import Foundation
import Photos
import UIKit

/// The engine behind the Dump tab: takes whole Photos albums and pushes every
/// asset to /api/drop, full resolution, in the background.
///
/// Two things shape this design:
///
/// 1. **It must survive leaving the app.** Sophie dumps 300 photos and then
///    locks her phone. So uploads run on a *background* URLSession, which the
///    system keeps going after the app is suspended or killed. A background
///    session can only upload from a FILE (not a data body) — that's why the
///    server takes a raw-body `/upload-file` rather than base64 JSON.
///
/// 2. **Exporting can't all happen up front.** Writing 300 full-res assets to
///    disk before uploading any of them would eat gigabytes. So the plan (a
///    list of asset ids) is persisted, and a worker keeps only a few files
///    exported at a time, topping up as uploads complete. If the app is
///    suspended mid-dump the in-flight uploads still finish; the rest of the
///    plan resumes on next launch.
@MainActor
final class DumpUploader: NSObject, ObservableObject {
    static let shared = DumpUploader()

    /// One asset waiting to go up. Stored, not held in memory, so a dump
    /// resumes after the app is killed.
    struct Job: Codable, Equatable {
        let assetID: String       // PHAsset localIdentifier
        let bundleName: String    // the album it came from — becomes the bundle
        let session: String       // which dump this belongs to
    }

    @Published private(set) var queued: [Job] = []
    @Published private(set) var inFlight = 0
    @Published private(set) var uploaded = 0
    @Published private(set) var failed = 0
    @Published private(set) var lastError: String?

    /// Total in the current dump, so the UI can show "38 of 214".
    @Published private(set) var total = 0

    var isRunning: Bool { !queued.isEmpty || inFlight > 0 }
    var done: Int { uploaded + failed }

    /// Keep a few files on disk at once — enough to keep the pipe full, not so
    /// many that a big dump fills the device.
    private let maxInFlight = 3

    private let defaultsKey = "dump.queue.v1"
    private let statsKey = "dump.stats.v1"

    static var store: UserDefaults { .standard }

    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.background(withIdentifier: "com.sageryza.imageforge.dump")
        // Deliberately NO sharedContainerIdentifier: that requires an App Group
        // entitlement, and setting one the app isn't entitled to throws at
        // session creation. The main app doesn't need it — only an extension
        // running a background session would, and the share extension uploads
        // in the foreground precisely to avoid adding that entitlement here.
        cfg.isDiscretionary = false          // she's waiting on this, don't defer it
        cfg.sessionSendsLaunchEvents = true
        cfg.timeoutIntervalForResource = 60 * 60 * 6   // a big clip on bad wifi
        return URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }()

    /// Maps a running task to the temp file to clean up when it finishes.
    private var taskFiles: [Int: URL] = [:]

    private override init() {
        super.init()
        load()
        // Touch the session so it reattaches to any tasks still running from a
        // previous launch, then keep working through whatever's left.
        session.getAllTasks { tasks in
            Task { @MainActor in
                self.inFlight = tasks.count
                self.pump()
            }
        }
    }

    // MARK: - Public

    /// Queue every asset in each album. Album name → bundle name, so her own
    /// labelling comes across for free and nothing has to be typed here.
    func add(albums: [DumpAlbum]) {
        let session = Self.newSessionID()
        var jobs: [Job] = []
        for album in albums {
            for assetID in album.assetIDs {
                jobs.append(Job(assetID: assetID, bundleName: album.title, session: session))
            }
        }
        guard !jobs.isEmpty else { return }
        if !isRunning { uploaded = 0; failed = 0; total = 0; lastError = nil }
        queued.append(contentsOf: jobs)
        total += jobs.count
        save()
        pump()
    }

    /// Drop everything still waiting. In-flight uploads are left to finish —
    /// cancelling mid-write would leave a partial file on the server.
    func cancelPending() {
        queued.removeAll()
        total = uploaded + failed + inFlight
        save()
    }

    func clearFinished() {
        guard !isRunning else { return }
        uploaded = 0; failed = 0; total = 0; lastError = nil
        save()
    }

    // MARK: - The worker

    private func pump() {
        while inFlight < maxInFlight, !queued.isEmpty {
            let job = queued.removeFirst()
            inFlight += 1
            save()
            Task { await self.start(job) }
        }
    }

    private func start(_ job: Job) async {
        do {
            let file = try await Self.export(assetID: job.assetID)
            var comps = URLComponents(string: MovieService.serverURL + "/api/drop/upload-file")!
            comps.queryItems = [
                .init(name: "session", value: job.session),
                .init(name: "bundle", value: job.bundleName),
                .init(name: "filename", value: file.lastPathComponent),
            ]
            var req = URLRequest(url: comps.url!)
            req.httpMethod = "POST"
            req.setValue(Self.contentType(for: file), forHTTPHeaderField: "Content-Type")
            let token = MovieService.studioToken
            if !token.isEmpty { req.setValue(token, forHTTPHeaderField: "x-studio-token") }

            let task = session.uploadTask(with: req, fromFile: file)
            taskFiles[task.taskIdentifier] = file
            task.resume()
        } catch {
            // Export failed (asset not downloaded from iCloud, or unreadable) —
            // count it and keep going rather than stalling the whole dump.
            finish(taskID: nil, file: nil, error: error)
        }
    }

    private func finish(taskID: Int?, file: URL?, error: Error?) {
        if let file { try? FileManager.default.removeItem(at: file) }
        if let taskID { taskFiles[taskID] = nil }
        inFlight = max(0, inFlight - 1)
        if let error {
            failed += 1
            lastError = error.localizedDescription
        } else {
            uploaded += 1
        }
        save()
        pump()
    }

    // MARK: - Exporting an asset to a file

    enum ExportError: LocalizedError {
        case missing, noResource
        var errorDescription: String? {
            switch self {
            case .missing:    return "That photo is no longer in the library."
            case .noResource: return "Couldn't read the original file."
            }
        }
    }

    /// Write an asset's ORIGINAL bytes to a temp file. Original, not a
    /// re-render: these can be listing photos, and nothing should be
    /// downscaled or recompressed on the way out. HEIC goes up as HEIC and the
    /// server converts it.
    nonisolated static func export(assetID: String) async throws -> URL {
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [assetID], options: nil).firstObject
        else { throw ExportError.missing }

        let resources = PHAssetResource.assetResources(for: asset)
        // Prefer the full-size original; fall back to whatever edited version
        // exists rather than failing.
        let wanted: [PHAssetResourceType] = asset.mediaType == .video
            ? [.video, .fullSizeVideo, .pairedVideo]
            : [.photo, .fullSizePhoto, .alternatePhoto]
        guard let resource = wanted.compactMap({ t in resources.first { $0.type == t } }).first
                ?? resources.first
        else { throw ExportError.noResource }

        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("dump", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let out = dir.appendingPathComponent(UUID().uuidString + "-" + resource.originalFilename)
        try? FileManager.default.removeItem(at: out)

        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true    // pull it back from iCloud if needed

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            PHAssetResourceManager.default().writeData(for: resource, toFile: out, options: options) { error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
        return out
    }

    nonisolated static func contentType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "jpg", "jpeg": return "image/jpeg"
        case "png":         return "image/png"
        case "heic":        return "image/heic"
        case "heif":        return "image/heif"
        case "webp":        return "image/webp"
        case "gif":         return "image/gif"
        case "mov":         return "video/quicktime"
        case "mp4", "m4v":  return "video/mp4"
        default:            return "application/octet-stream"  // server falls back to the filename
        }
    }

    static func newSessionID() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd-HHmm"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.string(from: Date())
    }

    // MARK: - Persistence

    private func save() {
        let d = Self.store
        d.set(try? JSONEncoder().encode(queued), forKey: defaultsKey)
        d.set([uploaded, failed, total], forKey: statsKey)
    }

    private func load() {
        let d = Self.store
        if let data = d.data(forKey: defaultsKey),
           let jobs = try? JSONDecoder().decode([Job].self, from: data) {
            queued = jobs
        }
        if let s = d.array(forKey: statsKey) as? [Int], s.count == 3 {
            uploaded = s[0]; failed = s[1]; total = s[2]
        }
    }
}

extension DumpUploader: URLSessionDataDelegate {
    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask,
                                didCompleteWithError error: Error?) {
        let id = task.taskIdentifier
        // A 4xx/5xx isn't an NSError — check the status line too, or a rejected
        // upload would silently count as a success.
        var failure = error
        if failure == nil, let http = task.response as? HTTPURLResponse, http.statusCode >= 400 {
            failure = NSError(domain: "Dump", code: http.statusCode, userInfo: [
                NSLocalizedDescriptionKey: "Server returned \(http.statusCode)",
            ])
        }
        Task { @MainActor in
            self.finish(taskID: id, file: self.taskFiles[id], error: failure)
        }
    }
}

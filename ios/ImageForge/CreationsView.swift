import SwiftUI
import UIKit
import Photos
import ImageIO             // CGImageSource — downsampling tiles as they decode
import FirebaseFirestore   // DocumentSnapshot — the paging cursor

/// What a save attempt actually did. `failed` carries Photos' own words — a
/// silent "Couldn't save" is undiagnosable, so the real message is surfaced.
enum PhotoSaveOutcome {
    case saved
    case denied                 // permission is off; only Settings can turn it on
    case failed(String)
}

/// Saves an image to the user's photo library, requesting add-only permission
/// first (needs NSPhotoLibraryAddUsageDescription in Info.plist). Reports back
/// on the main thread.
final class PhotoSaver {
    static let shared = PhotoSaver()

    /// `data` is the ORIGINAL downloaded bytes when we have them (that's what
    /// Photos is happiest with); `image` is the decoded fallback for formats it
    /// won't take — the gallery serves webp, which Photos rejects outright.
    func save(data: Data?, image: UIImage?, _ done: @escaping (PhotoSaveOutcome) -> Void) {
        let finish: (PhotoSaveOutcome) -> Void = { r in DispatchQueue.main.async { done(r) } }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { finish(.denied); return }
            guard let (bytes, ext) = Self.acceptableBytes(data: data, image: image) else {
                finish(.failed("that image couldn't be converted")); return
            }
            // Photos takes a FILE far more reliably than a raw data resource
            // (a data resource fails without a useful reason on some formats),
            // so stage the bytes in tmp and hand over the URL. shouldMoveFile
            // lets Photos consume the file, so there's nothing to clean up.
            let tmp = FileManager.default.temporaryDirectory
                .appendingPathComponent("save-\(UUID().uuidString).\(ext)")
            do { try bytes.write(to: tmp, options: .atomic) }
            catch { finish(.failed(error.localizedDescription)); return }
            let opts = PHAssetResourceCreationOptions()
            opts.shouldMoveFile = true
            PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.forAsset().addResource(with: .photo, fileURL: tmp, options: opts)
            } completionHandler: { ok, error in
                try? FileManager.default.removeItem(at: tmp)   // no-op once moved
                finish(ok ? .saved : .failed(error?.localizedDescription ?? "Photos refused the image"))
            }
        }
    }

    /// The first form of the picture Photos will actually accept: the original
    /// bytes when they're already PNG/JPEG/HEIC, otherwise a PNG (then JPEG)
    /// re-encode of the decoded image.
    private static func acceptableBytes(data: Data?, image: UIImage?) -> (Data, String)? {
        if let data, let ext = nativeExtension(of: data) { return (data, ext) }
        guard let image else { return nil }
        if let png = image.pngData() { return (png, "png") }
        if let jpg = image.jpegData(compressionQuality: 0.95) { return (jpg, "jpg") }
        return nil
    }

    /// Sniff the container from its magic bytes — the URL's extension lies often
    /// enough (Storage serves plenty of `.png` names that aren't).
    private static func nativeExtension(of data: Data) -> String? {
        let b = [UInt8](data.prefix(12))
        guard b.count >= 12 else { return nil }
        if b[0] == 0x89, b[1] == 0x50, b[2] == 0x4E, b[3] == 0x47 { return "png" }
        if b[0] == 0xFF, b[1] == 0xD8, b[2] == 0xFF { return "jpg" }
        // ftyp box: HEIC/HEIF. RIFF….WEBP is deliberately NOT here — Photos
        // rejects webp, so it falls through to the re-encode.
        if b[4] == 0x66, b[5] == 0x74, b[6] == 0x79, b[7] == 0x70 {
            let brand = String(bytes: b[8..<12], encoding: .ascii) ?? ""
            if brand.hasPrefix("hei") || brand.hasPrefix("mif") || brand.hasPrefix("msf") { return "heic" }
        }
        return nil
    }
}

/// Saves a VIDEO to the photo library. Photos wants a real file on disk with a
/// video resource — it will not take a remote URL and it will not take decoded
/// frames — so the clip is downloaded to tmp first and handed over with
/// `shouldMoveFile`, exactly the way `PhotoSaver` hands over image bytes.
///
/// Built Aug 2026, when Sophie pointed out that a clip she animated in Movies
/// had nowhere to go: "there's no download button and they don't appear in my
/// creations". Anything in the app that plays a clip saves it through here, so
/// there is one download path and one set of failure messages.
final class VideoSaver {
    static let shared = VideoSaver()

    func save(from url: URL, _ done: @escaping (PhotoSaveOutcome) -> Void) {
        let finish: (PhotoSaveOutcome) -> Void = { r in DispatchQueue.main.async { done(r) } }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { finish(.denied); return }
            // Keep the real extension where there is one: Photos reads the
            // container off the file, and a clip named `.dat` is refused.
            let ext = url.pathExtension.isEmpty ? "mp4" : url.pathExtension
            let tmp = FileManager.default.temporaryDirectory
                .appendingPathComponent("clip-\(UUID().uuidString).\(ext)")
            URLSession.shared.downloadTask(with: url) { located, _, error in
                guard let located else {
                    finish(.failed(error?.localizedDescription ?? "couldn’t download that clip")); return
                }
                // The download's own temp file is deleted the moment this
                // callback returns, so it has to be moved before anything else.
                do { try FileManager.default.moveItem(at: located, to: tmp) }
                catch { finish(.failed(error.localizedDescription)); return }
                let opts = PHAssetResourceCreationOptions()
                opts.shouldMoveFile = true
                PHPhotoLibrary.shared().performChanges {
                    PHAssetCreationRequest.forAsset().addResource(with: .video, fileURL: tmp, options: opts)
                } completionHandler: { ok, err in
                    try? FileManager.default.removeItem(at: tmp)   // no-op once moved
                    finish(ok ? .saved : .failed(err?.localizedDescription ?? "Photos refused the video"))
                }
            }.resume()
        }
    }
}

/// A grid of everything you've made. Reads the server-saved creations list, so
/// generations show up here even if a connection dropped or the app was
/// backgrounded mid-generation.
struct CreationsView: View {
    @State private var creations: [Creation] = []
    @State private var loading = true
    /// Where the next page starts, and whether there is one. The grid used to
    /// be a single 60-item query with no way to ask for more, so everything
    /// older than the newest 60 was unreachable.
    @State private var cursor: DocumentSnapshot?
    @State private var hasMore = false
    @State private var loadingMore = false
    @State private var errorText: String?
    @State private var preview: Creation?
    @State private var filter: String? = nil   // nil = show everything
    @State private var editable: EditableSheet?
    @State private var openingEditor = false
    @State private var toast: String?
    @State private var photosDenied = false
    @Environment(\.openTool) private var openTool

    private let grid = [GridItem(.adaptive(minimum: 110), spacing: 10)]

    /// A saved sheet pulled back out for editing: its image + re-detected boxes.
    struct EditableSheet: Identifiable {
        let id = UUID()
        let creationURL: URL
        let image: UIImage
        let boxes: [StickerBox]
    }

    /// Types present in the user's creations, in a friendly fixed order.
    private var types: [String] {
        let present = Set(creations.map { $0.type })
        let order = ["sticker", "coloring", "storybook", "card", "dream", "instagram", "clip", "film"]
        var out = order.filter { present.contains($0) }
        for t in present.sorted() where !out.contains(t) { out.append(t) }
        return out
    }

    private var filtered: [Creation] {
        guard let f = filter else { return creations }
        return creations.filter { $0.type == f }
    }

    var body: some View {
        VStack(spacing: 0) {
            if types.count > 1 { filterBar }
            ScrollView {
                if loading && creations.isEmpty {
                    ProgressView().padding(.top, 60)
                } else if creations.isEmpty {
                    emptyState(title: "Nothing yet",
                               subtitle: "Sheets and pages you make show up here.")
                } else if filtered.isEmpty {
                    emptyState(title: "None of those yet",
                               subtitle: "Nothing in this category — try another filter.")
                } else {
                    // Explicit VStack: the grid and the Older button below it are
                    // two views, and the grid stays lazy inside it.
                    VStack(spacing: 0) {
                        LazyVGrid(columns: grid, spacing: 10) {
                            ForEach(filtered) { c in
                                Button {
                                    AutoScrollDriver.shared.stop()   // stop autoscroll on tap
                                    preview = c
                                } label: { tile(c) }
                                    .buttonStyle(.plain)
                            }
                        }
                        .padding()
                        olderButton
                    }
                }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        // The standard tool header: eyebrow title in the bar, back chevron
        // top-left (previous screen).
        .forgeToolBar("My Creations")
        // While the image popup is open, hide the nav bar so its dim backdrop
        // covers the WHOLE screen — otherwise the nav-bar strip at the top
        // swallows taps and you can only dismiss by tapping the lower half.
        .toolbar(preview == nil ? .visible : .hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise") }
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .alert("Couldn't load",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        // Permission was refused at some point: the request returns instantly
        // from then on and never shows the system prompt again, so the only way
        // back is Settings.
        .alert("Photos access is off", isPresented: $photosDenied) {
            Button("Open Settings") {
                if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
            }
            Button("Not now", role: .cancel) { }
        } message: {
            Text("Turn on “Add Photos Only” for ImageForge to save pictures and clips to your library.")
        }
        .overlay { previewPopup }
        .overlay(alignment: .bottom) { toastView }
        .fullScreenCover(item: $editable) { e in
            StickerEditor(
                sheetImage: e.image,
                boxes: e.boxes,
                onClose: { editable = nil },
                onSaved: { _ in Task { await load() } })   // edited copy → refresh grid
        }
        .overlay {
            if openingEditor {
                ZStack {
                    Color.black.opacity(0.25).ignoresSafeArea()
                    ProgressView("Opening editor…").padding(20)
                        .background(Theme.surface).cornerRadius(Theme.radiusLg)
                }
            }
        }
    }

    // Horizontal row of rounded-rect filter chips (no pills): All + one per type.
    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("All", active: filter == nil) { filter = nil }
                ForEach(types, id: \.self) { t in
                    chip(Self.typeLabel(t), active: filter == t) { filter = t }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
    }

    private func chip(_ label: String, active: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundColor(active ? .white : Theme.text)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(active ? Theme.mauve : Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                    .stroke(active ? Color.clear : Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func emptyState(title: String, subtitle: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "square.grid.2x2")
                .font(.system(size: 34)).foregroundColor(Theme.textDim)
            Text(title).font(.headline).foregroundColor(Theme.text)
            Text(subtitle).font(.caption).foregroundColor(Theme.textDim)
        }
        .frame(maxWidth: .infinity).padding(.top, 60)
    }

    /// Friendly label for a stored creation type.
    static func typeLabel(_ t: String) -> String {
        switch t {
        case "sticker":   return "Stickers"
        case "coloring":  return "Coloring"
        case "storybook": return "Storybook"
        case "card":      return "Cards"
        case "dream":     return "Dreams"
        case "instagram": return "Instagram"
        case "clip":      return "Clips"
        case "film":      return "Films"
        default:          return t.capitalized
        }
    }

    /// The way further back. Deliberately a TAP, not load-on-scroll: this
    /// screen carries the autoscroll pill, which would run to the bottom by
    /// itself and pull page after page of full-size pictures over her data
    /// without her having asked for any of them.
    @ViewBuilder private var olderButton: some View {
        // Shown under a filter too: hiding it there would put older stickers
        // (or dreams, or cards) permanently out of reach, which is the very
        // thing this fixes. A page with none of the filtered type just leaves
        // the button sitting there to tap again — never a dead end.
        if hasMore {
            Button { Task { await loadMore() } } label: {
                Text(loadingMore ? "Loading…" : "Older")
                    .font(.subheadline)
                    .foregroundColor(Theme.textDim)
                    .padding(.vertical, 9).padding(.horizontal, 18)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))
            }
            .disabled(loadingMore)
            .padding(.bottom, 24)
        }
    }

    private func tile(_ c: Creation) -> some View {
        // Uniform square tile: the cell is a square sized to the grid column, and
        // the image fills it (center-cropped). Any aspect ratio — square, wide
        // banner, or tall — tiles cleanly instead of breaking the grid.
        //
        // `maxPixel` is what makes paging safe: a tile decoded at full size is a
        // ~1024x1536 bitmap (~6MB in memory), so a few hundred of them is a
        // gigabyte of decoded pictures. At tile size it is ~0.4MB.
        Color.white
            .aspectRatio(1, contentMode: .fit)
            // A video tiles as its POSTER — the panel it was animated from.
            // There is no frame to decode out of an mp4 here, so a clip with no
            // poster on file would be a blank white square.
            .overlay(CachedImageView(url: c.thumbURL, contentMode: .fill, maxPixel: 400))
            .overlay(alignment: .bottomTrailing) {
                if c.isVideo {
                    Image(systemName: "play.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(Color.black.opacity(0.55)))
                        .padding(6)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
    }

    // Centered popup module (a framed card on a dimmed backdrop) instead of a
    // bottom sheet. Tap the backdrop or the ✕ to close; one Save button at the
    // top downloads the image straight to Photos.
    @ViewBuilder private var previewPopup: some View {
        if let c = preview {
            ZStack {
                Color.black.opacity(0.55).ignoresSafeArea()
                    .onTapGesture { preview = nil }
                VStack(spacing: 12) {
                    HStack {
                        Button { savePreview(c) } label: {
                            Label("Save", systemImage: "arrow.down.to.line")
                                .font(.subheadline.weight(.semibold))
                        }
                        // The other way out: Files, AirDrop, Messages. A clip
                        // is the case that needs it — Photos is not always
                        // where a piece of footage is wanted next.
                        ShareLink(item: c.url) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .padding(.leading, 14)
                        Spacer()
                        Button { preview = nil } label: {
                            Image(systemName: "xmark").font(.system(size: 15, weight: .semibold))
                        }
                    }
                    .tint(Theme.accent)

                    if c.isVideo {
                        MoviePlayer(url: c.url)
                            .frame(maxWidth: .infinity)
                            .frame(height: 260)
                            .background(Color.black)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                    } else {
                        CachedImageView(url: c.url, contentMode: .fit)
                            .frame(maxWidth: .infinity)
                            .frame(maxHeight: 420)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                    }

                    // What made it — model · quality. First line of the caption,
                    // because it's the thing she's checking when she opens one.
                    if let made = c.madeWith {
                        Text(made)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(Theme.text)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let p = c.prompt, !p.isEmpty {
                        Text(p).font(.caption).foregroundColor(Theme.textDim)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    // Re-run or remix: jump to the Playground with this
                    // generation's prompt, style and quality already set.
                    if let q = playgroundQuery(c) {
                        Button {
                            PlaygroundPrefill.pending = q
                            preview = nil
                            openTool(.playground)
                        } label: {
                            Label("Open in Playground", systemImage: "paintpalette")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity).frame(height: 46)
                                .background(Theme.accent)
                                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                        }
                        .buttonStyle(.plain)
                    }
                    if c.type == "sticker" {
                        Button { openForEdit(c) } label: {
                            Label("Edit stickers", systemImage: "wand.and.stars")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity).frame(height: 46)
                                .background(Theme.mauve)
                                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
                .frame(maxWidth: 360)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
                .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.25), radius: 20, y: 8)
                .padding(24)
            }
        }
    }

    @ViewBuilder private var toastView: some View {
        if let t = toast {
            Text(t)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Theme.text.opacity(0.9))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .padding(.bottom, 40)
                .transition(.opacity)
        }
    }

    /// Download the image (from cache when we have it) and save it to Photos.
    /// Requests add-only permission if needed; reports the real outcome.
    private func savePreview(_ c: Creation) {
        // Say something the instant it's tapped: the download + the permission
        // round trip take a moment, and a silent button reads as a dead one.
        // A clip is downloaded to a file and handed to Photos as a video
        // resource — none of the image path below applies to it, and a few MB
        // of footage takes longer to land than a picture does.
        if c.isVideo {
            showToast("Saving…", seconds: 30)
            VideoSaver.shared.save(from: c.url) { outcome in report(outcome) }
            return
        }
        showToast("Saving…", seconds: 20)
        Task {
            // Prefer the bytes exactly as they were downloaded — Photos takes a
            // real PNG/JPEG straight, and re-encoding is only a fallback.
            var bytes = ImageCache.data(for: c.url)
            var image = ImageCache.image(for: c.url)
            if bytes == nil, let (data, _) = try? await URLSession.shared.data(from: c.url) {
                bytes = data
                image = UIImage(data: data)
                if let image { ImageCache.store(data, image, for: c.url) }
            }
            if image == nil, let bytes { image = UIImage(data: bytes) }
            guard bytes != nil || image != nil else {
                await MainActor.run { showToast("Couldn’t load that image") }
                return
            }
            PhotoSaver.shared.save(data: bytes, image: image) { outcome in report(outcome) }
        }
    }

    /// One place both save paths land, so a clip and a picture fail the same
    /// way. `denied` is deliberately NOT a toast: once permission is off
    /// nothing inside the app can turn it back on, so it raises the alert that
    /// offers Settings — the one door that works.
    private func report(_ outcome: PhotoSaveOutcome) {
        switch outcome {
        case .saved:            showToast("Saved to Photos")
        case .denied:           withAnimation { toast = nil }; photosDenied = true
        case .failed(let why):  showToast("Couldn’t save — \(why)", seconds: 4)
        }
    }

    /// The generation's settings as a Playground query, so "Open in
    /// Playground" lands with prompt, style and quality prefilled. Only for
    /// plain images with a prompt on file — sticker sheets, dreams and the
    /// rest have their own tools.
    private func playgroundQuery(_ c: Creation) -> String? {
        guard c.type == "image", let prompt = c.prompt, !prompt.isEmpty else { return nil }
        let made = [c.model, c.style].compactMap { $0 }.joined(separator: " ").lowercased()
        let style = made.contains("hoonie") ? "hoonie"
            : (made.contains("watercolor") || made.contains("wtr")) ? "watercolor"
            : "chatgpt"
        var items = [URLQueryItem(name: "prompt", value: prompt),
                     URLQueryItem(name: "style", value: style)]
        var quality = c.quality
        if quality == nil, let s = c.style?.lowercased() {
            quality = ["low", "medium", "high"].first { s.contains($0) }
        }
        if let q = quality { items.append(URLQueryItem(name: "quality", value: q)) }
        var comp = URLComponents()
        comp.queryItems = items
        return comp.percentEncodedQuery
    }

    private func showToast(_ message: String, seconds: Double = 1.8) {
        withAnimation { toast = message }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            withAnimation { if toast == message { toast = nil } }
        }
    }

    /// Pull a saved sheet back out: download it, re-detect the sticker boxes
    /// (off the main thread), then open the tap-to-redo editor.
    private func openForEdit(_ c: Creation) {
        guard !openingEditor else { return }
        let url = c.url
        preview = nil
        openingEditor = true
        Task {
            defer { openingEditor = false }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard let img = UIImage(data: data) else {
                    errorText = "Couldn't open that sheet."; return
                }
                let boxes = await Task.detached(priority: .userInitiated) {
                    StickerSegmenter.boxes(from: img)
                }.value
                guard !boxes.isEmpty else {
                    errorText = "Couldn't pick out individual stickers on this sheet."; return
                }
                editable = EditableSheet(creationURL: url, image: img, boxes: boxes)
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    /// Refresh from the top. Resets paging — pull-to-refresh means "start
    /// again", and keeping a stale cursor would page from the wrong place.
    private func load() async {
        loading = true
        do {
            let page = try await ForgeService.shared.fetchCreationPage()
            creations = page.items
            cursor = page.cursor
            hasMore = page.hasMore
            if let f = filter, !creations.contains(where: { $0.type == f }) { filter = nil }
        }
        catch { errorText = error.localizedDescription }
        loading = false
    }

    /// One more page, behind the oldest creation held.
    private func loadMore() async {
        guard !loadingMore, let after = cursor else { return }
        loadingMore = true
        do {
            let page = try await ForgeService.shared.fetchCreationPage(after: after)
            // Guard against a doc arriving twice — a creation written while she
            // was reading shifts the window, and ForEach traps on duplicate ids.
            let known = Set(creations.map(\.id))
            creations += page.items.filter { !known.contains($0.id) }
            cursor = page.cursor
            hasMore = page.hasMore
        }
        catch { errorText = error.localizedDescription }
        loadingMore = false
    }
}

/// Two-layer image cache: an in-memory `NSCache` for instant reuse this session,
/// plus a persistent **disk** copy in the Caches directory so images survive the
/// app being closed and reopened (the memory cache alone is wiped on every
/// launch, which made every picture re-download each time the app opened).
enum ImageCache {
    static let shared: NSCache<NSURL, UIImage> = {
        let c = NSCache<NSURL, UIImage>()
        // BOUNDED, because the grid is paged now. Unbounded, a few hundred
        // full-size decodes (~6MB each at 1024x1536 RGBA) is more memory than
        // the app is allowed to have. Cost is the decoded byte count, set by
        // `store`; NSCache evicts the least useful when the limit is passed.
        c.totalCostLimit = 96 * 1024 * 1024
        return c
    }()

    /// Downsampled copies for the grid, kept apart from the full-size ones so a
    /// tile can never evict the picture the popup is showing (or vice versa).
    static let thumbs: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.totalCostLimit = 48 * 1024 * 1024
        return c
    }()

    private static let dir: URL = {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("imgcache", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    /// Stable (process-independent) filename for a URL — FNV-1a hash as hex.
    /// `String.hashValue` is randomized per launch, so it CANNOT be used here or
    /// the disk cache would never hit after a restart.
    private static func fileURL(for url: URL) -> URL {
        var h: UInt64 = 1469598103934665603
        for b in url.absoluteString.utf8 { h = (h ^ UInt64(b)) &* 1099511628211 }
        return dir.appendingPathComponent(String(h, radix: 16))
    }

    /// Roughly what holding this decoded image costs, for the cache's budget.
    private static func cost(_ img: UIImage) -> Int {
        guard let cg = img.cgImage else { return 1 }
        return cg.bytesPerRow * cg.height
    }

    /// Decode `data` straight to `maxPixel` on its longest side.
    /// `CGImageSourceCreateThumbnailAtIndex` never materialises the full-size
    /// bitmap on the way — decoding first and resizing after would spend exactly
    /// the memory this exists to avoid.
    ///
    /// Falls back to a plain full-size decode if ImageIO won't thumbnail this
    /// data. These urls are a mix of png, webp and jpeg, and a picture that
    /// costs extra memory is still far better than a broken tile.
    static func downsample(_ data: Data, maxPixel: Int) -> UIImage? {
        guard let src = CGImageSourceCreateWithData(data as CFData,
                                                    [kCGImageSourceShouldCache: false] as CFDictionary)
        else { return UIImage(data: data) }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
        else { return UIImage(data: data) }
        return UIImage(cgImage: cg)
    }

    /// A tile-sized copy: memory, then the original bytes on disk, then nil
    /// (the caller downloads). Keyed by url AND size, so two sizes can coexist.
    static func thumb(for url: URL, maxPixel: Int) -> UIImage? {
        let key = "\(maxPixel)|\(url.absoluteString)" as NSString
        if let m = thumbs.object(forKey: key) { return m }
        guard let data = try? Data(contentsOf: fileURL(for: url)),
              let img = downsample(data, maxPixel: maxPixel) else { return nil }
        thumbs.setObject(img, forKey: key, cost: cost(img))
        return img
    }

    static func storeThumb(_ img: UIImage, for url: URL, maxPixel: Int) {
        thumbs.setObject(img, forKey: "\(maxPixel)|\(url.absoluteString)" as NSString, cost: cost(img))
    }

    /// The bytes exactly as they were downloaded, if this URL is on disk. Saving
    /// to Photos wants the original container, not a re-encode of the decode.
    static func data(for url: URL) -> Data? {
        try? Data(contentsOf: fileURL(for: url))
    }

    /// Look up an image: memory first, then disk (promoting it back to memory).
    static func image(for url: URL) -> UIImage? {
        if let m = shared.object(forKey: url as NSURL) { return m }
        if let data = try? Data(contentsOf: fileURL(for: url)), let img = UIImage(data: data) {
            shared.setObject(img, forKey: url as NSURL)
            return img
        }
        return nil
    }

    /// Store an image in both layers (raw bytes to disk so decoding is lossless).
    static func store(_ data: Data, _ img: UIImage, for url: URL) {
        shared.setObject(img, forKey: url as NSURL, cost: cost(img))
        try? data.write(to: fileURL(for: url), options: .atomic)
    }

    /// Keep the downloaded bytes without holding the full-size decode — what a
    /// tile wants: the popup and Save-to-Photos still find the original later.
    static func storeData(_ data: Data, for url: URL) {
        try? data.write(to: fileURL(for: url), options: .atomic)
    }
}

/// Loads a remote image once, caches the decoded `UIImage`, and reuses it on
/// every later request for the same URL.
///
/// Pass `maxPixel` where the image is shown small (a grid tile): it decodes to
/// that size instead of full resolution, which is roughly 15x less memory per
/// picture and is what lets the grid page back through hundreds of them. Leave
/// it nil for anything shown large — the popup, a dream page.
struct CachedImageView: View {
    let url: URL
    var contentMode: ContentMode = .fill
    var maxPixel: Int? = nil
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
            } else if failed {
                Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
            } else {
                ProgressView()
            }
        }
        .task(id: url) { await load() }
    }

    private func load() async {
        if let maxPixel {
            if let t = ImageCache.thumb(for: url, maxPixel: maxPixel) { image = t; return }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                // Bytes to disk, but only the SMALL decode is kept in memory —
                // the whole point of the tile path.
                ImageCache.storeData(data, for: url)
                guard let img = ImageCache.downsample(data, maxPixel: maxPixel) else { failed = true; return }
                ImageCache.storeThumb(img, for: url, maxPixel: maxPixel)
                image = img
            } catch { failed = true }
            return
        }
        if let cached = ImageCache.image(for: url) {
            image = cached; return
        }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let img = UIImage(data: data) {
                ImageCache.store(data, img, for: url)
                image = img
            } else { failed = true }
        } catch { failed = true }
    }
}

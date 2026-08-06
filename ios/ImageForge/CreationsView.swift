import SwiftUI
import UIKit
import Photos

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

/// A grid of everything you've made. Reads the server-saved creations list, so
/// generations show up here even if a connection dropped or the app was
/// backgrounded mid-generation.
struct CreationsView: View {
    @State private var creations: [Creation] = []
    @State private var loading = true
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
        let order = ["sticker", "coloring", "storybook", "card", "dream", "instagram"]
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
            Text("Turn on “Add Photos Only” for ImageForge to save pictures to your library.")
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
        default:          return t.capitalized
        }
    }

    private func tile(_ c: Creation) -> some View {
        // Uniform square tile: the cell is a square sized to the grid column, and
        // the image fills it (center-cropped). Any aspect ratio — square, wide
        // banner, or tall — tiles cleanly instead of breaking the grid.
        Color.white
            .aspectRatio(1, contentMode: .fit)
            .overlay(CachedImageView(url: c.url, contentMode: .fill))
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
                        Spacer()
                        Button { preview = nil } label: {
                            Image(systemName: "xmark").font(.system(size: 15, weight: .semibold))
                        }
                    }
                    .tint(Theme.accent)

                    CachedImageView(url: c.url, contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .frame(maxHeight: 420)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radius))

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
            PhotoSaver.shared.save(data: bytes, image: image) { outcome in
                switch outcome {
                case .saved:            showToast("Saved to Photos")
                // A toast for this was too easy to miss — once permission is
                // off, nothing inside the app can turn it back on, so say so
                // and offer the one door that works.
                case .denied:           withAnimation { toast = nil }; photosDenied = true
                case .failed(let why):  showToast("Couldn’t save — \(why)", seconds: 4)
                }
            }
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

    private func load() async {
        loading = true
        do {
            creations = try await ForgeService.shared.fetchCreations()
            if let f = filter, !creations.contains(where: { $0.type == f }) { filter = nil }
        }
        catch { errorText = error.localizedDescription }
        loading = false
    }
}

/// Two-layer image cache: an in-memory `NSCache` for instant reuse this session,
/// plus a persistent **disk** copy in the Caches directory so images survive the
/// app being closed and reopened (the memory cache alone is wiped on every
/// launch, which made every picture re-download each time the app opened).
enum ImageCache {
    static let shared = NSCache<NSURL, UIImage>()

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
        shared.setObject(img, forKey: url as NSURL)
        try? data.write(to: fileURL(for: url), options: .atomic)
    }
}

/// Loads a remote image once, caches the decoded `UIImage`, and reuses it on
/// every later request for the same URL.
struct CachedImageView: View {
    let url: URL
    var contentMode: ContentMode = .fill
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

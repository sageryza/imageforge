import SwiftUI
import UIKit
import Photos

/// Saves an image to the user's photo library, requesting add-only permission
/// first (needs NSPhotoLibraryAddUsageDescription in Info.plist). Reports back
/// on the main thread: (saved, deniedPermission).
final class PhotoSaver {
    static let shared = PhotoSaver()
    func save(_ image: UIImage, _ done: @escaping (_ ok: Bool, _ denied: Bool) -> Void) {
        let finish: (Bool, Bool) -> Void = { ok, denied in DispatchQueue.main.async { done(ok, denied) } }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { finish(false, true); return }
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            } completionHandler: { ok, _ in finish(ok, false) }
        }
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
        .navigationTitle("My Creations")
        .navigationBarTitleDisplayMode(.inline)
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

                    if let p = c.prompt, !p.isEmpty {
                        Text(p).font(.caption).foregroundColor(Theme.textDim)
                            .frame(maxWidth: .infinity, alignment: .leading)
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
        Task {
            var image = ImageCache.shared.object(forKey: c.url as NSURL)
            if image == nil, let (data, _) = try? await URLSession.shared.data(from: c.url) {
                image = UIImage(data: data)
            }
            guard let image else { showToast("Couldn’t load that image"); return }
            PhotoSaver.shared.save(image) { ok, denied in
                showToast(ok ? "Saved to Photos" : (denied ? "Allow Photos access in Settings" : "Couldn’t save"))
            }
        }
    }

    private func showToast(_ message: String) {
        withAnimation { toast = message }
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            withAnimation { toast = nil }
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

/// In-memory cache of decoded images, so the grid tile and the preview popup
/// share one download and re-opening the same image shows instantly.
enum ImageCache {
    static let shared = NSCache<NSURL, UIImage>()
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
        if let cached = ImageCache.shared.object(forKey: url as NSURL) {
            image = cached; return
        }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let img = UIImage(data: data) {
                ImageCache.shared.setObject(img, forKey: url as NSURL)
                image = img
            } else { failed = true }
        } catch { failed = true }
    }
}

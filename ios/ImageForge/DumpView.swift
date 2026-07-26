import SwiftUI
import Photos

/// One Photos album, ready to dump. Its title becomes the bundle name, so
/// Sophie's own album labels carry through with nothing to type.
struct DumpAlbum: Identifiable, Equatable {
    let id: String
    let title: String
    let count: Int
    let assetIDs: [String]
    let coverID: String?      // first photo in the album — the Apple-style thumbnail

    static func == (a: DumpAlbum, b: DumpAlbum) -> Bool { a.id == b.id }
}

@MainActor
final class DumpAlbums: ObservableObject {
    @Published var albums: [DumpAlbum] = []
    @Published var status: PHAuthorizationStatus = .notDetermined
    @Published var loading = false

    func load() async {
        status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if status == .notDetermined {
            status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        }
        guard status == .authorized || status == .limited else { return }
        loading = true
        let found = await Task.detached(priority: .userInitiated) { Self.fetch() }.value
        albums = found
        loading = false
    }

    /// Her own albums only — not smart albums like Recents or Favorites. The
    /// whole premise is "each thing is its own album," and that's what user
    /// albums are.
    nonisolated private static func fetch() -> [DumpAlbum] {
        let collections = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: nil)
        var out: [DumpAlbum] = []
        collections.enumerateObjects { collection, _, _ in
            let opts = PHFetchOptions()
            opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
            let assets = PHAsset.fetchAssets(in: collection, options: opts)
            guard assets.count > 0 else { return }   // empty albums are noise
            var ids: [String] = []
            ids.reserveCapacity(assets.count)
            assets.enumerateObjects { asset, _, _ in ids.append(asset.localIdentifier) }
            out.append(DumpAlbum(
                id: collection.localIdentifier,
                title: collection.localizedTitle ?? "Untitled",
                count: assets.count,
                assetIDs: ids,
                coverID: ids.first
            ))
        }
        return out.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }
}

/// The Dump: pick whole albums, tap once, they go up in the background.
/// Deliberately has no naming, typing, or sorting — labelling is a later pass.
struct DumpView: View {
    @StateObject private var library = DumpAlbums()
    @ObservedObject private var uploader = DumpUploader.shared
    @State private var selected: Set<String> = []

    private let grid = [GridItem(.adaptive(minimum: 104), spacing: 10)]

    var body: some View {
        VStack(spacing: 0) {
            if uploader.isRunning || uploader.done > 0 { progressBar }
            content
        }
        .background(Theme.bg.ignoresSafeArea())
        .task { await library.load() }
    }

    // MARK: - Progress

    private var progressBar: some View {
        VStack(spacing: 6) {
            HStack {
                Text(uploader.isRunning
                     ? "Sending \(uploader.done) of \(uploader.total)"
                     : "Sent \(uploader.uploaded) of \(uploader.total)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(Theme.text)
                Spacer()
                if uploader.isRunning {
                    Button("Stop") { uploader.cancelPending() }
                        .font(.subheadline).foregroundColor(Theme.danger)
                } else {
                    Button("Clear") { uploader.clearFinished() }
                        .font(.subheadline).foregroundColor(Theme.textDim)
                }
            }
            ProgressView(value: Double(uploader.done),
                         total: Double(max(uploader.total, 1)))
                .tint(Theme.accent)
            if uploader.failed > 0 {
                Text("\(uploader.failed) didn't make it\(uploader.lastError.map { " — \($0)" } ?? "")")
                    .font(.caption).foregroundColor(Theme.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if uploader.isRunning {
                Text("Keeps going if you leave the app.")
                    .font(.caption).foregroundColor(Theme.textDim)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(12)
        .background(Theme.surface)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.border), alignment: .bottom)
    }

    // MARK: - Body states

    @ViewBuilder private var content: some View {
        switch library.status {
        case .denied, .restricted:
            message("""
                Deck Factory can't see your photos yet.

                Settings ▸ Deck Factory ▸ Photos ▸ All Photos, then come back.
                """)
        case .limited:
            // Limited access hands over a hand-picked set with no albums at
            // all, so the whole screen is empty and looks broken. Say why.
            message("""
                You picked "Select Photos…", which hides your albums from the app.

                Settings ▸ Deck Factory ▸ Photos ▸ All Photos to dump whole albums.
                """)
        default:
            if library.loading {
                ProgressView().frame(maxHeight: .infinity)
            } else if library.albums.isEmpty {
                message("No albums yet. Make one in Photos and it'll show up here.")
            } else {
                albumGrid
            }
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.callout)
            .foregroundColor(Theme.textDim)
            .multilineTextAlignment(.center)
            .padding(28)
            .frame(maxHeight: .infinity)
    }

    private var albumGrid: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVGrid(columns: grid, spacing: 10) {
                    ForEach(library.albums) { album in
                        Button {
                            if selected.contains(album.id) { selected.remove(album.id) }
                            else { selected.insert(album.id) }
                        } label: {
                            AlbumTile(album: album, picked: selected.contains(album.id))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(12)
            }
            sendBar
        }
    }

    private var sendBar: some View {
        VStack(spacing: 0) {
            Divider().background(Theme.border)
            Button {
                let picked = library.albums.filter { selected.contains($0.id) }
                uploader.add(albums: picked)
                selected.removeAll()
            } label: {
                Text(sendLabel)
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(selected.isEmpty ? Theme.accentDim : Theme.accent)
                    .cornerRadius(Theme.radius)   // rounded rectangle, never a pill
            }
            .buttonStyle(.plain)
            .disabled(selected.isEmpty)
            .padding(12)
        }
        .background(Theme.surface)
    }

    private var sendLabel: String {
        let albums = library.albums.filter { selected.contains($0.id) }
        let files = albums.reduce(0) { $0 + $1.count }
        if albums.isEmpty { return "Pick albums to dump" }
        return "Dump \(albums.count) album\(albums.count == 1 ? "" : "s") · \(files) file\(files == 1 ? "" : "s")"
    }
}

/// An album as a square cover with its name — the shape Photos itself uses, so
/// it reads as the same thing she just came from.
private struct AlbumTile: View {
    let album: DumpAlbum
    let picked: Bool
    @State private var cover: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack(alignment: .topTrailing) {
                Group {
                    if let cover {
                        Image(uiImage: cover).resizable().scaledToFill()
                    } else {
                        Rectangle().foregroundColor(Theme.surface2)
                    }
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)
                .clipped()
                .cornerRadius(Theme.radius)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radius)
                        .stroke(picked ? Theme.accent : Theme.border, lineWidth: picked ? 3 : 1)
                )

                if picked {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.white)
                        .background(Circle().fill(Theme.accent))
                        .padding(6)
                }
            }
            Text(album.title)
                .font(.caption.weight(.semibold))
                .foregroundColor(Theme.text)
                .lineLimit(2, reservesSpace: true)      // keeps rows aligned
            Text("\(album.count)")
                .font(.caption2)
                .foregroundColor(Theme.textDim)
        }
        .task { await loadCover() }
    }

    private func loadCover() async {
        guard cover == nil, let id = album.coverID,
              let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject
        else { return }
        let opts = PHImageRequestOptions()
        opts.isNetworkAccessAllowed = true
        opts.deliveryMode = .opportunistic
        opts.resizeMode = .fast
        let size = CGSize(width: 300, height: 300)
        cover = await withCheckedContinuation { (cont: CheckedContinuation<UIImage?, Never>) in
            var resumed = false
            PHImageManager.default().requestImage(for: asset, targetSize: size,
                                                  contentMode: .aspectFill, options: opts) { image, info in
                // Opportunistic delivery calls back more than once (a blurry
                // placeholder, then the real thing) — only resume on the last.
                let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
                guard !degraded, !resumed else { return }
                resumed = true
                cont.resume(returning: image)
            }
        }
    }
}

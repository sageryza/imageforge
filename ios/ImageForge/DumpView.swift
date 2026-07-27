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

/// A Photos folder. Her albums are organised into folders, so a flat list means
/// scrolling past everything to reach anything — this mirrors the structure she
/// already navigates in Photos.
struct DumpFolder: Identifiable, Equatable {
    let id: String
    let title: String
    let folders: [DumpFolder]
    let albums: [DumpAlbum]

    /// Every album at or below this folder — what the count on a folder tile
    /// means, and what selecting from search draws on.
    var allAlbums: [DumpAlbum] { albums + folders.flatMap(\.allAlbums) }

    static func == (a: DumpFolder, b: DumpFolder) -> Bool { a.id == b.id }
}

@MainActor
final class DumpAlbums: ObservableObject {
    @Published var root = DumpFolder(id: "root", title: "Albums", folders: [], albums: [])
    @Published var status: PHAuthorizationStatus = .notDetermined
    @Published var loading = false

    /// Flat list of everything, for search.
    var everything: [DumpAlbum] { root.allAlbums }

    func load() async {
        status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if status == .notDetermined {
            status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        }
        guard status == .authorized || status == .limited else { return }
        loading = true
        root = await Task.detached(priority: .userInitiated) { Self.fetchTree() }.value
        loading = false
    }

    // MARK: - Reading the library

    /// Walk the real folder tree rather than fetching every album flat, so the
    /// hierarchy matches what Photos shows.
    nonisolated private static func fetchTree() -> DumpFolder {
        let top = PHCollectionList.fetchTopLevelUserCollections(with: nil)
        let (folders, albums) = split(top)
        return DumpFolder(id: "root", title: "Albums", folders: folders, albums: albums)
    }

    nonisolated private static func split(_ collections: PHFetchResult<PHCollection>)
        -> ([DumpFolder], [DumpAlbum]) {
        var folders: [DumpFolder] = []
        var albums: [DumpAlbum] = []
        collections.enumerateObjects { collection, _, _ in
            if let list = collection as? PHCollectionList {
                let children = PHCollection.fetchCollections(in: list, options: nil)
                let (subFolders, subAlbums) = split(children)
                // An empty folder is just noise in a picker.
                guard !subFolders.isEmpty || !subAlbums.isEmpty else { return }
                folders.append(DumpFolder(id: list.localIdentifier,
                                          title: list.localizedTitle ?? "Untitled",
                                          folders: subFolders, albums: subAlbums))
            } else if let collection = collection as? PHAssetCollection,
                      let album = read(collection) {
                albums.append(album)
            }
        }
        return (folders.sorted { byName($0.title, $1.title) },
                albums.sorted { byName($0.title, $1.title) })
    }

    nonisolated private static func byName(_ a: String, _ b: String) -> Bool {
        a.localizedStandardCompare(b) == .orderedAscending
    }

    nonisolated private static func read(_ collection: PHAssetCollection) -> DumpAlbum? {
        let opts = PHFetchOptions()
        opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        let assets = PHAsset.fetchAssets(in: collection, options: opts)
        guard assets.count > 0 else { return nil }   // empty albums are noise
        var ids: [String] = []
        ids.reserveCapacity(assets.count)
        assets.enumerateObjects { asset, _, _ in ids.append(asset.localIdentifier) }
        return DumpAlbum(id: collection.localIdentifier,
                         title: collection.localizedTitle ?? "Untitled",
                         count: assets.count, assetIDs: ids, coverID: ids.first)
    }
}

/// The Dump: pick whole albums, tap once, they go up in the background.
/// Deliberately has no naming, typing, or sorting — labelling is a later pass.
struct DumpView: View {
    @StateObject private var library = DumpAlbums()
    @ObservedObject private var uploader = DumpUploader.shared
    @State private var selected: Set<String> = []
    @State private var path: [DumpFolder] = []      // folders drilled into
    @State private var search = ""
    @FocusState private var searchFocused: Bool

    private let grid = [GridItem(.adaptive(minimum: 104), spacing: 10)]

    /// The folder being shown — the deepest one drilled into, else the root.
    private var current: DumpFolder { path.last ?? library.root }

    private var searching: Bool {
        !search.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Search looks through EVERY album at any depth — that's the point of it,
    /// so she never has to remember which folder something is in.
    private var results: [DumpAlbum] {
        let q = search.trimmingCharacters(in: .whitespaces)
        return library.everything.filter { $0.title.localizedCaseInsensitiveContains(q) }
    }

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
            ProgressView(value: Double(uploader.done), total: Double(max(uploader.total, 1)))
                .tint(Theme.accent)
            if uploader.failed > 0 { failures }
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

    /// Which albums lost files, not just how many. A count alone means a photo
    /// can go missing out of 300 and never be found again — naming the album
    /// is what makes it recoverable even if she re-sends by hand.
    private var failures: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(uploader.failed) didn't make it\(uploader.lastError.map { " — \($0)" } ?? "")")
                    .font(.caption).foregroundColor(Theme.danger)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                // Nothing is lost when a file fails — the job is kept, so it
                // can just be sent again.
                if !uploader.isRunning {
                    Button("Send again") { uploader.retryFailed() }
                        .font(.caption.weight(.semibold))
                        .foregroundColor(Theme.accent)
                }
            }
            ForEach(failedByAlbum, id: \.name) { row in
                Text("· \(row.count) in \(row.name)")
                    .font(.caption2).foregroundColor(Theme.textDim)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var failedByAlbum: [(name: String, count: Int)] {
        Dictionary(grouping: uploader.failedJobs, by: \.bundleName)
            .map { (name: $0.key, count: $0.value.count) }
            .sorted { $0.count > $1.count }
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
            } else if library.everything.isEmpty {
                message("No albums yet. Make one in Photos and it'll show up here.")
            } else {
                browser
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

    // MARK: - Browsing

    private var browser: some View {
        VStack(spacing: 0) {
            searchField
            if !path.isEmpty && !searching { breadcrumb }
            ScrollView {
                LazyVGrid(columns: grid, spacing: 10) {
                    if searching {
                        ForEach(results) { album in albumButton(album) }
                    } else {
                        ForEach(current.folders) { folder in
                            Button { searchFocused = false; path.append(folder) } label: {
                                FolderTile(folder: folder,
                                           picked: pickedCount(in: folder))
                            }
                            .buttonStyle(.plain)
                        }
                        ForEach(current.albums) { album in albumButton(album) }
                    }
                }
                .padding(12)
            }
            // Scrolling the grid puts the keyboard away — otherwise it sits
            // over half the albums with no obvious way to dismiss it.
            .scrollDismissesKeyboard(.immediately)
            if searching && results.isEmpty {
                Text("Nothing matching “\(search)”.")
                    .font(.callout).foregroundColor(Theme.textDim)
                    .frame(maxWidth: .infinity).padding(.bottom, 20)
            }
            sendBar
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundColor(Theme.textDim)
            TextField("Search albums", text: $search)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundColor(Theme.text)
                .focused($searchFocused)
                .submitLabel(.done)
                .onSubmit { searchFocused = false }
            if !search.isEmpty {
                Button { search = ""; searchFocused = false } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(Theme.textDim)
                }
                .buttonStyle(.plain)
            } else if searchFocused {
                Button("Done") { searchFocused = false }
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(Theme.accent)
            }
        }
        .padding(10)
        .background(Theme.surface)
        .cornerRadius(Theme.radius)
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
        .padding(.horizontal, 12)
        .padding(.top, 10)
    }

    private var breadcrumb: some View {
        HStack(spacing: 6) {
            Button {
                path.removeLast()
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left")
                    Text(path.count > 1 ? path[path.count - 2].title : "Albums")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundColor(Theme.accent)
            }
            .buttonStyle(.plain)
            Spacer()
            Text(current.title)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(Theme.text)
                .lineLimit(1)
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
    }

    private func albumButton(_ album: DumpAlbum) -> some View {
        Button {
            searchFocused = false
            if selected.contains(album.id) { selected.remove(album.id) }
            else { selected.insert(album.id) }
        } label: {
            AlbumTile(album: album, picked: selected.contains(album.id))
        }
        .buttonStyle(.plain)
    }

    private func pickedCount(in folder: DumpFolder) -> Int {
        folder.allAlbums.filter { selected.contains($0.id) }.count
    }

    // MARK: - Send

    private var sendBar: some View {
        VStack(spacing: 0) {
            Divider().background(Theme.border)
            Button {
                let picked = library.everything.filter { selected.contains($0.id) }
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
        let albums = library.everything.filter { selected.contains($0.id) }
        let files = albums.reduce(0) { $0 + $1.count }
        if albums.isEmpty { return "Pick albums to dump" }
        return "Dump \(albums.count) album\(albums.count == 1 ? "" : "s") · \(files) file\(files == 1 ? "" : "s")"
    }
}

// MARK: - Tiles

/// A fixed square that its artwork is clipped INTO.
///
/// Doing this the other way round — sizing the image and asking for a square
/// aspect ratio afterwards — lets the image's own proportions win, so wide
/// photos overflow their cell and overlap the neighbouring tile. The square
/// has to exist first; the image fills it and gets clipped.
private struct SquareThumb<Content: View>: View {
    let picked: Bool
    @ViewBuilder var content: Content

    var body: some View {
        Rectangle()
            .fill(Theme.surface2)
            .aspectRatio(1, contentMode: .fit)
            .overlay { content }
            // Selection can't rely on a tan ring being visible against whatever
            // photo is underneath — on a light or beige cover it disappears, so
            // some tiles read as unselected when they aren't. A scrim darkens
            // the art itself, which no photo can hide.
            .overlay { picked ? Color.black.opacity(0.28) : Color.clear }
            .clipped()
            .cornerRadius(Theme.radius)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radius)
                    .stroke(picked ? Theme.accent : Theme.border, lineWidth: picked ? 3 : 1)
            )
    }
}

/// The selected badge: a white-ringed check, so it reads on a dark photo and a
/// white one alike.
private struct PickedBadge: View {
    var body: some View {
        Image(systemName: "checkmark")
            .font(.system(size: 12, weight: .heavy))
            .foregroundColor(.white)
            .frame(width: 24, height: 24)
            .background(Circle().fill(Theme.accent))
            .overlay(Circle().stroke(Color.white, lineWidth: 2))
            .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
            .padding(6)
    }
}

/// Two lines of name plus the count, always the same height, so every row in
/// the grid lines up regardless of how long a title is.
private struct TileCaption: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(Theme.text)
                .lineLimit(2, reservesSpace: true)
                .multilineTextAlignment(.leading)
            Text(detail)
                .font(.caption2)
                .foregroundColor(Theme.textDim)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AlbumTile: View {
    let album: DumpAlbum
    let picked: Bool
    @State private var cover: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack(alignment: .topTrailing) {
                SquareThumb(picked: picked) {
                    if let cover {
                        Image(uiImage: cover).resizable().scaledToFill()
                    }
                }
                if picked { PickedBadge() }
            }
            TileCaption(title: album.title, detail: "\(album.count)")
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
        cover = await withCheckedContinuation { (cont: CheckedContinuation<UIImage?, Never>) in
            var resumed = false
            PHImageManager.default().requestImage(for: asset,
                                                  targetSize: CGSize(width: 300, height: 300),
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

private struct FolderTile: View {
    let folder: DumpFolder
    let picked: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack(alignment: .topTrailing) {
                SquareThumb(picked: picked > 0) {
                    Image(systemName: "folder")
                        .font(.system(size: 34, weight: .light))
                        .foregroundColor(Theme.accent)
                }
                if picked > 0 {
                    Text("\(picked)")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Theme.accent)
                        .cornerRadius(Theme.radius)
                        .padding(6)
                }
            }
            TileCaption(title: folder.title, detail: albumCount)
        }
    }

    private var albumCount: String {
        let n = folder.allAlbums.count
        return "\(n) album\(n == 1 ? "" : "s")"
    }
}

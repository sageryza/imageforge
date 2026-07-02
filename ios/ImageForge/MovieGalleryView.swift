import SwiftUI
import AVKit

// The Gallery — everything a movie has generated, organized and laid out:
//   • CUTS: every finished stitch, kept and named by what changed since the
//     previous one ("trimmed sc 3, slowed sc 7"), each with a comic-panel
//     contact sheet of exactly the frames it contains, in order.
//   • RAW GENERATIONS: every panel and clip per scene — current AND
//     superseded re-rolls — with the exact prompt one tap away.
struct MovieGalleryView: View {
    let movie: Movie
    @Environment(\.dismiss) private var dismiss
    @State private var detail: GalleryDetail?
    @State private var playingCut: MovieCut?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    cutsSection
                    rawSection
                }
                .padding()
            }
            .background(Reel.base.ignoresSafeArea())
            .navigationTitle("Gallery")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }.foregroundColor(Reel.amber)
                }
            }
            .sheet(item: $detail) { d in GalleryDetailSheet(detail: d) }
            .sheet(item: $playingCut) { cut in
                if let url = cut.videoURL {
                    ClipPreviewSheet(title: cut.name, url: url)
                }
            }
        }
        .tint(Reel.amber)
    }

    // MARK: Cuts

    private var cutsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("FINISHED CUTS")
            let cuts = Array((movie.cuts ?? []).reversed())
            if cuts.isEmpty {
                Text("No cuts yet — stitch the movie and every version will be kept here.")
                    .font(.caption).foregroundColor(Reel.dim)
            }
            ForEach(cuts) { cut in
                CutCard(cut: cut, isLatest: cut.id == movie.cuts?.last?.id) {
                    if cut.videoURL != nil { playingCut = cut }
                }
            }
        }
    }

    // MARK: Raw generations

    private var rawSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionLabel("RAW GENERATIONS — tap anything for its prompt")
            ForEach(Array(movie.scenes.enumerated()), id: \.element.id) { idx, scene in
                sceneRow(idx: idx, scene: scene)
            }
        }
    }

    private func sceneRow(idx: Int, scene: MovieScene) -> some View {
        // Oldest → newest, current generation last (and badged).
        let panels: [(PanelState, Bool)] = (scene.panelHistory ?? []).map { ($0, false) }
            + (scene.panel?.url != nil ? [(scene.panel!, true)] : [])
        let clips: [(ClipState, Bool)] = (scene.clipHistory ?? []).map { ($0, false) }
            + (scene.clip?.url != nil ? [(scene.clip!, true)] : [])
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(String(format: "%02d", idx + 1))
                    .font(.caption2.weight(.black).monospaced()).foregroundColor(Reel.amber)
                Text(scene.title).font(.caption.weight(.semibold)).foregroundColor(Reel.ink)
                Spacer()
                Text("\(panels.count) panel\(panels.count == 1 ? "" : "s") · \(clips.count) clip\(clips.count == 1 ? "" : "s")")
                    .font(.caption2).foregroundColor(Reel.dim)
            }
            if panels.isEmpty && clips.isEmpty {
                Text("nothing generated yet").font(.caption2).foregroundColor(Reel.dim)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(panels.enumerated()), id: \.offset) { _, pair in
                            PanelThumbCell(panel: pair.0, isCurrent: pair.1) {
                                detail = GalleryDetail(
                                    title: "\(scene.title) — panel",
                                    mediaURL: pair.0.url.flatMap(URL.init(string:)),
                                    isVideo: false,
                                    prompt: pair.0.promptUsed ?? scene.imagePrompt,
                                    meta: [pair.0.quality.map { "quality \($0)" }, pair.1 ? "current" : "superseded"]
                                        .compactMap { $0 }.joined(separator: " · "))
                            }
                        }
                        ForEach(Array(clips.enumerated()), id: \.offset) { _, pair in
                            ClipThumbCell(clip: pair.0, isCurrent: pair.1, poster: scene.panelURL) {
                                detail = GalleryDetail(
                                    title: "\(scene.title) — clip",
                                    mediaURL: pair.0.url.flatMap(URL.init(string:)),
                                    isVideo: true,
                                    prompt: pair.0.promptUsed ?? scene.motionPrompt,
                                    meta: [pair.0.tier, pair.0.cost.map { MovieCosts.chip($0) }, pair.1 ? "current" : "superseded"]
                                        .compactMap { $0 }.joined(separator: " · "))
                            }
                        }
                    }
                }
            }
            Divider().overlay(Reel.border)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text).font(.caption2.weight(.semibold)).tracking(1.4).foregroundColor(Reel.dim)
    }
}

// ─── One finished cut: name, meta, contact sheet ─────────────────────
private struct CutCard: View {
    let cut: MovieCut
    let isLatest: Bool
    let onPlay: () -> Void

    private let grid = Array(repeating: GridItem(.flexible(), spacing: 5), count: 5)

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(cut.name).font(.subheadline.weight(.semibold)).foregroundColor(Reel.ink)
                        if isLatest {
                            Text("LATEST").font(.caption2.weight(.bold)).tracking(0.5)
                                .foregroundColor(Reel.amber)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Reel.amber.opacity(0.6), lineWidth: 1))
                        }
                    }
                    Text(metaLine).font(.caption2).foregroundColor(Reel.dim)
                }
                Spacer()
                Button(action: onPlay) {
                    Image(systemName: "play.fill")
                        .font(.body)
                        .foregroundColor(.white)
                        .frame(width: 38, height: 38)
                        .background(Reel.amber)
                        .cornerRadius(Theme.radius)
                }
            }
            // Comic-panel contact sheet: exactly the frames in this cut, in order.
            if let frames = cut.frames, !frames.isEmpty {
                LazyVGrid(columns: grid, spacing: 5) {
                    ForEach(Array(frames.enumerated()), id: \.offset) { i, frame in
                        ZStack {
                            RoundedRectangle(cornerRadius: 4).fill(Reel.strip)
                            if let url = frame.panelUrl.flatMap(URL.init(string:)) {
                                AsyncImage(url: url) { phase in
                                    if case .success(let image) = phase {
                                        image.resizable().scaledToFill()
                                    }
                                }
                            }
                            if frame.bridge == true {
                                Rectangle().fill(.black.opacity(0.35))
                                Text("◇ dream").font(.system(size: 8, weight: .bold)).foregroundColor(.white)
                            }
                        }
                        .aspectRatio(2.0 / 3.0, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .overlay(alignment: .bottomLeading) {
                            Text("\(i + 1)")
                                .font(.system(size: 8, weight: .black).monospaced())
                                .foregroundColor(.white)
                                .padding(2)
                                .background(RoundedRectangle(cornerRadius: 3).fill(.black.opacity(0.55)))
                                .padding(2)
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(Reel.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Reel.border, lineWidth: 1))
    }

    private var metaLine: String {
        var bits: [String] = []
        if let d = cut.duration, d > 0 { bits.append(String(format: "%.0fs", d)) }
        if let when = cut.stitchedAt, let date = ISO8601DateFormatter().date(from: when) {
            let f = DateFormatter()
            f.dateFormat = "MMM d, h:mm a"
            bits.append(f.string(from: date).lowercased())
        }
        if let n = cut.frames?.count { bits.append("\(n) frames") }
        return bits.joined(separator: " · ")
    }
}

// ─── Thumb cells ─────────────────────────────────────────────────────
private struct PanelThumbCell: View {
    let panel: PanelState
    let isCurrent: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4).fill(Reel.strip)
                    if let url = panel.url.flatMap(URL.init(string:)) {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase { image.resizable().scaledToFill() }
                            else { ProgressView().tint(Reel.dim) }
                        }
                    }
                }
                .frame(width: 78, height: 104)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4)
                    .stroke(isCurrent ? Reel.amber : Reel.border, lineWidth: isCurrent ? 2 : 1))
                Text(isCurrent ? "current" : "panel")
                    .font(.system(size: 9)).foregroundColor(isCurrent ? Reel.amber : Reel.dim)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct ClipThumbCell: View {
    let clip: ClipState
    let isCurrent: Bool
    let poster: URL?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4).fill(Reel.strip)
                    if let poster {
                        AsyncImage(url: poster) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFill().opacity(0.55)
                            }
                        }
                    }
                    Image(systemName: "play.circle.fill")
                        .font(.title3).foregroundColor(.white).shadow(radius: 2)
                }
                .frame(width: 78, height: 104)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4)
                    .stroke(isCurrent ? Reel.amber : Reel.border, lineWidth: isCurrent ? 2 : 1))
                Text("\(clip.tier ?? "clip")\(isCurrent ? " · current" : "")")
                    .font(.system(size: 9)).foregroundColor(isCurrent ? Reel.amber : Reel.dim)
            }
        }
        .buttonStyle(.plain)
    }
}

// ─── Detail sheet: media + the exact prompt ──────────────────────────
struct GalleryDetail: Identifiable {
    let id = UUID()
    let title: String
    let mediaURL: URL?
    let isVideo: Bool
    let prompt: String
    let meta: String
}

private struct GalleryDetailSheet: View {
    let detail: GalleryDetail
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let url = detail.mediaURL {
                        if detail.isVideo {
                            MoviePlayer(url: url)
                                .aspectRatio(2.0 / 3.0, contentMode: .fit)
                                .frame(maxWidth: .infinity)
                                .cornerRadius(Theme.radiusLg)
                        } else {
                            AsyncImage(url: url) { phase in
                                if case .success(let image) = phase {
                                    image.resizable().scaledToFit()
                                } else {
                                    ProgressView().tint(Reel.dim).frame(height: 300)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .cornerRadius(Theme.radiusLg)
                        }
                    }
                    if !detail.meta.isEmpty {
                        Text(detail.meta.uppercased())
                            .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Reel.dim)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("PROMPT").font(.caption2.weight(.semibold)).tracking(1.4).foregroundColor(Reel.dim)
                        Text(detail.prompt)
                            .font(.caption).foregroundColor(Reel.ink)
                            .textSelection(.enabled)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Reel.surface)
                            .cornerRadius(Theme.radius)
                            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
                    }
                    if let url = detail.mediaURL {
                        ShareLink(item: url) {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .font(.caption.weight(.semibold)).foregroundColor(Reel.amber)
                        }
                    }
                }
                .padding()
            }
            .background(Reel.base.ignoresSafeArea())
            .navigationTitle(detail.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }.foregroundColor(Reel.amber)
                }
            }
        }
    }
}

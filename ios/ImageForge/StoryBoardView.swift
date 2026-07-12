import SwiftUI
import FirebaseAuth
import FirebaseFirestore

/// Story Boards — the video asset boards (Evan, Charlie, Spellcasting, …)
/// read LIVE from the `forge-story` Firestore collection. The collection is
/// written by `scripts/sync-story.js` on the server side, so new panels,
/// approvals, and whole projects appear here with no app build — the
/// snapshot listener updates the screen the moment a sync lands.
struct StoryBoardView: View {
    @StateObject private var model = StoryBoardModel()

    var body: some View {
        Group {
            if model.projects.isEmpty {
                VStack(spacing: 10) {
                    if model.loading { ProgressView() }
                    Text(model.loading ? "Loading boards…" : (model.error ?? "No projects yet."))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                shelfWall
            }
        }
        .navigationTitle("Story Boards")
        .task { await model.start() }
    }

    /// The video-store wall: shelves scrolling down, three VHS cases per
    /// shelf, each project a box with its cover shot and framed title.
    private var shelfWall: some View {
        ScrollView {
            LazyVStack(spacing: 26) {
                ForEach(Array(model.projects.chunked(3).enumerated()), id: \.offset) { _, row in
                    VStack(spacing: 0) {
                        HStack(alignment: .bottom, spacing: 14) {
                            ForEach(row) { p in
                                NavigationLink(value: p.id) { VHSBox(project: p) }
                                    .buttonStyle(.plain)
                            }
                            if row.count < 3 {
                                ForEach(0..<(3 - row.count), id: \.self) { _ in
                                    Color.clear.frame(maxWidth: .infinity)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 6)
                        ShelfBar()
                    }
                }
            }
            .padding(.vertical, 18)
            Text("data: \(model.projects.count) projects · covers \(model.projects.filter { $0.cover != nil }.count)/\(model.projects.count)")
                .font(.caption2).foregroundStyle(.tertiary).padding(.bottom, 10)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        .navigationDestination(for: String.self) { id in
            if let p = model.projects.first(where: { $0.id == id }) {
                ProjectBoardView(project: p).navigationTitle(p.title)
            }
        }
    }

}

/// One project's full beat board (the former tabbed view, now a detail page).
private struct ProjectBoardView: View {
    let project: StoryProject

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                ForEach(Array(project.beats.enumerated()), id: \.offset) { _, beat in
                    BeatView(beat: beat)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 20)
        }
    }
}

/// A VHS case: cover art, dark plastic spine, framed title label — slightly
/// angled so the wall reads like a rental-store shelf.
private struct VHSBox: View {
    let project: StoryProject

    var body: some View {
        VStack(spacing: 7) {
            ZStack {
                if let cover = project.displayCover {
                    AsyncImage(url: cover) { phase in
                        if case .success(let img) = phase { img.resizable().scaledToFill() }
                        else { Color(white: 0.88) }
                    }
                } else {
                    ZStack {
                        Color(white: 0.88)
                        Text("?").font(.system(size: 34, design: .serif)).foregroundStyle(.secondary)
                    }
                }
            }
            .aspectRatio(2 / 3, contentMode: .fit)
            .clipped()
            .overlay(Rectangle().strokeBorder(.black.opacity(0.25), lineWidth: 1))

            Text(project.title.uppercased())
                .font(.caption2.weight(.heavy))
                .kerning(0.8)
                .foregroundStyle(.black)
                .lineLimit(1).minimumScaleFactor(0.5)
                .padding(.bottom, 2)
        }
        .padding(7)
        .background(Color(red: 0.96, green: 0.94, blue: 0.88))
        .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(.black.opacity(0.55), lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .rotation3DEffect(.degrees(4), axis: (x: 0, y: 1, z: 0), perspective: 0.4)
        .shadow(color: .black.opacity(0.30), radius: 7, x: 4, y: 6)
        .frame(maxWidth: .infinity)
    }
}

/// The wooden shelf plank a row of cases stands on.
private struct ShelfBar: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(Color(red: 0.36, green: 0.24, blue: 0.14))
            .frame(height: 12)
            .shadow(color: .black.opacity(0.6), radius: 5, y: 5)
            .padding(.horizontal, 6)
    }
}

private extension Array {
    func chunked(_ size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map { Array(self[$0..<Swift.min($0 + size, count)]) }
    }
}

private struct BeatView: View {
    let beat: StoryBeat
    private let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !beat.vo.isEmpty {
                Text(beat.vo)
                    .font(.system(.callout, design: .serif))
                    .padding(.leading, 10)
                    .overlay(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 1).fill(.quaternary).frame(width: 3)
                    }
            }
            LazyVGrid(columns: cols, spacing: 10) {
                ForEach(Array(beat.cards.enumerated()), id: \.offset) { _, card in
                    CardView(card: card)
                }
            }
        }
    }
}

private struct CardView: View {
    let card: StoryCard

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let url = card.url {
                // Every card is the same 2:3 box; art that isn't 2:3 (square
                // grids, wide panels) scales DOWN to fit inside it instead of
                // overflowing onto neighboring cards.
                ZStack {
                    Color.secondary.opacity(0.06)
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFit()
                        case .failure: Color.secondary.opacity(0.1)
                        default: ProgressView()
                        }
                    }
                }
                .aspectRatio(2 / 3, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .opacity(card.status == "draft" || card.status == "cand" ? 0.75 : 1)
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5]))
                    .foregroundStyle(.tertiary)
                    .aspectRatio(2 / 3, contentMode: .fit)
                    .overlay(Text("?").font(.largeTitle).foregroundStyle(.tertiary))
            }
            Text(card.label).font(.caption.weight(.medium)).lineLimit(2)
            StatusChip(status: card.status)
        }
    }
}

private struct StatusChip: View {
    let status: String

    private var info: (String, Color) {
        switch status {
        case "ok":    return ("Approved", .green)
        case "cand":  return ("Candidate", .orange)
        case "draft": return ("Draft panel", .gray)
        default:      return ("Missing", .red)
        }
    }

    var body: some View {
        Text(info.0)
            .font(.caption2.weight(.bold)).textCase(.uppercase)
            .padding(.horizontal, 7).padding(.vertical, 2)
            .background(info.1.opacity(0.15), in: RoundedRectangle(cornerRadius: 5))
            .foregroundStyle(info.1)
    }
}

// ─── Data ────────────────────────────────────────────────────────────

struct StoryProject: Identifiable {
    let id: String
    let title: String
    let order: Int
    let cover: URL?
    let beats: [StoryBeat]

    /// The cover, or the first panel image anywhere in the beats — a case
    /// should never render empty while the project has any art at all.
    var displayCover: URL? {
        cover ?? beats.lazy.flatMap(\.cards).compactMap(\.url).first
    }
}

struct StoryBeat {
    let vo: String
    let cards: [StoryCard]
}

struct StoryCard {
    let label: String
    let status: String
    let url: URL?
}

@MainActor
final class StoryBoardModel: ObservableObject {
    @Published var projects: [StoryProject] = []
    @Published var loading = true
    @Published var error: String?
    private var listener: ListenerRegistration?

    func start() async {
        guard listener == nil else { return }
        do {
            if Auth.auth().currentUser == nil { try await Auth.auth().signInAnonymously() }
        } catch {
            self.error = error.localizedDescription
            loading = false
            return
        }
        let query = Firestore.firestore().collection("forge-story").order(by: "order")
        // The disk cache can hold pre-cover docs; force one server read so the
        // shelf never renders stale data, then keep the live listener.
        query.getDocuments(source: .server) { [weak self] snap, _ in
            if let docs = snap?.documents { self?.apply(docs) }
        }
        listener = query.addSnapshotListener { [weak self] snap, err in
            guard let self else { return }
            self.loading = false
            if let err { self.error = err.localizedDescription; return }
            self.apply(snap?.documents ?? [])
        }
    }

    private func apply(_ documents: [QueryDocumentSnapshot]) {
        loading = false
        projects = documents.map { doc in
                    let d = doc.data()
                    let beats = (d["beats"] as? [[String: Any]] ?? []).map { b in
                        StoryBeat(
                            vo: b["vo"] as? String ?? "",
                            cards: (b["cards"] as? [[String: Any]] ?? []).map { c in
                                StoryCard(
                                    label: c["label"] as? String ?? "",
                                    status: c["status"] as? String ?? "miss",
                                    url: (c["url"] as? String).flatMap(URL.init(string:))
                                )
                            }
                        )
                    }
                    return StoryProject(
                        id: doc.documentID,
                        title: d["title"] as? String ?? doc.documentID,
                        order: d["order"] as? Int ?? 99,
                        cover: (d["cover"] as? String).flatMap(URL.init(string:)),
                        beats: beats
                    )
        }
    }

    deinit { listener?.remove() }
}

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
    @State private var selected: String?

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
                board
            }
        }
        .navigationTitle("Story Boards")
        .task { await model.start() }
    }

    private var current: StoryProject? {
        model.projects.first { $0.id == selected } ?? model.projects.first
    }

    private var board: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22, pinnedViews: [.sectionHeaders]) {
                Section {
                    if let project = current {
                        ForEach(Array(project.beats.enumerated()), id: \.offset) { _, beat in
                            BeatView(beat: beat)
                        }
                    }
                } header: {
                    picker
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 32)
        }
    }

    private var picker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(model.projects) { p in
                    let on = p.id == current?.id
                    Button(p.title) { selected = p.id }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(on ? Color.primary.opacity(0.85) : Color.secondary.opacity(0.12),
                                    in: RoundedRectangle(cornerRadius: 6))
                        .foregroundStyle(on ? Color(.systemBackground) : .primary)
                }
            }
            .padding(.vertical, 8)
        }
        .background(.bar)
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
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    case .failure: Color.secondary.opacity(0.1)
                    default: ZStack { Color.secondary.opacity(0.06); ProgressView() }
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
    let beats: [StoryBeat]
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
        listener = Firestore.firestore().collection("forge-story").order(by: "order")
            .addSnapshotListener { [weak self] snap, err in
                guard let self else { return }
                self.loading = false
                if let err { self.error = err.localizedDescription; return }
                self.projects = (snap?.documents ?? []).map { doc in
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
                        beats: beats
                    )
                }
            }
    }

    deinit { listener?.remove() }
}

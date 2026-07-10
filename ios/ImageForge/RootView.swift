import SwiftUI

/// The tools the bottom bar can rotate through. Home (the grid) and Gallery
/// (My Creations) are fixed ends of the bar; everything here is a "mode" that
/// cycles through the three middle slots by most-recently-used.
enum Tool: String, CaseIterable, Identifiable {
    case movie, sticker, coloring, storybook, greeting, dreams, instagram, ads, story, test
    var id: String { rawValue }

    var title: String {
        switch self {
        case .movie:     return "Movies"
        case .sticker:   return "Sticker Page"
        case .coloring:  return "Coloring Pages"
        case .storybook: return "Storybook"
        case .greeting:  return "Greeting Cards"
        case .dreams:    return "Dreams"
        case .instagram: return "Instagram"
        case .ads:       return "Ads"
        case .story:     return "Story Boards"
        case .test:      return "Test Station"
        }
    }

    var desc: String {
        switch self {
        case .movie:     return "Type a story — get a hand-drawn movie. And its zine."
        case .sticker:   return "A full sheet of stickers — tap any to redo it."
        case .coloring:  return "Printable black-and-white line art to color."
        case .storybook: return "Build a picture book — a page at a time, words and all."
        case .greeting:  return "A card front with your greeting — birthdays, thanks, anything."
        case .dreams:    return "Illustrate last night's dream — and keep a journal."
        case .instagram: return "Make on-brand posts — product flat-lays & witchy memes."
        case .ads:       return "Run Instagram & Facebook ads — no confusing Ads Manager."
        case .story:     return "The video asset boards — live from the studio."
        case .test:      return "Run one prompt through the house styles."
        }
    }

    var icon: String {
        switch self {
        case .movie:     return "film"
        case .sticker:   return "sparkles"
        case .coloring:  return "pencil.and.outline"
        case .storybook: return "book"
        case .greeting:  return "envelope"
        case .dreams:    return "moon.stars"
        case .instagram: return "camera"
        case .ads:       return "megaphone"
        case .story:     return "rectangle.grid.2x2"
        case .test:      return "wand.and.stars"
        }
    }

    @ViewBuilder var view: some View {
        switch self {
        case .movie:     MovieMakerHome()
        case .sticker:   StickerView()
        case .coloring:  ColoringView()
        case .storybook: StorybookView()
        case .greeting:  GreetingCardsView()
        case .dreams:    DreamsView()
        case .instagram: InstagramView()
        case .ads:       AdsView()
        case .story:     StoryBoardView()
        case .test:      TestStationView()
        }
    }
}

/// Which screen the bottom bar is showing.
enum Screen: Hashable { case home, tool(Tool), gallery }

/// Tracks most-recently-used tools so the three middle bar slots rotate.
final class Recents: ObservableObject {
    @Published private(set) var order: [Tool]
    private let key = "deckfactory.recentTools.v1"

    init() {
        let saved = UserDefaults.standard.stringArray(forKey: key) ?? []
        var o = saved.compactMap { Tool(rawValue: $0) }
        // Seed sensible defaults so the bar is never empty on first launch.
        for t in [Tool.movie, .sticker, .coloring] where !o.contains(t) { o.append(t) }
        order = o
    }

    /// The three tools shown in the middle of the bar.
    var recentThree: [Tool] { Array(order.prefix(3)) }

    /// Promote a tool to most-recent (so it holds a middle slot).
    func use(_ t: Tool) {
        guard order.first != t else { return }
        order.removeAll { $0 == t }
        order.insert(t, at: 0)
        UserDefaults.standard.set(order.map { $0.rawValue }, forKey: key)
    }
}

/// App root: content area on top, custom bottom bar underneath. No top-level
/// back button — you move between modes with the bar.
struct RootView: View {
    @StateObject private var recents = Recents()
    @State private var screen: Screen = .home

    var body: some View {
        VStack(spacing: 0) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            BottomBar(screen: $screen, recents: recents)
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    // Keep the three recent tools + gallery alive so their state (a generated
    // sheet, a half-typed prompt) survives switching tabs; only the selected one
    // is shown.
    private var content: some View {
        ZStack {
            HomeGrid(open: open)
                .opacity(screen == .home ? 1 : 0)
                .allowsHitTesting(screen == .home)
            ForEach(recents.recentThree) { t in
                NavigationStack { t.view }
                    .opacity(screen == .tool(t) ? 1 : 0)
                    .allowsHitTesting(screen == .tool(t))
            }
            NavigationStack { CreationsView() }
                .opacity(screen == .gallery ? 1 : 0)
                .allowsHitTesting(screen == .gallery)
        }
    }

    private func open(_ t: Tool) {
        recents.use(t)
        screen = .tool(t)
    }
}

/// The custom bottom bar: 🏠 · recent · recent · recent · 🖼️.
private struct BottomBar: View {
    @Binding var screen: Screen
    @ObservedObject var recents: Recents

    var body: some View {
        HStack(spacing: 0) {
            slot(icon: "house", active: screen == .home) { screen = .home }
            ForEach(recents.recentThree) { t in
                // Tapping a slot just switches to it — no reshuffle. Tools only
                // get promoted into the slots when opened from Home.
                slot(icon: t.icon, active: screen == .tool(t)) { screen = .tool(t) }
            }
            slot(icon: "square.grid.2x2", active: screen == .gallery) { screen = .gallery }
        }
        .padding(.top, 8)
        .background(
            Theme.surface
                .overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func slot(icon: String, active: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Image(systemName: icon)
                .font(.system(size: 21, weight: active ? .semibold : .regular))
                .foregroundColor(active ? Theme.mauve : Theme.textDim)
                .frame(maxWidth: .infinity)
                .frame(height: 30)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// The Home grid — every tool as a card. Tapping one opens it (and promotes it
/// into the recent slots).
private struct HomeGrid: View {
    var open: (Tool) -> Void
    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                StarTitle(text: "Deck Factory")
            }
            .padding(.top, 12)
            .padding(.bottom, 4)
            ScrollView {
                LazyVGrid(columns: grid, spacing: 14) {
                    ForEach(Tool.allCases) { t in
                        Button { open(t) } label: {
                            HubCard(icon: t.icon, title: t.title, desc: t.desc)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
        }
        .background(Theme.bg.ignoresSafeArea())
    }
}

private struct HubCard: View {
    let icon: String
    let title: String
    let desc: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).font(.system(size: 26)).foregroundColor(Theme.accent)
            Text(title).font(.headline).foregroundColor(Theme.text)
            Text(desc).font(.caption).foregroundColor(Theme.textDim)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 124, alignment: .topLeading)
        .padding(16)
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }
}

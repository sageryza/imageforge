import SwiftUI

/// The tools the bottom bar can rotate through. Home (the grid) and Gallery
/// (My Creations) are fixed ends of the bar; everything here is a "mode" that
/// cycles through the three middle slots by most-recently-used.
enum Tool: String, CaseIterable, Identifiable {
    case movie, sticker, coloring, storybook, greeting, dreams, instagram, ads, story, writing, chats, test
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
        case .writing:   return "Writing Room"
        case .chats:     return "Chats"
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
        case .writing:   return "Read the dating-book drafts — leave notes as you go."
        case .chats:     return "Every chat's updates in one feed — read or listen."
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
        case .writing:   return "text.book.closed"
        case .chats:     return "bubble.left.and.bubble.right"
        case .test:      return "testtube.2"
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
        case .writing:   WritingRoomView()
        case .chats:     ChatFeedView()
        case .test:      TestStationView()
        }
    }
}

/// Which screen the bottom bar is showing.
enum Screen: Hashable { case home, tool(Tool), gallery }

/// Lets any tool screen pop back to the Home grid (the back arrow in a
/// tool's top-left corner). RootView injects the real action.
private struct GoHomeKey: EnvironmentKey { static let defaultValue: () -> Void = {} }
extension EnvironmentValues {
    var goHome: () -> Void {
        get { self[GoHomeKey.self] }
        set { self[GoHomeKey.self] = newValue }
    }
}

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
    @ObservedObject private var autoScroll = AutoScrollDriver.shared
    @State private var screen: Screen = .home

    var body: some View {
        VStack(spacing: 0) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            BottomBar(screen: $screen, recents: recents)
        }
        .background(Theme.bg.ignoresSafeArea())
        // Keep the bottom bar pinned to the bottom edge — without this the
        // keyboard's safe-area inset lifts the whole VStack, floating the bar
        // above the keyboard. Each tool's own ScrollView still lifts its fields.
        .ignoresSafeArea(.keyboard, edges: .bottom)
        // Changing screens always kills autoscroll — it must never keep
        // scrolling a hidden page or carry over onto the new one. The
        // notification reaches the web-view tools' in-page pills as well.
        .onChange(of: screen) { _ in
            AutoScrollDriver.shared.stop()
            NotificationCenter.default.post(name: .forgeScreenChanged, object: nil)
        }
        // Deep links: deckfactory://writing, ://chats, ://story, ://dreams,
        // ://movie, … (any Tool rawValue), plus ://gallery and ://home. Opens
        // Deck Factory straight to that tab. Scheme registered in Info.plist.
        .onOpenURL { url in handleDeepLink(url) }
        // CI screenshot hook: launch with FORGE_SCREEN=<dest> to open straight
        // to a screen (the simulator screenshot workflow relaunches per screen).
        // Never set in production, so it's inert there.
        .onAppear {
            let s = ProcessInfo.processInfo.environment["FORGE_SCREEN"] ?? ""
            if !s.isEmpty { go(s.lowercased()) }
        }
    }

    private func handleDeepLink(_ url: URL) {
        guard url.scheme?.lowercased() == "deckfactory" else { return }
        // accept deckfactory://writing and deckfactory:///writing alike
        let dest = (url.host ?? url.path)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            .lowercased()
        go(dest)
    }

    private func go(_ dest: String) {
        switch dest {
        case "", "home":
            screen = .home
        case "gallery", "creations":
            screen = .gallery
        default:
            if let t = Tool(rawValue: dest) { open(t) }
        }
    }

    // Keep the three recent tools + gallery alive so their state (a generated
    // sheet, a half-typed prompt) survives switching tabs; only the selected one
    // is shown.
    private var content: some View {
        ZStack {
            HomeGrid(open: open, recents: recents)
                .opacity(screen == .home ? 1 : 0)
                .allowsHitTesting(screen == .home)
            ForEach(recents.recentThree) { t in
                NavigationStack { t.view }
                    .environment(\.goHome, { screen = .home })
                    .opacity(screen == .tool(t) ? 1 : 0)
                    .allowsHitTesting(screen == .tool(t))
            }
            NavigationStack { CreationsView() }
                .opacity(screen == .gallery ? 1 : 0)
                .allowsHitTesting(screen == .gallery)
            // The autoscroll pill, on every native scrollable screen. The
            // web-view tools (Writing Room, Chats) carry their own in-page.
            if showAutoScroll {
                AutoScrollPill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(.top, 64)
                    .padding(.trailing, 14)
            }
        }
    }

    private var showAutoScroll: Bool {
        switch screen {
        case .home: return false
        case .gallery: return true
        case .tool(let t):
            if t == .writing || t == .chats { return false }
            // The Story Room (pushed inside the movies tool) is a web page
            // with its own in-page pill — showing the native one too would
            // stack two pills on top of each other.
            if t == .movie && autoScroll.webPillActive { return false }
            return true
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
    @ObservedObject var recents: Recents
    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    // Sophie's home order: Story Boards pinned first; greeting cards, stickers,
    // storybooks, and coloring pages pinned last; everything in between rotates
    // by most-recent use.
    private var tools: [Tool] {
        let pinnedBottom: [Tool] = [.greeting, .sticker, .storybook, .coloring]
        // Chats and Test Station aren't grid cards — they live as the corner
        // icons in the header (chats top-right, test station top-left).
        let middle = Tool.allCases.filter { $0 != .story && $0 != .chats && $0 != .test && !pinnedBottom.contains($0) }
        let ranked = recents.order.filter { middle.contains($0) }
        let rest = middle.filter { !ranked.contains($0) }
        return [.story] + ranked + rest + pinnedBottom
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                StarTitle(text: "Deck Factory")
            }
            .padding(.top, 12)
            .padding(.bottom, 4)
            // Test Station isn't a grid card — it's this test-tube icon in the
            // top-left corner.
            .overlay(alignment: .leading) {
                Button { open(.test) } label: {
                    Image(systemName: Tool.test.icon)
                        .font(.system(size: 20))
                        .foregroundColor(Theme.accent)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.leading, 12)
            }
            // Chats isn't a grid card — it's this icon in the top-right corner.
            .overlay(alignment: .trailing) {
                Button { open(.chats) } label: {
                    Image(systemName: Tool.chats.icon)
                        .font(.system(size: 20))
                        .foregroundColor(Theme.accent)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.trailing, 12)
            }
            ScrollView {
                LazyVGrid(columns: grid, spacing: 14) {
                    ForEach(tools) { t in
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

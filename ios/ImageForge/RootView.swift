import SwiftUI

/// The tools the bottom bar can rotate through. Home (the grid) and Gallery
/// (My Creations) are fixed ends of the bar; everything here is a "mode" that
/// cycles through the three middle slots by most-recently-used.
enum Tool: String, CaseIterable, Identifiable {
    case movie, sticker, coloring, storybook, greeting, dreams, instagram, ads, blog, product, report, story, lessons, writing, editor, cutroom, chats, test, dump, playground, scratchpad, voice, song, character, films
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
        case .blog:      return "Blog Studio"
        case .product:   return "Product Creator"
        case .report:    return "Shop Report"
        case .story:     return "Story Room"
        case .lessons:   return "Lessons"
        case .writing:   return "Writing Room"
        case .editor:    return "Episode Editor"
        case .cutroom:   return "Cutting Room"
        case .chats:     return "Chats"
        case .test:      return "Test Station"
        case .dump:      return "Dump"
        case .playground: return "Playground"
        case .scratchpad: return "Scratch Pad"
        case .voice:     return "Voice Studio"
        case .song:      return "Song Station"
        case .character: return "Characters"
        case .films:     return "Films"
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
        case .blog:      return "Turn a topic into an SEO post — then publish it."
        case .product:   return "An idea → designs → real products, as Etsy drafts."
        case .report:    return "How the shop is really doing — winners, sleepers, fixes."
        case .story:     return "Every story in one room — words, voice, art, films."
        case .lessons:   return "Every finished lesson & story in one map — tap to read."
        case .writing:   return "Read the dating-book drafts — leave notes as you go."
        case .editor:    return "Cut interview clips into an episode — then hear it."
        case .cutroom:   return "Mark a recording on its words — cut pauses, send sections on."
        case .chats:     return "Every chat's updates in one feed — read or listen."
        case .test:      return "Run one prompt through the house styles."
        case .dump:      return "Send whole albums here — sort them out later."
        case .playground: return "Try prompts on a style — four images a run, same seed."
        case .scratchpad: return "Think in pictures — hearted art laid out as beats."
        case .voice:     return "Your voices read anything you type."
        case .song:      return "Sing a made-up song — keep your voice, gain a band."
        case .character: return "The recurring people — cards that keep faces consistent."
        case .films:     return "Films without a story — experiments and one-offs."
        }
    }

    var icon: String {
        switch self {
        case .movie:     return "film"
        case .sticker:   return "sparkles"
        case .coloring:  return "pencil.and.outline"
        case .storybook: return "book"
        case .greeting:  return "envelope"
        case .dreams:    return "cloud"
        case .instagram: return "camera"
        case .ads:       return "megaphone"
        case .story:     return "books.vertical"
        case .lessons:   return "rectangle.grid.2x2"
        case .writing:   return "text.book.closed"
        case .editor:    return "slider.horizontal.3"
        case .cutroom:   return "scissors"
        case .chats:     return "bubble.left.and.bubble.right"
        case .test:      return "testtube.2"   // fallback; .test uses a custom asset (see customIcon)
        // Arrow down into a tray — the inbox glyph.
        case .dump:      return "tray.and.arrow.down"
        case .blog:      return "newspaper"
        case .product:   return "shippingbox"
        case .report:    return "chart.line.uptrend.xyaxis"
        case .playground: return "paintpalette" // fallback; .playground uses a custom asset (see customIcon)
        // The pad IS the Story Room now, so it wears the Story Room's books —
        // the old dashed placement slot read as a different tool in the bar.
        case .scratchpad: return "books.vertical"
        case .voice:     return "waveform"
        case .song:      return "music.note"
        case .character: return "person.crop.rectangle"
        case .films:     return "film.stack"
        }
    }

    /// A few tools ship a bundled custom icon (template-rendered so it still
    /// takes the foreground color) because their look isn't in SF Symbols.
    /// Test Station uses a hand-drawn twin-test-tube glyph; the Playground uses
    /// Sophie's drawing of the wire-loop toy (little trains riding sprung wires
    /// out of a flat base).
    var customIcon: String? {
        switch self {
        case .test:       return "TestTube"
        case .playground: return "Playground"
        default:          return nil
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
        case .blog:      BlogView().forgeToolBar("Blog Studio")
        case .product:   ProductCreatorView().forgeToolBar("Product Creator")
        case .report:    GatedWebTool(path: "/report", name: "the Shop Report", icon: "chart.line.uptrend.xyaxis").forgeToolBar("Shop Report")
        case .story:     StoryRoomView()
                             // Same dress as the movies-pushed Story Room: the
                             // heading in the native bar, matched to the page's paper.
                             .forgeTitle("Story Room", paper: StoryRoomView.paper)
        case .lessons:   LessonsView().forgeToolBar("Lessons", paper: LessonsView.paper)
        case .writing:   WritingRoomView()
        case .editor:    EpisodeEditorView()
        case .cutroom:   CuttingRoomView()
        case .chats:     ChatFeedView()
        case .test:      TestStationView()
        case .dump:      DumpView().forgeToolBar("Dump")
        case .playground: PlaygroundView()
        case .scratchpad: ScratchPadView()
        case .voice:     GatedWebTool(path: "/voice", name: "the Voice Studio", icon: "waveform").forgeToolBar("Voice Studio")
        case .song:      GatedWebTool(path: "/song", name: "the Song Station", icon: "music.note", mic: true).forgeToolBar("Song Station")
        case .character: GatedWebTool(path: "/character", name: "the Characters page", icon: "person.crop.rectangle").forgeToolBar("Characters")
        case .films:     GatedWebTool(path: "/films", name: "the Films archive", icon: "film.stack").forgeToolBar("Films")
        }
    }
}

/// Renders a tool's bar/corner icon: an SF Symbol, or a bundled custom asset
/// (template-rendered so it still takes the foreground color) for tools whose
/// look isn't in SF Symbols. Sized so a custom glyph sits at the same optical
/// weight as the symbols beside it.
struct ToolGlyph: View {
    let tool: Tool
    var size: CGFloat = 21
    var weight: Font.Weight = .regular

    var body: some View {
        if let asset = tool.customIcon {
            Image(asset)
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                // An SF Symbol at point size S draws only about 0.75·S of ink —
                // it sits on a text baseline, so the glyph is roughly cap
                // height, not the full box. Custom art fills ~0.9 of whatever
                // frame it gets, so matching that ink means a frame SMALLER
                // than S, not bigger. (This used to scale UP by 1.35, which is
                // why the Test Station's tubes read half again the size of
                // every symbol beside them.)
                .frame(width: size * 0.86, height: size * 0.86)
                // …in a LAYOUT box the height an SF Symbol of this size would
                // take, so a custom glyph never nudges whatever sits under it
                // (the home grid stacks a title right below the icon) out of
                // line with its neighbours.
                .frame(height: size * 1.2)
        } else {
            Image(systemName: tool.icon)
                .font(.system(size: size, weight: weight))
        }
    }
}

/// Which screen the bottom bar is showing. There are TWO home grids: the
/// making one (`.home`) and the business one (`.business`), reached by the
/// briefcase beside the test tube.
enum Screen: Hashable { case home, business, tool(Tool), gallery }

extension Tool {
    /// The tools that live on the BUSINESS home grid instead of the making one
    /// — running the shop rather than making the work. They're on one grid or
    /// the other, never both, so each home stays a short scannable list.
    var isBusiness: Bool {
        switch self {
        case .instagram, .ads, .blog, .product, .report: return true
        default: return false
        }
    }
}

/// Lets any tool screen pop back to the Home grid (the back arrow in a
/// tool's top-left corner). RootView injects the real action.
private struct GoHomeKey: EnvironmentKey { static let defaultValue: () -> Void = {} }
extension EnvironmentValues {
    var goHome: () -> Void {
        get { self[GoHomeKey.self] }
        set { self[GoHomeKey.self] = newValue }
    }
}

/// Lets a tool screen jump straight to another tool (e.g. Test Station's
/// top-right Chats icon). RootView injects the real action.
private struct OpenToolKey: EnvironmentKey { static let defaultValue: (Tool) -> Void = { _ in } }
extension EnvironmentValues {
    var openTool: (Tool) -> Void {
        get { self[OpenToolKey.self] }
        set { self[OpenToolKey.self] = newValue }
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

    /// The three tools shown in the middle of the bar. Chats is excluded — it's
    /// the always-alive launch screen, not part of the rotation (and may linger
    /// in saved state from before that change).
    var recentThree: [Tool] { Array(order.filter { $0 != .chats }.prefix(3)) }

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
    // The app opens on Chats (its home feed); the module grid is one tap away on
    // the bottom bar's house icon.
    @State private var screen: Screen = .tool(.chats)
    // Where you came from, most recent last — every tool's back chevron pops
    // this, so back always means "the previous screen", however you got here
    // (home grid, bottom bar, a corner icon, a deep link).
    @State private var history: [Screen] = []

    var body: some View {
        VStack(spacing: 0) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            BottomBar(screen: Binding(get: { screen }, set: { setScreen($0) }),
                      recents: recents)
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
        // ://movie, … (any Tool rawValue), plus ://gallery, ://home and
        // ://business (the second home grid). Opens
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
            setScreen(.home)
        case "gallery", "creations":
            setScreen(.gallery)
        case "business":
            setScreen(.business)
        default:
            if let t = Tool(rawValue: dest) { open(t) }
        }
    }

    /// Every screen change goes through here so the back chevron always knows
    /// where "back" is. Capped so the stack can't grow without bound.
    private func setScreen(_ s: Screen) {
        guard s != screen else { return }
        history.append(screen)
        if history.count > 24 { history.removeFirst() }
        screen = s
    }

    private func goBack() {
        screen = history.popLast() ?? .home
    }

    // Keep the three recent tools + gallery alive so their state (a generated
    // sheet, a half-typed prompt) survives switching tabs; only the selected one
    // is shown.
    private var content: some View {
        ZStack {
            HomeGrid(open: open, openBusiness: { setScreen(.business) }, recents: recents)
                .opacity(screen == .home ? 1 : 0)
                .allowsHitTesting(screen == .home)
            BusinessGrid(open: open, goHome: { setScreen(.home) })
                .opacity(screen == .business ? 1 : 0)
                .allowsHitTesting(screen == .business)
            ForEach(recents.recentThree.filter { $0 != .chats }) { t in
                NavigationStack { t.view }
                    .environment(\.goHome, { setScreen(.home) })
                    .environment(\.goBack, { goBack() })
                    .environment(\.openTool, { open($0) })
                    .opacity(screen == .tool(t) ? 1 : 0)
                    .allowsHitTesting(screen == .tool(t))
            }
            // Chats is the launch screen — kept always-alive (like Home and
            // Gallery), not part of the recent-tool rotation.
            NavigationStack { ChatFeedView() }
                .environment(\.goHome, { setScreen(.home) })
                .environment(\.goBack, { goBack() })
                .environment(\.openTool, { open($0) })
                .opacity(screen == .tool(.chats) ? 1 : 0)
                .allowsHitTesting(screen == .tool(.chats))
            NavigationStack { CreationsView() }
                .environment(\.goHome, { setScreen(.home) })
                .environment(\.goBack, { goBack() })
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
        case .home, .business: return false
        case .gallery: return true
        case .tool(let t):
            // Story Room is a web page with its own in-page pill.
            if t == .writing || t == .chats || t == .story { return false }
            // Episode Editor is a web page too — an arranging tool, not a read,
            // and the pill would sit on top of its sticky header.
            if t == .editor { return false }
            // Playground is a short web form + grid — nothing to autoscroll,
            // and the pill would cover its Generate corner.
            if t == .playground { return false }
            // Cutting Room is a web page with its own injected pill.
            if t == .cutroom { return false }
            // Scratch Pad is a web page with its own injected pill — showing
            // the native one too would stack two pills.
            if t == .scratchpad { return false }
            // The Story Room (pushed inside the movies tool) is a web page
            // with its own in-page pill — showing the native one too would
            // stack two pills on top of each other.
            if t == .movie && autoScroll.webPillActive { return false }
            return true
        }
    }

    private func open(_ t: Tool) {
        // Chats is always-alive and isn't part of the recent rotation, so it
        // never gets promoted into a bottom-bar slot.
        if t != .chats { recents.use(t) }
        setScreen(.tool(t))
    }
}

/// The custom bottom bar: 🏠 · recent · recent · recent · 🖼️.
private struct BottomBar: View {
    @Binding var screen: Screen
    @ObservedObject var recents: Recents

    var body: some View {
        HStack(spacing: 0) {
            slot(active: screen == .home, { screen = .home }) {
                Image(systemName: "house").font(.system(size: 21, weight: screen == .home ? .semibold : .regular))
            }
            ForEach(recents.recentThree) { t in
                // Tapping a slot just switches to it — no reshuffle. Tools only
                // get promoted into the slots when opened from Home.
                slot(active: screen == .tool(t), { screen = .tool(t) }) {
                    ToolGlyph(tool: t, size: 21, weight: screen == .tool(t) ? .semibold : .regular)
                }
            }
            slot(active: screen == .gallery, { screen = .gallery }) {
                Image(systemName: "square.grid.2x2").font(.system(size: 21, weight: screen == .gallery ? .semibold : .regular))
            }
        }
        .padding(.top, 8)
        .background(
            Theme.surface
                .overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func slot<Icon: View>(active: Bool, _ tap: @escaping () -> Void,
                                   @ViewBuilder icon: () -> Icon) -> some View {
        Button(action: tap) {
            icon()
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
    var openBusiness: () -> Void
    @ObservedObject var recents: Recents
    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    // Sophie's home order: Story Room pinned first; greeting cards, stickers,
    // storybooks, and coloring pages pinned last; everything in between rotates
    // by most-recent use.
    private var tools: [Tool] {
        // Voice Studio, Song Station, Characters and Films sit BELOW the four
        // making staples — Sophie's call: present, but at the end of the list.
        let pinnedBottom: [Tool] = [.greeting, .sticker, .storybook, .coloring,
                                    .voice, .song, .character, .films]
        // Chats and Test Station aren't grid cards — they live as the corner
        // icons in the header (chats top-right, test station top-left).
        // .scratchpad is hidden: the pad IS the Story Room now (the .story
        // tile's /storyroom page serves it), so two tiles would be the same
        // tool twice. The case and view stay for deep links and history.
        // Business tools live on the other home grid, behind the briefcase.
        let middle = Tool.allCases.filter { $0 != .story && $0 != .chats && $0 != .test && $0 != .scratchpad
                                            && !$0.isBusiness && !pinnedBottom.contains($0) }
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
            // Two corner icons on the left, neither a grid card: the Test
            // Station's test tube, and the briefcase across to the BUSINESS
            // home (Instagram, ads, the blog — running the shop rather than
            // making the work).
            .overlay(alignment: .leading) {
                HStack(spacing: 0) {
                    Button { open(.test) } label: {
                        ToolGlyph(tool: .test, size: 20)
                            .foregroundColor(Theme.accent)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Button(action: openBusiness) {
                        Image(systemName: "briefcase")
                            .font(.system(size: 20))
                            .foregroundColor(Theme.accent)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Business")
                }
                .padding(.leading, 4)
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
                            HubCard(tool: t, title: t.title, desc: t.desc)
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

/// The BUSINESS home — the second grid, behind the briefcase. Everything for
/// running the shop rather than making the work. Deliberately not a tool
/// screen: it's a home, so it has no back chevron and no bottom-bar slot — the
/// house in the top-left is the way back to the making home.
private struct BusinessGrid: View {
    var open: (Tool) -> Void
    var goHome: () -> Void
    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    private var tools: [Tool] { Tool.allCases.filter { $0.isBusiness } }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                StarTitle(text: "Business")
            }
            .padding(.top, 12)
            .padding(.bottom, 4)
            // The way back to the making home — the mirror of the briefcase
            // that got you here, in the same corner.
            .overlay(alignment: .leading) {
                Button(action: goHome) {
                    Image(systemName: "house")
                        .font(.system(size: 20))
                        .foregroundColor(Theme.accent)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Home")
                .padding(.leading, 12)
            }
            // Chats stays reachable from both homes, same corner as on the other.
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
                            HubCard(tool: t, title: t.title, desc: t.desc)
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
    // The tool, not a symbol name: a card must draw a bundled custom glyph
    // (Playground) the same way the bottom bar does.
    let tool: Tool
    let title: String
    let desc: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ToolGlyph(tool: tool, size: 26).foregroundColor(Theme.accent)
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

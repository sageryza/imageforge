import SwiftUI
import UIKit   // UIImage(systemName:) — the SF Symbol existence check in ToolGlyph

/// The tools the bottom bar can rotate through. Home (the grid) and Gallery
/// (My Creations) are fixed ends of the bar; everything here is a "mode" that
/// cycles through the three middle slots by most-recently-used.
enum Tool: String, CaseIterable, Identifiable {
    case movie, sticker, coloring, storybook, greeting, dreams, instagram, ads, blog, product, report, story, lessons, writing, editor, cutroom, cutmarks, blocks, pausing, search, chats, test, dump, playground, scratchpad, voice, song, character, films, freeform, vector, chunking, timeline, review
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
        case .search:    return "Search"
        case .cutmarks:  return "Cut Marks"
        case .blocks:    return "Cutting Blocks"
        case .pausing:   return "Pausing"
        case .chats:     return "Chats"
        case .test:      return "Test Station"
        case .dump:      return "Dump"
        case .playground: return "Playground"
        case .scratchpad: return "Scratch Pad"
        case .voice:     return "Voice Studio"
        case .song:      return "Song Station"
        case .character: return "Characters"
        case .films:     return "Films"
        case .freeform:  return "Freeform"
        case .vector:    return "Vector"
        case .chunking:  return "Chunking"
        case .timeline:  return "Story Timeline"
        case .review:    return "Review Queue"
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
        case .search:    return "Find any words in every interview and every memo."
        case .cutmarks:  return "Mark your own cuts on a video or recording — no transcript."
        case .blocks:    return "Break a recording into lines — split, mark, reorder, hear it."
        case .pausing:   return "Set how long a pause is — or put one where there is none."
        case .chats:     return "Every chat's updates in one feed — read or listen."
        case .test:      return "Run one prompt through the house styles."
        case .dump:      return "Send whole albums here — sort them out later."
        case .playground: return "Try prompts on a style — four images a run, same seed."
        case .scratchpad: return "Think in pictures — hearted art laid out as beats."
        case .voice:     return "Your voices read anything you type."
        case .song:      return "Sing a made-up song — keep your voice, gain a band."
        case .character: return "The recurring people — cards that keep faces consistent."
        case .films:     return "Films without a story — experiments and one-offs."
        case .freeform:  return "Your refs, your words — sent exactly as typed."
        case .vector:    return "Drawings that stay sharp at any size. Recolour them free."
        case .timeline:  return "Dictate a story's moments — then put them in order."
        case .chunking:  return "Every clip you’ve made, searchable — the pieces films get cut from."
        case .review:    return "Everything still waiting on your swipe — one pile."
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
        case .search:    return "magnifyingglass"
        case .cutmarks:  return "timeline.selection"
        case .blocks:    return "rectangle.split.3x1"
        // Two upright bars with air between them — a rest, the thing this
        // tool actually shapes. Distinct from the cutting family's scissors
        // and split strips: nothing here removes anything, it sets a length.
        case .pausing:   return "pause"
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
        // A loose scribble — the page with no house style.
        case .freeform:  return "scribble.variable"
        // fallback; .vector uses a custom asset (see customIcon)
        case .vector:    return "point.topleft.down.curvedto.point.bottomright.up"
        // A stack of playable pieces — the library of PARTS you already own.
        //
        // It was `rectangle.split.3x1`, which is the SAME symbol .blocks wears
        // (Sophie, Aug 2026: she couldn't tell the two apart). Both live under
        // the film filter, so the clash was two cards a row apart carrying one
        // glyph. The note it shipped with dodged .lessons' grid and walked
        // straight into Cutting Blocks' strip.
        //
        // The family reads: cutting tools wear scissors and cut strips
        // (.cutroom, .blocks, .cutmarks); Chunking is a SHELF, so it wears a
        // stack — and the play mark says the things on the shelf are footage,
        // not stills. Distinct from `film` (Movies) and `film.stack` (Films,
        // whole films, no play mark).
        case .chunking:  return "play.square.stack"
        // Moments stacked in an order, with one of them picked up — the whole
        // tool is moving a card up and down a list.
        case .timeline:  return "list.bullet.indent"
        // A list with check marks — the pile of things waiting to be worked
        // through. Distinct from .lessons' plain grid and .timeline's list.
        case .review:    return "checklist"
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
        case .vector:     return "Vector"
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
        case .blog:      GatedWebTool(path: "/blog?embed=1", name: "Blog Studio", icon: "newspaper", navTitle: "Blog Studio")
        case .product:   GatedWebTool(path: "/studio?embed=1", name: "the Product Creator", icon: "shippingbox", navTitle: "Product Creator")
        case .report:    GatedWebTool(path: "/report?embed=1", name: "the Shop Report", icon: "chart.line.uptrend.xyaxis", navTitle: "Shop Report")
        case .story:     StoryRoomView()
                             // Same dress as the movies-pushed Story Room: the
                             // heading in the native bar, matched to the page's paper.
                             .forgeTitle("Story Room", paper: StoryRoomView.paper)
        case .lessons:   LessonsView().forgeToolBar("Lessons", paper: LessonsView.paper)
        case .writing:   WritingRoomView()
        case .editor:    EpisodeEditorView()
        case .cutroom:   CuttingRoomView()
        case .search:    SearchView()
        case .cutmarks:  CutMarksView()
        case .blocks:    BlocksView()
        case .pausing:   PausingView()
        case .chats:     ChatFeedView()
        case .test:      TestStationView()
        case .dump:      DumpView().forgeToolBar("Dump")
        case .playground: PlaygroundView()
        case .scratchpad: ScratchPadView()
        // mic: the Voice Studio's CHANGE tab records a take in the page
        // (Aug 2026). Without this the WKWebView denies getUserMedia and the
        // record button dead-ends — the file picker still works either way.
        case .voice:     GatedWebTool(path: "/voice", name: "the Voice Studio", icon: "waveform", mic: true, navTitle: "Voice Studio")
        case .song:      GatedWebTool(path: "/song", name: "the Song Station", icon: "music.note", mic: true, navTitle: "Song Station")
        case .character: GatedWebTool(path: "/character", name: "the Characters page", icon: "person.crop.rectangle", navTitle: "Characters")
        case .films:     GatedWebTool(path: "/films", name: "the Films archive", icon: "film.stack", navTitle: "Films")
        // Page owns its whole header (Aug 2026 v2 design rule) — a bare
        // WKWebView host with NO forgeToolBar, the Chats/Scratch Pad pattern.
        case .freeform:  GatedWebTool(path: "/freeform", name: "Freeform", icon: "scribble.variable")
        // Native bar + chevron, like the other eyebrow-and-title tool pages —
        // only a page owning its WHOLE chrome (Chats, Story Room) gets a bare
        // host. See the headers design rule.
        case .vector:    GatedWebTool(path: "/vector", name: "Vector", icon: "circle.hexagongrid",
                                      navTitle: "Vector")
        // Chunking: the clip library. A shelf + a search box, so the native
        // bar carries the name and the page never repeats it (?embed=1).
        case .chunking:  GatedWebTool(path: "/chunking", name: "Chunking", icon: "play.square.stack",
                                      navTitle: "Chunking")
        // Story Timeline: a shelf of stories, then one open. The page answers
        // window.__navBack, so the chevron goes shelf-ward before it leaves.
        case .timeline:  GatedWebTool(path: "/timeline", name: "Story Timeline", icon: "list.bullet.indent",
                                      navTitle: "Story Timeline")
        // Review Queue: rows link OUT to the decks and grids themselves, so it
        // gets its own wrapper (in-view navigation + history-stepping chevron)
        // rather than GatedWebTool, which bounces off-path links to Safari.
        case .review:    ReviewQueueView()
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

    /// Frame factor for a bundled glyph, so its ink matches the SF Symbols
    /// beside it. MEASURED off a real 3x screenshot of this very screen
    /// (Aug 2026) rather than reasoned about, because reasoning about it had
    /// already failed twice:
    ///
    ///     SF Symbol ink at declared size S   height 0.90-0.95·S, width ~1.13·S
    ///     custom art ink at frame 0.86·S     0.77·S both ways  <- visibly small
    ///
    /// The old rule was built on a note claiming an SF Symbol "draws only
    /// ~0.75·S of ink". It does not — that figure is the myth that made every
    /// previous attempt land wrong (first 1.35·S, far too big; then 0.86·S,
    /// too small). Custom art fills 0.90 of its frame, so a frame of 1.11·S
    /// puts its ink at ~1.00·S — inside the cluster the real symbols occupy.
    static let customFrame: CGFloat = 1.11

    /// A bundled glyph at the custom-icon size rule. Use this for any
    /// hand-drawn asset, so there is ONE place the factor lives.
    static func asset(_ name: String, size: CGFloat) -> some View {
        Image(name)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(width: size * customFrame, height: size * customFrame)
    }

    var body: some View {
        if let asset = tool.customIcon {
            // This ONE rule is only right because every bundled glyph fills
            // exactly 0.90 of its own viewBox — enforced by
            // scripts/normalize-glyphs.py, not by hope. They didn't (0.853 to
            // 1.000), and that spread was the OTHER half of why the hand-drawn
            // icons never matched: the art was inconsistent AND the target was
            // wrong. Both had to be fixed.
            Self.asset(asset, size: size)
                // …in a LAYOUT box the height an SF Symbol of this size would
                // take, so a custom glyph never nudges whatever sits under it
                // (the home grid stacks a title right below the icon) out of
                // line with its neighbours.
                .frame(height: size * 1.2)
        } else {
            Image(systemName: Self.resolve(tool.icon))
                .font(.system(size: size, weight: weight))
        }
    }

    /// An SF Symbol name the running OS doesn't know renders as NOTHING —
    /// `Image(systemName:)` doesn't fall back and doesn't warn on screen, so a
    /// tile just goes blank and the tool looks broken rather than mis-drawn.
    /// Newer symbols are the ones at risk (the app deploys back to iOS 16), and
    /// picking one is a taste call made in a chat with no device to check on,
    /// so the check happens here once instead of being remembered every time.
    static func resolve(_ name: String) -> String {
        UIImage(systemName: name) != nil ? name : "square.stack"
    }
}

/// Which screen the bottom bar is showing. ONE home grid now — business and
/// old-fashioned are FILTERS on it (the shortcut row), not separate screens.
enum Screen: Hashable { case home, tool(Tool), gallery }

/// What the home grid is showing. `.all` is the normal module list; the other
/// three are the shortcut row's filter chips — tapping the lit one clears back
/// to `.all` (the Dump sort page's convention).
enum HomeFilter: Hashable { case all, business, crafts, movie, image }

extension Tool {
    /// The tools behind the BRIEFCASE filter — running the shop rather than
    /// making the work. Kept off the unfiltered list so it stays scannable.
    var isBusiness: Bool {
        switch self {
        case .instagram, .ads, .blog, .product, .report: return true
        default: return false
        }
    }

    /// The tools behind the QUILT filter — the original staples Sophie named:
    /// stickers, storybooks, coloring pages, greeting cards (same family, my
    /// call) and the Writing Room. Also kept off the unfiltered list.
    var isCraft: Bool {
        switch self {
        case .sticker, .storybook, .coloring, .greeting, .writing: return true
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
    // Which slice of the modules the home grid is showing. Lives here, not in
    // HomeGrid, so a deep link (deckfactory://business) can set it.
    @State private var homeFilter: HomeFilter = .all
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
        // A tapped push lands on the Chats screen; ChatFeedView hears the same
        // notification and reloads its page onto the Update tab (?view=news).
        .onReceive(NotificationCenter.default.publisher(for: .forgePushOpenUpdate)) { _ in
            if screen != .tool(.chats) { setScreen(.tool(.chats)) }
        }
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
            homeFilter = .all
            setScreen(.home)
        case "gallery", "creations":
            setScreen(.gallery)
        // The two old home screens are filters on the one home now, so their
        // deep links land on the home with that filter already lit.
        case "business":
            homeFilter = .business
            setScreen(.home)
        case "crafts", "quilt":
            homeFilter = .crafts
            setScreen(.home)
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
            HomeGrid(open: open, filter: $homeFilter, recents: recents)
                .opacity(screen == .home ? 1 : 0)
                .allowsHitTesting(screen == .home)
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
            // The gallery slot shows META ASSETS now (Aug 2026, Sophie: "it
            // will just replace my creations") — the /assets web page, every
            // chat's Assets tab in one automatic feed, app-made creations
            // folded in server-side. CreationsView stays in the repo,
            // deliberately unmounted, in case she ever wants it back.
            NavigationStack { MetaAssetsView() }
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
        case .home: return false
        // Meta Assets is a web page carrying the server-injected pill — the
        // native one on top of it would be two pills in one corner.
        case .gallery: return false
        case .tool(let t):
            // Story Room is a web page with its own in-page pill.
            if t == .writing || t == .chats || t == .story { return false }
            // Episode Editor is a web page too — an arranging tool, not a read,
            // and the pill would sit on top of its sticky header.
            if t == .editor { return false }
            // Playground is a short web form + grid — nothing to autoscroll,
            // and the pill would cover its Generate corner. Same for the two
            // business forms: the pill sat on their first card.
            if t == .playground || t == .product || t == .blog { return false }
            // Cutting Room is a web page with its own injected pill.
            if t == .cutroom { return false }
            // Search is a web page with its own injected pill too.
            if t == .search { return false }
            // Cut Marks too — same family, same injected pill.
            if t == .cutmarks { return false }
            // Cutting Blocks too — same family, same injected pill.
            if t == .blocks { return false }
            // Pausing too — same family, same injected pill.
            if t == .pausing { return false }
            // Scratch Pad is a web page with its own injected pill — showing
            // the native one too would stack two pills.
            if t == .scratchpad { return false }
            // Freeform is a web page with its own injected pill too.
            if t == .freeform { return false }
            // Vector is a web page with its own injected pill too.
            if t == .vector { return false }
            // Chunking is a web page with its own injected pill too.
            if t == .chunking { return false }
            // Story Timeline is served with { pill: true } as well.
            if t == .timeline { return false }
            // Review Queue is served with { pill: true } as well.
            if t == .review { return false }
            // Voice Studio is served with { pill: true } as well — it was the
            // one injected-pill page missing from this list, so both pills
            // drew and the speed label read "Fast" twice (Sophie's
            // screenshot, Aug 2026).
            if t == .voice { return false }
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

/// One stop on the movie & sound road — its number, its name, one line of what
/// happens there, and the tools that live at it. `HomeGrid.pipeline` is the
/// whole road and the ONLY place the order is written down.
private struct MovieStage: Identifiable {
    let n: Int
    let name: String
    let line: String
    let tools: [Tool]
    var id: Int { n }
}

/// The Home grid — every tool as a card. Tapping one opens it (and promotes it
/// into the recent slots). Above the cards sits the shortcut row: five rounded
/// squares, icons only, that either open a tool or filter the cards below.
private struct HomeGrid: View {
    var open: (Tool) -> Void
    @Binding var filter: HomeFilter
    @ObservedObject var recents: Recents
    /// The update button's cover. A COVER and not a `Tool` on purpose: opening
    /// a tool promotes it into `Recents`, so this button would evict one of her
    /// three bottom-bar slots on every tap — and it's the button meant to be
    /// tapped most. See BriefView for the rest of that reasoning.
    @State private var showBrief = false
    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    /// THE MOVIE & SOUND TAB IS A PIPELINE, NOT A PILE (Aug 2026, Sophie:
    /// "right now there's so many movie tools it's confusing… my possible fix
    /// is changing the movies tab to a sort of pipeline that shows the order
    /// they're meant to be used in").
    ///
    /// So this set is not a list any more — it is SIX ORDERED STOPS, and
    /// `movieTools` below is derived from them. One source of truth: adding a
    /// tool to a stage puts it in the tab, takes it off the default home, and
    /// gives it a place in the order, all at once. Re-ordering the road is
    /// re-ordering this array and nothing else.
    ///
    /// The order is the one the two pipeline docs already describe —
    /// `docs/audio-pipeline.md` (capture → blocks → arrange → word cut →
    /// exact cut → polish) with the story stops in front of it and the picture
    /// stops behind, so a film walks the page top to bottom.
    ///
    /// **Movies and sound are ONE road, deliberately interleaved** (her ask
    /// the same day: "for now group movies and audio together") — the audio
    /// stops are 2–4 and the picture stops are 5, rather than two separate
    /// piles that never mention each other.
    ///
    /// TWO tools that are NOT here, and why:
    /// - **Song Station** is gone from every grid — "get rid of song station
    ///   altogether". The tool, its page and `deckfactory://song` all still
    ///   work; it simply has no card anywhere now.
    /// - **Scratch Pad** is the Story Room (the `.story` tile serves the pad's
    ///   page), so listing it would be the same tool twice.
    ///
    /// **Story Room came BACK into this tab** (Sophie, Aug 2026: "move
    /// everything onto the movies page like the story boards…") — it had been
    /// pulled out earlier ("story room is no longer movies") and pinned first
    /// on the default home. Her newer word wins; it is stop 1 here and has no
    /// card on the default home any more.
    private static let pipeline: [MovieStage] = [
        MovieStage(n: 1, name: "The story",
                   line: "What it is about, and what order it happens in.",
                   tools: [.story, .timeline]),
        MovieStage(n: 2, name: "The voice",
                   line: "Find the take you already have — or speak the line.",
                   tools: [.search, .voice]),
        MovieStage(n: 3, name: "The cut",
                   line: "Break the recording up, then take the words you want.",
                   tools: [.blocks, .editor, .cutmarks]),
        MovieStage(n: 4, name: "The polish",
                   line: "Pauses and filler out, then how long each beat sits.",
                   tools: [.cutroom, .pausing]),
        MovieStage(n: 5, name: "The pictures",
                   line: "Faces first, so they stay the same — then the film.",
                   tools: [.character, .movie, .dreams]),
        MovieStage(n: 6, name: "The shelf",
                   line: "What is already made — to cut from, or to watch.",
                   tools: [.chunking, .films]),
    ]

    /// The film filter's set — everything that makes or cuts moving pictures
    /// AND sound, so the voice/audio tools belong here too (Sophie, Aug 2026).
    /// DERIVED from `pipeline` above, never hand-written beside it.
    ///
    /// **These tools are HIDDEN from the default home** — `tools` below
    /// subtracts this list, so the film chip works exactly like the quilt and
    /// the briefcase. That was Sophie's fix for the asymmetry she spotted
    /// ("the quilt hides the modules but the movies tab doesn't"): she wanted
    /// them off the home screen and in the movie tab, not in both places.
    private static let movieTools: [Tool] = HomeGrid.pipeline.flatMap { $0.tools }

    /// The image filter's set — the three "make me a picture" tools. This is
    /// the only place the Test Station gets a CARD: it's otherwise just the
    /// test tube beside the masthead. Playground and **Freeform** also sit on
    /// the DEFAULT home (Sophie, Aug 2026: "put Freeform in the default") —
    /// this filter narrows to them, it doesn't own them.
    private static let imageTools: [Tool] = [.playground, .test, .freeform, .vector]

    /// What the cards show: the normal list, or one filter's slice.
    private var shown: [Tool] {
        switch filter {
        case .all:      return tools
        case .business: return Tool.allCases.filter { $0.isBusiness }
        case .crafts:   return Tool.allCases.filter { $0.isCraft }
        case .movie:    return Self.movieTools
        case .image:    return Self.imageTools
        }
    }

    // Sophie's home order: everything rotates by most-recent use. Nothing is
    // pinned to the top or the bottom anymore — Story Room held the first slot
    // until she moved it into the movie tab (Aug 2026), and the old bottom trio
    // (Voice Studio, Characters, Films) are film tools that went the same way.
    private var tools: [Tool] {
        // THE FILM FILTER NOW HIDES ITS TOOLS FROM THE DEFAULT HOME, the same
        // way the quilt and briefcase always have (Aug 2026, Sophie, resolving
        // the asymmetry she spotted: "leave the stuff off the home screen,
        // just put it in the movie tab"). So Movies, Films, Cutting Room, Cut
        // Marks, Episode Editor, Voice Studio, Search and Characters live in
        // the film tab ONLY — and the old `pinnedBottom` trio (Voice Studio,
        // Characters, Films) is gone with them, since every one of those three
        // was a film tool sitting at the bottom of this list.
        //
        // The PICTURES filter is deliberately still a pure narrowing: Sophie
        // asked for Freeform on the default home, so Playground and Freeform
        // are cards here AND under the photo chip. Only the Test Station is
        // filter-only there.
        //
        // Song Station has NO card anywhere (Aug 2026, "get rid of song
        // station altogether") — not here, not under the film filter.
        // Deliberately not deleted: the case, the view and
        // `deckfactory://song` still work, so bringing it back is one line.
        //
        // Chats and Test Station aren't grid cards — they're the two corner
        // icons beside the masthead. .scratchpad is hidden because the pad IS
        // the Story Room now (the .story tile's /storyroom page serves it), so
        // two tiles would be the same tool twice; its case and view stay for
        // deep links and history. Story Room itself is stop 1 of the movie
        // pipeline now, so `movieTools` takes it off this list.
        let middle = Tool.allCases.filter { $0 != .chats && $0 != .test && $0 != .scratchpad
                                            && $0 != .song && $0 != .vector
                                            && !$0.isBusiness && !$0.isCraft
                                            && !Self.movieTools.contains($0) }
        let ranked = recents.order.filter { middle.contains($0) }
        let rest = middle.filter { !ranked.contains($0) }
        return ranked + rest
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                StarTitle(text: "Deck Factory")
            }
            .padding(.top, 12)
            .padding(.bottom, 4)
            // Four corner icons, Sophie's arrangement: test tube + briefcase
            // on the left, quilt + Chats on the right with Chats on the very
            // END (its old spot). The briefcase and quilt are the same FILTERS
            // as in the row below — several of these live in two places on
            // purpose ("it can be in two places, silly").
            .overlay(alignment: .leading) {
                HStack(spacing: 0) {
                    corner(label: "Test Station") { open(.test) } icon: {
                        ToolGlyph(tool: .test, size: 20)
                    }
                    corner(label: "Business") { toggle(.business) } icon: {
                        Image(systemName: "briefcase").font(.system(size: 20))
                    }
                }
                .padding(.leading, 4)
            }
            .overlay(alignment: .trailing) {
                HStack(spacing: 0) {
                    corner(label: "Old fashioned") { toggle(.crafts) } icon: {
                        quiltGlyph(20)
                    }
                    corner(label: "Chats") { open(.chats) } icon: {
                        Image(systemName: Tool.chats.icon).font(.system(size: 20))
                    }
                }
                .padding(.trailing, 4)
            }
            // Sophie: "a tad lower under Deck Factory so it doesn't feel so
            // crowded" — the row needs air between it and the masthead.
            shortcutRow.padding(.top, 14)
            updateButton
            ScrollView {
                // The movie chip draws the ROAD (numbered stops, in order);
                // every other slice is the plain grid it has always been.
                if filter == .movie {
                    pipelineCards
                } else {
                    LazyVGrid(columns: grid, spacing: 14) {
                        ForEach(shown) { t in
                            Button { open(t) } label: {
                                HubCard(tool: t, title: t.title, desc: t.desc)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .fullScreenCover(isPresented: $showBrief) { BriefView() }
    }

    /// The movie & sound tab, drawn as the ROAD rather than as a pile: each
    /// stop numbered, named, and carrying the tools that live at it, in the
    /// order a film actually walks (Sophie, Aug 2026 — see `pipeline` above).
    ///
    /// The cards themselves are the SAME `HubCard` as every other slice — the
    /// only thing this view adds is the ordering and the stop headers, so a
    /// tool never looks like a different tool depending on which chip is lit.
    private var pipelineCards: some View {
        VStack(alignment: .leading, spacing: 24) {
            ForEach(Self.pipeline) { stage in
                VStack(alignment: .leading, spacing: 10) {
                    stageHeader(stage)
                    LazyVGrid(columns: grid, spacing: 14) {
                        ForEach(stage.tools) { t in
                            Button { open(t) } label: {
                                HubCard(tool: t, title: t.title, desc: t.desc)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding()
    }

    /// One stop's header: its number, its name in the label voice, and one
    /// line of what happens here, over a hairline that runs the width.
    ///
    /// The name is the SANS in CAPS at a normal weight with tracking (the
    /// house label rule) — the number carries the emphasis instead, so nothing
    /// here needs bold to read as a heading.
    private func stageHeader(_ stage: MovieStage) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(stage.n)")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(Theme.accent)
                Text(stage.name.uppercased())
                    .font(.system(size: 13))
                    .tracking(1.1)
                    .foregroundColor(Theme.text)
            }
            Text(stage.line)
                .font(.caption)
                .foregroundColor(Theme.textDim)
                .fixedSize(horizontal: false, vertical: true)
            Rectangle()
                .fill(Theme.border)
                .frame(height: 1)
        }
    }

    /// THE UPDATE BUTTON (Aug 2026, Sophie: "an update button on the home
    /// screen that I can just click and then it does an API call that gives me
    /// the top five things I might want to be updated on").
    ///
    /// It sits between the shortcut row and the cards — the first thing under
    /// the chrome, where "what happened while I was away" belongs, and clear of
    /// the masthead's four corner icons, which are already as many as fit.
    ///
    /// **Not a sixth square in the shortcut row**: six 60pt squares don't fit a
    /// 375pt phone (6 × 60 = 360 inside 343 of usable row), and the squares only
    /// just grew from 48 to 60 because there were five. Shrinking them back to
    /// add this would undo a change she asked for.
    ///
    /// **It hugs its words** — the house button rule — so it reads as one thing
    /// to tap rather than a slab lying across the screen.
    ///
    /// It carries NO count badge, deliberately: a badge means fetching the
    /// brief every time the home grid draws, and the number would then be the
    /// only part of this screen that can be stale or wrong. The tap is the ask.
    private var updateButton: some View {
        Button { showBrief = true } label: {
            HStack(spacing: 7) {
                Image(systemName: "list.bullet.rectangle").font(.system(size: 16))
                Text("What's new").font(.system(size: 15, weight: .semibold))
            }
            .foregroundColor(Theme.accent)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Theme.surface)
            .cornerRadius(Theme.radius)
            .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                .stroke(Theme.accent, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: Theme.radius))
        }
        .buttonStyle(.plain)
        .padding(.top, 12)
    }

    /// Side of a shortcut button, and the icon inside it.
    ///
    /// **60, up from 48 (Aug 2026, Sophie: "the icons are too small — they
    /// were set when there were six and now there's only five, make them fill
    /// out the space a little better").** 48 was sized for SIX squares on the
    /// narrowest phone (375pt: 6 x 48 = 288 inside 343 of usable row), and the
    /// row has held five since the Dump square came off — so a quarter of the
    /// row was gap.
    ///
    /// The arithmetic, so the next change does not have to guess. Usable row =
    /// screen width - 32 (the row's own 16pt padding each side); five squares
    /// leave (usable - 5 x side) / 4 between them:
    ///
    ///     375pt phone   343 usable   gap 10.8    (was 20.6 at 48)
    ///     390pt phone   358 usable   gap 14.5    (was 24.4)
    ///     430pt phone   398 usable   gap 24.5    (was 34.4)
    ///
    /// 375 is the floor we hold to, and 60 still leaves a real gap there. This
    /// makes the row ~12pt taller, which pushes the module cards down — Sophie
    /// said that is fine.
    private static let squareSide: CGFloat = 60
    /// The glyph inside, scaled with the square (48/21 ≈ 60/26).
    private static let squareIcon: CGFloat = 26

    /// FIVE rounded SQUARES across, icons only (Sophie: "just the icon"). ONE
    /// opens a tool (Chats); the other four are filters on the cards below —
    /// the lit one clears back to everything when tapped again. Chats is here
    /// AND in its top-right corner on purpose ("it can be in two places,
    /// silly"), so don't "fix" that duplicate.
    ///
    /// **The DUMP square came off (Aug 2026, Sophie: "we can get rid of the
    /// dump button in the row at the top since it's now in the main home
    /// screen as the default").** It was a shortcut to a tool that is a card
    /// two inches below it — worth the slot back when the film tools left and
    /// the default grid got short. The Dump still opens on SORT from its card.
    private var shortcutRow: some View {
        HStack(spacing: 0) {
            square(lit: false, label: "Chats") { open(.chats) } icon: {
                Image(systemName: Tool.chats.icon).font(.system(size: Self.squareIcon))
            }
            // Deliberately NOT the generate star: that glyph is reserved for
            // controls that spend a model call, and a filter spends nothing.
            square(lit: filter == .image, label: "Pictures") { toggle(.image) } icon: {
                Image(systemName: "photo").font(.system(size: Self.squareIcon))
            }
            square(lit: filter == .business, label: "Business") { toggle(.business) } icon: {
                Image(systemName: "briefcase").font(.system(size: Self.squareIcon))
            }
            square(lit: filter == .crafts, label: "Old fashioned") { toggle(.crafts) } icon: {
                quiltGlyph(Self.squareIcon)
            }
            square(lit: filter == .movie, label: "Movies & sound") { toggle(.movie) } icon: {
                Image(systemName: "film").font(.system(size: Self.squareIcon))
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
    }

    private func toggle(_ f: HomeFilter) {
        filter = (filter == f) ? .all : f
    }

    /// The hand-drawn quilt, sized by the one custom-icon rule in `ToolGlyph`
    /// — never a hand-picked number here, which is how it drifted before.
    private func quiltGlyph(_ size: CGFloat) -> some View {
        ToolGlyph.asset("Quilt", size: size)
    }

    /// A header corner icon — plain glyph, no chrome, 44pt tap target.
    private func corner<Icon: View>(label: String, _ tap: @escaping () -> Void,
                                    @ViewBuilder icon: () -> Icon) -> some View {
        Button(action: tap) {
            icon()
                .foregroundColor(Theme.accent)
                .frame(width: 40, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// One shortcut button. A real SQUARE (Sophie — the first cut stretched
    /// them into rectangles by sharing the width out), and the lit state is a
    /// THICKER GOLD outline over a light gold tint, keeping the gold icon —
    /// filling the square with solid accent read as "turned beige".
    private func square<Icon: View>(lit: Bool, label: String,
                                    _ tap: @escaping () -> Void,
                                    @ViewBuilder icon: () -> Icon) -> some View {
        Button(action: tap) {
            icon()
                .foregroundColor(Theme.accent)
                .frame(width: Self.squareSide, height: Self.squareSide)
                .background(lit ? Theme.accent.opacity(0.14) : Theme.surface)
                .cornerRadius(Theme.radiusLg)
                .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg)
                    .stroke(lit ? Theme.accent : Theme.border, lineWidth: lit ? 2.5 : 1))
                .contentShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
                // Equal-width CELL, fixed-size square centred in it — the
                // square keeps its shape whatever the screen width, and the
                // gaps stay even. (Letting the square itself stretch to fill
                // the cell is what made them rectangles.)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
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

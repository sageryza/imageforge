import SwiftUI
import UIKit   // UIImage(systemName:) — the SF Symbol existence check in ToolGlyph

/// Every tool in the app. The bottom bar shows five of them and they are all
/// fixed: Home (the grid) and Gallery at the ends, and the three in `barTools`
/// between them. Everything else is reached from the home grid or a deep link.
enum Tool: String, CaseIterable, Identifiable {
    case movie, sticker, coloring, storybook, greeting, dreams, instagram, ads, blog, product, report, story, lessons, writing, editor, cutroom, cutmarks, blocks, pausing, search, chats, test, dump, playground, scratchpad, voice, song, character, films, freeform, vector, chunking, assembly, filmeditor, timeline, review, crop, shoebox
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
        case .assembly:  return "Assembly"
        case .filmeditor: return "Film Editor"
        case .timeline:  return "Story Timeline"
        case .review:    return "Review Queue"
        case .crop:      return "Squaring"
        case .shoebox:   return "Shoebox"
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
        case .assembly:  return "Put clips in order on a timeline — then bake one film."
        case .filmeditor: return "Cut a film with taps — split, trim, reorder, one audio track."
        case .review:    return "Everything still waiting on your swipe — one pile."
        case .crop:      return "Crop pictures square with arrows — nothing to drag."
        case .shoebox:   return "Every polaroid in your Memory Library — one shelf."
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
        // A crop frame: what the whole tool does, in one glyph.
        case .crop:      return "crop"
        // An archive box — a shoebox of kept things. Distinct from the Dump's
        // tray-with-arrow (an inbox) and Product Creator's shippingbox.
        case .shoebox:   return "archivebox"
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
        // Two rectangles of footage, one landing on the other — putting clips
        // together. Distinct from Chunking's shelf stack (squares) and from
        // Films' film.stack: this one is the act of joining, not the library.
        case .assembly:  return "play.rectangle.on.rectangle"
        // A timeline with a span selected — the editor is the act of
        // choosing spans. Distinct from Assembly (joining rectangles) and
        // the scissors family (audio cutting).
        case .filmeditor: return "timeline.selection"
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
                         // No .forgeTitle: the PAGE owns the header (Aug 2026,
                         // Sophie: "get rid of the apple native bar"). The view
                         // carries .forgeWebToolBar itself, which hides the bar
                         // while the page is up and brings it back — with this
                         // title — only for the failure screen.
        case .story:     StoryRoomView()
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
        // Squaring: one screen, the picture and the arrows. The page draws its
        // own header via pagehead.js — no Apple bar (the Aug 2026 rule).
        case .crop:      GatedWebTool(path: "/crop", name: "Squaring", icon: "crop",
                                      navTitle: "Squaring")
        // Shoebox: the Memory Library's polaroids, read-only. The page draws
        // its own header via pagehead.js — no Apple bar (the Aug 2026 rule).
        case .shoebox:   GatedWebTool(path: "/shoebox", name: "the Shoebox", icon: "archivebox",
                                      navTitle: "Shoebox")
        // Chunking: the clip library. A shelf + a search box, so the native
        // bar carries the name and the page never repeats it (?embed=1).
        case .chunking:  GatedWebTool(path: "/chunking", name: "Chunking", icon: "play.square.stack",
                                      navTitle: "Chunking")
        // Assembly: the clip shelf over a timeline. Two levels (the shelf of
        // assemblies, one open) — the page answers window.__navBack, so the
        // chevron goes shelf-ward before it leaves.
        case .assembly:  GatedWebTool(path: "/assembly", name: "Assembly", icon: "play.rectangle.on.rectangle",
                                      navTitle: "Assembly")
        // Film Editor: her tap editor — two levels (the shelf of cuts, one
        // open); the page answers window.__navBack.
        case .filmeditor: GatedWebTool(path: "/filmeditor", name: "Film Editor", icon: "timeline.selection",
                                       navTitle: "Film Editor")
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

    /// The server page this tool HOSTS, or nil for a native screen. Query
    /// strings are not part of it — `/blog?embed=1` is the `/blog` page.
    ///
    /// WHY THIS EXISTS: `showAutoScroll` below used to be a hand-kept blacklist
    /// of "tools whose page already carries a pill", and forgetting one is
    /// SILENT — you get two pills stacked in the same corner and the speed
    /// label reading "Fast" twice. It had already been missed once (Voice
    /// Studio, Aug 2026) and was missed FIVE more times: Dreams, Shop Report,
    /// Characters, Song Station and Films were all drawing two (2026-08-27,
    /// Sophie's screenshot of the Characters page: "two pills"). So the answer
    /// is DERIVED from this map plus `forgePillPages`, and
    /// `scripts/test-native-pill.js` reads both out of this file and compares
    /// them against server.js — the ForgeLinks/applinks contract, same shape.
    var webPath: String? {
        switch self {
        case .blog:       return "/blog"
        case .product:    return "/studio"
        case .report:     return "/report"
        case .dreams:     return "/dreams"
        case .story:      return "/storyroom"
        case .lessons:    return "/lessons"
        case .writing:    return "/writing"
        case .editor:     return "/editor"
        case .cutroom:    return "/cuttingroom"
        case .search:     return "/search"
        case .cutmarks:   return "/cutmarks"
        case .blocks:     return "/blocks"
        case .pausing:    return "/pausing"
        case .chats:      return "/chats"
        case .playground: return "/playground"
        case .scratchpad: return "/scratchpad"
        case .voice:      return "/voice"
        case .song:       return "/song"
        case .character:  return "/character"
        case .films:      return "/films"
        case .freeform:   return "/freeform"
        case .vector:     return "/vector"
        case .chunking:   return "/chunking"
        case .assembly:   return "/assembly"
        case .filmeditor: return "/filmeditor"
        case .timeline:   return "/timeline"
        case .review:     return "/review"
        case .crop:       return "/crop"
        case .shoebox:    return "/shoebox"
        // Native screens — nothing to collide with.
        case .movie, .sticker, .coloring, .storybook, .greeting, .instagram,
             .ads, .test, .dump:
            return nil
        }
    }
}

/// EVERY PAGE THAT ALREADY CARRIES AN AUTOSCROLL PILL — the ones the server
/// injects it into (`serveGated(…, { pill: true })` in server.js) plus the two
/// that BAKE their own copy from scripts/pill.py (chats.html, writing.html).
///
/// The app cannot read server.js, so this is a mirror — and a mirror nothing
/// but a test compares is exactly how the six double-pill tools happened.
/// `scripts/test-native-pill.js` derives the real set from server.js and the
/// baked pages and fails on drift, in either direction: a page listed here
/// that has no pill loses its native one (no way back to the top), and a page
/// missing from here draws two.
let forgePillPages: Set<String> = [
    "/assembly", "/assets", "/audio", "/blocks", "/blog", "/brief", "/character",
    "/chunking", "/clips", "/crystals", "/crystalsplit", "/cutmarks", "/cuttingroom",
    "/deliverables", "/desktop", "/dreams", "/dreams-archive", "/dump", "/editor",
    "/films", "/freeform", "/import", "/instagram", "/pausing", "/photo", "/playground",
    "/promptlab", "/report", "/review", "/scratchpad", "/search", "/shoebox", "/song",
    "/storyroom", "/studio", "/timeline", "/vector", "/voice",
    // baked in-page from scripts/pill.py, not injected
    "/chats", "/gallery", "/wall", "/writing",
]

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
enum HomeFilter: Hashable { case all, business, crafts, movie, movieFlat, image }

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

/// THE THREE MIDDLE BAR SLOTS ARE FIXED (2026-08-26, Sophie: "right now the
/// bottom real icons switch off can you change it so they're permanent I want
/// the story room, the story timeline and the playground"). They used to
/// rotate by most-recently-used, so the three tools under her thumb changed
/// every time she opened something else from Home — the bar could never be
/// learned, and the tool she wanted was never where she left it.
///
/// Nothing else about `Recents` changed: it still tracks use order, because
/// the HOME GRID ranks its cards by it. Only the bar stopped reading it.
let barTools: [Tool] = [.story, .timeline, .playground]

/// Tracks most-recently-used tools — the HOME GRID's card order. The bottom
/// bar no longer reads this (see `barTools` above).
final class Recents: ObservableObject {
    @Published private(set) var order: [Tool]
    private let key = "deckfactory.recentTools.v1"

    init() {
        let saved = UserDefaults.standard.stringArray(forKey: key) ?? []
        order = saved.compactMap { Tool(rawValue: $0) }
    }

    /// Promote a tool to most-recent (so it leads the home grid).
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
            BottomBar(screen: Binding(get: { screen }, set: { setScreen($0) }))
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
        // UNIVERSAL LINKS — the same thing for an ordinary
        // https://imageforge-q125.onrender.com/… link, which unlike a custom
        // scheme is tappable everywhere she reads (Aug 2026). iOS delivers it
        // as a browsing activity, not through onOpenURL, so this second door
        // is required; both walk into the same handler. See ForgeLinks.swift.
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL { handleDeepLink(url) }
        }
        // AND THE SAME LINK TAPPED INSIDE THE APP (2026-08-25). iOS never
        // hands a universal link to the app it is already in, so a tool link
        // in a message used to bounce out to Safari. The web views ask
        // ForgeLinks.open first and it arrives here instead.
        .onReceive(NotificationCenter.default.publisher(for: ForgeLinks.opened)) { note in
            if let url = note.object as? URL { handleDeepLink(url) }
        }
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
        let dest: String
        if url.scheme?.lowercased() == "deckfactory" {
            // accept deckfactory://writing and deckfactory:///writing alike
            dest = (url.host ?? url.path)
                .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                .lowercased()
        } else if let d = ForgeLinks.destination(for: url) {
            dest = d
        } else {
            // A path we don't claim any more (Apple caches the site's
            // association file for a while). Bring the app forward on
            // whatever she was looking at rather than jumping her somewhere.
            return
        }
        // THE QUERY IS CARRIED NOW, which is what makes a link land on ONE
        // THREAD rather than on the Chats list — /chats?chat=<slug> and
        // deckfactory://chats?chat=<slug> alike. It rides the same one-shot
        // pending flags a tapped push already uses (chats.html strips either
        // param after honouring it, so a later reload can't drag her back),
        // so there is one mechanism here and not two.
        let q = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if dest == "chats" {
            let chat = q.first(where: { $0.name == "chat" })?.value ?? ""
            let view = q.first(where: { $0.name == "view" })?.value ?? ""
            if !chat.isEmpty {
                PushDelegate.pendingChat = chat
                PushDelegate.pendingUpdateTab = false
            } else if view == "news" {
                PushDelegate.pendingChat = nil
                PushDelegate.pendingUpdateTab = true
            }
            if !chat.isEmpty || view == "news" {
                // ChatFeedView reloads its page onto the pending destination,
                // and RootView's own listener brings the Chats screen up.
                NotificationCenter.default.post(name: .forgePushOpenUpdate, object: nil)
                return
            }
        }
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

    // The tools kept ALIVE in the stack: the three permanent bar tools, plus
    // whatever tool is open right now. The bar's three used to be the whole
    // list — which only worked because opening anything from Home promoted it
    // INTO that list. With the slots fixed (see `barTools`) a tool opened from
    // Home belongs to neither, so it has to be added here or its screen would
    // render as nothing at all.
    //
    // It also carries the ONE most-recently-opened tool from outside the bar,
    // which is what keeps the old promise: before the slots were fixed, a tool
    // opened from Home became a bar slot and so stayed alive, and walking
    // Home → Playground → Home kept the half-typed prompt. Without it a
    // fixed bar would silently start throwing that work away on every trip.
    private var alive: [Tool] {
        var t = barTools
        if let recent = recents.order.first(where: { $0 != .chats && !barTools.contains($0) }) {
            t.append(recent)
        }
        if case .tool(let cur) = screen, cur != .chats, !t.contains(cur) { t.append(cur) }
        return t.filter { $0 != .chats }
    }

    // Keep those tools + gallery alive so their state (a generated sheet, a
    // half-typed prompt) survives switching tabs; only the selected one is
    // shown.
    private var content: some View {
        ZStack {
            HomeGrid(open: open, filter: $homeFilter, recents: recents)
                .opacity(screen == .home ? 1 : 0)
                .allowsHitTesting(screen == .home)
            ForEach(alive) { t in
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

    /// The native pill, on every screen that has nothing else drawing one.
    /// DERIVED from `Tool.webPath` + `forgePillPages` — never a per-tool list
    /// again; see the note on `webPath` for what the list cost.
    private var showAutoScroll: Bool {
        switch screen {
        case .home: return false
        // Meta Assets is the /assets web page, which carries the injected pill.
        case .gallery: return false
        case .tool(let t):
            // The page already has one. Two in one corner is the bug this
            // whole map exists to make impossible.
            if let p = t.webPath, forgePillPages.contains(p) { return false }
            // Film Editor is ONE screen that never scrolls — no pill at all,
            // which is also why /filmeditor is not in the set above.
            if t == .filmeditor { return false }
            // The Story Room, pushed INSIDE the movies tool, is a web page with
            // its own in-page pill — the one case a tool's pill depends on
            // where it currently is rather than on which page it hosts.
            if t == .movie && autoScroll.webPillActive { return false }
            return true
        }
    }

    private func open(_ t: Tool) {
        // Use order ranks the HOME GRID's cards; the bar's three are fixed.
        // Chats is always-alive and is never a card, so it never gets ranked.
        if t != .chats { recents.use(t) }
        setScreen(.tool(t))
    }
}

/// The custom bottom bar: 🏠 · Story Room · Story Timeline · Playground · 🖼️.
/// The three middle slots are PERMANENT (see `barTools`) — they used to rotate
/// by most-recent use, so the tools under her thumb moved every time she opened
/// something else.
private struct BottomBar: View {
    @Binding var screen: Screen

    var body: some View {
        HStack(spacing: 0) {
            slot(active: screen == .home, { screen = .home }) {
                Image(systemName: "house").font(.system(size: 21, weight: screen == .home ? .semibold : .regular))
            }
            ForEach(barTools) { t in
                // Tapping a slot just switches to it — the three never move.
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
    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 14)]
    /// THREE to a row, fixed — the flat movie pile's cards are small enough
    /// that an adaptive minimum would give four on a big phone and two on a
    /// small one. Sophie asked for three, so three it is at every width.
    /// The second film chip's glyph. `movieclapper` is iOS 17+, and an SF
    /// Symbol the running OS doesn't know renders as NOTHING — so the fallback
    /// is named HERE rather than left to `ToolGlyph.resolve`, whose generic
    /// `square.stack` would say nothing about film on the one chip that has to
    /// read as a second film chip.
    private static let flatFilmSymbol: String =
        UIImage(systemName: "movieclapper") != nil ? "movieclapper" : "video"
    private static let tightGrid = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

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
    /// **Story Room is stop 1 here AND a card on the default home** (Sophie,
    /// 2026-08-24: "someone took the story room module out of the default
    /// icons on the homepage… can you add it back"). It came back into this
    /// tab in Aug 2026 ("move everything onto the movies page like the story
    /// boards…") and the film filter's hide-from-home rule then took its home
    /// card away as a side effect — which is not what she asked for either
    /// time. It is the ONE named exception to that rule (`homeAlso` below);
    /// the flat movies chip still drops it, on her own reasoning that it is
    /// "already on the home screen".
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
                   tools: [.chunking, .assembly, .filmeditor, .films]),
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

    /// Pipeline tools that ALSO keep a card on the default home. One entry,
    /// Story Room — see the note in `tools` below. Keep this tiny: the film
    /// chip's whole point is that its tools are not also on the home screen.
    private static let homeAlso: Set<Tool> = [.story]

    /// THE SECOND MOVIES CHIP — the same tools as one flat pile (Aug 2026,
    /// Sophie: "add a second movies icon but choose a different icon for it …
    /// the exact same modules except smaller so they just have the icon and
    /// the name, three to a row … get rid of the words that say number one
    /// number two etc. so it's all just one big pile").
    ///
    /// It is the SAME set as `movieTools`, deliberately — one road, two ways
    /// of looking at it: the numbered stops when she wants the order
    /// explained, this when she just wants to get to a tool. So it is DERIVED
    /// from `pipeline` too, and adding a tool to a stage puts it in both.
    ///
    /// Two changes she asked for on top of the flattening:
    /// - **Story Timeline leads** — this view is meant to read as the
    ///   pipeline, and the timeline is where a film starts.
    /// - **Story Room is not here** ("take out story room since it's already
    ///   on the home screen"). It stays stop 1 of the numbered tab.
    ///
    /// The FINAL ORDER is still Sophie's call — she said she would decide it
    /// off the mockup — so this array is the thing to re-order and nothing
    /// else follows from it.
    private static let flatMovieTools: [Tool] = {
        let lead: [Tool] = [.timeline]
        let drop: Set<Tool> = [.story, .timeline]
        return lead + HomeGrid.pipeline.flatMap { $0.tools }.filter { !drop.contains($0) }
    }()

    /// The image filter's set — the three "make me a picture" tools. This is
    /// the only place the Test Station gets a CARD: it's otherwise just the
    /// test tube beside the masthead. Playground and **Freeform** also sit on
    /// the DEFAULT home (Sophie, Aug 2026: "put Freeform in the default") —
    /// this filter narrows to them, it doesn't own them.
    private static let imageTools: [Tool] = [.playground, .test, .freeform, .vector, .crop, .shoebox]

    /// What the cards show: the normal list, or one filter's slice.
    private var shown: [Tool] {
        switch filter {
        case .all:      return tools
        case .business: return Tool.allCases.filter { $0.isBusiness }
        case .crafts:   return Tool.allCases.filter { $0.isCraft }
        case .movie:    return Self.movieTools
        case .movieFlat: return Self.flatMovieTools
        case .image:    return Self.imageTools
        }
    }

    // Sophie's home order: everything rotates by most-recent use. Nothing is
    // pinned to the top or the bottom anymore — Story Room held the first slot
    // until she moved it into the movie tab (Aug 2026; it is a card here again
    // since 2026-08-24, just no longer pinned first), and the old bottom trio
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
        // deep links and history.
        //
        // STORY ROOM IS THE ONE EXCEPTION TO THE FILM-FILTER HIDE (`homeAlso`,
        // Sophie 2026-08-24: "someone took the story room module out of the
        // default icons on the homepage… can you add it back"). It is stop 1
        // of the pipeline AND a card here — losing the card was a side effect
        // of the hide rule, never something she asked for. Everything else in
        // `movieTools` stays film-tab-only.
        let middle = Tool.allCases.filter { $0 != .chats && $0 != .test && $0 != .scratchpad
                                            && $0 != .song && $0 != .vector
                                            && !$0.isBusiness && !$0.isCraft
                                            && (!Self.movieTools.contains($0)
                                                || Self.homeAlso.contains($0)) }
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
            ScrollView {
                // The movie chip draws the ROAD (numbered stops, in order);
                // every other slice is the plain grid it has always been.
                if filter == .movie {
                    pipelineCards
                } else if filter == .movieFlat {
                    // One pile, three to a row, icon + name only.
                    LazyVGrid(columns: Self.tightGrid, spacing: 12) {
                        ForEach(Self.flatMovieTools) { t in
                            Button { open(t) } label: {
                                TightCard(tool: t, title: t.title)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
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

    // THE UPDATE BUTTON LIVED HERE AND MOVED (Aug 2026, Sophie: "a couple days
    // ago we added a what's new button to the main screen, but I wanted it to
    // go on the update screen — could you rename it Update, no icon, and put it
    // on the update screen"). It is a row at the top of the Chats app's UPDATE
    // tab now (`newsUpdRow` in public/chats.html), which is the screen she
    // opens to find out what happened — the page it leads to answers the same
    // question across every chat at once. Nothing here presents BriefView any
    // more; it stays in the repo, unmounted, the way CreationsView does.

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

    /// FIVE rounded SQUARES across, icons only (Sophie: "just the icon"). TWO
    /// are actions (the HOUSE and Chats); the other three are filters on the
    /// cards below — the lit one clears back to everything when tapped again.
    /// Chats is here AND in its top-right corner on purpose ("it can be in two
    /// places, silly"), so don't "fix" that duplicate.
    ///
    /// **THE HOUSE ON THE LEFT IS THE WAY BACK TO THE PLAIN GRID (2026-08-25,
    /// Sophie: "add a fifth tile on the home screen on the left, a picture of a
    /// home that just takes you back to the home grid thing").** With a filter
    /// lit, the only way back to everything was to remember WHICH chip was on
    /// and tap that same one again — a way out you have to find first. The
    /// house clears the filter from wherever she is, and it is deliberately
    /// never LIT: it is an action like Chats, not a fifth filter, and a chip
    /// that glows on the screen's normal resting state is noise.
    ///
    /// **THE BRIEFCASE AND THE QUILT CAME OFF (Aug 2026, Sophie: "get rid of
    /// the briefcase and the quilt icons in the five line row … since they
    /// also exist in the very top header row").** Both filters are unchanged
    /// and still one tap away — they live in the masthead corners, which is
    /// where they were duplicated FROM. The row is House · Chats · Pictures ·
    /// Movies · Movies-as-a-pile now.
    ///
    /// **The DUMP square came off (Aug 2026, Sophie: "we can get rid of the
    /// dump button in the row at the top since it's now in the main home
    /// screen as the default").** It was a shortcut to a tool that is a card
    /// two inches below it — worth the slot back when the film tools left and
    /// the default grid got short. The Dump still opens on SORT from its card.
    private var shortcutRow: some View {
        HStack(spacing: 0) {
            // Same `house` glyph the bottom bar's Home slot wears, so the two
            // ways back to the plain grid read as the same thing.
            square(lit: false, label: "Everything") { filter = .all } icon: {
                Image(systemName: "house").font(.system(size: Self.squareIcon))
            }
            square(lit: false, label: "Chats") { open(.chats) } icon: {
                Image(systemName: Tool.chats.icon).font(.system(size: Self.squareIcon))
            }
            // Deliberately NOT the generate star: that glyph is reserved for
            // controls that spend a model call, and a filter spends nothing.
            square(lit: filter == .image, label: "Pictures") { toggle(.image) } icon: {
                Image(systemName: "photo").font(.system(size: Self.squareIcon))
            }
            square(lit: filter == .movie, label: "Movies & sound") { toggle(.movie) } icon: {
                Image(systemName: "film").font(.system(size: Self.squareIcon))
            }
            // The SECOND movies chip — the same tools as one flat pile of
            // small cards (Sophie, Aug 2026). A different glyph on purpose:
            // the clapperboard, so the two film chips can never be mistaken
            // for each other in the row.
            square(lit: filter == .movieFlat, label: "Movies, all in one pile") { toggle(.movieFlat) } icon: {
                Image(systemName: Self.flatFilmSymbol).font(.system(size: Self.squareIcon))
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

/// A SMALL module card — the glyph and the name, nothing else (Aug 2026,
/// Sophie: "they should all be smaller so they just have the icon and then the
/// name of the module but not the little explanation text so I can fit three
/// to a row instead of two").
///
/// It is the same chrome as `HubCard` (surface, hairline, radius) so the two
/// read as the same family — only the description and the min-height are gone,
/// and the contents CENTRE, because a name of one or two words looks stranded
/// left-aligned in a square this small.
private struct TightCard: View {
    let tool: Tool
    let title: String

    var body: some View {
        VStack(spacing: 8) {
            ToolGlyph(tool: tool, size: 24).foregroundColor(Theme.accent)
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(Theme.text)
                .multilineTextAlignment(.center)
                // Two lines is enough for every name in the set ("Episode
                // Editor", "Story Timeline"); fixedSize keeps the second line
                // from being truncated in a narrow column.
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 84)
        .padding(.vertical, 12)
        .padding(.horizontal, 6)
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
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

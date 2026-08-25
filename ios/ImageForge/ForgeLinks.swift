import Foundation

/// UNIVERSAL LINKS — the app half of `applinks.js` (Aug 2026, Sophie: "is
/// there anyway to do links that go directly and open in my actual iOS Deck
/// Factory app?").
///
/// An ordinary `https://imageforge-q125.onrender.com/panels` link, tapped
/// anywhere on her phone, arrives here instead of Safari. The `deckfactory://`
/// scheme still works exactly as it did — it is what the widget uses — but a
/// custom scheme is only tappable where something treats it as a link, and in
/// most of what she reads it renders as plain text.
///
/// THIS MAP IS THE CONTRACT WITH THE SERVER. iOS only hands the app a URL
/// whose path is claimed in the site's apple-app-site-association file, and
/// this is the only thing that knows what a claimed path MEANS. The two lists
/// are pinned equal by `scripts/test-applinks.js`, which parses this file —
/// add a path to both or it is dead either way.
enum ForgeLinks {
    /// The host whose links belong to this app. It is the same default the
    /// rest of the app talks to; a custom server in Settings does NOT get
    /// universal links, because the entitlement names one fixed domain.
    static let host = "imageforge-q125.onrender.com"

    /// Server path → deep-link destination (a `Tool` raw value, or
    /// `home`/`gallery`). They differ in a few places on purpose: the Cutting
    /// Room's page is /cuttingroom and its tool is `cutroom`, the Story Room's
    /// page is /storyroom and its tool is `story`.
    static let map: [String: String] = [
        "/": "home",
        "/chats": "chats",
        "/gallery": "gallery",
        "/playground": "playground",
        "/panels": "panels",
        "/freeform": "freeform",
        "/vector": "vector",
        "/test": "test",
        "/review": "review",
        "/timeline": "timeline",
        "/storyroom": "story",
        "/scratchpad": "scratchpad",
        "/writing": "writing",
        "/editor": "editor",
        "/cuttingroom": "cutroom",
        "/cutmarks": "cutmarks",
        "/blocks": "blocks",
        "/pausing": "pausing",
        "/search": "search",
        "/chunking": "chunking",
        "/clips": "chunking",
        "/assembly": "assembly",
        "/filmeditor": "filmeditor",
        "/dump": "dump",
        "/blog": "blog",
        "/studio": "product",
        "/report": "report",
        "/voice": "voice",
        "/song": "song",
        "/character": "character",
        "/films": "films",
    ]

    /// The destination a tapped web link means, or nil if it is not ours.
    /// A trailing slash is tolerated — `/panels/` and `/panels` are the same
    /// page, and a link she pasted may carry either.
    static func destination(for url: URL) -> String? {
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
              url.host?.lowercased() == host else { return nil }
        var path = url.path.lowercased()
        if path.count > 1 && path.hasSuffix("/") { path.removeLast() }
        if path.isEmpty { path = "/" }
        return map[path]
    }
}

import WidgetKit
import SwiftUI
import UIKit

// THE DECKS WAITING TO BE SWIPED, on the home screen (2026-09-02, Sophie:
// "the widget / make it 4 icons / decks to swipe / currently / the dream
// factory deck / the wallpapers").
//
// It used to be a count — the Update tab's number and the newest chats' lines
// — and it is four PICTURES now: the top four decks in the Review Queue, each
// one a tap straight into that deck's cards. That is the difference between
// "there are things waiting" and "here is the one I'll do", which is what she
// asked for; the count still lives on the Update tab, one tap away, and the
// push is still what makes "right now" arrive.
//
// It keeps the widget KIND it has always had ("ForgeUpdateWidget") on purpose:
// the kind is what iOS remembers a placed widget by, so changing it would
// leave the one on her home screen orphaned and she would have to place a new
// one. Same widget, different subject.
//
// It reads ONE small endpoint (GET /api/review/widget?limit=4) — the same
// waiting rows the /review page draws, in the same order, off the same 60s
// cache, so the widget and the page can never disagree about what is waiting.
// Every picture rides the DERIVED thumb service (the server hands back
// /api/story/thumb urls, never the original): a deck's first picture is
// routinely a 1-3MB lossless webp, and a widget process is killed for less.
//
// IT TALKS TO THE DEFAULT SERVER UNAUTHENTICATED, and that is a signing
// constraint rather than a choice (Aug 2026 — the first build failed on it):
// this extension gets a NEW App ID from Apple-managed CI signing, which does
// not enable the App GROUP on it, so an app-groups entitlement here fails the
// archive outright. Without the group it cannot read the settings the app
// writes. Fine today — STUDIO_TOKEN is off on the live server — and the
// failure mode if that changes is the honest one: "can't reach the queue",
// never a wrong pile. The lookup below is left intact so restoring the group
// (enable App Groups on com.sageryza.imageforge.widget in the developer
// portal once, re-add the entitlements file) needs no code change at all.

private let APP_GROUP = "group.com.sageryza.imageforge"
private let DEFAULT_SERVER = "https://imageforge-q125.onrender.com"

struct ForgeDeck: Identifiable, Hashable {
    let id: String
    /// The chat's name — what she calls the pile the deck came out of.
    let name: String
    /// The deck's own title, and its first card's words: the two things a
    /// pictureless deck has to be drawn with.
    let title: String
    let peek: String
    let left: Int
    /// The face, already downloaded — a widget VIEW cannot load a URL, so
    /// every picture is fetched in the provider. Usually webp; `UIImage`
    /// decodes it (iOS 14+).
    let art: Data?

    /// Where a tap goes. `review` is the tool; the query names the deck, and
    /// RootView carries it exactly the way a push carries `?chat=`.
    var link: URL? { URL(string: "deckfactory://review?deck=" + id) }
}

struct ForgeEntry: TimelineEntry {
    let date: Date
    /// How many decks are waiting in total — the four are the top of it.
    let count: Int
    let decks: [ForgeDeck]
    /// A fetch that failed says so quietly rather than showing a confident
    /// empty pile — "nothing waiting" and "couldn't ask" must never look the
    /// same.
    let stale: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> ForgeEntry {
        ForgeEntry(date: Date(), count: 4, decks: [
            ForgeDeck(id: "a", name: "Dream factory", title: "Two more sheets", peek: "Up all night again", left: 18, art: nil),
            ForgeDeck(id: "b", name: "Portland dates", title: "Moments", peek: "He ordered for both of us", left: 23, art: nil),
            ForgeDeck(id: "c", name: "XI cards", title: "Batch 2", peek: "", left: 131, art: nil),
            ForgeDeck(id: "d", name: "PWC memes", title: "Round 1", peek: "", left: 5, art: nil),
        ], stale: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (ForgeEntry) -> Void) {
        fetch { completion($0) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ForgeEntry>) -> Void) {
        fetch { entry in
            // 20 minutes is a request of iOS, not a promise from it — the
            // system decides the real cadence from how often she looks. The
            // pile moves when she swipes, which is a tap away either way.
            let next = Calendar.current.date(byAdding: .minute, value: 20, to: Date()) ?? Date()
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private var server: String {
        let defaults = UserDefaults(suiteName: APP_GROUP)
        let base = (defaults?.string(forKey: "forge.serverURL") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return base.isEmpty ? DEFAULT_SERVER : base
    }

    private func request(_ path: String) -> URLRequest? {
        guard let url = URL(string: server + path) else { return nil }
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        let defaults = UserDefaults(suiteName: APP_GROUP)
        if let token = defaults?.string(forKey: "forge.studioToken"), !token.isEmpty {
            req.setValue(token, forHTTPHeaderField: "x-studio-token")
        }
        return req
    }

    private func fetch(_ done: @escaping (ForgeEntry) -> Void) {
        let bad = ForgeEntry(date: Date(), count: 0, decks: [], stale: true)
        guard let req = request("/api/review/widget?limit=4") else { return done(bad) }
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let raw = obj["decks"] as? [[String: Any]] else { return done(bad) }
            let count = (obj["count"] as? Int) ?? raw.count
            // Every picture is fetched HERE — a widget view has no way to load
            // a URL, and an entry is archived to disk, so these have to be
            // small (they are: the server hands back derived ~240px thumbs).
            self.loadIcons(raw) { faces in
                let decks: [ForgeDeck] = raw.enumerated().compactMap { i, d in
                    let id = (d["id"] as? String) ?? ""
                    guard !id.isEmpty else { return nil }
                    return ForgeDeck(id: id,
                                     name: (d["name"] as? String) ?? "",
                                     title: (d["title"] as? String) ?? "",
                                     peek: (d["peek"] as? String) ?? "",
                                     left: (d["left"] as? Int) ?? 0,
                                     art: faces[i])
                }
                done(ForgeEntry(date: Date(), count: count, decks: decks, stale: false))
            }
        }.resume()
    }

    /// The four faces, in parallel, answered in the rows' own order. A picture
    /// that will not load is nil rather than a failure: the tile falls back to
    /// the deck's words, which is what a text deck draws anyway.
    private func loadIcons(_ raw: [[String: Any]], _ done: @escaping ([Data?]) -> Void) {
        var out = [Data?](repeating: nil, count: raw.count)
        let group = DispatchGroup()
        let lock = NSLock()
        for (i, d) in raw.enumerated() {
            let icon = (d["icon"] as? String) ?? ""
            guard !icon.isEmpty else { continue }
            // the server sends a server-relative thumb path for anything it
            // can derive, and an absolute url for anything it cannot
            let path = icon.hasPrefix("http") ? icon : server + icon
            guard let url = URL(string: path) else { continue }
            group.enter()
            URLSession.shared.dataTask(with: URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 12)) { data, _, _ in
                if let data = data, data.count < 900_000 {
                    lock.lock(); out[i] = data; lock.unlock()
                }
                group.leave()
            }.resume()
        }
        group.notify(queue: .main) { done(out) }
    }
}

// The app's paper palette, so the widget reads as part of Deck Factory rather
// than a system panel. Flat colours only — no gradients, house rule.
private extension Color {
    static let forgePaper = Color(red: 0.965, green: 0.949, blue: 0.914)
    static let forgeInk = Color(red: 0.16, green: 0.14, blue: 0.12)
    static let forgeInk2 = Color(red: 0.45, green: 0.41, blue: 0.36)
    static let forgeLine = Color(red: 0.84, green: 0.81, blue: 0.76)
}

/// ONE deck's face. A rounded SQUARE at the house 6px — never a circle
/// (2026-08-24) — holding the deck's own first picture, or its chat's little
/// drawing, or, when it has neither, the first card's words in the serif,
/// which is what a text deck is.
private struct DeckIcon: View {
    let deck: ForgeDeck
    let side: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6).fill(Color.white)
            if let art = deck.art, let img = UIImage(data: art) {
                Image(uiImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                Text(deck.peek.isEmpty ? deck.title : deck.peek)
                    .font(.system(size: side < 60 ? 8 : 9.5, design: .serif))
                    .foregroundColor(.forgeInk2)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .padding(4)
            }
        }
        .frame(width: side, height: side)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.forgeLine, lineWidth: 1))
    }
}

struct ForgeWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: ForgeEntry

    var body: some View {
        Group {
            if entry.stale {
                message("can't reach the queue")
            } else if entry.decks.isEmpty {
                message("nothing to swipe")
            } else if family == .systemSmall {
                small
            } else {
                medium
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // SMALL HAS EXACTLY ONE TAP TARGET — iOS gives a systemSmall widget a
        // single `widgetURL` and ignores any Link inside it — so the little
        // one opens the queue and the medium one's icons each open their own
        // deck. That is the whole reason the two layouts differ.
        .widgetURL(URL(string: "deckfactory://review"))
    }

    private func message(_ s: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("DECKS").font(.system(size: 10)).tracking(0.8).foregroundColor(.forgeInk2)
            Text(s).font(.system(size: 12, design: .serif)).italic().foregroundColor(.forgeInk2)
        }
    }

    // THE SIDE IS MEASURED, NEVER A MAGIC NUMBER. A widget's content box
    // differs by device AND by iOS version (iOS 17's `containerBackground`
    // insets it), so four 64pt icons that fit an iPhone 13 in the simulator
    // overflow a smaller phone — and an overflowing widget is silently
    // clipped, with nothing on screen saying so.
    private static let gap: CGFloat = 8

    /// 2×2 — four icons and nothing else. A name at this size is a smear.
    private var small: some View {
        GeometryReader { geo in
            let side = max(28, min((geo.size.width - Self.gap) / 2,
                                   (geo.size.height - Self.gap) / 2))
            VStack(spacing: Self.gap) {
                ForEach(0..<2, id: \.self) { row in
                    HStack(spacing: Self.gap) {
                        ForEach(0..<2, id: \.self) { col in
                            if row * 2 + col < entry.decks.count {
                                DeckIcon(deck: entry.decks[row * 2 + col], side: side)
                            } else {
                                Color.clear.frame(width: side, height: side)
                            }
                        }
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    /// A row of four, each its own tap, with the chat's name under it — the
    /// one word that says which pile a picture came out of.
    private var medium: some View {
        GeometryReader { geo in
            // the name line and the header have to come out of the height
            // before the icon can claim what's left
            let side = max(28, min((geo.size.width - Self.gap * 3) / 4,
                                   geo.size.height - 32))
            VStack(alignment: .leading, spacing: 7) {
                Text(entry.count == 1 ? "1 DECK TO SWIPE" : "\(entry.count) DECKS TO SWIPE")
                    .font(.system(size: 9.5)).tracking(0.8)
                    .foregroundColor(.forgeInk2)
                HStack(alignment: .top, spacing: Self.gap) {
                    ForEach(entry.decks.prefix(4)) { d in
                        if let link = d.link {
                            Link(destination: link) { cell(d, side: side) }
                        } else {
                            cell(d, side: side)
                        }
                    }
                    Spacer(minLength: 0)
                }
                Spacer(minLength: 0)
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
        }
    }

    private func cell(_ d: ForgeDeck, side: CGFloat) -> some View {
        VStack(spacing: 3) {
            DeckIcon(deck: d, side: side)
            Text(d.name.uppercased())
                .font(.system(size: 8.5)).tracking(0.3)
                .foregroundColor(.forgeInk)
                .lineLimit(1)
                .frame(width: side)
        }
    }
}

struct ForgeWidget: Widget {
    var body: some WidgetConfiguration {
        // The kind is UNCHANGED on purpose — see the note at the top: it is
        // what iOS remembers her placed widget by.
        StaticConfiguration(kind: "ForgeUpdateWidget", provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                ForgeWidgetView(entry: entry)
                    .containerBackground(Color.forgePaper, for: .widget)
            } else {
                ForgeWidgetView(entry: entry)
                    .padding()
                    .background(Color.forgePaper)
            }
        }
        .configurationDisplayName("Decks to swipe")
        .description("The decks still waiting in the Review Queue. Tap one to swipe it.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct ForgeWidgetBundle: WidgetBundle {
    var body: some Widget { ForgeWidget() }
}

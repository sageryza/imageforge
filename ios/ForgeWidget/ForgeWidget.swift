import WidgetKit
import SwiftUI

// The Update tab on the home screen (Aug 2026, Sophie: "I'd like the widget").
// The third notification shape, alongside the push and the tab itself: no
// banner to dismiss, nothing to open — the count and the newest chats just sit
// there. Tapping anywhere opens Deck Factory on the Chats screen.
//
// It reads ONE small endpoint (GET /api/chatfeed/widget) rather than the real
// feed, which is ~500KB and would be absurd on a refresh timer.
//
// IT TALKS TO THE DEFAULT SERVER UNAUTHENTICATED, and that is a signing
// constraint rather than a choice (Aug 2026 — the first build failed on it):
// this extension gets a NEW App ID from Apple-managed CI signing, which does
// not enable the App GROUP on it, so an app-groups entitlement here fails the
// archive outright. Without the group it cannot read the settings the app
// writes. Fine today — STUDIO_TOKEN is off on the live server — and the
// failure mode if that changes is the honest one: "can't reach the feed",
// never a wrong number. The lookup below is left intact so restoring the
// group (enable App Groups on com.sageryza.imageforge.widget in the developer
// portal once, re-add the entitlements file) needs no code change at all.

private let APP_GROUP = "group.com.sageryza.imageforge"
private let DEFAULT_SERVER = "https://imageforge-q125.onrender.com"

struct ForgeRow: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let line: String
}

struct ForgeEntry: TimelineEntry {
    let date: Date
    let count: Int
    let rows: [ForgeRow]
    /// A fetch that failed says so quietly rather than showing a confident 0 —
    /// "nothing new" and "couldn't ask" must never look the same.
    let stale: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> ForgeEntry {
        ForgeEntry(date: Date(), count: 2,
                   rows: [ForgeRow(name: "Cutting blocks", line: "v8 is up"),
                          ForgeRow(name: "Witch School", line: "six lesson cards, drawing now")],
                   stale: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (ForgeEntry) -> Void) {
        fetch { completion($0) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ForgeEntry>) -> Void) {
        fetch { entry in
            // 20 minutes is a request of iOS, not a promise from it — the
            // system decides the real cadence from how often she looks. The
            // push is what makes "right now" arrive; this is the glance.
            let next = Calendar.current.date(byAdding: .minute, value: 20, to: Date()) ?? Date()
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func fetch(_ done: @escaping (ForgeEntry) -> Void) {
        let defaults = UserDefaults(suiteName: APP_GROUP)
        let base = (defaults?.string(forKey: "forge.serverURL") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let server = base.isEmpty ? DEFAULT_SERVER : base
        guard let url = URL(string: server + "/api/chatfeed/widget?limit=3") else {
            return done(ForgeEntry(date: Date(), count: 0, rows: [], stale: true))
        }
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        if let token = defaults?.string(forKey: "forge.studioToken"), !token.isEmpty {
            req.setValue(token, forHTTPHeaderField: "x-studio-token")
        }
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let count = obj["count"] as? Int else {
                return done(ForgeEntry(date: Date(), count: 0, rows: [], stale: true))
            }
            let raw = (obj["rows"] as? [[String: Any]]) ?? []
            let rows = raw.map { ForgeRow(name: ($0["name"] as? String) ?? "",
                                          line: ($0["line"] as? String) ?? "") }
            done(ForgeEntry(date: Date(), count: count, rows: rows, stale: false))
        }.resume()
    }
}

// The app's paper palette, so the widget reads as part of Deck Factory rather
// than a system panel. Flat colours only — no gradients, house rule.
private extension Color {
    static let forgePaper = Color(red: 0.965, green: 0.949, blue: 0.914)
    static let forgeInk = Color(red: 0.16, green: 0.14, blue: 0.12)
    static let forgeInk2 = Color(red: 0.45, green: 0.41, blue: 0.36)
    static let forgeRose = Color(red: 0.70, green: 0.27, blue: 0.25)
}

struct ForgeWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: ForgeEntry

    var body: some View {
        // The count is the point, so it leads at both sizes; the medium one
        // adds who, which is the difference between "3 things" and "3 things I
        // can decide about without opening anything".
        VStack(alignment: .leading, spacing: family == .systemSmall ? 2 : 6) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(entry.count)")
                    .font(.system(size: family == .systemSmall ? 42 : 34, weight: .semibold, design: .serif))
                    .foregroundColor(entry.count > 0 ? .forgeRose : .forgeInk2)
                Text(entry.count == 1 ? "update" : "updates")
                    .font(.system(size: 11, weight: .regular))
                    .textCase(.uppercase)
                    .tracking(0.8)
                    .foregroundColor(.forgeInk2)
                Spacer(minLength: 0)
            }
            if entry.stale {
                Text("can't reach the feed")
                    .font(.system(size: 11)).italic()
                    .foregroundColor(.forgeInk2)
            } else if entry.rows.isEmpty {
                Text("all caught up")
                    .font(.system(size: 12, design: .serif)).italic()
                    .foregroundColor(.forgeInk2)
            } else if family == .systemSmall {
                // small: names only — a line of prose at this size is a smear
                ForEach(entry.rows.prefix(3)) { r in
                    Text(r.name.uppercased())
                        .font(.system(size: 10.5)).tracking(0.4)
                        .foregroundColor(.forgeInk)
                        .lineLimit(1)
                }
            } else {
                ForEach(entry.rows.prefix(3)) { r in
                    VStack(alignment: .leading, spacing: 1) {
                        Text(r.name.uppercased())
                            .font(.system(size: 11)).tracking(0.4)
                            .foregroundColor(.forgeInk)
                            .lineLimit(1)
                        if !r.line.isEmpty {
                            Text(r.line)
                                .font(.system(size: 12, design: .serif)).italic()
                                .foregroundColor(.forgeInk2)
                                .lineLimit(1)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(URL(string: "deckfactory://chats"))
    }
}

struct ForgeWidget: Widget {
    var body: some WidgetConfiguration {
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
        .configurationDisplayName("Updates")
        .description("Chats that have something new since you last checked them off.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct ForgeWidgetBundle: WidgetBundle {
    var body: some Widget { ForgeWidget() }
}

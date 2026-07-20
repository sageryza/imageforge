import SwiftUI

/// Palette lifted from witch.html's :root — keep in sync if the page's theme
/// ever changes (bg/surface-2/border/gold/text/text-faint).
enum WitchTheme {
    static let bg        = Color(red: 245/255, green: 239/255, blue: 226/255) // --bg
    static let navBg     = Color(red: 241/255, green: 233/255, blue: 216/255) // --surface-2
    static let border    = Color(red: 227/255, green: 216/255, blue: 194/255) // --border
    static let gold      = Color(red: 156/255, green: 111/255, blue:  51/255) // --gold
    static let ink       = Color(red:  48/255, green:  43/255, blue:  52/255) // --text
    static let inkFaint  = Color(red: 161/255, green: 150/255, blue: 139/255) // --text-faint
}

/// The four tabs — mirrors witch.html's views array; rawValue is what
/// window.__setTab expects. Icons are real SF Symbols (the native win).
enum WitchTab: String, CaseIterable {
    case home, school, book, shop

    var label: String {
        switch self {
        case .home: return "Home"
        case .school: return "School"
        case .book: return "Shadows"
        case .shop: return "Shop"
        }
    }
    var symbol: String {
        switch self {
        case .home: return "sparkles"
        case .school: return "graduationcap"
        case .book: return "book"
        case .shop: return "bag"
        }
    }
}

struct WitchRootView: View {
    @State private var tab: WitchTab = .home
    @State private var loading = true
    @State private var failed = false
    @State private var reloadKey = 0

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                WitchTheme.bg.ignoresSafeArea()
                if failed {
                    failedView
                } else {
                    WitchWebView(tab: $tab, loading: $loading, failed: $failed)
                        .id(reloadKey)
                    if loading { loadingView }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            tabBar
        }
        .background(WitchTheme.navBg.ignoresSafeArea(edges: .bottom))
        // Keeps the tab bar pinned under the keyboard instead of riding above it.
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    // Cream screen with a pulsing sparkle while the page (or a sleepy Render
    // server) wakes up.
    private var loadingView: some View {
        VStack(spacing: 14) {
            Image(systemName: "sparkles")
                .font(.system(size: 34))
                .foregroundStyle(WitchTheme.gold)
                .symbolEffect(.pulse, options: .repeating)
            Text("Summoning…")
                .font(.system(size: 15))
                .foregroundStyle(WitchTheme.inkFaint)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WitchTheme.bg)
    }

    private var failedView: some View {
        VStack(spacing: 14) {
            Image(systemName: "moon.stars")
                .font(.system(size: 40))
                .foregroundStyle(WitchTheme.inkFaint)
            Text("The veil is thick tonight")
                .font(.headline)
                .foregroundStyle(WitchTheme.ink)
            Text("Couldn't reach the app — check the connection and try again.")
                .font(.subheadline)
                .foregroundStyle(WitchTheme.inkFaint)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 30)
            Button("Try again") {
                failed = false
                loading = true
                reloadKey += 1
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 18).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 6).stroke(WitchTheme.gold, lineWidth: 1))
            .foregroundStyle(WitchTheme.gold)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WitchTheme.bg)
    }

    // Native recreation of the page's bottom nav: 62pt bar, 23pt icon,
    // tiny uppercase label, gold active state with a 2pt top accent.
    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(WitchTab.allCases, id: \.self) { t in
                Button {
                    tab = t
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: t.symbol)
                            .font(.system(size: 21, weight: .regular))
                            .frame(height: 25)
                        Text(t.label.uppercased())
                            .font(.system(size: 9.5))
                            .kerning(0.3)
                    }
                    .padding(.top, 4)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .foregroundStyle(tab == t ? WitchTheme.gold : WitchTheme.inkFaint)
                    .overlay(alignment: .top) {
                        if tab == t {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(WitchTheme.gold)
                                .frame(width: 22, height: 2)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .frame(height: 62)
        .frame(maxWidth: 640)
        .frame(maxWidth: .infinity)
        .background(WitchTheme.navBg)
        .overlay(alignment: .top) {
            WitchTheme.border.frame(height: 1)
        }
    }
}

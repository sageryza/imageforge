import SwiftUI

/// Secretly a Witch — the public witchy app as a native iOS shell.
/// The content IS the deployed web app (public/witch.html at /witch): a
/// full-screen WKWebView in app mode (?app=1 hides the page's own nav), with
/// a native SF-Symbols tab bar below it driving the page's go() via
/// window.__setTab. Content updates ship with a Render deploy — no TestFlight
/// build needed. No Firebase, no tokens: the page and its APIs are public.
@main
struct SecretlyAWitchApp: App {
    var body: some Scene {
        WindowGroup {
            WitchRootView()
                .preferredColorScheme(.light) // the cream theme is light-only
        }
    }
}

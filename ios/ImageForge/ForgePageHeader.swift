import SwiftUI
import WebKit

/// THE PAGE OWNS ITS HEADER — Apple's nav bar is gone from the web-wrapped
/// tools (Aug 2026, Sophie: "get rid of the apple native bar").
///
/// WHY. Every web tool used to carry TWO title strips stacked on each other:
/// Apple's bar (its chevron and the tool name, drawn by the phone) and the
/// page's own `.head` band underneath it. Embedded, the page hid its own title
/// because the bar already showed it — so the band sat there holding nothing
/// but the "?", and the two together ate the top of the screen. Worse, the
/// chevron lives in Swift, so every fix to how BACK behaves waited for a
/// TestFlight build; the "it always goes back too far" bug sat unfixable on
/// her phone for exactly that reason.
///
/// Her own rule in CLAUDE.md already said the page owns its header. This makes
/// it true: the bar is hidden, the page draws its title, its "?", its tabs AND
/// its back chevron in one row, in the house style — and all of it now ships
/// with a deploy instead of a build.
///
/// THE ONE THING SWIFT STILL HAS TO DO is leave the tool, because only Swift
/// knows there is a screen behind the web view. So the wrapper injects a
/// bridge, `window.__forgeLeave()`, and the page calls it when its own back
/// control has nowhere left to go inside the page.
///
/// `__forgeLeave` IS ALSO THE FEATURE FLAG, deliberately. The web half ships
/// the moment it merges; this half waits for a TestFlight build. So the page
/// only takes over its header when the bridge is actually there (server.js's
/// gated-page injection tests for it). On the build she has today nothing
/// changes — no double chevron, no missing way out.
enum ForgePageHeader {
    /// Runs before the page's own scripts: marks the native host and installs
    /// the leave bridge. Replaces the older `window.__nativeNavBar = true`,
    /// whose whole job was telling the page to HIDE its back button — the
    /// exact opposite of what we want now. Pages still reading that flag
    /// simply never see it and show their own chevron again, which is the
    /// point.
    ///
    /// EXCEPT `__nativeNavBar` IS STILL SET, deliberately. Ten pages read it,
    /// and what it has always meant to them is "back is handled by chrome
    /// outside your content — don't draw your own", which is still exactly
    /// true: pagehead.js draws that chevron now instead of Apple's bar.
    /// Dropping it would have every one of those pages show a second chevron
    /// beside the new one, and each means something slightly different by its
    /// own `#back` (the Story Timeline's is a "Stories" button back to the
    /// shelf, not a way out of the tool), so re-deciding it page by page is
    /// exactly the guessing this avoids. One flag; only who honours it changed.
    static func userScript() -> WKUserScript {
        WKUserScript(
            source: """
            window.__nativeNavBar = true;
            window.__forgeNative = true;
            window.__forgeLeave = function () {
              try { window.webkit.messageHandlers.forgeLeave.postMessage(1); } catch (e) {}
            };
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true)
    }

    /// Wires the bridge into a config. Call from `makeUIView` BEFORE creating
    /// the web view — a user script added afterwards misses the current load.
    static func install(into config: WKWebViewConfiguration,
                        onLeave: @escaping () -> Void) -> ForgeLeaveHandler {
        let handler = ForgeLeaveHandler(onLeave: onLeave)
        config.userContentController.addUserScript(userScript())
        // Named for what the page calls, so a grep for `forgeLeave` finds both
        // sides. Removed first: a re-created view would otherwise throw on a
        // duplicate name.
        config.userContentController.removeScriptMessageHandler(forName: "forgeLeave")
        config.userContentController.add(handler, name: "forgeLeave")
        return handler
    }
}

/// Answers `window.__forgeLeave()` by popping the tool screen. Held by the
/// coordinator that created it — `addScriptMessageHandler` does NOT retain.
final class ForgeLeaveHandler: NSObject, WKScriptMessageHandler {
    private let onLeave: () -> Void
    init(onLeave: @escaping () -> Void) { self.onLeave = onLeave }
    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        // The page may fire this off a tap handler on any thread.
        DispatchQueue.main.async { [onLeave] in onLeave() }
    }
}

extension View {
    /// Hides Apple's nav bar for a screen whose PAGE draws the header.
    /// Use instead of `.forgeToolBar(…)` on a web-wrapped tool.
    ///
    /// The bar is hidden rather than the screen being presented outside the
    /// NavigationStack, because the stack is still what `goBack` pops and what
    /// the swipe-from-the-left-edge gesture drives — hiding only the chrome
    /// keeps both working.
    func forgePageOwnsHeader() -> some View {
        self.toolbar(.hidden, for: .navigationBar)
            .navigationBarBackButtonHidden(true)
    }

    /// THE chrome for a web-wrapped tool — one line per wrapper, replacing the
    /// `.forgeToolBar(…)` they all used to carry.
    ///
    /// Normally there is none: the page draws the header. **The failure screen
    /// is the exception and it is not optional** — when the page did not load
    /// there is no page header, so hiding the bar would strand her on
    /// "Couldn't open …" with no way out. That is the one screen where Apple's
    /// chevron is still the only door, which is why `failed` is a required
    /// argument rather than something a call site can forget.
    func forgeWebToolBar(_ title: String, tint: Color = Theme.text,
                         paper: Color = Theme.bg, failed: Bool,
                         back: (() -> Void)? = nil) -> some View {
        Group {
            if failed { self.forgeToolBar(title, tint: tint, paper: paper, back: back) }
            else { self.forgePageOwnsHeader() }
        }
    }
}

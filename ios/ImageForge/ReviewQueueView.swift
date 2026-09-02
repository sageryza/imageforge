import SwiftUI
import UIKit
import WebKit

/// Review Queue — one screen of everything waiting to be reviewed (Aug 2026,
/// Sophie: "I have a pile of things that need to be reviewed and I'd like one
/// screen that shows all the things waiting to be reviewed"). Wraps the
/// server's gated /review page (public/review.html, engine at /api/review in
/// review.js) the way BlocksView wraps /blocks: no native bar — the page draws THE back
/// chevron, media paused on screen changes, the studio gate answered with the
/// token. Page changes ship with a Render deploy — no app build needed.
///
/// NOT a GatedWebTool on purpose: that wrapper bounces any off-path link out
/// to Safari, and this page's rows ARE off-path links — each opens the deck or
/// grid page itself (/api/chatfeed/page/…), which must load in place so she
/// swipes inside the tool. So navigation is allowed, the swipe-back gesture is
/// on (a row leads OUT and back, the brief's reasoning), and the chevron steps
/// the web view's own history before it leaves the tool.
struct ReviewQueueView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = ReviewWebRef()
    @Environment(\.goBack) private var goBack

    /// The page's paper — tool.css `--bg` #faf9f7, same as What's New.
    static let paper = Color(red: 0.980, green: 0.976, blue: 0.969)

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "checklist")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open the Review Queue")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(studioToken.isEmpty
                         ? "The studio token isn't set on this phone — ask a chat to help set it, then try again."
                         : "Check the connection and try again.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSoft)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
                    Button("Try again") { loadFailed = false; reloadKey += 1 }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink, lineWidth: 1))
                        .foregroundStyle(Theme.ink)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.bg)
            } else {
                ReviewWebView(token: studioToken, failed: $loadFailed, webRef: webRef, onLeave: goBack)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // A WIDGET ICON OPENS ITS OWN DECK (2026-09-02). Bumping the key
        // recreates the web view, whose URL builder consumes the pending id —
        // the same shape ChatFeedView uses for a tapped push, and for the same
        // reason: the app keeps three tools alive, so arriving at a tool it is
        // already holding runs no makeUIView. Covers a cold start too, where
        // the flag is set before this view first builds.
        .onReceive(NotificationCenter.default.publisher(for: .forgeOpenDeck)) { _ in
            loadFailed = false
            reloadKey += 1
        }
        .forgeWebToolBar("Review Queue", paper: Self.paper, failed: loadFailed, back: navBack)
    }

    /// The chevron asks the page first, then steps the web view's history
    /// (back out of a deck she opened, onto the queue), and only then leaves.
    private func navBack() {
        guard !loadFailed, let web = webRef.web else { goBack(); return }
        web.evaluateJavaScript("window.__navBack ? window.__navBack() : false") { handled, _ in
            if (handled as? Bool) == true { return }
            if web.canGoBack { web.goBack() } else { goBack() }
        }
    }
}

/// Hands the loaded WKWebView up to SwiftUI so the chevron can talk to the page.
final class ReviewWebRef: ObservableObject { weak var web: WKWebView? }

private struct ReviewWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: ReviewWebRef
    /// Leave the tool — what `window.__forgeLeave()` reaches now that
    /// the page draws the back chevron instead of Apple's bar.
    var onLeave: () -> Void = {}

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // The page draws its own header now (ForgePageHeader): this installs
        // the bridge its back chevron calls to leave the tool.
        context.coordinator.leaveHandler = ForgePageHeader.install(into: config, onLeave: onLeave)
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.980, green: 0.976, blue: 0.969, alpha: 1) // tool.css --bg
        // ON: a row leads OUT of the queue into a deck, so the swipe back is
        // the gesture she'll reach for and the chevron already agrees with it.
        web.allowsBackForwardNavigationGestures = true
        webRef.web = web
        // A pending deck (a home-screen widget icon) opens THAT deck's cards
        // instead of the queue — the same url a queue tile opens, so a deck
        // reached from the widget is identical to one reached by tapping its
        // row, chevron and all: judge.js's `__navBack` steps history and falls
        // back to /review, so the way out lands on the queue either way. The
        // flag is one-shot; nothing may drag her back into it on a reload.
        var path = "/review?embed=1"
        if let deck = PushDelegate.pendingDeck, !deck.isEmpty {
            PushDelegate.pendingDeck = nil
            let id = deck.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? deck
            path = "/api/chatfeed/page/" + id + "?clean=1"
        }
        if let url = URL(string: MovieService.serverURL + path) {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopMediaOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        // iOS reclaims the web content process under memory pressure (this
        // app keeps three tools alive at once). A bare reload() here made it
        // WORSE — all three resurrecting together re-spiked memory and iOS
        // killed them in a loop, blanking the tool she was reading every ~10s
        // (build 175). ForgeWebRevive reloads only the visible view, one at a
        // time; a hidden tool revives when she switches back to it.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            ForgeWebRevive.shared.terminated(webView)
        }
        /// `addScriptMessageHandler` does not retain — this does.
        var leaveHandler: ForgeLeaveHandler?
        let parent: ReviewWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: ReviewWebView) { self.parent = parent }

        // The web view stays alive behind the app; a deck's voice note or a
        // film must not keep playing out of a screen she can't see.
        func stopMediaOnScreenChange(_ web: WKWebView) {
            let pause = "document.querySelectorAll('audio,video').forEach(function(m){m.pause()});"
            screenChangeObserver = NotificationCenter.default.addObserver(
                forName: .forgeScreenChanged, object: nil, queue: .main) { [weak web] _ in
                    web?.evaluateJavaScript(pause, completionHandler: nil)
            }
        }

        deinit {
            if let o = screenChangeObserver { NotificationCenter.default.removeObserver(o) }
        }

        // /review sits behind HTTP Basic (any user, password = the studio token).
        func webView(_ webView: WKWebView,
                     didReceive challenge: URLAuthenticationChallenge,
                     completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
            if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodHTTPBasic,
               challenge.previousFailureCount == 0 {
                completionHandler(.useCredential,
                                  URLCredential(user: "sophie", password: parent.token, persistence: .forSession))
            } else if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
                completionHandler(.performDefaultHandling, nil)
            } else {
                completionHandler(.cancelAuthenticationChallenge, nil)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.failed = true
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.failed = true
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if let http = navigationResponse.response as? HTTPURLResponse, http.statusCode == 401 {
                parent.failed = true
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

import SwiftUI
import UIKit
import WebKit

/// What's New — the home screen's update button (Aug 2026, Sophie: "an update
/// button on the home screen that I can just click and then it does an API call
/// that gives me the top five things that I might want to be updated on, and
/// then maybe some lower priority things, and ideally images that chats made or
/// links to compare pages").
///
/// Wraps the server's gated /brief page (public/brief.html, engine at
/// /api/brief in brief.js) the way CutMarksView wraps /cutmarks: the studio
/// gate answered with the token, `__nativeNavBar` injected so the page hides
/// its own title, media paused on a screen change.
///
/// TWO THINGS ARE DELIBERATELY DIFFERENT from every other web tool here:
///
/// 1. **It is presented as a full-screen COVER from the home grid, not as a
///    `Tool`.** A Tool joins `Recents` the moment it is opened, so tapping this
///    button would evict one of her three bottom-bar slots every single time —
///    and this is the button she taps most often. A cover leaves the bar alone
///    and returns her to the home grid exactly where she was.
/// 2. **It is built fresh on every present**, which is what makes it always
///    show today's brief with nothing to remember to refresh. The page is a
///    read; rebuilding it costs four Firestore reads, three of them capped.
///
/// The chevron asks the page first (`__navBack` closes an open picture), then
/// steps the web view's own history (she may have opened a Compare page or a
/// chat from a card), and only then closes the cover.
struct BriefView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = BriefWebRef()
    @Environment(\.dismiss) private var dismiss

    /// The page's paper — tool.css `--bg` #faf9f7 — so the nav bar and the
    /// page are one colour instead of a white strip above cream.
    static let paper = Color(red: 0.980, green: 0.976, blue: 0.969)

    var body: some View {
        NavigationStack {
            Group {
                if loadFailed {
                    VStack(spacing: 14) {
                        Image(systemName: "list.bullet.rectangle")
                            .font(.system(size: 40))
                            .foregroundStyle(Theme.inkSoft)
                        Text("Couldn't open What's New")
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
                    BriefWebView(token: studioToken, failed: $loadFailed, webRef: webRef)
                        .id(reloadKey)
                        .ignoresSafeArea(edges: .bottom)
                }
            }
            .background(Self.paper.ignoresSafeArea())
            .forgeToolBar("What's New", paper: Self.paper, back: navBack)
        }
    }

    private func navBack() {
        guard !loadFailed, let web = webRef.web else { dismiss(); return }
        web.evaluateJavaScript("window.__navBack ? window.__navBack() : false") { handled, _ in
            if (handled as? Bool) == true { return }
            if web.canGoBack { web.goBack() } else { dismiss() }
        }
    }
}

/// Hands the loaded WKWebView up to SwiftUI so the chevron can talk to the page.
final class BriefWebRef: ObservableObject { weak var web: WKWebView? }

private struct BriefWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: BriefWebRef

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // The nav bar carries the title, so the page hides its own (body.native).
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__nativeNavBar = true",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.980, green: 0.976, blue: 0.969, alpha: 1) // tool.css --bg
        // ON here, unlike the other wrappers: a card's links lead OUT of the
        // brief (into a chat, into a Compare page), so the swipe back is the
        // gesture she'll reach for and the chevron already agrees with it.
        web.allowsBackForwardNavigationGestures = true
        webRef.web = web
        if let url = URL(string: MovieService.serverURL + "/brief?embed=1") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopMediaOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: BriefWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: BriefWebView) { self.parent = parent }

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

        // /brief sits behind HTTP Basic (any user, password = the studio token).
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

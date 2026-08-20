import SwiftUI
import UIKit
import WebKit

/// Cut Marks — mark your own cut points on a playhead, video or audio, no
/// transcript: the manual sibling of the Cutting Room. Wraps the server's
/// gated /cutmarks page (public/cutmarks.html, engine at /api/cutmarks in
/// cutmarks.js) exactly like the Episode Editor wraps /editor: native tool
/// bar with THE back chevron, __nativeNavBar injected so the page hides its
/// own back button, media paused on screen changes.
/// Page changes ship with a Render deploy — no app build needed.
struct CutMarksView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = CutMarksWebRef()
    @Environment(\.goBack) private var goBack

    /// The page's paper (fixed light), same tokens as the editor/cutting room.
    static let paper = Color(red: 0.980, green: 0.969, blue: 0.945)   // --paper #FAF7F1
    static let ink = Color(red: 0.137, green: 0.125, blue: 0.106)     // --ink #23201B

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "timeline.selection")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open Cut Marks")
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
                CutMarksWebView(token: studioToken, failed: $loadFailed, webRef: webRef, onLeave: goBack)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // The standard tool header: the PAGE draws the back chevron —
        // inside a recording the page consumes it and returns to the list
        // (__navBack); on the list it leaves the tool.
        .forgeWebToolBar("Cut Marks", tint: Self.ink, paper: Self.paper, failed: loadFailed, back: navBack)
    }

    /// Ask the page to step back one level; when it's already on the list —
    /// or the page isn't up — step the web view's own history, then leave.
    private func navBack() {
        guard !loadFailed, let web = webRef.web else { goBack(); return }
        web.evaluateJavaScript("window.__navBack ? window.__navBack() : false") { handled, _ in
            if (handled as? Bool) == true { return }
            if web.canGoBack { web.goBack() } else { goBack() }
        }
    }
}

/// Hands the loaded WKWebView up to the SwiftUI layer so the page's own back
/// chevron can be answered (and the failure screen's bar still works).
final class CutMarksWebRef: ObservableObject { weak var web: WKWebView? }

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the
/// token and lets the page play media inline (the recording, the video, the
/// renders) without a second tap for the media itself.
private struct CutMarksWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: CutMarksWebRef
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
        web.backgroundColor = UIColor(red: 0.980, green: 0.969, blue: 0.945, alpha: 1) // page --paper #FAF7F1
        web.allowsBackForwardNavigationGestures = false
        webRef.web = web
        if let url = URL(string: MovieService.serverURL + "/cutmarks") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopMediaOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        /// `addScriptMessageHandler` does not retain — this does.
        var leaveHandler: ForgeLeaveHandler?
        let parent: CutMarksWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: CutMarksWebView) { self.parent = parent }

        // This web view stays alive (hidden) when Sophie switches tabs, so a
        // playing recording or video would keep going out of a screen she
        // can't see — pause every media element on a screen change.
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

        // The /cutmarks page sits behind HTTP Basic (any user, password = token).
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

import SwiftUI
import WebKit

/// Episode Editor — build an episode out of a real interview: pick spans of the
/// transcript as snippet cards, arrange them with narration and gaps, tap Render,
/// hear the finished audio. Wraps the server's gated /editor page
/// (public/editor.html, engine at /api/editor in editor.js) exactly like the
/// Writing Room wraps /writing: the page IS the UI, this only hosts it and
/// answers the studio gate's HTTP Basic challenge with the stored token
/// (Settings ▸ studio token, same one Movies uses). Page changes ship with a
/// Render deploy — no app build needed.
struct EpisodeEditorView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = EditorWebRef()
    @Environment(\.goBack) private var goBack

    /// The page's paper (fixed light — the editor has no dark theme), so the
    /// nav-bar area blends into the page instead of showing a mismatched strip.
    static let paper = Color(red: 0.980, green: 0.969, blue: 0.945)   // --paper #FAF7F1
    static let ink = Color(red: 0.137, green: 0.125, blue: 0.106)     // --ink #23201B

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "waveform")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open the Episode Editor")
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
                EpisodeEditorWebView(token: studioToken, failed: $loadFailed, webRef: webRef, onLeave: goBack)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // The standard tool header, Story Room pattern: the PAGE draws
        // the back chevron — inside an episode the page consumes it and returns
        // to the episode list (__navBack); on the list it leaves the tool.
        .forgeWebToolBar("Episode Editor", tint: Self.ink, paper: Self.paper, failed: loadFailed, back: navBack)
    }

    /// Ask the page to step back one level; when it's already on the episode
    /// list — or the page isn't up — step the web view's own history, then
    /// leave the tool.
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
final class EditorWebRef: ObservableObject { weak var web: WKWebView? }

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the token
/// and lets the page play audio inline (snippet previews and the rendered
/// episode) without a second tap for the media itself.
private struct EpisodeEditorWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: EditorWebRef
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
        if let url = URL(string: MovieService.serverURL + "/editor") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopAudioOnScreenChange(web)
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
        let parent: EpisodeEditorWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: EpisodeEditorWebView) { self.parent = parent }

        // This web view stays alive (hidden) when Sophie switches tabs, so a
        // snippet preview or a rendered episode would keep playing out of a
        // screen she can't see — pause everything whenever RootView changes
        // screens. Two players to catch: the page's `<audio>` elements (the
        // rendered episodes) and its detached `previewAudio` object (the ▶ on a
        // snippet card), which isn't in the DOM. editor.html is a classic
        // script, so that top-level binding resolves here; `typeof` keeps this
        // harmless if the page ever stops declaring it.
        func stopAudioOnScreenChange(_ web: WKWebView) {
            let pause = "document.querySelectorAll('audio').forEach(function(a){a.pause()});" +
                        "if(typeof previewAudio!=='undefined')previewAudio.pause();"
            screenChangeObserver = NotificationCenter.default.addObserver(
                forName: .forgeScreenChanged, object: nil, queue: .main) { [weak web] _ in
                    web?.evaluateJavaScript(pause, completionHandler: nil)
            }
        }

        deinit {
            if let o = screenChangeObserver { NotificationCenter.default.removeObserver(o) }
        }

        // The /editor page sits behind HTTP Basic (any user, password = token).
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

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
                EpisodeEditorWebView(token: studioToken, failed: $loadFailed)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
    }
}

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the token
/// and lets the page play audio inline (snippet previews and the rendered
/// episode) without a second tap for the media itself.
private struct EpisodeEditorWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.980, green: 0.969, blue: 0.945, alpha: 1) // page --paper #FAF7F1
        web.allowsBackForwardNavigationGestures = false
        if let url = URL(string: MovieService.serverURL + "/editor") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopAudioOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
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

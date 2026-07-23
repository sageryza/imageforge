import SwiftUI
import WebKit

/// Dreams — now a thin wrapper around the gated `/dreams` web page
/// (public/dreams.html), the same way the Writing Room wraps `/writing`.
///
/// The whole dream experience lives in the page: write/record a dream → the
/// fast split (order + who's in it) → one cream cast sheet to pick the
/// characters → hand-drawn comic pages → past-dreams archive + zine. Because
/// it's a web page, every change (the cast sheet, new steps, styling) ships
/// with a Render deploy — no TestFlight build. This wrapper only hosts the
/// page, hides the native nav bar (the page has its own top bar), answers the
/// studio HTTP Basic gate with the token, and grants mic capture.
struct DreamsView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "moon.stars")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open Dreams")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text("Check the connection and try again.")
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
                DreamsWebView(token: studioToken, failed: $loadFailed)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .navigationBarHidden(true)   // the /dreams page carries its own top bar
    }
}

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the
/// token and grants the page's mic capture request (voice dictation / memos).
private struct DreamsWebView: UIViewRepresentable {
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
        web.backgroundColor = UIColor(red: 0.980, green: 0.976, blue: 0.969, alpha: 1) // page --bg
        web.allowsBackForwardNavigationGestures = false
        if let url = URL(string: MovieService.serverURL + "/dreams") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: DreamsWebView
        init(_ parent: DreamsWebView) { self.parent = parent }

        // The /dreams page sits behind HTTP Basic (any user, password = token).
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

        // Grant the page's mic capture (the OS permission prompt still applies
        // the first time); voice recording in-page transcribes via Whisper.
        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(type == .microphone ? .grant : .deny)
        }
    }
}

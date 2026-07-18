import SwiftUI
import WebKit

/// Story Room — the movie boards webpage (/storyroom), wrapped like the
/// Writing Room: the server page is the UI, this just hosts it and answers
/// the studio gate's HTTP Basic challenge with the stored token. Content
/// updates land with a Render deploy — no app build needed.
struct StoryRoomView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0

    /// The page's own paper color (light/dark), so the nav-bar area blends
    /// into the web page instead of showing a white strip above the cream.
    static let paper = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.098, green: 0.090, blue: 0.075, alpha: 1)   // page --paper dark #191713
            : UIColor(red: 0.965, green: 0.949, blue: 0.914, alpha: 1)   // page --paper light #f6f2e9
    })

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "books.vertical")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open the Story Room")
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
                StoryRoomWebView(token: studioToken, failed: $loadFailed)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // The page carries its own in-page autoscroll pill — hide the native
        // one while this screen is up (and stop any run already in flight).
        .onAppear {
            AutoScrollDriver.shared.stop()
            AutoScrollDriver.shared.webPillActive = true
        }
        .onDisappear { AutoScrollDriver.shared.webPillActive = false }
    }
}

private struct StoryRoomWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool

    func makeUIView(context: Context) -> WKWebView {
        let web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(StoryRoomView.paper)
        web.allowsBackForwardNavigationGestures = true
        if let url = URL(string: MovieService.serverURL + "/storyroom") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopAutoscrollOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: StoryRoomWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: StoryRoomWebView) { self.parent = parent }

        // If Sophie switches tabs while the boards are pushed, the page's
        // in-page autoscroll must not keep drifting in the background.
        func stopAutoscrollOnScreenChange(_ web: WKWebView) {
            screenChangeObserver = NotificationCenter.default.addObserver(
                forName: .forgeScreenChanged, object: nil, queue: .main) { [weak web] _ in
                    web?.evaluateJavaScript("window.__scrollStop && window.__scrollStop()", completionHandler: nil)
            }
        }

        deinit {
            if let o = screenChangeObserver { NotificationCenter.default.removeObserver(o) }
        }

        // The page sits behind HTTP Basic (any user, password = token).
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

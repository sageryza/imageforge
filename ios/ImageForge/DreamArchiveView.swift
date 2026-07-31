import SwiftUI
import WebKit

/// The past-dreams archive — every dream Sophie has, in one chronological run,
/// newest first. Reached from the moon button on the Dreams screen.
///
/// This used to be a native grid of rendered dream pages, which meant it only
/// ever showed dreams that had been ILLUSTRATED. It now wraps the server's
/// gated /dreams-archive page, which merges every source: the voice memos (the
/// only ones carrying the original recording), the dream pipeline's
/// illustrations, the witch app, and the scanned journal — so a dream she
/// recorded this morning is here with its words and its audio straight away,
/// and its drawings attach to it whenever they're made.
///
/// Content changes ship with a Render deploy — no app build needed. This
/// wrapper only hosts the page and answers its HTTP Basic gate with the studio
/// token (Settings ▸ studio token, the same one Movies uses).
struct DreamArchiveView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "moon.stars")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.textDim)
                    Text("Couldn't open your dreams")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Text(studioToken.isEmpty
                         ? "The studio token isn't set on this phone — ask a chat to help set it, then try again."
                         : "Check the connection and try again.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textDim)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
                    Button("Try again") { loadFailed = false; reloadKey += 1 }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 6).stroke(Theme.text, lineWidth: 1))
                        .foregroundStyle(Theme.text)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                DreamArchiveWebView(token: studioToken, failed: $loadFailed)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .navigationTitle("Dreams")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct DreamArchiveWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true          // the recordings play in place
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.969, green: 0.957, blue: 0.933, alpha: 1) // page paper
        web.allowsBackForwardNavigationGestures = false
        if let url = URL(string: MovieService.serverURL + "/dreams-archive") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopAutoscrollOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: DreamArchiveWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: DreamArchiveWebView) { self.parent = parent }

        // The web view stays alive (hidden) when Sophie switches tabs, so its
        // in-page autoscroll — and any recording playing — would carry on in the
        // background. Stop both whenever RootView changes screens.
        func stopAutoscrollOnScreenChange(_ web: WKWebView) {
            screenChangeObserver = NotificationCenter.default.addObserver(
                forName: .forgeScreenChanged, object: nil, queue: .main) { [weak web] _ in
                    web?.evaluateJavaScript(
                        "window.__scrollStop && window.__scrollStop();"
                        + "document.querySelectorAll('audio').forEach(function(a){a.pause()})",
                        completionHandler: nil)
            }
        }

        deinit {
            if let o = screenChangeObserver { NotificationCenter.default.removeObserver(o) }
        }

        // /dreams-archive sits behind HTTP Basic (any user, password = token).
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
    }
}

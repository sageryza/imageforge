import AuthenticationServices
import SwiftUI
import WebKit

/// WKWebView host for the deployed /witch page in app mode (?app=1: the page
/// hides its own bottom nav and exposes window.__setTab for the native bar).
/// One web view lives for the whole session — tab switches are just a JS call,
/// so every tab keeps its state exactly like the website.
struct WitchWebView: UIViewRepresentable {
    @Binding var tab: WitchTab
    @Binding var loading: Bool
    @Binding var failed: Bool
    /// Bumped when the already-selected tab is tapped again. SwiftUI never
    /// re-runs updateUIView for `tab = sameValue`, so a counter is the only way
    /// the page hears about a re-tap — which is what pops a lesson to root.
    @Binding var popSignal: Int

    static let serverURL = "https://imageforge-q125.onrender.com"

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // Native sign-in bridge: the page's Google button posts here and gets
        // a Firebase credential back (Google OAuth can't run inside WKWebView).
        config.userContentController.add(context.coordinator, name: "witchAuth")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 245/255, green: 239/255, blue: 226/255, alpha: 1) // --bg cream
        web.scrollView.backgroundColor = web.backgroundColor
        web.allowsBackForwardNavigationGestures = false
        // CI screenshots may request a specific section via WITCH_SHOT.
        var urlStr = Self.serverURL + "/witch?app=1"
        if let shot = ProcessInfo.processInfo.environment["WITCH_SHOT"], !shot.isEmpty {
            urlStr += "&shot=" + (shot.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? shot)
        }
        if let url = URL(string: urlStr) {
            // Generous timeout: the free-tier server may be cold-starting.
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 90))
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        // Tab changed natively → drive the page's go().
        if context.coordinator.lastTab != tab {
            context.coordinator.lastTab = tab
            web.evaluateJavaScript("window.__setTab && window.__setTab('\(tab.rawValue)')", completionHandler: nil)
        } else if context.coordinator.lastPop != popSignal {
            // Re-tap of the current tab: go() closes every open full-page
            // overlay before activating the view, so re-sending the same tab
            // pops a lesson/quiz back to the tab's root.
            context.coordinator.lastPop = popSignal
            web.evaluateJavaScript("window.__setTab && window.__setTab('\(tab.rawValue)')", completionHandler: nil)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let parent: WitchWebView
        var lastTab: WitchTab
        var lastPop: Int
        init(_ parent: WitchWebView) {
            self.parent = parent
            self.lastTab = parent.tab
            self.lastPop = parent.popSignal
        }

        // "Continue with Google" tapped in the page → run the native OAuth
        // sheet, then hand the tokens back so Firebase JS finishes sign-in.
        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "witchAuth",
                  let body = message.body as? String, body == "google",
                  let web = message.webView else { return }
            GoogleNativeAuth.shared.signIn { result in
                switch result {
                case .success(let t):
                    let access = t.accessToken.map { "'\($0)'" } ?? "null"
                    web.evaluateJavaScript(
                        "window.__witchGoogleCredential && window.__witchGoogleCredential('\(t.idToken)', \(access))",
                        completionHandler: nil)
                case .failure(let err):
                    let ns = err as NSError
                    // User closed the sheet — not an error worth showing.
                    let cancelled = ns.domain == ASWebAuthenticationSessionError.errorDomain
                        && ns.code == ASWebAuthenticationSessionError.canceledLogin.rawValue
                    let msg = cancelled ? "" : err.localizedDescription
                        .replacingOccurrences(of: "\\", with: "")
                        .replacingOccurrences(of: "'", with: "\u{2019}")
                        .replacingOccurrences(of: "\n", with: " ")
                    web.evaluateJavaScript(
                        "window.__witchGoogleFailed && window.__witchGoogleFailed('\(msg)')",
                        completionHandler: nil)
                }
            }
        }

        private func isAppHost(_ url: URL?) -> Bool {
            guard let host = url?.host, let appHost = URL(string: WitchWebView.serverURL)?.host else { return false }
            return host == appHost
        }

        // Outbound links (shop, Instagram, YouTube) open in the real browser —
        // the web view only ever shows the app itself.
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url,
               navigationAction.navigationType == .linkActivated, !isAppHost(url) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // target="_blank" links have no in-page destination — send them to Safari.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }

        // Lift the "Summoning…" splash the moment the page STARTS rendering
        // (didCommit) instead of waiting for the full load — the page paints
        // its own cream shell immediately, so there's nothing to hide. The
        // splash used to sit through fonts/scripts/images on every open.
        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            parent.loading = false
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.loading = false
            // Honor a non-default starting tab (CI screenshots / restored state).
            if parent.tab != .home {
                webView.evaluateJavaScript("window.__setTab && window.__setTab('\(parent.tab.rawValue)')", completionHandler: nil)
            }
        }
        // iOS reclaims backgrounded webview processes under memory pressure;
        // without this the app comes back as a frozen snapshot (nothing taps).
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.loading = false
            parent.failed = true
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.loading = false
            parent.failed = true
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if let http = navigationResponse.response as? HTTPURLResponse, http.statusCode >= 500,
               isAppHost(http.url) {
                parent.loading = false
                parent.failed = true
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

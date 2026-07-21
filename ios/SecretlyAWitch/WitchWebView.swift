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

    static let serverURL = "https://imageforge-q125.onrender.com"

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
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
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: WitchWebView
        var lastTab: WitchTab
        init(_ parent: WitchWebView) {
            self.parent = parent
            self.lastTab = parent.tab
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

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.loading = false
            // Honor a non-default starting tab (CI screenshots / restored state).
            if parent.tab != .home {
                webView.evaluateJavaScript("window.__setTab && window.__setTab('\(parent.tab.rawValue)')", completionHandler: nil)
            }
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

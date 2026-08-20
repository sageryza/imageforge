import SwiftUI
import UIKit
import WebKit

/// One wrapper for every "a tile that hosts a gated web page" tool — the
/// pattern BlogView / ProductCreatorView / LessonsView each hand-rolled,
/// extracted so adding a page tool is one line in RootView instead of a new
/// file of copied boilerplate. Hosts the page, answers the studio HTTP Basic
/// gate, shows the standard retry screen on failure.
struct GatedWebTool: View {
    /// Server path of the page, e.g. "/report".
    let path: String
    /// Tool name for the failure screen ("Couldn't open <name>").
    let name: String
    /// SF Symbol on the failure screen — usually the tool's own icon.
    let icon: String
    /// Grant the page microphone capture (Song Station records her singing).
    var mic: Bool = false
    /// JS to run whenever `refreshTick` changes — for a page kept alive behind
    /// a tab, which must re-read its data when she switches back to it.
    var refreshOnAppear: String? = nil
    /// Bump to fire `refreshOnAppear`. (A plain counter, not onAppear: a view
    /// held alive in a ZStack only ever appears once.)
    var refreshTick: Int = 0
    /// Set this to give the tool the standard nav bar (title + chevron) with
    /// the chevron ASKING THE PAGE FIRST — `window.__navBack` steps a
    /// multi-level page back one level (a story to its shelf, a recording to
    /// its list) and only when the page says no does the chevron fall back to
    /// web history and then to leaving the tool. This used to exist only in
    /// the hand-rolled wrappers (BlocksView, CutMarksView…), so every tool
    /// that used the PLAIN `.forgeToolBar("Name")` had a chevron that dumped
    /// Sophie on the home screen from anywhere inside the tool — the Story
    /// Timeline is where she caught it ("this is a pattern that needs to be
    /// fixed all over the app"). Prefer this over `.forgeToolBar` for every
    /// GatedWebTool call site; a page with no `__navBack` behaves exactly as
    /// before.
    var navTitle: String? = nil

    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = GatedWebRef()
    @Environment(\.goBack) private var goBack

    var body: some View {
        if let title = navTitle {
            core.forgeToolBar(title, back: navBack)
        } else {
            core
        }
    }

    /// Ask the page to step back one level; when it's already at its top —
    /// or the page isn't up — step the web view's own history, then leave.
    private func navBack() {
        guard !loadFailed, let web = webRef.web else { goBack(); return }
        web.evaluateJavaScript("window.__navBack ? window.__navBack() : false") { handled, _ in
            if (handled as? Bool) == true { return }
            if web.canGoBack { web.goBack() } else { goBack() }
        }
    }

    private var core: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: icon)
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open \(name)")
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
                GatedWebView(path: path, token: studioToken, mic: mic,
                             refreshJS: refreshOnAppear, refreshTick: refreshTick,
                             failed: $loadFailed, webRef: webRef)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Theme.bg.ignoresSafeArea())
    }
}

/// Hands the loaded WKWebView up to the SwiftUI layer so the nav-bar chevron
/// can ask the page to step back a level (the BlocksWebRef pattern, shared).
final class GatedWebRef: ObservableObject { weak var web: WKWebView? }

private struct GatedWebView: UIViewRepresentable {
    let path: String
    let token: String
    let mic: Bool
    let refreshJS: String?
    let refreshTick: Int
    @Binding var failed: Bool
    var webRef: GatedWebRef? = nil

    /// Every page hosted here is inside a native tool screen, so it is always
    /// asked for with `?embed=1` — the server then hides the page's own title
    /// row (`.app-header` / `.tool-eyebrow`) and its "← Hub" button, which
    /// would otherwise duplicate the nav bar's title and navigate the web view
    /// out of the tool. Doing it HERE and not at each call site is the point:
    /// /vector shipped without the param and showed "VECTOR" twice, because
    /// remembering to type it is exactly the kind of thing that gets missed.
    static func embedded(_ path: String) -> String {
        if path.contains("embed=") { return path }
        return path + (path.contains("?") ? "&" : "?") + "embed=1"
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Generated audio (voice renders, song mixes) plays inline on tap.
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        // forge.css --bg, so the page's own paper shows while it loads.
        web.backgroundColor = UIColor(red: 0.980, green: 0.976, blue: 0.969, alpha: 1)
        web.allowsBackForwardNavigationGestures = true
        if let url = URL(string: MovieService.serverURL + Self.embedded(path)) {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        webRef?.web = web
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        guard let js = refreshJS, refreshTick != context.coordinator.lastTick else { return }
        context.coordinator.lastTick = refreshTick
        // Guarded: the page may still be loading when the tab is first shown.
        web.evaluateJavaScript("if (\(js)) \(js)()", completionHandler: nil)
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: GatedWebView
        var lastTick = 0
        init(_ parent: GatedWebView) { self.parent = parent }

        // The pages sit behind HTTP Basic (any user, password = studio token).
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
        /// Keep her INSIDE the tool. A link on one of these pages navigates the
        /// web view itself, and the page it lands on offers "← Hub" — which
        /// walks her into the web hub with no way back to the app (Sophie hit
        /// this from the Product Creator's Photo studio link). So: the tool's
        /// own page may load; anything else opens in Safari instead, and the
        /// tool stays put.
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard navigationAction.navigationType == .linkActivated,
                  let url = navigationAction.request.url else {
                decisionHandler(.allow); return
            }
            let mine = URL(string: MovieService.serverURL + parent.path)?.path  // query stripped
            if url.path == mine {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
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

        // Song Station records her singing via getUserMedia — grant the capture
        // request when the tool opted in (the OS mic prompt still applies once).
        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(parent.mic && type == .microphone ? .grant : .deny)
        }
    }
}

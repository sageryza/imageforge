import SwiftUI
import WebKit
import UIKit

/// Playground — try prompts against the house LoRA styles with the fixed
/// comparable recipe (4 images a run, seed 85, 2:3, guidance 3, 28 steps).
/// Wraps the server's gated /playground page (public/promptlab.html, engine at
/// /api/promptlab) exactly like the Episode Editor wraps /editor: the page IS
/// the UI, this only hosts it and answers the studio gate's HTTP Basic
/// challenge with the stored token. Runs are background jobs the page resumes
/// from localStorage, so leaving mid-draw loses nothing. Page changes ship
/// with a Render deploy — no app build needed.
struct PlaygroundView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = PlaygroundWebRef()
    @Environment(\.goBack) private var goBack

    /// The page's paper (fixed light), so the nav-bar area blends into the
    /// page instead of showing a mismatched strip.
    static let paper = Color(red: 0.980, green: 0.969, blue: 0.949)   // --paper #FAF7F2
    static let ink = Color(red: 0.169, green: 0.149, blue: 0.133)     // --ink #2B2622

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "paintpalette")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open the Playground")
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
                PlaygroundWebView(token: studioToken, failed: $loadFailed, webRef: webRef, onLeave: goBack)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // Standard tool header: the PAGE draws the back chevron — the
        // page consumes it while its lightbox is open, then it leaves the tool.
        .forgeWebToolBar("Playground", tint: Self.ink, paper: Self.paper, failed: loadFailed, back: navBack)
    }

    /// Ask the page to step back one level (close its lightbox); when there is
    /// nothing to close — or the page isn't up — step the web view's own
    /// history, then leave the tool.
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
final class PlaygroundWebRef: ObservableObject { weak var web: WKWebView? }

/// A one-shot query string another tool wants the Playground opened with —
/// the gallery's "open in Playground with these settings". Set it, then
/// openTool(.playground): a fresh web view builds its URL from it, and an
/// already-alive one reloads on the screen-change notification. Cleared on
/// use. MainActor because serverURL is (and every touch is UI-side anyway).
@MainActor
enum PlaygroundPrefill {
    static var pending: String?
    static func url() -> URL? {
        guard let q = pending else { return nil }
        pending = nil
        return URL(string: MovieService.serverURL + "/playground?" + q)
    }
}

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the
/// stored token, same pattern as the Episode Editor.
private struct PlaygroundWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: PlaygroundWebRef
    /// Leave the tool — what `window.__forgeLeave()` reaches now that
    /// the page draws the back chevron instead of Apple's bar.
    var onLeave: () -> Void = {}

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // The page draws its own header now (ForgePageHeader): this installs
        // the bridge its back chevron calls to leave the tool.
        context.coordinator.leaveHandler = ForgePageHeader.install(into: config, onLeave: onLeave)
        // Save to Photos has to happen natively. The page's share-sheet path
        // works in a browser but not reliably inside a WKWebView, so the page
        // hands the image url over here instead — through the ONE saver the
        // native gallery uses (ForgeSaveBridge), never a per-tool copy.
        context.coordinator.saveHandler = ForgeSaveBridge.install(into: config)
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.980, green: 0.969, blue: 0.949, alpha: 1) // page --paper #FAF7F2
        web.allowsBackForwardNavigationGestures = false
        webRef.web = web
        if let url = PlaygroundPrefill.url() ?? URL(string: MovieService.serverURL + "/playground") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        // The tool stays alive between visits, so a prefill sent while this
        // web view already exists arrives via the screen-change notification.
        context.coordinator.watchForPrefill(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate {
        // iOS reclaims the web content process under memory pressure (this
        // app keeps three tools alive at once). A bare reload() here made it
        // WORSE — all three resurrecting together re-spiked memory and iOS
        // killed them in a loop, blanking the tool she was reading every ~10s
        // (build 175). ForgeWebRevive reloads only the visible view, one at a
        // time; a hidden tool revives when she switches back to it.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            ForgeWebRevive.shared.terminated(webView)
        }
        /// `addScriptMessageHandler` does not retain — these do.
        var leaveHandler: ForgeLeaveHandler?
        var saveHandler: ForgeSaveHandler?
        let parent: PlaygroundWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: PlaygroundWebView) { self.parent = parent }

        /// An alive web view picks a pending prefill up when the screen
        /// changes (the gallery sets it, then jumps to the Playground).
        func watchForPrefill(_ web: WKWebView) {
            screenChangeObserver = NotificationCenter.default.addObserver(
                forName: .forgeScreenChanged, object: nil, queue: .main) { [weak web] _ in
                    Task { @MainActor in
                        if let url = PlaygroundPrefill.url() {
                            web?.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
                        }
                    }
            }
        }

        deinit {
            if let o = screenChangeObserver { NotificationCenter.default.removeObserver(o) }
        }

        // The /playground page sits behind HTTP Basic (any user, password = token).
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

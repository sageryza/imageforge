import SwiftUI
import UIKit
import WebKit

/// Search — one search across BOTH transcript libraries: the interview
/// transcripts in `forge-nde-videos` and every transcribed voice memo. A
/// result is a passage with its timestamp, and each one hands off to the tool
/// that owns that kind of audio (interview → Episode Editor, memo → Cutting
/// Room). Wraps the server's gated /search page (public/search.html, engine at
/// /api/search in search.js) with the Episode Editor wrapper pattern: native
/// tool bar carrying THE back chevron, __nativeNavBar injected so the page
/// hides its own back button, audio paused on screen changes.
/// Page changes ship with a Render deploy — no app build needed.
struct SearchView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = SearchWebRef()
    @Environment(\.goBack) private var goBack

    /// The page's paper (fixed light), so the nav-bar area blends into the
    /// page instead of showing a mismatched strip. Same tokens as the Cutting
    /// Room and the Episode Editor — the audio tools are one family.
    static let paper = Color(red: 0.980, green: 0.969, blue: 0.945)   // --paper #FAF7F1
    static let ink = Color(red: 0.137, green: 0.125, blue: 0.106)     // --ink #23201B

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open Search")
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
                SearchWebView(token: studioToken, failed: $loadFailed, webRef: webRef, onLeave: goBack)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        .forgeWebToolBar("Search", tint: Self.ink, paper: Self.paper, failed: loadFailed, back: navBack)
    }

    /// Search has no inner levels of its own, but a hand-off navigates the web
    /// view to /cuttingroom — so step the web view's history first, and only
    /// then leave the tool.
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
final class SearchWebRef: ObservableObject { weak var web: WKWebView? }

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the
/// token and lets the page play a hit's audio inline without a second tap.
private struct SearchWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: SearchWebRef
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
        // The clip download buttons post here (same bridge name the Cutting
        // Room uses): a web view can't reach the Files app, so the native
        // side fetches the clip and hands it to the iOS share sheet.
        config.userContentController.add(context.coordinator, name: "cutroomShare")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.980, green: 0.969, blue: 0.945, alpha: 1) // page --paper #FAF7F1
        // A hand-off navigates to /cuttingroom, so back/forward history is real
        // here — but the chevron drives it, not an edge swipe.
        web.allowsBackForwardNavigationGestures = false
        webRef.web = web
        if let url = URL(string: MovieService.serverURL + "/search") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopAudioOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
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
        let parent: SearchWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: SearchWebView) { self.parent = parent }

        // Clip download → fetch the file → iOS share sheet (Save to Files /
        // AirDrop). Same contract as CuttingRoomView's handler.
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "cutroomShare",
                  let body = message.body as? [String: Any],
                  let urlStr = body["url"] as? String,
                  let url = URL(string: urlStr) else { return }
            let raw = (body["name"] as? String) ?? "clip"
            let safe = raw.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>…")).joined()
                .trimmingCharacters(in: .whitespaces)
            let filename = (safe.isEmpty ? "clip" : String(safe.prefix(60))) + ".mp3"
            URLSession.shared.downloadTask(with: url) { tmp, _, _ in
                guard let tmp = tmp else { return }
                let dest = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
                try? FileManager.default.removeItem(at: dest)
                try? FileManager.default.moveItem(at: tmp, to: dest)
                DispatchQueue.main.async {
                    let share = UIActivityViewController(activityItems: [dest], applicationActivities: nil)
                    let windows = UIApplication.shared.connectedScenes
                        .compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
                    guard let root = (windows.first { $0.isKeyWindow } ?? windows.first)?.rootViewController else { return }
                    var top = root
                    while let presented = top.presentedViewController { top = presented }
                    share.popoverPresentationController?.sourceView = top.view
                    top.present(share, animated: true)
                }
            }.resume()
        }

        // This web view stays alive (hidden) when Sophie switches tabs, so a
        // playing passage would keep talking out of a screen she can't see.
        func stopAudioOnScreenChange(_ web: WKWebView) {
            let pause = "document.querySelectorAll('audio').forEach(function(a){a.pause()});"
            screenChangeObserver = NotificationCenter.default.addObserver(
                forName: .forgeScreenChanged, object: nil, queue: .main) { [weak web] _ in
                    web?.evaluateJavaScript(pause, completionHandler: nil)
            }
        }

        deinit {
            if let o = screenChangeObserver { NotificationCenter.default.removeObserver(o) }
        }

        // The /search page sits behind HTTP Basic (any user, password = token).
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

import SwiftUI
import UIKit
import WebKit

/// Cutting Room — mark one of Sophie's own recordings on its transcript:
/// cut the pauses out, slice sections off to save or send on (Episode
/// Editor / Story Room). Wraps the server's gated /cuttingroom page
/// (public/cuttingroom.html, engine at /api/cutroom in cuttingroom.js)
/// exactly like the Episode Editor wraps /editor: native tool bar with THE
/// back chevron, __nativeNavBar injected so the page hides its own back
/// button, audio paused on screen changes. v1 shipped as a bare host and
/// Sophie flagged the mismatch immediately ("no back arrow, different
/// pill") — match the sibling tools, not the aspirational pattern.
/// Page changes ship with a Render deploy — no app build needed.
struct CuttingRoomView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = CutroomWebRef()
    @Environment(\.goBack) private var goBack

    /// The page's paper (fixed light), so the nav-bar area blends into the
    /// page instead of showing a mismatched strip. Same tokens as the editor.
    static let paper = Color(red: 0.980, green: 0.969, blue: 0.945)   // --paper #FAF7F1
    static let ink = Color(red: 0.137, green: 0.125, blue: 0.106)     // --ink #23201B

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "scissors")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open the Cutting Room")
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
                CuttingRoomWebView(token: studioToken, failed: $loadFailed, webRef: webRef)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // The standard tool header: the nav-bar chevron is THE back arrow —
        // inside a recording the page consumes it and returns to the
        // recordings list (__navBack); on the list it leaves the tool.
        .forgeToolBar("Cutting Room", tint: Self.ink, paper: Self.paper, back: navBack)
    }

    /// Ask the page to step back one level; when it's already on the
    /// recordings list — or the page isn't up — step the web view's own
    /// history, then leave the tool.
    private func navBack() {
        guard !loadFailed, let web = webRef.web else { goBack(); return }
        web.evaluateJavaScript("window.__navBack ? window.__navBack() : false") { handled, _ in
            if (handled as? Bool) == true { return }
            if web.canGoBack { web.goBack() } else { goBack() }
        }
    }
}

/// Hands the loaded WKWebView up to the SwiftUI layer so the nav-bar chevron
/// can talk to the page.
final class CutroomWebRef: ObservableObject { weak var web: WKWebView? }

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the
/// token and lets the page play audio inline (the recording, renders, clips)
/// without a second tap for the media itself.
private struct CuttingRoomWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: CutroomWebRef

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Tells the page this build's nav bar carries the back chevron, so it
        // hides its own in-page back button (body.native) — never both.
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__nativeNavBar = true",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // The download buttons post here: a web view can't reach the Files
        // app, so the native side fetches the clip and hands it to the iOS
        // share sheet (Save to Files / AirDrop / anywhere).
        config.userContentController.add(context.coordinator, name: "cutroomShare")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.980, green: 0.969, blue: 0.945, alpha: 1) // page --paper #FAF7F1
        web.allowsBackForwardNavigationGestures = false
        webRef.web = web
        if let url = URL(string: MovieService.serverURL + "/cuttingroom") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopAudioOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let parent: CuttingRoomWebView
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: CuttingRoomWebView) { self.parent = parent }

        // Download button → fetch the clip → iOS share sheet. "Download to my
        // phone" on iOS means Save to Files, and only native code can offer it.
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
        // playing recording would keep talking out of a screen she can't see —
        // pause everything on a screen change. Both players are DOM-attached
        // <audio> elements, so one selector catches them.
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

        // The /cuttingroom page sits behind HTTP Basic (any user, password = token).
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

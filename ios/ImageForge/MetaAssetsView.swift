import SwiftUI
import WebKit
import UIKit   // UIImageWriteToSavedPhotosAlbum — the forgeSave bridge

/// Meta Assets — every chat's Assets tab in one automatic, filing-ordered
/// place (Aug 2026, Sophie: "it will just replace my creations"). Wraps the
/// server's gated /assets page (public/assets.html, data from
/// /api/gallery/assets/all) exactly like the Episode Editor wraps /editor:
/// the page IS the UI, this only hosts it and answers the studio gate's HTTP
/// Basic challenge with the stored token. Page changes ship with a Render
/// deploy — no app build needed.
///
/// This took over the gallery slot from the native CreationsView (kept in the
/// repo, unmounted): everything that gallery showed rides along, because the
/// server folds the app-made creations into the same feed.
///
/// The page's Save icon posts the image url through the `forgeSave` bridge
/// (the Playground's pattern) so saving lands in the real Photos library.
struct MetaAssetsView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = MetaAssetsWebRef()
    @Environment(\.goBack) private var goBack

    /// The page's paper (chats-app palette), so the nav-bar area blends into
    /// the page instead of showing a mismatched strip.
    static let paper = Color(red: 0.965, green: 0.949, blue: 0.914)   // --paper #F6F2E9
    static let ink = Color(red: 0.149, green: 0.133, blue: 0.110)     // --ink #26221C

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "square.grid.2x2")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open Meta Assets")
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
                MetaAssetsWebView(token: studioToken, failed: $loadFailed, webRef: webRef, onLeave: goBack)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // The nav-bar chevron is THE back arrow: the page consumes it when its
        // lightbox is open (__navBack), else the web view's own history steps
        // back (she may have followed the chat icon into /chats), else leave.
        .forgeWebToolBar("Meta Assets", tint: Self.ink, paper: Self.paper, failed: loadFailed, back: navBack)
    }

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
final class MetaAssetsWebRef: ObservableObject { weak var web: WKWebView? }

/// WKWebView host: answers the studio gate's HTTP Basic challenge with the
/// token and carries the forgeSave bridge for the page's Save-to-Photos icon.
private struct MetaAssetsWebView: UIViewRepresentable {
    /// Leave the tool — what `window.__forgeLeave()` reaches now that
    /// the page draws the back chevron instead of Apple's bar.
    var onLeave: () -> Void = {}
    let token: String
    @Binding var failed: Bool
    let webRef: MetaAssetsWebRef

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Tells the page this build's nav bar carries the back chevron, so it
        // hides any in-page back affordance — never both.
        context.coordinator.leaveHandler = ForgePageHeader.install(into: config, onLeave: onLeave)
        // Save to Photos has to happen natively: the page's share-sheet path
        // works in a browser but not reliably inside a WKWebView, so the page
        // hands the image url over here (the Playground's pattern).
        config.userContentController.add(context.coordinator, name: "forgeSave")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.965, green: 0.949, blue: 0.914, alpha: 1) // page --paper #F6F2E9
        web.allowsBackForwardNavigationGestures = false
        webRef.web = web
        // embed=1: the nav bar already says Meta Assets, so the server strips
        // the page's own title row — the name appears once.
        if let url = URL(string: MovieService.serverURL + "/assets?embed=1") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        /// `addScriptMessageHandler` does not retain — this does.
        var leaveHandler: ForgeLeaveHandler?
        let parent: MetaAssetsWebView
        init(_ parent: MetaAssetsWebView) { self.parent = parent }

        /// The page's Save icon: `forgeSave.postMessage(<image url>)`. Fetch
        /// it, write it to Photos, and tell the page how it went so its toast
        /// is the truth rather than a guess.
        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "forgeSave",
                  let raw = message.body as? String,
                  let url = URL(string: raw) else { return }
            let web = message.webView
            Task {
                var ok = false
                if let (data, _) = try? await URLSession.shared.data(from: url),
                   let image = UIImage(data: data) {
                    UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                    ok = true
                }
                let msg = ok ? "Saved to Photos" : "Couldn’t save that image"
                await MainActor.run {
                    web?.evaluateJavaScript("window.__saveResult && window.__saveResult(\(ok), '\(msg)')")
                }
            }
        }

        // The /assets page sits behind HTTP Basic (any user, password = token).
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

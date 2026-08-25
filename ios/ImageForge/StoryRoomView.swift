import SwiftUI
import WebKit
import UniformTypeIdentifiers

/// Story Room — the story surface webpage (/storyroom), wrapped like the
/// Writing Room: the server page is the UI, this just hosts it and answers
/// the studio gate's HTTP Basic challenge with the stored token. Content
/// updates land with a Render deploy — no app build needed.
///
/// One thing the web layer CAN'T do on its own, bridged natively here (same
/// pattern as DreamsView): **paste a voiceover recording**. iOS won't hand a
/// clipboard audio file to a web page, so the page asks us, we read
/// UIPasteboard and upload it as the story's voiceover. This is how a Voice
/// Memo gets in without saving it to Files first: in Voice Memos,
/// Share → Copy, then tap "Paste a recording".
struct StoryRoomView: View {
    /// true when pushed inside another tool's stack (Movies) — the chevron's
    /// fallback then pops back there instead of jumping to the home grid.
    var pushed = false
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @StateObject private var webRef = StoryRoomWebRef()
    @Environment(\.goBack) private var goBack
    @Environment(\.dismiss) private var dismiss

    /// The page's own paper color (light/dark), so the nav-bar area blends
    /// into the web page instead of showing a white strip above the cream.
    static let paper = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.098, green: 0.090, blue: 0.075, alpha: 1)   // page --paper dark #191713
            : UIColor(red: 0.965, green: 0.949, blue: 0.914, alpha: 1)   // page --paper light #f6f2e9
    })

    /// The page's ink, so the chevron reads as part of the page's header.
    static let ink = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.910, green: 0.886, blue: 0.839, alpha: 1)   // page --ink dark #e8e2d6
            : UIColor(red: 0.149, green: 0.133, blue: 0.110, alpha: 1)   // page --ink light #26221c
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
                StoryRoomWebView(token: studioToken, failed: $loadFailed,
                                 webRef: webRef, onLeave: leave)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(Self.paper.ignoresSafeArea())
        // APPLE'S BAR IS GONE FROM HERE TOO (Aug 2026, Sophie: "I made the
        // impression that we had gotten rid of the Apple native header, but I
        // think story room still has it cause there's a back Chevron"). It was
        // the last web-wrapped tool still carrying one — a `.toolbar` with
        // ForgeBackButton, written before `.forgeWebToolBar` existed — so the
        // Story Room wore two title strips while every sibling wore one. The
        // PAGE draws the chevron now (pagehead.js), which is also what lets the
        // shelf and every sheet share that one row's shape. The bar comes back
        // for the failure screen only: there is no page there to draw one.
        .forgeWebToolBar("Story Room", tint: Self.ink, paper: Self.paper,
                         failed: loadFailed, back: navBack)
        // The page carries its own in-page autoscroll pill — hide the native
        // one while this screen is up (and stop any run already in flight).
        .onAppear {
            AutoScrollDriver.shared.stop()
            AutoScrollDriver.shared.webPillActive = true
        }
        .onDisappear { AutoScrollDriver.shared.webPillActive = false }
    }

    /// Ask the page to step back one level; when it reports it's already on
    /// the shelf — or the page isn't up at all — leave the Story Room.
    private func navBack() {
        guard !loadFailed, let web = webRef.web else { leave(); return }
        web.evaluateJavaScript("window.__navBack ? window.__navBack() : false") { handled, _ in
            if (handled as? Bool) == true { return }
            // The page said no — but the web view itself may have navigated to
            // ANOTHER page (the Characters button does location.href='/character',
            // which has no __navBack). Step the web view's own history back to
            // the Story Room before giving up and leaving the tool entirely.
            if web.canGoBack { web.goBack() } else { leave() }
        }
    }

    private func leave() {
        if pushed { dismiss() } else { goBack() }
    }
}

/// Hands the loaded WKWebView up to the SwiftUI layer so the nav-bar chevron
/// can talk to the page.
final class StoryRoomWebRef: ObservableObject { weak var web: WKWebView? }

private struct StoryRoomWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let webRef: StoryRoomWebRef
    /// Leave the tool — what `window.__forgeLeave()` reaches now that the page
    /// draws the back chevron instead of Apple's bar.
    var onLeave: () -> Void = {}

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "pasteVoiceover")
        // The page draws its own header now. This installs both halves of the
        // hand-over: `__nativeNavBar` (unchanged — it has always meant "chrome
        // outside your content owns back, don't draw your own", and pagehead.js
        // is that chrome now) and the `__forgeLeave` bridge the chevron calls
        // once the page has no level left to step back through.
        context.coordinator.leaveHandler =
            ForgePageHeader.install(into: config, onLeave: onLeave)
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(StoryRoomView.paper)
        web.allowsBackForwardNavigationGestures = true
        context.coordinator.webView = web
        webRef.web = web
        if let url = URL(string: MovieService.serverURL + "/storyroom") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        context.coordinator.stopAutoscrollOnScreenChange(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        // iOS reclaims the web content process under memory pressure (this
        // app keeps three tools alive at once). A bare reload() here made it
        // WORSE — all three resurrecting together re-spiked memory and iOS
        // killed them in a loop, blanking the tool she was reading every ~10s
        // (build 175). ForgeWebRevive reloads only the visible view, one at a
        // time; a hidden tool revives when she switches back to it.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            ForgeWebRevive.shared.terminated(webView)
        }
        let parent: StoryRoomWebView
        weak var webView: WKWebView?
        /// `addScriptMessageHandler` does NOT retain — hold the leave bridge
        /// here or `window.__forgeLeave()` reaches nothing.
        var leaveHandler: ForgeLeaveHandler?
        private var screenChangeObserver: NSObjectProtocol?
        init(_ parent: StoryRoomWebView) { self.parent = parent }

        // ── Page → native: paste a voiceover recording ──
        func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "pasteVoiceover" else { return }
            pasteVoiceover(projectId: (message.body as? String) ?? "")
        }

        /// Read a copied audio recording off the clipboard and attach it as this
        /// story's voiceover. Mirrors DreamsView's paste bridge.
        private func pasteVoiceover(projectId: String) {
            guard !projectId.isEmpty else { return }
            let pb = UIPasteboard.general
            let provider = pb.itemProviders.first { p in
                p.registeredTypeIdentifiers.contains { UTType($0)?.conforms(to: .audio) == true }
            }
            guard let provider,
                  let typeId = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .audio) == true }) else {
                run("window.__pasteVoEmpty && window.__pasteVoEmpty()")
                return
            }
            let mime = UTType(typeId)?.preferredMIMEType ?? "audio/mp4"
            run("window.__pasteVoStart && window.__pasteVoStart()")
            provider.loadDataRepresentation(forTypeIdentifier: typeId) { [weak self] data, _ in
                guard let self else { return }
                guard let data, !data.isEmpty else {
                    self.run("window.__pasteVoEmpty && window.__pasteVoEmpty()"); return
                }
                self.upload(projectId: projectId, data: data, mime: mime)
            }
        }

        /// POST the recording to /api/story/voiceover. Done natively (not in the
        /// page) so the megabytes of audio never have to cross into JavaScript.
        /// The server transcribes it into the voiceover's words in the
        /// background, so the page only needs to refetch the story.
        private func upload(projectId: String, data: Data, mime: String) {
            guard let url = URL(string: MovieService.serverURL + "/api/story/voiceover") else { return }
            let dataURL = "data:\(mime);base64," + data.base64EncodedString()
            var req = URLRequest(url: url, timeoutInterval: 240)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if !parent.token.isEmpty { req.setValue(parent.token, forHTTPHeaderField: "x-studio-token") }
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["projectId": projectId, "audio": dataURL])
            URLSession.shared.dataTask(with: req) { [weak self] respData, _, err in
                guard let self else { return }
                var ok = false, serverError = ""
                if let respData, let obj = try? JSONSerialization.jsonObject(with: respData) as? [String: Any] {
                    ok = (obj["ok"] as? Bool) ?? false
                    serverError = (obj["error"] as? String) ?? ""
                }
                DispatchQueue.main.async {
                    if ok {
                        self.run("window.__pasteVoDone && window.__pasteVoDone()")
                    } else {
                        let msg = serverError.isEmpty
                            ? (err?.localizedDescription ?? "Couldn't add that recording") : serverError
                        self.run("window.__pasteVoError && window.__pasteVoError(\(self.jsString(msg)))")
                    }
                }
            }.resume()
        }

        /// JSON-encode a string into a safe JS literal (quoted + escaped).
        private func jsString(_ s: String) -> String {
            if let d = try? JSONSerialization.data(withJSONObject: [s]),
               var lit = String(data: d, encoding: .utf8) {
                lit.removeFirst(); lit.removeLast()   // strip the surrounding [ ]
                return lit
            }
            return "\"\""
        }

        private func run(_ js: String) {
            DispatchQueue.main.async { self.webView?.evaluateJavaScript(js, completionHandler: nil) }
        }

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

import SwiftUI
import WebKit
import UniformTypeIdentifiers

/// Dreams — a thin wrapper around the gated `/dreams` web page
/// (public/dreams.html), the same way the Writing Room wraps `/writing`.
///
/// The whole dream experience lives in the page: write/record a dream → the
/// fast split (who's in it) → one cream cast sheet to pick the characters →
/// hand-drawn comic pages → past-dreams archive + zine. Because it's a web
/// page, most changes ship with a Render deploy — no TestFlight build.
///
/// Two things the web layer CAN'T do on its own, so this wrapper bridges them
/// natively (the page calls these; they only appear in the app):
///   • Paste a recording — iOS won't hand a clipboard audio file to a web page,
///     so the page asks us, we read UIPasteboard, transcribe it, and drop the
///     text back into the box. This is how a Voice Memo gets in: in Voice
///     Memos, Share → Copy, then tap Paste here.
///   • Open the Character Creator as a native sheet.
struct DreamsView: View {
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @State private var showCharacters = false

    var body: some View {
        Group {
            if loadFailed {
                VStack(spacing: 14) {
                    Image(systemName: "moon.stars")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.inkSoft)
                    Text("Couldn't open Dreams")
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
                DreamsWebView(token: studioToken,
                              failed: $loadFailed,
                              onOpenCharacters: { showCharacters = true })
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .navigationBarHidden(true)   // the /dreams page carries its own top bar
        .sheet(isPresented: $showCharacters) { CharacterCreatorView() }
    }
}

/// WKWebView host: answers the studio gate's HTTP Basic challenge, grants mic
/// capture, and bridges the page's `pasteAudio` / `openCharacters` messages.
private struct DreamsWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool
    let onOpenCharacters: () -> Void

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "pasteAudio")
        config.userContentController.add(context.coordinator, name: "openCharacters")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.980, green: 0.976, blue: 0.969, alpha: 1) // page --bg
        web.allowsBackForwardNavigationGestures = false
        context.coordinator.webView = web
        if let url = URL(string: MovieService.serverURL + "/dreams") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
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
        let parent: DreamsWebView
        weak var webView: WKWebView?
        init(_ parent: DreamsWebView) { self.parent = parent }

        // ── Page → native bridges ──
        func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case "pasteAudio": pasteRecording()
            case "openCharacters": parent.onOpenCharacters()
            default: break
            }
        }

        /// Read a copied audio recording off the clipboard, transcribe it via the
        /// server, and drop the text into the dream box. Mirrors how the native
        /// app used to accept a pasted Voice Memo.
        /// The clipboard's changeCount from the last paste — Copy on a long
        /// Voice Memo takes a moment to actually land on the clipboard, so a
        /// too-quick paste silently grabs the PREVIOUS recording. If nothing
        /// new was copied since last time, say so (but still paste it — a
        /// deliberate re-paste of the same memo stays possible).
        private static var lastPasteChangeCount = -1

        private func pasteRecording() {
            guard let web = webView else { return }
            let pb = UIPasteboard.general
            if pb.changeCount == Self.lastPasteChangeCount {
                run("window.__pasteAudioNote && window.__pasteAudioNote(\(jsString("Heads up — this is the same copy as last time. If you meant a new recording, give Copy a second to finish, then tap paste again.")))")
            }
            Self.lastPasteChangeCount = pb.changeCount
            let provider = pb.itemProviders.first { p in
                p.registeredTypeIdentifiers.contains { UTType($0)?.conforms(to: .audio) == true }
            }
            guard let provider,
                  let typeId = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .audio) == true }) else {
                run("window.__pasteAudioEmpty && window.__pasteAudioEmpty()")
                return
            }
            let mime = UTType(typeId)?.preferredMIMEType ?? "audio/mp4"
            run("window.__pasteAudioStart && window.__pasteAudioStart()")
            provider.loadDataRepresentation(forTypeIdentifier: typeId) { [weak self] data, _ in
                guard let self else { return }
                guard let data, !data.isEmpty else {
                    self.run("window.__pasteAudioEmpty && window.__pasteAudioEmpty()"); return
                }
                self.transcribe(data: data, mime: mime)
            }
        }

        /// POST the audio to /api/movies/dream/transcribe and inject the text.
        /// Done natively (not in the page) so the megabytes of audio never have
        /// to cross into JavaScript — only the resulting transcript does.
        private func transcribe(data: Data, mime: String, attempt: Int = 0) {
            guard let url = URL(string: MovieService.serverURL + "/api/movies/dream/transcribe") else { return }
            let dataURL = "data:\(mime);base64," + data.base64EncodedString()
            var req = URLRequest(url: url, timeoutInterval: 240)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if !parent.token.isEmpty { req.setValue(parent.token, forHTTPHeaderField: "x-studio-token") }
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["audio": dataURL])
            URLSession.shared.dataTask(with: req) { [weak self] respData, _, err in
                guard let self else { return }
                var text = ""
                if let respData,
                   let obj = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
                   let t = obj["text"] as? String { text = t }
                // A dropped connection / timeout gets two automatic retries
                // before the error ever reaches the screen — the audio is
                // still in hand, so re-sending costs nothing.
                if text.isEmpty, err != nil, attempt < 2 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 2.5) {
                        self.transcribe(data: data, mime: mime, attempt: attempt + 1)
                    }
                    return
                }
                DispatchQueue.main.async {
                    if text.isEmpty {
                        let msg = err?.localizedDescription ?? "Couldn't read that recording"
                        self.run("window.__pasteAudioError && window.__pasteAudioError(\(self.jsString(msg)))")
                    } else {
                        self.run("window.__fillDream && window.__fillDream(\(self.jsString(text)))")
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

        // ── Gate / mic / errors (unchanged) ──
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

        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(type == .microphone ? .grant : .deny)
        }
    }
}

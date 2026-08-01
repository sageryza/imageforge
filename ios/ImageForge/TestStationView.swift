import SwiftUI
import WebKit

/// Test Station — one prompt through any house style. Now a WKWebView on the
/// server's public /test page (public/test.html), so the style list lives in
/// ONE place (server MODELS) and new styles ship with a Render deploy — no app
/// build. This wrapper only hosts the page, keeps the corner nav, and gates
/// first use behind the App Store 5.1.2(i) AI-consent sheet (the page sends
/// the prompt to Replicate / OpenAI).
struct TestStationView: View {
    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @State private var loadFailed = false
    @State private var reloadKey = 0
    @Environment(\.goHome) private var goHome
    @Environment(\.openTool) private var openTool

    var body: some View {
        Group {
            if !aiConsentAccepted {
                // Consent placeholder — the sheet rises over this on appear;
                // the button covers a dismissed sheet.
                VStack(spacing: 14) {
                    ToolGlyph(tool: .test, size: 40)
                        .foregroundColor(Theme.textDim)
                    Text("Test Station")
                        .font(.headline)
                        .foregroundColor(Theme.text)
                    Text("Run one prompt through the house styles.")
                        .font(.subheadline)
                        .foregroundColor(Theme.textDim)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
                    Button("Get started") { showConsent = true }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 6).stroke(Theme.accent, lineWidth: 1))
                        .foregroundColor(Theme.accent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.bg)
                .onAppear { showConsent = true }
            } else if loadFailed {
                VStack(spacing: 14) {
                    ToolGlyph(tool: .test, size: 40)
                        .foregroundColor(Theme.textDim)
                    Text("Couldn't open the Test Station")
                        .font(.headline)
                        .foregroundColor(Theme.text)
                    Text("Check the connection and try again.")
                        .font(.subheadline)
                        .foregroundColor(Theme.textDim)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
                    Button("Try again") { loadFailed = false; reloadKey += 1 }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 6).stroke(Theme.accent, lineWidth: 1))
                        .foregroundColor(Theme.accent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.bg)
            } else {
                TestStationWebView(failed: $loadFailed)
                    .id(reloadKey)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .toolbar {
            // Home (back to the module grid) top-left; Chats top-right — Test
            // Station's entry point is a home-screen corner icon, so it
            // carries the matching corner nav.
            ToolbarItem(placement: .navigationBarLeading) {
                Button { goHome() } label: {
                    Image(systemName: "house")
                        .font(.system(size: 18))
                        .foregroundColor(Theme.accent)
                }
                .accessibilityLabel("Back to all the modules")
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { openTool(.chats) } label: {
                    Image(systemName: Tool.chats.icon)
                        .font(.system(size: 18))
                        .foregroundColor(Theme.accent)
                }
                .accessibilityLabel("Chats")
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [
                    AIProvider(name: "Replicate", role: "Generates your images (house styles)"),
                    AIProvider(name: "OpenAI", role: "Generates your images (ChatGPT / gpt-image-2)"),
                ],
                dataDescription: "the prompt you enter",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false },
                onCancel: { showConsent = false })
        }
    }
}

/// WKWebView host for the public /test page (no gate, no token). The server
/// sends no-cache on this route, so page changes reach the phone on reopen.
private struct TestStationWebView: UIViewRepresentable {
    @Binding var failed: Bool

    func makeUIView(context: Context) -> WKWebView {
        let web = WKWebView(frame: .zero)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.965, green: 0.949, blue: 0.914, alpha: 1) // forge paper
        web.allowsBackForwardNavigationGestures = false
        if let url = URL(string: MovieService.serverURL + "/test") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: TestStationWebView
        init(_ parent: TestStationWebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            // Only a failed FIRST load flips to the retry screen.
            if webView.url == nil { parent.failed = true }
        }
    }
}

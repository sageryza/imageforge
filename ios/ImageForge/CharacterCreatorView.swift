import SwiftUI
import WebKit

/// Character Creator — the `/character` web page wrapped like the Story Room /
/// Writing Room. Sophie saves the recurring people in her dreams (a photo, a
/// name, and aliases like "me"/"Sophie" or "Daddy"/"Dad"); the dream render
/// then matches each dream's cast to these and draws them consistently.
/// The page is the UI; this hosts it and answers the studio HTTP Basic gate.
/// Presented as a sheet from the Dreams "add a character" button.
struct CharacterCreatorView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var loadFailed = false
    @State private var reloadKey = 0

    var body: some View {
        NavigationStack {
            Group {
                if loadFailed {
                    VStack(spacing: 14) {
                        Image(systemName: "person.crop.circle.badge.exclamationmark")
                            .font(.system(size: 40))
                            .foregroundStyle(Theme.inkSoft)
                        Text("Couldn't open the Character Creator")
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
                    CharacterCreatorWebView(token: studioToken, failed: $loadFailed)
                        .id(reloadKey)
                        .ignoresSafeArea(edges: .bottom)
                }
            }
            .navigationTitle("Characters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct CharacterCreatorWebView: UIViewRepresentable {
    let token: String
    @Binding var failed: Bool

    func makeUIView(context: Context) -> WKWebView {
        let web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = false
        if let url = URL(string: MovieService.serverURL + "/character") {
            web.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: CharacterCreatorWebView
        init(_ parent: CharacterCreatorWebView) { self.parent = parent }

        // The page sits behind HTTP Basic (any user, password = studio token).
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

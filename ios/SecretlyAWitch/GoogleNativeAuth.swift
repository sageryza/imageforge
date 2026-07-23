import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

/// Native Google OAuth for the wrapped /witch web app.
///
/// Google refuses to complete OAuth inside a plain WKWebView (popup-blocked /
/// disallowed_useragent), so the page's "Continue with Google" button posts to
/// the `witchAuth` bridge and this class runs the flow in an
/// ASWebAuthenticationSession — Apple's sanctioned sign-in sheet, which Google
/// allows. PKCE authorization-code flow against the iOS OAuth client of
/// Firebase project membry-df528 (the same project the web app's Firebase Auth
/// uses), so the resulting ID token signs straight into the page via
/// signInWithCredential. iOS clients have no client secret; PKCE + the
/// reversed-client-ID redirect scheme are the whole handshake.
final class GoogleNativeAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = GoogleNativeAuth()

    private let clientID = "513384339473-pj0eg85b28r286btsteq7aag2ivp3v4e.apps.googleusercontent.com"
    private let redirectScheme = "com.googleusercontent.apps.513384339473-pj0eg85b28r286btsteq7aag2ivp3v4e"
    private var redirectURI: String { redirectScheme + ":/oauth2redirect" }

    private var session: ASWebAuthenticationSession?

    struct Tokens {
        let idToken: String
        let accessToken: String?
    }

    func signIn(completion: @escaping (Result<Tokens, Error>) -> Void) {
        let verifier = Self.randomURLSafe(64)
        let challenge = Self.s256(verifier)
        var comps = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        comps.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
        ]
        let s = ASWebAuthenticationSession(url: comps.url!, callbackURLScheme: redirectScheme) { [weak self] url, err in
            guard let self else { return }
            self.session = nil
            if let err { completion(.failure(err)); return }
            guard let url,
                  let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                      .queryItems?.first(where: { $0.name == "code" })?.value else {
                completion(.failure(NSError(domain: "GoogleNativeAuth", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Google didn't return a sign-in code"])))
                return
            }
            self.exchange(code: code, verifier: verifier, completion: completion)
        }
        s.presentationContextProvider = self
        s.prefersEphemeralWebBrowserSession = false // keep Google's session for easy re-sign-in
        session = s
        s.start()
    }

    private func exchange(code: String, verifier: String,
                          completion: @escaping (Result<Tokens, Error>) -> Void) {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let form: [String: String] = [
            "client_id": clientID,
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirectURI,
        ]
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        req.httpBody = form
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: allowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)
        URLSession.shared.dataTask(with: req) { data, _, err in
            DispatchQueue.main.async {
                if let err { completion(.failure(err)); return }
                guard let data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let idToken = json["id_token"] as? String else {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "(no response)"
                    completion(.failure(NSError(domain: "GoogleNativeAuth", code: 2,
                        userInfo: [NSLocalizedDescriptionKey: "Token exchange failed: \(body)"])))
                    return
                }
                completion(.success(Tokens(idToken: idToken,
                                           accessToken: json["access_token"] as? String)))
            }
        }.resume()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }

    private static func randomURLSafe(_ count: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes).base64URLEncoded()
    }

    private static func s256(_ verifier: String) -> String {
        Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded()
    }
}

private extension Data {
    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

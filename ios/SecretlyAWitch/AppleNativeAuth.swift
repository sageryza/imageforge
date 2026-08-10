import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

/// Sign in with Apple for the wrapped /witch web app.
///
/// **Required by App Store guideline 4.8** — the app offers Google sign-in, so
/// it must also offer a login service that limits collection to name + email,
/// lets the user hide their email, and doesn't track for ads. Sign in with
/// Apple is the one Apple names. Version 1.0 (8) was rejected for exactly this
/// (submission 52f6aa43, 2026-08-05).
///
/// Shaped like `GoogleNativeAuth`: the page's Apple button posts to the
/// `witchAuth` bridge, this runs the native sheet, and the RAW TOKENS go back
/// to the page, which finishes with Firebase JS `signInWithCredential`. No
/// Firebase SDK is linked into this target — the web app owns the session.
///
/// The nonce is the one non-obvious part and it is load-bearing: Apple is sent
/// the SHA256 of it and Firebase is given the RAW value, which is what stops a
/// stolen identity token being replayed. Firebase rejects the credential if the
/// two don't correspond, so both must come from the same `signIn()` call.
final class AppleNativeAuth: NSObject, ASAuthorizationControllerDelegate,
                             ASAuthorizationControllerPresentationContextProviding {
    static let shared = AppleNativeAuth()

    struct Tokens {
        let idToken: String
        /// The unhashed nonce. Firebase needs this one, not the hash Apple got.
        let rawNonce: String
        /// Only ever non-nil on the FIRST authorization for this Apple ID —
        /// Apple never sends the name again, so the page passes it straight
        /// into the credential rather than storing it for later.
        let fullName: String?
    }

    private var completion: ((Result<Tokens, Error>) -> Void)?
    private var currentNonce: String?
    /// Held so ARC doesn't release the controller mid-sheet.
    private var controller: ASAuthorizationController?

    func signIn(completion: @escaping (Result<Tokens, Error>) -> Void) {
        let nonce = Self.randomNonce()
        currentNonce = nonce
        self.completion = completion

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(nonce)

        let c = ASAuthorizationController(authorizationRequests: [request])
        c.delegate = self
        c.presentationContextProvider = self
        controller = c
        c.performRequests()
    }

    private func finish(_ result: Result<Tokens, Error>) {
        let done = completion
        completion = nil
        currentNonce = nil
        controller = nil
        DispatchQueue.main.async { done?(result) }
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken,
              let idToken = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce else {
            finish(.failure(NSError(domain: "AppleNativeAuth", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Apple sign-in didn't return an identity token",
            ])))
            return
        }
        var name: String?
        if let n = cred.fullName {
            let parts = [n.givenName, n.familyName].compactMap { $0 }.filter { !$0.isEmpty }
            if !parts.isEmpty { name = parts.joined(separator: " ") }
        }
        finish(.success(Tokens(idToken: idToken, rawNonce: nonce, fullName: name)))
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithError error: Error) {
        finish(.failure(error))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }

    /// Apple's own recommended nonce alphabet + rejection sampling.
    private static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            guard SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms) == errSecSuccess else { continue }
            for r in randoms where remaining > 0 {
                if r < UInt8(charset.count) {
                    result.append(charset[Int(r)])
                    remaining -= 1
                }
            }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

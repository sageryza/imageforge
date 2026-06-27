import Foundation
import FirebaseAuth
import FirebaseFunctions

/// Thin wrapper over the reused backend: anonymous Firebase Auth + the
/// `forgeTestImage` Cloud Function (renders one prompt through a chosen house
/// style and returns a permanent Storage URL). No API keys ship in the app —
/// they live in the function's Firestore config, same as the other apps.
@MainActor
final class ForgeService {
    static let shared = ForgeService()

    private lazy var functions = Functions.functions()

    func ensureSignedIn() async throws {
        if Auth.auth().currentUser == nil {
            try await Auth.auth().signInAnonymously()
        }
    }

    /// Render `prompt` in `styleId` and return the image URL.
    func generate(prompt: String, styleId: String) async throws -> URL {
        try await ensureSignedIn()
        let result = try await functions.httpsCallable("forgeTestImage").call([
            "prompt": prompt,
            "style": styleId,
        ])
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(
                domain: "ImageForge", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No image was returned."]
            )
        }
        return url
    }
}

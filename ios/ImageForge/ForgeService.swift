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

    /// Render a full-page sticker sheet from `prompt`. The house sticker look is
    /// baked into the backend (reference images + style prompt); the app only
    /// sends the subject prompt and the quality. Returns the sheet URL plus the
    /// detected sticker boxes (for tap-to-redo).
    func generateStickerSheet(prompt: String, quality: String) async throws -> StickerSheetResult {
        try await ensureSignedIn()
        // Routed through forgeTestImage (style "sticker-sheet") because that
        // function already has the public-invoker binding the client SDK needs.
        let result = try await functions.httpsCallable("forgeTestImage").call([
            "prompt": prompt,
            "style": "sticker-sheet",
            "quality": quality,
        ])
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(
                domain: "ImageForge", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No sticker sheet was returned."]
            )
        }
        let rawBoxes = (data["stickers"] as? [[String: Any]]) ?? []
        let boxes: [StickerBox] = rawBoxes.compactMap { b in
            guard
                let x = (b["xPct"] as? NSNumber)?.doubleValue,
                let y = (b["yPct"] as? NSNumber)?.doubleValue,
                let w = (b["wPct"] as? NSNumber)?.doubleValue,
                let h = (b["hPct"] as? NSNumber)?.doubleValue
            else { return nil }
            return StickerBox(xPct: x, yPct: y, wPct: w, hPct: h)
        }
        return StickerSheetResult(url: url, boxes: boxes)
    }

    /// Redo one sticker: send the cropped tile (PNG bytes) and get back a fresh
    /// variation of the same subject in the house style, on plain white.
    func redoSticker(imageData: Data) async throws -> URL {
        try await ensureSignedIn()
        let result = try await functions.httpsCallable("forgeTestImage").call([
            "style": "redo-sticker",
            "image": imageData.base64EncodedString(),
            "mimeType": "image/png",
        ])
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(
                domain: "ImageForge", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No sticker was returned."]
            )
        }
        return url
    }
}

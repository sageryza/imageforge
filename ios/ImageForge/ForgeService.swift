import Foundation
import FirebaseAuth
import FirebaseFunctions
import FirebaseFirestore

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

    /// Call a callable with a couple of automatic retries on transient network
    /// failures (e.g. "network connection lost"), so a brief blip doesn't kill a
    /// generation. Permanent errors (bad input, rate limit) are thrown right away.
    private func call(_ name: String, _ payload: [String: Any], retries: Int = 2) async throws -> HTTPSCallableResult {
        var attempt = 0
        while true {
            do {
                return try await functions.httpsCallable(name).call(payload)
            } catch {
                attempt += 1
                if attempt > retries || !Self.isRetryable(error) { throw error }
                try? await Task.sleep(nanoseconds: UInt64(attempt) * 1_500_000_000)
            }
        }
    }

    private static func isRetryable(_ error: Error) -> Bool {
        func urlRetryable(_ e: NSError) -> Bool {
            e.domain == NSURLErrorDomain && [
                NSURLErrorNetworkConnectionLost, NSURLErrorNotConnectedToInternet,
                NSURLErrorTimedOut, NSURLErrorCannotConnectToHost,
                NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed,
            ].contains(e.code)
        }
        let ns = error as NSError
        if urlRetryable(ns) { return true }
        if let underlying = ns.userInfo[NSUnderlyingErrorKey] as? NSError, urlRetryable(underlying) { return true }
        // Firebase Functions transient codes (domain "com.firebase.functions"):
        // 4 deadlineExceeded, 13 internal, 14 unavailable.
        if ns.domain == "com.firebase.functions" { return [4, 13, 14].contains(ns.code) }
        return false
    }

    /// Render `prompt` in `styleId` and return the image URL.
    func generate(prompt: String, styleId: String) async throws -> URL {
        try await ensureSignedIn()
        let result = try await call("forgeTestImage", [
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
        let result = try await call("forgeTestImage", [
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

    /// Redo one sticker: send the cropped tile (PNG bytes). With `replacement`
    /// text, draw that new subject in the same style; otherwise a fresh variation
    /// of the same subject. Returns the new sticker image URL.
    func redoSticker(imageData: Data, replacement: String? = nil) async throws -> URL {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "style": "redo-sticker",
            "image": imageData.base64EncodedString(),
            "mimeType": "image/png",
        ]
        let want = replacement?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !want.isEmpty { payload["prompt"] = want }
        let result = try await call("forgeTestImage", payload)
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

    /// Persist an edited (flattened) sticker sheet to the user's creations so
    /// edits made in the editor aren't lost. Returns the saved image URL.
    func saveEditedSheet(imageData: Data, prompt: String? = nil) async throws -> URL {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "style": "save-sheet",
            "image": imageData.base64EncodedString(),
        ]
        if let p = prompt, !p.isEmpty { payload["prompt"] = p }
        let result = try await call("forgeTestImage", payload)
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Couldn't save the sheet."])
        }
        return url
    }

    /// Generate a printable black-and-white coloring page.
    func generateColoringPage(prompt: String, quality: String) async throws -> URL {
        try await ensureSignedIn()
        let result = try await call("forgeTestImage", [
            "prompt": prompt,
            "style": "coloring-page",
            "quality": quality,
        ])
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(
                domain: "ImageForge", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No coloring page was returned."]
            )
        }
        return url
    }

    /// Illustrate a dream in the baked moody style. Returns the image URL.
    func generateDream(text: String) async throws -> URL {
        try await ensureSignedIn()
        let result = try await call("forgeTestImage", [
            "prompt": text,
            "style": "dream",
            "quality": "medium",
        ])
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "No dream was returned."])
        }
        return url
    }

    /// Generate a greeting card front: an illustration with `message` set as a
    /// headline along the bottom (composited server-side). Returns the card URL.
    func generateGreetingCard(prompt: String, message: String?, quality: String) async throws -> URL {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "prompt": prompt,
            "style": "greeting-card",
            "quality": quality,
        ]
        if let m = message?.trimmingCharacters(in: .whitespacesAndNewlines), !m.isEmpty { payload["message"] = m }
        let result = try await call("forgeTestImage", payload)
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "No card was returned."])
        }
        return url
    }

    /// Generate one storybook page: an illustrated scene with `caption` set along
    /// the bottom (composited server-side). Returns the finished page image URL.
    func generateStorybookPage(prompt: String, caption: String?, quality: String) async throws -> URL {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "prompt": prompt,
            "style": "storybook-page",
            "quality": quality,
        ]
        if let c = caption?.trimmingCharacters(in: .whitespacesAndNewlines), !c.isEmpty { payload["caption"] = c }
        let result = try await call("forgeTestImage", payload)
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "No storybook page was returned."])
        }
        return url
    }

    /// Generate a 4:5 Instagram post in the chosen `aesthetic` preset (dark /
    /// celestial / earthy). Optional product reference photo and optional caption
    /// text (composited onto the image for memes).
    func generateIgPost(prompt: String, referenceImage: Data?, caption: String?, quality: String, aesthetic: String = "dark") async throws -> URL {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "prompt": prompt,
            "style": "ig-post",
            "quality": quality,
            "aesthetic": aesthetic,
        ]
        if let ref = referenceImage { payload["refs"] = [ref.base64EncodedString()] }
        if let c = caption?.trimmingCharacters(in: .whitespacesAndNewlines), !c.isEmpty { payload["caption"] = c }
        let result = try await call("forgeTestImage", payload)
        guard
            let data = result.data as? [String: Any],
            let urlString = data["url"] as? String,
            let url = URL(string: urlString)
        else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "No post was returned."])
        }
        return url
    }

    /// Get an on-brand caption + hashtags for a post subject (text only).
    func generateCaption(subject: String) async throws -> (caption: String, hashtags: [String]) {
        try await ensureSignedIn()
        let result = try await call("forgeTestImage", [
            "prompt": subject,
            "style": "ig-caption",
        ])
        let data = result.data as? [String: Any]
        let caption = (data?["caption"] as? String) ?? ""
        let hashtags = (data?["hashtags"] as? [String]) ?? []
        return (caption, hashtags)
    }

    /// Generate a 5-slide educational carousel (cover + 4) from a topic, in the
    /// chosen aesthetic. Returns the slide URLs plus a suggested caption/hashtags.
    func generateCarousel(topic: String, aesthetic: String, quality: String) async throws -> CarouselResult {
        try await ensureSignedIn()
        let result = try await call("forgeTestImage", [
            "prompt": topic,
            "style": "ig-carousel",
            "aesthetic": aesthetic,
            "quality": quality,
        ])
        guard
            let data = result.data as? [String: Any],
            let arr = data["slides"] as? [String]
        else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "No carousel was returned."])
        }
        let slides = arr.compactMap { URL(string: $0) }
        guard slides.count >= 2 else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "The carousel came back too short."])
        }
        return CarouselResult(
            slides: slides,
            title: (data["title"] as? String) ?? "",
            caption: (data["caption"] as? String) ?? "",
            hashtags: (data["hashtags"] as? [String]) ?? [])
    }

    /// Publish a set of slide URLs as one Instagram carousel.
    func postCarousel(imageUrls: [URL], caption: String?) async throws {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "style": "ig-carousel-publish",
            "imageUrls": imageUrls.map { $0.absoluteString },
        ]
        if let c = caption?.trimmingCharacters(in: .whitespacesAndNewlines), !c.isEmpty { payload["caption"] = c }
        _ = try await call("forgeTestImage", payload)
    }

    /// Generate a short cinematic vertical Reel (still + Ken-Burns motion) in the
    /// chosen aesthetic. Returns the video URL plus a poster still.
    func generateReel(prompt: String, aesthetic: String, quality: String) async throws -> (video: URL, poster: URL?) {
        try await ensureSignedIn()
        let result = try await call("forgeTestImage", [
            "prompt": prompt, "style": "ig-reel", "aesthetic": aesthetic, "quality": quality,
        ])
        guard
            let data = result.data as? [String: Any],
            let v = data["videoUrl"] as? String, let video = URL(string: v)
        else {
            throw NSError(domain: "ImageForge", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "No reel was returned."])
        }
        let poster = (data["url"] as? String).flatMap { URL(string: $0) }
        return (video, poster)
    }

    /// Publish a video URL as an Instagram Reel.
    func postReel(videoUrl: URL, caption: String?) async throws {
        try await ensureSignedIn()
        var payload: [String: Any] = ["style": "ig-reel-publish", "videoUrl": videoUrl.absoluteString]
        if let c = caption?.trimmingCharacters(in: .whitespacesAndNewlines), !c.isEmpty { payload["caption"] = c }
        _ = try await call("forgeTestImage", payload)
    }

    /// Schedule a finished post to publish later. `type` is feed / story /
    /// carousel / reel; pass the matching url(s). It posts at `at`.
    func schedulePost(type: String, imageUrl: URL? = nil, imageUrls: [URL]? = nil,
                      videoUrl: URL? = nil, caption: String?, at: Date) async throws {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "style": "ig-schedule",
            "type": type,
            "postAt": Int(at.timeIntervalSince1970 * 1000),
        ]
        if let c = caption?.trimmingCharacters(in: .whitespacesAndNewlines), !c.isEmpty { payload["caption"] = c }
        if let u = imageUrl { payload["imageUrl"] = u.absoluteString }
        if let us = imageUrls { payload["imageUrls"] = us.map { $0.absoluteString } }
        if let v = videoUrl { payload["videoUrl"] = v.absoluteString }
        _ = try await call("forgeTestImage", payload)
    }

    /// Publish an already-generated image straight to Instagram (Graph API).
    /// `asStory` posts a 24h Story instead of a feed post (Stories ignore the
    /// caption). Throws a clear error if Instagram posting isn't set up yet.
    func postToInstagram(imageUrl: URL, caption: String?, asStory: Bool = false) async throws {
        try await ensureSignedIn()
        var payload: [String: Any] = [
            "style": "ig-publish",
            "imageUrl": imageUrl.absoluteString,
            "asStory": asStory,
        ]
        if let c = caption?.trimmingCharacters(in: .whitespacesAndNewlines), !c.isEmpty { payload["caption"] = c }
        _ = try await call("forgeTestImage", payload)
    }

    /// Read the signed-in user's saved creations (newest first). These are
    /// written server-side on every generation, so they survive a dropped
    /// connection / backgrounded app and back the in-app grid.
    func fetchCreations(limit: Int = 60) async throws -> [Creation] {
        try await ensureSignedIn()
        guard let uid = Auth.auth().currentUser?.uid else { return [] }
        let snap = try await Firestore.firestore()
            .collection("users").document(uid).collection("creations")
            .order(by: "createdAt", descending: true)
            .limit(to: limit)
            .getDocuments()
        return snap.documents.compactMap { doc in
            let data = doc.data()
            guard let urlStr = data["url"] as? String, let url = URL(string: urlStr) else { return nil }
            return Creation(
                id: doc.documentID,
                type: (data["type"] as? String) ?? "image",
                url: url,
                prompt: data["prompt"] as? String
            )
        }
    }

    /// Recovery: if a sticker generation's on-screen call dropped (e.g. the app
    /// was backgrounded), the server still finished and saved it. Find the newest
    /// sticker creation made since `since` and rebuild the full sheet (url +
    /// boxes) so the screen can show it instead of an error.
    func latestStickerSheet(since: Date) async throws -> StickerSheetResult? {
        try await ensureSignedIn()
        guard let uid = Auth.auth().currentUser?.uid else { return nil }
        // Fetch a few newest creations and pick the newest sticker one — avoids a
        // composite index that a type+createdAt query would require.
        let snap = try await Firestore.firestore()
            .collection("users").document(uid).collection("creations")
            .order(by: "createdAt", descending: true)
            .limit(to: 6)
            .getDocuments()
        for doc in snap.documents {
            let data = doc.data()
            guard (data["type"] as? String) == "sticker",
                  let urlStr = data["url"] as? String, let url = URL(string: urlStr) else { continue }
            if let ts = data["createdAt"] as? Timestamp, ts.dateValue() < since { continue }
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
        return nil
    }
}

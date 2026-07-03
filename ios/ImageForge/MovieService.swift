import Foundation

// REST client for the Movie medium — talks straight to the imageforge server
// (movies.js at /api/movies). Unlike the Test Station (a Cloud Function), the
// movie pipeline is a long-running, stateful REST API: create → poll the movie
// doc while jobs run → patch edits → stitch. No API keys ship in the app; the
// server holds them. When the server sets STUDIO_TOKEN, requests carry it in
// the x-studio-token header (Settings ▸ studio token).

enum MovieAPIError: LocalizedError {
    case badURL
    case server(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "The server URL in Settings isn't a valid URL."
        case .server(let message): return message
        }
    }
}

@MainActor
final class MovieService {
    static let shared = MovieService()
    static let defaultServer = "https://imageforge-q125.onrender.com"

    static var serverURL: String {
        let s = (UserDefaults.standard.string(forKey: "forge.serverURL") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return s.isEmpty ? defaultServer : s
    }
    static var studioToken: String {
        UserDefaults.standard.string(forKey: "forge.studioToken") ?? ""
    }

    private let decoder = JSONDecoder()

    // MARK: - Core request

    private func data(_ method: String, _ path: String,
                      body: [String: Any]? = nil,
                      timeout: TimeInterval = 90) async throws -> Data {
        guard let url = URL(string: Self.serverURL + "/api/movies" + path) else {
            throw MovieAPIError.badURL
        }
        var req = URLRequest(url: url, timeoutInterval: timeout)
        req.httpMethod = method
        let token = Self.studioToken
        if !token.isEmpty { req.setValue(token, forHTTPHeaderField: "x-studio-token") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status < 400 else {
            if let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = dict["error"] as? String {
                throw MovieAPIError.server(message)
            }
            throw MovieAPIError.server("Server error \(status)")
        }
        return data
    }

    private func fetch<T: Decodable>(_ type: T.Type, _ method: String, _ path: String,
                                     body: [String: Any]? = nil,
                                     timeout: TimeInterval = 90) async throws -> T {
        try decoder.decode(T.self, from: await data(method, path, body: body, timeout: timeout))
    }

    /// Action routes reply {ok, movie}; create/get/patch reply the movie itself.
    private struct Envelope: Decodable { let movie: Movie }

    private func movieCall(_ method: String, _ path: String,
                           body: [String: Any]? = nil,
                           timeout: TimeInterval = 90) async throws -> Movie {
        let raw = try await data(method, path, body: body, timeout: timeout)
        if let envelope = try? decoder.decode(Envelope.self, from: raw) { return envelope.movie }
        return try decoder.decode(Movie.self, from: raw)
    }

    // MARK: - API

    /// Also the wake-up call — Render's free tier sleeps after ~15 min, and the
    /// first request rides out the cold start (generous timeout, one retry).
    func status() async throws -> MoviesStatus {
        do { return try await fetch(MoviesStatus.self, "GET", "/status", timeout: 75) }
        catch { return try await fetch(MoviesStatus.self, "GET", "/status", timeout: 75) }
    }

    private struct MovieList: Decodable { let movies: [MovieSummary] }
    func list() async throws -> [MovieSummary] {
        try await fetch(MovieList.self, "GET", "", timeout: 75).movies
    }

    /// Story → scene breakdown (one GPT call, synchronous, ~5-15s).
    func create(story: String, sceneCount: Int? = nil, panelQuality: String? = nil) async throws -> Movie {
        var body: [String: Any] = ["story": story]
        if let sceneCount { body["sceneCount"] = sceneCount }
        if let panelQuality { body["panelQuality"] = panelQuality }
        return try await movieCall("POST", "", body: body, timeout: 120)
    }

    /// Lock (sceneId) or clear (nil) the character anchor.
    func setAnchor(_ id: String, sceneId: String?) async throws -> Movie {
        try await movieCall("POST", "/\(id)/anchor", body: ["sceneId": sceneId ?? NSNull()])
    }

    func movie(_ id: String) async throws -> Movie {
        try await movieCall("GET", "/\(id)")
    }

    func delete(_ id: String) async throws {
        _ = try await data("DELETE", "/\(id)")
    }

    /// The zoom-in surface: title/styles/dream mode/scene order/per-scene
    /// prompt overrides and the ffmpeg edit list all land here.
    func patch(_ id: String, _ body: [String: Any]) async throws -> Movie {
        try await movieCall("PATCH", "/\(id)", body: body)
    }

    func patchScene(_ id: String, sceneId: String, _ fields: [String: Any]) async throws -> Movie {
        var scene = fields
        scene["id"] = sceneId
        return try await patch(id, ["scenes": [scene]])
    }

    func reorder(_ id: String, order: [String]) async throws -> Movie {
        try await patch(id, ["order": order])
    }

    // Generation steps — each starts a background job; poll `movie(id)`.

    /// quality nil → the movie's chosen panelQuality; `only` limits to given scenes.
    func renderPanels(_ id: String, quality: String? = nil, only: [String]? = nil, force: Bool = false) async throws -> Movie {
        var body: [String: Any] = ["force": force]
        if let quality { body["quality"] = quality }
        if let only, !only.isEmpty { body["only"] = only }
        return try await movieCall("POST", "/\(id)/panels", body: body)
    }

    func rerollPanel(_ id: String, sceneId: String, quality: String = "medium",
                     imagePrompt: String? = nil) async throws -> Movie {
        var body: [String: Any] = ["quality": quality]
        if let imagePrompt { body["imagePrompt"] = imagePrompt }
        return try await movieCall("POST", "/\(id)/scenes/\(sceneId)/panel", body: body)
    }

    func animateAll(_ id: String, tier: String = "draft") async throws -> Movie {
        try await movieCall("POST", "/\(id)/clips", body: ["tier": tier])
    }

    func rerollClip(_ id: String, sceneId: String, tier: String = "draft",
                    frames: Int? = nil, motionPrompt: String? = nil) async throws -> Movie {
        var body: [String: Any] = ["tier": tier]
        if let frames { body["frames"] = frames }
        if let motionPrompt { body["motionPrompt"] = motionPrompt }
        return try await movieCall("POST", "/\(id)/scenes/\(sceneId)/clip", body: body)
    }

    func makeBridges(_ id: String) async throws -> Movie {
        try await movieCall("POST", "/\(id)/bridges")
    }

    func stitch(_ id: String) async throws -> Movie {
        try await movieCall("POST", "/\(id)/stitch")
    }

    /// The zine: cover + captioned pages from the movie's scenes.
    func makeZine(_ id: String, quality: String = "medium") async throws -> Movie {
        try await movieCall("POST", "/\(id)/zine", body: ["quality": quality])
    }

    // MARK: Quick animate (one image → one clip, no movie)

    /// Kick off a quick animation. `jpeg` is the picked image, already
    /// downscaled client-side; wan-2.2 runs at 720p by default.
    func animate(jpeg: Data, prompt: String, resolution: String = "720p") async throws -> QuickClip {
        let dataURL = "data:image/jpeg;base64," + jpeg.base64EncodedString()
        return try await fetch(QuickClip.self, "POST", "/animate",
                               body: ["image": dataURL, "prompt": prompt, "resolution": resolution],
                               timeout: 120)
    }

    private struct QuickList: Decodable { let clips: [QuickClip] }
    func quickList() async throws -> [QuickClip] {
        try await fetch(QuickList.self, "GET", "/quick").clips
    }

    func quickGet(_ id: String) async throws -> QuickClip {
        try await fetch(QuickClip.self, "GET", "/quick/\(id)")
    }

    func quickDelete(_ id: String) async throws {
        _ = try await data("DELETE", "/quick/\(id)")
    }
}

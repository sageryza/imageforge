import Foundation

// Codable models for the Movie medium — mirrors the JSON shapes served by
// imageforge's movies.js (/api/movies). Keep the two in sync.

/// A movie in the list screen (server sends summaries only — light for the phone).
struct MovieSummary: Codable, Identifiable {
    let id: String
    var title: String
    var createdAt: String?
    var updatedAt: String?
    var sceneCount: Int
    var poster: String?
    var movieUrl: String?
    var spend: Double?
    var job: MovieJob?
}

/// The full per-movie state: story, scenes, prompts, panel/clip URLs, edit
/// list, bridges, running job. This is what the film strip renders.
struct Movie: Codable, Identifiable {
    let id: String
    var title: String
    var story: String
    var characters: String?
    var imageStyle: String?
    var motionStyle: String?
    var negativePrompt: String?
    var dreamMode: Bool?
    var scenes: [MovieScene]
    var bridges: [MovieBridge]?
    var cuts: [MovieCut]?
    var zine: MovieZine?
    var job: MovieJob?
    var movieUrl: String?
    var movieDuration: Double?
    var spend: Double?
    var createdAt: String?
    var updatedAt: String?
}

/// One finished stitch. Every stitch is kept, named by what changed since the
/// previous cut, with the ordered frames it contains (the contact sheet).
struct MovieCut: Codable, Identifiable {
    let id: String
    var url: String
    var name: String
    var duration: Double?
    var stitchedAt: String?
    var frames: [CutFrame]?

    var videoURL: URL? { URL(string: url) }
}

struct CutFrame: Codable {
    var sceneId: String
    var title: String
    var panelUrl: String?
    var bridge: Bool?
}

/// The movie's scenes as a zine — a hand-lettered cover plus one captioned
/// 2x2 page per four scenes, all in the style reference's own format.
struct MovieZine: Codable {
    var pages: [ZinePage]
    var quality: String?
    var madeAt: String?
}

struct ZinePage: Codable, Identifiable {
    var url: String
    var promptUsed: String?
    var cover: Bool?
    var sceneIds: [String]?

    var id: String { url }
    var pageURL: URL? { URL(string: url) }
}

/// A one-image quick animation (home-screen "Animate", no movie attached).
struct QuickClip: Codable, Identifiable {
    let id: String
    var status: String      // running | done | error
    var error: String?
    var prompt: String?
    var imageUrl: String?
    var clipUrl: String?
    var resolution: String?
    var frames: Int?
    var cost: Double?
    var createdAt: String?

    var clipVideoURL: URL? { clipUrl.flatMap(URL.init(string:)) }
    var posterURL: URL? { imageUrl.flatMap(URL.init(string:)) }
}

struct MovieScene: Codable, Identifiable {
    let id: String
    var title: String
    var summary: String            // the self-contained scene description
    var imagePrompt: String
    var motionPrompt: String
    var motionPromptOverride: String?
    var hasText: Bool?
    var pairWithNext: Bool?
    var panel: PanelState?
    var clip: ClipState?
    var panelHistory: [PanelState]?   // superseded generations (the gallery)
    var clipHistory: [ClipState]?
    var edits: SceneEdits?

    enum CodingKeys: String, CodingKey {
        case id, title, imagePrompt, motionPrompt, motionPromptOverride
        case hasText, pairWithNext, panel, clip, panelHistory, clipHistory, edits
        case summary = "description"
    }

    var panelURL: URL? { (panel?.url).flatMap(URL.init(string:)) }
    var clipURL: URL? { (clip?.url).flatMap(URL.init(string:)) }
    /// Seconds of generated footage (before edits) — for the trim controls.
    var clipSeconds: Double {
        if let f = clip?.frames, f > 0 { return Double(f) / 16.0 }   // wan draft @16fps
        return 5                                                     // kling default
    }
}

struct PanelState: Codable {
    var url: String?
    var quality: String?
    var status: String?    // running | done | error
    var error: String?
    var promptUsed: String?
}

struct ClipState: Codable {
    var url: String?
    var tier: String?      // draft | standard | pro
    var status: String?    // running | done | error
    var error: String?
    var frames: Int?
    var cost: Double?
    var promptUsed: String?
}

/// The per-scene ffmpeg edit list — all free, applied at stitch time.
struct SceneEdits: Codable {
    var enabled: Bool?
    var trimStart: Double?
    var trimEnd: Double?    // seconds from clip start; 0 = play to the end
    var speed: Double?      // 1 = as generated, 0.8 = dreamy slow-mo, 2 = snappy
    var freezeEnd: Double?  // seconds of freeze-frame appended
    var fadeOut: Double?    // seconds of fade to black
}

/// A dream-mode bridge clip across a hard cut.
struct MovieBridge: Codable, Identifiable {
    let id: String
    var fromSceneId: String
    var toSceneId: String
    var prompt: String
    var clip: ClipState?
}

/// The one-at-a-time background job recorded in the movie doc; the app polls
/// the movie while `status == "running"` and the strip stays current.
struct MovieJob: Codable {
    var kind: String
    var status: String     // running | done | error
    var done: Int?
    var total: Int?
    var label: String?
    var error: String?
    var startedAt: String?

    var isRunning: Bool { status == "running" }
}

struct MoviesStatus: Codable {
    var ok: Bool
    var openai: Bool
    var replicate: Bool
    var firebase: Bool
    var ffmpeg: Bool
    var styleReference: Bool?
    var gated: Bool
}

// ─── Cost chips (mirror movies.js constants) ─────────────────────────
enum MovieCosts {
    static let panel: [String: Double] = ["low": 0.02, "medium": 0.06, "high": 0.25]
    static let clip: [String: Double] = ["draft": 0.06, "standard": 0.25, "pro": 0.55]
    static let bridge = 0.08

    static func chip(_ amount: Double) -> String {
        amount < 0.005 ? "free" : String(format: "$%.2f", amount)
    }
}

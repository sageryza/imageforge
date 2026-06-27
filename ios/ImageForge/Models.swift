import Foundation

/// A house style shown as a tile in the Test Station. `id` is the style key the
/// `forgeTestImage` Cloud Function expects; `sampleSeg` is the filename of the
/// committed preview served by the web app (nil when there's no committed
/// preview, e.g. gpt-image-2).
struct ForgeStyle: Identifiable, Hashable {
    let id: String
    let name: String
    let provider: String      // "replicate" | "openai"
    let sampleSeg: String?

    var sampleURL: URL? {
        guard let seg = sampleSeg else { return nil }
        return URL(string: "https://imageforge-q125.onrender.com/samples/\(seg).webp")
    }
}

enum ForgeStyles {
    /// Mirrors MODELS in imageforge/server.js and FORGE_STYLES in the Cloud
    /// Function. Keep the order/keys in sync across all three.
    static let all: [ForgeStyle] = [
        ForgeStyle(id: "gosh",        name: "Gouache",              provider: "replicate", sampleSeg: "gosh"),
        ForgeStyle(id: "pnt",         name: "Painterly",            provider: "replicate", sampleSeg: "paint"),
        ForgeStyle(id: "special",     name: "Sketchy",              provider: "replicate", sampleSeg: "special"),
        ForgeStyle(id: "vict",        name: "Book Illustrations",   provider: "replicate", sampleSeg: "victorianstyle"),
        ForgeStyle(id: "wtr",         name: "Watercolor Drawings",  provider: "replicate", sampleSeg: "watercolordrawings"),
        ForgeStyle(id: "tok",         name: "PWC Scans",            provider: "replicate", sampleSeg: "pwcscans"),
        ForgeStyle(id: "hoonie",      name: "Hoonie Linocut",       provider: "replicate", sampleSeg: "hoonie"),
        ForgeStyle(id: "gpt-image-2", name: "ChatGPT (gpt-image-2)", provider: "openai",   sampleSeg: nil),
    ]
}

/// One generation in the results feed (newest first).
struct ForgeResult: Identifiable {
    let id = UUID()
    let styleId: String
    let styleName: String
    let prompt: String
    var url: URL?
    var error: String?
    var isLoading: Bool { url == nil && error == nil }
}

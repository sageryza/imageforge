import Foundation
import UIKit

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

/// A detected sticker's bounding box on the sheet, as fractions (0–1) of the
/// sheet's width/height. Returned by the backend's segmentation.
struct StickerBox: Hashable {
    let xPct: Double
    let yPct: Double
    let wPct: Double
    let hPct: Double
}

/// A generated sticker sheet: the flat image plus the per-sticker boxes used by
/// the tap-to-redo canvas.
struct StickerSheetResult {
    let url: URL
    let boxes: [StickerBox]
}

/// One on-canvas sticker the user can tap to redo. Positioned by its center and
/// size as fractions of the canvas; carries its current image.
struct CanvasSticker: Identifiable {
    let id = UUID()
    var centerXPct: Double
    var centerYPct: Double
    var sidePct: Double      // square side as a fraction of canvas width
    var image: UIImage?
    var isLoading: Bool = false
}

/// A saved creation (sticker sheet, coloring page, …) from the user's server
/// list — powers the in-app grid + "pick it up when you reopen" recovery.
struct Creation: Identifiable, Hashable {
    let id: String
    let type: String
    let url: URL
    let prompt: String?
    /// What made the picture. `model`/`quality` are the structured fields the
    /// generators write now; `style` is the older single label ("ChatGPT ·
    /// medium", "Watercolor Drawings") that everything filed before them carries.
    var model: String? = nil
    var quality: String? = nil
    var style: String? = nil

    /// The line shown under a creation when you open it — model · quality.
    var madeWith: String? {
        let parts = [model, quality].compactMap { $0?.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if !parts.isEmpty { return parts.joined(separator: " · ") }
        let s = style?.trimmingCharacters(in: .whitespaces)
        return (s?.isEmpty == false) ? s : nil
    }
}

/// A generated educational carousel: ordered slide images plus a suggested
/// caption + hashtags. Posted as one Instagram carousel.
struct CarouselResult {
    let slides: [URL]
    let title: String
    let caption: String
    let hashtags: [String]
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

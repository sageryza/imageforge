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
    /// This picture's only copy was encoded lossily before the bytes ever
    /// reached us (written by scripts/tag-compressed-at-birth.js). The flag is
    /// the data; the "[compressed]" below is presentation.
    var compressedAtBirth: Bool = false
    /// The still a VIDEO creation tiles with — a clip has no frame the grid can
    /// decode, so without this it would tile as a blank square. For a Movies
    /// clip it's the panel the clip was animated from (movies.js files it).
    var poster: URL? = nil

    /// Whether this creation plays rather than displays. The TYPE is what the
    /// filer writes, but the url is checked too, so a clip filed before this
    /// existed (or by a script that called it something else) still plays
    /// instead of tiling as a broken picture.
    var isVideo: Bool {
        if ["clip", "film", "video", "movie"].contains(type) { return true }
        return ["mp4", "mov", "m4v", "webm"].contains(url.pathExtension.lowercased())
    }

    /// What the grid draws in the tile: the poster for a video, the thing
    /// itself for a picture.
    var thumbURL: URL { poster ?? url }

    /// The line shown under a creation when you open it — model · quality,
    /// led by "[compressed]" when the original was thrown away at birth. A
    /// picture with no model/quality on file still says it, so the mark never
    /// depends on a caption that may not exist.
    var madeWith: String? {
        let parts = [model, quality].compactMap { $0?.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        var line: String? = nil
        if !parts.isEmpty { line = parts.joined(separator: " · ") }
        else {
            let s = style?.trimmingCharacters(in: .whitespaces)
            if s?.isEmpty == false { line = s }
        }
        guard compressedAtBirth else { return line }
        return ["[compressed]", line].compactMap { $0 }.joined(separator: " ")
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

import SwiftUI
import UIKit
import ImageIO

/// Plays a bundled animated image (GIF or APNG). SwiftUI's `Image` can't animate
/// these, so we decode the frames with ImageIO and hand them to a UIImageView.
///
/// `speed` scales playback: 1 = the image's own timing, <1 slower, >1 faster.
/// We drive it off the busy state so the HOONIE loader idles slowly and speeds
/// up once generation actually starts.
struct GIFView: UIViewRepresentable {
    let name: String        // resource name, no extension
    var ext: String = "gif" // "gif" or "png" (APNG)
    var speed: Double = 1   // playback multiplier

    func makeUIView(context: Context) -> UIImageView {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFit
        iv.setContentHuggingPriority(.defaultLow, for: .horizontal)
        iv.setContentHuggingPriority(.defaultLow, for: .vertical)
        // Allow SwiftUI's .frame(...) to shrink it below the image's intrinsic
        // size (otherwise it renders at full resolution).
        iv.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        iv.setContentCompressionResistancePriority(.defaultLow, for: .vertical)

        let decoded = GIFView.decoded(named: name, ext: ext)
        iv.animationImages = decoded?.frames
        context.coordinator.baseDuration = decoded?.duration ?? 0
        apply(iv, context: context)
        return iv
    }

    func updateUIView(_ uiView: UIImageView, context: Context) {
        apply(uiView, context: context)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator { var baseDuration: Double = 0; var appliedSpeed: Double = -1 }

    /// (Re)apply the current speed by scaling the animation duration. Only
    /// restarts the animation when the speed actually changes so it doesn't
    /// stutter on unrelated view updates.
    private func apply(_ iv: UIImageView, context: Context) {
        guard let frames = iv.animationImages, !frames.isEmpty else { return }
        let s = max(speed, 0.05)
        guard context.coordinator.appliedSpeed != s else {
            if !iv.isAnimating { iv.startAnimating() }
            return
        }
        context.coordinator.appliedSpeed = s
        iv.animationDuration = context.coordinator.baseDuration / s
        iv.animationRepeatCount = 0
        iv.stopAnimating()
        iv.startAnimating()
    }

    // MARK: - Decode (cached)

    private struct Decoded { let frames: [UIImage]; let duration: Double }
    private static var cache: [String: Decoded] = [:]

    private static func decoded(named name: String, ext: String) -> Decoded? {
        let key = "\(name).\(ext)"
        if let hit = cache[key] { return hit }
        guard let url = Bundle.main.url(forResource: name, withExtension: ext),
              let data = try? Data(contentsOf: url),
              let src = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = CGImageSourceGetCount(src)
        var frames: [UIImage] = []
        var total: Double = 0
        for i in 0..<count {
            guard let cg = CGImageSourceCreateImageAtIndex(src, i, nil) else { continue }
            frames.append(UIImage(cgImage: cg))
            let props = CGImageSourceCopyPropertiesAtIndex(src, i, nil) as? [CFString: Any]
            let gif = props?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
            let png = props?[kCGImagePropertyPNGDictionary] as? [CFString: Any]
            let dt = (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
                ?? (gif?[kCGImagePropertyGIFDelayTime] as? Double)
                ?? (png?[kCGImagePropertyAPNGUnclampedDelayTime] as? Double)
                ?? (png?[kCGImagePropertyAPNGDelayTime] as? Double)
                ?? 0.05
            total += max(dt, 0.02)
        }
        guard !frames.isEmpty else { return nil }
        let d = Decoded(frames: frames, duration: total)
        cache[key] = d
        return d
    }

    /// Kept for any callers that just want the still animated image.
    static func animatedImage(named name: String, ext: String = "gif") -> UIImage? {
        guard let d = decoded(named: name, ext: ext) else { return nil }
        return UIImage.animatedImage(with: d.frames, duration: d.duration)
    }
}

import SwiftUI
import UIKit
import ImageIO

/// Plays an animated GIF bundled in the app. SwiftUI's `Image` can't animate
/// GIFs, so we decode the frames with ImageIO and hand them to a UIImageView.
struct GIFView: UIViewRepresentable {
    let name: String   // resource name, no extension

    func makeUIView(context: Context) -> UIImageView {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFit
        iv.image = GIFView.animatedImage(named: name)
        iv.startAnimating()
        iv.setContentHuggingPriority(.defaultLow, for: .horizontal)
        iv.setContentHuggingPriority(.defaultLow, for: .vertical)
        return iv
    }

    func updateUIView(_ uiView: UIImageView, context: Context) {}

    static func animatedImage(named name: String) -> UIImage? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "gif"),
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
            let dt = (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
                ?? (gif?[kCGImagePropertyGIFDelayTime] as? Double) ?? 0.05
            total += max(dt, 0.02)
        }
        guard !frames.isEmpty else { return nil }
        return UIImage.animatedImage(with: frames, duration: total)
    }
}

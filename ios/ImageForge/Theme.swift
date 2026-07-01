import SwiftUI

/// The ImageForge house palette — matches public/forge.css so the app and the
/// web hub feel like one product.
enum Theme {
    static let bg        = Color(hex: 0xFAF9F7)
    static let surface   = Color.white
    static let surface2  = Color(hex: 0xF5F0EB)
    static let border    = Color(hex: 0xE8E4DF)
    static let accent    = Color(hex: 0xB48B6A)
    static let accentDim = Color(hex: 0xC9AD93)
    static let text      = Color(hex: 0x3A3530)
    static let textDim   = Color(hex: 0x9E9590)
    static let danger    = Color(hex: 0xD4807A)

    /// Design rule: text buttons are rounded rectangles at 6px (no pills).
    static let radius: CGFloat = 6
    static let radiusLg: CGFloat = 12

    // --- Deck Factory hand-drawn skin (the "contraption" look) ---
    static let cream     = Color(hex: 0xFBF5E6)   // page background
    static let ink       = Color(hex: 0x1C1813)   // outlines + text
    static let inkSoft   = Color(hex: 0x9A8F72)   // dim labels on cream
    static let marigold  = Color(hex: 0xF8C600)   // the logo yellow (fills only)
    static let mauve     = Color(hex: 0xC58BA6)   // generate-button accent (mauve pink)
    static let ghost     = Color(hex: 0xD8CFB6)   // empty-placeholder dashed lines
    static let radiusXL: CGFloat = 18

    /// EB Garamond (bundled + registered at launch) at a given size.
    static func serif(_ size: CGFloat) -> Font {
        Font.custom("EBGaramond-Regular", size: size)
    }
}

extension Color {
    init(hex: UInt) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue:  Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

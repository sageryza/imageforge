import SwiftUI
import UIKit

/// One nav-bar title pattern for every top-level page: the small, wide-tracked,
/// uppercase, muted "eyebrow" style used across the web pages (the `.no` class —
/// the text that sat next to "deck factory"). Replaces `.navigationTitle(…)` on
/// a page's root so the title reads as a designed label, not a plain nav title.
///
/// It keeps a real `navigationTitle` underneath (for the a11y label and the
/// back-button text on pushed children) and overrides only the *visible* title
/// via a principal toolbar item, so backgrounds and back buttons are untouched.
extension View {
    func forgeTitle(_ text: String) -> some View {
        self
            .navigationTitle(text)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(text.uppercased())
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(2.5)
                        .foregroundColor(ForgeTitle.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .accessibilityLabel(text)
                }
            }
    }
}

private enum ForgeTitle {
    /// The web eyebrow's muted ink (`--ink2`): #8a8377 light, #97907f dark.
    static let ink = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.592, green: 0.565, blue: 0.498, alpha: 1)
            : UIColor(red: 0.541, green: 0.514, blue: 0.467, alpha: 1)
    })
}

import SwiftUI
import UIKit

/// One nav-bar title pattern for every top-level page: the small, wide-tracked,
/// uppercase, muted "eyebrow" style used across the web pages (the `.no` class —
/// the text that sat next to "deck factory"). Replaces `.navigationTitle(…)` on
/// a page's root so the title reads as a designed label, not a plain nav title.
///
/// It keeps a real `navigationTitle` underneath (for the a11y label and the
/// back-button text on pushed children) and overrides only the *visible* title
/// via a principal toolbar item, so back buttons are untouched. It also paints
/// the bar with the screen's paper — see `paper` below.
extension View {
    /// `paper` is the screen's own background. The nav bar is painted with it so
    /// the page colour runs to the very top edge — left to the system default
    /// the bar keeps its own material, which reads as a white strip above the
    /// cream (Home has no strip only because it isn't in a NavigationStack at
    /// all). Pass a screen's paper whenever it isn't the house `Theme.bg`; the
    /// web-wrapped tools each match their page's CSS paper.
    func forgeTitle(_ text: String, paper: Color = Theme.bg) -> some View {
        self
            .navigationTitle(text)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(paper, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
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

/// Where the standard back chevron goes: the PREVIOUS screen. RootView keeps
/// the screen history and injects the real action; with no history it falls
/// back to the Home grid.
struct GoBackKey: EnvironmentKey { static let defaultValue: () -> Void = {} }
extension EnvironmentValues {
    var goBack: () -> Void {
        get { self[GoBackKey.self] }
        set { self[GoBackKey.self] = newValue }
    }
}

/// The one back button every tool screen carries, top-left: a chevron that
/// returns to the previous screen. Pass `action` to intercept it — the
/// web-wrapped tools ask their page to step back a level first.
struct ForgeBackButton: View {
    var tint: Color = Theme.text
    var action: (() -> Void)? = nil
    @Environment(\.goBack) private var goBack

    var body: some View {
        Button { (action ?? goBack)() } label: {
            Image(systemName: "chevron.left")
                .font(.body.weight(.semibold))
                .foregroundColor(tint)
        }
        .accessibilityLabel("Back")
    }
}

extension View {
    /// The standard header for every tool screen: the eyebrow title in the nav
    /// bar + the back chevron top-left (previous screen). Trailing controls
    /// stay per-screen. This is THE pattern — don't hand-roll tool headers.
    func forgeToolBar(_ title: String, tint: Color = Theme.text,
                      paper: Color = Theme.bg,
                      back: (() -> Void)? = nil) -> some View {
        self.forgeTitle(title, paper: paper)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    ForgeBackButton(tint: tint, action: back)
                }
            }
    }
}

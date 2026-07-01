import SwiftUI

// Shared building blocks for the stripped-down tool layout: a result STAGE that's
// always on screen (shows the HOONIE loader gif until a result exists, then the
// result in place) and a one-row COMPOSER (prompt · go). Styling is intentionally
// restrained for now — the visual style isn't locked yet; this is about the UI.

/// The always-present result frame. Shows the HOONIE gif (idle, then animating as
/// it works) until there's a result, then the result fills the frame in place.
struct ToolStage<ResultContent: View>: View {
    var busy: Bool
    var hasResult: Bool
    var aspect: CGFloat = 1
    var loaderText: String? = nil
    @ViewBuilder var result: () -> ResultContent

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            if hasResult && !busy {
                result()
            } else {
                VStack(spacing: 8) {
                    GIFView(name: "loading-anim", ext: "png").frame(width: 150, height: 150)
                    if busy, let t = loaderText {
                        Text(t).font(.caption).foregroundColor(Theme.textDim)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(aspect, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }
}

/// The single generate affordance — one small icon button.
struct GoButton: View {
    var busy: Bool
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "sparkles").font(.system(size: 19, weight: .semibold))
                .frame(width: 50, height: 50)
                .foregroundColor(.white)
                .background(Theme.accent)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .opacity(busy ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .accessibilityLabel("Generate")
    }
}

/// One-row composer: prompt box · go button. (Quality defaults to Low; no control.)
struct Composer: View {
    @Binding var text: String
    var placeholder: String
    var busy: Bool
    var focused: FocusState<Bool>.Binding
    var onGo: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(1...4).font(.body)
                .foregroundColor(Theme.text)
                .tint(Theme.accent)
                .focused(focused)
                .padding(.horizontal, 14).padding(.vertical, 14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
            GoButton(busy: busy, action: onGo)
        }
    }
}

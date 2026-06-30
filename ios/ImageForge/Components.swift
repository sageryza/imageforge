import SwiftUI

// Shared "Deck Factory" building blocks for the stripped-down tool layout:
// a result STAGE that's always on screen (empty placeholder → in-frame loader →
// result), and a one-row COMPOSER (quality chip · prompt · go) that sits below it.

/// The always-present result frame. Shows the tool's empty placeholder until you
/// generate, the HOONIE loader in the same frame while working, then the result.
struct ToolStage<EmptyContent: View, ResultContent: View>: View {
    var busy: Bool
    var hasResult: Bool
    var aspect: CGFloat = 1
    var loaderText: String? = nil
    @ViewBuilder var empty: () -> EmptyContent
    @ViewBuilder var result: () -> ResultContent

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusXL).fill(Color.white)
            if busy {
                VStack(spacing: 8) {
                    GIFView(name: "loading-anim", ext: "png").frame(width: 150, height: 150)
                    if let t = loaderText { Text(t).font(.caption).foregroundColor(Theme.inkSoft) }
                }
            } else if hasResult {
                result()
            } else {
                empty()
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(aspect, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusXL))
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusXL).stroke(Theme.ink, lineWidth: 2.5))
    }
}

/// A faint "what will appear here" hint for an empty stage.
struct EmptyHint: View {
    var systemImage: String = "sparkles"
    var text: String
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage).font(.system(size: 34)).foregroundColor(Theme.ghost)
            Text(text).font(.callout).foregroundColor(Theme.inkSoft)
                .multilineTextAlignment(.center)
        }
        .padding(24)
    }
}

/// Tiny quality toggle — defaults to Low, taps cycle Low → Med → High.
struct QualityChip: View {
    @Binding var quality: String
    private let order = ["low", "medium", "high"]
    var body: some View {
        Button {
            let i = order.firstIndex(of: quality) ?? 0
            quality = order[(i + 1) % order.count]
        } label: {
            VStack(spacing: 1) {
                Image(systemName: "speedometer").font(.system(size: 15, weight: .semibold))
                Text(quality.prefix(1).uppercased()).font(.system(size: 9, weight: .heavy))
            }
            .frame(width: 48, height: 48)
            .foregroundColor(Theme.ink)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.ink, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Quality: \(quality)")
    }
}

/// The single generate affordance — a marigold ✦ button.
struct GoButton: View {
    var busy: Bool
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "sparkles").font(.system(size: 20, weight: .bold))
                .frame(width: 52, height: 52)
                .foregroundColor(Theme.ink)
                .background(busy ? Theme.ghost : Theme.marigold)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.ink, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .accessibilityLabel("Generate")
    }
}

/// One-row composer: quality chip · prompt box · go button.
struct Composer: View {
    @Binding var quality: String
    @Binding var text: String
    var placeholder: String
    var busy: Bool
    var focused: FocusState<Bool>.Binding
    var onGo: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            QualityChip(quality: $quality)
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(1...4).font(.body).foregroundColor(Theme.ink)
                .focused(focused)
                .padding(.horizontal, 14).padding(.vertical, 14)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.ink, lineWidth: 2))
            GoButton(busy: busy, action: onGo)
        }
    }
}

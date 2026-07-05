import SwiftUI

// Shared building blocks for the stripped-down tool layout: a result STAGE that's
// always on screen (shows the HOONIE loader gif until a result exists, then the
// result in place) and a one-row COMPOSER (quality menu · prompt · go).

/// The always-present result frame. Shows the HOONIE gif (idle, then animating as
/// it works) until there's a result, then the result fills the frame in place.
struct ToolStage<ResultContent: View>: View {
    var busy: Bool
    var hasResult: Bool
    var aspect: CGFloat = 1
    var cornerRadius: CGFloat = 8
    var maxHeight: CGFloat? = nil
    var loaderText: String? = nil
    @ViewBuilder var result: () -> ResultContent

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: cornerRadius).fill(Color.white)
            if hasResult && !busy {
                result()
            } else {
                VStack(spacing: 8) {
                    // Idles very slow and calm; eases up to the gentle "working"
                    // pace once generation actually starts.
                    GIFView(name: "loading-anim", ext: "png", speed: busy ? 0.35 : 0.15)
                        .frame(width: 140, height: 140)
                    if busy, let t = loaderText {
                        Text(t).font(.caption).foregroundColor(Theme.textDim)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(aspect, contentMode: .fit)
        .frame(maxHeight: maxHeight)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .overlay(RoundedRectangle(cornerRadius: cornerRadius).stroke(Theme.border, lineWidth: 1))
        .frame(maxWidth: .infinity)
    }
}

/// Quality picker as a small dropdown menu button (Low / Medium / High).
struct QualityMenu: View {
    @Binding var quality: String
    static func shortLabel(_ q: String) -> String {
        switch q { case "medium": return "Med"; case "high": return "High"; default: return "Low" }
    }
    var body: some View {
        Menu {
            Button("Low") { quality = "low" }
            Button("Medium") { quality = "medium" }
            Button("High") { quality = "high" }
        } label: {
            HStack(spacing: 3) {
                // Short, equal-ish labels so the button never changes width.
                Text(Self.shortLabel(quality)).font(.caption.weight(.semibold))
                    .frame(width: 32, alignment: .leading)
                Image(systemName: "chevron.down").font(.system(size: 8, weight: .bold))
            }
            .foregroundColor(Theme.text)
            .frame(height: 50).padding(.horizontal, 11)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
        }
    }
}

/// The single generate affordance — a mauve-pink button with the three-star icon.
struct GoButton: View {
    var busy: Bool
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "sparkles").font(.system(size: 19, weight: .semibold))
                .frame(width: 50, height: 50)
                .foregroundColor(.white)
                .background(Theme.mauve)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .opacity(busy ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .accessibilityLabel("Generate")
    }
}

/// A decorated tool title: the name centered in EB Garamond small-caps with a
/// star on each side. Equal spacers put every star exactly halfway between the
/// screen edge and the word — the house placement for stars, everywhere.
struct StarTitle: View {
    var text: String
    var body: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            Image(systemName: "sparkles").font(.system(size: 15)).foregroundColor(Theme.mauve)
            Spacer(minLength: 0)
            Text(text)
                .font(Theme.serif(24).smallCaps())
                .tracking(1.5)
                .foregroundColor(Theme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .layoutPriority(1)
            Spacer(minLength: 0)
            Image(systemName: "sparkles").font(.system(size: 15)).foregroundColor(Theme.mauve)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Pick a future time (and Feed vs Story) to schedule a post.
struct ScheduleSheet: View {
    var allowStoryChoice: Bool = false
    var onSchedule: (Date, Bool) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var when = Date().addingTimeInterval(3600)
    @State private var asStory = false

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("When", selection: $when, in: Date()...)
                    .datePickerStyle(.graphical)
                if allowStoryChoice {
                    Picker("Post as", selection: $asStory) {
                        Text("Feed post").tag(false)
                        Text("Story").tag(true)
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Schedule").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Schedule") { onSchedule(when, asStory); dismiss() }
                }
            }
        }
        .tint(Theme.accent)
    }
}

/// One-row composer: quality menu · prompt box · go button.
struct Composer: View {
    @Binding var quality: String
    @Binding var text: String
    var placeholder: String
    var busy: Bool
    var focused: FocusState<Bool>.Binding
    var onGo: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            QualityMenu(quality: $quality)
            TextField(placeholder, text: $text)
                .font(.body)
                .foregroundColor(Theme.text)
                .tint(Theme.accent)
                .focused(focused)
                .submitLabel(.go)
                .onSubmit(onGo)
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
            GoButton(busy: busy, action: onGo)
        }
    }
}

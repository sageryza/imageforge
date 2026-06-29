import SwiftUI

/// Sticker Page — describe a set of stickers and get one full-page sheet of
/// free-form kiss-cut stickers. The house sticker style (reference images +
/// palette) is baked into the `forgeStickerSheet` Cloud Function, so the screen
/// only collects a prompt and a quality. Generation goes through gpt-image-2, so
/// it sits behind the same one-time AI-consent gate as the Test Station.
struct StickerView: View {
    @State private var prompt = ""
    @State private var quality = "medium"
    @State private var busy = false
    @State private var sheetURL: URL?
    @State private var errorText: String?

    // App Store Guideline 5.1.2(i): one-time consent before sending anything to
    // third-party AI. Shared key with the Test Station.
    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false

    private let qualities = ["low", "medium", "high"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    promptField
                    qualityPicker
                    generateButton
                    if busy { loadingCard }
                    if let url = sheetURL, !busy { resultCard(url) }
                }
                .padding()
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Sticker Page")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Couldn't generate",
                   isPresented: Binding(get: { errorText != nil },
                                        set: { if !$0 { errorText = nil } })) {
                Button("OK", role: .cancel) { errorText = nil }
            } message: {
                Text(errorText ?? "")
            }
            .sheet(isPresented: $showConsent) {
                AIConsentSheet(
                    theme: .deckFactory,
                    appName: "Deck Factory",
                    providers: [
                        AIProvider(name: "OpenAI", role: "Generates your sticker sheet (ChatGPT / gpt-image-2)"),
                    ],
                    dataDescription: "the prompt you enter",
                    privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                    onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                    onCancel: { showConsent = false })
            }
        }
        .tint(Theme.accent)
    }

    // MARK: - Sections

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT STICKERS?")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            TextField("a cozy autumn set — a steaming mug, a maple leaf, a little fox, a stack of books…",
                      text: $prompt, axis: .vertical)
                .lineLimit(2...5)
                .font(.body)
                .foregroundColor(Theme.text)
                .padding(12)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
        }
    }

    private var qualityPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("QUALITY")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            HStack(spacing: 8) {
                ForEach(qualities, id: \.self) { q in
                    Button { quality = q } label: {
                        Text(q.capitalized)
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(quality == q ? Theme.surface2 : Color.clear)
                            .foregroundColor(quality == q ? Theme.text : Theme.textDim)
                            .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                                .stroke(quality == q ? Theme.accentDim : Theme.border, lineWidth: 1))
                            .cornerRadius(Theme.radius)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var generateButton: some View {
        Button { run() } label: {
            Text(busy ? "Generating…" : "Generate Sticker Sheet")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Theme.accent)
                .foregroundColor(.white)
                .cornerRadius(Theme.radius)
        }
        .disabled(busy)
        .opacity(busy ? 0.6 : 1)
    }

    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Theme.surface2)
            VStack(spacing: 10) {
                ProgressView()
                Text("rendering your sticker sheet…")
                    .font(.caption).foregroundColor(Theme.textDim)
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(2.0 / 3.0, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func resultCard(_ url: URL) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("YOUR SHEET")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFit()
                        .background(Color.white)
                        .cornerRadius(Theme.radius)
                case .failure:
                    Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                default:
                    ProgressView()
                }
            }
            .frame(maxWidth: .infinity)
            ShareLink(item: url) {
                Label("Share / Save", systemImage: "square.and.arrow.up")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(Theme.accent)
            }
        }
        .padding(14)
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Actions

    private func run() {
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Describe the stickers you want first."; return }
        guard !busy else { return }
        // Gate the first AI call behind the consent sheet (5.1.2(i)).
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        sheetURL = nil
        Task {
            do {
                let url = try await ForgeService.shared.generateStickerSheet(prompt: text, quality: quality)
                sheetURL = url
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }
}

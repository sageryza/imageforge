import SwiftUI

/// Coloring Pages — describe a scene, get a printable black-and-white line-art
/// page to color. Single image, no editor. Behind the shared AI-consent gate.
struct ColoringView: View {
    @State private var prompt = ""
    @State private var quality = "medium"
    @State private var busy = false
    @State private var pageURL: URL?
    @State private var errorText: String?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @FocusState private var promptFocused: Bool

    private let qualities = ["low", "medium", "high"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if busy { loadingCard }
                if let url = pageURL, !busy { resultCard(url) }
                promptField
                qualityPicker
                generateButton
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { promptFocused = false }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Coloring Pages")
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
                    AIProvider(name: "OpenAI", role: "Generates your coloring page (ChatGPT / gpt-image-2)"),
                ],
                dataDescription: "the prompt you enter",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                onCancel: { showConsent = false })
        }
    }

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT SCENE?")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            TextField("a friendly dragon reading in a cozy garden…",
                      text: $prompt, axis: .vertical)
                .lineLimit(2...5)
                .font(.body)
                .foregroundColor(Theme.text)
                .focused($promptFocused)
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
            Text(busy ? "Generating…" : "Generate Coloring Page")
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
                GIFView(name: "loading-anim", ext: "png").frame(width: 120, height: 120)
                Text("drawing your coloring page…")
                    .font(.caption).foregroundColor(Theme.textDim)
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(2.0 / 3.0, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func resultCard(_ url: URL) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("YOUR PAGE")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFit().background(Color.white).cornerRadius(Theme.radius)
                case .failure:
                    Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                default:
                    ProgressView()
                }
            }
            .frame(maxWidth: .infinity)
            ShareLink(item: url) {
                Label("Share / Save", systemImage: "square.and.arrow.up")
                    .font(.subheadline.weight(.medium)).foregroundColor(Theme.accent)
            }
        }
        .padding(14)
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func run() {
        promptFocused = false
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Describe the scene you want first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        pageURL = nil
        Task {
            do {
                pageURL = try await ForgeService.shared.generateColoringPage(prompt: text, quality: quality)
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }
}

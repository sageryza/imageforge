import SwiftUI

/// Greeting Cards — describe the card and type the greeting; get a card-front
/// illustration with the greeting set as a headline along the bottom. Single
/// image, share from the ⋯ menu. Behind the shared AI-consent gate.
struct GreetingCardsView: View {
    @State private var prompt = ""
    @State private var message = ""
    @State private var quality = "medium"
    @State private var busy = false
    @State private var cardURL: URL?
    @State private var errorText: String?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @FocusState private var messageFocused: Bool
    @FocusState private var promptFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ToolStage(busy: busy, hasResult: cardURL != nil, aspect: 2.0 / 3.0,
                          maxHeight: 430,
                          loaderText: "making your card — this takes a minute.\nyou can leave; it'll be waiting in your gallery.") {
                    cardResult
                }
                messageField
                Composer(quality: $quality, text: $prompt, placeholder: "…",
                         busy: busy, focused: $promptFocused, onGo: run)
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { messageFocused = false; promptFocused = false }
            }
            if let url = cardURL, !busy {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        ShareLink(item: url) { Label("Share / Save", systemImage: "square.and.arrow.up") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        // The standard tool header: eyebrow title in the bar, back chevron
        // top-left (previous screen).
        .forgeToolBar("Greeting Cards")
        .alert("Couldn't generate",
               isPresented: Binding(get: { errorText != nil },
                                    set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [AIProvider(name: "OpenAI", role: "Generates your card (ChatGPT / gpt-image-2)")],
                dataDescription: "the greeting and description you enter",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                onCancel: { showConsent = false })
        }
    }

    // Optional greeting headline set along the bottom of the card.
    private var messageField: some View {
        TextField("greeting (optional) — e.g. Happy Birthday!", text: $message, axis: .vertical)
            .lineLimit(1...3).font(.body).foregroundColor(Theme.text)
            .tint(Theme.accent)
            .focused($messageFocused)
            .padding(.horizontal, 14).frame(minHeight: 50)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
    }

    @ViewBuilder private var cardResult: some View {
        if let url = cardURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image): image.resizable().scaledToFill()
                case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                default: ProgressView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func run() {
        messageFocused = false; promptFocused = false
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Describe what's on the card first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        cardURL = nil
        let msg = message.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                cardURL = try await ForgeService.shared.generateGreetingCard(
                    prompt: text, message: msg, quality: quality)
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }
}

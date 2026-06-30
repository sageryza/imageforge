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
    @FocusState private var focusedField: Field?
    private enum Field { case message, prompt }

    private let qualities = ["low", "medium", "high"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if busy { loadingCard }
                if let url = cardURL, !busy { resultCard(url) }
                messageField
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
                Button("Done") { focusedField = nil }
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
        .navigationTitle("Greeting Cards")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Couldn't generate",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
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

    private var messageField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("GREETING (OPTIONAL)")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            TextField("Happy Birthday!", text: $message, axis: .vertical)
                .lineLimit(1...3).font(.body).foregroundColor(Theme.text)
                .focused($focusedField, equals: .message)
                .padding(12).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
        }
    }

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT'S ON THE CARD?")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            TextField("a witchy black cat with balloons and crystals…", text: $prompt, axis: .vertical)
                .lineLimit(2...5).font(.body).foregroundColor(Theme.text)
                .focused($focusedField, equals: .prompt)
                .padding(12).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
        }
    }

    private var qualityPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("QUALITY")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            HStack(spacing: 8) {
                ForEach(qualities, id: \.self) { q in
                    Button { quality = q } label: {
                        Text(q.capitalized)
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity).padding(.vertical, 9)
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
            Text(busy ? "Making your card…" : "Make Card")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(Theme.accent).foregroundColor(.white).cornerRadius(Theme.radius)
        }
        .disabled(busy).opacity(busy ? 0.6 : 1)
    }

    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            GIFView(name: "loading-anim", ext: "png").frame(width: 150, height: 150)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(2.0 / 3.0, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func resultCard(_ url: URL) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image): image.resizable().scaledToFit().background(Color.white)
            case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
            default: ProgressView()
            }
        }
        .frame(maxWidth: .infinity)
        .background(Color.white)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func run() {
        focusedField = nil
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

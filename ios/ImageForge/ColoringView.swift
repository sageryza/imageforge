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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                StarTitle(text: "Coloring Pages").frame(maxWidth: .infinity).padding(.top, 4)
                ToolStage(busy: busy, hasResult: pageURL != nil, aspect: 2.0 / 3.0,
                          maxHeight: 430,
                          loaderText: "drawing your page — this takes a minute.\nyou can leave; it'll be waiting in your gallery.") {
                    pageResult
                }
                Composer(quality: $quality, text: $prompt, placeholder: "…",
                         busy: busy, focused: $promptFocused, onGo: run)
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { promptFocused = false }
            }
            if let url = pageURL, !busy {
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
        .navigationTitle("")
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

    // The page filling the stage.
    @ViewBuilder private var pageResult: some View {
        if let url = pageURL {
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

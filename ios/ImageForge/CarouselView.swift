import SwiftUI
import UIKit

/// Carousel — an educational multi-slide Instagram post (the highest-engagement
/// format). Give it a topic; the backend plans a cover + 4 slides, renders each
/// in your aesthetic with the text baked on, and you post the whole set as one
/// Instagram carousel.
struct CarouselView: View {
    @State private var topic = ""
    @State private var busy = false
    @State private var slides: [URL] = []
    @State private var title = ""
    @State private var draftCaption = ""
    @State private var draftHashtags: [String] = []
    @State private var current = 0
    @State private var posting = false
    @State private var errorText: String?
    @State private var resultText: String?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @AppStorage("ig.aesthetic.v1") private var aesthetic = "dark"
    @State private var showConsent = false
    @FocusState private var focused: Bool

    private let aesthetics: [(id: String, label: String)] = [
        ("dark", "Dark"), ("celestial", "Celestial"), ("earthy", "Earthy"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                topicField
                presetPicker
                generateButton
                if busy { loadingCard }
                if !slides.isEmpty && !busy { resultSection }
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { focused = false } }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Carousel")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Couldn't make the carousel",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .alert("Instagram", isPresented: Binding(get: { resultText != nil }, set: { if !$0 { resultText = nil } })) {
            Button("OK", role: .cancel) { resultText = nil }
        } message: { Text(resultText ?? "") }
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [AIProvider(name: "OpenAI", role: "Plans & illustrates your carousel (ChatGPT / gpt-image-2)")],
                dataDescription: "the topic you enter",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                onCancel: { showConsent = false })
        }
    }

    // MARK: - Form

    private var topicField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CAROUSEL TOPIC")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            TextField("e.g. 5 crystals for protection", text: $topic, axis: .vertical)
                .lineLimit(1...3).font(.body).foregroundColor(Theme.text)
                .focused($focused)
                .padding(12).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
            Text("Best as a short list or how-to — the tool writes the slides.")
                .font(.caption2).foregroundColor(Theme.textDim)
        }
    }

    private var presetPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("AESTHETIC")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            HStack(spacing: 8) {
                ForEach(aesthetics, id: \.id) { a in
                    Button { aesthetic = a.id } label: {
                        Text(a.label)
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity).padding(.vertical, 9)
                            .background(aesthetic == a.id ? Theme.surface2 : Color.clear)
                            .foregroundColor(aesthetic == a.id ? Theme.text : Theme.textDim)
                            .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                                .stroke(aesthetic == a.id ? Theme.accentDim : Theme.border, lineWidth: 1))
                            .cornerRadius(Theme.radius)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var generateButton: some View {
        Button { run() } label: {
            Text(busy ? "Building your carousel…" : "Generate Carousel")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(Theme.accent).foregroundColor(.white).cornerRadius(Theme.radius)
        }
        .disabled(busy).opacity(busy ? 0.6 : 1)
    }

    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            VStack(spacing: 10) {
                GIFView(name: "loading-anim", ext: "png").frame(width: 130, height: 130)
                Text("Writing slides & illustrating…").font(.caption).foregroundColor(Theme.textDim)
            }
        }
        .frame(maxWidth: .infinity).aspectRatio(4.0 / 5.0, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Result

    private var resultSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            TabView(selection: $current) {
                ForEach(Array(slides.enumerated()), id: \.element) { idx, url in
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFit()
                        default: ProgressView()
                        }
                    }
                    .tag(idx)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .frame(maxWidth: .infinity).aspectRatio(4.0 / 5.0, contentMode: .fit)
            .background(Color.white).cornerRadius(Theme.radiusLg)
            .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))

            Text("Slide \(min(current + 1, slides.count)) of \(slides.count) — swipe to preview")
                .font(.caption).foregroundColor(Theme.textDim)

            Text("CAPTION")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            TextField("Caption…", text: $draftCaption, axis: .vertical)
                .lineLimit(2...6).font(.callout).foregroundColor(Theme.text)
                .padding(10).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
            if !draftHashtags.isEmpty {
                Text(draftHashtags.map { "#\($0)" }.joined(separator: " "))
                    .font(.caption).foregroundColor(Theme.textDim)
            }

            Button { post() } label: {
                HStack {
                    if posting { ProgressView().tint(.white) }
                    Text(posting ? "Posting…" : "Post Carousel")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(Theme.accent).foregroundColor(.white).cornerRadius(Theme.radius)
            }
            .disabled(posting)
            Button {
                UIPasteboard.general.string = composedCaption()
            } label: {
                Label("Copy caption + tags", systemImage: "doc.on.doc")
                    .font(.caption.weight(.medium)).foregroundColor(Theme.accent)
            }
        }
    }

    // MARK: - Actions

    private func composedCaption() -> String {
        let base = draftCaption.trimmingCharacters(in: .whitespacesAndNewlines)
        let tags = draftHashtags.isEmpty ? "" : draftHashtags.map { "#\($0)" }.joined(separator: " ")
        return [base, tags].filter { !$0.isEmpty }.joined(separator: "\n\n")
    }

    private func run() {
        focused = false
        let t = topic.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { errorText = "Give the carousel a topic first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        slides = []
        Task {
            do {
                let r = try await ForgeService.shared.generateCarousel(topic: t, aesthetic: aesthetic, quality: "low")
                slides = r.slides
                title = r.title
                draftCaption = r.caption
                draftHashtags = r.hashtags
                current = 0
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }

    private func post() {
        guard !posting, slides.count >= 2 else { return }
        posting = true
        let cap = composedCaption()
        Task {
            do {
                try await ForgeService.shared.postCarousel(imageUrls: slides, caption: cap)
                resultText = "Carousel posted to your feed! 🎉"
            } catch {
                resultText = error.localizedDescription
            }
            posting = false
        }
    }
}

import SwiftUI
import AVKit
import UIKit

/// Reel — turn a prompt into a short cinematic vertical clip (a generated still
/// with a slow Ken-Burns zoom) and post it as an Instagram Reel. Reels drive
/// reach (most views come from non-followers).
struct ReelView: View {
    @State private var prompt = ""
    @State private var busy = false
    @State private var videoURL: URL?
    @State private var draftCaption = ""
    @State private var draftHashtags: [String] = []
    @State private var captionBusy = false
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
                promptField
                presetPicker
                generateButton
                if busy { loadingCard }
                if let url = videoURL, !busy { resultSection(url) }
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { focused = false } } }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Reel").navigationBarTitleDisplayMode(.inline)
        .alert("Couldn't make the reel",
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
                providers: [AIProvider(name: "OpenAI", role: "Illustrates your reel (ChatGPT / gpt-image-2)")],
                dataDescription: "the prompt you enter",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                onCancel: { showConsent = false })
        }
    }

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT'S THE REEL?")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            TextField("…", text: $prompt, axis: .vertical)
                .lineLimit(2...5).font(.body).foregroundColor(Theme.text)
                .focused($focused)
                .padding(12).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
            Text("Makes a 6-second vertical clip with a slow cinematic zoom.")
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
            Text(busy ? "Filming your reel…" : "Generate Reel")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(Theme.mauve).foregroundColor(.white).cornerRadius(Theme.radius)
        }
        .disabled(busy).opacity(busy ? 0.6 : 1)
    }

    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            VStack(spacing: 10) {
                GIFView(name: "loading-anim", ext: "png", speed: 0.35).frame(width: 130, height: 130)
                Text("Illustrating & filming…").font(.caption).foregroundColor(Theme.textDim)
            }
        }
        .frame(maxWidth: .infinity).aspectRatio(9.0 / 16.0, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func resultSection(_ url: URL) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            LoopingVideoView(url: url)
                .frame(maxWidth: .infinity).aspectRatio(9.0 / 16.0, contentMode: .fit)
                .background(Color.black).cornerRadius(Theme.radiusLg)
                .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))

            HStack {
                Text("CAPTION")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                Spacer()
                Button { suggestCaption() } label: {
                    HStack(spacing: 4) {
                        if captionBusy { ProgressView().scaleEffect(0.7) } else { Image(systemName: "sparkles") }
                        Text(captionBusy ? "Writing…" : "Suggest")
                    }
                    .font(.caption.weight(.semibold)).foregroundColor(Theme.accent)
                }
                .disabled(captionBusy)
            }
            TextField("Caption…", text: $draftCaption, axis: .vertical)
                .lineLimit(2...6).font(.callout).foregroundColor(Theme.text)
                .padding(10).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
            if !draftHashtags.isEmpty {
                Text(draftHashtags.map { "#\($0)" }.joined(separator: " "))
                    .font(.caption).foregroundColor(Theme.textDim)
            }

            Button { post(url) } label: {
                HStack {
                    if posting { ProgressView().tint(.white) }
                    Text(posting ? "Posting…" : "Post Reel")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(Theme.accent).foregroundColor(.white).cornerRadius(Theme.radius)
            }
            .disabled(posting)
            ShareLink(item: url) {
                Label("Share / Save", systemImage: "square.and.arrow.up")
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
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Describe the reel first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        videoURL = nil
        draftCaption = ""; draftHashtags = []
        Task {
            do {
                let r = try await ForgeService.shared.generateReel(prompt: text, aesthetic: aesthetic, quality: "low")
                videoURL = r.video
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }

    private func suggestCaption() {
        guard !captionBusy else { return }
        captionBusy = true
        let subject = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                let r = try await ForgeService.shared.generateCaption(subject: subject.isEmpty ? "a witchy reel" : subject)
                draftCaption = r.caption
                draftHashtags = r.hashtags
            } catch {
                resultText = error.localizedDescription
            }
            captionBusy = false
        }
    }

    private func post(_ url: URL) {
        guard !posting else { return }
        posting = true
        let cap = composedCaption()
        Task {
            do {
                try await ForgeService.shared.postReel(videoUrl: url, caption: cap)
                resultText = "Reel posted to your feed! 🎉"
            } catch {
                resultText = error.localizedDescription
            }
            posting = false
        }
    }
}

/// A muted, auto-looping video preview.
struct LoopingVideoView: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                let p = AVPlayer(url: url)
                p.isMuted = true
                player = p
                p.play()
                NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime, object: p.currentItem, queue: .main
                ) { _ in p.seek(to: .zero); p.play() }
            }
            .onDisappear { player?.pause() }
    }
}

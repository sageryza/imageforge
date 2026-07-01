import SwiftUI

/// Storybook — build a picture book one page at a time. Each page is a prompted
/// illustration with a caption set along the bottom (like a real children's
/// book). Pages collect into a flip-through book you can swipe through.
struct StorybookView: View {
    @State private var caption = ""
    @State private var scene = ""
    @State private var quality = "medium"
    @State private var busy = false
    @State private var pages: [Creation] = []
    @State private var loading = true
    @State private var current = 0
    @State private var errorText: String?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @FocusState private var focusedField: Field?
    private enum Field { case caption, scene }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                StarTitle(text: "Storybook").frame(maxWidth: .infinity).padding(.top, 4)
                if busy { loadingCard }
                bookSection
                Divider().background(Theme.border)
                composeSection
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedField = nil }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadPages() }
        .alert("Couldn't make the page",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [AIProvider(name: "OpenAI", role: "Illustrates each page (ChatGPT / gpt-image-2)")],
                dataDescription: "the caption and scene you write",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                onCancel: { showConsent = false })
        }
    }

    // MARK: - Book

    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            GIFView(name: "loading-anim", ext: "png", speed: 0.35).frame(width: 150, height: 150)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(2.0 / 3.0, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    @ViewBuilder private var bookSection: some View {
        if loading && pages.isEmpty {
            ProgressView().frame(maxWidth: .infinity).padding(.top, 20)
        } else if pages.isEmpty {
            emptyHint
        } else {
            VStack(spacing: 10) {
                PageCurlBook(count: pages.count, index: $current) { idx in
                    spread(pages[idx])
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(1.5, contentMode: .fit)   // landscape: an open book
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
                .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.12), radius: 8, y: 4)

                HStack(spacing: 14) {
                    Text("Page \(min(current + 1, pages.count)) of \(pages.count) · drag a page edge to turn")
                        .font(.caption).foregroundColor(Theme.textDim)
                    Spacer()
                    if let url = pages[safe: current]?.url {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up").foregroundColor(Theme.accent)
                        }
                    }
                }
            }
        }
    }

    // One open-book spread: the words set on the left page, the illustration on
    // the right — with a soft gutter shadow down the middle so it reads like a
    // real open picture book.
    private func spread(_ page: Creation) -> some View {
        HStack(spacing: 0) {
            // LEFT — the words, on warm paper.
            ZStack {
                Color(hex: 0xFBF8F1)
                if let cap = page.prompt, !cap.isEmpty {
                    Text(cap)
                        .font(Theme.serif(16))
                        .foregroundColor(Theme.text)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.6)
                        .padding(18)
                } else {
                    Text("·").font(Theme.serif(20)).foregroundColor(Theme.textDim)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(gutter(trailing: true), alignment: .trailing)

            // RIGHT — the picture, on white paper.
            ZStack {
                Color.white
                AsyncImage(url: page.url) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFit().padding(8)
                    case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                    default: ProgressView()
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(gutter(trailing: false), alignment: .leading)
        }
        .background(Color.white)
    }

    // Soft shadow along the spine side of a page.
    private func gutter(trailing: Bool) -> some View {
        LinearGradient(
            colors: trailing ? [.clear, .black.opacity(0.12)] : [.black.opacity(0.12), .clear],
            startPoint: .leading, endPoint: .trailing)
            .frame(width: 16)
    }

    // Empty state: a blank open book inviting the first page.
    private var emptyHint: some View {
        HStack(spacing: 0) {
            ZStack {
                Color(hex: 0xFBF8F1)
                VStack(spacing: 8) {
                    Image(systemName: "book").font(.system(size: 30)).foregroundColor(Theme.accentDim)
                    Text("Your book\nstarts here")
                        .font(Theme.serif(19)).foregroundColor(Theme.text)
                        .multilineTextAlignment(.center)
                }
                .padding(14)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(gutter(trailing: true), alignment: .trailing)

            ZStack {
                Color.white
                Text("write a page below\nto begin →")
                    .font(.caption).foregroundColor(Theme.textDim)
                    .multilineTextAlignment(.center).padding(14)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(gutter(trailing: false), alignment: .leading)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(1.5, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
    }

    // MARK: - Compose

    private var composeSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("ADD A PAGE")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)

            VStack(alignment: .leading, spacing: 6) {
                Text("WORDS ON THIS PAGE")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                TextField("Once upon a time, in a forest of glass…", text: $caption, axis: .vertical)
                    .lineLimit(1...4).font(.body).foregroundColor(Theme.text)
                    .focused($focusedField, equals: .caption)
                    .padding(12).background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                    .cornerRadius(Theme.radius)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("PICTURE FOR THIS PAGE")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                TextField("a small fox looking up at the glass trees", text: $scene, axis: .vertical)
                    .lineLimit(2...5).font(.body).foregroundColor(Theme.text)
                    .focused($focusedField, equals: .scene)
                    .padding(12).background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                    .cornerRadius(Theme.radius)
            }

            HStack(spacing: 8) {
                QualityMenu(quality: $quality)
                Spacer()
            }

            Button { run() } label: {
                Text(busy ? "Drawing the page…" : "Add Page")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(Theme.mauve).foregroundColor(.white).cornerRadius(Theme.radius)
            }
            .disabled(busy).opacity(busy ? 0.6 : 1)
        }
    }

    // MARK: - Actions

    private func run() {
        focusedField = nil
        let scn = scene.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !scn.isEmpty else { errorText = "Describe the picture for this page first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        let cap = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                let url = try await ForgeService.shared.generateStorybookPage(
                    prompt: scn, caption: cap, quality: quality)
                pages.append(Creation(id: UUID().uuidString, type: "storybook", url: url, prompt: cap))
                current = pages.count - 1
                caption = ""; scene = ""
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }

    private func loadPages() async {
        loading = true
        if let all = try? await ForgeService.shared.fetchCreations(limit: 90) {
            // Creations come newest-first; a book reads oldest-first.
            pages = all.filter { $0.type == "storybook" }.reversed()
            current = max(0, pages.count - 1)
        }
        loading = false
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

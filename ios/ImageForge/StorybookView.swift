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
    // House style for the pages (Watercolor Drawings by default) + book shape.
    @AppStorage("deckfactory.storybook.style") private var styleId = "wtr"
    @AppStorage("deckfactory.storybook.aspect") private var aspect = "portrait"

    /// One page's width/height ratio; a spread is two pages side by side.
    private var pageAspect: CGFloat {
        switch aspect { case "square": return 1; case "landscape": return 1.5; default: return 2.0 / 3.0 }
    }
    private var spreadAspect: CGFloat { pageAspect * 2 }

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
            // Book shape, top right: square / portrait / landscape.
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button { aspect = "portrait" } label: { menuRow("Portrait", on: aspect == "portrait") }
                    Button { aspect = "square" } label: { menuRow("Square", on: aspect == "square") }
                    Button { aspect = "landscape" } label: { menuRow("Landscape", on: aspect == "landscape") }
                } label: {
                    Image(systemName: "aspectratio").foregroundColor(Theme.textDim)
                }
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

    @ViewBuilder private func menuRow(_ title: String, on: Bool) -> some View {
        if on { Label(title, systemImage: "checkmark") } else { Text(title) }
    }

    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            GIFView(name: "loading-anim", ext: "png", speed: 0.35).frame(width: 150, height: 150)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(pageAspect, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    @ViewBuilder private var bookSection: some View {
        if loading && pages.isEmpty {
            ProgressView().frame(maxWidth: .infinity).padding(.top, 20)
        } else if pages.isEmpty {
            emptyHint
        } else {
            VStack(spacing: 10) {
                PageCurlBook(count: spreadCount, index: $current) { i in
                    spread(i)
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(spreadAspect, contentMode: .fit)   // an open book, two pages wide
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
                .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.12), radius: 8, y: 4)

                HStack(spacing: 14) {
                    Text("\(pageRangeLabel) · drag a page edge to turn")
                        .font(.caption).foregroundColor(Theme.textDim)
                    Spacer()
                    if let url = pages[safe: current * 2]?.url {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up").foregroundColor(Theme.accent)
                        }
                    }
                }
            }
        }
    }

    // Two facing pages per spread; a spread turns two pages at a time.
    private var spreadCount: Int { max(1, (pages.count + 1) / 2) }

    private var pageRangeLabel: String {
        let lo = current * 2 + 1
        let hi = min(current * 2 + 2, pages.count)
        let range = lo == hi ? "Page \(lo)" : "Pages \(lo)–\(hi)"
        return "\(range) of \(pages.count)"
    }

    private func pageAt(_ idx: Int) -> Creation? {
        (idx >= 0 && idx < pages.count) ? pages[idx] : nil
    }

    // One open-book spread: two facing pages, each a picture with its words set
    // along the bottom — a soft gutter shadow down the spine between them.
    private func spread(_ i: Int) -> some View {
        HStack(spacing: 0) {
            leaf(pageAt(i * 2))
                .overlay(gutter(trailing: true), alignment: .trailing)
            leaf(pageAt(i * 2 + 1))
                .overlay(gutter(trailing: false), alignment: .leading)
        }
        .background(Color.white)
    }

    // One page: the illustration filling the page, its words tucked underneath.
    private func leaf(_ page: Creation?) -> some View {
        ZStack {
            Color.white
            if let page {
                VStack(spacing: 6) {
                    AsyncImage(url: page.url) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFit()
                        case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                        default: ProgressView()
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, 10).padding(.horizontal, 10)
                    if let cap = page.prompt, !cap.isEmpty {
                        Text(cap)
                            .font(Theme.serif(12))
                            .foregroundColor(Theme.text)
                            .multilineTextAlignment(.center)
                            .lineLimit(3).minimumScaleFactor(0.6)
                            .padding(.horizontal, 10).padding(.bottom, 12)
                    } else {
                        Spacer().frame(height: 12)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // Soft shadow along the spine side of a page.
    private func gutter(trailing: Bool) -> some View {
        LinearGradient(
            colors: trailing ? [.clear, .black.opacity(0.12)] : [.black.opacity(0.12), .clear],
            startPoint: .leading, endPoint: .trailing)
            .frame(width: 16)
    }

    // Empty state: a blank open book — no words, just the little hoonie
    // keeping the first page warm.
    private var emptyHint: some View {
        HStack(spacing: 0) {
            ZStack {
                Color(hex: 0xFBF8F1)
                GIFView(name: "loading-anim", ext: "png", speed: 0.15)
                    .frame(width: 110, height: 110)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(gutter(trailing: true), alignment: .trailing)

            ZStack {
                Color.white
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(gutter(trailing: false), alignment: .leading)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(spreadAspect, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
    }

    // MARK: - Compose

    private var composeSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("WORDS ON THIS PAGE")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                TextField("…", text: $caption, axis: .vertical)
                    .lineLimit(1...4).font(.body).foregroundColor(Theme.text)
                    .focused($focusedField, equals: .caption)
                    .padding(12).background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                    .cornerRadius(Theme.radius)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("PICTURE FOR THIS PAGE")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                TextField("…", text: $scene, axis: .vertical)
                    .lineLimit(2...5).font(.body).foregroundColor(Theme.text)
                    .focused($focusedField, equals: .scene)
                    .padding(12).background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                    .cornerRadius(Theme.radius)
            }

            // One row: quality · Add Page · style.
            HStack(spacing: 8) {
                QualityMenu(quality: $quality)
                Button { run() } label: {
                    Text(busy ? "Drawing…" : "Add Page")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity).frame(height: 50)
                        .background(Theme.mauve).foregroundColor(.white).cornerRadius(Theme.radius)
                }
                .disabled(busy).opacity(busy ? 0.6 : 1)
                styleMenu
            }
        }
    }

    /// House-style picker for the pages (Watercolor Drawings by default).
    private var styleMenu: some View {
        Menu {
            ForEach(ForgeStyles.all) { style in
                Button { styleId = style.id } label: {
                    menuRow(style.name, on: styleId == style.id)
                }
            }
        } label: {
            HStack(spacing: 3) {
                Image(systemName: "paintpalette").font(.system(size: 14))
                Image(systemName: "chevron.down").font(.system(size: 8, weight: .bold))
            }
            .foregroundColor(Theme.text)
            .frame(height: 50).padding(.horizontal, 11)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
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
                    prompt: scn, caption: cap, quality: quality, style: styleId, aspect: aspect)
                pages.append(Creation(id: UUID().uuidString, type: "storybook", url: url, prompt: cap))
                current = max(0, (pages.count - 1) / 2)   // spread holding the new page
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
            current = max(0, (pages.count - 1) / 2)   // last spread
        }
        loading = false
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

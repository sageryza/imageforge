import SwiftUI
import PhotosUI
import UIKit

/// Instagram — make on-brand square posts: describe the post, optionally attach a
/// product photo (staged into a flat-lay) and/or a caption (composited onto the
/// image for memes). Posts collect into a feed-style grid; share to post for now
/// (auto-posting via the Graph API is a later phase).
struct InstagramView: View {
    @State private var prompt = ""
    @State private var caption = ""
    @State private var quality = "medium"
    @State private var busy = false
    @State private var posts: [Creation] = []
    @State private var loading = true
    @State private var errorText: String?

    @State private var photoItem: PhotosPickerItem?
    @State private var refImage: UIImage?
    @State private var preview: Creation?
    @State private var posting = false
    @State private var postingStory = false
    @State private var postResult: String?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @AppStorage("ig.aesthetic.v1") private var aesthetic = "dark"
    @State private var showConsent = false
    @State private var planning = false
    // Caption helper (used in the post preview sheet)
    @State private var draftCaption = ""
    @State private var draftHashtags: [String] = []
    @State private var captionBusy = false
    @FocusState private var focusedField: Field?
    private enum Field { case prompt, caption }

    private let qualities = ["low", "medium", "high"]
    private let aesthetics: [(id: String, label: String)] = [
        ("dark", "Dark"), ("celestial", "Celestial"), ("earthy", "Earthy"),
    ]
    private let grid = [GridItem(.flexible(), spacing: 3), GridItem(.flexible(), spacing: 3), GridItem(.flexible(), spacing: 3)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                presetPicker
                promptField
                referencePicker
                captionField
                qualityPicker
                generateButton
                if busy { loadingCard }
                feedSection
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
        .navigationTitle("Instagram")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { planning = true } label: { Image(systemName: "square.grid.3x3") }
                    .disabled(posts.isEmpty)
            }
        }
        .navigationDestination(isPresented: $planning) { FeedPlannerView(posts: posts) }
        .task { await loadPosts() }
        .onChange(of: photoItem) { _ in loadPickedPhoto() }
        .alert("Couldn't generate",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [AIProvider(name: "OpenAI", role: "Generates your post (ChatGPT / gpt-image-2)")],
                dataDescription: "the prompt (and any photo) you add",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                onCancel: { showConsent = false })
        }
        .sheet(item: $preview) { p in previewSheet(p) }
    }

    // MARK: - Form

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT'S THE POST?")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            TextField("a moody flat lay of crystals and tarot cards…", text: $prompt, axis: .vertical)
                .lineLimit(2...5).font(.body).foregroundColor(Theme.text)
                .focused($focusedField, equals: .prompt)
                .padding(12).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
        }
    }

    private var referencePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PRODUCT PHOTO (OPTIONAL)")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            HStack(spacing: 12) {
                if let img = refImage {
                    Image(uiImage: img).resizable().scaledToFill()
                        .frame(width: 64, height: 64).clipped().cornerRadius(Theme.radius)
                        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                    Button("Remove") { refImage = nil; photoItem = nil }
                        .font(.caption).foregroundColor(Theme.danger)
                } else {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        HStack(spacing: 6) {
                            Image(systemName: "photo.badge.plus")
                            Text("Add a product photo")
                        }
                        .font(.subheadline).foregroundColor(Theme.accent)
                        .padding(.vertical, 10).padding(.horizontal, 14)
                        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                    }
                }
            }
        }
    }

    private var captionField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CAPTION ON IMAGE (OPTIONAL)")
                .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
            TextField("e.g. things a witch finds in her purse: all crystals", text: $caption, axis: .vertical)
                .lineLimit(1...3).font(.body).foregroundColor(Theme.text)
                .focused($focusedField, equals: .caption)
                .padding(12).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
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

    private var qualityPicker: some View {
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

    private var generateButton: some View {
        Button { run() } label: {
            Text(busy ? "Generating…" : "Generate Post")
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
        .frame(maxWidth: .infinity).aspectRatio(1, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private var feedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !posts.isEmpty {
                Text("YOUR FEED").font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                LazyVGrid(columns: grid, spacing: 3) {
                    ForEach(posts) { p in
                        Button { preview = p } label: {
                            AsyncImage(url: p.url) { phase in
                                switch phase {
                                case .success(let image): image.resizable().scaledToFill()
                                default: Rectangle().fill(Theme.surface2)
                                }
                            }
                            .aspectRatio(1, contentMode: .fill)
                            .frame(maxWidth: .infinity).clipped()
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else if loading {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 10)
            }
        }
    }

    private func previewSheet(_ p: Creation) -> some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AsyncImage(url: p.url) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFit().cornerRadius(Theme.radius)
                        default: ProgressView().padding(40)
                        }
                    }
                    captionHelper(p)
                    Button { post(p, asStory: false) } label: {
                        HStack {
                            if posting && !postingStory { ProgressView().tint(.white) }
                            Text(posting && !postingStory ? "Posting…" : "Post to Feed")
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(Theme.accent).foregroundColor(.white).cornerRadius(Theme.radius)
                    }
                    .disabled(posting)
                    Button { post(p, asStory: true) } label: {
                        HStack {
                            if postingStory { ProgressView().tint(Theme.accent) }
                            Text(postingStory ? "Posting…" : "Post to Story")
                                .font(.subheadline.weight(.semibold)).foregroundColor(Theme.accent)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.accentDim, lineWidth: 1))
                    }
                    .disabled(posting)
                    Text("A Story disappears after 24 hours.")
                        .font(.caption2).foregroundColor(Theme.textDim)
                    ShareLink(item: p.url) {
                        Label("Share / Save", systemImage: "square.and.arrow.up")
                            .font(.subheadline.weight(.medium)).foregroundColor(Theme.accent)
                    }
                }
                .padding()
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Post").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button("Done") { preview = nil } } }
            .onAppear { draftCaption = ""; draftHashtags = [] }
            .alert("Instagram", isPresented: Binding(get: { postResult != nil }, set: { if !$0 { postResult = nil } })) {
                Button("OK", role: .cancel) { postResult = nil }
            } message: { Text(postResult ?? "") }
        }
        .tint(Theme.accent)
    }

    private func captionHelper(_ p: Creation) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("CAPTION")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                Spacer()
                Button { suggestCaption(p) } label: {
                    HStack(spacing: 4) {
                        if captionBusy { ProgressView().scaleEffect(0.7) } else { Image(systemName: "sparkles") }
                        Text(captionBusy ? "Writing…" : "Suggest")
                    }
                    .font(.caption.weight(.semibold)).foregroundColor(Theme.accent)
                }
                .disabled(captionBusy)
            }
            TextField("Write a caption, or tap Suggest…", text: $draftCaption, axis: .vertical)
                .lineLimit(2...6).font(.callout).foregroundColor(Theme.text)
                .padding(10).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
            if !draftHashtags.isEmpty {
                Text(draftHashtags.map { "#\($0)" }.joined(separator: " "))
                    .font(.caption).foregroundColor(Theme.textDim)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if !draftCaption.isEmpty || !draftHashtags.isEmpty {
                Button {
                    UIPasteboard.general.string = composedCaption(p)
                } label: {
                    Label("Copy caption + tags", systemImage: "doc.on.doc")
                        .font(.caption.weight(.medium)).foregroundColor(Theme.accent)
                }
            }
        }
    }

    /// The caption used when posting: the draft + hashtags, or the subject prompt.
    private func composedCaption(_ p: Creation) -> String {
        let base = draftCaption.trimmingCharacters(in: .whitespacesAndNewlines)
        let tags = draftHashtags.isEmpty ? "" : draftHashtags.map { "#\($0)" }.joined(separator: " ")
        let joined = [base, tags].filter { !$0.isEmpty }.joined(separator: "\n\n")
        return joined.isEmpty ? (p.prompt ?? "") : joined
    }

    private func suggestCaption(_ p: Creation) {
        guard !captionBusy else { return }
        captionBusy = true
        Task {
            do {
                let r = try await ForgeService.shared.generateCaption(subject: p.prompt ?? "a witchy product")
                draftCaption = r.caption
                draftHashtags = r.hashtags
            } catch {
                postResult = error.localizedDescription
            }
            captionBusy = false
        }
    }

    private func post(_ p: Creation, asStory: Bool) {
        guard !posting else { return }
        posting = true
        postingStory = asStory
        let cap = composedCaption(p)
        Task {
            do {
                try await ForgeService.shared.postToInstagram(imageUrl: p.url, caption: cap, asStory: asStory)
                postResult = asStory ? "Posted to your Story! 🎉 (gone in 24h)" : "Posted to your feed! 🎉"
            } catch {
                postResult = error.localizedDescription
            }
            posting = false
            postingStory = false
        }
    }

    // MARK: - Actions

    private func run() {
        focusedField = nil
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Describe the post first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        let refData = refImage?.jpegData(compressionQuality: 0.85)
        let cap = caption
        Task {
            do {
                let url = try await ForgeService.shared.generateIgPost(
                    prompt: text, referenceImage: refData, caption: cap, quality: quality, aesthetic: aesthetic)
                posts.insert(Creation(id: UUID().uuidString, type: "instagram", url: url, prompt: text), at: 0)
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }

    private func loadPosts() async {
        loading = true
        if let all = try? await ForgeService.shared.fetchCreations(limit: 90) {
            posts = all.filter { $0.type == "instagram" }
        }
        loading = false
    }

    private func loadPickedPhoto() {
        guard let item = photoItem else { return }
        Task {
            if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) {
                refImage = downscale(img, maxDim: 1024)
            }
        }
    }

    private func downscale(_ image: UIImage, maxDim: CGFloat) -> UIImage {
        let w = image.size.width, h = image.size.height
        let scale = min(1, maxDim / max(w, h))
        if scale >= 1 { return image }
        let size = CGSize(width: w * scale, height: h * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}

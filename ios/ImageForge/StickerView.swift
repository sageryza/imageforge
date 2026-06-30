import SwiftUI
import UIKit

/// Sticker Page — describe a set of stickers and get one full-page sheet of
/// free-form stickers (house style baked in server-side). After a sheet is
/// generated, "Edit stickers" opens a canvas where each detected sticker is its
/// own tile you can tap to regenerate in place. Generation goes through
/// gpt-image-2, so it sits behind the shared one-time AI-consent gate.
struct StickerView: View {
    @State private var prompt = ""
    @State private var quality = "low"
    @State private var busy = false
    @State private var sheet: StickerSheetResult?
    @State private var errorText: String?

    // Editor
    @State private var loadingEditor = false
    @State private var editorItem: IdentifiedImage?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @FocusState private var promptFocused: Bool

    var body: some View {
        ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ToolStage(busy: busy, hasResult: sheet != nil, aspect: 2.0 / 3.0,
                              loaderText: "conjuring your stickers…") {
                        stickerEmpty
                    } result: {
                        stickerResult
                    }
                    Composer(quality: $quality, text: $prompt, placeholder: "what's on the sheet?",
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
                if let sheet, !busy {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Menu {
                            if !sheet.boxes.isEmpty {
                                Button { openEditor(sheet) } label: { Label("Edit stickers", systemImage: "wand.and.stars") }
                            }
                            ShareLink(item: sheet.url) { Label("Share / Save", systemImage: "square.and.arrow.up") }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
            }
            .background(Theme.cream.ignoresSafeArea())
            .navigationTitle("Stickers")
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
            .fullScreenCover(item: $editorItem) { item in
                if let sheet {
                    StickerEditor(
                        sheetImage: item.image,
                        boxes: sheet.boxes,
                        onClose: { editorItem = nil },
                        onSaved: { url in self.sheet = StickerSheetResult(url: url, boxes: sheet.boxes) })
                }
            }
    }

    // MARK: - Sections

    // Empty stage — ghost tiles hinting where the stickers will land.
    private var stickerEmpty: some View {
        VStack(spacing: 14) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                ForEach(0..<6, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [5]))
                        .foregroundColor(Theme.ghost)
                        .aspectRatio(1, contentMode: .fit)
                }
            }
            .frame(width: 210)
            Text("your stickers appear here").font(.callout).foregroundColor(Theme.inkSoft)
        }
        .padding(20)
    }

    // The generated sheet, filling the stage — tap to open the editor.
    @ViewBuilder private var stickerResult: some View {
        if let sheet {
            AsyncImage(url: sheet.url) { phase in
                switch phase {
                case .success(let image): image.resizable().scaledToFit()
                case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                default: ProgressView()
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { if !sheet.boxes.isEmpty { openEditor(sheet) } }
        }
    }

    // MARK: - Actions

    private func run() {
        promptFocused = false   // dismiss the keyboard
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Describe the stickers you want first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        sheet = nil
        let started = Date()
        Task {
            do {
                sheet = try await ForgeService.shared.generateStickerSheet(prompt: text, quality: quality)
            } catch {
                // The on-screen call may have dropped (e.g. backgrounded) while
                // the server finished. Try to pick up the saved sheet before
                // surfacing an error.
                if let recovered = try? await ForgeService.shared.latestStickerSheet(since: started.addingTimeInterval(-120)) {
                    sheet = recovered
                } else {
                    errorText = "Couldn't reach the server. If you left the app, your sheet may still be finishing — check My Creations."
                }
            }
            busy = false
        }
    }

    /// Download the sheet image, then open the tap-to-redo canvas.
    private func openEditor(_ sheet: StickerSheetResult) {
        guard !loadingEditor else { return }
        loadingEditor = true
        Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: sheet.url)
                if let img = UIImage(data: data) {
                    editorItem = IdentifiedImage(image: img)
                } else {
                    errorText = "Couldn't open the sheet for editing."
                }
            } catch {
                errorText = error.localizedDescription
            }
            loadingEditor = false
        }
    }
}

/// Wraps a UIImage so it can drive `.fullScreenCover(item:)` / `.sheet(item:)`.
struct IdentifiedImage: Identifiable {
    let id = UUID()
    let image: UIImage
}

// MARK: - Editor canvas

/// Full-screen canvas of individual sticker tiles cropped from the sheet. Tap a
/// tile to regenerate just that sticker in place.
private struct StickerEditor: View {
    let sheetImage: UIImage
    let boxes: [StickerBox]
    var onClose: () -> Void
    var onSaved: (URL) -> Void = { _ in }

    @State private var stickers: [CanvasSticker] = []
    @State private var errorText: String?
    @State private var shareItem: IdentifiedImage?
    @State private var redoTargetId: UUID?
    @State private var redoText = ""
    @State private var showRedoAlert = false
    @State private var didEdit = false

    private var aspect: CGFloat {
        guard sheetImage.size.height > 0 else { return 2.0 / 3.0 }
        return sheetImage.size.width / sheetImage.size.height
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Text("Tap any sticker to redo it.")
                .font(.caption).foregroundColor(Theme.textDim)
                .padding(.vertical, 8)
            canvas
            Spacer(minLength: 0)
        }
        .background(Theme.bg.ignoresSafeArea())
        .onAppear(perform: buildStickers)
        .alert("Couldn't redo", isPresented: Binding(get: { errorText != nil },
                                                     set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .sheet(item: $shareItem) { item in
            ActivityView(items: [item.image])
        }
        .alert("Redo this sticker", isPresented: $showRedoAlert) {
            TextField("What should it be? (blank = redraw)", text: $redoText)
            Button("Go") { if let id = redoTargetId { redo(id, replacement: redoText) } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Type what this sticker should become, or leave blank for a fresh version of the same thing.")
        }
    }

    private var header: some View {
        HStack {
            Button("Done") { done() }
                .font(.subheadline.weight(.semibold))
                .foregroundColor(Theme.accent)
            Spacer()
            Text("Edit Stickers").font(.subheadline.weight(.semibold)).foregroundColor(Theme.text)
            Spacer()
            Menu {
                Button { shareItem = IdentifiedImage(image: flatten()) } label: {
                    Label("Share / Save", systemImage: "square.and.arrow.up")
                }
            } label: {
                Image(systemName: "ellipsis.circle").foregroundColor(Theme.accent)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(Theme.surface)
        .overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .bottom)
    }

    private var canvas: some View {
        Color.clear
            .aspectRatio(aspect, contentMode: .fit)
            .overlay {
                GeometryReader { geo in
                    ZStack(alignment: .topLeading) {
                        Color.white
                        ForEach(stickers) { s in
                            tile(s, canvas: geo.size)
                        }
                    }
                }
            }
            .background(Color.white)
            .cornerRadius(Theme.radius)
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
            .padding(12)
    }

    private func tile(_ s: CanvasSticker, canvas: CGSize) -> some View {
        let side = s.sidePct * canvas.width
        return Group {
            if let img = s.image {
                Image(uiImage: img)
                    .resizable()
                    .scaledToFit()
                    .frame(width: side, height: side)
                    .overlay {
                        if s.isLoading {
                            ZStack {
                                Color.white.opacity(0.6)
                                ProgressView()
                            }
                        }
                    }
                    .position(x: s.centerXPct * canvas.width, y: s.centerYPct * canvas.height)
                    .onTapGesture {
                        redoTargetId = s.id
                        redoText = ""
                        showRedoAlert = true
                    }
            }
        }
    }

    // MARK: build / redo

    private func buildStickers() {
        guard sheetImage.cgImage != nil else { return }
        let sheetW = sheetImage.size.width, sheetH = sheetImage.size.height
        stickers = boxes.map { b in
            let cx = b.xPct + b.wPct / 2
            let cy = b.yPct + b.hPct / 2
            // Square side as a fraction of WIDTH (so tiles are square in points).
            let sideW = max(b.wPct, b.hPct * (sheetH / sheetW)) * 1.06
            let img = cropSquare(centerXPct: cx, centerYPct: cy, sideWPct: sideW)
            return CanvasSticker(centerXPct: cx, centerYPct: cy, sidePct: sideW, image: img)
        }
    }

    private func cropSquare(centerXPct: Double, centerYPct: Double, sideWPct: Double) -> UIImage? {
        guard let cg = sheetImage.cgImage else { return nil }
        let W = Double(cg.width), H = Double(cg.height)
        let sidePx = sideWPct * W
        let cx = centerXPct * W, cy = centerYPct * H
        let raw = CGRect(x: cx - sidePx / 2, y: cy - sidePx / 2, width: sidePx, height: sidePx)
        let rect = raw.intersection(CGRect(x: 0, y: 0, width: W, height: H))
        guard !rect.isNull, let cropped = cg.cropping(to: rect) else { return nil }
        return UIImage(cgImage: cropped, scale: sheetImage.scale, orientation: sheetImage.imageOrientation)
    }

    private func redo(_ id: UUID, replacement: String) {
        guard let idx = stickers.firstIndex(where: { $0.id == id }),
              let img = stickers[idx].image, !stickers[idx].isLoading,
              let png = img.pngData() else { return }
        stickers[idx].isLoading = true
        Task {
            do {
                let url = try await ForgeService.shared.redoSticker(imageData: png, replacement: replacement)
                let (data, _) = try await URLSession.shared.data(from: url)
                if let i = stickers.firstIndex(where: { $0.id == id }) {
                    if let newImg = UIImage(data: data) { stickers[i].image = newImg; didEdit = true }
                    stickers[i].isLoading = false
                }
            } catch {
                if let i = stickers.firstIndex(where: { $0.id == id }) { stickers[i].isLoading = false }
                errorText = error.localizedDescription
            }
        }
    }

    /// Close the editor. If anything was redone, flatten the sheet and save the
    /// edited version to My Creations (and hand it back so the main screen shows
    /// it). Saving runs in the background so closing is instant.
    private func done() {
        if didEdit, let data = flatten().jpegData(compressionQuality: 0.9) {
            Task {
                if let url = try? await ForgeService.shared.saveEditedSheet(imageData: data) {
                    onSaved(url)
                }
            }
        }
        onClose()
    }

    /// Flatten the current canvas to a shareable image.
    @MainActor private func flatten() -> UIImage {
        let renderW: CGFloat = 1000
        let size = CGSize(width: renderW, height: renderW / aspect)
        let content = StickerCanvasRender(stickers: stickers, size: size)
        let renderer = ImageRenderer(content: content)
        renderer.scale = 2
        return renderer.uiImage ?? sheetImage
    }
}

/// Non-interactive render of the canvas at a fixed size (for sharing/export).
private struct StickerCanvasRender: View {
    let stickers: [CanvasSticker]
    let size: CGSize
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.white
            ForEach(stickers) { s in
                if let img = s.image {
                    Image(uiImage: img)
                        .resizable().scaledToFit()
                        .frame(width: s.sidePct * size.width, height: s.sidePct * size.width)
                        .position(x: s.centerXPct * size.width, y: s.centerYPct * size.height)
                }
            }
        }
        .frame(width: size.width, height: size.height)
    }
}

/// UIKit share sheet wrapper.
private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

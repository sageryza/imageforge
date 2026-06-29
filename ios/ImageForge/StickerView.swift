import SwiftUI
import UIKit

/// Sticker Page — describe a set of stickers and get one full-page sheet of
/// free-form stickers (house style baked in server-side). After a sheet is
/// generated, "Edit stickers" opens a canvas where each detected sticker is its
/// own tile you can tap to regenerate in place. Generation goes through
/// gpt-image-2, so it sits behind the shared one-time AI-consent gate.
struct StickerView: View {
    @State private var prompt = ""
    @State private var quality = "medium"
    @State private var busy = false
    @State private var sheet: StickerSheetResult?
    @State private var errorText: String?

    // Editor
    @State private var loadingEditor = false
    @State private var editorItem: IdentifiedImage?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @FocusState private var promptFocused: Bool

    private let qualities = ["low", "medium", "high"]

    var body: some View {
        ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    // Generated content sits above the prompt controls.
                    if busy { loadingCard }
                    if let sheet, !busy { resultCard(sheet) }
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
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Sticker Page")
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
                    StickerEditor(sheetImage: item.image, boxes: sheet.boxes) {
                        editorItem = nil
                    }
                }
            }
    }

    // MARK: - Sections

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT STICKERS?")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            TextField("a cozy autumn set — a steaming mug, a maple leaf, a little fox, a stack of books…",
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
            Text(busy ? "Generating…" : "Generate Sticker Sheet")
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
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            GIFView(name: "loading-anim", ext: "png").frame(width: 150, height: 150)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(2.0 / 3.0, contentMode: .fit)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    // Just the sheet on white — tap it to open the editor. Actions live in the
    // ⋯ menu in the nav bar; sheets also auto-save to My Creations.
    private func resultCard(_ sheet: StickerSheetResult) -> some View {
        AsyncImage(url: sheet.url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFit().background(Color.white)
            case .failure:
                Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
            default:
                ProgressView()
            }
        }
        .frame(maxWidth: .infinity)
        .background(Color.white)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture { if !sheet.boxes.isEmpty { openEditor(sheet) } }
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

    @State private var stickers: [CanvasSticker] = []
    @State private var errorText: String?
    @State private var shareItem: IdentifiedImage?
    @State private var redoTargetId: UUID?
    @State private var redoText = ""
    @State private var showRedoAlert = false

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
            Button("Done", action: onClose)
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
                    if let newImg = UIImage(data: data) { stickers[i].image = newImg }
                    stickers[i].isLoading = false
                }
            } catch {
                if let i = stickers.firstIndex(where: { $0.id == id }) { stickers[i].isLoading = false }
                errorText = error.localizedDescription
            }
        }
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

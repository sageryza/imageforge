import SwiftUI
import PDFKit
import UIKit

/// The dream zine: every dream's comic pages compiled into one PDF you can flip
/// through like a book, then print or save. Two layouts:
///   • Pages   — one comic page per sheet, straight reading order.
///   • Booklet — 2-up saddle-stitch imposition: print double-sided, fold in
///               half, staple, and it reads in order.
/// Reached from the spiral-notebook button on the Dreams screen.
struct DreamZineView: View {
    @State private var pdfURL: URL?
    @State private var status = "Gathering your dreams…"
    @State private var building = true
    @State private var booklet = false

    var body: some View {
        Group {
            if building {
                VStack(spacing: 14) {
                    ProgressView()
                    Text(status).font(.callout).foregroundColor(Theme.textDim)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let url = pdfURL {
                VStack(spacing: 0) {
                    Picker("Layout", selection: $booklet) {
                        Text("Pages").tag(false)
                        Text("Booklet").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .padding(12)
                    if booklet {
                        Text("Print double-sided (flip on long edge), fold in half, and staple.")
                            .font(.caption).foregroundColor(Theme.textDim)
                            .padding(.horizontal, 12).padding(.bottom, 8)
                    } else {
                        Text("Tap the right or left side to turn the page.")
                            .font(.caption).foregroundColor(Theme.textDim)
                            .padding(.horizontal, 12).padding(.bottom, 8)
                    }
                    // Reading view = an open book (two pages at a time). The
                    // booklet layout is a print imposition, shown one sheet at a time.
                    ZinePDFView(url: url, twoUp: !booklet)
                }
            } else {
                Text("No dream pages to bind yet — illustrate a dream first.")
                    .font(.callout).foregroundColor(Theme.textDim)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Dream zine")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url = pdfURL {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                }
            }
        }
        .task { await build() }
        .onChange(of: booklet) { _ in Task { await build() } }
    }

    private func build() async {
        building = true
        let dreams = await MovieService.shared.allDreamsFull()
        // Oldest first — a book that reads forward in time.
        let urls = dreams
            .sorted { ($0.createdAt ?? "") < ($1.createdAt ?? "") }
            .flatMap { $0.pages ?? [] }
            .compactMap { $0.pageURL }
        guard !urls.isEmpty else { pdfURL = nil; building = false; return }
        status = booklet
            ? "Imposing \(urls.count) pages into a booklet…"
            : "Binding \(urls.count) page\(urls.count == 1 ? "" : "s")…"
        pdfURL = booklet
            ? await ZineBuilder.makeBookletPDF(from: urls)
            : await ZineBuilder.makePDF(from: urls)
        building = false
    }
}

/// Builds the zine PDF from remote page images — straight reading order, or a
/// saddle-stitch booklet imposition. Runs off the main actor.
enum ZineBuilder {
    private static func download(_ urls: [URL]) async -> [UIImage] {
        var images: [UIImage] = []
        for url in urls {
            if let (data, _) = try? await URLSession.shared.data(from: url),
               let img = UIImage(data: data) {
                images.append(img)
            }
        }
        return images
    }

    /// Aspect-fit an image, centered, inside a rect with a margin. Uses the
    /// current UIGraphics PDF context (set by beginPage()).
    private static func draw(_ img: UIImage?, in rect: CGRect, margin: CGFloat) {
        guard let img else { return }
        let avail = rect.insetBy(dx: margin, dy: margin)
        let scale = min(avail.width / img.size.width, avail.height / img.size.height)
        let w = img.size.width * scale, h = img.size.height * scale
        img.draw(in: CGRect(x: rect.midX - w / 2, y: rect.midY - h / 2, width: w, height: h))
    }

    /// One comic page per US-Letter portrait sheet.
    static func makePDF(from urls: [URL]) async -> URL? {
        let images = await download(urls)
        guard !images.isEmpty else { return nil }
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)   // US Letter @72dpi
        let out = FileManager.default.temporaryDirectory.appendingPathComponent("dream-zine.pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        do {
            try renderer.writePDF(to: out) { ctx in
                for img in images {
                    ctx.beginPage()
                    draw(img, in: pageRect, margin: 24)
                }
            }
            return out
        } catch { return nil }
    }

    /// Saddle-stitch imposition: landscape sheets, two content pages side by
    /// side, ordered so a double-sided print folded in half reads 1..N. Padded
    /// to a multiple of 4 with blanks.
    static func makeBookletPDF(from urls: [URL]) async -> URL? {
        let content = await download(urls)
        guard !content.isEmpty else { return nil }
        var imgs: [UIImage?] = content.map { $0 }
        let padded = ((imgs.count + 3) / 4) * 4
        while imgs.count < padded { imgs.append(nil) }

        let sheet = CGRect(x: 0, y: 0, width: 792, height: 612)      // US Letter landscape
        let leftHalf  = CGRect(x: 0,   y: 0, width: 396, height: 612)
        let rightHalf = CGRect(x: 396, y: 0, width: 396, height: 612)
        let out = FileManager.default.temporaryDirectory.appendingPathComponent("dream-booklet.pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: sheet)
        do {
            try renderer.writePDF(to: out) { ctx in
                let sheets = padded / 4
                for i in 0..<sheets {
                    // Front: [ page(padded-2i) | page(1+2i) ]  → 0-based indices.
                    ctx.beginPage()
                    draw(imgs[padded - 1 - 2 * i], in: leftHalf,  margin: 18)
                    draw(imgs[2 * i],              in: rightHalf, margin: 18)
                    // Back: [ page(2+2i) | page(padded-1-2i) ].
                    ctx.beginPage()
                    draw(imgs[1 + 2 * i],          in: leftHalf,  margin: 18)
                    draw(imgs[padded - 2 - 2 * i], in: rightHalf, margin: 18)
                }
            }
            return out
        } catch { return nil }
    }
}

/// A PDF shown like a book you flip through. `twoUp` shows an open two-page
/// spread (the reading view); otherwise one sheet at a time (the print booklet).
/// Tap the right/left half to turn the page.
struct ZinePDFView: UIViewRepresentable {
    let url: URL
    var twoUp = false

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.document = PDFDocument(url: url)
        view.autoScales = true
        view.usePageViewController(true, withViewOptions:
            [UIPageViewController.OptionsKey.interPageSpacing: 8])
        view.displayMode = twoUp ? .twoUp : .singlePage
        view.displayDirection = .horizontal
        view.backgroundColor = .clear

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.onTap(_:)))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
        context.coordinator.pdf = view
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {
        view.displayMode = twoUp ? .twoUp : .singlePage
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject {
        weak var pdf: PDFView?
        @objc func onTap(_ g: UITapGestureRecognizer) {
            guard let pdf else { return }
            if g.location(in: pdf).x < pdf.bounds.width / 2 { pdf.goToPreviousPage(nil) }
            else { pdf.goToNextPage(nil) }
        }
    }
}

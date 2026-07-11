import SwiftUI
import PDFKit
import UIKit

/// The dream zine: every dream's comic pages compiled into one PDF you can flip
/// through like a book, then print or save (AirPrint / Save to Files). Reached
/// from the spiral-notebook button on the Dreams screen. Booklet imposition
/// (fold-and-staple ordering) is a planned follow-up; this is the straight PDF.
struct DreamZineView: View {
    @State private var pdfURL: URL?
    @State private var status = "Gathering your dreams…"
    @State private var building = true
    @State private var pageCount = 0

    var body: some View {
        Group {
            if building {
                VStack(spacing: 14) {
                    ProgressView()
                    Text(status).font(.callout).foregroundColor(Theme.textDim)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let url = pdfURL {
                ZinePDFView(url: url)
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
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
        .task { await build() }
    }

    private func build() async {
        let dreams = await MovieService.shared.allDreamsFull()
        // Oldest first — a book that reads forward in time.
        let urls = dreams
            .sorted { ($0.createdAt ?? "") < ($1.createdAt ?? "") }
            .flatMap { $0.pages ?? [] }
            .compactMap { $0.pageURL }
        guard !urls.isEmpty else { building = false; return }
        pageCount = urls.count
        status = "Binding \(urls.count) page\(urls.count == 1 ? "" : "s")…"
        let out = await ZineBuilder.makePDF(from: urls)
        pdfURL = out
        building = false
    }
}

/// Downloads each page image and lays it into a US-Letter portrait PDF, one
/// comic page per sheet, aspect-fit with a margin. Runs off the main actor.
enum ZineBuilder {
    static func makePDF(from urls: [URL]) async -> URL? {
        var images: [UIImage] = []
        for url in urls {
            if let (data, _) = try? await URLSession.shared.data(from: url),
               let img = UIImage(data: data) {
                images.append(img)
            }
        }
        guard !images.isEmpty else { return nil }

        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)   // US Letter @72dpi
        let margin: CGFloat = 24
        let out = FileManager.default.temporaryDirectory
            .appendingPathComponent("dream-zine.pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        do {
            try renderer.writePDF(to: out) { ctx in
                for img in images {
                    ctx.beginPage()
                    let avail = pageRect.insetBy(dx: margin, dy: margin)
                    let scale = min(avail.width / img.size.width,
                                    avail.height / img.size.height)
                    let w = img.size.width * scale
                    let h = img.size.height * scale
                    let rect = CGRect(x: (pageRect.width - w) / 2,
                                      y: (pageRect.height - h) / 2,
                                      width: w, height: h)
                    img.draw(in: rect)
                }
            }
            return out
        } catch {
            return nil
        }
    }
}

/// A PDF shown page-by-page so it reads like a book you flip through.
struct ZinePDFView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.document = PDFDocument(url: url)
        view.autoScales = true
        view.displayMode = .singlePage
        view.displayDirection = .horizontal
        view.usePageViewController(true, withViewOptions:
            [UIPageViewController.OptionsKey.interPageSpacing: 8])
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {}
}

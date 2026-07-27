import UIKit
import UniformTypeIdentifiers

/// "Send to Deck Factory" — the share-sheet way into the Dump.
///
/// The album picker in the app is the better path when the grouping matters
/// (it knows album names). This is the everywhere-else path: share photos or
/// clips from Photos, Files, Safari, anywhere, and they land in the inbox as
/// one unnamed bundle to be labelled later.
///
/// Uploads run in the FOREGROUND, while this sheet is open. A background
/// URLSession inside an extension requires an App Group entitlement, and
/// adding one to the host app risks its automatic signing in CI — not worth
/// breaking the app's builds over. The cost is that a big share keeps the
/// sheet up until it finishes, which is at least honest about what's happening.
final class ShareViewController: UIViewController {
    private let card = UIView()
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let progress = UIProgressView(progressViewStyle: .default)
    private let sendButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    private var attachments: [NSItemProvider] = []
    private var sent = 0
    private var failed = 0
    private var session = ""

    // House palette, matched to Theme.swift.
    private let ink = UIColor(red: 0.23, green: 0.21, blue: 0.19, alpha: 1)
    private let dim = UIColor(red: 0.62, green: 0.58, blue: 0.56, alpha: 1)
    private let accent = UIColor(red: 0.71, green: 0.55, blue: 0.42, alpha: 1)
    private let paper = UIColor(red: 0.98, green: 0.976, blue: 0.969, alpha: 1)

    override func viewDidLoad() {
        super.viewDidLoad()
        session = Self.newSessionID()
        attachments = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
            .filter { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier)
                   || $0.hasItemConformingToTypeIdentifier(UTType.movie.identifier) }
        buildUI()
    }

    // MARK: - UI

    private func buildUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.35)

        card.backgroundColor = paper
        card.layer.cornerRadius = 12          // rounded rectangle, never a pill
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        titleLabel.text = attachments.isEmpty
            ? "Nothing to dump"
            : "Dump \(attachments.count) item\(attachments.count == 1 ? "" : "s")"
        titleLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        titleLabel.textColor = ink

        statusLabel.text = attachments.isEmpty
            ? "No photos or videos in what you shared."
            : "Lands in the inbox — you can label it later."
        statusLabel.font = .systemFont(ofSize: 13)
        statusLabel.textColor = dim
        statusLabel.numberOfLines = 0

        progress.progressTintColor = accent
        progress.isHidden = true

        sendButton.setTitle("Dump it", for: .normal)
        sendButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        sendButton.setTitleColor(.white, for: .normal)
        sendButton.backgroundColor = accent
        sendButton.layer.cornerRadius = 6
        sendButton.isEnabled = !attachments.isEmpty
        sendButton.alpha = attachments.isEmpty ? 0.45 : 1
        sendButton.addTarget(self, action: #selector(send), for: .touchUpInside)

        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(dim, for: .normal)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [
            titleLabel, statusLabel, progress, sendButton, cancelButton,
        ])
        stack.axis = .vertical
        stack.spacing = 12
        stack.setCustomSpacing(6, after: titleLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20),
            sendButton.heightAnchor.constraint(equalToConstant: 46),
        ])
    }

    // MARK: - Sending

    @objc private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(domain: "Dump", code: 0))
    }

    @objc private func send() {
        sendButton.isEnabled = false
        sendButton.alpha = 0.45
        cancelButton.isHidden = true
        progress.isHidden = false
        progress.progress = 0
        statusLabel.text = "Sending… keep this open."

        Task {
            for (i, provider) in attachments.enumerated() {
                do {
                    let file = try await Self.loadFile(from: provider)
                    defer { try? FileManager.default.removeItem(at: file) }
                    try await upload(file)
                    sent += 1
                } catch {
                    failed += 1
                }
                let done = Float(i + 1) / Float(attachments.count)
                await MainActor.run {
                    progress.setProgress(done, animated: true)
                    statusLabel.text = "Sent \(sent) of \(attachments.count)…"
                }
            }
            await MainActor.run { finish() }
        }
    }

    private func finish() {
        if failed == 0 {
            extensionContext?.completeRequest(returningItems: nil)
        } else {
            // Say what happened rather than dismissing on a silent partial fail.
            titleLabel.text = "Sent \(sent), \(failed) failed"
            statusLabel.text = "The ones that failed are still on your phone — try again."
            progress.isHidden = true
            sendButton.setTitle("Done", for: .normal)
            sendButton.isEnabled = true
            sendButton.alpha = 1
            sendButton.removeTarget(self, action: #selector(send), for: .touchUpInside)
            sendButton.addTarget(self, action: #selector(dismissDone), for: .touchUpInside)
        }
    }

    @objc private func dismissDone() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    /// Copy the shared item to a temp file. `loadFileRepresentation` hands back
    /// a URL that's only valid inside the callback, so it has to be copied out
    /// before the closure returns.
    private static func loadFile(from provider: NSItemProvider) async throws -> URL {
        let type = provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier)
            ? UTType.movie.identifier : UTType.image.identifier
        return try await withCheckedThrowingContinuation { cont in
            provider.loadFileRepresentation(forTypeIdentifier: type) { url, error in
                if let error { return cont.resume(throwing: error) }
                guard let url else {
                    return cont.resume(throwing: NSError(domain: "Dump", code: 1, userInfo: [
                        NSLocalizedDescriptionKey: "Couldn't read the shared file",
                    ]))
                }
                let dest = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString + "-" + url.lastPathComponent)
                do {
                    try FileManager.default.copyItem(at: url, to: dest)
                    cont.resume(returning: dest)
                } catch {
                    cont.resume(throwing: error)
                }
            }
        }
    }

    private func upload(_ file: URL) async throws {
        let server = UserDefaults.standard.string(forKey: "forge.serverURL")?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        var comps = URLComponents(string: (server?.isEmpty == false ? server! : Self.defaultServer)
                                  + "/api/drop/upload-file")!
        comps.queryItems = [
            .init(name: "session", value: session),
            .init(name: "filename", value: file.lastPathComponent),
        ]
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "POST"
        req.setValue(Self.contentType(for: file), forHTTPHeaderField: "Content-Type")
        let token = UserDefaults.standard.string(forKey: "forge.studioToken") ?? ""
        if !token.isEmpty { req.setValue(token, forHTTPHeaderField: "x-studio-token") }

        let (_, response) = try await URLSession.shared.upload(for: req, fromFile: file)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code < 400 else {
            throw NSError(domain: "Dump", code: code, userInfo: [
                NSLocalizedDescriptionKey: "Server returned \(code)",
            ])
        }
    }

    private static let defaultServer = "https://imageforge-q125.onrender.com"

    private static func contentType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "jpg", "jpeg": return "image/jpeg"
        case "png":         return "image/png"
        case "heic":        return "image/heic"
        case "heif":        return "image/heif"
        case "gif":         return "image/gif"
        case "webp":        return "image/webp"
        case "mov":         return "video/quicktime"
        case "mp4", "m4v":  return "video/mp4"
        default:            return "application/octet-stream"
        }
    }

    private static func newSessionID() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd-HHmm"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.string(from: Date())
    }
}

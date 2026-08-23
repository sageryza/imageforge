import UIKit
import UniformTypeIdentifiers
import AVFoundation

/// "Send to Deck Factory" — the share-sheet way into the Dump.
///
/// The album picker in the app is the better path when the grouping matters
/// (it knows album names). This is the everywhere-else path: share photos or
/// clips from Photos, Files, Safari, anywhere, and they land in the inbox as
/// one unnamed bundle to be labelled later.
///
/// Audio too (Aug 2026, revised same week — Sophie's call): a recording shared
/// from the Files app files into the VOICE MEMOS archive (`/api/memos/ingest`
/// → membry `memo-audio/`, the private shelf JournalReader reads) — not the
/// public Deck Factory audio drop. The toggle picks whether the memo pipeline
/// transcribes + categorizes it on arrival (Whisper, ~1¢/min) or files it
/// quietly as a note for later.
///
/// Uploads run through a BACKGROUND URLSession (Aug 2026, Sophie's call —
/// house rule: nothing waits in the foreground). The sheet stages each file
/// into the App Group container, hands one upload task per file to the
/// system's transfer daemon, and dismisses — the uploads finish on their own,
/// even with the phone locked. Fire-and-forget on purpose: the server de-dupes
/// by content hash, so if something ever doesn't arrive, re-sharing the batch
/// heals it instead of doubling it. Staged files are swept two days later on
/// the next share.
final class ShareViewController: UIViewController {
    private let card = UIView()
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let progress = UIProgressView(progressViewStyle: .default)
    private let sendButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)
    // Whisper opt-in for recordings — shown only when the share contains audio.
    private let transcribeSwitch = UISwitch()
    // Name it / sort it at dump time (Aug 2026, Sophie: "add an option to add
    // a name or sort it in the share sheet pop-up"). Both stay OPTIONAL —
    // dump-first is still the rule, and everything here is editable on /dump
    // afterwards. This just saves the trip back when she already knows what
    // the thing is.
    private let nameField = UITextField()
    private let folderRow = ChipFlowView()
    private var folders: [String] = ShareViewController.bakedFolders
    private var chosenFolder: String?
    private var cardCenterY: NSLayoutConstraint?

    private var attachments: [NSItemProvider] = []
    private var failed = 0
    private var session = ""

    /// The folders offered before `GET /api/drop/tracks` answers — and if it
    /// never does. Kept equal to the server's `KNOWN_TRACKS` by
    /// scripts/test-dump-session-time.js.
    private static let bakedFolders = ["crystals", "story-art", "hoonies", "reference", "product"]

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
                   || $0.hasItemConformingToTypeIdentifier(UTType.movie.identifier)
                   || $0.hasItemConformingToTypeIdentifier(UTType.audio.identifier) }
        buildUI()
        observeKeyboard()
        loadFolders()
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
            ? "No photos, videos or recordings in what you shared."
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

        // Recordings file into the voice-memo archive; the toggle picks
        // whether the pipeline transcribes + categorizes on arrival (Whisper,
        // ~1¢ a minute — ON by default, that's what makes a memo findable) or
        // files them quietly as notes for later.
        var rows: [UIView] = [titleLabel, statusLabel]
        let hasAudio = attachments.contains {
            $0.hasItemConformingToTypeIdentifier(UTType.audio.identifier)
        }
        if hasAudio {
            statusLabel.text = "Recordings file with your voice memos; photos and clips land in the inbox."
            let lbl = UILabel()
            lbl.text = "Transcribe the recordings"
            lbl.font = .systemFont(ofSize: 14)
            lbl.textColor = ink
            transcribeSwitch.onTintColor = accent
            transcribeSwitch.isOn = true
            let row = UIStackView(arrangedSubviews: [lbl, transcribeSwitch])
            row.axis = .horizontal
            row.alignment = .center
            rows.append(row)
        }
        // Name it, and sort it. Both optional; a share with only recordings in
        // it has no album and no folder to set, so the folder row comes off
        // there rather than sitting there doing nothing.
        let onlyAudio = !attachments.isEmpty && attachments.allSatisfy {
            $0.hasItemConformingToTypeIdentifier(UTType.audio.identifier)
        }
        if !attachments.isEmpty {
            // Ships EMPTY, and the placeholder NAMES the field rather than
            // filling it or instructing — house rule, no pre-written text in
            // anything she writes in.
            nameField.placeholder = "Name"
            nameField.font = .systemFont(ofSize: 15)
            nameField.textColor = ink
            nameField.borderStyle = .none
            nameField.backgroundColor = .white
            nameField.layer.cornerRadius = 6      // rounded rectangle, never a pill
            nameField.layer.borderWidth = 1
            nameField.layer.borderColor = UIColor(red: 0.89, green: 0.87, blue: 0.85, alpha: 1).cgColor
            nameField.autocapitalizationType = .sentences
            nameField.returnKeyType = .done
            nameField.delegate = self
            nameField.clearButtonMode = .whileEditing
            // Room inside the box for the text to breathe.
            let pad = UIView(frame: CGRect(x: 0, y: 0, width: 10, height: 1))
            nameField.leftView = pad
            nameField.leftViewMode = .always
            nameField.translatesAutoresizingMaskIntoConstraints = false
            nameField.heightAnchor.constraint(equalToConstant: 40).isActive = true
            rows.append(nameField)

            if !onlyAudio {
                folderRow.onPick = { [weak self] folder in self?.chosenFolder = folder }
                folderRow.set(folders, selected: nil, ink: ink, dim: dim, accent: accent)
                rows.append(folderRow)
            }
        }
        rows.append(contentsOf: [progress, sendButton, cancelButton])
        let stack = UIStackView(arrangedSubviews: rows)
        stack.axis = .vertical
        stack.spacing = 12
        stack.setCustomSpacing(6, after: titleLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        cardCenterY = card.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            cardCenterY!,
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20),
            sendButton.heightAnchor.constraint(equalToConstant: 46),
        ])
    }

    // MARK: - Folders and the keyboard

    /// The folders come from the SERVER (`GET /api/drop/tracks`) so a folder
    /// she invented on /dump shows up here without a new build. The baked list
    /// is already on screen by then — this only ever adds to it, so a failed
    /// or slow fetch costs nothing and the sheet is never waiting on a network
    /// call to be usable.
    private func loadFolders() {
        guard let url = URL(string: Self.serverBase() + "/api/drop/tracks") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 4
        let token = UserDefaults.standard.string(forKey: "forge.studioToken") ?? ""
        if !token.isEmpty { req.setValue(token, forHTTPHeaderField: "x-studio-token") }
        URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
            guard let self,
                  let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let list = json["tracks"] as? [String],
                  !list.isEmpty else { return }
            DispatchQueue.main.async {
                self.folders = list
                self.folderRow.set(list, selected: self.chosenFolder,
                                   ink: self.ink, dim: self.dim, accent: self.accent)
            }
        }.resume()
    }

    /// The card is centred, so the keyboard would sit over the name box on a
    /// short phone. Lift it by however much the two actually overlap — never a
    /// fixed nudge, which over-scrolls on a big screen.
    private func observeKeyboard() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardChanged),
            name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardHidden),
            name: UIResponder.keyboardWillHideNotification, object: nil)
        // MUST NOT swallow the touch — the default cancels it, which would
        // eat every tap on Dump it / Cancel / a folder chip.
        let tap = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
    }

    @objc private func keyboardChanged(_ note: Notification) {
        guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey]
                as? NSValue else { return }
        let kb = view.convert(frame.cgRectValue, from: nil)
        // Measure against where the card SITS AT REST, not where it is now —
        // the keyboard sends this again when the predictive bar appears, and
        // reading the already-lifted frame would stack a second lift on top.
        let atRest = card.frame.maxY - (cardCenterY?.constant ?? 0)
        let overlap = max(0, atRest + 12 - kb.minY)
        cardCenterY?.constant = -overlap
        UIView.animate(withDuration: 0.25) { self.view.layoutIfNeeded() }
    }

    @objc private func keyboardHidden() {
        cardCenterY?.constant = 0
        UIView.animate(withDuration: 0.25) { self.view.layoutIfNeeded() }
    }

    @objc private func dismissKeyboard() { view.endEditing(true) }

    /// What she typed, trimmed. Empty means she didn't name it — the dump then
    /// behaves exactly as it always did, one unnamed bundle in the inbox.
    private var typedName: String {
        nameField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    // MARK: - Sending

    @objc private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(domain: "Dump", code: 0))
    }

    @objc private func send() {
        view.endEditing(true)
        sendButton.isEnabled = false
        sendButton.alpha = 0.45
        cancelButton.isHidden = true
        progress.isHidden = false
        progress.progress = 0
        statusLabel.text = "Handing off…"

        Task {
            // Stage every file into the App Group container — the transfer
            // daemon must still be able to read them after this sheet is gone
            // — queue one background upload task each, then dismiss. The only
            // wait here is reading the files off disk, seconds not uploads.
            let fm = FileManager.default
            guard let container = fm.containerURL(
                forSecurityApplicationGroupIdentifier: Self.appGroup) else {
                await MainActor.run { self.stageFailed("No shared container — reinstall the app.") }
                return
            }
            let outbox = container.appendingPathComponent("dumpshare-outbox", isDirectory: true)
            try? fm.createDirectory(at: outbox, withIntermediateDirectories: true)
            Self.sweepOutbox(outbox)

            let bg = Self.makeBackgroundSession()
            var queued = 0
            var usedStamps = Set<String>()
            for (i, provider) in attachments.enumerated() {
                do {
                    let tmp = try await Self.loadFile(from: provider)
                    let staged = outbox.appendingPathComponent(
                        UUID().uuidString + "-" + tmp.lastPathComponent)
                    try fm.moveItem(at: tmp, to: staged)
                    let req = Self.isAudio(staged)
                        ? await memoRequest(for: staged, usedStamps: &usedStamps)
                        : dumpRequest(for: staged)
                    bg.uploadTask(with: req, fromFile: staged).resume()
                    queued += 1
                } catch {
                    failed += 1
                }
                let done = Float(i + 1) / Float(attachments.count)
                await MainActor.run { progress.setProgress(done, animated: true) }
            }
            await MainActor.run { self.finishQueued(queued) }
        }
    }

    private func finishQueued(_ queued: Int) {
        if failed == 0 {
            // Everything is queued with the system — done here, uploads
            // continue on their own even if the app closes or the phone locks.
            extensionContext?.completeRequest(returningItems: nil)
        } else {
            // Say what happened rather than dismissing on a silent partial fail.
            titleLabel.text = queued > 0 ? "Sending \(queued), \(failed) unreadable" : "Couldn't read those"
            statusLabel.text = queued > 0
                ? "The unreadable ones are still on your phone — share them again."
                : "Nothing could be read from that share."
            progress.isHidden = true
            sendButton.setTitle("Done", for: .normal)
            sendButton.isEnabled = true
            sendButton.alpha = 1
            sendButton.removeTarget(self, action: #selector(send), for: .touchUpInside)
            sendButton.addTarget(self, action: #selector(dismissDone), for: .touchUpInside)
        }
    }

    private func stageFailed(_ message: String) {
        titleLabel.text = "Couldn't hand off"
        statusLabel.text = message
        progress.isHidden = true
        sendButton.setTitle("Done", for: .normal)
        sendButton.isEnabled = true
        sendButton.alpha = 1
        sendButton.removeTarget(self, action: #selector(send), for: .touchUpInside)
        sendButton.addTarget(self, action: #selector(dismissDone), for: .touchUpInside)
    }

    // Staged files can't be deleted on upload completion (nobody is around to
    // hear it) — sweep anything older than two days on the next share instead.
    private static func sweepOutbox(_ dir: URL) {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: [.contentModificationDateKey]) else { return }
        let cutoff = Date().addingTimeInterval(-48 * 3600)
        for f in files {
            let mod = (try? f.resourceValues(forKeys: [.contentModificationDateKey])
                .contentModificationDate) ?? .distantPast
            if mod < cutoff { try? fm.removeItem(at: f) }
        }
    }

    private static let appGroup = "group.com.sageryza.imageforge"

    private static func makeBackgroundSession() -> URLSession {
        // A fresh identifier per share: sessions are one-shot handoffs, and
        // reusing an identifier while its tasks still run is an error.
        let config = URLSessionConfiguration.background(
            withIdentifier: "com.sageryza.imageforge.dumpshare." + UUID().uuidString)
        config.sharedContainerIdentifier = appGroup
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = false
        return URLSession(configuration: config)
    }

    @objc private func dismissDone() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    /// Copy the shared item to a temp file. `loadFileRepresentation` hands back
    /// a URL that's only valid inside the callback, so it has to be copied out
    /// before the closure returns.
    private static func loadFile(from provider: NSItemProvider) async throws -> URL {
        let type = provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier)
            ? UTType.movie.identifier
            : provider.hasItemConformingToTypeIdentifier(UTType.audio.identifier)
            ? UTType.audio.identifier : UTType.image.identifier
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

    private static func serverBase() -> String {
        let server = UserDefaults.standard.string(forKey: "forge.serverURL")?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return server?.isEmpty == false ? server! : defaultServer
    }

    private static func signedRequest(_ url: URL, contentType: String) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        let token = UserDefaults.standard.string(forKey: "forge.studioToken") ?? ""
        if !token.isEmpty { req.setValue(token, forHTTPHeaderField: "x-studio-token") }
        return req
    }

    /// Images and clips go to the Dump, one date-stamped bundle per share.
    ///
    /// A typed name becomes the album (`bundle`), which also means re-sharing
    /// into the same name CONTINUES that album rather than starting a second
    /// one — the server looks a bundle up by slug across every dump. A picked
    /// folder becomes the `track`. Neither is sent when she left it alone.
    private func dumpRequest(for file: URL) -> URLRequest {
        var comps = URLComponents(string: Self.serverBase() + "/api/drop/upload-file")!
        var items: [URLQueryItem] = [
            .init(name: "session", value: session),
            .init(name: "filename", value: file.lastPathComponent),
        ]
        let name = typedName
        if !name.isEmpty { items.append(.init(name: "bundle", value: name)) }
        if let folder = chosenFolder, !folder.isEmpty {
            items.append(.init(name: "track", value: folder))
        }
        comps.queryItems = items
        return Self.signedRequest(comps.url!, contentType: Self.contentType(for: file))
    }

    /// A recording files into the VOICE MEMOS archive (membry `memo-audio/`,
    /// the private shelf JournalReader reads) via /api/memos/ingest. The
    /// archive keys memos by their recording stamp, so the stamp prefers the
    /// audio's EMBEDDED creation date (the true recording time on a real
    /// voice memo — file dates only say when a copy was made; verified Aug
    /// 2026 when saved-from-video audio stamped "tonight" instead of
    /// January), falling back to the file's modification date, bumped a
    /// minute at a time when two files in one share would collide.
    private func memoRequest(for file: URL, usedStamps: inout Set<String>) async -> URLRequest {
        let fm = FileManager.default
        let asset = AVURLAsset(url: file)
        var when = Date()
        if let item = try? await asset.load(.creationDate),
           let embedded = try? await item.load(.dateValue) {
            when = embedded
        } else if let mtime = (try? fm.attributesOfItem(atPath: file.path)[.modificationDate] as? Date)
            .flatMap({ $0 }) {
            when = mtime
        }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd_HHmm"
        var stamp = f.string(from: when)
        while usedStamps.contains(stamp) {
            when = when.addingTimeInterval(60)
            stamp = f.string(from: when)
        }
        usedStamps.insert(stamp)

        var dur = 0
        if let seconds = try? await AVURLAsset(url: file).load(.duration).seconds,
           seconds.isFinite { dur = Int(seconds.rounded()) }

        // The staged name carries a UUID prefix (outbox collision guard) and
        // the iOS export prefix — peel both back to a human title.
        var title = file.deletingPathExtension().lastPathComponent
        if title.count > 37, title.prefix(37).hasSuffix("-") { title = String(title.dropFirst(37)) }
        if title.count > 37, title.prefix(37).hasSuffix("-") { title = String(title.dropFirst(37)) }
        // A name she typed beats the filename — that IS the name for this
        // thing, whichever shelf it lands on. The archive keys memos by their
        // recording stamp, not the title, so sharing several recordings under
        // one name files them all correctly.
        if !typedName.isEmpty { title = typedName }

        let iso = ISO8601DateFormatter().string(from: when)
        var comps = URLComponents(string: Self.serverBase() + "/api/memos/ingest")!
        var items: [URLQueryItem] = [
            .init(name: "stamp", value: stamp),
            .init(name: "iso", value: iso),
            .init(name: "dur", value: String(dur)),
            .init(name: "ext", value: file.pathExtension.lowercased()),
            .init(name: "title", value: title),
        ]
        if !transcribeSwitch.isOn { items.append(.init(name: "transcribe", value: "0")) }
        comps.queryItems = items
        return Self.signedRequest(comps.url!, contentType: Self.contentType(for: file))
    }

    private static let defaultServer = "https://imageforge-q125.onrender.com"

    private static let audioExts: Set<String> = [
        "m4a", "mp3", "wav", "aac", "aif", "aiff", "caf", "ogg", "oga", "opus", "flac", "amr",
    ]
    private static func isAudio(_ file: URL) -> Bool {
        audioExts.contains(file.pathExtension.lowercased())
    }

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
        case "m4a":         return "audio/mp4"
        case "mp3":         return "audio/mpeg"
        case "wav":         return "audio/wav"
        case "aac":         return "audio/aac"
        case "aif", "aiff": return "audio/aiff"
        case "caf":         return "audio/x-caf"
        case "ogg", "oga":  return "audio/ogg"
        case "opus":        return "audio/opus"
        case "flac":        return "audio/flac"
        case "amr":         return "audio/amr"
        default:            return "application/octet-stream"
        }
    }

    /// The dump's id, stamped in HER wall clock.
    ///
    /// This was UTC until Aug 2026, and that is what made an evening dump wear
    /// tomorrow's date: a clip shared at 5:53 pm Pacific on Aug 22 landed as
    /// `2026-08-23-0052`, and looking for "the video from the 22nd" found
    /// nothing. The server's own fallback stamp (dropbox.js `newSession`) had
    /// the same bug and was fixed in the same change.
    private static func newSessionID() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd-HHmm"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "America/Los_Angeles") ?? .current
        return f.string(from: Date())
    }
}

// MARK: - Return closes the keyboard

extension ShareViewController: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}

/// A row of folder chips that WRAPS.
///
/// A horizontal scroll view was the other option and it hides folders off the
/// right edge — on a sheet whose whole job is "pick one", an option you have
/// to discover by scrolling may as well not be there. UIStackView cannot wrap,
/// so this lays the chips out itself and reports the height it needs.
final class ChipFlowView: UIView {
    var onPick: ((String?) -> Void)?

    private var chips: [UIButton] = []
    private var selected: String?
    private let hGap: CGFloat = 6
    private let vGap: CGFloat = 6

    func set(_ folders: [String], selected: String?,
             ink: UIColor, dim: UIColor, accent: UIColor) {
        self.selected = selected
        chips.forEach { $0.removeFromSuperview() }
        chips = folders.map { folder in
            let b = UIButton(type: .system)
            b.setTitle(folder, for: .normal)
            b.titleLabel?.font = Self.chipFont
            b.layer.cornerRadius = 6          // rounded rectangle, never a pill
            b.layer.borderWidth = 1
            b.accessibilityIdentifier = folder
            b.addTarget(self, action: #selector(tap(_:)), for: .touchUpInside)
            addSubview(b)
            return b
        }
        self.ink = ink; self.dim = dim; self.accent = accent
        paint()
        setNeedsLayout()
        invalidateIntrinsicContentSize()
    }

    private var ink: UIColor = .darkText
    private var dim: UIColor = .gray
    private var accent: UIColor = .brown

    private func paint() {
        for b in chips {
            // Both sides are optional, so a plain `==` would light every chip
            // the moment nothing is selected (nil == nil).
            let on = b.accessibilityIdentifier != nil && b.accessibilityIdentifier == selected
            b.backgroundColor = on ? accent : .white
            b.setTitleColor(on ? .white : ink, for: .normal)
            b.layer.borderColor = (on ? accent : dim.withAlphaComponent(0.45)).cgColor
        }
    }

    /// Tapping the lit chip again clears it back to unsorted — the same
    /// gesture the /dump page's track chips use, so the two behave alike.
    @objc private func tap(_ sender: UIButton) {
        let folder = sender.accessibilityIdentifier
        selected = (selected == folder) ? nil : folder
        paint()
        onPick?(selected)
    }

    private var lastPackedHeight: CGFloat = 0

    override func layoutSubviews() {
        super.layoutSubviews()
        let h = pack(width: bounds.width, place: true)
        // The first intrinsic height is measured against a GUESSED width (the
        // real one isn't known until the stack lays out). Tell the stack once
        // the true number is in, or a wrapped second row is clipped.
        if abs(h - lastPackedHeight) > 0.5 {
            lastPackedHeight = h
            invalidateIntrinsicContentSize()
        }
    }

    override var intrinsicContentSize: CGSize {
        // Before the stack lays out, neither this view nor its superview has a
        // width yet — fall back to one chip row so the sheet never opens with
        // the row collapsed to nothing.
        let w = bounds.width > 0 ? bounds.width : (superview?.bounds.width ?? 0)
        let h = w > 0 ? pack(width: w, place: false) : Self.chipHeight
        return CGSize(width: UIView.noIntrinsicMetric, height: h)
    }

    /// One pass: walk the chips left to right, wrapping when the next one
    /// would overflow. Returns the total height, and optionally places them.
    @discardableResult
    private func pack(width: CGFloat, place: Bool) -> CGFloat {
        guard !chips.isEmpty, width > 0 else { return 0 }
        var x: CGFloat = 0, y: CGFloat = 0
        for b in chips {
            // Measured, not asked of the button: `contentEdgeInsets` is
            // deprecated and `UIButton.Configuration` paints its own
            // background, which would fight the lit/unlit colours above.
            let text = (b.title(for: .normal) ?? "") as NSString
            let textW = text.size(withAttributes: [.font: Self.chipFont]).width
            let w = min(ceil(textW) + Self.chipPadX * 2, width)
            if x > 0, x + w > width { x = 0; y += Self.chipHeight + vGap }
            if place { b.frame = CGRect(x: x, y: y, width: w, height: Self.chipHeight) }
            x += w + hGap
        }
        return y + Self.chipHeight
    }

    private static let chipFont = UIFont.systemFont(ofSize: 13)
    private static let chipHeight: CGFloat = 30
    private static let chipPadX: CGFloat = 11
}

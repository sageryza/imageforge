import UIKit
import WebKit

/// THE ONE SAVE-TO-PHOTOS PATH for anything that isn't the native gallery —
/// the `forgeSave` bridge every web-wrapped tool's Save icon posts through,
/// and the Settings door behind a refused photo library.
///
/// WHY IT EXISTS. The Playground and Meta Assets each carried their own copy
/// of the bridge, and both copies were the same two lines (found Aug 2026,
/// Sophie: "the safe button doesn't work in the playground. I haven't checked
/// Meta assets." — she was right about both):
///
///     UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
///     ok = true
///
///  1. **It never asked for permission.** That call writes nothing once
///     add-only access is off, and `requestAuthorization` never re-prompts
///     after a "Don't Allow" — so every tap after one refusal was a permanent
///     no-op with nothing on screen admitting it.
///  2. **It reported success before Photos had done anything.** The completion
///     selector is nil, so nothing could ever know; the page toasted "Saved to
///     Photos" whatever happened. That is the bug she reported — it says it
///     saved and Photos is empty. A failure is never silence, and never a lie.
///  3. **It called UIKit from a detached `Task`**, off the main thread.
///  4. **It handed Photos a decoded `UIImage`.** `PhotoSaver` passes the
///     ORIGINAL bytes when they are PNG/JPEG/HEIC (what Photos is happiest
///     with) and re-encodes only what it must — the gallery serves webp, which
///     Photos rejects outright.
///
/// All four were already solved, once, in `PhotoSaver` (CreationsView.swift)
/// for the native gallery — and MetaAssetsView has since taken that gallery's
/// slot, so the app's only working saver had stopped being reachable at all.
/// This routes the web tools through it instead of keeping a second, worse
/// copy per tool. `node scripts/test-save-to-photos.js` pins that.
enum ForgeSaveBridge {
    /// The message-handler name both sides grep for.
    static let name = "forgeSave"

    /// Registers the handler on a config. Call from `makeUIView` BEFORE
    /// creating the web view. Removed first: a re-created view would otherwise
    /// throw on a duplicate name. The returned handler must be retained by the
    /// coordinator — `addScriptMessageHandler` does NOT retain.
    static func install(into config: WKWebViewConfiguration) -> ForgeSaveHandler {
        let handler = ForgeSaveHandler()
        config.userContentController.removeScriptMessageHandler(forName: name)
        config.userContentController.add(handler, name: name)
        return handler
    }

    /// THE ONE "Photos access is off" door. A toast is a dead end here — only
    /// Settings can turn the permission back on, which is the lesson the
    /// native gallery already learned. Presented from UIKit because the
    /// callers are a web view and a full-screen overlay, not a SwiftUI list.
    static func offerPhotosSettings() {
        Task { @MainActor in
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
            guard let top = scene?.keyWindow?.rootViewController?.forgeTopMost else { return }
            let alert = UIAlertController(
                title: "Photos access is off",
                message: "Turn on Add Photos Only for Deck Factory to save pictures to your library.",
                preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Not now", style: .cancel))
            alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { _ in
                if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
            })
            top.present(alert, animated: true)
        }
    }
}

/// Answers `forgeSave.postMessage(<image url>)`: download the picture, put it
/// in the photo library, and tell the page what actually happened.
final class ForgeSaveHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == ForgeSaveBridge.name,
              let raw = message.body as? String,
              let url = URL(string: raw) else { return }
        let web = message.webView
        Task {
            guard let (data, _) = try? await URLSession.shared.data(from: url), !data.isEmpty else {
                await Self.reply(web, false, "Couldn’t download that image")
                return
            }
            // `image` is only the FALLBACK, for a container Photos won't take
            // (webp); the original bytes go first whenever they're usable. No
            // guard on it — PNG/JPEG/HEIC bytes are savable whether or not
            // UIImage happens to decode them, and PhotoSaver says so itself
            // when neither form works.
            PhotoSaver.shared.save(data: data, image: UIImage(data: data)) { outcome in
                switch outcome {
                case .saved:
                    Task { await Self.reply(web, true, "Saved to Photos") }
                case .denied:
                    Task { await Self.reply(web, false, "Photos access is off") }
                    ForgeSaveBridge.offerPhotosSettings()
                case .failed(let why):
                    Task { await Self.reply(web, false, "Couldn’t save — \(why)") }
                }
            }
        }
    }

    /// The page's own toast says what happened. JSON-encoded rather than
    /// interpolated between quotes: Photos' error text is its words, and one
    /// apostrophe in it would be a syntax error instead of a message.
    @MainActor
    private static func reply(_ web: WKWebView?, _ ok: Bool, _ msg: String) {
        let json = (try? JSONSerialization.data(withJSONObject: [msg]))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        web?.evaluateJavaScript("window.__saveResult && window.__saveResult(\(ok), \(json)[0])")
    }
}

private extension UIViewController {
    /// The controller actually on screen — presenting on the root while a
    /// sheet is up puts the alert nowhere.
    var forgeTopMost: UIViewController {
        presentedViewController?.forgeTopMost ?? self
    }
}

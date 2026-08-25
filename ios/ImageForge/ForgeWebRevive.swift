import UIKit
import WebKit

/// ONE revive policy for every web view in the app (2026-08-25, the same
/// night twice). Build 175 gave all 19 web views the standard
/// `webViewWebContentProcessDidTerminate → reload()` so a tool iOS had
/// reclaimed under memory pressure would come back instead of sitting blank.
/// But RootView keeps THREE tools alive at once behind `.opacity(0)`, so
/// under pressure every kill triggered an instant reload, three heavy pages
/// resurrected together, iOS killed again — and the tool Sophie was READING
/// died every ~10 seconds ("wow, this is even worse. It's blink blinking").
/// A per-view reload was the right recovery applied at the wrong scope.
///
/// The policy here: a killed view joins a dead-list; only a view that is
/// actually VISIBLE reloads, at most one reload every `gap` seconds
/// app-wide; a hidden tool stays quietly dead — exactly the pre-175
/// behaviour — until she switches to it, which the 2s sweep notices and
/// revives within a beat. If the visibility walk can't tell (SwiftUI's
/// opacity not reaching the UIKit layer), everything reads as visible and
/// the throttle alone still holds reloads to one per `gap` — degraded, never
/// a thrash loop.
final class ForgeWebRevive {
    static let shared = ForgeWebRevive()

    private struct Dead { weak var web: WKWebView? }
    private var dead: [Dead] = []
    private var lastReload = Date.distantPast
    private var timer: Timer?
    private let gap: TimeInterval = 12

    func terminated(_ webView: WKWebView) {
        DispatchQueue.main.async {
            if !self.dead.contains(where: { $0.web === webView }) {
                self.dead.append(Dead(web: webView))
            }
            self.tick()
            self.arm()
        }
    }

    private func arm() {
        guard timer == nil, !dead.isEmpty else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    private func tick() {
        dead.removeAll { $0.web == nil }
        if dead.isEmpty { timer?.invalidate(); timer = nil; return }
        guard Date().timeIntervalSince(lastReload) >= gap else { return }
        guard let idx = dead.firstIndex(where: { Self.visible($0.web) }) else { return }
        let web = dead.remove(at: idx).web
        lastReload = Date()
        web?.reload()
        if dead.isEmpty { timer?.invalidate(); timer = nil }
    }

    /// Visible = attached to a window with no hidden/transparent ancestor.
    static func visible(_ v: UIView?) -> Bool {
        guard var u: UIView = v, u.window != nil else { return false }
        while true {
            if u.isHidden || u.alpha < 0.01 || u.layer.opacity < 0.01 { return false }
            guard let s = u.superview else { return true }
            u = s
        }
    }
}

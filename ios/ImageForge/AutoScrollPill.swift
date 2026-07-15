import SwiftUI
import UIKit

/// The autoscroll pill from the Writing Room, for native screens. One overlay
/// in RootView covers every tool: on play it finds the visible UIScrollView
/// under the key window (largest scrollable one on screen) and drives its
/// contentOffset with a CADisplayLink. Idle: ▲ up / ▶ play / ▼ down; playing:
/// − slower / ‖ pause / + faster. Default 1.0×, range 0.1–2×.
final class AutoScrollDriver: ObservableObject {
    /// Shared instance so screens can stop autoscroll on interaction (e.g. the
    /// gallery halts it when you tap an image to open the preview).
    static let shared = AutoScrollDriver()

    @Published var playing = false
    @Published var speedIndex = 1               // 0 slow · 1 medium · 2 fast
    var direction: Double = 1

    /// Three discrete speeds instead of a continuous dial.
    static let speeds: [(label: String, value: Double)] = [("Slow", 0.5), ("Medium", 1.0), ("Fast", 1.9)]
    var speed: Double { Self.speeds[speedIndex].value }
    var speedLabel: String { Self.speeds[speedIndex].label }
    func slower() { speedIndex = max(0, speedIndex - 1) }
    func faster() { speedIndex = min(Self.speeds.count - 1, speedIndex + 1) }

    private var link: CADisplayLink?
    private var lastTime: CFTimeInterval?
    private weak var target: UIScrollView?

    func toggle() { playing ? stop() : start(direction == 0 ? 1 : direction) }

    func start(_ dir: Double) {
        direction = dir
        target = Self.findScrollView()
        guard target != nil else { return }
        playing = true
        lastTime = nil
        link?.invalidate()
        let l = CADisplayLink(target: self, selector: #selector(tick))
        l.add(to: .main, forMode: .common)
        link = l
    }

    func stop() {
        playing = false
        link?.invalidate()
        link = nil
        lastTime = nil
    }

    @objc private func tick(_ l: CADisplayLink) {
        guard playing else { return }
        guard let sv = target, sv.window != nil else {
            // screen changed under us — re-find once, else stop
            target = Self.findScrollView()
            if target == nil { stop() }
            return
        }
        defer { lastTime = l.timestamp }
        guard let last = lastTime else { return }
        let dt = l.timestamp - last
        let delta = CGFloat(direction * 42.0 * speed * dt)
        let minY = -sv.adjustedContentInset.top
        let maxY = max(minY, sv.contentSize.height + sv.adjustedContentInset.bottom - sv.bounds.height)
        var y = sv.contentOffset.y + delta
        if y <= minY { y = minY }
        if y >= maxY { y = maxY }
        sv.contentOffset.y = y
        if (direction > 0 && y >= maxY) || (direction < 0 && y <= minY) { stop() }
    }

    /// The biggest scrollable, visible UIScrollView on screen right now.
    static func findScrollView() -> UIScrollView? {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) else { return nil }
        var best: UIScrollView?
        var bestArea: CGFloat = 0
        func walk(_ v: UIView) {
            if v.isHidden || v.alpha < 0.05 { return }
            if let sv = v as? UIScrollView, !(v is UITextView) {
                let frame = v.convert(v.bounds, to: window)
                let visible = frame.intersection(window.bounds)
                let scrollable = sv.contentSize.height > sv.bounds.height + 40
                if scrollable, visible.height > 200 {
                    let area = visible.width * visible.height
                    if area > bestArea { bestArea = area; best = sv }
                }
            }
            for sub in v.subviews { walk(sub) }
        }
        walk(window)
        return best
    }
}

struct AutoScrollPill: View {
    @ObservedObject private var driver = AutoScrollDriver.shared

    var body: some View {
        VStack(spacing: 6) {
            VStack(spacing: 0) {
                pillButton(driver.playing ? "minus" : "chevron.up",
                           dim: driver.playing && driver.speedIndex == 0) {
                    if driver.playing { driver.slower() } else { driver.start(-1) }
                }
                Rectangle().fill(Theme.text).frame(width: 46, height: 1.5)
                pillButton(driver.playing ? "pause.fill" : "play.fill", accent: driver.playing) {
                    driver.toggle()
                }
                Rectangle().fill(Theme.text).frame(width: 46, height: 1.5)
                pillButton(driver.playing ? "plus" : "chevron.down",
                           dim: driver.playing && driver.speedIndex == AutoScrollDriver.speeds.count - 1) {
                    if driver.playing { driver.faster() } else { driver.start(1) }
                }
            }
            .background(Theme.bg)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.text, lineWidth: 1.5))
            .shadow(color: .black.opacity(0.09), radius: 5, y: 2)

            Text(driver.speedLabel)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(Theme.textDim)
        }
        .onDisappear { driver.stop() }
    }

    private func pillButton(_ icon: String, accent: Bool = false, dim: Bool = false,
                            action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(accent ? Theme.danger : Theme.text.opacity(dim ? 0.3 : 1))
                .frame(width: 46, height: 46)
                .background(accent ? Theme.danger.opacity(0.16) : Color.clear)
                .contentShape(Rectangle())   // whole 46×46 is tappable, not just the glyph
        }
        .buttonStyle(.plain)
    }
}

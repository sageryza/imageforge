import UIKit
import UserNotifications

/// Push — the lock-screen half of the Chats app's Update tab (Aug 2026,
/// Sophie: "we could make these updates on my phone… through iOS since this
/// is an iOS app", offered the tiers: "let's build the hardest version").
///
/// The server (push.js) does the sending; this side has exactly three jobs:
///   1. ask for notification permission once and register with APNs,
///   2. hand the device token to the server (POST /api/push/device — an
///      upsert, so re-registering on every launch is free and covers token
///      rotation),
///   3. on a notification TAP, land her on the Chats screen's UPDATE tab —
///      the push is that tab's doorbell, so the tap opens the door.
///
/// Notifications are SUPPRESSED while the app is foregrounded (willPresent
/// returns []): if she is already in the app, the Update tab itself is the
/// notification, and a banner over it would be noise.
final class PushDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    /// Set before the UI reacts to a tap; ChatFeedView consumes it when
    /// building the /chats URL (→ ?view=news). A static flag rather than a
    /// published object because the cold-start tap arrives before any SwiftUI
    /// view exists to observe anything.
    static var pendingUpdateTab = false

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async { application.registerForRemoteNotifications() }
        }
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        // Same server + gate every other surface uses. Fire-and-forget: a
        // failed registration self-heals on the next launch.
        let base = (UserDefaults.standard.string(forKey: "forge.serverURL") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let server = base.isEmpty ? "https://imageforge-q125.onrender.com" : base
        guard let url = URL(string: server + "/api/push/device") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let studio = UserDefaults.standard.string(forKey: "forge.studioToken"), !studio.isEmpty {
            req.setValue(studio, forHTTPHeaderField: "x-studio-token")
        }
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["token": token])
        URLSession.shared.dataTask(with: req).resume()
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Nothing to do — the Update tab still works without push, and the
        // next launch tries again.
    }

    /// Foregrounded: the app is already the notification. Show nothing.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([])
    }

    /// Tapped: open on the Update tab. The flag is read by ChatFeedView when
    /// it builds its URL; the NotificationCenter post covers the warm case
    /// where the app (and the Chats web view) already exist.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        Self.pendingUpdateTab = true
        NotificationCenter.default.post(name: .forgePushOpenUpdate, object: nil)
        completionHandler()
    }
}

extension Notification.Name {
    /// A push was tapped — RootView switches to the Chats screen, ChatFeedView
    /// reloads onto the Update tab.
    static let forgePushOpenUpdate = Notification.Name("forgePushOpenUpdate")
}

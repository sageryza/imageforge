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
/// A NOTIFICATION SHOWS ITS BANNER EVEN WITH THE APP OPEN (Aug 2026, Sophie:
/// "notifications that come down into the app and appear at the top of the
/// screen while I'm in the app, that's a thing I think I've seen other
/// apps"). v1 suppressed them outright — willPresent returned [] — on the
/// reasoning that if she is already in the app the Update tab IS the
/// notification. That reasoning holds only on the Chats screen: the Update
/// tab is one screen of one tab, so a chat answering her while she is in the
/// Playground, the Story Room or the gallery said nothing at all, and the
/// nearest thing (the rose "New message" bar) lives on /chats and names
/// neither the chat nor what it said. So the banner is drawn now, wherever
/// she is, and tapping it routes exactly like a lock-screen tap.
///
/// NO SOUND while she is looking at the phone — [.banner, .list] and not
/// .sound. The buzz is what makes a lock-screen push reach her across the
/// room; in her hand the banner has already done that job, and a chime on top
/// is the noise the old suppression was rightly worried about. `.list` still
/// files it in Notification Center, so a banner she swipes past is not lost.
final class PushDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    /// Set before the UI reacts to a tap; ChatFeedView consumes these when it
    /// builds the /chats URL. Static rather than published because the
    /// cold-start tap arrives before any SwiftUI view exists to observe
    /// anything.
    ///
    /// A TAP OPENS THE CHAT IT CAME FROM (Aug 2026, Sophie: "I click on the
    /// notification, it lands me in the updates tab, but that notification is
    /// already gone because clicking the notification gets rid of it"). v1
    /// always opened the Update tab, on the reasoning that the push is that
    /// tab's doorbell — but iOS consumes the banner on tap, so landing on a
    /// LIST left her with no way to tell which chat had just spoken. The
    /// payload has always carried the chat; now it is used. The Update tab is
    /// still one tap away, and it is the fallback when a push predates this
    /// (no `chat` in its payload).
    static var pendingChat: String?
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

    /// Foregrounded: draw the banner anyway, silently (see the note above).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list])
    }

    /// Tapped: open on the Update tab. The flag is read by ChatFeedView when
    /// it builds its URL; the NotificationCenter post covers the warm case
    /// where the app (and the Chats web view) already exist.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let chat = response.notification.request.content.userInfo["chat"] as? String
        // "push-test" is the /api/push/test send, which belongs to no chat —
        // that one still lands on the Update tab.
        Self.pendingChat = (chat == "push-test") ? nil : chat
        Self.pendingUpdateTab = (Self.pendingChat == nil)
        NotificationCenter.default.post(name: .forgePushOpenUpdate, object: nil)
        completionHandler()
    }
}

extension Notification.Name {
    /// A push was tapped — RootView switches to the Chats screen, ChatFeedView
    /// reloads onto the Update tab.
    static let forgePushOpenUpdate = Notification.Name("forgePushOpenUpdate")
}

import SwiftUI
import UIKit          // willEnterForegroundNotification (the widget handoff below)
import FirebaseCore
import CoreText

@main
struct ImageForgeApp: App {
    // Push registration + notification taps (PushDelegate.swift). The adaptor
    // is what gives a SwiftUI app the UIApplicationDelegate callbacks APNs
    // delivers its device token through.
    @UIApplicationDelegateAdaptor(PushDelegate.self) private var pushDelegate

    init() {
        FirebaseApp.configure()
        Self.registerBundledFonts()
        Self.shareSettingsWithWidget()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.light)   // system menus/alerts match the paper theme
                // …and again whenever she comes back, so a token or server
                // change made in Settings reaches the widget without waiting
                // for the next cold launch.
                .onReceive(NotificationCenter.default.publisher(
                    for: UIApplication.willEnterForegroundNotification)) { _ in
                    Self.shareSettingsWithWidget()
                }
        }
    }

    /// Copy the server URL + studio token into the shared App Group so the
    /// WIDGET can call the server (ForgeWidget.swift). A widget extension has
    /// its own container and cannot read the app's UserDefaults — without
    /// this it can only ever hit the default server unauthenticated, which
    /// breaks the moment STUDIO_TOKEN is switched on.
    static func shareSettingsWithWidget() {
        guard let shared = UserDefaults(suiteName: "group.com.sageryza.imageforge") else { return }
        let std = UserDefaults.standard
        shared.set(std.string(forKey: "forge.serverURL") ?? "", forKey: "forge.serverURL")
        shared.set(std.string(forKey: "forge.studioToken") ?? "", forKey: "forge.studioToken")
    }

    /// Register any .ttf shipped in the app bundle (e.g. EB Garamond) so we can
    /// use it with Font.custom without an Info.plist UIAppFonts entry.
    static func registerBundledFonts() {
        for url in Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) ?? [] {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

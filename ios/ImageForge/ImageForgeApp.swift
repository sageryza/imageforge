import SwiftUI
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
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.light)   // system menus/alerts match the paper theme
        }
    }

    /// Register any .ttf shipped in the app bundle (e.g. EB Garamond) so we can
    /// use it with Font.custom without an Info.plist UIAppFonts entry.
    static func registerBundledFonts() {
        for url in Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) ?? [] {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

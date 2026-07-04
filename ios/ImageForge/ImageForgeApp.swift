import SwiftUI
import FirebaseCore
import CoreText

@main
struct ImageForgeApp: App {
    init() {
        FirebaseApp.configure()
        Self.registerBundledFonts()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
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

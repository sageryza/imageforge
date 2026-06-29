import SwiftUI
import FirebaseCore

@main
struct ImageForgeApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            TabView {
                StickerView()
                    .tabItem { Label("Stickers", systemImage: "sparkles") }
                TestStationView()
                    .tabItem { Label("Test Station", systemImage: "wand.and.stars") }
            }
            .tint(Theme.accent)
        }
    }
}

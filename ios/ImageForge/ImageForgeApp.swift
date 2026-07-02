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
                TestStationView()
                    .tabItem { Label("Test Station", systemImage: "wand.and.stars") }
                MovieMakerHome()
                    .tabItem { Label("Movies", systemImage: "film") }
            }
        }
    }
}

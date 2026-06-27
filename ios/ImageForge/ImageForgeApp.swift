import SwiftUI
import FirebaseCore

@main
struct ImageForgeApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            TestStationView()
        }
    }
}

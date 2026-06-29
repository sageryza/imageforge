import SwiftUI

/// Home screen: a grid of project types. Each card pushes its focused tool.
/// New types slot in as more cards rather than crowding a tab bar.
struct HubView: View {
    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: grid, spacing: 14) {
                    NavigationLink(destination: StickerView()) {
                        HubCard(icon: "sparkles", title: "Sticker Page",
                                desc: "A full sheet of stickers — tap any to redo it.")
                    }
                    NavigationLink(destination: ColoringView()) {
                        HubCard(icon: "pencil.and.outline", title: "Coloring Pages",
                                desc: "Printable black-and-white line art to color.")
                    }
                    NavigationLink(destination: CreationsView()) {
                        HubCard(icon: "square.grid.2x2", title: "My Creations",
                                desc: "Everything you've made, in one grid.")
                    }
                    NavigationLink(destination: TestStationView()) {
                        HubCard(icon: "wand.and.stars", title: "Test Station",
                                desc: "Run one prompt through the house styles.")
                    }
                }
                .padding()
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Deck Factory")
        }
        .tint(Theme.accent)
    }
}

private struct HubCard: View {
    let icon: String
    let title: String
    let desc: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).font(.system(size: 26)).foregroundColor(Theme.accent)
            Text(title).font(.headline).foregroundColor(Theme.text)
            Text(desc).font(.caption).foregroundColor(Theme.textDim)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 124, alignment: .topLeading)
        .padding(16)
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }
}

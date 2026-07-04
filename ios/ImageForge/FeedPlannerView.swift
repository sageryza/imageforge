import SwiftUI

/// Feed planner — previews your Instagram posts as a 3-wide profile grid, newest
/// first, cropped the way Instagram crops feed posts (~3:4) so you can eyeball
/// cohesion before posting. Aiming for an alternating rhythm (flat-lay, meme,
/// flat-lay…) reads as an intentional, on-brand feed.
struct FeedPlannerView: View {
    let posts: [Creation]
    private let cols = [
        GridItem(.flexible(), spacing: 2),
        GridItem(.flexible(), spacing: 2),
        GridItem(.flexible(), spacing: 2),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("This mirrors your Instagram profile grid — three across, newest first, cropped the way Instagram crops feed thumbnails. Alternating flat-lays and memes/quotes (a checkerboard rhythm) keeps the grid cohesive.")
                    .font(.caption).foregroundColor(Theme.textDim)
                    .padding(.horizontal)

                LazyVGrid(columns: cols, spacing: 2) {
                    ForEach(posts) { p in
                        Color.clear
                            .aspectRatio(3.0 / 4.0, contentMode: .fit)
                            .overlay(
                                AsyncImage(url: p.url) { phase in
                                    switch phase {
                                    case .success(let image): image.resizable().scaledToFill()
                                    default: Rectangle().fill(Theme.surface2)
                                    }
                                }
                            )
                            .clipped()
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Feed Planner")
        .navigationBarTitleDisplayMode(.inline)
    }
}

import SwiftUI

/// The past-dreams archive — every rendered dream page, two to a row. Reached
/// from the moon button on the Dreams screen. Newest dream first.
struct DreamArchiveView: View {
    @State private var pages: [DreamPage] = []
    @State private var loading = true

    private let columns = [GridItem(.flexible(), spacing: 10),
                           GridItem(.flexible(), spacing: 10)]

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
            } else if pages.isEmpty {
                Text("No dreams yet — illustrate one and it'll show up here.")
                    .font(.callout).foregroundColor(Theme.textDim)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity).padding(.horizontal, 40).padding(.top, 60)
            } else {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(pages) { page in pageTile(page.pageURL) }
                }
                .padding(12)
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Past dreams")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let all = await MovieService.shared.allDreamsFull()
            // Newest first, all pages flattened.
            pages = all
                .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
                .flatMap { $0.pages ?? [] }
            loading = false
        }
    }

    private func pageTile(_ url: URL?) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image): image.resizable().scaledToFit()
            case .failure:
                Image(systemName: "exclamationmark.triangle")
                    .foregroundColor(Theme.danger)
                    .frame(maxWidth: .infinity).frame(height: 220)
            default:
                ProgressView().frame(maxWidth: .infinity).frame(height: 220)
            }
        }
        .frame(maxWidth: .infinity)
        .background(Color.white)
        .cornerRadius(Theme.radius)
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
    }
}

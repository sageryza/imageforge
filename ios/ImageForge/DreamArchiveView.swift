import SwiftUI

/// The past-dreams archive — every rendered dream page, two to a row. Reached
/// from the moon button on the Dreams screen. Newest dream first.
struct DreamArchiveView: View {
    @State private var items: [DreamPageRef] = []
    @State private var loading = true
    @State private var selected: DreamPageRef?

    private let columns = [GridItem(.flexible(), spacing: 10),
                           GridItem(.flexible(), spacing: 10)]

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
            } else if items.isEmpty {
                Text("No dreams yet — illustrate one and it'll show up here.")
                    .font(.callout).foregroundColor(Theme.textDim)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity).padding(.horizontal, 40).padding(.top, 60)
            } else {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(items) { item in
                        Button {
                            AutoScrollDriver.shared.stop()
                            selected = item
                        } label: { pageTile(item.url) }
                        .buttonStyle(.plain)
                    }
                }
                .padding(12)
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Past dreams")
        .navigationBarTitleDisplayMode(.inline)
        .overlay { if let sel = selected { DreamPagePopup(ref: sel) { selected = nil } } }
        .task {
            let all = await MovieService.shared.allDreamsFull()
            // Newest dream first; every page carries its dream's written text so
            // the popup can show the words behind the picture.
            items = all
                .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
                .flatMap { d in (d.pages ?? []).map {
                    DreamPageRef(id: $0.url, url: $0.pageURL, title: d.title, dreamText: d.dream)
                } }
            loading = false
        }
    }

    private func pageTile(_ url: URL?) -> some View {
        Group {
            if let url { CachedImageView(url: url, contentMode: .fit) }
            else { Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger) }
        }
        .frame(maxWidth: .infinity, minHeight: 200)
        .background(Color.white)
        .cornerRadius(Theme.radius)
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
    }
}

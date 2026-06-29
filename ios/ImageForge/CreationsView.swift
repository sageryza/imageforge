import SwiftUI

/// A grid of everything you've made. Reads the server-saved creations list, so
/// generations show up here even if a connection dropped or the app was
/// backgrounded mid-generation.
struct CreationsView: View {
    @State private var creations: [Creation] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var preview: Creation?

    private let grid = [GridItem(.adaptive(minimum: 110), spacing: 10)]

    var body: some View {
        ScrollView {
            if loading && creations.isEmpty {
                ProgressView().padding(.top, 60)
            } else if creations.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "square.grid.2x2")
                        .font(.system(size: 34)).foregroundColor(Theme.textDim)
                    Text("Nothing yet").font(.headline).foregroundColor(Theme.text)
                    Text("Sheets and pages you make show up here.")
                        .font(.caption).foregroundColor(Theme.textDim)
                }
                .frame(maxWidth: .infinity).padding(.top, 60)
            } else {
                LazyVGrid(columns: grid, spacing: 10) {
                    ForEach(creations) { c in
                        Button { preview = c } label: { tile(c) }
                            .buttonStyle(.plain)
                    }
                }
                .padding()
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("My Creations")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise") }
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .alert("Couldn't load",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .sheet(item: $preview) { c in previewSheet(c) }
    }

    private func tile(_ c: Creation) -> some View {
        AsyncImage(url: c.url) { phase in
            switch phase {
            case .success(let img): img.resizable().scaledToFill()
            case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
            default: ProgressView()
            }
        }
        .frame(height: 150).frame(maxWidth: .infinity).clipped()
        .background(Color.white)
        .cornerRadius(Theme.radius)
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
    }

    private func previewSheet(_ c: Creation) -> some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AsyncImage(url: c.url) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFit().background(Color.white).cornerRadius(Theme.radius)
                        default: ProgressView().padding(40)
                        }
                    }
                    if let p = c.prompt, !p.isEmpty {
                        Text(p).font(.caption).foregroundColor(Theme.textDim)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ShareLink(item: c.url) {
                        Label("Share / Save", systemImage: "square.and.arrow.up")
                            .font(.subheadline.weight(.medium)).foregroundColor(Theme.accent)
                    }
                }
                .padding()
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle(c.type.capitalized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { preview = nil }
                }
            }
        }
        .tint(Theme.accent)
    }

    private func load() async {
        loading = true
        do { creations = try await ForgeService.shared.fetchCreations() }
        catch { errorText = error.localizedDescription }
        loading = false
    }
}

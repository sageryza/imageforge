import SwiftUI
import UIKit

/// A grid of everything you've made. Reads the server-saved creations list, so
/// generations show up here even if a connection dropped or the app was
/// backgrounded mid-generation.
struct CreationsView: View {
    @State private var creations: [Creation] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var preview: Creation?
    @State private var filter: String? = nil   // nil = show everything
    @State private var editable: EditableSheet?
    @State private var openingEditor = false

    private let grid = [GridItem(.adaptive(minimum: 110), spacing: 10)]

    /// A saved sheet pulled back out for editing: its image + re-detected boxes.
    struct EditableSheet: Identifiable {
        let id = UUID()
        let creationURL: URL
        let image: UIImage
        let boxes: [StickerBox]
    }

    /// Types present in the user's creations, in a friendly fixed order.
    private var types: [String] {
        let present = Set(creations.map { $0.type })
        let order = ["sticker", "coloring", "storybook", "card", "dream", "instagram"]
        var out = order.filter { present.contains($0) }
        for t in present.sorted() where !out.contains(t) { out.append(t) }
        return out
    }

    private var filtered: [Creation] {
        guard let f = filter else { return creations }
        return creations.filter { $0.type == f }
    }

    var body: some View {
        VStack(spacing: 0) {
            if types.count > 1 { filterBar }
            ScrollView {
                if loading && creations.isEmpty {
                    ProgressView().padding(.top, 60)
                } else if creations.isEmpty {
                    emptyState(title: "Nothing yet",
                               subtitle: "Sheets and pages you make show up here.")
                } else if filtered.isEmpty {
                    emptyState(title: "None of those yet",
                               subtitle: "Nothing in this category — try another filter.")
                } else {
                    LazyVGrid(columns: grid, spacing: 10) {
                        ForEach(filtered) { c in
                            Button { preview = c } label: { tile(c) }
                                .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
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
        .fullScreenCover(item: $editable) { e in
            StickerEditor(
                sheetImage: e.image,
                boxes: e.boxes,
                onClose: { editable = nil },
                onSaved: { _ in Task { await load() } })   // edited copy → refresh grid
        }
        .overlay {
            if openingEditor {
                ZStack {
                    Color.black.opacity(0.25).ignoresSafeArea()
                    ProgressView("Opening editor…").padding(20)
                        .background(Theme.surface).cornerRadius(Theme.radiusLg)
                }
            }
        }
    }

    // Horizontal row of rounded-rect filter chips (no pills): All + one per type.
    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("All", active: filter == nil) { filter = nil }
                ForEach(types, id: \.self) { t in
                    chip(Self.typeLabel(t), active: filter == t) { filter = t }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
    }

    private func chip(_ label: String, active: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundColor(active ? .white : Theme.text)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(active ? Theme.mauve : Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                    .stroke(active ? Color.clear : Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func emptyState(title: String, subtitle: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "square.grid.2x2")
                .font(.system(size: 34)).foregroundColor(Theme.textDim)
            Text(title).font(.headline).foregroundColor(Theme.text)
            Text(subtitle).font(.caption).foregroundColor(Theme.textDim)
        }
        .frame(maxWidth: .infinity).padding(.top, 60)
    }

    /// Friendly label for a stored creation type.
    static func typeLabel(_ t: String) -> String {
        switch t {
        case "sticker":   return "Stickers"
        case "coloring":  return "Coloring"
        case "storybook": return "Storybook"
        case "card":      return "Cards"
        case "dream":     return "Dreams"
        case "instagram": return "Instagram"
        default:          return t.capitalized
        }
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
                    if c.type == "sticker" {
                        Button { openForEdit(c) } label: {
                            Label("Edit stickers", systemImage: "wand.and.stars")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity).frame(height: 46)
                                .background(Theme.mauve)
                                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                        }
                        .buttonStyle(.plain)
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

    /// Pull a saved sheet back out: download it, re-detect the sticker boxes
    /// (off the main thread), then open the tap-to-redo editor.
    private func openForEdit(_ c: Creation) {
        guard !openingEditor else { return }
        let url = c.url
        preview = nil
        openingEditor = true
        Task {
            defer { openingEditor = false }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard let img = UIImage(data: data) else {
                    errorText = "Couldn't open that sheet."; return
                }
                let boxes = await Task.detached(priority: .userInitiated) {
                    StickerSegmenter.boxes(from: img)
                }.value
                guard !boxes.isEmpty else {
                    errorText = "Couldn't pick out individual stickers on this sheet."; return
                }
                editable = EditableSheet(creationURL: url, image: img, boxes: boxes)
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    private func load() async {
        loading = true
        do {
            creations = try await ForgeService.shared.fetchCreations()
            if let f = filter, !creations.contains(where: { $0.type == f }) { filter = nil }
        }
        catch { errorText = error.localizedDescription }
        loading = false
    }
}

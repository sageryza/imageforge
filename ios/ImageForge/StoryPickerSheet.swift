import SwiftUI

/// The shared story library. Three of the media are stories wearing different
/// clothes (Movies, Storybook, the zine), so stories live in one place: save
/// one here and use it anywhere. Pick a saved story — or paste a new one and
/// optionally save it — and it's handed to whichever tool opened the sheet.
struct StoryPickerSheet: View {
    var onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var stories: [SavedStory] = []
    @State private var loading = true
    @State private var draft = ""
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    composeBox
                    savedSection
                }
                .padding()
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Stories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }.foregroundColor(Theme.accent)
                }
            }
            .alert("Story trouble", isPresented: Binding(get: { errorText != nil },
                                                         set: { if !$0 { errorText = nil } })) {
                Button("OK", role: .cancel) { errorText = nil }
            } message: { Text(errorText ?? "") }
            .task { await load() }
        }
        .tint(Theme.accent)
    }

    // MARK: New story

    private var composeBox: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("…", text: $draft, axis: .vertical)
                .lineLimit(4...10).font(.body).foregroundColor(Theme.text)
                .padding(12).background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
            HStack(spacing: 8) {
                Button { saveDraft(andUse: false) } label: {
                    Text("Save")
                        .font(.subheadline.weight(.semibold)).foregroundColor(Theme.text)
                        .padding(.horizontal, 16).frame(height: 44)
                        .background(Theme.surface)
                        .cornerRadius(Theme.radius)
                        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                }
                Button { saveDraft(andUse: true) } label: {
                    Text("Save & use")
                        .font(.subheadline.weight(.semibold)).foregroundColor(.white)
                        .padding(.horizontal, 16).frame(height: 44)
                        .background(Theme.mauve).cornerRadius(Theme.radius)
                }
                Spacer()
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    // MARK: Saved stories

    private var savedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if loading {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 8)
            } else if stories.isEmpty {
                Text("…").font(.body).foregroundColor(Theme.textDim)
                    .frame(maxWidth: .infinity, alignment: .center).padding(.top, 8)
            }
            ForEach(stories) { story in
                Button {
                    onPick(story.text)
                    dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(story.title).font(.subheadline.weight(.semibold)).foregroundColor(Theme.text)
                        Text(story.text).font(.caption).foregroundColor(Theme.textDim)
                            .lineLimit(3).multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(Theme.surface)
                    .cornerRadius(Theme.radiusLg)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button(role: .destructive) {
                        Task {
                            try? await MovieService.shared.storyDelete(story.id)
                            stories.removeAll { $0.id == story.id }
                        }
                    } label: { Label("Delete story", systemImage: "trash") }
                }
            }
        }
    }

    // MARK: Actions

    private func load() async {
        do { stories = try await MovieService.shared.storyList() }
        catch { errorText = error.localizedDescription }
        loading = false
    }

    private func saveDraft(andUse: Bool) {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        Task {
            do {
                let saved = try await MovieService.shared.storySave(text: text)
                stories.insert(saved, at: 0)
                draft = ""
                if andUse {
                    onPick(saved.text)
                    dismiss()
                }
            } catch { errorText = error.localizedDescription }
        }
    }
}

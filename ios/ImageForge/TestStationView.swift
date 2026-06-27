import SwiftUI

/// The Style Machine — type one prompt, run it through any house style (or
/// several at once) and compare. The iOS sibling of the web /test page.
struct TestStationView: View {
    @State private var prompt = ""
    @State private var selected: Set<String> = []
    @State private var results: [ForgeResult] = []
    @State private var busy = false
    @State private var errorText: String?

    private let grid = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    intro
                    promptField
                    stylesSection
                    if !selected.isEmpty { runSelectedButton }
                    if !results.isEmpty { resultsSection }
                }
                .padding()
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Test Station")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Couldn't generate",
                   isPresented: Binding(get: { errorText != nil },
                                        set: { if !$0 { errorText = nil } })) {
                Button("OK", role: .cancel) { errorText = nil }
            } message: {
                Text(errorText ?? "")
            }
        }
        .tint(Theme.accent)
    }

    // MARK: - Sections

    private var intro: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("The Style Machine")
                .font(.title3.weight(.semibold))
                .foregroundColor(Theme.text)
            Text("Type one prompt, then tap a style to see it rendered that way. Your prompt stays put — tap another style, or tick a few and run them together to compare.")
                .font(.footnote)
                .foregroundColor(Theme.textDim)
        }
    }

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PROMPT")
                .font(.caption2.weight(.semibold))
                .tracking(1)
                .foregroundColor(Theme.textDim)
            TextField("a teapot on a windowsill, a castle on a hill…",
                      text: $prompt, axis: .vertical)
                .lineLimit(2...5)
                .font(.body)
                .foregroundColor(Theme.text)
                .padding(12)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                    .stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
        }
    }

    private var stylesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("STYLES")
                .font(.caption2.weight(.semibold))
                .tracking(1)
                .foregroundColor(Theme.textDim)
            LazyVGrid(columns: grid, spacing: 12) {
                ForEach(ForgeStyles.all) { style in
                    StyleTile(
                        style: style,
                        isSelected: selected.contains(style.id),
                        onRun: { run([style]) },
                        onToggle: { toggle(style.id) }
                    )
                }
            }
        }
    }

    private var runSelectedButton: some View {
        Button {
            run(ForgeStyles.all.filter { selected.contains($0.id) })
        } label: {
            Text("Run \(selected.count) selected")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.accent)
                .foregroundColor(Theme.bg)
                .cornerRadius(Theme.radius)
        }
        .disabled(busy)
        .opacity(busy ? 0.5 : 1)
    }

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("RESULTS")
                    .font(.caption2.weight(.semibold))
                    .tracking(1)
                    .foregroundColor(Theme.textDim)
                Spacer()
                Button("Clear") { results.removeAll() }
                    .font(.caption)
                    .foregroundColor(Theme.accent)
            }
            LazyVGrid(columns: grid, spacing: 12) {
                ForEach(results) { ResultCard(result: $0) }
            }
        }
    }

    // MARK: - Actions

    private func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    /// Render the current prompt through each style, sequentially (kind to
    /// Replicate/OpenAI rate limits), prepending a result card per style.
    private func run(_ styles: [ForgeStyle]) {
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Enter a prompt first."; return }
        guard !busy else { return }
        busy = true
        Task {
            for style in styles {
                let result = ForgeResult(styleId: style.id, styleName: style.name, prompt: text)
                results.insert(result, at: 0)
                do {
                    let url = try await ForgeService.shared.generate(prompt: text, styleId: style.id)
                    update(result.id) { $0.url = url }
                } catch {
                    update(result.id) { $0.error = error.localizedDescription }
                }
            }
            busy = false
        }
    }

    private func update(_ id: UUID, _ change: (inout ForgeResult) -> Void) {
        guard let i = results.firstIndex(where: { $0.id == id }) else { return }
        change(&results[i])
    }
}

// MARK: - Style tile

private struct StyleTile: View {
    let style: ForgeStyle
    let isSelected: Bool
    let onRun: () -> Void
    let onToggle: () -> Void

    var body: some View {
        Button(action: onRun) {
            ZStack(alignment: .bottomLeading) {
                // Sample preview (committed) or a soft placeholder.
                if let url = style.sampleURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFill()
                        default: placeholder
                        }
                    }
                } else {
                    placeholder
                }

                LinearGradient(colors: [.black.opacity(0.55), .clear],
                               startPoint: .bottom, endPoint: .center)

                Text(style.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)
                    .shadow(radius: 2)
                    .padding(10)
            }
            .frame(height: 150)
            .frame(maxWidth: .infinity)
            .clipped()
            .cornerRadius(Theme.radiusLg)
            .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg)
                .stroke(isSelected ? Theme.accent : Theme.border,
                        lineWidth: isSelected ? 2 : 1))
            .overlay(alignment: .topTrailing) { selectToggle }
        }
        .buttonStyle(.plain)
    }

    private var placeholder: some View {
        LinearGradient(colors: [Theme.surface2, Theme.accentDim.opacity(0.4)],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private var selectToggle: some View {
        Button(action: onToggle) {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundColor(isSelected ? Theme.accent : .white)
                .shadow(radius: 2)
                .padding(8)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Result card

private struct ResultCard: View {
    let result: ForgeResult

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                Rectangle().fill(Theme.surface2)
                if let url = result.url {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFill()
                        case .failure: Image(systemName: "exclamationmark.triangle")
                            .foregroundColor(Theme.danger)
                        default: ProgressView()
                        }
                    }
                } else if let error = result.error {
                    Text(error).font(.caption2).foregroundColor(Theme.danger)
                        .multilineTextAlignment(.center).padding(8)
                } else {
                    ProgressView()
                }
            }
            .frame(height: 150)
            .frame(maxWidth: .infinity)
            .clipped()

            VStack(alignment: .leading, spacing: 3) {
                Text(result.styleName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(Theme.text)
                Text(result.prompt)
                    .font(.caption2)
                    .foregroundColor(Theme.textDim)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
        }
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }
}

import SwiftUI

/// The Style Machine — type one prompt, run it through any house style (or
/// several at once) and compare. Native SwiftUI again (the WKWebView era is
/// over): the style list is FETCHED from the server's `/api/models` on open,
/// so new styles still ship with a Render deploy — no app build — while the
/// screen itself keeps the app theme and responsiveness. A baked-in fallback
/// list renders instantly when the server is cold or unreachable; the fetch
/// replaces it the moment it lands. Generation goes through the same open
/// endpoints the /test web page uses, so results match exactly.
struct TestStationView: View {
    @State private var prompt = ""
    @State private var styles: [TestStyle] = TestStyle.fallback
    @State private var selected: Set<String> = []
    @State private var results: [ForgeResult] = []
    @State private var busy = false
    @State private var errorText: String?
    @State private var replicateOpen = false

    // App Store Guideline 5.1.2(i): one-time consent before sending the prompt
    // to third-party AI (Replicate / OpenAI). Gated in run().
    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @State private var pendingStyles: [TestStyle] = []
    @FocusState private var promptFocused: Bool
    @Environment(\.goHome) private var goHome
    @Environment(\.openTool) private var openTool

    // Three across.
    private let grid = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)

    // The web page's arrangement, kept: ChatGPT + House tiles up top (what
    // gets used now), the Replicate LoRAs tucked behind a disclosure.
    private var primaryStyles: [TestStyle] { styles.filter { $0.provider != .replicate } }
    private var replicateStyles: [TestStyle] { styles.filter { $0.provider == .replicate } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                StarTitle(text: "Test Station").frame(maxWidth: .infinity).padding(.top, 4)
                promptField
                if !results.isEmpty { resultsSection }   // image(s) above the styles
                stylesSection
                if !selected.isEmpty { runSelectedButton }
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .task { await refreshStyles() }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { promptFocused = false }
            }
            // Home (back to the module grid) top-left; Chats top-right —
            // Test Station's entry point is a home-screen corner icon, so it
            // carries the matching corner nav.
            ToolbarItem(placement: .navigationBarLeading) {
                Button { goHome() } label: {
                    Image(systemName: "house")
                        .font(.system(size: 18))
                        .foregroundColor(Theme.accent)
                }
                .accessibilityLabel("Back to all the modules")
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { openTool(.chats) } label: {
                    Image(systemName: Tool.chats.icon)
                        .font(.system(size: 18))
                        .foregroundColor(Theme.accent)
                }
                .accessibilityLabel("Chats")
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Couldn't generate",
               isPresented: Binding(get: { errorText != nil },
                                    set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: {
            Text(errorText ?? "")
        }
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [
                    AIProvider(name: "Replicate", role: "Generates your images (house styles)"),
                    AIProvider(name: "OpenAI", role: "Generates your images (ChatGPT / gpt-image-2)"),
                ],
                dataDescription: "the prompt you enter",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run(pendingStyles) },
                onCancel: { showConsent = false })
        }
    }

    // MARK: - Sections

    private var promptField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PROMPT")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            TextField("a teapot on a windowsill, a castle on a hill…",
                      text: $prompt, axis: .vertical)
                .lineLimit(2...5)
                .font(.body)
                .foregroundColor(Theme.text)
                .focused($promptFocused)
                .padding(12)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
        }
    }

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("RESULT")
                    .font(.caption2.weight(.semibold)).tracking(1)
                    .foregroundColor(Theme.textDim)
                Spacer()
                Button("Clear") { results.removeAll() }
                    .font(.caption).foregroundColor(Theme.accent)
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                ForEach(results) { ResultCard(result: $0) }
            }
        }
    }

    private var stylesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("STYLES")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            LazyVGrid(columns: grid, spacing: 8) {
                ForEach(primaryStyles) { style in
                    StyleTile(
                        style: style,
                        isSelected: selected.contains(style.id),
                        onRun: { run([style]) },
                        onToggle: { toggle(style.id) }
                    )
                }
            }
            if !replicateStyles.isEmpty {
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { replicateOpen.toggle() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: replicateOpen ? "chevron.down" : "chevron.right")
                            .font(.caption2.weight(.semibold))
                        Text("Replicate styles (\(replicateStyles.count))")
                            .font(.caption.weight(.medium))
                    }
                    .foregroundColor(Theme.textDim)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
                if replicateOpen {
                    LazyVGrid(columns: grid, spacing: 8) {
                        ForEach(replicateStyles) { style in
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
        }
    }

    private var runSelectedButton: some View {
        Button {
            run(styles.filter { selected.contains($0.id) })
        } label: {
            Text("Run \(selected.count) selected")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.mauve)
                .foregroundColor(.white)
                .cornerRadius(Theme.radius)
        }
        .disabled(busy)
        .opacity(busy ? 0.5 : 1)
    }

    // MARK: - Actions

    private func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    private func run(_ chosen: [TestStyle]) {
        promptFocused = false   // dismiss the keyboard
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Enter a prompt first."; return }
        guard !busy else { return }
        // Gate the first AI call behind the consent sheet (5.1.2(i)).
        guard aiConsentAccepted else { pendingStyles = chosen; showConsent = true; return }
        busy = true
        Task {
            // Sequential, like the web page — friendly to Replicate rate limits.
            for style in chosen {
                let result = ForgeResult(styleId: style.id, styleName: style.name, prompt: text)
                results.insert(result, at: 0)
                do {
                    let url = try await TestStationAPI.generate(prompt: text, style: style)
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

    /// Swap the baked-in fallback for the server's live style list. Silent on
    /// failure — the fallback already renders, and a cold Render start (30–60s)
    /// must never leave the screen empty.
    private func refreshStyles() async {
        guard let fetched = try? await TestStationAPI.fetchStyles(), !fetched.isEmpty else { return }
        styles = fetched
        selected = selected.filter { id in fetched.contains { $0.id == id } }
    }
}

// MARK: - Styles (fetched from the server)

/// One selectable style. Mirrors an entry of the server's MODELS
/// (`GET /api/models`) — the server stays the single source of truth; this app
/// never hardcodes which styles exist beyond the offline fallback below.
struct TestStyle: Identifiable, Hashable {
    enum Provider: String { case replicate, openai, house }
    let id: String
    let name: String
    let provider: Provider
    var quality: String?

    /// Committed preview shipped at /samples/<seg>.webp (seg = the id's last
    /// path component, e.g. "sageryza/gosh" → gosh.webp). Styles with no
    /// committed preview (gpt-image-2) just show the flat placeholder.
    /// @MainActor because MovieService (and its serverURL) is MainActor-bound.
    @MainActor var sampleURL: URL? {
        guard let seg = id.split(separator: "/").last else { return nil }
        return URL(string: MovieService.serverURL + "/samples/\(seg).webp")
    }

    /// Offline / cold-start fallback — a snapshot of MODELS as of Aug 2026.
    /// Replaced by the live list as soon as /api/models answers.
    static let fallback: [TestStyle] = [
        TestStyle(id: "gpt-image-2", name: "ChatGPT (gpt-image-2)", provider: .openai, quality: "low"),
        TestStyle(id: "house-pastel", name: "Pastel (house)", provider: .house),
        TestStyle(id: "sageryza/gosh", name: "Gouache", provider: .replicate),
        TestStyle(id: "sageryza/paint", name: "Painterly", provider: .replicate),
        TestStyle(id: "sageryza/special", name: "Sketchy", provider: .replicate),
        TestStyle(id: "sageryza/victorianstyle", name: "Book Illustrations", provider: .replicate),
        TestStyle(id: "sageryza/watercolordrawings", name: "Watercolor Drawings", provider: .replicate),
        TestStyle(id: "sageryza/pwcscans", name: "PWC Scans", provider: .replicate),
        TestStyle(id: "sageryza/hoonie", name: "Hoonie Linocut", provider: .replicate),
    ]
}

// MARK: - Server calls (the same open endpoints the /test web page uses)

enum TestStationAPI {
    struct ServerError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    /// The web page's default background suffix for GPT/Replicate runs; house
    /// styles control their own background so they don't get it.
    private static let bgSuffix = "centered on a white background"

    @MainActor
    static func fetchStyles() async throws -> [TestStyle] {
        guard let url = URL(string: MovieService.serverURL + "/api/models") else { return [] }
        var req = URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 20)
        req.httpMethod = "GET"
        let (data, _) = try await URLSession.shared.data(for: req)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        func entries(_ key: String, _ provider: TestStyle.Provider) -> [TestStyle] {
            ((json[key] as? [[String: Any]]) ?? []).compactMap { m in
                guard let id = m["id"] as? String, let name = m["name"] as? String else { return nil }
                return TestStyle(id: id, name: name, provider: provider, quality: m["quality"] as? String)
            }
        }
        // Primary tiles first (openai + house), then the Replicate LoRAs —
        // the generic DALL·E entry isn't a "style", same as the web page.
        return entries("openai", .openai) + entries("house", .house) + entries("replicate", .replicate)
    }

    /// Render `prompt` in `style` and return the permanent image URL.
    @MainActor
    static func generate(prompt: String, style: TestStyle) async throws -> URL {
        let path: String
        var body: [String: Any]
        switch style.provider {
        case .house:
            // gpt-image-2 EDITS with the house style refs — the style controls
            // the background, so no bg suffix here.
            path = "/api/generate/housestyle"
            body = ["prompt": prompt, "styleId": style.id]
        case .openai:
            path = "/api/generate/gptimage"
            body = ["prompt": "\(prompt), \(Self.bgSuffix)", "quality": style.quality ?? "low"]
        case .replicate:
            // The server prepends the LoRA trigger word and applies the model's
            // own promptSuffix / default steps.
            path = "/api/generate/replicate"
            body = ["prompt": "\(prompt), \(Self.bgSuffix)", "model": style.id]
        }
        guard let url = URL(string: MovieService.serverURL + path) else {
            throw ServerError(message: "Bad server URL.")
        }
        var req = URLRequest(url: url, timeoutInterval: 180)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: req)
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ServerError(message: "The server sent back something unreadable.")
        }
        if let err = json["error"] as? String { throw ServerError(message: err) }
        guard let urlString = json["url"] as? String, let out = URL(string: urlString) else {
            throw ServerError(message: "No image was returned.")
        }
        return out
    }
}

// MARK: - Style swatch (wide, zoomed into the linework; centered label)

private struct StyleTile: View {
    let style: TestStyle
    let isSelected: Bool
    let onRun: () -> Void
    let onToggle: () -> Void

    var body: some View {
        Button(action: onRun) {
            ZStack {
                // Zoomed crop of the sample so the line/paint texture shows,
                // not the whole subject.
                if let url = style.sampleURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill().scaleEffect(1.7)
                        default: placeholder
                        }
                    }
                } else {
                    placeholder
                }

                // Centered, standout label (rounded rect — not a pill).
                Text(style.name)
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 7).padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: 6).fill(.black.opacity(0.5)))
                    .padding(4)
            }
            .frame(height: 64)
            .frame(maxWidth: .infinity)
            .clipped()
            .cornerRadius(Theme.radius)
            .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                .stroke(isSelected ? Theme.accent : Theme.border, lineWidth: isSelected ? 2.5 : 1))
            .overlay(alignment: .topTrailing) {
                Button(action: onToggle) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.caption)
                        .foregroundColor(isSelected ? Theme.accent : .white)
                        .shadow(radius: 2)
                        .padding(4)
                }
                .buttonStyle(.plain)
            }
        }
        .buttonStyle(.plain)
    }

    private var placeholder: some View {
        Rectangle().fill(Theme.surface2)
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
                        case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                        default: ProgressView()
                        }
                    }
                } else if let error = result.error {
                    Text(error).font(.caption2).foregroundColor(Theme.danger)
                        .multilineTextAlignment(.center).padding(8)
                } else if result.styleId.hasSuffix("hoonie") {
                    // HOONIE gets its own engraving loading animation.
                    Color.white
                    GIFView(name: "hoonie-loading", speed: 0.35).frame(width: 120, height: 120)
                } else {
                    ProgressView()
                }
            }
            .frame(height: 150).frame(maxWidth: .infinity).clipped()

            VStack(alignment: .leading, spacing: 3) {
                Text(result.styleName).font(.subheadline.weight(.semibold)).foregroundColor(Theme.text)
                Text(result.prompt).font(.caption2).foregroundColor(Theme.textDim).lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
        }
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }
}

import SwiftUI
import UserNotifications

/// Dreams — write down a dream and it's illustrated as a short hand-drawn
/// diary comic: GPT decides the beats + captions, and the pages render as 2x2
/// panels in the baked style with a locked character so the recurring figure
/// stays consistent. Kept as a journal. A daily ~11am local notification
/// nudges "What did you dream last night?".
struct DreamsView: View {
    @State private var text = ""
    @State private var busy = false
    @State private var statusLabel = ""
    @State private var current: Dream?           // the dream being illustrated now
    @State private var dreams: [DreamSummary] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var pollGeneration = 0

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @AppStorage("dreams.nudgeScheduled") private var nudgeScheduled = false
    @State private var showConsent = false
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                StarTitle(text: "Dreams").frame(maxWidth: .infinity).padding(.top, 4)
                inputSection
                if busy || current != nil { currentSection }
                journalSection
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focused = false }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadDreams()
            scheduleNudgeIfNeeded()
        }
        .onDisappear { pollGeneration += 1 }   // stop polling when we leave
        .alert("Couldn't illustrate",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [
                    AIProvider(name: "OpenAI", role: "Illustrates your dream (ChatGPT / gpt-image-2)"),
                ],
                dataDescription: "the dream you write",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: { aiConsentAccepted = true; showConsent = false; run() },
                onCancel: { showConsent = false })
        }
    }

    // MARK: - Sections

    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT DID YOU DREAM?")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            TextField("Last night I dreamed…", text: $text, axis: .vertical)
                .lineLimit(3...8)
                .font(.body)
                .foregroundColor(Theme.text)
                .focused($focused)
                .padding(12)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                .cornerRadius(Theme.radius)
            Button { run() } label: {
                Text(busy ? "Illustrating…" : "Illustrate this dream")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Theme.mauve)
                    .foregroundColor(.white)
                    .cornerRadius(Theme.radius)
            }
            .disabled(busy)
            .opacity(busy ? 0.6 : 1)
        }
    }

    /// The dream being illustrated right now: its pages once they land, with a
    /// progress note while the beats are still drawing.
    @ViewBuilder private var currentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let pages = current?.pages, !pages.isEmpty {
                ForEach(pages) { page in pageImage(page.pageURL) }
            }
            if busy { progressCard }
        }
    }

    private var progressCard: some View {
        HStack(spacing: 12) {
            ProgressView()
            Text(statusLabel.isEmpty ? "Illustrating…" : statusLabel)
                .font(.callout).foregroundColor(Theme.textDim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private var journalSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !dreams.isEmpty {
                Text("YOUR DREAM JOURNAL")
                    .font(.caption2.weight(.semibold)).tracking(1)
                    .foregroundColor(Theme.textDim)
            }
            if loading && dreams.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 20)
            }
            ForEach(dreams) { dream in DreamJournalCard(summary: dream) }
        }
    }

    private func pageImage(_ url: URL?) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image): image.resizable().scaledToFit()
            case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
            default: ProgressView().frame(height: 160)
            }
        }
        .frame(maxWidth: .infinity)
        .background(Color.white)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Actions

    private func run() {
        focused = false
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { errorText = "Write down your dream first."; return }
        guard !busy else { return }
        guard aiConsentAccepted else { showConsent = true; return }
        busy = true
        statusLabel = "Reading your dream…"
        current = nil
        Task {
            do {
                // 1. Breakdown (free): dream → beats + captions.
                let created = try await MovieService.shared.createDream(text: body)
                current = created
                // 2. Render the beats as comic pages (background job).
                statusLabel = "Drawing the character…"
                current = try await MovieService.shared.renderDream(created.id)
                // 3. Poll until the pages are done.
                await pollDream(created.id)
                text = ""
                await loadDreams()
                current = nil                 // it's in the journal now
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
            statusLabel = ""
        }
    }

    /// Poll the dream doc until its render job finishes, surfacing the job's
    /// own label ("drawing the character" → "drawing pages") as it goes.
    private func pollDream(_ id: String) async {
        pollGeneration += 1
        let generation = pollGeneration
        while generation == pollGeneration {
            do {
                let d = try await MovieService.shared.dream(id)
                current = d
                guard let job = d.job, job.isRunning else {
                    if d.job?.status == "error" { errorText = d.job?.error ?? "The render didn't finish." }
                    return
                }
                if let label = job.label, !label.isEmpty {
                    statusLabel = "\(label.prefix(1).uppercased())\(label.dropFirst())…"
                }
            } catch {
                errorText = error.localizedDescription
                return
            }
            try? await Task.sleep(nanoseconds: 3_200_000_000)
        }
    }

    private func loadDreams() async {
        loading = true
        if let all = try? await MovieService.shared.dreamList() { dreams = all }
        loading = false
    }

    /// Ask for notification permission once and schedule a daily 11am nudge.
    private func scheduleNudgeIfNeeded() {
        guard !nudgeScheduled else { return }
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            var when = DateComponents(); when.hour = 11; when.minute = 0
            let content = UNMutableNotificationContent()
            content.title = "Dreams"
            content.body = "What did you dream last night?"
            content.sound = .default
            let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: true)
            let req = UNNotificationRequest(identifier: "dream-nudge", content: content, trigger: trigger)
            center.removePendingNotificationRequests(withIdentifiers: ["dream-nudge"])
            center.add(req)
            DispatchQueue.main.async { nudgeScheduled = true }
        }
    }
}

/// A dream in the journal — lazy-loads its full pages, shows them stacked, with
/// the dream text beneath (tap to expand).
private struct DreamJournalCard: View {
    let summary: DreamSummary
    @State private var full: Dream?
    @State private var expanded = false

    private var caption: String { full?.dream ?? summary.title }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let pages = full?.pages, !pages.isEmpty {
                ForEach(pages) { page in pageImage(page.pageURL) }
            } else {
                // Poster (or a placeholder) while the full pages load.
                pageImage(summary.posterURL)
            }
            if !caption.isEmpty {
                Text(caption)
                    .font(.callout).foregroundColor(Theme.text)
                    .lineLimit(expanded ? nil : 3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .onTapGesture { withAnimation { expanded.toggle() } }
            }
        }
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
        .task { if full == nil { full = try? await MovieService.shared.dream(summary.id) } }
    }

    private func pageImage(_ url: URL?) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image): image.resizable().scaledToFit()
            case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
            default: ProgressView().frame(height: 160)
            }
        }
        .frame(maxWidth: .infinity)
        .background(Color.white)
    }
}

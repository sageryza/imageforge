import SwiftUI
import UserNotifications

/// Dreams — write down a dream and it's illustrated as a short hand-drawn
/// diary comic: GPT breaks it into beats + captions AND reconstructs the true
/// chronology from your cues, you get a quick "check the chronology" step to
/// nudge the order, then it renders as 2x2 comic pages in the baked style with
/// a locked character. Kept as a journal, with a daily ~11am nudge.
struct DreamsView: View {
    @State private var text = ""
    @State private var busy = false
    @State private var statusLabel = ""
    @State private var review: [DreamBeat] = []   // beats to check the chronology of
    @State private var reviewId: String?          // the dream being reviewed
    @State private var current: Dream?            // rendering / finished pages
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
                if reviewId != nil && current == nil {
                    chronologySection
                } else if busy || current != nil {
                    currentSection
                }
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

    /// The chronology check — dreams come out of order, so the breakdown's best
    /// guess at the real sequence, with ▲▼ to nudge any beat before drawing.
    private var chronologySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CHECK THE CHRONOLOGY")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            Text("Dreams come out of order. Nudge any beat into place, then draw.")
                .font(.footnote).foregroundColor(Theme.textDim)
            ForEach(Array(review.enumerated()), id: \.element.id) { idx, beat in
                beatRow(idx: idx, beat: beat)
            }
            Button { draw() } label: {
                Text("Draw it")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Theme.mauve)
                    .foregroundColor(.white)
                    .cornerRadius(Theme.radius)
            }
            .padding(.top, 2)
        }
    }

    private func beatRow(idx: Int, beat: DreamBeat) -> some View {
        let label = (beat.caption?.isEmpty == false) ? (beat.caption ?? "") : beat.imagePrompt
        return HStack(spacing: 12) {
            Text("\(idx + 1)")
                .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                .foregroundColor(Theme.mauve)
                .frame(width: 20)
            Text(label)
                .font(.callout).foregroundColor(Theme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(2)
            VStack(spacing: 6) {
                arrowButton("chevron.up", disabled: idx == 0) { moveBeat(idx, -1) }
                arrowButton("chevron.down", disabled: idx == review.count - 1) { moveBeat(idx, 1) }
            }
        }
        .padding(12)
        .background(Theme.surface)
        .cornerRadius(Theme.radius)
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
    }

    private func arrowButton(_ icon: String, disabled: Bool, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(disabled ? Theme.textDim.opacity(0.4) : Theme.mauve)
                .frame(width: 32, height: 24)
                .background(Theme.bg)
                .cornerRadius(6)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }

    /// The dream being illustrated: its pages once they land, plus a progress
    /// note while the beats draw.
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
        reviewId = nil
        review = []
        Task {
            do {
                // Breakdown (free): dream → beats + captions, already in the
                // AI's best chronological order.
                let created = try await MovieService.shared.createDream(text: body)
                review = created.beats
                reviewId = created.id
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
            statusLabel = ""
        }
    }

    /// Draw the reviewed beats in the confirmed order.
    private func draw() {
        guard let id = reviewId else { return }
        let order = review.map { $0.id }
        busy = true
        statusLabel = "Drawing the character…"
        reviewId = nil
        Task {
            do {
                current = try await MovieService.shared.renderDream(id, order: order)
                await pollDream(id)
                text = ""
                await loadDreams()
                current = nil                 // it's in the journal now
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
            statusLabel = ""
            review = []
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

    private func moveBeat(_ i: Int, _ dir: Int) {
        let j = i + dir
        guard j >= 0, j < review.count else { return }
        review.swapAt(i, j)
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

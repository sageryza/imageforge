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
    @State private var reviewDreams: [Dream] = []   // dreams split from the recording, to check the chronology of
    @State private var current: Dream?              // the dream currently rendering
    @State private var finished: [Dream] = []       // dreams already drawn this run (pages kept on screen)
    @State private var errorText: String?
    @State private var pollGeneration = 0

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @AppStorage("dreams.nudgeScheduled") private var nudgeScheduled = false
    @State private var showConsent = false
    @FocusState private var focused: Bool
    @StateObject private var speech = DreamSpeech()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                inputSection
                if !reviewDreams.isEmpty {
                    chronologySection
                } else if busy || current != nil || !finished.isEmpty {
                    currentSection
                } else {
                    sunflowerEmptyState
                }
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                NavigationLink { DreamArchiveView() } label: {
                    Image(systemName: "moon.stars").foregroundColor(Theme.accent)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink { DreamZineView() } label: {
                    SpiralNotebookIcon(size: 22, color: Theme.accent)
                }
            }
            ToolbarItem(placement: .principal) {
                Text("Dreams")
                    .font(Theme.serif(20).smallCaps())
                    .tracking(1.5)
                    .foregroundColor(Theme.text)
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focused = false }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            scheduleNudgeIfNeeded()
        }
        .onDisappear { pollGeneration += 1; speech.stop() }   // stop polling + mic when we leave
        .alert("Couldn't illustrate",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .onChange(of: speech.transcript) { newValue in text = newValue }
        .onChange(of: speech.errorText) { newValue in
            if let e = newValue { errorText = e; speech.errorText = nil }
        }
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
            HStack(spacing: 8) {
                Text(speech.recording ? "LISTENING…" : "WHAT DID YOU DREAM?")
                    .font(.caption2.weight(.semibold)).tracking(1)
                    .foregroundColor(speech.recording ? Theme.danger : Theme.textDim)
                Spacer()
                Button {
                    focused = false
                    speech.toggle(seed: text)
                } label: {
                    Image(systemName: speech.recording ? "stop.circle.fill" : "mic.fill")
                        .font(.system(size: 19))
                        .foregroundColor(speech.recording ? Theme.danger : Theme.accent)
                }
                .accessibilityLabel(speech.recording ? "Stop recording" : "Record your dream")
            }
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
                HStack(spacing: 7) {
                    Image(systemName: "sparkles")
                    Text(busy ? "Illustrating…" : "Illustrate")
                }
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Theme.lightGold)
                .foregroundColor(Theme.ink)
                .cornerRadius(Theme.radius)
            }
            .disabled(busy)
            .opacity(busy ? 0.6 : 1)
        }
    }

    /// The chronology check — dreams come out of order, so the breakdown's best
    /// guess at the real sequence, with ▲▼ to nudge any beat before drawing.
    private var chronologySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(reviewDreams.count > 1 ? "\(reviewDreams.count) DREAMS — CHECK THE CHRONOLOGY" : "CHECK THE CHRONOLOGY")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            Text(reviewDreams.count > 1
                 ? "That recording was more than one dream. Each is split out and put in order — nudge any beat, then draw them all."
                 : "Dreams come out of order. Nudge any beat into place, then draw.")
                .font(.footnote).foregroundColor(Theme.textDim)
            ForEach(Array(reviewDreams.enumerated()), id: \.element.id) { di, dream in
                VStack(alignment: .leading, spacing: 8) {
                    if reviewDreams.count > 1 {
                        Text(dream.title)
                            .font(Theme.serif(17)).foregroundColor(Theme.text)
                            .padding(.top, di == 0 ? 0 : 6)
                    }
                    ForEach(Array(dream.beats.enumerated()), id: \.element.id) { bi, beat in
                        beatRow(dreamIndex: di, beatIndex: bi, beat: beat, count: dream.beats.count)
                    }
                }
            }
            Button { draw() } label: {
                Text(reviewDreams.count > 1 ? "Draw all \(reviewDreams.count)" : "Draw it")
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

    private func beatRow(dreamIndex di: Int, beatIndex bi: Int, beat: DreamBeat, count: Int) -> some View {
        let label = (beat.caption?.isEmpty == false) ? (beat.caption ?? "") : beat.imagePrompt
        return HStack(spacing: 12) {
            Text("\(bi + 1)")
                .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                .foregroundColor(Theme.mauve)
                .frame(width: 20)
            Text(label)
                .font(.callout).foregroundColor(Theme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(2)
            VStack(spacing: 6) {
                arrowButton("chevron.up", disabled: bi == 0) { moveBeat(di, bi, -1) }
                arrowButton("chevron.down", disabled: bi == count - 1) { moveBeat(di, bi, 1) }
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
            ForEach(finished) { dream in
                ForEach(dream.pages ?? []) { page in pageImage(page.pageURL) }
            }
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

    /// The friendly idle state: a little hand-drawn sunflower asking what you
    /// dreamed. Your past dreams live in the moon archive (top-left), so the
    /// Illustrate page stays just the prompt.
    private var sunflowerEmptyState: some View {
        Image("DreamSunflowers")
            .resizable()
            .scaledToFit()
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
            .accessibilityLabel("What did you dream last night?")
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
        finished = []
        reviewDreams = []
        Task {
            do {
                // Breakdown (free): the recording → one or more dreams, each
                // split out and already in Claude's best chronological order.
                reviewDreams = try await MovieService.shared.createDream(text: body)
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
            statusLabel = ""
        }
    }

    /// Draw each reviewed dream in turn, in its confirmed beat order.
    private func draw() {
        let dreams = reviewDreams
        guard !dreams.isEmpty else { return }
        reviewDreams = []
        finished = []
        busy = true
        Task {
            for (i, dream) in dreams.enumerated() {
                statusLabel = dreams.count > 1 ? "Drawing dream \(i + 1) of \(dreams.count)…" : "Drawing the character…"
                do {
                    let order = dream.beats.map { $0.id }
                    current = try await MovieService.shared.renderDream(dream.id, order: order)
                    await pollDream(dream.id)
                    if let done = current { finished.append(done) }
                    current = nil
                } catch {
                    errorText = error.localizedDescription
                    break
                }
            }
            text = ""            // the dreams are saved to the moon archive
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

    private func moveBeat(_ di: Int, _ bi: Int, _ dir: Int) {
        guard di >= 0, di < reviewDreams.count else { return }
        let j = bi + dir
        guard j >= 0, j < reviewDreams[di].beats.count else { return }
        reviewDreams[di].beats.swapAt(bi, j)
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

/// A little spiral-bound notebook glyph for the zine button — friendlier and
/// less "official" than a closed book. Drawn so it tints with the toolbar.
struct SpiralNotebookIcon: View {
    var size: CGFloat = 22
    var color: Color = Theme.accent

    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            let lw = max(1.3, w * 0.07)
            let topY = h * 0.26
            // The notebook page block.
            let body = Path(roundedRect: CGRect(x: w * 0.17, y: topY, width: w * 0.66, height: h * 0.60),
                            cornerRadius: w * 0.10)
            ctx.stroke(body, with: .color(color), lineWidth: lw)
            // A couple of faint page lines.
            for f: CGFloat in [0.50, 0.66, 0.80] {
                var line = Path()
                line.move(to: CGPoint(x: w * 0.31, y: h * f))
                line.addLine(to: CGPoint(x: w * 0.69, y: h * f))
                ctx.stroke(line, with: .color(color.opacity(0.65)), lineWidth: lw * 0.7)
            }
            // Spiral rings straddling the top edge.
            let rings = 4
            let r = w * 0.055
            for i in 0..<rings {
                let x = w * (0.30 + 0.40 * CGFloat(i) / CGFloat(rings - 1))
                let loop = Path(ellipseIn: CGRect(x: x - r, y: topY - r, width: 2 * r, height: 2 * r))
                ctx.stroke(loop, with: .color(color), lineWidth: lw)
            }
        }
        .frame(width: size, height: size)
    }
}

import SwiftUI
import UIKit
import UserNotifications
import UniformTypeIdentifiers

/// Dreams — write down a dream and it's illustrated as a short hand-drawn
/// diary comic, in user-approved stages: a fast read ONLY splits the recording
/// into its separate dreams (order + who's mentioned — no beats), you approve
/// "is this the order?" and "are these the characters?" (picking between
/// look-alike candidates from the saved sheet, or describing someone new),
/// and only then does the server decide how many pages each dream needs —
/// allotting your exact words to each image — and draw them. Kept as a
/// journal, with a daily ~11am nudge.
struct DreamsView: View {
    /// One mentioned name in a dream and what the user decided about it:
    /// a picked saved-character candidate, a typed description, or neither
    /// (the model just draws them fresh from the dream's words).
    struct CastPick: Identifiable {
        let id = UUID()
        let dreamId: String
        let mention: String
        var candidates: [CastMatch]
        var selected: String?          // picked candidate's id (nil = none)
        var desc: String = ""          // for people not on the sheet
    }

    @State private var text = ""
    @State private var busy = false
    @State private var statusLabel = ""
    @State private var reviewDreams: [Dream] = []   // dreams split from the recording, awaiting approval
    @State private var castPicks: [CastPick] = []   // the character approvals, across all review dreams
    @State private var originalOrder: [String] = [] // dream ids as the server returned them
    @State private var expandedDreams: Set<String> = []   // tapped-to-expand review text blocks
    @State private var current: Dream?              // the dream currently rendering
    @State private var finished: [Dream] = []       // dreams already drawn this run (pages kept on screen)
    @State private var errorText: String?
    @State private var selectedPage: DreamPageRef?   // tapped page → enlarge + read the words
    @State private var renderSession = 0

    // Dreams still drawing on the server — persisted so closing the app or
    // leaving the screen doesn't lose them. We resume polling these on return.
    @AppStorage("dreams.activeRenderIDs") private var activeRenderIDsRaw = ""
    // A reading (breakdown) still running on the server — persisted for the same
    // reason: tapping Illustrate starts it in the background, so the phone can
    // lock/leave without the request timing out, and we resume polling on return.
    @AppStorage("dreams.activeReadingID") private var activeReadingID = ""
    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @AppStorage("dreams.nudgeScheduled") private var nudgeScheduled = false
    @State private var showConsent = false
    @State private var showCharacters = false        // the "add a character" sheet (Character Creator web page)
    @State private var showAudioPicker = false
    @State private var transcribing = false          // uploading a recording → text
    @State private var pendingAudio: (data: Data, mime: String)?   // audio waiting on AI consent
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
        .overlay { if let sel = selectedPage { DreamPagePopup(ref: sel) { selectedPage = nil } } }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            scheduleNudgeIfNeeded()
            await resumeActiveReading()   // pick up a reading still in progress
            await resumeActiveRenders()   // pick up any dream still drawing from before
        }
        .onDisappear { renderSession += 1; speech.stop() }   // stop polling + mic when we leave (server keeps drawing)
        .alert("Couldn't illustrate",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .onChange(of: speech.transcript) { newValue in text = newValue }
        .onChange(of: speech.errorText) { newValue in
            if let e = newValue { errorText = e; speech.errorText = nil }
        }
        .fileImporter(isPresented: $showAudioPicker,
                      allowedContentTypes: [.audio],
                      allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls): if let u = urls.first { readAudioFile(u) }
            case .failure(let err): errorText = err.localizedDescription
            }
        }
        .sheet(isPresented: $showConsent) {
            AIConsentSheet(
                theme: .deckFactory,
                appName: "Deck Factory",
                providers: [
                    AIProvider(name: "OpenAI", role: "Transcribes & illustrates your dream (Whisper / gpt-image-2)"),
                ],
                dataDescription: "the dream you write or the recording you add",
                privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                onAgree: {
                    aiConsentAccepted = true
                    showConsent = false
                    if let p = pendingAudio { pendingAudio = nil; beginTranscription(p.data, mime: p.mime) }
                    else { run() }
                },
                onCancel: { showConsent = false; pendingAudio = nil })
        }
        .sheet(isPresented: $showCharacters) {
            CharacterCreatorView()
        }
    }

    // MARK: - Sections

    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(speech.recording ? "LISTENING…" : (transcribing ? "TRANSCRIBING…" : "WHAT DID YOU DREAM?"))
                    .font(.caption2.weight(.semibold)).tracking(1)
                    .foregroundColor(speech.recording ? Theme.danger : Theme.textDim)
                Spacer()
                if transcribing { ProgressView().scaleEffect(0.75).padding(.trailing, 2) }
                // Add a character — save the recurring people in your dreams
                // (name + photo + aliases like "me"/"Sophie", "Daddy"/"Dad").
                // At render time the dream's cast is matched to these so they're
                // drawn consistently. Opens the Character Creator web page.
                Button {
                    focused = false
                    showCharacters = true
                } label: {
                    Image(systemName: "person.crop.circle.badge.plus")
                        .font(.system(size: 18))
                        .foregroundColor(Theme.accent)
                }
                .accessibilityLabel("Add a character")
                .disabled(speech.recording || transcribing)
                .opacity(speech.recording || transcribing ? 0.4 : 1)
                // Paste a copied recording OR copied text. If the clipboard holds
                // an audio recording it's transcribed (Whisper); text just drops in.
                Button {
                    focused = false
                    pasteFromClipboard()
                } label: {
                    Image(systemName: "doc.on.clipboard")
                        .font(.system(size: 17))
                        .foregroundColor(Theme.accent)
                }
                .accessibilityLabel("Paste a recording or text")
                .disabled(speech.recording || transcribing)
                .opacity(speech.recording || transcribing ? 0.4 : 1)
                // Add an existing recording (a voice memo she already made) —
                // transcribed with Whisper, then illustrated like typed text.
                Button {
                    focused = false
                    pickAudio()
                } label: {
                    Image(systemName: "waveform")
                        .font(.system(size: 18))
                        .foregroundColor(Theme.accent)
                }
                .accessibilityLabel("Add a voice recording")
                .disabled(speech.recording || transcribing)
                .opacity(speech.recording || transcribing ? 0.4 : 1)
                Button {
                    focused = false
                    speech.toggle(seed: text)
                } label: {
                    Image(systemName: speech.recording ? "stop.circle.fill" : "mic.fill")
                        .font(.system(size: 19))
                        .foregroundColor(speech.recording ? Theme.danger : Theme.accent)
                }
                .accessibilityLabel(speech.recording ? "Stop recording" : "Record your dream")
                .disabled(transcribing)
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

    /// The approval step — the fast read only split the recording, so this asks
    /// two questions at once: "is this the order of your dreams?" (▲▼ moves a
    /// whole dream) and "are these the characters?" (candidate cards from the
    /// saved sheet; a blank describe-them card for anyone it doesn't know).
    private var chronologySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(reviewDreams.count > 1 ? "\(reviewDreams.count) DREAMS — IS THIS THE ORDER?" : "CHECK YOUR DREAM")
                .font(.caption2.weight(.semibold)).tracking(1)
                .foregroundColor(Theme.textDim)
            Text(reviewDreams.count > 1
                 ? "That recording was more than one dream. Check the order and the characters, then draw them all."
                 : "Check the words and the characters, then draw. Out-of-order phrases are marked — they'll be drawn in the true order.")
                .font(.footnote).foregroundColor(Theme.textDim)
            ForEach(Array(reviewDreams.enumerated()), id: \.element.id) { di, dream in
                dreamApprovalCard(dream, index: di)
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

    /// One split dream: title (+ ▲▼ to move the whole dream when there are
    /// several), its own words with the out-of-order phrases marked, and its
    /// character picks.
    private func dreamApprovalCard(_ dream: Dream, index di: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Text(dream.title)
                    .font(Theme.serif(17)).foregroundColor(Theme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if reviewDreams.count > 1 {
                    arrowButton("chevron.up", disabled: di == 0) { moveDream(di, -1) }
                    arrowButton("chevron.down", disabled: di == reviewDreams.count - 1) { moveDream(di, 1) }
                }
            }
            Text(highlightedText(dream))
                .font(.callout).foregroundColor(Theme.text)
                .lineLimit(expandedDreams.contains(dream.id) ? nil : 5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture {
                    if expandedDreams.contains(dream.id) { expandedDreams.remove(dream.id) }
                    else { expandedDreams.insert(dream.id) }
                }
            let picks = castPicks.enumerated().filter { $0.element.dreamId == dream.id }
            if !picks.isEmpty {
                Text("WHO'S IN IT")
                    .font(.caption2.weight(.semibold)).tracking(1)
                    .foregroundColor(Theme.textDim)
                    .padding(.top, 2)
                ForEach(picks, id: \.element.id) { idx, pick in
                    castPickRow(pick, at: idx)
                }
            }
        }
        .padding(14)
        .background(Theme.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    /// One mentioned name: its saved-sheet candidates as tappable cards (tap to
    /// pick, tap again to unpick — unpicked means "not them, draw fresh"), or a
    /// blank card with a describe-them box when the sheet has no match.
    private func castPickRow(_ pick: CastPick, at idx: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if pick.candidates.isEmpty {
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .frame(width: 44, height: 44)
                        .overlay(Image(systemName: "person.fill.questionmark")
                            .font(.system(size: 16)).foregroundColor(Theme.textDim))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(pick.mention).font(.footnote.weight(.semibold)).foregroundColor(Theme.text)
                        TextField("describe them (optional)", text: Binding(
                            get: { castPicks.indices.contains(idx) ? castPicks[idx].desc : "" },
                            set: { if castPicks.indices.contains(idx) { castPicks[idx].desc = $0 } }))
                            .font(.footnote)
                            .foregroundColor(Theme.text)
                            .focused($focused)
                    }
                }
            } else {
                if pick.candidates.count > 1 {
                    Text("\(pick.mention) — which one?")
                        .font(.footnote).foregroundColor(Theme.textDim)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(pick.candidates) { cand in
                            castCandidateCard(cand, mention: pick.mention,
                                              selected: pick.selected == cand.id) {
                                guard castPicks.indices.contains(idx) else { return }
                                castPicks[idx].selected = castPicks[idx].selected == cand.id ? nil : cand.id
                            }
                        }
                    }
                }
            }
        }
    }

    private func castCandidateCard(_ cand: CastMatch, mention: String, selected: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            VStack(spacing: 4) {
                Group {
                    if let url = cand.imageURL { CachedImageView(url: url, contentMode: .fill) }
                    else { Image(systemName: "person.fill").foregroundColor(Theme.textDim) }
                }
                .frame(width: 62, height: 62)
                .clipped()
                .cornerRadius(6)
                Text(cand.name == mention ? cand.name : "\(mention) = \(cand.name)")
                    .font(.caption2)
                    .foregroundColor(selected ? Theme.text : Theme.textDim)
                    .lineLimit(1)
            }
            .padding(6)
            .background(selected ? Theme.lightGold : Theme.bg)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8)
                .stroke(selected ? Theme.mauve : Theme.border, lineWidth: selected ? 2 : 1))
        }
        .buttonStyle(.plain)
    }

    /// The dream's own words with each out-of-order phrase marked.
    private func highlightedText(_ dream: Dream) -> AttributedString {
        var attr = AttributedString(dream.reviewText)
        for cue in dream.driftCues ?? [] where !cue.isEmpty {
            if let r = attr.range(of: cue) {
                attr[r].foregroundColor = Theme.mauve
                attr[r].underlineStyle = .single
            }
        }
        return attr
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
                ForEach(dream.pages ?? []) { page in pageButton(page, dream) }
            }
            if let cur = current, let pages = cur.pages, !pages.isEmpty {
                ForEach(pages) { page in pageButton(page, cur) }
            }
            if busy { progressCard }
        }
    }

    /// A drawn page — tap to enlarge it and read the dream behind it.
    private func pageButton(_ page: DreamPage, _ dream: Dream) -> some View {
        Button {
            AutoScrollDriver.shared.stop()
            selectedPage = DreamPageRef(id: page.id, url: page.pageURL,
                                        title: dream.title, dreamText: dream.reviewText)
        } label: { pageImage(page.pageURL) }
        .buttonStyle(.plain)
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
        Group {
            if let url { CachedImageView(url: url, contentMode: .fit) }
            else { Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger) }
        }
        .frame(maxWidth: .infinity, minHeight: 200)
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
        castPicks = []
        originalOrder = []
        renderSession += 1
        let session = renderSession
        Task {
            do {
                // The reading (breakdown) runs as a BACKGROUND job on the server —
                // start it, persist the id, then poll. The phone can lock or leave
                // and we resume from the saved id on return (resumeActiveReading),
                // so a slow read + Render cold start never times out the request.
                let batchId = try await MovieService.shared.startDreamReading(text: body)
                activeReadingID = batchId
                await drainReading(batchId, session: session)
            } catch {
                errorText = error.localizedDescription
                busy = false
                statusLabel = ""
            }
        }
    }

    /// Poll the background reading job to completion. Resilient to dropped
    /// connections / cold starts (the server keeps reading no matter what) — a
    /// transient failure just retries. When reading finishes the split dreams go
    /// to the chronology check; an error surfaces the reason.
    private func drainReading(_ id: String, session: Int) async {
        var transientFails = 0
        while session == renderSession {
            do {
                let batch = try await MovieService.shared.dreamBatch(id)
                transientFails = 0
                switch batch.status {
                case "error":
                    activeReadingID = ""
                    errorText = batch.error ?? "Couldn't read that dream."
                    busy = false; statusLabel = ""
                    return
                case "done":
                    activeReadingID = ""
                    busy = false; statusLabel = ""
                    let dreams = batch.dreams ?? []
                    if dreams.isEmpty { errorText = "Couldn't read that dream — try again." }
                    else { beginReview(dreams) }
                    return
                default:   // still reading
                    if let label = batch.label, !label.isEmpty {
                        statusLabel = "\(label.prefix(1).uppercased())\(label.dropFirst())…"
                    }
                }
            } catch {
                // Dropped connection / cold start — keep trying; the server is
                // still reading. Give up quietly after a long dry spell (we'll
                // resume from the saved id next time the screen opens).
                transientFails += 1
                if transientFails >= 25 {
                    if session == renderSession { busy = false; statusLabel = "" }
                    return   // keep activeReadingID so a re-open resumes
                }
            }
            try? await Task.sleep(nanoseconds: 3_200_000_000)
        }
        // view went away; the read continues server-side, resumed on return
    }

    /// Coming back to the screen (or relaunching the app): if a reading was still
    /// going, pick it up — the server never stopped reading.
    private func resumeActiveReading() async {
        let id = activeReadingID
        guard !id.isEmpty, !busy, reviewDreams.isEmpty, current == nil else { return }
        busy = true
        statusLabel = "Reading your dream…"
        renderSession += 1
        await drainReading(id, session: renderSession)
    }

    /// The waveform button: open the file picker, but ask for AI consent first
    /// (transcribing sends the audio to OpenAI, same as illustrating).
    private func pickAudio() {
        guard !transcribing, !busy else { return }
        showAudioPicker = true
    }

    /// A picked recording file → read its bytes → transcribe.
    private func readAudioFile(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let raw = try? Data(contentsOf: url) else {
            errorText = "Couldn't read that recording."
            return
        }
        beginTranscription(raw, mime: Self.audioMime(for: url.pathExtension))
    }

    /// The clipboard button: if you copied a recording, transcribe it; if you
    /// copied text, just drop the text in. This is the "paste it" path — copy a
    /// voice memo anywhere, come here, paste. iOS text fields can't hold an audio
    /// file, so the recording is pulled off the clipboard here instead.
    private func pasteFromClipboard() {
        guard !transcribing, !busy else { return }
        let pb = UIPasteboard.general
        // A recording on the clipboard → Whisper.
        if let provider = pb.itemProviders.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.audio.identifier) }) {
            let typeId = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .audio) == true })
                ?? UTType.audio.identifier
            let ext = UTType(typeId)?.preferredFilenameExtension ?? "m4a"
            transcribing = true   // spinner while the clipboard item loads
            provider.loadDataRepresentation(forTypeIdentifier: typeId) { data, _ in
                Task { @MainActor in
                    transcribing = false
                    guard let data, !data.isEmpty else {
                        errorText = "Couldn't read the copied recording — try the waveform button instead."
                        return
                    }
                    beginTranscription(data, mime: Self.audioMime(for: ext))
                }
            }
            return
        }
        // Plain text on the clipboard → append it.
        if let s = pb.string, !s.isEmpty {
            text = text.isEmpty ? s : text + " " + s
            return
        }
        errorText = "Nothing to paste — copy a recording (or some text) first."
    }

    /// Shared transcription path for both the file picker and paste: gate on AI
    /// consent, then base64 data URL → Whisper → drop the transcript in the box
    /// (appended to whatever's there), so she can read/fix it before drawing.
    private func beginTranscription(_ data: Data, mime: String) {
        guard aiConsentAccepted else { pendingAudio = (data, mime); showConsent = true; return }
        // Whisper caps files at 25MB and the server body at 25MB (base64 ~+33%);
        // ~18MB of audio ≈ 15+ min of a voice memo, plenty for a dream.
        guard data.count <= 18_000_000 else {
            errorText = "That recording's a bit long to upload — try one under about 15 minutes."
            return
        }
        let dataURL = "data:\(mime);base64," + data.base64EncodedString()
        let seed = text
        focused = false
        transcribing = true
        Task {
            do {
                let transcript = try await MovieService.shared.transcribeDream(audioDataURL: dataURL)
                text = seed.isEmpty ? transcript : seed + " " + transcript
            } catch {
                errorText = error.localizedDescription
            }
            transcribing = false
        }
    }

    /// Best-effort mime for the picked file's extension (iOS Voice Memos = m4a).
    private static func audioMime(for ext: String) -> String {
        switch ext.lowercased() {
        case "mp3", "mpeg", "mpga": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "webm": return "audio/webm"
        case "ogg", "oga": return "audio/ogg"
        case "aiff", "aif": return "audio/aiff"
        case "flac": return "audio/flac"
        default: return "audio/mp4"   // m4a / mp4 / aac / caf
        }
    }

    /// The split dreams arrive — set up the approval state: dreams in server
    /// order, one CastPick per mentioned name (best saved-sheet candidate
    /// pre-picked; no match = a blank describe-them card).
    private func beginReview(_ dreams: [Dream]) {
        reviewDreams = dreams
        originalOrder = dreams.map { $0.id }
        expandedDreams = dreams.count == 1 ? [dreams[0].id] : []
        castPicks = dreams.flatMap { dream in
            (dream.castSuggestions ?? (dream.mentions ?? []).map { CastSuggestion(name: $0, matches: []) })
                .map { s in
                    CastPick(dreamId: dream.id, mention: s.name,
                             candidates: s.matches, selected: s.matches.first?.id)
                }
        }
    }

    /// Draw each approved dream. The approved whole-dream order is persisted
    /// first (if it changed), then each render is kicked off with that dream's
    /// approved characters — the server decides the pages and allots the words.
    /// Renders are recorded by id, so leaving the screen never loses them.
    private func draw() {
        let dreams = reviewDreams
        guard !dreams.isEmpty else { return }
        focused = false
        let picks = castPicks
        let orderChanged = dreams.map({ $0.id }) != originalOrder
        reviewDreams = []
        castPicks = []
        finished = []
        current = nil
        busy = true
        renderSession += 1
        let session = renderSession
        Task {
            statusLabel = "Planning pages…"
            if orderChanged {
                try? await MovieService.shared.reorderDreams(dreams.map { $0.id })
            }
            var started: [String] = []
            for dream in dreams {
                guard session == renderSession else { return }   // left the screen — server keeps going
                do {
                    _ = try await MovieService.shared.renderDream(
                        dream.id, characters: charactersPayload(for: dream, picks: picks))
                    started.append(dream.id)
                    activeRenderIDsRaw = started.joined(separator: ",")
                } catch {
                    errorText = error.localizedDescription
                }
            }
            await drainActiveRenders(started, total: dreams.count, session: session)
        }
    }

    /// The approved cast for one dream, in the render endpoint's shape: every
    /// mention rides along (so the page planner knows the cast); a picked
    /// candidate contributes its card image, a typed description its text.
    private func charactersPayload(for dream: Dream, picks: [CastPick]) -> [[String: Any]] {
        picks.filter { $0.dreamId == dream.id }.map { pick in
            var entry: [String: Any] = ["name": pick.mention]
            if let sel = pick.selected, let cand = pick.candidates.first(where: { $0.id == sel }) {
                if let u = cand.url { entry["url"] = u }
            } else {
                let d = pick.desc.trimmingCharacters(in: .whitespacesAndNewlines)
                if !d.isEmpty { entry["desc"] = d }
            }
            return entry
        }
    }

    /// Coming back to the screen (or relaunching the app): if a render was still
    /// going, pick it up — the server never stopped drawing.
    private func resumeActiveRenders() async {
        let ids = activeRenderIDsRaw.split(separator: ",").map(String.init)
        guard !ids.isEmpty, !busy, reviewDreams.isEmpty else { return }
        finished = []
        current = nil
        busy = true
        renderSession += 1
        await drainActiveRenders(ids, total: ids.count, session: renderSession)
    }

    /// Poll each active dream to completion, moving finished ones onto the page
    /// and dropping their ids from the persisted set as they land.
    private func drainActiveRenders(_ ids: [String], total: Int, session: Int) async {
        var remaining = ids
        var doneCount = total - ids.count
        while !remaining.isEmpty, session == renderSession {
            let id = remaining.removeFirst()
            doneCount += 1
            statusLabel = total > 1 ? "Drawing dream \(doneCount) of \(total)…" : statusLabel
            let ok = await pollDream(id, session: session)
            if session != renderSession { return }   // left the screen mid-poll
            if ok, let done = current, done.id == id { finished.append(done) }
            current = nil
            activeRenderIDsRaw = remaining.joined(separator: ",")   // this one's saved to the archive now
        }
        if session == renderSession {
            busy = false
            statusLabel = ""
            text = ""            // the dreams are saved to the moon archive
        }
    }

    /// Poll the dream doc until its render job finishes, surfacing the job's own
    /// label ("drawing the character" → "drawing pages") as it goes. Resilient
    /// to dropped connections (phone locked, Render waking) — the render runs
    /// server-side no matter what, so a transient failure just retries rather
    /// than aborting. Returns true when the dream finished drawing.
    @discardableResult
    private func pollDream(_ id: String, session: Int) async -> Bool {
        var transientFails = 0
        while session == renderSession {
            do {
                let d = try await MovieService.shared.dream(id)
                current = d
                transientFails = 0
                if d.job?.status == "error" {
                    errorText = d.job?.error ?? "The render didn't finish."
                    return false
                }
                if !(d.job?.isRunning ?? false) {
                    return d.job?.status == "done" || (d.pages?.isEmpty == false)
                }
                if let label = d.job?.label, !label.isEmpty {
                    statusLabel = "\(label.prefix(1).uppercased())\(label.dropFirst())…"
                }
            } catch {
                // Dropped connection / cold start — keep trying; the server is
                // still drawing. Give up quietly only after a long dry spell
                // (we'll resume from the saved id next time the screen opens).
                transientFails += 1
                if transientFails >= 25 { return false }
            }
            try? await Task.sleep(nanoseconds: 3_200_000_000)
        }
        return false   // view went away; the render continues server-side
    }

    private func moveDream(_ di: Int, _ dir: Int) {
        let j = di + dir
        guard di >= 0, di < reviewDreams.count, j >= 0, j < reviewDreams.count else { return }
        reviewDreams.swapAt(di, j)
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

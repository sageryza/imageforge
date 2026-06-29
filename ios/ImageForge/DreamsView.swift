import SwiftUI
import UserNotifications

/// Dreams — write down a dream and it's illustrated in the fixed moody
/// diary-comic style, then kept as a journal. A daily ~11am local notification
/// nudges "What did you dream last night?".
struct DreamsView: View {
    @State private var text = ""
    @State private var busy = false
    @State private var dreams: [Creation] = []
    @State private var loading = true
    @State private var errorText: String?

    @AppStorage("deckfactory.aiConsent.v1") private var aiConsentAccepted = false
    @AppStorage("dreams.nudgeScheduled") private var nudgeScheduled = false
    @State private var showConsent = false
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                inputSection
                if busy { loadingCard }
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
        .navigationTitle("Dreams")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadDreams()
            scheduleNudgeIfNeeded()
        }
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
                    .background(Theme.accent)
                    .foregroundColor(.white)
                    .cornerRadius(Theme.radius)
            }
            .disabled(busy)
            .opacity(busy ? 0.6 : 1)
        }
    }

    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radiusLg).fill(Color.white)
            GIFView(name: "loading-anim", ext: "png").frame(width: 150, height: 150)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(1, contentMode: .fit)
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
            ForEach(dreams) { dream in dreamCard(dream) }
        }
    }

    private func dreamCard(_ dream: Creation) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: dream.url) { phase in
                switch phase {
                case .success(let image): image.resizable().scaledToFit()
                case .failure: Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                default: ProgressView().frame(height: 120)
                }
            }
            .frame(maxWidth: .infinity)
            .background(Color.white)
            if let p = dream.prompt, !p.isEmpty {
                Text(p)
                    .font(.callout).foregroundColor(Theme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
            }
        }
        .background(Theme.surface)
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
        Task {
            do {
                let url = try await ForgeService.shared.generateDream(text: body)
                dreams.insert(Creation(id: UUID().uuidString, type: "dream", url: url, prompt: body), at: 0)
                text = ""
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }

    private func loadDreams() async {
        loading = true
        if let all = try? await ForgeService.shared.fetchCreations(limit: 80) {
            dreams = all.filter { $0.type == "dream" }
        }
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

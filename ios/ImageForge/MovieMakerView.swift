import SwiftUI
import AVKit
import PhotosUI
import UIKit

// The Movie medium — type a story, get a movie. Native frontend for
// imageforge's movies.js (/api/movies).
//
// UX philosophy (from the prototyping session): simple up front — story →
// pipeline → movie, one button, zero decisions — but every node supports
// ZOOM-IN for progressive micro-control:
//   zoom 0  type story, get movie (Autopilot)
//   zoom 1  approve/reorder scenes; re-roll a scene's panel
//   zoom 2  view/edit the exact image prompt
//   zoom 3  view/edit the exact motion prompt; re-roll a clip
//   zoom 4  per-clip editing — trim, speed, freeze, fade, drop, reorder
// Staying zoomed-out is effortless; zooming in is per-scene (tap a frame).
//
// Film-strip motif (sprocket-holed timeline, reel spinner) on the warm paper
// house palette — light, like the rest of the forge. House rules apply —
// NO PILLS (6px corners).

// ─── Reel palette (paper light) ──────────────────────────────────────
enum Reel {
    static let base    = Color(hex: 0xFAF9F7)   // house paper
    static let strip   = Color(hex: 0xF1EBE2)   // film strip — warm parchment
    static let surface = Color.white
    static let hole    = Color(hex: 0xDCD2C4)   // sprocket holes
    static let border  = Color(hex: 0xE8E4DF)
    static let ink     = Color(hex: 0x3A3530)   // primary text
    static let dim     = Color(hex: 0x9E9590)
    static let amber   = Color(hex: 0xB48B6A)   // house accent
    static let danger  = Color(hex: 0xD4807A)
    static let green   = Color(hex: 0x7AB58A)
}

extension ComplianceTheme {
    static let movieReel = ComplianceTheme(
        background: Reel.base, card: Reel.surface, ink: Reel.ink, subtleInk: Reel.dim,
        accent: Reel.amber, accentText: .white, line: Color(white: 0, opacity: 0.10),
        titleFont: { Font.system(size: $0, weight: .heavy) },
        bodyFont: { Font.system(size: $0) })
}

/// Example stories for the dice button — each has a visually distinct lead
/// character (continuity tokens the breakdown can repeat) and 3-4 concrete
/// beats, so the storyboard lands well without any editing. Riff or rewrite.
enum StorySeeds {
    static let all: [String] = [
        "A girl with a black bob haircut and a crystal necklace finds a glowing moth in her kitchen at night. She follows it out the window into the garden, where it lands on an empty jam jar. She carries the jar to her bedroom and falls asleep with it glowing on the nightstand.",
        "An old fisherman with a white beard and a red knit cap rows out on a grey morning and pulls up a tiny whale the size of a loaf of bread. They look at each other for a long moment. He lowers it back in, and it follows his boat all the way home like a dog.",
        "A round orange cat sneaks into a bakery before dawn. It walks across the flour sacks leaving perfect white pawprints, sits in the front window among the bread loaves, and is discovered at opening time by the baker — who shrugs and puts a 'shop cat' sign next to it.",
        "A small robot with one wheel and a dented brass body waters a single daisy growing in a crack in the sidewalk. A storm comes; the robot shields the flower with its umbrella hand all night. In the morning the daisy has two new blooms, and the robot's dent is full of rainwater and petals.",
        "A boy in a yellow raincoat and red boots finds a paper boat stuck in a storm drain. He frees it, folds a second one from his bus ticket, and races them down the gutter stream all the way to the sea, where both boats sail off together into the sunset.",
        "A night-shift lighthouse keeper with round glasses and a wool sweater notices the beam has stopped turning. She climbs the spiral stairs with a candle, finds a seagull asleep on the mechanism, and gently relocates it to a nest of rags — the beam sweeps back to life over the waves.",
        "A tortoise wearing a tiny mailbag delivers letters along a country lane. Today's last letter is addressed to the tortoise itself. It sits under a sunflower, opens the envelope, and finds a drawing of it made by all the animals on the route — which it pins up inside its shell.",
        "A witch with silver hair in a messy bun burns her toast every single morning. Today she finally enchants the toaster; it grows legs, walks to the window, and starts toasting bread perfectly by holding slices up to the sunrise.",
        "Two kids build a snowman with a carrot nose and a green scarf at dusk. At midnight the snowman leans over, picks up their forgotten mitten, and hangs it carefully on the garden gate before settling back into place — one mitten-shaped patch of snow missing from its arm.",
        "A janitor at a natural history museum with a limp and a big keyring hums to the whale skeleton every night while he mops. On his last shift before retiring, the skeleton slowly turns its head and hums the tune back.",
    ]

    static func random(avoiding current: String) -> String {
        let options = all.filter { $0 != current }
        return options.randomElement() ?? all[0]
    }
}

/// House-rule button (rounded rectangle, never a pill) in the reel palette.
func reelButton(_ title: String, prominent: Bool = false, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Text(title)
            .font(.subheadline.weight(.semibold))
            .foregroundColor(prominent ? .white : Reel.ink)
            .padding(.horizontal, 16).padding(.vertical, 11)
            .background(prominent ? Reel.amber : Reel.surface)
            .cornerRadius(Theme.radius)
            .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                .stroke(prominent ? Color.clear : Reel.border, lineWidth: 1))
    }
}

// ─── Home: the canister shelf ────────────────────────────────────────
struct MovieMakerHome: View {
    @State private var movies: [MovieSummary] = []
    @State private var story = ""
    @State private var creating = false
    @State private var loading = true
    @State private var errorText: String?
    @State private var openedMovie: Movie?
    @State private var openAutopilot = false
    @State private var showDetail = false

    @AppStorage("forge.movie.aiConsent.v1") private var aiConsentAccepted = false
    @State private var showConsent = false
    @State private var pendingMode: CreateMode = .autopilot
    @State private var pendingQuick = false

    // Story Room (the movie boards webpage) + the bookmark save
    @State private var showStoryRoom = false
    @State private var storySaved = false
    @State private var storyExpanded = false   // full-screen story editor

    // Quick animate (one image → one clip)
    @State private var quickPickerItem: PhotosPickerItem?
    @State private var quickImageData: Data?
    @State private var quickPrompt = ""
    @State private var quickQuality: QuickQuality = .p720
    @State private var quickBusy = false
    @State private var quickJob: QuickClip?
    @State private var quickClips: [QuickClip] = []
    @State private var playingQuick: QuickClip?
    @FocusState private var inputFocused: Bool
    @Environment(\.goBack) private var goBack

    // NOTE: no NavigationStack of its own — RootView wraps every tool in one.
    var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    newMovieSection
                    animateSection
                    shelfSection
                }
                // Sit the content higher (less dead space under the header),
                // while the story box keeps its own clearance from the pill.
                .padding(.horizontal).padding(.bottom).padding(.top, 4)
            }
            .background(Reel.base.ignoresSafeArea())
            .scrollDismissesKeyboard(.interactively)
            // Tapping anywhere also puts the keyboard away (runs alongside
            // whatever was tapped, so buttons still work).
            .simultaneousGesture(TapGesture().onEnded { inputFocused = false })
            .forgeTitle("Movies", paper: Reel.base)
            .toolbar {
                // The multiline fields' return key types a newline, so the
                // keyboard needs its own way out.
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { inputFocused = false }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    ForgeBackButton(tint: Reel.ink)
                }
                // Save · dice · Story Room all live in the header now (top-right)
                // — as high as they go on screen.
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    if !story.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Button {
                            let text = story.trimmingCharacters(in: .whitespacesAndNewlines)
                            Task {
                                do { _ = try await MovieService.shared.storySave(text: text); storySaved = true }
                                catch { errorText = error.localizedDescription }
                            }
                        } label: {
                            Image(systemName: storySaved ? "bookmark.fill" : "bookmark").foregroundColor(Reel.amber)
                        }
                        .accessibilityLabel("Save this story to the library")
                    }
                    Button { story = StorySeeds.random(avoiding: story) } label: {
                        Image(systemName: "die.face.5").foregroundColor(Reel.amber)
                    }
                    .accessibilityLabel("Surprise me with an example story")
                    Button { showStoryRoom = true } label: {
                        Image(systemName: "books.vertical").foregroundColor(Reel.amber)
                    }
                    .accessibilityLabel("Open the Story Room")
                }
            }
            .navigationDestination(isPresented: $showDetail) {
                if let movie = openedMovie {
                    MovieDetailView(movieId: movie.id, initial: movie, autopilot: openAutopilot)
                }
            }
            // Full-screen push (not a popup sheet) — the boards read as a
            // proper native screen; the webview inside is still the live page.
            .navigationDestination(isPresented: $showStoryRoom) {
                StoryRoomView(pushed: true)
                    // The single "Story Room" heading lives in the native nav
                    // bar, in the branded eyebrow style (see forgeTitle).
                    // paper = the web page's own, so there's no white strip
                    // between the nav bar and the cream page
                    .forgeTitle("Story Room", paper: StoryRoomView.paper)
            }
            // Expanded (full-screen) story editor — same $story binding.
            .fullScreenCover(isPresented: $storyExpanded) {
                NavigationStack {
                    TextEditor(text: $story)
                        .scrollContentBackground(.hidden)
                        .padding()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Reel.base)
                        .foregroundColor(Reel.ink)
                        .forgeTitle("Story", paper: Reel.base)
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) {
                                Button("Done") { storyExpanded = false }.foregroundColor(Reel.amber)
                            }
                        }
                }
            }
            .sheet(isPresented: $showConsent) {
                AIConsentSheet(
                    theme: .movieReel,
                    appName: "Deck Factory",
                    providers: [
                        AIProvider(name: "OpenAI", role: "Breaks your story into scenes and draws the panels"),
                        AIProvider(name: "Replicate", role: "Animates the panels into video clips"),
                    ],
                    dataDescription: "the story you write",
                    privacyURL: URL(string: "https://incaseofamnesia.com/privacy.html"),
                    onAgree: {
                        aiConsentAccepted = true; showConsent = false
                        if pendingQuick { pendingQuick = false; startQuickAnimate() }
                        else { create(mode: pendingMode) }
                    },
                    onCancel: { showConsent = false })
            }
            .sheet(item: $playingQuick) { clip in
                if let url = clip.clipVideoURL {
                    ClipPreviewSheet(title: clip.prompt?.isEmpty == false ? clip.prompt! : "quick animation", url: url)
                }
            }
            .alert("Movie trouble", isPresented: Binding(get: { errorText != nil },
                                                         set: { if !$0 { errorText = nil } })) {
                Button("OK", role: .cancel) { errorText = nil }
            } message: { Text(errorText ?? "") }
            .task { await load() }
            .refreshable { await load() }
            .tint(Reel.amber)
    }

    // MARK: New movie (zoom 0)

    private var newMovieSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("NEW FEATURE PRESENTATION")
            TextEditor(text: $story)
                .focused($inputFocused)
                .frame(minHeight: 84)                 // ~3 lines by default (still expands)
                .scrollContentBackground(.hidden)
                .padding(10)
                .background(Reel.surface)
                .foregroundColor(Reel.ink)
                .cornerRadius(Theme.radius)
                .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
                // Expand into a full-screen editor (like a code block's expand).
                .overlay(alignment: .topTrailing) {
                    Button { storyExpanded = true } label: {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Reel.dim)
                            .padding(7)
                    }
                    .accessibilityLabel("Expand the story editor")
                }
                .padding(.trailing, 50)               // keep the box clear of the autoscroll pill
            HStack(spacing: 10) {
                reelButton(creating ? "Rolling…" : "🎬  Make it!", prominent: true) {
                    requestCreate(mode: .autopilot)
                }
                Menu {
                    Button("👤 Nail the character first · 3 key scenes") { requestCreate(mode: .character) }
                    Divider()
                    Button("Storyboard · sketch grids · ~½¢/panel") { requestCreate(mode: .storyboard("sketch")) }
                    Button("Storyboard · low · 2¢/panel") { requestCreate(mode: .storyboard("low")) }
                    Button("Storyboard · medium · 6¢/panel") { requestCreate(mode: .storyboard("medium")) }
                    Button("Storyboard · high · 25¢/panel") { requestCreate(mode: .storyboard("high")) }
                } label: {
                    HStack(spacing: 5) {
                        Text("Storyboard").font(.subheadline.weight(.semibold)).foregroundColor(Reel.ink)
                        Image(systemName: "chevron.down").font(.caption2.weight(.bold)).foregroundColor(Reel.dim)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(Reel.surface)
                    .cornerRadius(Theme.radius)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
                }
            }
            .disabled(creating)
            .opacity(creating ? 0.6 : 1)
        }
    }

    // MARK: Quick animate (one image → one clip)

    private var animateSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("ANIMATE")
            HStack(alignment: .top, spacing: 12) {
                PhotosPicker(selection: $quickPickerItem, matching: .images) {
                    ZStack {
                        RoundedRectangle(cornerRadius: Theme.radius).fill(Reel.surface)
                        if let data = quickImageData, let ui = UIImage(data: data) {
                            Image(uiImage: ui).resizable().scaledToFill()
                        } else {
                            Image(systemName: "photo.badge.plus").font(.title2).foregroundColor(Reel.amber)
                        }
                    }
                    .frame(width: 84, height: 112)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius)
                        .stroke(quickImageData == nil ? Reel.border : Reel.amber, lineWidth: 1))
                }
                VStack(alignment: .leading, spacing: 8) {
                    TextField("What should move? (optional)", text: $quickPrompt, axis: .vertical)
                        .focused($inputFocused)
                        .lineLimit(1...3)
                        .font(.caption)
                        .foregroundColor(Reel.ink)
                        .padding(9)
                        .background(Reel.surface)
                        .cornerRadius(Theme.radius)
                        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
                    HStack(spacing: 8) {
                        Menu {
                            ForEach(QuickQuality.allCases) { q in
                                Button(q.label) { quickQuality = q }
                            }
                        } label: {
                            HStack(spacing: 5) {
                                Text(quickQuality.label).font(.caption.weight(.semibold)).foregroundColor(Reel.ink)
                                Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold)).foregroundColor(Reel.dim)
                            }
                            .padding(.horizontal, 10).padding(.vertical, 9)
                            .background(Reel.surface)
                            .cornerRadius(Theme.radius)
                            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
                        }
                        reelButton(quickBusy ? "Sending…" : "▶︎ Animate", prominent: true) {
                            startQuickAnimate()
                        }
                        .disabled(quickImageData == nil || quickBusy)
                        .opacity(quickImageData == nil || quickBusy ? 0.5 : 1)
                    }
                    Text("Five second clip").font(.system(size: 10)).foregroundColor(Reel.dim)
                }
            }
            if let job = quickJob {
                quickJobRow(job)
            }
            if !quickClips.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(quickClips) { clip in
                            quickThumb(clip)
                        }
                    }
                }
            }
        }
        .onChange(of: story) { _ in storySaved = false }
        .onChange(of: quickPickerItem) { item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    quickImageData = Self.downscaledJPEG(data)
                }
            }
        }
    }

    private func quickJobRow(_ job: QuickClip) -> some View {
        HStack(spacing: 10) {
            if job.status == "running" { ReelSpinner(size: 18) }
            Text(job.status == "running" ? "animating — pick another image to queue the next one"
                 : job.status == "error" ? "animation failed: \(job.error ?? "unknown")"
                 : "done! it's in the row below — tap to play")
                .font(.caption)
                .foregroundColor(job.status == "error" ? Reel.danger : Reel.dim)
            Spacer()
        }
        .padding(10)
        .background(Reel.surface)
        .cornerRadius(Theme.radius)
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
    }

    private func quickThumb(_ clip: QuickClip) -> some View {
        Button {
            if clip.clipVideoURL != nil { playingQuick = clip }
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: Theme.radius).fill(Reel.surface)
                if let poster = clip.posterURL {
                    AsyncImage(url: poster) { phase in
                        if case .success(let image) = phase {
                            image.resizable().scaledToFill().opacity(clip.status == "done" ? 1 : 0.4)
                        }
                    }
                }
                if clip.status == "running" { ReelSpinner(size: 16) }
                else if clip.status == "done" {
                    Image(systemName: "play.circle.fill").font(.title3).foregroundColor(.white).shadow(radius: 2)
                }
            }
            .frame(width: 64, height: 86)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive) {
                Task {
                    try? await MovieService.shared.quickDelete(clip.id)
                    quickClips.removeAll { $0.id == clip.id }
                }
            } label: { Label("Delete", systemImage: "trash") }
        }
    }

    private func startQuickAnimate() {
        guard let data = quickImageData, !quickBusy else { return }
        guard aiConsentAccepted else { pendingQuick = true; showConsent = true; return }
        quickBusy = true
        let prompt = quickPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let quality = quickQuality
        Task {
            do {
                // The POST returns as soon as the server accepts the job — the
                // clip renders in the background. Clear the form right away so
                // the next image can be picked while this one renders; any
                // number can run at once.
                let job = try await MovieService.shared.animate(jpeg: data, prompt: prompt,
                                                                resolution: quality.resolution,
                                                                tier: quality.tier)
                quickJob = job
                quickClips.insert(job, at: 0)
                quickPickerItem = nil
                quickImageData = nil
                quickPrompt = ""
                pollQuick(job.id)
            } catch { errorText = error.localizedDescription }
            quickBusy = false
        }
    }

    /// One independent poller per queued clip, so several can render at once.
    private func pollQuick(_ id: String) {
        Task {
            var misses = 0
            while true {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                guard let job = try? await MovieService.shared.quickGet(id) else {
                    misses += 1
                    if misses > 30 { return }   // ~2 min of dead network — give up quietly
                    continue
                }
                misses = 0
                if quickJob?.id == id { quickJob = job }
                if let i = quickClips.firstIndex(where: { $0.id == job.id }) { quickClips[i] = job }
                if job.status != "running" { return }
            }
        }
    }

    /// Downscale to ≤1536px JPEG so a 12MP photo doesn't ride the request.
    private static func downscaledJPEG(_ data: Data, maxSide: CGFloat = 1536) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let side = max(image.size.width, image.size.height)
        guard side > maxSide else { return image.jpegData(compressionQuality: 0.85) }
        let scale = maxSide / side
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: newSize)) }
        return resized.jpegData(compressionQuality: 0.85)
    }

    enum CreateMode { case autopilot, character, storyboard(String) }

    /// The quick-animate quality menu: resolution + price only (first two are
    /// wan, last two kling — deliberately unlabeled, Sophie knows which).
    enum QuickQuality: String, CaseIterable, Identifiable {
        case p480, p720, kling720, kling1080
        var id: String { rawValue }
        var label: String {
            switch self {
            case .p480:      return "480p · 6¢"
            case .p720:      return "720p · 16¢"
            case .kling720:  return "720p · 25¢"
            case .kling1080: return "1080p · 55¢"
            }
        }
        var tier: String {
            switch self {
            case .p480, .p720: return "draft"
            case .kling720:    return "standard"
            case .kling1080:   return "pro"
            }
        }
        var resolution: String { self == .p480 ? "480p" : "720p" }
    }

    private func requestCreate(mode: CreateMode) {
        let text = story.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { errorText = "Type a story first — one sentence is enough."; return }
        guard aiConsentAccepted else { pendingMode = mode; showConsent = true; return }
        create(mode: mode)
    }

    private func create(mode: CreateMode) {
        let text = story.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !creating else { return }
        creating = true
        Task {
            do {
                var quality: String?
                if case .storyboard(let q) = mode { quality = q }
                var movie = try await MovieService.shared.create(story: text, panelQuality: quality)
                // Kick the first render per mode so the reel is already rolling
                // when the detail screen opens.
                switch mode {
                case .autopilot:
                    break   // detail-view autopilot chains everything
                case .character:
                    let keys = movie.scenes.filter { $0.key == true }.map(\.id)
                    if !keys.isEmpty {
                        movie = try await MovieService.shared.renderPanels(movie.id, only: keys)
                    }
                case .storyboard:
                    movie = try await MovieService.shared.renderPanels(movie.id)
                }
                story = ""
                if case .autopilot = mode { openAutopilot = true } else { openAutopilot = false }
                openedMovie = movie
                showDetail = true
            } catch { errorText = error.localizedDescription }
            creating = false
        }
    }

    // MARK: Shelf (existing movies)

    private var shelfSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("ON THE SHELF")
            if loading {
                HStack(spacing: 10) {
                    ReelSpinner(size: 22)
                    Text("waking the projector…").font(.caption).foregroundColor(Reel.dim)
                }
                .padding(.vertical, 8)
            } else if movies.isEmpty {
                Text("No movies yet — the shelf is waiting for your first feature.")
                    .font(.callout).foregroundColor(Reel.dim).padding(.vertical, 8)
            }
            ForEach(movies) { summary in
                CanisterRow(summary: summary,
                            onOpen: { open(summary) },
                            onDelete: { delete(summary) })
            }
        }
    }

    private func load() async {
        do {
            movies = try await MovieService.shared.list()
            quickClips = (try? await MovieService.shared.quickList()) ?? quickClips
        } catch { errorText = error.localizedDescription }
        loading = false
    }

    private func open(_ summary: MovieSummary) {
        Task {
            do {
                openAutopilot = false
                openedMovie = try await MovieService.shared.movie(summary.id)
                showDetail = true
            } catch { errorText = error.localizedDescription }
        }
    }

    private func delete(_ summary: MovieSummary) {
        Task {
            do {
                try await MovieService.shared.delete(summary.id)
                movies.removeAll { $0.id == summary.id }
            } catch { errorText = error.localizedDescription }
        }
    }

    private func label(_ text: String) -> some View {
        Text(text).font(.caption2.weight(.semibold)).tracking(1.4).foregroundColor(Reel.dim)
    }
}

/// One movie on the shelf — a film-canister label.
private struct CanisterRow: View {
    let summary: MovieSummary
    let onOpen: () -> Void
    let onDelete: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 12) {
                posterThumb
                VStack(alignment: .leading, spacing: 4) {
                    Text(summary.title).font(.subheadline.weight(.semibold)).foregroundColor(Reel.ink)
                        .lineLimit(2).multilineTextAlignment(.leading)
                    HStack(spacing: 8) {
                        Text("\(summary.sceneCount) scenes").font(.caption2).foregroundColor(Reel.dim)
                        if summary.movieUrl != nil {
                            Text("● stitched").font(.caption2).foregroundColor(Reel.green)
                        }
                        if let job = summary.job, job.isRunning {
                            Text("● \(job.kind)…").font(.caption2).foregroundColor(Reel.amber)
                        }
                    }
                }
                Spacer()
                if let spend = summary.spend, spend > 0 {
                    CostChip(text: MovieCosts.chip(spend))
                }
                Image(systemName: "chevron.right").font(.caption).foregroundColor(Reel.dim)
            }
            .padding(12)
            .background(Reel.surface)
            .cornerRadius(Theme.radiusLg)
            .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Reel.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive, action: onDelete) { Label("Delete movie", systemImage: "trash") }
        }
    }

    private var posterThumb: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.radius).fill(Reel.strip)
            if let poster = summary.poster.flatMap(URL.init(string:)) {
                AsyncImage(url: poster) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    }
                }
            } else {
                Image(systemName: "film").foregroundColor(Reel.hole)
            }
        }
        .frame(width: 44, height: 58)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
    }
}

// ─── Detail: the film strip ──────────────────────────────────────────
struct MovieDetailView: View {
    let movieId: String
    @State var movie: Movie?
    @State private var autopilot: Bool
    @State private var errorText: String?
    @State private var expandedSceneId: String?
    @State private var pollGeneration = 0
    @State private var busy = false           // a request is in flight
    @State private var showGallery = false
    @State private var zinePage: ZinePage?

    init(movieId: String, initial: Movie? = nil, autopilot: Bool = false) {
        self.movieId = movieId
        _movie = State(initialValue: initial)
        _autopilot = State(initialValue: autopilot)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let movie {
                    headerSection(movie)
                    if let job = movie.job, job.isRunning || job.status == "error" {
                        JobBanner(job: job)
                    }
                    ctaSection(movie)
                    if let urlString = movie.movieUrl, let url = URL(string: urlString) {
                        theaterSection(url: url, movie: movie)
                    }
                    filmStrip(movie)
                    dreamSection(movie)
                    zineSection(movie)
                    Text("Edits are free — trim, speed, freeze and reorder never regenerate anything. Re-stitch after tweaking. Upgrade single scenes to Kling when the draft cut feels right.")
                        .font(.caption2).foregroundColor(Reel.dim).padding(.bottom, 30)
                } else {
                    HStack(spacing: 10) { ReelSpinner(size: 22); Text("loading the reel…").font(.caption).foregroundColor(Reel.dim) }
                }
            }
            .padding()
        }
        .background(Reel.base.ignoresSafeArea())
        .navigationTitle(movie?.title ?? "Movie")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showGallery = true } label: {
                    Image(systemName: "photo.on.rectangle.angled").foregroundColor(Reel.amber)
                }
                .accessibilityLabel("Gallery — every generation and finished cut")
            }
        }
        .sheet(isPresented: $showGallery) {
            if let movie { MovieGalleryView(movie: movie) }
        }
        .sheet(item: $zinePage) { page in
            ZinePageSheet(page: page)
        }
        .toolbarBackground(Reel.base, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .alert("Movie trouble", isPresented: Binding(get: { errorText != nil },
                                                     set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
        .task {
            await refresh()
            if autopilot { await advance() }
        }
        .onDisappear { pollGeneration += 1 }   // stop polling
        .refreshable { await refresh() }
        .tint(Reel.amber)
    }

    // MARK: Pipeline stage (what's the one obvious next step?)

    private enum Stage { case panels, animate, stitch, restitch, done }

    private func merged(_ movie: Movie, _ idx: Int) -> Bool {
        idx > 0 && movie.scenes[idx - 1].pairWithNext == true
    }

    private func missingPanels(_ movie: Movie) -> Int {
        movie.scenes.filter { $0.panel?.url == nil }.count
    }

    private func missingClips(_ movie: Movie) -> Int {
        movie.scenes.enumerated().filter { (idx, s) in
            !merged(movie, idx) && s.edits?.enabled != false && s.panel?.url != nil && s.clip?.url == nil
        }.count
    }

    private func stage(_ movie: Movie) -> Stage {
        if missingPanels(movie) > 0 { return .panels }
        if missingClips(movie) > 0 { return .animate }
        if movie.movieUrl == nil { return .stitch }
        // Movie exists — stitching again is always available after edits.
        return movie.job?.isRunning == true ? .done : .restitch
    }

    // MARK: Header

    private func headerSection(_ movie: Movie) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(movie.title).font(.title3.weight(.heavy)).foregroundColor(Reel.ink)
                Spacer()
                CostChip(text: "spent \(MovieCosts.chip(movie.spend ?? 0))")
            }
            if let characters = movie.characters, !characters.isEmpty {
                Text("CAST  ·  \(characters)").font(.caption2).foregroundColor(Reel.dim).lineLimit(2)
            }
            if movie.characterAnchor?.url != nil {
                HStack(spacing: 8) {
                    Text("🔗 character locked — renders stay consistent")
                        .font(.caption2).foregroundColor(Reel.green)
                    Button("unlock") {
                        fire(poll: false) { try await MovieService.shared.setAnchor(movieId, sceneId: nil) }
                    }
                    .font(.caption2).foregroundColor(Reel.dim)
                }
            }
            HStack(spacing: 8) {
                Text("\(movie.scenes.count) scenes").font(.caption).foregroundColor(Reel.dim)
                if let duration = movie.movieDuration, duration > 0 {
                    Text("·  \(String(format: "%.0f", duration))s film").font(.caption).foregroundColor(Reel.dim)
                }
                Spacer()
                if autopilot {
                    HStack(spacing: 5) {
                        ReelSpinner(size: 13)
                        Text("AUTOPILOT").font(.caption2.weight(.bold)).tracking(1)
                    }
                    .foregroundColor(Reel.amber)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.amber, lineWidth: 1))
                }
            }
        }
    }

    // MARK: The one big button (zoom 0)

    private func ctaSection(_ movie: Movie) -> some View {
        let running = movie.job?.isRunning == true
        return VStack(alignment: .leading, spacing: 8) {
            switch stage(movie) {
            case .panels:
                if characterPending(movie), !running {
                    characterBanner(movie)
                } else {
                    let n = missingPanels(movie)
                    let q = movie.panelQuality ?? "medium"
                    let per = MovieCosts.panel[q] ?? 0.06
                    bigButton("Render the storyboard  ·  \(n) panels (\(q))  ·  ~\(MovieCosts.chip(Double(n) * per))", disabled: running || busy) {
                        fire { try await MovieService.shared.renderPanels(movieId) }
                    }
                }
            case .animate:
                let n = missingClips(movie)
                bigButton("Animate all scenes  ·  draft  ·  ~\(MovieCosts.chip(Double(n) * 0.06))", disabled: running || busy) {
                    fire { try await MovieService.shared.animateAll(movieId, tier: "draft") }
                }
                Text("Panels look right? Animation locks them in. Re-roll any panel first (tap its frame).")
                    .font(.caption2).foregroundColor(Reel.dim)
            case .stitch:
                bigButton("Stitch the movie  ·  free", disabled: running || busy) {
                    fire { try await MovieService.shared.stitch(movieId) }
                }
            case .restitch:
                bigButton("Re-stitch with current edits  ·  free", disabled: running || busy) {
                    fire { try await MovieService.shared.stitch(movieId) }
                }
            case .done:
                EmptyView()
            }
        }
    }

    // MARK: The character (nail him down first, then lock)

    /// Key-scene panels exist but no anchor is locked and panels remain — the
    /// user should approve the character before drawing everything else.
    private func characterPending(_ movie: Movie) -> Bool {
        movie.characterAnchor?.url == nil
            && movie.scenes.contains { $0.key == true && $0.panel?.url != nil }
            && missingPanels(movie) > 0
    }

    private func characterBanner(_ movie: Movie) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("THE CHARACTER — look at the key frames above. Happy with the design?")
                .font(.caption).foregroundColor(Reel.ink)
            HStack(spacing: 10) {
                reelButton("🔗 Lock & draw the rest", prominent: true) {
                    guard let sceneId = movie.scenes.first(where: { $0.key == true && $0.panel?.url != nil })?.id else { return }
                    fire {
                        _ = try await MovieService.shared.setAnchor(movieId, sceneId: sceneId)
                        return try await MovieService.shared.renderPanels(movieId)
                    }
                }
                reelButton("🎲 New character") {
                    let keys = movie.scenes.filter { $0.key == true }.map(\.id)
                    fire { try await MovieService.shared.renderPanels(movieId, only: keys, force: true) }
                }
            }
            .disabled(busy)
            Text("Locking makes the first key panel the character's anchor — every panel and re-roll after renders with it attached, so the face, hair and clothes stay put.")
                .font(.caption2).foregroundColor(Reel.dim)
        }
        .padding(12)
        .background(Reel.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Reel.amber.opacity(0.5), lineWidth: 1))
    }

    // MARK: Theater (the stitched movie)

    private func theaterSection(url: URL, movie: Movie) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("NOW SHOWING")
            MoviePlayer(url: url)
                .aspectRatio(560.0 / 704.0, contentMode: .fit)
                .frame(maxWidth: .infinity)
                .cornerRadius(Theme.radiusLg)
                .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Reel.border, lineWidth: 1))
            ShareLink(item: url) {
                Label("Share the movie", systemImage: "square.and.arrow.up")
                    .font(.caption.weight(.semibold)).foregroundColor(Reel.amber)
            }
        }
    }

    // MARK: Film strip (zoom 1-4)

    private func filmStrip(_ movie: Movie) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("THE REEL — tap a frame to zoom in")
            VStack(spacing: 3) {
                ForEach(Array(movie.scenes.enumerated()), id: \.element.id) { idx, scene in
                    SceneFrame(
                        movie: movie,
                        scene: scene,
                        index: idx,
                        isMerged: merged(movie, idx),
                        expanded: expandedSceneId == scene.id,
                        busy: movie.job?.isRunning == true || busy,
                        onTap: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                expandedSceneId = expandedSceneId == scene.id ? nil : scene.id
                            }
                        },
                        onAction: { action in handle(action, scene: scene, index: idx) }
                    )
                }
            }
        }
    }

    // MARK: Dream mode

    private func dreamSection(_ movie: Movie) -> some View {
        let bridges = movie.bridges ?? []
        let readyClips = movie.scenes.enumerated().filter { !merged(movie, $0.offset) && $0.element.clip?.url != nil }.count
        return VStack(alignment: .leading, spacing: 8) {
            sectionLabel("DREAM MODE")
            VStack(alignment: .leading, spacing: 10) {
                Toggle(isOn: Binding(
                    get: { movie.dreamMode ?? false },
                    set: { on in fire { try await MovieService.shared.patch(movieId, ["dreamMode": on]) } }
                )) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Dream the cuts together").font(.subheadline.weight(.semibold)).foregroundColor(Reel.ink)
                        Text("A surreal bridge clip morphs every hard cut — one scene physically becomes the next.")
                            .font(.caption2).foregroundColor(Reel.dim)
                    }
                }
                .tint(Reel.amber)
                if movie.dreamMode == true {
                    let done = bridges.filter { $0.clip?.url != nil }.count
                    let cuts = max(0, readyClips - 1)
                    HStack {
                        Text("\(done)/\(cuts) bridges dreamt").font(.caption).foregroundColor(done == cuts && cuts > 0 ? Reel.green : Reel.dim)
                        Spacer()
                        if done < cuts {
                            reelButton("Dream \(cuts - done) bridges · ~\(MovieCosts.chip(Double(cuts - done) * MovieCosts.bridge))") {
                                fire { try await MovieService.shared.makeBridges(movieId) }
                            }
                            .disabled(movie.job?.isRunning == true || readyClips < 2)
                        }
                    }
                }
            }
            .padding(12)
            .background(Reel.surface)
            .cornerRadius(Theme.radiusLg)
            .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Reel.border, lineWidth: 1))
        }
    }

    // MARK: The zine (same story, printed medium)

    private func zineSection(_ movie: Movie) -> some View {
        let pageCount = Int((Double(movie.scenes.count) / 4).rounded(.up)) + 1  // + cover
        let cost = Double(pageCount) * 0.06
        let running = movie.job?.isRunning == true
        return VStack(alignment: .leading, spacing: 8) {
            sectionLabel("THE ZINE")
            VStack(alignment: .leading, spacing: 10) {
                if let zine = movie.zine, !zine.pages.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(zine.pages) { page in
                                zinePageThumb(page)
                            }
                        }
                    }
                    HStack {
                        Text("\(zine.pages.count) pages — tap to read & share")
                            .font(.caption2).foregroundColor(Reel.dim)
                        Spacer()
                        reelButton("Remake · ~\(MovieCosts.chip(cost))") {
                            fire { try await MovieService.shared.makeZine(movieId) }
                        }
                        .disabled(running || busy)
                    }
                } else {
                    Text("The same story as a hand-lettered zine — a cover plus one captioned 2×2 page per four scenes, in your style. Print-ready later.")
                        .font(.caption2).foregroundColor(Reel.dim)
                    reelButton("📖 Make the zine · \(pageCount) pages · ~\(MovieCosts.chip(cost))", prominent: true) {
                        fire { try await MovieService.shared.makeZine(movieId) }
                    }
                    .disabled(running || busy)
                }
            }
            .padding(12)
            .background(Reel.surface)
            .cornerRadius(Theme.radiusLg)
            .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Reel.border, lineWidth: 1))
        }
    }

    private func zinePageThumb(_ page: ZinePage) -> some View {
        Button { zinePage = page } label: {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4).fill(Reel.strip)
                    if let url = page.pageURL {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFill()
                            } else {
                                ProgressView().tint(Reel.dim)
                            }
                        }
                    }
                }
                .frame(width: 74, height: 111)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Reel.border, lineWidth: 1))
                Text(page.cover == true ? "cover" : "page")
                    .font(.system(size: 9)).foregroundColor(Reel.dim)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: Scene actions

    private func handle(_ action: SceneAction, scene: MovieScene, index: Int) {
        switch action {
        case .rerollPanel(let quality, let prompt):
            fire { try await MovieService.shared.rerollPanel(movieId, sceneId: scene.id, quality: quality, imagePrompt: prompt) }
        case .rerollClip(let tier, let prompt):
            fire { try await MovieService.shared.rerollClip(movieId, sceneId: scene.id, tier: tier, motionPrompt: prompt) }
        case .pairAndAnimate:
            // Mark the pair, then generate — the server passes the next panel
            // as last_image so the clip animates BETWEEN the two drawings.
            fire {
                _ = try await MovieService.shared.patchScene(movieId, sceneId: scene.id, ["pairWithNext": true])
                return try await MovieService.shared.rerollClip(movieId, sceneId: scene.id, tier: "draft")
            }
        case .unpair:
            fire(poll: false) { try await MovieService.shared.patchScene(movieId, sceneId: scene.id, ["pairWithNext": false]) }
        case .patchEdits(let edits):
            fire(poll: false) { try await MovieService.shared.patchScene(movieId, sceneId: scene.id, ["edits": edits]) }
        case .patchScene(let fields):
            fire(poll: false) { try await MovieService.shared.patchScene(movieId, sceneId: scene.id, fields) }
        case .move(let offset):
            guard var m = movie else { return }
            let to = index + offset
            guard to >= 0, to < m.scenes.count else { return }
            m.scenes.swapAt(index, to)
            movie = m
            let order = m.scenes.map(\.id)
            fire(poll: false) { try await MovieService.shared.reorder(movieId, order: order) }
        }
    }

    // MARK: Networking

    /// Run a service call, adopt the returned movie, and start polling if a
    /// job is now running.
    private func fire(poll: Bool = true, _ call: @escaping () async throws -> Movie) {
        busy = true
        Task {
            do {
                let m = try await call()
                movie = m
                if poll, m.job?.isRunning == true { schedulePoll() }
            } catch {
                errorText = error.localizedDescription
                autopilot = false
            }
            busy = false
        }
    }

    private func refresh() async {
        do {
            let m = try await MovieService.shared.movie(movieId)
            movie = m
            if m.job?.isRunning == true { schedulePoll() }
            else if autopilot { await advance() }
        } catch { errorText = error.localizedDescription }
    }

    private func schedulePoll() {
        pollGeneration += 1
        let generation = pollGeneration
        Task {
            try? await Task.sleep(nanoseconds: 3_200_000_000)
            guard generation == pollGeneration else { return }
            await refresh()
        }
    }

    /// Autopilot: chain the pipeline stages until the movie exists.
    private func advance() async {
        guard autopilot, let m = movie, m.job?.isRunning != true else { return }
        if m.job?.status == "error" { autopilot = false; return }
        do {
            switch stage(m) {
            case .panels:
                movie = try await MovieService.shared.renderPanels(movieId)
                schedulePoll()
            case .animate:
                movie = try await MovieService.shared.animateAll(movieId, tier: "draft")
                schedulePoll()
            case .stitch:
                movie = try await MovieService.shared.stitch(movieId)
                schedulePoll()
            case .restitch, .done:
                autopilot = false
            }
        } catch {
            errorText = error.localizedDescription
            autopilot = false
        }
    }

    // MARK: Bits

    private func sectionLabel(_ text: String) -> some View {
        Text(text).font(.caption2.weight(.semibold)).tracking(1.4).foregroundColor(Reel.dim)
    }

    private func bigButton(_ title: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Reel.amber)
                .foregroundColor(.white)
                .cornerRadius(Theme.radius)
        }
        .disabled(disabled)
        .opacity(disabled ? 0.45 : 1)
    }
}

// ─── One frame of the strip ──────────────────────────────────────────
enum SceneAction {
    case rerollPanel(quality: String, prompt: String?)
    case rerollClip(tier: String, prompt: String?)
    case pairAndAnimate            // one clip that travels THIS panel → NEXT panel
    case unpair
    case patchEdits([String: Any])
    case patchScene([String: Any])
    case move(Int)
}

private struct SceneFrame: View {
    let movie: Movie
    let scene: MovieScene
    let index: Int
    let isMerged: Bool
    let expanded: Bool
    let busy: Bool
    let onTap: () -> Void
    let onAction: (SceneAction) -> Void

    @State private var showImagePrompt = false
    @State private var showMotionPrompt = false
    @State private var showClipPreview = false
    @State private var showPanelZoom = false

    private var disabled: Bool { scene.edits?.enabled == false }

    /// The next scene has a rendered panel — pairing into it is possible.
    private var nextPanelExists: Bool {
        index + 1 < movie.scenes.count && movie.scenes[index + 1].panel?.url != nil
    }

    var body: some View {
        HStack(spacing: 0) {
            SprocketColumn()
            VStack(alignment: .leading, spacing: 10) {
                collapsedRow
                if expanded { expandedControls }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            SprocketColumn()
        }
        .background(Reel.strip)
        .cornerRadius(4)
        .opacity(disabled ? 0.45 : 1)
        .sheet(isPresented: $showImagePrompt) {
            PromptEditorSheet(
                title: "Image prompt",
                subtitle: "Exactly what the panel artist is told (zoom 2). Your style-reference drawing is attached automatically — style only, never its content.",
                text: scene.imagePrompt,
                actionLabel: "Save & re-roll panel  ·  \(MovieCosts.chip(0.06))"
            ) { newPrompt in
                onAction(.rerollPanel(quality: scene.panel?.quality ?? "medium", prompt: newPrompt))
            }
        }
        .sheet(isPresented: $showMotionPrompt) {
            PromptEditorSheet(
                title: "Motion prompt",
                subtitle: "Exactly what the video model is told to move (zoom 3). The style lock is added automatically.",
                text: scene.motionPromptOverride ?? scene.motionPrompt,
                actionLabel: "Save & re-animate  ·  \(MovieCosts.chip(0.06))"
            ) { newPrompt in
                onAction(.rerollClip(tier: scene.clip?.tier ?? "draft", prompt: newPrompt))
            }
        }
        .sheet(isPresented: $showClipPreview) {
            if let url = scene.clipURL {
                ClipPreviewSheet(title: scene.title, url: url)
            }
        }
        .sheet(isPresented: $showPanelZoom) {
            if let url = scene.panelURL {
                PanelZoomSheet(title: scene.title, url: url)
            }
        }
    }

    // MARK: Collapsed (zoom 1)

    private var collapsedRow: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                // Tapping the ART opens it big (pinch to zoom); tapping the
                // rest of the row expands the scene's controls.
                Button {
                    if scene.panelURL != nil { showPanelZoom = true } else { onTap() }
                } label: {
                    panelThumb
                }
                .buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Text(String(format: "%02d", index + 1))
                            .font(.caption2.weight(.black).monospaced())
                            .foregroundColor(Reel.amber)
                        Text(scene.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(Reel.ink)
                            .multilineTextAlignment(.leading)
                        if scene.key == true {
                            Text("★").font(.caption2).foregroundColor(Reel.amber)
                        }
                    }
                    statusLine
                    if scene.pairWithNext == true {
                        pairBadge("⛓ paired with the next frame — one seamless clip")
                    }
                    if isMerged {
                        pairBadge("⛓ lives inside the previous frame's clip")
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption2).foregroundColor(Reel.dim)
                    if let cost = scene.clip?.cost {
                        CostChip(text: MovieCosts.chip(cost))
                    }
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var panelThumb: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 3).fill(Reel.surface)
            if let url = scene.panelURL {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        ProgressView().tint(Reel.dim)
                    }
                }
            } else if scene.panel?.status == "running" {
                ReelSpinner(size: 18)
            } else {
                Image(systemName: "photo").foregroundColor(Reel.hole)
            }
        }
        .frame(width: 62, height: 82)
        .clipShape(RoundedRectangle(cornerRadius: 3))
    }

    private var statusLine: some View {
        HStack(spacing: 8) {
            statusDot("panel", state: scene.panel?.status, present: scene.panel?.url != nil)
            if !isMerged {
                statusDot(scene.clip?.tier == "standard" || scene.clip?.tier == "pro" ? "clip · kling" : "clip",
                          state: scene.clip?.status, present: scene.clip?.url != nil)
            }
        }
    }

    private func statusDot(_ label: String, state: String?, present: Bool) -> some View {
        HStack(spacing: 3) {
            if state == "running" {
                ReelSpinner(size: 9)
            } else {
                Circle()
                    .fill(state == "error" ? Reel.danger : (present ? Reel.green : Reel.hole))
                    .frame(width: 6, height: 6)
            }
            Text(label).font(.caption2).foregroundColor(Reel.dim)
        }
    }

    private func pairBadge(_ text: String) -> some View {
        Text(text).font(.caption2).foregroundColor(Reel.amber.opacity(0.85))
    }

    // MARK: Expanded (zoom 2-4)

    private var expandedControls: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let error = scene.panel?.error ?? scene.clip?.error {
                Text(error).font(.caption2).foregroundColor(Reel.danger)
            }
            Text(scene.summary).font(.caption).foregroundColor(Reel.dim)

            // Panel row (zoom 1-2)
            controlRow(label: "PANEL") {
                smallButton("🎲 Re-roll · \(MovieCosts.chip(0.06))") {
                    onAction(.rerollPanel(quality: "medium", prompt: nil))
                }
                smallButton("🎲 Low · \(MovieCosts.chip(0.02))") {
                    onAction(.rerollPanel(quality: "low", prompt: nil))
                }
                smallButton("✏️ Prompt") { showImagePrompt = true }
                smallButton("HQ · \(MovieCosts.chip(0.25))") {
                    onAction(.rerollPanel(quality: "high", prompt: nil))
                }
            }

            // Clip row (zoom 3)
            if !isMerged {
                controlRow(label: "CLIP") {
                    if scene.clipURL != nil {
                        smallButton("▶︎ Play") { showClipPreview = true }
                    }
                    smallButton("\(scene.clipURL == nil ? "▶︎ Animate" : "🎲 Re-roll") · \(MovieCosts.chip(0.06))") {
                        onAction(.rerollClip(tier: "draft", prompt: nil))
                    }
                    if scene.pairWithNext == true {
                        smallButton("⛓ Unpair from next") { onAction(.unpair) }
                    } else if nextPanelExists {
                        smallButton("⇢ Animate into next · \(MovieCosts.chip(0.06))") {
                            onAction(.pairAndAnimate)
                        }
                    }
                    smallButton("✏️ Motion") { showMotionPrompt = true }
                    Menu {
                        Button("Kling standard 720p · \(MovieCosts.chip(0.25))") {
                            onAction(.rerollClip(tier: "standard", prompt: nil))
                        }
                        Button("Kling pro 1080p · \(MovieCosts.chip(0.55))") {
                            onAction(.rerollClip(tier: "pro", prompt: nil))
                        }
                    } label: {
                        smallButtonLabel("⬆ Upgrade")
                    }
                }
                // Edit desk (zoom 4) — re-seeded when the clip changes
                if scene.clipURL != nil {
                    EditDesk(scene: scene, onAction: onAction)
                        .id(scene.id + (scene.clip?.url ?? ""))
                }
            }

            // Frame row: in/out of the cut, reorder
            controlRow(label: "FRAME") {
                smallButton(disabled ? "＋ Back in the cut" : "－ Drop from cut") {
                    onAction(.patchEdits(["enabled": disabled]))
                }
                smallButton("↑") { onAction(.move(-1)) }
                smallButton("↓") { onAction(.move(1)) }
            }
        }
        .disabled(busy)
        .opacity(busy ? 0.55 : 1)
    }

    private func controlRow<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption2.weight(.semibold)).tracking(1.2).foregroundColor(Reel.dim)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8, content: content)
            }
        }
    }

    private func smallButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { smallButtonLabel(title) }
    }

    private func smallButtonLabel(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundColor(Reel.ink)
            .padding(.horizontal, 10).padding(.vertical, 7)
            .background(Reel.surface)
            .cornerRadius(Theme.radius)
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
    }
}

// ─── The edit desk: trim / speed / freeze / fade (zoom 4) ────────────
private struct EditDesk: View {
    let scene: MovieScene
    let onAction: (SceneAction) -> Void

    @State private var trimStart: Double
    @State private var trimEnd: Double
    @State private var speed: Double
    @State private var freeze: Double
    @State private var fade: Double

    private let speeds: [Double] = [0.5, 0.8, 1.0, 1.5, 2.0]

    init(scene: MovieScene, onAction: @escaping (SceneAction) -> Void) {
        self.scene = scene
        self.onAction = onAction
        let e = scene.edits
        _trimStart = State(initialValue: e?.trimStart ?? 0)
        let end = e?.trimEnd ?? 0
        _trimEnd = State(initialValue: end > 0 ? end : scene.clipSeconds)
        _speed = State(initialValue: e?.speed ?? 1)
        _freeze = State(initialValue: e?.freezeEnd ?? 0)
        _fade = State(initialValue: e?.fadeOut ?? 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("EDIT DESK — free, applied at stitch")
                .font(.caption2.weight(.semibold)).tracking(1.2).foregroundColor(Reel.dim)

            // Trim
            HStack {
                Text("in \(trimStart, specifier: "%.1f")s").font(.caption2.monospaced()).foregroundColor(Reel.ink)
                Slider(value: $trimStart, in: 0...max(0.1, scene.clipSeconds - 0.5), step: 0.1) { editing in
                    if !editing { commit() }
                }
                Text("out \(trimEnd, specifier: "%.1f")s").font(.caption2.monospaced()).foregroundColor(Reel.ink)
                Slider(value: $trimEnd, in: 0.5...scene.clipSeconds, step: 0.1) { editing in
                    if !editing { commit() }
                }
            }

            // Speed
            HStack(spacing: 6) {
                Text("speed").font(.caption2).foregroundColor(Reel.dim)
                ForEach(speeds, id: \.self) { s in
                    Button {
                        speed = s
                        commit()
                    } label: {
                        Text(s == 1 ? "1×" : String(format: "%g×", s))
                            .font(.caption2.weight(.bold))
                            .foregroundColor(speed == s ? .white : Reel.ink)
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .background(speed == s ? Reel.amber : Reel.surface)
                            .cornerRadius(Theme.radius)
                    }
                }
            }

            // Freeze + fade
            HStack(spacing: 14) {
                Stepper(value: $freeze, in: 0...5, step: 0.5,
                        onEditingChanged: { editing in if !editing { commit() } }) {
                    Text("freeze \(freeze, specifier: "%.1f")s").font(.caption2).foregroundColor(Reel.ink)
                }
                Stepper(value: $fade, in: 0...3, step: 0.5,
                        onEditingChanged: { editing in if !editing { commit() } }) {
                    Text("fade \(fade, specifier: "%.1f")s").font(.caption2).foregroundColor(Reel.ink)
                }
            }
        }
        .padding(10)
        .background(Reel.surface.opacity(0.5))
        .cornerRadius(Theme.radius)
    }

    private func commit() {
        if trimEnd < trimStart + 0.5 { trimEnd = min(scene.clipSeconds, trimStart + 0.5) }
        onAction(.patchEdits([
            "trimStart": trimStart,
            // full length → 0 (play to the end), so longer re-rolls aren't cut
            "trimEnd": trimEnd >= scene.clipSeconds - 0.05 ? 0 : trimEnd,
            "speed": speed,
            "freezeEnd": freeze,
            "fadeOut": fade,
        ]))
    }
}

// ─── Sheets ──────────────────────────────────────────────────────────
private struct PromptEditorSheet: View {
    let title: String
    let subtitle: String
    @State var text: String
    let actionLabel: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text(subtitle).font(.caption).foregroundColor(Reel.dim)
                TextEditor(text: $text)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .background(Reel.surface)
                    .foregroundColor(Reel.ink)
                    .cornerRadius(Theme.radius)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.border, lineWidth: 1))
                Button {
                    onSave(text.trimmingCharacters(in: .whitespacesAndNewlines))
                    dismiss()
                } label: {
                    Text(actionLabel)
                        .font(.subheadline.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(Reel.amber)
                        .foregroundColor(.white)
                        .cornerRadius(Theme.radius)
                }
            }
            .padding()
            .background(Reel.base.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundColor(Reel.dim)
                }
            }
            .toolbarBackground(Reel.base, for: .navigationBar)
        }
    }
}

/// The one player every clip in Movies opens in — a scene's clip, a quick
/// animation, a finished cut — which is why the way OUT of the app lives here:
/// one download button, one share sheet, one set of failure messages, on
/// everything Movies makes (Sophie, Aug 2026: "there's no download button and
/// they don't appear in my creations").
struct ClipPreviewSheet: View {
    let title: String
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var toast: String?
    @State private var photosDenied = false

    var body: some View {
        NavigationStack {
            MoviePlayer(url: url)
                .background(Reel.strip.ignoresSafeArea())
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Done") { dismiss() }.foregroundColor(Reel.amber)
                    }
                    ToolbarItemGroup(placement: .navigationBarTrailing) {
                        Button { save() } label: {
                            Image(systemName: "arrow.down.to.line").foregroundColor(Reel.amber)
                        }
                        // Files / AirDrop / Messages — Photos is not always
                        // where a piece of footage is wanted next.
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up").foregroundColor(Reel.amber)
                        }
                    }
                }
                .toolbarBackground(Reel.base, for: .navigationBar)
                .overlay(alignment: .bottom) { toastView }
                // Permission was refused at some point: the request returns
                // instantly from then on and never shows the system prompt
                // again, so the only way back is Settings.
                .alert("Photos access is off", isPresented: $photosDenied) {
                    Button("Open Settings") {
                        if let u = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(u)
                        }
                    }
                    Button("Not now", role: .cancel) { }
                } message: {
                    Text("Turn on “Add Photos Only” for ImageForge to save clips to your library.")
                }
        }
    }

    @ViewBuilder private var toastView: some View {
        if let t = toast {
            Text(t)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(Reel.base)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Reel.amber)
                .cornerRadius(Theme.radius)
                .padding(.bottom, 40)
                .transition(.opacity)
        }
    }

    /// Say something the instant it's tapped: a clip is a few MB and the
    /// download plus the permission round trip take a moment, so a silent
    /// button reads as a dead one.
    private func save() {
        showToast("Saving…", seconds: 30)
        VideoSaver.shared.save(from: url) { outcome in
            switch outcome {
            case .saved:           showToast("Saved to Photos")
            case .denied:          withAnimation { toast = nil }; photosDenied = true
            case .failed(let why): showToast("Couldn’t save — \(why)", seconds: 4)
            }
        }
    }

    private func showToast(_ message: String, seconds: Double = 1.8) {
        withAnimation { toast = message }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            withAnimation { if toast == message { toast = nil } }
        }
    }
}

/// Full-screen panel viewer with pinch-to-zoom — for looking the character
/// (or any frame) in the eye before deciding.
struct PanelZoomSheet: View {
    let title: String
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                ScrollView([.horizontal, .vertical], showsIndicators: false) {
                    AsyncImage(url: url) { phase in
                        if case .success(let image) = phase {
                            image.resizable().scaledToFit()
                        } else {
                            ProgressView().tint(Reel.dim)
                        }
                    }
                    .frame(width: geo.size.width * scale, height: geo.size.height * scale)
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
            .background(Reel.base.ignoresSafeArea())
            .gesture(
                MagnificationGesture()
                    .onChanged { value in scale = min(5, max(1, lastScale * value)) }
                    .onEnded { _ in lastScale = scale }
            )
            .onTapGesture(count: 2) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    scale = scale > 1 ? 1 : 2.5
                    lastScale = scale
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }.foregroundColor(Reel.amber)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up").foregroundColor(Reel.amber)
                    }
                }
            }
        }
    }
}

/// Full-screen zine page: read it, share it.
struct ZinePageSheet: View {
    let page: ZinePage
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    if let url = page.pageURL {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFit()
                            } else {
                                ProgressView().tint(Reel.dim).frame(height: 400)
                            }
                        }
                        .cornerRadius(Theme.radiusLg)
                        ShareLink(item: url) {
                            Label("Share this page", systemImage: "square.and.arrow.up")
                                .font(.caption.weight(.semibold)).foregroundColor(Reel.amber)
                        }
                    }
                }
                .padding()
            }
            .background(Reel.base.ignoresSafeArea())
            .navigationTitle(page.cover == true ? "Cover" : "Zine page")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }.foregroundColor(Reel.amber)
                }
            }
        }
    }
}

/// AVKit player that starts playing on appear and loops.
struct MoviePlayer: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                let p = AVPlayer(url: url)
                p.actionAtItemEnd = .none
                NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime,
                    object: p.currentItem, queue: .main
                ) { _ in
                    p.seek(to: .zero)
                    p.play()
                }
                player = p
                p.play()
            }
            .onDisappear { player?.pause() }
    }
}

// ─── Settings ────────────────────────────────────────────────────────
struct MovieSettingsSheet: View {
    @AppStorage("forge.serverURL") private var serverURL = ""
    @AppStorage("forge.studioToken") private var studioToken = ""
    @State private var checkResult: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(MovieService.defaultServer, text: $serverURL)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Studio token (if the server is gated)", text: $studioToken)
                } header: {
                    Text("Forge server")
                } footer: {
                    Text("The movie pipeline runs on the ImageForge server — the app holds no AI keys. Leave the URL empty for the default.")
                }
                Section {
                    Button("Check connection") {
                        checkResult = "checking…"
                        Task {
                            do {
                                let s = try await MovieService.shared.status()
                                checkResult = "connected ✓  openai \(s.openai ? "✓" : "✗") · replicate \(s.replicate ? "✓" : "✗") · ffmpeg \(s.ffmpeg ? "✓" : "✗") · storage \(s.firebase ? "✓" : "✗")\(s.gated ? " · token required" : "")"
                            } catch {
                                checkResult = "failed: \(error.localizedDescription)"
                            }
                        }
                    }
                    if let checkResult {
                        Text(checkResult).font(.caption)
                    }
                }
            }
            .navigationTitle("Movie Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) { Button("Done") { dismiss() } }
            }
        }
    }
}

// ─── Reel widgets ────────────────────────────────────────────────────
/// Square sprocket holes down both edges of the strip (real 35mm has square
/// perforations — the motif from the prototyping session).
private struct SprocketColumn: View {
    var body: some View {
        GeometryReader { geo in
            let count = max(2, Int(geo.size.height / 24))
            VStack(spacing: 0) {
                ForEach(0..<count, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Reel.hole)
                        .frame(width: 10, height: 10)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: 24)
    }
}

/// A little spinning film reel — the medium's progress spinner.
struct ReelSpinner: View {
    var size: CGFloat = 20
    @State private var spinning = false

    var body: some View {
        ZStack {
            Circle().stroke(Reel.amber, lineWidth: size * 0.09)
            ForEach(0..<5, id: \.self) { i in
                Circle()
                    .fill(Reel.amber)
                    .frame(width: size * 0.18, height: size * 0.18)
                    .offset(y: -size * 0.27)
                    .rotationEffect(.degrees(Double(i) * 72))
            }
            Circle().fill(Reel.amber).frame(width: size * 0.14, height: size * 0.14)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(spinning ? 360 : 0))
        .onAppear {
            withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) {
                spinning = true
            }
        }
    }
}

private struct CostChip: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.caption2.weight(.bold).monospaced())
            .foregroundColor(Reel.amber)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: Theme.radius).stroke(Reel.amber.opacity(0.6), lineWidth: 1))
    }
}

private struct JobBanner: View {
    let job: MovieJob

    var body: some View {
        HStack(spacing: 10) {
            if job.isRunning { ReelSpinner(size: 20) }
            VStack(alignment: .leading, spacing: 2) {
                if job.isRunning {
                    Text("\(job.kind)\(progressText)").font(.caption.weight(.semibold)).foregroundColor(Reel.ink)
                    Text(job.label ?? "working…").font(.caption2).foregroundColor(Reel.dim)
                } else if job.status == "error" {
                    Text("The \(job.kind) step hit trouble").font(.caption.weight(.semibold)).foregroundColor(Reel.danger)
                    Text(job.error ?? "unknown error").font(.caption2).foregroundColor(Reel.dim)
                }
            }
            Spacer()
        }
        .padding(12)
        .background(Reel.surface)
        .cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg)
            .stroke(job.status == "error" ? Reel.danger.opacity(0.5) : Reel.border, lineWidth: 1))
    }

    private var progressText: String {
        guard let done = job.done, let total = job.total, total > 0 else { return "" }
        return "  ·  \(done)/\(total)"
    }
}

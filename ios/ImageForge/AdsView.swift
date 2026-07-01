import SwiftUI
import UIKit
import AuthenticationServices
import FirebaseAuth

/// Ads — run Instagram/Facebook ad campaigns without the Ads Manager maze.
/// You tap Connect (log in on Meta's own screen), the app finds your ad account
/// + pixel, then you describe what you're promoting and a daily budget. Every
/// campaign is created PAUSED — nothing spends until you tap Launch.
struct AdsView: View {
    @State private var phase: Phase = .loading
    @State private var summary: AdsStatus?
    @State private var errorText: String?

    // Campaign builder
    @State private var promoting = ""
    @State private var dailyBudget = 15
    @State private var creating = false
    @State private var lastCampaign: AdsCampaign?

    @State private var connecting = false
    @FocusState private var promoteFocused: Bool

    enum Phase { case loading, disconnected, connected }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                StarTitle(text: "Ads").frame(maxWidth: .infinity).padding(.top, 4)

                switch phase {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                case .disconnected:
                    connectCard
                case .connected:
                    connectedHeader
                    builderCard
                    if let c = lastCampaign { campaignCard(c) }
                }
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("").navigationBarTitleDisplayMode(.inline)
        .task { await refresh() }
        .alert("Something went wrong",
               isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: { Text(errorText ?? "") }
    }

    // MARK: - Disconnected

    private var connectCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Connect your Meta account")
                .font(.headline).foregroundColor(Theme.text)
            Text("Tap Connect and log in on Meta's screen. The app finds your ad account and pixel for you — you won't have to hunt for anything.")
                .font(.subheadline).foregroundColor(Theme.textDim)
                .fixedSize(horizontal: false, vertical: true)
            Button { connect() } label: {
                HStack {
                    if connecting { ProgressView().tint(.white) }
                    Text(connecting ? "Connecting…" : "Connect Meta")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity).frame(height: 50)
                .background(Theme.mauve).foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            }
            .disabled(connecting)
            Text("No passwords are shared — Meta hands the app permission directly.")
                .font(.caption2).foregroundColor(Theme.textDim)
        }
        .padding(16)
        .background(Theme.surface).cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Connected

    private var connectedHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Connected to Meta", systemImage: "checkmark.seal.fill")
                .font(.subheadline.weight(.semibold)).foregroundColor(Theme.text)
            if let name = summary?.accountName {
                Text(accountLine(name: name, currency: summary?.currency))
                    .font(.caption).foregroundColor(Theme.textDim)
            }
            if let pixel = summary?.pixelId {
                Label("Found your pixel ✓  (\(pixel))", systemImage: "dot.radiowaves.left.and.right")
                    .font(.caption).foregroundColor(Theme.accent)
            } else {
                Label("No pixel detected yet — we can still run traffic ads.",
                      systemImage: "exclamationmark.triangle")
                    .font(.caption).foregroundColor(Theme.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface2).cornerRadius(Theme.radiusLg)
    }

    private var builderCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("New campaign").font(.headline).foregroundColor(Theme.text)

            VStack(alignment: .leading, spacing: 6) {
                Text("WHAT ARE YOU PROMOTING?")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                TextField("your shop, or a product link…", text: $promoting, axis: .vertical)
                    .lineLimit(1...3).font(.body).foregroundColor(Theme.text)
                    .focused($promoteFocused)
                    .padding(12).background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.border, lineWidth: 1))
                    .cornerRadius(Theme.radius)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("DAILY BUDGET")
                    .font(.caption2.weight(.semibold)).tracking(1).foregroundColor(Theme.textDim)
                HStack(spacing: 14) {
                    Stepper(value: $dailyBudget, in: 5...200, step: 5) {
                        Text("$\(dailyBudget)/day").font(.body.weight(.semibold)).foregroundColor(Theme.text)
                    }
                }
                Text("Meta needs ~2 weeks to learn. Nothing spends until you launch.")
                    .font(.caption2).foregroundColor(Theme.textDim)
            }

            Button { create() } label: {
                HStack {
                    if creating { ProgressView().tint(.white) }
                    Text(creating ? "Building…" : "Build campaign (paused)")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity).frame(height: 50)
                .background(Theme.mauve).foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .opacity(creating || promoting.trimmingCharacters(in: .whitespaces).isEmpty ? 0.6 : 1)
            }
            .disabled(creating || promoting.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(16)
        .background(Theme.surface).cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func campaignCard(_ c: AdsCampaign) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(c.name).font(.subheadline.weight(.semibold)).foregroundColor(Theme.text)
                Spacer()
                Text(c.status.capitalized)
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(c.status == "ACTIVE" ? .white : Theme.text)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(c.status == "ACTIVE" ? Theme.accent : Theme.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
            }
            Text("Created paused. Review it, then launch when you're ready — this is the moment it can start spending.")
                .font(.caption).foregroundColor(Theme.textDim)
            HStack(spacing: 10) {
                Button {
                    setStatus(c, active: c.status != "ACTIVE")
                } label: {
                    Text(c.status == "ACTIVE" ? "Pause" : "Launch")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity).frame(height: 44)
                        .background(c.status == "ACTIVE" ? Theme.surface2 : Theme.mauve)
                        .foregroundColor(c.status == "ACTIVE" ? Theme.text : .white)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                }
            }
        }
        .padding(16)
        .background(Theme.surface).cornerRadius(Theme.radiusLg)
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
    }

    private func accountLine(name: String, currency: String?) -> String {
        if let c = currency, !c.isEmpty { return "Ad account: \(name) · \(c)" }
        return "Ad account: \(name)"
    }

    // MARK: - Actions

    private func refresh() async {
        do {
            let s = try await ForgeService.shared.adsSummary()
            summary = s
            phase = s.connected ? .connected : .disconnected
        } catch {
            phase = .disconnected
        }
    }

    private func connect() {
        guard let uid = Auth.auth().currentUser?.uid, !uid.isEmpty else {
            // Ensure we're signed in first, then connect.
            Task {
                try? await ForgeService.shared.ensureSignedIn()
                connect()
            }
            return
        }
        connecting = true
        let base = "https://us-central1-membry-df528.cloudfunctions.net/adsAuthStart"
        guard let url = URL(string: "\(base)?state=\(uid)") else { connecting = false; return }
        let session = ASWebAuthenticationSession(
            url: url, callbackURLScheme: "imageforge"
        ) { _, error in
            connecting = false
            if let error = error as? ASWebAuthenticationSessionError,
               error.code == .canceledLogin { return }
            if error != nil { errorText = "Couldn't finish connecting. Please try again."; return }
            Task { await refresh() }
        }
        session.presentationContextProvider = AuthContext.shared
        session.prefersEphemeralWebSession = false
        session.start()
    }

    private func create() {
        promoteFocused = false
        let what = promoting.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !what.isEmpty else { return }
        creating = true
        Task {
            do {
                lastCampaign = try await ForgeService.shared.adsCreateCampaign(
                    promoting: what, dailyBudgetCents: dailyBudget * 100)
            } catch {
                errorText = error.localizedDescription
            }
            creating = false
        }
    }

    private func setStatus(_ c: AdsCampaign, active: Bool) {
        Task {
            do {
                try await ForgeService.shared.adsSetStatus(id: c.id, active: active)
                lastCampaign = AdsCampaign(id: c.id, name: c.name, status: active ? "ACTIVE" : "PAUSED")
            } catch {
                errorText = error.localizedDescription
            }
        }
    }
}

/// Presentation anchor for ASWebAuthenticationSession.
final class AuthContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AuthContext()
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

/// The connection + pixel state the app shows after Connect.
struct AdsStatus {
    let connected: Bool
    let accountName: String?
    let currency: String?
    let pixelId: String?
}

/// A created ad campaign (starts PAUSED).
struct AdsCampaign {
    let id: String
    let name: String
    let status: String   // "PAUSED" | "ACTIVE"
}

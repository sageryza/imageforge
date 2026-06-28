import SwiftUI

// Shared AI-data consent gate for App Store Guideline 5.1.2(i): before any
// personal content is sent to a third-party AI, name the providers and get
// explicit consent. Pass a ComplianceTheme that matches the app.

struct ComplianceTheme {
    var background: Color
    var card: Color
    var ink: Color
    var subtleInk: Color
    var accent: Color
    var accentText: Color
    var line: Color
    var titleFont: (CGFloat) -> Font
    var bodyFont: (CGFloat) -> Font
}

struct AIProvider: Identifiable {
    let id = UUID()
    let name: String
    let role: String
}

struct AIConsentSheet: View {
    let theme: ComplianceTheme
    let appName: String
    let providers: [AIProvider]
    let dataDescription: String          // what is sent, e.g. "the prompt you enter"
    var privacyURL: URL? = nil
    var onAgree: () -> Void
    var onCancel: () -> Void

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()
            VStack(spacing: 18) {
                Spacer(minLength: 6)
                Image(systemName: "sparkles").font(.system(size: 38)).foregroundStyle(theme.accent)
                Text("Uses AI").font(theme.titleFont(28)).foregroundStyle(theme.ink)
                Text("To create your result, \(appName) sends \(dataDescription) to the AI partners below, who generate it. It's used only for this — nothing else.")
                    .font(theme.bodyFont(19)).foregroundStyle(theme.subtleInk)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true).padding(.horizontal, 4)
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(providers) { p in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Image(systemName: "arrow.up.forward.app.fill").foregroundStyle(theme.accent)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(p.name).font(theme.bodyFont(18)).foregroundStyle(theme.ink)
                                Text(p.role).font(theme.bodyFont(15)).foregroundStyle(theme.subtleInk)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                .background(theme.card)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.line))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                if let privacyURL {
                    Link("Privacy details", destination: privacyURL).font(theme.bodyFont(16)).foregroundStyle(theme.accent)
                }
                Spacer(minLength: 6)
                Button(action: onAgree) {
                    Text("Agree & Continue").font(theme.titleFont(20)).foregroundStyle(theme.accentText)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(theme.accent).clipShape(RoundedRectangle(cornerRadius: 8))
                }
                Button(action: onCancel) {
                    Text("Not now").font(theme.bodyFont(18)).foregroundStyle(theme.subtleInk).padding(.vertical, 4)
                }
            }
            .padding(24).frame(maxWidth: 460)
        }
    }
}

extension ComplianceTheme {
    static let deckFactory = ComplianceTheme(
        background: Color(red: 0.99, green: 0.80, blue: 0.16),  // yellow
        card: .white, ink: .black, subtleInk: Color(white: 0.25),
        accent: .black, accentText: .white, line: Color(white: 0.0, opacity: 0.15),
        titleFont: { Font.system(size: $0, weight: .heavy) },
        bodyFont:  { Font.system(size: $0) })
}

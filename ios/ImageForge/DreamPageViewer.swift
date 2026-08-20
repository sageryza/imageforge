import SwiftUI
import UIKit

/// A single dream page pulled up for a closer look: the comic image, and the
/// dream you wrote that it came from. Shown as a centered popup (like the
/// gallery) with a two-tab pill — Picture / Words — in the Writing Room style,
/// one pink, one gold.
struct DreamPageRef: Identifiable {
    let id: String            // the page URL string
    let url: URL?
    let title: String
    let dreamText: String     // the actual words you wrote for this dream
}

struct DreamPagePopup: View {
    let ref: DreamPageRef
    let onClose: () -> Void

    @State private var tab = 0            // 0 = picture, 1 = words
    @State private var toast: String?

    var body: some View {
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()
                .onTapGesture { onClose() }

            VStack(spacing: 12) {
                HStack {
                    Button { save() } label: {
                        Label("Save", systemImage: "arrow.down.to.line")
                            .font(.subheadline.weight(.semibold))
                    }
                    .opacity(tab == 0 ? 1 : 0)          // saving only makes sense on the picture
                    .disabled(tab != 0)
                    Spacer()
                    Button { onClose() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .semibold))
                    }
                }
                .tint(Theme.accent)

                tabPill

                if tab == 0 {
                    Group {
                        if let url = ref.url {
                            CachedImageView(url: url, contentMode: .fit)
                        } else {
                            Image(systemName: "exclamationmark.triangle").foregroundColor(Theme.danger)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 260, maxHeight: 440)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                } else {
                    ScrollView {
                        Text(ref.dreamText.isEmpty ? "No text saved for this dream." : ref.dreamText)
                            .font(.callout).foregroundColor(Theme.text)
                            .lineSpacing(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(4)
                    }
                    .frame(minHeight: 260, maxHeight: 440)
                }
            }
            .padding(16)
            .frame(maxWidth: 360)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
            .overlay(RoundedRectangle(cornerRadius: Theme.radiusLg).stroke(Theme.border, lineWidth: 1))
            .shadow(color: .black.opacity(0.25), radius: 20, y: 8)
            .padding(24)
        }
        .overlay(alignment: .bottom) { toastView }
    }

    // Two-tab pill (Writing Room style): the selected tab fills — pink for the
    // picture, gold for the words.
    private var tabPill: some View {
        HStack(spacing: 0) {
            pillTab("Picture", index: 0, active: Theme.mauve)
            pillTab("Words", index: 1, active: Theme.lightGold)
        }
        .padding(3)
        .background(Theme.surface2)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
    }

    private func pillTab(_ label: String, index: Int, active: Color) -> some View {
        Button { withAnimation(.easeInOut(duration: 0.15)) { tab = index } } label: {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(tab == index ? Theme.ink : Theme.textDim)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(tab == index ? active : Color.clear)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private var toastView: some View {
        if let t = toast {
            Text(t)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Theme.text.opacity(0.9))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
                .padding(.bottom, 40)
                .transition(.opacity)
        }
    }

    /// Save the comic page to Photos (from cache when we already have it).
    /// Through `PhotoSaver`, like everything else that saves: the old
    /// `UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)` asked for no
    /// permission and had no completion, so a refused photo library toasted
    /// "Saved to Photos" and saved nothing, forever.
    private func save() {
        guard let url = ref.url else { return }
        Task {
            // Only fetch on a cache miss, as before — the cache holds a
            // decoded UIImage, so a hit has no original bytes to pass on and
            // PhotoSaver re-encodes it instead.
            var bytes: Data?
            var image = ImageCache.shared.object(forKey: url as NSURL)
            if image == nil, let (data, _) = try? await URLSession.shared.data(from: url) {
                bytes = data
                image = UIImage(data: data)
            }
            guard bytes != nil || image != nil else { showToast("Couldn’t load that image"); return }
            PhotoSaver.shared.save(data: bytes, image: image) { outcome in
                switch outcome {
                case .saved:
                    showToast("Saved to Photos")
                // Only Settings can turn the permission back on, so a toast on
                // its own would be a dead end.
                case .denied:
                    showToast("Photos access is off")
                    ForgeSaveBridge.offerPhotosSettings()
                case .failed(let why):
                    showToast("Couldn’t save — \(why)")
                }
            }
        }
    }

    private func showToast(_ message: String) {
        withAnimation { toast = message }
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            withAnimation { toast = nil }
        }
    }
}

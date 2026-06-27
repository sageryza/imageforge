# ImageForge — native iOS app (Test Station)

A SwiftUI app that brings the **Test Station** to iOS: type one prompt, tap a
house style (or tick several and run them together), and compare the results.

The **backend is reused unchanged** — it signs in anonymously with Firebase Auth
and calls the `forgeTestImage` Cloud Function (in the sibling
`memory-library-react/functions`), which renders the prompt through the chosen
Replicate LoRA (incl. HOONIE's linocut, with its suffix + 40 steps) or OpenAI
`gpt-image-2` (quality low), and returns a permanent Storage URL. **No API keys
ship in the app** — they live in the function's locked-down Firestore config
(`config/replicate`, `config/openai`), same pattern as the Miracles app.

> Built remotely and **not yet compiled** — expect a few fixes on the first
> `xcodebuild`. Running Claude Code locally on the Mac (pointed at `ios/`) is the
> fastest way to iterate: it can build, run the Simulator, and fix errors with you.

## One-time setup

1. **Firebase config.** In the [Firebase console](https://console.firebase.google.com/project/membry-df528/settings/general)
   add an **iOS app** (bundle id `com.sageryza.imageforge`), download
   **`GoogleService-Info.plist`**, and drop it into `ios/ImageForge/`.

2. **Deploy the function.** From `memory-library-react/`, run
   `firebase deploy --only functions:forgeTestImage` (the Replicate + OpenAI keys
   must already be set in `config/*` — they are, since the games use them).

3. **Generate the Xcode project.** Two options:
   - **XcodeGen (recommended):** `brew install xcodegen`, then from `ios/` run
     `xcodegen generate`. Opens cleanly with the Firebase Swift Package wired up.
   - **Manual:** create a new Xcode *App* (SwiftUI, iOS 16+), add the firebase-ios-sdk
     Swift Package (`https://github.com/firebase/firebase-ios-sdk`) with products
     **FirebaseCore**, **FirebaseAuth**, **FirebaseFunctions**, then add the
     `ImageForge/*.swift` files and `GoogleService-Info.plist` to the target.

4. **Build & run** on the Simulator (iOS 16+). Anonymous sign-in happens on the
   first generation.

## Files

| File | Role |
|---|---|
| `project.yml` | XcodeGen spec (target, Firebase SPM deps, bundle id) |
| `ImageForge/ImageForgeApp.swift` | App entry, `FirebaseApp.configure()` |
| `ImageForge/Theme.swift` | House palette (matches `public/forge.css`) |
| `ImageForge/Models.swift` | `ForgeStyle`, `ForgeStyles.all`, `ForgeResult` |
| `ImageForge/ForgeService.swift` | Anonymous auth + `forgeTestImage` callable |
| `ImageForge/TestStationView.swift` | The Style Machine UI (tiles + results) |

Tiles load their committed previews from the live web app
(`https://imageforge-q125.onrender.com/samples/<seg>.webp`); gpt-image-2 shows a
placeholder until it's run.

## Notes / next

- Keep `ForgeStyles.all` (here), `MODELS` (`server.js`) and `FORGE_STYLES`
  (the Cloud Function) in sync when styles change.
- **TestFlight (no Mac needed):** builds run from the **`ImageForge TestFlight`**
  workflow in the `memory-library-react` repo, which already holds the App Store
  Connect secrets. That workflow checks out *this* public repo at build time and
  runs the lane below (`ios/fastlane/Fastfile`, `fastlane beta`) — Apple-managed
  signing, no certs. Trigger it from that repo's Actions tab (`workflow_dispatch`).
  The App Store Connect app record (`com.sageryza.imageforge` / "ImageForge")
  must exist once; the App ID auto-registers during signing. Team id `5XR23N2CBH`.
  - This repo also keeps its own `iOS TestFlight` workflow
    (`.github/workflows/ios-testflight.yml`), but it's **manual-only**
    (`workflow_dispatch`) and dormant until you add `ASC_KEY_ID`,
    `ASC_ISSUER_ID`, `ASC_KEY_P8` as secrets here. Once they're set you can run
    it directly (and re-add a `push` trigger for auto-builds) to make this repo
    self-contained instead of building from the games repo.
- Add an endpoint/app check before wide beta so the callable can't be abused
  (it's auth-gated, but anonymous auth is open).
- Next workflows to port: the **Deck Factory** pipeline, then the Picture Book /
  Zine, reusing the same service pattern.

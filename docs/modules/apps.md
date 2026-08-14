# Public apps (Secretly a Witch, Sticker Day)

The two public, ungated apps and their content pipelines.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. Nothing was rewritten; this is the text as it stood.)*

## Secretly a Witch (public witchy app)
- **SHIPPING IT IS ALL CI — no Mac, and that now includes the App Store
  listing text (Aug 2026).** Three workflows in `memory-library-react`, which
  is where the App Store Connect secrets live; every one of them takes the
  bundle id `com.sageryza.secretlyawitch` (the app builds from the
  `SecretlyAWitch` target in THIS repo's `ios/`, and the workflow checks this
  repo out — `imageforge_ref` picks the branch):
  - **Secretly a Witch TestFlight** — build + upload.
  - **ASC edit metadata** (`ci/asc_metadata.py`) — description, keywords,
    subtitle, promotional text, What's New, and the App Review contact /
    demo account / notes. **Run it with `dry_run` ON first**: it prints every
    current value plus the app and version a write would land on, so nobody
    edits the wrong app. Fields with no input of their own (supportUrl,
    marketingUrl, privacyPolicyUrl, demo account…) go through `fields_json`,
    where `""` CLEARS a field. Edits save on the version but do NOT submit.
  - **ASC submit release** (`ci/asc_submit_release.py`) — attach the build,
    set What's New, submit. `resubmit:true` cancels an in-queue submission
    first so a newer build can take its place.
  So a rejected version is reworked entirely from a chat: fix the metadata,
  then submit. **The two things that still need Sophie** are the reviewer's
  rejection text and any Resolution Center reply — Apple exposes neither in
  the public API, so paste the message in rather than guessing at it.
  Screenshots are API-able in principle but that flow is NOT built.
- **School + quiz art is served as WEBP, never the PNG originals (Aug 2026).**
  `SW_IMG` points at `witch-school/webp/` and every reference goes through
  `SW_EXT`, never a hard-coded `.png`; `QZ_IMG` is the SAME folder (the `qz-*`
  quiz cards have always lived in `witch-school/assets/` — `witch-quiz/assets/`
  is the videos). The lesson preload waits for the School tab instead of firing
  at boot on the Home screen. **Anyone adding or replacing cards must run
  `node scripts/webp-assets.js` and then `node scripts/webp-assets-verify.js`
  BEFORE deploying** — see the image-weight rule under Design rules.
- **The loading animation is CUT OUT — `/hoonie-loading-clear.gif` (Aug 2026,
  Sophie).** Every loading spot in the app sits on cream (`--bg #f5efe2`,
  `--surface #fffbf3`, `--panel #efe6d3`), so the old `hoonie-loading.gif`'s
  white square showed as a visible box. The clear one is the same hoonies with
  the paper removed — transparent background, 70 drawings, 240px, 390KB (the
  old one: 45 drawings, 360px, 865KB). Both files stay in `public/`; the old
  one is still what iOS bundles (`TestStationView` deliberately puts
  `Color.white` behind it). Rebuild either from a folder of hoonies with
  `python3 scripts/hoonie-cutouts.py <dir> --gif public/hoonie-loading-clear.gif
  --size 240 --pad 16 --max 70` (needs `pip3 install Pillow numpy scipy`); the same
  script writes the transparent PNG cutouts with `--out`. GIF transparency is
  1-bit, so each frame quantizes its own real colors (7 + transparent), so the ink keeps
  its warm tone — the first cut quantized to neutral gray and read greeny on
  the app's cream surfaces.
- **The hoonies themselves live in the Dump**, album **hoonies** (#228, 140
  drawings — woodcut smallies, many of them two things grown into each other).
  Cutouts at Storage `hoonies/cutouts2/<nnn>.png`, 210px webp thumbs at
  `hoonies/thumb2/` (v1 at `cutouts/`/`thumb/` was grayscale-quantized and read
  greeny on cream; v2 is the corner flood-fill cut — new paths because the old
  objects are immutable-cached). As a gpt-image-2 style reference they transfer well with
  the refs attached and **NO written style description** (same finding as
  `docs/evan-film-style.md`) — adding an engraving description pulls the line
  finer and more modern, away from their blunt woodcut feel.
- **Witch School lessons: the complete creation workflow is documented in
  `docs/witch-school-lessons.md`** — read it BEFORE writing a lesson so new
  lessons match the 14 live ones (voice, research pass, illustration pipeline
  via `scripts/witch-school-cards.js`, per-card sampled backgrounds, wiring,
  tests). Sophie's style refs live at `storage:witch-school/refs/sophie-snake.png + sophie-animals.png`.
- `public/witch.html` (page at `/witch`, **ungated/public**) is a mobile-first,
  single-page app with a **fixed bottom nav** (Lucide icons). Its own dark
  mystical theme (inline, not `forge.css`). Reuses the open `/api/generate/*`
  endpoints + a small set of stateless AI endpoints in `server.js`:
  `POST /api/witch/{tarot,spell,horoscope}` (all `openaiChat`,
  **Claude** via `anthropicChat`; `parseAnthropicJson` strips fences).
- **The blog is a real NAVIGATION out of the app page, and the tab re-assert
  must not follow it (Aug 2026 — this bug made the blog unreachable in the
  app: tapping "The blog" bounced to Home instantly).** In the iOS app the
  witch page and the blog share ONE web view, so opening `/blog?app=1`
  replaces the app. The blog page therefore installs its own `window.__setTab`
  shim (`blog-public.js`) that answers the native tab bar by navigating BACK
  into the app — but `WitchWebView`'s `didFinish` also re-asserts the current
  tab on every load, to keep bar and page in step after a reload. That
  re-assert fired the moment the blog finished loading and the shim did what it
  was told: straight back to Home. Fixed on BOTH sides, and both are load-
  bearing — `didFinish` now re-asserts only on the app page (`isAppPage`,
  path `/witch`), and the shim ignores the first call inside a 2s grace window
  (a finger can't beat the page's own load event) so ALREADY-INSTALLED builds
  are fixed by a Render deploy alone. A tab tap from a blog page still works:
  it arrives via `updateUIView`, not `didFinish`. Anything else the app ever
  navigates to in that web view needs the same treatment.
- **Five tabs** (Book of Miracles is locked as the **2nd** icon by request):
  - **Today** — computed **moon phase** (synodic calc from a fixed new-moon
    epoch, client-side), a deterministic **Card of the Day** (per-day hash into
    a full 78-card deck built in JS: 22 majors w/ up/rev meanings + 56 minors by
    suit×rank), an optional AI reflection, a daily **intention**, and a
    **moon calendar** (month grid, glyph per day, new/full highlighted).
  - **Miracles** — the Little Book of Miracles ported in full (capture/imagine →
    illustrated pages → read view). Shares `localStorage['imageforge_miracles_book']`
    with `/book`.
  - **Tarot** — 1 / three-card / yes-no draws + AI reading; **save readings** to
    `localStorage['witch_saved_readings']`.
  - **Conjure** — spell/ritual maker (**save to grimoire**,
    `localStorage['witch_grimoire']`) and a charm image
    maker over the house LoRA styles.
  - **More** — daily horoscope, Watch/Shop/Follow tiles, About.
- **Synchronicities order by SLOT, not by timestamp (Aug 2026).** A day's
  coincidences in the Book of Shadows read in the order Sophie WROTE them —
  Home's three boxes are slots 0-1-2, anything added later from inside the book
  takes 3, 4, … Timestamps record when each DRAWING finished and disagree
  constantly (a box typed first can be drawn hours later; a redraw restamps its
  entry), which is what had 24 July reading box 1, 0, 2 in the book while Home
  showed 0, 1, 2. `syncSlotOf()` reads the slot off the archive id
  (`coin_<day>_<i>`) or an explicit `slot` field. `newestFirst` now reverses the
  DAYS only — inside a day the order never flips.
- **Moments can be added from inside the book, not just Home (Aug 2026).** An
  empty cell on a Synchronicities page IS a Home coincidence box — same square,
  same border, same place in the grid, contenteditable, with "Draw it!" under it
  where the caption goes. NOT a dashed placeholder and NOT an "Add a moment"
  label (both shipped once and Sophie rejected them: "go look at what it looks
  like on the home screen"). A day that exactly fills a page turns onto a fresh
  blank page of four more boxes, the way paper does. Two gotchas: the book
  stage's tap-to-turn handler must skip `[contenteditable="true"]` or a tap into
  the box turns the page instead of focusing it, and text typed but not yet
  drawn lives in `syncDrafts` so a repaint can't eat it. The pending job lives
  in `witch_sync_jobs`
  (localStorage, deliberately NOT cloud-synced — a half-finished draw is one
  device's business); `resumeSyncJobs()` picks it up on return, same as the Home
  boxes. A moment added to an old day is stamped at that day's noon so it can't
  hijack "the newest page".
- **Writing a page happens ON A LEAF, never in a pop-up (Aug 2026, Sophie).**
  "Add to your book" turns the book to a blank writing leaf at the BACK (last
  page, so no existing page number moves and the contents is untouched) —
  date eyebrow, an **illuminated capital** opening the heading, the type
  picker set in the book's serif, then the paper you write on. The leaf is a
  real page of `bosPages()` (`{page:'write'}`), pushed only while `bosWriting`
  is set; turn away with nothing written and it's gone the way an unwritten
  page is, turn away WITH writing and it stays at the back so nothing typed
  can be lost (the draft lives in `bosWriteDraft`, same contract as
  `syncDrafts`). A tap on the leaf never turns the page — only the arrows do.
  Saving lands on the page the entry is actually on; "how did it turn out?"
  is the same leaf and lands back on the spell. The illuminated cap is one
  inline vine path mirrored into four corners inside its OWN `<svg>` — never
  a `<use>` of `#bos-corner`, which lives in a tab that can be `display:none`.
- **The book shows a moment in HER OWN WORDS, three lines (Aug 2026).** The
  short AI label is the HOME screen's caption; on a book page (two columns, room
  to spare) showing only the label threw most of what she wrote away. The cap is
  `-webkit-line-clamp: 3` over `desc`, and `more…` is appended AFTER layout only
  where the clamp really cut the text — and OUTSIDE the cap, since a
  line-clamp box clips anything following the clamped text. `more…` is not
  underlined.
- **A saved bookmark can carry a word to its left** (`.bm-save.has-lbl` +
  `.bm-lbl`, hidden until `.filled`) — the tarot one says "see in book", so the
  second tap (jump to the page in the book) isn't a secret. Opt-in per bookmark:
  only markup that includes the span gets one.
- **No "A gentle nudge" advice box on tarot readings (Aug 2026, Sophie).** The
  reading ends on the reading. Removed from the saved-reading render and the
  Ask-the-cards result, and from both server tarot prompts. Old saved readings
  still carry an `advice` string on the doc; it is simply not rendered.
- **The Shop tab sells IN the app (July 2026):** product bottom-sheet →
  cart → hand off to Shopify checkout only for the pay screen. Storefront
  API via server proxy — `GET /api/witch/shop/product/:handle`,
  `GET /api/witch/cart?id=`, `POST /api/witch/cart/{add,update}` (public
  storefront token, committed by design; `WITCH_STOREFRONT_TOKEN` overrides).
  Cart id in `localStorage['witch_cart_id']`; expired carts recreate quietly.
- **External links** live in a `LINKS` const at the top of the client script.
  Shop = `cod-god-inc.myshopify.com` (the store's permanent home —
  `secretlyawitch.com` itself now points at the app), Instagram =
  `@moonsickbaby`. **Watch =
  YouTube is still a placeholder search** — the channel URL isn't stored anywhere
  (the YouTube token is upload-only scope and can't read the channel), so it
  needs Sophie's `@handle` pasted in.

## Sticker Day (self-care sheet — `/selfcare`)
- `public/selfcare.html` (page at `/selfcare`, **ungated/public** like `/witch`) —
  seven small acts of self care a day, each one a **sticker**. An un-earned task
  shows only as a flat grey **silhouette**; tapping it (= "I did this") peels the
  sticker on in colour AND opens a bottom sheet revealing the art big with a
  **mini lesson** on why it matters. Tapping an earned sticker reopens the
  lesson; **undo lives in that sheet**, so a mis-tap is never permanent.
- **The day's set:** 5 basics every day (water, food, movement, outside, sleep)
  + 2 extras stepping deterministically through a pool of 12 (`setFor(iso)` —
  days-since-epoch × 2), so the sheet changes daily and exhausts the pool before
  repeating. All 7 done → the sheet gets a stamp. **Book** tab = every past
  sheet + how many distinct stickers have been discovered.
- **State is `localStorage` only** (`selfcare_sticker_book`, `{days:{iso:{set,
  done}}}`). Nothing leaves the phone — which is why the page is ungated. Past
  days store their own `set`, so a rendered old sheet is what it actually was.
- **Tasks and packs are SEPARATE** in `public/selfcare-stickers.json`: `tasks`
  = name + mini lesson; `packs.<id>.art.<taskId>.img` = the picture. **A new
  sticker pack is a new art set over the same tasks, so it ships as pure data —
  no app change.** Any task a pack has no art for falls back to the placeholder
  shape drawn inline in `selfcare.html` (`ART`).
- **The silhouette is the SAME PNG, CSS-masked** (`[data-done="0"] .pic::after`,
  `mask-image:var(--u)` + flat `--ghost`), so the shape you see always matches
  the sticker you get exactly. This is why sticker art **must be a transparent
  die-cut PNG** — any background left on it masks as a grey rectangle instead of
  the sticker's outline.
- **Art pipeline: `scripts/selfcare-stickers.js`** — the Witch School look
  (gpt-image-2 edits against `storage:witch-school/refs/sophie-snake.png + sophie-animals.png`, same as
  `witch-school-cards.js`) so stickers and lesson cards read as one set, then
  **background-remover (Replicate) → alpha-trim → upload** to
  `selfcare/stickers/<pack>/<id>.png` (raws kept under `_raw/`). The prompt bans
  cast shadows/surfaces/frames — they survive the cut and read as grime round
  the edge — and the alpha trim + square re-pad is what keeps every sticker the
  same visual size in its tile. Writes the manifest after EVERY sticker, so a
  crash keeps what landed. `--only a,b` / `--force` / `--pack` / `--dry-run`
  (prints cost first). ~$0.042 each, ~$0.71 for all 17.
- **Lesson voice:** aimed at what people don't know, not encouragement (pasta is
  carbohydrate and doesn't rebuild you; the 8-glasses rule came from a misread
  1945 report; light through a window doesn't set your body clock). Same voice
  rules as Witch School — no therapy-speak, aspirational not consoling.
- **Open by design:** how sticker **packs** get unlocked (earned per finished
  sheet? a few new ones a day?) is Sophie's call and is NOT built — only the
  data structure for it is.
- **Finishing all 7 plays the celebration** — a unicorn cantering over a flat
  pastel rainbow (`celebrate()`, SVG `animateMotion`, ~2.8s). Bands are
  concentric solid-stroke arcs, NOT a gradient. It only fires on the tap that
  completes the sheet (`updateProgress(true)`), never on page load, so
  re-opening a finished day doesn't replay it.

### Memory Passport (3rd tab of `/selfcare`)
- **Four stamps a day** — small things that happened. Each is a postage stamp:
  white scalloped paper with a picture inside. Tap an empty slot → the picker.
- **The scalloped edge is drawn by the PAGE, not the model** (`stampSVG()` —
  a square path with circles centred ON each edge punched out via
  `fill-rule="evenodd"`). A model draws a scallop differently every time and
  the point of a stamp is that the frame is identical on all of them. So the
  generated art is only the square INSIDE, and the prompt bans borders/frames.
- **Two ways to fill a slot:**
  - **Free library** — 20 pre-drawn generic moments ("someone gave me a
    compliment", "I got myself a treat"), `public/selfcare-stamps.json`, built
    by `scripts/selfcare-stamps.js` (~$0.28 for all 20). Each sits on its OWN
    flat pastel background colour so a page reads as a set, not one card
    repeated. Reached from the **grey rounded-square button top-right in the
    header** — deliberately above the passport page, never on it.
  - **Draw your own** (the paid feature) — type a moment → `selfcare.js`
    (`/api/selfcare`, PUBLIC, mounted in server.js) draws it with gpt-image-2
    at **`quality:'low'`** (~1¢) in the same house line style but pastel.
    **NOTE: there is no billing wired up** — the UI distinguishes free vs own,
    but nothing actually checks for a subscription yet.
- **Background job, always** (house rule): `POST /api/selfcare/stamp` returns
  an id in ~0.2s, the client stores it in `localStorage` and RESUMES polling on
  return, so leaving the app can't lose a stamp already paid for. State in
  Firestore `forge-selfcare-stamps`; `GET /api/selfcare/stamp/:id` polls.
- **The endpoint is public and spends money**, so it is rate-limited per IP
  (20/hour) behind the app's own 4-a-day rule. Worth revisiting if the page
  ever gets real traffic.
- **A stamp landing plays a stick sound** — synthesised with WebAudio (filtered
  noise burst over a low thud), so there's no audio file to load. iOS only
  allows audio after a gesture, so the context is unlocked on the first tap.
- **Everything is `localStorage`** except the generated images: the moment TEXT
  is sent to OpenAI and the resulting picture lives in public Storage. That is
  a real change from the stickers half, where nothing leaves the phone.
- **Display copies:** `scripts/selfcare-thumbs.js` makes a 512px webp
  (`thumb`) of every sticker/stamp/asset and writes it beside `img` in both
  manifests. The originals are 400–700KB each and the library shows twenty at
  once — serving them raw was ~26MB of page weight. The page uses `thumb` and
  keeps `img` as the untouched full-res original. Costs nothing to re-run.

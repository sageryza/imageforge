# The Dump, push notifications, and odds and ends

The generic phone inbox, the APNs doorbell, and the Google Drawing extractor.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. Nothing was rewritten; this is the text as it stood.)*

## The Dump (`dropbox.js`) — one inbox for anything off the phone
- `dropbox.js` (`/api/drop`) is the generalized drop box the crystal box grew
  into: **dump first, label afterwards**. Dropping asks no questions — no type,
  no name, no fields. Only two pieces of structure are captured at dump time,
  because they're free then and expensive to reconstruct later: the **bundle**
  (what arrived together — on the phone a Photos ALBUM, in a zip a folder, from
  the share sheet one share action) and the **session** (the dump, date-stamped).
  `track` (`crystals` / `story-art` / …) is deliberately null on arrival.
- **One Firestore doc per FILE** (`forge-drops`, deckfactory), plus one doc per
  album in `forge-drop-bundles` holding its number, name and file counter.
  Images and videos both (videos get a poster frame).
- **A bundle is keyed by its slug ACROSS dumps** — an album is one thing however
  many times it's sent to. **Re-dumping an album fills its gaps** instead of
  forking a second copy: files are keyed by the **md5 of their bytes** and an
  arrival already in that album is skipped (`duplicate:true`, counted as
  `skipped` in the response). Filenames can't be used for this — the iOS
  uploader names every export `UUID() + originalFilename`, so the same photo
  sent twice arrives under two different names.
- **Bytes are stored once**, content-addressed at `drops/_/<hash>.<ext>` — the
  same photo in two albums is ONE object with two entries pointing at it, like
  Photos. `dropDoc` only deletes bytes when no other doc references the hash.
- **`photoIndex` comes from a transaction** on the bundle doc. It used to be
  derived by counting the album on each request, and the app uploads several
  files at once, so concurrent uploads got the SAME index — album order came out
  scrambled and the holes looked like missing files. Never diagnose "missing
  photos" from index gaps in data dumped before 2026-07-28.
- **`scripts/drop-dedupe.js`** repairs existing data (hashes from Storage
  metadata — no downloads — then removes in-album duplicates, renumbers, seeds
  the registry). `--dry-run` prints the plan. Ran once on 2026-07-28: 2,717
  files → 2,594, 123 exact duplicates removed (~327 MB), 58 albums renumbered.
- **Sort & label page (Aug 2026, Sophie's ask): `/dump`** (`public/dump.html`,
  serveGated) — the other half of "dump first, label afterwards". Browse every
  album (filter by session / unlabelled-only), name it, set its `track` (chips
  for the known tracks + free text; tapping the lit chip clears back to
  unlabelled), notes, per-file lightbox with delete. Saves via
  `PATCH /api/drop/bundle` (loose files via `PATCH /items/:id`). **The native
  Dump tile is two tabs — SEND and SORT (Aug 2026, Sophie)**: sending albums
  in and sorting out what's already there are one tool, not a screen plus a
  pushed page. Both halves stay ALIVE behind the switch (a reload would lose
  her place), so the page exposes `window.__dumpRefresh` and `GatedWebTool`'s
  `refreshOnAppear`/`refreshTick` fires it on every switch to SORT —
  `onAppear` can't do this, a view held in a ZStack only appears once. The
  page hides its own eyebrow under `?embed=1` (the native bar already titles
  the screen) and the upload progress bar sits ABOVE the tabs, since an
  upload keeps running while she sorts. **Select mode (Aug 2026, Sophie):**
  the Select chip opens every album to just its thumbs — tap to pick across
  albums, then the fixed bottom bar moves the lot into an existing album or
  a newly named one (`POST /api/drop/move {ids, bundleName}`; placeIn()'s
  registry transaction numbers them in, the target album's session and
  track/name labels win, files placed in the order she picked them).
- **FOLDERS CONTAIN ALBUMS — they never merge them (Aug 2026, Sophie: "don't
  take it out of the sub folders it's already in").** A folder is the `track`
  field, shown as "Folder" in the UI: filing an album writes the label onto
  its files and nothing inside it moves, so one crystal stays one album stays
  one Etsy listing. The sort page's Select mode picks whole album CARDS (not
  files) and files the lot in one tap; the filter row carries a chip per
  folder in use, so tapping "Crystals" shows exactly those albums. Albums
  sort **newest first** by `newest` (the album's latest file — `seq` is
  arrival order across ALL albums and can't answer freshness).
  `POST /move` (file-level, above) is still there for a chat, but the page
  never merges albums. The page's whole control strip (title, counts, filter
  + Select chips) is ONE sticky header, and a back-to-top button floats
  bottom-LEFT past 400px of scroll — with 100 albums, reaching Select must
  never mean scrolling back to the top.
- **`DumpView` must RE-READ the Photos albums, not load them once.** Its
  `.task` fires a single time because RootView holds the view alive in a
  ZStack, so an album created in Photos after launch never appeared in SEND —
  and it read as the Dump having lost it (Sophie made "character references"
  and "style references", didn't see them, and made them again). It now
  reloads on `.forgeScreenChanged`, on `willEnterForeground`, and on every
  switch back to the SEND tab.
- **iOS is the main way in:** `ios/ImageForge/DumpUploader.swift` (in-app album
  picker — the share sheet can't see album names, so it's the right tool for a
  pile of named albums) with a background `URLSession` that survives leaving the
  app, plus the `DumpShare` share extension. Routes: `GET /sessions`,
  `GET /bundles?session=`, `GET /items`, `POST /upload` (data URLs),
  `POST /upload-file` (raw body — the iOS path), `POST /upload-zip`,
  `PATCH /bundle` (label a whole album at once), `DELETE /items/:id`.

## Push notifications (the Update tab's doorbell — Aug 2026)
- **`push.js` (`/api/push`) sends real APNs lock-screen notifications**, raw
  HTTP/2 straight to Apple — no Firebase Messaging, no SDK. The iOS app
  registers its device token per launch (`POST /device`, upsert), and
  `chatfeed.js` calls `notifyChat()` on a **finished reply** (never a draft)
  and on a **new Compare page** — the pushes are the Update tab's doorbell,
  not its replacement, so dropped ones are never lost news.
- **A FINISHED REPLY ONLY BUZZES WHEN IT IS ANSWERING HER (`push-gate.js`,
  Aug 2026, Sophie: "I don't need a notification when I send a message. I
  need a notification when they respond to my message").** Every finished
  reply used to push, and three real shapes put the buzz at the wrong moment:
  a **catch-up post** (the hook's final pass runs on UserPromptSubmit too, so
  a reply Stop failed to post lands the instant she hits send on her next
  message), a **queued message** (messaging a chat that is mid-turn; the turn
  already running finishes seconds later), and a **chat grinding on its own**
  (turn after turn nobody asked for, and with the old 60s global spacing
  whichever one landed next after she sent was the buzz she got).
  Two comparisons, both against fields already on the registry doc, so the
  gate costs no extra read: she must have spoken **since the last push**
  (`lastHerAt > pushedAt`), and the reply must have been **written after she
  spoke** (`created >= lastHerAt`) — a reply whose text predates her message
  cannot be an answer to it. `lastHerAt` is stamped by `POST /reply`, which
  is both doors (the hook lifting her words out of the Claude app, and the
  Chats app's reply box), and it carries her REAL send time, never the lift
  time. `pushedAt` is stamped in the same registry write the reply already
  makes.
  - **NO TIME DEBOUNCE on a reply** (`notifyChat(..., {debounce:false})`).
    The per-chat 10 minutes existed only because every reply pushed, and
    measured against her real threads it broke exactly what she asked for —
    she messaged `update-tab-messaging` at 2:07 pm and again at 2:11 pm, and
    a 10-minute window swallows the answer to the second. Each message she
    sends can now produce at most one buzz, from the chat she sent it to. The
    Compare-page call keeps the old 10 min + 60s windows, and a skipped send
    still takes the global stamp, so a page and the reply in one turn stay
    one buzz.
  - **A chat that has never lifted one of her messages is NOT silenced.** No
    `lastHerAt` on file looks identical whether the session's hook is too old
    to post her messages or she has simply never written to it, so those keep
    the old behaviour — a missed buzz is worse than a stray one.
  - Tests: `node scripts/test-push-gate.js` (the whole decision table, pure,
    no network).
- **Dormant until the APNs key exists**: `APNS_KEY_ID`, `APNS_TEAM_ID`,
  optional `APNS_TOPIC` (defaults to `com.sageryza.imageforge`), plus the
  key itself EITHER as `APNS_KEY` (raw PEM, base64, or literal-\n all
  accepted) **OR — the better home, her ask — as a RENDER SECRET FILE**: any
  `*.p8` in `/etc/secrets`, the project root or cwd is picked up by
  extension, so Apple's own `AuthKey_<KEYID>.p8` can be uploaded unchanged
  with no name to get right (`APNS_KEY_FILE` overrides with a path). Env
  wins; a file MISS is re-checked every 30s, so a key uploaded after the
  deploy starts working on its own. Everything is read lazily at send time,
  so a key landing needs no redeploy. **Only Sophie can mint the key** (Apple
  developer portal → Keys, environment **Sandbox & Production** — TestFlight
  rides production); never paste it into a chat.
  **Her ids, for reference: Key ID `G8WMZDR4KK`, Team ID `5XR23N2CBH`** —
  neither is a credential (the .p8 is), and having them here saves a
  screenshot hunt next time.
- **`POST /api/push/test {title?, body?}`** (gated) sends a real push to
  every registered device with per-device results — the end-to-end check.
  `GET /status` → `{configured, devices}`.
- **iOS side** (`PushDelegate.swift` + `aps-environment` in the
  entitlements): permission asked once at launch, token POSTed with the
  studio token, notifications SUPPRESSED while the app is foregrounded (the
  Update tab is the notification there), and a **tap opens THE CHAT IT CAME
  FROM** (`/chats?chat=<slug>`).
  - **v1 always opened the Update tab and she rejected it** ("I click on the
    notification, it lands me in the updates tab, but that notification is
    already gone because clicking the notification gets rid of it"): iOS
    consumes the banner on tap, so landing on a LIST leaves her no way to
    tell which chat just spoke. The payload always carried `chat`; now it
    routes. A push naming no chat (the `/test` send) still lands on Update.
  - **BOTH params are stripped at boot** (`?chat=` and `?view=news`) —
    checkBuild reloads the page on every deploy and keeps the URL, so a
    leftover param would re-open that thread over whatever she is reading,
    on every deploy, forever. Pinned by `test-chats-build-reload.js`. TestFlight rides the
  PRODUCTION APNs host. Apple-managed CI signing registers the push
  capability on the App ID automatically (same as the App Group did).
- **THE HOME-SCREEN WIDGET (Aug 2026, Sophie: "I'd like the widget")** —
  `ios/ForgeWidget/`, a WidgetKit extension: the Update count big, plus the
  newest chats (names at small, name + line at medium), tap opens
  `deckfactory://chats`. Flat paper palette, no gradients.
  - It reads **`GET /api/chatfeed/widget?limit=`** — one small JSON — and
    must NEVER pull the real feed (~500KB on a refresh timer). Cost is the
    cached registry + one capped message read, nothing per-chat.
  - **Its floor is `notifSeenAt`, and OPENING A CHAT NOW WRITES THAT STAMP
    TOO** (`markSeen` POSTs `/notif-seen`, Aug 2026). Without it the widget
    counted everything-since-the-✓ while the tab counted
    everything-since-she-last-looked — measured live the hour it shipped:
    **14 against 2**, the same idea disagreeing with itself on two screens,
    because `seen` is localStorage inside the web view and a widget is a
    separate process with its own container. Opening a chat already cleared
    its Update card, so this changed no visible behaviour in the app; it
    just put the same fact where the widget can read it.
  - **IT HAS NO ENTITLEMENTS FILE, and that is load-bearing — the first
    build died on exactly this.** Apple-managed CI signing registers a NEW
    App ID for the extension but does NOT enable the App GROUP on it, so
    asking for `com.apple.security.application-groups` fails the archive:
    *"provisioning profile … doesn't match the entitlements file's value for
    the com.apple.security.application-groups entitlement"*. DumpShare's
    group was enabled long before, which is why that target never hits this
    — **do not copy DumpShare's entitlements into a NEW extension and expect
    it to build.** Consequence: the widget can't read the settings the app
    writes (`ImageForgeApp.shareSettingsWithWidget` still writes them), so it
    calls the DEFAULT server unauthenticated. Fine while STUDIO_TOKEN is off
    (it is). To restore the group: enable App Groups on
    `com.sageryza.imageforge.widget` in the developer portal ONCE, then add
    the entitlements file back — the Swift side already reads the group, so
    there is no code change.
  - A failed fetch says "can't reach the feed" rather than showing 0:
    "nothing new" and "couldn't ask" must never look the same.
  - Tests: `node scripts/test-widget-feed.js` (drives the real route against
    a stubbed Firestore).
- **A dead token self-heals**: 410/`Unregistered` deletes the device doc.
  Tests: `node scripts/test-push.js` (key-paste shapes, verifiable ES256
  JWT, wire format against a local h2c server; Apple itself is only
  testable via `/test` + a real phone).

- **NO recurring hourly self-check-ins / `send_later` loops (July 2026).** Do not
  set up a chat to wake itself every hour to poll for notes/replies/PRs — that
  pattern spread across chats and kept pinging Sophie, and it's been turned off.
  Only schedule a recurring wake-up if Sophie explicitly asks for one in that
  chat; otherwise pick things up when she next messages you.

## Getting original art OUT of a Google Drawing (Aug 2026)
Sophie's old scanned artwork lives inside Google Drawings — for a lot of it
those embedded copies are the only ones left. **The SVG export is the only way
out at full size**, and `scripts/gdrawing-extract.py` (stdlib only) does the
whole job: `python3 scripts/gdrawing-extract.py <url-or-id> [-o dir] [--list]`.
- **Why SVG:** File ▸ Download ▸ PNG/JPEG flattens the whole drawing to ONE
  image at **screen size** (~1056x816 — useless for print). The SVG export
  instead embeds every placed image as its own base64 blob at the size Google
  stored it, so splitting the SVG apart returns each picture individually at
  full resolution.
- **Don't reach for the Drive API export** (`download_file_content`,
  `mimeType=image/svg+xml`): it has a hard **~10MB cap** and answers *"File too
  large for export"* for any drawing full of scans. The plain public URL
  `https://docs.google.com/drawings/d/<id>/export/svg` has no such cap (84MB
  came down fine) — that's what the script uses.
- **It needs link sharing.** That URL is unauthenticated, so a restricted
  drawing 401s; Sophie sets Share ▸ General access ▸ "Anyone with the link"
  (Viewer is enough) and can set it back afterwards. The script prints exactly
  that instruction on a 401 instead of a stack trace.
- **Reading the sizes:** anything sitting EXACTLY on **2500px** hit Google's
  upload resize ceiling, so the original was bigger; anything under it is the
  size she uploaded. **2500 applies to PNG as well as JPEG** — an earlier note
  here claimed PNGs capped at 2048, which is wrong (2048 is just a common
  export size, and PNGs come out at 2500 all the time). Either way it is the
  biggest copy that still exists. Bytes are Google's re-encode (same pixels,
  metadata stripped), never the byte-for-byte original file.
- Duplicates are skipped by content hash — drawings copied from other drawings
  repeat images heavily (one 46-image drawing shared 9 with its sibling).
- **A two-figure image** (two people in one placed picture, often on a
  transparent background) splits cleanly on the empty alpha column between
  them, then composites onto white — Pillow + numpy, see the Blake-and-Louis
  pair in the Aug 2026 chat.

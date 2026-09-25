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
- **EVERY FILE SAYS WHO PUT IT THERE — `from: 'sophie' | 'claude'` — AND
  THE PAGE OPENS ON HERS (2026-09-25, Sophie: "the dump is ducked · it's slow
  · and used by chats to give me stuff idk why i never wanted that · hide
  every single thing a chat has ever uploaded or make a new tab. make it like
  'from claude' and from me").** `/dump` carries a hairline row, FROM ME ·
  FROM CLAUDE, and opens on FROM ME every time (memory, never a setting).
  Measured the day it landed: 4,888 files, 3,152 hers and 1,736 put there by
  chats — a third of what she scrolled past to find her own albums.
  - **AT UPLOAD TIME the server decides, in this order** (`whoFrom` in
    `dropbox.js`): an upload that SAYS who it is from wins (`?from=claude` /
    `?from=me` on `/upload-file` and `/upload-zip`, `from` in the `/upload`
    body); otherwise the User-Agent — a browser or the iOS app (Mozilla /
    CFNetwork / Darwin) is her tap, while curl, node, undici, python and a
    HeadlessChrome driven from a container are a chat's script. **A chat
    filing anything into the Dump sends `from=claude`** — the User-Agent rule
    catches a script that forgets, but the word is the contract. A server
    module calling `/upload-file` on itself (ytdl.js) forwards the word from
    the request that asked, since its own fetch reads as a script.
  - **OLDER FILES WERE JUDGED BY THEIR SHAPE, ONCE, album by album**
    (`guessFrom` + `albumFrom`; `node scripts/dump-from-backfill.js`, dry by
    default, `--go` wrote 4,888). A session id a chat named (`card-pattern`,
    `seedance-cut1`) is a chat's; the phone's own names — the export UUID the
    share sheet prefixes (`66FB6123-…-IMG_2138.HEIC`), `IMG_`, `save-UUID`,
    an uppercase extension, a Midjourney download, a name with spaces — are
    hers; a lowercase kebab-case name under a server-minted session is a
    chat's. The album takes the MAJORITY, a tie to her: a chat re-uploading
    four of her crystal photos does not make her album a chat's, and her file
    hidden on the wrong side is the worse mistake. A doc that already carries
    `from` is never re-guessed, so the backfill is safe to re-run and a
    corrected file stays corrected. The read routes answer `from` on every
    bundle and fall back to the guess for a doc with none, so the page was
    right before the backfill ran.
  - **`from` IS EDITABLE** — `PATCH /bundle {session, bundle, from:'me'}`
    moves a whole album to her side (or `'claude'` the other way); an unknown
    word is dropped, never written. Nothing on the page offers it yet; hers
    to ask for.
  - **AND THE SLOW HALF: ONE READ, HELD 20 SECONDS.** Every list route
    (`/sessions`, `/bundles`, `/tracks`, `/items`) read the whole collection
    from Firestore on every call, and the page called three of them on open
    and `/bundles` again on every chip — 4,888 docs, four or five times,
    before an album drew. `allDocs()` holds the snapshot for 20s and every
    write in the module drops it (`forgetAll`), so a dump that just landed is
    in the next read. The page reads its side ONCE (`/bundles?from=me` +
    `/sessions?from=me`) and every chip is a filter over memory. Measured on
    the real data through the new code: the chat side opens in ~0.2s from
    the cache where each read was a full collection scan.
  - Test: `node scripts/test-dump-from.js` (the rule pure; the real page
    headless — the chat album COUNTED off the rendered list, the tab line
    MEASURED under the lit word, a chip tap asserted to re-read nothing).
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

### WHAT A DUMPED CLIP SAYS — transcribed once, ever

`node scripts/transcribe-media.js` (2026-09-14, Sophie: "transcribe w whisper,
cache it"). She shoots takes on her phone, dumps the album, and then wants to
know what she said in each one without opening every clip.

**The rule it is built around is the house one: paid or slow work is banked the
moment it exists and keyed by what made it.** whisper-1 is ~0.6¢ a minute and a
take gets read many times — by her, by the Story Room's take alignment, by
whatever cuts the film — so the answer lives at

    transcripts/<sha1(source url)>.json
    { url, model, text, words:[{word,start,end}], segments, seconds, at, silent? }

and asking for the same url twice costs nothing. **The Dump is
content-addressed** (`drops/_/<md5>.<ext>`), so the same bytes dumped into two
albums are ONE cache entry by construction — nothing here has to dedupe.

**Two mirrors, both deliberate.**

- `scratchpad/take-words/<the same key>.json` — the Story Room's OWN take cache
  (`takeWords` in `scratchpad.js`), same key, same word shape. A story whose
  voiceover IS this take then renders with no transcription at all. Writing it
  here is free; not writing it means paying twice. **If either side's key rule
  drifts the mirror is dead weight and nothing says so**, which is what
  `scripts/test-transcribe-media.js` pins — against the REAL expressions in both
  files, never a copy typed into the test.
- `transcript` + `transcriptAt` on the file's own `forge-drops` doc, capped at
  4,000 characters, so a reader can SHOW what a clip says without fetching the
  cache. The words stay in Storage: a long take is thousands of them and the doc
  rides a list read.

**Her file is never touched and never re-encoded** — it is downloaded, a
throwaway 16k mono mp3 is handed to whisper, and the original is left alone (the
house *a derived copy, never the source* rule). **A file with no audio track is
cached as `silent`** rather than left to be retried forever: silence is the
answer, not a failure.

Usage — `<url|dropId>…`, or `--session <s> --bundle <b>` to sweep a whole album;
`--dry` is free and names what it would do; `--force` re-transcribes; `--json`
for a reader. Measured the day it landed: the whole `footage` bundle — 14 clips,
113 seconds of audio — cost **1.1¢**, and the second run cost nothing.

## Push notifications (the Update tab's doorbell — Aug 2026)
- **`push.js` (`/api/push`) sends real APNs lock-screen notifications**, raw
  HTTP/2 straight to Apple — no Firebase Messaging, no SDK. The iOS app
  registers its device token per launch (`POST /device`, upsert), and
  `chatfeed.js` calls `notifyChat()` on a **finished reply** (never a draft)
  and on a **new Compare page** — the pushes are the Update tab's doorbell,
  not its replacement, so dropped ones are never lost news.
- **THE BELL DECIDES WHICH CHATS MAY BUZZ AT ALL — a WHITELIST (`chatNotifies`
  in `push-gate.js`, Aug 2026, Sophie: "add a little bell next to the star that
  I can click in. This will enable notifications for this chat and un-click and
  it will turn them off — only the ones I clicked the bell on will notify me").**
  One field, `notify`, on the chat's registry doc, beside `starred` and
  `bookmarked`, so it rides the feed read the app already makes. **Absent means
  SILENT**: nothing pushes until she taps a bell, and a chat she has never
  belled never reaches her lock screen. It is asked BEFORE the timing gate
  below — the coarse question first — and in front of **both** doors, a
  finished reply and a new Compare page, so there is no way to buzz her past
  it. The control is the bell in a chat's thread header (`.bellbtn` in
  `chats.html`, next to the ★); `POST /api/chatfeed/notify {chat, notify}`
  writes it, 404 on a chat that does not exist (the phantom-row guard every
  registry write carries). Comparing `notify === true`, never truthiness, is
  deliberate — the safe failure direction for an opt-in is silence.
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
  - **THE BODY IS NEVER HER OWN WORDS (`pushBody`).** Found live 2026-08-15
    from her screenshot at 3:01 pm, and it is what she was actually reporting
    — the timing was already right. Two house rules collided: *Answering a
    question* opens a reply with her question repeated **verbatim in bold** on
    its own line, and the push body was `tldr || the reply's first non-empty
    line`. So every answer to a question buzzed her with her own sentence,
    asterisks and all, because nothing stripped the markdown either. Leading
    lines that are ENTIRELY bold are now skipped — that is precisely the shape
    the answering rule produces, and `**TLDR** — …` has ordinary text after
    the bold, so a real opening line is kept. (Since 2026-08-23 that bold echo
    fires only on a question she marked with the word "question", so the skip
    reaches fewer replies but exactly the ones that matter.) The chosen line is then
    flattened (emphasis, headings, quote marks, inline code, and a link
    reduced to its text). A reply that is nothing but bolded questions still
    sends its first line rather than a blank banner.
    - **Structural, not stored, on purpose.** The other option was comparing
      the line against her newest message, which means carrying a few hundred
      characters of it on the registry doc — and the registry rides the feed
      read to her phone 276 chats at a time.
  - Tests: `node scripts/test-push-gate.js` (the whole decision table, the bell
    whitelist and the body rules, pure, no network — 30 checks) and
    `node scripts/test-chats-bell.js` (the bell + the eye + the trash can on
    the real page, headless — 24 checks, including the painted colours: filled
    bell, gold when lit, nothing red sitting at rest).
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
- **THE HOME-SCREEN WIDGET IS FOUR DECKS TO SWIPE (2026-09-02, Sophie: "the
  widget / make it 4 icons / decks to swipe / currently / the dream factory
  deck / the wallpapers")** — `ios/ForgeWidget/`, a WidgetKit extension: the
  top four decks still waiting in the **Review Queue**, as pictures, each one
  a tap into that deck's cards. Flat paper palette, no gradients.
  - **It used to be the Update COUNT** (Aug 2026, "I'd like the widget") and
    that is history rather than a rule: the number is still on the Update tab
    and the push still carries "right now", where four faces are the
    difference between *there are things waiting* and *here is the one I'll
    do*. The old `GET /api/chatfeed/widget` route is untouched and still
    tested — nothing reads it now.
  - **THE KIND IS UNCHANGED (`ForgeUpdateWidget`) ON PURPOSE.** iOS remembers
    a placed widget by its kind, so renaming it would orphan the one on her
    home screen and she would have to place a new one. Same widget, different
    subject.
  - It reads **`GET /api/review/widget?limit=4`** — the SAME waiting rows the
    `/review` page draws, in the same order, off the same 60s cache, so the
    widget and the page can never disagree about what is waiting or which
    deck leads. `count` is the FULL pile, so four icons never imply four
    decks.
  - **THE FACE IS A LADDER, and the middle rung is the point:** the deck's own
    first picture → **the chat's icon** (chaticons.js already draws one for
    every chat — the little drawing she recognises a chat by) → its first
    card's words. Twelve of fifteen queued pages had no picture when the queue
    shipped: text decks are the common case here, and prose at 64pt is not an
    icon where her chat drawing is.
  - **EVERY FACE RIDES THE DERIVED THUMB SERVICE, never the original** — a
    deck's first picture is routinely a 1-3MB lossless webp and a widget
    process is killed for less. The server hands back `/api/story/thumb` urls;
    a test fails if a raw Storage url ever reaches the widget.
  - **SMALL HAS EXACTLY ONE TAP TARGET, and that is why the two layouts
    differ.** iOS gives a `systemSmall` widget a single `widgetURL` and
    ignores any `Link` inside it, so the little one is a 2×2 of icons opening
    the queue, and the medium one is a row of four, each its own `Link` into
    its own deck.
  - **A tap opens THAT DECK — `deckfactory://review?deck=<page id>`.** RootView
    carries the query onto `PushDelegate.pendingDeck` and posts
    `.forgeOpenDeck`; ReviewQueueView bumps its reload key and its URL builder
    consumes the flag, loading `/api/chatfeed/page/<id>?clean=1` — the exact
    url a queue tile opens, so a widget-opened deck is identical to a
    tapped-row one, chevron and all (judge.js's `__navBack` steps history and
    falls back to `/review`). The NOTIFICATION is the load-bearing half: the
    app keeps three tools alive in a ZStack, so arriving at a tool it is
    already holding runs no `makeUIView` and the deck would never open. The
    flag is one-shot, so a later reload cannot drag her back into a deck she
    has walked out of.
  - **The name under a medium icon is TWO LINES with its hyphens taken out**
    — measured against the live queue the hour it shipped: most chats carry
    no `displayName`, so the name IS the slug (`triangle-cards-compare`), and
    one line at 64pt fits about twelve characters. "TRIANGLE-CAR…" names
    nothing; broken at its own words it does. The picture is still what she
    recognises a deck by.
  - **Pictures are fetched in the PROVIDER**, never the view — a widget view
    cannot load a URL — and a timeline entry is archived to disk, which is the
    other reason the faces must be derived thumbs.
  - Tests: `node scripts/test-review-widget.js` (the real route against a
    stubbed Firestore and Storage) and the widget block in
    `node scripts/test-review.js` (the icon ladder and the caps, pure).
  - **Its old floor was `notifSeenAt`, and OPENING A CHAT WRITES THAT STAMP
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
  - A failed fetch says "can't reach the queue" rather than showing an empty
    pile: "nothing waiting" and "couldn't ask" must never look the same.
  - The old count route still has its own test:
    `node scripts/test-widget-feed.js` (drives it against a stubbed
    Firestore).
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


## Moved from CLAUDE.md (2026-09-14)

Moved here verbatim from `CLAUDE.md` on 2026-09-14 so that file stays readable;
CLAUDE.md keeps a one-sentence pointer per entry. Nothing was reworded.

### Opinions

- **Opinions** (`opinions.js`, `/api/opinions`, page at `/opinions`, no iOS
  tile yet) — the decide-on-things game from Sophie's commercial concept (Aug
  2026): two ideas side by side — businesses, things to make, app ideas, or
  two pictures — tap the better one, and the picked side stamps **GOOD IDEA**
  (the other BAD IDEA). Relentlessly encouraging by design: a streak, an
  accolade ladder (Opinion Haver → Chief Opinion Officer), and a headline
  that keeps telling her she has good opinions. **It costs nothing** — no
  model calls; the feed is PRELOADED from committed `opinions-feed.json`
  (image sides point at committed webps) plus Firestore extras any chat can
  add (`POST /api/opinions/items {items:[{kind,category,q,a,b}]}` — commit
  seed edits for curated sets, POST for drive-by ideas; a POSTed id colliding
  with the seed is refused, committed wins). Picks are ONE doc per item id in
  `forge-opinions` (re-picking updates in place — changing her mind, never a
  duplicate); notes ride the same doc via the small + on a card. Item ids
  are permanent — renaming one orphans her pick. One screen, never scrolls,
  no pill. Tests: `node scripts/test-opinions.js` (pure).
  **Scenario art is drawn as 2×2 SHEETS at MEDIUM (Sophie, Aug 2026: "one
  image per quarter so each image will cost a quarter"; quality raised from
  low the same week — "the little ones are coming out too low"; there is no
  2K size, 1024x1536 is gpt-image-2's ceiling)** — one Playground pastel run
  whose prompt describes a 2x2 grid of four separate small illustrations,
  cut into quarters locally, each quarter filed as its own image (~1¢
  apiece). **Scenarios come in PAIRS and PLAY as pairs (Sophie, Aug 2026:
  "just put easy mode and then the hard mode version right after it")** —
  every scenario exists as an easy card AND its hard twin (same choice,
  escalated picture, a more-information line that flips it; `twin` on the
  easy item names its hard card), and the SCENARIOS tab deals them
  interleaved: the easy one, then its hard version immediately after. There
  are no separate easy/hard tabs any more. **The more-information line is a
  CAPTION, never drawn into the picture** (Sophie, Aug 2026) — a hard twin's
  art changes only when the SCENE itself changes (the puppy dangling the
  baby); otherwise the easy picture carries over and the caption does the
  flip. **A hard joke that doesn't work is removed, not forced** — an easy
  card may stand alone (`twin` optional; the cookie and refund twins were
  cut on her word). The gun is a generated silver-revolver image
  (`public/opinions-gun.png`), not a line icon. Candidate batches go on a
  review deck for her ♥ first; a single-option batch she has delegated goes
  straight in.
  **DRAWING AND CUTTING ARE PACED SEPARATELY — TWO NUMBERS, NOT ONE (Sophie,
  2026-08-28: "ok fine back to notches. but separate running sheets and
  cutting").** One ceiling was always wrong here because the two halves of a
  panels run live on different machines, and conflating them is what made
  every version of this note either too slow or too fragile:
  - **DRAWS: fire the WHOLE batch at once, no ceiling.** The draw happens on
    OpenAI's hardware and costs this box nothing. Serializing them is a chat
    spending her minutes for no protection — the mistake she deleted twice
    (2026-08-27, a 12-minute ten-sheet batch; 2026-08-28, "please all at
    once").
  - **CUTS: one at a time, and the SERVER enforces it now** (`gateCut` in
    server.js, 2026-08-28). A cut decodes the sheet to raw — ~33MB for a 4K
    sheet on a 512MB instance — so N sheets finishing together used to stack
    N decodes and kill the instance mid-batch. A cut takes seconds against a
    60-180s draw, so the queue costs a batch almost nothing and makes peak
    memory independent of batch size. **A chat no longer staggers its
    launches**; if you find yourself wanting to, the gate is broken, say so.
  - **The ledger, which is the CUT ceiling and ratchets like she asked:**
    - **Broke it: 16** concurrent outputs + whiten passes (2026-08-19), and
      **10** concurrent 9-panel 4K sheets whose cuts landed together
      (2026-08-28 — seven runs lost, the crash that produced `gateCut`).
    - **Clean: 5** concurrent 9-panel 4K sheets (2026-08-28), and any number
      of draws once `gateCut` is in.
    - **DO NOT RAISE THE GATE — the cap was MEASURED and it is 1 (2026-08-28,
      container, the exact cutSheet recipe on a 4K sheet):** ONE cut peaks
      **+153MB** over baseline and TWO concurrent peak **+241MB** — sharp's
      pipeline holds several dimension-sized buffers at once, so a cut costs
      ~3x the naive 33MB-decode estimate. The 512MB box's headroom fits ONE.
      The gate at 1 is the ceiling, not caution, and the prize for raising it
      is seconds: a cut is ~2s, so even a ten-sheet batch queues ~20s of
      cutting total. (This retires the "raise a notch and write what you
      measured" ratchet that stood here — the measurement is done.)
  - **A run refused with a 502 on the POST was never created and never
    billed** (measured 2026-08-28) — a start failure is free, so retrying a
    start costs nothing. What is genuinely lost is a run whose sheet died
    in flight: billed, no bytes, unrecoverable at any concurrency. A run
    whose sheet was BANKED recovers free (the 2026-08-27 sweep, and
    `POST /api/promptlab/:id/recut`).
  - **Broke it: 4 concurrent LOW SINGLE edits on a box already at 427MB
    (2026-09-02, 9:58pm Pacific — Sophie's first `{curly-bracket}` run;
    Render's event: `oomKilled {memoryLimit: 512Mi}`, two seconds after the
    batch started).** Not the sheets' shape at all: each edit carried the
    8.5MB `sage-sandy-mirror.png` reference in its body, and the BASELINE
    was the killer — a fresh boot idles at ~190MB and this instance had
    crept to 427MB over 35 minutes with nothing running (Render memory
    metrics, 30s resolution). Two things came of it, both in code:
    **`draw-gate.js` admits a gpt-image draw by the memory left** (any
    number while there is room, one at a time as it fills, never zero — the
    Playground's own bracket batch goes serial on a full box instead of
    dying; `node scripts/test-draw-gate.js`), and **the sweep REDRAWS a
    single run killed mid-draw** exactly as it already did for panels
    (`singleCfgOf` in `promptlab-sweep.js`, capped at 2; a photo reference
    that will not re-fetch fails it honestly). `GET /api/promptlab/inflight`
    is the read — the in-process draw/cut sets plus `process.memoryUsage()`,
    so the creep is measurable from a chat. **THE CREEP IS NATIVE, NOT THE
    JS HEAP — measured the same night through `/inflight` every 30s:** a
    fresh boot idles at rss ~200MB / heap ~87MB, and 90 seconds later rss is
    ~300 while the heap is ~110 — the growth sits outside V8. sharp/libvips
    on glibc is the known shape of that (fragmentation across malloc arenas;
    sharp's own docs say to set `MALLOC_ARENA_MAX=2`), and every thumbnail
    the app serves goes through sharp. **`MALLOC_ARENA_MAX=2` IS SET AND IT
    HELPED — A PLATEAU, NOT A CURE (measured the same night on the same box,
    30s samples over 35 minutes):** the boots before it went 200-220MB →
    298-317MB by five minutes and 427MB by 35; the first boot with it held
    195-216MB for eight minutes, then settled into a **250-310MB band from
    ten minutes to 35 with no climb inside it** (267 · 289 · 268 · 265 · 266
    · 258 · 296 · 266 at three-minute steps). So ~120MB more headroom at the
    35-minute mark than the night's crash had, and the growth that remains
    is a step up under traffic rather than a ramp. The JS heap runs 100-125
    in that band (77-94 at boot), so part of the step is real use. An
    earlier line here said "gone" — this is the honest shape. Set in
    render.yaml AND by API (an API env-var change does NOT trigger a deploy
    by itself — it rode the next merge). Next suspects for the band, if it
    ever climbs again: sharp's own cache (only `cutSheet` turns it off) and
    grpc's buffers under the Firestore SDK; `/inflight` every 30s is the
    measurement.
  - **Broke it: 8** concurrent 4K panels SHEETS (2026-08-28, ~6:04pm Pacific,
    another chat's shoebox batches — the box restarted with NO deploy in
    flight, so the concurrency alone did it; 5 of the 8 died mid-generation.
    That measurement is what `gateCut` above now removes the cause of.)
  - **A KILL DURING GENERATION SELF-HEALS SINCE 2026-08-29 — the sweep
    REDRAWS it (capped at 2; see the Playground bullet).** The first bill is
    still lost (measured 2026-08-28: 15 failed panels runs in one evening,
    NONE with a banked sheet — ~$1.75 of 4K medium sheets billed and never
    received), so a deploy landing while sheets are in flight still wastes
    one sheet's cost per run, and merges cannot be paused with many chats
    working. **A chat running MORE
    than the ledger's clean number of sheets should draw them in its OWN
    CONTAINER** (post to OpenAI directly — the `gen-dream-distilled.js`
    pattern; `OPENAI_API_KEY` is in the environment) **and cut them there
    too** (sharp runs anywhere; the cut recipe is `cutSheet` in server.js),
    then file panels via the normal gallery/prompt POSTs. A container is
    immune to deploys, shares nothing with the 512MB box, and parallel
    generation there is limited only by OpenAI's rate limits (measured
    2026-08-20: 5 parallel in 57s). Render's `/api/promptlab` panels stay
    for HER taps and small batches (≤3).
  **THE SCOPE IS THE BOX, NOT THE WORD "PLAYGROUND" (2026-08-20, Sophie
  mid-run: "why are you doing them one at a time?").** Two things this note
  does NOT cover:
  - **A chat drawing in its OWN container** (`gen-dream-distilled.js` and
    friends, posting straight to OpenAI). The Render box is not in the loop
    at all, so there is nothing to pace — measured 2026-08-20, the same
    five images took 4m39s serial and **57s in parallel**.
  - **The PLAYGROUND ITSELF, which has never serialized** — its ladders fire
    `Promise.all` and `runPromptLabGptJob` is fired without `await`, so
    nothing queues server-side either.

### Similitude

- **Similitude** (`triset.js`, `/api/triset`, pages at `/similitude` and
  `/triset`, no iOS tile yet) —
  triangular SET solitaire (Sophie's concept, 2026-08-30). A pool of
  triangular picture cards; three are dealt around a middle inverted triangle
  that is a TEXT BOX. She writes what they have in common — or taps a card to
  swap it — until she finds a set. Two kinds: **all the same** (one shared
  thing, named in the middle) and **each different** (each card shares
  something DIFFERENT with a 4th thing; the middle names the 4th thing, three
  side boxes name the connections). **Finding a set GENERATES A NEW CARD** —
  the venn center: her named qualities become the prompt for one new subject
  that unites them, drawn as a new triangular card that joins the pool. The
  game feeds itself.
  - **The style is Dreamy, HANDED IN** (`init({ gptStyles, fileCreation })`,
    the freeform pattern — server.js owns the wording). Two swaps on the tail,
    both the swap-never-argue mechanism: the border clause (anchored on
    `dreamy.sheet.from`) becomes the TRIANGLE clause, and her own noText swap
    runs (cards carry no text). Anchor stops matching → the triangle clause is
    APPENDED, never lost; the test pins it.
  - **EQUILATERAL is spelled out, and a MADE card is UPSIDE DOWN (2026-08-30,
    Sophie: "u didn't specify equalateral so the shapes are off" · "the middle
    card has to be upside down, and shud show, in the middle, when drawn").**
    The first 12 seeds came back steep isosceles — they stay in the pool
    (gorgeous, her word) unless she asks for a redraw. A found set's card is
    drawn point DOWN, lands IN the middle inverted slot when ready (no
    overlay), and carries `flip` on its doc — the page clips it point-down
    wherever it is dealt, forever, which is also how you tell the cards the
    game made from the seeds.
  - **THE CUT IS A PERFECT EQUILATERAL WITH A CREAM BORDER — c4, and the
    version she picked (2026-08-31, after five rounds: "the cards are fine as
    is" · "the previous version · with the flat fill · to make it
    equilateral").** The model draws each card — art, frame line, cream rim —
    on a white 1024 square, and **it draws them too big: measured across her
    whole nature set, ZERO of 72 squares hold a true equilateral around the
    drawn card with any margin, and only 20 at a bare fit.** So a cut that
    refuses to add anything must either crop the art or come out a different
    triangle every time. `triset-cut.js` (c4,
    `triset/cuts/<id>.c4.webp`): flood-fill the white away, **contain** the
    drawn card inside the slot triangle inset by MIN_BORDER (`inscribePlan` —
    base-anchored and centered, so a narrow card's extra lands at its sides
    and a squat one's at the top, her rule), and **fill the triangle with
    cream sampled from that card's own rim** (`rimColor`; a dark rimless edge
    falls back to the house CREAM). The seam is invisible because the fringe
    is eroded (`erodeAlpha`) and the card is flattened onto its cream BEFORE
    the resize — a hard alpha edge rings ~1px brighter when scaled, which is
    the "original cut shows as white lines" report.
    **The added band IS flat, and she knows and accepted that** — the honest
    trade for a perfect equilateral on every card.
    **The roads not taken:** c1 preserved the drawn shape (every cut a
    different triangle); c2 cover-fit (cropped art); **c5 cut a true window
    into the original** — real paper, real grain, nothing synthesized, and it
    cut through the art on all but 20 cards, which is why it lost. Reverting
    to c4 was pointing every card's `cut` back at its c4 object (they are
    immutable per version, so nothing had to be re-baked). **A redraw would
    fix the geometry at the source** — probed 3 cards through a gpt-image-2
    edit at medium and all three came back true equilaterals with the full
    margin, ~6¢ each, ~$3.10 for the 52 — she declined; the cards are fine.
    **THE ONLY CREAM BORDER IS THE PAPER RIM THE MODEL DREW INTO THE PICTURE
    (2026-08-31, Sophie: "there shud be no cream border aside from the one
    built into the images").** The first cut of this put a cream `.face` mat
    behind every card so it would show through as the border — which is a
    SECOND band, in a different cream, around the rim already there. So the
    slots draw nothing behind a card and the cut's transparency shows page
    paper outside the triangle (the c2 cut fills its triangle edge to edge —
    the gap between cards is the board's slot spacing now, not a FIT margin). The middle slot keeps its cream face while it is the WRITING
    SURFACE and drops it under a made card (`#s-mid.made .face`), or the
    doubling comes straight back on the one card that lands there. Bakes: render()
    right after banking the paid bytes (best-effort — a failed bake still
    readies the card, the old mapping is the page fallback), `POST /recut`
    (fire-and-forget sweep, `/status` reports it), `/seed` kicks it, and
    `node scripts/triset-recut.js` runs it from a container (dry by default).
    **HER CUT-OUT NATURE SET IS AN EDITION IN THE GAME (2026-09-01: "can u
    put the current nature set that u cut out into the actual game").** The
    72 nature subjects she hearted and printed carry `edition:'nature'`, so
    the game's edition chips (built for the color edition) show a **Nature**
    deck that narrows the deal to exactly the cards on her paper sheets — the
    physical set and the digital one are the same 72. One card per subject,
    the live in-pool one at the best quality; a hidden generation is never
    tagged, since it cannot be dealt. `edLabel` falls through to the
    capitalized slug, so the chip needed no page change.
    The objects are immutable — bump `CUT_VERSION` to re-bake past the CDN.
    **AND THERE IS A SECOND EDITION SINCE 2026-09-03 — EVERYDAY (Sophie, after
    asking why her shattered-plate card was hidden: "do the second edition").**
    Measured that day: 816 of the 902 cards were hidden, and **27 subjects she
    had HEARTED were hidden for no reason but not being nature** — the plate
    among them. **Widening the nature list was the wrong fix** and is the thing
    not to do: she spent a day deciding what nature means ("they did a bad job
    of deciding what's nature and what's not. redo"), and stretching it to fit
    a teacup undoes that. So the vocabulary is a TABLE now — `EDITIONS` in
    `triset.js`, one entry per edition over its own slugs file
    (`docs/triset/nature-slugs.json`, `docs/triset/everyday-slugs.json`) — and
    `syncPlan` runs its whole rule per edition instead of against a hardcoded
    `'nature'`. **The page needed NO change**: it derives the chips from the
    pool and `edLabel` capitalizes an unknown slug, so a THIRD edition is one
    file plus one line in that table. Three things not to undo:
    - **ADOPTION LANDS IN `ADOPT_EDITION`, NOT IN NATURE** — and that is a real
      behaviour change, not a tidy-up. Her ♥ on the waiting-room page used to
      deal a non-nature subject straight INTO the nature edition, which is the
      one thing the closed vocabulary exists to prevent; measured, **10
      subjects were already sitting in nature that way** (burnt-toast,
      dominoes, coat-chair…) and the switch moved them to everyday. Nature is
      closed and hers; everyday is where anything she adopts goes.
    - **`waitingPlan` counts a subject dealt in ANY edition**, not in nature —
      it named `'nature'` alone, and after the second edition it would have
      gone on offering her cards the game already deals.
    - **The two vocabularies must not overlap** (a subject has ONE edition) —
      a test asserts it, because `editionForSlug` takes the first hit and a
      subject in both would silently belong to whichever file is listed first.
    Live after the first sync: **Nature 71, Everyday 37**. Two subjects in
    everyday read as NATURE and are named in that file's `_open` —
    `blackberries` and `peacock-fan`; moving them is one line and is hers.
    **AND HER HEARTS ARE THE DECK NOW — no chat runs anything (2026-09-01:
    "connect it to the deck so they flow in and out automatically").** A ♥ on
    a nature card puts it IN the deal and an ✕ takes it out, cast wherever she
    already casts them (the Assets tab, Meta Assets, a hearts page) — one
    votes read behind a 60s cache at the top of `GET /cards`, writing only the
    cards whose state actually changed, so a settled deck writes nothing.
    **THE NATURE VOCABULARY IS KEPT ON PURPOSE**: she spent a day deciding
    what nature means and asked for a deck of exactly that, so a heart on a
    card outside `docs/triset/nature-slugs.json` does NOT silently join the
    deal — it is collected on the "New triangle hearts" Compare page for her
    to add deliberately. Widening it is one line (drop the `NATURE_SLUGS`
    test) and is hers to ask for.
    **THE WAITING ROOM is that page — one standing Compare deck, `triset-waiting`
    in `triset-nature-classification`** (kept the `runAutoCompare` way: fixed
    doc id, the data hashed, rewritten only when the set really changes, so her
    marks survive every rebuild because **an item's id is its SUBJECT SLUG**).
    **HER ♥ THERE IS THE ADOPTION AND IS A DIFFERENT SIGNAL from the heart that
    put the card on it** — a page mark lands on the page's own verdict doc, not
    on the asset vote — so "I like this drawing" and "put this in my deck" stay
    two separate answers, which is the only reason the vocabulary can hold
    without a heart anywhere in the app silently widening her set.
    **`hidden` AND `edition` CARRY DIFFERENT FACTS, and the sync keeps them
    apart**: `hidden` is "not in the pool at all" (508 of 583 cards are, on
    purpose — the alternates and the subjects she did not keep) and
    `edition:'nature'` is "this is the card the deal shows for that subject".
    So a ♥ never un-hides the pool wholesale, and **the incumbent wins** — a
    newly-hearted generation does not swap the picture on her printed sheet
    unless she crossed the dealt one out.
  - **HER PLAYGROUND TRIANGLE HEARTS ARE A STANDING PAGE TOO, REWRITTEN BY THE
    SERVER (2026-09-03, Sophie: "upgrade ur playground hearts page to auto
    update as i add new cards, showing newest first").** It began as a script
    that re-posted a frozen page, which is the thing a posted Compare page
    cannot escape — its data is written to Storage at post time — so "auto
    update" has to mean the waiting room's own machinery: one fixed doc id
    (`triset-pl-likes`, in `triset-card-inventory`), the data hashed, rewritten
    only when the set really changes. `likesPlan`/`writeLikes`/`syncLikes` in
    `triset.js`; the retired script was `scripts/gen-triset-playground-likes.js`.
    **A HEART IN THE PLAYGROUND REBUILDS IT** — both promptlab vote routes call
    `triset.pokeLikes()` fire-and-forget when the run is a `triangle` one,
    leading + trailing like `runAutoCompare` (the leading half is what survives
    a deploy inside the debounce window), and the game's own `/cards` sweep
    rebuilds it as well, so a poke lost to a restart is picked up the next time
    she opens Similitude. **THE ITEM ID IS `<run>-<index>`**, which is the whole
    reason the page can be rewritten under her — an id that moved with the
    ordering would re-point her marks at other pictures the first time she
    hearted something new. Newest first, her ask; one item per hearted IMAGE,
    since a panels run holds several; a hearted index with no url is dropped
    rather than drawn empty; the hike run is skipped by id ("hike one was an
    accident", and it has people). Test: `node scripts/test-triset-likes.js`.
  - **Her words are the content half, verbatim**; the one connective line
    (INVENT_LINE) rides in the wrapper and is disclosed in `promptStyle` with
    the `[content]` seam. The whole prompt is stored on every card doc.
  - **PLAYING AGAINST THE COMPUTER (2026-09-01, Sophie: "make it possible to
    play against a computer").** Turned on in the settings gear; the score
    replaces the set count. **TURN-BASED, NEVER A TIMER** — she looks for as
    long as she likes and **ITS TURN** is what hands the hand over. A race
    against a clock would make a quiet game a reflex test.
    - **IT PLAYS FROM THE CARDS' OWN PROMPTS, not the pictures** — those words
      ARE what drew each card, so it reads the same thing she is looking at,
      and a text call is ~0.1¢ where a vision call is cents.
    - **IT CAN NEVER SPEND HER MONEY.** A set it finds is announced, typed
      into the middle and scored; the ~2¢ venn card is still her own Draw it!
      tap. **`claimBy` is why a claim has an owner** — without it, drawing the
      card the computer found would score HER a point for its set.
    - **IT IS ALLOWED TO PASS, and that is the balance** — an opponent that
      always finds something is narrating, not playing. `A STRETCH IS A PASS`
      is in the prompt and pinned by the test.
  - **THE SETS SHE HAS WON SIT AT THE BOTTOM (2026-09-01: "sets get saved at
    the bottom, left to right, 4 to a row, in full triangle formation, new
    card included in middle · can be clicked to see bigger · you can also
    click to see opponents successful sets").** A tile is the BOARD at tile
    size — **the same `.sl` geometry, one copy of the numbers**, so a saved set
    looks exactly like the hand that won it. Stored as card IDs like the table,
    so a re-cut card is never a stale copy. Two things not to undo: **the
    middle of a formation is the inverted triangle BY POSITION, never by the
    card's own `flip`** (a set drawn but not yet made still has to nest), and
    the opponent's tiles wear a small gold **IT** in the formation's empty
    top-left corner — hers wear nothing.
  - **HER RULESET IS IN THE SETTINGS SHEET, IN HER WORDS (2026-09-01, "add the
    stealing to the ruleset")** — *Claiming a set* and *Challenging and
    stealing sets*, dictated by her; don't reword them. **THAT SHEET SCROLLS
    NOW**: it made the card taller than a phone, and a centred flex child
    overflows in BOTH directions, so the modes and the opponent toggle at the
    TOP of it were off screen and untappable — pinned with `elementFromPoint`,
    since a control above the fold passes every width assertion.
  - **NEW HAND, HARD LEFT (2026-09-01: "add a new hand button, on the left")**
    — it calls `nextHand()`, the same door the made card's tap uses, so there
    is one way a hand is replaced. **Only `#found` takes `margin-left:auto`**;
    with the auto margin on every `.btn` three buttons spread out and nothing
    is hard left. And **the outline costs nothing** (her check the same
    message, "make sure the outline didn't make the buttons bigger"): the 1px
    border is taken back out of the padding, so the box is exactly the size it
    was before these went gold-outline. Pinned as `padding + border === 9/14`.
  - **A DOUBLE TAP OR A LONG PRESS OPENS A CARD BIG (2026-09-01)** — a single
    tap already means pick-for-swap on the board and in the hand alike, so the
    big view rides the two gestures a single tap is not. Two things not to
    undo: the long press **suppresses the click it would otherwise become**, or
    opening a card also picks it; and the release that ENDS the press must not
    read as the tap that closes the overlay it just opened under her finger —
    that is a FLAG set by the press (`eatCardTap`), never a timing window,
    because a clock is the same bug waiting for a slow frame.
  - **THE CHALLENGE (2026-09-01: "you can challenge your opponent, if you have
    a card in your hand that fits their rule, then you steal their set").**
    Open one of its sets big, tap Challenge, pick a card from her hand;
    `POST /api/triset/challenge` asks the model whether it really fits the rule
    it named, and a yes moves the point to her. **The referee is DELIBERATELY
    STRICT** — a challenge that always succeeds makes the opponent pointless —
    so the rule must be true of the card the same plain way it is true of the
    set, and a near miss is a no. One text call, ~0.1¢, no picture.
  - **Money:** a found set draws ONE gpt-image-2 edit with the dreamy
    reference — LOW while the prompts are tuned (her call, 2026-08-30), ~1.8c,
    only on her deliberate star tap; `QUALITY` in triset.js is the one line
    that raises it back. Opening the page spends nothing.
  - **A THIRD KIND — `auto` ("Model finds it", 2026-08-30, her idea tried the
    same day and it worked: sunflower+lemon+beehive → a yellow umbrella in
    grey rain).** The three dealt cards are ATTACHED behind the style
    reference and `AUTO_RULES` explains both set kinds; the model finds the
    connection and draws the venn center itself. Nothing typed → the content
    half is honestly EMPTY, the title is the three source titles joined, and
    `from.urls` is resolved at /found time (a bad id refuses before money
    moves). ~5c — the three card images ride as input tokens. **Seeding is a container job** —
    `node scripts/seed-triset.js` (dry by default, `--go` draws; all draws
    fire at once, the container pacing rule) — never Render's.
  - Firestore `forge-triset-cards`, one doc per card; seeds content-addressed
    sha1(url) so re-seeding dedupes; made cards carry `from` (which three
    cards, which kind, her words). Nothing deleted — `hidden` is the verb.
  - **SHE CALLS IT SIMILITUDE (2026-09-01: "rename it similitude").** The
    DISPLAY name only — the `<title>`, the header, the help card. The route,
    `/api/triset`, `forge-triset-cards`, the `triset/` storage prefix and the
    `triset.*` localStorage keys are IDENTITY and are never re-keyed (the
    chat-rename rule: renaming is cosmetic and re-keys nothing). `/similitude`
    is served as the same page so the new name is a real URL, and `/triset`
    keeps working for her pin and any saved link.
  - **HER PLACE IS SAVED, AND THE SETS ARE COUNTED (2026-09-01: "saves ur
    place, even w deploy or reopen" · "counts how many sets - top right -
    number" · "buttons go above hand").** The whole table rides in
    localStorage BY CARD ID — board, hand, deck, discard, her typed middle,
    the kind and the count — so a reload, a reopen or a deploy puts her back
    exactly where she was; typing saves too, so nothing is lost mid-sentence.
    **Ids, not card objects**: the pool is re-fetched every load and a stored
    copy would go stale the day a card is re-cut, and anything the pool no
    longer holds is dropped on the way back in, so a hidden card cannot strand
    the game (a board that cannot be rebuilt deals fresh instead). The count
    is a bare number top-right, absent at zero. The buttons sit ABOVE the hand.
  - **THE CHROME IS GOLD OUTLINE AND THE MODES LIVE IN SETTINGS (2026-09-01:
    "buttons shud be gold outline gold text no fill, and all caps" · "get rid
    of deal button" · "put the question mark in the top right and make it a
    settings button so i can toggle the mode … so get rid of the row" · "make
    the set button all the way right" · "outlines are too thick").** Every
    button is a gold outline with gold text, no fill, uppercase; the one that
    is left rides `margin-left:auto` so it sits hard right without knowing how
    many share the row. **Deal is gone** — the deck flows through her HAND, so
    a new board comes from swaps and from finding a set. The `?` became a
    settings gear top right (the set count beside it) and the three modes moved
    into its sheet, so the mode row is gone. **`setKind` is called at boot** or
    the sheet opens with nothing lit, since `kind` has a default no tap set.
    **THE HEADER NEEDS ITS OWN `min-height`** — every child of it is absolute
    or hidden, so without one it collapses to its padding and the board
    overlaps the gear, which then cannot be tapped at all (caught by PHOTO).
  - **THE RIGHT BUTTON HAS TWO STAGES (2026-09-01: "right button - 'set!' -
    highlights cards in gold · set becomes 'draw it!' w the star AFTER you
    enter text").** "Set!" CLAIMS the three cards — they light gold and the
    middle box takes her words — and only once there are words does it become
    **"Draw it!"** wearing the generate star. So the claim is free and
    reversible and **the paid tap is never the first one**. The gold is a
    drop-shadow, never a border: the cards are clipped triangles and a border
    would draw a rectangle round one.
  - **A REAL DECK AND A HAND (2026-09-01: "make it so i get dealt three cards,
    they show under the board, i click a card on the board and one in my hand,
    to replace it w that card. a new card from the deck comes into my hand" ·
    "make sure its an actual deck dealing").** Not a random pick per slot: a
    SHUFFLED deck (Fisher-Yates) dealt off the top, six cards on the table at a
    time (three on the board, three in her hand under it), no card in two
    places, a replaced board card going to the DISCARD, and the discard
    shuffled back only when the deck runs dry. A swap is TWO TAPS — a board
    card and a hand card, either order — and the emptied hand slot refills off
    the top. Four things not to undo: **the board is dealt first and the hand
    takes what is left**, so a three-card edition fills the board and leaves
    the hand empty rather than refusing to deal (a real deck runs low
    honestly); **the pick is shown by DIMMING the others**, never a border,
    since the cards are clipped triangles and a border would draw a rectangle
    round one; **`drawFresh` puts aside anything already on the table**, so a
    re-shuffle can never deal a card twice; and **undo snapshots the whole
    table — deck and discard by copy** — or restoring the board while the deck
    kept its position deals a card that is already in play.
  - **UNDO AND REDO ARE BARE GLYPHS AT THE TOP LEFT (2026-09-01: "undo button
    at the top left - no words, just an icon that grows a redo if applicable ·
    no square or fill around icon").** Both live in the header, left of the
    centred title: a Lucide `undo-2`/`redo-2` pair with **no plate at all** —
    the house rule's plateless case, since the header is the calmest strip on
    the page — and a 34px tap target with only the paint absent. **REDO is
    drawn only when there is something to redo**, and any NEW move drops the
    redo stack (the future she undid ends the moment she plays a different
    one); `pushUndo` is the one door every action comes through, so that
    clearing has one home. `snap`/`restore` are shared by both, so the two can
    never disagree about what a saved table is.
  - **UNDO PUTS THE LAST HAND BACK (2026-09-01: "add an undo button").** Deal
    and swap are RANDOM, so a card swapped away is gone unless the draw happens
    to return it — undo is the only way to keep one she liked. A stack of
    hands (`undos`, capped 20), pushed by deal and swap, popped by the button.
    Three things not to undo: it restores the three CARDS and nothing else —
    her typed middle, the kind and the edition are hers and still describe the
    hand that comes back; the button is **hidden** when there is nothing to go
    back to (the edition row's own rule — a dead control in a row of three is
    worse than a row of two); and it is off while a card is `pending`, since
    the draw is already paid for.
  - **EVERY MOVE IS LOGGED, PER PHONE (2026-09-04, Sophie, after Miriam's
    game: "do u have a play by play of her game - which cards she moved etc"
    → "yea i'd like that").** The solitaire table lives in the phone's
    localStorage, so until this the server only ever saw a FOUND set — Miriam's
    evening came back as nine cards and nothing between them. The page posts
    every deal, swap, undo, redo, claim, find, edition and mode change,
    batched a second behind the tap and flushed on pagehide, under a random
    per-phone id (`triset.player` in localStorage — no name, no login; the
    phone is the player), and `/found` carries that id so a made card wears
    `player`. `POST /api/triset/moves {player, moves}` appends in a
    transaction to one doc per player per day (`forge-triset-moves`,
    `<player>-<yyyymmdd>`, capped 2000, a retried batch adds nothing twice);
    `GET /api/triset/moves?player=` reads the timeline back. **A log never
    gets in the way of the game** — nothing awaits it, a failed post rides
    the next batch. Games played BEFORE this shipped have no moves on file,
    only their finds. Test: `node scripts/test-triset-moves.js` (the route
    pure, then the real page against a stub that records what really lands).
  - The page is one screen, NO pill; the mid slot is `pointer-events:none`
    (its rectangle overlaps the two lower cards) — only the textarea takes
    taps. Made cards land in My Creations via the handed-in fileCreation.
  - Tests: `node scripts/test-triset.js` (pure + headless page half; reads
    the real dreamy wording out of server.js via
    `scripts/lib/dreamy-style.js`).
  - **GATHERING EVERY TRIANGLE CARD SHE HAS HEARTED — TWO SURFACES, ONE
    GATHER (2026-09-03, Sophie: "gather all the triangle cards i've hearted
    everywhere i[n] ur assets tab and 1 up tinder quick toggle w good/bad ·
    be thorough").** `scripts/lib/triangle-hearts.js` is the gather;
    `triangle-hearts-deck.js` posts the swipe deck and
    `triangle-hearts-file.js` files the same set into the chat's Assets tab
    with the full ritual (a real label, the MODEL · QUALITY · SIZE caption,
    both exact prompt halves — measured, all 166 carry all three, so nothing
    files short). **ONE gather, so the tab and the deck can never disagree
    about what the set is**, and both mark the SAME url, so a ♥ in either
    shows in the other. Both are dry by default and cost nothing — reads
    only, no model call. Three doors a heart comes through, all swept: an Assets-tab / Meta
    Assets ♥ (`forge-asset-votes`), a ♥ or a "this one" pick on **any**
    Compare page (`forge-chat-verdicts`), and a per-image ♥ on a Playground
    run (`forge-promptlab`). Live 2026-09-03: **162 distinct cards** — 127
    pool cards (70 of them in the Similitude deal) and 35 Playground pictures.
    - **A COMPARE PAGE'S ITEM IDS CANNOT BE GUESSED — READ THE PAGE'S OWN
      JSON.** The first version (2026-09-01) resolved them by guessing a
      card's url stem or a `subject` field; measured, **`subject` exists on
      none of the 902 card docs**, and across all 131 verdict docs exactly
      **one** of her 300 `true` marks resolved. Her pages carry at least six
      id shapes (a slugified title, a subject slug, a card stem, a 12-char
      card-id prefix, `pl-<run>-<i>`, `<run>-<i>`), because each page was
      built by a different chat. `chat-pages/<id>.json` in Storage IS the
      dictionary — id → url, whatever the ids are called — and it is the only
      reading that cannot go stale the next time a chat invents a shape.
    - **WHAT COUNTS AS A TRIANGLE CARD IS EVIDENCE, never a path guess:** a
      pool card, a Playground run declared on the Triangle tile **or** whose
      own `fullPrompt` matches the clause (10 runs predate the tile and
      declare nothing), or a filed asset whose stored style half matches —
      `matchStyle` in `playground-port.js`, the one rule.
    - **ONE CARD IS ONE ITEM.** A heart can land on the pool card, its
      current cut, an OLDER cut (`triset/cuts/<card doc id>.c1.webp`), a
      thumb-service link, or a re-encoded copy — joined by url, by the cut's
      stem, and by the Assets tab's own **md5** union.
    - **HER MARK LANDS ON THE CARD'S OWN URL for a pool card**, never the old
      cut the heart happened to sit on: `syncHearts` reads the whole vote
      collection keyed by URL and ignores the chat, so a ♥/✕ in the gathered
      deck really does put the card into the deal or take it out.
    - **A LONE `%` IN A REAL URL THROWS** — `decodeURIComponent` raised "URI
      malformed" on one of her liked urls and took the whole sweep with it.
      Every decode here is guarded; a key that cannot be decoded is still a
      usable key undecoded.
    - **THE TAB IS NOT PRE-HEARTED, on purpose.** An asset vote is keyed
      chat+url, so the hearts that put a card in this pile live in the chats
      it came from — and filling this tab with 166 ♥ of its own would be the
      2026-08-31 "they all have good on them covering the image" complaint in
      tile form, leaving the ♥ here meaning nothing. Empty marks make it a
      fresh re-triage, exactly like the deck.
    - **The prompt route answers `results`, not `items`** — reading the wrong
      key made a batch that fully succeeded print "0 ok".

### SIMILITUDE FOR TWO PHONES

- **SIMILITUDE FOR TWO PHONES** (`similitude-two.js`, `/api/similitude`,
  page at `/similitude/play` — PUBLIC, no tile; 2026-09-04, Sophie: "how can
  we make this multiplayer" → "same cards as the dominoes deck. turns. just
  cap the drawing at like a dollar per person"). The triangle game played by
  two people from their own phones, over the SAME two-seat table as the
  dominoes game.
  - **`table.js` IS THE ONE TABLE.** The seats, the invite, the turn gate, the
    your-turn text and the per-player view were lifted out of dominoes.js
    into a factory (`makeTable({collection, page, title})`) the day this
    shipped; dominoes.js is a thin call now and its test is byte-for-byte
    green. A game adds its own routes to the returned router and may ride
    server-owned fields on the read (`extendView`, and async `enrich` — how a
    drawing card becomes its picture on the way past). **A third two-phone
    game is one `makeTable` call**, never a copy of the seat code.
  - **THE DECK IS THE DOMINOES DECK BY CONSTRUCTION** — the 61 ids are read
    out of `public/dominoes.html`'s own `DECK` constant at first use (a
    bracket-depth walk; the line ends in a comment), resolved to each card's
    CURRENT cut and words, served public at `GET /deck` and cached 60s. No
    second list anywhere, and a test fails if one appears.
  - **TURNS, NEVER A RACE** (her word, and her own rule from the computer
    opponent: a clock makes a quiet game a reflex test). A turn is ONE thing:
    swap a hand card onto the board, pass, **Set!** + the words (claims and
    scores the set, the three leave play for the tile, the board refills off
    the deck), or **Challenge** a set the other found with a card from your
    hand — win or lose, the challenge was your turn. Only the player on turn
    writes; the other phone polls and adopts (dominoes' page pattern). Both
    hands ride the state as dominoes' do; the page shows only yours.
  - **THE DOLLAR IS SERVER-SIDE AND PER SEAT.** `POST /rooms/:id/draw` is the
    one paid tap — triset.js's own `startFound` (lifted out of `/found` for
    this, with `judgeChallenge` out of `/challenge`, so a made card is the
    same made card wherever the set was found). The room doc carries `spent:
    {a,b}` in cents; the route RESERVES the cost in a transaction before the
    card is started (two taps cannot both fit under the cap by reading one
    balance), refunds a start that failed, and refuses past `CAP_CENTS`
    (100) with 402 — the page greys the button and says "your dollar is
    spent". Only the finder may draw their set, once per set, and a draw is
    keyed by GAME + win index, or a new game's tile would inherit last
    game's card. The made card lands in the winning tile's middle; **it does
    not join the 61** — that is a follow-up, hers to ask for.
  - **The page** (`public/similitude-two.html`) is the dominoes lobby (name,
    optional phone, invite link, your tables remembered on the phone) over
    the Similitude board, hand and shelf — triset.html's geometry number for
    number, its gold-outline buttons, its Set!/Claim/Draw it! stages. The
    score is two numbers in the corner, mine first, because a score with
    names in it ran into the centred title at 390pt; the names live on the
    turn line and under the shelf tiles. Boxes ship empty.
  - Tests: `node scripts/test-similitude-two.js` — the deck's single source,
    drawGate's decision table and the cap pure; then the REAL page on two
    headless phones over the real router with an in-memory Firestore and
    the model doors stubbed: start, invite, sit down, deal, swap, the gate,
    pass, Set!+words, Draw it! reserving the cents and the card landing in
    the tile, the 402 past the dollar, a challenge stealing a set, and no
    token or phone ever crossing seats.

### THE UPDATE BUTTON

- **THE UPDATE BUTTON** (`brief.js`, `/api/brief`, page at `/brief`) —
  **ITS DOOR WENT WITH THE UPDATE TAB (2026-09-14)**: the **Update** row that
  opened it lived at the top of that tab and nothing in the app links `/brief`
  now. The page still works at
  https://imageforge-q125.onrender.com/brief — seating the door somewhere else
  is hers to ask for. Aug 2026,
  Sophie: "an update button that I can just click and then
  it does an API call that gives me the top five things I might want to be
  updated on, and then maybe some lower priority things, and ideally images
  that chats made or links to compare pages". One tap → five cards, the
  quieter ones under them, each carrying the pictures that chat made and the
  Compare pages it posted.
  - **IT LIVES ON THE UPDATE SCREEN, NOT THE HOME GRID (Aug 2026 v2, Sophie:
    "a couple days ago we added a what's new button to the main screen, but I
    wanted it to go on the update screen — could you rename it Update, no
    icon, and put it on the update screen").** It shipped as "What's new" with
    a list icon on the iOS home screen. It is on EVERY paint of that tab, the
    caught-up one included: the page behind it answers a different question
    from the cards, so an empty list is no reason to take the door away. It
    carries no count, for the same reason it never did on the home screen.
    `BriefView.swift` is kept but unmounted, and /brief opens inside the Chats
    web view with its own chevron back.
  - **IT IS A CHIP, AND IT SITS ABOVE THE ACCOUNT TABS (Aug 2026 v3, Sophie:
    "the update and also the review button that you probably copied are both
    supposed to be smaller and they're supposed to go above the chats").**
    Both doors shipped as full-width slabs at the top of the LIST — 92px of
    screen before the first card, on the screen she opens to find out what
    happened. They are `.catchip`-sized buttons on their own line in
    `#nwdoors` now, between the search row and the account tabs, so they are
    CHROME and not list: `paintNewsDoors` fills that row, `paintHomeChrome`
    empties it on every other view, and only the review CARDS behind the ⌄
    still live in the grid. Measured on a 390pt phone: 26px instead of 92, and
    the first card moved up 66px. Review keeps its ⌄; Update is never owed, so
    it doesn't.
  - **NONE OF THE THREE IS RED (Aug 2026 v4, Sophie: "make the review button on
    updates tab not red").** Review was the one door painted in the accent, on
    the reasoning recorded here that it is "the door that says something is
    owed" — she looked at it and said no, so that reasoning is history rather
    than a rule. Every door now wears the quiet `var(--line)` box every other
    chip on the page wears, and the COUNT beside the word is what says how much
    is waiting. Don't paint one back.
  - **AND A THIRD DOOR — TO READ (Aug 2026 v4, Sophie: "add a to read button
    next to it").** The one bookmark tag with a door of its own: things she
    kept meaning to read back are the pile that goes stale when it can only be
    reached by remembering it is there. It is on EVERY paint (like Update) and
    carries a count (unlike Update, because unlike Update it can be empty), and
    it opens the KEEP-PILE with the To read filter lit — never a fourth pile of
    its own, because there is one place kept things live. **The count is what
    is still WAITING**: a row she has ticked read (and a thing she has since
    un-kept) is filtered out of it in memory, because `array-contains` plus an
    equality would need a composite index. The count is its own
    tiny route (`GET /api/chatfeed/to-read`, two array-contains queries), asked
    once per load and repainted when it lands: this tab paints on every poll
    and `GET /bookmarks` returns up to a thousand documents.
  - **IT OPENS ON THE LAST LIST SHE SAW, AND THE READ IS A TAP (Aug 2026 v2,
    Sophie: "rather than immediately doing another API read, I'd like to be
    able to go back and forth, so the update should be behind one more tap …
    there's a button at the top that says refresh which causes another API
    read, and it also says last updated and then the time").** The whole
    answer is kept in `localStorage` (`forge.brief.last`, with the moment it
    was read) and drawn instantly; **Refresh** at the top of the page is the
    only thing that reads, and it sends `?fresh=1` past the server's 60s hold.
    Two things not to undo: the old **auto-reload on `visibilitychange` is
    gone** (it re-read every time she came back — the exact thing she asked to
    stop), and a FAILED refresh keeps the list she was looking at on screen
    with the error in the stamp line. Coming back repaints the stamp only, so
    "5m ago" can never go stale while the tab sits in the background.
  - **IT SPENDS NOTHING AND WRITES NOTHING.** No model call: the lines it
    shows were already written by the chats themselves (their status card's
    `need`, their Update card's `did`, their TLDR), so a summary here would be
    a paraphrase of a summary. Four Firestore reads, three capped, one of them
    chatfeed's own 5-minute registry cache (`registry` is exported for this —
    do NOT open a second cache of that collection). The answer is held 60s, so
    a double tap is free; `?fresh=1` is the Refresh button.
  - **`notifSeenAt` — the ✓ in the Chats app — is the ONE floor**, the same
    one the Update tab and the widget use. Checking a chat off there empties
    its card here, and anything newer brings it back by itself. **Reading the
    brief marks nothing seen**: a button that silently cleared her Update tab
    would lose news she never read.
  - **Her filing wins the ranking**: `pinTop` and `starred` lift,
    `newsQueue:'later'` sinks, `'never'` drops out, and archived/trashed/hidden
    obey the same rules as the chat list (hidden is a STAMP, so a chat that
    answers her pops back out). A live `need` keeps a card even once she has
    seen it — the ask is still open.
  - **ONE OF THE FIVE IS RESERVED for something to LOOK at** (measured against
    her real data 2026-08-17: **24 of 33 cards carried an open `need`**, so a
    pure score sort filled all five with asks and the pictures and pages —
    half of what she asked the button for — never reached the top of the
    page). It is a reservation, not a re-score: the top four are whatever
    scored highest, and with nothing to look at the fifth goes back to the
    next card by score.
  - **The picture strip merges by md5 and keeps the LABELED record**, not the
    newest one — the unlabeled twin is always the hook's `claude-deliveries`
    copy, so "first one wins" would strip the label off half the strip.
  - **It was a full-screen COVER from the home grid, never a `Tool`** —
    opening a Tool promotes it into `Recents`, so the button would have
    evicted one of her three bottom-bar slots on every tap. That HALF is
    history since 2026-08-26 (the bar's three are fixed now — see *THE BOTTOM
    BAR'S THREE ARE PERMANENT* below), but the rest of the reasoning stands
    and is banked in `BriefView.swift` in case the page ever wants a native
    screen again.
  - Tests: `node scripts/test-brief.js` (the whole ranking, pure, fixtures),
    `node scripts/test-brief-page.js` (the real page + the real injected pill,
    headless — the cache-first open counted in API calls, Refresh, the pill
    palette, the pill's corner over the top card, the lightbox contract, the
    ⌄). `test-chats-update-row.js` went with the Update tab.

### THE REVIEW QUEUE

- **THE REVIEW QUEUE** (`review.js`, `/api/review`, page at `/review`, iOS
  tile "Review Queue") — Aug 2026, Sophie: "I have a pile of things that need
  to be reviewed and I'd like one screen that shows all the things waiting to
  be reviewed". One screen, every deck/grid TEMPLATE page across every chat,
  with how far through each she is. Measured the day it was built: 9 template
  pages, 285 items, 9 decided.
  - **PAGES ARE SQUARE TILES, THREE TO A ROW (Aug 2026 v2, Sophie: "icons
    three to a row … square and they should just be the first picture of
    whatever the review content is")** — the tile face is the content's first
    picture, or on a text deck (date moments, video ideas — 12 of the 15
    queued pages the day this shipped) the first card's own words in the
    serif (`peek` on the row). Tapping a tile opens the page **CLEAN**:
    `/api/chatfeed/page/<id>?clean=1` renders the template with NO h1,
    straight onto the cards (her ask: "not a compare page because that has a
    header at the top, but instead just a clean Tinder style page … with all
    the content preloaded"). `clean` lives in `renderTemplatePage`
    (page-templates.js) and works on both templates; a deck already has no
    pill, a clean grid keeps its pill because it scrolls.
  - **EVERYTHING ELSE MOVED INSIDE THE DECK (Aug 2026 v2, same conversation:
    "take away the chat list at the bottom and instead offer a link back to
    the chat in the piles area" · "get rid of the X on all of the icons and
    instead offer a skip or done button in the piles area").** The queue is
    now decks and ONLY decks — a chat tagged `to be reviewed` is no longer a
    row here (the word still files it in the Chats app, it just no longer
    puts a second kind of row in front of the pile), and no tile carries an
    ✕. A deck's **piles view** carries all three: *Open the chat*, **Skip**
    (not a review — stamps `reviewHidden`, still reversible with ↩ from the
    hidden pile) and **Done** (`reviewDone` — finished with it whatever the
    cards say; the queue still derives DONE from the counts as well). Both
    stamps go through `POST /api/chatfeed/page/:id/review`, which lives in
    chatfeed because that is where the deck already posts its verdicts —
    the same gate, nothing new to authorize. `/api/review/hide` stays as the
    queue's own ↩, and is the page's only write.
  - **A DECK OPENED FROM THE QUEUE HAS A WAY BACK** (her ask) — `?clean=1` is
    both the door and the signal: judge.js reads it, shows a back chevron in
    the top row, and `history.back()` returns her to the queue exactly as she
    left it (`/review` is the cold-open fallback). A deck opened from the
    Compare tab shows no chevron — the app's own header owns that.
  - **A LONG CARD PUTS ITS TITLE IN THE TOP-LEFT CORNER (Aug 2026, Sophie:
    "if the text is really long have the title just go in the top left corner
    instead of in the middle. I really don't like scrolling").** Over ~240
    characters (~150 with a picture) a moment card wears `.long`: the name
    drops from 21px centred to a small left-aligned line, the stack starts at
    the TOP instead of centring, and the ✕/♥ **float on the content's bottom
    corners** with the note box directly under it — her second ask the same
    day ("there's a lot of space between the X and the heart that's empty…
    put the heart and the X on top of the content so the content comes down a
    little farther"). The old ✕ · note · ♥ row cost ~78px of mostly empty
    band. **A SHORT card is deliberately untouched** — there the big centred
    name is the design.
  - **A DECK REOPENS WHERE SHE LEFT OFF (2026-08-29, Sophie: "I swipe through
    the Tinder thing does it save my place rather than showing me things I've
    already swiped on").** Her MARKS always came back — they live on the
    verdict doc — but the resume jumped to the first UNMARKED card, and in
    **browse mode a mark never moves the deck**, so every card she read past
    without marking pulled her backwards on the next open. Her place is one
    more field on that same doc (`at`, an item id), written by `savePlace` in
    judge.js on every move and flushed on `pagehide`.
    - **The id, never the index.** The sheet name already carries the item
      set's shape, but an id says what it means, and a card that has since
      gone falls through to the old first-unmarked rule instead of landing
      her on whatever moved into that slot.
    - **A place is not a verdict.** It rides `POST /api/chatfeed/verdict` for
      the identity and the one doc, in its own field — so saving a place can
      never mark a card, and the route now takes `item` OR `at`.
    - **A FINISHED deck still opens on the PILES**, ahead of her place: "you
      are done" is the honest screen for a finished deck, and her last card is
      one tap from it.
    - **A ♥ arriving from the Assets tab must not yank her off a restored
      place** — `loadAssetVotes` can finish the deck mid-resume, and it used
      to re-aim at the first unmarked card when it did.
    - Test: `node scripts/test-judge-place.js` — the deck is LOADED TWICE
      against a server that really keeps the doc, because a source assertion
      cannot tell a saved place from a lucky index (verified failing pre-fix).
  - **ONE PAGE, TWO VIEWS (Aug 2026 v4, Sophie: "the compare page, and tinder
    swipe shud be TWO views of the the same page, since they have the same
    content. that way I can swipe back and forth, and see them at full size,
    rather than opening and closing").** Every template page now carries BOTH
    halves behind one hairline switch (SWIPE · COMPARE, `page-views.js`);
    `template` only decides which it OPENS on. The half that is missing from
    the data is derived — a grid's groups flatten into the deck's item list, a
    deck's items become one-card groups — so a page posted either way opens
    either way, including every page already posted.
    - **The marks cross by themselves.** Both views have always written the
      same verdict doc under the same item ids, so switching is a repaint:
      each view exposes a `refresh()` and re-reads on the way back in. Her
      place in the deck is kept (`resume(false)` — catching up must not jump
      her to the first unjudged card).
    - **The pill is per VIEW, not per page.** A deck is one screen and a grid
      scrolls, so `meta forge-pill off` could no longer say it: the pill is
      injected and hidden by the body class instead.
    - **The deck's height chain runs through the new wrapper** — judge.js
      sizes off 100% of its mount, so `#pageviews` is a full-height flex
      column and `#judge` takes what the switch does not. Without that the
      card floats at the top of a half-height box.
    - **AND SO IS THE TITLE, AND SO IS THE APP'S PILL (2026-09-03, Sophie:
      "spacing is weird / identity issues").** The pill rule above was the
      first of a family and the other two were still keyed off the POSTED
      template, which since this change only decides which view a page OPENS
      on. So the swipe view of a GRID-posted page was a second, worse deck:
      page-templates drops the `<h1>` for a `deck` only, so her deck chrome
      came up under a 26px serif title — the same name the app viewer's bar
      was already showing — and page-views' `.jg-mombg .float{display:none}`
      hides the INJECTED pill, where a page in the app runs in an IFRAME and
      the pill she taps lives in the PARENT (`mkPagePill`). Measured at
      390x844 with her 47px inset: bar 0-55, h1 55-78, the deck's top row
      130-174 under a pill spanning 47-239, and `elementFromPoint` on the
      deck's "?" answering the pill's play button — **not merely covered,
      untappable**. Now: `.jg-mombg .wrap>h1{display:none}` (hidden per view,
      never dropped, so the compare half keeps its heading and compare.js its
      "?" mount, and every page already posted gets it), and judge.js asks
      `window.parent.__pagePill(view === 'piles')` — down on a card, which
      scrolls nothing, BACK on the piles, which is the autoscroll she asked
      for on 2026-09-01 and the reason this cannot simply hide the pill.
      Test: `node scripts/test-page-viewer-deck-pill.js` (verified failing 4).
    - **AND THE VIEWER'S HEADER IS THE DECK'S TO SPEND (2026-09-03, Sophie:
      "the main thing is too much extra on screen pushing the picture down so
      the buttons overlap it unnecessarily" · "headers unnecessary - takes
      space. push it down").** `openPage` decided the bar from the posted
      template too, so a grid-posted page's deck wore a bar showing the same
      title the page already carries — 94px of a screen the deck fills
      exactly. It is per VIEW now (`window.__pageChrome`, page-views' own
      call), and the chevron is not lost: every TEMPLATE page is opened with
      `back=1`, so the deck draws one in the top row it already has.
      **THE NOTCH IS THE PARENT'S TO MEASURE** — `env(safe-area-inset-top)`
      is 0 in a nested browsing context, so the moment the bar goes the
      deck's top row would sit under her status bar; the viewer measures the
      inset where it resolves and hands it down as `--forgetop`, which the
      switch row pads by. Measured at 390x844 with her 47px inset: her top
      row 130 → 96, the card 253 → 183.
    - **A PICTURE CARD IS THE PICTURE (same report).** `.jg.mom.pic` — a card
      carrying a picture and none of her own parts (no `who`, words, sections
      or caption) — gets a caption-sized name and RESERVES the floating
      buttons' band, the way `.long` and `.linkroom` already do. The ✕/♥
      float on the content's bottom corners, so on a card whose picture fills
      it they float on the PICTURE: measured on a portrait fixture, 36px of
      the ♥ sat on the art. A card carrying any of her own parts is
      untouched — there the big centred name IS the design.
    - **A CARD'S NAME IS CLAMPED TO TWO LINES (same report).** `.who` is her
      date deck's line for a person's NAME and a picture card feeds it the
      item's LABEL, which on a filed Playground picture is the prompt —
      measured on her live hearts page: 19 labels, 6 to 116 characters,
      drawing 52 · 79 · 105 · **157px** tall, so the card's whole shape
      depended on how long a prompt was and her ✕/♥ ended up on top of the
      picture. `isLong` counts the card's own WORDS and never the name, so
      the small top-left treatment could not fire either. The words are one
      tap away behind the picture's own PROMPT door.
  - **A PAGE IS SPREADS HOLDING CARDS, AND A MARK LANDS ON EITHER (Aug 2026
    v4, Sophie: "so I can leave a note per card, or per spread. same w
    heart").** A spread of 2+ carries a key of its own — derived in
    `page-views.js` from its label, **`s:` prefixed so it can never collide
    with a card's** (item ids are cut to `[a-z0-9_-]`, so a colon cannot
    appear in one) — and rides the same verdict doc, so nothing new is
    stored and every page already posted gets it. **A one-card spread gets NO
    key**: its card's mark IS the mark, and a second heart for the same
    picture would be two answers to one question.
    - **BUT THE SWIPE VIEW DEFAULTS TO ONE CARD AT A TIME — A GROUP OF 4+
      SPLITS (2026-09-03, Sophie, on "Playground triangle hearts v1 (19)": "as
      a rule tinder compare shud default to 1 unless they're comparing
      something specific").** Every group used to become ONE swipe card
      holding all of it side by side, which is right for the two-up picker it
      was built for and falls apart the moment a group is a LISTING:
      `.jg-spread` is `flex:1 1 0` with no wrap, so her 19-card group drew
      11px-wide pictures under a row of "this one" buttons overlapping into an
      unreadable stack. **`SPREAD_MAX` in `page-views.js` is 3, and it is
      MEASURED on the real page at her 390pt viewport**: 2 across → 169px
      pictures with the button fitting easily, 3 → 110px, 4 → 81px against a
      72px button with no slack left, 5 → 63px, 9 → 31px pictures (16px TALL)
      with the buttons OVERFLOWING, 19 → 11px. So 3 is the last size where a
      picture is big enough to compare and every control still fits its
      column. Measured over her 30 most recent template pages the same day the
      group sizes are **1×60, 2×1, 3×40, 4-10×72, 19×1** — so this splits the
      inventory buckets (attributes, hearts, panels) and leaves the quality
      ladders and the three-proposal sets exactly as they were.
      - **COMPARE IS DELIBERATELY UNTOUCHED** — `spreadsOf` still hands the
        grid its groups, so the label, the ruled-off row and the `s:` key are
        all still there in the view a big group reads correctly in. A split
        group's spread mark therefore lives in compare only, and **no verdict
        is lost either way**: review.js counts CARD ids, and a spread mark
        already decides every card under it.
      - **A split card is COPIED**, never the grid's own object — an eyebrow
        written onto one would show up in the other view too — and it wears
        the group's name as its eyebrow, so she still knows which pile it came
        out of, the way the grid's heading tells her.
      - Test: `node scripts/test-swipe-one-at-a-time.js` (the real page
        headless at 390pt — every assertion a MEASUREMENT, since a card
        drawing nineteen 11px pictures and a card drawing one are the same
        markup to any source assertion; verified failing 6 pre-fix).
    - In the COMPARE view the spread's ♥/✕ sit at the end of its name row
      (with the pill's 64px column reserved, because the page scrolls and a
      row passes through that band on its way up), and its note is the shared
      `__compareNotes` + in the corner — a card's note lives on its picture,
      in the lightbox, and a spread has no picture.
    - **A "this one" UNDER EACH PICTURE PICKS THE WINNER (Aug 2026, Sophie:
      "is there a way to pick one or the other if I'm choosing between them?
      Maybe best is to just have a 'this one' small button underneath each
      one").** The spread's verdict becomes the WINNING CARD'S ID, so what is
      recorded is *silkscreen won this spread* rather than *she liked a card*
      — and a picked spread gets its own **Picked** pile, since a card-id
      verdict matches none of Yes/No/Unsure and would otherwise drop off that
      screen. The ✕/♥ still answer the spread as a whole (neither, or both).
    - **THE SPREAD SITS ABOVE THE BROWSE ZONES (Aug 2026, found by measuring
      rather than looking).** The edge zones are 26%-wide strips at z-index 2,
      and on a two-up card the CENTRE of each picture lands inside one — so a
      tap on either picture PAGED THE DECK instead of opening it, and the
      "this one" buttons under them were unreachable for the same reason, on
      the one card whose whole job is choosing between two pictures. The
      spread is lifted above the zones; the card's margins above and below
      still page, and the swipe always did. `elementFromPoint` at a control's
      centre is the only honest way to test this — the element is "visible"
      either way, and the question is what the tap actually reaches.
    - **NO OUTLINE AND NO ROUNDED CORNER ON A PICTURE** (same day: "gray
      outlines, rounded corners" · "are the corners rounded on the actual
      image in the light box? Should not be"). Her rounded white boxes are for
      WORDS. The spread wore two borders — the panel drew one and the image
      another — and the lightbox rounded the art itself, which at that size
      reads as a crop rather than as chrome.
    - **BROWSE IS THE DECK'S DEFAULT and only the deck template's validator
      was setting it**, so a GRID-posted page's swipe view came up without it
      and a mark jumped her to the piles instead of leaving her on the card.
      page-views.js defaults it now.
    - In the SWIPE view a spread is ONE card: its pictures side by side, each
      named, the card's ✕/♥ and note box marking the SPREAD, and tapping
      either picture opening that picture's own lightbox. **That is also
      exactly the two-up picker** she asked for earlier ("comparing two
      different images to each other, and picking between them") — it falls
      out of the shape instead of being a third thing to build.
    - `paintActs` asks for the spread's own row FIRST: a group contains tiles
      and a tile has `.gd-acts`, so the plain descendant selector matched a
      CARD's buttons inside the spread and painted the wrong thing.
  - **TAPPING THE PICTURE OPENS THE ASSETS LIGHTBOX, on a swipe card too (Aug
    2026 v4, Sophie: "I think I want the same exact asset tab formula w heart
    ex prompt note chat etc in lightbox view, and u can have tinder one choice
    when not in lightbox").** So the card keeps ONE choice — her ✕/♥ and the
    note box at the bottom — and everything else about a picture lives behind
    it: its own ♥/✕, both halves of the prompt, the note thread. The adapter
    is `asset-view.js`, lifted out of grid.js so a tile and a swipe card open
    the same thing rather than two copies drifting apart. judge.js drops the
    `zoom` class when the adapter is present, because that class belongs to
    compare.js's own document-level lightbox and racing it would be a bug.
  - **EVERY DECK IS HER DECK NOW (Aug 2026 v3, Sophie: "I think we should
    just make the single image review surface the same general template as
    the text one").** Her Decision Deck chrome — the cream, one screen, the
    progress line with **Piles** and the "?", the ✕/♥ floating on the content
    with the note box under it — was the date cards' alone, and a deck of
    PICTURES wore the house look instead: a count, three unlabelled gold
    circles, four verdict buttons. That is what hid Skip/Done from her: the
    piles view existed, but the way in was an unlabelled grid icon. So
    `renderTemplatePage` tells judge.js `look:'mom'` for every `deck`, and
    every card — picture, words, or both — is one of hers. The item's `label`
    becomes the name over the picture; a picture with no `aspect` sits in a
    panel that HUGS it, capped at 56vh, so a picture card is one screen like
    everything else. **A hand-built judge page (judge-shell.html) never comes
    through the renderer, so nothing already posted restyles itself** — and a
    test pins that.
    - **The mic survived the move**, deliberately: her date decks never had
      one, but all five live picture decks are posted with `voice:true`
      (measured), so folding them into her look would have taken the
      hands-free notes away. It rides in the note box's own corner.
    - **Four verdicts became two, and MAYBE came back as the third
      (2026-08-24, Sophie: "can you add a maybe option in the Tinder checklist
      template?").** Her footer is **✕ · ? · ♥** — the ? centred between the
      two that hug the card's bottom corners — and Maybe is a first-class
      pile now, not a legacy one. `LATER` stays legacy: it is still listed
      when something is actually in it, so an old mark cannot vanish off the
      screen, but nothing can cast one on a stock deck any more.
      - **The ? is DRAWN, like the ✕ and the ♥** — `MOM_MAYBE`, a filled
        ribbon with the nib thin where it enters, heaviest over the shoulder,
        a chisel cap at the tail, and a lopsided dot. Deliberately not
        `I.maybe`, the dashed circle: that is a Lucide-weight LINE icon and
        would be the only geometric mark inside her design.
      - **A maybe stamps NOTHING and CLEARS the asset vote.** The
        good/bad stamp rule already said there is no good and no bad in a
        maybe; the vote mirror follows the same logic — a maybe is not a like,
        so the Assets tab and the card still agree.
      - **THE CENTRE OF A CARD'S BOTTOM WAS NOT FREE, and only a measurement
        found it.** A card's `link` (its way out — "Open the chat ›") is
        centred at the end of the stack, which was safe while the only two
        buttons hugged the corners; the ? landed exactly on that anchor and
        `elementFromPoint` reported `BLOCKED-by-jg-mombtn maybe`. A card
        carrying a link now wears `linkroom` and reserves the buttons' 58px,
        the same band `.long` already reserves. Pinned by
        `node scripts/test-template-link.js`.
    - A deck with its own `states` keeps its chips — her words still win.
  - **THE PILES VIEW SURVEYS HER NOTES (2026-08-31, Sophie: "add note survey
    to piles").** Every card she wrote on, read back in one place, at the top
    of the piles — `Notes · N`, one row each: the card's picture, its name,
    and the note's whole thread. Five things not to undo:
    - **It CUTS ACROSS the piles** — a note is a note whether the card ended
      in Yes or sits unmarked — so it is its own section rather than a mark on
      a tile, and it LEADS them: the tiles are the pictures she has just been
      looking at, and a survey four piles down is one she will not read.
    - **READ-BACK only** (the keep-pile's own rule: "the pile is where a note
      is READ BACK; the keeping tap is where it is WRITTEN"). The row's name
      and its picture each open that card, where the note box is.
    - **The thread is painted by `__compareShell.paintNote`** — compare.js's
      ONE renderer — and folds with the same `N earlier` caret the card's note
      has, so a note reads the same in both places.
    - **The caret is a SIBLING of the name button, never inside it** — a
      button in a button is invalid and the tap would bubble into re-opening
      the card, so unfolding would leave the piles view.
    - **A field that parses to NO message makes no row**, and a deck she has
      written nothing on shows no survey at all — the common case, and
      byte-for-byte the view that was there before.
    - **AND THE WHOLE `Notes · N` HEADING FOLDS (2026-09-02, Sophie: "notes
      shud also collapse").** The piles grew their fold the day before and
      this did not — and it LEADS them, so on a deck she has written a lot on
      the survey pushed every pile off the first screen with no way to put the
      words away (measured at 390x844 on a five-card fixture: the first pile
      sits at y=399 open and y=160 shut). It is the piles' own control, the
      same per-visit `folded` map and the same one handler, so nothing new is
      stored and a fold behaves the same wherever she taps one. Two things not
      to undo: **no "Swipe these" beside it** — the survey is READ-BACK and its
      rows come from every pile at once, so there is no lane to walk; and the
      **count shows open AND shut**, unlike the chats app's pinned fold, because
      the rows underneath are her NOTES rather than the chats the count names.
    - **AND EVERY SECTION STARTS SHUT — THE PILES TOO (2026-09-03, Sophie:
      "collapse by default" · "they all default collapsed").** The piles view
      opens as its own TABLE OF CONTENTS — `Notes · 3` · `Unsure · 3` ·
      `Yes · 2` · `Maybe · 1` · `No · 1`, each with its own *Swipe these* —
      and she taps the one she came for instead of scrolling past the ones she
      did not. PHOTO'd at 390x844: the whole thing is five lines in the top
      third of the screen. **`shutPile(key)` is the one reader of that rule**,
      shared by the paint and the fold handler — the handler used to flip
      `folded[key]` by negating it, which on a key that is undefined-but-shut
      writes `true` and makes the FIRST tap on every section do nothing at
      all. `folded` still means only "what she has done to it this visit", so
      an open survives a re-render: tapping a row or a tile to read that card
      must not shut the section behind her. **Three tests reach for tiles and
      had to open a fold first** (`test-judge`, `test-judge-piles`,
      `test-judge-note-survey`) — a new one on this screen must too.
    Test: `node scripts/test-judge-note-survey.js` (the real page headless, at
    both looks — every assertion a MEASUREMENT, since a survey *below* the
    piles is still "present", a shut section is not in the DOM at all, and a
    folded thread and an open one carry the same markup; verified failing 15
    against the page before the survey and 23 against the open-by-default one).
  - **THE UNMARKED PILE LEADS THE PILES (2026-09-03, Sophie: "unsure at
    top" · "unswiped is first then yes maybe no").** `Unsure` on her decks,
    `Unsorted` on the house look, and it used to sit LAST — the one pile with
    something still to do in it, under everything she had already decided.
    Her order is the whole rule: unswiped, then Yes · Maybe · No. A legacy pile (`Later`, `Picked`) is
    appended at the END now: the old splice put it "before Unsorted, which
    stays last", which with Unsure leading would land it at the very top.
    `test-judge-piles.js` walked the FIRST pile with a hardcoded 30-step cap
    and that pile is the big one now — the cap is the deck's length.
  - **THE MINI AUTOSCROLL — conditional, small, on the side (Aug 2026,
    Sophie: "ideally you would add a conditional auto scroll thing, but only
    appears when the text is very long and is smaller than the normal one and
    just like on the side of the screen").** A deck carries no house pill —
    one card at a time never scrolls the PAGE — but a long card scrolls
    INSIDE itself, so this drives the card's own scroller: a 28px button on
    the right edge, shown only while the card in front of her actually
    overflows (measured, not guessed from a character count). Two things it
    had to learn: a NEW card starts stopped but the SAME card is left alone
    (the serif lands late and `fonts.ready` re-syncs, which killed a scroll a
    second after she started it), and the position is accumulated in JS —
    `scrollTop += 0.37` snaps to the same integer every frame and moved the
    card exactly 0px.
  - **THE GOOD / BAD STAMP LANDS AND LEAVES — IT IS NOT SOMETHING A CARD WEARS
    (Aug 2026, her own "Decision Deck v3" canvas: "a little good/bad stamp that
    stamps the ones that you pick or don't pick"; 2026-09-01: "the stamp shud
    only stay for a second and then leave").** Red rubber, tilted, slamming on
    the card she just decided — in at 2.5x and blurred, invisible until it is
    nearly down, an overshoot, then settled in 560ms — then ~1s on the paper
    and out over a 280ms fade. The ink is rough rather than printed: an
    feTurbulence displacement chews the edges and a mask of radial holes lifts
    the worn spots out of the middle; two filters and two hole patterns so the
    halves of a spread never stamp identically. Values are the artboard's
    (`docs/decision-deck/`).
    - **IT USED TO BE A STATE, AND THAT IS WHAT SHE RETIRED.** Every card
      carrying a yes/no was stamped on every paint, so a pile she came back to
      — her re-swipe, or a deck built out of her hearts — arrived with GOOD
      IDEA across every picture. `stamp:false` existed to escape exactly that
      and is still there, but it is no longer the answer: **the stamp is the
      ACT of deciding; where a card ENDED UP is what the piles are for.** So
      `paintStamp` returns unless the card is `stampNow` — nothing else is
      ever stamped, and a card revisited later wears none.
    - The fade is on the WRAPPER, not the mark, so it composes with whichever
      landing animation is still running underneath instead of fighting it for
      the same property. A re-render takes the node with it and the pending
      timer then finds nothing, which is why none of them is cancelled.
    - **The SPREAD is the case it is named for** — picking one of two pictures
      stamps GOOD on the winner and BAD on the other. A ♥ or ✕ anywhere else
      stamps the whole card.
    - **maybe / later / a deck's own words stamp NOTHING.** There is no good
      and no bad in "sort this one later", and a red mark there would invent a
      verdict she never gave.
    - **A deck with no browse mode waits out the animation before it
      advances**, so the card she is leaving is the one that wears the mark —
      otherwise the stamp is painted onto a card replaced in the same frame.
      Her decks are all `browse`, where a mark never moves the deck anyway.
    - It is `pointer-events:none` everywhere, so it can never take a tap off
      the ♥ underneath it — measured with `elementFromPoint`, the only honest
      way to ask. `stamp:false` turns it off; `goodWord` / `badWord` are hers
      to change, because her artboard made them fields.
    - Tests: `node scripts/test-judge-stamp.js` (it lands) and
      `node scripts/test-judge-piles.js` (it leaves, and an already-marked
      card arrives with none).
  - **THE TOUR AND THE HELP CARD HAVE TO SAY WHICH PACE THE DECK IS
    (2026-09-03).** Both lines were written for the LABORED deck and
    HARDCODED — *"that is the only thing that moves you"*, *"marking one never
    moves you on"* — and **quick became the default on 2026-09-03**, so every
    deck was teaching her the opposite of what its own buttons do, on the
    first open, before she has touched anything. They read `quick` now, in
    `tourSteps()` and in the help card, both of which already sit in that
    closure. **Found by PHOTOGRAPHING a real posted deck**: the tour is the
    first thing on screen and no test had ever read a word of it — a whole
    surface can be wrong for days while every assertion about the page passes.
    Test: `node scripts/test-judge-pace-copy.js` (the real tour stepped
    through at BOTH paces, asserting on MEANING rather than wording — each
    pace never claims the other's behaviour — so a reword is free; verified
    failing 3 pre-fix). One trap in the test itself, worth keeping: *"never
    moves you on"* CONTAINS *"moves you on"*, so the denials come out of the
    text before it asks whether anything promises the move.
  - **EACH PILE FOLDS AND RE-SWIPES ITSELF, AND THE PILES AUTOSCROLL
    (2026-09-01, Sophie: "right now the auto scroll doesn't work in piles" ·
    "add a good/bad/maybe button to each pile to re-swipe just those" · "also
    make the good bad maybe collapsible in piles" · "change the template not
    just this one").** Three asks on one screen, all in `judge.js`, so every
    template page ever posted has them the day it deploys.
    - **Swipe these** on a pile walks JUST that pile's cards in the card view,
      with her ✕ · ? · ♥ — the way a pile gets re-decided without going
      through the whole deck. It is a **LANE** (`lane` = the pile's ids) that
      every move reads through `laneStep`, never a filter on `items`: the
      piles, the counts and every id-keyed lookup still see the whole deck,
      which is what keeps this one rule rather than a second deck to keep in
      step. The lane ends when the card view does — running off the end,
      tapping Piles, or opening one card off the piles (`toPiles()` /
      `data-open` clear it), because a lane that outlived its screen would
      silently shorten the next walk.
    - **The fold is per pile and per VISIT**, in memory — it is how she is
      reading this screen right now, not a setting. The heading IS the fold
      (the whole name and count, not a caret to hit) and **Swipe these is a
      SIBLING of it**, never nested: a button in a button is invalid and the
      tap would fold the pile she was trying to re-open.
    - **The mini autoscroll now asks `.jg-piles` too** — and the pill she taps
      INSIDE THE APP is a different control that needed its own fix a day
      later (*AND IT NOW FOLLOWS WHATEVER IS ACTUALLY SCROLLING INSIDE THE
      FRAME* in the design rules); this half is the page's own little
      side-button. It only ever looked at the card selectors, so on the one screen in the deck that is genuinely
      long it hid itself. Whether a box really scrolls is read off the
      COMPUTED overflow, never assumed: content taller than a box that does
      not scroll reports the same `scrollHeight`, and driving one of those
      moves nothing. A deck that is not one of hers has no height cap on its
      piles, so there the fallback drives the WINDOW — card view is
      deliberately left out of that, since there the card is the answer.
    - Test: `node scripts/test-judge-piles.js` (the real page headless —
      every assertion a MEASUREMENT: the fold is its tiles gone from the
      layout, the autoscroll is `scrollTop` really moving, the lane is how
      many cards the pass actually steps through; verified failing 5 pre-fix).
  - **THE ✕ AND ♥ ARE DRAWN BY HAND (Aug 2026, Sophie, pointing at the ✕
    inside one of her own cards: "can you make this X that I gave as a
    screenshot, and make the heart actually kind of a handwriting look?").**
    They were the plain ✕/♥ CHARACTERS in the system sans — the only two
    geometric marks on a card that is otherwise all her serif and her cream.
    `MOM_X` / `MOM_HEART` in judge.js are filled outlines rather than strokes,
    which is what buys the weight through the middle and the chisel cap at
    each end; the heart is lopsided on purpose. **Not Lucide** — the house
    line icons are chrome, and this is inside her own design.
  - **Everything is DERIVED, nothing is filed**: the item lists are the pages'
    own frozen Storage JSON (cached forever per id — a new version is a new
    page), her progress is the verdict doc (`<chat>__page-<id>`), names come
    from the registry cache. No model call, no cost; the answer is held 60s.
  - **A PICTURE INSIDE A SPREAD HEARTS TO THE ASSETS TAB, NOT TO THE PAGE
    (found live 2026-08-22, Sophie on the witch reels: "the heart doesn't work
    in the review queue… per image. they're supposed to tie back in to the
    original chat likes so all likes are synchronized everywhere").** The
    card's ♥/✕ answers the SPREAD — that is what the `s:` key is for — so a
    per-picture heart cannot be the card's verdict. judge.js's lightbox cast
    used to compare the picture's id against the CURRENT CARD's, which for a
    spread's picture never match, so her tap **did nothing at all**: no light,
    no verdict, no vote, nothing written anywhere. It casts the ASSET vote now,
    exactly what the grid's tile does on an own-states page. That page is 47
    pictures in 8 labeled groups, i.e. every picture on it, and it had zero
    marks on file.
  - **AND THE DECK READS THE ASSETS TAB AT LOAD, which it never did** — the
    grid has since it shipped, so "the two surfaces agree in BOTH directions"
    was only ever half true. A ♥ she gave in the Assets tab now fills in a
    top-level card's verdict and lights a spread picture's own heart. Tests:
    `node scripts/test-judge-spread-heart.js` (the real page headless, verified
    failing against the pre-fix file, 6 of 15).
  - **A SPREAD VERDICT COUNTS AS PROGRESS (found live 2026-08-20).** Her ♥/✕
    on a whole spread and her "this one" pick land under the `s:` key, and the
    queue used to count only card ids — she reviewed the "Monkey + summit"
    grid (verdict doc: `s:monkeys-… → the winning card`) and the tile went on
    saying "10 to go", which she reported as "the heart button doesn't work".
    `pageSpreads` in review.js re-derives the `s:` keys EXACTLY the way
    page-views.js does (label slug, in order) — change one and the other or
    spread marks silently stop counting again; `node scripts/test-review.js`
    pins them against each other's shape.
  - **The 'later' rule**: on stock-states pages `'later'` counts as still
    waiting (it is literally "declined to sort now" — judge.js), shown apart
    ("4 of 28 · 2 later"). A page with its OWN states counts every one.
  - **A CHAT TAGGED `to be reviewed` WAS BRIEFLY A ROW HERE, AND IS NOT ANY
    MORE (Aug 2026 v2 — see the bullet above).** It was the one thing on the
    screen with nothing to swipe and no cards to count; the chat is reached
    from inside its own deck now. The label still takes a chat off her main
    list in the Chats app — that half is unchanged, and `REVIEW_LABEL` still
    lives in `chatfeed.js` for it.
  - **THE SAME PICTURES SPLIT ACROSS PAGES GET COMBINED — `scripts/combine-decks.js`
    (2026-09-02, Sophie: "combine dream factory pics").** A set cut in two
    batches, or posted into two chats so both could see it, shows here as
    several rows of one thing — the dream factory panels were **three rows, 69
    pictures, one of them an exact duplicate she would have had to swipe
    again**. The script unions the decks into one page, carries every verdict,
    note and place across, and SUPERSEDES the sources. Dry by default.
    - **AN ITEM'S ID IS ITS IDENTITY**, so the union dedupes by id and a mark
      follows its picture with nothing to re-map. Two pages carrying one id
      with DIFFERENT pictures is the one thing it refuses — a silent join
      there lands her verdict on the wrong picture forever.
    - **Later source wins a contested mark** (pass them oldest first), and a
      mark whose card is not in the combined deck is dropped AND NAMED.
    - **NOTHING IS DESTROYED** — the sources are superseded, keeping their own
      verdict docs, so undoing a wrong join is one
      `POST /page/:id/supersede {superseded:false}` per source.
    - Test: `node scripts/test-combine-decks.js` (the union rules, pure).
  - **Hand-built HTML pages are OUT by design** — their items live in markup,
    and a guessed total is a wrong number in front of her.
  - **Not every deck is a review** (the template demos, a browse deck): SKIP
    in the deck's piles view is hers — "not a review" — and stamps
    `reviewHidden` on the page doc. Hidden tiles keep a pile behind the DONE
    tab and un-hide with ↩; nothing is deleted. A superseded page is on no
    list.
  - The injected pill owns the top-right corner (x 326–374, y 14–192), which
    is exactly the first row's third tile — the reason the hidden pile's ↩
    sits over the face's top-LEFT, and the reason nothing tappable may go on
    the right of a row inside that band.
  - Tests: `node scripts/test-review.js` (the decision table, pure) and
    `node scripts/test-review-page.js` (the real page + the real injected
    pill, headless — tabs, the ✕/↩ POSTs, the pill palette).

### THE INSTAGRAM MOCKUPS

- **THE INSTAGRAM MOCKUPS** (page at `/instagram`, reached from the icon at the
  RIGHT of the Chats app's UPDATE tag row — Aug 2026, Sophie: "an icon button
  in the top right within the existing header space where the tags are, of my
  update tab … that leads to two tabs — two mockups of instagram"). Her
  accounts drawn as their profile grids, behind hairline tabs: **DREAM**
  (`you...my.dreams`), **WITCH** (`moonsickbaby`), **PWC** (`peoplewatchclub`,
  since 2026-08-24) and **XI** (`incaseofamnesia`, since 2026-08-26). **It
  costs nothing** — no model call, no job; it reads a committed JSON and one
  free API.
  - **A NEW ACCOUNT IS ONE ROW IN `public/instagram-grids.json` — nothing
    counts the tabs, in the page or in the test (2026-08-24, Sophie: "can you
    add another Hairline tab in my Instagram posting button on the update page
    for my People Watching Club").** The page has said that since it shipped
    and People Watching is the first time it was collected: the page, the
    renderer and `grid.js` needed no change at all. The TEST did — it had
    hardcoded "two hairline tabs" and "Dream · Witch", which is exactly the
    edit the claim exists to prevent, so every assertion is derived from the
    data file now and each account is swept generically (its tiles, its
    buttons, its post count, its handle).
  - **A TAB WORD MUST FIT ITS SHARE OF THE ROW, and that is measured.** The row
    divides 390pt minus the pill's reserved 64 between however many accounts
    there are, so each new one makes every tab narrower: at three, "People
    watching" wrapped to two lines, which pushes the WHOLE row from 26px to
    36px and leaves that one label reading over two lines beside its
    neighbours' one. The tab is **PWC**, her own shorthand for it (her deck
    titles say "PWC Instagram", "PWC memes"). Pinned with a Range over each
    label's own text — a width assertion cannot see a wrap.
  - **PWC HOLDS THE EIGHT REELS PLUS THE BINGO CARD (2026-08-26, Sophie: "pwc
    has none of the reels we made … add them in and make them link so they
    sync w the current version").** A full 3x3, newest first: the Training
    Film No. 001 (prefix `pwc-training-film/film-`, chat
    `account-three-ordering-reel` — currently v8), the Hands reel
    (`pwc/hands-reel/`, `middle-one-goes-first` — the go that chat was
    waiting for), ep006 (`pwc-reels/pwc-ep006-`, `people-watching-club-reel`
    — the chat's PIN is what keeps the 61MB `-master` upload, newest by
    timestamp under that prefix, off the tile), ep005 back to ep001
    (`pwc-reels/pwc-ep00N-`, all `stock-footage-backstories`, the
    ep001–ep005 builder), and her hearted bingo card last. Covers are derived
    640px webps at `pwc-reels/covers/` — poster frames pulled ~15% in from
    the reels themselves; the training film's is its own title card, the
    hands reel's its existing poster. **AND NO EMPTY TILE SAYS "NEXT" ANY
    MORE, on any account** (same message: "get rid of 'NEXT' placeholder
    text") — an empty slot is a bare dashed square in both renderers
    (`instagrid.js` and `grid.js`), and the `label` came off the empty rows
    in the JSON.
  - **The handle and bio are a PLACEHOLDER she has not confirmed** — nothing in
    the feed or the repo records the real PWC Instagram handle, so the mockup
    reads `peoplewatchclub` / "like a ghost among the living, silently
    witnessing." Same for XI (`incaseofamnesia`). Swap them the moment she says
    what they are; they are two strings in the JSON.
  - **XI HOLDS THE TWO MEMORY LIBRARY ADS, ONE CUT EACH (2026-08-26, Sophie:
    "fill it with any reels we made for XI I think there's a couple versions of
    some so just pick one version").** Xi / Memory Library / incaseofamnesia.com
    is one app under three names, so its reels are the two the commercial series
    shot for it: **skipsmalltalk** (the infomercial date, 0:31,
    `fictional-pill-commercial`) and **the couple fight** (0:25,
    `commercial-production-series`). The fight exists as TWO takes — a warm cut
    and a spiky cut of the identical ad — and the grid carries the WARM one,
    because that is the cut the chat pinned as its deliverable and `/newest`
    resolves that prefix from the pin. The spiky cut is not lost: it is one row
    away in `manifest-reel-memoryfight-spiky.json`.
  - **THE STREET-INTERVIEW AD WAS NEVER SHOT** — it is greenlit and waiting on
    her pick between two questions (`fictional-pill-commercial`, 2026-08-16). So
    two real tiles is the honest state of the account, not a gap to fill; the
    tile appears the day the film lands, as one row in the JSON.
  - **THE COVERS ARE DERIVED COPIES, never the raw stills** — `GET
    /api/story/thumb?w=640&url=<still>` bakes a webp into `thumbs/` and answers
    a 302 to its permanent public url, which is what the JSON carries (33-41KB,
    against 2.2MB for the PNG behind it). The house webp rule with no new
    tooling: the originals in `commercials/reels/<slug>/stills/` are untouched.
  - **THE DREAM GRID IS THE ONE THE dream-app-commercial CHAT ALREADY MADE, not
    a copy of it** (her ask: "reuse it exactly, it plays the films"). The phone,
    the 3:4 crop, the tiles that play and the current-cut refresh live in
    `public/instagrid.js`, a faithful lift of `scripts/dream-commercials/grid.js`
    — and **both readers now take their tiles from `public/instagram-grids.json`**.
    That is the load-bearing half: a posted Compare page is FROZEN the day it is
    posted while this page is not, so two hand-kept tile lists would drift into
    two different mockups of one account. `grid.js`'s output was diffed
    byte-for-byte across the change, and a test compares the two as objects.
  - **A TILE PLAYS ITS CURRENT CUT.** The url in the data is only the fallback:
    every tile names its film's Storage `prefix` and the `chat` that makes it,
    and the page asks `GET /api/chatfeed/newest` on every open — so a re-cut in
    another chat reaches both grids with nothing re-posted. A tile with no film
    opens its still instead, so **no tile is a dead control**, and a note left
    on a playing film lands in the chat that can act on it (`filmnote.js`).
  - **THE WITCH GRID HOLDS ONE THING — moon milk — and that is measured, not a
    placeholder.** Her only witch film: swept Storage and the whole feed (Aug
    2026) and there is no moon milk VIDEO in the bucket at all — the story is
    12 beats with no voice, and `moon-milk-meta`'s own note reads "to do:
    download moon milk videos (or remake)", i.e. the real cuts are on her
    phone. So the tile carries the one real still there is
    (`survey/covers/moon-milk.webp`) and says **"no film here yet"** rather
    than a duration that belongs to nothing. Its `prefix` is `moon-milk/`: drop
    a film there and the tile starts playing it by itself.
    **Three finished Secretly a Witch shorts DO exist** and are deliberately
    NOT on the grid (`witch-shorts/believing-the-worst`, `…/rules-review-room`,
    `…/combined/tolle-combined`, newest cuts v7/v7/v6) — she said only moon
    milk, and they are lesson films rather than reels. Adding one is a row in
    the JSON.
  - **THE ICON COSTS THE UPDATE ROW A LINE, and that was the cheaper half.**
    The true top-right corner (x 324-374, y 14-192) belongs to the injected
    pill, so the button is a right FLOAT placed after `#pillnotch` — the
    rightmost place the row actually has. Measured at 390pt: the row runs
    glass(34+8) · "Come back to"(117+6) · "In a minute"(97+6) with 64 reserved,
    leaving 25px, and shrinking the button to 26 and then 24 still wrapped the
    second box (a chip's own 6px right margin counts against the line). Nothing
    ≥20px fits, so the wrap was coming either way and it keeps a full-size tap
    target. UPDATE row 40px → 72px, that screen only.
  - Test: `node scripts/test-instagram-grids.js` (the one-data-source rule
    pure, then both real pages headless — every account's grid swept, the tabs'
    measured underline, no tab word wrapping, a tile playing, the still
    fallback, the pill's palette and corner, and the icon asked with
    `elementFromPoint` at its own centre, which is the only honest way to ask
    whether the pill is sitting on it).

### Push notifications

- **Push notifications** (`push.js`, `/api/push`) — real APNs lock-screen
  notifications, raw HTTP/2 straight to Apple, no Firebase Messaging. Sent on a
  **finished reply** (never a draft) and on a new Compare page. They were the
  Update tab's **doorbell, not its replacement** — that tab is gone
  (2026-09-14) and a dropped push is still never lost news: the chat's own row
  says it answered. A tap opens THE CHAT IT CAME FROM.
  **THE BANNER SHOWS WITH THE APP OPEN TOO, SILENTLY (Aug 2026, Sophie:
  "notifications that come down into the app and appear at the top of the
  screen while I'm in the app").** `willPresent` returned `[]` until then — the
  app suppressed every foregrounded notification on the reasoning that the
  Update tab IS the notification. That is true only on the Chats screen: from
  the Playground or the Story Room a chat answering her said nothing at all,
  and the rose "New message" bar on `/chats` names neither the chat nor what it
  said. It is `[.banner, .list]` and deliberately NOT `.sound` — the buzz is
  what carries a lock-screen push across the room, and in her hand the banner
  has already done that. Do not "fix" this back to `[]`.
  **THE BELL IS ON BY DEFAULT — she taps it to turn a chat OFF (`chatNotifies`
  in `push-gate.js`, 2026-09-01, Sophie: "change to readily notify on for
  chats").** One field, `notify`, on the chat's registry doc beside
  `starred`/`bookmarked`, flipped by the bell in a chat's thread header and in
  its Organize sheet (`POST /api/chatfeed/notify {chat, notify}`). **Absent
  means ON**, and only an explicit `notify:false` of hers silences a chat — so
  the reader compares `notify === false` rather than truthiness, and the write
  goes the other way round from every other mark: OFF is stored, ON deletes
  the field. It is asked BEFORE the timing gate below and in front of BOTH
  doors (a finished reply and a new Compare page).
  - **IT SHIPPED AS A WHITELIST AND THAT IS HISTORY, NOT A RULE** (Aug 2026,
    "only the ones I clicked the bell on will notify me" — read literally,
    absent meant silent). What it cost is the same measurement the self-belling
    rule is built on: **48 chats set a `need` in two days and 6 of them were
    belled**, i.e. 42 asks she could only find by opening the app. A chat she
    has never thought about was silent forever, and those are exactly the ones
    worth hearing from. Don't put the whitelist back without her.
  - **THE TIMING GATE IS WHAT KEEPS THIS QUIET, not the bell.** A push still
    needs her to have spoken since the last one AND the reply to post-date her
    message, so a chat grinding on its own cannot ring however many are
    unsilenced. Default-on means "the chats I talk to answer me on my lock
    screen", never "260 chats buzz".
  - **THE QUICK-QUESTION SELF-BELL IS NOW A NO-OP** (2026-08-27, "a 'quick
    question' chat shud set its own bell as true") — a quick-question chat is
    already on, so there is nothing to set. Harmless if a chat still POSTs it.
    **A chat still never turns a bell OFF; that stays hers alone.**
  **A REPLY ONLY BUZZES WHEN IT IS ANSWERING HER (`push-gate.js`, Aug 2026,
  Sophie: "I don't need a notification when I send a message. I need a
  notification when they respond to my message").** Two comparisons against
  fields already on the registry: she must have spoken since the last push
  (`lastHerAt > pushedAt`, stamped by `POST /reply` with her REAL send time),
  and the reply must have been written after she spoke (`created >=
  lastHerAt`) — a reply whose text predates her message cannot answer it. That
  kills the three shapes that buzzed her at the wrong moment: a **catch-up
  post** (the hook's final pass runs on UserPromptSubmit, so a reply Stop
  failed to post lands the instant she hits send), a **queued message** (the
  turn already running finishes seconds after she sends), and a **chat
  grinding on its own**. **The per-chat 10-minute debounce is GONE for
  replies** — it swallowed the answer to a follow-up she sent four minutes
  later; her message is the gate now. A chat that has never lifted one of her
  messages keeps the old behaviour rather than going quiet.
  **A CHAT BELLS ITSELF WHEN IT IS BLOCKED ON HER (2026-08-28, Sophie: "can u
  make chats bell themselves based on importance").** Written while the bell
  was a whitelist — its 48-asks-to-6-bells measurement is the same one that
  later retired the whitelist outright — and it still earns its keep: a finished
  reply whose `need` is NEW buzzes her **whatever the bell says**, so it reaches
  a chat she has deliberately SILENCED as well. That is the one case where the
  CHAT, not she, knows something matters: it has stopped and is waiting on her
  (`needEscalates` in `push-gate.js`).
  - **IT IS NOT A FLIP OF HER BELL.** A self-set bell sticks (only she turns
    one off), so a chat she silenced would be un-silenced forever by one
    important moment. **Importance is a property of the MOMENT, not of the
    chat** — this escalates ONE reply and changes no stored flag of hers.
    Making it sticky is hers to ask for.
  - **IT IS NOT "a need exists".** A chat re-states its need at the end of
    every turn, so that would buzz her on a loop for one ask. `POST /status`
    stamps **`needSetAt` only when the text CHANGED** (read off the doc, not
    the registry cache — the route runs once a turn, and a stale read would
    either drop a real ask or repeat one), and the reply compares it against
    `needPushedAt`: one buzz per distinct ask.
  - **It skips the answers-her test on purpose** — a chat that hit a blocker
    working on its own is exactly the case that test exists to silence, and
    exactly the case she wants to hear about. Clearing the need (`need:""`)
    deletes the stamp, so a withdrawn ask can never ring later.
  **AND THE BANNER SAYS WHICH CHAT AND WHAT KIND (2026-08-28, Sophie: "and
  notification more informative").** It used to be the chat's name over the
  reply's TLDR, and on a deliverable the words "New deliverable" over a title
  with the chat trailing after an em dash — so the one fact she needs first
  (WHICH chat) moved depending on which door rang, and nothing said what kind
  of arrival it was. One shape now, `pushAlert` in `push-gate.js`: **the CHAT
  is always the title**, and the body leads with the kind — `New film · Evan
  v18 (4:23)` · `New page · Sheet v2` — with an answer still leading on its
  TLDR. **AN ASK CARRIES NO LABEL AT ALL** (2026-08-28, her correction the same
  hour: "they also need you that's redundant. None of them need to say that"):
  a `need` line is already a sentence asking her for something, in the chat's
  own words, so `Needs you ·` in front of it said nothing the sentence had not
  said and spent the banner's first words — the ones a lock screen shows. **The ask WINS the banner** when a reply
  carries one: a chat that just asked her something is not better described by
  its own summary. The 2026-08-15 rule survives inside it — a reply opening
  with her own question in bold never comes back as the banner.
  **THE BUZZ WAITS FOR THE TURN TO END (2026-08-28, Sophie: "I get notified on
  my phone a few seconds before chats actually finish their turn").** The
  FINISHED-REPLY door was always honest — it fires from the hook's Stop pass.
  **The other three doors are filed MID-TURN and used to push the instant they
  were filed:** a media pin recording a DELIVERABLE (the checklist has a chat
  pin its film before its cards and its reply), a new Compare page
  (`POST /page`), and an auto-compare grid the server files when a prompt or
  caption lands. Measured against her real deliverables that day, the gap from
  the filing to that chat's finished reply: **19s, 23s, 42s, 58s, 103s** — her
  "a few seconds", exactly. Those doors call `push.queueChat` now and the
  finished reply calls `push.flushChat`, so the doorbell rings when the turn
  really ends. Three rules not to undo: **a reply push SWALLOWS the held one**
  (same chat, same second, same collapse-id — the reply's TLDR is the better
  banner, and an UNBELLED chat still gets its deliverable buzz because no reply
  push fires there to swallow it, which is the deliverables list's whole ask);
  **one entry per chat, newest news wins, and re-queueing never moves the
  DEADLINE** (or a chat filing every few minutes pushes its own doorbell out
  forever); and **a 15-minute fallback timer**, because a hookless session, a
  chat killed mid-turn or a script filing a film never posts a finished reply
  and a doorbell that waits forever never rings. A deploy drops a held buzz,
  which is fine — the deliverables list and the chat's own row are the
  catch-all.
  Test: `node scripts/test-push-pending.js`.
  **THE BODY IS NEVER HER OWN WORDS (`pushBody`, found live 2026-08-15 from
  her screenshot — this, not the timing, is what she was actually reporting).**
  Two house rules collided: *Answering a question* at the time REQUIRED a
  reply to open with her question repeated verbatim in bold on its own line
  (that blanket rule was retired the same day, and since 2026-08-23 the echo is
  back for the questions SHE marks with the word "question" — so this skip
  matters MORE now, not less), and the push body was
  `tldr || the reply's first non-empty line` — so every answer buzzed her with
  her own sentence, asterisks and all. Leading **entirely bold** lines are now
  skipped (that is exactly the shape the answering rule produces; `**TLDR** —
  …` has ordinary text after the bold and is kept), and the body is stripped
  of markdown. Deliberately structural, not stored: comparing against her
  message would mean carrying hundreds of characters of every chat's newest
  message on the registry doc, which rides the feed read to her phone 276
  chats at a time.
  Tests: `node scripts/test-push-gate.js`, `node scripts/test-chats-bell.js`.
  **LIVE since Aug 2026 (measured 2026-08-27: `GET /api/push/status` answers
  `configured:true, devices:1`)** — the APNs key is in Render's secret files.
  This line used to say "dormant until the key exists"; that is history.
  **A DEPLOY BUZZES HER PHONE, START AND END (2026-09-13, Sophie: "can i get a
  notification when deploy starts and ends so i know when to stop making clips
  and start again").** A deploy swaps the instance out and a footage SEND in
  flight is a request the old instance dies holding, so the minute around a
  deploy is the one minute not to tap the star. Both moments were already known
  exactly and neither is a guess:
  - **START is the deploy guard's LAST word, not its first.** `deploy-guard.js`
    (Render's pre-deploy command) holds until nothing is drawing, pauses new
    draws, reads once more, and only then lets the swap through — so it
    re-affirms its pause carrying `deploy:true`, and `POST /api/promptlab/pause`
    calls `push.notifyDeploy('start')` on that flag alone. A guard still
    holding, one that lifted its pause because a draw snuck in, or one that
    gives up at the cap never gets there, so a held deploy never buzzes her.
  - **DONE is the new instance BOOTING** — nothing else knows the swap
    finished, and a boot is exactly "you can send again".
  - **THE MARKER IS WHAT KEEPS A CRASH RESTART QUIET.** `push.notifyDeploy
    ('start')` writes `startedAt` on one doc; `push.deployBootCheck()` pushes
    "back up" only if that mark exists and is under 30 minutes old, and clears
    it on the way past — so an OOM kill or a Render recycle at 3am says
    nothing, one deploy is one pair, and a mark nobody consumed goes stale
    instead of buzzing her a week later. Gated on `RENDER_EXTERNAL_URL`, or a
    dev container booting server.js eats her notification.
  - **AND A `__`-PREFIXED DOC IS NEVER PUSHED TO — found in the LIVE log the
    hour this shipped (2026-09-14).** The mark lives in the DEVICES collection,
    so `sendAll` pushed to it, Apple refused it (`BadDeviceToken`), and the
    mark was **deleted as a dead token by the very "start" push that had just
    written it** — the "back up" buzz on the next boot then found nothing. It
    did it SILENTLY, because removing a dead token is exactly what that code is
    for, and it fired on one deploy and not the next (the race between the two
    writes). `loadDevices` skips a `__`-prefixed id and anything carrying no
    real token; the undeployed-count mark lives in the same doc and had the
    same hole.
  - **IT NAMES NO CHAT, deliberately** — `PushDelegate` opens the chat a push
    names and there is no chat here; with none it lands on the chat list (the
    Update tab until 2026-09-14), which is the right room and needs no
    TestFlight build. It carries its own
    `thread` instead (a new `sendAll` case), so "Back up" replaces "Server
    update starting" in her shade rather than stacking.
  - Tests: `node scripts/test-deploy-notify.js` (the marker's whole decision
    table against a fake Firestore — the half that can silently be wrong — plus
    the wirings by source) and `node scripts/test-deploy-guard.js` (that only
    the FINAL pause carries the flag, and that a refused or called-off deploy
    carries none).
  **AND THE DEPLOY WAITS FOR A FOOTAGE SEND, AND FOR EVERYTHING ELSE —
  `inflight.js`, ONE REGISTER (2026-09-14, Sophie: "make sure the deploy guard
  waits for footage sends and anything else that would cause a problem").**
  `/inflight` answered `drawingNow`/`cuttingNow` and nothing else — the
  Playground's own two sets — so the guard, the hand deploy and the SIGTERM
  hold all said "nothing drawing or cutting" over a box that was in the middle
  of a **footage send**: the one piece of work here that is CHARGED AT THE DOOR
  BEFORE ANYTHING IS WRITTEN DOWN, so a restart inside it loses her prompt, her
  references and the money at once. Now work registers itself
  (`inflight.track('name', fn)`) and the three readers ask that one register,
  which `GET /api/promptlab/inflight` reports as `work` beside the two arrays.
  Six things not to undo:
  - **A SEND IN THE SWAP WINDOW IS REFUSED, NOT DRAWN.** The guard pauses the
    box once it has decided to let the swap through, and the old instance dies
    about a minute later. The Playground QUEUES a tap; a video job has no queue
    to stand in, so `POST /api/footage/jobs` answers 503 `refusal:'paused'`
    saying **nothing was sent or charged, tap again in about a minute** — this
    page's OWN words, never the Playground's note, which promises the tap
    "will draw on its own" and would be a message promising a clip that never
    comes. **It only ever reaches the OLD instance** — the new one boots with
    no pause at all — so the wait is seconds.
  - **THE COUNT IS IN MEMORY AND PER PROCESS, deliberately.** The question both
    readers ask is *would killing THIS process lose something*, which is a fact
    about this process. A doc saying `running` may belong to an instance that
    is already gone — that is what every module's own stale sweep is for — and
    reading those back would hold a deploy for a job nobody is holding.
  - **`track` CAN NEVER FAIL THE WORK IT WRAPS**: it returns exactly what the
    function returns, rethrows exactly what it throws, and decrements in a
    `finally`, so a throw cannot leave a phantom holding the deploy for ever.
  - **AN OLDER SERVER ANSWERING NO `work` READS AS CLEAR.** A box that cannot
    say is not a reason to hold a deploy — the guard's own long-standing rule.
  - **WHAT IS REGISTERED:** a footage SEND (`footage-send`) and its trim /
    frame-grab / poster bakes (`footage-bake`); every ffmpeg render — the Film
    Editor, Stitch, Assembly and the Story Room pad's film (`render`); the
    Movies pipeline's two job runners (`movies`); a Voice Studio render or
    conversion (`voice`, already billed at ElevenLabs by the time it writes
    back); and the chat-icons sweep (`icons`, ~6c a sheet). **A new kind of
    work is ONE line where it starts**, never a counter threaded through
    server.js.
  - The cap is unchanged: still 25 minutes, and still a FAILED deploy rather
    than a killed job — nothing ships, nothing dies, the next merge carries it.
  Test: `node scripts/test-inflight.js` (the register measured, a throw proved
  to leave nothing, the guard proved to really HOLD on a send alone, and every
  wiring pinned; verified failing 5 against the pre-fix guard).
  **AND SHE IS TOLD WHEN FIVE CHANGES ARE WAITING (2026-09-14, Sophie: "I
  would like a notification when there are five changes undeployed").** A merge
  no longer deploys by itself — the house rule is merge with `[skip render]`,
  then ask — so main runs ahead of the live box for hours and the only way to
  know by how much was to go and count. **It is DERIVED, not filed**: Render
  stamps every instance with the commit it was built from
  (`RENDER_GIT_COMMIT`) and GitHub's compare API says how many commits main
  carries on top of it, so nothing has to be recorded when a PR merges and a
  chat that forgets to file something cannot make the number wrong. Hourly, one
  free unauthenticated GitHub read, no model call, skipped entirely off Render.
  Three things not to undo: **one buzz per RUNG, never one per tick** — it
  fires at five, then again at ten and fifteen, because a number that keeps
  climbing is worth hearing again and the same number every hour is not; **the
  rung is marked BEFORE the push is sent** (a push that lands with no mark
  buzzes her every hour, which is the one failure this exists to avoid); and
  **a deploy resets it by construction** — the mark is keyed by the commit, so
  the new instance finds a mark that is not its own and starts at zero.
  `behindPlan` / `readBehind` / `behindCheck` in `push.js`; test
  `node scripts/test-behind-push.js` (the rule pure, then the whole check
  against a fake Firestore — the mark is the half that can silently be wrong).
  **THE HOME-SCREEN WIDGET IS FOUR DECKS TO SWIPE (2026-09-02, Sophie: "the
  widget / make it 4 icons / decks to swipe / currently / the dream factory
  deck / the wallpapers")** — the top four decks still waiting in the Review
  Queue, as pictures, each a tap into that deck's cards
  (`deckfactory://review?deck=<page id>`). It reads
  `GET /api/review/widget?limit=4` — the SAME waiting rows the `/review` page
  draws, in the same order, off the same 60s cache, so the two can never
  disagree — and must NEVER pull the real feed. **The face is a ladder** (the
  deck's own first picture → the CHAT'S icon → its first card's words) and
  **every face rides the derived thumb service**: a deck's first picture is
  routinely a 1-3MB lossless webp and a widget process is killed for less.
  **The widget KIND is unchanged on purpose** — iOS remembers a placed widget
  by it. It used to be the Update count; that is history, not a rule.
  **Full details: `docs/modules/inbox-and-misc.md`.**


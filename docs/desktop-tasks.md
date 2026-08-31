# DESKTOP TASKS — the queue for when Sophie is at her computer

**Sophie is almost never at her desktop.** She works from her phone, so anything
that can only run on her Mac does NOT get asked for the moment it comes up — it
gets **written down here** and waits for the next time she sits at the computer.
Then she says one thing to the terminal chat and the whole queue runs.

**This file is the ONE list**, for every chat in every repo. Her Mac checkout is
`~/imageforge`, so the list is already on the machine that has to run it.

**On a phone it reads at https://imageforge-q125.onrender.com/desktop** — the
same file, rendered: what is waiting, what has been checked off, and what any of
them needs from her. Read-only; the queue is edited here, where it is run.

---

## HER ONE COMMAND (what she says at the computer)

> "Open `docs/desktop-tasks.md` and run the queue."

## FOR THE TERMINAL CHAT ON HER MAC

1. `cd ~/imageforge && git checkout main && git pull origin main` — the queue
   only exists on `main`, and the checkout parks on feature branches
   (see `docs/modules/nde.md`, the `git checkout main` note).
2. Work **OPEN** top to bottom. Each task is self-contained: it says why, where,
   the exact commands, and what it needs from her.
3. **Ask her before anything that spends money or is hard to undo** — the queue
   is a list of what to do, not standing permission.
4. As each one finishes, move its whole block to **DONE** with the date. Nothing
   is deleted — she reads this later to remember what ran.
5. Commit and push the updated file when the queue is worked, so the cloud chats
   see what landed.
6. Anything that FAILED goes back under OPEN with a note about how it failed —
   never silently dropped.

## FOR A CLOUD CHAT ADDING ONE

- **Append to OPEN, at the bottom.** Copy the template below and fill every
  field. A task another chat can't run without asking questions isn't queued.
- **The commands must be exact and copy-pasteable**, with the `cd` in them.
  Nobody reconstructs them months later.
- **No secrets, tokens or her uid** — this repo is public.
- Commit + push it the same turn you thought of it, and say in your reply that
  you queued it (one line — she should know the pile grew, not have to ask).
- **Not in this repo?** Attach imageforge with `add_repo` and append here. If you
  genuinely can't, put the finished task block verbatim in your reply and say it
  still needs queueing.
- **Truly urgent** — she's blocked without it, or it expires — is the one thing
  that interrupts: say so plainly in the reply AND queue it here anyway, so it
  doesn't get lost if she isn't near the computer.

### Template

```
### <short title>
- **Why:** one line — what this unblocks
- **Where:** ~/imageforge  (or the repo / folder it runs in)
- **Run:**
  ```bash
  cd ~/imageforge && <the exact command>
  ```
- **Needs from her:** what she has to do or paste — or "nothing, it just runs"
- **Queued:** YYYY-MM-DD by <chat slug>
```

---

## OPEN

### Give `node` Full Disk Access so the scheduled push can read Voice Memos
- **Why:** the auto-push agent is installed and running on schedule, but every
  run comes back empty-handed. macOS does not let a launchd job inherit
  Terminal's Full Disk Access, so the job can *see* `CloudRecordings.db` and
  copy it, but the copy it gets is **0 bytes** — which surfaces as the
  confusing `no such table: ZCLOUDRECORDING` rather than the "No Voice Memos
  database" line the installer watches for. Nothing is wrong with the push
  itself: run by hand from Terminal it reads the database fine and finds 138
  recordings waiting. This one click is the only thing between the archive and
  a push that runs by itself.
- **Where:** System Settings, then a terminal
- **Run:** (the click first — there is no command for this part)
  1. System Settings → Privacy & Security → **Full Disk Access**
  2. Click **+**, press **Cmd-Shift-G**, paste this exact path and add it:
     `/Users/sageryza/.nvm/versions/node/v24.7.0/bin/node`
  3. Then re-run the installer so the agent picks it up:
  ```bash
  curl -fsSL https://imageforge-q125.onrender.com/install-memo-autopush.sh -o /tmp/install-memo-autopush.sh && bash /tmp/install-memo-autopush.sh
  ```
  It prints the log at the end — a good run says `Sending N recording(s)`
  instead of an error.
- **Heads up, this path has a version number in it.** It is nvm's node, so
  upgrading node moves the binary and the agent quietly stops working *and*
  loses its Full Disk Access grant. If the daily push ever goes silent, this is
  the first thing to check: `command -v node`, and re-run the installer.
- **Needs from her:** the one click above; everything else is a paste.
- **Queued:** 2026-08-19 by terminal chat (desktop queue run)

### Decide what to do about four junk transcripts
- **Why:** the first local-transcription run had no hallucination filter yet,
  and Whisper's silence filler got banked on four near-silent recordings. They
  are wrong, they are indexed by Search, and **nothing in the API can clear
  them** — `POST /api/memos/transcript` is fill-only and there is no route that
  unsets a transcript. The filter that would have caught all four is in place
  now, so this is a one-time cleanup, not an ongoing leak.
  - `2021-02-01_1626_2021-02-02T00_26_28Z` (9s) — `*gunshot*`
  - `2021-11-09_0208_2021-11-09T10_08_45Z` (16s) — `Thank you.`
  - `2024-02-15_0551_2024-02-15T13_51_43Z` (5s) — `Thank you.`
  - `2025-10-20_1744_2025-10-21T00_44_23Z` (71s) — `*crickets* *crickets*`
- **Where:** ~/imageforge (a server change, so it needs a deploy)
- **Run:** nothing yet — this is a decision, not a command. The options are
  (a) leave them: four wrong rows in 1,235, all on recordings that are close to
  silent anyway; (b) add a narrow `POST /api/memos/transcript/clear {id}` that
  unsets `transcript`/`transcriptFrom` and puts the record back in
  `/untranscribed`, then re-run `scripts/transcribe-local.mjs`, which will now
  skip all four correctly.
- **Needs from her:** which of (a) or (b).
- **Queued:** 2026-08-19 by terminal chat (desktop queue run)

### Upload the group dream journal's VERSION HISTORY screenshots

- **Why:** the `dream-journal-version-history` cloud chat is working from the
  version history of Sophie's real group dream journal and can see nothing —
  the screenshots live only on the Mac (her logged-in browser / her Desktop),
  and its Assets tab is empty. Uploading them is the whole unblock.
- **Where:** ~/imageforge
- **Run:**
  ```bash
  # 1. Find them. Adjust FOLDER if she saved them somewhere else.
  cd ~/imageforge && ls -lt ~/Desktop ~/Downloads 2>/dev/null | grep -iE '\.(png|jpg|jpeg)$' | head -40
  ```
  ```bash
  # 2. Upload every screenshot and file it into the chat's Assets tab.
  #    Set FOLDER and GLOB to whatever step 1 showed.
  cd ~/imageforge && FOLDER=~/Desktop GLOB='*.png' CHAT=dream-journal-version-history \
  B=https://imageforge-q125.onrender.com bash -c '
    i=0
    for f in "$FOLDER"/$GLOB; do
      [ -f "$f" ] || continue
      i=$((i+1))
      n=$(basename "$f")
      url=$(curl -s -X POST --data-binary @"$f" -H "Content-Type: image/png" \
        "$B/api/drop/upload-file?bundle=Dream%20journal%20version%20history&filename=$n" \
        | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{console.log(JSON.parse(s).item.url)}catch(e){console.log(\"\")}})")
      [ -z "$url" ] && { echo "FAILED upload: $n"; continue; }
      curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"assetsOnly\":true,\"chat\":\"$CHAT\",\"url\":\"$url\",\"description\":\"Group dream journal version history — screenshot $i ($n)\"}" \
        "$B/api/gallery" >/dev/null
      echo "filed $i: $n"
    done'
  ```
  ```bash
  # 3. Check it landed (should print a count and the labels).
  curl -s "https://imageforge-q125.onrender.com/api/gallery/assets?chat=dream-journal-version-history&limit=100" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.total+" filed");(j.assets||[]).forEach(a=>console.log("-",a.description||"(no label)"))})'
  ```
  Label them better than "screenshot 1" if the order or the date range is
  visible in the shot — the label is what Sophie reviews by, and it is what the
  cloud chat reads to know which page of the history it is looking at. Re-POST
  the same `assetsOnly` call with a new `description` to fix one in place.
- **Needs from her:** where the screenshots are, if they are not on the Desktop
  or in Downloads. **If she has not taken them yet**, they come out of the
  journal document's own version history in her logged-in browser (File →
  Version history → See version history, if it is a Google Doc) — a cloud
  session can never reach that, which is why this is here.
- **Queued:** 2026-08-20 by dream-journal-version-history

---

### Let `ASC review status` be asked about any app (needs a `workflow` scope push)

- **Why:** `ci/asc_review_status.py` is the one tool that prints an app's
  App Store version states AND its review-submission state, but
  `.github/workflows/asc-status.yml` hardcodes `APP_BUNDLE_ID:
  com.sageryza.xi`, so it can only ever be asked about XI. Checking Secretly a
  Witch's review state today meant going the long way round through the ASC
  metadata dry run, which never shows the submission itself. A cloud session
  CANNOT do this: GitHub refuses any push or API write that touches
  `.github/workflows/**` without the `workflow` OAuth scope, which the session
  token does not carry (tried both, both 403).
- **Where:** ~/memory-library-react (clone it if it is not there)
- **Run:**
  ```bash
  cd ~/memory-library-react && git checkout main && git pull origin main \
    && git checkout -b claude/asc-status-bundle-input
  # in .github/workflows/asc-status.yml, under `on: workflow_dispatch:` add:
  #     inputs:
  #       bundle:
  #         description: Bundle id (e.g. com.sageryza.secretlyawitch)
  #         required: false
  #         default: com.sageryza.xi
  # and change the env line to:
  #     APP_BUNDLE_ID: ${{ inputs.bundle }}
  git commit -am "ASC review status: take the bundle id as an input" \
    && git push -u origin claude/asc-status-bundle-input
  ```
  The default stays `com.sageryza.xi`, so a run that passes nothing is
  unchanged.
- **Needs from her:** nothing beyond running it from her Mac, where the git
  credential has `workflow` scope.
- **Queued:** 2026-08-22 by secretly-witch-review-status

---

### Turn on the automatic derived-files check (1 minute, `workflow` scope push)

- **Why:** the dagster-pipeline-tool chat built a checker that catches
  forgot-to-rebuild generated pages (`scripts/check-derived.js`, works by hand
  today), but the GitHub workflow that would run it automatically needs one
  file moved into `.github/workflows/` — chat sessions' GitHub tokens are
  barred from that folder, her own account is not. The task was originally
  filed in `what-sage-should-do-at-her-computer.md`, a file nothing reads —
  moved here 2026-08-26 so the queue actually sees it. Same credential and
  same sitting as the ASC task above.
- **Run:**

  ```
  cd ~/imageforge
  git checkout main && git pull origin main
  git mv scripts/check-derived.workflow.yml .github/workflows/check-derived.yml
  git commit -m "Turn on the derived-files check"
  git push origin main
  ```

  If the repo has uncommitted changes or sits on another chat's branch, stop
  and report instead of switching or discarding anything.
- **Done when** this link works:
  https://github.com/sageryza/imageforge/blob/main/.github/workflows/check-derived.yml
- **Needs from her:** nothing beyond running it from her Mac.
- **Queued:** 2026-08-26 by arcade-archive-candidates (originally 2026-08-12 by
  dagster-pipeline-tool)

### Download Wilco — "Was I In Your Dreams" (cloud grab came back blocked)
- **Why:** the `/api/ytdl/grab` for this song hit YouTube's sign-in bot-wall
  on Render's IP (`blocked:true`, 2026-08-26 evening) after several grabs in
  a row. The block is intermittent, so TRY THE CLOUD FIRST — this task only
  needs running if that still fails.
- **Where:** ~/imageforge
- **Run:**
  ```bash
  cd ~/imageforge && curl -sS -X POST "https://imageforge-q125.onrender.com/api/ytdl/grab" -H 'Content-Type: application/json' -d '{"url":"https://www.youtube.com/watch?v=Z-Bp3e52eTY","kind":"audio"}'
  sleep 20 && curl -sS "https://imageforge-q125.onrender.com/api/ytdl/c05503f49b9f4378a10a/job"
  ```
  If that answer says `"blocked":true` again, download it locally instead
  (a home IP is never bot-walled):
  ```bash
  brew list yt-dlp >/dev/null 2>&1 || brew install yt-dlp
  yt-dlp -f "ba[ext=m4a]/ba" -o "$HOME/Downloads/wilco-was-i-in-your-dreams.%(ext)s" "https://www.youtube.com/watch?v=Z-Bp3e52eTY"
  ```
  The file lands in Downloads; report the path. Do NOT upload it into the
  audio library — it's music, and that library transcribes everything into
  her searchable voice-memo archive.
- **Needs from her:** nothing, it just runs.
- **Queued:** 2026-08-26 by youtube-download-endpoint

---

### Grab the newest Anthony Chene interview (YouTube is asking for a login)
- **Why:** "Doorway to Oneness — With Julien Chameroy (Podcast episode 3)"
  (2026-07-05, 44:52) is the newest full interview on the channel and the next
  one the NDE pipeline wants. `/api/ytdl` cannot get it: YouTube answers
  "Sign in to confirm you're not a bot" for this channel right now, on Render
  AND on a session container, after the full retry ladder and every yt-dlp
  client fallback. Your Mac has the one thing neither has — a logged-in
  browser whose cookies satisfy that check.
- **Not a general block, and worth not re-diagnosing:** Render's own probe
  read an unrelated video fine in 6.4s the same minute. Measured 2026-08-27 —
  video AND audio of the interview blocked, a 97-second Chene Short blocked
  too, so it is the channel, not the one video and not the file size.
- **Where:** ~/imageforge
- **Run:**
  ```bash
  cd ~/imageforge && git checkout main && git pull origin main && ./scripts/grab
  ```
  Paste this when it asks, then press Return on an empty line:
  ```
  https://www.youtube.com/watch?v=2lvyZgX9lDM
  ```
  That banks the AUDIO where the cutter reads it (Storage `nde-audio/`,
  Firestore `forge-nde-videos`) — which is what the NDE pipeline needs.
  Want the picture as well, for the Dump / Assembly / the Film Editor:
  ```bash
  cd ~/imageforge && yt-dlp --cookies-from-browser chrome \
    -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]" \
    --merge-output-format mp4 -o "~/Downloads/chene-ep3.%(ext)s" \
    "https://www.youtube.com/watch?v=2lvyZgX9lDM"
  ```
  (swap `chrome` for `safari` or `firefox` — whichever browser is signed in to
  YouTube). 480p lands about 175MB; 720p is ~308MB, which is over the 300MB
  cap `/api/ytdl` would have had to respect anyway.
- **Needs from her:** nothing beyond being signed in to YouTube in a browser
  on that Mac. If she wants the video half in the Dump afterwards, upload
  `~/Downloads/chene-ep3.mp4` from the Dump's SEND tab.
- **Try the cloud first — it may just work by then.** This kind of gating
  comes and goes. One free check, no download and no cost:
  `curl -sS "https://imageforge-q125.onrender.com/api/ytdl/status?probe=1"`
  then re-fire the grab that is already on file:
  `curl -sS -X POST "https://imageforge-q125.onrender.com/api/ytdl/1240021800a3c35abfd3/retry" -H 'content-type: application/json' -d '{}'`
  If that comes back with a url, skip this whole task.
- **Queued:** 2026-08-27 by anthony-chene-video-download


## DONE

### Hand Apple's Voice Memos transcripts to the archive — SUPERSEDED, then solved another way
- **Ran:** 2026-08-19 (after the 2026-08-18 failure below)
- **What happened:** the import can never work. Voice Memos transcribes
  per-device, on demand, and does **not** carry the result across iCloud, so
  the phone's transcripts stayed on the phone. Confirmed on this Mac: no
  transcript column in any of the 30 tables of `CloudRecordings.db`, none in
  `EncryptedCloudRecordings.db`, and the Recordings container holds only
  `.m4a` and `.waveform` files. This was never the "layout differs on this OS
  version" case the task anticipated — there is no layout to fit a reader to.
- **What was done instead:** the audio is all here, so the Mac transcribes it
  itself. New `scripts/transcribe-local.mjs` — whisper.cpp with
  `large-v3-turbo`, **no API key and no per-minute cost** (the OpenAI route
  would have been about $17.55 for this backlog). Neither limit that emptied
  these records applies locally: whisper.cpp streams a file of any length, so
  the 45-minute ceiling and the 24MB cap are both gone and **nothing needed
  chunking** — including the 5.9-hour recording.
- **Setup this left on the Mac:** `brew install whisper-cpp`, plus two models
  in `~/Library/Application Support/ImageForge/whisper-models/`
  (`ggml-large-v3-turbo.bin`, 1.5GB, and `ggml-silero-v5.1.2.bin`, the VAD).
- **The result:**
```
101 wordless records at the start  →  59 now.
42 filled. Roughly 48h40 of audio, about 1h45 of machine time (14–178× realtime).

The 5.9-hour recording: 119 seconds, no chunking, 436 characters (it is nearly
all silence — that is the honest answer for it).
Biggest transcript: 81,346 characters from a 79-minute recording.
Two sends died on a dropped socket mid-run; both went through on a retry, and
the script now caches the words to disk before sending and retries 4×.

The 59 that remain are not reachable from this Mac: 26 have no recording in
Voice Memos, 27 are under 5 seconds, 3 have an ambiguous stamp+length, and 3
contain no speech at all (checked every run, correctly skipped every time).
```
- **Reach:** of 101 wordless records, 45 had real audio on this Mac. The other
  56 are out of reach from here — 26 have no recording in Voice Memos at all,
  3 have a stamp+length matching two recordings (left alone rather than
  guessed), and 27 are under 5 seconds.
- **The one bruise:** the first run, before the filter existed, banked four
  junk transcripts. They cannot be cleared without a new server route — see
  the OPEN task above.
- **Queued:** 2026-08-17 by search-index-rebuild

- **FAILED 2026-08-18** (terminal chat, macOS 26.1, build 25B78): there are no
  Apple transcripts on this Mac to import. `--dry-run` and `--report` both
  found 0 transcript columns across all 30 tables of `CloudRecordings.db`, and
  a hand check agreed. Superseded by the run above.

### Turn on the automatic daily Voice Memos push
- **Ran:** 2026-08-19 — installed, loaded, and scheduled.
- **What landed:** `~/Library/LaunchAgents/com.imageforge.push-memos.plist`
  (RunAtLoad + daily at 12:00) and the runner in
  `~/Library/Application Support/ImageForge/`, logging to
  `~/Library/Logs/imageforge-push-memos.log`.
- **Not finished:** the scheduled run cannot read the Voice Memos database
  until `node` has Full Disk Access — see the OPEN task above. The push logic
  itself is fine; run by hand from Terminal it found 138 recordings to send.
- **Queued:** 2026-08-18 by voice-memos-upload-script


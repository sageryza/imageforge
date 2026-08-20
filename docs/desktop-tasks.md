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

### Hand Apple's Voice Memos transcripts to the archive
- **Why:** 94 of the 1,137 archived recordings have NO transcript — too long
  for the server's 45-minute ceiling, over Whisper's 24MB cap, heard as empty,
  or a failed enrich. Search searches words, so those recordings are invisible
  in it, and a search that finds nothing reads as a recording that doesn't
  exist. Voice Memos already transcribed them on the phone, for free, including
  the long ones — but only this Mac can read Apple's database.
- **Expect ~57, not 94** (measured live 2026-08-17): 11 of the 94 are
  zero-length and 26 more are under 5 seconds, so there is nothing for Apple to
  have transcribed either. The 57 that carry real audio are **66.5 hours**,
  14 of them over an hour each — those are the ones the server's ceiling
  refused, and the whole point of this.
- **Where:** anywhere (it needs no checkout — the script is served by the app)
- **Run:**
  ```bash
  curl -fsSL https://imageforge-q125.onrender.com/import-apple-transcripts.mjs -o /tmp/apple-tx.mjs && node /tmp/apple-tx.mjs --dry-run
  ```
  It reads Apple's database, matches each recording to its archive record, and
  prints what it found and what it would fill — sending nothing. Then, to
  actually send them, the same line without `--dry-run`:
  ```bash
  node /tmp/apple-tx.mjs
  ```
- **If it says it found no transcript text:** the layout differs on this OS
  version. Run `node /tmp/apple-tx.mjs --report` and paste the output back —
  the reader fits itself to whatever it is told.
- **Needs from her:** nothing, it just runs. Open the Voice Memos app once
  first if it has never been opened on this Mac. Safe to re-run: it only ever
  fills records that have no words, and the server refuses to overwrite one
  that does.
- **Queued:** 2026-08-17 by search-index-rebuild

- **FAILED 2026-08-18** (terminal chat, macOS 26.1, build 25B78): there are no
  Apple transcripts on this Mac to import — this is not the "layout differs on
  this OS version" case the task anticipated. `--dry-run` and `--report` both
  found 0 transcript columns across all 30 tables of `CloudRecordings.db`, and
  a hand check agrees: `ZCLOUDRECORDING` (1,197 rows) has no transcript column
  of any kind, the second database (`EncryptedCloudRecordings.db`) has none
  either, and the Recordings container holds only `.m4a` and `.waveform` files
  — the 610 `_FBF` external blobs are audio, not text. The words simply aren't
  here: Voice Memos transcription is produced per-device, on demand, and is not
  carried across iCloud, so the phone's transcripts stayed on the phone.
  Fitting the reader to another schema cannot fix this.
  **What could work instead** (needs her decision before anything is rewritten):
  transcribe from the audio this Mac already holds — all 1,196 recordings are
  on disk, so the 57 wordless ones (66.5 hours) could be chunked under the size
  cap locally and sent — or export the transcripts off the phone.

### Turn on the automatic daily Voice Memos push
- **Why:** Sophie asked for the Mac push to run by itself — at login and once a
  day — instead of being a command she has to remember. This installs a small
  launchd agent that runs the existing `push-memos.mjs` (fetched fresh from the
  server each run, so it never goes stale). One-time install; after this the
  push needs nobody.
- **Where:** anywhere (it needs no checkout — the installer is served by the app)
- **Run:**
  ```bash
  curl -fsSL https://imageforge-q125.onrender.com/install-memo-autopush.sh -o /tmp/install-memo-autopush.sh
  bash /tmp/install-memo-autopush.sh
  ```
  It writes the agent, starts the first push immediately, and shows the log.
- **If the log says "No Voice Memos database":** that's macOS keeping a
  background job away from the recordings even though Terminal can see them.
  The installer prints the one-time fix (add the `node` binary it names to
  System Settings → Privacy & Security → Full Disk Access) — do that, then run
  the installer once more.
- **Afterwards:** it runs at every login and daily at 12:00 PM (a run missed
  while the Mac sleeps happens on the next wake). The log lives at
  `~/Library/Logs/imageforge-push-memos.log`. Re-running the installer is
  always safe; uninstall lines are in the script's header.
- **Needs from her:** nothing beyond the possible Full Disk Access click above.
- **Queued:** 2026-08-18 by voice-memos-upload-script
- **If the curl 404s** (deploy not live yet): pull main and run
  `bash ~/imageforge/scripts/install-memo-autopush.sh` instead — same script.


---

## DONE

*(nothing yet — finished tasks move here with the date they ran)*

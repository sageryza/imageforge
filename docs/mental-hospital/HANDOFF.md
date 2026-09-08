# Hospital night — handoff (2026-09-08, from the `severance-api-multiple-frames` chat)

Sophie is shooting her hospital-night film on **Seedance 2.5 via APIFRAME**
(`POST https://imageforge-q125.onrender.com/api/apiframe/video`), 480p, 3:4,
audio on, ~15¢ a second, one job at a time. Everything below is what the next
chat needs. Her rules first — they are all hers, all in force.

## Her rules
- **"go" is the send word.** Before EVERY job show: model · seconds · resolution ·
  the exact prompt · every reference (which video, which still). Then wait.
  After sending, read back what APIFRAME really received and say it.
- **Never write her scenes.** Her text goes verbatim. Header lines (who is who,
  setting) may be yours and are NAMED as yours. A "before:" / "what came before:"
  line in her text is HER continuity line for the model — send it as written.
- **Every clip with Sophie carries the jazz as Video1** (`refs.json` → `jazz150`,
  15.1s; url ends `1788736757836-f3j8qh.mp4`). Triple flag. No exceptions.
- **30s of reference footage per clip, max.** A character rides with their
  FIRST-appearance clip (its origin). A 4s reference clip cut off an origin is
  a *reference clip*, not an audition. Her verdict 2026-09-08: "4s auditions
  don't rly work"; Michael's is "too far away" to be useful.
- **Never describe what exists as a picture** — point at the image. A still
  carries ONLY the people you want copied (blur hides a face from the filter,
  crop removes the person). Seedance image limits: width ≥300px, h/w between
  0.40 and 2.50.
- **Her clothes line on every card:** `sophie is the woman in [Video1].  she
  wears the blue hospital pajamas in [Image1], [Image2] and [Image3], NOT the
  dress in [Video1]`
- **She picks seconds** — give "my pick", she decides. Shortest clip by default.
- **Say dollars, never credits.** Report a died/failed job immediately
  (background watcher). No status/update cards in this chat ("stop the cards").
  No questions UI. Short replies.
- **Don't wire references or change a card without her approval.**
- **One page:** the belt (a swipe deck, film order). Too many compare pages
  confuse her. Pin = the newest clip (`kind:video`); never pin a page.

## Where things are (all in `docs/mental-hospital/belt/`)
- `jobs.json` — the full belt (76 cards, film order, every prompt + refs).
- `jobs-md.json` — **"Her scenes — the belt"** (8 cards, her latest md rewrites
  of the montage, the sculptures scene, climax 3–6). Live as v4. Her edits to
  words/seconds save on verdict sheet `belt-md` (`GET /api/chatfeed/verdict?chat=severance-api-multiple-frames&sheet=belt-md`), notes on `belt-md-notes`.
  The older full belt ("The conveyor belt v21") uses sheet `conveyor`.
- `belt-md.py` / `conveyor.py` — repost a belt (supersede state in `*-state.json`).
- `runaf3.py` — the runner: `DUR=10 AR=3:4 REFS='[…]' IMGS='[…]' python3 runaf3.py <key> "<title>" <file.mp4> <prompt.txt>`; on landing it uploads to the Dump (bundle "Ward → Seedance"), pins "Newest clip · <title>", appends `clips.json`, reposts "The clips" page, POSTs `/api/deliverables` and `/api/chatfeed/clips`. Watch: `until grep -qE 'pinned|FAILED|HTTP|COMPLETED|ERROR|CANCELED' run-af-<key>.log`.
- `refs.json` — every still and clip by key → Dump id + storage url. Keys that
  matter: `jazz150`, `pj-optA-solo`, `pj-optC-solo`, `still-pj-pocket`,
  `still-room3` (her room, face blurred, valid), `still-dining` (dining room band),
  `still2-doctor-chair`, `broll1b` (doctor+assistant hall, head-on, 4s — their
  reference at 1 step from intake A), `office2` (doctor+assistant office, eye
  level, 4s), `scaleAud3` (Mayra + white-coat nurse), `parentsAud` (parents 4s),
  `s39a3` (parents part 1, 10s, reinvented from words — landed 3rd try),
  `michaelAud2` (Michael 4s, she finds it useless), `intakeA3` (intake A, 25s).
- `hospital-night-notes.md` — the cast, the rules as they were earned.
- `script-*.md` — her scene files, verbatim. The **Script box** on the belt
  (`GET/POST /api/chatfeed/script?chat=`) holds them too; `script-cut.js`
  splits on the word `cut`.
- Clips list in the app header (`/api/chatfeed/clips`), lit until tapped.

## Open
- Her md belt: approve seconds, then wire + send card by card on "go".
  Two cards are over 30s and need a split (the hall breakdown at "just like i
  always wanted"; Mary and Juanita at "There." The nurse points at the wall).
- Auditions still needing her words: Yolanda, Nurse Edna, Ms. O'Hara + nurses,
  Nurse Mary + Juanita, Superintendent + Anastasia. She doubts 4s auditions work.
- The old room still (`still-room`, 224px) is INVALID and still on ~22 cards of
  `jobs.json` — replace with `still-room3` when she says.
- Office dialogue cast the assistant as a patient ("leave it for now").
- APIFRAME refunds to chase: 291px refusal 60¢, Michael audio refusal 60¢,
  second scale-A timeout $4.50. Balance was $20.69.
- Filters: "output video/audio may be related to copyright" is random on the
  same input — a resend can land (39 part 1 did on try 3).

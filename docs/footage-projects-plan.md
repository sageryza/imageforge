# Footage — grouping references and clips by PROJECT (plan, 2026-09-11)

Sophie: "wonder if we could group projects and character references so when I
switch between projects, I can only see those references offered to me and
only related files in the tiles list view area · come up with a plan · think
of cases · besides manually switching, any way to easily group work".

Written as the plan before anything was built. **Steps 1–4 and the backfill
shipped the same day** (her "good plan … go ahead for now"): the picker, the
field on every clip, the feed filter, the Dump album, the hand-off switch, the
174 clips filed under the ward — **which was wrong for a third of them** and
was redone the same evening by reading every prompt on the log (369 clips,
nine projects; the counts are in CLAUDE.md's Footage note). Also shipped that
evening, both on her word: **the move drop-down on every card** (step 6) and
**every chat's clips in the feed** (case 9 below is superseded — "if so,
good"). **Later the same night: sub-folders** ("can we do sub folders ex the
witch commercials") — a `folder` field inside a project, derived rather than
stored, one picker drawn as a folder icon with the header carrying the name,
the card's drop-down moving a clip anywhere; full note in CLAUDE.md's Footage
section. Still open: the evidence rules (step 5 / the "?" chip). The picker
rode three seats in a night — the Buttons fold row, the panel's fold row, the
Buttons row itself — and lives on the **feed bar**, between the search and the
funnel, since she marked the spot ("folders should go in red spot"): it is a
filter over the feed, so it sits with the feed's filters and cannot be folded
away from what it filters.

## What is already there (measured 2026-09-11)

- **The cast library already has projects — it calls them FILMS.** `cast.js`
  keys every entry `<film>__<slug>`, `GET /api/cast/films` lists the folders,
  the character sheet on `/footage` shows a row of film chips when there is
  more than one, and the pick is remembered (`footage_castfilm`). Live: one
  film, `ward` ("The ward"), 20 entries, 50 reference urls.
- **Footage jobs carry NO project.** 174 jobs on the log, all from 09-09 to
  09-11, every one `chat:'footage'`, none with a `from`/`scene`/`project`
  field. `buildJob` sends `chat · title · session` and nothing else about
  where the clip belongs.
- **The belt hand-off already names its source and the page drops it.**
  `scene-index.js` writes `from: belt.chat` and `title` into `footage_handoff`;
  `takeHandoff` reads the prompt, refs, model, seconds, res, ratio, seed — and
  uses `title` only for the toast. So the one automatic signal that exists
  today is thrown away on arrival.
- **Every uploaded reference lands in ONE Dump album, "Footage"**
  (`?bundle=Footage` in the page's upload). The Dump has folders (`track`)
  and albums (`bundle`) and neither is used per project.
- **The RECENT drawer is derived from the feed** (one tile per reference url
  off earlier cards), so anything that narrows the feed narrows the drawer
  for free.
- **Chats already have a `project` word** (`project-words.js`, the auto-sorter
  files one, the Chats app stacks siblings by it). That is the vocabulary a
  chat-sent clip could inherit; not the page's problem.
- **Reference evidence, measured:** of 174 jobs, 140 carry references, 34
  none. Only **19** of the 140 match a ward shelf url exactly — but the jazz
  clip alone rides under two urls (the Dump's `_/042e7aaa….mp4` and the
  shelf's `ward-refs/jazz-best4s-….mp4`, byte-identical per CLAUDE.md), and
  Dump urls ARE md5s, so a join by md5 (the Assets tab's own union) would
  lift that number a lot. 17 jobs reference an earlier Atlas OUTPUT (chaining
  off a clip or its last frame). Not measured: how many of the four most-used
  reference pictures (`c05681…`, `22d0563…`, `2d6c34…`, `613e82…`, 17-21 jobs
  each) are ward pajama stills not yet on the shelf — likely all of them,
  since the ward is the only film that has drawn anything.

## The plan — ONE field, `project`, read everywhere

The cast's film list IS the project list. No second vocabulary.

1. **A project picker on `/footage`.** One drop-down (the model's chrome, no
   label), listing `GET /api/cast/films` plus **All** and a way to name a new
   one (`POST /api/cast/films`). Remembered as `footage_project`; it replaces
   `footage_castfilm`, so the character sheet and the page can never disagree
   about which film she is on. **All** is a real stop — the filter must have
   an off state, or a clip drawn under the wrong project is lost to her.
2. **Every job sent carries `project`.** `buildJob` → the body → the
   `forge-video-jobs` doc. `GET /jobs?project=` filters server-side (the
   feed pages by `sentAt`, and the Assets-tab lesson says never filter a
   truncated page client-side). The list, the tiles, the RECENT drawer and the
   character sheet all read the one picker.
3. **References upload into an album named after the project**
   (`bundle=<project name>` instead of `Footage`), so the Dump is grouped by
   the same word with nothing extra to file. A reference already in "Footage"
   stays attachable — the drawer narrows by JOB, not by album.
4. **A hand-off carries `project` and SWITCHES the picker.** The belt page
   names it beside `CHAT`/`SHEET` (`var PROJECT='ward'`), scene-index.js
   passes it through, `takeHandoff` sets the picker. A belt that names none
   falls back to its `from` chat mapped through a small table (both ward belts
   → `ward`). This is the first automatic case and covers the whole draft.
5. **Backfill the 174.** `scripts/footage-project-backfill.js`, dry by
   default: every job on the log today is the ward (one film, three days),
   so the first run is one word. The script is kept for the next project's
   strays, with the evidence rules below as its brain.
6. **A chip on the card says the project** (small, beside the model tag) and
   tapping it moves a clip — the one repair path for a clip drawn under the
   wrong picker. Nothing is deleted; `project` is a string on the doc.

Cost: nothing. No model call anywhere in this; every read is the log the
page already polls.

## Grouping without switching — the automatic signals, strongest first

- **a. The hand-off names it** (step 4). Exact, free, covers everything sent
  from a belt.
- **b. The cast tap names it.** Attaching a character from film X sets the
  picker to X when it is on All or unset; when it is on another film, the
  attach still works and the picker is left alone (her tap on a character is
  not a tap on a project).
- **c. Reference evidence.** A job whose references are on ONE film's shelf
  belongs to that film — joined by url and by md5 (`asset-hash.js` reads a
  Storage object's md5 from metadata without a download; a Dump url carries
  its md5 in the filename). Used to PROPOSE, never to write silently on a
  send: on a job with no project it fills the chip with a "?" she confirms in
  one tap, and the backfill uses the same rule with `--go`.
- **d. Chaining.** A job whose reference is another job's output or last
  frame inherits that job's project (17 of 174 today). Same proposing rule.
- **e. The chat's project word**, for clips a CHAT sends through the module:
  the registry's `project` maps chat → project. Not the page's signal.
- **f. Stickiness.** The picker is remembered, so consecutive sends in a
  sitting stay together by themselves. This is the cheapest signal and it is
  already what the character sheet does.

What is deliberately NOT a signal: the prompt's words (a scene naming "the
ward" is text, and a clip about a hallway says nothing), and the clock (a
day she works two projects on would be cut in half).

## Cases

1. **One person in two projects** (Sophie in the ward AND a Nautch film).
   The cast is keyed per film, so she is two entries and that is right; but
   her reference stills will be the same files, so rule c matches BOTH films
   → ambiguous → propose nothing rather than guess. A look shared across
   films (one entry, several films) is a later ask, not this.
2. **A job with no references** (34 of 174). Only the picker or a hand-off
   can place it. Fine: the picker is sticky.
3. **A generic reference** (the socks B-roll, a room, a prop) used in two
   projects. Rule c must weigh a PERSON or a look over a setting, and require
   the majority of a job's references, or a shared room drags a clip across.
4. **Switching mid-draft.** Her words and the references ALREADY attached
   stay — they are hers, and a reference attached from another project is
   still a valid reference. Only what is OFFERED narrows (the drawer, the
   character sheet, the feed).
5. **Tests, B-roll, and "none".** A clip on no project shows on **All** only.
   A picker on All sends `project:''`, which is honest and what the backfill
   proposes over later.
6. **Renaming a project** is cosmetic — the films doc's `name` — and the
   slug never re-keys (the chat-rename rule). Merging two projects is a
   script with `--dry`, never a rename.
7. **Two belts for one film** (the main ward belt and the climax belt) both
   say `ward`; a belt names its project explicitly rather than the page
   inferring one from a chat slug that may fork (`<slug>-<sid6>`).
8. **A clip drawn under the wrong picker.** The card's chip moves it (step
   6); the drawer and the feed repaint from the doc.
9. **A chat's own clips** are tagged with the chat's slug, not `footage`.
   They WERE out of this feed by design (the Playground rule); since
   2026-09-11 they ride it, sorted into the same projects, each card saying
   `from <chat>` — her call ("are you adding them to footage? if so, good").
10. **The old page on her phone** (the app keeps a tool's web view alive)
    sends no `project` — the server must treat a missing field as `''`, and
    the self-heal brings the new page on the next visibility change.
11. **The character sheet with one film** draws no chips today; with the
    picker on the page it draws none either — the picker is the one control.
12. **Hearts, trims, notes and seeds** are per clip and untouched by any of
    this; a filter never hides a mark.

## Order to build

1. Picker + `project` on the job + `?project=` filter + the card's chip
   (one PR, the page and `footage.js`, tests in `test-footage.js`).
2. The backfill script and its one run (dry, then `--go`).
3. The hand-off carries and switches it (scene-index.js + the belt pages'
   `PROJECT` line, patched onto the live pages the `level-scene-pages.js`
   way — never rebuilt).
4. Upload into the project's Dump album.
5. The evidence rules (c, d) as the "?" chip and as the backfill's brain.

Steps 1–2 make the ward the first project and the tiles/list/drawer narrow to
it. Step 3 is what makes switching automatic for the draft work. Step 5 is
the only part with judgement in it and comes last.

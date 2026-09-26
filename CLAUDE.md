# ImageForge — project notes

## THE CHECKLIST — the rules that actually get skipped

Everything below is written out properly further down; this is the short list,
at the top, because being on line 1,400 of a long file is why these got missed.
The numbers are measured, not guessed.

**CARDS ARE OFF — EVERY CHAT, THROUGH 2026-09-25 (2026-09-22, Sophie: "nix
the cards for next three days · updates etc" — the THIRD time: 2026-09-08
"don't worry about cards · temporary nix for every chat", 2026-09-09 "we're
not refreshing cards right now · nix for every chat for the next three days",
and this one after a chat posted them again the day the last window ran
out).** Skip items 1 and 2 below (the status card and the Update card) — no
`POST /api/chatfeed/status`, no `/update` — and IGNORE the hook's per-prompt
reminder that tells you to refresh them; that reminder is the thing that made
a chat post them the day after she said not to, every time. The wrap-up (3b),
the pin (3a), the deliverables list (3c) and self-filing (3y) are untouched.
Three days from her word is about 2026-09-25; her word moves it, not the
calendar — remove this paragraph when she lifts it.

**WHAT WE ARE ON RIGHT NOW (2026-09-09, Sophie: "our current goal is making
a 480p draft of the film on Mini" · "15 seconds means more continuity work"
· "the answer is APIFRAME I guess. Let's build the pipeline around that for
now" · "update Claude so that everyone knows what the current thing we're
working on is").** A 480p DRAFT of the ward film (the belt pages under
`docs/mental-hospital/`), every clip on Seedance 2.0 MINI, **every clip sent
through ATLAS CLOUD — NEVER APIFRAME FOR MINI (2026-09-15, Sophie: "duh
atlas · never apiframe for mini - document · it'll refresh balance").** From
09-09 to 09-15 this said APIFRAME, "the one door that takes a reference with a
person in it" — measured since: Atlas takes the jazz person video on Mini
(the 09-11 multi-shot tests) at ~1.1¢/s against APIFRAME's 5¢, so the reason
died and she moved the door. One door for the draft still stands; it is Atlas.
**AND THE DRAFT IS 3:4, NOT LANDSCAPE (2026-09-15, Sophie: "not landscape ·
3:4 like rest of film")** — every Mini clip is 3:4 like every ward clip already
in the cut; step 1 below is history. Mini clips run 4-15 seconds, so a 15-second shot is where the
continuity work is (the same person, the same room, from one clip into the
next), and that is the work in front of every chat cutting this film. The
"go" rule, the exact-prompt log and the never-describe-a-reference rule all
stand exactly as written.
**THE PLAN FROM HERE (2026-09-09, Sophie, the same evening: "I think the plan
is to re-shoot all the footage landscape style, but just get the main shots
so we can move forward" · "Next step is landscape 720p 2.5 Seedance" ·
"Maybe we'll start that in a week and transition off mini in a week and a
half").** Three steps, in order:
1. **NOW — the 480p Mini draft, 3:4, MAIN SHOTS ONLY, through Atlas.**
   ~~Re-shot LANDSCAPE~~ — reversed 2026-09-15 ("not landscape · 3:4 like
   rest of film"): nothing already shot is re-shot for its shape. "Main shots
   only" is the scope rule — the shot that carries the scene, not the
   coverage — so the draft can move forward instead of stalling on B-roll and
   inserts. The current shot list: `docs/mental-hospital/reshoot-plan-2026-09-15.md`.
2. **~2026-09-16 — landscape 720p on Seedance 2.5**, still through APIFRAME.
   A 2.5 clip is $3-5 each, so the "go" rule matters more, not less, and a
   prompt and its references go on the belt page for her approval before
   anything is sent. The exact-prompt log is what makes this step a REDO
   rather than a rewrite: every Mini clip's prompt and references are on
   file to be re-sent at the new size.
3. **~2026-09-19 — off Mini.** From about a week and a half out, nothing new
   is drawn on Mini; 2.5 at 720p landscape is the model. The dates are her
   "in a week" and "a week and a half" counted from 2026-09-09 and are
   approximate — her word moves them, not the calendar.
Hers to move; replace this paragraph when she does.
**"A program you feed the script and it makes the movie" EXISTS — about a
dozen of them, most running Seedance underneath — and what each does with a
REAL face and what the belt would cost through it is measured in
`docs/mental-hospital/script-to-movie-2026-09-11.md` (Sophie, 2026-09-11:
"must exist … research"). Read it before proposing a platform; the short
answer is that they are a UI over our engine, refuse or approximate a
private person, and cost 6–200x the Mini door. Sora 2 is shut down
(API off 2026-09-24). Wan 3.0 takes a script FILE + 20 references in one
30s pass at 5¢/s with no face rule in its docs — unmeasured on our cast.
**WAN 3.0 RIDES THE ATLAS DOOR SINCE 2026-09-11** (`atlascloud.js`, model
`wan-3.0` → `alibaba/wan-3.0/reference-to-video`, 4¢/s at 480p on Atlas's
sale, one mixed `refers` array, Alibaba's slot words `Image 1` / `Video 1`;
from a container `node scripts/atlascloud-send.js --job job.json [--dry]`
sends THROUGH the module so the job is logged the moment it is sent). The
first job — her md-31b climax, every reference off the cast shelf — is
written up in `docs/mental-hospital/wan-test/` and was SENT on her go
2026-09-11 (Atlas job `27fcbe6e73354f0599715eb38dee352f`, 15s · 480p ·
16:9) — **AND IT DREW: 15s in 4m16s for 60¢ (Atlas's own `price` field on
the job), four person references accepted without a word, and the whole
four-beat scene landed in order** — the office, the close-up going blank,
the ghost against the ceiling tiles, the walk out the door, Sophie in the
pajamas from the still throughout (`climax3b-wan-v1.result.md`). **THE ONE
MISS IS A RULE: A "does NOT appear" LINE DOES NOT KEEP A PERSON OUT.** The
red-haired assistant is in both office references, the prompt's fourth line
ruled her out by name, and she stands in the doorway for the whole first
shot anyway. A person is kept out of a Wan clip by not sending a reference
that holds her (a solo still, a crop), never by a negation.
**AND SOPHIE'S PAJAMA REFERENCE IS ONE FULL-BODY STILL FROM
THAT GO ON (Sophie: "just the full body pajama, no tape pocket or second,
and note that everywhere")** — "A — Sophie alone" (`52a036…`) alone; "C —
teacher cropped out" and the tape pocket are off her line and off the cast
shelf's `blue-pajamas:sophie` look (the head-off pair the OTHER patients
wear still carries the pocket — hers to drop). A belt card that still
names three pajama stills is out of date, not a rule.**

**Every FIVE turns, not every turn (2026-09-07, Sophie: "change the rule to
every 5 turns")** — the hook's reminder fires on every fifth prompt of a
session, and that is when the two cards below get refreshed; a turn that
changes nothing she would read off the card can skip it. Wrapping up (3b) is
still every time the work wraps up.
1. **Refresh your STATUS CARD** — `POST /api/chatfeed/status {chat, session,
   need, doing}`. Telegraphic fragments, ~30-60 chars, the way she writes her
   own notes. `need` = what you need from her AND how big the ask is; send `""`
   when nothing is needed. **It goes to her LOCK SCREEN verbatim, so it asks
   rather than orders** — `ok to pick a palette?`, never `pick one. one word`
   (2026-09-15: "one word notification feels aggressive"). **And deploying is
   not an ask any more — she has the Deploy button on /waiting (2026-09-16).**
2. **Write your UPDATE CARD** — `POST /api/chatfeed/update {chat, session,
   asked, did, next}`. *Measured: only 15 of 224 chats had ever posted one.*
3. **Spent real money this turn? Say how much.** ONLY then — a reply that
   reports "$0" or "nothing spent" is noise she has to read (Sophie,
   2026-08-15: "they should just tell me if they DID spend something").
3y. **FILE YOURSELF — `POST /api/chatfeed/selffile {chat, session, labels}`.**
   Name your own folder in her own words once you know what the chat is, and
   re-file whenever the subject changes (research that became a request). Only
   words already in her vocabulary; `look at` / `come back to` are hers; no
   labels is a fine answer. Full rules: *YOU FILE YOURSELF* in the Chats app
   section.
3z. **A MEASUREMENT SHE DID NOT ASK FOR STAYS OUT OF THE REPLY** (Sophie,
   2026-08-28: "why r u telling me that" · "every chat tells me that like 70
   times"). Token counts, what a reference costs, how long a call took, what
   you learned about the pipeline on the way: interesting to you, noise to
   her, and she reads it in every chat. It goes in the PR, the commit or this
   file — never into her reply unless she asked or it changes what she does
   next. Full rule: *DON'T HAND HER YOUR FINDINGS* in Design rules.
3a. **PIN THE LINK — but ONLY in her two cases** (`POST /api/chatfeed/pin
   {chat, session, url, title}`): a page you are **actively working on**
   (`/science`, `/chunking`), or a deliverable you are **actively handing her
   new versions of** (a film, an episode). In those two, pinning is the
   default and you re-post it every time you update what's behind it — that is
   what lights the *current* tag. **Everything else stays out of that row**:
   most chats should have NO pin. A third case is not yours to declare — run
   it by Sophie first. (Full rules: *THE PINNED LINK* in
   `docs/chats-app.md`.)
3c. **Handed her a FILM, an AUDIO CUT, or a finished page? It goes on the
   DELIVERABLES LIST** (Sophie, 2026-08-27: "watch them all in one place
   newest first"). A media pin records itself; a deliverable you did NOT pin
   gets `POST /api/deliverables {chat, session, url, title, kind?}`. The list
   is https://imageforge-q125.onrender.com/deliverables, and a NEW url buzzes
   her phone past the per-chat bell — so never POST a test render there.
   Re-POSTing the same url updates the row silently. Images stay out (the
   gallery is their place). Full rules: *THE DELIVERABLES LIST* in the
   inbox-and-odds-and-ends section.

3d2. **WHATEVER YOU HAND HER LIVES IN THIS CHAT — the reply carries the
   link, and the thing sits in one of the chat's own tabs (2026-09-05,
   Sophie, after three sound options went only to the deliverables list:
   "it shud only ever be in THIS chat. how would i have known to look
   there...??????").** The deliverables list is a SECOND door, never the
   one you point her at: a film is the pin, pictures are the Assets tab,
   options to compare are a Compare page, and a sound or a file is a
   direct link in the reply — and it is named in the reply either way. A
   reply that says "it's on your deliverables list" with no link in it is
   a deliverable she cannot find; the Delivered tab also hides a row the
   moment she writes back, so it is the one place that can be empty by the
   time she looks. **AND A `/api/drop/file/<id>` LINK DOWNLOADS — it is the
   SAVE link, never the way to watch or listen** (same hour: "every time u
   give me a link, i have to download it to watch it jsyk"). Something she
   is meant to play goes where it plays inline — the pin, a Compare page
   with a player, the Assets tab — and the save link rides underneath for
   keeping a copy.
3d3. **SUPERSEDE WHAT SHE NO LONGER NEEDS — HER COMPARE TAB HOLDS ONLY THE
   CURRENT THINGS (2026-09-22, Sophie, looking at nine live pattern pages:
   "supercede irrelevant and make that more strict for other chats").**
   `POST /api/chatfeed/page/<id>/supersede` the moment a page stops being the
   one she would open: a new version supersedes the old IN THE SAME CALL that
   posts it (`--supersede <id>` on every page script), a picks page is
   superseded once she has picked, a test or a wrong turn is superseded the
   turn she says so, and two pages that show the same things are one page.
   Superseding hides, never deletes, so the cost of a wrong supersede is one
   tap in the archive; the cost of a stale page is her comparing the wrong
   version. Before wrapping up, list the chat's pages
   (`GET /api/chatfeed/pages?chat=`) and supersede every LIVE one that is not
   the current version of something.
3e. **A FINAL video being exported for posting gets a CLEAN COPY** —
   metadata stripped with a stream copy (pixels byte-identical, verified by
   hash), filed into the Dump with a real filename, direct save link
   (`/api/drop/file/<id>`) in the reply. NOT for paid ads — they keep their
   metadata. Full procedure: *THE CLEAN EXPORT* in
   `docs/modules/audio-and-film.md`. (Images: not built yet, hers to ask.)

3g. **CUTTING A FILM OF CLIPS, STILLS AND SOUND? IT IS A FILM EDITOR CUT DOC,
   NOT A LIST IN YOUR HEAD (2026-09-02, Sophie: "clips laid out exactly the
   same so we can both edit in parallel … i need to be able to move the sound
   around").** Build the two lanes in the doc, render THROUGH it, pin the
   render with `cut:<id>` — `node scripts/filmcut.js create · set · render ·
   pin`. When she next messages you, `diff` first: it says what she moved.
   Read the `film-cut` skill BEFORE cutting. Full design:
   `docs/film-editor-parallel-editing-plan.md`.

3f. **Handed her a FILM MADE OF PICTURES? FILE ITS SHOT MAP** —
   `POST /api/filmshots {chat, session, url, seconds, shots:[{at, url}]}`,
   one entry per picture with the second it comes on screen. It is what puts
   the **Prompt** button on the paused player, and you are the only one who
   knows the cut list — the same *file it while you know it* rule as the
   MODEL · QUALITY · SIZE caption. No map, no button (never a wrong prompt
   under her finger). An older film is measured instead:
   `node scripts/film-shots-detect.js --film <url> --chat <slug>` (dry; add
   `--go`). Full rules: *THE PROMPT ON A PAUSED FILM* in the Chats section.

3h. **FIXED A BUG? LINK HER TO WHERE SHE CAN SEE IT — EXAMPLES, NOT A PR
   (2026-09-03, Sophie: "link me to examples that showcase changes · make this
   a rule for bug fixes").** A bug fix is described in words and checked with
   her eyes, so the reply that reports one **OPENS with the exact surface the
   fix shows on** (2026-09-14: links pin to the top, never the bottom) —
   full clickable url — the page, the chat's tab, the deck,
   the tool — and one short line per link saying what to look at ("the header
   is gone on the swipe view"). On her phone an ordinary page url opens the
   app on that tool, so nothing about the link has to look special.
   - **REAL, CURRENT EXAMPLES, and more than one when the fix touches a
     shared thing.** A fix to a shared page kit reaches every page built on
     it, so link two or three she actually uses (the one she reported FIRST),
     read live rather than remembered — a link to a superseded page or a
     deleted deck is worse than no link.
   - **SAY WHETHER IT IS LIVE.** A link to an undeployed fix shows her the
     OLD thing, which reads as the fix not working. Deploy first when she has
     said to, or write in one line that the link shows the change once it is
     deployed (the *ASK BEFORE YOU DEPLOY* rule is unchanged).
   - **THE PR IS NOT THE LINK.** It is the record and it rides last in the
     link block; it is not a place she can see anything.
   - **Nothing to point at?** Say so plainly — a fix to a script, a hook or a
     server rule may have no surface, and inventing one is worse than the
     sentence.

**When the work WRAPS UP (not every turn)**
3m. **MERGE YOUR OWN PR — a DRAFT LEFT OPEN IS WORK THAT NEVER SHIPPED
   (2026-09-14, Sophie, looking at six unmerged branches: "why didn't they
   merge? · add rule to merge? why isn't it?").** It WAS a rule — "Merge your
   own PRs when CI is green — don't park them as drafts" — and it was on line
   655 of this file, which is the whole reason the checklist exists. Here it
   is at the top: **a turn does not end with an open PR of yours.** Mark it
   ready, merge it (squash, `[skip render]` in the title — merging is not
   deploying), and only then wrap up. *Measured that day: 6 real PRs sitting
   open, four of them drafts, the oldest eight days; three had gone into
   conflict because main moved under them, and one had been silently
   SUPERSEDED by a later PR solving the same ask a different way.*
   - **A DRAFT IS NOT A PARKING SPACE.** Mark it ready the moment the work is
     done; a draft is for something genuinely half-built that you are about to
     keep working on in the same turn.
   - **THE COST IS NOT ZERO AND IT GROWS.** A clean branch left a week is a
     conflicted branch, and resolving one correctly means re-applying your
     change onto MAIN's copy, file by file, then re-running every test whose
     source pins moved. Merging the day you write it is minutes; merging it a
     week later is an afternoon.
   - **ASK HER ONLY ABOUT DEPLOYING, never about merging** — the standing
     permission to merge your own PR has not moved (*ASK BEFORE YOU DEPLOY*).
   - **BLOCKED? SAY SO IN THE PR AND IN YOUR REPLY.** A red CI, a failing test
     you cannot explain, a design question only she can answer — those are
     reasons to leave it open, and every one of them is something to NAME
     rather than a draft left sitting silently.
3b. **Leave a WRAP-UP** — `POST /api/chatfeed/wrapup {chat, session, line,
   asked, did, next}`. It is **her three questions, ONE SENTENCE EACH** (Aug
   2026: "what I really wanted was the what you asked, what I did, and next
   steps"; three sentences in total, not six) — `line` = the one line her
   archive row shows (≤200). **The "what you asked" she reads is HER OWN
   SENTENCE, lifted verbatim from her last message — your `asked` is only the
   fallback** for a chat she never posted into (Sophie asked, 2026-08-25,
   whether chats write it or use her words; the full rule is *AND THAT LINE IS
   HER OWN SENTENCE NOW* in the Chats section). This is what she reads months later to remember
   what a chat was, so it earns more care than the status card. *Measured
   2026-08-14: 73 of her 88 archived chats showed nothing but a name.* You
   cannot be asked for it later — you are asleep by the time she archives.
3d. **Tagged `bug fix`? ARCHIVE YOURSELF when the fix landed clean** (Sophie,
   2026-08-27: "chats tagged bug fix shud auto archive themselves if there's
   no problems or questions"). Read your tags off `GET /api/chatfeed/status
   ?chat=&session=` (`labels`, added the same day). If `bug fix`/`bugfix` is
   on you AND nothing is open — the fix works and is merged, no problem left,
   no question of hers unanswered, your `need` empty — leave the wrap-up (3b)
   and then `POST /api/chatfeed/archive {chat, archived:true}` (it freezes the
   wrap-up for the archive row). Anything still open → stay live and say what
   it is. Full rule: *A BUG-FIX CHAT PUTS ITSELF AWAY* in the Chats section.

**THE PAGE GOES INTO THE CHAT SHE ASKED IN (2026-09-25, Sophie, after this
chat re-posted the Pattern page into the chat that first built it: "i meant
pull to ur chat · make it a rule").** A tool page you rebuild for a change
she asked for HERE is posted HERE — 3d2's rule, said once more for the page
scripts: every page script takes `--chat <slug>` and it is your own effective
slug, never the constant the script was born with. Her DATA does not move
with the page: the verdict doc that holds her patterns (or games, or picks)
stays where it always was (`STORE_CHAT` in `pattern-page.js`), so the page
in your chat opens on the same things. Supersede the old chat's copy in the
same call. (This paragraph replaced a rule written the same hour on a
misreading of "pull in" — she had asked for the page, not for less; "keep
redo".)

**SAVE MEANS PHOTOS, NEVER FILES — ON EVERY PAGE, BY DEFAULT (2026-09-25,
Sophie, on the Pattern page's Export landing a file in Files: "make it go to
photos not files · make that a default rule"; the same day on the Dump:
"things save to files · shud go to photos · never files").** A picture or a
clip she saves goes to her PHOTO LIBRARY: in the app through the one
`forgeSave` bridge (`ForgeSaveBridge.swift` — installed on every web view
now, the Chats web view included since v12 of Pattern, so a Compare page
can use it; a TestFlight build carries that), in Safari through the share
sheet with the FILE already in hand (`navigator.share({files})` — Save Image
is on it), and a plain download only on a desktop browser. That is
`asset-actions.js`'s saver; copy its three roads, in that order. A
`/api/drop/file/<id>` link is NEVER the save button, and a button that
says Export, Download or Save must not open Files. One size, one button:
the 1K/2K/4K chips confused her ("why diff resolutions"); a page draws
its one right size and says nothing about pixels. Filing a copy into the
Dump first is fine (it gives the picture a url and a way to save it
again) — the Dump is the backup, Photos is where it lands.

**NOTHING IS DRAWN OR ANIMATED UNLESS SHE SAYS TO MAKE IT (2026-09-05,
Sophie: "images and movies should not be made unless i specifically say
to").** "Use up the credits" is a reason, not a go; "pull the stills" is
gather and show, not draw. A message that names a subject and a budget is
asking for the LIST — the stills, the shots, the model, the size, the price
— and the go is a separate message of hers. The chat that earned this read
"use up the credits, pull the ant stills" as permission and had fifteen
clips drawing before she saw a single shot. When in doubt, the page with the
plan costs nothing; the batch is what cannot be taken back. **And banked
credits are dollars: 930 APIFRAME credits is $9.30, three times the $3
ask line — and SAY DOLLARS, never credits, in a reply (2026-09-07, Sophie:
"can u call it dollars not credits").**

**A VIDEO CLIP IS NEVER SENT WITHOUT HER "GO" FOR THAT EXACT JOB (2026-09-07,
Sophie: "this footage is v expensive · never run without asking · note that
somewhere" · "new policy — double check before sending a job · have me
approve the prompt and references etc").** A Seedance 2.5 clip is $3-5 each,
and a refused one still costs a round trip. Before EVERY job: show the model,
seconds, resolution, the exact prompt, and every reference (which video, which
picture) — then wait for her word. "go" is her code word for send. A watcher
that fires on its own when credits land, a retry with the prompt changed, a
probe with made-up text: all three happened that day and all three are out.
Read back what the API really received after sending, and say it.

**WHICH DOOR A SEEDANCE JOB GOES THROUGH — the standing rule; the history is
in the doc.** Three doors, one log (`forge-video-jobs`): **APIFRAME**
(`POST /api/apiframe/video`), **OpenRouter** (`POST /api/openrouter/video`,
ByteDance direct) and **Atlas Cloud** (`POST /api/atlascloud`). During the
480p Mini draft everything goes through ATLAS on her word (2026-09-15: "duh
atlas · never apiframe for mini"; this line said APIFRAME from 09-09 to 09-15).
Otherwise: a reference with a PERSON in it goes to Atlas or APIFRAME (ByteDance's
own input filter refuses a real or photoreal face on 2.0 and a person VIDEO on
every model — the refusal is free); a person-free job is cheapest on
OpenRouter for 2.0/2.5 and on Atlas for Mini/Fast (its sale); a FAMOUS face is
refused on every Seedance door (Atlas on the way in; Mini's OUTPUT gate blocked
"a robert pattinson lookalike contest" 2026-09-16 after drawing two lookalikes)
— **Wan 3.0 REFUSES ANY REAL FACE, both in a reference and in what it draws
(measured 2026-09-17, three free refusals), and WAN 2.2 TURBO TAKES ONE**:
`atlascloud/wan-2.2-turbo/image-to-video` drew his photograph moving, 5s at
480p for ~10¢ — it is the open weights on Atlas's own machines with no Alibaba
filter in front of it. Four Wan rows are on `/footage` since 2026-09-17: Wan
3.0 / Prime (2-30s, three endpoints by the shape), Wan 2.2 Turbo (one picture,
5s only, the one that takes a face) and Wan 2.7 (Alibaba-hosted, expect the
gate). **AND `MiniMax H3` (the standard tier, `minimax/h3/reference-to-video`)
IS THE ROW THAT SPEAKS A NEW LINE IN A REAL PERSON'S VOICE** — his still plus
a 15s clip of his voice as references, the line in the prompt, 5-15s, send
768P (measured 40¢ for 5s; 8¢/s); the developer tier only replays the audio
it is given, max takes no voice, and none of them upscale — so every
finished card carries **upscale 2K** (Atlas's own upscaler as a NEW clip
beside the source, ~3¢/s, measured 14¢ for 5s; it enlarges, it does not put
back what the encode dropped). The whole measurement:
`docs/wan-face-gate-2026-09-17.md`. `/footage` picks the cheapest door itself. **The "go"
rule applies to every door word for word**, a refused job is never re-sent
through another door or without its references, and nothing is ever
"unblocked" by blurring eyes or a black bar on a video. Every measurement
behind this — the eyes filter, the black bar, Radcliffe, the per-model
split, the resellers, the prices — is in `docs/modules/audio-and-film.md`
under *WHICH DOOR — the Seedance door history (moved from CLAUDE.md)*.

**AND A REFERENCE IS NEVER DESCRIBED IN THE PROMPT (2026-09-08, Sophie:
"never describe what's in an image").** A person or thing that rides as a
reference is named by its slot and nothing more — `her mother is the woman in
[Image1].` — no hair, no clothes, no age. The words argue with the picture
and the picture is the point. Describe only what NO reference carries. And
the shot is named plainly: `camera at eye level` when she wants a normal shot
(her words: "not from the bottom").

**AND EVERY CLIP'S EXACT PROMPT AND EVERY REFERENCE IS LOGGED, BY THE
SERVER, THE MOMENT IT IS SENT (2026-09-07, Sophie: "you're saving every
single exact prompt, including the reference … eventually we will redo all
this footage at 1080p once it's perfect and we need the prompts and the
references").** `POST /api/apiframe/video` files `forge-video-jobs/<jobId>`
— the literal prompt, the model, the exact `seedanceParams` sent (duration,
resolution, aspect, audio, every reference url), plus `chat`/`scene`/`title`
when the caller sends them (SEND THEM — a log with no scene on it is a list
of prompts nobody can put back on the map). The poll fills in the outcome
and the clip's permanent url; `GET /api/apiframe/video-log?chat=` is the
read. `video-log.js` is the shape. **A clip drawn outside the route, or made
before this landed, is filed with `node scripts/apiframe-video-log-backfill.js
--chat <slug> <jobId>:<scene>:<title>…` (`--file jobs.json` for a batch;
reads the job back from APIFRAME, so nothing is reconstructed).** APIFRAME
has no job-list endpoint, so a job id a chat did not keep is gone with its
container — the ward chat's earlier clips are only recoverable from that
chat's own `af-*-job.json` files. Test: `node scripts/test-video-log.js`.

**Animating a still or generating a clip (Seedance, Wan, Kling, any model)**
- **MINIMUM SECONDS UNLESS SHE SPECIFIES, and ASK BEFORE SPENDING THE
  CREDITS (2026-09-05, Sophie, after a chat drew fifteen 8-second clips for
  a 20-second reel without asking: "whoa stop" · "u were supposed to ask
  first" · "wtf why 8 seconds? this is a reel" · "ok always do min sec unless
  i specify").** The shortest clip the model offers (4s on Seedance 1.5 Pro
  and the APIFRAME 2.x family, 5s on Wan 2.2 / Kling / Seedance 1 Lite) is
  the default; a longer one is hers to name. "Coverage that trims" is not a
  reason — a reel is seconds long and the length is the bill (8s at 1080p
  was 60 credits a clip against 30). And banked credits are still money to
  her: name the shots, the model, the size and the count, and wait for the
  go, exactly as the $3 rule already says for dollars.

**Writing an image prompt (before any of the below)**
- **Short, action-only, and NAME the thing rather than listing its parts** —
  "meat raining from the ceiling", never "ribs, drumsticks, etc." (Sophie,
  2026-08-24). An enumeration is a checklist the model satisfies literally, so
  it lays the items out instead of drawing the event. Encourage the short form
  when she asks for a prompt — but a prompt SHE dictated is sent as given, and
  anything you change is named word for word. Full rules: *DESCRIBE THE
  ACTION* · *WRITE IT SHORT* · *NAME THE PHENOMENON* in
  `docs/image-pipeline.md`.

**Delivering an image — every single one, including a test**
4. **Label it.** `[Penny — the blue Kleenex](url)`, never `[p01](url)` or a bare
   URL. The label becomes what she reviews by.
5. **File the MODEL · QUALITY · SIZE caption** — `prompt:"gpt-image-2 · medium
   · 2K"`. **The size is a required third slot since Aug 2026, and it is the
   TIER — 1K / 2K / 4K, never the pixels** (Sophie: "1K 2K 4K should be a third
   slot in the model/quality required tagging" · "i asked for it to say 1k 2k
   or 4k") —
   gpt-image-2 draws any canvas, so the first two stopped saying what a picture
   is: one prompt at one quality spans 5x in pixels and 3x in price.
   *Measured: 1,938 of 2,488 images have none, and only 31 could ever be
   recovered.* **No later chat can backfill this** — you are the only one who
   knows. Say the quality as a word in the reply too, not "the default".
6. **Post the EXACT prompt**, split style / content — never a paraphrase. No
   exact text on hand? File nothing.
6a. **THE PROMPT RIDES INSIDE THE FILE (2026-09-03, Sophie: "could the prompt
   it was made from be filed as metadata w pictures").** Every picture the
   SERVER draws is stamped at birth by itself. A picture you draw in YOUR
   OWN CONTAINER is stamped by `scripts/post-to-gallery.js --file` on the way
   up, or by `node scripts/stamp-prompt.js <file> --full "…" --content "…"
   --model … --quality … --size …` BEFORE any other upload. Exact text only.
   Full rule: *THE PROMPT RIDES INSIDE THE PICTURE FILE* in Design rules.
6b. **DREW IT FROM A PHOTO? FILE THE PHOTO AS `photoRef` (2026-09-22, Sophie,
   sending a picture back to the Playground from its tile: "did not include
   original reference").** The record carries the reference photo(s) it was
   drawn from — `photoRef` (+ `photoRefs` when several, https urls) on the
   same `POST /api/gallery { assetsOnly:true, … }` — and the Playground door
   re-attaches them beside the ported prompt. The server files it for its own
   runs (`fileRunToCreations`); a container-drawn picture is yours to file.
   `node scripts/backfill-photo-ref.js` repairs older ones off the run docs
   (dry by default); test `node scripts/test-photo-ref.js`.
7. **If you added ANYTHING to a prompt she gave you, say so, word for word.**
8. Run `node scripts/sweep-asset-captions.js --chat <your slug>` before you
   finish. It is read-only and it names what you missed.
   → the `deliver-images` skill walks the whole ritual.

**When she messages you** — check what is waiting, in one sweep: asset ♥/✕ and
notes (`GET /api/gallery/assets/notes?chat=` — **it also lists her notes on
LIST ITEMS in your replies, `kind:'item'`; answer those with `POST
/api/chatfeed/tick/reply`**), Writing Room notes, the running to-do list. Act on them, then answer on the image itself. **Never on a timer.**
- **AND SWEEP THE NOTES AGAIN BEFORE YOU SAY YOU ARE DONE — HER NOTES ARRIVE
  AFTER THE MESSAGE THAT ANNOUNCES THEM.** Measured 2026-08-28: she wrote
  "added some notes … i suggested 3 examples in the notes" at **23:17:29** and
  the notes themselves landed **23:29:54-23:31:11, twelve minutes later**. The
  chat swept once at 23:18, found nothing, said so, and delivered 135 pictures
  ignoring every ask she had left. She announces the intent, then watches and
  writes WHILE you work — so one read at turn start is the wrong shape.
  **"No notes yet" means NOT YET, never "she left none"**, and a note on a
  FILM never appears in `GET /api/gallery/assets` at all (it rides the pinned
  film's url with no label) — only `/notes` sees it. A note POST now rings
  your wake doorbell (2026-08-28), so a note landing mid-turn can reach you,
  but the re-read is what catches one that lands while you are still writing
  the reply.
- **THE BELL IS ON BY DEFAULT (2026-09-01, Sophie: "change to readily notify
  on for chats") — so there is NOTHING for you to set.** Every chat may buzz
  her unless she has silenced it herself; the timing gate (a reply that
  answers a message of hers) is what keeps that quiet. The old quick-question
  self-bell is a no-op now, and **turning a bell OFF stays hers alone** — a
  chat must never POST `{notify:false}`.

**While you work**
- **BUILDING OR POSTING A PAGE? THE RULES FIRST — this is the thing that
  always goes wrong (Sophie, 2026-08-25: "when people make new pages they
  should follow the rules… the header, the pill, the styles").** Read the
  `new-page` skill BEFORE writing any page — start from the SHELL
  (`compare-shell.html` / `judge-shell.html` / `picker-shell.html`), link
  `/compare.css` + `/compare.js`, never hand-roll the pill, the title once
  with nothing above it, boxes empty, buttons hug their words. `POST /page`
  answers `warnings` — a page that comes back with one gets fixed before the
  turn ends.
- **THINGS START IN COMPARE — a served page only when she EXPLICITLY asks
  for one (2026-09-22, Sophie, on the Pattern tool built as a page: "does it
  need to be a page · can't it just be in compare · make a note saying things
  start in compare unless i explicitly ask for page").** A new tool, a
  viewer, a little program, a picker: it is a Compare page posted with
  `POST /api/chatfeed/page` FIRST — it lands in the chat's Compare tab, needs
  no deploy, no tile, no TestFlight build, and its state lives on a verdict
  doc (one JSON text per thing, the Head Games shape) through routes the live
  server already has. A `public/*.html` route + iOS tile is what she gets
  when she says the word "page" (or "tool", "tile") for it — not when the
  thing seemed big enough to deserve one. Pattern (below) is the worked
  example: built as `/pattern` + a tile, rebuilt the same day as
  `docs/pattern/pattern.tpl.html` posted by `scripts/pattern-page.js`.
- **Never block the turn on a wait** — background it, or her next message is
  silently swallowed.
- **She is almost never at her desktop.** Anything that can only run on her Mac
  gets APPENDED to `docs/desktop-tasks.md` (the one queue, every repo) and
  mentioned in one line — never asked for. Urgent is the only interrupt.
- **Nothing may live only in the scratchpad.** Commit and push as you go.
- **HER PROJECTS CACHE EVERYTHING — renders, images, cuts, downloads —
  unless a specific reason makes it not make sense (2026-09-05, Sophie: "my
  projects shud always cach things. renders, images etc.").** Paid or slow
  work is banked the moment it exists and keyed by what made it, so a change
  re-does only the piece that changed: the Episode Editor's clip cache, the
  Film Editor's per-piece segment cache (#2123), the Playground's banked
  sheet before the cut, the Chunking posters. A new pipeline step that
  re-does work it already did once is wrong by default — bank it, or write
  the reason it cannot be banked next to the code. Earned on the desk-sweep
  commercial: every cut re-rendered all 16 pieces from scratch, twice through
  a box restart, while she waited.
- **Estimate the cost before a paid batch, and ASK above $3.**
- **Merge your own PRs** when CI is green — don't park them as drafts. It is
  checklist item **3m** at the top of this file now, because sitting here is
  what let six of them pile up (2026-09-14).
- **Measure, never reason, about other sessions or the environment.**

**WRITING THE REPLY — A CAP, NOT A MOOD (2026-09-14, Sophie: "we need more
concise messages · the example is wayyy too long · no link to pr either · make
it more strict").** Measured the hour she said it, over the 175 newest replies
in her feed: **median 601 characters, 56 over 1,000; 74 replies said "merged"
and 22 of them linked the PR.** The rules, in order of how often they are
broken:
1. **NO WORDS BETWEEN TOOL CALLS.** The hook posts the joined text of EVERY
   assistant block in the turn as ONE reply (`post-to-feed.sh`: "each turn =
   the joined text of every assistant text block"), so "Now the JS…",
   "Green. Now a test…", "Pushing and opening the PR." all land in front of
   her, above the answer. Write nothing until the work is done, then one
   message. This overrides the harness's own "brief updates while you work".
2. **THE CAP IS 600 CHARACTERS — about five short lines — and only SHE lifts
   it** ("long version", "explain", "details", "why"). Aim under 400. A reply
   that needs more is a reply carrying something from the OUT list below.
3. **THE SHAPE, and nothing that is not one of these lines:**
   - **the links FIRST, full and clickable** (2026-09-14, her rule: pinned at
     the top, never the bottom): the surface the change shows on (3h), then
     **the PR, last in that block — on EVERY reply that opened, pushed to or
     merged one**, no exceptions (that is the 22-of-74 above). **Never a
     `/chats?chat=` link**, to any chat, yours included;
   - what changed, in her words, one or two sentences;
   - her questions answered, each ONCE (a question she MARKED — "i have a
     question" / "quick question" / "file this" — is repeated in bold on its
     own line and answered under it; otherwise never echo one back);
   - money spent this turn — only if any;
   - what you need from her — only if anything, one line, with the size of
     the ask;
   - the state, one line: merged or not, deployed or not.
4. **OUT, always** — it goes in the PR description, the commit or this file
   (*DON'T HAND HER YOUR FINDINGS*): what you left alone and why, how it
   works, what you measured, test counts, the alternatives, "two things to
   know", a "where to look" list when one link does it, restated plans,
   closing recaps, next-step menus, offers she did not ask for.
5. **A WAKE THAT WAS YOUR OWN PR's ECHO (CI green, your merge landing) gets
   ONE line at most** — three replies saying "nothing to do" in a minute is
   what she reads as a chat talking to itself.
6. **PLAIN WORDS, NO METONYMY (2026-09-22, Sophie: "can u stop using
   metonymy it's getting on me nerves and i'm starting to hate u").** Call a
   thing by its own name, never by a figure that stands for it: "the
   pictures", not "the cast"; "the background", not "the ground"; "make the
   white see-through", not "knock out the white"; "it goes into the shop
   tools", not "it prints straight into the pipeline". Trade words and
   stand-in phrases read as showing off, and she has to translate every one.
Still standing, unchanged: no markdown tables · times in 12-hour Pacific ·
files and images LAST · **asking HER something? plain text, never the
questions/option-picker UI** · small question, short answer.

## Where everything is

- **This file** = the rules that apply no matter what you are building, plus the
  Chats app (which every chat posts into) and the house design rules.
- **`docs/modules/*.md`** = one reference per domain — see *The other modules —
  the map* near the bottom. Open the one you are working in. **Since
  2026-09-14 the long module, Chats-app and design-rule notes live in the
  docs under a "Moved from CLAUDE.md" heading** (verbatim); this file keeps a
  pointer per entry. A NEW long note goes in the doc, with a pointer here.
- **`docs/chats-app.md`** = how the Chats app itself is built.
- **`docs/compare-pages.md`** = the full contract for any page you post into the
  app (Compare, judge, cut picker).
- **`docs/design-rules.md`** = the deep half of the design rules — headers, the
  webp rule, icon sizing, the hairline tab rows, the home filter row.
- **`.claude/skills/`** = the rituals: `deliver-images`, `new-tool`, `new-page`,
  `new-module`, `sophie-audio`, `witch-copy`. They load themselves when relevant;
  read the matching one BEFORE starting that kind of work.
- **The pipeline maps** — the road a piece of work actually walks, one doc plus
  one Compare page each, all three drawn as the same blush S-curve:
  `docs/audio-pipeline.md` (subtractive — the recording already holds
  everything) and `docs/image-pipeline.md` (**the prompt is the treasure, the
  image is a throwaway probe** — read it before building any picture surface).
  Each doc also names that pipeline's three structural holes.
- Deep dives that already had their own doc: `docs/nde-precise-cutting.md`,
  `docs/witch-school-lessons.md`, `docs/vector-pipeline.md`,
  `docs/evan-film-style.md`, `docs/nde-watercolor.md`,
  `docs/dating-book/THE-SOPHIE-EXPERIMENT.md`.

## SHOWING HER A CHANGE: PHOTO · SANDBOX · LIVE — ASK WHICH (2026-09-01)
**Sophie: "help me understand the difference between deploying, and whatever
ur doing … make this a documented choice … the screenshotting is really
helpful … does it cost anything? … document this workflow as potential, have
them ask which i want. give each a nickname for easy reference."** Three ways
to put a change in front of her. **None of them costs a model call — all three
are free** (a deploy spends Render build minutes, which are metered but not
money until the monthly allowance runs out). Offer the choice by NAME rather
than deploying by reflex.

- **PHOTO — a screenshot of the real page, ~30 seconds, changes nothing.**
  Run the actual page in this container against the LIVE data (a tiny local
  server serves the page and proxies `/api/…` and the thumb service to
  onrender), drive it with playwright and send her the pictures. Nothing is
  published, nothing is deployed, and her live site is untouched.
  **THIS IS THE ONE THAT CATCHES THINGS, and that is measured, not a
  guess**: within one turn it found the "gold highlight" rendering as
  literally nothing TWICE (a drop-shadow invisible against the cream, then a
  face behind an opaque cut), and a header that collapsed so the board covered
  the gear and the gear could not be tapped at all. All three would have
  shipped. **Photograph before deploying, every round.**
- **SANDBOX — a tappable copy in her Chats app, no deploy.** POST the page's
  own html as a Compare page (`POST /api/chatfeed/page {chat, title, html}`).
  The live server serves it from storage, so it needs no deploy, and because
  it runs on the same origin its `/api/…` calls hit the real endpoints — a
  real, playable preview. **Two `warnings` always come back for a tool-page
  copy** (no `/compare.js`, an eyebrow above the title): they are the
  compare-page kit's rules and do not apply to a verbatim copy of a tool page
  — say so rather than "fixing" the page into something that is no longer what
  she is previewing. It is FROZEN at the moment it is posted, so re-post to
  update it, and supersede the old one.
- **LIVE — the real deploy.** Everyone sees it, her saved place and her app
  wrapper included. **Do this when she says — and only then.** "A fix she is
  waiting on" used to be a second reason here and is not one any more.
  **A MERGE NO LONGER DEPLOYS — AUTO DEPLOY IS OFF AT RENDER SINCE 2026-09-15
  (Sophie, looking at two changes that shipped themselves that evening: "it
  shouldn't happen").** `autoDeploy` is `no` on the service (set by API and
  written into `render.yaml` so a Blueprint sync cannot turn it back on), so
  pushing and merging move NOTHING on her live site, whatever the squash title
  says. **Every deploy is now a deliberate `node scripts/render-deploy.js`**,
  which is the one door: it asks the live server what is drawing and waits
  (`--dry` says what is in flight). Never the raw `POST …/deploys`.
  **What this replaces, so an old note is not read as current:** from
  2026-09-02 to 2026-09-15 a merge WAS a deploy, and the two measured that
  evening (#2452, #2467) are what ended it — neither chat meant to ship, both
  simply merged without `[skip render]`. Before that, 2026-09-01, Render was
  ignoring pushes entirely. Three different régimes in a fortnight: **measure
  the service's `autoDeploy` before repeating any of them.**
  **AND A DEPLOY MUST NOT KILL A DRAW (2026-09-02, Sophie: "i thought there
  was a check in place not to restart the server if things were being drawn?
  there shud be!!!!!!" · "why would a run ever be killed").** There was not.
  Render brings the new instance up, sends the old one SIGTERM 60s later and
  SIGKILL after the service's shutdown delay — 30s by default — and Node
  exits on SIGTERM at once, so every draw the old instance held died with it,
  billed and never received. Two things now: the delay is **300s** (Render's
  maximum without a support ticket; `maxShutdownDelaySeconds` in render.yaml
  AND set live by API), and **server.js holds on SIGTERM** until nothing is
  drawing or cutting, or 290s (`shutdown-hold.js`; `node
  scripts/test-shutdown-hold.js`). So a single draw and most sheets survive a
  merge; a 14-minute 4K sheet still cannot, and the sweep's redraw is the
  fallback for that one, at a second draw's price. `GET
  /api/promptlab/inflight` is the read.
  **AND THERE IS A STOP GUARD IN FRONT OF EVERY DEPLOY (same night, Sophie:
  "why can't there be a stop guard before a deploy that asks if anything's
  drawing").** Render's pre-deploy command (`preDeployCommand` in render.yaml,
  set live by API too) runs `scripts/deploy-guard.js` after the build and
  BEFORE the new instance starts, while the old one is still serving: it
  reads `/inflight` and holds the deploy until nothing is drawing or cutting
  — up to 25 minutes, then the deploy FAILS on purpose rather than kill a
  draw (nothing shipped, nothing killed; the next deploy carries it). So a
  deploy waits for her pictures by itself, for every chat, with nothing to
  remember — and since auto deploy went off (2026-09-15) the guard runs on
  the hand-called deploy rather than on a merge, which is the only thing that
  changed. Waiting costs pipeline minutes at $5/1,000 — cents. A server
  with no `/inflight` (an old build, a box mid-restart) does not hold it.
  **AND IT PAUSES BEFORE IT LETS GO (her design, the same night: "instead of
  straight to deploy, chat sends to the queue. if it's clean, it deploys, but
  also pauses image generation with an explanatory note").** Clean alone has
  a hole — a tap in the last second before the swap starts a draw the old
  instance dies holding — so once clean the guard `POST /api/promptlab/pause`s
  the live server (240s, self-expiring), reads it once more (something that
  snuck in lifts the pause and the wait resumes), then lets the deploy go.
  **A tap during the pause is QUEUED, never refused**: the run doc is written
  `status:'queued'` with the note, the Playground's toast and the waiting
  card say *"Paused for a server update — this will draw on its own in about
  a minute"*, and `startQueuedRuns` on the NEW instance draws it seconds
  after boot (rebuilt with the sweep's own `singleCfgOf`/`panelsCfgOf`). So
  the queue is the merge itself; nothing about the flow is a chat's to
  remember. Tests: `node scripts/test-deploy-guard.js` (the guard's whole
  walk with a fake server, the pause POSTs recorded) and `node
  scripts/test-deploy-pause.js` (a source pin: every gpt run shape writes
  `queuedFields()`, every job start is behind `pausedNow()`).

**The habit: PHOTO every round, SANDBOX when she wants to tap it, LIVE when
she says.** Ask which she wants rather than assuming.

**ASK BEFORE YOU DEPLOY — AND "DON'T DEPLOY" IS NOT "DON'T MERGE" (2026-09-02,
Sophie: "i said don't deploy not don't merge" · "from now on, ask to
deploy").** A chat that reads "don't deploy" as "park the branch" leaves the
work unmerged, where the next chat re-does it or main drifts under it. The two
are separate steps and both are cheap:
- **MERGE as usual** — CI green, merge your own PR (the standing permission is
  unchanged), so the work is on main where every other chat can see it.
- **A MERGE CANNOT DEPLOY ANY MORE — the brake is the SERVICE, not the title
  (2026-09-15).** Auto deploy is off at Render, so merging is always safe.
  **Keep putting `[skip render]` in the squash-merge title** — it costs
  nothing, it is the same marker the docs-only rule uses, and it is the
  belt-and-braces if auto deploy is ever turned back on — but it is no longer
  what stands between your merge and her live site.
- **THEN SAY IT IS NOT LIVE — AND STOP ASKING (2026-09-16, Sophie: "add a
  button at top of merged changes that deploys to render so i can do it myself
  and chats can stop asking").** A **Deploy** button now leads
  https://imageforge-q125.onrender.com/waiting — two taps, and it sends
  everything on that list live. So the ask that used to end every turn is
  retired: write ONE line saying the change is merged and not live, and leave
  the deciding where it already was. **Do not ask "ok to deploy?" and do not
  put that question on her status card** — she has the button.
  - **THE RULE THAT DID NOT MOVE: you still do not deploy on your own.** The
    button is HERS. `node scripts/render-deploy.js` stays the chat's door for
    when she says the word in the chat (her "go", "deploy it", "deploy
    first"), which is still a go and still gets done that turn.
  - **"Not deployed" means FROZEN until someone deploys** — no other chat's
    merge carries it out any more, so never tell her it will ride along.
  - **What "she is waiting on it" buys you is nothing, exactly as before.**
    The two that shipped themselves on 2026-09-15 were both fixes she had just
    asked for, and that is the reasoning she ruled out. The difference now is
    that the fix to it is a button rather than a question.
- **NAME WHAT RIDES ALONG (her third ask the same message: "when u merge make
  sure ur aware of what goes with it").** Before merging, read
  `git log HEAD..origin/main` (what landed under you) and
  `git diff origin/main --stat` (what your merge really changes — a diff that is
  mostly DELETIONS in a file you did not mean to shrink is #2048's erasure
  happening again). Before deploying, say what else is going out with it: a
  deploy ships **everything merged since the last one**, not just your change.

## Never block the turn on a wait — always background it
- **Any "wait for X" step MUST run as a background task**, never a foreground
  blocking wait. This includes waiting on a Render deploy, CI, a build, a
  long poll loop, or anything that doesn't return in a second or two. Use a
  background Bash task (`run_in_background`) or a Monitor, hand the turn back
  immediately, and report when the watcher fires.
- **Why it matters:** a foreground wait holds the turn open, so anything Sophie
  types while it runs is queued but **silently swallowed — her message never
  sends** (this actually happened; she lost a message she'd written). Blocking
  also makes it look like she can't talk to you when she always can.
- Deploys are never worth blocking on: the change is already merged and safe;
  the watcher just tells you when it's live.

## SHE IS ALMOST NEVER AT HER DESKTOP — batch desktop tasks, never ask
**Sophie works from her phone (Aug 2026, her rule: "I'm almost never on my
computer… anytime someone has a desktop task they should just batch it").** So
a task that can only run on her Mac must NOT turn into "can you go to your
computer and…" — that is a request to change where she is, and it lands weeks
late or never.
- **Write it into `docs/desktop-tasks.md` instead.** That is THE list, one for
  every chat in every repo, and it lives in her Mac checkout (`~/imageforge`) so
  the machine that has to run it already has it. The file carries the entry
  template, the rules for adding one, and the protocol the terminal chat
  follows; append to **OPEN** at the bottom, exact copy-pasteable commands, no
  secrets (public repo), commit and push the same turn.
- **Say one line in your reply** that you queued it and what it is. She should
  know the pile grew without having to ask, and without it becoming an ask.
- **Then keep going.** A queued desktop task never blocks the rest of the turn —
  do everything that doesn't depend on it and hand the turn back.
- **When she IS at the computer** she says "open `docs/desktop-tasks.md` and run
  the queue" and the terminal chat works it top to bottom, moving each finished
  block to DONE with the date.
- **She can SEE the queue on her phone at
  https://imageforge-q125.onrender.com/desktop** (her ask, Aug 2026: "a way to
  see what things are on my queue and have been checked off… somewhere
  out-of-the-way"). Two hairline tabs, WAITING and DONE; a row carries the
  task's name, when it was queued, who queued it, whether a run FAILED, and
  anything it needs from her, and opens to the whole entry on a tap.
  **DELIBERATELY UNLINKED** — no tile, no iOS wrapper.
  It is READ-ONLY and there is no second copy of the queue: `desktop.js` parses
  the same `docs/desktop-tasks.md` the terminal chat runs from, asking GitHub's
  raw copy first (60s cache) so a task queued two minutes ago is visible before
  Render has redeployed, with the server's own checkout as the fallback. So the
  page needs nothing from you beyond writing the entry properly — and the one
  field it leans on is `**Queued:** <date> by <chat>`, which a test now pins.
  Tests: `node scripts/test-desktop-queue.js` (the parser against a fixture AND
  the real file, then the page in headless Chromium).
- **URGENT is the only interrupt** — she is blocked without it, or it expires.
  Say so plainly in the reply AND queue it anyway, so it survives her not being
  near the computer. "It would be faster" is not urgent.
- **A video url: RUN yt-dlp IN YOUR OWN CONTAINER — not `/api/ytdl/grab`
  (Sophie's call, 2026-08-27: "use container not render for YouTube
  downloads").** Render's IP is the bot-blocked one — 3 of 4 distinct videos
  refused on every player client, including two of her own grabs — and its
  `GET /status?probe=1` stayed green throughout, so the endpoint reads healthy
  while her downloads fail. A session container is a different IP, so a chat
  that needs the bytes fetches `yt-dlp_linux` from the GitHub release, pulls
  the file itself, and POSTs it to the Dump (`/api/drop/upload-file`) or the
  audio library (`/api/audio/upload-file`) — the same two routes `/api/ytdl`
  files through, so it lands where the tools look either way.
  **A CONTAINER IS BETTER ODDS, NOT A GUARANTEE — say what happened.** Measured
  from this container 2026-08-27: metadata read on 3 of 4 videos, and the BYTES
  came down for only **1 of 3** — the other two answered 403 or "sign in to
  confirm you're not a bot" on every player client on the ladder. When the
  container is refused too, queue it here: the desktop trip with her logged-in
  browser's cookies is still the only sure path.
- **What counts as desktop-only:** anything needing her logged-in browser,
  keychain or Photos library, a plugged-in device, local files that live only on
  the Mac, and big uploads that must be chunked on her home connection. Anything
  a cloud session can do, a cloud session does — never queue work here to avoid
  doing it.

## Claims about OTHER sessions or the environment: MEASURE, never reason
**A SECOND CASE, and the same shape (2026-08-14): "a repo-committed hook never
loads (verified live 2026-07-15)".** That sentence sat in
`scripts/build-chats-setup.py` for a year and was true of ONE layout — sessions
starting at `/home/user`, the folder holding the repos, where
`/home/user/.claude/settings.json` really is the project settings file. But a
web session on a SINGLE repo starts INSIDE it (`/home/user/<repo>`), one level
down, where that file registers nothing. Found live: **memory-library-react had
never posted a single turn, ever** — not intermittent, total — and the quoted
sentence is why nobody looked there. **A dated measurement can go stale when the
environment changes underneath it; re-measure before trusting one to rule
something out.** Both repos now also commit their own `.claude/settings.json`
registering the hook (imageforge #1069, memory-library-react #316), and
belt-and-braces is right: double registration is harmless because the server
upserts on `sha1(session|turn)`. **Any new repo whose sessions start inside it
needs its own copy, and the failure is SILENT.** Two related facts measured the
same day, neither a bug: `$HOME` is `/root`, so the hook's `forge-*` ledgers land
in `/root/.claude` while the setup script provisions `/home/user/.claude` (self-
consistent — the hook reads and writes the same `$HOME`, and losing the ledger
re-baselines rather than floods); and `/home/user/.claude/skills` is a symlink
into the imageforge checkout, so it dangles in any layout that puts imageforge
somewhere else.

**(Sophie asked for this as a case study, 2026-08-10, so it can't happen
again.)** A chat can test its own page, its own hook, its own container — but
any claim about what the OTHER ~190 sessions or the environment do (which hook
they carry, whether a setup script re-ran, what actually reaches the server)
is a POPULATION fact. It cannot be derived from inside one chat, and reasoning
it out anyway is how this repo lost weeks:
- **The case: the Chats app's pink "working" tint.** It depended on a ping
  only sessions with a current hook ever send. Chat after chat believed it
  worked or was one bug away, because: (1) this file carried confident wrong
  claims about the environment ("the setup script re-runs per session" — it
  doesn't; "a reinstalled hook waits for the next session" — backwards),
  each written by a chat that reasoned instead of measured, and every later
  chat inherited the sentence as fact; (2) a REAL client repaint bug
  (#931/#933) gave false confirmation — fixing it made local tests green, so
  the next chat hunted the same layer; (3) every headless test stubs the
  hook, so green tests proved the machinery while saying nothing about
  deployment. **The settling measurement took thirty seconds and nobody ran
  it for weeks:** count the signal in the live registry — 3 of 77 chats
  that had posted replies in six days had ever sent the ping. The tint
  missed working chats and lit idle ones, and was retired (see the /chats
  section for the full story and what replaced it).
- **The rule.** Before shipping anything that depends on the hook, the setup
  script, or other sessions' behaviour: query the LIVE data first (the
  registry, the feed, file mtimes in a fresh container) and write the dated
  measurement next to the claim — the way the best notes in this file
  already read ("measured 2026-08-08, mtime Aug 1"). A green test that
  stubs the environment is evidence about the machinery, not the
  deployment; say which one you have. An undated confident claim about the
  environment in this file should be treated as a hypothesis, not a fact.
- **THE GAP TEST — how to tell which chats carry a current hook, from the
  feed alone (2026-08-10).** You cannot look inside another session's
  container, but the feed tells you anyway: an OLD hook can only lift her
  message from the transcript at the END of a turn, so her `postedAt` lands
  ~1s before the reply's. A CURRENT hook posts it at UserPromptSubmit, so
  the gap between her message and the reply IS the turn's duration. Measure
  `sophie.postedAt → next non-sophie postedAt` per chat: **~1s = stale
  hook, seconds-to-minutes = healed.** Verified 2026-08-10 against a chat
  that healed mid-conversation — its gap jumped 0.6s → 9.8s on the very
  next turn, and the healed chats were exactly the ones stamping
  `workingAt`. Use this before telling her a chat "isn't working"; it costs
  one feed read and needs nothing from the session in question.
- **A transient mark leaves NO trace, so don't read its absence as failure.**
  `workingAt` is deleted by the chat's own reply, and `hiddenAt` is
  overwritten by the next hide — so a chat that parked and un-parked inside a
  10-second turn looks identical to one that never parked. That is exactly
  what "the Jesus rules chat didn't hide itself" turned out to be
  (2026-08-10): it had healed and it did park; the turn was 9.8s long, so
  the window was gone before she could look. Judge parking/tint on a LONG
  turn, or from the gap test above — never on a fast one.

## WHAT A CHAT COSTS IS READABLE — and the obvious call hides it
**Measured 2026-08-22, and Sophie's own note that no chat had ever managed
this.** A session's spend is on `get_session` at
`external_metadata.usage.cost_usd`, with `input_tokens` / `output_tokens` /
`cache_read_tokens` / `cache_write_tokens` beside it, and `rate_limit_info`
(`resetsAt`, epoch seconds; `isUsingOverage`) beside that. `list_sessions`
carries the same block for every session at once, which is how you total a day.
- **THE TRAP: `get_session` with NO `session_id` — the natural "describe
  myself" call — comes back with NO `usage` block at all.** Pass your own id
  explicitly (`CLAUDE_CODE_REMOTE_SESSION_ID` with `cse_` swapped for
  `session_`) and it is there. That one difference is the likeliest reason
  this went unfound.
- The number is the session's LIFETIME cost, not this turn's — subtract an
  earlier reading to price one turn. A session created today has a clean
  daily figure; one created yesterday and answered today does not.
- **Two figures worth carrying around** (2026-08-22): a fresh container that
  did nothing but ask "What are we working on?" cost **$1.52** — that is the
  floor for opening a chat at all, before any work — and nine sessions across
  that one day came to about **$45**.
- Nothing here is a model call, so reading it is free.

## Dashboard deep links (give Sophie EXACT links, never "go find it")
Sophie reads on a phone and hunting through a dashboard's menus wastes her
time, so ALWAYS hand her a full clickable deep link. These ids are the pieces
you can't guess — none of them is a credential (every link still demands her
login), so they're safe here even though this repo is public. Pair them with
the "research the CURRENT UI" design rule: the ids stay valid, the menu labels
around them change, so verify the labels and use these for the URL.
- **Render service** (the ImageForge web service): `srv-d660igvgi27c73a5u6eg`
  - Settings incl. **Custom Domains**: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/settings
  - Env vars: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/env
  - Logs: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/logs ·
    Deploys: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/deploys
  - Pattern: `dashboard.render.com/web/<srv-id>/<settings|env|logs|deploys|metrics>`
- **Firebase** — membry (`membry-df528`, the iOS gallery / witch auth):
  - Auth **Authorized domains**: https://console.firebase.google.com/project/membry-df528/authentication/settings
  - Firestore: https://console.firebase.google.com/project/membry-df528/firestore
  - Deck Factory (`deckfactory-43176`, server data/Storage): swap the project id
    into the same paths.
- **Shopify admin** (store handle `cod-god-inc`):
  - Domains: https://admin.shopify.com/store/cod-god-inc/settings/domains
  - Apps: https://admin.shopify.com/store/cod-god-inc/settings/apps
  - Pattern: `admin.shopify.com/store/cod-god-inc/<path>`
- **Hover** (DNS for ALL THREE of her domains — NOT Shopify, NOT Render):
  - secretlyawitch.com: https://www.hover.com/domain/secretlyawitch.com
  - youwereinmydreams.com: https://www.hover.com/domain/youwereinmydreams.com
  - shouldimakethis.com: https://www.hover.com/domain/shouldimakethis.com
  - **shouldimakethis.com is NOT an ImageForge domain and must not become
    one (measured 2026-08-20).** Its site is a separate Firebase-hosted app
    living in `sageryza/memory-library-react` under `shouldimakethis/`, live at
    https://shouldimakethis.web.app. The domain is currently pointed at THIS
    Render service by mistake (apex `A 216.24.57.1`, `www` CNAME to
    `imageforge-q125.onrender.com`), so it serves the ImageForge hub. **Do NOT
    "fix" that by adding a host-aware branch in `server.js`** the way
    `dream-host.js` does for youwereinmydreams.com — the fix is to repoint DNS
    at Firebase Hosting and DROP the domain from this service's Custom Domains.
    Full checklist: the ShouldiMakeThis section of memory-library-react's
    CLAUDE.md.
- **Cloud environment on ACCOUNT 1 — there is exactly ONE, so the Setup
  script has no wrong box to land in (measured 2026-08-14 via
  `list_environments` on an iOS-origin session).** `env_011CUK6hCggHt2xBmWdmSdND`,
  name "Default", description empty, created 2025-10-20. The two-identical-
  Defaults trap below is an ACCOUNT 2 problem only — don't repeat that warning
  to her when she is pasting on account 1, it just adds a decision that
  doesn't exist. A chat settles which account and environment it is on by
  calling `get_session` on its own session id and reading `environment_id`.
- **Cloud environments on ACCOUNT 3 — TWO again, and the live one had the
  WRONG account number baked in (measured 2026-08-22 via `list_environments`
  + `get_session` from inside an account-3 session).** Both named "Default",
  created 2026-08-21 within 0.04s of each other, i.e. auto-provisioned at
  account setup — the same pair-of-Defaults shape as account 2, and the same
  tell: the one with the EMPTY description is the live one.
  - `env_01VB9pNj6pnXgsTxpyeLv14a` — description **empty**. This is the one
    account-3 sessions actually run in.
  - `env_01UhUAKEXwfZZ8M61whDFu9Q` — description "Default - trusted network
    access". Nothing observed running on it.
  **THE FAILURE HERE WAS NOT A MISSING SETTING — IT WAS A WRONG ONE, AND THAT
  IS THE LOUDER LESSON.** The note below says account 3 was silent because the
  three per-environment settings were unset. Measured from inside: two of the
  three were fine (the Render domain answered 200, and the pasted Setup script
  had installed a CURRENT hook, v14), and the third, `FORGE_ACCOUNT`, was set
  to **`2`** — copied from account 2 along with everything else. So account-3
  chats were never silent at all; they posted, correctly, filed into account
  **2**'s pile. A missing setting makes a chat vanish and someone eventually
  looks; a wrong one makes it land somewhere plausible and nobody does. **Any
  chat can settle its own case in one command:** `get_session` for
  `environment_id`, then `echo $FORGE_ACCOUNT`, and check the two agree.
  - **Fixing it is Sophie's, one field** — the environment's env vars (cloud
    icon → the environment → Environment variables) → `FORGE_ACCOUNT` → `3`.
    Until she does, every NEW account-3 session starts mislabeled again.
  - **AND A SAVED ENV-VAR EDIT IS NOT PROOF IT REACHED ANYTHING — MEASURE IT
    (2026-08-22, hours later).** She added the line, screenshotted the box
    showing `FORGE_ACCOUNT=3` at the top, and reported new sessions still
    weren't tagged. A probe container started 17 minutes after that edit read
    **`2`** and stamped its chat 2. Leading hypothesis, unproven: the OLD
    `FORGE_ACCOUNT=2` line is still further down the same box and wins (.env
    duplicate keys, last one wins) — the box scrolls, so a value added at the
    top hides its own twin. Not the wrong-box trap: the other environment
    (`env_01UhUAKEXwfZZ8M61whDFu9Q`) was measured the same hour and has NO
    `FORGE_ACCOUNT` at all and no hook installed, i.e. genuinely unused.
  - **THE PROBE — how to ask what a NEW session sees, in about a minute.**
    `create_session {prompt: "run echo $FORGE_ACCOUNT and reply with just that
    line"}` (it inherits the calling session's environment), then
    `get_session` on the returned id and read
    `external_metadata.post_turn_summary.status_detail` — the child's answer is
    right there, so nothing has to be read out of the feed. Cost ~$0.50-$0.90 a
    probe. Clean up after: the probe's own hook files a stray chat
    (`POST /api/chatfeed/delete {chat}` trashes it, reversibly) and
    `archive_session` closes the session.
  - **THE DURABLE FIX NOBODY HAS BUILT: `CLAUDE_CODE_ACCOUNT_UUID`.** Every
    container carries it — account 3 is
    `226fb540-b801-46a1-9612-09ffd6a973fe` (measured 2026-08-22) — set by the
    platform, not by Sophie, so it cannot be copied from another account or
    pasted into the wrong box the way `FORGE_ACCOUNT` was. A hook that posted
    it plus a uuid→number map on the settings doc would make the account tag
    self-correcting, with the posted `FORGE_ACCOUNT` as the fallback for an
    unmapped uuid. NOT BUILT — it needs a hook change, and a hook change only
    reaches a session when Sophie re-pastes the environment's Setup script
    (session init has no network, so the pasted copy is static: this container
    ran a hook a day older than the served one).
  - **A chat can fix ITSELF for its own session**, no waiting: prefix its
    hook commands in `/home/user/.claude/settings.json` with
    `FORGE_ACCOUNT=3 ` (settings and hooks are re-read per event, so it takes
    effect on the next one), and `POST /api/chatfeed/account {chat,
    account:"3"}` to tag the registry for turns already posted. The hook reads
    the env var on every post and stamps it, so the prefix is the durable half
    of the two — the manual tag alone is overwritten by the next post.
  - **Chats on account 3 from before this was found are tagged `2` and there
    is no way to tell them apart from real account-2 chats** — the tag is all
    that was ever recorded. The environment was created 2026-08-21, so the
    mislabeled ones are only ever that recent.
- **Cloud environments on ACCOUNT 2 — there are TWO, both named "Default",
  and only one is used (measured 2026-08-10 via `list_environments` +
  `list_sessions`/`get_session`).** Telling them apart matters, because the
  Setup script is a per-environment field and pasting it into the wrong one
  looks identical to pasting it into the right one:
  - `env_01NCcMuoimJBkNbag4JrEGZx` — name "Default", description **empty**.
    **This is the one every session actually runs in**: all 19 sessions back
    to Aug 3 were on it, including this file's own chats.
  - `env_01PpZpGDKFXqhCj3ZieoBUkH` — name "Default", description "Default -
    trusted network access". Nothing observed running on it.
  Both were created 2026-07-26 within 0.23s of each other, i.e. auto-
  provisioned at account setup — Sophie did not make two. **A chat can settle
  which environment anything is on by calling `get_session` on its own
  session id and reading `environment_id`; never infer it from behaviour.**
  (This corrected a live wrong diagnosis: differing hook versions across
  chats were blamed on "two environments" when in fact every chat shared one
  and the healed ones had each been healed BY HAND.)
- **Missing an id you need?** Ask Sophie to paste the URL from her address bar
  while she's on that page, build the exact link from it, and ADD THE ID HERE
  so no future chat has to ask twice.

## Live app
- **Deployed:** https://imageforge-q125.onrender.com (Render.com, **Starter**
  instance — $7/mo, always-on; Sophie upgraded Aug 2026)
  - Hub: https://imageforge-q125.onrender.com/
  - Test Station: https://imageforge-q125.onrender.com/test
  - Picture Book (Miracles): https://imageforge-q125.onrender.com/book
  - Illustrated Zine (Talking to Myself): https://imageforge-q125.onrender.com/talking
  - Gallery: https://imageforge-q125.onrender.com/gallery
  - **Secretly a Witch** (public witchy app): https://imageforge-q125.onrender.com/witch
  - **youwereinmydreams.com → the dream feed (bought Aug 2026, Hover).** The
    front door is `dream-host.js`, mounted above `express.static` in
    `server.js`: on that host `/` IS the dream app (`public/dreamapp.html`),
    `/dreamfeed` 301s to `/`, `robots.txt` keeps the API and the studio out,
    and a studio page typed on that host 301s to the feed. Every other host
    is untouched — `/dreamfeed` still serves the page on onrender.
    **ON A WIDE SCREEN THE FEED IS A MASONRY DESK, and the phone is untouched
    (Aug 2026, her own `Dream Feed Web` canvas: "a fun masonry layout, and I
    want it to look good on a desktop. But not on the mobile site").**
    **THE FIRST PORT WAS A GRID AND SHE SAW IT IN ONE LOOK ("you didn't even
    do the masonry layout") — the cause is worth knowing, because it is a
    phone rule leaking into a desk.** `fitCard` cuts a dream's words to its
    PICTURE's height (her rule: side by side, matched so neither leaves a
    hole) — true and right in ONE column, and in columns it is the thing that
    kills masonry, because it makes every card with a picture exactly one
    picture tall, so the columns end level. **On the desk the words are not
    cut to the picture at all**: a flat 12-line fold, so a short dream makes a
    short card and a long one makes a tall card, which IS the layout. The same
    mistake had a second half: the day divider was drawn as a full-width band
    with fresh columns either side, which forces every column to end level a
    second time — it rides INSIDE a column now, as it does on her artboard.
    Two more things not to undo. **The columns are real elements filled
    shortest-first, built in JS — never `column-count`**: multicol re-balances the whole feed
    when one card changes height, and opening a dream changes it by a whole
    picture, so every card after it would jump columns while she reads the one
    she just tapped. And **the desk's whole look rides on `data-shape` /
    `data-ar` / `--r`, written on every card and read ONLY inside `@media
    (min-width:900px)`** — that is what keeps the phone byte-for-byte what it
    was. The desk's header button is deliberately NOT hidden while a dream is
    open (unlike the phone's bottom bar, which yields its seat to the floating
    close): it sits in the flow, so hiding it shrank the header and slid the
    feed up under her mid-tap. Test:
    `node scripts/test-dream-desktop.js` (both widths). The artboard and what
    the port changed: `docs/dream-feed-designs/`.
    **The domain needs three flips, all doable from her phone:** Render → the
    service's Settings → Custom Domains → add the apex and www; Hover → DNS →
    `A @ 216.24.57.1` and `CNAME www imageforge-q125.onrender.com` (Hover has
    no ALIAS, so the apex is an A record; leave the MX records alone or her
    email stops); Firebase → membry-df528 → Authentication → Settings →
    Authorized domains → add both hostnames, or Google sign-in fails on the
    new domain with nothing in the UI to explain it. Test:
    `node scripts/test-dream-host.js`.
  - **secretlyawitch.com → the witch app (July 2026).** The server is
    host-aware: on `secretlyawitch.com` the witch app serves at `/`, old
    Shopify-storefront paths 301 to `WITCH_STORE_ORIGIN` (default
    `cod-god-inc.myshopify.com`), old `/blogs/*` 301 to the on-site blog at
    `/blog` (+ `/blog/:slug`, rendered from Firestore by `blog-public.js`;
    preview via `/blog?public=1` on the onrender host), and `robots.txt` /
    `sitemap.xml` are served for SEO. The onrender host is unaffected. DNS
    lives at **Hover** (not Shopify); the flip checklist is in
    `docs/secretly-a-witch-todo.md` (Domain section).

## LINKS THAT OPEN THE iOS APP — hand her an https link, not a scheme
**Sophie, 2026-08-25: "is there anyway to do links that go directly and open
in my actual iOS Deck Factory app?"** Yes, two ways, and only one of them is
worth putting in a reply.
- **Give her the ORDINARY page url** —
  `https://imageforge-q125.onrender.com/playground`,
  `…/chats?chat=<slug>`, `…/review` — and on her phone it opens the app on
  that tool instead of Safari. That is a **universal link**: iOS reads
  `/.well-known/apple-app-site-association` (served by `applinks.js`) at
  install/update and remembers which paths are ours. Nothing about the link
  looks special, so it works in a reply, a note, a message, anywhere — which
  is exactly why it is the one to use.
- **`deckfactory://<tool>` still works and is NOT for her.** Any Tool raw
  value plus `home`/`gallery`; the widget deep-links through it. But a custom
  scheme is only tappable where something treats it as a link, and in most of
  what she reads it renders as plain text — so keep it for the widget, a
  Shortcut, and page-to-app hops.
- **THE PATH LIST IS A CONTRACT ACROSS TWO FILES that nothing but a test
  compares** — `LINKS` in `applinks.js` (what the site claims) and
  `ForgeLinks.map` in `ios/ImageForge/ForgeLinks.swift` (what the app knows).
  Claimed-but-unknown opens the app on nothing; known-but-unclaimed never
  reaches it, and **both failures are silent on her phone**. Add a path to
  BOTH; `node scripts/test-applinks.js` fails if they drift.
- **A LINK TAPPED INSIDE THE APP IS NOT A UNIVERSAL LINK — iOS never hands
  one back to the app it is already in (2026-08-25, Sophie: "it didn't work",
  and she was in the Deck Factory app).** That is the whole of the first bug
  report, and nothing about the site half was wrong: Apple's own CDN was
  serving the association file and the build carried the entitlement. Every
  web view here passed a tapped link to `UIApplication.shared.open`, which on
  one of OUR urls opens **Safari** — so the link she tapped to reach a tool
  took her out of the app instead. `ForgeLinks.open(url)` is asked FIRST now
  (in `ChatFeedView`'s `createWebViewWith` and `GatedWebTool`'s navigation
  policy) and routes into the same `handleDeepLink` a real universal link
  walks into, so a link means the same thing wherever it is tapped. **A new
  web view that opens links must ask it too** — `node
  scripts/test-applinks.js` sweeps every `UIApplication.shared.open` in the
  app and fails on an unguarded one (a Settings deep link is exempt).
  The **configured server's host counts as ours** for this, though it can
  never carry a universal link — the entitlement names one fixed domain.
- **The query rides along**, which is what makes a link land on ONE THREAD:
  `?chat=<slug>` and `?view=news` reuse the pending flags a tapped push
  already sets, so there is one mechanism and not two.
- **Only claimed paths are claimed** — the public pages (`/witch`,
  `/selfcare`, `/dreamfeed`, `/fruit`), `/desktop`, and `/instagram` (the
  MOCKUPS page, a different thing from the app's `instagram` tool) keep
  opening in Safari, deliberately.
- **The app half needs a TestFlight build** (the Associated Domains
  entitlement), the site half ships with a deploy. Until she installs a build
  carrying it, every one of those links just opens the page in Safari as
  before — no broken state either way.

## Render plan: STARTER since Aug 2026 (don't diagnose free-tier symptoms)
- **The service runs on the $7/mo Starter instance** (`plan: starter` in
  `render.yaml`; confirmed live on the dashboard). Two free-tier problems are
  simply gone, so **do not explain a slow load with either of them**:
  - **No spin-down.** Free services slept after ~15 min idle and the next
    visitor ate a ~30–60s cold start. Starter never sleeps, so there is no
    cold start except the ~30–60s right after a deploy or restart, while the
    new instance boots.
  - **No 750-hour monthly cap.** The free tier's per-workspace hour budget
    (which could suspend every free service until the 1st) does not apply.
    "ImageForge is hard-down late in the month" is no longer a running-hours
    question.
- **CPU went 0.1 → 0.5 vCPU** (RAM is still 512MB, unchanged — the streaming
  discipline around big audio/video buffers still matters exactly as much).
  So the **server's own** work got roughly 5× the CPU: ffmpeg (film stitching,
  Episode Editor / Cutting Room renders, pause detection), sharp (webp copies,
  HEIC re-encodes, MPC prep), zip building.
- **Model time did NOT change** and it dominates most waits: gpt-image-2,
  Replicate, Whisper, ElevenLabs and the LLM calls all run on someone else's
  hardware. A ~30–90s medium image is still ~30–90s.
- **BUILD PIPELINE MINUTES CAN RUN OUT AND SILENTLY STOP EVERY DEPLOY
  (measured 2026-08-19).** ~10 straight deploys failed overnight; the real row
  said "Build canceled: your workspace has run out of build pipeline minutes
  for the current billing period." The service keeps serving its LAST
  successful build while main keeps merging, so **a merged PR is NOT live
  until you verify the change on the live page** — a watcher that greps the
  served page for a new marker is the honest check. Every merge burns build
  minutes, and many chats merging all day burns the month's budget. The fix
  is Sophie's, one screen: Render dashboard → Workspace Settings → Build
  Pipeline → **Set spend limit** (raise it; needs a payment method) —
  pipeline tasks re-enable immediately and the next deploy ships everything
  merged in the gap. Without that, every deploy waits for the billing-period
  reset. Do NOT keep pushing retrigger commits at this error — the build is
  canceled before it starts, whatever the code says.
  **A DOCS-ONLY MERGE IS FREE — put `[skip render]` in the squash-merge
  commit TITLE (Sophie's call, 2026-08-19).** Render skips the deploy
  entirely when the pushed head commit's message carries that marker, and a
  skipped deploy burns ZERO build minutes. Nothing under `docs/` is served,
  so a docs-only diff never needs a deploy, and the next deploy carries the
  docs out anyway. **Since 2026-09-15 auto deploy is OFF, so no merge builds
  at all and the marker saves nothing** — keep writing it as belt-and-braces,
  but the build minutes are no longer what it is for. Measured: 88 of 604 pushes in two weeks (~15%) were
  docs-only. Use it when the WHOLE diff is **docs/ or a root `*.md`**
  (CLAUDE.md is not served either) — a mixed merge must build.
  **AND IT IS WORKING, WHICH ALSO MEANS IT IS NOT THE LEVER (measured
  2026-09-01 over all 1,321 merges to main since Aug 1).** 147 of them
  changed only docs/ or a root .md — 11% of merges — and the ones that built
  anyway burned **129 minutes, about 7% of the month's 1,780**. Compliance
  went 0/84 in the two weeks before the rule landed to **23 skipped, 1 built**
  in the last full week. So the minutes are spent by the sheer NUMBER of
  merges (~43 a day, median build 78s), not by docs, and chasing docs further
  buys almost nothing. At that rate the 1,000 free minutes last ~17 days and
  the overage is a few dollars a month — cheap. **The thing that actually
  hurts is a custom pipeline-minute limit**, which converts that few dollars
  into the silent deploy outage above. (Starter build minutes are $5/1,000 past the included **1,000** —
  Render's own 70%-warning email, 2026-09-01, says "1000 available free
  pipeline minutes this month"; this file said 500 until then. There is also
  a WARNING EMAIL at 70%, which is the early notice the Aug 19 outage never
  had: it names the workspace and says overage is auto-charged at $5/1,000
  UNLESS a custom pipeline-minute limit is set, in which case builds PAUSE at
  that limit until the next billing period. So a custom limit is what turns
  a spend cap into a silent deploy outage — check that screen before raising
  anything. The $25
  Performance tier is 16-CPU build hardware for giant compile jobs — this
  repo's build is a small npm install, so it would cost 5× for nothing.
  Don't suggest it.)
- **The keep-awake self-ping is now redundant but harmless.** `server.js`
  (bottom, the "Keep-awake" block) still fetches `/api/talking/ping` every
  10 min via `setInterval` — an **internal self-ping**, not an external uptime
  monitor / cron / GitHub Action (there is NO external pinger in any of the
  four repos; don't go hunting for one). It was the free-tier compromise
  against spin-down. Left in place deliberately: it costs one request per
  10 min and it is the safety net if the instance is ever moved back to Free.

## Dating book — "The Sophie Experiment"
Sophie's long-running dating-memoir project (square coffee-table book from ~50
Portland dates). The full brief, her own planning docs/mockups, illustration
**style prompt formulas**, essay & infographic lists, and prior-chat transcripts
live in **`docs/dating-book/`** — read `docs/dating-book/THE-SOPHIE-EXPERIMENT.md`
first for anything dating-book related. Art uses the `wtr` watercolor LoRA.

## Terminology (Sophie's usage)
- **"app" = the iOS app.** When Sophie says "the app," she means the native
  iOS app (SwiftUI), not the web. Icons/behaviours she describes there may be
  SF Symbols / platform-native (e.g. the "sparkles" star is Apple's SF Symbols
  `sparkles`: big star bottom-RIGHT, medium star left, small star top —
  verified against the actual glyph July 2026; an older note here said
  bottom-left, which is wrong. The witch web app's `STAR` const in
  `witch.html` is an exact bezier-fit match of it).
- **"web app" = the web app** (the `public/*.html` pages served by Render,
  e.g. `/witch`).

## What it is
A hub for making illustrated projects (card decks, picture books, sticker
sheets, zines, single images). Home screen (`/`) is a grid of project types;
each opens a focused workflow that shares the same house styles.

## Deliverables → the in-app gallery (ALWAYS)
- **Any image deliverable made for Sophie — in a chat, via the web generator, a
  pipeline, anything — goes into the iOS app's "My Creations" gallery**
  (`CreationsView.swift`) so she sees it on her phone next to everything else.
  This is the default hand-off surface; don't leave deliverables only as chat
  attachments or web-gallery entries.
- **No exceptions, and never withhold a batch to avoid "cluttering" it.** If
  Sophie asked for images — a set, options, a 20-image backlog, anything — EVERY
  one goes in. She decides what's too much for her gallery, not you. The only
  things that stay out are genuine throwaways she didn't ask to keep (failed
  tests, rejected re-rolls). When in doubt, post it. (The gallery tiles are
  uniform squares, so batch size never breaks the layout — that's not a reason
  to hold anything back.)
- **How the gallery works:** it reads Firestore `users/{uid}/creations` in
  project `membry-df528`, ordered by `createdAt` **DESC**. Normally those docs
  are written by the app's Cloud Functions under the device's **anonymous-auth**
  uid, so images made outside the app never appear on their own — you must write
  the doc yourself with the Admin SDK.
- **The gallery is PAGED (Aug 2026) — 60 at a time, then an "Older" button.**
  It used to be ONE capped 60-doc query with no way to ask for more, so
  creation 61 and everything behind it was unreachable. That is a hard truncate
  the same shape as the Assets tab's old one, and it hid almost everything:
  1,396 creations existed, 442 of them made in eight days, so the visible
  window had shrunk to about a day and Sophie reported her older images as
  gone. **Never diagnose that report as data loss** — check the count first
  (`node scripts/find-gallery-uid.js` prints it per uid).
  `ForgeService.fetchCreationPage(limit:after:)` returns items plus a
  `DocumentSnapshot` cursor; `hasMore` and the cursor are derived from the
  SNAPSHOT count, never the mapped items, because a doc with no usable url is
  dropped from the page but still occupies a slot.
- **Tiles decode DOWNSAMPLED, and both image caches are cost-bounded.** A
  gallery tile is ~110pt but its url is a full 1024x1536 picture (~6MB once
  decoded), so paging back through hundreds of them would be a gigabyte of
  bitmaps. `CachedImageView(url:contentMode:maxPixel:)` decodes to the tile's
  size via `CGImageSourceCreateThumbnailAtIndex` (~0.4MB) and keeps the
  downloaded BYTES on disk, so the popup and Save-to-Photos still get the
  original. Leave `maxPixel` nil for anything shown large.
  **The download is still full-size** — there is no server-side thumbnail for
  creations (unlike `scripts/selfcare-thumbs.js` / `webp-assets.js`), so
  paging deep costs real bandwidth. Worth building if she pages a lot.
- **Label your images (July 2026).** The hook turns the markdown link text of
  a Firebase image URL in your finished reply into the asset's DESCRIPTION,
  shown on the Assets tile + lightbox (Sophie reviews with ♥/notes there). So
  always write meaningful labels — `[Penny — the blue Kleenex](url)`, never
  `[p01](url)` or a bare URL. Identical images de-dupe server-side by content
  hash, so posting the picture inline AND the link files ONE asset. The full
  labeling rule — including the re-encoded-copy trap no hash can catch — is
  *LABEL every image you deliver* in Design rules; this bullet is the hook
  mechanics, that one is the rule.
- **AUTO-FILING (July 2026):** the chats' Stop hook (`post-to-feed.sh` v3) also
  files image deliverables automatically via `POST /api/gallery` — any Firebase
  Storage image URL in the finished reply, plus image files sent with
  SendUserFile. So the normal flow needs NO manual gallery step in
  hook-equipped sessions. Still post manually (below) when the hook is absent,
  for non-image types, per-image prompts/styles, or true generation times on
  a backfill.
  **It also scans the turn's RAW tool activity, so an image a chat merely
  TOUCHED (read, verified, copied a url of) used to be filed into that chat
  unlabelled — see `docs/wip-asset-filing.md`** for the mechanism, how to spot
  one (no `description`, caption reads `from <chat>`) and the measurements.
  **GUARDED SERVER-SIDE SINCE AUG 2026 (`asset-guard.js`, in the `assetsOnly`
  branch of `POST /api/gallery`)** — so it reaches every chat, including ones
  on ancient hooks, with nothing to re-paste. Three rules, and they judge ONLY
  a background catch (that door, plus no description and no curated caption):
  a **prose** delivery and any **labeled** filing are never touched, so "it
  can be in two places" and a chat curating a photo into its own tab both work
  exactly as before.
  - **Labeled elsewhere → refused.** A catch may not create a tile for a url
    already filed WITH a label in a DIFFERENT chat (matched by url, then by
    md5 when that misses — which catches a renamed copy and costs no extra
    Storage read). 144 of the 759 catches on file are this.
  - **A server-derived display copy → refused** (`thumbs/`, `drops/_thumb/`).
    A thumbnail is labeled in no chat, so the rule above can never see it —
    and investigating the first stray filed a thumb of it straight back in.
  - **A Dump photo → LABELED, never refused.** It files carrying its album's
    name ("Dump — Dinner party #3"), read from `forge-drops`. **Refusing
    these was built first and reversed by measurement**: all 90 `drops/`
    records are unlabeled background catches, the 18 in the dinner-party chat
    included, and those are a review workflow Sophie uses — her pull and a
    stray are the same POST. The problem was never that they were filed, it
    was that they tiled nameless.
  - **The safety net is intact for anything a chat MAKES** — a picture labeled
    nowhere still files (523 of the 759), including the unlabeled source sheet
    behind a batch of labeled cut-outs.
  - Still true, and not bugs: the guard needs the deliberate filing to land
    FIRST (a catch that beats it leaves both records — the md5 union and the
    sweep clean up after that), and a RE-ENCODED copy is different bytes under
    a different name, so nothing joins it. `POST /api/gallery/asset-cleanup`
    (with `dry` first) still removes strays.
    **DO NOT trust `asset-cleanup` to be scoped by `chat` — measured
    2026-08-15 it is not.** Called `{chat:"image-pipeline-design", dry:true}`
    against a tab holding **22** images it answered `wouldDelete: 23`, i.e.
    more records than that chat has. Running it without `dry` on the strength
    of "it's chat-scoped" would have deleted other chats' tiles. **Always run
    it dry and check the number against the chat's real `total`
    (`GET /api/gallery/assets?chat=`) before running it for real** — and if
    the two don't line up, label the stray instead and leave it. A duplicate
    tile beside a labeled one is a much smaller problem than a wrong delete.
    Also measured the same day: a stray that shares a url with an
    already-labeled record can survive re-POSTing the label (the write
    answers `ok:true, deduped:true` and lands on the labeled doc every time,
    never the other one), so the tab keeps one nameless twin. Known, not
    worth chasing.
  - Tests: `node scripts/test-asset-guard.js` (the whole decision table with
    fixtures, no network).
- **NO contact sheets — review happens IN the gallery, labeled (July 2026,
  Sophie's rule).** Every image deliverable goes into the gallery / the chat's
  Assets tab **individually and LABELED** (the label is its `description` — what
  she reviews by), and she reviews it there, one image at a time. **Do NOT build
  or send a stitched contact sheet** — not in chat, not as a file. When you
  re-roll an image, give the new version a **NEW id** and **KEEP** the old one
  in the gallery as history (label it "…v1 — superseded"); nothing is
  overwritten or deleted. To label an already-filed asset, re-POST
  `POST /api/gallery { assetsOnly:true, chat, url, description }` (it dedupes by
  url and updates the label in place).
- **One command does upload + post:**
  `GALLERY_UID=<uid> node scripts/post-to-gallery.js --file ./image.png --prompt "…"`
  uploads the local file to membry Storage, makes it public, and writes the
  gallery doc — so generate → post is a single step (use `--url` instead for an
  already-hosted image). Needs the `membry-df528` Admin service account via
  `STORY_FIREBASE_SERVICE_ACCOUNT` (preferred — see the two-key note below) /
  `FIREBASE_SERVICE_ACCOUNT` (fallback) / `GOOGLE_APPLICATION_CREDENTIALS`, and the target uid
  (neither in the repo). Doc shape:
  `{ type, url, prompt, stickers:null, createdAt:Timestamp, source, style? }`.
- **The target uid is Sophie's device anonymous-auth id** — a personal
  identifier, so it's kept OUT of the repo (pass `--uid` or set `GALLERY_UID`;
  store it in Render env / a local `.env`, or Sophie shares it in-session).
  Anonymous uids change on reinstall — re-find with
  `node scripts/find-gallery-uid.js` (scans every user's creations via
  collectionGroup and ranks them; the device is the uid with hundreds of
  creations and a recent date).
- **Timestamps = when the image was actually made.** The app sorts by
  `createdAt`, and multiple chats post concurrently, so pass the true generation
  time (`--created <ms>`) — that's what keeps everyone's deliverables in correct
  chronological order (and puts a genuinely-fresh batch at the top). Don't reuse
  a stale/skewed server clock just because it's embedded in a filename.
- **Images must live at a public URL** the app can fetch (Firebase Storage in
  either project, made public). Temporary Replicate/OpenAI URLs expire — upload
  to Storage first (`saveToFirebase()` in `server.js`, or `bucket.upload()`).
- **Opening a creation shows MODEL · QUALITY at the top of its caption (Aug
  2026).** The doc carries `model` + `quality` as separate fields (older docs
  have only the single `style` label, "ChatGPT · medium" — the app falls back
  to it), so anything filing a creation should write both. `prompt` stays the
  line underneath.
- **Saving to Photos hands over a FILE, not a UIImage or a data resource**
  (`PhotoSaver`): the original PNG/JPEG/HEIC bytes when the download already is
  one (sniffed by magic number — webp is excluded, Photos rejects it), else a
  PNG re-encode, staged in tmp and added with `shouldMoveFile`. Photos' own
  error text is shown in the toast, and a refused permission raises an alert
  with **Open Settings** — `requestAuthorization` never re-prompts after a
  "Don't Allow", so a toast there was a dead end.

## Stack
- Single-file Node/Express backend: `server.js` (~"v11").
- Static frontend in `public/` (`index.html` = hub, `test.html`, `book.html`,
  `talking.html`, `gallery.html`); shared design system in `public/forge.css`.
- Deployed on Render via `render.yaml`. Env vars set in the Render dashboard
  (all `sync:false`): `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`,
  `FIREBASE_SERVICE_ACCOUNT`. **The server's Firebase project is
  `deckfactory-43176`** (verified 2026-07-11 via a Storage upload URL) — NOT
  membry-df528 as previously documented. The iOS app's direct Firestore reads
  (Story Boards, GoogleService-Info.plist) use `membry-df528`, so data written
  by the server and data read directly by the app live in DIFFERENT projects.
  `/api/story` bridges this with `STORY_FIREBASE_SERVICE_ACCOUNT` (a membry
  service-account JSON) — set it in Render or the boards read as empty.
- **Two service accounts → two env vars (same names for the server AND for a
  chat's local scripts).** Set BOTH so anything works, including the
  network-proof direct-to-Firestore paths:
  - `FIREBASE_SERVICE_ACCOUNT` = **Deck Factory** (`deckfactory-43176`) — the
    chat feed (`forge-chat-feed`), assets/votes, thumbs, Compare pages, Storage.
    Used by `server.js` and `scripts/post-feed-direct.js`.
  - `STORY_FIREBASE_SERVICE_ACCOUNT` = **Memory / membry** (`membry-df528`) —
    the iOS "My Creations" gallery and Story Boards. Used by `/api/story` and
    `scripts/post-to-gallery.js` (which falls back to `FIREBASE_SERVICE_ACCOUNT`).
  For a chat's cloud environment, set both as **environment variables** in the
  environment settings (NEVER commit either to this public repo). Only ONE
  default environment? Set both there once and every session has them.

## Image generation
- OpenAI `gpt-image-2` (the zine; single/sticker can also use DALL·E 3).
- Replicate Flux LoRA house styles in `MODELS.replicate` (`server.js`). Each has
  a trigger word prepended to the prompt. A model may pin a `version` hash or
  leave it `null` to resolve the latest from Replicate on first use (cached).
  Styles: Gouache (gosh), Painterly (pnt), Sketchy (special), Book Illustrations
  (vict), Watercolor Drawings (wtr), PWC Scans (tok), **HOONIE** linocut
  (`sageryza/hoonie`, trigger `HOONIE`, suffix "linocut relief print, white
  background", 40 inference steps — applied automatically server-side).
- Committed style previews live in `public/samples/<seg>.webp` (used by the Test
  Station tiles). Regenerate with `node scripts/gen-samples.js` against a running
  server (needs `REPLICATE_API_TOKEN`).
- `saveToFirebase()` uploads generated images to Firebase Storage for permanent
  URLs + the gallery; without `FIREBASE_SERVICE_ACCOUNT` images are temporary
  (~1hr) Replicate/OpenAI URLs.

## Reference images — Sophie's names (Aug 2026)
The style/character references the app attaches automatically. **These are the
names Sophie picked, so use them when talking to her about a look** — she named
them off the reference sheet, not off the old filenames.
- `refs/sage-sandy-mirror.png` — **sage sandy mirror**, her scanned
  ink-and-watercolour page ("datescan0013"). The Playground's **Sandy mirror**
  style (called ChatGPT until 2026-08-24 — the tile called ChatGPT now attaches
  no reference at all),
  the Story Room's "draw it here", the Evan film. Was `evan-film-style.png`.
- `refs/sophie-book.png` — **sophie book**, the character card behind the
  Sophie toggle. Was `sophie-character.png`.
- `refs/dream-mystery.jpg` — **dream mystery**, her diary-comic page ("1000
  Dreams Per Night"). Movies' "Dreamy pencil", the dream illustrator, the
  zine, Character Creator, and since Aug 2026 the Playground's **Dreamy**
  tile. Was `movie-style.jpg`, and it ALSO existed as a
  second slightly-different crop at `refs/style.jpg` (the zine's own copy) —
  Sophie spotted the duplicate and asked for one file, so `style.jpg` is
  deleted and the zine reads this. **Since Aug 2026 the file is the
  full-quality photo (3370x4096) she downloaded herself** — the old copy was
  a 1170x1364 SCREENSHOT with an Instagram speaker icon baked into its
  corner and the frames cropped. Same filename on purpose: every reader
  loads `refs/dream-mystery.jpg` from disk, so nothing else changed.
- `storage:witch-school/refs/sophie-snake.png` + `sophie-animals.png` —
  **sophie snake** / **sophie animals**, the Pastel pair. The Playground's
  Pastel, the Witch School lesson cards, the self-care stickers and stamps.
  Were `style-1.png` / `style-2.png`; the old Storage objects were COPIED not
  moved, so they still exist and can be deleted once this has been live a
  while.
- Deliberately NOT renamed, at her ask: `richard-scarry-1/2/3.png`,
  `flat-cool.png` / `flat-busy.png`, `evan-character.png`, and the four
  `storage:hoonies/refs/style-*.png`.
- Her full name list is banked at `GET /api/chatfeed/verdict?chat=references-render-plan&sheet=ref-names`.

## The Chat app (forge-chat-feed) — every chat posts its replies
- `chatfeed.js` (`/api/chatfeed`, page at `/chats`, iOS tile "Chats") — one
  feed of every project chat's replies so Sophie can read/listen in one place
  (picture icon per chat, tap-to-expand, ▶ Play renders the neural voice on
  tap (cached), orange "Open" button deep-links back to the Claude session,
  List/Tiles view toggle, newest message at the top, reply box).
- **Do NOT also post replies by hand** — the hook already does it, and manual
  posts would duplicate. Check `ls /home/user/.claude/hooks/post-to-feed.sh`;
  only if it's MISSING (hook absent in your session) fall back to the old
  manual post: `POST https://imageforge-q125.onrender.com/api/chatfeed` with
  `{ "chat": "<short-chat-name>", "text": "<reply>", "tldr": "<TLDR>" }`
  (x-studio-token header when gated). The hook names the chat from the git
  branch (e.g. `dating-book-design`); set `FORGE_CHAT` env to override.
  **Unnamed sessions keep a per-session tail** (July 2026): every unnamed
  session's branch is `claude/new-session-<random>`, and stripping the suffix
  merged four different sessions into ONE chat called "new-session" — so a
  generic slug (`new-session`/`session`/`untitled`) now gets 6 chars of the
  session id appended, e.g. `new-session-7f3e9a`, one chat per session.
  **A chat's identity is its SESSION, not its slug (Aug 2026 v2):** branch
  names get REUSED and naming conventions change, and both broke threads for
  real — first two sessions sharing a slug interleaved into ONE thread (the
  chat Sophie renamed "Imprint"), then the untangle claimed that slug with a
  placeholder session id, which ORPHANED the thread (no live session could
  match it, so even its own session forked away and Imprint went silent).
  Resolution is now **session-first**: the registry doc records which session
  owns each slug, and a session that already owns a chat posts there FOREVER,
  whatever its branch says today. The slug only matters on a session's first
  post — it keeps the pretty name if unclaimed, else forks to `<slug>-<sid6>`.
  The hook resolves once per session (`GET /api/chatfeed/resolve?chat=&session=`)
  as a hint, and **every post — feed, gallery, and Sophie's lifted messages —
  also carries `session`, so the server re-resolves authoritatively** (a stale
  hook cache can't mis-file; `explicit:true` marks a deliberately shared
  FORGE_CHAT, never re-keyed). A merged/repaired chat leaves a registry
  tombstone `{ movedTo }` that redirects anything still addressed to the old
  slug. Untangling: `POST /api/chatfeed/session {chat, sessionId}` binds a
  thread to its REAL session id (never a placeholder — that's what orphaned
  Imprint) and clears that id off every other doc; `scripts/merge-chat.js`
  moves a mis-filed message/asset span between chats, re-keys votes, and
  plants the tombstone (`--dry-run` first; the Imprint repair is its header
  example).
- **THE CHATS PAGE HEALS ITS OWN STALENESS (2026-09-02, Sophie: "build self
  heal").** The Playground's rule (`plBuildCheck`) ported to the page she has
  open most: `GET /api/chatfeed/build` answers `pageBuildId('chats.html')`,
  serveGated stamps the same hash on the page, and `chBuildCheck` (chats.html)
  compares them on `visibilitychange`→visible and every five minutes, reading
  the stamp LAZILY (it is appended after the page). **It reloads ONLY when
  nothing would be lost** — `chHolding`: words in any composer/note/search box,
  a focused field, an open sheet (`.askwrap`), an open Compare page or deck
  (`.pageview` — the pill is exactly what she is using there), an open picture,
  Select mode, a running autoscroll, a playing voice, or a tap in the last ten
  seconds. From inside a thread it reloads onto `?chat=<slug>` (the door a
  tapped push uses) and never onto a `?chat=` left over from a link. Why: #2048
  put a clobbered page live for two hours and the app kept it on her phone
  past the repair. Test: `node scripts/test-chats-selfheal.js` (the real page,
  every guard driven BOTH ways — held, then released and reloading — so a
  broken check cannot pass as a cautious one; the page script is ONE IIFE, so
  `window.__chHeal` is the test's hands on the closure).
- **A RUN OF REPLIES WITH NOTHING FROM HER BETWEEN THEM IS ONE MESSAGE IN
  THE THREAD (2026-09-02, Sophie, looking at four CLAUDE rows in ten minutes:
  "why do these all show as separate messages").** They are separate TURNS: a
  chat that backgrounded a deploy watcher and subscribed to its own PR wakes
  once per event, each wake is a turn, and the hook posts one message per
  turn. **The data is untouched, on purpose** — a doc is keyed by
  session+turn, and a turn that stays silent is indistinguishable from a
  crashed hook (the 2026-08-28 silence). The THREAD merges instead:
  `mergePlan` in `chats.html` draws a run as ONE row — the newest's id, time,
  Play and bookmark, with the whole run as its body **oldest first, each part
  under its own small time**, and "4 replies" in the head. **It shipped first
  as a FOLD (newest shown, the rest hidden behind "3 earlier replies") and she
  corrected it the same hour: "i need the messages combined into one message,
  so i can read them in the right order, not separated and hidden."** Nothing
  is hidden and there is nothing to open. `MERGE_MS` (60 min) is the dial.
  Never merged: anything from her (her message is what ends a run), a live
  draft (its own row until the next rebuild), a bookmarked message (a bookmark
  on a merged row would point at the wrong turn). A chapter heading ends a
  run. The thread search matches the whole run's text; a jump into any turn
  of a run (`focusMessage`, via `data-mids`) opens the row and scrolls to that
  part; `refreshDraft` keeps the parts across a node swap. The home list, the
  Update tab, the Questions view and every count are untouched.
  **A test fixture that stacks filler replies seconds apart now merges** into
  one short row — three fixtures were re-spaced two hours apart
  (`test-chats-jump-message`, `test-chats-questions`,
  `test-chats-viewer-escape`); a new one needs the same, or a message from her
  between the fillers. Test: `node scripts/test-chats-dribble-merge.js`
  (verified failing against the pre-merge page).
  **AND EACH REPLY IN A RUN FOLDS ON ITS OWN (2026-09-11, Sophie: "messages w
  two replies - make it so i can collapse each reply individually").** Nothing
  above changed: a run is still ONE message with every part open, in the order
  it was written — her 2026-09-02 correction stands and the parts are never
  hidden until she taps one. What was missing is that four long turns are four
  long turns of scrolling with no way to put any of them away. **THE HEADING IS
  THE FOLD** — the part's own small time line, the whole of it, not a caret to
  hit (the pinned heading's rule, and judge.js's piles before it) — so
  `.m-partt` is a `<button>` wearing the class it already had. Four things not
  to undo: **shut, the part shows its first line beside its time** (a column of
  bare timestamps is a message she has to reopen to identify, and it is the
  same line `.m-preview` leads the row with); the tap **stops propagation**,
  because a tap on `.m-full` toggles the reading-aid autoscroll and pre-fix a
  tap on that time line really did start the page walking (MEASURED, 72px in a
  second); **the fold survives a repaint** — `partShut` is a module-level map
  keyed by the part's own message id, since the thread rebuilds on every poll
  and a fold living on the node alone springs open seconds later (the Story
  Room caption's own bug); and it is **MEMORY, never localStorage** — a
  reload opens everything, which is the safe direction, and this is how she is
  reading the thread right now rather than a setting. A jump to a folded turn
  OPENS it (`focusMessage` — landing on a collapsed reply is landing on
  nothing), and a message that is not a run carries no fold at all. Test:
  `node scripts/test-chats-part-fold.js` (the real page headless — every
  assertion a MEASUREMENT, since a heading with the right markup that folds
  nothing, a fold whose CSS never landed, one that springs open on the next
  poll, and a tap that also starts the autoscroll all look identical in the
  source; verified failing 11 pre-fix).
- **A REPLY CAN BE BLOCKED BY THE SANDBOX EGRESS FILTER, and the symptom is a
  reply stuck as its partial draft (found live 2026-08-10).** The cloud
  environment's proxy scores outbound POST bodies and answered one with a 403
  HTML block page — with curl exit 0, so the old hook recorded it as posted
  and the full reply never reached the app. The trigger that time: the reply
  contained the literal setup.sh pipe-to-shell one-liner inside a long
  message (the same string alone in a small body passes — it's a scored
  filter, not a string match). Two consequences:
  - **IT HAPPENED AGAIN 2026-08-28, IN A CHAT THAT HAD JUST READ THIS RULE, AND
    THE FIX IS A URL RATHER THAN BETTER INTENTIONS (Sophie: "where's ur
    message").** The reply recommending she switch the environment's Setup
    script to the one-liner naturally CONTAINED the one-liner, so the post was
    blocked and her screenshot showed her message with no answer under it. The
    hook behaved correctly — v10 refuses to record an unconfirmed post, so it
    retried on every later event and was blocked every time, i.e. **a reply
    carrying that string is not delayed, it is unpostable forever.** Describing
    the command in prose is the rule, but a command she has to TYPE is no use
    on a phone, which is why the rule kept losing. So the line is SERVED:
    **`/setup-line.txt`** — she opens it, selects all, copies. A chat handing
    her any pipe-to-shell command links that file and never writes the string.
    **AND THE ONE-LINER IS NOT FOR THE SETUP SCRIPT FIELD (Sophie, the same
    day: "no").** Session init has no network, so a Setup script that fetches
    installs nothing — her flat correction retired that recommendation within
    the hour. The field takes the FULL `/setup.sh` paste; the served line
    stays only for telling a RUNNING session to self-heal.
  - **Don't put the literal `curl … | bash` one-liner in a reply.** When a
    reply needs to tell Sophie or another chat about the self-heal, DESCRIBE
    it ("fetch /setup.sh with curl and run it with bash", or point at this
    file) — the hook POSTs your reply through the same filter.
  - **Hook v10 records a turn as posted only AFTER the server answers
    `ok:true`** — a blocked or failed post stays un-recorded and the next
    event retries it. A stuck partial draft from an OLDER hook is repaired by
    re-POSTing the full text to /api/chatfeed with the turn's key (`turn` =
    the transcript uuid of the user message that started the turn; the server
    upserts onto the same message doc).
- **Self-heal if you're NOT posting, or posting with an OLD hook (any chat).**
  Run `curl -fsSL https://imageforge-q125.onrender.com/setup.sh | bash`.
  (Curl works HERE and not in the Setup script for one reason: a running
  session has network, session INIT does not — see the trap above before
  suggesting this to Sophie as an environment setting.) It
  rewrites the hook + `/home/user/.claude/settings.json`, and — **contrary to
  what this file said for weeks — it takes effect IMMEDIATELY, in the session
  you run it in** (proved live 2026-08-07: a container holding the Aug 1 hook
  with only Stop + UserPromptSubmit registered ran the script mid-turn and the
  very next tool call posted a live draft with `working:true`). Hooks and
  settings are re-read per event, not only at Claude Code startup. That wrong
  claim is why a stale hook was left in place for days with a manual-posting
  workaround instead of a five-second fix.
  - **Check whether YOUR hook is current before believing a feature is
    broken:** `grep -c PostToolUse /home/user/.claude/hooks/post-to-feed.sh`
    (0 = pre-v7, no live drafts and no turn-start ping — the Chats app's
    "still writing…" and its pink working tint can never fire for you).
  - A brand-new session gets whatever the ENVIRONMENT's pasted setup script
    installs, so self-healing per session is a patch, not the cure — the cure
    is the fetch-the-current-one Setup script (see the LIVE DRAFTS note above).
  - Only if the hook is genuinely MISSING and can't be reinstalled, post by
    hand: `POST https://imageforge-q125.onrender.com/api/chatfeed`
    `{ "chat":"<branch-name>", "text":"<reply>", "tldr":"<TLDR>" }` — and ONLY
    then (once the hook is back it posts, and a manual post would duplicate).
    No auth header needed (STUDIO_TOKEN is off on the live server).
  - **If the curl / POST is BLOCKED (network error, not a 4xx):** your cloud
    environment's **Network access** doesn't allow `imageforge-q125.onrender.com`
    (the default **Trusted** level only permits package registries + GitHub +
    cloud SDKs — a Render app isn't on it). This blocks BOTH the reinstall and
    the hook's own POST, so the chat can never appear in the Chats app until
    it's fixed. A chat CANNOT change its own network policy — tell Sophie: edit
    the environment (cloud icon) → **Network access → Custom** → add
    `imageforge-q125.onrender.com` to **Allowed domains** → keep "Also include
    default list of common package managers" checked → Save. It's a one-time
    per-environment flip.
  - **Network-proof path — post straight to Firestore (works even when the
    server is blocked).** With the **Deck Factory JSON** (the deckfactory-43176
    Firebase Admin service account) available as `FIREBASE_SERVICE_ACCOUNT`, a
    chat can write the reply directly to the `forge-chat-feed` collection
    instead of curling the API: `printf '%s' "$reply" | node
    scripts/post-feed-direct.js --chat <name> --tldr "<TLDR>"`. Firestore is on
    `googleapis.com`, which is allowed on EVERY network level, so this posts
    even on the locked-down Trusted level. Provide the JSON as an **env var on
    the environment** (`FIREBASE_SERVICE_ACCOUNT=<json>`, same as the server —
    never commit it to this public repo); if it's missing, ask Sophie for it.
    The robust setup is to configure one environment once with all three:
    Network access (add the domain), the Setup script (auto-poster), and
    `FIREBASE_SERVICE_ACCOUNT`.
- **THE HARNESS JOINS HER BACK-TO-BACK MESSAGES INTO ONE USER RECORD, and the
  hook's queue reconciliation has to know it (hook v18, 2026-08-27).** Measured
  in this fix's own transcript: she sent two messages in a row, the
  `queue-operation` record held the FIRST alone and the user record held the
  first AND the second joined by a blank line. The reconciliation matched on
  WHOLE normalised text only, so the queue entry found no home, posted as a
  message of its own, and **her first message landed twice** — once alone and
  once inside the joined record. Live count that day: **12 such pairs across
  her 3,768 messages**. A queue entry is matched against a record's SEGMENTS as
  a FALLBACK now, and one record can absorb several of them (`aliases`, a list,
  where there used to be one `alias`). **Whole text still wins first** — two
  passes, so nothing about the old matching moved and a joined record can never
  out-bid the plain record that really is that message; and it stays a multiset,
  so repeating a short phrase can't let the first swallow the second. Test:
  `node scripts/test-chats-first-message.js` (verified failing 2 pre-fix).
- **A CHAT NAMED AFTER ITS SESSION ID SWALLOWS HER MESSAGES — hook v19
  (2026-08-28, Sophie: "issues w chat hooks today · slug").** Measured that
  morning: **3 of the day's 29 chats carried a meaningless slug**
  (`chat-5d92c228`, `chat-9cac7ca2`, `new-session-56f2b0`) against **one in the
  whole four days before it** — and `chat-9cac7ca2` held **exactly one message:
  hers, unanswered for seven hours**, because no session was reading a thread
  nobody could recognise. (It had also self-archived at 01:16 under the bug-fix
  rule; her message landed at 01:56, into a chat that was already asleep.)
  - **The cause was the branch scan accepting ONLY `claude/*`.** A session
    created with no repo attached clones it mid-turn and lands on an ORDINARY
    working branch — `chat-5d92c228`'s own first reply says it: "The repo isn't
    cloned in this container. Let me attach it." Its branch was
    `panels-background-draw`, which `claude/*` never matched, so the name fell
    through to `chat-<sid8>` — and **session-first binding makes that permanent
    on the first post**, so the chat can never recover its own name.
  - **The fix is two halves, and the second one is why the slug does not move.**
    The scan now takes a plain working branch when there is no `claude/` one
    (default branches — main/master/develop/trunk — say nothing about the work
    and are skipped), and `name_repair` fills the **DISPLAY name** on a chat
    already stuck with a fallback. It never touches the slug: a moving slug is
    what orphaned "Imprint". It only ever fills a BLANK name, on a slug that is
    plainly the fallback shape, once per session, backgrounded.
  - **The three already stuck were repaired by hand** with `POST
    /api/chatfeed/rename` — cosmetic, reversible with her pencil, and it re-keys
    nothing. That is the repair for any future one too; a merge is heavier and
    is hers to approve.
  - **The FORK tail is NOT this and is working as designed** — 8 of the day's 29
    chats carry a `-<sid6>` tail because the harness re-uses branch names, which
    is what keeps two sessions out of one thread. What it costs is real though:
    her Playground back-to-top question lived across FOUR slugs
    (`playground-back-to-top`, `-01hhcz`, `-01k54v`, `chat-9cac7ca2`), none of
    them knowing the others' history.
  - **AND THE ENVIRONMENT'S PASTED HOOK IS STALE — v14 against the repo's and
    the served one's v18 (measured the same morning in this container).** The
    Setup script field holds a LITERAL copy, so it froze whenever she last
    pasted it; sessions starting at `/home/user` (multi-repo) or with no repo
    run that copy, missing v15/v16/v18 — the two fixes for her back-to-back
    messages vanishing and landing twice. **Not what broke today** (no duplicate
    shape in the live window), but it is one field of hers: re-paste the Setup
    script into the environment. Sessions starting inside imageforge run the
    repo's copy and are unaffected.
  - **THE NEXT PASTE IS THE LAST ONE (2026-08-28, Sophie: "it's gotta be an
    easier way than paste every time" — and her "no" to a fetching Setup
    script: session init has no network, so a curl in that field installs
    nothing).** The pasted settings now register a command that prefers the
    IMAGEFORGE CHECKOUT's hook (`/home/user/imageforge/.claude/hooks/…`) and
    falls back to the baked copy only when no checkout exists. The checkout is
    cloned fresh from main every session, so once this paste is in, a hook fix
    reaches every imageforge-touching session with the deploy — nothing to
    re-paste per version. Resolved at EVENT time (hooks re-read per event), so
    a repo cloned mid-turn upgrades on its very next event — the exact
    no-repo-at-start shape that produced today's nameless chats. The
    registration UPGRADES an old fixed-path entry rather than sitting beside
    it. Test: `node scripts/test-setup-registration.js` (the block extracted
    from the real generated setup.sh, driven against fixtures).
  - Test: `node scripts/test-chat-slug.js` — the naming block EXTRACTED from the
    live hook (never copied) and driven against real fixture repos; verified
    failing 3 against the pre-fix rule via `FORGE_HOOK_FILE`.
- **A HOOK THAT CRASHES POSTS NOTHING AND EXITS 0 — THE SILENCE LOOKS LIKE A
  DEAD CHAT, NOT A BUG (2026-08-28, Sophie: "ur chat hook is weird").** Her
  chat showed ONE mangled message in the app while its transcript held eleven
  turns. The cause was in v18's own queue reconciliation: `segcells` is built
  from `users` BEFORE the loop, and an unmatched queue entry is APPENDED to
  `users` — so the next entry's segment pass walked a record `segcells` had
  never seen, `segcells[id(u)]` raised a KeyError, and the parser died. The
  hook's python is behind `2>/dev/null` and its output is consumed by the
  shell, so the whole thing printed nothing and exited 0: **no replies, none
  of her messages, silently, for the life of the session.** It needs TWO
  queued messages that match no user record — she sends afterthoughts while a
  turn runs, so it is not rare. `segcells.get(id(u)) or ()` is the fix, in all
  THREE copies (`public/setup.sh`, `docs/chats-autopost-setup-script.sh`,
  `.claude/hooks/post-to-feed.sh`), and `node
  scripts/test-chats-first-message.js` now drives that shape against the real
  hook (verified failing: it posted `[]`).
  - **A LIVE SESSION KEEPS THE BROKEN COPY** — the fix reaches a NEW session
    with the deploy, and an existing one only when it re-runs the setup
    script. A chat that has gone quiet in the app is worth healing before it
    is diagnosed as anything else.
  - **`scripts/backfill-chat-history.sh` HAD ITS OWN SILENT FAILURE, found in
    the same sitting:** `FORGE_BACKFILL=1 ${ACCT:+FORGE_ACCOUNT="$ACCT"} bash
    "$HOOK"` — the conditional expands AFTER bash has parsed assignment
    prefixes, so the shell read `FORGE_ACCOUNT=1` as the COMMAND NAME, died
    with "command not found", and the script still printed "done". It is
    `env FORGE_BACKFILL=1 …` now. **Any recovery tool that can report success
    without having posted is worse than no tool.**
- **A CHAT THAT NEVER POSTED CANNOT HEAL ITS OWN PAST — back it up on purpose
  (Aug 2026).** The hook BASELINES on its first firing in a session (only the
  latest turn posts), so fixing a silent chat also throws its history away.
  Measured 2026-08-22: **zero chats had ever been tagged account 3** — and the
  reason turned out NOT to be the missing-settings one first written here.
  Measured the same day from inside an account-3 session: its network reached
  the app, its Setup script had installed a current hook, and `FORGE_ACCOUNT`
  was set — to **`2`**. Those chats were posting all along, filed into account
  2's pile. **So diagnose a "silent account" by measuring the three settings,
  never by assuming they are unset** — a wrong value looks like silence from
  the outside and needs no backfill at all, just the right tag. The account-3
  environment ids and the fix are in the ACCOUNT 3 bullet up in *Dashboard
  deep links*. Recover a genuinely silent chat from
  INSIDE it (its transcript exists nowhere else):
  `bash scripts/backfill-chat-history.sh` diagnoses and posts nothing;
  `--go` posts every turn and every message of hers, oldest first; `--account 3`
  tags them when the environment doesn't. Re-running is safe (upsert by turn).
  Full rules in `docs/chats-app.md`; test `node scripts/test-chat-backfill.js`.
- **Sophie can reply in the app** (`POST /reply`, shows as `from:"sophie"`) — a
  chat picks up replies addressed to its chat name the next time Sophie messages
  it (`GET /api/chatfeed?limit=50`), then acts on them. **NOT on a timer.**
- **THE WAKE DOORBELL (Aug 2026) — the app is not read-only anymore.** Each
  thread has a composer; Send posts her message to the feed AND rings
  `POST /api/chatfeed/wake`, which fires the account's SWITCHBOARD chat over
  the public Routines API; the switchboard then wakes the target chat, which
  sweeps its feed replies and answers. Full design + the measured findings
  that shaped it: `docs/chats-wake-doorbell.md`. What EVERY chat must do:
  - **Register yourself wakeable, once per session** (no token, no Sophie
    step): create a no-schedule self-bound trigger with your own tools —
    `create_trigger { name: "wake: <your slug>", prompt: "<wake prompt
    below>" }` (omit cron/run_once — a poke-only routine), then
    `POST /api/chatfeed/wake-register { chat, session, triggerId, account }`
    (`session` = your `CLAUDE_CODE_REMOTE_SESSION_ID` without `cse_`;
    `account` = your `FORGE_ACCOUNT`). Write the trigger's prompt for a wake:
    "Sophie pinged this chat from the Chats app — sweep your feed replies,
    asset notes/votes and the to-do list, act, and answer."
  - **NEVER attach `text` to a wake fire** — a fire with text spawns a stray
    NEW chat; only a contentless fire re-enters the bound session (measured
    2026-07-31). The message always rides the feed, never the ping.
  - **Waking a sibling chat yourself** (fan-out, e.g. the morning-ideas
    flow): look it up in `GET /api/chatfeed/wake-registry`, post the task as
    a feed reply addressed to it, then `fire_trigger` its `triggerId` with NO
    text (same account only). If it shows in ListAgents it's awake —
    SendMessage it instead.
  - **The account-2 switchboard is the chats-app-messaging chat** (trigger
    `trig_01JWxYFQzEJVRxToP6EdDbmR`, token in Render env
    `WAKE_FIRE_TOKEN_2`). Its duties on a wake ping: `GET
    /api/chatfeed/wake-queue?account=2` → deliver each entry (SendMessage if
    the target is listed awake, else `fire_trigger` its trigger, no text; an
    entry naming ITSELF = just answer Sophie's message, never self-fire) →
    `POST /wake-done {chat}` each. Don't message Sophie about routine
    dispatches. Maintenance: its routine carries a placeholder
    `run_once_at` 2027-06-01 (kept so the routines UI shows it); when it
    fires, the routine self-disables — re-arm with `update_trigger`
    (new far-future `run_once_at`, `enabled:true`) or account-2 wakes die.
  - **Account 1 has no switchboard yet** — building it = any account-1 chat
    repeats the register step, Sophie mints its API token in THAT account's
    routines UI, and `WAKE_TRIGGER_1` + `WAKE_FIRE_TOKEN_1` land in Render
    env.
- **THE ARCHIVE WRAP-UP — what the chat was about and what went down (Aug
  2026, Sophie: "whenever I'm about to archive a chat the last message of the
  chat is them explaining what the chat was about … and that could go into the
  note at the top").** Measured that day: **73 of her 88 archived chats showed
  nothing but a name.**
  **Full details: *THE ARCHIVE WRAP-UP* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **A BOOKMARK CARRIES A NOTE AND A TAG SET — on a MESSAGE AND ON AN
  ARTIFACT, identically (Aug 2026, Sophie: "when i bookmark a message it offers
  a textbox to say whi i'm saving it. shud be same for artifact" · "also, both
  shud now have a set of tag buttons: to read, and 'important' level (1-3) -
  icons, and review finished feature, review bug fix or information/question
  answered").** Keeping either one opens the same box straight away and focuses
  it — the reason is in her head at that moment and nowhere else — and it stays
  under the thing for as long as it is kept.
  - **ONE RENDERER, AND THE WHOLE EDITOR IS THE KEEPING STEP ONLY (Aug 2026,
    two corrections, the second the settled rule).** First the tags: "those tags
    were supposed to only show up in the step when I'm actively bookmarking it.
    Either a chat or an artifact" — so they came off every later paint while the
    note box stayed. Then the box itself: **"the why keep this bookmark button
    should only show up at the time that I'm bookmarking it or if I un bookmark
    and bookmark again"** — the same sentence about the other half of the same
    node. So `mkBmkEdit(m, kind)` is drawn on ONE event, the tap that keeps the
    thing, and a message or artifact she kept last week carries NOTHING under
    it. An empty "Why keep this?" field under every kept thing is a box asking a
    question she already answered, sitting under things she is only trying to
    read.
    - **UN-KEEPING AND KEEPING AGAIN IS THE WAY BACK IN, and it loses nothing** —
      the bookmark toggle sends `bookmarked` alone, so her note survives and the
      re-opened box holds it. That re-keep is her own named gesture, not a
      workaround.
    - **NOTHING IS HIDDEN FOR GOOD:** her note leads that thing's row in the
      keep-pile in its own editable field (`.sr-note-in`), so naming a backlog
      never means opening each message. The pile is where a note is READ BACK;
      the keeping tap is where it is WRITTEN.
    - One node so un-keeping takes the whole editor with it; one renderer so a
      message and an artifact can never end up with two different sets of
      controls.
  - **THE READ BOX IS WHAT THE KEEP-PILE'S ROWS CARRY INSTEAD (Aug 2026,
    Sophie: "a rounded square check box that is empty with a gray outline and
    becomes red with a check in it when I read it I'll mark it manually").**
    `bmkRead`, hers to tick, on a message and on an artifact — a kept CHAT gets
    none, because a chat is not a thing you finish reading once. **Nothing
    derives it**: opening a thing is not reading it, so no view, scroll or tap
    anywhere else may set it. A rounded rectangle at the house 6px, never a
    circle (see *No pills* in Design rules — the old circular-icon exception
    was retired 2026-08-24). Her tick is what takes
    a thing out of the **To read** door's count.
  - **THE WORDS ARE A FIXED VOCABULARY** — `BMK_TAGS` in `chatfeed.js` and in
    `chats.html`, pinned equal by `node scripts/test-chats-bookmark-tags.js`,
    the same contract `TAGS`/`TAG_LIST` have kept since the archive sheet:
    `to-read` · `feature` (finished feature) · `bugfix` · `answered`
    (information / question answered). An unknown word is DROPPED server-side
    rather than refused, so an older cached page can never fail a save.
  - **THE IMPORTANCE IS A DIAL, NOT A FIFTH TAG** — `bmkLevel` 1-3 on its own
    field, in one segmented box: a thing has one level where it can carry
    several words. Each button is a meter of three bars with the ones above the
    level left faint, so the picture says "2 of 3" with no number to read;
    tapping the lit one clears it. Icons, never words — her ask.
  - **A PATCH TOUCHES ONLY WHAT IT NAMES.** Both routes (`POST /bookmark`,
    `POST /page/:id/bookmark`) take `note`, `tags`, `level` and `read`, and
    carry no keep-flag unless one is sent — so tagging can never un-keep a
    thing, naming one can never drop its tags, and a tick can never do either.
- **A BLOCK IN THE THREAD THAT COST NO OUTPUT TOKENS — `node
  scripts/chat-block.js post --chat <slug> --file scene.txt` (2026-09-08,
  Sophie: "could chats put an editable text block inserted into their chat,
  but NOT as output tokens").** A run of `> ` lines in a message is already
  ONE editable block with a pencil (`quoteBlocks`, 2026-09-07; her edit lives
  on the message doc under `blockedits[key]`, 4000 chars, autosaved). What was
  missing was putting one there without the model WRITING it. The script
  reads a FILE — a scene from the repo, a prompt, her own words back to her —
  quotes it and POSTs it through the ordinary feed route, so the bytes go disk
  → server and never through the model: nothing to post, verbatim by
  construction. `read --chat <slug>` prints every block with her edit where
  she made one (`--out file` writes the newest), which is how a chat gets her
  version back for the cheap input price. **THE BLOCK IS NOT PART OF THE
  CONVERSATION — that is the whole point (her words, the same hour: "so they
  don't have to read it back every turn").** When she edits one, the thread
  gets ONE LINE as her message, `Block <msgId>/<key> "…" was edited`, never
  the text; a chat that sees that line runs `read --id <msgId> --key <key>`
  and reads the words once, when it wants them. Three things: it is its OWN message
  (a separate doc, never inside the hook's reply — a run of the chat's rows
  merges on the page, so it still reads in place); a blank line rides as a
  bare `>` so the scene stays one block; and a file over the edit cap is
  REFUSED rather than posted as a block she could not save whole (split it,
  or post a Compare page). The key it prints is the page's own `tickKey`,
  pinned equal by `node scripts/test-chat-block.js`.
- **A LIST IN A REPLY WEARS A BOX ON EVERY ITEM, AND THE BOX HAS THREE STOPS
  (2026-09-03, Sophie: "could message lists automatically have a tick in the
  app" · 2026-09-04: "do a three way toggle so two press is an x three press
  is a note option that brings up a text box … a toggle default to for claude
  but also can set to 'just for me'").** A markdown list of 2+ or a run of 3+
  bold-led paragraphs draws a box at the head of each item (`tickList` in
  chats.html).
  **Full details: *A LIST IN A REPLY WEARS A BOX ON EVERY ITEM* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **THE PINNED LINK — if your work lives at a URL, PIN IT (Aug 2026, Sophie:
  "I'm constantly referring to a link to a page… I just wanna make that
  pattern more clear that chats have that option and make it the expected and
  common behavior for chats if a link is involved").** A pinned link sits
  directly under the chat's name, above the messages: one row, the title she
  gave it, one tap.
  **Full details: *THE PINNED LINK* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **THE PROMPT ON A PAUSED FILM — what drew the picture she just stopped on
  (`filmshots.js`, `/api/filmshots`, 2026-08-27, Sophie: "in the play pause
  feedback pinned video tool, add a way to see image prompts. example: hate
  of the game").** The paused screen already offered a NOTE; it now also
  offers **Prompt**, opposite it, and behind it the picture's label, its
  MODEL · QUALITY · SIZE caption and both halves of its exact prompt.
  - **THE WORDS ARE NEVER COPIED — only the TIMES are stored.** A film's doc
    (`forge-film-shots`, id = sha1(the film's url)) holds `[{at, url}]` and
    nothing else; the label, caption and both prompt halves are resolved from
    the chat's own filed pictures (`forge-chat-assets`) on every read. So a
    prompt corrected in the Assets tab is corrected in the player, and the
    exact-prompt rule keeps ONE copy of the text (*nothing stands between the
    source and the output*). The join is url, then FILENAME — one picture,
    two roads, `asset-union.js`'s own subject.
  - **NO MAP, OR NOTHING FILED FOR THAT SHOT → NO BUTTON.** The Assets tab's
    own silence: reading one picture's prompt believing it belongs to another
    is the one failure this must not have, and a label alone is not a prompt.
    Every film made before this simply looks as it always did.
  - **TWO DOORS IN.** A chat that CUTS a film knows its shot list and POSTs it
    the same turn it pins the film (checklist 3f) — exact, free. An EXISTING
    film is MEASURED: `scripts/film-shots-detect.js` finds the cuts with
    ffmpeg and matches each shot's own frame against the chat's filed
    pictures by perceptual hash (dHash). On her example — Hate of the Game —
    the reel v1, 5:42 — 39 cuts → 40 shots and **40 of 40 matched the right
    picture**, each the nearest candidate by a clear margin. **A shot it is
    not sure about is LEFT OUT, never guessed in** (`--loose` overrides; say
    so if you use it). No model call anywhere; it is bandwidth and ffmpeg on
    our own box.
  - **It rides BOTH hosts of the player** — the Chats app's pinned film and
    compare.js's video lightbox — because the door lives in the ONE shared
    `public/filmnote.js`, beside tap-to-note.
  - **The words stop above the button row, not at the bottom of the screen**:
    the scrubber, play and NOTE stay hers while she reads ("this prompt is
    wrong" is the likeliest thing she has to say about the picture she is
    standing on). Content opens by default and the half she picks rides along
    as she steps; a tap on the words puts them away and never reaches the
    film's own pause/play toggle underneath.
  - Tests: `node scripts/test-filmshots.js` (the map, the join and the
    detector's refusals — pure) and `node scripts/test-film-prompt.js` (the
    real page + the real filmnote.js, headless).
- **THE FILM WEARS OUR OWN TRANSPORT — `/filmbar.js`, and that is what ended
  the TINT (2026-09-10, Sophie: "the way a movie tints when it starts" · "how
  hard would that be?" · "go").** The grey wash over a film the moment it
  starts is **iOS's own controls overlay**, painted over any
  `<video controls>` — nothing in this repo draws it, and there is no flag
  that keeps the controls and loses the wash. So the film drops native
  `controls` and `window.__filmBar({wrap, video})` draws the bar: play/pause,
  the elapsed and total time, and a strip that seeks. Two players carry it —
  the Chats app's PINNED FILM and compare.js's VIDEO LIGHTBOX.
  - **WHAT IT COSTS, named:** AirPlay, picture-in-picture and the native
    fullscreen button are gone with the overlay. **An AUDIO pin keeps native
    controls** — there is no picture to tint.
  - **THE SCRIM WORKAROUND IS DELETED, NOT DISABLED** — `SCRIM_MS`,
    `scrimAt`, `scrimMs()` and the 64px "scrub bar exemption" band in
    `filmnote.js` all existed ONLY to coexist with an overlay no API reports.
    The exemption is now `e.target !== v`: the bar is a SIBLING of the video,
    so a tap on it simply is not a tap on the film. Not a rule to bring back.
  - **THE BAR IS ALWAYS ON SCREEN, deliberately.** A bar that fades
    reintroduces the exact tap ambiguity the scrim code papered over — a tap
    on a control that is not there yet.
  - **THE TRANSPORT IS THE FOOTAGE TRIMMER'S, LIFTED** — a 34px band around a
    6px bar (the `.mtick` rule: the band is the target, the bar is the
    picture), the fraction measured off the BAR's own rect, `‹ ›`-free because
    she is watching rather than marking. Unlike the trimmer a strip tap does
    NOT pause: nothing here is being marked.
  - **`destroy()` removes every listener** — compare.js reuses one
    `.cmp-vlb` wrap across opens, so a leak there is a bar per film.
  - **compare.js loads the module and only falls back to `controls` if the
    fetch fails** — a Compare page's film with no chat gets no filmnote, so
    the bar cannot ride on that load.
  - Tests: the transport section of `node scripts/test-chats-film-note.js`
    (the real page headless — the film asserted to carry NO `controls`, the
    bar's play really toggling, and a strip tap MEASURED as `currentTime`
    landing in the middle of the clip).
- **A SECOND, UNRELATED PIN — the PUSHPIN keeps a CHAT at the top of her list
  (Aug 2026, Sophie: "an option to pin chat to the top so they always show
  first when they come out of hiding and they never disappeared to the bottom
  if I don't look at them for a while").** Nothing to do with the pinned link
  above, and **not yours to set** — it is hers, tapped on the pushpin on the
  chat's row on the `/chats` HOME screen (it shipped in the thread header and
  she moved it: "I was assuming it would go right on the main page not inside
  of it"). Her override on the recency sort: a pinned chat leads every pile,
  and pinned chats keep their own recency order among themselves.
  - **The names are separate ON PURPOSE and must stay that way:** `pinTop` +
    `POST /api/chatfeed/pin-top` for this, `pinned` + `POST /pin` for the
    deliverable link (which stores an OBJECT under `pinned`). Express matches
    the first route, so a route named `pin` shadows the other one.
  - The whole sort is ONE tier in `sortedChatNames` (chats.html), which every
    list comes through — so the hidden pile, the archive, the ★ chip and the
    account tabs all obey it without knowing about it.
  - **The glyph is a PUSHPIN — round head, straight spike — never the Maps
    teardrop.** It shipped as a `map-pin` and she corrected it ("the pin
    that's like round with a metal thing sticking down from it — that's a
    different one that you made"). Don't drift it back.
  - Test: `node scripts/test-chats-pin-top.js`.
- **A THIRD PIN, AND IT IS A SCREEN — ON MY TRAY (2026-08-31, Sophie: "add a
  tab in chats called 'on my tray' where i can pin chats by their icons for
  what im working on rn — ex xi to do · review cards illustrations ideas ·
  triset · review cards").** The FOURTH list tab, leading the row, and the one
  answer none of the four marks above gave: `starred` lifts a chat inside a
  list of two hundred, where the tray IS the list — three or four chats and
  nothing else on screen.
  **Full details: *A THIRD PIN, AND IT IS A SCREEN* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **A PROJECT GROUPS ITSELF — THE STACKED CARDS IN A THREAD'S HEADER
  (2026-09-02, Sophie: "projects could auto group themselves, like all the
  triset chats, grouped in reverse chronological order, so i can go back and
  see all the triset chats from a single icon button on that chat page header
  · probably 3-4 stacked square cards · opens a page w hairline icon or list
  view · default icon, 3-up").** Three stacked cards beside the tag icon,
  drawn ONLY when the chat has siblings; the page is a home view
  (`homeView='project'`, `renderProject` in chats.html) titled by the project,
  a hairline ICONS · LIST row (sticky, opening on icons three across, no day
  headings — PHOTO'd: four chats on three days drew as a column under them),
  newest first, the archived siblings IN and dimmed and counted, across the
  accounts. Nothing is stored for the page.
  - **WHICH CHATS IS ONE RULE, `project-words.js`, shared with the server and
    MEASURED, not reasoned.** The harness names a branch from her first message
    SUBJECT FIRST (over her 788 live chats: `story-…` leads 42, `playground-…`
    37, `triset-…` 4), where a raw token count is noise (`button` 30, `new`
    25). So a project word is one that LEADS two or more slugs, minus the
    verbs and fillers the harness sometimes leads with (`remove-…`,
    `missing-…`, the `STOP` list); a chat is on its own lead word, on a
    `project` the auto-sorter FILED on it, and on any ESTABLISHED project
    (leading 3+) a later word of its slug or her display name carries. A chat
    on two things opens on its first and the page offers the rest as chips.
    Plurals fold (`panels`/`panel`). Measured the day it shipped: 615 of 761
    live chats carry the button, triset is exactly its 4.
  - **THE SORTER FILES `project` NOW, AS A TOP-UP** — one more field in the
    same end-of-turn call (`chat-sort.js`, `pickProject`; `projectBy:'auto'`,
    never over `projectBy:'sophie'`), offered the page's own vocabulary so it
    spells a project the way the page groups. It is NOT a folder: it files the
    chat nowhere she looks, so it is written whatever the category answer
    was. It reaches the chats whose slug says nothing (29 fallback slugs) and
    the ones renamed since (Similitude is the triset project). Chats asleep
    before this never get one and the word rule still covers them.
  - Tests: `node scripts/test-project-words.js` (the rule, pure, on a fixture
    shaped like her registry) and `node scripts/test-chats-project.js` (the
    real page headless — the button and its absence, the pile, three across
    MEASURED, the sticky view, back from a tile, the chips, the pill).
- **ORGANIZE — a chat can be filed and tagged from INSIDE it (Aug 2026,
  Sophie: "an ability to tag or categorize something from within the chat
  itself … an icon that says organize and then it pulls up the ability to tag
  and categorize which is already on the front page but so far it doesn't work
  within there").** The tag icon in a thread's header opens a sheet of her own
  words — one row of chips, several lit at once — which shipped as her FOLDERS
  (one per chat) over a fixed TAG vocabulary (many); both already existed and
  neither was reachable from a thread.
  **Full details: *ORGANIZE — a chat can be filed and tagged from INSIDE it* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **A LIT TAG IS ITS OWN PILE AND SHOWS EVERY CHAT WEARING THE WORD
  (2026-08-31, Sophie: "things get hidden in chats in multiple ways" · "come
  back to shud show allll not just ones not on another list" · "any tag shud
  show all" · "verify first - how does it work now").** A chip used to NARROW
  whichever list she was standing on, so every filter that list already applied
  went on applying — and they STACK. **Measured against her live feed before
  anything was changed: `come back to` is on 34 chats and the lit chip rendered
  ONE row.** The four that ate the other 33, each a chat she had filed under the
  word herself:
  - **the HIDDEN pile** — 23 of the 28 live ones, and nearly all of those by the
    bug below rather than by anything she did;
  - **the ACCOUNT tabs** — the survivors were 10/9/8 across accounts 1/2/3, so
    **no single account tab could ever have shown her the pile**;
  - **the BUG-FIX carve-out on ALL**, which drops a chat wearing both words —
    literally "ones on another list";
  - **the seven-day MORE fold** under the live list.
  So a lit chip is a PLACE SHE WENT, like ★ and the tray and the bug tab: it
  replaces the list rather than narrowing it, and none of the four apply. It
  reaches ACROSS THE ACCOUNTS for the tray's own reason — the account row is not
  even on screen while the lists row is, and a hand-picked pile silently missing
  two thirds of itself is exactly the filter she cannot see. **She picked the
  word; that IS the filter.**
  - **THE ARCHIVE STILL DOES NOT POP OUT** (2026-08-28: "archive doesn't pop out
    ur insane that's the point of archive") — but the count is NAMED under the
    list, because silently dropping 6 of 34 is the whole complaint. The archive
    has its own filter row for finding one in there.
  - DELIVERED is untouched: its rows are films and pictures, not chats.
  - Test: `node scripts/test-chats-tag-shows-all.js` (the real page headless —
    every assertion a MEASUREMENT, since a chat folded behind "More" and one
    that was never rendered look identical to any source assertion, and the
    account filter is invisible to one entirely; verified failing 7 pre-fix).
- **A PARK NEVER EXPIRED ONCE ITS REPLY AGED OUT OF THE LOADED FEED — the
  biggest of the "multiple ways", and it was nobody's filing decision
  (2026-08-31).** `chatHidden` asks "did this chat write anything after I parked
  it?" and could only ever answer it from the messages the page has loaded —
  **one feed read carries ~260 messages for ~770 chats**. So a chat auto-parked
  at turn start that replied a minute later fell back into the hidden pile the
  day its reply scrolled out of that window, and stayed there forever, because
  nothing was ever going to load it again. **Measured live: 125 of her 294 live
  chats were sitting in the hidden pile and 122 of them had no loaded message at
  all.**
  - **`repliedAt` on the registry doc is the evidence that outlives the
    window** — stamped by `chatfeed.js` in the one write that knows a turn
    FINISHED, carrying that reply's `postedAt`. It satisfies both rules
    `unparked` enforces by construction: monotonic (never `created`, which
    predates the park — the bug the note on `unparked` was written about), and a
    live draft never writes it. **`lastSeen` beside it is rewritten on every
    post — it is the chat's NEWEST message (measured 2026-09-02 on twelve real
    threads: newest on all twelve, first on none) and is not a substitute.**
    This line used to call it `created`; that was wrong.
  - **The loaded message always wins.** `repliedSince` is consulted ONLY when
    the page holds nothing for that chat, so the rule above did not move: a live
    draft still keeps a chat parked, and a reply loaded from before the park
    still keeps it hidden.
  - **`chatBack` was deliberately NOT given the same fallback.** It is the same
    bug, but popping 100+ filed chats onto her main inbox is a loud change she
    did not ask for. Worth raising with her; do not just do it.
  - **The already-stuck chats needed their own pass** — a shipped fix to a WRITE
    path leaves the existing records wrong (`/wrapup/rehers`'s lesson).
    `POST /api/chatfeed/repliedat-backfill` is free, dry by default, writes
    `repliedAt` and nothing else, and **never touches `hiddenAt`**: it supplies
    the missing evidence, it does not decide anything, so a chat she parked by
    hand that has said nothing since stays parked.
  - Test: `node scripts/test-chats-unpark.js`. Its harness also stubs
    `reviewHeld`, which had been undefined — **four `chatBack` assertions were
    dying on a ReferenceError on main and the runner never reached them.**
- **A BUG-FIX CHAT WEARS A BUG AND PUTS ITSELF AWAY (2026-08-27, Sophie: "add
  a tag on the chat ex bug fix - a picture of a bug in the list. start w just
  bugs" · "a bug fix tag button on the right in the header on all 3 account
  pages" · "chats tagged bug fix shud auto archive themselves if there's no
  problems or questions").** Three halves, one tag:
  - **THE MARK.** A chat labelled `bug fix` (or `bugfix`/`bug`/`bugs` — her
    dictation) draws a small Lucide bug at the front of its row, in the tile's
    name and in the thread's `<h1>` — the watch's slot, but in the quiet ink,
    not the marks' red: a bug fix is what the chat IS, never a debt she is
    owed. `TAG_MARKS` in `chats.html` is the table (one renderer,
    `tagMarkHtml`), and **the next picture-tag is a row in that table** —
    "start w just bugs" means the bug is the first, not the only shape the
    table will ever hold.
  - **THE BUTTON.** A bug icon at the right of the header's tool row on the
    chat list — the three account tabs are views of that list, so it rides
    all three (the Instagram icon's float, `#bugbtn`). Tapping it narrows the
    screen to the OPEN bug-fix chats; lit while on, sticky with the row's
    third tab (2026-08-28), and it LEAVES THE ARCHIVE ALONE — see the
    reversal in the three-lists section: the emptying as chats auto-archive
    is the feature, not a hole to plug.
  - **THE AUTO-ARCHIVE is the CHAT'S OWN job, at wrap-up** (see 3d in the
    checklist): tagged `bug fix` + nothing open (fix works and is merged, no
    problem left, no unanswered question of hers, `need` empty) → wrap-up,
    then `POST /api/chatfeed/archive {chat, archived:true}`. Anything open →
    stay live and name it. Nothing server-side archives for you — a wrong
    auto-archive hides a chat she is still waiting on, so the judgement stays
    with the chat that did the work. She finds them again on the bug button,
    in the archive, or by un-archiving.
  Tests: `node scripts/test-chats-bug-tag.js` (the real page, headless).
- **EVERY CHAT LIST IS SEPARATED BY DATE, AND THE DAY TURNS OVER AT 5AM
  PACIFIC (2026-08-28, Sophie: "separate chats by date" · "5am pst cut off").**
  A hairline heading — Today · Yesterday · Tue, Aug 26 — over the rows of each
  working day. The list was already newest-first, so this only NAMES where one
  day stops; nothing about the sort moved.
  - **The cut is hers and it is the whole point.** She works past midnight, so
    a reply at 2am belongs to the day she is still having — the clock's own
    midnight would cut one working night into two headings, which is exactly
    what a date heading exists to stop.
  - **Read through the IANA zone (`America/Los_Angeles`), never a fixed -8** —
    she says PST and it is PDT half the year, and an offset would put every
    heading an hour out all summer (the chat-icons sweep's own lesson). The
    hour is asked in WALL CLOCK terms rather than by shifting the instant five
    hours, so it still lands on 5am on a DST day.
  - **A PINNED chat gets its own `Pinned` heading, never a date one.** It sits
    above the sort by her override, so its date says nothing about where it is
    — read as a date it would put an older heading above a newer one and then
    repeat the newer one underneath it.
  - `dayKey` / `dayLabel` / `chatDayKey` / `mkDayRule` in `chats.html` are the
    one implementation, and the headings are drawn inside `renderList` and
    `renderTiles` — so every pile gets them from one place (live, ALL, ★, bug
    fix, the hidden pile, the archive) and a new pile needs nothing.
  - Test: `node scripts/test-chats-day-rules.js` (the real page headless, with
    an INDEPENDENT copy of the 5am rule in the test rather than the page's own
    arithmetic read back to itself; verified failing 10 pre-fix).
- **AND THE PINNED HEADING FOLDS (2026-09-02, Sophie: "make the pinned panel
  collapsible in chat app").** Her pushpin lifts a chat above the sort so it
  always shows first — and she has pinned **32**, so the block that was meant to
  be a shortcut had become the screen. PHOTO'd on her live list at 390x844
  before anything was built: **PINNED at y=282, TODAY at y=741**, i.e. her
  pinned chats filled the entire first screen and the current ones started below
  the fold — with the HIDDEN bar sitting directly above them already folding,
  and this block, the taller of the two, with no way to put it away. Folded,
  TODAY moves to **y=314**.
  - **THE HEADING IS THE FOLD** — the whole row, not a caret to hit (judge.js's
    piles rule) — so it is a `<button>` still wearing `.dayrule`: the same
    furniture, not a new control. No box and no fill; a rose bar here would read
    as a second HIDDEN pile one row under the real one.
  - **IT OPENS OPEN AND IS REMEMBERED** (`chats.pinshut` in localStorage).
    Default open because pinned chats exist to lead the list — her own ask, "they
    never disappeared to the bottom if I don't look at them for a while" — so
    folded has to be a state she chose; remembered because this is a list she
    comes back to all day, where judge.js's per-visit piles are a screen she
    passes through.
  - **THE COUNT SHOWS ONLY WHILE IT IS SHUT** (the archive summary's
    don't-say-it-twice rule — open, the rows are right there), and it is the
    count of the PILE she is looking at, never her whole `pinTop` set: the
    archive, the ★ chip and the hidden pile each carry their own pinned chats,
    and a heading saying 32 over a block of three is a lie about the screen.
  - **It rides `mkDayRule`, so every pile got it from one place** — live, ALL,
    ★, bug fix, the hidden pile, the archive — and both renderers skip the rows
    rather than hiding them, so a folded block is really out of the layout.
    The tap goes through `repaintKeepingBar('.pinrule')`: this block is at the
    TOP of a long list, so a plain `renderHome` would collapse the page under
    her thumb (the MORE fold's own lesson).
  - Test: `node scripts/test-chats-pin-fold.js` (the real page headless — the
    rows COUNTED off the rendered list rather than asserted in source, since a
    row hidden with CSS and a row that never rendered look identical to any
    source assertion; the tap asked with `elementFromPoint` at the heading's own
    centre; the lift, the count, the memory across a reload and the heading's
    viewport position all MEASURED. Verified failing pre-fix, where there is no
    `.pinrule` at all).
- **THE CHAT AREA IS THREE LISTS, AND THE ROW TAKES TURNS WITH THE ACCOUNTS
  (2026-08-28, Sophie: "i'm thinking about restructuring chat area based on bug
  fixes and deliverables, so they're on two separate lists" · "one tab ALL
  chats, in timing order · one - list of deliverables AS they're delivered. so
  - just the link to a movie, previews of images and whatnot · bug fix tab
  third" · "also have a toggle next to account switcher that goes back to 3
  tabs 1 per account").** One hairline row under the header with two modes,
  swapped by `#rowtog` beside the account switcher — the LISTS, or the ACCOUNT
  tabs it has always been.
  **Full details: *THE CHAT AREA IS THREE LISTS* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **THE ACCOUNT FILTER FOLLOWS THE ACCOUNT ROW, AND NEVER OUTLIVES IT
  (2026-09-15, Sophie: "does chat app default to only current account?" ·
  "shud be chronological").** It did, invisibly: the THREE LISTS are the
  default row and they take the ACCOUNT row's PLACE, so the tabs were off
  screen while their filter went on narrowing every pile to whichever account
  the iOS app is signed into. **Measured that morning with `appAccount:"2"`:
  of her 30 most recently active chats, 26 are on account 1 and 4 on account 2
  — the screen she opens was hiding 26 of her newest 30 (136 of 401 across the
  whole ALL pile).** One rule now, `acctRowOn()` in `chats.html`, shared with
  the code that SHOWS the row so the two cannot drift: the filter applies
  exactly while the row is on screen. Every row still carries its account
  digit, so a merged list still says which account a chat ran on. Two things
  found in the same sitting and fixed with it: the category chip's red badge
  was still account-scoped while its pile went cross-account on 2026-08-31,
  and the **★ chip was a dead control on the default screen** (`if(starOnly)`
  sat below the ALL branch, which returns). One measured and NOT changed: at
  390pt the masthead's six controls start at x=84 and the word "Chats" runs to
  x=95.7, so the bookmark button takes a tap on the end of the title — which
  control gives way is hers.
  **Full details: *THE ACCOUNT FILTER FOLLOWS THE ACCOUNT ROW* in
  `docs/chats-app.md`.**

- **AND THE NUMBER OF CHATS THAT HAVE ANSWERED HER RIDES THAT ROW TOO
  (2026-09-15, Sophie: "add number new chats unread").** The red "N answered
  you" badge has been on the ACCOUNT tabs since Aug 2026 — and the fix above
  left those tabs off the default screen, so the one count of what is unopened
  was painted where she cannot see it. The THREE LISTS carry it now, per pile
  (`listFresh` in `chats.html`): MY TRAY is today's tray, ALL is every live
  chat minus the bug-tagged ones (the ALL branch's own carve-out, so one reply
  is counted once), BUG FIXES is the open bug pile, and DELIVERED gets none —
  its rows are films and pictures, not chats. `chatAnswered` is the one rule,
  shared with the unread dot on a row. The badge is the COMPACT one and that is
  measured: the account row's 15px badge wants 0.7px more than a 390pt tab has,
  which wraps "BUG FIXES" and takes this hairline row from 28px to 39px; below
  360pt it drops its number and keeps the dot rather than overflowing onto the
  tab beside it. Full details: *THE NUMBER OF CHATS THAT HAVE ANSWERED HER
  RIDES THE ROW THAT IS ON SCREEN* in `docs/chats-app.md`. Test:
  `node scripts/test-chats-unread-count.js`.

- **THE UPDATE TAB IS GONE — SHE HAD IT TAKEN OFF (2026-09-14, Sophie: "get
  rid of the updates tab in chats").** It LED the account row from Aug 2026 as
  a whole VIEW rather than an account, and everything that screen owned went
  with it: **the one card per chat** carrying its newest Compare page and its
  last three pictures, **the ✓** that checked one off, **the three sections**
  (urgent · important · the rest) and the triage that picked them, **the two
  red boxes**, **the three queue boxes** — Come back to · In a minute · Maybe
  never, with the mint wash on `soon` — **the picking-and-filing gesture**, the
  tag sheet over a selection, the **Update** (`/brief`), **Review** and **To
  read** doors above the tabs, and the **TAG_RULES pin** that put a `waiting
  for a response` chat at the top of it. ~1,000 lines of `chats.html` and its
  whole stylesheet; 12 test files went with them. **This is history now, not a
  rule — do not rebuild any of it from git without her.**
  - **WHAT SURVIVED, and why:** the **Update CARD** a chat posts
    (`POST /api/chatfeed/update`) is untouched and still matters — the archive
    wrap-up falls back to it, and `sumRows`/`UPD_LABELS` still draw its three
    answers there. `notifSeenAt` is still stamped by the SERVER on her reply
    and is still what settles the `waiting for a response` **wristwatch mark**
    on the chat list (`seenFloor`, the old `newsFloor` renamed). `reviewHeld`
    still suppresses the pop-out for a chat already holding a `reviewHoldAt`.
  - **WHAT LOST ITS ONLY DOOR, named rather than quietly kept:** the
    **Instagram mockups** icon moved to the CHAT LIST (the bug button's rule)
    because `/instagram` is reachable from nowhere else. The **To read** door
    was the ONLY thing that ever set `bmkTag`, so the keep-pile grew its own
    **tag chip row** (`bmkTagRow` — the row that already drew the lit clear
    chip now draws the unlit ones, and a word nothing is wearing is not
    offered); without it she could mark a thing `to read` and never ask for
    the ones she had. The **Update** door to `/brief` went with the screen and
    nothing links `/brief` now — the page still works, and seating that door
    somewhere is hers to ask for. **Review** kept its own iOS tile and
    `/review`.
  - **AND THE SECOND HALF OF THE `to be reviewed` RULE DIED WITH IT** — the
    hold on her account lists was written by dismissing a card from that tab
    ("IF i dismiss manually from update tab"), and there is no dismissal now.
    Existing `reviewHoldAt` stamps still clear normally; nothing writes a new
    one.
  - **The queue chips are gone from the category row** — `come back to` is one
    of her ordinary labels again, and `in a minute` / `maybe never` only ever
    appeared while a box held something, so they simply stop appearing. Every
    chat's `newsQueue` field is left on its registry doc, untouched and unread:
    nothing is destroyed.
  - **The server routes are left in place** (`POST /news-queue`,
    `/notif-seen`, `GET /to-read`) — unreachable from the page, harmless, and
    the safe direction while a phone may still hold a cached copy.
  - `?view=news` / `?view=update` is still SWALLOWED by the page (an older
    push, an older iOS build, a saved link) and lands her on the chat list.
    iOS: `pendingUpdateTab` → `pendingChatList`, `forgePushOpenUpdate` →
    `forgePushOpenChats`, and a push naming no chat opens `/chats`.
- **STATUS CARDS — every chat keeps one, updated at the END of every turn
  (Aug 2026, Sophie's ask: "a line on what they need and a summary of what
  that chat is currently working on").** The card shows under the chat's name
  on the `/chats` home (list, tiles, and the Status view — the ask reads in
  rose). `POST /api/chatfeed/status { chat, session, need, doing }`:
  - **WRITE IT THE WAY SHE WRITES HER OWN NOTES (Aug 2026, measured against
    the real ones): telegraphic fragments, commas between, NO connecting
    words, ~30-60 chars.** Hers read "research it, karaoke, tabs" and
    "compare and Tinder templates" — that is the target. Not a sentence, not
    a summary, never a changelog: a chat pasted a 464-character release note
    into her field the day it shipped, which is what prompted this rule. The
    server truncates at 110 chars, but hitting the cap means you wrote the
    wrong thing.
  - **ONLY ONE LINE SHOWS, and it looks exactly like her own notes** (Aug
    2026, Sophie: "I want them the same as mine — italicized, not bold, not
    pink… they only need one line"). The row renders `note || need ||
    doing`: **a note SHE wrote supersedes your card entirely**, otherwise
    your `need` takes the line and `doing` is the fallback. So write the
    ONE thing worth her seeing — both fields are stored, but do not count
    on `doing` being read while a `need` is set.
  - `need` = what you need from her, with the size of the ask — "pick a
    palette, 10 seconds", "listen to two cuts". Send `""` when nothing is
    needed; an empty `need` is the honest default, and a stale ask is worse
    than none.
  - **AND IT GOES TO HER LOCK SCREEN VERBATIM, SO ASK — DON'T BARK
    (2026-09-15, Sophie: "one word notification feels aggressive").** A new
    `need` bells her without her bell (*a chat blocked on her rings* below),
    and `pushAlert('need')` sends the line with nothing in front of it — the
    2026-08-28 rule took "Needs you ·" off, so the sentence stands alone on
    the banner. The one she was looking at read **`deploy? one word`**. That
    is this rule followed to the letter and it lands as an order with a
    demand for how short to answer.
    - **Write the ask as a person would say it**: `ok to deploy?`, not
      `deploy?`. A verb with a question mark after it is a command, not a
      question.
    - **The size is a KINDNESS, not a quota** — "10 seconds", "1-4",
      "two cuts" tell her how much of her day this costs. **`one word` is not
      that**: it tells her how to answer, which is hers to decide. Drop it
      when the ask is already one beat.
    - Telegraphic is still right. Short and asking is `ok to deploy?`; short
      and barking is `deploy? one word`. It is four characters between them.
    - **That example is now HISTORY, not a card to write.** Deploying stopped
      being an ask on 2026-09-16 — she has the Deploy button on /waiting — so
      a `need` that asks to deploy is the wrong card whatever its wording.
  - `doing` = what you're on — "six lesson cards, drawing now". Clear it
    (`""`) when you finish.
  - `session` = `CLAUDE_CODE_REMOTE_SESSION_ID` without `cse_` — resolution
    is session-first like every other post, so the card lands on your
    effective chat whatever your branch slug says.
  - Refresh it at the end of ANY turn that changed your state (200 chars
    each; the fields you don't send are left alone). Stored on the registry
    doc, so it rides the feed's already-cached read — costs nothing.
- **The NOTE on a chat (`sophieNote`) is the where-things-stand line, mostly
  HERS (Aug 2026: "it's not really for the chat to read, it's for me") — but
  it is NOT locked to her ("it's not that I wanted the field to myself, I
  just wanted them to know how to write notes").** She writes it from the
  thread ("+ note for this chat"); it shows on the home row with no prefix.
  `GET /api/chatfeed/status` returns it as `note` — read it for context, but
  it is not an instruction and needs no reply.
  - A chat MAY write one (`POST /chatnote {chat, note}`), and the rule is
    **STYLE, not permission**: her length and her shape — telegraphic
    fragments, commas, no connecting words, ~30-60 chars. A chat filed a
    464-character changelog there and that is the failure to avoid. Prefer
    your STATUS CARD (above) for what you're doing; leave the note alone
    when she has written one you'd be overwriting.
  - **NEVER write test/probe text into it, or any other live field.** A
    deploy-watcher here POSTed the literal word `probe` as this chat's note
    to see whether the route answered — the write SUCCEEDED against the
    old code, and she found "probe" sitting in her app as a note to
    herself. Watch a deploy with a READ (`GET /status`, the build stamp),
    never a write to real data.
    **A MADE-UP CHAT NAME IS NOT A SAFE PROBE EITHER (2026-08-10, done
    again — same rule, different field).** Poking a new registry route with
    `{chat:"__nonexistent-probe"}` to confirm it was live CREATED that
    chat: Firestore's `set({field: <delete>}, {merge:true})` on a missing
    doc still writes the doc (empty), and `sortedChatNames` lists every
    registry key, so the fake name becomes a phantom row in her list. Two
    things to know if it happens: only the Admin SDK can remove it
    (`forge-chat-registry`, there is no delete route), and the registry's
    5-minute cache keeps serving the phantom afterwards until ANY write
    through the API invalidates it — a no-op write to a chat that really
    exists is the clean way to force that. Confirm a new route with a READ
    of the page (`curl /chats | grep <the new markup>`), never by calling
    the write.
  - **Never gate a field the app already writes behind a flag only a NEW
    build sends.** The `app:true` requirement did exactly that: the phone
    keeps a cached page for days, so her own edit was refused with
    "couldn't be saved" while the note she was trying to fix stayed put.
- **ANSWERING A QUESTION — answer it ONCE, at the top, plainly. THE BOLD ECHO
  FIRES ONLY WHEN SHE SAYS THE WORD "QUESTION" (2026-08-23, Sophie: "get rid of
  the directions for chats to bold question answers. it ONLY applies if i use
  the word question in my text eg i have a question, or my question is: or
  'quick question' etc. THEN it's bolded and put in the questions tab").** One
  rule with a switch on it, and the switch is hers:
  - **She did NOT say it → answer plainly and move on.**
  **Full details: *ANSWERING A QUESTION* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **YOU FILE YOURSELF — `POST /api/chatfeed/selffile {chat, session, labels}`
  (2026-09-01, Sophie: "chats choose their own" · "have them check in
  periodically in case the subject changes").** Name your own folder once you
  know what the chat is about, and **re-file yourself whenever the subject
  really changes** — her own example: something she asked you to RESEARCH
  becomes a REQUEST, and the folder that was right on turn one is wrong by
  turn ten. Re-check at wrap-up and whenever the work changes shape; a re-post
  is free and replaces your last answer.
  - **THIS REVERSES THE do-NOT-POST-A-CATEGORY RULE that stood from Aug 2026**,
    and the reversal is a measurement rather than a change of mind. That rule
    rested on one number — a chat-posted folder would come from "the same ~7%
    that ever post an Update card" — and **remeasured 2026-09-01 it is 98%**
    (229 of the 234 chats active in seven days had posted BOTH a status card
    and an Update card; 46% had left a wrap-up). The checklist at the top of
    this file and the hook's per-turn reminder are what closed that gap. You
    are already reading your own thread when you write those cards, so naming
    the folder there is free and better informed than the server's pick, which
    is a paid model call over a digest of your first two and last four
    messages (~2,400 tokens in, ~200 out — about 0.7c on claude-sonnet-5).
  - **THE PAID SORTER IS THE FALLBACK, not gone.** It still files any chat that
    says nothing, and it stands down the moment you file yourself
    (`catBy:'chat'` → `shouldAutoSort` answers `chat-filed`).
  - **WHAT THE WORK IS BEATS WHERE IT HAPPENED** — the rule below applies to
    you exactly as it applied to the sorter: a bug fix in the Story Room is
    `bug fix`, not `story`.
  - **The guardrails are enforced in CODE (`chatSort.selfFilePlan`), so a
    refusal is an answer and never a silent wrong write.** Read the `why` back:
    her filing is final (`catBy:'sophie'` and her `catNone` both refuse), an
    unknown word is DROPPED and named in `dropped` rather than invented, triage
    words are off limits (`look at` · `come back to` · `waiting for a response`
    · `to be reviewed`), and **"none" is a normal answer** — filing hides a chat
    from her main list, so a wrong folder costs her real work. Sending no labels
    rests the paid sorter for a day and changes no folder of hers.
  - Test: `node scripts/test-self-file.js` (the whole decision table, pure).
  The three rules the server-side sorter obeys, unchanged: **anything SHE filed is never touched** (`catBy`),
  **"none" is a normal answer** (filing hides a chat from her main list, so a
  wrong folder costs her real work), and **it never invents a folder** — her
  vocabulary is read live and taught by her own filing. Her two WHEN folders,
  `look at` and `come back to`, are off limits to it.
  **WHAT THE WORK IS BEATS WHERE IT HAPPENED (2026-08-24, Sophie: "if it's in
  the story room but it's just a bug fix for the story room then they shouldn't
  tag it story, they should just tag it bug fix — and that applies to all the
  other categories obviously").** Her vocabulary holds two different kinds of
  word and the sorter could not tell them apart: some name a SUBJECT AREA
  (`witch` · `story` · `film` · `dream app` · `tech` · `meta`) and some name
  WHAT THE WORK IS (`bug fix` · `new feature` · `research` · `failure` ·
  `built` · `quick question`). Every chat has a subject, so the subject always
  looked like the safe answer — which fills `story` with plumbing and leaves
  `bug fix`, the pile she reaches for when she wants to know what has been
  going wrong, empty. **It is enforced in CODE, not only in the prompt**: the
  model answers `kind` in its own field and `pickCategory` prefers it, so
  forgetting the rule would take an active "none". Three things not to undo — a
  `kind` that names a SUBJECT is ignored (or the field built to beat subjects
  carries one), an invented kind is refused like any other folder, and a kind
  with no subject beside it still files. `WORK_KINDS` is a HINT over her live
  vocabulary, never an addition to it; `GET /api/chatfeed/sort` prints
  `workKinds` so the day it goes stale against her words is measurable.
  Full rules in `docs/chats-app.md`; `GET /api/chatfeed/sort` shows the
  vocabulary and the counts; test `node scripts/test-chat-sort.js`.
- **Naming a chat: the Chats app is the source of truth (July 2026).** Sophie
  renames a chat with the pencil in its thread header; that writes `displayName`
  on the registry doc and is the name she sees everywhere. **The Claude app's own
  session title CAN BE READ, one direction only — the July 2026 claim that
  "nothing exposes a session's title" is STALE (re-measured 2026-09-08:
  `list_sessions` answers a `title` per session, and her renames are in it).
  So a rename she makes in the Claude app CAN be mirrored into Deck Factory;
  nothing can push one the other way, and hers wins either way.
  **Mirroring one: `list_sessions {mine:true, limit:100}` → id + title, join to
  the registry through each chat's `url` (`session_…`), and rename with
  `POST /api/chatfeed/rename {chat, name}`. TWO RULES.** (1) **Most titles are
  the HARNESS's auto-title, not a rename** — it writes one from her first
  message, so it near-twins the branch slug ("playground-back-to-top" →
  "Back to top button in Playground"). Measured 2026-09-08 over 96 account-3
  chats: 74 titles differ from the Deck Factory name and only **5** share no
  words with the slug. Word overlap against the slug is the tell — a rename of
  hers is short, lowercase and unrelated ("tape montage", "ms o hara",
  "stills"); mirroring all 74 would rename her whole app with machine
  sentences. (2) **A session's title is only listable from its OWN account** —
  an account-3 chat cannot read an account-1 session — so a sweep covers one
  account and must say so. (3) **NEVER write over a `displayName` she already
  set, and judge "recent" by `startedAt`, not by `lastSeen`** (2026-09-08,
  Sophie: "oops no just from today · undo others"). Two registry docs can
  point at ONE session — a re-bound or forked thread — so a title lands on
  both, and the older doc is the one carrying a name of hers: the sweep
  renamed a chat started two days earlier from her own `seedance` to today's
  title. Rename only the docs whose `startedAt` is inside the window you were
  asked for, leave a doc that already has her name alone, and name it in the
  reply instead. A chat reads what she calls it with
  `GET /api/chatfeed/name?chat=<slug>&session=<your session id>` →
  `{ chat, displayName, name }` — ALWAYS pass `session` (the
  `CLAUDE_CODE_REMOTE_SESSION_ID` without `cse_`): the returned `chat` is your
  EFFECTIVE slug (session-first — a fork or re-bound thread, not necessarily
  the branch slug), and that's the slug to use for pages, asset prompts,
  notes, and any other chat-keyed POST. Renaming is cosmetic and never re-keys
  a chat's history.
- **THE OPEN BUTTON'S LINK IS THE OWNER'S, AND IT WAS NOT GUARDED (2026-09-08,
  Sophie: "that's a bug, right?").** `sessionId` on a registry doc is the
  chat's OWNER and `resolveChat` guards it; `url` — the orange Open button —
  was written from whatever posted, unchecked, so the two could disagree and
  the button opened SOMEONE ELSE'S Claude session. Found live on
  `severance-api-multiple-frames`: all 872 of its messages are from session
  `018fYFNh…` while its url pointed at `01XwF5s…`. **Scope measured before
  anything was changed: 1 of 870 chats** — repaired by hand (there is no route
  that writes `url`, so a repair needs the Admin SDK). `keepsDeepLink` in
  `chatfeed.js` is the rule now — an unowned chat takes the poster's link, an
  owner keeps its own, and a post naming no session may not move one. The
  shape that does it is a post that skips session-first resolution (an
  explicit `FORGE_CHAT`, or a draft whose final post re-patched its `chat` and
  left the crumb behind). **`reg.account` has the same unguarded shape and was
  deliberately left alone** — a wrong account is a filing label, not a broken
  door. Test: `node scripts/test-chat-deeplink-owner.js`.
- **Assets curation (♥/✕ + notes, July 2026):** Sophie hearts/rejects images
  in a chat's Assets tab (tiles AND the lightbox), and the lightbox has a note
  box (under the image) she can send per image. Votes + notes live in
  `forge-asset-votes` (deckfactory, one doc per chat+url) and ride along on
  `GET /api/gallery/assets?chat=<name>` as `vote: "like" | "dislike"` and
  `note` per asset. When Sophie next messages a chat, it should check its
  votes/notes and act on them (favor the hearted ones, re-roll the ✕'d and
  anything noted "redo") — same review-loop pattern as writing notes, NOT on
  a timer.
- **Notes are a THREAD — WRITE BACK on the image (July 2026).** A note is a
  two-way conversation on that picture: she writes from the lightbox, and **the
  chat that made the image replies on the image itself**.
  **Full details: *Notes are a THREAD* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **Prompts on Assets images — POST THE PROMPT FOR EVERY IMAGE YOU MAKE (July
  2026).** Sophie taps **PROMPT** on an image in the Assets tab and the prompt
  covers the picture, with a **Style / Content** toggle (style left, content
  right).
  **Full details: *Prompts on Assets images* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **EVERY SEARCH BOX SPEAKS ONE GRAMMAR, AND SEARCHES AS SHE DICTATES (Aug
  2026).** Bare words are AND'd **within one message/image** (`witch keywords`
  = both, any order — her ask: two words she knows shared one message where one
  of them appears in hundreds of others), `OR` takes either, `-word` excludes,
  `"quoted"` keeps words adjacent (the old whole-field-as-one-phrase
  behaviour).
  **Full details: *EVERY SEARCH BOX SPEAKS ONE GRAMMAR, AND SEARCHES AS SHE DICTATES* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **THE SEARCH FILTERS — OPT IN, THREE-WAY, AND THE ROW THE NEXT ONES JOIN
  (Aug 2026, Sophie: "I'd like to add some filters to the search in the chats
  thing that are optional … one would be a filter allowing me to search
  through my messages versus Claude's messages" → "now: make the filters opt
  in" → "another filter to add can be archived as in does it search the
  archive or not or just the archive").** One `Filters` chip under the search
  box; the drawer under it is SHUT until she taps it.
  **Full details: *THE SEARCH FILTERS* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **THE ADVANCED SEARCH DRAWER — `/searchfilters.js` + `/searchfilters.css`,
  the ONE shell, on every page (2026-09-02, Sophie: "can u add settings - a
  toggle open advanced search in all pages - reusable shell - playground meta
  assets etc · search by low medium high, by date · you can put the heart x
  thing within the toggle").** The Chats drawer above WAS the design; it just
  lived inside `chats.html` where nothing could reach it, so the Playground and
  Meta Assets each grew their own loose row of chips instead — on bars already
  fighting the injected pill for width, with nowhere to put "only the high
  ones".
  **Full details: *THE ADVANCED SEARCH DRAWER* in `docs/chats-app.md` (moved from CLAUDE.md).**

- **EVERY CHAT HAS A LITTLE DRAWING BESIDE ITS NAME, AND IT SWEEPS ITSELF
  (`chaticons.js`, `/api/chaticons`, Aug 2026, Sophie: "the icons that just
  have big letters next to each chat and the update tab — I'd like to replace
  them with icons").** A chat with no `icon` on its registry doc drew a box
  with a giant letter in it; 356 were drawn by hand in one sitting and the
  rest arrive on their own.
  - **25 TO A SHEET IS THE WHOLE DESIGN.** One gpt-image-2 sheet in the pastel
    house style is ~6c at medium, so an icon costs **0.24c**; drawing each
    chat the moment it appeared would be a separate ~6c call, 25x the price
    for the same pictures. So the sweep WAITS until enough have piled up, and
    a brand-new chat wears a letter for a day or two. That is the trade, and
    it is the right way round. Measured 2026-08-15: **104 new chats in one
    hour**, which is why hand-running batches was never going to hold.
  - **It skips ARCHIVED chats** (her rule: "obviously skip archived chats"),
    the trash, and any chat with **nothing to draw from** — no display name,
    no note, no status/update card, and a generic slug (`new-session-7f3e9a`).
    There is no picture of an unnamed session and a wrong one is worse than a
    letter; it comes back into range by itself when the chat says what it is.
  - **It draws from the REGISTRY, not the threads** — her name for it, her
    note, the chat's own cards, its wrap-up, the slug. 23KB for 250 chats, so
    the reading costs nothing; Claude turns each line into one drawing subject
    (one call per sheet).
  - **It never touches the TRACER.** `/api/vector/sheet` draws, cuts AND traces
    every cell to SVG, and the trace is what hangs — two sheets stalled half an
    hour on one cell with the other 24 done, and pinning `ink` did not stop the
    second. An icon needs the CUT, never the SVG, so this calls `drawSheet` +
    `sheetPrompt` and vectorize's `slice`/`cutout` directly. The same lesson is
    in `scripts/gen-chat-icons.js`, which is still how you redraw a SPECIFIC
    set by hand (`--sheet <n>`, `--recut` off the banked sheet for free).
  - **The daily tick is hourly and the due check is in FIRESTORE** (`lastRunAt`
    on the module's state doc). This service restarts on every deploy, so a
    24-hour interval counted from boot would either never fire or fire on every
    restart — and the stored clock also means a dev container that boots the app
    spends nothing. The tick only runs where `RENDER_EXTERNAL_URL` is set.
  - **THE AUTOMATIC SWEEP KEEPS HER HOURS — 11am to 11pm PACIFIC (Aug 2026,
    Sophie: "i'm on pst not utc jsyk" · "11am-11pm").** Read through the IANA
    zone (`America/Los_Angeles`), never a fixed -8: she says PST but it is PDT
    half the year, and an offset would fire an hour out all summer. A HAND
    `POST /run` ignores the window — she asked for the hours the tick keeps,
    not a curfew on her own button. With the 20-hour due gap the run time drifts
    earlier each day until it hits 11am and settles there.
  - **ONE RUN AT A TIME, tick or hand** — found live: the tick fired four
    minutes into a hand run, each had read who was waiting at its own start,
    and a sheet's worth of chats was drawn and filed twice for about 6c.
    Nothing re-checks mid-run, which is right for one run and exactly what
    makes two collide. A run still `running` after 20 minutes is a dead
    process (a deploy mid-sweep) and stops blocking — cutmarks.js's takeover
    rule. `POST /run` answers 409 with the live run's id; `force:true` is the
    way past it.
  - `POST /run {limit?, dry?}` sweeps on demand — **`dry:true` is free** and
    names exactly who is about to be drawn and what it will cost.
    `GET /status` and `GET /waiting` are free reads. Tests:
    `node scripts/test-chat-icons.js` (the decision table, pure).
- **A claim about what OTHER sessions do is a POPULATION fact — measure it, never
  reason it out.** See the case study at the top of this file. Most chats run an
  older hook than the repo's, so a feature that depends on a new hook simply does
  not fire for them, and that is silence rather than a bug.
- **A chat's identity is its SESSION, not its slug.** Branch names get reused;
  every post carries `session` and the server re-resolves authoritatively, so a
  stale hook cache cannot mis-file a reply.

### Working ON the Chats app itself?

**`docs/chats-app.md` has the rest** — the hook and its versions (live drafts, the
turn-start ping, the working fold, stale-hook detection, the turn-boundary rule),
her own messages in the feed, the home screen's views and piles (hidden, archive,
categories, bookmarks, UPDATE, to-do, trash), the account tabs, the header and
masthead rules, chapters, and the sagas that produced them. Two things from it are
worth knowing even if you never open it:

### Posting a page into the app (Compare / judge / picker)

Sophie asks for a comparison sheet, an options board, a side-by-side, or any
custom viewing page → **post it into her app**, don't make a claude.ai artifact:
`POST /api/chatfeed/page {chat, title, html}`. It lands in your chat's Compare
tab and opens full-screen. **Read the `new-page` skill first; the full contract
is `docs/compare-pages.md`.** The parts you must not get wrong:

- **A LIST FITS A STOCK TEMPLATE — post the DATA, not HTML (Aug 2026).** When
  the page is "review these one at a time" or "these variants side by side",
  don't build HTML at all: `POST /api/chatfeed/page { chat, title,
  template:'deck'|'grid', data }` — the deck is the Tinder pager (browse
  taps/swipe, optional ♥/✕ or her own states, tap-to-record voice notes), the
  grid is rows wrapping at three across, ruled off from each other, each tile
  a picture with one what-changed line under it and ✕ · PROMPT · ♥; tapping a
  picture opens THE Assets-tab lightbox itself (`/asset-lightbox.js`, shared
  with chats.html), so ♥/✕/notes mirror to the Assets tab and the two agree. **AUTO COMPARE IS OFF SINCE 2026-09-22 (Sophie: "get rid of
  auto compare for now and supersede all")** — `AUTO_COMPARE_OFF` in
  `chatfeed.js` holds the poke and the hand route, and every auto page then
  on file (`auto-subjects--` · `auto-reruns--` · `auto-ladders--`) was
  superseded the same day. "For now": she lifts it, and lifting it is that one
  constant. What follows is how it worked and still works once it is on.
  **The SERVER auto-files the objective comparisons ITSELF (Aug 2026
  v2)**: filing a prompt or a MODEL · QUALITY caption pokes `runAutoCompare`
  (chatfeed.js) — **on the FIRST filing of a batch as well as 45s after the
  last** (2026-08-24: Sophie filed a low sheet beside a medium one, looked, and
  the quality ladder was not there yet; it was, 45 seconds later). The trailing
  run still coalesces a batch, but the leading one means the page is right
  within a second — and it is what makes "automatic" survive a deploy, since
  the debounce timer lives in the server PROCESS and a Render restart inside
  the window used to drop the pending poke with nothing to re-run it. Running
  twice is free: `runAutoCompare` makes no model call, and a test pins that.
  It keeps two standing auto grid pages per chat — same
  content with a differing quality/model/style, and same style across
  different subjects — updated in place, her verdicts preserved. So FILE THE
  PROMPTS; an image with no prompt on record can never join a group.
  Near-variant prompts (a line changed) are still only FLAGGED
  (`GET /api/gallery/assets/variants?chat=`) — filing those is the chat's
  call. Full contract in `docs/compare-pages.md` (THE STOCK TEMPLATES).
  **PICKING BETWEEN NEAR-TWIN PICTURES? FOUR MORE PAGE FIELDS (2026-09-03,
  Sophie's triangle review deck):** `buttons` (her words + a mark on the
  footer's three — `x` · `heart` · `maybe` · `triangle`; the keys never
  move), `spreadEach: true` (every picture on a spread is its own decision
  and a no takes it OFF the spread so the rest can be compared),
  `spreadAll: true` (a twin set of any size stays ONE card — "has to be all
  no cap" — 2x2 for four, three across after) and `note: 'small'`. Full
  contract in `docs/compare-pages.md`; `scripts/triangle-deck-review.js` is
  the worked example. **AND `addsTo: 'similitude'` MAKES THE ▲ DO WHAT IT
  SAYS** (2026-09-03, "why was that so hard"): a yes puts the card into the
  Similitude deal — a Playground picture becomes a pool card — and a no takes
  it out, through `triset.js reviewPlan`. A verb on a button the page cannot
  perform is the archive-deck lesson again.
  **WORDS ON A CARD — a date, a moment, a scene — GO IN HER DATE-CARD DESIGN,
  and it is automatic (Aug 2026, her own "Decision Deck v2", built for the
  dating book).** Give a deck item any of `who` (the name — her rust, centred
  under the header), `eyebrow`, `text` (the moment), `sections:[{label,text}]`,
  `caption`, `img` — every part OPTIONAL, a card renders only what it carries
  — and the deck comes out in her design: white boxes on her cream, the
  Newsreader serif, one screen with no scrolling, her footer — ✕ and ♥ above
  a full-width "Note for Claude…" box. **A hand-built page CANNOT get this** — `card:'<html>'`
  items are excluded by design, and a page posted as `html` is frozen the day
  it is posted. So a text deck that hand-rolls its own card styling is not a
  style choice, it is opting out of hers.
- **START FROM THE SHELL** — `public/compare-shell.html`, which links
  `/compare.css` (the one house look AND the `:root` tokens the injected
  autoscroll pill styles itself from) and `/compare.js` (the one house
  behaviour). Hand-rolling either is how pages shipped with a black, broken pill.
- **Don't reach for a page by default.** A routine options batch is reviewed as
  labeled Assets tiles. When you do build one: images in rows of TWO, minimal
  text, compared things side by side, the deliverable at the TOP, a film as a
  line of text with a play button — never an embedded `<video>`.
- **The title and nothing else at the top** — no eyebrow, no tagline.
  Instructions go behind a `?` via `window.__compareHelp`. Text boxes ship
  empty; buttons hug their words.
- **She must be able to leave a NOTE on anything reviewable** —
  `window.__compareNotes({chat, sheet})`, one line. Answer her on the note
  itself; it renders as a thread. Never post to `/api/chatfeed/reply` from a
  page — the server reroutes it onto the page's verdict doc.
- **AN ITEM'S `text` ON THE VERDICT DOC IS ITS NOTE THREAD — A PAGE'S OWN
  TEXT NEVER SHARES THE data-item KEY (2026-09-07, Sophie: "the whole point
  was my edit" · "audit elsewhere to see if it happens or could happen
  anywhere else").** A b-roll page saved each scene's editable text under its
  item id, the slot `__compareNotes` writes to; her "go" note replaced the
  scene edit she had just made, and the chat — having read "— me: go" in the
  slot — sent its own draft anyway, $1.20 of her money on words she had not
  approved. Own text rides its own key (`<id>.t`, `ord-<id>`) or its own
  sheet. Audited the same hour: every other page in the repo and all 24
  posted pages that write their own text already do (the dominoes games,
  the Evan running orders, the timelines, Head Games, the shoebox timing) —
  none clashed. Three things now: `POST /page` warns on the shape (a bare
  `item:` beside `text:` on a page that wires notes), the verdict route
  keeps the text it writes over as `textsWas[item]` (`verdict-text.js`,
  read back on `GET /verdict`) so this class is recoverable once, and the
  shell says the rule. And the rule under the rule: **a "go" is a go for the
  text SHE approved — when the slot she edited reads as anything but her
  words, stop and ask, never send the draft.** Tests:
  `node scripts/test-verdict-text.js`, `node scripts/test-page-kit-warnings.js`.
- **A new VERSION is a NEW page**, never an edit of the old one, and the title
  says which version it is. Supersede the one it replaces
  (`POST /page/:id/supersede`) instead of deleting it — IN THE SAME TURN,
  and supersede any page she no longer needs (checklist 3d3). A verdict sheet's name
  must carry the shape of the item set (`blocks-s96`), or a rebuild silently
  re-points her saved answers at different content.
  **AND SUPERSEDE WHAT IS NO LONGER RELEVANT, NOT ONLY WHAT WAS REPLACED
  (2026-09-22, Sophie: "supersede irrelevant pages and add that as a
  note").** A comparison she has decided, a side-by-side that led to the one
  she kept, a candidate she said no to: once it is settled it is superseded
  by the page that won, so her Compare tab holds only the pages still in
  play. The font chat that earned this had 14 live pages of fruit cards in
  one tab, seven of them comparisons already settled by the eighth.
- **`POST /page` answers `warnings`** when a page skips the kit. If yours comes
  back with one, fix the page and re-post before you finish the turn.
- **A FIX TO A PAGE BUILDER REACHES NOTHING ALREADY POSTED — SWEEP THE LIVE
  PAGES (2026-09-08, Sophie: "are chats importing wrong versions · check every
  version · see maybe some even have additional features i asked for that
  didn't reach all of them").** A posted page is FROZEN, and a builder is
  COPIED by the next chat that wants one — so a fix lands in one copy and the
  other four go on shipping the bug. Measured that morning across her five
  live belt pages: the read-back saver written the day before ("a stupid error
  that's gonna lose my edits") was on two of them, and **three pages she types
  her scenes into were still slicing every save to 1,900 characters** — the
  main belt among them. The whole drift matrix, feature by feature, is in
  `docs/mental-hospital/belt/VERSIONS.md`.
  - **REPAIR THE LIVE PAGE, DON'T REBUILD IT.** Rebuilding from the repo
    loses whatever the owning chat has in its own container: measured against
    the live belt v9, a rebuild dropped 9 stills, a video and seven of her
    reference-line edits. `scripts/fix-belt-truncation.js` patches the POSTED
    html — byte for byte, only the saver swapped — re-posts it as the next
    version and supersedes the old (dry by default; `--file` does a committed
    snapshot in place). Her edits live on the verdict sheet and never move.
  - **NOTHING MAY CUT HER WORDS ON THE WAY OUT**, ever: over the limit the box
    REFUSES and says by how much, and every save is read back off the sheet.
    `node scripts/test-belt-save-guard.js` sweeps every page builder in the
    repo and fails on a truncating save, so the next copy cannot lose the fix
    quietly.
  - **The features a patch cannot carry** (a box that is not in the markup —
    the redo-notes fold, the model's-pick seconds) stay for the owning chat's
    next build. Name them rather than half-porting them.
  - **AND THE SCENES-INDEX PAGES ABOVE THE BELTS DRIFTED THE SAME WAY — THE
    ANSWER IS A SERVED FILE, `public/scene-index.js` (2026-09-10, Sophie: "add
    send to footage button · and chapter buttons etc · so light blue ward,
    nautch and ticky tack all have all features").** A scenes index is the wall
    of little 3-D keys — one key a scene, a tap opening that scene's card on
    its belt page — and there are three (the ward film in light blue, the
    Nautchaug Boyfriend's in beige, Ticky Tack in red). Measured on the live
    html: the **Send-to-Footage key** was on the ward only, the **chapter rail**
    and **folding a chapter away** on the nautch only, and Ticky Tack had
    neither. So the three behaviours moved into ONE SERVED FILE and a page opts
    in with one line after `/compare.js` —
    `<script src="/scene-index.js"></script>` — which is what makes the NEXT fix
    reach all three the day it deploys, with nothing re-posted. It reads the
    markup all three already share (`.grid`, `.ep` headings, a tile whose href
    is `/api/chatfeed/page/<belt>#j-<key>`) and **builds only the halves that
    page does not already have**, so it can be added to a live page without
    taking anything away. **The belt names itself** — every belt page carries
    `var CHAT='…', SHEET='…'` — so the hand-off needs no map, and it is HER
    EDIT that rides: the posted html holds the words as the chat wrote them and
    the verdict sheet holds what she has typed since, which is what the key
    reads. `scripts/level-scene-pages.js` added the line to the four live page
    docs (the nautch page is posted into two chats) the same way
    `fix-belt-truncation.js` does — the posted html, byte for byte, re-posted
    and superseded, **never rebuilt**. Full matrix and the three measurements
    behind it (the keys go on BEFORE the fold; a page with its own fold hides
    the tile, so `.cell:has(> .b.hid)` follows it down; a 56px rail key holds
    about one word, so a long phrase is boiled down to its longest word) are in
    `docs/mental-hospital/belt/VERSIONS.md`. Test:
    `node scripts/test-scene-index.js` (`--live` also checks the posted pages).
- **Picking spans of a recording is `public/picker-shell.html` +
  `window.__cutPicker`** — required, not optional. Four chats hand-rolled their
  own in one week and each re-shipped the same bugs.
## Which model writes it (Aug 2026, Sophie: "my brains are really important")
- **Anything whose output is WORDS A HUMAN READS runs on Claude, never
  `gpt-4o-mini`.** Blog posts *and the keyword research behind them*, Etsy
  listing copy, the shop advice she makes spending decisions from, the witch
  app's spells / natal readings / sky lessons. Route them through **`anthropic.js`** (`chat` / `chatJSON`,
  default `claude-sonnet-5` via `CLAUDE_WRITING_MODEL`) — do NOT hand-copy the
  fetch a fifth time. `server.js`'s `anthropicChat` + `parseAnthropicJson` is
  the in-server equivalent for routes that already live there.
- **`gpt-4o-mini` stays ONLY for bulk mechanical extraction** where the job is
  "pull the fields out of hundreds of documents", not "write something worth
  reading": NDE moment mining (`nde.js`), memo titling (`memos.js`), the deck
  brainstorm lists (`/api/generate/subjects`, `/moments`), `stories.js`,
  `/api/set/third`, the Talking zine's planner, `dreamapp.js`. If you switch
  one of these, say why.
- **The Book of Miracles stays on mini — Sophie's explicit call.** It was
  switched to Claude once and she asked for it back: the book's voice is
  settled and the model change moves how the pages read. `/api/generate/miracles`
  is ONE route feeding BOTH the witch app's Miracles tab and `/book` (they also
  share the same localStorage book), so touching it moves both at once. The
  THIRD Book of Miracles is a separate iOS app in another repo and is not
  affected by anything here.
- **`gpt-4o-mini-tts` and `gpt-4o-mini-transcribe` are NOT this.** They are
  the audio models — a grep for "gpt-4o-mini" hits them and inflates the
  count. Leave them alone; the voice rules elsewhere govern them.
- **A doc that tells you to use mini for reader-facing words is STALE — fix
  the doc.** This kept coming back because the module headers said "gpt-4o-mini"
  long after the code moved on. When you change a model, change its comment,
  its module header, and this file in the same commit.
- **Opening a page must never spend money.** The Shop Report used to write its
  AI advice on page load; that is now `?advice=1`, behind a star button. Same
  rule anywhere else: numbers/lists are free, a model call is a deliberate tap.

## Design rules (forever)
- **NOTHING STANDS BETWEEN THE SOURCE AND THE OUTPUT (Aug 2026, Sophie).** The
  one principle behind several rules that already exist separately, now named
  so new work inherits it whole. Her words reach the model VERBATIM (anything
  added is disclosed word for word — the prompt rule below). The model's
  output comes back at FULL QUALITY (no lossy encode at birth —
  `node scripts/test-no-generation-compression.js` pins it). A style
  reference is always the ORIGINAL — her scan, her photo at its source
  resolution — never a screenshot of it, and never a GENERATED image standing
  in for it: a generated reference makes the next picture a photocopy of a
  photocopy, repainting the last picture's flaws as if they were style (the
  dream feed's continuity refs did exactly this while they were also
  compressed — the two bugs fed each other). When a page needs a smaller
  file, the copy is DERIVED from the original and the original stays. The
  test for any new step in any pipeline: if it silently transforms what she
  gave or what the model made, the step is wrong — make it lossless, or make
  it loud.
- **NEVER PUT PRE-WRITTEN TEXT IN ANYTHING SHE WRITES IN — unless she asked
  for it (Aug 2026, Sophie, pointing at the "What is it waiting for?" box:
  "it has pre-written text. Can you get rid of that and also make it a rule to
  never add prewritten text unless I ask for it").** A box that holds her words
  ships EMPTY: no example answer, no starter sentence, no suggested phrasing,
  no sample she has to clear before she can dictate. The label or the question
  above the field already says what it is for; an example on top of that is
  words she did not ask for sitting where hers go, and it teaches her a shape
  she never chose. Applies everywhere she types or dictates — every web page,
  every iOS screen, every Compare/deck note box, every sheet.
  - **A placeholder may NAME the field, never fill it and never instruct.**
    `Search all chats…`, `Note…`, `New…`, `Back text` are names and they stay;
    a short question that names the box (`What happened?`) is a name too. Out:
    an example answer (`the API key, her go-ahead, Tuesday…`, `you@email.com`),
    a **sentence** (`Say anything. It is sent word for word.`), and a
    **description of what to write** — `A note to yourself about this chat`,
    `Describe what you want to generate…`, `Tell us what happened`. A name with
    an instruction stapled on keeps only the name: `Name (blank = skip)` →
    `Name`.
    - **THE FIRST VERSION OF THIS TEST WAS TOO WEAK AND SHE CAUGHT IT (Aug
      2026, pointing at the archive sheet's note box: "there's still
      pre-written text … makes me wonder if you really audited very well").**
      It read *could what's in the field be a real answer?* — which passes
      every placeholder that merely DESCRIBES what to write, so
      `A note to yourself about this chat` was filed as a field name and
      survived the sweep. Ask instead: **is this a NAME, or is it words?**
  - **AUDIT THE BOX, NOT THE `placeholder=` ATTRIBUTE.** The same sweep
    grepped only for `placeholder=` and therefore never saw the worst case in
    the repo: `/talking`'s entry box shipped with a whole invented paragraph
    **inside** it ("I told my dad that when you dream of flying…"), live, as
    real content. Three greps, not one — `placeholder=`, a `<textarea>` with
    anything between its tags, and `value=` on a text input. And when you
    remove prefilled content, check what READS it: that paragraph was the
    source of `TEST_DREAM`, so the "↺ reset to test dream" link would have
    quietly blanked her entry instead of restoring anything.
  - **Prefilling with HER OWN saved value is not this** — reopening the waiting
    box on a chat that already says what it is waiting for shows her sentence
    back, and that is her text, not yours. Same for the note she wrote.
  - **It goes beyond boxes**: don't seed a text deck, a doc, or a form with
    sample content "to show the shape". If she wants an example she asks for
    one — and then it is a deliverable, not furniture.
  - Where this already bit: `/vector` shipped with example text in its boxes
    (the `new-tool` skill), Compare pages have carried "Text boxes ship empty"
    since the same lesson, and the waiting-for box carried an example answer
    for a week. Pinned by `node scripts/test-chats-labels.js`.
- **Every image deliverable goes into the in-app gallery.** See "Deliverables →
  the in-app gallery (ALWAYS)" near the top — post it with
  `scripts/post-to-gallery.js`, stamped with its true make-time.
- **LABEL every image you deliver.** An image link's markdown text becomes its
  Assets-tab description (what Sophie reviews by). ALWAYS write a meaningful
  label — `[Penny — the blue Kleenex](url)` — NEVER `[p01](url)`, `[image](url)`,
  or a bare URL. Applies to every image in a finished reply.
  - **AN IDENTICAL copy can no longer duplicate — a RE-ENCODED one still can
    (Aug 2026, updated).** The hook auto-files every image sent with
    SendUserFile. **Byte-identical copies now collapse onto the labeled tile
    whatever they are called**, because the tab joins on the Storage object's
    md5 (see "dedupes by CONTENT HASH" above) — that is the fail-safe, and it
    needs nothing from you. **A CONVERTED copy is the case it cannot catch:**
    a webp→png re-encode for chat preview has NEW bytes AND a new random
    filename, so nothing on the record ties it to the original and it files as
    a fresh tile with NO label beside it. No hash can fix that one — different
    bytes are a different picture as far as any hash is concerned. Labeling
    only the storage URL is therefore still NOT enough. Avoid it: send the ORIGINAL file
    (bytes untouched) whenever the image already lives in Storage; if a
    conversion is genuinely needed for chat, then AFTER the reply finishes,
    sweep `GET /api/gallery/assets?chat=` for new unlabeled tiles and label
    each (`POST /api/gallery { assetsOnly:true, chat, url, description }`,
    matching by downloaded content hash when unsure which is which). An
    experiment's versions MUST each carry their version label on EVERY copy —
    an unlabeled variant makes the whole comparison unreadable.
- **WRITE THE PROMPT SHORT, AND NAME THE THING INSTEAD OF LISTING ITS PARTS
  (Aug 2026, Sophie: "highly encourage short prompts that don't describe exact
  things … 'meat raining from the ceiling' is better than 'ribs, drumsticks,
  etc.'").** A list of exact things reads to the model as a checklist and it
  satisfies it literally — every named object drawn, separately, arranged so
  each can be seen — so what comes back is an inventory rather than the event.
  The compact phrase names the whole happening and lets the model pick the
  parts. It is the third handle on one rule: *DESCRIBE THE ACTION* (don't
  specify the look), *WRITE IT SHORT* (don't specify at length), this one
  (don't specify the parts) — all in `docs/image-pipeline.md`. The test is
  whether a word could be swapped for another of its kind without changing the
  idea: if "ribs" could be "drumsticks", ribs was never the idea. **Guidance
  for prompts a CHAT writes** — a prompt Sophie dictated still goes verbatim,
  and anything you add is named word for word (the rule below).
- **THE WHOLE PROMPT IS STORED WHEREVER AN IMAGE IS MADE — a HARD RULE
  (2026-08-24, Sophie: "yes make it store the whole prompt. this is a hard
  rule. anytime an image is made ANYWHERE the whole prompt shud be stored").**
  Nearly every surface here wraps her words in a style prefix and a suffix
  before sending them, and until this landed most of them persisted only the
  TYPED words — so the exact text that drew a picture existed for the length of
  one request and was then gone. That is why Meta Assets could show a picture's
  style LABEL but never its style PROMPT, and why the exact-prompt rule below
  ("never paraphrase; no exact text on hand → file nothing") had nothing to
  file for anything the app made itself.
  - **Use the ONE builder — `prompt-record.js`** (`promptRecord` /
    `promptFields`). It writes three fields: **`fullPrompt`** (the literal text
    sent), **`promptStyle`** (the wrapper, with `[content]` marking where her
    words go — the convention the Assets PROMPT overlay documents) and
    **`promptContent`** (her words verbatim). Empty fields are dropped, so
    nothing writes `""`.
  - **Pass the string you actually sent as `full`.** A rebuild can differ by a
    space and the whole point of the field is that it is literal.
  - **No wrapper → NO style half.** A verbatim surface (Freeform, a blog hero)
    files an empty style half, which is the honest answer and what keeps the
    overlay's STYLE button hidden. Never fill it with the style's LABEL —
    "Dreamy" is the recipe's name, not the text that was sent, and filing it
    there is exactly the reconstruction the exact-prompt rule forbids.
  - **A NEW image surface stores it or the test fails** —
    `node scripts/test-prompt-record.js` sweeps every call of the two gallery
    filers, of the injected `fileCreation` (photostudio, movies) and of
    the `/api/generate/*` helper, and fails if one files a picture without a
    full prompt.
  - **EVERY SURFACE IS COVERED AS OF 2026-08-25 — swept, not assumed (Sophie:
    "any surface or endpoint or route or anything that makes images, the style
    is now always saved never thrown away, is that correct?").** It was not,
    quite: two holes were open a day after the rule landed, and each was
    invisible from inside the surface that had it.
    - **Photostudio** persisted its edit prompt nowhere, and its flatlay half is
      written by the vision model per run — genuinely unrecoverable once the
      response ended, not merely unfiled.
    - **The Test Station routes** (`/api/generate/dalle` · `gptimage` ·
      `housestyle` · `replicate`) had no doc to write to at all. They file
      through `fileGenerateRoute` now, so Test Station images appear in My
      Creations the way Playground images always have. `style-test` and
      `deck-batch` proxy into those four internally and are covered by them.
    **The lesson is the sweep, not the two fixes**: a surface that files a
    picture at all can be checked from OUTSIDE it in one command, and every one
    of these read as fine from inside its own module.
  - **`select()` IS A WHITELIST, and that is how two caption slots hid for
    weeks.** Meta Assets' creations read never asked for `size`, so the
    required third slot could never appear however well the builder handled it;
    `style` was asked for but only read as a fallback, so it was fetched and
    dropped. When you add a field, add it to the read as well as the write.
- **THE PROMPT RIDES INSIDE THE PICTURE FILE — `image-meta.js` (2026-09-03,
  Sophie: "could the prompt it was made from be filed as metadata w pictures"
  · "would this help our recurring prompt issue?").** The whole-prompt rule
  above stores the text on a DOC, joined to the picture by url, filename or
  md5 — and every one of those joins breaks the moment the bytes travel (a
  re-encoded copy, a download, a Save to Photos, a file pasted into another
  chat). So the same fields are now written INTO the file as an XMP packet:
  `fullPrompt` · `promptStyle` · `promptContent` · `model` · `quality` ·
  `size` · `canvas`, plus `dc:description` = her words, which is the field
  Photos shows as a picture's Caption.
  - **PURE BYTE SURGERY, NEVER A RE-ENCODE.** The packet is spliced into the
    container (a webp `XMP ` chunk behind a VP8X header, a PNG `iTXt` ahead
    of IDAT, a JPEG APP1) and the pixel data is byte-for-byte what the model
    returned — measured through sharp: identical raw pixels on every
    container, ~1KB added. A lossless re-encode would have kept the pixels
    too and cost a 4K encode on the 512MB box for nothing. Stdlib only, so
    the test needs no node_modules. **A stamp can never fail a save**: a
    foreign or truncated file comes back as the same buffer.
  - **WHERE IT IS WRITTEN: every save of a picture this server draws.**
    `saveBufferToFirebase` / `saveToFirebase` take the fields as a last
    argument and the Playground (single, sheet, every cut panel, the LoRA
    copies), the four `/api/generate/*` routes, Freeform, Similitude and
    `scripts/post-to-gallery.js --file` all pass them. `node
    scripts/test-image-meta.js` pins every site by source, so a new save
    site fails there until it stamps. A chat drawing in ITS OWN CONTAINER
    stamps before any other upload with `scripts/stamp-prompt.js`
    (`--read` prints what a file carries).
  - **WHERE IT IS READ: `POST /api/gallery`, both doors.** A filing that
    brings no prompt reads the file's own — a ranged read of the TAIL (webp,
    png) or the HEAD (jpeg), never the whole object, and inline bytes are
    read in hand — and fills the Assets halves and the MODEL · QUALITY · SIZE
    caption from it. So the hook's `claude-deliveries` copy, a renamed copy,
    and a re-encoded copy that KEPT its metadata all arrive already knowing
    what they are. **Only ever a fallback**: a prompt the caller sent wins,
    and the hook's generic `from <chat>` caption loses to the file's real one
    (`captionUpgrade`'s own rule). **It does not fix the case nothing wrote
    at birth** — an unstamped file reads as nothing, honestly, so the file-it-
    when-you-make-it rules above stand exactly as they were.
  - **THE PHONE CARRIES IT THROUGH (a TestFlight build).** `PhotoSaver`
    re-encodes a webp to PNG for Photos and `pngData()` throws every chunk
    away — it now lifts the `XMP ` chunk out of the RIFF and writes the PNG
    through ImageIO with the packet attached, so a saved picture's Caption in
    Photos is her prompt. A browser download keeps the webp as-is. **Nobody
    has looked at a saved picture on a real phone yet** — the ImageIO half is
    written, not measured; Sophie checking one picture's Caption in Photos
    after the build is the measurement.
  - **NOT BACKFILLED.** A Storage object is immutable behind a year-long CDN
    cache, so stamping an older picture means a new object at a new url —
    hers to ask for. Pictures made before this carry nothing, exactly as
    their captions do.
  - Test: `node scripts/test-image-meta.js` (the three containers by hand,
    the pixel bytes located untouched inside the stamped file, the re-stamp
    that replaces rather than stacks, the ranged reader against a server
    that ignores Range, and the source pins).
- **POST THE PROMPT for every image you deliver**, split into style + content —
  `POST /api/gallery/assets/prompt`. It's what the PROMPT overlay in the Assets
  tab reads. **The EXACT text sent to the model — NEVER PARAPHRASE**; no exact
  text on hand → file nothing (or `not available`). Full rules in "Prompts on
  Assets images" above.
- **If you ADD anything to a prompt Sophie gave, TELL HER — every time (Aug
  2026, Sophie, VERY IMPORTANT).** When she supplies prompt text, or asks for a
  "plain" run, send it exactly as given. Anything you add — style language, a
  content line she didn't dictate, a style-ref preamble, quality hints — must
  be named explicitly, word for word, in the reply that delivers the result.
  This rule was earned: a "plain" style-ref test shipped with Claude-written
  style description in the prompt and she only found out from the PROMPT
  overlay. A truly plain run contains only her words (plus unavoidable API
  params); if a necessary line has to come from you, say which line is yours.
- **FILE THE MODEL · QUALITY · SIZE CAPTION on every image too (Aug 2026,
  Sophie).** The Assets tile's caption is the asset doc's `prompt` field — file
  it as a curated tag like `gpt-image-2 · medium · 2K` via
  `POST /api/gallery
  { assetsOnly:true, chat, url, prompt:"gpt-image-2 · medium · 2K", description }`
  **THE SIZE IS A REQUIRED THIRD SLOT, AND IT IS THE TIER (Aug 2026, Sophie:
  "1K 2K 4K should be a third slot in the model/quality required tagging, in
  the playground and in assets and Meta assets" — then, on the first cut, which
  wrote the raw canvas: "i asked for it to say 1k 2k or 4k").**
  **Full details: *FILE THE MODEL · QUALITY · SIZE CAPTION* in `docs/design-rules.md` (moved from CLAUDE.md).**

- **COMPARING TAKES — AUDIO TOO — IS A COMPARE PAGE, NEVER A LIST OF LINKS
  (2026-09-05, Sophie, handed four cello takes as four mp3 links: "if i'm
  comparing takes -> compare tab").** Anything she has to choose BETWEEN —
  sound-effect takes, TTS takes, music beds, cuts of a film — goes into the
  chat's Compare tab: one `__filmRow` per take, each inside a `[data-item]`
  block so her ♥/✕ and note land on the take itself, and the title says what
  is being compared. An AUDIO url plays IN ITS ROW (tap plays, tap again
  stops, one at a time; `kind:'audio'` when the url has no extension) — the
  video overlay is a black slab over a page whose whole point is listening
  side by side. `compare-shell.html` carries the pattern.
- **Do NOT dump image-link lists at the bottom of replies (Sophie, Aug 2026).**
  She reviews images in the Assets tab, not in chat — a stack of markdown links
  is clutter. Deliver images by filing them directly instead:
  `POST /api/gallery { assetsOnly:true, chat, url, description }` (the
  description = a real scene description, what she reviews by) + the prompt
  POST above for every image, and when a set belongs together (a storyboard,
  an options batch, frames of one video) ALSO compile it as a **Compare page**
  so she sees the whole thing in order in the Compare tab. Mentioning an image
  inline in prose is fine — the rule is that link dumps are not the delivery
  mechanism.
- **NO GRADIENTS. Ever.** Sophie hates gradients — flat solid colors only, in
  every UI (iOS, web pages, artifacts). No LinearGradient, no CSS gradients.
- **Sophie's voice renders on `eleven_multilingual_v2` — NEVER `eleven_v3`
  (Aug 2026, Sophie: "no one uses v3 ever again").** Her professional clone
  ("Sophie — morning", `UTkHGl2ImiT6gwtAFCql`) is not optimized for v3 and
  the likeness collapses — "a cousin doing an impression". v3 was tried and
  REVERTED in the pad and the editor, but stale doc notes kept saying v3 and
  a chat followed one, shipping a 15-minute film in the wrong voice: **when a
  doc and the code disagree about her voice, trust the code** (scratchpad.js
  / editor.js are the live copies). Settings of record:
  `stability 0.5, similarity_boost 0.75, style 0, use_speaker_boost true`.
  `<break time>` tags work on v2; v3's `[quietly]`-style acting tags do not.
- **No Claude-isms in public-facing copy** (lessons, blog posts, app text,
  product listings — anything Sophie's readers see). People shouldn't be able
  to tell it's AI-written. Banned: mic-drop closers ("That's the whole
  practice." / "That's it."), the negation-pivot reframe ("X isn't Y — it's
  Z"), therapy-speak verbs on feelings ("name it", "sit with it", "notice what
  comes up", "hold space"), permission-granting ("you're allowed to", "give
  yourself permission"), "here's the thing", "that's not nothing", the
  profound-simplicity pronouncement ("X IS the answer", "the real secret is…",
  "that's a spell by any name"), and false-easy reassurance ("just name three
  shapes", "it's right there", "it's that simple" — reads condescending). And
  the MEANING-level rule beneath them all: **aspirational, not consoling** —
  never lower the bar to comfort the reader ("X is plenty", "counts as a
  potion", "can come later, or never"); frame small acts as the first rung and
  name the higher rungs. Rewording a consolation is not fixing it. Full list +
  guidance in `docs/witch-school-lessons.md` (Voice rules). Swept the 16 live
  Witch School lessons three times July 2026; keep new copy clean.
- **Everything slow is a background job — never make anyone watch a spinner.**
  Any generation that isn't near-instant (image gen, an LLM reading, audio,
  video, a long fetch) MUST be a fire-and-forget background job that survives
  leaving the app: the server starts the work and returns immediately, the
  result is persisted (Firestore/Storage) so it's never lost, and the client
  records the pending job id (e.g. `localStorage`/`@AppStorage`) and RESUMES
  polling on return — the pattern the dream illustrator uses (`/api/witch/dream-
  illustrate` + poll). Nobody — not even Sophie while testing — should have to
  sit and stare at a spinner or risk losing a result by glancing away. If a case
  genuinely can't be a background job (or it seems not worth it), **check with
  Sophie first** rather than shipping a blocking wait.
- **Research the CURRENT UI before giving click-by-click steps for any external
  dashboard** (Shopify, Render, Google, etc.). These tools change their menus,
  buttons, and URLs constantly, and guessing from memory sends Sophie hunting and
  wastes her time (this rule was earned the hard way on the Shopify Dev Dashboard
  — see the Shopify section). Look up the up-to-date flow (web search / official
  docs), name the exact current labels, and when a deep link needs an account/app
  ID you can't see, say so and ask her to paste the address-bar URL so you can
  build the exact link — don't invent a path.
- **MINIMIZE THE SCROLLING — fit it on ONE SCREEN (Aug 2026, Sophie).** If a
  surface can fit on one screen, it fits on one screen. When it can't, it gets a
  **hairline tab row — never a taller page.**
  - **The test for splitting into tabs is REFERENCE, not length:** "is it
    something that's going to be referred to? Are you gonna have to switch
    between the different views often?" Two views she reads against each other
    are two tabs; a long page nobody cross-references is just a long page, and
    tabbing it only hides things.
  - Her worked example, the Episode Editor: "you need to switch between the
    clips and between the raw transcript so you can take things from the
    transcript, add it to the clips, and then go back and add more things. Back
    and forth, back and forth, back and forth. So to make that easy — a
    hairline pattern, 2 tabs."
  - The rows measure their own underline, so adding a tab costs no layout work
    — `.acctabs` in `docs/design-rules.md`.
- **PROGRESSIVE EXPANSION AND CONTRACTION (Aug 2026, Sophie: "this has to do
  with the abstraction principle").** A surface opens at the level of
  abstraction she needs and expands only where she goes into it — so the first
  thing on screen is the shape of the whole thing, not its contents. Her worked
  example, the Story Room: organize by projects and by level of completion,
  with the LAST hairline tab holding the ones she wants to start on.
- **BACK TO THE TOP RIDES IN THE PILL'S RAIL (Aug 2026, Sophie: "add a small
  back to top arrow in playground when i scroll down. as well as other long
  scrolls like meta assets").** A small round button under the autoscroll
  pill, shown a full screen down, gone at the top — in the rail rather than
  floating loose, because that corner is the only one reserved on every page.
  **Full details: *BACK TO THE TOP RIDES IN THE PILL'S RAIL* in `docs/design-rules.md` (moved from CLAUDE.md).**
  **AND A PAGE CAN NAME STOPS ON THE WAY (2026-09-14): `window.__pillStops`
  → the ↑/↓ jumps go to the nearest stop first, then all the way. Footage
  names its references bar. Same section of the doc.**
- **A FILTER LOADS A SET NUMBER, NEVER A DATE'S WORTH (2026-09-26, Sophie:
  "filters ex trimmed shud always load a set number not by a set date · audit
  elsewhere").** Every feed reads a page and every filter ran over that page
  only, so Footage's Trimmed chip showed the trimmed clips among today's
  sends and `… older` walked the unfiltered log. A filter over a truncated
  page is a filter over a date. Two shapes now: Footage and Stitch send the
  funnel to the server (`feedFilter` in `footage.js` narrows the whole log
  before the page is cut, so a page is forty MATCHES); the Playground's first
  page, the chat's Assets tab and Meta Assets walk pages until the narrowed
  wall holds one. A new feed with a filter does one or the other — never a
  filter over the loaded page. Test: `node scripts/test-filter-set-number.js`.
  **Full details: *A FILTER LOADS A SET NUMBER* in `docs/design-rules.md`.**

- **A LONG PAGE KEEPS HER PLACE AND NAMES ITS CHAPTERS (2026-09-02, Sophie,
  on the Similitude inventory — 97 cards under 75 headings: "long scroll pages
  like the inventory triset a chat just made need to have place saving
  mechanisms — 1 save scroll position 2 chapter titles quick click to").**
  `window.__pagePlace` in `compare.js`, so every Compare page ever posted has
  it with nothing re-posted. Two halves: **where she was is restored on the
  next open** (localStorage under the page's own path, anchored to a CHAPTER
  plus an offset — a bare pixel count drifts a screen while the lazy
  pictures above her place land — re-asserted for a few seconds while the
  layout settles and never after her own gesture), and **one sticky row
  names the chapter she is in with its count** (`31/75 · a rainbow / bands
  of colour`); a tap opens the whole list, a tap on a title jumps to it.
  The GRID template's group labels are the chapters (grid.js hands them
  in); a hand-built page gets its `<h2>`s by default. Three things not to
  undo: it draws **only when the page is genuinely long** (2+ chapters and
  more than 1.5 screens, re-measured as pictures land — a short page carries
  no dead control); **a save never runs while the grid is hidden behind the
  swipe view** (it would file y=0 over her place) nor while a restore is
  settling (the first restore is clamped to a page that has not got its
  height yet, and filing THAT spot made every reopen land 7px short); and
  the lit title is brought into the list's view by hand, never
  `scrollIntoView`, which walks every scrollable ancestor and moves the page
  she is standing on. The 64px on its right is the app pill's column. Not
  the chapters-shell (`chapters.js`), which is a catalog page of a chat.
  Test: `node scripts/test-page-place.js` (every assertion a measurement —
  the stick, the jump, the reopen judged against her chapter, the swipe
  round trip, her own scroll standing against the re-asserts).
- **A 1-UP GRID PAGE IS NOT A COMPARISON, AND ITS TOUR MUST NOT SAY IT IS
  (2026-09-03).** `grid.js`'s tour opened with a hardcoded "each row is one
  comparison — the things on it differ by exactly one thing", which is a
  sentence about a page she is not looking at whenever every group holds ONE
  item (the 1-up shape her standing Playground-hearts page uses). `oneUp` is
  DERIVED from the real groups rather than passed as a flag, so any
  one-per-row page gets the right words with nothing to remember. **Found by
  PHOTOgraphing the live page** — nothing else would have shown it, since the
  page renders perfectly either way. Test:
  `node scripts/test-grid-oneup-tour.js` (the real grid.js, the tour opened,
  the words read off the screen; verified failing 2 pre-fix).
- **THE CARET STAYS WHERE SHE CAN SEE IT — `/caretkeep.js`, ONE FILE, EVERY
  PAGE (2026-09-08, Sophie editing a scene on the soap belt: "when i edit the
  text, the scroll position moves, so the cursor is under the textbox").**
  Every box she writes in is fitted to its own words and never scrolls itself
  (the Playground's bigger box, the belt's `fit`, the Chats app's script-block
  editor) — which is right for reading and is exactly what loses the caret: a
  2,000-character scene is a 1,500px-tall textarea, so WebKit scrolls the TOP
  of the box into view and the line she is typing sits under the keyboard,
  with nothing on screen saying why.
  **Full details: *THE CARET STAYS WHERE SHE CAN SEE IT* in `docs/design-rules.md` (moved from CLAUDE.md).**
  **AND A FIT NEVER COLLAPSES THE BOX SHE IS TYPING IN (2026-09-14, "huge
  text block bug · rapid movement"): the shrink road measures on a twin
  textarea and writes the box only when its height really changed — a
  `height:auto` on a focused box is the jump. Same section of the doc.**
  **AND THE ROOM IT BORROWS IS THE WHOLE KEYBOARD, NOT JUST THE CARET'S
  SHORTFALL (2026-09-16, "no way to scroll down or split long or bottom
  messages"): the layout viewport does not shrink when the keyboard opens, so
  the foot of the page — the end of what she is writing and the Done bar
  under it — sat a keyboard's height below the band with nothing left to
  scroll (MEASURED at 390x844: 683 and 731 against a band ending at 482), and
  a box fitted to its words fills the band, so there is no page left to drag
  either. While a box is focused the page now borrows the keyboard itself.
  Same section of the doc; `node scripts/test-caret-room.js`.**

- **THE WAY OUT OF A BIG BOX STAYS ON SCREEN — `/stickybox.js`, ONE FILE,
  EVERY PAGE (2026-09-10, Sophie: "can we get a floating or sticky/pinned
  contract button for text boxes esp in footage so i can close with out having
  to scroll all the way down").** The corner toggle that opens a box is the
  same one that closes it and it lives in the box's BOTTOM-RIGHT corner — so
  the taller the box, the further the way out is from where she is standing.
  **Full details: *THE WAY OUT OF A BIG BOX STAYS ON SCREEN* in `docs/design-rules.md` (moved from CLAUDE.md).**

- **TRUNCATED TEXT OPENS WITH AN UNDERLINED WORD, NEVER A BUTTON (Aug 2026,
  Sophie: "the ... button for longer than two line prompt is huge … truncated
  text shud always just be a ...with a line under it that links to open
  (untruncate) or it can say 'more' or 'see more'. never a separate button.
  document that as a ui pattern").** `…` / `… more` / `see more`, underlined,
  inline, inheriting the surrounding type — no border, no padding, no
  background, and never a bare unstyled `<button>` (which draws the browser's
  own box). Still a `<button>` ELEMENT — the rule is about paint, not markup.
  **It rides ON THE LAST LINE of the words, never parked beside them** (Aug
  2026, Sophie: "Button should be part of the text, not separated from it on
  the side") — a `max-height` clamp plus a right float behind a zero-width
  float one line short of the cap, the dream cards' own solution. The class is
  `.moretxt` on every page. The full pattern, and the class-name
  collision that actually caused this (`.morebtn` was the opener AND the
  "Older" paging button in one file, later rule wins), are in
  `docs/design-rules.md`; pinned by `node scripts/test-truncation-opener.js`.
- **THREE OPTIONS = A THREE-WAY TOGGLE, AND THERE IS EXACTLY ONE SHELL (Aug
  2026, Sophie: "for things with three options, it shud be a three way toggle.
  add the toggle as a likely pattern where it applies. make a reusable three
  toggle shell so we can change the styling all at once. make color a per
  instance option. apply it to the few instances that already exists").**
  `public/tritoggle.css`, class `.tri` — link it, never copy it.
  **Full details: *THREE OPTIONS = A THREE-WAY TOGGLE, AND THERE IS EXACTLY ONE SHELL* in `docs/design-rules.md` (moved from CLAUDE.md).**

- **LIST · TILES · 3/4 = THE ONE VIEW SWITCH, `/viewswitch.js` +
  `/viewswitch.css` (2026-09-12, Sophie, on Stitch: "could you reuse the
  shell so I can switch between tiles and list view?").** The Playground's
  switch had been hand-copied onto Footage and Stitch would have been the
  third copy — the tritoggle shape. ONE file now: `window.__viewSwitch({
  mount, key, cols:[3,4], view, onView })` builds the box (or ADOPTS a
  `.viewtog` the page already carries — the ids `#v-list` · `#v-tiles` ·
  `#v-cols` are what two dozen headless tests tap, so they never moved),
  keeps the view and the columns under the page's OWN key (`<key>_view` /
  `<key>_cols`, byte-for-byte the old Playground and Footage keys), sets
  `--cols` on the root, and calls the page back to swap its two surfaces.
  The Playground and Footage read it (their `curView`/`curCols`/`setView`
  are thin wrappers now); a new feed links both halves and never copies
  either. Two stops on the number segment is not the cycle the house rule
  forbids. Test: `node scripts/test-viewswitch.js` (nobody keeps a second
  copy; the built and the adopted box measured in a browser).
- **No pills.** Text buttons are rounded rectangles — `border-radius: 6px`.
  **AND A CIRCLE IS NOT THE DEFAULT FOR AN ICON EITHER (2026-08-24, Sophie: "i
  prefer rounded squares for buttons, or plain icons, rather than circles").**
  An icon control is a **rounded square** at the house 6px, or the **bare
  glyph** with no plate at all when the background behind it is calm enough to
  read it against — a round plate is the one to stop reaching for. This
  supersedes the line that used to sit here calling circular icon buttons "the
  only exception", so an existing circle is history rather than a rule: don't
  copy one into new work, and change one when you are already in that file.
  Small round DOTS that are a mark rather than a button (a status dot, a
  colour chip) are not this. **Plus one named exception Sophie asked for (Aug
  2026): the Chats home screen's REFRESH button (`.refreshbtn`) is
  pill-shaped.** It is the exception, not a loosening of the rule — don't
  round anything else off, and don't "fix" that one back.
- **THE PILL DEFENDS ITSELF NOW, AND READS ITS COLOURS FROM YOUR PAGE (Aug
  2026 v3, Sophie: "this is the wrong pill" → "it's still the wrong pill … it
  looks different"). Two rounds of the same bug; this is the settled
  contract.** The pill on a Compare page is INJECTED — the server appends
  `pill-inject.html` to a page it has never met — so **every property the pill
  leaves unset is a hole the host falls through**, and CSS is global whichever
  way the pill arrived.
  - **What actually reached it, measured** by diffing every computed property
    of the pill rendered alone against the same markup with only
    `compare.css` added: **four** — `border-radius` (0 → 6px, from a bare
    `button, .btn{…}` rule at specificity (0,0,1), which turned the capsule's
    three segments into three loose rounded boxes and swallowed the hairline
    dividers), `box-sizing` (the host's `*{border-box}` pulled the 1.5px
    stroke inside, 50px → 48), `line-height` (`#spd` 12px → 17px, so the whole
    pill grew 5px taller) and the buttons' `font`. `.vseg button` had always
    out-specified the host for everything it DECLARED — border, background,
    colour, size, padding — which is why nobody found this for months.
  - **All four are declared in `scripts/pill.py` now** (`.float, .float *`
    pins `box-sizing`/`line-height`/`letter-spacing`/`text-transform`;
    `.vseg button` pins `border-radius:0`, `gap`, `margin`, `font`). **Add to
    that line whenever a new host reaches something — don't re-derive it.**
  - **THE FIVE TOKENS ARE READ FROM THE HOST, `var(--x, fallback)`, never
    baked onto `.float`.** The old copy carried its own palette plus a
    `prefers-color-scheme: dark` block, and an element's own custom property
    beats one inherited from `:root` — so a host could not colour the pill by
    defining the tokens, it had to OUT-SPECIFY with `body .float{…}`, which is
    the ten hand-synced lines `compare.css` was carrying (its own comment
    warned they had to be kept in step by hand). Now the host's `:root` wins by
    itself, exactly as it always has for a baked-in pill; a page that defines
    none of the five still gets the studio cream; and a cream page on a dark
    phone stays cream, because the pill has no dark block of its own. **The
    whole contract for a host page is: define the five tokens.**
  - **IT ONLY APPEARS WHEN THERE IS SOMETHING TO SCROLL** (Sophie: "it should
    be a conditional pill that only appears if there's actually content to
    scroll"). **The check keeps watching — a ResizeObserver, not a check at
    load** — because almost every page here fetches its content after it
    loads, so a one-shot check would hide the pill on nearly all of them.
    `window.__pillSync()` re-runs it by hand; the `forge-pill off` /
    `data-nopill` opt-out still removes the pill outright.
  - Tests: `node scripts/test-pill-host.js` (the whole contract against the
    real `pill-inject.html` and the real `compare.css` — verified failing
    against the pre-fix pill, 8 of 16), plus the per-page pill assertions in
    `test-review-page.js` and `test-brief-page.js`.
- **A GENERATED PAGE'S TEMPLATE IS PROBABLY STALE — CHECK BEFORE YOU RUN A
  `gen-*.py` (measured 2026-08-20, caught one command short of shipping it).**
  Running a generator overwrites its page from the template, so if the PAGE has
  been hand-edited since — which it constantly is, several chats at once — the
  edits are gone. Measured that day by running each generator against a clean
  tree and diffing: **not one of the four was in sync.** `gen-chats.py` would
  have dropped **~300KB** of shipped work (1,577KB → 1,275KB); `gen-writing.py`
  deletes a date entry and its cover; `gen-wall.py` / `gen-storyroom.py` are the
  safe direction (the generator is AHEAD — those two pages were missing the
  pill's `forge-pill`/`data-nopill` opt-out block entirely).
  - **The check is one command and costs nothing:** on a clean tree run the
    generator and `git diff --stat` its page. Empty = in sync, safe. Anything
    else = read the diff and find out which side is ahead BEFORE you commit.
  - `scripts/resync-gen-chats.py` exists to pull the page's edits back into
    `gen-chats.py`'s template and is the documented order (edit page → resync →
    generate). **It currently cannot run** — it looks for the pill blocks
    verbatim to turn them back into placeholders and finds zero, so
    `chats.html`'s pill has drifted from `pill.py` by hand. Fixing that is its
    own job; until then treat `chats.html` and `writing.html` as
    HAND-MAINTAINED and patch them in place.
  - `public/gallery.html` has **no generator at all** — its pill is a hand copy
    nothing can keep in step.
- **Opening an image freezes the page behind it.** Tapping/clicking a picture
  (lightbox, enlarged view, any overlay) must **pause any autoscroll** and lock
  background scroll (`document.body.style.overflow='hidden'`), restoring on
  close.
  **Full details: *Opening an image freezes the page behind it* in `docs/design-rules.md` (moved from CLAUDE.md).**

- **THE BOTTOM BAR'S SLOTS ARE PERMANENT — Story Room · Story Timeline ·
  Playground · Footage (2026-08-26, Sophie: "right now the bottom real icons
  switch off can you change it so they're permanent I want the story room, the
  story timeline and the playground"; **Footage joined them 2026-09-11**, "make
  footage rotate w the three bottom nav buttons" — a FOURTH slot, not a swap:
  she named the other three herself, so nothing came off to make room).** The
  middle slots used to rotate by
  most-recently-used, so the tools under her thumb moved every time she opened
  anything else from Home — a bar that can never be learned. `barTools` in
  `RootView.swift` is the whole list and the ONE place the order is written
  down; changing it is that line.
  - **`Recents` still exists and still tracks use order — it ranks the HOME
    GRID's cards.** Only the bar stopped reading it. Do not delete it.
  - **THE ALIVE SET IS NOT THE BAR ANY MORE, and that is the half that breaks
    if it is "tidied".** The ZStack used to keep exactly the bar's three tools
    alive, which only worked because opening a tool from Home promoted it INTO
    that set; with the slots fixed, a tool opened from Home is in neither, so
    `alive` = the bar's tools + the currently-open tool + the ONE most recent tool
    from outside the bar. Drop the first and a tool opened from Home renders as
    a blank screen; drop the second and Home → Playground → Home silently
    throws away her half-typed prompt.
- **iOS: pin bottom bars below the keyboard (never floating above it).** A
  custom bottom nav/tab bar laid out in a `VStack` rides UP and hovers above the
  keyboard, because SwiftUI's keyboard safe-area inset shrinks the stack. This
  keeps recurring across apps. **The fix is one modifier** on the container that
  holds the bar: `.ignoresSafeArea(.keyboard, edges: .bottom)` (e.g. on
  `RootView`'s outer `VStack`). The bar then stays pinned to the bottom and the
  keyboard covers it, while each screen's own `ScrollView` still lifts its text
  fields. Any app with a persistent bottom bar MUST have this — add it when you
  build the shell, and check for it whenever a keyboard-over-bar bug appears.
- **ONE generate glyph, everywhere (Aug 2026, Sophie).** Any control that
  makes something with AI wears the hand-fitted **star** — the witch app's
  `STAR` const in `witch.html`, an exact bezier match of SF Symbols
  `sparkles`. Not Lucide's `sparkles`, not a wand, not a per-page variant: a
  button that spends a model call must read the same in every surface. Live
  copies: `ICON_STAR` in `scripts/gen-scratchpad.py` (the Story Room's beat
  popup), `ICONS.sparkles` in `promptlab.html` (the Playground's Generate), and
  `GEN_STAR` in `chats.html` (the archive sheet's Summarize — named apart from
  that file's own `STAR`, which is the five-pointed mark on a starred chat).
  Deliberate exceptions, because they say something the star can't: the pad's
  **wand** (draw every beat that's missing art — a bulk action) and the
  Playground's **pyramid** (low·low·medium, a picture of how many — an actual
  tiered pyramid, two cells along the base for the lows and the filled top
  tier for the better one; NOT Lucide's `pyramid`, which is a solid 3D shape
  that says nothing about how many). **It is EQUILATERAL** — Sophie asked, and
  she was right that it wasn't: base 18 on y 19.8 with the apex 9√3 = 15.59
  above it puts all three angles at 60.00°, where the first version was
  isosceles at 53°/63° (base 17, height 17) and read noticeably narrow. The
  horizontal cut sits at half the HEIGHT, which lands its ends exactly halfway
  along each side, so the filled cap is the same triangle at half scale.
  **It is a REUSABLE named glyph: `SetPyramid`** (Sophie's name, Aug 2026) —
  `ios/ImageForge/Assets.xcassets/SetPyramid.imageset/setpyramid.svg`, so
  `ToolGlyph.asset("SetPyramid", size:)` draws it anywhere in the app, and it
  is in `normalize-glyphs.py`'s `GLYPHS` list like the other three. TWO copies
  exist by necessity (64-box bundled for iOS, 24-box inline in
  `promptlab.html` for the web) and each names the other — move both.
- **A button that opens another tool wears THAT tool's icon.** The Story
  Room's "make its art in the Playground" is the Playground's own wire-loop
  drawing, not a generic palette — same vector as the iOS tile
  (`Assets.xcassets/Playground.imageset`, mirrored as `ICON_PLAY` in
  `gen-scratchpad.py`). Keep the copies in step.
- **Deliberately UNLINKED pages (Aug 2026, Sophie's call — don't "fix" by
  adding tiles):** the `/audio` page (superseded — the share sheet routes
  audio into the memo library now; the `audio.js` API underneath is still
  live machinery), `/crystals` and `/import` (project-specific drop boxes,
  superseded for day-to-day use by the share sheet / Dump; kept because
  their data and APIs are real), `/wall` (the everything-feed; no tile
  asked for), and `/desktop` (the desktop queue — she asked for it
  "somewhere out-of-the-way"). The pages still serve at their URLs for a chat
  or a browser.
- **Icons: Lucide line icons, not emoji.** Functional UI chrome — bottom-nav
  tabs, buttons, link tiles — uses inline **Lucide** SVGs (stroke
  `currentColor`, `stroke-width` ~1.8, an SF-Symbols-like clean line look), not
  emoji. Pull exact paths from `unpkg.com/lucide-static@latest/icons/<name>.svg`
  and inline them (CSP-safe, no external requests). Emoji are fine ONLY as
  expressive *content* (moon phases 🌑🌕, a decorative ✦), never as the icon for
  a control. (Lucide dropped brand glyphs like YouTube/Instagram for trademark
  reasons — hand-inline a simple equivalent or use `monitor-play`/`camera`.)
- **Each app may have its own visual identity — don't blanket-copy the warm-paper
  studio look.** `forge.css` (warm paper, `--accent` tan) is the *studio/hub*
  system; public apps can and should diverge. Example: **Secretly a Witch** uses
  its own dark, mystical theme (ink/plum + gold + moonlight) defined inline in
  `witch.html`, NOT `forge.css`. When starting a new surface, pick a palette that
  fits *that* product rather than reaching for the studio tokens by reflex.
- **Always use full clickable links** in updates — app pages, the deployed URL,
  PRs — never bare text the user has to assemble.
- **NEVER LINK HER TO A CHAT — AND EVERY LINK PINS TO THE TOP OF THE REPLY
  (2026-09-14, Sophie: "links now pin to page top" · "never link to chat").**
  Two rules, both replacing what stood here.
  - **NO `/chats?chat=<slug>` LINK, EVER** — not in a briefing, not in a
    roundup, not beside a chat you are reporting on, not to your own chat.
    Name the chat in words; she gets to it her own way. **THE AUG 2026 RULE IS
    HISTORY, NOT A RULE**: it said any reply reporting on other chats ends with
    one link per chat named ("they should always have a link back to the chat
    that they're talking about at the bottom of their analysis"), and she
    retired it. Don't put one back.
  - **LINKS GO AT THE TOP.** The working links — the page, the deploy, the
    surface a bug fix shows on, the PR last — sit at the head of the reply, not
    the end of it. Everything else about them is unchanged: full clickable
    urls, never bare text she has to assemble, one short line each saying what
    to look at. **FILES AND IMAGES ARE STILL LAST** — that order is a separate
    rule and it did not move.
  - Where this reaches: the reply-format line in the checklist, rule **3h**
    (a bug fix's example links), and anything that used to collect links "at
    the very bottom".
- **Always include clickable testing links** when something is ready to test:
  the deployed page for the feature plus the PR link.
- **Copy-paste / handoff messages = one code block.** When the user asks for a
  message to copy-paste, forward, or hand off to another chat, put the ENTIRE
  message inside a single fenced code block so it copies in one tap — no
  commentary mixed in, never split across sections or styled headers.
- **No markdown tables in chat replies.** The user reads on a narrow phone
  where wide tables need horizontal sliding and often don't render. Present
  comparisons as short labeled lines or bullet lists instead.
- **Deliverables go last — files and images at the very BOTTOM.** When a
  message includes a generated file — audio, image, video, any downloadable
  deliverable, or an attached image — it is the final item, after all the
  text, never before or in the middle. Write the explanation first, deliver
  last. (This was two separate bullets saying the same thing, written on
  different days; merged 2026-08-24.)
- **Answer questions FIRST — and answer each one ONCE.** If Sophie's message
  contains a question, answer it at the top of the reply, before doing or
  reporting on any tasks from the same message. Whether to also repeat it in
  bold is the echo rule, and it lives in ONE place — *ANSWERING A QUESTION* in
  `docs/chats-app.md` (short version: only a question she MARKED with an
  asking phrase like "i have a question" / "quick question", or a code word
  like "file this", earns the bold echo; everything else is answered plainly).
  This bullet used to restate the gate and drifted a day behind it — the rule
  is there, this is the pointer.
- **SHORT REPLIES BY DEFAULT — and since 2026-09-14 a HARD CAP: 600
  characters, no words between tool calls, the PR link on every reply that
  touched one. The cap and the shape live in ONE place, *WRITING THE REPLY*
  in the checklist at the top; this bullet is the history.** (Aug
  2026, Sophie: "a lot of my responses are really long and it's actually
  annoying cause I don't wanna read through it all").** The default reply is a
  few short paragraphs: the TLDR, her questions answered, and only the facts
  that change what she does or decides next. Cut the rest — play-by-play of
  the work, options you didn't take, recaps of things she already knows,
  restated plans, closing summaries, next-step menus she didn't ask for.
  Detail that genuinely matters goes behind an offer ("want the long
  version?") or into the PR description / a doc she can open — never into the
  reply by default. Output tokens also bill at several times the input rate,
  so a long reply costs real money on top of her reading time — but her
  reading time is the reason. "Small question → short answer" and "quick
  question mode" below are the tighter ends of the same dial, not exceptions
  to a verbose default.
- **DON'T HAND HER YOUR FINDINGS (2026-08-28, Sophie: "why r u telling me
  that", then "every chat tells me that like 70 times").** The reply that
  earned it ended with a free measurement — the style reference costs 1,505
  image tokens, most of the bill on a low run — which she had not asked about
  and which changed nothing she was doing. It is the same reflex in every
  chat: a chat measures something on the way to the work and reports it
  because it was interesting to MEASURE, and she gets the same aside dozens of
  times over.
  - **The test is whether it changes what she does next**, not whether it is
    true or hard-won. Token counts, per-call latencies, cache behaviour, what
    a route does internally, why an approach was slow: out.
  - **Money she is spending is the one that stays in** — the checklist's rule
    is unchanged (say what a turn spent, estimate a batch, ask above $3). A
    per-token breakdown of a bill she has already been told is not that.
  - **The finding is not lost, it is FILED**: the PR description, the commit
    message, or a line in this file where the next chat will read it. That is
    where a measurement belongs, and it is why writing it into her reply buys
    nothing.
- **NEVER THE QUESTIONS UI — ASK IN PLAIN TEXT (2026-08-28, Sophie: "from now
  on never questions mode · questions go as plain text").** When you need
  something from her, ask it as ordinary words in your reply — the option
  picker is out, always, whatever the harness offers. She dictates and reads on
  a phone, so a card of buttons is a shape she has to stop and operate where a
  sentence is one she can answer in the same breath. Ask ONE question, name the
  option you would take, and keep going with everything that does not depend on
  the answer (the *deliver the work* rule is unchanged — a question is a last
  resort, not a way to hand the decision back).
- **Small question → short answer.** When Sophie asks a quick or small
  question, reply with just the answer — no suggestions about what to do next,
  no updates on work already done, no recaps. Save those for when she asks.
- **Quick-question mode — phrase "quick question mode".** Sophie uses
  voice-to-text (she never types), so the trigger is the spoken phrase
  **"quick question mode"** (case-insensitive, matched anywhere in her message) —
  NOT a typed shorthand. When it appears (she may fire off a couple of rapid
  questions), keep the ENTIRE reply to **one iPhone screen, no scrolling** (she
  has an iPhone 13). Give the needed information — a sentence up to a short
  paragraph, NOT one word — but nothing beyond what's essential: no preamble, no
  options, no next-step suggestions, no reporting on other work, no closing
  recap. If a real answer genuinely can't fit one screen, give the short version
  and offer to expand ("want the long version?"). Answers only.

### Building a page, a screen or a piece of chrome?

**`docs/design-rules.md` has the deep half** — read it before you lay anything
out. The headlines, so you know when to go and look:

- **A web-wrapped tool's PAGE owns its header, and now it really does — APPLE'S
  NAV BAR IS GONE FROM EVERY ONE OF THEM (Aug 2026, Sophie: "yes, definitely
  pick B … get rid of the apple native bar").** This line used to end "but a NEW
  tool still ships with the native bar + chevron", and that contradiction is
  what she was looking at: two title strips stacked, Apple's on top with the
  chevron and the tool name, the page's own band underneath holding nothing but
  the "?" because it hid its title. **Use `.forgeWebToolBar(title, failed:
  loadFailed, back: navBack)`** on a web-wrapped tool — no bar while the page is
  up, and the bar back for the failure screen, which has no page to draw one and
  would otherwise strand her on "Couldn't open …".
  - **Swift's one remaining job is LEAVING**, because only Swift knows there is
    a screen behind the web view. `ForgePageHeader.install(into:onLeave:)`
    injects `window.__forgeLeave()`; `public/pagehead.js` draws the chevron and
    walks **`__navBack` → web history → `__forgeLeave`**. That order is the fix
    for "the back button always goes back too far", and it now ships with a
    DEPLOY instead of a TestFlight build — which is the real reason to prefer
    the page's header.
  - **`__forgeLeave` IS THE FEATURE FLAG.** The web half ships on merge and the
    Swift half waits for a build, so `pagehead.js` does nothing at all unless
    the bridge is there. Either half can land first; on the older build the app
    looks exactly as it did.
  - **`__nativeNavBar` IS STILL SET and still means what it always meant** —
    "chrome outside your content owns back, don't draw your own". Ten pages read
    it and pagehead.js is that chrome now. Dropping it would give each of them a
    second chevron, and `#back` means different things page to page (the Story
    Timeline's is a "Stories" button back to the shelf, not a way out).
  - **`history.length` CANNOT DECIDE THE CHEVRON'S LAST STEP (2026-08-20,
    Sophie: "the back button doesn't work … or doesn't go anywhere").** After
    a round trip (Review Queue → deck → back) the page sits at history INDEX 0
    with length 2, where `history.back()` is a silent no-op — so the chevron
    read as dead. pagehead.js stamps each entry's depth onto `history.state`
    (`__forgeDepth`) and leaves the tool at depth 0, with a 400ms bail to
    `__forgeLeave` if a back it did attempt turns out to move nothing. It also
    owns the header pattern now: title centred top-middle (`.fh`, direct
    children only — nested `.htext` stacks are left alone), the chevron in a
    small rounded box, and `.app-header` restored to FLEX (the old
    `display:block !important` un-hide is what stacked Meta Assets' title into
    the row below, under the pill). Tests: `node scripts/test-pagehead.js`.
  - A gated page inside a native tool must be asked for with `?embed=1`, and
    gated pages must not be cached. Test: `node scripts/test-pagehead.js` (both
    builds, headless).
- **Never serve a raw generated PNG to a page** — gpt-image-2 writes ~1MB PNGs
  and the same picture as webp is ~50KB, about 22x. Run
  `node scripts/webp-assets.js` then `webp-assets-verify.js` BEFORE deploying;
  there is deliberately no PNG fallback, so a missing copy is a broken picture.
  **This rule is about the DERIVED DISPLAY COPY, never the original — do NOT
  compress a generation call (Aug 2026, Sophie found it).** Shrinking the copy
  a page loads is right; shrinking the picture at birth is not.
  `output_compression` on an OpenAI images call is LOSSY and OpenAI applies it
  BEFORE the bytes come back, so what it discards never existed on our side and
  **no later pass can undo it** — only a re-draw, which is a different picture.
  It had spread by copy-paste to SIX live surfaces (the Playground's four
  gpt-image-2 styles, the Story Room pad's beat art, the Test Station house
  styles + the committed `public/samples`, and the Talking zine) and every
  original they ever made is 5-6x lighter than it should be: measured on one
  prompt, 281KB compressed vs 1,667KB clean. It showed as graininess on fine
  ink hatching, which the house style is full of. All of them are clean now and
  `node scripts/test-no-generation-compression.js` greps the tree so a
  copy-paste into a new module fails there instead of silently costing a batch
  of originals. Need a smaller file for a page? Derive one — `webp-assets.js`,
  or the `thumbs/` service in `server.js`.
  **AND WITHOUT THAT FLAG, `output_format:'webp'` COMES BACK LOSSLESS — webp is
  the CONTAINER, not a compression (measured 2026-08-27, Sophie asked: "why
  webp? are they compressed?").** Read the fourth chunk id of the actual bytes:
  a lossless webp is **`VP8L`**, a lossy one is `VP8 `. Every original this app
  stores is VP8L — a character card is 1,262,818 bytes for 1024x1024 (1.18
  bytes/pixel, which is lossless territory; a lossy webp of the same picture is
  a tenth of that) and a 4K Playground render is 3,051,188. The derived thumbs
  are `VP8 ` and are MEANT to be — that is the display copy the rule above is
  about. So "it's a webp" is never on its own evidence that something was
  compressed: **check the chunk id, and check whether the file is an original
  or a derived copy.** One command:
  `python3 -c "import sys;d=open(sys.argv[1],'rb').read();print(d[12:16])" <file>`.
- **THE HEADER TOP IS ONE NUMBER AND `pagehead.js` ENFORCES IT (2026-08-23,
  Sophie: "the header is different in both, and not at the top").** Measured
  that day: across all 39 gated pages the gap above the header ran 0 to 42px,
  because every page improvised its own status-bar clearance and new pages
  copied their neighbour's. `levelRow()` in `pagehead.js` now measures the
  real box and corrects the row to `var(--headtop)` (safe area + 4px) / left
  16 — so a page writes NO top-inset code of its own, and
  `node scripts/test-header-top.js` measures every `serveGated` page (the
  list is derived from server.js, so a new page is covered the day it is
  registered). Full rules in `docs/design-rules.md`.
- **A REPAINT NEVER REBUILDS WHAT DID NOT CHANGE (2026-08-28, Sophie: "this
  shud be the automatic best practices").** A poll or refresh that wipes and
  recreates image DOM strobes the page blank on iOS — the Story Room's
  "blinks a lot", found live on three more pages the same day. The pattern is
  a signature skip reading the same values the paint draws; full rule and
  worked examples in `docs/design-rules.md`.
- **The hairline `.acctabs` rows measure their own underline** — no row anywhere
  declares a tab count. Add a tab and the line still lands under the word.
- **Custom icons are framed at 1.11x the SF Symbol point size**, and every
  bundled glyph must fill exactly 0.90 of its own viewBox — run
  `python3 scripts/normalize-glyphs.py` after adding or editing one.
- **The sans is CAPS and not bold; the serif is untouched by that rule.**
- **`[hidden]` loses to any author `display` rule** — every page that toggles the
  attribute needs `[hidden]{display:none !important}`.
- **The home is ONE grid with a shortcut row of five filter squares** — there are
  no separate business/crafts home screens anymore.
## The other modules — the map

Each one's full reference moved into `docs/` (Aug 2026) so this file could stay
readable. The bullet keeps what you need WITHOUT opening the doc; open the doc
before working on that module. Nothing was deleted — the moved text is verbatim.

### Pictures
- **Playground** (`/playground`, `public/promptlab.html` + `/api/promptlab`, iOS
  tile) — the prompt tester. **THE FEED IS HERS — a chat does NOT draw into it**
  (2026-08-28): draw in your own container and file into your chat's Assets
  tab; a container-drawn panel sheet goes to `POST /api/promptlab/panels-import`.
  **Full details: *Playground* in `docs/modules/pictures.md` (moved from CLAUDE.md).**

- **Shoebox** (`shoebox.js`, `/api/shoebox`, page at `/shoebox`, iOS tile
  under the PICTURES filter) — the WHOLE Shoebox inside Deck Factory
  (2026-08-29, Sophie: "can u add the shoebox as a module on deck factory",
  then on the first cut that shipped only a picture shelf: "you forgot the
  library and the boards and the strings in the play button and everything
  else").
  **Full details: *Shoebox* in `docs/modules/pictures.md` (moved from CLAUDE.md).**

- **Squaring** (`cropper.js`, `/api/crop`, page at `/crop`, iOS tile under the
  PICTURES filter) — crop pictures to square by TAPPING ARROWS.
  **Full details: *Squaring* in `docs/modules/pictures.md` (moved from CLAUDE.md).**

- **Pattern** (a COMPARE PAGE in the animal-fruit-pattern-tool chat, built
  by `scripts/pattern-page.js` from `docs/pattern/pattern.tpl.html`; the
  module `pattern.js` at `/api/pattern` behind it for the pieces and a
  server export — 2026-09-22, Sophie: "a program that lets me choose and
  arrange animals and or fruits into a repeating pattern" · "i need to choose
  the constituents, choose how much to rotate, choose how far apart, and
  choose where they go" · then "does it need to be a page · can't it just be
  in compare"). Three hairline tabs: PIECES (tap ticks a picture onto the
  tile; a search box narrows the list as she types), TILE (drag to place, a
  degrees box and ±15 to turn, a size slider,
  flip, "+" for another of the same, SPACING grows the tile under the pieces
  so the repeats land farther apart, SPIN turns every piece at random within
  ±N°, SCATTER deals every piece a new random spot each tap, spread so
  nothing piles up — 2026-09-25) and REPEAT (the tiled preview, EXPORT at 1K/2K/4K —
  drawn on the page's own canvas and filed into the Dump, album `Patterns`,
  through the live `/api/drop/upload-file`). **NO DEPLOY, ever**: her
  patterns are JSON texts on the verdict doc (sheet `pattern`, keys `p:cfg:
  <id>` and `p:it:<id>:<k>`, its own sheet and its own prefix so a note can
  never overwrite one), and `node scripts/pattern-page.js --go [--supersede
  <id>]` posts a new version (ledger `docs/pattern/VERSIONS`). **The pieces
  are baked into the page**: every ready, unhidden doc on
  `forge-pattern-pieces` — 174 on 2026-09-23 (72 animals, **35 fruits —
  EXACTLY her picked deck, `scripts/decks/fruit-picked.json`, every other
  fruit piece hidden (09-23, "use the most recent one of each fruit i chose
  · including half peeled medium banana")**, 35 vegetables, 31 plants — the
  card-pattern chat's decks under `scripts/decks/` and the fruit chart's
  records), filed by `scripts/pattern-seed.js` with TWO cuts each: `cut`, the
  clean one (`vectorize.cutout`, the paper made see-through), and `rough`,
  THE ONE THE PAGE DRAWS — the scissors cut ported verbatim from
  `scripts/card-pattern.js --cut rough` (a loose 28-point polygon a 6%
  margin out from the drawing, wobbled, the white paper kept inside it;
  `pattern.js roughCut`, seeded by the piece's id) after her second look:
  "use the rough cut method on white no transparent background".
  `pattern-seed.js --rough` gives every piece without one its scissors cut
  (id = sha1 of the source url; an older twin under a name a preferred
  picture holds is HIDDEN, never deleted; card-only pictures under 500px
  skipped). A new piece is a
  chat's job — seed it or `POST /api/pattern/pieces {name, kind, src}` once
  the module is live — and a re-post of the page. **ONE ARITHMETIC,
  `pattern-plan.js`**, inlined into the page and required by the module: a
  piece over an edge is drawn again one tile over (nine copies listed, the
  ones that cannot touch dropped), a half-drop is the tile beside itself
  dropped h/2, a mirror is 2x2 reflected by `mx`/`my` flags the renderer
  applies. Items are `{piece, x, y, size, rot, flip}` with x/y as FRACTIONS
  of the tile, so growing the tile spreads them. Spends nothing; the module's
  DRAW route (a new piece in the fruit chart's exact recipe, ~6c) is the one
  paid thing and is not on the page. Test: `node scripts/test-pattern.js`
  (the plan, the whitelist, a real sharp render whose SEAM is measured, the
  built page through the server's own page-kit warnings, and the real page
  headless against a stubbed verdict store and Dump: a drag moves the saved
  x/y by exactly the drag, Export POSTs a real PNG). **Full details:
  `docs/modules/pictures.md` (Pattern).**
  **SINCE v9 (2026-09-25, Sophie's second look): UNDO · REDO** arrows in the
  pick row, on every tab (snapshots of the items, tile and layout before each
  change, memory only, per open; the name and exports stay out); **SPACING IS
  FIVE NOTCHES**, not a slider ("clear notches to click"); **RESET** puts every
  piece at its starting size with no turn ("reset to default · size and
  spin"); **WHITE AND GRID ONLY, FOR NOW** ("default white no other colors ·
  no half drop mirror toggle" — the half-drop and mirror arithmetic stays in
  the plan, the page just never asks); and **THE PAGE IS POSTED INTO THE CHAT
  THAT ASKED** (`--chat`), her patterns staying on the pattern chat's verdict
  doc. **v12: SAVE TO PHOTOS** — one button, one size (2K), a copy in the
  Dump, then the photo library through the `forgeSave` bridge (the share
  sheet until the build that puts the bridge on the Chats web view lands);
  no size chips, no Export, no link into Files. **v13: ONE SCREEN** — the
  band is six small whole tiles, size is five notches like spacing, and a
  selected piece's rows REPLACE the pattern rows so the Tile tab never
  scrolls (measured in the test, both states). **v14: SCATTER IS AN EVEN
  LATTICE** — every piece as far from the next as it can be (rows slid a
  fraction, or a rank-1 lattice, whichever spreads widest on the torus), a
  tap only re-deals which piece lands where; and **COPY** on the name sheet
  keeps an arrangement as a second pattern. `docs/modules/pictures.md`
  (Pattern).
  **AND A PIECE'S SIZE ON A TILE IS NEVER CHANGED WITHOUT ASKING (2026-09-23,
  Sophie, after a re-lay at two across made every picture bigger: "never
  change size without asking").** A re-lay she asked for changes ONLY what she
  named — the background, the count, the layout — and keeps the pictures the
  size they were; `--cols` moves the size with it, so a different column count
  is a size change and is hers to say. Same rule as the card mockups' "every
  card the same size": the size is a decision she made once, not a knob.
- **Freeform** (`freeform.js`, `/api/freeform`, `/freeform`) — the one image
  surface with **no opinion**: the prompt goes to gpt-image-2 verbatim, no prefix,
  no suffix, not even a trailing-period trim.
  **Full details: *Freeform* in `docs/modules/pictures.md` (moved from CLAUDE.md).**

- **Vector pipeline** (`vector.js`, `/api/vector`, page at `/vector`, iOS tile
  under the PICTURES filter) — describe 1-25 drawings -> ONE gpt-image-2 sheet in
  the pastel house style (~6c, the only cost) -> cut into cells -> trace each to
  SVG (free, local). **Making vector art, or touching `vector.js`/`vectorize.js`?
  Read `docs/vector-pipeline.md` FIRST** — it carries the exact style, routes,
  gotchas and tests. The one hard limit is GRADIENTS. Re-cutting a sheet you
  already paid for is free. Recolour after the fact with `POST /recolor`, and
  never turn that into a find-and-replace. **Full details: `docs/modules/pictures.md`.**
- **Card-deck art generator** (`apiframe.js`, `/api/apiframe`) — the deck card art
  via **Midjourney**, which has no official API, so it goes through APIFRAME
  (their own MJ accounts — none of Sophie's is involved). ~6-8c per generate of 4
  options. `ingest.js` (`/api/ingest`, `/import`) is the bring-your-own-Midjourney
  alternative, plus a Chrome extension that posts straight from her logged-in MJ
  session. **Full details: `docs/modules/pictures.md`.**

### Audio & film
- **Footage** (`footage.js`, `/api/footage`, page at `/footage`, iOS tile
  under the FILM filter's pictures stage — 2026-09-09, Sophie: "the next step
  is to build a point so I can just make things on my own time by describing
  them or uploading references") — **she sends a Seedance clip herself.**
  **THE STAR IS THE ONLY SEND AND IT READS THE BLOCK MARKS (2026-09-15,
  Sophie: "how do i select multiple non adjacent text blocks in footage to
  send appended as one prompt").** Each block's heading carries a tick; the
  star sends the ticked blocks as ONE appended clip (blocks 1 and 3 without 2),
  and with nothing ticked it is the block wearing the gold line, exactly as
  before. **Do NOT put a second star back** — that is the All button she had
  removed (#2397, "button is stipid get it out") and `test-footage-audit-5.js`
  pins its absence.
  **THE FUNNEL SITS BESIDE THE FOLDER, ALWAYS, AND HAS A TRIMMED ROW
  (2026-09-25, Sophie: "where is the filter button in footage · shud be next
  to the folder" · "add a filter for trimmed clips").** It was the glass's
  sub menu from 09-11 and hid with the search field — she could not find it.
  The folder, the funnel, the field and the drawer are one flex item of the
  bar (`.narrow`), so at 390pt the pair drops to a second line TOGETHER
  (the first line was measured full); the funnel wears its own count. Do not
  tuck it back behind the glass. Full note under *Footage* in the doc.
  **A TRIM'S ROOM GUARD ASKS FOR THE CLIP'S OWN ROOM (2026-09-26, Sophie:
  "i'm worried not all my trims have been going through"): measured, 6 of
  the 7 trims she cut on 09-25 were refused for room a 480p trim never
  needed (51MB, not 150), and a refused part could not be retried. Now:
  need by pixels off the probe, anonymous memory not RSS, and **Try again**
  on the card. Full note under *SHE TRIMS A CLIP AS IT COMES OUT* in the doc.
  **Full details: *Footage* in `docs/modules/audio-and-film.md` (moved from CLAUDE.md).**

- **Stitch** (`stitch.js`, `/api/stitch`, page at `/stitch`, iOS tile under the
  FILM filter's shelf stage — 2026-09-12, Sophie, after saying Assembly "never
  really worked" and the Film Editor "was the one that never worked": "i'm
  thinking something very simple.
  **AND SHE CAN NUMBER THE CLIPS ON FOOTAGE ITSELF (2026-09-23, Sophie:
  "press the stitch mode icon in footage and then i select the clips and add
  numbers to them · and then they go to the stitch area in that order")** —
  the three-boxes button beside Footage's `?` turns on STITCH MODE: a tap on
  a tile puts the next number on it, a second tap takes it off, a trimmed
  clip puts its parts in one number each, and **Send to Stitch** (`POST
  /api/stitch/from-footage {ids}`) makes the stitch in that order and opens
  it. It is in the header, not on the feed bar — the bar's first line is
  full at 390pt (measured). Test: `node scripts/test-footage-stitch-mode.js`.
  **Full details: *Stitch* in `docs/modules/audio-and-film.md` (moved from CLAUDE.md).**

- **Movies** (`movies.js`, `/api/movies`, iOS Movies tab — no web page) — story ->
  ~8-12 self-contained scenes -> gpt-image-2 panels -> Replicate image-to-video ->
  ffmpeg stitch, ~$1.35 for a 12-scene film.
  **Full details: *Movies* in `docs/modules/audio-and-film.md` (moved from CLAUDE.md).**

- **Cutting Blocks** (`blocks.js`, `/api/blocks`, page at `/blocks`, iOS tile
  under the FILM filter) — the TOP of the audio pipeline. A recording comes
  apart into sentence-level LINES to split (tap two words), meld back together
  (the chain), mark **locked in / not sure / out** (three states, not
  keep-or-cut), reorder, respeak in her voice, and **hear as marked before
  anything is cut**. It was a hand-authored Compare page re-posted at v14 with
  no server behind it — five capabilities that existed nowhere else, and every
  improvement cost a chat re-authoring an 87KB artifact.
  **The two-tier timing rule is load-bearing:** the bulk 75s-chunked whisper
  pass places and PREVIEWS a line (via the Episode Editor's `page-cut`), and
  the real render RE-LISTENS per card and cuts through `editor.js`'s validated
  cutter — the Cutting Room's finding, imported rather than re-learned
  (`cuttingroom.js` now exports `chunkedWords` / `cutSection`). Her marking
  state is a whitelisted patch on one Firestore doc (`forge-blocks`,
  content-addressed by the source url, so re-opening resumes); words and
  blocks live in Storage. Transcription is ~$0.006/min, once ever per
  recording; rendering is ffmpeg on our own box, free. Tests:
  `node scripts/test-blocks.js`. **Full details: `docs/audio-pipeline.md`.**
- **Pausing** (`pausing.js`, `/api/pausing`, page at `/pausing`, iOS tile under
  the FILM filter) — the BOTTOM of the audio pipeline, and the other half of
  the polish pass: **how long a beat sits**. The Cutting Room can only REMOVE a
  pause (compressed to ~0.28s, its one length); here she sets a length, ADDS a
  pause where the recording has none, and hears her EDIT rather than the
  source ("I need to be able to hear it to know how long of a pause I want").
  It was a hand-authored Compare page ("Evan — the pause timeline v7b") with
  its whole state in a chat's verdict fields.
  **Three things not to undo.** (1) **Pause detection is IMPORTED** —
  `cuttingroom.js` exports `breathCuts`/`roomToneCuts`/`mergeRanges`/
  `rmsProfile` and this module calls them; every constant in them is a measured
  finding, so a second copy would find different pauses and the same recording
  would read differently in two rooms. Those passes return ranges to REMOVE,
  inset by KEEP/2 either side — Pausing takes the inset back off to get the
  GAP, and no further (the 0.10s margins are speech protection). (2) **A PAUSE
  IS NEVER DIGITAL SILENCE** — it is the recording's own room tone, an existing
  gap lending its own air (trimmed or looped) and an added pause borrowing the
  quietest stretch of the file, baked once at `pausing/<id>/room.wav`. Zero
  samples read as a dropout; that is what made the "45 percent" line sound
  bungled. (3) **The edit is ONE file** — `pause-plan.js`, loaded by the render
  on the server AND served to the page at `/pause-plan.js`, because she
  approves a length by ear and the preview has to be the take. It does not cut
  WORDS (that is the Cutting Room's and Cutting Blocks' job, with the re-listen
  a real word cut needs); "out" is 0.08s of room tone, an elision. Listening is
  per PARAGRAPH — the server cuts that span once via `/api/search/clip-span`
  and the page splices in the browser, so changing a length costs no round
  trip; ninety minutes decoded would be most of a gigabyte in a WKWebView.
  Transcription ~$0.006/min once ever per recording; everything else is free.
  **"CUT PAUSE" IS A NOTE FOR THE CHAT (2026-09-05, Sophie: "the function is
  a note for u, then u fix").** Every chip's sheet carries a red *cut pause*
  button; it stores the word `cut` in `set`/`added` in place of a length, the
  chip paints red and says *cut*, the tally counts "N to cut", and the plan
  renders NOTHING for it (`cuts` on `planEdit`'s answer). A chat rendering her
  film reads them off `GET /api/pausing/:id` and tightens those spots by
  energy — never assume a marked pause was rendered shorter by the tool.
  Tests: `node scripts/test-pausing.js` (pure) and `node
  scripts/test-pausing-page.js` (the real page, headless, asserting on the
  SAMPLES — a pause must be quiet and NON-ZERO).
  **Full details: `docs/audio-pipeline.md`.**
- **Chunking** (`clips.js`, `/api/clips`, page at `/chunking` — `/clips` is an
  alias — iOS tile under the FILM filter) — the clip LIBRARY: every short
  self-contained piece the app has made, on one shelf, four to a row with names
  under the posters, so a re-cut reuses clips instead of re-paying for them.
  **A CHUNK (Sophie's word, what the tool is named for) is a named, tagged
  SECTION of a finished video — footage + voiceover together — that she'd
  reuse whole in a different video** (her examples: the Sheldrake telepathy
  bridge in the Evan video; the manifestation trio she visualized at night).
  `POST /api/clips/chunk {url, start, end, title, vo?, tags?, from?}` files
  and bakes one in the background (content-addressed by url+span; `vo` =
  the span's voiceover text, searchable as `vo:`); the harvest never touches
  chunks. Any chat that cuts a section of a finished video should file it.
  **Rebuilt from scratch 2026-08-15** (Sophie asked for a fresh take on the
  first build; the old `forge-clips` collection lies dormant — this one is
  `forge-clip-library`). **It generates and stitches nothing and costs
  nothing.** Harvest = Firestore (movie scene clips + kept re-rolls + dream
  bridges + quick-animates, arriving with real titles and the generation
  PROMPT) + a Storage SWEEP for the shorts chats built into their own
  prefixes. **The skip list is the load-bearing half** (`SKIP_PREFIXES`,
  measured 2026-08-15): the Dump, whole interviews, finished
  episodes/films, `movies/` (the Firestore half covers it), the pad's
  still-encode cache, voice notes; a swept file over 64MB never downloads,
  and one probing over 180s is a film, skipped and counted. Search is the
  whole interface — the house grammar (`search-grammar.js` parses; matching
  is substrings over normalized text) with `tag:`/`title:`/`from:`/`prompt:`/
  `note:`/`kind:`; the box runs through `liveInput` so dictation searches as
  she speaks; semantic search deliberately not built yet. **Her edits always
  win** — `editedFields` on the doc; a re-harvest never overwrites a touched
  field, and there is deliberately NO delete route (hidden is the verb).
  Posters read the bytes via the Admin SDK, NOT the url (ffmpeg can't reach
  the sandbox's HTTPS proxy), frame at ~15% in, 480px webp. Opening the page
  never starts a harvest — it only shows a running one.
  Tests: `node scripts/test-clips.js` (pure, no network).
  **Full details: `docs/modules/audio-and-film.md`.**
- **Assembly** (`assembly.js`, `/api/assembly`, page at `/assembly`, iOS tile
  under the FILM filter) — put pieces IN ORDER on a timeline, then bake one
  film.
  **Full details: *Assembly* in `docs/modules/audio-and-film.md` (moved from CLAUDE.md).**

- **Film Editor** (`filmeditor.js`, `/api/filmeditor`, page at `/filmeditor`,
  iOS tile under the FILM filter) — **the one surface that CUTS video**, built
  Aug 2026 from Sophie's own Claude Design canvas (`docs/film-editor-design/`,
  which also carries the other chat's gaps file — the build fixed every bug it
  names).
  **Full details: *Film Editor* in `docs/modules/audio-and-film.md` (moved from CLAUDE.md).**

- **The audio PROJECT** (`audioproject.js`, `/api/audioproject`,
  `forge-audio-projects` — no page of its own) — the light cross-room id
  Sophie picked (2026-08-19): threaded through every audio hand-off as
  `&project=`, it carries the NAME and WHO-SPEAKS so they are decided once;
  marks/geometry stay room-local ON PURPOSE (each room re-listens anyway).
  `GET /walk?url=` derives full lineage by joining render urls to source urls
  across the room collections — zero stored state, ~60s cache — and feeds the
  one-line "came from · went on to" strip on `/blocks`, `/cutmarks` and
  `/cuttingroom`. Every project write is best-effort: a room must open fine
  with no project at all. The Episode Editor deliberately doesn't mint one.
  Tests: `node scripts/test-audio-wiring.js`.
  **Full details: `docs/audio-pipeline.md` (The PROJECT across the rooms).**
- **Songs** (`songs.js`, `/api/songs`, `/song`) — she sings into her phone, out
  comes a produced track with HER actual voice (resemble-enhance -> musicgen
  melody conditioning -> ffmpeg mix). ~$0.11 per 30s chunk. **It has no tile
  anywhere by request** — see the deliberately-unlinked pages note.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Voice Memos — ONE library, and every path files into it.** membry Storage
  `memo-audio/` + a manifest (`memos.js`, `/api/memos`); the Mac push, the iOS
  share sheet, Story Room pastes and a chat with a pasted file all funnel through
  `memos.fileIntoArchive()`. **A chat files a pasted recording with ONE call —
  never hand-build the stamp:** `POST /api/memos/ingest?title=&dur=&ext=m4a` with
  the raw bytes as the body. Transcription is unconditional. Dedupe is three
  layers (file md5, date-zeroed audio fingerprint, transcript backstop) because
  iOS rewrites an m4a's dates on every share — so identical audio has different
  bytes. **A shared stamp is NOT a duplicate** and never dedupes anything.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Voice Studio** (`voicelab.js`, `/voice`) — her cloned voices, two hairline
  tabs: TEXT (TTS, stock v2 defaults, no settings by design) and VOICE
  (speech-to-speech on `eleven_multilingual_sts_v2`, which keeps the performance
  and swaps only the voice).
  **Full details: *Voice Studio* in `docs/modules/audio-and-film.md` (moved from CLAUDE.md).**

- **Audio drop** (`audio.js`, `/api/audio`) — the generic destination for audio
  off her phone: dump first, label afterwards, files keyed by byte md5, readable
  Storage paths because these URLs get pasted into other tools by hand. The iOS
  share sheet routes audio here. **Do NOT point Sophie at the `/audio` PAGE to
  find a clip** — it is an uploader whose list only shows the batch typed in its
  box. **Full details: `docs/modules/audio-and-film.md`.**
- **Episode Editor** (`editor.js`, `/api/editor`, `/editor`, iOS tile) — she picks
  spans of a real interview transcript as snippet cards, arranges them with
  narration and gap cards, taps Render, gets finished audio. **It owns THE cutter**
  (a faithful port of `scripts/nde-supercut-precise.py`: `phraseSpan` ->
  `clampBounds` -> silence snapping -> micro-fades) — every other tool imports it
  rather than hand-rolling one. Every cut is banked in a permanent clip cache, so
  a clip is cut once ever; bump `CUT_VERSION` when the cutting logic changes.
  Editing during a render is safe. **Full details: `docs/modules/audio-and-film.md`,
  and `docs/nde-precise-cutting.md` for the cutting pipeline itself.**
- **Cutting Room** (`cuttingroom.js`, `/api/cutroom`, `/cuttingroom`, iOS tile) —
  she opens one of her OWN recordings, marks it **on its transcript** (never a
  waveform), cuts pauses out, slices sections off to save or send on. Designed
  around her wrist: everything is a tap, nothing drags or scrubs. **Every real cut
  re-listens first** — the stored bulk-pass words are chips-only accuracy. **Her
  voice is never loudnormed.** A finished Episode Editor render comes here (the
  scissors on each render row) to have its pauses and filler taken out — that is
  deliberately NOT done inside a render, because removing an "um" from the middle
  of a clip is a splice and a splice gets approved by ear.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Search** (`search.js`, `/api/search`, `/search`, iOS tile) — one search across
  BOTH transcript libraries (77 interviews + 1,000+ voice memos). Results are
  PASSAGES with audio, and the hand-offs are the point (interview -> Episode
  Editor, memo -> Cutting Room). Two modes: WORDS (keyword, free) and MEANING
  (int8 embeddings, ~$0.05 to embed the library). **Re-index after ingesting new
  videos or memos, then re-embed** — vectors are keyed to the index build and go
  stale. **Full details: `docs/modules/audio-and-film.md`.**
- **Cut Marks** (`cutmarks.js`, `/api/cutmarks`, `/cutmarks`, iOS tile) — the
  manual sibling of the Cutting Room: no transcript, no waveform. She plays the
  file, taps the scissors at the spot, the marks split it into pieces she keeps or
  drops, render bakes one new file. Audio or video. Renders never overwrite — an
  audio one also files into the audio library (batch `cut-marks`), a video one
  stays on the recording's Cuts list. **Two hairline tabs at the top, CUT ·
  MARKS & PIECES** (Aug 2026): the cutting (picture, transport, strip) and
  everything she has made (pieces, marks, cuts) take turns on the whole screen,
  so neither is a scroll away; the player, transport and strip never scroll.
  **Full details: `docs/modules/audio-and-film.md`.**
- **YouTube auto-upload** — finished videos post to her business channel as
  **private drafts** for her to publish by hand; nothing goes public
  automatically. `scripts/youtube_upload.py` (stdlib only), auth via a durable
  refresh token, upload-only scope. **Full details: `docs/modules/audio-and-film.md`.**
- **Grab a video** (`ytdl.js`, `/api/ytdl`, no page — a chat calls it) — paste a
  YouTube (or Vimeo, or almost anything yt-dlp knows) url, get the file, already
  filed where the tools look.
  **Full details: *Grab a video* in `docs/modules/audio-and-film.md` (moved from CLAUDE.md).**

### Story
- **The pad IS the Story Room now (Aug 2026)** — `/storyroom` serves the pad page
  and the app's Story Room tile opens it.
  **Full details: *The pad IS the Story Room now* in `docs/modules/story.md` (moved from CLAUDE.md).**

- **Scratch Pad / Story Room** (`scratchpad.js`, `/api/scratchpad`, page built by
  `scripts/gen-scratchpad.py`) — thinking with pictures.
  **Full details: *Scratch Pad / Story Room* in `docs/modules/story.md` (moved from CLAUDE.md).**

- **Story Room data** (`forge-story` in membry, `/api/story/*`) — one doc per
  story; **every content field is optional**, any one of them starts a project.
  Films live ON their story. Voiceover comes in by PASTE (from iOS Voice Memos) or
  file — there is deliberately no record button. The approve/candidate step is
  **PARKED** by request: the data model keeps `status`, but nothing user-facing may
  show approval state. **Making art for the "Evan" story? `docs/evan-film-style.md`
  FIRST** — write NO style description at all.
  **Full details: `docs/modules/story.md`.**
  - **THE MIGRATION TO THE PADS LEFT THINGS BEHIND, AND FIXING IT IS SOPHIE'S
    CALL — `docs/story-room-unported.md` (2026-08-24, her ask: "document this
    as something to possibly fix but that no chat should fix it without me
    saying so").** Whatever moved `forge-story` onto the story pads followed
    ONE field, `voiceover.url`, and dropped the art into each pad's INBOX. So
    five stories (Jonas, Moon Milk, The Meteorite, Charlie, My Own Destiny)
    have an empty canvas with their pictures waiting unplaced and **the
    narration line that went under each picture carried nowhere**; nine pinned
    covers were lost, so the shelf derives a different face; Charlie's and
    Evan's chapter headings had no field to live in — **they do since
    2026-09-06: `beat.chapter`, see CHAPTERS below** (porting theirs is still
    hers to ask for); and Wormsicles, which had
    no voiceover to follow, had no pad at all until one was made. **The audio
    half IS fixed** — every pad carries its `description`/`descriptionAudio`/
    `voiceover` now, which is what finally lights the *About this story* button
    (it had never appeared on any story). **The COVERS and CHARLIE are also
    done, on her word the same day** — her pinned shelf face is back on Moon
    Milk, Jonas, My Own Destiny, Soul Leaves the Body and Evan, under her rule
    **"unless I already chose a different one on purpose"** (a pad carrying its
    own `cover` is left alone), and Charlie is now two versions in one bucket:
    `folder:"Charlie"` over *as it is now* and *as it used to be*. **The other
    four stories' beats are documented and deliberately NOT done.** Do not place
    them from that doc: which of a beat's 2-5 candidate pictures wins is the
    story's look, and that is hers. Propose it in a reply and wait for a go.
  - **PORTING WORDS: ONLY WHAT SHE SAYS (2026-08-24, Sophie: "any words that
    aren't part of the narration need to go like the moon milk ones describing
    the action").** A card's `label` describes the picture ("Final shot",
    "upscaled from the mini panel") and is never narration. And some stories'
    `vo` is stage direction rather than narration — Moon Milk's *"She holds the
    bucket up to the smiling moon's tap"* is the named example — so it must not
    land on a canvas as her words. Charlie's lines were read one by one before
    porting. **Picking the picture is not the status field either**: a card
    whose label calls it a storyboard panel sorts LAST before status is read,
    because the corrected upscale is often only a `cand` while the rough panel
    it replaced is a `draft`.
- **Story Timeline** (`timeline.js` + `timeline-parse.js`, `/api/timeline`,
  page at `/timeline`, iOS tile) — a dictated list of moments becomes cards she
  can put in order.
  **Full details: *Story Timeline* in `docs/modules/story.md` (moved from CLAUDE.md).**

- **Story Link** (`storylink.js` + `storylink-plan.js`, `/api/storylink`, no
  page yet) — **one story, three rooms.**
  **Full details: *Story Link* in `docs/modules/story.md` (moved from CLAUDE.md).**

- **Character Creator** (`character.js`, `/api/character`, page at `/character`,
  iOS tile "Characters", and a sheet inside Dreams) — the recurring people in
  her dreams and stories: a photo + a name + her aliases ("me"/"Sophie",
  "Daddy"/"Dad") become a diary-comic reference the dream render matches each
  dream's cast against, so a face stays the same picture to picture.
  **Full details: *Character Creator* in `docs/modules/story.md` (moved from CLAUDE.md).**

- **Writing Room** (`writing.js`, `/api/writing`, `/writing`, iOS tile) — every
  dating-book date in two versions ("Claude's" and "Mine") with every changed word
  marked red, autoscroll, and per-paragraph notes (text or voice memo). **Notes are
  the review loop**: she annotates on the couch, ANY chat can read them
  (`GET /api/writing/notes`) and apply the edits, then DELETE them. Source of truth
  is `docs/dating-book/working-drafts/featured2.json`; run
  `python3 scripts/gen-writing.py` after editing and commit all three files.
  **Full details: `docs/modules/story.md`.**

### Business
- **Product pipeline** — the **Product Creator IS `/studio`** (iOS tile on the
  business filter): describe a vibe -> plan theme/styles/products -> generate
  designs -> real Printify mockups -> AI listing copy -> one Create tap runs the
  whole batch as a server background job. **Nothing goes live from here, ever** —
  apparel/mug become Printify products published to Etsy as DRAFTS, art
  print/card become plain Etsy drafts. Five self-contained modules behind it:
  `pipeline.js` (orchestration), `printify.js` (live-confirmed), `printful.js`,
  `lulu.js` (books), `mpc.js` + `mpc-upload.js` (card decks at MakePlayingCards,
  which has no POD API — payment is never automated). Keys load from env vars OR
  a Firestore doc via `config-loader.js`; host env always wins.
  **Full details: `docs/modules/business.md`, plus `docs/mpc-fulfillment.md`.**
- **Etsy** (`etsy.js`, `/api/etsy`) — Open API v3, the terminal step of the
  pipeline: generated design -> POD product -> **draft** listing Sophie reviews
  before publishing. Two auth tiers (app-level reads need keystring AND shared
  secret joined by a colon; writes need OAuth+PKCE, tokens persisted to
  Firestore so they survive redeploys). Title <=140 chars, <=13 tags of <=20.
  **Shop Report** at `/report` — numbers are free, the AI advice is opt-in via
  `?advice=1`, because opening a page must never spend money.
  **Full details: `docs/modules/business.md`.**
- **Shopify** (`shopify.js`, `/api/shopify`) — one Admin custom-app token for the
  newsletter audience and blog publishing. **NOT the storefront token.** Three
  auth modes; the client-credentials one silently returns an EMPTY-scope token for
  single-store apps, which is the trap to recognise — use the OAuth `/connect`
  flow instead. **Full details: `docs/modules/business.md`** (including the Dev
  Dashboard setup, which changes often — re-verify the UI before instructing).
- **Photo -> Etsy** (`photostudio.js`, `/api/photostudio`, `/photo`) — a separate
  track from POD, for things Sophie already MADE: one photo of the real product ->
  reviewable Etsy draft. Mockups use gpt-image-2 **edits**, which preserve the
  ACTUAL product rather than hallucinating one. **NO `input_fidelity` — every
  image surface here is gpt-image-2 and it refuses that flag BECAUSE it runs
  every input at high fidelity automatically** (2026-09-16, Sophie: "use 2,
  change everywhere and the docs"; OpenAI's own docs). This route led with
  gpt-image-1 + the flag until that day, on a comment here calling gpt-image-2
  "degraded" — backwards, and it had been filing `gpt-image-2` as the caption
  on every mockup gpt-image-1 drew. gpt-image-2 is also cheaper ($8/1M image
  in, $30/1M out, against $10 and $40). gpt-image-2.5-sunburst / -flare exist
  on the key (2026-09-08) and are UNMEASURED here — hers to ask for.
  **Full details: `docs/modules/business.md`.**
- **Jewelry → Etsy** (`jewelry.js`, `/api/jewelry`, page at `/jewelry`, no
  iOS tile — 2026-09-16, Sophie: "a simple user friendly website my mom can
  interact with, with clear step by steps 1. upload jewelry 2. review details
  and approve sample photos" · "the chatgpt model makes the pics" · "she only
  uploads one") — her MOM's two-step page. ONE phone photo of the piece goes
  in; one tap ("Make the listing") runs ONE background job: Claude reads the
  photo and writes the listing (title, materials, description, 13 tags, a
  price guess — words a human reads, so Claude), then gpt-image-2 (the
  ChatGPT image model) draws FIVE sample photos (main · close-up · styled ·
  another angle · worn) with the photo attached as `image[]` under the MASTER
  FIDELITY PROMPT from her jewelry pipeline chat ("the jewelry item is
  immutable… only the background, lighting, framing, camera position, and
  surrounding scene may change") — the five prompts of that chat, verbatim.
  She fixes the words, taps "Looks good"/"Redo" per photo, and SEND TO ETSY
  makes a DRAFT with the approved photos (the photostudio path:
  `pipeline.publishDraft`, defaults off an active listing). Nothing goes live.
  **About 30¢ a piece** (five medium shots with one reference at ~6¢ each,
  the read ~1¢); a Redo ≈ 6¢. Four things to know: the prompt NEVER
  describes the photo (the never-describe-a-reference rule — the photo is
  the description; only the seller's own notes ride, as "scale information");
  gpt-image-2 rejects `input_fidelity`, so the fidelity is prompt + reference,
  which is what her chat settled on; a shot is saved as a stamped PNG (Etsy
  takes no webp) plus a 600px webp thumb the page shows; the page is served
  like `/photo` (studio gate off live, so the link just opens — if
  `STUDIO_TOKEN` is ever turned on, her mom needs the fruit.js `who=` pattern,
  not built) and `/make` + `/redo` carry selfcare's per-IP rate limit (12 an
  hour). `?account=<name>` on the link picks which Etsy shop the draft lands
  in (`etsy.shopIdForAccount`). Every shot's exact prompt is on the doc AND
  inside the PNG. Test: `node scripts/test-jewelry.js` (pure + the real page
  headless against a stubbed API). **Full details:
  `docs/modules/business.md` (Jewelry → Etsy).**
- **Lightroom → the picker** (`lightroom.js`, `/api/lightroom`, page at
  `/lightroom`, the script at `/lightroom-sync.py` + `/lightroom-sync.bat` —
  2026-09-16, Sophie: "step 1. extract images from her lightroom" · "too many
  to export" · "she has tons of files" · "classic · 4000 pics" · "step 2.
  tinder picker based on her specs"). NO EXPORT: the script runs once on her
  mom's Windows PC (double-click the .bat; Python from the Microsoft Store),
  reads the Lightroom Classic catalog file (SQLite) for every picture's
  title, folder and collections, lifts each picture's preview out of
  Lightroom's own cache (`… Previews.lrdata`, the level around 1,000px) and
  POSTs it to `/api/lightroom/photo`. Only folders/collections matching
  "necklace" are sent; resumable (`GET /have`); `--dry` counts first,
  `--limit 20` a few first. Her mom's rules (the recording, `lightroom.js`
  `classify`): a title that is just N + a number is a piece (`N12`); sold /
  sample bag / gave / gifted / donated are out; anything else is "other".
  `/lightroom` is a JUDGE page (`/judge.js`, never a hand-rolled deck): one
  card per piece with EVERY photo on it, her four words as the states — star
  · yes · maybe · no — on her computer; verdicts on the chat verdict doc
  (`jewelry-upload-website` / `lr-<catalog>`). **Send starred** turns picked
  pieces into jewelry.js items (front photo = the ONE picture) and starts
  each Make job — ~30¢ each, so the button arms on the first tap with the
  count and the cost and sends on the second (`POST /send {confirm:true,
  limit}`, default 5, max 40, never a piece twice). **THE CATALOG SCHEMA IS
  AN ASSUMPTION** — the test builds a synthetic catalog from the tables the
  script reads (Adobe_images · AgLibraryFile · AgLibraryFolder ·
  AgLibraryRootFolder · Adobe_AdditionalMetadata's dc:title XMP ·
  AgLibraryCollection* · previews.db's imageId/uuid/digest table); the first
  `--dry` on her real catalog is the measurement. Test:
  `node scripts/test-lightroom.js`. **Full details: `docs/modules/business.md`
  (Lightroom → the picker).**
- **The hat store** (`hats.js`, `/api/hats`, page at `/hats` — PUBLIC, no
  tile; 2026-09-22, Sophie: "if i wanted to make a hat store for my friend" ·
  "no etsy no printify · it's thru instagram" · "use my buy button?" · "build
  the hats page") — her friend's hats, sold from an Instagram bio link. The
  hats live in SOPHIE'S Shopify (cod-god-inc): the page reads the collection
  whose handle is `hats`, or, until that exists, every product TAGGED `hats`
  (measured 2026-09-22: the store had neither, so the page opens on "No hats
  yet" until the first one is tagged and published to the Online Store
  channel). Buying is the Buy-Button model the witch app's Shop tab already
  uses — a fresh cart on the public Storefront API, then Shopify's own
  checkout — so money lands in her shop and she pays her friend out; nothing
  on the page spends, and no card number touches this server. Two across on
  a phone, a hat opens as a sheet (a picture strip that snaps, a chip row per
  real option with a sold-out combination struck through, Buy off until every
  option is picked, Buy hugging its words), and `/hats#<handle>` opens on one
  hat, which is the link for a post. Instagram itself is by hand (product
  TAGGING ties a catalog to one account — hers — and the API needs a Meta app
  review); the bio link works from any account. Ten-minute product cache;
  `POST /api/hats/refresh` after adding a hat. **A hat goes IN with `POST
  /api/hats/add {title, price, imageUrl}` (Admin token, tagged and
  published) or, from a container with no deploy, `node scripts/hats-add.js
  --title … --price … --image … [--dry]` — shopify.js treats its STORED
  OAuth token as connected since 2026-09-22, so no app keys are needed. Every add publishes to Online Store AND Buy
  Button — the storefront token is the Buy Button channel's, and a product
  published only to the online store is invisible to the page (measured
  2026-09-22).** Test:
  `node scripts/test-hats.js` (the shape pure, the router over a stubbed
  store, the real page headless with every check measured).
  **Full details: `docs/modules/business.md` (The hat store).**
- **Blog Studio** (`blog.js`, `/api/blog`, `/blog`) — topic -> long-tail keywords
  -> full SEO post -> image -> publish. **Primary destination is the on-site blog
  at secretlyawitch.com/blog**, so organic traffic builds the real domain;
  Shopify is secondary. Keywords AND draft both run on **Claude** (reader-facing
  words). **Full details: `docs/modules/business.md`.**
- **Tarot email** (`tarot-email.js`, `/api/tarot-email`) — the kinetic daily
  spread as three face-down cards with pure-CSS tap-to-reveal (email clients strip
  JS). Apple Mail gets the real flips; Gmail/Outlook fall back gracefully. The
  spread is deterministic per day and MATCHES THE WEBSITE (a verbatim port of
  `witch.html`'s `dailyPull()` — keep the deck data in sync). Campaign sends stay
  in Brevo's dashboard. **Full details: `docs/modules/business.md`.**
- **Crystal drop** (`crystals.js`, `/api/crystals`, `/crystals`) — her mom's
  crystals, photographed, on their way to Etsy listings. **The album-is-one-stone
  model is WRONG for most of the real data**: the photos live in the Dump (15
  albums, 629 photos), and most albums are catalogue runs holding 20-50 separate
  stones — roughly 175 stones in total. Nothing can DERIVE where one stone stops
  and the next begins, so **the Splitter (`/crystalsplit`) asks her**: one tap on
  any photo that starts a new stone. Marks are file ids, never indexes. Tiles must
  use `thumb`, never the full-resolution `url`.
  **Full details: `docs/modules/business.md`.**

### Public apps
- **Secretly a Witch** (`public/witch.html`, `/witch`, **ungated/public**, and
  `secretlyawitch.com`) — mobile-first single-page app, five tabs (Today,
  Miracles, Tarot, Conjure, More), its own dark mystical theme (NOT `forge.css`),
  a shop that sells in-app via the Storefront API, and the Book of Shadows.
  **Full details: *Secretly a Witch* in `docs/modules/apps.md` (moved from CLAUDE.md).**

- **Sticker Day** (`public/selfcare.html`, `/selfcare`, **ungated/public**) —
  seven small acts of self care a day, each one a sticker: an un-earned task is a
  flat grey silhouette, tapping it peels the sticker on in colour and opens a mini
  lesson. State is `localStorage` only, which is why the page is ungated. Sticker
  art must be a transparent die-cut PNG (the silhouette is the same PNG,
  CSS-masked). Its third tab is the **Memory Passport** — four stamps a day, the
  scalloped edge drawn by the PAGE not the model, with a paid draw-your-own that
  spends real money on a public endpoint (rate-limited).
  **Full details: `docs/modules/apps.md`.**

### The Anthony Chene NDE project
- **Anthony Chene NDE moments database** (`nde.js`, `/api/nde`) — reads his
  near-death-experience interviews and extracts illustratable moments unique to
  each experiencer. **Adding videos runs on SOPHIE'S Mac** — not for the bytes
  (`/api/ytdl` grabs those from the cloud) but because `nde-grab-local.py` banks
  them in the exact layout the cutter reads. Her one
  command is `cd ~/imageforge && git checkout main && git pull origin main &&
  ./scripts/grab` (the `git checkout main` is load-bearing, not boilerplate).
  `./scripts/clip` pulls short video clips instead.
  **Her home uplink stalls on any single upload over ~1MB**, so every Storage
  upload from her Mac must be chunked via `blob.open("wb", chunk_size=…)` — NOT
  `upload_from_string` with `chunk_size` set on the blob, which looks equivalent
  and silently still sends one request. When `git push` stalls on her Mac, hand
  the commit to a cloud chat rather than fighting the network.
  **Full details: `docs/modules/nde.md`.**
- **NDE movies — the watercolour look.** Making art for the montages? Read
  `docs/nde-watercolor.md` FIRST; the headline rule is counter-intuitive — write
  NO style description at all, just attach `refs/sage-sandy-mirror.png` as a pure
  style reference (gpt-image-2 edits, quality medium, 1024x1536). The nine
  experiencer character cards are BUILT and public — do not re-derive them.
  **Only nine people have an approved likeness: never invent a face for a real
  person.** **Full details: `docs/modules/nde.md`.**

### The inbox, the doorbell, and odds and ends
- **Favorite fruit poll** (`fruit.js`, `/api/fruit`, pages `/fruit` + `/fruitchart`)
  — the chart for Sophie's fridge. 27 fruits drawn in her ink-and-watercolour
  look (`refs/sage-sandy-mirror.png` through gpt-image-2 edits, medium,
  1024x1024, `scripts/fruit-chart/fruits.json`) become a **Tinder-style swipe
  deck**: ♥/✕ one fruit at a time, then crown a #1. **BOTH PAGES ARE PUBLIC AND
  UNGATED, and that is the design** — they are opened from an email by her
  family, who have no studio token, so the unguessable `who=` token in the link
  IS the identity. Emails live only on the poll doc and the public read strips
  them, so one person's link can never enumerate the others'. A ballot doc is
  content-addressed (`<poll>__<person>`), so swiping twice updates one ballot
  and "close it, come back" works; only `done:true` counts as an answer, so an
  abandoned half-deck never lands in the chart. `/fruitchart` renders the same
  answers three ways (per person · a grid · sized by how many picked it) and
  prints one design per page. **Sending needs `BREVO_API_KEY` +
  `BREVO_FROM_EMAIL`, and as of Aug 2026 NEITHER IS SET** — not in Render env,
  not in `config/pipeline` (measured 2026-08-14: `/api/tarot-email/status`
  answers `brevo:false`). `POST /invite` refuses with which one is missing
  rather than half-sending; run it with `dryRun:true` first, the same guard the
  App Store metadata workflow gets. Tests: `node scripts/test-fruit.js`.
- **Witch-video pipeline** (`witchvideo.js`, `/api/witchvideo`, page at
  `/witchvideo` — PUBLIC, deliberately unlinked, no tile) — Theo's (her mom's
  ChatGPT's) video ideas → a chat's draft 480p cuts → **her MOM reviews on her
  phone**: the unguessable `who=` token in her link is the identity (the fruit
  pattern), **tapping the video pauses it and opens the note box** stamped
  with the second she stopped at, ♥ approves / ✕ reopens, stills batches get
  per-still notes before animation money is spent, and the box at the bottom
  files a new idea. **Every note/verdict/idea rings the owning chat's wake
  doorbell** (`chat-wake.ring` — the ONE shared implementation, exported Aug
  2026 so modules ring in-process; never copy it) and lands in
  `GET /api/witchvideo/inbox?chat=` for the sweep. **The module generates and
  spends NOTHING** — generation is chat work (movies.js recipe, ~$1–1.50 a
  draft; a batch of ideas ≈ $20 gets the >$3 ask). Notes over 2000 chars are
  refused, never truncated; cuts/stills/thread are kept capped 12/8/300;
  emails live only on the `__reviewers` doc and never ride a public read. A
  new cut emails reviewers when Brevo is configured (it was NOT, measured
  2026-08-14 — the response says `emailSkipped` honestly). Full map:
  `docs/witch-video-pipeline.md`. Tests: `node scripts/test-witchvideo.js`
  (pure + the real page headless).
- **Opinions** (`opinions.js`, `/api/opinions`, page at `/opinions`, no iOS
  tile yet) — the decide-on-things game from Sophie's commercial concept (Aug
  2026): two ideas side by side — businesses, things to make, app ideas, or
  two pictures — tap the better one, and the picked side stamps **GOOD IDEA**
  (the other BAD IDEA).
  **Full details: *Opinions* in `docs/modules/inbox-and-misc.md` (moved from CLAUDE.md).**

- **Similitude** (`triset.js`, `/api/triset`, pages at `/similitude` and
  `/triset`, no iOS tile yet) —
  triangular SET solitaire (Sophie's concept, 2026-08-30).
  **Full details: *Similitude* in `docs/modules/inbox-and-misc.md` (moved from CLAUDE.md).**

- **SIMILITUDE DOMINOES FOR TWO PHONES** (`dominoes.js`, `/api/dominoes`,
  page at `/dominoes` — PUBLIC, no tile; 2026-09-04, Sophie: "i want to play
  against my friend miriam. no computer" → "i'm more wanting to build it for
  anyone so i can share it on ig"). The dominoes game (the triset-dominoes-game
  chat's page, her 61 chosen cards) as a table ANYONE can start: your name and
  an optional phone, an invite link, the friend sits down with theirs, and the
  two play from their own phones. **The page holds the rules and the server
  holds the table** — the two seats (the fruit poll's `who=` pattern: each
  player's unguessable token IS their seat, the invite token lets exactly one
  friend in), the turn gate (a move is accepted only from the seat the stored
  state says is on turn, in a transaction, so a stale phone can never overwrite
  a fresher one), and the turn TEXT — when a move hands the turn over, the
  other player gets one SMS through `sms.js` (Twilio: `TWILIO_ACCOUNT_SID` ·
  `TWILIO_AUTH_TOKEN` · `TWILIO_FROM`, managed keys) if they gave a number,
  deduped on the move number. A read never carries the other seat's phone or
  token. It costs nothing but Twilio's own fraction of a cent per text. The
  phone remembers its seats (`dominoes.seats` in localStorage) and the lobby
  lists them. Test: `node scripts/test-dominoes.js` (the gate, the text plan and
  the view pure, then the REAL page on two headless phones over the real router
  with an in-memory Firestore).
- **SIMILITUDE FOR TWO PHONES** (`similitude-two.js`, `/api/similitude`,
  page at `/similitude/play` — PUBLIC, no tile; 2026-09-04, Sophie: "how can
  we make this multiplayer" → "same cards as the dominoes deck.
  **Full details: *SIMILITUDE FOR TWO PHONES* in `docs/modules/inbox-and-misc.md` (moved from CLAUDE.md).**

- **HEAD GAMES** (`docs/headgames/`, a Compare page in the
  `mental-games-instrumental-beliefs` chat — no route, no module, no iOS tile;
  2026-09-03, Sophie: "little games we play in our head all the time …
  organizing ur mind — stray bits of info that normally float around, now,
  structured in a format that makes sense … diagnose mental processes,
  represent, no value judgement" · "can we build a hub, each game an icon" ·
  "make it off render so we don't have to deploy every time — a compare page
  maybe"). Five games behind five hand-drawn line icons, three to a row:
  **the scale** (hers: pros and cons, she decides how many blocks each reason
  weighs, taps them on one at a time, the line names the block that tipped
  it), **the jars** (questions she never looked up, the lid comes off with the
  answer, the shelf counts the shut ones and the longest-shut), **the train**
  (how did I get to thinking about this — cars coupled backwards to the
  station), **the tower** (why she believes a thing — pull a block, does it
  still stand, the load-bearing ones turn rose) and **luggage tags** (who
  handed her each opinion, grouped by name). Nothing judges anything; each
  shape only says what is in it. **It costs nothing** — no model call, no
  route, and a new version needs NO DEPLOY.
  - **THE PAGE IS POSTED, NOT SERVED.** `node scripts/headgames-page.js --go`
    builds `headgames.tpl.html` + `rules.js` (inlined) and posts it with
    `POST /api/chatfeed/page`; `--supersede <id>` retires the old one. The
    version comes off `docs/headgames/VERSIONS`, a ledger the script appends
    to, so the title is always `Head Games vN`. A change to the page is:
    edit the template, run the tests, post, supersede, merge with
    `[skip render]`. Don't turn it into a `public/*.html` route — that is
    exactly the deploy-per-change she asked to be rid of.
  - **HER STATE LIVES OFF THE PAGE, on verdict docs** — one per game
    (`hg-scale` · `hg-jar` · `hg-train` · `hg-tower` · `hg-tag`, under the
    chat above), one JSON text per item, through the `/api/chatfeed/verdict`
    the live server already has. So every version opens on the same jars and
    towers, and a page is frozen the day it is posted while her games are
    not. A verdict text holds 2000 chars; an item over ~1900 is refused with
    "This one is full" rather than truncated. Nothing is deleted — "Put it
    away" sets `hidden`.
  - **FOUR THINGS THE PHOTO CAUGHT, worth not re-earning:** a CSS `width`
    on `.blk` (the tower's HTML block) reached the scale's SVG `rect.blk`
    and drew every weight as a bar across the drawing (the SVG blocks are
    `.bk`); a placed reason wearing `.on` picked up compare.css's
    `button.on` white-on-gold and read as blank (`.placed`); a pulled tower
    block at 38% slid off a 390pt phone (blocks are 70% wide, the slide 20%,
    and `.wrap` never scrolls sideways); and the "A jar" button was
    right-aligned into the pill's corner. And **three lists sharing one
    `#lnew` id gave only the first a handler** — they are `.lnew`, scoped
    per list.
  - Tests: `node scripts/test-headgames.js` (the rules, pure — the scale's
    deciding block, the shelf order, the route, load-bearing, the grouping —
    and the built page against the page-kit warnings) and
    `node scripts/test-headgames-page.js` (the real page headless, every
    game walked against a stubbed verdict store; every check a measurement).
- **The Dump** (`dropbox.js`, `/api/drop`, sort page at `/dump`, iOS tile with
  SEND and SORT tabs) — **dump first, label afterwards**. Dropping asks no
  questions; only the bundle (a Photos album) and the session are captured,
  because they are free then and expensive to reconstruct later. Bytes are stored
  once, content-addressed, so the same photo in two albums is ONE object.
  **FOLDERS CONTAIN ALBUMS — they never merge them** (a folder is the `track`
  field; filing an album moves nothing inside it). `photoIndex` comes from a
  transaction, never from counting — that is the bug that scrambled album order.
  **EVERY FILE SAYS WHO PUT IT THERE, AND THE PAGE OPENS ON HERS (2026-09-25,
  Sophie: "used by chats to give me stuff idk why i never wanted that · hide
  every single thing a chat has ever uploaded or make a new tab · 'from
  claude' and from me").** `from: 'sophie' | 'claude'` on every doc; `/dump`
  is FROM ME · FROM CLAUDE and opens on FROM ME. **A chat filing anything into
  the Dump sends `from=claude`** (`?from=claude` on `/upload-file`); the server
  reads the User-Agent when nothing is said (a script is a chat, a browser or
  the app is her), and the 4,888 older files were judged by shape once, album
  by album (`scripts/dump-from-backfill.js`). The list routes read the
  collection ONCE and hold it 20s — that was half of "it's slow"; the other
  half was every cover and tile drawn from the 3-4MB original, and
  `GET /api/drop/thumb/:id` (a 480px webp made once, banked as `thumbUrl`)
  is what the page draws now. **Same evening: Save goes to PHOTOS through the
  `forgeSave` bridge, never a `/file/` link into Files; the 143 dump-date
  chips are ONE `Date` chip with a sheet so the chip row wraps and nothing
  scrolls sideways; TILES via `/viewswitch.js`; and the iOS tile's SEND tab
  is off ("delete it for now") — the share sheet is the way in.** Full rules:
  *EVERY FILE SAYS WHO PUT IT THERE* in `docs/modules/inbox-and-misc.md`;
  test `node scripts/test-dump-from.js`.
  **WHAT A DUMPED CLIP SAYS IS TRANSCRIBED ONCE, EVER —
  `node scripts/transcribe-media.js` (2026-09-14, Sophie: "transcribe w
  whisper, cache it").** She shoots takes on her phone, dumps them, and then
  wants to know what she said in each without opening every clip. whisper-1 is
  ~0.6¢ a minute and a take gets read many times, so the answer is banked:
  **`transcripts/<sha1(source url)>.json`** in Storage (text, word timestamps,
  segments), and the Dump is content-addressed, so the same bytes in two albums
  are ONE cache entry by construction. Asking twice costs nothing. **Two
  mirrors, both deliberate:** the word list is ALSO written to
  `scratchpad/take-words/<the same key>.json` — the Story Room's own take cache
  — so a story whose voiceover IS that take renders with no transcription at
  all; and `transcript`/`transcriptAt` go on the file's `forge-drops` doc so a
  reader can SHOW what a clip says without fetching the cache (the words stay in
  Storage — a long take is thousands of them and the doc rides a list read).
  Her file is never touched: a throwaway 16k mono mp3 is what whisper gets. A
  file with **no audio track caches as `silent`** rather than being retried
  forever. `--session`/`--bundle` sweeps a whole album, `--dry` is free and says
  what it would do, `--force` re-transcribes. Measured the day it landed: the
  whole `footage` bundle — 14 clips, 113s — cost **1.1¢**. Test:
  `node scripts/test-transcribe-media.js` (the cache key and the Story Room
  mirror pinned against the REAL expressions in both files, since a drifted key
  is invisible — it just pays twice).
  **AND IT TAKES A FILE — a zip or a PDF files whole as `media:'file'`
  (2026-09-16, the LumaFusion zip door).** The share extension accepts a zip
  (a TestFlight build carries it), the Dump page draws a file as its name with
  a save link, and `scripts/fcpxml-to-cut.js --dump latest` reads her
  LumaFusion XML Project Package straight off the Dump — exported with **No
  Relinkable Media**, since every clip is already in our Storage. Test:
  `node scripts/test-dump-file.js`.
  **Full details: `docs/modules/inbox-and-misc.md`.**
- **THE UPDATE BUTTON** (`brief.js`, `/api/brief`, page at `/brief`) —
  **ITS DOOR WENT WITH THE UPDATE TAB (2026-09-14)**: the **Update** row that
  opened it lived at the top of that tab and nothing in the app links `/brief`
  now.
  **Full details: *THE UPDATE BUTTON* in `docs/modules/inbox-and-misc.md` (moved from CLAUDE.md).**

- **THE MORNING BRIEF — a Compare page, twice a day, on a Routine
  (`scripts/morning-brief.js` + `.tpl.html`, Aug 2026).** Sophie asked for her
  briefing as a page rather than a reply ("this would be more helpful as a
  compare page with the things checked off from yesterday and empty, checked
  boxes for today"), then for it on a schedule. **The FORMAT is code and the
  JUDGEMENT stays with the chat**: a run reads the live sources, decides what
  matters and how urgent each thing is, writes a small JSON, and the script
  turns it into the page. It is NOT the `/brief` Update button — that one is
  derived and free; this one is a chat sitting down and reading everything.
  - **The sections ARE her three timings — Now · Later · At some point** (her
    ask: "can u then group them by importance timing"). The run makes the
    first call in `when`; her tap on one of the three marks under a line MOVES
    it, and that override is what the page reloads to. So the flag and the
    grouping are one control, not two.
  - **ITEM IDS ARE HASHED FROM THE WORDS (`idFor`), never counted.** The
    evening run re-posts onto the SAME per-day sheet (`brief-YYYY-MM-DD`), so
    a positional id would hand her morning tick to whatever task landed in
    that slot at 5pm. Hashing the chat slug + title means a task that survives
    the day keeps its tick, its flag and its star.
  - **A CHAT IS LINKED BY ITS DECK FACTORY SLUG, never a claude.ai session
    url** (her ask: "the links shud go to the chat in deck factory, not the
    Claude app"). Inside the app the page is a same-origin IFRAME of
    chats.html, so a plain link would load the whole Chats app inside the page
    viewer — the row hands the parent `window.__openThread(slug)` and only
    falls back to `/chats?chat=` in a browser. Same bridge judge.js uses to get
    back to the review queue.
  - Ticking drops a line into **Done** at the bottom and unticking returns it
    to its own place; the **star** is "remember this" and outlines the row red;
    the boxes are red because she likes red. The three marks and the star sit
    BOTTOM-LEFT on purpose — the injected pill is fixed over a row's top-right.
  - **Editing the look? Edit `scripts/morning-brief.tpl.html`, never a posted
    page** — a posted page is frozen, and a new version is a new page
    (supersede the one it replaces; `--supersede <id>` does it).
  - Tests: `node scripts/test-morning-brief.js` (the id rule pure, then the
    real page driven in headless Chromium — including inside an iframe host,
    which is the only place the link bridge can be checked).
- **THE REVIEW QUEUE** (`review.js`, `/api/review`, page at `/review`, iOS
  tile "Review Queue") — Aug 2026, Sophie: "I have a pile of things that need
  to be reviewed and I'd like one screen that shows all the things waiting to
  be reviewed".
  **Full details: *THE REVIEW QUEUE* in `docs/modules/inbox-and-misc.md` (moved from CLAUDE.md).**

- **THE INSTAGRAM MOCKUPS** (page at `/instagram`, reached from the icon at the
  RIGHT of the Chats app's UPDATE tag row — Aug 2026, Sophie: "an icon button
  in the top right within the existing header space where the tags are, of my
  update tab … that leads to two tabs — two mockups of instagram").
  **Full details: *THE INSTAGRAM MOCKUPS* in `docs/modules/inbox-and-misc.md` (moved from CLAUDE.md).**

- **Push notifications** (`push.js`, `/api/push`) — real APNs lock-screen
  notifications, raw HTTP/2 straight to Apple, no Firebase Messaging.
  **Full details: *Push notifications* in `docs/modules/inbox-and-misc.md` (moved from CLAUDE.md).**

- **WAITING** (`waiting.js`, `/api/waiting`, page at `/waiting`, no iOS tile —
  2026-09-14, Sophie, looking at the "11 changes waiting" push: "shud go to a
  screen that says what the unmerged changes are · each chat contributes").
  What the number on her phone is actually about: everything merged and NOT
  LIVE yet, then everything still OPEN, each change under the chat that wrote
  it. **The tap lands there now** — the behind push carries `open:'/waiting'`
  and `PushDelegate.pendingPath` opens it (an older build ignores the field and
  lands on the chat list exactly as before, so nothing is half-broken while the
  TestFlight build catches up).
  - **EACH CHAT ALREADY CONTRIBUTES — the join is DERIVED and there is nothing
    to remember.** Every PR's squash message carries the house attribution
    trailer (`Claude-Session: …/session_…`) and the registry records that same
    session on the chat that owns it, so a change reaches its chat with no
    discipline from anyone, asleep chats included. Measured over the last 40
    merges: the trailer and a PR number are on nearly all of them, and
    `scripts/test-waiting.js` reads THIS repo's real commits so a drifted
    trailer format fails there instead of quietly emptying the page.
  - **A chat MAY say what its change means in her words** —
    `POST /api/waiting {chat, session, pr, line}` (200 chars) — and that line
    leads the row with the commit subject quiet underneath. Keyed by PR (or
    sha), never by chat, so three changes get three lines.
  - **A change that traces to no chat is NAMED, never dropped** ("not traced to
    a chat", last) — a change she cannot see is the thing this screen ends.
  - The count is `ahead_by` off the same live commit push.js counts from, so
    the page and the buzz can never disagree. Two cached unauthenticated GitHub
    reads, no model call, no Firestore read unless a line was filed; opening it
    spends nothing. Tests: `node scripts/test-waiting.js`
    and `node scripts/test-waiting-page.js`.
  - **"WAITING TO DEPLOY" MEANS CHANGES THAT WOULD CHANGE SOMETHING FOR HER
    (2026-09-25, Sophie, looking at eleven Compare-page and doc merges under
    the count: "why are things like compare page need to be deployed" · "only
    have the 'waiting to deploy' mean changes that would change something for
    me").** A Compare page is live the moment it is posted; its template, its
    script, its test and the doc note are the RECORD, and a deploy moves none
    of them. So `waiting.js` reads every waiting commit's file list (one
    GitHub read per commit, cached for the life of the process) and sorts it
    with `kindOfFiles`: LIVE (anything the server serves or runs — a root
    module, `public/`, `refs/`, `render.yaml`; an UNLISTED folder counts as
    live, so nothing served can be filed away by accident), IOS (only `ios/`
    — a TestFlight build ships it, a deploy does not; the row says so) or
    RECORD (`docs/`, `scripts/`, `.claude/`, `tools/`, any `.md`). **The
    count, the pile, the Deploy button and the "N changes waiting" push are
    the LIVE ones** (`forYou`; push.js `countForHer`, which falls back to the
    raw `ahead_by` when the pile could not be sorted — never a smaller number
    off a partial read); the rest sit shut under one row, "N merges change
    nothing for you". A commit whose files could not be read (a 403 —
    measured from a chat's container, whose shared egress IP was already at
    0 of 60) is UNKNOWN and counted with hers, the safe direction. At most 20
    commits are read per build so the compare read the push needs is never
    spent; a `GITHUB_TOKEN` in the env lifts it to 5,000/hr (not set — hers).
    Tests: the two above, plus `node scripts/test-behind-push.js`.
  - **AND SHE DEPLOYS IT HERSELF FROM THE TOP OF IT (2026-09-16, Sophie: "add
    a button at top of merged changes that deploys to render so i can do it
    myself and chats can stop asking").** **Deploy** leads the page, above the
    pile it would ship; two taps (the first ARMS it and says how many go live,
    the second sends), `POST /api/waiting/deploy` with no body, and Render's
    own `preDeployCommand` guard does the waiting on a draw exactly as it does
    for a chat's `render-deploy.js`. **It is drawn only when there is
    something to ship AND the server can deploy at all** — a button that can
    only answer "no key" is a dead control. Two guards, because STUDIO_TOKEN
    is off live and the page is therefore open: nothing waiting is refused,
    and one deploy per five minutes per process.
  - **THE SECRET IT NEEDS IS THE SMALL ONE — `RENDER_DEPLOY_HOOK`, and it is
    ONE FIELD OF HERS.** Render's per-service deploy hook (its Settings page,
    the "Deploy Hook" row) is a url that can do exactly one thing: deploy THIS
    service. That is why it is preferred over `RENDER_API_KEY`, which is
    account-wide and could also delete her services — on a public route the
    secret behind the button should be the smallest one that does the job.
    `RENDER_API_KEY` still works as the fallback, and is what a chat's own
    container uses for `render-deploy.js`, where the blast radius is a
    container rather than an open url. A hook that is not on
    `https://api.render.com/deploy/` is IGNORED rather than POSTed to — the
    value is a url this server sends a stranger's tap at, so it is checked
    rather than trusted. **Measured 2026-09-16: the service carried neither,
    so the button is not drawn until she pastes one.** Her two screens:
    https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/settings (copy
    the Deploy Hook) →
    https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/env (add it as
    `RENDER_DEPLOY_HOOK`). **A chat cannot do this for her** — writing a
    secret into a store is refused in a session container. **The chat-side
    rule this retires is in *ASK BEFORE YOU DEPLOY* — stop asking; say it is
    merged and not live in one line.**

- **THE WORK LOG** (`GET /api/chatfeed/worklog`, page at `/worklog`, no
  iOS tile — 2026-09-02, Sophie: "i want to make a timeline of what i worked
  on chronological"). One row per chat under the day it BEGAN, oldest first,
  a dot per day on a left rail, month rules, her own sentence as the line
  (the archive summary's ladder: `wrapAsked` when hers, then the Update card's
  `asked`, then a paraphrase, then `wrapLine`, her note, `statusDoing`); a
  chat that ran on says "→ Aug 30". A row opens the chat. Read-only, no model
  call — a projection of the registry cache.
  - **`startedAt` IS A NEW REGISTRY FIELD, because nothing on the doc held
    when a chat began.** `lastSeen` is the newest message (measured — see the
    unpark bullet). Stamped on a chat's FIRST post only (a doc with no
    `lastSeen` yet); `POST /api/chatfeed/startedat-backfill` (dry by default)
    and `node scripts/backfill-started-at.js --go` fill the rest from the
    oldest `created` on the thread, hers included, and a stamp only ever
    walks BACKWARDS. Run 2026-09-02: 754 of 770 stamped; 16 had no messages.
    A row with no stamp falls back to its newest message and says so
    (`atFrom:'last'`), never pretends.
  - The day turns over at 5am Pacific (the Chats app's own cut); the page
    keeps its own copy of `dayKey` because chats.html's is not a shared file,
    and the test holds an INDEPENDENT copy so the two cannot drift.
  - **`.row` is tool.css's flex row** — a page on tool.css that names a class
    `.row` gets `display:flex; flex-wrap:wrap` and its labels sit beside its
    text (PHOTO'd). This page's row is `.wl`.
  - Test: `node scripts/test-worklog-page.js` (the rows pure, then the real
    page headless — the 5am cut, her italic line as a computed style, the
    span, the iframe bridge).
- **THE DELIVERABLES LIST** (`deliverables.js`, `/api/deliverables`, page at
  `/deliverables` — Aug 2026, Sophie: "is there a running list of deliverables?
  … can you make one, and have the notification go off when a new deliverable
  is added, even if I didn't set notifications true for the chat that made it,
  so I can watch them all in one place newest first"). One doc per URL
  (sha1(url), `forge-deliverables`), sorted by `updatedAt` desc — a re-render
  at the same url surfaces with a version count instead of duplicating.
  - **ONE ROW PER WORK, ITS LATEST VERSION (2026-08-27, Sophie: "only put the
    latest version").** A new cut is a new url, so every take had its own row:
    measured that day, the Water reel filled **7 of the 32 rows**, the PWC
    training film 3 and Evan 2 — the newest of each buried among its own older
    takes. The join is the TITLE STEM (`workKey`), which works because every
    title here follows the house shape `<name> v<N> — what changed (0:41)`:
    cut at the version marker and what is left is the work. **It must cross
    CHATS** — the Water reel is cut in three of them — so grouping by chat
    cannot do it. Two things not to undo: **newest is by DATE, never by
    version number** (two chats cutting one reel both call theirs v14), and **a
    title with no version marker is its own whole stem**, which is what keeps
    PWC ep005 and ep006 two rows instead of hiding an episode. Nothing is
    dropped — the earlier takes fold under the row, so a wrong merge costs a
    tap and never a deliverable. Live: 32 rows → 23 works.
  - **Two doors in:** every MEDIA pin (video/audio) records itself from
    chatfeed's `POST /pin` — a pinned film IS a hand-over — and anything else
    is an explicit `POST /api/deliverables {chat, session, url, title, kind?}`
    (checklist item 3c). Link pins do NOT auto-record: most are pages being
    worked on, not deliverables. Images stay out by design — the gallery /
    Meta Assets is their one place, and 2,488 of them would bury the films.
  - **The push BYPASSES the bell ON PURPOSE — that is the whole ask.** A NEW
    url calls `push.notifyChat` directly (`debounce:false`, the module's own
    60s collapse), whatever `chatNotifies` says; tapping it opens the making
    chat. A re-POST of the same url is silent. So never POST a test render.
  - **It spends nothing** — no model calls; one single-orderBy Firestore read
    plus chatfeed's exported registry cache for display names.
  - `POST /backfill {dry?}` (dry by default, never pushes) sweeps existing
    registry media pins in, so the list started full. It dedupes by url
    (two chats pinning one file = one hand-over, newest pin wins), writes
    the PIN's own date, and re-running repairs its own records while never
    touching a live door's — the launch-day version recorded per chat
    through the live update path and stamped today's date on week-old
    films (Sophie caught it: "evan says today"). Tests:
    `node scripts/test-deliverables.js` (pure) and
    `node scripts/test-deliverables-page.js` (the real page headless — the
    fold, and the toggle's own tap asked with `elementFromPoint`, since the
    row is an `<a>` and a nested control would be eaten by the link).
- **Getting original art OUT of a Google Drawing** — for a lot of her old scanned
  artwork the embedded copy is the only one left, and **the SVG export is the only
  way out at full size**. `python3 scripts/gdrawing-extract.py <url-or-id>` does
  the whole job. Don't reach for the Drive API export (~10MB cap); it needs link
  sharing turned on. Anything sitting exactly on 2500px hit Google's upload resize
  ceiling. **Full details: `docs/modules/inbox-and-misc.md`.**

## Sibling repos
- `memory-library-react` — the games (incl. the Xi card deck), live at
  incaseofamnesia.com; Firebase Cloud Functions that read API keys from
  locked-down Firestore docs (`config/replicate`, `config/openai`, etc.).
- `sage-lora-app` — a minimal standalone Replicate LoRA generator.

## Dev workflow
- Develop on a feature branch, commit + push, open a DRAFT PR.
- **A PR BODY CARRIES NO LINKS, AND IT LEADS WITH WHAT SHE ASKED IN HER OWN
  WORDS (2026-09-15, Sophie: "pull requests shud never post links" · "it shud
  be what i asked in my words").** She reads a PR to find out what a chat was
  told to do, so her sentence — quoted, verbatim, the way the wrap-up already
  lifts it — is the first thing in the body, and what changed goes under it.
  - **NO LINKS OF ANY KIND**: no claude.ai session url, no deploy url, no
    dashboard link, no linked issue or PR reference (write `2445`, not the
    `#` that autolinks it). This includes the session line the harness
    attribution asks for — her rule wins over it; the commit trailer is
    where that belongs and it stays there.
  - **Her words, not a paraphrase of them.** No sentence of yours standing in
    for hers, and nothing invented when she never said it — a PR for work no
    message of hers asked for simply says so.
  - **The reply is the opposite and has not moved**: links FIRST, full and
    clickable, PR last (*WRITING THE REPLY*). The PR is the record; the reply
    is the door.
- **Merging a DOCS-ONLY PR? Put `[skip render]` in the squash title** — the
  deploy is skipped and costs zero build minutes; the next code merge ships
  the docs. Full note in the Render section above.
- **Claude merges its own PRs — always, without asking.** Standing permission
  (July 2026). When the work is ready, merge it, then watch the post-merge
  deploys/TestFlight and fix anything that breaks.
- **Multiple Claude chats work these repos in parallel.** Another chat may
  push, merge, or ship a TestFlight build at any moment — main moves under
  you, TestFlight build numbers race, and code you wrote can get rewritten.
  Re-fetch main before merging, never assume the latest build is yours, and
  re-dispatch from your branch (`imageforge_ref` input) if a main build
  buries it.
- **A "MERGE MAIN" COMMIT THAT KEEPS YOUR SIDE OF A CONFLICT ERASES EVERYONE
  ELSE'S DAY — MEASURED 2026-09-02, ON MAIN.** PR #2048 ended with "Merge main
  into the merge rework" and resolved `public/chats.html` and `CLAUDE.md` by
  taking its own stale copies: **828 lines of the page and 1,354 of this file
  went out with the squash** — the tray tab, the pinned fold, the bell
  default, the project stacks, the Shoebox / Similitude / Work log notes —
  while every test the PR ran stayed green, because those tests never looked
  for them. The next chat found it only because the feature it was asked to
  extend was not on the page. **Before merging a PR whose diff to main is
  mostly DELETIONS in a file you did not mean to shrink (`git diff
  origin/main --stat`), stop: that is the other chats' work leaving, not
  yours arriving.** Resolve a conflict in a hand-maintained file (chats.html
  above all) by re-applying your change onto MAIN's copy — restore the file
  from main and `git apply --3way` your own commit's diff — never by keeping
  yours. The repair here was exactly that, the same day (#2050). The chat that
  merged #2048 was `separate-messages-display` (session
  `019GGYMSZMyw4MNguQ9KqeDe`) — not malice, a conflict resolved the wrong way.
  **AND A FIX CANNOT REACH A PHONE THAT LOADED THE BROKEN PAGE** — the app
  keeps the Chats web view for the whole app process, so she reported the
  deck-piles autoscroll "back" an hour after the repair was live. The Chats
  page SELF-HEALS since 2026-09-02 (below), which is what closes that hole.


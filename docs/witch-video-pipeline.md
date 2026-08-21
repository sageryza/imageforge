# The witch-video pipeline

Sophie's mom wants witch videos made (they are the steady-cash half of the
business) without being responsible for making them. Theo — her mom's own
ChatGPT — supplies the ideas. This pipeline is the road from a Theo pitch to
an approved video, with her mom reviewing every draft on her phone and her
feedback walking itself back to the chat that made it. Built Aug 2026
(`witchvideo.js`, page at `/witchvideo`, chat: witch-video-pipeline).

## The road

1. **IDEA.** Theo's pitch is filed — her mom pastes it in the box at the
   bottom of her own review page (`POST /api/witchvideo/idea`), or Sophie
   drops it in a chat, or a chat calls `POST /api/witchvideo/video`. Filing
   costs nothing and generates nothing.
2. **DRAFT.** The owning chat makes the stills and stitches a **draft 480p**
   cut — the movies.js recipe (gpt-image-2 panels → Replicate image-to-video
   → ffmpeg stitch), voiceover and music only where the idea needs them.
   Generation is CHAT work, never this module's: opening any page here can
   never spend money.
   - **Cost, per draft:** roughly $1–1.50 at the movies recipe (~$1.35 for a
     12-scene film; witch shorts run ~8 scenes). One draft is under the $3
     line; **a batch of Theo's ideas (~15 ≈ $20) gets estimated and asked
     first** — that ask is Sophie's, not her mom's, which is the whole reason
     the pipeline exists.
   - The witch LOOK (which reference, which style) is settled with Sophie per
     series, not invented per video — the deliver-images ritual applies to
     every still.
   - Voiceover: whose voice runs on a PUBLIC witch video is **Sophie's call**
     — never default her ElevenLabs clone onto public content without her
     word. (Her clone, when she says yes: `eleven_multilingual_v2`, never v3.)
3. **REVIEW.** The chat uploads the cut to Storage (permanent url — never a
   temp model url) and `POST /api/witchvideo/cut {id, url, seconds}`. The
   review page shows it at the top of her mom's feed with a NEW dot; when
   Brevo is configured the cut also emails every reviewer with an address
   (`emailed`/`emailSkipped` in the response says which happened —
   **BREVO_API_KEY / BREVO_FROM_EMAIL were unset as of 2026-08-14**, so until
   Sophie adds them the "sent to her phone" step is Sophie texting the link
   once; the link always opens on the newest cut).
4. **HER MOM WATCHES.** `/witchvideo?who=<her token>` — public page, the
   unguessable token is the identity (fruit.js's family-link pattern; no
   login, no studio token). **Tapping the video pauses it and opens the note
   box**, stamped with the second she stopped at; she dictates what she wants
   different. ♥ = approved, ✕ = another pass (✕ opens the note box too).
5. **THE FEEDBACK WALKS BACK BY ITSELF.** Every note/verdict/idea lands on
   the video's doc AND **rings the owning chat's wake doorbell** —
   `chat-wake.ring`, the one shared switchboard implementation. The chat
   wakes, sweeps `GET /api/witchvideo/inbox?chat=<slug>`, does the round,
   posts the next cut. Account 1 has no switchboard yet (CLAUDE.md), so on
   account-1 chats the ring parks as `not-wakeable`/`no-switchboard` and the
   note waits in the inbox — snail mail, never lost; the moment
   `WAKE_TRIGGER_1`/`WAKE_FIRE_TOKEN_1` exist it wakes for real, with no
   change here.
6. **THE NITTY-GRITTY VARIANT.** Before animation money is spent, the chat
   can `POST /api/witchvideo/stills {id, items:[{url,label}]}` — the batch
   shows under the video on her page, and tapping a still opens it big with
   its own note box (`still` = the image url rides the note).
7. **APPROVED.** ♥ marks the state `approved`; the chat renders the real cut
   (full quality, not the 480p draft) and posts it — and the finished video
   can ride the existing YouTube auto-upload (`scripts/youtube_upload.py`,
   private draft on her business channel; nothing goes public on its own).

## The state table (one place: `stateAfter` in witchvideo.js)

`idea` → chat picks it up → `working` → cut posted → `review` → her note or ✕
→ `changes` → next cut → `review` → ♥ → `approved`. A note always hands the
ball back to the chat; a cut always hands it to the reviewer; `waiting` on the
doc says whose turn it is, and `GET /inbox` lists everything waiting on a
chat with the unanswered tail of each thread.

## The rules that shaped it

- **The review surface asks nothing of her mom** — no login, no app, no
  studio token. One link, kept. Emails live only on the `__reviewers` doc and
  never ride a public read.
- **Notes are refused over 2000 chars, never truncated** (the Assets-note
  rule). History is kept, capped: 12 cuts, 8 stills batches, 300 thread
  entries. Nothing a reviewer wrote is deleted.
- **The chat answers ON the video** (`POST /api/witchvideo/answer`) — same
  snail-mail rhythm as Assets notes, so the thread on her page reads as a
  conversation.
- **Every chat-side POST carries `chat` + `session`** and goes through
  chatfeed's session-first resolution, so a reused branch name can never
  claim another chat's videos.
- Reviewer links are minted with `POST /api/witchvideo/reviewers
  {people:[{name,email?}]}` (gated) — re-POSTing keeps existing ids, so a
  link already on a phone keeps working.

## Tests

`node scripts/test-witchvideo.js` — the state table, the note refusals, the
public shape (no email can leak), the page against the house rules
(gradients, placeholders, prefilled boxes), then the real page in headless
Chromium: tap-to-pause opens the note box stamped with the second, the still
overlay freezes the page, /seen · /note · /idea actually fire.

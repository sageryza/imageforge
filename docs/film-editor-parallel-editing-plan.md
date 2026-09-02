# Editing a film in unison — the plan

Sophie, 2026-09-02: "discussing movies w chats is frustrating and difficult to
fine tune … while they edit, also have it in the film editor that was made,
clips laid out exactly the same so we can both edit in parallel. each new
version gets adjusted in unison … it needs to be fully operational or it
won't help at all."

**The design in one line: there is no sync. The Film Editor's cut doc IS the
film, the chat and Sophie both edit that one doc, and every version is a
render of it.** Two copies kept in step is the Story Link lesson (a live
two-way sync silently rearranges someone's work); one source of truth is how
the Story Room and the Playground already share a picture.

**Her corrections the same day, which this plan now follows:**
- *"i need to be able to move the sound around. that's literally what i can't
  describe to the chat."* — so the SOUND lane is hers exactly as the picture
  lane is: every sound is a piece she can move, split, trim, level, fade, mute
  and delete with the SAME tools. A gain ride is not a curve she has to drag;
  it is the bed split into pieces with their own levels and fades.
- *"they don't need to wake up automatically because i'll know what i want
  them to do next."* — so there is NO doorbell on her save. Her loop is: the
  chat gives a draft → she edits in the Film Editor → she sends a message →
  the chat reads what she changed off the doc and does its half → renders →
  she edits again. Her message is the wake, as it is everywhere else in this
  house; the chat's sweep reads the cut's diff the way it reads asset notes.
- *"the captions and stills im not so worried about"* — stills stay in the
  plan because The Ant Farm is 60% stills and Assembly's recipe makes them
  cheap; text overlays are out.

## The acceptance test — The Ant Farm

The plan is done when **The Ant Farm v7** (chat `ant-movie-sound-redesign`,
1:48) lives whole in a cut doc and a render of that doc is the same film:

- 16 shots — 9 video clips and **7 held stills** (about 60 of its 108 seconds)
- 4 sound layers — her voice at unity, her scream wav on "imagine" fading by
  6.5s, a cello bed with a gain ride (dry open · quiet entrance · climax into
  the horror clip · dry middle · warm swell at the end), and ant screams
  **riding the horror clip** at 39.2s
- then: she opens it in the Film Editor, moves the horror clip, adds the
  shooting star as a closing card, saves — the chat wakes, sees exactly what
  moved, re-anchors the screams, renders v8, and v8 shows up on her editor as
  the newest version with the chat's name on it. No question in a thread.

Measured 2026-09-02 against `filmeditor.js` as it stands: the doc can hold the
9 clips and ONE audio file at one offset. Nothing else. So today the editor
could mirror half the picture and none of the sound design — and the sound
design is what that chat is for.

## What exists and is reused, not rebuilt

- **The cut doc and its API** (`filmeditor.js`, `forge-film-edits`): pieces
  are references (url + in/out), saves are whole, render is a background job,
  proxies bake themselves. A chat can create/save/render today.
- **Assembly's still piece** (`kind:'image'`, `hold`, the `-loop 1 -t` encode)
  — ported, not reinvented.
- **The wake doorbell** (`chat-wake.ring`) — the asset-note bell, aimed at a
  cut's owning chat.
- **The pin → deliverables → filmshots chain** — a render pinned with its cut
  id gets an editor door, and the shot map is DERIVED from the doc (a still
  piece's url is a picture), so checklist 3f becomes free.
- **The Film Editor page's player discipline** (proxies, rVFC playhead, pacing)
  — untouched; a still rides in as a baked 60s proxy so the two-video player
  never learns what a still is.

## Phases

### Phase 0 — the schema, in one pure file (DONE 2026-09-02, this chat)
`cut-model.js`, dependency-free, served at `/cut-model.js` like
`pause-plan.js`, so the server and the page validate one shape and cannot
drift (the page mirrored `cleanPieces` by hand before this). TWO LANES:

```
piece  { key, kind:'video'|'image', url, title, poster, seconds, in, out,
         mute, gain }          // a still: in 0, out = its hold, muted
sound  { key, url, name, seconds, in, out (null = to the end), at, gain (dB),
         fadeIn, fadeOut, mute,
         anchor: { piece: <key>, offset } | null }   // rides a SHOT
doc    { …, clips:[piece], sounds:[sound], audio: <legacy mirror of sounds[0]>,
         chat, session, updatedAt,
         renders:[{ url, at, by, seconds, cut:{clips, sounds} }] }
```
Rules the file owns: `soundStart` (anchor wins when its shot exists, else
`at`), `normalize` (rewrites `at` to the resolved second on every save, drops
an anchor to a missing shot), `moveSound` (her move keeps an anchored sound
on its shot with a new offset), `anchorToShot` ("ride this shot"),
`splitSound`, the legacy `audio` read/mirror, and `diffCut` → words the chat
reads back ("kid horrified earlier (now at 8.4s, was 32.1s)"). Tests:
`node scripts/test-cut-model.js` (48 checks, the ant movie as the fixture).

### Phase 1 — the server can render the ant movie (DONE 2026-09-02, agent A)
`filmeditor.js`:
- still pieces through Assembly's own recipe (`-loop 1 -t hold`), proxied as
  a 60s baked mp4 so the player treats it as video; trim = hold.
- `mixGraph` generalized: N sounds → each trimmed (`-ss in -to out`), delayed
  to its RESOLVED start (`CutModel.soundStart`), `volume` in dB, `afade`
  in/out, then `amix normalize=0` (the house rule — amix's default halves
  every voice). No curve type: a ride is sound pieces.
- piece `mute`/`gain` on the per-segment PCM.
- `POST /:id/pieces` takes `base` — a stale write is refused WITH the current
  doc, never merged, never silently overwritten (last-writer-wins is the bug
  this plan exists to close). `by:'sophie'|'chat'` on every write.
- every render snapshots the cut onto the render record.
- `GET /:id/diff?from=<renderAt|updatedAt>` → what moved, in words the chat
  can repeat back ("horror clip earlier by 4.0s; still added after God close").
Tests: `test-filmeditor.js` grows the mix graph and the diff; an integration
render of a 3-piece fixture (2 clips + 1 still, 2 tracks, one anchored) with
WebM fixtures the way `test-filmeditor-page.js` does, asserting the shot
boundaries and that the anchored track lands on its shot after a reorder.

### Phase 2 — the page can show and edit it (DONE 2026-09-02, agent B)
`public/filmeditor.html`:
- a still in the strip (poster tile, its hold as its length); upload accepts
  images; **Add from the Dump** (Assembly's door, ported); a still's trim
  in/out edits its hold through the SAME tools — no new controls.
- a SOUND LANE under the picture strip: every sound drawn as a bar at its
  resolved start, overlapping sounds stacked. Tap a sound and the SAME tool
  row works on it — split at the playhead, trim in/out, earlier/later
  (nudge), sync (start it AT the playhead — that is "move the sound around"),
  delete — plus a level −/+ (1 dB a tap), fade in/out chips, mute, and "ride
  this shot" (anchor to the shot under its start). Adding a sound: upload
  (already there) or the audio library.
- preview: one `<audio>` per sound, each primed and paced the way the one
  track is today (`primeAudio`/`audioPace` become per-element), volume from
  `CutModel.db2lin`, fades ramped. This is the riskiest piece of the plan and
  gets the measured-on-the-real-page test.
- versions: the films sheet lists renders with WHO made each and a "newest
  from the chat" mark; opening the cut after a chat render says so.
- a stale save (refused `base`) reloads the doc and re-applies her last tap,
  saying "the chat changed this — reapplied" rather than losing either.
Tests: `test-filmeditor-page.js` grows a still, two tracks, a level change,
and the base-conflict path; every assertion a measurement on the real page.

### Phase 3 — the chat side (DONE 2026-09-02, this chat)
- `POST /` takes `chat` + `session` so the cut knows its chat. **No doorbell**
  (her call): when she next messages the chat, its sweep reads `/diff` since
  its last render, the way it reads asset notes.
- `POST /pin` and `/api/deliverables` take `cut:<id>`; the pinned-film row in
  the Chats app grows an **Open in the editor** door; filmshots is written
  from the doc at render time (still pieces → shots).
- `scripts/filmcut.js` — the chat's CLI: `create`, `set <edl.json>`, `render
  --wait`, `diff`, `pin`. One command each, so a chat never hand-rolls the
  doc.
- the RULE, in CLAUDE.md and a `film-cut` skill: a chat cutting a film of
  clips/stills builds the doc, renders through `/render`, pins the render
  with the cut id. A chat that renders in its own container instead (effects
  the doc cannot say yet) must say so in the reply — that film cannot be
  edited in unison, and she should know before she opens the editor.
- The ant movie migrated: the doc built from v7's shot map plus the beds the
  chat banked under `ant-story/`; v8 rendered from it and compared against v7
  (shot boundaries from `film-shots-detect`, sound by listening). That render
  is the acceptance test, and it is free — ffmpeg on our box.

### Phase 4 — the loop, live (this chat — the next thing)
Chat's draft → her edit → her message → chat reads the diff → does its half
→ saves with `base` → renders → pins with the cut id → her editor shows the
new version. Then the
same loop run once on the ant movie with her actually tapping, and whatever
breaks in her hand fixed before this is called done.

## What is deliberately NOT in this plan
- **Text overlays / drawtext.** The ant movie's marquee is a picture, so a
  title card is a still piece. A text piece is a later addition if a film
  needs live text.
- **Transitions, speed, crops.** None in the ant movie; hard cuts only.
- **A gain curve.** A ride is sound pieces with levels and fades — one
  vocabulary on both lanes, and every part of it hers to move.
- **An automatic wake on her save.** Her message is the wake.
- **A second copy of the cut anywhere.** No EDL in a chat's head, no JSON in
  a scratchpad — the doc or nothing.

## Chats and agents
One chat (this one) drives the whole thing; it does NOT need to be spread
across several of her chats. It DOES split into parallel agents inside this
session for Phase 1 and Phase 2, which only meet at the schema — that is why
Phase 0 lands first and alone. Order of PRs:

1. Phase 0 (schema + tests) — merged before anything else starts
2. Phase 1 (server) and Phase 2 (page) — two agents, two PRs, in parallel
3. Phase 3 (chat side + the ant migration) — one PR
4. Phase 4 — the live loop, fixed in her hand

Nothing here spends money: renders are ffmpeg on our own box, and the ant
migration reuses the beds already banked.

## What she decides
Nothing blocks the start (she said go for the clear parts, 2026-09-02). One
call she can make later: whether a chat rendering outside the doc is ever
acceptable once this exists.

## What the migration measured (2026-09-02)

The Ant Farm rendered from its cut doc against v7, in this container:
- **Picture:** every one of the 16 shots' middle frame within 3.2 grey levels
  of v7's (re-encode noise; 0 = identical) — the shot map is the cut.
- **Sound, first pass:** the voice-only stretches correlated 1.000 with v7 and
  sat exactly 3.0 dB UNDER it. Her voice memo is MONO, and
  `aformat=channel_layouts=stereo` upmixes a centre channel into L and R at
  1/√2 each (astats: −18.06 dB mono → −21.07 per channel; `pan=stereo|c0=c0|
  c1=c0` and `-ac 2` both keep −18.06). The render probes each sound's
  channels now and sends a mono one through `pan` first. **This would have put
  her voice 3 dB under every bed on every film cut here** — the acceptance
  test paid for itself on its first run.
- **Sound, second pass:** rms identical to v7 in every 10s window (0.0848 vs
  0.0848 …), correlation 1.000 everywhere except the last 18 seconds (0.90 /
  0.95), which is the `god` clip: v7's cut list held it 5.28s but the source
  is 5.209s, so everything after it — the cello ending anchored to god-close
  included — sits ~70ms earlier than in v7. That is the doc being truer than
  the film.
- The last still's Playground original is GONE from Storage (403 public, 404
  via the Admin SDK); the frame v7 holds at 103s is banked as
  `ant-story/stills/theater-punchline.png` and the cut references that.
- The cut is `the-ant-farm` (`forge-film-edits`), owned by
  `ant-movie-sound-redesign`; its first render is by the chat, with the
  snapshot; `scripts/migrate-ant-cut.js` is the whole procedure.

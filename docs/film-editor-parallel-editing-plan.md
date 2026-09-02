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

### Phase 0 — the schema, in one pure file (½ turn, this chat)
`cut-model.js`, dependency-free, served to the page like `pause-plan.js`, so
the server and the page validate one shape and cannot drift (the page mirrors
`cleanPieces` by hand today).

```
piece  { key, kind:'video'|'image', url, title, poster, seconds, in, out,
         hold?      // image only — seconds on screen
         mute?      // drop this clip's own sound
         gain? }    // dB on this clip's own sound
track  { key, url, name, offset, gain (dB), fadeIn, fadeOut, mute,
         anchor?: { piece: <key>, at: seconds }   // rides a SHOT, not a clock
         points?: [{ at, db }] }                  // the gain ride, chat-authored
doc    { …, clips:[piece], tracks:[track], audio: <legacy mirror of tracks[0]>,
         chat, session, by, base:updatedAt,
         renders:[{ url, at, by, seconds, cut:<snapshot of clips+tracks> }] }
```
`audio` stays written as a mirror of the first track for the page cached on
her phone. Tests: `scripts/test-cut-model.js` — every field's clean/refuse
table, the anchor resolving to a timeline second, the legacy read.

### Phase 1 — the server can render the ant movie (1 agent, parallel with 2)
`filmeditor.js`:
- still pieces through Assembly's own recipe (`-loop 1 -t hold`), proxied as
  a 60s baked mp4 so the player treats it as video; trim = hold.
- `mixGraph` generalized: N tracks → adelay per track (anchor resolved against
  the pieces' timeline positions at render time), `volume` per track, `afade`
  in/out, `points` rendered as a `volume` expression interpolated over `t`,
  `amix normalize=0` (the house rule — amix's default halves every voice).
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

### Phase 2 — the page can show and edit it (1 agent, parallel with 1)
`public/filmeditor.html`:
- a still in the strip (poster tile, its hold as its length); upload accepts
  images; **Add from the Dump** (Assembly's door, ported); a still's trim
  in/out edits its hold through the SAME tools — no new controls.
- the audio row becomes a LIST: name · sync (offset, already there) · a −/+
  level · mute · ✕ · and "rides: <shot>" when anchored. The gain ride is
  drawn as a small read-only line: her levers are louder, quieter, out; the
  curve stays the chat's (Sophie decides if she wants to drag points later).
- preview: one `<audio>` per track, each primed and paced the way the one
  track is today (`primeAudio`/`audioPace` become per-element). This is the
  riskiest piece of the plan and gets the measured-on-the-real-page test.
- versions: the films sheet lists renders with WHO made each and a "newest
  from the chat" mark; opening the cut after a chat render says so.
- a stale save (refused `base`) reloads the doc and re-applies her last tap,
  saying "the chat changed this — reapplied" rather than losing either.
Tests: `test-filmeditor-page.js` grows a still, two tracks, a level change,
and the base-conflict path; every assertion a measurement on the real page.

### Phase 3 — the chat side (this chat, after 1+2 merge)
- `POST /` takes `chat` + `session`; her save rings `chat-wake.ring(chat)`;
  the chat's sweep reads `/diff` since its last render.
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

### Phase 4 — the loop, live (this chat)
Her edit → doorbell → chat reads the diff → does its half → saves with `base`
→ renders → pins with the cut id → her editor shows the new version. Then the
same loop run once on the ant movie with her actually tapping, and whatever
breaks in her hand fixed before this is called done.

## What is deliberately NOT in this plan
- **Text overlays / drawtext.** The ant movie's marquee is a picture, so a
  title card is a still piece. A text piece is a later addition if a film
  needs live text.
- **Transitions, speed, crops.** None in the ant movie; hard cuts only.
- **Dragging the gain-ride points on the phone.** Her lever is per-track
  level/fade/mute; the curve is authored by the chat.
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
Nothing blocks the start. Two calls she can make later: whether she wants to
drag the gain-ride points herself (not built), and whether a chat rendering
outside the doc is ever acceptable once this exists.

# The metaphor learning method — corner motifs on lessons

Sophie's method for making lessons digestible, dictated into the **imprint** chat
(`deck-factory-story-room`, 2026-07-29 → 2026-08-12) and picked back up in the
**metaphor-learning-method** chat (2026-08-31). This doc is the spec a chat
should read before building any lesson video or touching the corner mechanic —
the source recordings are scattered across a 501-message thread, and every chat
that re-derived the method from memory got it slightly wrong.

## The method, in her words

Two dictations carry the whole idea (2026-07-30, imprint):

> "The point is, like, call attention to when you're changing the concept so
> that they can use it as a map for where their brain needs to go, and make it
> easy to switch topics by contextualizing it. Each one is like a little map.
> That's the Tupperware. You have to figure out which Tupperware container to
> use, which size something fits in."

> "These diagram and metaphor corner icons, as you called them, are for that
> purpose [making lessons easily digestible]."

So: a lesson runs on **metaphor imagery** (the pastel illustrations), and the
**concept currently in use is made EXPLICIT in the corner** — a small (~1 inch)
recurring motif that appears when a concept becomes active and clears when it
stops applying. The corner is a "you are here" signal that fires exactly when
the concept changes, giving the viewer's brain a beat to re-orient. It is a
map, not decoration.

Two kinds of corner item, two handles on the same idea:
- **metaphor icon** — the intuitive handle (the tricycle = training wheels)
- **diagram icon** — the structural handle (the five-box "you are here" strip)

A motif is **recurring across lessons**: the tricycle means the same thing in
every video that uses it ("this is the beginner move, not the end goal").

## The corner rules

From her 2026-07-29 dictation and the card prototype she reviewed:

1. **~1 inch big**, small enough to never compete with the scene.
2. **Appears when its concept becomes active — then LEAVES once it has been
   digested (2026-08-31, her correction, and it supersedes "holds while it
   applies"):** the motif slides in with a satisfying transition and a soft
   sound effect (ElevenLabs SFX), sits about two seconds — long enough to
   register subconsciously — and slips out. It never lingers on screen. The
   *change* is the attention cue. (The old hold-while-active behaviour is
   what the card prototype and proof v1 did; video builds use the
   appear-digest-disappear rule.)
3. **Empty corners are the normal state.** A corner with something in it means
   something specific is in play right now.
4. **Labeled** — the card prototype wrote "metaphor" / "diagram" under each
   slot, so explicit really means explicit.
5. **Placement — OPEN CALL, default to her words.** Her dictation (2026-07-29):
   "the diagrams and metaphors are both in the **top right** corner." The card
   prototype shipped metaphor top-LEFT / diagram top-RIGHT and asked her to
   correct it; she never answered (the conversation turned to the
   prompt-paraphrase problem). Until she rules, a video puts both top-right,
   stacked — that is the version she actually dictated.

## The motif vocabulary (all drawn, all in the imprint Assets tab)

Base: `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/`

- **tricycle** (`meta-tricycle-v4.png`) — the SET-theory / training-wheels
  stage: write down what the instances share; a stepping stool, not the end
  goal. A real three-wheeled trike, 3/4-back view (she rejected
  "bicycle with an extra wheel" twice — v4 is the FINAL). Orange, yellow trim,
  pink/orange/yellow streamers.
- **five-box "you are here" strip** (`na-youarehere.png`, and `na-zoomout5.png`
  the earlier variant) — the zoom-out diagram: this idea is one of several;
  box #2 is where you are.
- **one-becomes-two** (`na-onetwo.png`) — a thing splits into two things
  (circle vs square).
- **beef jerky** (`na-disentangle.png`) — two things stuck together need
  pulling apart.
- **wider net** (`na-widenet.png`) — expansion, casting wider.
- **gold frame** (`na-goldframe-v2.png`) — the reusable "THIS is the art" stamp;
  meant to be animated slamming onto things.
- **bouncer** (`na-bouncer.png`) — the abstraction gatekeeper (precursor lesson
  to the machine).
- **the metaphor machine** (`mm-machine.png` + 9 more `mm-*` cards) — the
  machine that strips instances of their patterns and hands up the shared
  abstraction. The machine is a lesson SUBJECT, and `mm-machine` doubles as a
  motif for "we are abstracting right now".
- **map POV** (`meta-map-v2.png`) — first-person hands opening a fold-in-thirds
  road map, the path ahead: the intro's opening shot ("this is what I'm going
  to be doing"). POV matters — a third-person version changed the meaning and
  she rejected it.
- **copied brackets** (drawn 2026-08-31, dreamy, in the metaphor-learning-method
  chat's Assets tab — `panels/cuts/1788222336861-9qv23i.webp`) — a solid
  bracket pair and a dashed copy: **relationship extrapolation**, the move in
  her cat/god dream script where the relationship between one pair (cat→us)
  is copied and pasted onto another (us→?). Debuts in "The Cat Becomes Us";
  recurring from then on. Its arrival sound is a photocopy-thunk.

Every motif's exact prompt is filed on its asset (imprint Assets tab, PROMPT
button). The style family: bold black ink outlines, flat limited palette, no
gradients, pastel/warm house tones on cream or white — the exact style half is
on each asset, verbatim. Don't re-derive it; copy it off the asset you are
matching.

## What exists vs. what doesn't

**Built (imprint, by 2026-08-12):**
- The full motif set above, reviewed by her, finals marked.
- The corner mechanic as a CARD prototype — a Compare page where the two slots
  slide in per-card and hold across the cards a concept spans:
  https://imageforge-q125.onrender.com/api/chatfeed/page/u10reFkKkeV7DDLfwcsG
- The 21 lesson decks rebuilt in her words (the Lessons hub).

**Not built (why the metaphor-learning-method chat exists):**
- The VIDEOS. No lesson ever became a moving thing with concepts surfacing in
  its corners. The intro lesson (map opening → corner motifs appearing as the
  lesson runs, tricycle tagging the set-theory stage) was captured and parked.

## The video architecture (settled 2026-08-31, first proof)

- **Motifs are COMPOSITED as overlays, never drawn into the generated
  frames.** The generation model cannot render a crisp recurring 1-inch icon
  reliably, and a motif drawn into the pixels is a different picture every
  time — the whole point is that the tricycle is THE tricycle in every lesson.
  ffmpeg `overlay` with timed enable + a slide-in; the motif PNG is the same
  asset the cards use. This is *nothing stands between the source and the
  output* applied to the corner.
- Scene motion comes from wan-2.2-i2v-fast (draft, 480p, 81 frames, ~6¢/clip)
  animating the existing lesson art; stills get holds/Ken Burns for free.
- Assembly is ffmpeg in a chat's own container (free; immune to deploys).
- A finished film follows checklist 3f — pin + deliverables + `/api/filmshots`
  shot map, one entry per picture.

## Where the source material lives

- The imprint thread: https://imageforge-q125.onrender.com/chats?chat=deck-factory-story-room
  — the method dictations are 2026-07-29 20:52–21:22 and 2026-07-30 00:18–00:37.
- The card prototype page: id `u10reFkKkeV7DDLfwcsG` (chatfeed pages).
- The 21 lesson decks: the Lessons hub (imprint's status card points at it).
- Note for the record: the imprint session was configured `claude-fable-5` but
  ran `claude-opus-5` from some point on (measured 2026-08-31 via
  `get_session`: `session_context.model` and `last_served_model` both opus,
  `configured_model` fable). Her frustration with that chat's later work dates
  from after the switch.

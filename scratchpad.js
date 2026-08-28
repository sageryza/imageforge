// scratchpad.js — the Scratch Pad. Stage ONE of a story: thinking with
// pictures, before the Story Room (stage two) makes it a board.
//
// The idea (Sophie, Aug 2026 voice memo + chat): images she makes in the
// Playground and HEARTS become a dump inbox for the pad. From the pad she
// opens that inbox (button top-right), taps a thumbnail, and it lands on the
// pad as a beat in a thin gray frame. Tapping a beat opens a popup where she
// gives its frame a color — mustard / green / blue / pink — the color IS the
// indicator (deliberately unlabelled; the whole point is markers that skip
// left-brain naming). Adding the next image shows dashed slots so she picks
// where in the order it goes. No drawing happens on the pad itself — it shows
// finished artwork only; regenerating/versions will live in the beat popup
// LATER (left flexible on purpose).
//
// Data: ONE Firestore doc (collection `forge-scratchpad`, doc `pad`) —
//   { beats: [{ id, url, color, src:{ runId, i, prompt, model, engine,
//     quality }, addedAt }], updatedAt }
// The `src` block is carried so the later regenerate feature knows exactly
// how each image was made without re-deriving anything.
//
// The inbox is READ straight out of `forge-promptlab` (votes live on the run
// docs — `votes.<imageIndex> === 'like'`), so hearting in the Playground needs
// no new write path and un-hearting there removes it from the inbox too.
//
// Mounted at /api/scratchpad by server.js, page at /scratchpad.
// STUDIO_TOKEN-gated (only /status open), same as every studio tool.
//
// Routes:
//   GET  /status         → { ok, firebase }
//   GET  /               → { title, beats }
//   POST /title          → { title } — the story's name ("Untitled" until set)
//   POST /tts            → { id } → { url } — the beat's note in Sophie's
//                          voice (ElevenLabs "Sophie — morning", cached by
//                          text hash at scratchpad/tts/<hash>.mp3)
//   GET  /inbox          → { items:[{url, runId, i, prompt, model, engine,
//                          quality, at}] } — hearted Playground images, newest first
//   POST /inbox/hide     → { url, hide? } — take one picture OUT of this
//                          story's add sheet (hide:false puts it back). It
//                          HIDES, never deletes — see the route.
//   POST /add            → { url, at?, src?, style? } — insert a beat at
//                          index `at` (default: the end); returns { beats }.
//                          With no `style` the side is DERIVED from the
//                          picture's own run record (sideFromEvidence) —
//                          same on /image — so a chat seeding art never
//                          lands a dreamy picture on the watercolor side
//   POST /color          → { id, color } — set a beat's frame color
//                          ('mustard'|'green'|'blue'|'pink'|null = back to gray)
//   POST /text           → { id, text } — the beat's note (the popup's
//                          three-line text box; 5000 chars max)
//   GET  /shelf          → { clips } — the Chunking clip library (ready
//                          clips only), newest first; ?q= speaks the house
//                          search grammar (clips.js parses it — never a
//                          second copy)
//   POST /clip           → { clip:{id,url,poster,seconds,title}, at? | id? }
//                          — a FILM CLIP as a beat: inserted at `at`, or
//                          dropped into the existing (blank) beat `id`
//   POST /remove         → { id, style? } — delete a beat FROM A SIDE: with
//                          art still on the other side only this side goes
//                          (emptied + `off`, the beat keeps its place and
//                          its words there); with nothing left anywhere the
//                          whole beat goes, as it always did
//   POST /style          → { style:'watercolor'|'dreamy'|'pastel' } — which art set
//                          the story shows (the toggle at the top; the beats
//                          and their words are shared, only the art differs —
//                          see the STYLE TOGGLE block below)
//   POST /upload         → { item:{url, kind:'image'|'clip', poster?, title?} }
//                          — file a photo/movie she added from her phone onto
//                          the story's add sheet (bytes go through the Dump's
//                          /api/drop/upload-file first; this stores the url)
//   POST /episode        → { episodeId, remove? } — link/unlink an Episode
//                          Editor episode to this story; GET / returns the
//                          linked episodes' newest renders as `audios`, and
//                          the story page shows a listen row for each (the
//                          NDE montages on their NDE stories, Aug 2026)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COL = 'forge-scratchpad';
const DOC = 'pad';
const PROMPTLAB = 'forge-promptlab';
// The Episode Editor's episodes (same Firestore project). A story doc may
// carry `episodes: [episodeId, …]` — audio made FROM this story's material
// (the NDE montages were cut there), listenable from the story page.
const EDITOR = 'forge-editor';
const COLORS = ['mustard', 'green', 'blue', 'pink'];
// The Chunking clip library — the shelf a film-clip beat is picked off.
const CLIPS = process.env.CLIPS_COLLECTION || 'forge-clip-library';

// ── A beat can be a FILM CLIP ───────────────────────────────────────
// Sophie, Aug 2026: "can u add film clips to story room". A clip beat is an
// ordinary beat whose `url` is an mp4 rather than a picture — kind:'clip',
// plus the poster it tiles as, its length, its name and the library id it
// came from. It sits in the order like any other beat, takes a frame color,
// carries her words, links into a chunk. Two things are deliberately NOT
// true of it: nothing DRAWS a clip (the star/Playground/inbox doors are for
// pictures), and in the film **the clip's own sound is its voice** — a TTS
// read of its note would talk over what is already on the tape.
// Per-SLOT clip test — since the style toggle, a clip lives in the art slot
// it was placed in (the beat root IS the watercolor slot, so every
// pre-toggle clip record reads unchanged), and "is this a clip" is a
// question about a SIDE, not the beat.
const slotClip = (s) => Boolean(s && s.kind === 'clip');
// What a slot shows as a PICTURE — a clip's face is its poster, never its
// mp4 (the shelf tile and the story cover are <img>).
const slotFace = (s) => (slotClip(s) ? (s.poster || null) : ((s && s.url) || null));

// A beat's note read aloud — Sophie's professional ElevenLabs clone
// ("Sophie — morning") on eleven_multilingual_v2, the Voice Studio recipe.
// v3 was tried (Aug 2026) and REVERTED: professional clones aren't optimized
// for v3 and the likeness drops badly ("a cousin doing an impression") —
// v2 is the model that actually sounds like her. <break time="1.0s" /> tags
// work in a note for pauses; v3's [quietly]-style acting tags do not.
const TTS_VOICE_ID = 'UTkHGl2ImiT6gwtAFCql';
const TTS_MODEL = 'eleven_multilingual_v2';
const TTS_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };

// ── Drawing a beat's art IN the pad ─────────────────────────────────
// One style per story, so nothing here asks which: the pad draws in the
// Playground's ChatGPT recipe (gpt-image-2 edits with Sophie's scanned page
// as a pure STYLE reference, 2:3 portrait), and her character card rides
// along by default so "Sophie" in a prompt is that girl. The two prompt
// strings are COPIES of PL_GPT.prefix / PL_GPT.characterLine in server.js —
// keep all three identical.
const ART = {
  size: '1024x1536',
  qualities: ['low', 'medium', 'high'],
  quality: 'medium',
  styleFile: 'sage-sandy-mirror.png',
  characterFile: 'sophie-book.png',
  prefix: 'Use only the style of the attached style reference and ignore its ' +
    'content — do not copy anything depicted in it. You can choose your own ' +
    'colors rather than copying the colors of the style reference.',
  characterLine: ' Use the second attached image as a character reference. ' +
    'Her name is Sophie. Whenever the prompt mentions Sophie, draw her as that girl.',
};

// ── THE STORY'S SHAPE — portrait, or SQUARE (2026-08-28, Sophie: "add a new
// square story type in story room") ─────────────────────────────────
// A story is ONE shape the whole way down: the canvas its beats are drawn on,
// the tiles on the pad, the blank paper in the popup, and the film's frame.
// Half a story square and half portrait is a film that letterboxes every
// other shot, which is why this lives on the pad rather than on a beat — the
// same call `movie.aspect` makes in movies.js, the only other per-project
// shape in the repo.
//
// PORTRAIT IS WHAT THE PAD HAS ALWAYS BEEN, and it is the shape a pad
// carrying no `shape` at all gets — so every story already on the shelf is
// byte-for-byte what it was, with nothing to migrate.
//
// The words are the Playground's own (PL_GPT.sizes in server.js), because
// the pad draws in the Playground's recipe and two names for one canvas is
// how a caption ends up disagreeing with the picture.
//
// NOTHING COUNTS THE SHAPES BUT THIS LIST — a third one (landscape) is a row
// here plus its word in the page's own SHAPES, and the draw, the film, the
// tiles and the toggle all follow without knowing how many there are.
const SHAPES = [
  { key: 'portrait', size: '1024x1536', ar: '2 / 3', film: { w: 1000, h: 1500 } },
  // 1080x1080 is 1.17 megapixels against portrait's 1.5 — UNDER the frame
  // size the OOM note below FILM proves this 512MB box survives, which is the
  // number that matters, not the width.
  { key: 'square', size: '1024x1024', ar: '1 / 1', film: { w: 1080, h: 1080 } },
];
const SHAPE_KEYS = SHAPES.map((s) => s.key);
// A pad with no shape is portrait — the honest default and the only one every
// existing story can have.
const shapeOf = (pad) => SHAPES.find((s) => s.key === (pad && pad.shape)) || SHAPES[0];

// A STORY'S SHAPE FOLLOWS ITS FIRST PICTURE (2026-08-28, Sophie: "automatic
// by first picture") — so the toggle is there for when she wants it, not
// something she has to remember before she starts.
//
// It fires on a picture PLACED on a story that has no shape yet: her pick out
// of the inbox, a Playground send, a photo off her phone, a chat seeding art.
// A picture the pad DREW can never teach the story anything — it was drawn AT
// the story's shape, so reading it back would only ever confirm the default.
//
// NOBODY-HAS-DECIDED IS THE WHOLE GUARD, and it is one field: a pad carrying
// no `shape` at all. Her tap on the toggle writes one (POST /shape), so from
// then on the story is hers and this never runs again — the `catBy` rule the
// chat sorter follows, spelled with the value's own presence instead of a
// second field to keep in step.
const SHAPE_AUTO_TOL = 0.20;   // ±22%, in log space so both shapes are judged evenly
// The shape this picture IS, or null when it is not really either of them.
// A landscape phone photo and a 16:9 clip poster decide NOTHING: portrait is
// the fallback, and a story quietly turned square by a picture that is
// neither shape is worse than one left at the default she can see and change.
function shapeForSize(w, h) {
  if (!(w > 0) || !(h > 0)) return null;
  const r = Math.log(w / h);
  let best = null;
  let bestD = Infinity;
  SHAPES.forEach((sh) => {
    const [aw, ah] = String(sh.ar).split('/').map((x) => Number(x.trim()));
    const d = Math.abs(r - Math.log(aw / ah));
    if (d < bestD) { bestD = d; best = sh; }
  });
  return bestD <= SHAPE_AUTO_TOL ? best : null;
}
// The picture's size from its HEADER — a ranged read of the first few
// kilobytes, never the whole file (an original here is 1-3MB). image-size.js
// parses the container itself because sharp REFUSES a truncated webp header,
// which is the format nearly everything here is stored in; sharp is the
// fallback for a format it doesn't know. Best-effort throughout: this is a
// convenience on top of a working default, so nothing it does may fail a
// placement.
async function fetchImageSize(url) {
  const { imageSize, HEADER_BYTES } = require('./image-size');
  try {
    const r = await fetch(url, {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
      timeout: 8000,
    });
    if (!r.ok && r.status !== 206) return null;
    // A host that ignores Range sends the whole file; we only ever read the
    // front of the buffer either way.
    const buf = (await r.buffer()).subarray(0, HEADER_BYTES);
    const s = imageSize(buf);
    if (s) return s;
    try {
      const m = await require('sharp')(buf).metadata();
      return (m && m.width && m.height) ? { w: m.width, h: m.height } : null;
    } catch { return null; }
  } catch { return null; }
}
// What to merge onto the pad, or {} for "leave it alone". Read BEFORE the
// write (it needs the network), and the transaction re-checks that nothing
// decided in between.
async function autoShapePatch(padId, url) {
  if (!url || !/^https?:\/\//.test(url)) return {};
  try {
    const snap = await padRef(padId).get();
    if (snap.exists && snap.data().shape) return {};   // already decided
    const size = await fetchImageSize(url);
    const sh = size && shapeForSize(size.w, size.h);
    // The first picture DECIDES, portrait included — writing it is what
    // makes this happen once. A picture that is neither shape (a landscape
    // photo, a clip's 16:9 poster) writes nothing and leaves the story open,
    // which is the honest answer to "I can't tell from this one".
    return sh ? { shape: sh.key } : {};
  } catch { return {}; }
}

const refCache = {};
function artRef(file) {
  if (!refCache[file]) refCache[file] = fs.readFileSync(path.join(__dirname, 'refs', file));
  return refCache[file];
}

// ── The STYLE TOGGLE: watercolor · dreamy · pastel (Aug 2026, Sophie: "I
// want to have the same beats but I wanna fill them with new art … a style
// toggle at the top of a story that alternates between dreamy and
// watercolor"; PASTEL added 2026-08-26 at her ask, "another style in the
// story room called pastel besides watercolor and dreamy").
// One story, N sets of art over the SAME beats: the words, colors, voice
// takes and order are shared; only the pictures differ. "watercolor" is the
// pad's original look (sage sandy mirror — the fields already on the beat,
// so nothing that exists migrates or moves), and every OTHER style keeps its
// art in a parallel slot, `beat.alt[style]` ({url, src, gen, imageHistory}),
// empty until she fills it. `pad.style` remembers which side the story is
// showing; requests that touch ART carry `style` so a stale page can never
// draw into the wrong side. A CLIP is per-style TOO (2026-08-23, Sophie,
// after movies she added on the dreamy side showed up on watercolor: "The
// beats should be added, but the Art should not") — a slot holds a picture
// OR a clip (kind:'clip' + poster/seconds/title/clipId on the slot), so a
// movie placed under dreamy leaves the watercolor side exactly as it was.
//
// NOTHING COUNTS THE STYLES BUT THIS LIST. It shipped as a pair, and the
// pair was written into the code as ternaries (`style === 'dreamy' ? … : …`,
// `otherStyle`, a hardcoded `b.alt.dreamy` in three sweeps) — so a third one
// was a rewrite rather than a line. It is a rewrite once: a FOURTH style is
// an entry here plus its recipe in STYLE_ART below, and the toggle, the
// film, the delete rule, the shelf face and the stuck-job sweep all follow
// without knowing how many there are.
const STYLES = ['watercolor', 'dreamy', 'pastel'];
const styleOf = (req) => {
  const s = String((req.body && req.body.style) || req.query.style || '');
  return STYLES.includes(s) ? s : 'watercolor';
};
// The side the request actually NAMED — null when it named none. The page
// always sends the side she is showing, so null is a CHAT placing art, which
// is the case sideFromEvidence exists for (2026-08-26, Sophie: nine dreamy
// pictures for "The dance I joined by accident" all landed watercolor
// because the placing chat sent no style and styleOf defaulted it).
const styleNamed = (req) => {
  const s = String((req.body && req.body.style) || req.query.style || '');
  return STYLES.includes(s) ? s : null;
};
// The object holding a beat's art for a style. For watercolor it IS the beat
// (url/src/gen/imageHistory live at the root, exactly as they always have);
// for every other style it is beat.alt[style], created on first write.
function artSlot(b, style, make) {
  if (!b || style === 'watercolor' || !STYLES.includes(style)) return b || {};
  if (make) { b.alt = b.alt || {}; b.alt[style] = b.alt[style] || {}; }
  return (b.alt && b.alt[style]) || {};
}
// Every slot a beat has, in STYLES order — for the sweeps that must reach all
// of them (missing clip posters, a draw stuck under a style she flipped away
// from) rather than the one she is looking at.
const allSlots = (b) => STYLES.map((s) => artSlot(b, s, false));
const otherStyles = (style) => STYLES.filter((s) => s !== style);
// EVERY field that belongs to ONE side, and nothing else. The watercolor
// slot IS the beat root, so emptying a side is done by this explicit list
// and NEVER by wiping the object — the words, the frame color, her voice
// takes and the chunk link live at the root too and belong to BOTH sides.
const SLOT_KEYS = ['url', 'src', 'gen', 'imageHistory', 'kind', 'poster', 'seconds', 'title', 'clipId'];
function clearSlot(slot) { SLOT_KEYS.forEach((k) => { delete slot[k]; }); }
// A side she DELETED the beat from (2026-08-23, Sophie: "if I delete a beat
// in one of the styles … leave it in the other style cause that one might
// have an image for that"). `off` is per-slot, so the beat keeps its place
// in the order and its words on the side that still wants it, and simply is
// not drawn on the side she removed it from. Giving that side art again
// clears the mark — putting something back is what brings it back.
const slotOff = (s) => Boolean(s && s.off);
// Swapping a picture into a slot — the past-pictures bookkeeping lives in
// its own dependency-free file so it can be tested without a node_modules,
// and so /image and a finished draw share ONE copy of the rules.
const { swapArt } = require('./pad-art');
// One story becomes two — fresh beat ids, no renders carried, art optional.
const { dupPad } = require('./pad-duplicate');
// Which side a picture belongs on when nobody said — the pure decision
// (evidence from the picture's own run record, playground-port's rule).
const { padSideOf, shouldReveal } = require('./pad-side');
// Character references — the story's cast, picked per draw. The pure rules
// (list shape, the pick, the disclosed prompt line) live in their own
// dependency-free file so they have a test that needs no node_modules.
const { normalizeCharacters, pickCharacters, charLine, MAX_CHARACTERS } = require('./pad-characters');

// ── Deriving the side from the picture's own run record ─────────────
// Only for a placement that named NO side (styleNamed → null). Best-effort
// everywhere: an unreadable run doc means watercolor, exactly as before —
// a failed lookup must never fail a placement.
async function sideFromEvidence(url, src) {
  try {
    // 1 — the run the src names (the shape landOnBeat and the chats already
    //     carry: {runId, i, …}).
    if (src && src.runId) {
      const snap = await db().collection(PROMPTLAB).doc(String(src.runId)).get();
      if (snap.exists) return padSideOf(snap.data(), STYLES);
    }
    if (!url) return null;
    // 2 — no run named: a Playground run stores its image urls as plain
    //     strings, so the url itself finds the run that drew it.
    const q = await db().collection(PROMPTLAB)
      .where('images', 'array-contains', url).limit(1).get();
    if (!q.empty) return padSideOf(q.docs[0].data(), STYLES);
  } catch (e) { /* evidence is best-effort — fall through to the default */ }
  return null;
}
// The pad-style patch a DERIVED placement may add (shouldReveal in
// pad-side.js): a chat seeding a fresh story must not leave her opening it
// onto blank tiles, and a side with any art on it is never flipped away
// from. `cur` is the beats array as it is about to be written.
function revealPatch(padData, cur, landed) {
  const showing = STYLES.includes(padData && padData.style) ? padData.style : 'watercolor';
  const hasArt = (side) => cur.some((b) => {
    const s = artSlot(b, side, false);
    return !slotOff(s) && Boolean(slotFace(s));
  });
  return shouldReveal({ showing, landed, showingHasArt: hasArt(showing), landedHasArt: hasArt(landed) })
    ? { style: landed } : {};
}

// ── The recipes for every style but watercolor ──────────────────────
// Each one is the PLAYGROUND's tile of the same name, so a beat drawn here
// and a picture drawn there are the same picture: the prompt strings are
// COPIES of PL_GPT_STYLES.<style>.prefix/.suffix in server.js and
// test-scratchpad-style.js pins them byte-for-byte, the same
// keep-the-copies-identical rule ART.prefix has always lived under. Reword
// one there → move the copy here in the same commit.
//
// NONE of them takes the Sophie character card: hers is the watercolor look,
// i.e. a style reference by another name, and a second reference in a
// different style is exactly what these prefixes forbid.
//
// `styleFile` reads out of refs/ on disk; `storageFiles` are Firebase Storage
// paths (the Witch School pair the house pastel style already uses), so both
// kinds of reference load through refsFor() below.
const STYLE_ART = {
  // DREAMY — refs/dream-mystery.jpg with HER OWN dictated prefix and suffix
  // (2026-08-22), bookending her words exactly as the Playground sends them
  // (prefix\n\nwords\n\nsuffix).
  dreamy: {
    styleFile: 'dream-mystery.jpg',
    prefix: 'The FIRST attached image is a STYLE reference — copy its drawing style ' +
      'but do NOT copy its content, subjects, or composition.',
    suffix: 'Render as ONE single illustration — NOT a grid, NOT split panels. ' +
      'Draw it inside a hand-drawn border, like the frames in the style ' +
      'reference. no text. Again: the attached image is a STYLE reference ' +
      'only — do not draw its content, its subjects or its composition.',
  },
  // PASTEL (2026-08-26, Sophie: "can you make another style in the story room
  // called pastel besides watercolor and dreamy?") — the Playground's Pastel
  // tile, which is the house `house-pastel` look: the two Witch School refs
  // she named sophie snake / sophie animals, the written style line, and the
  // WHITEN pass on the way out. Its references live in STORAGE, not refs/ —
  // that is the one thing that makes this style different to wire up, and it
  // is why refsFor() is async.
  //
  // THE WHITEN PASS IS PART OF THE RECIPE, not a nicety: this look draws on a
  // plain white ground and gpt-image-2 returns that ground faintly tinted,
  // which reads as grey the moment the beat sits on the pad's cream. Shared
  // with the Playground through whiten-bg.js — one copy, no drift.
  pastel: {
    storageFiles: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    prefix: 'Use the attached images ONLY as a STYLE reference for the linework: ' +
      'bold confident black ink outlines, flat colors with NO gradients and minimal ' +
      'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, ' +
      'on a plain white background, playful modern editorial illustration.',
    suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
    whiten: true,
  },
};
const { whitenBackground } = require('./whiten-bg');
// A style's reference images, wherever they live. The twin of server.js's
// `playgroundRefs` / `loadHouseRef` — this module holds no Playground
// credentials and is required long before those exist, so it reads Storage
// itself and caches the bytes for the life of the process.
const storageRefCache = new Map();
async function storageRef(objectPath) {
  if (!storageRefCache.has(objectPath)) {
    const [buf] = await admin.storage().bucket().file(objectPath).download();
    storageRefCache.set(objectPath, buf);
  }
  return storageRefCache.get(objectPath);
}
// Each reference comes back with the NAME it is on disk (or in Storage), so
// the multipart part can declare what it actually is — dream-mystery is a
// JPEG and the pastel pair are PNGs, and a part typed wrong is a refusal from
// the API rather than a picture.
async function refsFor(recipe) {
  const named = (recipe.styleFile ? [recipe.styleFile] : []).map((f) => ({ name: f, buf: artRef(f) }));
  const remote = await Promise.all((recipe.storageFiles || [])
    .map(async (p) => ({ name: p, buf: await storageRef(p) })));
  return named.concat(remote);
}
const refPart = (r, i) => {
  // A character ref's name is its URL, which may carry a query — strip it
  // before reading the extension. The Dump serves JPEG/PNG/WEBP, all of
  // which the edits endpoint accepts.
  const n = String(r.name || '').replace(/\?.*$/, '');
  const jpeg = /\.jpe?g$/i.test(n);
  const webp = /\.webp$/i.test(n);
  const ext = jpeg ? 'jpg' : (webp ? 'webp' : 'png');
  const type = jpeg ? 'image/jpeg' : (webp ? 'image/webp' : 'image/png');
  return { filename: `ref${i + 1}.${ext}`, contentType: type };
};

// The picked characters' bytes — fetched by their public urls, cached for
// the life of the process (a cast is a handful of images drawn against
// again and again). Best-effort is WRONG here: a draw she aimed at a
// character must fail loudly rather than quietly draw without them.
const charBytesCache = new Map();
async function charRefs(chars) {
  const out = [];
  for (const c of chars || []) {
    if (!charBytesCache.has(c.url)) {
      const r = await fetch(c.url, { timeout: 30000 });
      if (!r.ok) throw new Error(`character reference fetch ${r.status}`);
      if (charBytesCache.size >= 40) charBytesCache.delete(charBytesCache.keys().next().value);
      charBytesCache.set(c.url, await r.buffer());
    }
    out.push({ name: c.url, buf: charBytesCache.get(c.url) });
  }
  return out;
}

// ── The film ────────────────────────────────────────────────────────
// The pad already knows how long every picture should be on screen: each
// beat's own audio says so — HER recording when she made one, otherwise the
// cached TTS of its line. So the film is pure ffmpeg (free, seconds, no
// video model): one segment per beat at its audio's real length, hard cuts,
// 2:3 portrait. A beat with no words holds for FILM.silent seconds. Chunks
// are DISPLAY-ONLY — every member is an ordinary shot with its own audio;
// the animate-between-panels treatment is the paid follow-up, not this.
const { execFile } = require('child_process');
// 1000x1500 (2:3), not 1080x1620: the free instance has 512MB for the whole
// app, and the bigger frame's x264 buffers pushed encodes over the OOM line —
// jobs died SILENTLY (no catch runs when the process is killed), which is
// exactly how Sophie's first films vanished. Draft films prove 1000-wide
// encodes survive here. ref=1 + short lookahead keep the encoder lean.
const FILM = { w: 1000, h: 1500, fps: 24, tail: 0.35, silent: 2.0, min: 0.6, segVersion: 2 };
function tryRequire(name) { try { return require(name); } catch { return null; } }
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}
function usable(p) { if (!p) return null; try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { return null; } }
const FFMPEG = process.env.FFMPEG_PATH || usable(tryRequire('ffmpeg-static')) || firstOnPath('ffmpeg');
const FFPROBE = process.env.FFPROBE_PATH || usable((tryRequire('ffprobe-static') || {}).path) || firstOnPath('ffprobe');

// `job` (optional) is a film job's cancel token — see CANCELING A RENDER
// below. Handing the running child to the token is what lets a cancel land in
// SECONDS rather than at the end of a ten-minute encode: killing the ffmpeg
// makes this promise reject, and the checkpoint after it stops the job.
function run(bin, args, timeoutMs = 300000, job = null) {
  return new Promise((resolve, reject) => {
    const child = execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (job && job.child === child) job.child = null;
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
    if (job) {
      job.child = child;
      // Canceled between the token check and the spawn — kill it now, or this
      // one encode runs to completion after she has already stopped the film.
      if (job.canceled) { try { child.kill('SIGKILL'); } catch { /* already gone */ } }
    }
  });
}
async function mediaSeconds(file) {
  if (!FFPROBE) return 0;
  try {
    const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 60000);
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
}
// What streams a downloaded file actually has — a clip beat's segment is
// built from this (no video = nothing to show; no audio = its own silence).
async function probeStreams(file) {
  if (!FFPROBE) return { hasVideo: true, hasAudio: false };
  try {
    const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type',
      '-of', 'json', file], 60000);
    const streams = (JSON.parse(stdout || '{}').streams) || [];
    return {
      hasVideo: streams.some((x) => x.codec_type === 'video'),
      hasAudio: streams.some((x) => x.codec_type === 'audio'),
    };
  } catch { return { hasVideo: true, hasAudio: false }; }
}

async function fetchTo(url, file) {
  const r = await fetch(url, { redirect: 'follow', timeout: 300000 });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${url.slice(0, 80)}`);
  fs.writeFileSync(file, await r.buffer());
  return file;
}

const db = () => admin.firestore();
const padRef = (id) => db().collection(COL).doc(id || DOC);
// Which STORY a request is about. `pad` rides in the body or the query, and
// the legacy single-pad doc id is the default, so the first story (and any
// old link) keeps working untouched.
const padIdOf = (req) => String((req.body && req.body.pad) || req.query.pad || DOC);

function fail(res, e) {
  console.warn('scratchpad:', e.message);
  res.status(500).json({ error: e.message });
}

async function readPad(padId) {
  const snap = await padRef(padId).get();
  const v = snap.exists ? snap.data() : {};
  return {
    title: v.title || '', beats: Array.isArray(v.beats) ? v.beats : [],
    // Which art set the story is showing — see the STYLE TOGGLE block above.
    style: STYLES.includes(v.style) ? v.style : 'watercolor',
    // Portrait or square — see THE STORY'S SHAPE above. Absent means
    // portrait, which is what every story made before this is.
    shape: SHAPE_KEYS.includes(v.shape) ? v.shape : SHAPE_KEYS[0],
    film: v.film || null, films: Array.isArray(v.films) ? v.films : [],
    inbox: Array.isArray(v.inbox) ? v.inbox : null,
    // Photos and movies she added straight off her phone (POST /upload) —
    // they ride the add sheet beside the inbox, waiting to be placed.
    uploads: Array.isArray(v.uploads) ? v.uploads : [],
    // Pictures she has taken OUT of this story's inbox (POST /inbox/hide).
    // HIDDEN, never deleted — the house verb everywhere else in this repo:
    // the picture stays in Storage, a Playground heart stays hearted, and
    // the same route puts it back. See /inbox/hide below.
    inboxHidden: Array.isArray(v.inboxHidden) ? v.inboxHidden : [],
    // "About this story" — what Sophie said about it, in her own words
    // (verbatim, written by a chat; never paraphrased). When what she said
    // is a recording, descriptionAudio carries it instead of text; voiceover
    // is her narration/read-aloud where a story has one.
    description: v.description || '',
    descriptionAudio: v.descriptionAudio || null,
    voiceover: v.voiceover || null,
    episodes: Array.isArray(v.episodes) ? v.episodes : [],
    // The recordings this story came OUT of — voice memos (and interviews)
    // attached by id. See sourceAudios below.
    sources: Array.isArray(v.sources) ? v.sources : [],
    // The story's CAST — character reference cards a draw can pick from
    // (2026-08-26, Sophie). See pad-characters.js and POST /character.
    characters: normalizeCharacters(v.characters),
    updatedAt: v.updatedAt || 0,
  };
}

// Resolve a story's linked episodes to playable audio, live — the URL is the
// episode's NEWEST render (renders[0]; editor.js prepends), so a re-render in
// the Episode Editor reaches the story page with no re-link. An episode with
// no render yet (or a deleted one) simply doesn't show; the link is kept.
async function episodeAudios(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const refs = ids.slice(0, 30).map((id) => db().collection(EDITOR).doc(String(id)));
  const snaps = await db().getAll(...refs);
  const out = [];
  snaps.forEach((s) => {
    if (!s.exists) return;
    const v = s.data() || {};
    const r = (Array.isArray(v.renders) && v.renders[0]) || null;
    if (!r || !r.url) return;
    out.push({
      kind: 'episode',
      episodeId: s.id, title: v.title || 'Untitled episode',
      url: r.url, seconds: r.seconds || null, at: r.at || null,
    });
  });
  return out;
}

// Resolve a story's attached SOURCE RECORDINGS — the voice memos it came out
// of (an interview works the same way). The name, date and length are stored
// on the story when it is attached, so drawing the list costs no index read;
// the URL is built HERE, per request, because a memo's bytes are not public
// and the proxy carries the studio token — storing that url would bake in a
// token that can change under it. (An interview's audio IS public, so its own
// url is stored and used as-is.)
function sourceAudios(sources, req) {
  if (!Array.isArray(sources) || !sources.length) return [];
  const base = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '')
    || `${req.protocol}://${req.get('host')}`;
  const token = process.env.STUDIO_TOKEN || '';
  return sources.slice(0, 60).map((s) => ({
    kind: 'source',
    src: s.src,
    title: s.title || s.src,
    date: s.date || null,
    seconds: s.seconds || null,
    // Unconfirmed guesses draw under their own header in the sheet.
    candidate: !!s.candidate,
    url: s.url
      || `${base}/api/search/audio/${encodeURIComponent(s.src)}${token ? `?token=${encodeURIComponent(token)}` : ''}`,
  }));
}

const router = express.Router();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '25mb' })); // /voice carries a recording as a data URL

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: admin.apps.length > 0 });
});

// ── A CLIP BEAT WITH NO POSTER TILES BLANK, FOREVER ──────────────────
// (2026-08-26, Sophie, looking at the Evan story: "why isn't the third panel
// showing an image preview".) A clip's face IS its poster — never its mp4, so
// a page of decoding videos never happens — and the poster is COPIED onto the
// slot when the clip is placed. The Dump bakes that frame best-effort and
// ONE-SHOT, so a file whose ffmpeg died at dump time hands the pad a null, and
// nothing on either side ever looks again: measured that day, 6 of 133 video
// files in the Dump carry no poster and her third beat was one of them.
//
// So the pad heals itself on read. It fires ONLY for a clip that genuinely has
// none (rare), never blocks the answer, and once a slot is patched it never
// runs again — a url the Dump does not know is remembered as hopeless rather
// than re-queried on every open. The patch deliberately does NOT bump
// `updatedAt`: recovering a thumbnail is not an edit to the story, and would
// otherwise reshuffle the shelf and stale the film.
const drop = require('./dropbox');
const posterless = new Set();   // urls the Dump can't poster — asked once
let healingPosters = false;
// Which slots are missing one — both styles, because a clip is per-slot (a
// movie placed under dreamy leaves the watercolor side alone). Pure, exported
// so the rule has a test that needs no Firestore.
function clipsNeedingPoster(pad, skip) {
  const want = [];
  ((pad && pad.beats) || []).forEach((b) => {
    STYLES.forEach((style) => {
      const s = artSlot(b, style, false);
      if (slotClip(s) && !s.poster && s.url && !(skip && skip.has(s.url))) {
        want.push({ id: b.id, style, url: s.url });
      }
    });
  });
  return want;
}
async function healClipPosters(padId, pad) {
  if (healingPosters) return;
  const want = clipsNeedingPoster(pad, posterless);
  if (!want.length) return;
  healingPosters = true;
  try {
    for (const w of want.slice(0, 4)) {
      const posterUrl = await drop.posterForUrl(w.url);
      if (!posterUrl) { posterless.add(w.url); continue; }
      await db().runTransaction(async (tx) => {
        const snap = await tx.get(padRef(padId));
        const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
        const b = cur.find((x) => x.id === w.id);
        if (!b) return;
        const slot = artSlot(b, w.style, true);
        // Only the slot this url is still sitting in — she may have swapped
        // the clip out while the frame was baking.
        if (!slotClip(slot) || slot.url !== w.url || slot.poster) return;
        slot.poster = posterUrl;
        tx.set(padRef(padId), { beats: cur }, { merge: true });
      });
    }
  } catch (e) {
    console.warn('scratchpad: clip poster heal —', e.message);
  } finally {
    healingPosters = false;
  }
}

router.get('/', async (req, res) => {
  try {
    const pid = padIdOf(req);
    res.set('Cache-Control', 'no-store');
    const pad = await readPad(pid);
    healClipPosters(pid, pad).catch(() => {});   // never blocks the read
    // ONE list — the waveform button holds everything attached to the story,
    // the finished cuts and the raw recordings alike (Sophie, Aug 2026).
    const audios = (await episodeAudios(pad.episodes)).concat(sourceAudios(pad.sources, req));
    res.json({ ...pad, audios, pad: pid });
  } catch (e) { fail(res, e); }
});

// Which art set the story shows — the style toggle at the top of a story.
// Like /category, deliberately NO updatedAt bump: flipping the view is not a
// story edit, so it must not stale the film or reshuffle the shelf (the film
// carries its own `style`, which is how the page knows a watercolor render
// is not the dreamy film).
router.post('/style', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const style = String(req.body.style || '');
    if (!STYLES.includes(style)) {
      return res.status(400).json({ error: `style must be one of ${STYLES.join('/')}` });
    }
    await padRef(pid).set({ style }, { merge: true });
    res.json({ ok: true, pad: pid, style });
  } catch (e) { fail(res, e); }
});

// The story's SHAPE — portrait or square (see THE STORY'S SHAPE above).
//
// THIS ROUTE IS "SOMEBODY DECIDED", and that is what turns the automatic rule
// off for good: autoShapePatch only ever fires on a pad with no `shape` at
// all, so her tap here (or a chat's deliberate one) is the last word, and no
// later picture can move it under her.
//
// Like /style, deliberately NO updatedAt bump: the shelf's newest-first order
// is about the story's words and pictures, not about the canvas they sit on.
//
// It is a TOP-LEVEL route on purpose, not /pads/shape: the page marks the
// film stale for any POST outside its own allowlist, and a shape change is
// exactly that — the film's frame moved, so the render she has is of the old
// canvas. Naming it under /pads would have quietly filed it with the
// shelf-tidying writes that must NOT stale the film.
//
// Nothing already drawn is touched. A portrait picture in a square story is
// kept and letterboxed on white by the film's own scale+pad chain, which is
// the honest answer — the pad has never destroyed a picture.
router.post('/shape', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const shape = String(req.body.shape || '');
    if (!SHAPE_KEYS.includes(shape)) {
      return res.status(400).json({ error: `shape must be one of ${SHAPE_KEYS.join('/')}` });
    }
    await padRef(pid).set({ shape }, { merge: true });
    res.json({ ok: true, pad: pid, shape });
  } catch (e) { fail(res, e); }
});

// A photo or movie straight off her phone (Aug 2026, Sophie: "add clips
// right from my phone into the inbox … a file picker that looks in my photos
// so I can add movies or photos"). The BYTES go through the Dump's
// /api/drop/upload-file (md5 dedupe, HEIC→JPEG, video posters — never a
// second upload path); this route only files the finished url onto the
// story, so the add sheet lists it beside the inbox, waiting to be placed.
// A movie places as a CLIP beat, a photo as a picture.
router.post('/upload', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const it = (req.body && typeof req.body.item === 'object' && req.body.item) || {};
    const url = String(it.url || '').trim();
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'item.url must be http(s)' });
    const entry = {
      url,
      kind: it.kind === 'clip' ? 'clip' : 'image',
      poster: it.poster && /^https?:\/\//.test(String(it.poster)) ? String(it.poster) : null,
      title: String(it.title || '').slice(0, 200),
      at: Date.now(),
    };
    const uploads = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().uploads)) ? snap.data().uploads : [];
      // The Dump content-addresses bytes, so re-adding the same file is the
      // same url — move it to the front rather than doubling it.
      const next = [entry].concat(cur.filter((x) => x && x.url !== url)).slice(0, 300);
      // NO updatedAt bump: an upload waiting in the add sheet is not on the
      // timeline yet, so it must not stale the film (placing it will).
      tx.set(padRef(pid), { uploads: next }, { merge: true });
      return next;
    });
    res.json({ ok: true, pad: pid, count: uploads.length, uploads });
  } catch (e) { fail(res, e); }
});

// ── CHARACTER REFERENCES — the story's cast (2026-08-26, Sophie: "attach
// one or more character references … the characters could exist at the top
// of the story and then there could be like an add character card button and
// then through there I pick one or multiple of the characters that are for
// the story"). The list lives on the pad doc (`characters`), managed from
// the top of the story; a draw picks ids and they ride the edit as the LAST
// attached images (see runArtJob). The BYTES never come through here — the
// page uploads through the Dump's /api/drop/upload-file exactly like the add
// sheet's photos (md5 dedupe, HEIC→JPEG; never a second upload path), and
// this route only files the finished url with a name.
// One route adds AND renames: no `id` = a new card ({url, name?}); an `id` =
// patch that card's name (and url, if a new one is sent).
router.post('/character', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '').trim();
    const url = String(req.body.url || '').trim();
    const name = req.body.name === undefined ? undefined : String(req.body.name || '').trim().slice(0, 60);
    if (!id && !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'a character needs an image url' });
    const characters = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = normalizeCharacters(snap.exists ? snap.data().characters : []);
      if (id) {
        const c = cur.find((x) => x.id === id);
        if (!c) throw new Error('no such character');
        if (name !== undefined) c.name = name;
        if (/^https?:\/\//.test(url)) c.url = url;
      } else {
        if (cur.length >= MAX_CHARACTERS) throw new Error(`a story keeps at most ${MAX_CHARACTERS} characters`);
        cur.push({
          id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
          name: name || '', url, at: Date.now(),
        });
      }
      // Like /style, deliberately NO updatedAt bump: the cast list is not an
      // edit to the beats, so it must not stale the film or reshuffle the
      // shelf.
      tx.set(padRef(pid), { characters: cur }, { merge: true });
      return cur;
    });
    res.json({ ok: true, pad: pid, characters });
  } catch (e) { fail(res, e); }
});

// Taking a character off the list. The IMAGE is untouched wherever it lives
// (the Dump keeps its bytes, and any draw it rode is history on the beat) —
// the house verb is off-the-list, never destroy.
router.post('/character/remove', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '').trim();
    if (!id) return res.status(400).json({ error: 'character id required' });
    const characters = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = normalizeCharacters(snap.exists ? snap.data().characters : [])
        .filter((c) => c.id !== id);
      tx.set(padRef(pid), { characters: cur }, { merge: true });
      return cur;
    });
    res.json({ ok: true, pad: pid, characters });
  } catch (e) { fail(res, e); }
});

// Link (or unlink) an Episode Editor episode to this story. Like /category,
// deliberately NO updatedAt bump: connecting audio that already exists is not
// a story edit, so it must not stale the film or reshuffle the shelf.
router.post('/episode', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const epId = String(req.body.episodeId || '').trim();
    if (!epId) return res.status(400).json({ error: 'episodeId required' });
    if (!req.body.remove) {
      const snap = await db().collection(EDITOR).doc(epId).get();
      if (!snap.exists) return res.status(400).json({ error: 'no such episode' });
    }
    const episodes = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().episodes)) ? snap.data().episodes : [];
      const next = cur.filter((x) => x !== epId);
      if (!req.body.remove) next.push(epId);
      tx.set(padRef(pid), { episodes: next }, { merge: true });
      return next;
    });
    res.json({ ok: true, pad: pid, episodes });
  } catch (e) { fail(res, e); }
});

// Attach (or detach) a SOURCE RECORDING — a voice memo, or an interview —
// to this story. (Aug 2026, Sophie: "I would make it so that a story can hold
// multiple audios, but I think I would hide them all behind a single icon that
// has a wave form".) Identified by its SEARCH INDEX id, which is the id every
// other hand-off already speaks, so the same recording is the same thing in
// the Search page, the Cutting Room and here.
//
// Like /episode and /category, deliberately NO updatedAt bump: connecting a
// recording that already exists is not a story edit, so it must not stale the
// film or reshuffle the shelf.
router.post('/audio', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const src = String(req.body.src || '').trim();
    if (!src) return res.status(400).json({ error: 'src required' });
    let entry = null;
    if (!req.body.remove) {
      // Lazily required: search.js pulls in the editor and the memo archive,
      // and nothing else in this module needs either of them.
      const { loadIndex } = require('./search');
      const index = await loadIndex();
      const found = index.sources[`m:${src}`] || index.sources[`v:${src}`];
      if (!found) return res.status(400).json({ error: 'that recording is not in the search index' });
      entry = {
        src,
        kind: found.k || 'memo',
        title: found.title || src,
        date: found.date || null,
        seconds: found.seconds || null,
        // A memo's url is derived per request (see sourceAudios); an
        // interview's is public and keeps working forever, so store it.
        url: found.k === 'memo' ? null : (found.audioUrl || null),
        at: Date.now(),
      };
      // A CANDIDATE is a recording a chat THINKS belongs to this story but
      // Sophie hasn't confirmed (Aug 2026, her call: "attach them behind the
      // wave form, but under a header tag called candidates"). It rides the
      // same list and the same player — the sheet just draws it under its own
      // header, so a guess can be listened to in the story's own context
      // instead of judged from a title on a review card. Confirming one is
      // the same POST without the flag.
      if (req.body.candidate) entry.candidate = true;
    }
    const sources = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().sources)) ? snap.data().sources : [];
      // Attaching one twice moves it to the end rather than doubling it.
      const next = cur.filter((x) => x && x.src !== src);
      if (entry) next.push(entry);
      tx.set(padRef(pid), { sources: next }, { merge: true });
      return next;
    });
    res.json({ ok: true, pad: pid, sources });
  } catch (e) { fail(res, e); }
});

// ── More than one story ─────────────────────────────────────────────
// Every story is its own doc in the same collection; the original single
// pad keeps the doc id 'pad' and simply becomes one of the list.
router.get('/pads', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const pads = snap.docs.map((d) => {
      const v = d.data() || {};
      const beats = Array.isArray(v.beats) ? v.beats : [];
      const style = STYLES.includes(v.style) ? v.style : 'watercolor';
      // The shelf face follows the toggle — the side the story is showing —
      // falling back to the other side so a tile is never blank while any
      // art exists at all.
      // The showing side first, then every other one in STYLES order, so a
      // tile is never blank while any art exists at all.
      const faceOf = (b) => slotFace(artSlot(b, style))
        || otherStyles(style).map((s) => slotFace(artSlot(b, s))).find(Boolean) || null;
      const withArt = beats.find((b) => faceOf(b));
      // A seeded story keeps its art in its own inbox until it is placed on
      // the timeline, so the shelf cover falls back there — a tile is a real
      // picture from the story, never a blank (the survey prototype's rule).
      const inbox = Array.isArray(v.inbox) ? v.inbox : [];
      const inboxArt = inbox.find((it) => it && it.url);
      return {
        id: d.id, title: v.title || '', beats: beats.length,
        // Sophie can pin a cover from a beat's popup (POST /cover); the
        // pinned one wins over the first-art derivation.
        cover: v.cover || (withArt ? faceOf(withArt) : (inboxArt ? inboxArt.url : null)),
        category: v.category || null, folder: v.folder || null,
        // Portrait or square — the shelf keeps ONE tile footprint (that is
        // what holds the names level across a row), so this only decides
        // whether the cover is cropped to the mat or sat on it whole.
        shape: SHAPE_KEYS.includes(v.shape) ? v.shape : SHAPE_KEYS[0],
        pinned: v.pinned === true, updatedAt: v.updatedAt || 0,
      };
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ count: pads.length, pads });
  } catch (e) { fail(res, e); }
});

const FOLDER_MAX = 60;

router.post('/pads', async (req, res) => {
  try {
    const title = String(req.body.title || '').slice(0, 200).trim();
    // Started from inside a folder → it belongs to that folder (the shelf's +
    // while a folder is open). Absent everywhere else, so a plain new story
    // still lands loose on the shelf.
    const folder = String(req.body.folder || '').slice(0, FOLDER_MAX).trim();
    // A story can be born SQUARE (see THE STORY'S SHAPE). Absent — which is
    // what the shelf's + sends unless she picked one — writes no field at
    // all, so a plain new story is portrait exactly as it always was.
    const shape = SHAPE_KEYS.includes(req.body.shape) ? req.body.shape : null;
    const ref = db().collection(COL).doc();
    await ref.set({ title, beats: [], updatedAt: Date.now(),
      ...(folder ? { folder } : {}), ...(shape ? { shape } : {}) });
    res.json({ ok: true, pad: ref.id, title, folder: folder || null, shape: shape || SHAPE_KEYS[0] });
  } catch (e) { fail(res, e); }
});

// DUPLICATE A STORY — the same words, drawn twice (2026-08-27, Sophie: "can
// u duplicate the hate of the game story room story so i can do my own
// pictures name one (mine) and the other (claude) as suffix").
//
// `art:false` (the default) is the case she asked for: the copy keeps the
// beats, their words, their colours, the story's inbox and its recordings,
// and starts with a BLANK canvas for her own pictures. `art:true` is a
// faithful clone. Either way the copy gets fresh beat ids and does NOT carry
// the other version's renders — the rules, and why, live in pad-duplicate.js.
//
// It costs nothing: one read, one write, no model call and no new bytes —
// both stories point at the same pictures wherever those really live.
router.post('/pads/duplicate', async (req, res) => {
  try {
    const from = String(req.body.pad || req.body.from || '').trim();
    if (!from) return res.status(400).json({ error: 'pad required' });
    const snap = await padRef(from).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such story' });
    const src = snap.data() || {};
    const title = String(req.body.title ?? `${src.title || 'Untitled'} (copy)`)
      .slice(0, 200).trim();
    const art = req.body.art === true || req.body.art === 'true';
    const ref = db().collection(COL).doc();
    const doc = dupPad(src, {
      title, art, styles: STYLES, slotKeys: SLOT_KEYS,
      mkId: () => db().collection(COL).doc().id,
    });
    await ref.set(doc);
    res.json({ ok: true, pad: ref.id, from, title, art, beats: doc.beats.length });
  } catch (e) { fail(res, e); }
});

// ── Folders on the shelf ────────────────────────────────────────────
// (Aug 2026, Sophie: "just make an intermediate shelf so basically treat the
// Evan and Mason ones as a folder … some sort of UI design like a stack that
// you can see underneath the cover image so you can tell there's multiple
// stories in there".) One story of hers becomes several as chats work on it,
// and the flat newest-first shelf interleaves them with everything else — the
// five Mason stories were scattered across four screens.
//
// A folder is just a NAME on the pad doc, not a doc of its own: there is
// nothing to create, nothing to delete, and a folder stops existing the
// moment its last story leaves it. That is what keeps the shelf honest — an
// empty folder tile can never sit there pointing at nothing.
//
// Like /category, this deliberately does NOT bump updatedAt: tidying the
// shelf must not reshuffle its newest-first order.
router.post('/pads/folder', async (req, res) => {
  try {
    // `pads` files a whole set in one call — how a chat gathers a character's
    // stories — and `pad` is the single-story form.
    const ids = (Array.isArray(req.body.pads) ? req.body.pads : [req.body.pad])
      .map((x) => String(x || '').trim()).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'pad or pads required' });
    const folder = String(req.body.folder || '').slice(0, FOLDER_MAX).trim();
    const batch = db().batch();
    // '' takes a story back out of its folder — the only way out, and the
    // reason this stores null rather than deleting the field (a merge:true
    // write cannot unset one).
    ids.forEach((id) => batch.set(padRef(id), { folder: folder || null }, { merge: true }));
    await batch.commit();
    res.json({ ok: true, pads: ids, folder: folder || null });
  } catch (e) { fail(res, e); }
});

// Which shelf chip a story answers to (unsorted / personal / witch / lessons /
// nde). Set by the seed script or a chat — a story carrying NONE files under
// UNSORTED, so a brand-new story is never invisible and never lands in one of
// her real piles uninvited (2026-08-26, Sophie: "I think personal is the
// default so can you just make a different default and just put the ones I
// mentioned into personal" — Personal had become everything nobody had filed).
// `pads` files a whole set in one call, the /pads/folder shape; `pad` is the
// single-story form. Deliberately does NOT bump updatedAt: filing a story must
// not reshuffle the shelf's newest-first order.
router.post('/pads/category', async (req, res) => {
  try {
    const ids = (Array.isArray(req.body.pads) ? req.body.pads : [req.body.pad])
      .map((x) => String(x || '').trim()).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'pad or pads required' });
    const category = String(req.body.category || '').toLowerCase().slice(0, 24).trim();
    const batch = db().batch();
    ids.forEach((id) => batch.set(padRef(id), { category: category || null }, { merge: true }));
    await batch.commit();
    res.json({ ok: true, pad: ids[0], pads: ids, category: category || null });
  } catch (e) { fail(res, e); }
});

// PINNED TO THE TOP OF THE SHELF (Aug 2026, Sophie: "a pinning feature where i
// can pin a couple stories i'm actively working on and the rest go behind a see
// more toggle"). Nothing to do with /cover, which pins a story's FACE — this is
// which stories lead the shelf. Absent means unpinned, so a story is never
// hidden behind the fold by a field nobody set. Like /category, deliberately
// does NOT bump updatedAt: pinning is not an edit to the story.
//
// A WHOLE FOLDER PINS AT ONCE — `pads` takes a list (2026-08-26, Sophie: "make
// it possible to pin multiple stories that are together so I can pin all my
// Mason stories at once"). The folder's pushpin sends every story in it, so
// what is stored is still one flag per story and nothing new has to be kept in
// step with which stories a folder holds.
router.post('/pads/pin', async (req, res) => {
  try {
    const ids = (Array.isArray(req.body.pads) ? req.body.pads : [req.body.pad])
      .map((x) => String(x || '').trim()).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'pad or pads required' });
    const pinned = req.body.pinned === true || req.body.pinned === 'true';
    const batch = db().batch();
    ids.forEach((id) => batch.set(padRef(id), { pinned }, { merge: true }));
    await batch.commit();
    res.json({ ok: true, pad: ids[0], pads: ids, pinned });
  } catch (e) { fail(res, e); }
});

// Pin a story's shelf cover to one beat's art (Sophie's pick — the shelf
// otherwise shows the FIRST art, which isn't always the story's face; the
// meditation lesson led with Mason when it should lead with her waking up).
// `id` = a beat id; empty/absent clears the pin back to the derivation.
// Like /category, deliberately does NOT bump updatedAt.
router.post('/cover', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const beatId = String(req.body.id || '').trim();
    if (!beatId) {
      await padRef(pid).set({ cover: null }, { merge: true });
      return res.json({ ok: true, pad: pid, cover: null });
    }
    const pad = await readPad(pid);
    const beat = (pad.beats || []).find((b) => b.id === beatId);
    // The cover comes off the side she is LOOKING at — a dreamy beat's popup
    // pins the dreamy picture, never silently the watercolor one.
    const style = styleOf(req);
    const art = beat ? slotFace(artSlot(beat, style)) : null;
    if (!art) return res.status(400).json({ error: 'that beat has no art' });
    await padRef(pid).set({ cover: art }, { merge: true });
    res.json({ ok: true, pad: pid, cover: art });
  } catch (e) { fail(res, e); }
});

// ── ADD TO SHOEBOX (2026-08-28, Sophie: "add to shoebox button option in
// share in story room", settled after "this is too complicated" as the one
// simple version) ─────────────────────────────────────────────────────────
// One tap on a beat's popup files the picture she is looking at as a MEMORY
// in her Memory Library (membry users/{uid}/memories — the collection the
// Shoebox at incaseofamnesia.com/shoebox is a polaroid view over): the
// beat's words as the title, the picture as `illustration.url`. It lands in
// the Shoebox LIBRARY as a developed polaroid; pinning it to a board stays
// hers, in the shoebox. Nothing else is written anywhere.
//
// The membry handles are HANDED IN by server.js (init below) — the pattern
// every membry-touching module here uses — because the credential lives on
// STORY_FIREBASE_SERVICE_ACCOUNT and this module's own admin app is Deck
// Factory's.
//
// WHOSE LIBRARY: her uid is DISCOVERED, never committed — the house
// find-gallery-uid technique (rank collectionGroup parents by count; her
// pile is thousands of memories against a family member's handful from a
// Versus game). SHOEBOX_UID in the environment overrides the scan, and the
// answer is cached for the life of the process. A tie or an empty scan is a
// refusal, not a guess — writing into the wrong person's library is the one
// failure this must not have.
let membryWiring = null;
function init(w) { membryWiring = w || null; }
let shoeboxUidCache = null;
async function shoeboxUid(mdb) {
  if (process.env.SHOEBOX_UID) return process.env.SHOEBOX_UID;
  if (shoeboxUidCache) return shoeboxUidCache;
  const q = await mdb.collectionGroup('memories').limit(1000).get();
  const counts = {};
  q.docs.forEach((d) => {
    const uid = d.ref.parent.parent && d.ref.parent.parent.id;
    if (uid) counts[uid] = (counts[uid] || 0) + 1;
  });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) {
    throw new Error('could not tell whose memory library this is — set SHOEBOX_UID in the environment');
  }
  shoeboxUidCache = ranked[0][0];
  return shoeboxUidCache;
}
router.post('/shoebox', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const beatId = String(req.body.id || '').trim();
    if (!beatId) return res.status(400).json({ error: 'beat id required' });
    const pad = await readPad(pid);
    const beat = (pad.beats || []).find((b) => b.id === beatId);
    // The picture is the side she is LOOKING at — the /cover rule.
    const style = styleOf(req);
    const art = beat ? slotFace(artSlot(beat, style)) : null;
    if (!art || !/^https?:\/\//.test(art)) return res.status(400).json({ error: 'that beat has no picture' });
    const mdb = membryWiring && membryWiring.membryDb && await membryWiring.membryDb();
    if (!mdb) return res.status(503).json({ error: 'the memory library credential (STORY_FIREBASE_SERVICE_ACCOUNT) is not set' });
    const uid = await shoeboxUid(mdb);
    // Content-addressed by the picture, so tapping twice updates ONE memory
    // (the deliverables-list rule) — and the doc id is prefixed so it can
    // never collide with an addDoc id.
    const id = 'sb-' + crypto.createHash('sha1').update(art).digest('hex').slice(0, 24);
    const ref = mdb.collection('users').doc(uid).collection('memories').doc(id);
    const now = new Date();
    const FV = require('firebase-admin').firestore.FieldValue;
    const snap = await ref.get();
    // The shape useMemories/Shoebox read: title on the chin, illustration.url
    // as the picture, createdAt because the library's one query ORDERS BY IT
    // (a doc without it is silently omitted — the Firestore orderBy trap).
    const doc = {
      title: String(beat.text || '').trim().slice(0, 140),
      hashtags: ['storyroom'],
      illustration: { url: art },
      source: 'storyroom', pad: pid, beat: beatId,
      timestamp: now.toISOString(),
      dateTime: now.toLocaleDateString('en-US'),
      updatedAt: FV.serverTimestamp(),
    };
    if (!snap.exists) { doc.content = ''; doc.createdAt = FV.serverTimestamp(); }
    await ref.set(doc, { merge: true });
    res.json({ ok: true, id });
  } catch (e) { fail(res, e); }
});

// The inbox. A story that carries its OWN inbox shows that instead of the
// Playground hearts (Aug 2026, Sophie): the art a story already has —
// gathered from the chats that made it — is what she wants to place on the
// timeline, not whatever she last hearted in the Playground. A pad with no
// inbox of its own behaves exactly as before, so nothing that exists breaks.
router.get('/inbox', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const padData = await readPad(padIdOf(req));
    // Anything she has taken out of the inbox is filtered on the way OUT, so
    // one rule covers all three kinds of item — a story's own gathered art, a
    // phone upload, and a Playground heart this story never owned.
    const gone = new Set(padData.inboxHidden);
    // Her phone uploads ride along whichever inbox this story shows — the
    // add sheet draws them at the top, waiting to be placed.
    const uploads = padData.uploads.filter((u) => u && !gone.has(u.url));
    // The SOURCE is decided by the unfiltered list: a story that gathered its
    // own art keeps showing its own art even once she has taken every picture
    // out of it — falling back to the Playground hearts there would answer an
    // emptied inbox with a stranger's pictures.
    const own = padData.inbox;
    if (own && own.length) {
      const left = own.filter((x) => x && !gone.has(x.url));
      return res.json({ count: left.length, items: left, source: 'story', uploads });
    }
    const q = await db().collection(PROMPTLAB)
      .orderBy('createdAt', 'desc').limit(300).get();
    const items = [];
    q.docs.forEach((s) => {
      const d = s.data();
      const votes = d.votes || {};
      (d.images || []).forEach((url, i) => {
        if (votes[i] !== 'like' || !url || gone.has(url)) return;
        items.push({
          url, runId: s.id, i,
          prompt: d.prompt || null, model: d.model || null,
          engine: d.engine || null, quality: d.quality || null,
          at: d.createdAt?.toMillis?.() || null,
        });
      });
    });
    res.json({ count: items.length, items, source: 'playground', uploads });
  } catch (e) { fail(res, e); }
});

// Take a picture OUT of this story's inbox — or put it back (`hide:false`).
// Sophie, Aug 2026: "a way to delete certain items from the inbox".
//
// It HIDES rather than deletes, for the reason the clip shelf has no delete
// route either: the three kinds of item in that grid belong to three
// different places, and only one of them is the story's to destroy. A
// Playground heart lives on its run doc, so un-hearting it here would reach
// back into the Playground and change what she sees THERE; an upload's bytes
// are the Dump's, content-addressed and possibly shared with an assembly. So
// the removal is recorded on the STORY — the one thing this route owns — as a
// url on `inboxHidden`, and every read filters against it. The picture is
// untouched wherever it really lives, and the same route is the undo.
//
// NO updatedAt bump, like /upload and /category: what is waiting in the add
// sheet is not on the timeline, so taking one out must not stale the film.
router.post('/inbox/hide', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const url = String(req.body.url || '').trim();
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'url must be http(s)' });
    const hide = req.body.hide !== false;
    const hidden = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().inboxHidden)) ? snap.data().inboxHidden : [];
      const next = cur.filter((x) => x !== url);
      if (hide) next.push(url);
      tx.set(padRef(pid), { inboxHidden: next }, { merge: true });
      return next;
    });
    res.json({ ok: true, pad: pid, url, hidden: hide, count: hidden.length });
  } catch (e) { fail(res, e); }
});

// Fill a story's own inbox — the art it already has, gathered from wherever it
// was made. `items` is [{url, prompt?, model?, quality?, style?, src?}];
// `replace:false` appends and skips urls already there.
router.post('/inbox', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const incoming = (Array.isArray(req.body.items) ? req.body.items : [])
      .filter((x) => x && typeof x.url === 'string' && /^https?:\/\//.test(x.url))
      .slice(0, 600)
      .map((x) => ({
        url: x.url,
        prompt: x.prompt == null ? null : String(x.prompt).slice(0, 600),
        model: x.model == null ? null : String(x.model).slice(0, 80),
        quality: x.quality == null ? null : String(x.quality).slice(0, 40),
        style: x.style == null ? null : String(x.style).slice(0, 60),
        src: x.src == null ? null : String(x.src).slice(0, 80),
        at: Number(x.at) || null,
      }));
    const cur = (await readPad(pid)).inbox || [];
    const keep = req.body.replace ? [] : cur;
    const seen = new Set(keep.map((x) => x.url));
    const merged = keep.concat(incoming.filter((x) => !seen.has(x.url) && seen.add(x.url)));
    await padRef(pid).set({ inbox: merged, updatedAt: Date.now() }, { merge: true });
    res.json({ ok: true, pad: pid, count: merged.length, added: merged.length - keep.length });
  } catch (e) { fail(res, e); }
});

router.post('/add', async (req, res) => {
  try {
    const pid = padIdOf(req);
    // No url = an EMPTY beat (blank tile; its art comes later).
    const url = String(req.body.url || '').trim();
    if (url && !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'image url must be http(s)' });
    const src = (req.body.src && typeof req.body.src === 'object') ? req.body.src : null;
    // The page names the side she is showing; a request naming NONE is a
    // chat seeding art, and the side comes from the picture's own run record
    // (sideFromEvidence — watercolor only when the evidence claims no side).
    const named = styleNamed(req);
    const style = named || (url ? await sideFromEvidence(url, src) : null) || 'watercolor';
    const beat = {
      id: db().collection(COL).doc().id, url: null, color: null, src: null,
      addedAt: Date.now(),
    };
    // A picture placed while the story shows DREAMY lands in the dreamy slot;
    // the watercolor side of the new beat stays blank (and vice versa).
    if (url) { const slot = artSlot(beat, style, true); slot.url = url; slot.src = src; }
    // A STORY'S SHAPE FOLLOWS ITS FIRST PICTURE — read ahead of the write,
    // because it needs the picture's own header off the network. {} unless
    // this really is the first picture on a story nobody has decided yet.
    const shapePatch = await autoShapePatch(pid, url);
    // Single-user tool, but the read-modify-write still goes through a
    // transaction so two quick adds can't drop each other.
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      let at = Number(req.body.at);
      if (!Number.isInteger(at) || at < 0 || at > cur.length) at = cur.length;
      cur.splice(at, 0, beat);
      const patch = { beats: cur, updatedAt: Date.now() };
      // A derived placement may also flip the toggle — only onto a story
      // whose showing side holds no art at all (revealPatch).
      if (!named && url) Object.assign(patch, revealPatch(snap.exists ? snap.data() : null, cur, style));
      // Re-checked HERE: another placement may have decided the shape while
      // this one was reading its picture's header.
      if (shapePatch.shape && !(snap.exists && snap.data().shape)) Object.assign(patch, shapePatch);
      tx.set(padRef(pid), patch, { merge: true });
      return cur;
    });
    // The shape rides the answer so the page can follow it without a reload —
    // her first picture landing is exactly when the tiles change shape.
    res.json({ ok: true, beat, beats, ...(shapePatch.shape ? { shape: shapePatch.shape } : {}) });
  } catch (e) { fail(res, e); }
});

// Give an EXISTING beat its picture — the empty-beat popup's inbox path
// (choosing from there fills THAT beat instead of adding a new one).
router.post('/image', async (req, res) => {
  try {
    const id = String(req.body.id || '');
    const url = String(req.body.url || '').trim();
    if (!id) return res.status(400).json({ error: 'beat id required' });
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'image url required' });
    const src = (req.body.src && typeof req.body.src === 'object') ? req.body.src : null;
    // Same rule as /add: the page names the side; a chat naming none gets the
    // side the picture's own run record claims (sideFromEvidence).
    const named = styleNamed(req);
    const style = named || (await sideFromEvidence(url, src)) || 'watercolor';
    const pid = padIdOf(req);
    // A STORY'S SHAPE FOLLOWS ITS FIRST PICTURE (see autoShapePatch) — {}
    // unless this is the first picture on a story nobody has decided yet.
    const shapePatch = await autoShapePatch(pid, url);
    const beats = await placeOnBeat(pid, id, url, style, src, { derived: !named, shapePatch });
    res.json({ ok: true, beats, ...(shapePatch.shape ? { shape: shapePatch.shape } : {}) });
  } catch (e) { fail(res, e); }
});

// THE ONE WRITE that puts a picture on a beat, so every door behaves the
// same: her pick from the inbox, her picking an older version back off the
// past-pictures row (both POST /image), and a Playground run she started FROM
// a beat, which server.js lands here itself when the job finishes — the
// picture must reach the beat whether or not she is still looking at the
// Playground when it draws.
//
// Swapping a picture into a clip SLOT makes that side a picture again —
// leaving `kind` behind would render an image url as a film. Only this side:
// the other style's clip (or picture) is untouched. swapArt owns that, the
// history bookkeeping and the provenance.
async function placeOnBeat(padId, beatId, url, style, src, opts) {
  const st = STYLES.includes(style) ? style : 'watercolor';
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(padRef(padId));
    const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
    const b = cur.find((x) => x.id === beatId);
    if (!b) throw new Error('no such beat');
    swapArt(artSlot(b, st, true), url, src || null);
    const patch = { beats: cur, updatedAt: Date.now() };
    // A DERIVED placement (the caller named no side — a chat's, never the
    // page's) may flip the toggle onto its side, but only when the showing
    // side holds no art at all (revealPatch).
    if (opts && opts.derived) Object.assign(patch, revealPatch(snap.exists ? snap.data() : null, cur, st));
    // The story's shape, decided by this picture if it is the first one — the
    // caller read it ahead of the write; re-checked here in case another
    // placement decided in between.
    const sp = (opts && opts.shapePatch) || {};
    if (sp.shape && !(snap.exists && snap.data().shape)) Object.assign(patch, sp);
    tx.set(padRef(padId), patch, { merge: true });
    return cur;
  });
}

// ── MATCH A SENT PICTURE TO ITS BEAT (2026-08-26, Sophie: "if I'm in the
// playground and I want to send a drawing to the story room then it does
// some sort of a check to match it to the right beat and then asks me to
// confirm or asks me to choose a different one") ────────────────────
// The send trip's guess: the run's typed prompt against every beat's words
// across the whole shelf, ranked by send-match.js (pure, tested — the rules
// live there). FREE — one collection read, no model call, because this fires
// on a page open. It only ever PROPOSES: the page shows the candidates and
// nothing places without her tap, through the same POST /image every other
// placement takes.
router.get('/send-match', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const q = String(req.query.q || '').slice(0, 2000).trim();
    if (!q) return res.json({ candidates: [] });
    const { matchBeats } = require('./send-match');
    const snap = await db().collection(COL).get();
    const pads = snap.docs.map((d) => {
      const v = d.data() || {};
      return {
        id: d.id, title: v.title || '', updatedAt: v.updatedAt || 0,
        beats: Array.isArray(v.beats) ? v.beats : [],
      };
    });
    const candidates = matchBeats(q, pads).map((c) => ({
      pad: c.pad.id, padTitle: c.pad.title, beat: c.beat.id,
      // What the row shows her — the words the match was made on. The
      // drawing prompt leads exactly as promptFor() reads it.
      words: String(c.beat.prompt || c.beat.text || '').slice(0, 240),
      // A face from any side, so the row can show which picture (if any)
      // she would be replacing — same derivation as the shelf tiles'.
      art: STYLES.map((s) => slotFace(artSlot(c.beat, s))).find(Boolean) || null,
      exact: c.exact === true,
    }));
    res.json({ candidates });
  } catch (e) { fail(res, e); }
});

// ── The clip shelf ──────────────────────────────────────────────────
// The Chunking library, read-only, straight through: a clip lives there and
// is REFERENCED here, never copied (the same rule Assembly follows). The
// search grammar is clips.js's own — required lazily, because nothing else
// in this module needs the clip module and its boot pulls in ffmpeg probing.
router.get('/shelf', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const lib = require('./clips');
    const snap = await db().collection(CLIPS).get();
    let items = [];
    snap.forEach((x) => {
      const v = x.data() || {};
      // Only a clip that is actually playable: baked, not hidden, with a file.
      if (v.hidden || (v.status && v.status !== 'ready') || !v.url) return;
      items.push({
        id: x.id, url: v.url, poster: v.poster || null, title: v.title || '',
        seconds: v.seconds ?? null, from: v.from || '', tags: v.tags || [],
        kind: v.kind || 'short', prompt: v.prompt || null, note: v.note || null,
        vo: v.vo || null, createdAt: v.createdAt || 0,
      });
    });
    if (req.query.q) {
      const groups = lib.parseClipQuery(String(req.query.q));
      items = items.filter((c) => lib.matchClip(c, groups));
    }
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ count: items.length, clips: items });
  } catch (e) { fail(res, e); }
});

// A film clip onto the pad. With `at` it is a new beat at that place; with
// `id` it drops into that (usually blank) beat, exactly like picking a
// picture out of the inbox does. Only the fields the pad draws and renders
// are stored — the library doc stays the truth for everything else.
// PER STYLE since 2026-08-23 (see the STYLE TOGGLE block): the clip lands in
// the side she is showing, so a movie placed under dreamy never touches the
// watercolor art — the very first live use of the toggle put three movies
// onto both sides, two of them OVER existing watercolor art.
router.post('/clip', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const c = (req.body && typeof req.body.clip === 'object' && req.body.clip) || {};
    const url = String(c.url || '').trim();
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'clip url must be http(s)' });
    const style = styleOf(req);
    const fields = {
      kind: 'clip',
      url,
      poster: c.poster && /^https?:\/\//.test(String(c.poster)) ? String(c.poster) : null,
      seconds: Number.isFinite(Number(c.seconds)) ? Math.round(Number(c.seconds) * 10) / 10 : null,
      title: String(c.title || '').slice(0, 200),
      clipId: String(c.id || '').slice(0, 60) || null,
    };
    const beatId = String(req.body.id || '').trim();
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      if (beatId) {
        const b = cur.find((x) => x.id === beatId);
        if (!b) throw new Error('no such beat');
        const slot = artSlot(b, style, true);
        // A picture this side already had is kept, never destroyed.
        if (slot.url && !slotClip(slot)) slot.imageHistory = (slot.imageHistory || []).concat([{ url: slot.url, at: Date.now() }]);
        Object.assign(slot, fields);
        delete slot.gen;
        // Art here again un-deletes this side (see `off` above).
        delete slot.off;
      } else {
        let at = Number(req.body.at);
        if (!Number.isInteger(at) || at < 0 || at > cur.length) at = cur.length;
        const beat = { id: db().collection(COL).doc().id, color: null, src: null, addedAt: Date.now() };
        Object.assign(artSlot(beat, style, true), fields);
        cur.splice(at, 0, beat);
      }
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// Patch one beat inside a transaction (the pad is one doc, so every write
// is read-modify-write).
async function patchBeat(padId, id, fn) {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(padRef(padId));
    const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
    const b = cur.find((x) => x.id === id);
    if (!b) throw new Error('no such beat');
    fn(b, cur);
    tx.set(padRef(padId), { beats: cur, updatedAt: Date.now() }, { merge: true });
    return cur;
  });
}

// Draw a beat's art in place. BACKGROUND JOB (house rule): the POST returns
// at once with the beat marked drawing, the page polls the pad, and leaving
// the app can't lose the picture. Superseded art is never deleted — it goes
// to beat.imageHistory.
async function runArtJob(padId, id, { prompt, quality, character, style, chars, shape }) {
  // The STORY's canvas, not a per-draw one (see THE STORY'S SHAPE). An
  // unknown or absent shape lands on portrait, which is what every beat drawn
  // before this used.
  const canvas = shapeOf({ shape });
  const recipe = STYLE_ART[style] || null;   // null = watercolor, the pad's original
  try {
    // A non-watercolor style draws its Playground tile's recipe: that tile's
    // reference images, her dictated prefix and suffix bookending the words,
    // and never the Sophie card (see the STYLE TOGGLE block). Watercolor is
    // the pad's original recipe, byte-for-byte.
    // The story's PICKED CHARACTERS ride LAST on any style — behind the
    // style reference(s) and, on watercolor, behind the Sophie card — which
    // is what lets one disclosed line ("the last attached image(s)…") stay
    // true everywhere. With none picked, every string below is
    // byte-for-byte what it always was.
    const picked = Array.isArray(chars) ? chars : [];
    const refs = (recipe
      ? await refsFor(recipe)
      : [{ name: ART.styleFile, buf: artRef(ART.styleFile) }]
        .concat(character ? [{ name: ART.characterFile, buf: artRef(ART.characterFile) }] : []))
      .concat(await charRefs(picked));
    const useCard = !recipe && Boolean(character);
    // Where the character line rides is per style, ON PURPOSE: watercolor
    // puts it in the head beside the Sophie line (its own shape); a recipe
    // style appends it AFTER the suffix, because dreamy's suffix re-asserts
    // "the attached image is a STYLE reference only" and the carve-out must
    // come after that sentence, not before it.
    const cline = charLine(picked);
    const full = recipe
      ? `${recipe.prefix}\n\n${prompt}\n\n${recipe.suffix}${cline}`
      : `${ART.prefix}${character ? ART.characterLine : ''}${cline}\n\n${prompt}`;
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', full);
    form.append('size', canvas.size);
    form.append('quality', quality);
    form.append('output_format', 'webp');
    // NO output_compression — it is lossy, OpenAI applies it before the bytes
    // come back, and every beat's art here is a KEPT original (superseded art
    // goes to beat.imageHistory rather than being deleted). See
    // scripts/test-no-generation-compression.js.
    // Each ref is declared as what it actually IS, read off its own filename —
    // dream-mystery is a JPEG, the pastel pair are PNGs.
    refs.forEach((r, i) => form.append('image[]', r.buf, refPart(r, i)));
    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
      body: form,
      timeout: 300000,
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'gpt-image-2 edit error');
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('gpt-image-2 returned no image');
    let buf = Buffer.from(b64, 'base64');
    // The pastel recipe ends with the flood-fill whiten, exactly as the
    // Playground's Pastel tile and the house style do — best-effort, because a
    // failed whiten must keep the picture rather than lose a paid render.
    if (recipe && recipe.whiten) {
      try { buf = await whitenBackground(buf); } catch (e) { console.warn('scratchpad whiten failed:', e.message); }
    }
    const bucket = admin.storage().bucket();
    const dest = `scratchpad/art/${id}-${Date.now()}.webp`;
    const tmp = path.join(os.tmpdir(), `spa-${id}.webp`);
    fs.writeFileSync(tmp, buf);
    await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'image/webp' } });
    await bucket.file(dest).makePublic();
    fs.unlink(tmp, () => {});
    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    await patchBeat(padId, id, (b) => {
      const slot = artSlot(b, style, true);
      // Through swapArt so the picture this draw replaces is banked WITH the
      // run that made it — that is what lets her pick it back later and get
      // its own prompt with it, rather than this draw's.
      swapArt(slot, url, {
        engine: 'gptimage', model: 'gpt-image-2', prompt, quality,
        character: useCard, style, promptUsed: full,
        // Provenance: WHICH characters rode this draw, by name — so a
        // picked-back version says who was in it.
        ...(picked.length ? { characters: picked.map((c) => c.name || '') } : {}),
      });
      slot.gen = { status: 'done', at: Date.now() };
    });
    // Every draw also lands in My Creations (house rule — the gallery is the
    // hand-off surface for every image made for Sophie). Through the server's
    // own gallery route so the de-dupe and membry wiring stay in one place.
    try {
      await fetch(`http://localhost:${process.env.PORT || 3001}/api/gallery`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.STUDIO_TOKEN ? { 'x-studio-token': process.env.STUDIO_TOKEN } : {}),
        },
        // THE WHOLE PROMPT rides along (Sophie's hard rule, 2026-08-24). This
        // module has always built `full` and kept it on the beat as
        // `promptUsed`; until now the gallery only ever saw her typed words.
        body: JSON.stringify({ url, prompt,
          style: `Scratch Pad · ${style !== 'watercolor' ? `${style} · ` : ''}${quality}`,
          fullPrompt: full,
          promptPrefix: recipe ? recipe.prefix : `${ART.prefix}${useCard ? ART.characterLine : ''}${cline}`,
          promptSuffix: recipe ? `${recipe.suffix}${cline}` : '' }),
        timeout: 30000,
      });
    } catch (e) { console.warn('scratchpad → creations:', e.message); }
  } catch (err) {
    console.warn('scratchpad art:', err.message);
    await patchBeat(padId, id, (b) => {
      artSlot(b, style, true).gen = { status: 'failed', error: String(err.message || err).slice(0, 300), at: Date.now() };
    }).catch(() => {});
  }
}

// Delete a beat — from its popup, behind an are-you-sure. The beat leaves
// the pad but nothing is destroyed: its full record (art, history, takes,
// words) moves to pad.trash, and every drawn image is already in Storage /
// My Creations regardless.
// DELETING IS PER STYLE (2026-08-23, Sophie: "if I delete a beat in one of
// the styles does it delete it for the other style too? … I don't want it
// to. Make it persist … leave it in the other style cause that one might
// have an image for that"). So a delete asks one question first — is there
// still art on the OTHER side?
//   • Yes → only THIS side goes: its picture (or clip) is banked in the
//     trash, the side is emptied and marked `off`, and the beat keeps its
//     place, its words, its color and her voice for the side that still
//     wants it. It simply stops being drawn on the side she deleted it from.
//   • No  → the beat itself is gone, exactly as before (the whole record to
//     pad.trash, a chunk left with one member un-chunked). Her own reason IS
//     this rule: the thing worth keeping is the other side's image, and with
//     no image over there a words-only beat she deleted is just deleted.
router.post('/remove', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const style = styleOf(req);
    const out = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const v = snap.exists ? snap.data() : {};
      const cur = Array.isArray(v.beats) ? v.beats : [];
      const idx = cur.findIndex((x) => x.id === id);
      if (idx < 0) throw new Error('no such beat');
      const trash = Array.isArray(v.trash) ? v.trash : [];
      const b = cur[idx];

      // Art on ANY other side keeps the beat over there (2026-08-23, extended
      // to N styles 2026-08-26 — "leave it in the other style cause that one
      // might have an image for that" holds however many others there are).
      if (otherStyles(style).some((s) => artSlot(b, s).url)) {
        // ONE SIDE ONLY. The banked record names its beat and its side, so a
        // per-side removal is never mistaken for a whole deleted beat.
        const mine = artSlot(b, style, true);
        const kept = { beatId: b.id, style, text: b.text || '', removedAt: Date.now() };
        SLOT_KEYS.forEach((k) => { if (mine[k] !== undefined) kept[k] = mine[k]; });
        clearSlot(mine);
        mine.off = true;
        tx.set(padRef(pid), {
          beats: cur, trash: trash.concat([kept]).slice(-50), updatedAt: Date.now(),
        }, { merge: true });
        return { beats: cur, style, whole: false };
      }

      const [gone] = cur.splice(idx, 1);
      // A chunk of one is just a beat again.
      if (gone.chunk) {
        const rest = cur.filter((x) => x.chunk === gone.chunk);
        if (rest.length === 1) delete rest[0].chunk;
      }
      tx.set(padRef(pid), {
        beats: cur, trash: trash.concat([{ ...gone, removedAt: Date.now() }]).slice(-50), updatedAt: Date.now(),
      }, { merge: true });
      return { beats: cur, style, whole: true };
    });
    res.json({ ok: true, ...out });
  } catch (e) { fail(res, e); }
});

// Speech-only markup has no business in an image prompt: [pause]-style
// tags and <break time="1s" /> are directions for the VOICE. Stripped
// wherever words become a prompt — the wand here, and the draw box's seed
// on the page (its own copy, stripSpeech).
function drawablePrompt(text) {
  return String(text || '')
    .replace(/<break[^>]*>/gi, ' ')
    .replace(/\[[^\]\n]{1,40}\]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// What a beat DRAWS: its own stored prompt when Sophie has written one, else
// its words with the speech markup stripped. The prompt is its own field
// (beat.prompt) so tuning what a picture shows never rewrites what the film
// says — and an absent prompt keeps following the words, so nothing existing
// changed the day this landed.
function promptFor(beat) {
  const p = String((beat && beat.prompt) || '').trim();
  return p || drawablePrompt(beat && beat.text);
}

// The one-tap outline pass: draw every beat that has its OWN words but no
// art. Chunk siblings without text are skipped on purpose (their art is a
// hand decision — the literal→metaphorical pair), as is anything already
// drawing or already pictured. Naturally safe to re-tap: it only ever draws
// what is still missing. Two at a time so a big pad doesn't trip rate limits.
router.post('/drawall', async (req, res) => {
  try {
    const pid = padIdOf(req);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not set' });
    const quality = ART.qualities.includes(req.body.quality) ? req.body.quality : 'low';
    const style = styleOf(req);
    // Only WATERCOLOR takes the Sophie card — every other style is a
    // reference of its own, and hers is the watercolor look (noCharacter).
    const character = style === 'watercolor';
    const pad = await readPad(pid);
    // "Missing" is per STYLE: a beat whose watercolor is drawn but whose
    // pastel slot is empty is exactly what the toggle exists to fill — and a
    // beat that is a CLIP on the other side still draws on this one (a clip
    // slot itself never draws).
    const targets = pad.beats
      // A beat she DELETED from this side is not missing art here — it is
      // not on this side at all, so the wand must never draw it back.
      .filter((b) => { const s = artSlot(b, style); return !slotOff(s) && !slotClip(s) && !s.url && !(s.gen && s.gen.status === 'drawing') && promptFor(b); })
      .map((b) => ({ id: b.id, prompt: promptFor(b) }));
    if (!targets.length) return res.status(400).json({ error: 'every beat with words already has its picture' });
    const ids = new Set(targets.map((t) => t.id));
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      cur.forEach((b) => {
        if (ids.has(b.id)) artSlot(b, style, true).gen = { status: 'drawing', prompt: promptFor(b), quality, character, at: Date.now() };
      });
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    (async () => {
      const queue = targets.slice();
      await Promise.all(Array.from({ length: 2 }, async () => {
        while (queue.length) {
          const t = queue.shift();
          await runArtJob(pid, t.id, { prompt: t.prompt, quality, character, style, shape: pad.shape });
        }
      }));
    })();
    res.json({ ok: true, count: targets.length, beats });
  } catch (e) { fail(res, e); }
});

router.post('/generate', async (req, res) => {
  try {
    const pid = padIdOf(req);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not set' });
    const id = String(req.body.id || '');
    const prompt = String(req.body.prompt || '').trim();
    if (!id) return res.status(400).json({ error: 'beat id required' });
    if (!prompt) return res.status(400).json({ error: 'say what to draw first' });
    const quality = ART.qualities.includes(req.body.quality) ? req.body.quality : ART.quality;
    const style = styleOf(req);
    // Sophie's character card rides along unless explicitly turned off —
    // and never on a style with its own reference (the Playground's
    // noCharacter rule: her card is the watercolor look, wrong there).
    const character = style !== 'watercolor' ? false : (req.body.character === false ? false : true);
    // The STORY'S OWN characters she picked for this draw (2026-08-26) —
    // resolved against the pad's cast, in its order, deduped and capped; an
    // id the story doesn't know is dropped rather than failing the draw.
    // They ride EVERY style, unlike the Sophie card above.
    // Read once: the cast she picked for this draw AND the story's canvas
    // both come off the pad, and asking twice is a second Firestore read for
    // one document.
    const pad = await readPad(pid);
    const picked = Array.isArray(req.body.characters) && req.body.characters.length
      ? pickCharacters(pad.characters, req.body.characters)
      : [];
    const beats = await patchBeat(pid, id, (b) => {
      const slot = artSlot(b, style, true);
      if (slotClip(slot)) throw new Error('nothing draws a clip');
      slot.gen = { status: 'drawing', prompt, quality, character, at: Date.now(),
        ...(picked.length ? { characters: picked.map((c) => c.name || '') } : {}) };
      // Art here again un-deletes this side (see `off` above).
      delete slot.off;
    });
    runArtJob(pid, id, { prompt, quality, character, style, chars: picked, shape: pad.shape });   // fire and forget
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// Her OWN reading of a beat's words (the popup's mic icon): stored on the
// beat as voiceUrl, and it beats TTS everywhere — the caption and speech
// icon play the recording when one exists. EVERY take is kept in
// beat.voiceTakes (Sophie's rule — re-recording never deletes a take);
// voiceUrl is simply the latest. audio:null clears voiceUrl back to TTS
// (the takes stay).
router.post('/voice', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    let url = null;
    if (req.body.audio !== null && req.body.audio !== undefined) {
      // iOS reports recordings as e.g. "audio/mp4;codecs=mp4a.40.2" — the
      // mime can carry params before ";base64", so match them (this exact
      // regex rejecting params is what silently ate her first take).
      const m = String(req.body.audio).match(/^data:(audio\/[\w.+-]+)(?:;[^,]*?)?;base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'audio must be an audio data URL (or null to clear)' });
      const ext = m[1].includes('mp4') ? 'm4a' : (m[1].includes('webm') ? 'webm' : 'audio');
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length) return res.status(400).json({ error: 'empty recording' });
      const bucket = admin.storage().bucket();
      const dest = `scratchpad/voice/${id}-${Date.now()}.${ext}`;
      const tmp = path.join(os.tmpdir(), `spv-${id}.${ext}`);
      fs.writeFileSync(tmp, buf);
      await bucket.upload(tmp, { destination: dest, metadata: { contentType: m[1] } });
      await bucket.file(dest).makePublic();
      fs.unlink(tmp, () => {});
      url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    }
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      if (url) {
        b.voiceUrl = url; b.voiceAt = Date.now();
        b.voiceTakes = (b.voiceTakes || []).concat([{ url, at: b.voiceAt }]);
      } else { delete b.voiceUrl; delete b.voiceAt; }
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, url, beats });
  } catch (e) { fail(res, e); }
});

// ── Render the film ─────────────────────────────────────────────────
// Every beat with art is its own shot, with its OWN audio — her recording
// first, else the line's TTS, else FILM.silent of quiet — held for exactly
// that audio's length. Hard cuts. CHUNKS ARE DISPLAY-ONLY (Sophie, Aug
// 2026): the shared frame is for reading the pad, and the film treats the
// members as ordinary beats — the first cut that merged a chunk's audio
// swallowed every member's recording but the first. Background job: the
// POST returns at once, the page polls the pad, leaving the app loses
// nothing. Every render is kept, so an old cut is never overwritten.

// ── CANCELING A RENDER (Aug 2026, Sophie: "add a cancel button to the play
// which makes the film button in story room") ───────────────────────────
// The film is FREE — ffmpeg on our own box — but it is not fast: a long story
// is minutes of encoding, and until now the only way out was to wait it out
// with the play button greyed the whole time. A job registers a token here;
// POST /film/cancel flips it and kills the ffmpeg the job is inside.
//
// TWO RULES, and both are about the doc never lying about the render:
//   • Every write the job makes goes through `beat()`/the canceled checks, so
//     a progress heartbeat can never re-stamp 'making' over her cancel.
//   • The job re-stamps 'canceled' on its way out, AFTER the child is dead —
//     which closes the one race left, a heartbeat already in flight when she
//     tapped. Nothing else can be writing the field by then.
// Nothing is deleted: a cancel leaves the pad exactly as it was, and the next
// tap on play starts a fresh render.
const filmJobs = new Map();   // padId → { canceled, child }
function cancelError() { const e = new Error('canceled'); e.canceled = true; return e; }

// ONE SHOT MADE OF A FILM CLIP. The clip passes through WHOLE — its own
// pictures, its own sound, its own length — normalized onto the film's
// canvas (the same scale+pad+fps+sar chain Assembly uses, which is what makes
// the concat-copy join safe beside the still segments). Its audio is taken
// from the SEGMENT's real encoded length, so the sample-exact wav concat can
// never walk off the picture.
//
// Deliberately NOT segment-cached, unlike a still: a still's segment is the
// whole shot, while a clip's audio has to come off the source anyway, so a
// cache would save the encode and still pay the download. Clips here are
// short by construction (they come off the Chunking shelf).
// `beat` here is the shot's ART SLOT (the beat root for watercolor, the
// dreamy slot under dreamy) — it carries the clip's url/title either way.
// `size` is the STORY's film frame ({w,h} off shapeOf) — a clip is normalized
// onto the same canvas as the stills or the concat-copy join is not safe.
async function clipSegment(dir, u, beat, job = null, size = FILM) {
  const src = path.join(dir, `c${u}-src`);
  await fetchTo(beat.url, src);
  const { hasVideo, hasAudio } = await probeStreams(src);
  if (!hasVideo) throw new Error(`"${beat.title || 'a clip'}" has no video in it`);
  const seg = path.join(dir, `s${u}-clip.mp4`);
  await run(FFMPEG, ['-y', '-i', src, '-an',
    '-vf', `scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease,pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2:color=white,fps=${FILM.fps},setsar=1,format=yuv420p`,
    '-threads', '1', '-x264opts', 'ref=1:rc-lookahead=12',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', seg], 900000, job);
  const seconds = await mediaSeconds(seg);
  if (!seconds) throw new Error(`"${beat.title || 'a clip'}" encoded to nothing`);
  const wav = path.join(dir, `a${u}.wav`);
  if (hasAudio) {
    await run(FFMPEG, ['-y', '-i', src, '-vn', '-af', 'apad', '-t', seconds.toFixed(3),
      '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', wav], 600000, job);
  } else {
    await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', seconds.toFixed(3), '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', wav], 600000, job);
  }
  fs.rmSync(src, { force: true });   // one source on disk at a time
  return { seg, wav, seconds, hasAudio };
}

async function runFilmJob(padId) {
  // EVERYTHING fallible lives inside the try — measured 2026-08-24: with
  // mkdtempSync on this line, a throw here (a full disk, an unwritable tmp)
  // rejects the fire-and-forget promise with no catch anywhere, which under
  // Node's default crashes the WHOLE process: the doc wedges on 'making'
  // with no progress, the sweep later stamps it "interrupted by a server
  // restart", and the restart was this job's own doing. Every pad's render
  // had been dying this shape for days with nothing to say why.
  let dir = null;
  const clean = () => { try { if (dir) fs.rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ } };
  // The cancel token. `stop()` is the checkpoint — called before every
  // expensive step, so a cancel that arrives between two encodes still ends
  // the job — and `beat()` is the only way this job writes progress, so a
  // heartbeat can never re-stamp 'making' over her cancel.
  const job = { canceled: false, child: null };
  filmJobs.set(padId, job);
  const stop = () => { if (job.canceled) throw cancelError(); };
  const beat = (progress) => (job.canceled ? Promise.resolve()
    : padRef(padId).set({ film: { status: 'making', at: Date.now(), progress } }, { merge: true }).catch(() => {}));
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spfilm-'));
    if (!FFMPEG || !FFPROBE) throw new Error('ffmpeg is not available on this server');
    const pad = await readPad(padId);
    // The film is the SIDE the story is showing: the toggled style's art
    // AND its clips (both live in the slot). A beat with nothing in this
    // style is simply not a shot — same as a blank beat always was.
    const style = pad.style;
    // The film's frame is the STORY's shape (see THE STORY'S SHAPE) — every
    // shot, still or clip, is normalized onto it, so the concat-copy join
    // stays safe and a picture drawn in the other shape is letterboxed on
    // white rather than cropped.
    const frame = shapeOf(pad).film;
    const shots = pad.beats.filter((b) => artSlot(b, style).url);
    if (!shots.length) throw new Error('draw some art first — the film is made of the pictures and clips');

    const segs = [];      // { file } per picture
    const auds = [];      // { file, seconds } per shot
    const notes = [];     // which audio each shot used — the render's receipt
    let total = 0;
    for (let u = 0; u < shots.length; u++) {
      stop();
      const lead = shots[u];
      const slot = artSlot(lead, style);
      // A FILM CLIP is its own shot, whole: its pictures, its sound, its
      // length. No TTS — reading its note aloud would talk over the tape.
      if (slotClip(slot)) {
        const cut = await clipSegment(dir, u, slot, job, frame);
        segs.push(cut.seg);
        auds.push(cut.wav);
        total += cut.seconds;
        notes.push(`shot ${u + 1}: clip ${cut.hasAudio ? 'with its own sound' : 'silent'} ${cut.seconds.toFixed(1)}s`);
        await beat(`clip ${segs.length}`);
        continue;
      }
      // The shot's voice: her take wins; then the line read aloud; else quiet.
      let audio = lead.voiceUrl || null;
      let audioKind = audio ? 'her voice' : 'quiet';
      if (!audio && String(lead.text || '').trim()) {
        try { audio = await ttsFor(padId, lead); if (audio) audioKind = 'tts'; }
        catch (e) { console.warn('film tts:', e.message); }
      }

      let seconds = FILM.silent;
      // The per-unit audio is PCM, not aac: concatenating aac adds a few ms of
      // encoder priming to EVERY file, and across a long story that drift
      // walks the voice out from under the pictures (measured: ~24ms per two
      // units). WAV concatenates sample-exact, and the whole track is encoded
      // once at the mux.
      const aFile = path.join(dir, `a${u}.wav`);
      if (audio) {
        const raw = await fetchTo(audio, path.join(dir, `a${u}-raw`));
        // DECODE FIRST, MEASURE THE WAV. iOS MediaRecorder writes fragmented
        // mp4 whose duration is NOT in the metadata, so probing the raw file
        // returned 0 — her recordings were treated as silent 2s holds and her
        // voice never made the film (Sophie caught it by the timing pattern).
        // A decoded WAV's duration is always exact, whatever the source was.
        const dec = path.join(dir, `a${u}-dec.wav`);
        await run(FFMPEG, ['-y', '-i', raw, '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', dec], 300000, job);
        const spoken = await mediaSeconds(dec);
        if (!spoken) throw new Error(`could not read the audio for unit ${u + 1}`);
        seconds = Math.max(FILM.min, spoken + FILM.tail);
        // Pad the tail with silence so a line never runs into the next picture.
        await run(FFMPEG, ['-y', '-i', dec, '-af', `apad=pad_dur=${FILM.tail + 0.05}`, '-t', seconds.toFixed(3),
          '-c:a', 'pcm_s16le', aFile], 300000, job);
      } else {
        await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', seconds.toFixed(3), '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', aFile], 300000, job);
      }
      seconds = (await mediaSeconds(aFile)) || seconds;
      notes.push(`shot ${u + 1}: ${audioKind} ${seconds.toFixed(1)}s`);
      auds.push(aFile);
      total += seconds;

      // One picture per shot, held for its whole audio — the active style's.
      const pics = [{ url: slot.url }];
      const each = seconds;
      for (let p = 0; p < pics.length; p++) {
        stop();
        const seg = path.join(dir, `s${u}-${p}.mp4`);
        // The SEGMENT CACHE — the whole reason a re-render is fast. Encoding
        // stills into h264 is the only part of a film that burns this
        // server's own (small) CPU, and a beat that didn't change encodes to
        // identical bytes: same picture, same length, same recipe. So each
        // segment is banked by that key, and a tweaked story only re-encodes
        // the beats the tweak touched; everything else is a small download.
        // Bump FILM.segVersion whenever the encode recipe changes.
        const segKey = crypto.createHash('sha1')
          // The frame is IN the key, so a story flipped to square re-encodes
          // its shots rather than serving the portrait ones back out of the
          // cache — and flipping back finds them still banked.
          .update(`${FILM.segVersion}|${pics[p].url}|${each.toFixed(3)}|${frame.w}x${frame.h}@${FILM.fps}`).digest('hex');
        const cached = admin.storage().bucket().file(`scratchpad/film-cache/${segKey}.mp4`);
        let fromCache = false;
        try {
          if ((await cached.exists())[0]) { await cached.download({ destination: seg }); fromCache = true; }
        } catch { /* a cache miss is just an encode */ }
        if (!fromCache) {
          const img = await fetchTo(pics[p].url, path.join(dir, `i${u}-${p}`));
          await run(FFMPEG, ['-y', '-loop', '1', '-i', img, '-t', each.toFixed(3),
            '-vf', `scale=${frame.w}:${frame.h}:force_original_aspect_ratio=decrease,pad=${frame.w}:${frame.h}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p`,
            '-r', String(FILM.fps), '-threads', '1', '-x264opts', 'ref=1:rc-lookahead=12',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', seg], 600000, job);
          try { await admin.storage().bucket().upload(seg, { destination: `scratchpad/film-cache/${segKey}.mp4`, metadata: { contentType: 'video/mp4' } }); }
          catch (e) { console.warn('film seg-cache save:', e.message); }
        }
        segs.push(seg);
        // Progress heartbeat: the page shows it, and refreshing `at` means the
        // stuck-job sweep measures STALLED time, not total time — a long story
        // that is genuinely moving is never mistaken for a zombie.
        await beat(`picture ${segs.length}`);
      }
    }

    stop();
    const vList = path.join(dir, 'v.txt');
    fs.writeFileSync(vList, segs.map((f) => `file '${f}'`).join('\n'));
    const silentFilm = path.join(dir, 'v.mp4');
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', vList, '-c', 'copy', silentFilm], 600000, job);

    const aList = path.join(dir, 'a.txt');
    fs.writeFileSync(aList, auds.map((f) => `file '${f}'`).join('\n'));
    const track = path.join(dir, 'a.wav');
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', aList, '-c', 'copy', track], 600000, job);

    const out = path.join(dir, 'film.mp4');
    await run(FFMPEG, ['-y', '-i', silentFilm, '-i', track, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart', out], 600000, job);

    // The LAST checkpoint: past here the film exists and the upload is cheap
    // compared with what it took to get here, so a cancel arriving now still
    // stops before anything is written onto her story.
    stop();
    const bucket = admin.storage().bucket();
    const dest = `scratchpad/films/${padId}-${Date.now()}.mp4`;
    await bucket.upload(out, { destination: dest, metadata: { contentType: 'video/mp4' } });
    await bucket.file(dest).makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    const seconds = Math.round(await mediaSeconds(out)) || Math.round(total);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(padId));
      const v = snap.exists ? snap.data() : {};
      const films = Array.isArray(v.films) ? v.films : [];
      const prev = v.film && v.film.url ? [{ url: v.film.url, at: v.film.at, seconds: v.film.seconds, style: v.film.style || 'watercolor' }] : [];
      tx.set(padRef(padId), {
        // `style` on the record is how the page knows a watercolor render is
        // not the dreamy film — the toggle never bumps updatedAt, so this is
        // the freshness signal across a flip.
        film: { status: 'done', url, seconds, at: Date.now(), pictures: segs.length, notes, style },
        films: prev.concat(films).slice(0, 12),   // older cuts are kept, never overwritten
        updatedAt: Date.now(),
      }, { merge: true });
    });
  } catch (err) {
    // A CANCEL IS NOT A FAILURE. She stopped it on purpose, so it must never
    // read as "the film failed" — and the killed ffmpeg's own error is the
    // shape the cancel takes, so both are answered here. The re-stamp is the
    // race-closer described up at filmJobs: a heartbeat already in flight when
    // she tapped could have landed after the route wrote 'canceled', and by
    // now the child is dead and nothing else can write the field.
    if (job.canceled) {
      await padRef(padId).set({ film: { status: 'canceled', at: Date.now() } }, { merge: true }).catch(() => {});
    } else {
      console.warn('scratchpad film:', err.message);
      await padRef(padId).set({ film: { status: 'failed', error: String(err.message || err).slice(0, 300), at: Date.now() } }, { merge: true }).catch(() => {});
    }
  } finally {
    clean();
    if (filmJobs.get(padId) === job) filmJobs.delete(padId);
  }
}

router.post('/film', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const pad = await readPad(pid);
    if (!pad.beats.some((b) => artSlot(b, pad.style).url)) {
      return res.status(400).json({ error: 'draw some art first' });
    }
    await padRef(pid).set({ film: { status: 'making', at: Date.now() } }, { merge: true });
    // belt for the braces above: if the job ever rejects outside its own
    // catch again, stamp the doc instead of letting the rejection escape
    runFilmJob(pid).catch((e) => padRef(pid)
      .set({ film: { status: 'failed', error: String((e && e.message) || e).slice(0, 300), at: Date.now() } }, { merge: true })
      .catch(() => {}));   // fire and forget — the page polls the pad
    res.json({ ok: true, status: 'making' });
  } catch (e) { fail(res, e); }
});

// STOP THE RENDER. The token ends the job at its next checkpoint and killing
// the running ffmpeg makes that immediate; the DOC is stamped either way,
// because a render orphaned by a deploy has no token in THIS process and
// would otherwise sit on 'making' until the 15-minute sweep. Nothing is
// deleted and nothing is spent — the next tap on play starts a fresh render.
router.post('/film/cancel', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const job = filmJobs.get(pid);
    if (job) {
      job.canceled = true;
      if (job.child) { try { job.child.kill('SIGKILL'); } catch { /* already gone */ } }
    }
    await padRef(pid).set({ film: { status: 'canceled', at: Date.now() } }, { merge: true });
    res.json({ ok: true, status: 'canceled', running: Boolean(job) });
  } catch (e) { fail(res, e); }
});

// Deploys restart the server mid-job and orphan in-flight work: a film stuck
// 'making' forever, a beat stuck 'drawing…' (happened for real — Sophie's
// first film died under the next deploy). No legitimate film or draw outlives
// 15 minutes, so sweep older ones into 'failed' at boot and on an interval.
async function sweepStuckJobs() {
  try {
    if (!admin.apps.length) return;
    const cutoff = Date.now() - 15 * 60 * 1000;
    const snap = await db().collection(COL).get();
    for (const d of snap.docs) {
      const v = d.data();
      const patch = {};
      if (v.film && v.film.status === 'making' && (v.film.at || 0) < cutoff) {
        patch.film = { status: 'failed', error: 'interrupted by a server restart — tap to make it again', at: Date.now() };
      }
      let beatsChanged = false;
      const beats = Array.isArray(v.beats) ? v.beats : [];
      beats.forEach((b) => {
        // EVERY art slot — a draw can be stuck on any side of the toggle.
        allSlots(b).forEach((slot) => {
          if (slot && slot.gen && slot.gen.status === 'drawing' && (slot.gen.at || 0) < cutoff) {
            slot.gen = { status: 'failed', error: 'interrupted by a server restart', at: Date.now() };
            beatsChanged = true;
          }
        });
      });
      if (beatsChanged) patch.beats = beats;
      if (Object.keys(patch).length) {
        await d.ref.set(patch, { merge: true });
        console.log(`scratchpad sweep: cleared stuck job(s) on ${d.id}`);
      }
    }
  } catch (e) { console.warn('scratchpad sweep:', e.message); }
}
setTimeout(sweepStuckJobs, 90 * 1000);
setInterval(sweepStuckJobs, 10 * 60 * 1000);

// ── Chunks: beats linked so they always travel together ─────────────
// A chunk is contiguous beats sharing a `chunk` id. On the pad it renders in
// ONE tile's width (the members as side-by-side slices in a shared frame),
// and placement slots only appear between units — never inside a chunk.
// Linking is unbounded: chunk with the next unit again and again (2, 3, 4…).
// Unlinking dissolves the WHOLE chunk back into single beats (predictable
// for any length). Colors apply chunk-wide (see /color).

function membersOf(beats, beat) {
  if (!beat.chunk) return [beat];
  return beats.filter((b) => b.chunk === beat.chunk);
}

// Link this beat's unit with the NEXT unit on the pad (they become one chunk).
router.post('/chunk', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      const mine = membersOf(cur, b);
      const lastIdx = cur.indexOf(mine[mine.length - 1]);
      const next = cur[lastIdx + 1];
      if (!next) throw new Error('nothing after this beat to link with');
      const theirs = membersOf(cur, next);
      const chunkId = b.chunk || next.chunk || db().collection(COL).doc().id;
      mine.concat(theirs).forEach((m) => { m.chunk = chunkId; });
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// Dissolve the whole chunk this beat belongs to.
router.post('/unchunk', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      membersOf(cur, b).forEach((m) => { delete m.chunk; });
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// The story's name — "Untitled" on the page until Sophie changes it.
router.post('/title', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const title = String(req.body.title ?? '').slice(0, 200).trim();
    await padRef(pid).set({ title, updatedAt: Date.now() }, { merge: true });
    res.json({ ok: true, title });
  } catch (e) { fail(res, e); }
});

// A beat's note as audio in Sophie's voice. Cached by the text itself
// (sha1 of voice|model|text → Storage scratchpad/tts/<hash>.mp3), so
// replaying costs nothing and an edited note renders fresh on next play.
// Her line in her voice, cached by the text itself — the film reuses this,
// so rendering a film costs nothing for lines that have already been heard.
// Returns the url, or null when the beat has no words.
async function ttsFor(padId, beat) {
  const text = String((beat && beat.text) || '').trim();
  if (!text) return null;
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is not set');
    // Settings ride in the cache key so a changed voice mode (Natural →
    // Robust) re-renders existing notes instead of replaying the old sound.
    const hash = crypto.createHash('sha1')
      .update(`${TTS_VOICE_ID}|${TTS_MODEL}|s${TTS_SETTINGS.stability}|${text}`).digest('hex');
    if (beat.ttsHash === hash && beat.ttsUrl) return beat.ttsUrl;

    const bucket = admin.storage().bucket();
    const dest = `scratchpad/tts/${hash}.mp3`;
    const file = bucket.file(dest);
    let url;
    if ((await file.exists())[0]) {
      url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    } else {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_ID}?output_format=mp3_44100_192`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: TTS_SETTINGS }),
        timeout: 120000,
      });
      if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const audio = await r.buffer();
      if (!audio.length) throw new Error('ElevenLabs returned empty audio');
      const tmp = path.join(os.tmpdir(), `sp-${hash}.mp3`);
      fs.writeFileSync(tmp, audio);
      await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'audio/mpeg' } });
      await file.makePublic();
      fs.unlink(tmp, () => {});
      url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    }

    await patchBeat(padId, beat.id, (b) => { b.ttsUrl = url; b.ttsHash = hash; }).catch(() => {});
  return url;
}

router.post('/tts', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const pad = await readPad(pid);
    const beat = pad.beats.find((b) => b.id === id);
    if (!beat) return res.status(404).json({ error: 'no such beat' });
    if (!String(beat.text || '').trim()) return res.status(400).json({ error: 'this beat has no words yet' });
    const url = await ttsFor(pid, beat);
    res.json({ ok: true, url });
  } catch (e) { fail(res, e); }
});

router.post('/text', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const text = String(req.body.text ?? '').slice(0, 5000);
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      b.text = text;
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// The beat's DRAWING PROMPT — what its picture is asked for, apart from what
// the film says. Saved automatically by the page (no save button, Sophie's
// rule): the draw box POSTs here on blur/close/draw. A prompt that matches
// the words' own drawable form is stored as NOTHING — the beat keeps
// following its words, so editing the note later still updates what draws.
router.post('/prompt', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const prompt = String(req.body.prompt ?? '').slice(0, 5000).trim();
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      if (!prompt || prompt === drawablePrompt(b.text)) delete b.prompt;
      else b.prompt = prompt;
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

router.post('/color', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    const color = req.body.color === null ? null : String(req.body.color || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    if (color !== null && !COLORS.includes(color)) {
      return res.status(400).json({ error: `color must be one of ${COLORS.join('/')} or null` });
    }
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      // A chunk shares one frame, so it shares one color.
      membersOf(cur, b).forEach((m) => { m.color = color; });
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// Attach an already-hosted recording to a beat as its voice — the Cutting
// Room's hand-off. Same contract as POST /voice: voiceUrl is the latest,
// EVERY take is kept in voiceTakes (Sophie's rule), nothing is deleted.
async function attachVoiceUrl(padId, beatId, url) {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(padRef(padId));
    const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
    const b = cur.find((x) => x.id === beatId);
    if (!b) throw new Error('no such beat');
    b.voiceUrl = url; b.voiceAt = Date.now();
    b.voiceTakes = (b.voiceTakes || []).concat([{ url, at: b.voiceAt }]);
    tx.set(padRef(padId), { beats: cur, updatedAt: Date.now() }, { merge: true });
    return b;
  });
}

module.exports = { router, init, attachVoiceUrl, placeOnBeat, autoShapePatch, drawablePrompt, promptFor, clipsNeedingPoster };

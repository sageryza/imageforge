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
//   POST /add            → { url, at?, src? } — insert a beat at index `at`
//                          (default: the end); returns { beats }
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
//   POST /style          → { style:'watercolor'|'dreamy' } — which art set
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
const refCache = {};
function artRef(file) {
  if (!refCache[file]) refCache[file] = fs.readFileSync(path.join(__dirname, 'refs', file));
  return refCache[file];
}

// ── The STYLE TOGGLE: watercolor ↔ dreamy (Aug 2026, Sophie: "I want to
// have the same beats but I wanna fill them with new art … a style toggle at
// the top of a story that alternates between dreamy and watercolor").
// One story, TWO sets of art over the SAME beats: the words, colors, voice
// takes and order are shared; only the pictures differ. "watercolor" is the
// pad's original look (sage sandy mirror — the fields already on the beat,
// so nothing that exists migrates or moves), and "dreamy" keeps its art in
// a parallel slot, `beat.alt.dreamy` ({url, src, gen, imageHistory}), empty
// until she fills it. `pad.style` remembers which side the story is showing;
// requests that touch ART carry `style` so a stale page can never draw into
// the wrong side. A CLIP is per-style TOO (2026-08-23, Sophie, after movies
// she added on the dreamy side showed up on watercolor: "The beats should be
// added, but the Art should not") — a slot holds a picture OR a clip
// (kind:'clip' + poster/seconds/title/clipId on the slot), so a movie placed
// under dreamy leaves the watercolor side exactly as it was.
const STYLES = ['watercolor', 'dreamy'];
const styleOf = (req) => {
  const s = String((req.body && req.body.style) || req.query.style || '');
  return s === 'dreamy' ? 'dreamy' : 'watercolor';
};
// The object holding a beat's art for a style. For watercolor it IS the beat
// (url/src/gen/imageHistory live at the root, exactly as they always have);
// for dreamy it is beat.alt.dreamy, created on first write.
function artSlot(b, style, make) {
  if (style !== 'dreamy') return b;
  if (make) { b.alt = b.alt || {}; b.alt.dreamy = b.alt.dreamy || {}; }
  return (b.alt && b.alt.dreamy) || {};
}
const otherStyle = (style) => (style === 'dreamy' ? 'watercolor' : 'dreamy');
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

// DREAMY's recipe is the Playground's Dreamy tile — refs/dream-mystery.jpg
// with HER OWN dictated prefix and suffix (2026-08-22), bookending her words
// exactly as the Playground sends them (prefix\n\nwords\n\nsuffix). These two
// strings are COPIES of PL_GPT_STYLES.dreamy.prefix/.suffix in server.js —
// keep them identical (test-scratchpad-style.js pins the pair). No Sophie
// character card: hers is the watercolor look, the wrong reference here.
const DREAMY = {
  styleFile: 'dream-mystery.jpg',
  prefix: 'The FIRST attached image is a STYLE reference — copy its drawing style ' +
    'but do NOT copy its content, subjects, or composition.',
  suffix: 'Render as ONE single illustration — NOT a grid, NOT split panels. ' +
    'Draw it inside a hand-drawn border, like the frames in the style ' +
    'reference. no text. Again: the attached image is a STYLE reference ' +
    'only — do not draw its content, its subjects or its composition.',
};

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
    film: v.film || null, films: Array.isArray(v.films) ? v.films : [],
    inbox: Array.isArray(v.inbox) ? v.inbox : null,
    // Photos and movies she added straight off her phone (POST /upload) —
    // they ride the add sheet beside the inbox, waiting to be placed.
    uploads: Array.isArray(v.uploads) ? v.uploads : [],
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
      const faceOf = (b) => slotFace(artSlot(b, style))
        || slotFace(b) || slotFace((b.alt && b.alt.dreamy) || null);
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
    const ref = db().collection(COL).doc();
    await ref.set({ title, beats: [], updatedAt: Date.now(), ...(folder ? { folder } : {}) });
    res.json({ ok: true, pad: ref.id, title, folder: folder || null });
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

// Which shelf chip a story answers to (personal / lessons / nde). Set by the
// seed script or a chat — the page files a story with none under Personal, so
// a brand-new story is never invisible. Deliberately does NOT bump updatedAt:
// filing a story must not reshuffle the shelf's newest-first order.
router.post('/pads/category', async (req, res) => {
  try {
    const pid = String(req.body.pad || '').trim();
    if (!pid) return res.status(400).json({ error: 'pad required' });
    const category = String(req.body.category || '').toLowerCase().slice(0, 24).trim();
    await padRef(pid).set({ category: category || null }, { merge: true });
    res.json({ ok: true, pad: pid, category: category || null });
  } catch (e) { fail(res, e); }
});

// PINNED TO THE TOP OF THE SHELF (Aug 2026, Sophie: "a pinning feature where i
// can pin a couple stories i'm actively working on and the rest go behind a see
// more toggle"). Nothing to do with /cover, which pins a story's FACE — this is
// which stories lead the shelf. Absent means unpinned, so a story is never
// hidden behind the fold by a field nobody set. Like /category, deliberately
// does NOT bump updatedAt: pinning is not an edit to the story.
router.post('/pads/pin', async (req, res) => {
  try {
    const pid = String(req.body.pad || '').trim();
    if (!pid) return res.status(400).json({ error: 'pad required' });
    const pinned = req.body.pinned === true || req.body.pinned === 'true';
    await padRef(pid).set({ pinned }, { merge: true });
    res.json({ ok: true, pad: pid, pinned });
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

// The inbox. A story that carries its OWN inbox shows that instead of the
// Playground hearts (Aug 2026, Sophie): the art a story already has —
// gathered from the chats that made it — is what she wants to place on the
// timeline, not whatever she last hearted in the Playground. A pad with no
// inbox of its own behaves exactly as before, so nothing that exists breaks.
router.get('/inbox', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const padData = await readPad(padIdOf(req));
    // Her phone uploads ride along whichever inbox this story shows — the
    // add sheet draws them at the top, waiting to be placed.
    const uploads = padData.uploads;
    const own = padData.inbox;
    if (own && own.length) {
      return res.json({ count: own.length, items: own, source: 'story', uploads });
    }
    const q = await db().collection(PROMPTLAB)
      .orderBy('createdAt', 'desc').limit(300).get();
    const items = [];
    q.docs.forEach((s) => {
      const d = s.data();
      const votes = d.votes || {};
      (d.images || []).forEach((url, i) => {
        if (votes[i] !== 'like' || !url) return;
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
    const style = styleOf(req);
    const beat = {
      id: db().collection(COL).doc().id, url: null, color: null, src: null,
      addedAt: Date.now(),
    };
    // A picture placed while the story shows DREAMY lands in the dreamy slot;
    // the watercolor side of the new beat stays blank (and vice versa).
    if (url) { const slot = artSlot(beat, style, true); slot.url = url; slot.src = src; }
    // Single-user tool, but the read-modify-write still goes through a
    // transaction so two quick adds can't drop each other.
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      let at = Number(req.body.at);
      if (!Number.isInteger(at) || at < 0 || at > cur.length) at = cur.length;
      cur.splice(at, 0, beat);
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beat, beats });
  } catch (e) { fail(res, e); }
});

// Give an EXISTING beat its picture — the empty-beat popup's inbox path
// (choosing from there fills THAT beat instead of adding a new one).
router.post('/image', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const id = String(req.body.id || '');
    const url = String(req.body.url || '').trim();
    if (!id) return res.status(400).json({ error: 'beat id required' });
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'image url required' });
    const src = (req.body.src && typeof req.body.src === 'object') ? req.body.src : null;
    const style = styleOf(req);
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      const slot = artSlot(b, style, true);
      // Swapping a picture into a clip SLOT makes that side a picture again —
      // leaving `kind` behind would render an image url as a film. Only this
      // side: the other style's clip (or picture) is untouched. swapArt owns
      // that, the history bookkeeping, and the provenance — this route is
      // both a fresh pick from the inbox AND her picking an older version
      // back off the past-pictures row, and they must behave identically.
      swapArt(slot, url, src);
      tx.set(padRef(pid), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
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
// onto both sides, two of them OVER existing watercolor panels.
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
async function runArtJob(padId, id, { prompt, quality, character, style }) {
  const dreamy = style === 'dreamy';
  try {
    // DREAMY draws the Playground Dreamy recipe: dream-mystery as the one
    // reference, her dictated prefix and suffix bookending the words, and
    // never the Sophie card (see the STYLE TOGGLE block). Watercolor is the
    // pad's original recipe, byte-for-byte.
    const refs = [artRef(dreamy ? DREAMY.styleFile : ART.styleFile)];
    if (!dreamy && character) refs.push(artRef(ART.characterFile));
    const full = dreamy
      ? `${DREAMY.prefix}\n\n${prompt}\n\n${DREAMY.suffix}`
      : `${ART.prefix}${character ? ART.characterLine : ''}\n\n${prompt}`;
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', full);
    form.append('size', ART.size);
    form.append('quality', quality);
    form.append('output_format', 'webp');
    // NO output_compression — it is lossy, OpenAI applies it before the bytes
    // come back, and every beat's art here is a KEPT original (superseded art
    // goes to beat.imageHistory rather than being deleted). See
    // scripts/test-no-generation-compression.js.
    // dream-mystery is a JPEG — declare each ref as what it actually is.
    const jpeg = dreamy;
    refs.forEach((b, i) => form.append('image[]', b, {
      filename: `ref${i + 1}.${i === 0 && jpeg ? 'jpg' : 'png'}`,
      contentType: i === 0 && jpeg ? 'image/jpeg' : 'image/png',
    }));
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
    const bucket = admin.storage().bucket();
    const dest = `scratchpad/art/${id}-${Date.now()}.webp`;
    const tmp = path.join(os.tmpdir(), `spa-${id}.webp`);
    fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
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
        character: Boolean(character) && !dreamy, style: dreamy ? 'dreamy' : 'watercolor', promptUsed: full,
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
        body: JSON.stringify({ url, prompt, style: `Scratch Pad · ${dreamy ? 'dreamy · ' : ''}${quality}`,
          fullPrompt: full,
          promptPrefix: dreamy ? DREAMY.prefix : `${ART.prefix}${character && !dreamy ? ART.characterLine : ''}`,
          promptSuffix: dreamy ? DREAMY.suffix : '' }),
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

      if (artSlot(b, otherStyle(style)).url) {
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
    const character = style !== 'dreamy';   // dreamy never takes the Sophie card
    const pad = await readPad(pid);
    // "Missing" is per STYLE: a beat whose watercolor is drawn but whose
    // dreamy slot is empty is exactly what the toggle exists to fill — and a
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
          await runArtJob(pid, t.id, { prompt: t.prompt, quality, character, style });
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
    // and never on dreamy (the Playground's noCharacter rule: her card is
    // the watercolor look, the wrong reference there).
    const character = style === 'dreamy' ? false : (req.body.character === false ? false : true);
    const beats = await patchBeat(pid, id, (b) => {
      const slot = artSlot(b, style, true);
      if (slotClip(slot)) throw new Error('nothing draws a clip');
      slot.gen = { status: 'drawing', prompt, quality, character, at: Date.now() };
      // Art here again un-deletes this side (see `off` above).
      delete slot.off;
    });
    runArtJob(pid, id, { prompt, quality, character, style });   // fire and forget
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
async function clipSegment(dir, u, beat, job = null) {
  const src = path.join(dir, `c${u}-src`);
  await fetchTo(beat.url, src);
  const { hasVideo, hasAudio } = await probeStreams(src);
  if (!hasVideo) throw new Error(`"${beat.title || 'a clip'}" has no video in it`);
  const seg = path.join(dir, `s${u}-clip.mp4`);
  await run(FFMPEG, ['-y', '-i', src, '-an',
    '-vf', `scale=${FILM.w}:${FILM.h}:force_original_aspect_ratio=decrease,pad=${FILM.w}:${FILM.h}:(ow-iw)/2:(oh-ih)/2:color=white,fps=${FILM.fps},setsar=1,format=yuv420p`,
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
        const cut = await clipSegment(dir, u, slot, job);
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
          .update(`${FILM.segVersion}|${pics[p].url}|${each.toFixed(3)}|${FILM.w}x${FILM.h}@${FILM.fps}`).digest('hex');
        const cached = admin.storage().bucket().file(`scratchpad/film-cache/${segKey}.mp4`);
        let fromCache = false;
        try {
          if ((await cached.exists())[0]) { await cached.download({ destination: seg }); fromCache = true; }
        } catch { /* a cache miss is just an encode */ }
        if (!fromCache) {
          const img = await fetchTo(pics[p].url, path.join(dir, `i${u}-${p}`));
          await run(FFMPEG, ['-y', '-loop', '1', '-i', img, '-t', each.toFixed(3),
            '-vf', `scale=${FILM.w}:${FILM.h}:force_original_aspect_ratio=decrease,pad=${FILM.w}:${FILM.h}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p`,
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
        // Both art slots — a draw can be stuck on either side of the toggle.
        [b, b.alt && b.alt.dreamy].forEach((slot) => {
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

module.exports = { router, attachVoiceUrl, drawablePrompt, promptFor, clipsNeedingPoster };

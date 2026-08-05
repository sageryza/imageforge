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
const COLORS = ['mustard', 'green', 'blue', 'pink'];

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
  styleFile: 'evan-film-style.png',
  characterFile: 'sophie-character.png',
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

// ── The film ────────────────────────────────────────────────────────
// The pad already knows how long every picture should be on screen: each
// beat's own audio says so — HER recording when she made one, otherwise the
// cached TTS of its line. So the film is pure ffmpeg (free, seconds, no
// video model): one segment per beat at its audio's real length, hard cuts,
// 2:3 portrait. A beat with no words holds for FILM.silent seconds. A chunk
// shares its audio, its members splitting that time equally — the animate-
// between-panels version of a chunk is the paid follow-up, not this.
const { execFile } = require('child_process');
const FILM = { w: 1080, h: 1620, fps: 24, tail: 0.35, silent: 2.0, min: 0.6 };
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

function run(bin, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
  });
}
async function mediaSeconds(file) {
  if (!FFPROBE) return 0;
  try {
    const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 60000);
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
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
    film: v.film || null, films: Array.isArray(v.films) ? v.films : [],
  };
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

router.get('/', async (req, res) => {
  try {
    const pid = padIdOf(req);
    res.set('Cache-Control', 'no-store');
    res.json({ ...(await readPad(pid)), pad: pid });
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
      const withArt = beats.find((b) => b.url);
      return {
        id: d.id, title: v.title || '', beats: beats.length,
        cover: withArt ? withArt.url : null, updatedAt: v.updatedAt || 0,
      };
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ count: pads.length, pads });
  } catch (e) { fail(res, e); }
});

router.post('/pads', async (req, res) => {
  try {
    const title = String(req.body.title || '').slice(0, 200).trim();
    const ref = db().collection(COL).doc();
    await ref.set({ title, beats: [], updatedAt: Date.now() });
    res.json({ ok: true, pad: ref.id, title });
  } catch (e) { fail(res, e); }
});

// The inbox: every Playground image Sophie hearted, newest run first. Votes
// live on the run docs, so this is a pure read — nothing is copied anywhere.
router.get('/inbox', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
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
    res.json({ count: items.length, items });
  } catch (e) { fail(res, e); }
});

router.post('/add', async (req, res) => {
  try {
    const pid = padIdOf(req);
    // No url = an EMPTY beat (blank tile; its art comes later).
    const url = String(req.body.url || '').trim();
    if (url && !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'image url must be http(s)' });
    const src = (req.body.src && typeof req.body.src === 'object') ? req.body.src : null;
    const beat = {
      id: db().collection(COL).doc().id, url: url || null, color: null, src,
      addedAt: Date.now(),
    };
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
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef(pid));
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      b.url = url;
      if (src) b.src = src;
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
async function runArtJob(padId, id, { prompt, quality, character }) {
  try {
    const refs = [artRef(ART.styleFile)];
    if (character) refs.push(artRef(ART.characterFile));
    const full = `${ART.prefix}${character ? ART.characterLine : ''}\n\n${prompt}`;
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', full);
    form.append('size', ART.size);
    form.append('quality', quality);
    form.append('output_format', 'webp');
    form.append('output_compression', '80');
    refs.forEach((b, i) => form.append('image[]', b, { filename: `ref${i + 1}.png`, contentType: 'image/png' }));
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
      if (b.url && b.url !== url) b.imageHistory = (b.imageHistory || []).concat([{ url: b.url, at: Date.now() }]);
      b.url = url;
      b.src = { engine: 'gptimage', model: 'gpt-image-2', prompt, quality, character: Boolean(character), promptUsed: full };
      b.gen = { status: 'done', at: Date.now() };
    });
  } catch (err) {
    console.warn('scratchpad art:', err.message);
    await patchBeat(padId, id, (b) => { b.gen = { status: 'failed', error: String(err.message || err).slice(0, 300), at: Date.now() }; }).catch(() => {});
  }
}

router.post('/generate', async (req, res) => {
  try {
    const pid = padIdOf(req);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not set' });
    const id = String(req.body.id || '');
    const prompt = String(req.body.prompt || '').trim();
    if (!id) return res.status(400).json({ error: 'beat id required' });
    if (!prompt) return res.status(400).json({ error: 'say what to draw first' });
    const quality = ART.qualities.includes(req.body.quality) ? req.body.quality : ART.quality;
    // Sophie's character card rides along unless explicitly turned off.
    const character = req.body.character === false ? false : true;
    const beats = await patchBeat(pid, id, (b) => {
      b.gen = { status: 'drawing', prompt, quality, character, at: Date.now() };
    });
    runArtJob(pid, id, { prompt, quality, character });   // fire and forget
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
// Units in order (a chunk is one unit): each gets its audio's real length —
// her recording first, else the line's TTS, else FILM.silent of quiet — and
// the pictures hold for exactly that. Hard cuts. Background job: the POST
// returns at once, the page polls the pad, leaving the app loses nothing.
// Every render is kept, so an old cut is never overwritten.
function filmUnits(beats) {
  const units = [];
  for (let i = 0; i < beats.length;) {
    const b = beats[i];
    const members = [b];
    if (b.chunk) while (i + members.length < beats.length && beats[i + members.length].chunk === b.chunk) members.push(beats[i + members.length]);
    units.push(members);
    i += members.length;
  }
  return units;
}

async function runFilmJob(padId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spfilm-'));
  const clean = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ } };
  try {
    if (!FFMPEG || !FFPROBE) throw new Error('ffmpeg is not available on this server');
    const pad = await readPad(padId);
    const units = filmUnits(pad.beats).filter((m) => m.some((b) => b.url));
    if (!units.length) throw new Error('draw some art first — the film is made of the pictures');

    const segs = [];      // { file } per picture
    const auds = [];      // { file, seconds } per unit
    let total = 0;
    for (let u = 0; u < units.length; u++) {
      const members = units[u];
      const lead = members[0];
      // The unit's voice: her take wins; then the line read aloud; else quiet.
      let audio = lead.voiceUrl || null;
      if (!audio && String(lead.text || '').trim()) {
        try { audio = await ttsFor(padId, lead); } catch (e) { console.warn('film tts:', e.message); }
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
        const spoken = await mediaSeconds(raw);
        seconds = Math.max(FILM.min, (spoken || FILM.silent) + FILM.tail);
        // One rate/layout for every unit, with the tail padded in silence so a
        // line never runs into the next picture.
        await run(FFMPEG, ['-y', '-i', raw, '-af', `apad=pad_dur=${FILM.tail + 0.05}`, '-t', seconds.toFixed(3),
          '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', aFile]);
      } else {
        await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', seconds.toFixed(3), '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', aFile]);
      }
      seconds = (await mediaSeconds(aFile)) || seconds;
      auds.push(aFile);
      total += seconds;

      // The unit's pictures split its time (a lone beat simply gets all of it).
      const pics = members.filter((b) => b.url);
      const each = seconds / pics.length;
      for (let p = 0; p < pics.length; p++) {
        const img = await fetchTo(pics[p].url, path.join(dir, `i${u}-${p}`));
        const seg = path.join(dir, `s${u}-${p}.mp4`);
        await run(FFMPEG, ['-y', '-loop', '1', '-i', img, '-t', each.toFixed(3),
          '-vf', `scale=${FILM.w}:${FILM.h}:force_original_aspect_ratio=decrease,pad=${FILM.w}:${FILM.h}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p`,
          '-r', String(FILM.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', seg], 600000);
        segs.push(seg);
      }
    }

    const vList = path.join(dir, 'v.txt');
    fs.writeFileSync(vList, segs.map((f) => `file '${f}'`).join('\n'));
    const silentFilm = path.join(dir, 'v.mp4');
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', vList, '-c', 'copy', silentFilm], 600000);

    const aList = path.join(dir, 'a.txt');
    fs.writeFileSync(aList, auds.map((f) => `file '${f}'`).join('\n'));
    const track = path.join(dir, 'a.wav');
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', aList, '-c', 'copy', track], 600000);

    const out = path.join(dir, 'film.mp4');
    await run(FFMPEG, ['-y', '-i', silentFilm, '-i', track, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart', out], 600000);

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
      const prev = v.film && v.film.url ? [{ url: v.film.url, at: v.film.at, seconds: v.film.seconds }] : [];
      tx.set(padRef(padId), {
        film: { status: 'done', url, seconds, at: Date.now(), pictures: segs.length },
        films: prev.concat(films).slice(0, 12),   // older cuts are kept, never overwritten
        updatedAt: Date.now(),
      }, { merge: true });
    });
  } catch (err) {
    console.warn('scratchpad film:', err.message);
    await padRef(padId).set({ film: { status: 'failed', error: String(err.message || err).slice(0, 300), at: Date.now() } }, { merge: true }).catch(() => {});
  } finally { clean(); }
}

router.post('/film', async (req, res) => {
  try {
    const pid = padIdOf(req);
    const pad = await readPad(pid);
    if (!pad.beats.some((b) => b.url)) return res.status(400).json({ error: 'draw some art first' });
    await padRef(pid).set({ film: { status: 'making', at: Date.now() } }, { merge: true });
    runFilmJob(pid);   // fire and forget — the page polls the pad
    res.json({ ok: true, status: 'making' });
  } catch (e) { fail(res, e); }
});

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

module.exports = { router };

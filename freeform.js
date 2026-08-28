// Freeform — your own images, your own words, nothing added.
//
// Every other image surface in here wraps what you type in a house style: the
// Playground prepends a style prefix and attaches a fixed reference, the Scratch
// Pad locks one style per story, the passport paints pastel. This module is the
// one with NO opinion. You upload whatever reference images you want, you type
// whatever you want, you pick low/medium/high, and that is EXACTLY what goes to
// the model — no prefix, no suffix, no trigger word, no trailing-period trim.
// If the prompt should say something about style, you say it.
//
// ONE deliberate exception, and it is a BUTTON (2026-08-28, Sophie: "add a
// default boiler style not content prompt to freeform with a toggle on off
// button"). The BOILER style is a stock STYLE line — it says how a picture is
// drawn and never what is in it — appended after her words when the toggle is
// ON. It is OFF by default and not sticky, the page prints the exact text it
// adds while it is lit, and the run stores `promptSent` / `promptStyle` /
// `promptContent`, so nothing is ever added invisibly. With the toggle off
// this module is byte-for-byte the verbatim surface it has always been.
//
// That rule matters enough to be load-bearing: the "if you add anything to a
// prompt Sophie gave, tell her" rule in CLAUDE.md exists because a "plain" run
// once shipped with invented style language in it. Here there is nothing to
// disclose, because the module cannot add a word. `promptSent` is stored on
// every run so the page can prove it.
//
// Refs are a LIBRARY, not a per-run upload: an image you upload once can be
// attached to any later run (and to several at a time), because the whole point
// is trying the same references against different words.
//
// Rendering is a BACKGROUND JOB (house rule — nothing slow blocks a request):
// POST returns an id, the page polls and resumes on return, and the result is
// persisted so leaving the app never loses an image already paid for.
const express = require('express');
const admin = require('firebase-admin');
const { promptRecord, promptFields } = require('./prompt-record');

const router = express.Router();
const RUNS = 'forge-freeform';
const REFS = 'forge-freeform-refs';

// gpt-image-2's own sizes. Anything else is refused by the API, so the page
// picks from these three rather than accepting free text.
const SIZES = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024',
};
const QUALITIES = ['low', 'medium', 'high'];

// A render is fire-and-forget IN THIS PROCESS, so a deploy that swaps the
// instance out between "OpenAI answered" and "we saved it" leaves the doc on
// `drawing` forever — and the page polls a run that says that, so the card
// spins with nothing on screen ever admitting it is dead (found live
// 2026-08-28: a square run stuck two hours, which read as "freeform can't do
// squares"). A draw is 30-90s and every path stamps done/failed, so a run
// still unfinished after this long is orphaned, never slow. Judged on READ —
// there is no sweep to schedule and a restart cannot lose it.
const STUCK_MS = 15 * 60 * 1000;

// Pure, so the rule is testable without a Firestore. A run that already landed
// SOME images is `done` with what it has (`ready` means outputs were arriving);
// one with none is honestly failed. Returns null when nothing should change.
function stuckPatch(run, now = Date.now()) {
  const st = run && run.status;
  if (st !== 'drawing' && st !== 'ready') return null;
  if (now - (run.createdAt || 0) < STUCK_MS) return null;
  const images = Array.isArray(run.images) ? run.images : [];
  if (images.length) return { status: 'done', finishedAt: now };
  return { status: 'failed', error: 'interrupted — the server restarted mid-draw', finishedAt: now };
}
// Roughly what a single image costs at each tier — shown on the page so a
// `high` run is a deliberate choice rather than a surprise.
const COST = { low: 0.02, medium: 0.06, high: 0.25 };

// THE BOILERPLATE STYLE (her word: "boiler plate") — the one thing this module
// may add, and only on her tap.
//
// IT IS THE HOUSE TEXT, NOT A NEW ONE (2026-08-28, Sophie: "the text we use for
// dreamy or watercolor"). The first cut invented a style line, which is exactly
// the reconstruction this repo's exact-prompt rule forbids — and there was no
// need for one: the Playground already sends a settled style-reference recipe
// around her words. So this is `PL_GPT_STYLES.evan` — Sandy mirror, her scanned
// ink-and-watercolour page — HANDED IN at mount time (`init`, the movies.js
// pattern) rather than copied, because server.js owns what is actually sent and
// a second copy would drift the day she rewords one.
//
// WHY THAT ONE AND NOT DREAMY: this wording names "the attached style
// reference" and nothing else, so it travels onto whatever SHE has attached
// here. Dreamy's tail names its own picture (its hand-drawn frames, the woman
// in the green tank top) and would be nonsense over her references. Switching
// is one line — the style id below.
const BOILER_STYLE = 'evan';
const BOILER = { id: BOILER_STYLE, label: 'Boilerplate style', prefix: '', suffix: '' };

// ONE CLAUSE IS DROPPED HERE (2026-08-28, Sophie: "get rid of the color
// line"). Sandy mirror invites the model to pick its own palette; in Freeform
// the reference she attached is usually the whole point of attaching it, so
// the line argues with her. Cut as a NAMED clause rather than by rewriting the
// text — the swap pattern PL_GPT_STYLES.dreamy's own no-text toggle uses — so
// this stays the house wording minus one sentence, and the Playground's Sandy
// mirror tile is untouched.
// A REWORD IN server.js MUST MOVE THIS STRING: `BOILER.colorCut` records
// whether it was found, and the test fails when it stops matching, rather than
// the clause silently coming back.
const COLOR_CLAUSE = 'You can choose your own colors rather than copying the '
  + 'colors of the style reference.';

// Called by server.js once PL_GPT_STYLES exists (it is defined long after the
// mount, so this cannot be a require).
function init({ gptStyles } = {}) {
  const st = (gptStyles && gptStyles[BOILER_STYLE]) || null;
  if (!st) return;
  const prefix = String(st.prefix || '');
  BOILER.colorCut = prefix.includes(COLOR_CLAUSE);
  BOILER.prefix = prefix.split(COLOR_CLAUSE).join('').replace(/\s+/g, ' ').trim();
  BOILER.suffix = String(st.suffix || '');
  BOILER.from = st.label || BOILER_STYLE;
}

// ONE assembler, exported so the seam is testable without a Firestore: the
// route calls this and nothing else builds the sent text.
function boilerFields(prompt, on) {
  const words = String(prompt || '');
  const prefix = on ? BOILER.prefix : '';
  const suffix = on ? BOILER.suffix : '';
  const rec = promptRecord({ prefix, content: words, suffix });
  return { sent: rec.fullPrompt, ...promptFields(rec) };
}

const MAX_PROMPT = 4000;
const MAX_REFS = 12;                // the edits endpoint accepts up to 16 images
const MAX_OUTPUTS = 4;

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
// Reference images arrive as data URLs, so the body can be large.
router.use(express.json({ limit: '60mb' }));

async function put(buf, path, contentType) {
  const file = bucket().file(path);
  await file.save(buf, { metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${path}`;
}

// A 1024-square page showing a dozen references would be megabytes of PNG, so
// every ref carries a small webp display copy (same reasoning as the webp rule
// for the school art). The full-size original is what's sent to the model.
async function thumbOf(buf, path) {
  try {
    const sharp = require('sharp');
    const webp = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    return await put(webp, path, 'image/webp');
  } catch (e) { return null; }
}

function decodeImage(input) {
  const s = String(input || '');
  const m = s.match(/^data:(image\/[a-z.+-]+);base64,(.+)$/i);
  if (!m) return null;
  return { buf: Buffer.from(m[2], 'base64'), mime: m[1] };
}

async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`could not fetch reference (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

// The model call. `prompt` is passed through untouched — this function is
// deliberately the only place a prompt could be modified, and it doesn't.
async function draw(prompt, refBuffers, { quality, size }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', prompt);
  fd.append('size', size);
  fd.append('quality', quality);
  fd.append('n', '1');
  for (const [i, b] of refBuffers.entries()) {
    fd.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i + 1}.png`);
  }
  // With no references at all this is a plain generation, not an edit — the
  // edits endpoint requires an image, so the two are genuinely different calls.
  const url = refBuffers.length
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';
  let body = fd;
  let headers = { authorization: 'Bearer ' + key };
  if (!refBuffers.length) {
    body = JSON.stringify({ model: 'gpt-image-2', prompt, size, quality, n: 1, output_format: 'webp' });
    headers = { authorization: 'Bearer ' + key, 'content-type': 'application/json' };
  }
  const r = await fetch(url, { method: 'POST', headers, body });
  const d = await r.json();
  if (d.error) throw new Error(String(d.error.message || d.error.code || 'image failed').slice(0, 300));
  if (!d.data || !d.data[0] || !d.data[0].b64_json) throw new Error('no image returned');
  return Buffer.from(d.data[0].b64_json, 'base64');
}

// Fire-and-forget: the request has already been answered by the time this runs.
// Each output lands on the doc as it finishes, so the grid fills in as they
// arrive and one failed call costs its image, not the run.
async function render(id, { prompt, refUrls, quality, size, outputs }) {
  const doc = db().collection(RUNS).doc(id);
  try {
    const buffers = [];
    for (const u of refUrls) buffers.push(await fetchBuffer(u));
    const images = [];
    let firstErr = null;
    await Promise.all(Array.from({ length: outputs }, (_, i) => (async () => {
      try {
        const buf = await draw(prompt, buffers, { quality, size });
        const url = await put(buf, `freeform/out/${id}-${i + 1}.webp`, 'image/webp');
        images.push(url);
        await doc.set({ images, status: 'ready' }, { merge: true });
      } catch (e) { firstErr = firstErr || e; }
    })()));
    if (!images.length) throw firstErr || new Error('no images produced');
    await doc.set({ status: 'done', images, finishedAt: Date.now() }, { merge: true });
  } catch (e) {
    await doc.set({ status: 'failed', error: String(e.message || e).slice(0, 400), finishedAt: Date.now() },
      { merge: true }).catch(() => {});
  }
}

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    openai: !!process.env.OPENAI_API_KEY,
    firebase: !!admin.apps.length,
    sizes: Object.keys(SIZES),
    qualities: QUALITIES,
    cost: COST,
    boiler: BOILER,
  });
});

// The boiler text, served rather than copied into the page (the Playground's
// `/styles` rule): server.js owns what is actually sent.
router.get('/style', (req, res) => res.json({ ok: true, style: BOILER }));

// ── Reference library ──────────────────────────────────────────────────────
// POST /refs { images:[dataURL|https url], name? } — add references.
router.post('/refs', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'storage unavailable' });
    const list = Array.isArray(req.body && req.body.images) ? req.body.images : [];
    if (!list.length) return res.status(400).json({ error: 'images required' });
    const out = [];
    for (const item of list.slice(0, 40)) {
      try {
        const src = typeof item === 'string' ? item : (item && item.image);
        const name = String((item && item.name) || (req.body && req.body.name) || '').slice(0, 120);
        let buf, mime;
        const dec = decodeImage(src);
        if (dec) { buf = dec.buf; mime = dec.mime; }
        else if (/^https?:\/\//.test(String(src))) { buf = await fetchBuffer(String(src)); mime = 'image/png'; }
        else { out.push({ ok: false, error: 'not an image' }); continue; }
        const ref = db().collection(REFS).doc();
        const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
        const url = await put(buf, `freeform/refs/${ref.id}.${ext}`, mime);
        const thumb = await thumbOf(buf, `freeform/refs/${ref.id}-512.webp`);
        const doc = { url, thumb, name, bytes: buf.length, createdAt: Date.now() };
        await ref.set(doc);
        out.push({ ok: true, id: ref.id, ...doc });
      } catch (e) { out.push({ ok: false, error: String(e.message || e).slice(0, 200) }); }
    }
    res.json({ ok: true, refs: out });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// MOST RECENTLY USED FIRST, falling back to when it was uploaded (Aug 2026 —
// the page folds the library behind a `Recently used` button, so the order the
// server hands back IS what that button opens). A ref that has never been on a
// run has no `lastUsedAt`, so it sorts by upload date exactly as it always did
// — nothing needed backfilling for this.
function refOrder(refs) {
  const when = (r) => (r && (r.lastUsedAt || r.createdAt)) || 0;
  return refs.slice().sort((a, b) => when(b) - when(a));
}

router.get('/refs', async (req, res) => {
  try {
    const snap = await db().collection(REFS).get();
    const refs = refOrder(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    res.json({ ok: true, refs });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.patch('/refs/:id', async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').slice(0, 120);
    await db().collection(REFS).doc(String(req.params.id)).set({ name }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// Removing a reference drops the record; the bytes stay, because a finished run
// still points at them and its history must not turn into a broken image.
router.delete('/refs/:id', async (req, res) => {
  try {
    await db().collection(REFS).doc(String(req.params.id)).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// ── Runs ───────────────────────────────────────────────────────────────────
// POST /run { prompt, refs:[id|url], quality, size, outputs }
router.post('/run', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'storage unavailable' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'image generation unavailable' });
    const b = req.body || {};
    const prompt = String(b.prompt || '').slice(0, MAX_PROMPT);
    if (!prompt.trim()) return res.status(400).json({ error: 'prompt required' });
    const quality = QUALITIES.includes(b.quality) ? b.quality : 'medium';
    const size = SIZES[b.size] || (Object.values(SIZES).includes(b.size) ? b.size : SIZES.portrait);
    const outputs = Math.min(Math.max(Number(b.outputs) || 1, 1), MAX_OUTPUTS);
    // Her toggle. Anything but an explicit true leaves this the verbatim
    // surface — silence is the safe direction for a wrapper.
    const boiler = b.boiler === true || b.boiler === 'true';
    const { sent, ...promptRec } = boilerFields(prompt, boiler);

    // Refs may be library ids or plain urls; resolve ids to their stored url.
    const wanted = (Array.isArray(b.refs) ? b.refs : []).slice(0, MAX_REFS).map(String);
    const refUrls = [];
    const refIds = [];
    for (const r of wanted) {
      if (/^https?:\/\//.test(r)) { refUrls.push(r); continue; }
      const snap = await db().collection(REFS).doc(r).get();
      if (snap.exists && snap.data().url) { refUrls.push(snap.data().url); refIds.push(r); }
    }
    // Stamped so the library comes back in the order she actually reaches for
    // them. Best-effort: a failed stamp costs an ordering, never a run.
    const usedAt = Date.now();
    await Promise.all(refIds.map(id => db().collection(REFS).doc(id)
      .set({ lastUsedAt: usedAt }, { merge: true }).catch(() => {})));

    const ref = db().collection(RUNS).doc();
    const doc = {
      prompt,
      // What was actually sent, byte for byte. With the boiler toggle off the
      // two are identical by construction; with it on this is her words plus
      // the one style line, and `promptStyle` marks the seam with [content].
      promptSent: sent,
      boiler,
      ...promptRec,
      refs: refUrls, refIds, quality, size, outputs,
      model: 'gpt-image-2', status: 'drawing', images: [], createdAt: Date.now(),
    };
    await ref.set(doc);
    render(ref.id, { prompt: sent, refUrls, quality, size, outputs });   // deliberately not awaited
    res.json({ ok: true, id: ref.id, status: 'drawing', poll: `/api/freeform/run/${ref.id}` });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.get('/runs', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 200);
    const snap = await db().collection(RUNS).get();
    const runs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);
    await Promise.all(runs.map(async r => {
      const patch = stuckPatch(r);
      if (!patch) return;
      Object.assign(r, patch);
      await db().collection(RUNS).doc(r.id).set(patch, { merge: true }).catch(() => {});
    }));
    res.json({ ok: true, runs });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.get('/run/:id', async (req, res) => {
  try {
    const doc = await db().collection(RUNS).doc(String(req.params.id)).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    const run = { id: doc.id, ...doc.data() };
    const patch = stuckPatch(run);
    if (patch) {
      Object.assign(run, patch);
      await doc.ref.set(patch, { merge: true }).catch(() => {});
    }
    res.json({ ok: true, ...run });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.delete('/run/:id', async (req, res) => {
  try {
    await db().collection(RUNS).doc(String(req.params.id)).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

module.exports = { router, SIZES, QUALITIES, refOrder, BOILER, boilerFields, stuckPatch, STUCK_MS, init };

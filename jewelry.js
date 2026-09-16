// jewelry.js — a piece of jewelry becomes an Etsy draft, in two steps her mom
// can walk on her phone (2026-09-16, Sophie: "a simple user friendly website
// my mom can interact with, with clear step by steps 1. upload jewelry
// 2. review details and approve sample photos").
//
//   1. UPLOAD — ONE phone photo of the piece (Sophie: "she only uploads
//      one"). Normalized in the browser (HEIC → JPEG, ≤1536px) and POSTed as
//      raw bytes; stored once per md5 under jewelry/<item>/. The route takes
//      more, but the page asks for one.
//   2. MAKE THE LISTING — one tap, one background job, two things:
//        a. Claude reads every photo (vision) and writes the listing: what it
//           is, materials, a title, a description, thirteen tags, a price
//           guess. Words a human reads → Claude (the house rule).
//        b. gpt-image-2 (the ChatGPT image model — "the chatgpt model makes
//           the pics") draws FIVE sample photos — main, close-up, styled,
//           another angle, worn — with the upload attached as `image[]` and the
//           MASTER FIDELITY PROMPT from Sophie's own pipeline chat on top:
//           the jewelry is immutable, only the scene may change. The prompt
//           never describes what is in the photos (the never-describe-a-
//           reference rule); the photos are the description.
//      She fixes the words, taps "Looks good" on the photos she wants,
//      "Redo" on the ones she doesn't, and SEND TO ETSY makes a DRAFT with
//      the approved photos attached (pipeline.publishDraft, the photostudio
//      path — shipping/return/taxonomy defaults come off an active listing).
//      Nothing ever goes live from here.
//
// WHAT IT COSTS (gpt-image-2 medium square 4.1¢ + ~1.85¢ per reference read,
// docs/modules/pictures.md): a shot with one reference ≈ 6¢, the five shots
// ≈ 30¢, the Claude read ≈ 1¢. About 30¢ a piece; a Redo ≈ 6¢.
//
// GOTCHAS
// - gpt-image-2 REJECTS `input_fidelity` — and that is not a loss: OpenAI's
//   docs say it "processes every image input at high fidelity automatically",
//   so there is nothing to set. (photostudio.js led with gpt-image-1 + the
//   flag until 2026-09-16, Sophie: "use 2, change everywhere and the docs";
//   every image surface in this repo is gpt-image-2 now.) The fidelity here
//   is the prompt plus every reference, which is what Sophie's pipeline chat
//   settled on. A safety refusal is terminal — no retry.
// - Etsy takes png/jpg, never webp, so a shot is saved as PNG (the Etsy copy,
//   stamped with its prompt — image-meta.js) plus a 600px webp THUMB for the
//   page (the derived display copy the never-serve-a-raw-PNG rule wants).
// - Every shot's exact prompt is on the doc (prompt-record.js) AND inside
//   the PNG (image-meta.js) — the whole-prompt rule.
// - The page is served like /photo (serveGated + the STUDIO_TOKEN gate, off
//   on the live server, so the link just opens). If that token is ever
//   turned on, her mom needs the fruit.js `who=` pattern instead — not built.
// - Public-ish and it spends money, so /make and /redo carry selfcare.js's
//   per-IP rate limit (12 an hour ≈ $6 an hour at most).
// - `?account=<name>` on the page picks WHICH Etsy shop the draft lands in
//   (etsy.shopIdForAccount, never ETSY_SHOP_ID directly — the cross-shop bug).
// - ONE equality filter per query; sorting in memory; no composite index.
//
// ROUTES (/api/jewelry)
//   GET    /status                       open — config health, booleans only
//   POST   /items {account?}             a new piece
//   GET    /items?limit=&account=        recent pieces, newest first
//   GET    /items/:id                    the piece (poll this while a job runs)
//   PATCH  /items/:id {details, notes}   EDITABLE whitelist, her edits win
//   POST   /items/:id/photo (raw bytes)  one reference photo; md5-deduped
//   DELETE /items/:id/photo/:key
//   POST   /items/:id/make {notes}       the job: read + five shots (rate-limited)
//   POST   /items/:id/shot/:key {approved}
//   POST   /items/:id/shot/:key/redo     redraw one shot (rate-limited)
//   POST   /items/:id/draft {details?}   the Etsy DRAFT with the approved shots
//
// Test: node scripts/test-jewelry.js

const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');
const admin = require('firebase-admin');
const anthropic = require('./anthropic');
const promptRecord = require('./prompt-record');

const COL = 'forge-jewelry';
const MAX_PHOTOS = 8;
const CANVAS = '1024x1024';
const QUALITY = 'medium';
const MODEL = 'gpt-image-2';

function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`jewelry: ${name} unavailable —`, err.message);
    return null;
  }
}
const pipeline = tryRequire('./pipeline');
const etsy = tryRequire('./etsy');

// ─── The prompts — Sophie's own, from the jewelry pipeline chat, verbatim ───
const FIDELITY = `The jewelry item is immutable.

Preserve the exact physical object shown in ALL reference images. Maintain its exact proportions, component sizes, stone shape and size, setting, metal thickness, chain/link structure, clasp, texture, finish, color, translucency, inclusions, imperfections, construction, and the number and placement of every component.

Use all reference images together as evidence of the same physical object.

Do NOT redesign, beautify, symmetrize, simplify, enlarge, shrink, replace, repair, polish, add, remove, or reinterpret any part of the jewelry.

Do not invent details that are hidden or unclear in the reference images.

Only the background, lighting, framing, camera position, and surrounding scene may change.

The finished image must look like a new professional photograph of this EXACT physical jewelry item, not a similar item.`;

const SHOTS = {
  main: {
    label: 'Main photo',
    prompt: `Create a clean, high-end Etsy product photograph of the exact jewelry item in the reference images.

Place it naturally against a simple warm off-white background. Use soft diffused natural-looking studio light and realistic subtle shadows.

Show the complete item clearly and make it the dominant subject of the image.

Square composition suitable for an Etsy listing thumbnail.

Do not alter the jewelry in any way.`,
  },
  detail: {
    label: 'Close-up',
    prompt: `Create a close-up product photograph showing the craftsmanship and materials of the exact jewelry item in the reference images.

Use a macro-style composition with soft professional lighting. Show the real surface texture, stone characteristics, metalwork, connections, and imperfections visible in the references.

Do not enhance, smooth, perfect, recolor, or invent details.

It must remain an accurate representation of the physical item being sold.`,
  },
  styled: {
    label: 'Styled',
    prompt: `Create a tasteful editorial product photograph of the exact jewelry item in the reference images.

Place it in a subtle, natural setting appropriate for handmade jewelry. Keep the styling restrained so nothing competes with the jewelry.

Use soft natural light, realistic depth of field, and believable contact shadows.

The jewelry itself must remain completely unchanged from the references.`,
  },
  angle: {
    label: 'Another angle',
    prompt: `Create a professional product photograph of the exact jewelry item from a different useful viewing angle.

Infer the object's three-dimensional form only from the supplied reference photographs. Do not invent unseen construction or decorative details.

Use a clean neutral background, soft realistic lighting, and natural shadows.

Preserve the exact object's proportions, materials, construction, colors, and imperfections.`,
  },
  model: {
    label: 'Worn',
    prompt: `Create a realistic lifestyle product photograph showing a person wearing the EXACT jewelry item from the supplied reference images.

The jewelry is immutable. Preserve its exact proportions, scale, materials, colors, stone size and shape, setting, chain/link structure, thickness, construction, texture, finish, and imperfections.

Most importantly, preserve the jewelry's REAL-WORLD SIZE. Do not enlarge the pendant, stones, beads, chain, or other components to make them more visible. Use the supplied reference images and any scale information to determine its correct size relative to the human body.

Place the jewelry naturally on the model exactly as the real item would sit when worn. Respect gravity, chain length, attachment points, and orientation.

The model should look natural and understated. Simple neutral clothing, soft natural light, realistic skin and photography. The jewelry remains the focus.

Do not redesign, beautify, simplify, symmetrize, repair, add to, or otherwise alter the jewelry. The result must look like this exact physical item was photographed on a real person.`,
  },
};
const SHOT_KEYS = Object.keys(SHOTS);

// The whole prompt one shot is sent: the fidelity block, the shot, and — only
// when she wrote any — the seller's own notes (a size, a material), which is
// the "scale information" the worn shot asks for. Nothing describes the
// pictures.
function shotPrompt(key, notes) {
  const shot = SHOTS[key];
  if (!shot) throw new Error(`no such shot: ${key}`);
  const n = String(notes || '').trim();
  const content = shot.prompt + (n ? `\n\nNotes from the seller about this piece: ${n}` : '');
  const full = `${FIDELITY}\n\n${content}`;
  return { full, ...promptRecord.promptFields({ prefix: FIDELITY, content, full }) };
}

// ─── Firestore ──────────────────────────────────────────────────────
const db = () => (admin.apps.length ? admin.firestore() : null);
const bucketOrNull = () => { try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; } };
const nowIso = () => new Date().toISOString();
const strip = (o) => JSON.parse(JSON.stringify(o));

async function loadDoc(id) {
  const d = db();
  if (!d) throw new Error('Firebase unavailable');
  const snap = await d.collection(COL).doc(id).get();
  return snap.exists ? { id, ...snap.data() } : null;
}
// Patch FIELDS, never stamp a whole doc — a job's progress save must not
// revert an edit she made meanwhile. `merge:true` deep-merges maps, so
// { shots: { main: {...} } } touches one shot and leaves the rest.
async function patchDoc(id, fields) {
  await db().collection(COL).doc(id).set({ ...strip(fields), updatedAt: Date.now() }, { merge: true });
}

// ─── Rate limit — selfcare.js's, verbatim in spirit ────────────────
const RATE_MAX = 12;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();
function rateLimited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}
function limited(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown';
  if (!rateLimited(ip)) return false;
  res.status(429).json({ error: 'That is a lot of pieces for one hour — try again a little later.' });
  return true;
}

// ─── The EDITABLE whitelist — what a PATCH may touch ───────────────
const DETAIL_FIELDS = ['title', 'kind', 'materials', 'style', 'colors', 'size', 'description', 'tags', 'price'];
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const list = (v, n, each) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(s => clip(s, each)).filter(Boolean).slice(0, n);
function cleanDetails(d = {}) {
  const out = {};
  if (d.title !== undefined) out.title = clip(d.title, 140);
  if (d.kind !== undefined) out.kind = clip(d.kind, 60);
  if (d.materials !== undefined) out.materials = list(d.materials, 13, 45);
  if (d.style !== undefined) out.style = clip(d.style, 80);
  if (d.colors !== undefined) out.colors = list(d.colors, 6, 30);
  if (d.size !== undefined) out.size = clip(d.size, 120);
  if (d.description !== undefined) out.description = clip(d.description, 4000);
  if (d.tags !== undefined) out.tags = list(d.tags, 13, 20);
  if (d.price !== undefined) {
    const p = Number(d.price);
    if (Number.isFinite(p) && p > 0) out.price = Math.round(p * 100) / 100;
  }
  return out;
}

// What the list row and the page read as the piece's state, in her words.
function stateOf(doc) {
  if (!doc) return '';
  if (doc.status === 'drafted') return 'sent to Etsy';
  if (doc.job && doc.job.status === 'running') return 'working';
  if (doc.job && doc.job.status === 'failed') return 'didn\'t work';
  if (doc.details && doc.details.title) return 'ready to review';
  return 'new';
}
function thumbOf(doc) {
  const m = doc.shots && doc.shots.main;
  if (m && m.status === 'done' && m.thumb) return m.thumb;
  const p = (doc.photos || [])[0];
  return p ? (p.thumb || p.url) : '';
}
function publicItem(doc) {
  if (!doc) return null;
  return { ...doc, state: stateOf(doc), thumb: thumbOf(doc) };
}

// ─── Storage ────────────────────────────────────────────────────────
async function saveBytes(path, buf, contentType) {
  const bucket = bucketOrNull();
  if (!bucket) throw new Error('Firebase Storage not configured');
  const file = bucket.file(path);
  await file.save(buf, { metadata: { contentType }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
async function thumbOfBuffer(buf, width = 600) {
  const sharp = require('sharp');
  return sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}
// The reference is sent to the models as a ≤1024 JPEG — the edits endpoint
// reads it as image tokens (~1.85¢), and a phone photo's extra pixels buy
// nothing there.
async function referenceJpeg(buf, max = 1024) {
  const sharp = require('sharp');
  return sharp(buf).rotate().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 }).toBuffer();
}
async function fetchBuffer(url) {
  const r = await fetch(url, { timeout: 60000 });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return r.buffer();
}

// ─── Claude reads the photos and writes the listing ────────────────
const READ_SYSTEM = `You write Etsy listings for a small handmade jewelry shop. You are shown a photo of ONE piece of jewelry (sometimes more than one photo of the same piece). Describe only what the photos show; when something is not visible or not certain, say so briefly in the description rather than inventing it. Plain, warm, specific words a shopper trusts — no hype, no exclamation marks, no clichés.

Return STRICT JSON with exactly these keys:
{
  "kind": "what it is, two or three words (e.g. beaded necklace, drop earrings, silver ring)",
  "title": "an Etsy title up to 140 characters: what it is, the main material and stone, the style, who it is for",
  "materials": ["up to 8 materials, most important first"],
  "style": "the style in a few words",
  "colors": ["up to 4 colors"],
  "size": "your best read of the size, or an empty string",
  "description": "three or four short paragraphs: what it is and how it is made, the materials and colors, how it wears, and a line on care or gifting. 500 to 900 characters.",
  "tags": ["exactly 13 Etsy tags, each 20 characters or fewer, lowercase, shopper search phrases, no duplicates"],
  "price": a number in US dollars, a fair Etsy price for handmade jewelry of this kind and material
}`;

async function readPhotos(refs, notes) {
  if (!anthropic.available()) throw new Error('ANTHROPIC_API_KEY not set — the listing words run on Claude');
  const content = [];
  for (const buf of refs) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } });
  }
  const n = String(notes || '').trim();
  content.push({ type: 'text', text: (refs.length === 1 ? 'This photo shows one piece of jewelry.' : `These ${refs.length} photos show one piece of jewelry.`)
    + (n ? ` The seller adds: ${n}` : '') + ' Write the listing.' });
  const out = await anthropic.chatJSON({ system: READ_SYSTEM, messages: [{ role: 'user', content }], maxTokens: 1500 });
  const d = cleanDetails(out || {});
  if (!d.title) throw new Error('Claude did not return a title');
  return d;
}

// ─── gpt-image-2 draws one shot with every reference attached ──────
function terminalRefusal(msg) {
  return /safety|content policy|moderation|not allowed/i.test(String(msg || ''));
}
async function drawShot({ refs, prompt, retries = 1 }) {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) throw new Error('OPENAI_API_KEY not set');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', MODEL);
      form.append('prompt', prompt);
      refs.forEach((buf, i) => form.append('image[]', buf, { filename: `ref${i + 1}.jpg`, contentType: 'image/jpeg' }));
      form.append('size', CANVAS);
      form.append('quality', QUALITY);
      form.append('output_format', 'png');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, ...form.getHeaders() },
        body: form,
        timeout: 240000,
      });
      const data = await res.json();
      if (data.error) {
        const err = new Error(data.error.message || 'image edit error');
        err.terminal = terminalRefusal(data.error.message) || (res.status >= 400 && res.status < 500 && res.status !== 429);
        throw err;
      }
      const b64 = data.data && data.data[0] && data.data[0].b64_json;
      if (!b64) throw new Error('gpt-image-2 returned no image');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      if (err.terminal || attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

let fileCreation = null;
function init(opts = {}) {
  if (typeof opts.fileCreation === 'function') fileCreation = opts.fileCreation;
}

// Draw, save (PNG for Etsy, stamped; webp thumb for the page), file, and land
// the shot on the doc — the moment it exists, so a failure elsewhere in the
// same job never costs a picture already paid for.
async function makeShot(id, key, refs, notes) {
  const doc = await loadDoc(id);
  const prev = doc && doc.shots && doc.shots[key];
  const rec = shotPrompt(key, notes);
  await patchDoc(id, { shots: { [key]: { status: 'drawing', startedAt: nowIso(), approved: null } } });
  try {
    const png = await drawShot({ refs, prompt: rec.full });
    const madeAt = nowIso();
    const stamp = { fullPrompt: rec.fullPrompt, promptStyle: rec.promptStyle, promptContent: rec.promptContent,
      model: MODEL, quality: QUALITY, size: '1K', canvas: CANVAS, madeAt, label: SHOTS[key].label };
    const buf = require('./image-meta').stamp(png, stamp);
    const ts = Date.now();
    const url = await saveBytes(`jewelry/${id}/${key}-${ts}.png`, buf, 'image/png');
    const thumb = await saveBytes(`jewelry/${id}/${key}-${ts}.webp`, await thumbOfBuffer(png), 'image/webp');
    const shot = { status: 'done', url, thumb, madeAt, approved: null, label: SHOTS[key].label,
      model: MODEL, quality: QUALITY, canvas: CANVAS,
      fullPrompt: rec.fullPrompt, promptStyle: rec.promptStyle, promptContent: rec.promptContent };
    const patch = { shots: { [key]: shot } };
    // A redo keeps the old one: nothing she paid for is deleted, capped at six.
    if (prev && prev.status === 'done') {
      const hist = ((doc.shotsHistory || {})[key] || []).concat([prev]).slice(-6);
      patch.shotsHistory = { [key]: hist };
    }
    await patchDoc(id, patch);
    if (fileCreation) {
      await Promise.resolve().then(() => fileCreation({
        url, prompt: `jewelry · ${SHOTS[key].label}`, fullPrompt: rec.fullPrompt,
        promptStyle: rec.promptStyle, promptContent: rec.promptContent,
        model: MODEL, quality: QUALITY, canvas: CANVAS, source: 'jewelry',
      })).catch(err => console.warn('jewelry → My Creations failed:', err.message));
    }
    return shot;
  } catch (err) {
    await patchDoc(id, { shots: { [key]: { status: 'failed', error: clip(err.message, 300), approved: null } } });
    throw err;
  }
}

// ─── Background jobs — cutmarks.js's startJob on this collection ───
async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such piece');
  if (doc.job && doc.job.status === 'running') {
    const age = Date.now() - new Date(doc.job.startedAt || 0).getTime();
    if (age < 20 * 60 * 1000) throw new Error('Still working on this piece — give it a minute.');
  }
  const job = { kind, status: 'running', done: 0, total: 0, label: 'Starting…', error: null, startedAt: nowIso() };
  await patchDoc(id, { job });
  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      Object.assign(job, { done, total, label });
      if (Date.now() - lastSave > 1500) {
        lastSave = Date.now();
        await patchDoc(id, { job }).catch(() => {});
      }
    };
    try {
      await fn(progress);
      Object.assign(job, { status: 'done', label: 'done' });
    } catch (err) {
      console.warn(`jewelry: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'failed', error: clip(err.message, 300) });
    }
    await patchDoc(id, { job }).catch(e => console.warn('jewelry: save failed —', e.message));
  })();
  return job;
}

async function loadRefs(doc) {
  const photos = doc.photos || [];
  if (!photos.length) throw new Error('Add a photo first.');
  return Promise.all(photos.map(p => fetchBuffer(p.url).then(referenceJpeg)));
}

// The job behind "Make the listing": the words, then the five shots. Each shot
// lands on the doc as it finishes; one failed shot costs that shot, not the run.
async function makeAll(id, progress) {
  const doc = await loadDoc(id);
  const refs = await loadRefs(doc);
  await progress(0, 6, 'Reading your photo…');
  const details = await readPhotos(refs, doc.notes);
  await patchDoc(id, { details, detailsAt: nowIso(), detailsBy: 'claude' });
  await progress(1, 6, 'Taking the sample photos… (a few minutes)');
  let done = 1;
  const results = await Promise.allSettled(SHOT_KEYS.map(k => makeShot(id, k, refs, doc.notes)
    .then(s => { done++; progress(done, 6, `Sample photos: ${done - 1} of ${SHOT_KEYS.length}`); return s; })));
  const ok = results.filter(r => r.status === 'fulfilled').length;
  await patchDoc(id, { status: 'review' });
  if (!ok) throw new Error('None of the sample photos came out: ' + (results[0].reason && results[0].reason.message));
}

// ─── Routes ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: Boolean(db()), storage: Boolean(bucketOrNull()),
    openai: Boolean(process.env.OPENAI_API_KEY), claude: anthropic.available(),
    etsy: Boolean(etsy && pipeline && pipeline.publishDraft) });
});

const fail = (res, e) => res.status(/not set|unavailable|not configured/.test(e.message) ? 503
  : /no such|first|give it a minute|required|add a/i.test(e.message) ? 400 : 500)
  .json({ error: clip(e.message, 300) });

router.post('/items', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const d = db();
    if (!d) return res.status(503).json({ error: 'Firebase unavailable' });
    let account = 'default';
    try { account = etsy ? etsy.normAccount((req.body || {}).account) : 'default'; } catch (e) { return res.status(400).json({ error: e.message }); }
    const ref = d.collection(COL).doc();
    const doc = { account, status: 'new', photos: [], notes: '', details: {}, shots: {}, createdAt: Date.now(), updatedAt: Date.now() };
    await ref.set(doc);
    res.json(publicItem({ id: ref.id, ...doc }));
  } catch (e) { fail(res, e); }
});

router.get('/items', async (req, res) => {
  try {
    const d = db();
    if (!d) return res.status(503).json({ error: 'Firebase unavailable' });
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    let q = d.collection(COL);
    if (req.query.account) q = q.where('account', '==', String(req.query.account).toLowerCase());
    else q = q.orderBy('updatedAt', 'desc').limit(60);
    const snap = await q.get();
    const rows = snap.docs.map(s => ({ id: s.id, ...s.data() }))
      .filter(x => (x.photos || []).length)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, limit)
      .map(x => ({ id: x.id, title: (x.details && x.details.title) || '', state: stateOf(x), thumb: thumbOf(x), updatedAt: x.updatedAt || 0 }));
    res.json({ items: rows });
  } catch (e) { fail(res, e); }
});

router.get('/items/:id', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    res.json(publicItem(doc));
  } catch (e) { fail(res, e); }
});

router.patch('/items/:id', express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    const b = req.body || {};
    const patch = {};
    if (b.details) { patch.details = cleanDetails(b.details); patch.detailsBy = 'edited'; }
    if (b.notes !== undefined) patch.notes = clip(b.notes, 1000);
    await patchDoc(doc.id, patch);
    res.json({ ok: true, item: publicItem(await loadDoc(doc.id)) });
  } catch (e) { fail(res, e); }
});

router.post('/items/:id/photo', express.raw({ type: () => true, limit: '12mb' }), async (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.status(400).json({ error: 'empty body — POST the photo as the request body' });
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    if (doc.job && doc.job.status === 'running') return res.status(409).json({ error: 'Still working — add photos when it is done.' });
    const photos = doc.photos || [];
    if (photos.length >= MAX_PHOTOS) return res.status(400).json({ error: `${MAX_PHOTOS} photos is the most` });
    const md5 = crypto.createHash('md5').update(req.body).digest('hex');
    const key = md5.slice(0, 10);
    if (photos.some(p => p.key === key)) return res.json({ ok: true, duplicate: true, item: publicItem(doc) });
    const ct = /png/i.test(req.get('content-type') || '') ? 'image/png' : 'image/jpeg';
    const ext = ct === 'image/png' ? 'png' : 'jpg';
    const url = await saveBytes(`jewelry/${doc.id}/ref-${key}.${ext}`, req.body, ct);
    const thumb = await saveBytes(`jewelry/${doc.id}/ref-${key}.webp`, await thumbOfBuffer(req.body, 480), 'image/webp');
    const next = photos.concat([{ key, url, thumb, md5, bytes: req.body.length, at: Date.now() }]);
    await patchDoc(doc.id, { photos: next });
    res.json({ ok: true, item: publicItem({ ...doc, photos: next }) });
  } catch (e) { fail(res, e); }
});

router.delete('/items/:id/photo/:key', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    if (doc.job && doc.job.status === 'running') return res.status(409).json({ error: 'Still working — wait for it to finish.' });
    const next = (doc.photos || []).filter(p => p.key !== req.params.key);
    await patchDoc(doc.id, { photos: next });
    res.json({ ok: true, item: publicItem({ ...doc, photos: next }) });
  } catch (e) { fail(res, e); }
});

router.post('/items/:id/make', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    if (!(doc.photos || []).length) return res.status(400).json({ error: 'Add a photo first.' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'image generation unavailable' });
    if (!anthropic.available()) return res.status(503).json({ error: 'the listing writer is unavailable' });
    if (limited(req, res)) return;
    const notes = clip((req.body || {}).notes, 1000);
    await patchDoc(doc.id, { notes, status: 'working' });
    const job = await startJob(doc.id, 'make', p => makeAll(doc.id, p));
    res.json({ ok: true, job, item: publicItem({ ...doc, notes, status: 'working', job }) });
  } catch (e) { fail(res, e); }
});

router.post('/items/:id/shot/:key', express.json({ limit: '4kb' }), async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    const key = req.params.key;
    if (!SHOTS[key]) return res.status(400).json({ error: 'no such shot' });
    const shot = (doc.shots || {})[key];
    if (!shot || shot.status !== 'done') return res.status(400).json({ error: 'that photo is not ready' });
    const approved = (req.body || {}).approved === true ? true : (req.body || {}).approved === false ? false : null;
    await patchDoc(doc.id, { shots: { [key]: { approved } } });
    res.json({ ok: true, item: publicItem(await loadDoc(doc.id)) });
  } catch (e) { fail(res, e); }
});

router.post('/items/:id/shot/:key/redo', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    const key = req.params.key;
    if (!SHOTS[key]) return res.status(400).json({ error: 'no such shot' });
    if (!(doc.photos || []).length) return res.status(400).json({ error: 'Add a photo first.' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'image generation unavailable' });
    if (limited(req, res)) return;
    const job = await startJob(doc.id, `redo:${key}`, async (progress) => {
      await progress(0, 1, `Redoing the ${SHOTS[key].label.toLowerCase()}…`);
      const refs = await loadRefs(doc);
      await makeShot(doc.id, key, refs, doc.notes);
    });
    res.json({ ok: true, job, item: publicItem(await loadDoc(doc.id)) });
  } catch (e) { fail(res, e); }
});

// The approved shots, main first, as the PNG urls Etsy can fetch.
function approvedImages(doc) {
  return SHOT_KEYS.map(k => (doc.shots || {})[k])
    .filter(s => s && s.status === 'done' && s.approved === true && /^https?:/.test(s.url || ''))
    .map((s, i) => ({ url: s.url, rank: i + 1 }));
}

router.post('/items/:id/draft', express.json({ limit: '64kb' }), async (req, res) => {
  if (!pipeline || !pipeline.publishDraft) return res.status(503).json({ error: 'pipeline module unavailable' });
  if (!etsy || !etsy.getListingDefaults) return res.status(503).json({ error: 'etsy module unavailable' });
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such piece' });
    if (doc.job && doc.job.status === 'running') return res.status(409).json({ error: 'Still working — wait for it to finish.' });
    const b = req.body || {};
    // Her last edits ride the same tap, so a typo fixed a second ago is in the draft.
    const details = { ...(doc.details || {}), ...(b.details ? cleanDetails(b.details) : {}) };
    const images = approvedImages(doc);
    if (!images.length) return res.status(400).json({ error: 'Tap "Looks good" on at least one photo first.' });
    if (!details.title) return res.status(400).json({ error: 'The listing needs a title.' });
    if (!details.description) return res.status(400).json({ error: 'The listing needs a description.' });
    if (!details.price) return res.status(400).json({ error: 'Add a price.' });
    const account = etsy.normAccount(doc.account);
    const shopId = await etsy.shopIdForAccount(account, b.shop_id);
    if (!shopId) return res.status(400).json({ error: 'No Etsy shop is connected for this page yet.' });
    const def = await etsy.getListingDefaults(shopId);
    if (!def.ok) return res.status(502).json({ error: 'Etsy could not lend its listing settings (the shop needs one active listing).', detail: def.body });
    const d = def.defaults;
    await patchDoc(doc.id, { details, detailsBy: b.details ? 'edited' : (doc.detailsBy || 'claude') });
    const result = await pipeline.publishDraft({
      account, shop_id: Number(shopId), images,
      title: details.title, tags: details.tags, description: details.description,
      materials: details.materials, price: details.price, quantity: 1,
      taxonomy_id: d.taxonomy_id, shipping_profile_id: d.shipping_profile_id,
      return_policy_id: d.return_policy_id, readiness_state_id: d.readiness_state_id,
    });
    if (!result.ok) return res.status(502).json({ ok: false, error: 'Etsy did not take the draft.', detail: result });
    await patchDoc(doc.id, { status: 'drafted', etsy: { listing_id: result.listing_id || null, at: nowIso(), account, shop_id: Number(shopId) } });
    res.json({ ok: true, listing_id: result.listing_id, item: publicItem(await loadDoc(doc.id)) });
  } catch (e) { fail(res, e); }
});

module.exports = {
  router, init,
  // pure, for scripts/test-jewelry.js
  FIDELITY, SHOTS, SHOT_KEYS, shotPrompt, cleanDetails, stateOf, thumbOf, approvedImages, rateLimited, terminalRefusal,
  RATE_MAX, RATE_WINDOW_MS, MAX_PHOTOS,
};

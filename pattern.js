// pattern.js — Pattern: choose animals and fruits, arrange one tile, it repeats.
//
// 2026-09-22, Sophie: "we need to make a program that lets me choose and
// arrange animals and or fruits into a repeating pattern" · "i need to choose
// the constituents, choose how much to rotate, choose how far apart, and
// choose where they go". Four choices, four fields on an item — see
// pattern-plan.js, the one arithmetic the page and this module share.
//
// TWO COLLECTIONS.
//   forge-pattern-pieces — THE SHELF: one doc per animal / fruit / vegetable
//     she can put in a pattern. `src` is the picture on its white paper (the
//     fruit chart's own fruits, the animals, anything a chat POSTs), `cut` is
//     the same picture lifted off the paper — a transparent lossless webp —
//     and `thumb` the small copy the shelf shows. The id is sha1 of the source
//     url, so seeding twice is one shelf, never two.
//   forge-patterns — one doc per pattern: name, tile {w,h,bg}, layout {kind},
//     items [{k, piece, x, y, size, rot, flip}], exports [{size, url, at}].
//
// THE CUT-OUT IS vectorize.cutout — corner flood-fill, never a white
// threshold, so the white INSIDE a drawing (a bear's belly, a lychee's flesh)
// is kept and only paper a corner can reach is removed. It runs in the
// background the moment a piece is filed (`status:'cutting'` → 'ready'), a
// second or two for a 2000px picture; the page polls the shelf while any
// piece is still cutting.
//
// MONEY. Opening the page, arranging, and EXPORTING spend nothing — the export
// is sharp on our own box. The ONE paid thing is DRAW: a new piece she names
// is one gpt-image-2 edits call in the fruit chart's own recipe (the
// sage-sandy-mirror style reference, medium, 1024x1024, ~6-7c), so a new piece
// matches the fruits already on the shelf. It is behind the star and nothing
// else, and every drawn piece is stamped with its whole prompt (image-meta),
// filed into My Creations with it, and cut like any other.
//
// THE EXPORT is a background job on the pattern doc: the plan's draws are
// composited with sharp onto the tile's background at 1K / 2K / 4K (the TILE's
// width in pixels — a half-drop is twice as wide, a mirror twice as tall too),
// saved as PNG, and landed on `exports` (capped). A repeat of that one file on
// a plain grid IS the pattern, whatever the layout.
//
// Mounted at /api/pattern by server.js, page at /pattern. STUDIO_TOKEN-gated
// (only /status is open).
//
// Routes:
//   GET    /status                    → { ok, firebase, openai }
//   GET    /pieces                    → the shelf, ready or not
//   POST   /pieces {name, kind, src}  → file a picture as a piece; cuts in the background
//   POST   /pieces/draw {name, kind}  → THE PAID ONE: draw a new piece, then cut it
//   PATCH  /pieces/:id                → name / kind / hidden
//   POST   /pieces/:id/recut {tol}    → cut it again, another tolerance
//   GET    /patterns                  → every pattern, newest first (no items)
//   POST   /patterns {name?}          → a new pattern
//   GET    /patterns/:id
//   PATCH  /patterns/:id              → name / tile / layout / items
//   POST   /patterns/:id/export {size:'1K'|'2K'|'4K'} → background job; poll GET /patterns/:id

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fetch = require('node-fetch');
const FormData = require('form-data');

const { cutout } = require('./vectorize');
const plan = require('./pattern-plan');

const PIECES = 'forge-pattern-pieces';
const PATTERNS = 'forge-patterns';
const KINDS = ['animal', 'fruit', 'vegetable', 'other'];
const PIECE_EDITABLE = ['name', 'kind', 'hidden'];
const PATTERN_EDITABLE = ['name', 'tile', 'layout', 'items'];
const MAX_ITEMS = 60;
const EXPORT_PX = { '1K': 1024, '2K': 2048, '4K': 4096 };

// THE FRUIT CHART'S OWN RECIPE, verbatim from scripts/fruit-redraw.js, so a
// piece drawn here sits beside the fruits it was drawn to match. The style
// half is the wrapper with `[content]` where her words go (the Assets PROMPT
// overlay's convention); the content half is built from the name she typed.
const DRAW = {
  model: 'gpt-image-2',
  quality: 'medium',
  size: '1024x1024',
  ref: path.join(__dirname, 'refs', 'sage-sandy-mirror.png'),
  style: 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]',
  content: (name) => `a single ${name}, whole, on a plain white background. No text or lettering anywhere.`,
};

const router = express.Router();

// ── the gate (audio.js's, verbatim) ─────────────────────────────────────────
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '4mb' }));

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}
function bucket() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.storage().bucket();
}
function fail(res, err) {
  const msg = err && err.message ? err.message : String(err);
  res.status(msg.includes('not configured') ? 503 : msg.includes('no such') ? 404 : 500).json({ error: msg });
}
const nowIso = () => new Date().toISOString();
const rid = () => crypto.randomBytes(6).toString('hex');
const sha = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

async function put(p, buf, contentType) {
  const f = bucket().file(p);
  await f.save(buf, { metadata: { contentType, cacheControl: 'public,max-age=31536000,immutable' } });
  await f.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${p}`;
}
async function fetchBuf(url) {
  const r = await fetch(url, { redirect: 'follow', timeout: 120000 });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${String(url).slice(0, 80)}`);
  return Buffer.from(await r.arrayBuffer());
}

let fileCreation = null;
function init(opts = {}) {
  if (typeof opts.fileCreation === 'function') fileCreation = opts.fileCreation;
}

// ── pure: the shapes a client may write ─────────────────────────────────────
function cleanKind(k) { return KINDS.includes(k) ? k : 'other'; }
function cleanName(n) { return String(n || '').trim().replace(/\s+/g, ' ').slice(0, 60); }

/** A pattern PATCH, whitelisted and normalised; unknown fields are dropped and
 *  named in `dropped`. Items are capped and every number is clamped by the
 *  plan's own rules, so nothing a page sends can put the doc in a shape the
 *  renderer cannot draw. */
function cleanPatternPatch(body) {
  const out = {}, dropped = [];
  for (const k of Object.keys(body || {})) {
    if (!PATTERN_EDITABLE.includes(k)) { dropped.push(k); continue; }
    if (k === 'name') out.name = cleanName(body.name);
    else if (k === 'tile') out.tile = plan.tileOf({ tile: body.tile });
    else if (k === 'layout') out.layout = { kind: plan.layoutOf({ layout: body.layout }) };
    else if (k === 'items') {
      const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
      out.items = items.map((it) => plan.itemOf(it)).filter((it) => it.piece);
      out.items.forEach((it) => { if (!it.k) it.k = rid(); });
    }
  }
  return { patch: out, dropped };
}

function cleanPiecePatch(body) {
  const out = {}, dropped = [];
  for (const k of Object.keys(body || {})) {
    if (!PIECE_EDITABLE.includes(k)) { dropped.push(k); continue; }
    if (k === 'name') out.name = cleanName(body.name);
    else if (k === 'kind') out.kind = cleanKind(body.kind);
    else if (k === 'hidden') out.hidden = !!body.hidden;
  }
  return { patch: out, dropped };
}

/** What the shelf answers for a piece — never the whole doc. */
function pieceView(d) {
  return { id: d.id, name: d.name, kind: d.kind, src: d.src || null, cut: d.cut || null, thumb: d.thumb || null,
    w: d.w || null, h: d.h || null, status: d.status, error: d.error || null, hidden: !!d.hidden, drawn: !!d.drawn, createdAt: d.createdAt };
}

// ── the cut ─────────────────────────────────────────────────────────────────
/** Lift a picture off its paper and file the transparent copy. Trimmed to the
 *  ink (NOT re-padded square — an item's `size` is the ink's longest side, so
 *  a tall giraffe and a wide crocodile both mean what the slider says). */
async function cutPiece(id, src, { tol = 22 } = {}) {
  await db().collection(PIECES).doc(id).set({ status: 'cutting', error: null }, { merge: true });
  try {
    const raw = await fetchBuf(src);
    const png = await cutout(raw, { tol, pad: 0 });
    const trimmed = await sharp(png).trim().png().toBuffer();
    const meta = await sharp(trimmed).metadata();
    const cutBuf = await sharp(trimmed).webp({ lossless: true }).toBuffer();
    const thumbBuf = await sharp(trimmed).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const ts = Date.now();
    const cut = await put(`pattern/pieces/${id}-${ts}.webp`, cutBuf, 'image/webp');
    const thumb = await put(`pattern/pieces/${id}-${ts}-thumb.webp`, thumbBuf, 'image/webp');
    await db().collection(PIECES).doc(id).set({ status: 'ready', cut, thumb, w: meta.width, h: meta.height, tol, cutAt: nowIso() }, { merge: true });
  } catch (err) {
    console.warn(`pattern: cut ${id} failed —`, err.message);
    await db().collection(PIECES).doc(id).set({ status: 'failed', error: err.message }, { merge: true }).catch(() => {});
  }
}

// ── the draw (the one paid call) ────────────────────────────────────────────
async function drawOne(prompt) {
  const form = new FormData();
  form.append('model', DRAW.model);
  form.append('prompt', prompt);
  form.append('size', DRAW.size);
  form.append('quality', DRAW.quality);
  form.append('output_format', 'webp');
  form.append('image[]', fs.readFileSync(DRAW.ref), { filename: 'sage-sandy-mirror.png', contentType: 'image/png' });
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form, timeout: 300000,
  });
  const data = await res.json();
  if (data.error) {
    const msg = data.error.message || JSON.stringify(data.error);
    if (/safety|moderation|content policy/i.test(msg)) throw Object.assign(new Error('refused by the safety filter: ' + msg), { terminal: true });
    throw new Error(msg);
  }
  const d = data.data && data.data[0];
  if (d && d.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d && d.url) return fetchBuf(d.url);
  throw new Error('no image came back');
}

async function drawPiece(id, name) {
  const ref = db().collection(PIECES).doc(id);
  const promptContent = DRAW.content(name);
  const fullPrompt = DRAW.style.replace('[content]', promptContent);
  await ref.set({ status: 'drawing', error: null }, { merge: true });
  try {
    const webp = await drawOne(fullPrompt);
    const madeAt = nowIso();
    const stamp = { fullPrompt, promptStyle: DRAW.style, promptContent, model: DRAW.model, quality: DRAW.quality,
      size: '1K', canvas: DRAW.size, madeAt, label: `Pattern — ${name}` };
    const buf = require('./image-meta').stamp(webp, stamp);
    const src = await put(`pattern/pieces/${id}-full.webp`, buf, 'image/webp');
    await ref.set({ src, drawnAt: madeAt, fullPrompt, promptStyle: DRAW.style, promptContent,
      model: DRAW.model, quality: DRAW.quality, canvas: DRAW.size }, { merge: true });
    if (fileCreation) {
      await Promise.resolve().then(() => fileCreation({
        url: src, prompt: `pattern piece · ${name}`, fullPrompt, promptStyle: DRAW.style, promptContent,
        model: DRAW.model, quality: DRAW.quality, canvas: DRAW.size, source: 'pattern',
      })).catch((err) => console.warn('pattern → My Creations failed:', err.message));
    }
    await cutPiece(id, src);
  } catch (err) {
    console.warn(`pattern: draw ${id} failed —`, err.message);
    await ref.set({ status: 'failed', error: err.message }, { merge: true }).catch(() => {});
  }
}

// ── the export render ───────────────────────────────────────────────────────
function hexRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0xfaf6ee;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}

/** One draw as a raster ready to composite: sized, flipped, turned, mirrored —
 *  each transform its own sharp pass, because sharp orders the operations of
 *  ONE pipeline its own way (rotate before flip) and the plan needs flip
 *  INSIDE the turn and the mirror OUTSIDE it, exactly as the page's canvas does
 *  (translate → mirror → rotate → flip → draw). */
async function rasterDraw(pieceBuf, d, s) {
  const w = Math.max(1, Math.round(d.w * s)), h = Math.max(1, Math.round(d.h * s));
  let buf = await sharp(pieceBuf).resize(w, h, { fit: 'fill' }).png().toBuffer();
  if (d.flip) buf = await sharp(buf).flop().png().toBuffer();
  if (d.rot) buf = await sharp(buf).rotate(d.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  if (d.mx) buf = await sharp(buf).flop().png().toBuffer();
  if (d.my) buf = await sharp(buf).flip().png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width, h: meta.height };
}

/** Render the pattern's output image at `px` pixels per tile width. Pure
 *  sharp — no model, no money. `getPiece(id)` answers the cut-out's bytes. */
async function renderPattern(pattern, pieces, px, getPiece) {
  const dims = {};
  for (const p of Object.values(pieces)) if (p.w && p.h) dims[p.id] = { w: p.w, h: p.h };
  const out = plan.draws(pattern, dims);
  const tile = plan.tileOf(pattern);
  const s = px / tile.w;
  const W = Math.round(out.W * s), H = Math.round(out.H * s);
  const overlays = [];
  const cache = new Map();
  for (const d of out.draws) {
    if (!pieces[d.piece] || !pieces[d.piece].cut) continue;
    if (!cache.has(d.piece)) cache.set(d.piece, await getPiece(d.piece));
    const r = await rasterDraw(cache.get(d.piece), d, s);
    let left = Math.round(d.cx * s - r.w / 2), top = Math.round(d.cy * s - r.h / 2);
    // Clip to the canvas by hand: sharp refuses an overlay that hangs off it.
    const x0 = Math.max(0, left), y0 = Math.max(0, top);
    const x1 = Math.min(W, left + r.w), y1 = Math.min(H, top + r.h);
    if (x1 <= x0 || y1 <= y0) continue;
    let input = r.buf;
    if (x0 !== left || y0 !== top || x1 - x0 !== r.w || y1 - y0 !== r.h) {
      input = await sharp(r.buf).extract({ left: x0 - left, top: y0 - top, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
    }
    overlays.push({ input, left: x0, top: y0 });
  }
  let img = sharp({ create: { width: W, height: H, channels: 4, background: hexRgb(out.bg) } });
  if (overlays.length) img = img.composite(overlays);
  return { png: await img.png().toBuffer(), W, H };
}

// ── loaders ─────────────────────────────────────────────────────────────────
async function loadPieces() {
  const snap = await db().collection(PIECES).get();
  const out = {};
  snap.forEach((d) => { out[d.id] = { id: d.id, ...d.data() }; });
  return out;
}
async function loadPattern(id) {
  const d = await db().collection(PATTERNS).doc(id).get();
  if (!d.exists) throw new Error('no such pattern');
  return { id: d.id, ...d.data() };
}
async function patchPattern(id, fields) {
  await db().collection(PATTERNS).doc(id).set(fields, { merge: true });
}

// ── routes: status + the shelf ──────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: !!admin.apps.length, openai: !!process.env.OPENAI_API_KEY, kinds: KINDS, exportSizes: Object.keys(EXPORT_PX) });
});

router.get('/pieces', async (req, res) => {
  try {
    const all = Object.values(await loadPieces()).filter((p) => !p.hidden || req.query.hidden === '1');
    all.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    res.json({ pieces: all.map(pieceView) });
  } catch (err) { fail(res, err); }
});

router.post('/pieces', async (req, res) => {
  try {
    const src = String(req.body.src || '').trim();
    if (!/^https:\/\//.test(src)) return res.status(400).json({ error: 'src must be an https url' });
    const name = cleanName(req.body.name);
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = sha(src).slice(0, 20);
    const ref = db().collection(PIECES).doc(id);
    const had = await ref.get();
    if (had.exists && had.data().status === 'ready' && !req.body.recut) {
      return res.json({ piece: pieceView({ id, ...had.data() }), duplicate: true });
    }
    const doc = { name, kind: cleanKind(req.body.kind), src, status: 'cutting', error: null,
      createdAt: had.exists ? had.data().createdAt : nowIso(), hidden: false };
    await ref.set(doc, { merge: true });
    setImmediate(() => cutPiece(id, src, { tol: Number(req.body.tol) || 22 }));
    res.json({ piece: pieceView({ id, ...doc }) });
  } catch (err) { fail(res, err); }
});

router.post('/pieces/draw', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
    const name = cleanName(req.body.name);
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = rid();
    const doc = { name, kind: cleanKind(req.body.kind), status: 'drawing', error: null, drawn: true, createdAt: nowIso(), hidden: false };
    await db().collection(PIECES).doc(id).set(doc);
    setImmediate(() => drawPiece(id, name));
    res.json({ piece: pieceView({ id, ...doc }), cost: '~6c' });
  } catch (err) { fail(res, err); }
});

router.patch('/pieces/:id', async (req, res) => {
  try {
    const ref = db().collection(PIECES).doc(req.params.id);
    const had = await ref.get();
    if (!had.exists) return res.status(404).json({ error: 'no such piece' });
    const { patch, dropped } = cleanPiecePatch(req.body);
    if (Object.keys(patch).length) await ref.set(patch, { merge: true });
    res.json({ piece: pieceView({ id: req.params.id, ...had.data(), ...patch }), dropped });
  } catch (err) { fail(res, err); }
});

router.post('/pieces/:id/recut', async (req, res) => {
  try {
    const had = await db().collection(PIECES).doc(req.params.id).get();
    if (!had.exists) return res.status(404).json({ error: 'no such piece' });
    if (!had.data().src) return res.status(400).json({ error: 'nothing to cut from' });
    setImmediate(() => cutPiece(req.params.id, had.data().src, { tol: Number(req.body.tol) || 22 }));
    res.json({ ok: true, status: 'cutting' });
  } catch (err) { fail(res, err); }
});

// ── routes: patterns ────────────────────────────────────────────────────────
router.get('/patterns', async (req, res) => {
  try {
    const snap = await db().collection(PATTERNS).orderBy('updatedAt', 'desc').limit(100).get();
    const list = [];
    snap.forEach((d) => {
      const p = d.data();
      if (p.hidden) return;
      list.push({ id: d.id, name: p.name || '', layout: p.layout || { kind: 'grid' }, tile: p.tile || plan.DEFAULT_TILE,
        count: (p.items || []).length, updatedAt: p.updatedAt, createdAt: p.createdAt, thumb: p.thumb || null });
    });
    res.json({ patterns: list });
  } catch (err) { fail(res, err); }
});

router.post('/patterns', async (req, res) => {
  try {
    const id = rid();
    const now = nowIso();
    const doc = { name: cleanName(req.body.name), tile: plan.tileOf({ tile: req.body.tile }), layout: { kind: plan.layoutOf({ layout: req.body.layout }) },
      items: [], exports: [], createdAt: now, updatedAt: now, hidden: false };
    await db().collection(PATTERNS).doc(id).set(doc);
    res.json({ pattern: { id, ...doc } });
  } catch (err) { fail(res, err); }
});

router.get('/patterns/:id', async (req, res) => {
  try { res.json({ pattern: await loadPattern(req.params.id) }); } catch (err) { fail(res, err); }
});

router.patch('/patterns/:id', async (req, res) => {
  try {
    await loadPattern(req.params.id);
    const { patch, dropped } = cleanPatternPatch(req.body);
    if (Object.keys(patch).length) { patch.updatedAt = nowIso(); await patchPattern(req.params.id, patch); }
    res.json({ pattern: await loadPattern(req.params.id), dropped });
  } catch (err) { fail(res, err); }
});

router.post('/patterns/:id/export', async (req, res) => {
  try {
    const p = await loadPattern(req.params.id);
    const size = EXPORT_PX[req.body.size] ? req.body.size : '1K';
    if (p.job && p.job.status === 'running' && Date.now() - new Date(p.job.startedAt || 0).getTime() < 20 * 60 * 1000) {
      return res.json({ pattern: p, already: true });
    }
    const job = { kind: 'export', size, status: 'running', label: 'rendering', error: null, startedAt: nowIso() };
    await patchPattern(p.id, { job });
    setImmediate(async () => {
      try {
        const pieces = await loadPieces();
        const { png, W, H } = await renderPattern(p, pieces, EXPORT_PX[size], async (id) => fetchBuf(pieces[id].cut));
        const ts = Date.now();
        const url = await put(`pattern/exports/${p.id}-${size}-${ts}.png`, png, 'image/png');
        const thumb = await put(`pattern/exports/${p.id}-${size}-${ts}-thumb.webp`,
          await sharp(png).resize(512, 512, { fit: 'inside' }).webp({ quality: 82 }).toBuffer(), 'image/webp');
        const fresh = await loadPattern(p.id);
        const exports = (fresh.exports || []).concat([{ size, url, thumb, W, H, layout: plan.layoutOf(p), at: nowIso() }]).slice(-12);
        await patchPattern(p.id, { exports, thumb, job: { ...job, status: 'done', label: 'done', url } });
      } catch (err) {
        console.warn(`pattern: export ${p.id} failed —`, err.message);
        await patchPattern(p.id, { job: { ...job, status: 'failed', error: err.message } }).catch(() => {});
      }
    });
    res.json({ pattern: { ...p, job } });
  } catch (err) { fail(res, err); }
});

/** File a picture as a piece and cut it — the POST /pieces path as a function,
 *  for scripts/pattern-seed.js, which runs it with the Admin SDK from a
 *  container so the shelf is full before the page is ever deployed. */
async function filePiece({ name, kind, src, tol = 22, recut = false }) {
  const id = sha(src).slice(0, 20);
  const ref = db().collection(PIECES).doc(id);
  const had = await ref.get();
  if (had.exists && had.data().status === 'ready' && !recut) return { id, duplicate: true };
  await ref.set({ name: cleanName(name), kind: cleanKind(kind), src, status: 'cutting', error: null,
    createdAt: had.exists ? had.data().createdAt : nowIso(), hidden: false }, { merge: true });
  await cutPiece(id, src, { tol });
  const now = await ref.get();
  return { id, ...now.data() };
}

module.exports = { router, init, KINDS, EXPORT_PX, DRAW, cleanPatternPatch, cleanPiecePatch, pieceView, renderPattern, rasterDraw, hexRgb, filePiece, cutPiece };

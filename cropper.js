// cropper.js — Squaring: crop pictures to square by TAPPING ARROWS.
//
// Sophie's ask (2026-08-29, after twelve automatically-squared pictures came
// back missing the thing each one was about — "the shirt is crucial, the elbow
// isn't"): "could you make a cropping tool where I move it up or down with
// arrows rather than dragging."
//
// So the whole tool is one number per picture: WHERE the square sits along the
// long edge. `pos` is 0..1 — 0 is flush with the top (or the left), 1 with the
// bottom (or the right), 0.5 dead centre, which is exactly what an automatic
// crop gives you and exactly what she was correcting. Arrows step it; nothing
// drags, nothing pinches, and there is no zoom: a square out of a 2:3 has one
// degree of freedom and offering more would be inventing work.
//
// WHY THE PAGE AND THE SERVER CANNOT DISAGREE ABOUT THE CROP. The page previews
// by drawing the ORIGINAL with the discarded bands dimmed — she is looking at
// what is kept AND what is lost, which is the whole point — and the server cuts
// with `cropBox()` below. Both are the same arithmetic, and `cropBox` is
// exported so `scripts/test-cropper.js` can pin them against each other. A
// preview that lies about the cut is the one failure this must not have.
//
// NOTHING IS DESTROYED. The source picture is never touched or replaced; a save
// writes a NEW square copy and points whatever asked for it (`apply`) at the
// new url. Re-cropping writes another copy under another name, so no CDN cache
// can serve her yesterday's crop — that is why `pos` is in the filename.
//
// NO MODEL CALLS, NO COST. It is a download, sharp, and an upload, on our own
// box. Opening the page spends nothing (house rule).
//
// Firestore (deckfactory-43176): `forge-crops`, one doc per SET, id =
// sha1(title + the source urls) so re-seeding the same set updates one doc
// rather than piling up copies.
//
// `apply` is how a square gets back to where it came from. One kind so far:
//   { kind:'memory', uid, id }  → membry users/{uid}/memories/{id}
//                                 .illustration.url (the Shoebox polaroid)
// A set with no `apply` just produces urls. The membry handle is HANDED IN by
// server.js (init below) — the scratchpad/dreamapp pattern — because the
// credential lives on STORY_FIREBASE_SERVICE_ACCOUNT and this module's own
// admin app is Deck Factory's.
//
// Mounted at /api/crop by server.js. Page: /crop (serveGated).
//
// Routes:
//   GET    /status            → { ok, firebase, membry, sets }        (open)
//   GET    /sets              → { sets:[{id,title,count,cropped}] }
//   POST   /sets              → { title, items:[{url,label?,pos?,apply?}] }
//   GET    /sets/:id          → the set
//   POST   /sets/:id/pos      → { key, pos }   — the number only, instant
//   POST   /sets/:id/save     → starts the cut job, returns at once
//   GET    /sets/:id/job      → poll it
//   POST   /sets/:id/hide     → { hide? }      — never a delete
//
// Tests: node scripts/test-cropper.js (cropBox and the set/patch rules, pure)
//        node scripts/test-crop-page.js (the real page, headless)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const sharp = require('sharp');

const SETS = 'forge-crops';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const BUCKET = 'deckfactory-43176.firebasestorage.app';
const MAX_ITEMS = 60;
const OUT_MAX = 1600;          // never UPSCALE past this; a smaller source stays its own size
const JOB_STALE_MS = 20 * 60 * 1000;

const db = () => admin.firestore();
const hasFirebase = () => Boolean(admin.apps.length);
const bucket = () => admin.storage().bucket(BUCKET);

// membry (the Memory Library) is another Firebase project — handed in, never
// required, so this module loads fine without it and an `apply` that needs it
// fails on its own item instead of failing the module.
let wiring = null;
function init(w) { wiring = w || null; }
async function membryDb() {
  if (!wiring || !wiring.membryDb) return null;
  try { return await wiring.membryDb(); } catch { return null; }
}

/* ── the arithmetic, shared with the page ──────────────────────────────────
 * A square out of a WxH picture, positioned by `pos` (0..1) along the long
 * edge. This is exactly CSS `object-fit:cover` in a square box with
 * `object-position` at `pos` along that edge — which is how crop.html draws
 * the preview, so the two agree by construction.
 */
function clamp01(n) { const x = Number(n); return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; }
// A position that is missing or not a number means "nobody has decided" — and
// the honest answer to that is the middle, which is where an automatic crop
// would have put it anyway. clamp01 alone answers 0 for a NaN, which would
// silently slam every undecided picture flush against the top.
function posOf(v) { const x = Number(v); return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5; }
function cropBox(w, h, pos) {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  const S = Math.min(W, H);
  const p = posOf(pos);
  // Round the OFFSET, never the fraction — rounding p first walks the box a
  // pixel off the edge on a tall source and clips a hairline of the picture.
  const slack = Math.abs(W - H);
  const off = Math.round(p * slack);
  return H >= W
    ? { left: 0, top: off, width: S, height: S, axis: H === W ? null : 'y' }
    : { left: off, top: 0, width: S, height: S, axis: 'x' };
}

/* ── set shape ─────────────────────────────────────────────────────────── */
const keyFor = (url, i) => 'i' + i + '-' + crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 8);

function cleanApply(a) {
  if (!a || typeof a !== 'object') return null;
  if (a.kind !== 'memory') return null;
  const uid = String(a.uid || '').trim(), id = String(a.id || '').trim();
  if (!uid || !id) return null;
  return { kind: 'memory', uid, id };
}

// Build the stored items from a POST. Everything the server owns (the key, the
// output url, when it was cut) is derived here; the caller only ever supplies
// a source, a label, a starting position and where it should end up.
function buildItems(raw) {
  const items = [];
  (Array.isArray(raw) ? raw : []).forEach((it, i) => {
    const url = String((it && it.url) || '').trim();
    if (!/^https?:\/\//.test(url)) return;
    items.push({
      key: keyFor(url, i),
      url,
      label: String((it && it.label) || '').slice(0, 200),
      pos: posOf(it && it.pos),
      apply: cleanApply(it && it.apply),
      out: '', outPos: null, outAt: null,
    });
  });
  return items.slice(0, MAX_ITEMS);
}

// Re-seeding a set she has already worked on must not throw her positions
// away — the doc id is content-addressed, so the same set POSTed twice IS the
// same set. Keep `pos` and the cut copy for every item that survives; take the
// label and the apply target from the new POST (those are the caller's to
// correct).
function mergeItems(oldItems, freshItems) {
  const was = {};
  (oldItems || []).forEach((it) => { was[it.key] = it; });
  return freshItems.map((it) => {
    const o = was[it.key];
    if (!o) return it;
    return { ...it, pos: o.pos == null ? it.pos : o.pos, out: o.out || '', outPos: o.outPos == null ? null : o.outPos, outAt: o.outAt || null };
  });
}

const setId = (title, items) => crypto.createHash('sha1')
  .update(String(title || '') + '|' + items.map((i) => i.url).join('|')).digest('hex').slice(0, 20);

// An item needs cutting when it has never been cut, or when she has moved it
// since the copy on file was made. Comparing NUMBERS (not a dirty flag) means
// nudging a picture and nudging it back costs nothing.
const needsCut = (it) => !it.out || it.outPos == null || Math.abs(Number(it.outPos) - Number(it.pos)) > 1e-6;

/* ── the cut job ───────────────────────────────────────────────────────── */
const jobs = {};   // setId -> { token }

function jobLive(job) {
  return Boolean(job && job.status === 'running'
    && Date.now() - (job.startedAt || 0) < JOB_STALE_MS);
}

async function cutOne(sid, it) {
  const res = await fetch(it.url);
  if (!res.ok) throw new Error('could not fetch the picture (' + res.status + ')');
  const src = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(src).metadata();
  const box = cropBox(meta.width, meta.height, it.pos);
  const size = Math.min(box.width, OUT_MAX);
  const out = await sharp(src)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .resize(size, size)
    .webp({ quality: 92 })
    .toBuffer();
  // `pos` rides in the NAME so a re-crop is a new object — a saved crop can
  // never be shadowed by a year-long CDN cache of the previous one.
  const name = 'crops/' + sid + '/' + it.key + '-' + Math.round(posOf(it.pos) * 1000) + '.webp';
  const f = bucket().file(name);
  await f.save(out, { contentType: 'image/webp', resumable: false, metadata: { cacheControl: 'public,max-age=31536000' } });
  await f.makePublic();
  return 'https://storage.googleapis.com/' + BUCKET + '/' + name;
}

async function applyOne(it, url) {
  if (!it.apply || it.apply.kind !== 'memory') return;
  const mdb = await membryDb();
  if (!mdb) throw new Error('the memory library credential (STORY_FIREBASE_SERVICE_ACCOUNT) is not set');
  await mdb.collection('users').doc(it.apply.uid).collection('memories').doc(it.apply.id)
    .set({ illustration: { url }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

// Fire-and-forget, the cutmarks.js shape: state lives ON the doc, progress is
// PATCHED field by field (never a whole-doc stamp — that is what silently
// reverted her concurrent edits in the Episode Editor), and a stale token
// stands the job down so a deploy mid-cut cannot wedge the set forever.
function startJob(sid, keys) {
  const token = crypto.randomBytes(8).toString('hex');
  jobs[sid] = { token };
  (async () => {
    const ref = db().collection(SETS).doc(sid);
    const alive = () => jobs[sid] && jobs[sid].token === token;
    let done = 0, failed = 0, lastErr = '';
    for (const key of keys) {
      if (!alive()) return;
      const snap = await ref.get();
      const set = snap.data() || {};
      const it = (set.items || []).find((x) => x.key === key);
      if (!it) { done++; continue; }
      try {
        const url = await cutOne(sid, it);
        await applyOne(it, url);
        // Re-read inside the write: she may have moved ANOTHER picture while
        // this one was being cut, and stamping the array we read at the top of
        // the loop would throw that away.
        const fresh = (await ref.get()).data() || {};
        const items = (fresh.items || []).map((x) => (x.key === key
          ? { ...x, out: url, outPos: it.pos, outAt: Date.now() } : x));
        await ref.set({ items }, { merge: true });
      } catch (e) {
        failed++; lastErr = e.message || String(e);
      }
      done++;
      if (!alive()) return;
      await ref.set({ job: { kind: 'cut', status: 'running', done, total: keys.length, failed, error: lastErr, startedAt: jobs[sid].startedAt } }, { merge: true });
    }
    if (!alive()) return;
    await ref.set({ job: { kind: 'cut', status: failed && failed === keys.length ? 'failed' : 'done',
      done, total: keys.length, failed, error: lastErr, startedAt: jobs[sid].startedAt, finishedAt: Date.now() } }, { merge: true });
  })().catch(async (e) => {
    try {
      await db().collection(SETS).doc(sid)
        .set({ job: { kind: 'cut', status: 'failed', error: e.message || String(e), finishedAt: Date.now() } }, { merge: true });
    } catch { /* the doc is beyond reach; the poll will say so */ }
  });
  return token;
}

/* ── routes ────────────────────────────────────────────────────────────── */
const router = express.Router();
router.use(express.json({ limit: '1mb' }));
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

const fail = (res, e) => res.status(500).json({ error: e.message || String(e) });
const noDb = (res) => res.status(503).json({ error: 'Firebase is not configured' });

router.get('/status', async (req, res) => {
  let sets = null;
  try { if (hasFirebase()) sets = (await db().collection(SETS).get()).size; } catch { /* report null */ }
  res.json({ ok: true, firebase: hasFirebase(), membry: Boolean(wiring && wiring.membryDb), sets });
});

router.get('/sets', async (req, res) => {
  try {
    if (!hasFirebase()) return noDb(res);
    const q = await db().collection(SETS).get();
    const sets = q.docs.map((d) => d.data())
      .filter((s) => !s.hidden)
      .map((s) => ({
        id: s.id, title: s.title, count: (s.items || []).length,
        cropped: (s.items || []).filter((it) => !needsCut(it)).length,
        updatedAt: s.updatedAt || 0,
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ sets });
  } catch (e) { fail(res, e); }
});

// The set write, callable from a sibling module too (shoebox.js's Square-it
// door builds a one-picture set through this) — the route and the caller must
// share one implementation or their sets would merge by different rules.
async function createSet(rawTitle, rawItems) {
  if (!hasFirebase()) throw new Error('Firebase is not configured');
  const title = String(rawTitle || '').trim().slice(0, 120);
  const fresh = buildItems(rawItems);
  if (!fresh.length) throw new Error('no usable pictures — each item needs an http(s) url');
  const id = setId(title, fresh);
  const ref = db().collection(SETS).doc(id);
  const snap = await ref.get();
  const old = snap.exists ? (snap.data() || {}) : {};
  const items = mergeItems(old.items, fresh);
  await ref.set({ id, title, items, hidden: false,
    createdAt: old.createdAt || Date.now(), updatedAt: Date.now() }, { merge: true });
  return { ok: true, id, count: items.length, url: '/crop?set=' + id };
}

router.post('/sets', async (req, res) => {
  try {
    if (!hasFirebase()) return noDb(res);
    res.json(await createSet(req.body.title, req.body.items));
  } catch (e) {
    if (/no usable pictures/.test(e.message || '')) return res.status(400).json({ error: e.message });
    fail(res, e);
  }
});

router.get('/sets/:id', async (req, res) => {
  try {
    if (!hasFirebase()) return noDb(res);
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(SETS).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such set' });
    res.json(snap.data());
  } catch (e) { fail(res, e); }
});

// The number only. This is what an arrow tap costs, so it must be one small
// write and nothing else — no cutting, no uploading, no model call.
router.post('/sets/:id/pos', async (req, res) => {
  try {
    if (!hasFirebase()) return noDb(res);
    const key = String(req.body.key || '');
    const pos = posOf(req.body.pos);
    const ref = db().collection(SETS).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such set' });
    const items = (snap.data().items || []);
    if (!items.some((it) => it.key === key)) return res.status(404).json({ error: 'no such picture in this set' });
    await ref.set({ items: items.map((it) => (it.key === key ? { ...it, pos } : it)), updatedAt: Date.now() }, { merge: true });
    res.json({ ok: true, key, pos });
  } catch (e) { fail(res, e); }
});

router.post('/sets/:id/save', async (req, res) => {
  try {
    if (!hasFirebase()) return noDb(res);
    const sid = String(req.params.id);
    const ref = db().collection(SETS).doc(sid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such set' });
    const set = snap.data();
    // Re-POSTing while a job runs returns the running job, never a second one.
    if (jobLive(set.job)) return res.json({ ok: true, job: set.job, already: true });
    const keys = (set.items || []).filter(needsCut).map((it) => it.key);
    if (!keys.length) return res.json({ ok: true, job: { kind: 'cut', status: 'done', done: 0, total: 0 }, nothing: true });
    const job = { kind: 'cut', status: 'running', done: 0, total: keys.length, failed: 0, error: '', startedAt: Date.now() };
    await ref.set({ job }, { merge: true });
    jobs[sid] = { token: '', startedAt: job.startedAt };
    jobs[sid].token = startJob(sid, keys);
    jobs[sid].startedAt = job.startedAt;
    res.json({ ok: true, job });
  } catch (e) { fail(res, e); }
});

router.get('/sets/:id/job', async (req, res) => {
  try {
    if (!hasFirebase()) return noDb(res);
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(SETS).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such set' });
    const set = snap.data();
    res.json({ job: set.job || null, items: (set.items || []).map((it) => ({ key: it.key, out: it.out, outPos: it.outPos })) });
  } catch (e) { fail(res, e); }
});

// Hidden, never deleted — a set is a record of decisions she made about
// pictures, and nothing here has ever destroyed one of those.
router.post('/sets/:id/hide', async (req, res) => {
  try {
    if (!hasFirebase()) return noDb(res);
    const hide = req.body.hide === undefined ? true : Boolean(req.body.hide);
    await db().collection(SETS).doc(String(req.params.id)).set({ hidden: hide, updatedAt: Date.now() }, { merge: true });
    res.json({ ok: true, hidden: hide });
  } catch (e) { fail(res, e); }
});

module.exports = { router, init, cropBox, clamp01, posOf, buildItems, mergeItems, needsCut, setId, cleanApply, jobLive, createSet };

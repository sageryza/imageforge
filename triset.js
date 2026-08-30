// Triset — triangular SET solitaire (Sophie's concept, 2026-08-30).
//
// A pool of triangular picture cards. Three are dealt into a triangle — top,
// left, right — around a middle inverted triangle that is a TEXT BOX. She says
// what they have in common (or taps a card to swap it out) until she finds a
// set. Two kinds of set:
//   1. 'same' — all three share one thing; the middle box names it.
//   2. 'each' — each of the three shares something DIFFERENT with a 4th thing;
//      the middle box names the 4th thing, three side boxes name the three
//      connections.
// FINDING A SET GENERATES A NEW CARD — the venn-diagram center: her named
// qualities become the prompt for one new subject that unites them, drawn as a
// new triangular card in the same style, which joins the pool. The game feeds
// itself.
//
// THE STYLE IS DREAMY, HANDED IN — PL_GPT_STYLES.dreamy via init() (the
// freeform.js pattern; server.js owns the wording and a copy would drift the
// day she rewords it). Two swaps are applied to its tail, both by the house
// swap-never-argue mechanism: the border clause (anchored on dreamy.sheet.from)
// becomes the TRIANGLE clause, and her own noText swap runs (cards carry no
// text). If server.js rewords the tail and the anchor stops matching, the
// triangle clause is APPENDED instead — never lost, and the test pins the
// anchor.
//
// HER WORDS ARE THE CONTENT HALF, VERBATIM. The one connective line this
// module adds (INVENT_LINE) rides in the wrapper and is stored in promptStyle
// with the [content] seam, so nothing is added invisibly. The whole prompt is
// stored on every card (prompt-record — the hard rule).
//
// MONEY: finding a set draws ONE gpt-image-2 medium 1024x1024 edit with the
// dreamy reference attached — about 6.5c (5.3c the image + ~1.2c the
// reference's input tokens). That call happens only on her deliberate "found a
// set" tap; opening the page spends nothing. Seeding is a chat's container job
// (scripts/seed-triset.js), never this server.
//
// Firestore (deckfactory-43176): forge-triset-cards — one doc per card.
// Seed docs are content-addressed sha1(url) so re-seeding dedupes; made cards
// get fresh ids and carry `from` (which three cards, which kind, her words).
// Nothing is deleted — `hidden` is the verb.
//
// Mounted at /api/triset by server.js (inside loadConfig, for OPENAI_API_KEY);
// init({ gptStyles, fileCreation }) is called once PL_GPT_STYLES exists.
// Page: /triset (serveGated, no pill — one screen).
//
// Routes:
//   GET   /status     → { ok, firebase, openai, style, cards }      (open)
//   GET   /cards      → { cards:[…] }                               (gated)
//   POST  /found      → { cards:[id,id,id], kind, middle, sides? }  (gated, $)
//   GET   /card/:id   → poll one card                               (gated)
//   PATCH /card/:id   → { title?, hidden? }                         (gated)
//   POST  /seed       → { cards:[{title,url,…}] }                   (gated)
//
// Tests: node scripts/test-triset.js (pure + optional headless page half).

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promptRecord, promptFields } = require('./prompt-record');

const router = express.Router();
const CARDS = 'forge-triset-cards';

const QUALITY = 'medium';
const CANVAS = '1024x1024';
const SIZE_TIER = '1K';
const COST_CENTS = 6.5; // 5.3c medium square + ~1.2c dreamy reference input

const KINDS = ['same', 'each'];
const MAX_WORDS = 300; // per quality field — she dictates, but a paragraph is not a quality

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();
const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

// ── the style, handed in (never copied) ────────────────────────────────────
// The TRIANGLE clause — this module's one piece of style wording. It replaces
// dreamy's border clause (the tail names a rectangular hand-drawn frame; a
// triangle card needs a triangle). Stored in promptStyle like everything else.
// EQUILATERAL is spelled out twice (2026-08-30, Sophie: "u didn't specify
// equalateral so the shapes are off") — the first batch came back as steep
// isosceles cards. And a MADE card (the venn center, the middle slot) is
// drawn POINT DOWN (her rule: "the middle card has to be upside down") —
// `flip` on the doc is what tells the page which way to clip it, forever.
const TRIANGLE_UP = 'point up — the flat side on the bottom, one corner at the top';
const TRIANGLE_DOWN = 'point down, upside down — the flat side on TOP, one corner at the bottom';
function triangleClause(invert) {
  return 'Render as ONE single illustration — NOT a grid, NOT split panels. '
    + 'The illustration is an EQUILATERAL TRIANGLE-SHAPED CARD, all three '
    + 'sides exactly the same length, ' + (invert ? TRIANGLE_DOWN : TRIANGLE_UP)
    + ': a triangle with a plain paper border and a hand-drawn frame line, '
    + 'like the frames in the style reference but triangular, on a plain '
    + 'white background, the whole composition inside the triangle. ';
}
const TRIANGLE_CLAUSE = triangleClause(false);
// The connective line for a MADE card (the venn center). Rides in the wrapper
// prefix, so promptStyle discloses it; her words stay verbatim in the content.
const INVENT_LINE = 'Invent ONE new subject that unites the qualities named '
  + 'below, and draw that single subject:';

const STYLE = { id: 'dreamy', label: '', prefix: '', suffix: '', refFiles: [], swapped: false };
let fileCreationFn = null;

// Called by server.js once PL_GPT_STYLES exists (defined long after the mount).
function init({ gptStyles, fileCreation } = {}) {
  if (typeof fileCreation === 'function') fileCreationFn = fileCreation;
  const st = gptStyles && gptStyles.dreamy;
  if (!st) return;
  STYLE.label = st.label || 'Dreamy';
  STYLE.prefix = String(st.prefix || '');
  STYLE.refFiles = Array.isArray(st.refFiles) ? st.refFiles.slice() : [];
  let tail = String(st.suffix || '');
  STYLE.swapped = false;
  // Border → triangle, the swap-never-argue mechanism. `sheet.from` is the
  // tail's own border clause verbatim; when it stops matching (a reword in
  // server.js) the triangle clause is appended instead, never lost. The
  // orientation is per CARD, so the tail holds a placeholder cardPrompt fills.
  const anchor = st.sheet && st.sheet.from;
  if (anchor && tail.includes(anchor)) {
    tail = tail.split(anchor).join('{triangle}');
    STYLE.swapped = true;
  } else {
    tail = '{triangle}' + tail;
  }
  // Her own two words: cards carry no text.
  if (st.noText && st.noText.from && tail.includes(st.noText.from)) {
    tail = tail.split(st.noText.from).join(st.noText.to);
  }
  STYLE.suffix = tail;
}

// ── pure: prompts and validation (exported for the test) ───────────────────
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

// The content half of a card prompt — HER WORDS, joined, nothing invented.
// 'same': the one shared quality. 'each': the 4th thing, then the three
// connections in card order (top, left, right).
function foundContent({ kind, middle, sides } = {}) {
  const mid = clip(middle, MAX_WORDS);
  if (kind === 'each') {
    const ss = (Array.isArray(sides) ? sides : []).map(s => clip(s, MAX_WORDS)).filter(Boolean);
    return [mid, ss.join('; ')].filter(Boolean).join(' — ');
  }
  return mid;
}

// The full record for a card drawn by this module. `invent` marks a made card
// (the venn center gets the connective line); a seed card is just its subject.
// `invert` draws it point down — the made card is the middle, upside-down slot.
function cardPrompt(content, { invent = true, invert = false } = {}) {
  const prefix = [STYLE.prefix, invent ? INVENT_LINE : ''].filter(Boolean).join('\n\n');
  const suffix = STYLE.suffix.split('{triangle}').join(triangleClause(invert));
  return promptRecord({ prefix, content, suffix });
}

// null when well-formed, else a one-line reason.
function validFound(b) {
  if (!b || typeof b !== 'object') return 'not an object';
  const cards = Array.isArray(b.cards) ? b.cards.map(String).filter(Boolean) : [];
  if (cards.length !== 3) return 'cards must be three ids';
  if (new Set(cards).size !== 3) return 'cards must be three different ids';
  if (!KINDS.includes(b.kind)) return 'kind must be same|each';
  if (!clip(b.middle, MAX_WORDS)) return 'middle required';
  if (b.kind === 'each') {
    const ss = (Array.isArray(b.sides) ? b.sides : []).map(s => clip(s, MAX_WORDS)).filter(Boolean);
    if (ss.length !== 3) return 'each needs three sides';
  }
  return null;
}

// A run still unfinished after this long is orphaned by a restart, never slow
// (freeform's rule — judged on read, no sweep to schedule).
const STUCK_MS = 15 * 60 * 1000;
function stuckPatch(card, now = Date.now()) {
  if (!card || card.status !== 'drawing') return null;
  if (now - (card.createdAt || 0) < STUCK_MS) return null;
  return { status: 'failed', error: 'interrupted — the server restarted mid-draw', finishedAt: now };
}

// ── gate (audio.js's, verbatim shape) ──────────────────────────────────────
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '2mb' }));

// ── drawing ────────────────────────────────────────────────────────────────
async function put(buf, p) {
  const file = bucket().file(p);
  await file.save(buf, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${p}`;
}

function refBuffers() {
  return STYLE.refFiles.map(f => fs.readFileSync(path.join(__dirname, 'refs', f)));
}

// One gpt-image-2 edit, the house shape: moderation low, webp out, NO
// output_compression (the lossy-at-birth trap), the reference declared as the
// jpeg it is.
async function draw(prompt, refs) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', prompt);
  fd.append('size', CANVAS);
  fd.append('quality', QUALITY);
  fd.append('output_format', 'webp');
  fd.append('moderation', 'low');
  fd.append('n', '1');
  refs.forEach((b, i) => {
    const jpg = b.length > 2 && b[0] === 0xff && b[1] === 0xd8;
    fd.append('image[]', new Blob([b], { type: jpg ? 'image/jpeg' : 'image/png' }),
      `ref${i + 1}.${jpg ? 'jpg' : 'png'}`);
  });
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: 'Bearer ' + key }, body: fd,
  });
  const d = await r.json();
  // A safety refusal is terminal — never retried (house rule); the error lands
  // on the card doc and the page says so.
  if (d.error) throw new Error(String(d.error.message || d.error.code || 'image failed').slice(0, 300));
  if (!d.data || !d.data[0] || !d.data[0].b64_json) throw new Error('no image returned');
  return Buffer.from(d.data[0].b64_json, 'base64');
}

// Fire-and-forget; the POST has already answered. Every path stamps
// ready/failed on the doc, and the paid bytes are banked before anything else.
async function render(id) {
  const ref = db().collection(CARDS).doc(id);
  try {
    const snap = await ref.get();
    const card = snap.data() || {};
    const buf = await draw(card.fullPrompt, refBuffers());
    const url = await put(buf, `triset/cards/${id}.webp`);
    await ref.set({ url, status: 'ready', finishedAt: Date.now() }, { merge: true });
    // My Creations, best-effort — filing must never fail the card.
    if (fileCreationFn) {
      fileCreationFn({
        url, type: 'image', source: 'triset',
        prompt: card.promptContent || '', model: 'gpt-image-2',
        quality: QUALITY, canvas: CANVAS,
        fullPrompt: card.fullPrompt || '', promptStyle: card.promptStyle || '',
        promptContent: card.promptContent || '',
      }).catch(() => {});
    }
  } catch (e) {
    await ref.set({ status: 'failed', error: String(e.message || e).slice(0, 400), finishedAt: Date.now() },
      { merge: true }).catch(() => {});
  }
}

// ── routes ─────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  let cards = null;
  try { if (admin.apps.length) cards = (await db().collection(CARDS).get()).size; } catch (e) {}
  res.json({
    ok: true, firebase: !!admin.apps.length, openai: !!process.env.OPENAI_API_KEY,
    style: STYLE.label || null, swapped: STYLE.swapped, cards, costCents: COST_CENTS,
  });
});

// The whole pool — a few hundred small docs at most; sorted in memory (house
// rule: no composite indexes). Hidden cards stay out; drawing ones ride along
// so the page can poll a card it started before a reload.
router.get('/cards', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const snap = await db().collection(CARDS).get();
    const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => !c.hidden)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    await Promise.all(cards.map(async c => {
      const patch = stuckPatch(c);
      if (!patch) return;
      Object.assign(c, patch);
      await db().collection(CARDS).doc(c.id).set(patch, { merge: true }).catch(() => {});
    }));
    res.json({ ok: true, cards });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// She found a set → the venn center becomes a new card. The one paid route.
router.post('/found', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'image generation unavailable' });
    const b = req.body || {};
    const bad = validFound(b);
    if (bad) return res.status(400).json({ error: bad });
    const kind = b.kind;
    const middle = clip(b.middle, MAX_WORDS);
    const sides = kind === 'each'
      ? (b.sides || []).map(s => clip(s, MAX_WORDS)).filter(Boolean) : [];
    const content = foundContent({ kind, middle, sides });
    const rec = cardPrompt(content, { invent: true, invert: true });
    const ref = db().collection(CARDS).doc();
    const doc = {
      // flip: a made card is upside down for life — the page clips it point
      // down wherever it is dealt, which is also how you can tell the cards
      // the game made from the seeds.
      title: middle, source: 'made', status: 'drawing', flip: true,
      from: { cards: (b.cards || []).map(String), kind, middle, sides },
      model: 'gpt-image-2', quality: QUALITY, canvas: CANVAS, size: SIZE_TIER,
      ...promptFields(rec),
      createdAt: Date.now(),
    };
    await ref.set(doc);
    render(ref.id); // deliberately not awaited
    res.json({ ok: true, id: ref.id, status: 'drawing', poll: `/api/triset/card/${ref.id}` });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.get('/card/:id', async (req, res) => {
  try {
    const doc = await db().collection(CARDS).doc(String(req.params.id)).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    const card = { id: doc.id, ...doc.data() };
    const patch = stuckPatch(card);
    if (patch) {
      Object.assign(card, patch);
      await doc.ref.set(patch, { merge: true }).catch(() => {});
    }
    res.json({ ok: true, ...card });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// EDITABLE whitelist — everything else is server-owned.
router.patch('/card/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const patch = {};
    if (typeof b.title === 'string') patch.title = clip(b.title, 200);
    if (typeof b.hidden === 'boolean') patch.hidden = b.hidden;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing editable sent' });
    await db().collection(CARDS).doc(String(req.params.id)).set(patch, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// Seeding — a chat's container job posts finished cards here. Content-addressed
// by sha1(url) so re-seeding updates in place, never duplicates. The card
// arrives DRAWN (url + the exact prompt record); this route spends nothing.
router.post('/seed', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const list = Array.isArray(req.body && req.body.cards) ? req.body.cards : [];
    if (!list.length) return res.status(400).json({ error: 'cards required' });
    const out = [];
    for (const c of list.slice(0, 60)) {
      try {
        const url = String((c && c.url) || '');
        const title = clip(c && c.title, 200);
        if (!/^https?:\/\//.test(url)) { out.push({ ok: false, error: 'url required' }); continue; }
        if (!title) { out.push({ ok: false, error: 'title required' }); continue; }
        const id = sha1(url);
        const doc = {
          title, url, source: 'seed', status: 'ready',
          model: String(c.model || 'gpt-image-2'), quality: String(c.quality || QUALITY),
          canvas: String(c.canvas || CANVAS), size: String(c.size || SIZE_TIER),
          createdAt: Number(c.createdMs) || Date.now(),
        };
        // The seed arrives with its record already built (the exact sent
        // text); store it verbatim, dropped-when-empty like promptFields.
        for (const k of ['fullPrompt', 'promptStyle', 'promptContent']) {
          const v = clip(c[k], 6000);
          if (v) doc[k] = v;
        }
        await db().collection(CARDS).doc(id).set(doc, { merge: true });
        out.push({ ok: true, id });
      } catch (e) { out.push({ ok: false, error: String(e.message || e).slice(0, 200) }); }
    }
    res.json({ ok: true, cards: out });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

module.exports = {
  router, init,
  foundContent, cardPrompt, validFound, stuckPatch,
  KINDS, STYLE, TRIANGLE_CLAUSE, triangleClause, INVENT_LINE, STUCK_MS, COST_CENTS,
  // for scripts/seed-triset.js — the seed batch must draw through the exact
  // call a found set draws through, or the pool and the made cards drift.
  draw, refBuffers, QUALITY, CANVAS, SIZE_TIER,
};

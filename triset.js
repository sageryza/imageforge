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
// MONEY: finding a set draws ONE gpt-image-2 edit with the dreamy reference
// attached — LOW while the prompts are being tuned, ~1.8c (0.6c the image +
// ~1.2c the reference's input tokens, which do not get cheaper with the
// quality). That call happens only on her deliberate "found a
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
const { bakeCut, cutPath } = require('./triset-cut');
const pageTemplates = require('./page-templates');

const router = express.Router();
const CARDS = 'forge-triset-cards';
const VOTES = 'forge-asset-votes';
const PAGES = 'forge-chat-pages';
const VERDICTS = 'forge-chat-verdicts';
// The chat whose Compare tab holds the standing page. Fixed on purpose: the
// page is one place she comes back to, and a moving slug would orphan the
// verdicts her ♥ marks live under.
const HOME_CHAT = 'triset-nature-classification';
const WAIT_PAGE = 'triset-waiting';
const NATURE_SLUGS = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, 'docs/triset/nature-slugs.json'), 'utf8')).slugs);

/* ── HER HEARTS ARE THE DECK (2026-09-01, "connect it to the deck so they flow
   in and out automatically") ─────────────────────────────────────────────
   She curates by hearting: a ♥ on a nature card puts it IN the deck, an ✕
   takes it out, wherever she casts it — the Assets tab, Meta Assets, a hearts
   page. Nothing to run by hand and nothing for a chat to remember.

   THE NATURE RULE IS KEPT ON PURPOSE. She spent a day deciding what nature
   means and then asked for a deck of exactly that, so a heart on a card
   OUTSIDE that vocabulary does NOT silently join her deck — it is collected
   for her on a Compare page to add deliberately. Widening this is one line
   (drop the NATURE_SLUGS test) and is hers to ask for.

   AN ✕ HIDES THE CARD, which is how the pool already excludes things — so an
   ✕'d card leaves the deal and, being hidden, leaves every other surface's
   listing too. A card she un-✕s comes back by the same road.

   Cheap by construction: one votes read behind a 60s cache, and it WRITES only
   the cards whose state actually changed, so a settled deck writes nothing. */
const SYNC_MS = 60e3;
let syncAt = 0, syncing = null;

function slugOfUrl(url) {
  const m = String(url || '').match(/cards\/([a-z0-9]+)-(.+)\.webp$/);
  return m ? m[2] : null;
}

// pure: which cards should be IN the deal, given her votes.
//
// Two fields carry two different facts and this rule keeps them apart:
// `hidden` is "not in the pool at all" (508 of the 583 cards are, on purpose
// — the alternates and the subjects she did not keep) and `edition:'nature'`
// is "this is the card the deal shows for this subject".
//
// The votes are per PICTURE, deliberately: the hearts pages pair a subject's
// low and medium generations and ask her to pick BETWEEN them, so an ✕ there
// means "not this drawing", never "not this subject".
//
//   ♥ on a nature subject with nothing in the deal → that card joins it
//   ✕ on the card in the deal                     → it leaves; the next
//                                                    hearted generation of
//                                                    that subject takes over,
//                                                    and with none the
//                                                    subject leaves too
//
// It touches NOTHING else — a heart on a card whose subject is already dealt
// does not swap her printed picture, and a card she has never voted on is
// never moved. So a settled deck writes nothing at all.
const QRANK = { high: 3, medium: 2, low: 1 };
function bestCard(a, b) {
  const q = (QRANK[b.quality] || 0) - (QRANK[a.quality] || 0);
  if (q) return q < 0 ? a : b;
  return (b.createdAt || 0) > (a.createdAt || 0) ? b : a;
}
function syncPlan(cards, voteByUrl, adopted) {
  const IN = slug => NATURE_SLUGS.has(slug) || (adopted && adopted.has(slug));
  const patch = new Map();
  const put = (c, k, v) => {
    // most cards carry no `hidden` field at all, so compare it as a truth
    // value — or a settled deck rewrites every doc it reads
    if (k === 'hidden' ? !!c[k] === !!v : (c[k] || '') === v) return;
    const p = patch.get(c.id) || {}; p[k] = v; patch.set(c.id, p);
  };
  const bySlug = new Map();
  for (const c of cards) {
    const slug = slugOfUrl(c.url);
    if (!slug || !IN(slug)) continue;   // her vocabulary, plus what she adopted
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(c);
  }
  for (const [, group] of bySlug) {
    const out = group.filter(c => c.edition === 'nature' && !c.hidden
      && voteByUrl[c.url] === 'dislike');
    // the incumbent, unless she crossed it out
    let held = group.find(c => c.edition === 'nature' && !c.hidden
      && voteByUrl[c.url] !== 'dislike');
    if (!held) {
      const up = group.filter(c => voteByUrl[c.url] === 'like');
      if (up.length) held = up.reduce(bestCard);
    }
    for (const c of out) { put(c, 'hidden', true); if (c !== held) put(c, 'edition', ''); }
    if (held) { put(held, 'edition', 'nature'); put(held, 'hidden', false); }
    // one card per subject: the page deals every nature-tagged card, so a
    // second tagged generation would deal the same subject twice
    for (const c of group) {
      if (c !== held && c.edition === 'nature' && !c.hidden) put(c, 'edition', '');
    }
  }
  return [...patch].map(([id, p]) => ({ id, patch: p }));
}

/* ── THE WAITING ROOM (2026-09-01, Sophie: "make a compare page that auto
   adds new triangle hearts from elsewhere / and add them") ────────────────
   A standing Compare page in her Similitude chat holding every triangle card
   she has hearted that is NOT in the deal — the 38 subjects outside her
   nature vocabulary, plus any new one she hearts anywhere.

   HER ♥ ON THAT PAGE IS THE ADOPTION, and it is a DIFFERENT signal from the
   heart that put the card on the page: a page mark lands on the page's own
   verdict doc, not on the asset vote, so "I like this drawing" and "put this
   in my deck" stay two separate answers. That is what lets the nature
   vocabulary hold without a heart anywhere in the app silently widening her
   set. An ✕ there says no and the card stops being offered.

   It is kept the way runAutoCompare keeps its standing grids: one fixed doc
   id, the data hashed, rewritten only when the set really changes — so her
   marks survive every rebuild, because an item's id is its SUBJECT SLUG. */
function waitingPlan(cards, voteByUrl, verdicts) {
  const dealt = new Set();
  const best = new Map();
  for (const c of cards) {
    const slug = slugOfUrl(c.url);
    if (!slug) continue;
    if (c.edition === 'nature' && !c.hidden) { dealt.add(slug); continue; }
    if (voteByUrl[c.url] !== 'like') continue;
    if (verdicts[slug] === false) continue;          // she said no on the page
    const cur = best.get(slug);
    best.set(slug, cur ? bestCard(cur, c) : c);
  }
  const items = [];
  for (const [slug, c] of [...best].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    if (dealt.has(slug)) continue;
    items.push({
      id: slug,
      img: c.url,
      label: c.promptContent || slug.replace(/-/g, ' '),
      url: c.url,
      model: c.model || '',
      quality: c.quality || '',
    });
  }
  return items;
}

// Which subjects she has ADOPTED on the page — read back so the sync can deal
// them in even though they sit outside the nature vocabulary.
function adoptedFrom(verdicts) {
  return new Set(Object.keys(verdicts || {}).filter(k => verdicts[k] === true));
}

// The standing page itself, kept the runAutoCompare way: fixed doc id, the
// data hashed, rewritten only when the set really changes. It is a DECK
// (swipe), because the question is one card at a time — in or out.
async function writeWaiting(items) {
  const data = {
    template: 'deck', items,
    help: 'Triangle cards you hearted that are not in the Similitude deck yet. '
      + '♥ adds one to the deal; ✕ stops it being offered. New hearts arrive here on their own.',
    browse: true, stamp: false, voice: true,
  };
  const v = pageTemplates.validateTemplate('deck', data);
  if (!v.ok) return { ok: false, error: v.error };
  const title = `New triangle hearts (${items.length})`;
  const json = JSON.stringify(v.data);
  const hash = crypto.createHash('sha1').update(`${title}\n${json}`).digest('hex');
  const ref = db().collection(PAGES).doc(WAIT_PAGE);
  const snap = await ref.get();
  if (snap.exists && snap.data().dataHash === hash) return { ok: true, unchanged: true };
  if (!items.length && !snap.exists) return { ok: true, empty: true };
  const file = admin.storage().bucket().file(`chat-pages/${WAIT_PAGE}.json`);
  await file.save(Buffer.from(json, 'utf8'), { contentType: 'application/json', resumable: false });
  const stamp = new Date().toISOString();
  const base = { title, dataHash: hash, updated: stamp };
  if (snap.exists) await ref.set(base, { merge: true });
  else {
    await ref.set({
      ...base, chat: HOME_CHAT, heading: '', created: stamp,
      template: 'deck', path: file.name,
    });
  }
  return { ok: true, count: items.length, created: !snap.exists };
}

async function syncHearts() {
  if (syncing) return syncing;
  if (Date.now() - syncAt < SYNC_MS) return [];
  syncing = (async () => {
    const [cardSnap, voteSnap] = await Promise.all([
      db().collection(CARDS).get(), db().collection(VOTES).get(),
    ]);
    const cards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const voteByUrl = {};
    voteSnap.forEach(d => {
      const v = d.data() || {};
      if (v.url && (v.vote === 'like' || v.vote === 'dislike')) voteByUrl[v.url] = v.vote;
    });
    const vsnap = await db().collection(VERDICTS)
      .doc(`${HOME_CHAT}__page-${WAIT_PAGE}`).get().catch(() => null);
    const verdicts = (vsnap && vsnap.exists && vsnap.data().items) || {};
    const plan = syncPlan(cards, voteByUrl, adoptedFrom(verdicts));
    for (const p of plan) await db().collection(CARDS).doc(p.id).set(p.patch, { merge: true });
    // the page is rebuilt AFTER the deal, so a card adopted this pass has
    // already left the waiting room by the time she opens it
    const after = cards.map(c => ({ ...c, ...(plan.find(p => p.id === c.id) || {}).patch }));
    await writeWaiting(waitingPlan(after, voteByUrl, verdicts)).catch(() => {});
    syncAt = Date.now();
    return plan;
  })().catch(() => []).finally(() => { syncing = null; });
  return syncing;
}

// LOW while the prompts are being perfected (2026-08-30, Sophie: "draw low
// quality while we perfect the prompts etc") — one line to raise it back.
// TRISET_QUALITY overrides it for ONE container job (2026-08-31, Sophie:
// "draw as medium triangle squares"), so a batch she asks for at medium does
// not quietly raise the price of every found-set draw she taps in the game.
const QUALITY = ['low', 'medium', 'high'].includes(process.env.TRISET_QUALITY)
  ? process.env.TRISET_QUALITY : 'low';
const CANVAS = '1024x1024';
const SIZE_TIER = '1K';
// square 1K output (docs/modules/pictures.md) + ~1.2c of dreamy reference input
const COST_CENTS = { low: 1.8, medium: 6.5, high: 22.3 }[QUALITY];

// 'auto' (2026-08-30, Sophie: "a prompt explaining the rules of set and have
// the image model come up w something that shares each one") — the three
// dealt cards are ATTACHED and the model plays the game itself: it finds the
// connection (either kind) and draws the venn center. No words of hers ride
// along, so the content half is honestly empty and the whole prompt is the
// wrapper.
const KINDS = ['same', 'each', 'auto'];
const MAX_WORDS = 300; // per quality field — she dictates, but a paragraph is not a quality

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();
const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

// ── the style, handed in (never copied) ────────────────────────────────────
// The TRIANGLE clause replaces dreamy's border clause (the tail names a
// rectangular hand-drawn frame; a triangle card needs a triangle). Stored in
// promptStyle like everything else.
// THE WORDING LIVES IN triangle-clause.js, NOT HERE (2026-08-31) — the
// Playground's Triangle tile draws the same card, so a copy here would mean a
// card she likes in the game and one she draws in the Playground drifting
// apart. A MADE card (the venn center, the middle slot) is drawn POINT DOWN
// (her rule: "the middle card has to be upside down") — `flip` on the doc is
// what tells the page which way to clip it, forever.
const { triangleClause, TRIANGLE_CLAUSE, swapTail } = require('./triangle-clause');
// The connective line for a MADE card (the venn center). Rides in the wrapper
// prefix, so promptStyle discloses it; her words stay verbatim in the content.
const INVENT_LINE = 'Invent ONE new subject that unites the qualities named '
  + 'below, and draw that single subject:';
// The rules line for an 'auto' set — the model reads the three attached cards
// and finds the connection itself, either kind the game allows.
const AUTO_RULES = 'After the style reference, the three attached images are '
  + 'three triangular picture cards from a matching game. Play the game: '
  + 'either find ONE quality all three cards share, or invent a fourth thing '
  + 'that shares a DIFFERENT quality with each of the three. Draw ONE new '
  + 'single subject — the thing that connects them — as a new card. Do not '
  + "copy any of the three cards' subjects.";

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
  // Border → triangle, the swap-never-argue mechanism (triangle-clause.js's
  // `swapTail`, shared with the Playground tile). `sheet.from` is the tail's
  // own border clause verbatim; when it stops matching (a reword in server.js)
  // the triangle clause is prepended instead, never lost. The orientation is
  // per CARD, so the tail holds a placeholder cardPrompt fills.
  const swap = swapTail(tail, st.sheet && st.sheet.from, '{triangle}');
  tail = swap.tail;
  STYLE.swapped = swap.swapped;
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
  if (kind === 'auto') return '';
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
function cardPrompt(content, { invent = true, invert = false, auto = false } = {}) {
  const line = auto ? AUTO_RULES : (invent ? INVENT_LINE : '');
  const prefix = [STYLE.prefix, line].filter(Boolean).join('\n\n');
  const suffix = STYLE.suffix.split('{triangle}').join(triangleClause(invert));
  return promptRecord({ prefix, content, suffix });
}

// A made card stays in its EDITION (2026-08-31, the color edition: 12 pastel
// wheel cards seeded as `edition:'color'`). When all three source cards carry
// the same edition, the venn card rides onto it — three colors mix to a
// color, and filing the mix plain would drop it out of the deck it was found
// in. Any disagreement, or no edition at all, files it plain; null is the
// honest default, never a guess. Pure — the /found route feeds it the three
// docs' values.
function editionOf(eds) {
  const list = (Array.isArray(eds) ? eds : []).map(e => (typeof e === 'string' ? e.trim() : ''));
  return (list.length === 3 && list[0] && list.every(e => e === list[0])) ? list[0] : null;
}

// THREE HEX CARDS MIX IN CODE (2026-08-31, Sophie on the color edition: "for
// now the digital version just hex colors"). A hex card is a card whose doc
// carries `hex` and no picture, and the venn center of three colors IS their
// blend — computed, instant, free, never a model call. The mix is the
// per-channel GEOMETRIC MEAN in normalized sRGB: subtractive like paint (blue
// and yellow make green, red and yellow make orange), normalized for the
// count so three pastels stay pastel where a straight multiply goes muddy.
function mixHex(hexes) {
  const rgb = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim());
    if (!m) return null;
    return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  };
  const cs = (Array.isArray(hexes) ? hexes : []).map(rgb);
  if (cs.length !== 3 || cs.some(c => !c)) return null;
  return '#' + [0, 1, 2].map(ch => {
    const g = Math.cbrt(cs[0][ch] * cs[1][ch] * cs[2][ch]);
    return Math.round(g * 255).toString(16).padStart(2, '0');
  }).join('');
}

// null when well-formed, else a one-line reason.
function validFound(b) {
  if (!b || typeof b !== 'object') return 'not an object';
  const cards = Array.isArray(b.cards) ? b.cards.map(String).filter(Boolean) : [];
  if (cards.length !== 3) return 'cards must be three ids';
  if (new Set(cards).size !== 3) return 'cards must be three different ids';
  if (!KINDS.includes(b.kind)) return 'kind must be same|each|auto';
  if (b.kind !== 'auto' && !clip(b.middle, MAX_WORDS)) return 'middle required';
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
    const refs = refBuffers();
    // an auto set rides the three cards behind the style reference
    for (const u of ((card.from && card.from.urls) || [])) {
      const r = await fetch(u);
      if (!r.ok) throw new Error('could not fetch a source card (' + r.status + ')');
      refs.push(Buffer.from(await r.arrayBuffer()));
    }
    const buf = await draw(card.fullPrompt, refs);
    // bank the paid bytes FIRST (still 'drawing' — the poll waits for ready)
    const url = await put(buf, `triset/cards/${id}.webp`);
    await ref.set({ url }, { merge: true });
    // the die-cut is a derived display copy and best-effort: a bake failure
    // must never fail a paid card — the page falls back to the fixed mapping
    let cut = null;
    try { cut = await put((await bakeCut(buf, { flip: !!card.flip })).buf, cutPath(id)); }
    catch (e) { /* cut-less card still plays */ }
    await ref.set({ ...(cut ? { cut } : {}), status: 'ready', finishedAt: Date.now() }, { merge: true });
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

// ── the die-cut sweep ──────────────────────────────────────────────────────
// Bake the cut copy for every ready card missing one (a seed batch, a card
// whose bake failed). One at a time, fire-and-forget; /status reports the
// job. `force` re-bakes everything — only useful together with a
// CUT_VERSION bump (the objects are served immutable, so a same-version
// re-bake hides behind the CDN for a year).
let recutJob = null;
async function bakeCard(id, card) {
  const r = await fetch(card.url);
  if (!r.ok) throw new Error('fetch ' + r.status);
  const { buf } = await bakeCut(Buffer.from(await r.arrayBuffer()), { flip: !!card.flip });
  const cut = await put(buf, cutPath(id));
  await db().collection(CARDS).doc(id).set({ cut }, { merge: true });
  return cut;
}
async function bakeMissing(force) {
  const snap = await db().collection(CARDS).get();
  const need = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.status === 'ready' && c.url && (force || !c.cut));
  recutJob = { running: true, total: need.length, done: 0, failed: 0, startedAt: Date.now() };
  for (const c of need) {
    try { await bakeCard(c.id, c); recutJob.done++; }
    catch (e) { recutJob.failed++; }
  }
  recutJob.running = false;
  return recutJob;
}

// ── routes ─────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  let cards = null;
  try { if (admin.apps.length) cards = (await db().collection(CARDS).get()).size; } catch (e) {}
  res.json({
    ok: true, firebase: !!admin.apps.length, openai: !!process.env.OPENAI_API_KEY,
    style: STYLE.label || null, swapped: STYLE.swapped, cards, costCents: COST_CENTS,
    recut: recutJob,
  });
});

router.post('/recut', async (req, res) => {
  if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
  if (recutJob && recutJob.running) return res.status(409).json({ error: 'already running', job: recutJob });
  bakeMissing(!!(req.body || {}).force).catch(() => { if (recutJob) recutJob.running = false; });
  res.json({ ok: true, started: true });
});

// The whole pool — a few hundred small docs at most; sorted in memory (house
// rule: no composite indexes). Hidden cards stay out; drawing ones ride along
// so the page can poll a card it started before a reload.
router.get('/cards', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    await syncHearts();                 // her ♥/✕ flow the deck in and out
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

/* ── PLAYING AGAINST THE COMPUTER (2026-09-01, Sophie: "make it possible to
   play against a computer") ──────────────────────────────────────────────
   TURN-BASED, NEVER A TIMER. She looks for as long as she likes; when she is
   done looking she taps ITS TURN and the computer answers with a set or a
   pass. Racing her against a clock would turn a quiet game into a reflex
   test, which is not what this is.

   IT PLAYS FROM THE CARDS' OWN PROMPTS, not from the pictures — those words
   ARE what drew each card, so it is reading the same thing she is looking at,
   and a text call is about a tenth of a cent where a vision call is cents.
   It never draws: a set it finds is announced and SHE decides whether to
   spend the ~2¢ on the venn card, so the computer can never spend her money.

   IT IS ALLOWED TO PASS, and that matters — an opponent that always finds
   something is not playing, it is narrating. The prompt says a stretch is a
   pass, and a pass is what hands the turn back. */
const OPPONENT_SYSTEM = [
  'You are playing Similitude, a card game. Three triangular picture cards are on the table.',
  'You are given the prompt that drew each one — that IS the card.',
  '',
  'ALL THE SAME: name ONE thing all three genuinely share. Not a category so broad it fits',
  'any three things ("they are objects", "they exist", "they are drawings", "they are round-ish").',
  'EACH DIFFERENT: name a FOURTH thing, and say what each card separately shares with it.',
  '',
  'A STRETCH IS A PASS. If the three do not really connect, pass — that is a normal move and',
  'a better one than a weak claim. Be honest rather than clever.',
].join('\n');

function opponentPrompt(cards, kind) {
  const list = cards.map((c, i) => `${i + 1}. ${c}`).join('\n');
  if (kind === 'each') {
    return `${list}\n\nAnswer JSON: {"found":true,"middle":"the fourth thing",`
      + `"sides":["what card 1 shares with it","card 2","card 3"]} or {"found":false,"why":"one short line"}.`;
  }
  return `${list}\n\nAnswer JSON: {"found":true,"middle":"the one thing all three share"}`
    + ` or {"found":false,"why":"one short line"}.`;
}

// pure: what the model said, cleaned into a move — exported for the test
function opponentMove(raw, kind) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const middle = String(d.middle || '').trim().slice(0, MAX_WORDS);
  const why = String(d.why || '').trim().slice(0, MAX_WORDS);
  if (!d.found || !middle) return { found: false, why: why || 'nothing here' };
  if (kind === 'each') {
    const sides = Array.isArray(d.sides) ? d.sides.map(x => String(x || '').trim().slice(0, MAX_WORDS)) : [];
    // a claim missing a side is not a claim — it passes rather than half-scoring
    if (sides.length !== 3 || sides.some(x => !x)) return { found: false, why: why || 'nothing here' };
    return { found: true, middle, sides };
  }
  return { found: true, middle };
}

// Free to open, cheap to tap: one small text call, no picture, no card written.
router.post('/opponent', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const anthropic = require('./anthropic');
    if (!anthropic.available()) return res.status(503).json({ error: 'the opponent runs on Claude; the key is not set' });
    const b = req.body || {};
    const ids = Array.isArray(b.cards) ? b.cards.slice(0, 3).map(String) : [];
    if (ids.length !== 3) return res.status(400).json({ error: 'three cards are required' });
    const kind = KINDS.includes(b.kind) ? b.kind : 'same';
    const docs = await Promise.all(ids.map(id => db().collection(CARDS).doc(id).get()));
    if (docs.some(d => !d.exists)) return res.status(400).json({ error: 'card not found' });
    const words = docs.map(d => (d.data().promptContent || d.data().title || '').trim());
    if (words.some(w => !w)) return res.status(400).json({ error: 'a card has no words to play from' });
    const raw = await anthropic.chatJSON({
      system: OPPONENT_SYSTEM, user: opponentPrompt(words, kind), maxTokens: 400,
    });
    res.json({ ok: true, ...opponentMove(raw, kind) });
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
    // Resolve the three source cards ONCE — auto needs their urls (a bad id
    // refuses before any money moves), every kind reads edition and hex.
    const srcDocs = [];
    for (const id of b.cards.map(String)) {
      const snap = await db().collection(CARDS).doc(id).get();
      srcDocs.push(snap.exists ? { id, ...snap.data() } : { id });
    }
    // the made card stays in its edition — see editionOf
    const edition = editionOf(srcDocs.map(c => c.edition || null));
    // three hex color cards → the blend, computed and filed ready, free.
    // auto is refused honestly: there is no picture for the model to read.
    const hex = mixHex(srcDocs.map(c => c.hex));
    if (hex) {
      if (kind === 'auto') return res.status(400).json({ error: 'color cards mix by themselves — name the mix instead' });
      const ref = db().collection(CARDS).doc();
      await ref.set({
        title: middle, hex, source: 'made', status: 'ready', flip: true,
        ...(edition ? { edition } : {}),
        from: { cards: b.cards.map(String), kind, middle, sides, urls: [] },
        createdAt: Date.now(),
      });
      return res.json({ ok: true, id: ref.id, status: 'ready', hex, poll: `/api/triset/card/${ref.id}` });
    }
    const srcCards = [];
    if (kind === 'auto') {
      for (const c of srcDocs) {
        if (!c.url) return res.status(400).json({ error: 'unknown card ' + c.id });
        srcCards.push({ id: c.id, title: c.title || '', url: c.url });
      }
    }
    const content = foundContent({ kind, middle, sides });
    const rec = cardPrompt(content, { invent: kind !== 'auto', invert: true, auto: kind === 'auto' });
    // The model finds the connection, so nobody typed a name — the honest
    // title is the three cards it read.
    const title = kind === 'auto'
      ? srcCards.map(c => c.title).filter(Boolean).join(' + ') : middle;
    const ref = db().collection(CARDS).doc();
    const doc = {
      // flip: a made card is upside down for life — the page clips it point
      // down wherever it is dealt, which is also how you can tell the cards
      // the game made from the seeds.
      title, source: 'made', status: 'drawing', flip: true,
      ...(edition ? { edition } : {}),
      from: { cards: (b.cards || []).map(String), kind, middle, sides,
        urls: srcCards.map(c => c.url) },
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
    // die-cuts for the batch, in the background (best-effort; the sweep or
    // scripts/triset-recut.js catches anything this misses)
    if (!(recutJob && recutJob.running)) bakeMissing(false).catch(() => { if (recutJob) recutJob.running = false; });
    res.json({ ok: true, cards: out });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

module.exports = {
  router, init,
  foundContent, cardPrompt, validFound, stuckPatch, bakeCard, editionOf, mixHex,
  syncPlan, syncHearts, slugOfUrl, bestCard, waitingPlan, adoptedFrom, writeWaiting,
  opponentMove, opponentPrompt, OPPONENT_SYSTEM,
  KINDS, STYLE, TRIANGLE_CLAUSE, triangleClause, INVENT_LINE, AUTO_RULES, STUCK_MS, COST_CENTS,
  // for scripts/seed-triset.js — the seed batch must draw through the exact
  // call a found set draws through, or the pool and the made cards drift.
  draw, refBuffers, QUALITY, CANVAS, SIZE_TIER,
};

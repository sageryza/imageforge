// similitude-two.js — Similitude for two people on two phones, anyone's.
//
// Sophie (2026-09-04): "how can we make this multiplayer" → "same cards as the
// dominoes deck. turns. just cap the drawing at like a dollar per person".
// So: the triangle game (public/triset.html's rules) played by two people
// from their own phones, over the same two-seat TABLE the dominoes game sits
// at (table.js — seats, invite, turn gate, the your-turn text), dealing the
// SAME 61 cards the dominoes page deals, and with the one paid tap — Draw it!,
// the venn card — capped per seat.
//
// The page (public/similitude-two.html) holds the rules and writes the whole
// table state on its turn, exactly as dominoes does; this module adds the
// three things a Similitude table needs that a dominoes table does not:
//   GET  /deck                       the 61 cards, resolved to their CURRENT
//                                    cut and words (public — the page is)
//   POST /rooms/:id/challenge        {token, card, rule} → the referee
//                                    (triset.js's judgeChallenge, ~0.1c)
//   POST /rooms/:id/draw             {token, win, cards, kind, middle, sides}
//                                    → the paid venn card (triset.js's
//                                    startFound, ~2c / ~5c), CAPPED at
//                                    CAP_CENTS per seat per table
// and rides `draws` + `spent` on every room read, resolving a drawing card to
// its picture on the way past (the stuckPatch pattern — judged on read).
//
// THE DECK IS THE DOMINOES DECK BY CONSTRUCTION: the ids are read out of
// public/dominoes.html's own DECK constant at first use, never a second list.
// The cut each card shows is whatever the card doc carries NOW (c5 today),
// so a re-cut reaches this table without touching anything here.
//
// THE CAP IS SERVER-SIDE AND PER SEAT. A public page cannot be trusted to
// count, so the room doc carries `spent: {a, b}` in cents and the draw route
// reserves the cost in a transaction BEFORE the card is started; a start that
// fails hands the cents back. A player who has drawn their dollar's worth is
// refused with 402 and the page says so. Sophie's own tables are no
// exception — the cap is the rule of the table, not of the stranger.
//
// Firestore: forge-similitude-rooms, one doc per table.
'use strict';
const fs = require('fs');
const path = require('path');
const { makeTable } = require('./table');
const triset = require('./triset');

const CARDS = 'forge-triset-cards';
const CAP_CENTS = 100;                     // "like a dollar per person"
const DECK_TTL_MS = 60 * 1000;

// ── the deck: the dominoes page's 61 ─────────────────────────────────────
let _deckIds = null;
function deckIds() {
  if (_deckIds) return _deckIds;
  const html = fs.readFileSync(path.join(__dirname, 'public', 'dominoes.html'), 'utf8');
  const at = html.indexOf('var DECK = [');
  if (at < 0) throw new Error('dominoes.html carries no DECK');
  // walk to the matching bracket (the line ends in a comment, so a regex
  // to the first `];` is not enough); strings are skipped, brackets counted
  const start = at + 'var DECK = '.length;
  let depth = 0; let inStr = false; let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (!depth) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('dominoes.html DECK never closes');
  _deckIds = JSON.parse(html.slice(start, end)).map(c => String(c.k || '').split('.')[0]).filter(Boolean);
  return _deckIds;
}
// what one card looks like to a public page: the picture and the words that
// drew it, nothing else off the doc
function publicCard(id, d) {
  if (!d || d.status !== 'ready' || d.hidden) return null;
  if (!d.cut && !d.url && !d.hex) return null;
  return { id, cut: d.cut || null, url: d.url || null, hex: d.hex || null,
    flip: !!d.flip, title: d.title || '', words: d.promptContent || d.title || '' };
}
let _deck = null; let _deckAt = 0;
async function deck(db) {
  if (_deck && Date.now() - _deckAt < DECK_TTL_MS) return _deck;
  const ids = deckIds();
  const snaps = await Promise.all(ids.map(id => db.collection(CARDS).doc(id).get()));
  _deck = snaps.map((s, i) => publicCard(ids[i], s.exists ? s.data() : null)).filter(Boolean);
  _deckAt = Date.now();
  return _deck;
}
function forgetDeck() { _deck = null; _deckAt = 0; _deckIds = null; }

// ── the pure decisions (tested without Firestore) ────────────────────────
const costOf = (kind) => (kind === 'auto' ? triset.AUTO_COST_CENTS : triset.COST_CENTS);
// May `me` start this draw? {ok} | {ok:false, why, code}
function drawGate(room, me, body) {
  if (!me) return { ok: false, why: 'not seated', code: 403 };
  const st = room.state;
  if (!st || !Array.isArray(st.wins)) return { ok: false, why: 'nothing has been won at this table yet', code: 409 };
  if (!body || String(body.game || '') !== String(st.game || '')) return { ok: false, why: 'that set is from another game', code: 409 };
  const w = st.wins[Number(body.win)];
  if (!w) return { ok: false, why: 'no such set', code: 400 };
  if (w.by !== me) return { ok: false, why: 'you can only draw a set you found', code: 403 };
  const cards = Array.isArray(body.cards) ? body.cards.map(String) : [];
  const same = cards.length === 3 && Array.isArray(w.cards) && w.cards.every((c, i) => String(c) === cards[i]);
  if (!same) return { ok: false, why: 'those are not the cards of that set', code: 400 };
  const draws = Array.isArray(room.draws) ? room.draws : [];
  if (draws.some(d => d.game === st.game && d.win === Number(body.win) && d.status !== 'failed')) return { ok: false, why: 'that set already has its card', code: 409 };
  const spent = (room.spent && room.spent[me]) || 0;
  const cost = costOf(body.kind);
  if (spent + cost > CAP_CENTS + 1e-9) return { ok: false, why: 'you have drawn your dollar\'s worth at this table', code: 402 };
  return { ok: true, cost };
}
function spentView(room) {
  return { a: (room.spent && room.spent.a) || 0, b: (room.spent && room.spent.b) || 0 };
}

// ── the table ─────────────────────────────────────────────────────────────
const table = makeTable({
  collection: 'forge-similitude-rooms',
  page: '/similitude/play',
  title: 'Similitude',
  siteEnv: 'SIMILITUDE_SITE_ORIGIN',
  extendView: (room) => ({ draws: Array.isArray(room.draws) ? room.draws : [], spent: spentView(room), cap: CAP_CENTS }),
  enrich: async (room) => ({ draws: await resolveDraws(room) }),
});
const { router, db, docRef, load, _internals } = table;
const { seatOf } = _internals;

// a drawing card is resolved on the way past a read — the same judged-on-read
// shape as triset's stuckPatch, so no sweep has to be scheduled
async function resolveDraws(room) {
  const draws = Array.isArray(room.draws) ? room.draws : [];
  let changed = false;
  for (const d of draws) {
    if (d.status !== 'drawing' || !d.card) continue;
    const snap = await db().collection(CARDS).doc(d.card).get();
    const c = snap.exists ? snap.data() : null;
    const patch = c ? triset.stuckPatch({ ...c }) : null;
    const status = patch ? patch.status : (c && c.status);
    if (status === 'ready') {
      Object.assign(d, { status: 'ready', cut: c.cut || null, url: c.url || null, hex: c.hex || null, title: c.title || '' });
      changed = true;
    } else if (status === 'failed' || !c) {
      d.status = 'failed'; d.error = (patch && patch.error) || (c && c.error) || 'lost';
      changed = true;
    }
  }
  if (changed) await docRef(room.id).set({ draws, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
  return draws;
}

router.get('/deck', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, cards: await deck(db()) });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// the room read already resolves draws (enrich) — this is the same answer
// on its own, for a page that only wants to know about the cards
router.get('/rooms/:id/draws', async (req, res) => {
  try {
    const room = await load(req.params.id);
    if (!room) return res.status(404).json({ error: 'no such table' });
    if (!seatOf(room, req.query.token)) return res.status(403).json({ error: 'not seated' });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, draws: await resolveDraws(room), spent: spentView(room), cap: CAP_CENTS });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.post('/rooms/:id/challenge', async (req, res) => {
  try {
    const room = await load(req.params.id);
    if (!room) return res.status(404).json({ error: 'no such table' });
    const me = seatOf(room, req.body && req.body.token);
    if (!me) return res.status(403).json({ error: 'not seated' });
    // a challenge is a MOVE, so only the player on turn may ask the referee —
    // an off-turn phone could never write the result anyway
    if (!room.state || room.state.turn !== me) return res.status(409).json({ error: 'not your turn' });
    const b = req.body || {};
    res.json({ ok: true, ...(await triset.judgeChallenge(b.card, b.rule)) });
  } catch (err) { res.status(err.code || 502).json({ error: err.message }); }
});

router.post('/rooms/:id/draw', async (req, res) => {
  try {
    const b = req.body || {};
    const ref = docRef(req.params.id);
    let me = null; let cost = 0;
    // reserve the cents FIRST, in a transaction — two taps cannot both fit
    // under the cap by reading the same balance
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error('no such table'), { code: 404 });
      const room = snap.data();
      me = seatOf(room, b.token);
      const gate = drawGate(room, me, b);
      if (!gate.ok) throw Object.assign(new Error(gate.why), { code: gate.code, spent: spentView(room), cap: CAP_CENTS });
      cost = gate.cost;
      const spent = spentView(room); spent[me] = Math.round((spent[me] + cost) * 10) / 10;
      tx.set(ref, { spent, updatedAt: new Date().toISOString() }, { merge: true });
    });
    let out;
    try {
      out = await triset.startFound({ cards: b.cards, kind: b.kind, middle: b.middle, sides: b.sides });
    } catch (e) {
      // the start failed before any money moved — hand the cents back
      await db().runTransaction(async (tx) => {
        const room = (await tx.get(ref)).data() || {};
        const spent = spentView(room); spent[me] = Math.max(0, Math.round((spent[me] - cost) * 10) / 10);
        tx.set(ref, { spent }, { merge: true });
      }).catch(() => {});
      throw e;
    }
    const entry = { game: String(b.game), win: Number(b.win), by: me, card: out.id, kind: b.kind, cents: out.free ? 0 : cost,
      status: out.status === 'ready' ? 'ready' : 'drawing', at: new Date().toISOString(),
      ...(out.hex ? { hex: out.hex } : {}) };
    await db().runTransaction(async (tx) => {
      const room = (await tx.get(ref)).data() || {};
      const draws = Array.isArray(room.draws) ? room.draws : [];
      draws.push(entry);
      const patch = { draws, updatedAt: entry.at };
      if (out.free) { const spent = spentView(room); spent[me] = Math.max(0, Math.round((spent[me] - cost) * 10) / 10); patch.spent = spent; }
      tx.set(ref, patch, { merge: true });
    });
    const room = await load(req.params.id);
    res.json({ ok: true, card: out.id, status: entry.status, spent: spentView(room), cap: CAP_CENTS });
  } catch (err) {
    const body = { error: err.message };
    if (err.spent) { body.spent = err.spent; body.cap = err.cap; }
    res.status(err.code || 502).json(body);
  }
});

module.exports = {
  router, init: table.init, CAP_CENTS, costOf,
  _internals: Object.assign({ drawGate, spentView, deckIds, publicCard, forgetDeck, resolveDraws }, _internals),
};

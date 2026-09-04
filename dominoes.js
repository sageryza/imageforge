// dominoes.js — Similitude Dominoes for two people on two phones, anyone's.
//
// Sophie (2026-09-04): "i want to play against my friend miriam. no computer"
// → "i'm more wanting to build it for anyone so i can share it on ig". So this
// is a PUBLIC table, not a Compare page: someone starts a table with their
// name, sends the invite link, the friend joins with theirs, and the two play
// from their own phones. The page (public/dominoes.html) holds the whole
// game — the rules, the cards, the words she types — and this module is the
// TABLE: who sits where, whose turn it is, and the text that says so.
//
// WHAT THE SERVER OWNS (and the page cannot lie about):
//   • the two SEATS — each player's own unguessable token is their identity
//     (the fruit poll's `who=` pattern: the link IS the login, nothing to
//     sign up for), and the invite token is what lets exactly one friend in;
//   • the TURN GATE — a move is accepted only from the player the stored
//     state says is on turn (or either player once a round is over, or
//     anyone at an empty table), so a stale phone can never overwrite a
//     fresher one;
//   • the TURN TEXT — when a move hands the turn over, the other player gets
//     one SMS (sms.js, Twilio) if they gave a number, deduped on the move
//     number so a retried write cannot text twice.
// Phones and tokens NEVER ride a read for the other player — a room read
// says only whether the other seat has a number.
//
// Routes (all public; per-IP rate limit like fruit.js / selfcare.js):
//   POST /rooms                 {name, phone?}               → {room, token, invite}
//   POST /rooms/:id/join        {invite, name, phone?}       → {token}
//   GET  /rooms/:id?token=                                   → the table as this player sees it
//   POST /rooms/:id/move        {token, state, links?, line} → {ok, n}
//   POST /rooms/:id/phone       {token, phone}               → {ok, phone:bool}
//   GET  /status                                             → {ok, sms:bool}
// Firestore: forge-dominoes-rooms, one doc per table. It costs nothing — no
// model call anywhere; a text is Twilio's own fraction of a cent.
'use strict';
const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');
const sms = require('./sms');

const ROOMS = 'forge-dominoes-rooms';
const SITE = process.env.DOMINOES_SITE_ORIGIN || 'https://imageforge-q125.onrender.com';
// `init({ db })` hands in a Firestore handle (the test hands in a fake one);
// without it the module reads the app's own, like every sibling.
let _db = null;
const db = () => _db || admin.firestore();
function init(o) { if (o && o.db) _db = o.db; }
const token = () => crypto.randomBytes(8).toString('hex');
const roomId = () => crypto.randomBytes(5).toString('hex');
const now = () => new Date().toISOString();

/* ── Public-route rate limit (fruit.js's, verbatim in shape) ─────────────── */
const RATE_MAX = 900;                       // a game polls every 2.5s: ~1,440/h; two tabs share an IP
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();
function rateLimited(ip) {
  const t = Date.now();
  const list = (hits.get(ip) || []).filter(x => t - x < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(t); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 24);
const other = (p) => (p === 'a' ? 'b' : 'a');

// ── the pure decisions (tested without Firestore) ────────────────────────
// Who is this token? 'a' | 'b' | null.
function seatOf(room, tok) {
  if (!tok) return null;
  if (room.a && room.a.token === tok) return 'a';
  if (room.b && room.b.token === tok) return 'b';
  return null;
}
// May `me` write this state over what the room holds?
//   • an empty table: anyone seated may deal
//   • a round that is over: either may deal the next
//   • otherwise only the player on turn, and only a strictly newer move
function moveGate(room, me, state) {
  if (!me) return { ok: false, why: 'not seated' };
  if (!state || typeof state !== 'object') return { ok: false, why: 'no state' };
  if (state.turn !== 'a' && state.turn !== 'b') return { ok: false, why: 'no turn' };
  const cur = room.state;
  if (!cur) return { ok: true };
  const fresh = state.game && state.game !== cur.game;    // a new deal
  if (cur.over) return fresh ? { ok: true } : { ok: false, why: 'round is over' };
  if (cur.turn !== me) return { ok: false, why: 'not your turn' };
  if (!fresh && !((state.n || 0) > (cur.n || 0))) return { ok: false, why: 'stale' };
  return { ok: true };
}
// Who gets a text after this write, and what it says. null = nobody.
function notifyPlan(room, me, state, line) {
  const to = state.over ? other(me) : (state.turn !== me ? state.turn : null);
  if (!to) return null;
  const seat = room[to];
  if (!seat || !seat.phone) return null;
  if ((room.notifiedN || 0) >= (state.n || 0) && room.notifiedGame === state.game) return null;
  const text = String(line || '').replace(/<[^>]+>/g, '').trim();
  const link = `${SITE}/dominoes?room=${room.id}&t=${seat.token}`;
  return { to, phone: seat.phone, body: `Similitude Dominoes — ${text || (state.over ? 'the round is over.' : 'your turn.')} ${link}` };
}
// The room as one player may see it — never the other's phone or token.
function view(room, me) {
  const seat = (p) => room[p] ? { name: room[p].name, phone: !!room[p].phone } : null;
  return {
    ok: true, room: room.id, you: me, a: seat('a'), b: seat('b'),
    state: room.state || null, links: room.links || {}, n: room.n || 0,
    line: room.line || '', sms: sms.configured(),
    invite: me === 'a' && !room.b ? `${SITE}/dominoes?room=${room.id}&join=${room.invite}` : undefined,
    myPhone: room[me] && room[me].phone ? true : false,
  };
}

// ── routes ───────────────────────────────────────────────────────────────
const router = express.Router();
router.use(express.json({ limit: '256kb' }));
router.use((req, res, next) => {
  const ip = req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests — try again in a while' });
  next();
});

router.get('/status', async (req, res) => res.json({ ok: true, sms: await sms.ready() }));

router.post('/rooms', async (req, res) => {
  try {
    const name = cleanName(req.body && req.body.name);
    if (!name) return res.status(400).json({ error: 'a name is required' });
    const phone = sms.normalizePhone(req.body && req.body.phone);
    if (req.body && req.body.phone && !phone) return res.status(400).json({ error: 'that phone number does not look right' });
    const id = roomId();
    const room = { id, createdAt: now(), updatedAt: now(), invite: token(),
      a: { name, phone: phone || null, token: token(), joinedAt: now() }, b: null,
      state: null, links: {}, n: 0, line: '' };
    await db().collection(ROOMS).doc(id).set(room);
    res.json({ ok: true, room: id, token: room.a.token, invite: `${SITE}/dominoes?room=${id}&join=${room.invite}` });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

async function load(id) {
  const snap = await db().collection(ROOMS).doc(String(id || '').slice(0, 40)).get();
  return snap.exists ? snap.data() : null;
}

router.post('/rooms/:id/join', async (req, res) => {
  try {
    const room = await load(req.params.id);
    if (!room) return res.status(404).json({ error: 'no such table' });
    const { invite, name: rawName, phone: rawPhone } = req.body || {};
    if (!invite || invite !== room.invite) return res.status(403).json({ error: 'that invite is not for this table' });
    if (room.b) return res.status(409).json({ error: 'someone already took the other seat' });
    const name = cleanName(rawName);
    if (!name) return res.status(400).json({ error: 'a name is required' });
    const phone = sms.normalizePhone(rawPhone);
    if (rawPhone && !phone) return res.status(400).json({ error: 'that phone number does not look right' });
    const b = { name, phone: phone || null, token: token(), joinedAt: now() };
    const line = `${name} sat down. ${room.a.name}'s turn to deal.`;
    await db().collection(ROOMS).doc(room.id).set({ b, line, updatedAt: now() }, { merge: true });
    // the host hears their friend arrived — the one text that is not a move
    if (room.a.phone) sms.sendSms(room.a.phone, `Similitude Dominoes — ${line} ${SITE}/dominoes?room=${room.id}&t=${room.a.token}`).catch(() => {});
    res.json({ ok: true, token: b.token, room: room.id });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.get('/rooms/:id', async (req, res) => {
  try {
    const room = await load(req.params.id);
    if (!room) return res.status(404).json({ error: 'no such table' });
    const me = seatOf(room, req.query.token);
    res.set('Cache-Control', 'no-store');
    // an invite link previews the host's name before the friend sits down —
    // and says so when the seat is already taken
    if (!me && req.query.invite && req.query.invite === room.invite) {
      return res.json({ ok: true, preview: true, room: room.id, a: { name: room.a.name }, taken: !!room.b });
    }
    if (!me) return res.status(403).json({ error: 'that link is not a seat at this table' });
    await sms.ready();                    // warm the keys so the view's `sms` is honest
    res.json(view(room, me));
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.post('/rooms/:id/move', async (req, res) => {
  try {
    const { token: tok, state, links, line } = req.body || {};
    const ref = db().collection(ROOMS).doc(String(req.params.id || '').slice(0, 40));
    let plan = null, me = null, n = 0;
    // one transaction: the gate reads the SAME copy it writes over, so two
    // phones racing (a stale one, or a double tap) cannot interleave
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error('no such table'), { code: 404 });
      const room = snap.data();
      me = seatOf(room, tok);
      const gate = moveGate(room, me, state);
      if (!gate.ok) throw Object.assign(new Error(gate.why), { code: 409 });
      const fresh = !room.state || state.game !== room.state.game;
      const allLinks = Object.assign({}, fresh ? {} : (room.links || {}), links || {});
      n = state.n || 0;
      plan = notifyPlan(room, me, state, line);
      const patch = { state, links: allLinks, n, line: String(line || '').slice(0, 400), updatedAt: now() };
      if (plan) { patch.notifiedN = n; patch.notifiedGame = state.game; }
      tx.set(ref, patch, { merge: true });
    });
    if (plan) sms.sendSms(plan.phone, plan.body).then((r) => { if (!r.ok && r.reason !== 'not configured') console.warn('dominoes: sms', r.reason); }).catch(() => {});
    res.json({ ok: true, n, you: me, texted: !!plan && sms.configured() });
  } catch (err) { res.status(err.code || 502).json({ error: err.message }); }
});

router.post('/rooms/:id/phone', async (req, res) => {
  try {
    const room = await load(req.params.id);
    if (!room) return res.status(404).json({ error: 'no such table' });
    const me = seatOf(room, req.body && req.body.token);
    if (!me) return res.status(403).json({ error: 'not seated' });
    const raw = req.body && req.body.phone;
    const phone = raw ? sms.normalizePhone(raw) : null;
    if (raw && !phone) return res.status(400).json({ error: 'that phone number does not look right' });
    await db().collection(ROOMS).doc(room.id).set({ [me]: Object.assign({}, room[me], { phone }) , updatedAt: now() }, { merge: true });
    res.json({ ok: true, phone: !!phone });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = { router, init, _internals: { seatOf, moveGate, notifyPlan, view, cleanName, other } };

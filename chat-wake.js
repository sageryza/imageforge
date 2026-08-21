// Chat wake-up — "message a chat from the Chats app and it actually wakes"
// (Aug 2026). The feed's replies were snail mail: a chat only saw them when
// Sophie next messaged it on claude.ai. This module is the doorbell.
//
// HOW A WAKE TRAVELS (the switchboard design — docs/chats-wake-doorbell.md
// has the findings that forced each hop):
//   1. Sophie sends a message in the app → the page POSTs /reply (the message,
//      exactly as before) and then POST /wake {chat}.
//   2. The server queues the wake and fires the SWITCHBOARD routine for that
//      chat's Claude account over the public Routines API — with an EMPTY
//      body. No text, ever: a fire that carries text spawns a brand-new
//      session; a fire without text re-enters the session the routine is
//      bound to (measured live 2026-07-31, both directions).
//   3. The switchboard chat wakes inside its own conversation, reads
//      GET /wake-queue, and delivers each entry: SendMessage if the target is
//      awake (ListAgents), else fire_trigger on the target's own registered
//      trigger — again with no text. The target wakes in place, sweeps the
//      feed replies addressed to it (the standing rule), and answers.
//   4. The switchboard POSTs /wake-done per entry; a reply from the target
//      clears its entry too (noteReply below), so a crashed switchboard can't
//      leave "waking…" hanging forever.
//
// Why the middle hop exists at all: the public /fire endpoint needs a
// per-routine bearer token that only Sophie can mint in the claude.ai UI, so
// per-chat tokens would cost her a manual step for every chat. One switchboard
// per account = one token per account, ever. Chats register THEMSELVES as
// wakeable (create_trigger self-bind needs no token), so a new chat costs her
// nothing. Freshly SPAWNED sessions have no trigger tools (measured — the
// "RELAY FAIL" test), which is why the switchboard must be a persistent chat
// and never a spawned dispatcher.
//
// Accounts: a trigger can only be fired from its own account, so each account
// has its own switchboard routine + token. Account 2's routine is bound to the
// chats-app-messaging chat (the chat that built this); account 1's is created
// the same way when needed.
//
// Env/config (config-loader MANAGED_KEYS; Render env wins, Firestore doc
// fills gaps). Trigger ids are not credentials (an id can't be fired without
// its token) — same rule as the committed Render service id:
//   WAKE_TRIGGER_1 / WAKE_TRIGGER_2   routine trigger ids (trig_…)
//   WAKE_FIRE_TOKEN_1 / WAKE_FIRE_TOKEN_2   the API-trigger bearer tokens
//
// Registry fields written here (via chatfeed's regRef so its cache drops):
//   wakeTriggerId  — the chat's own self-bound routine (trig_…)
//   wakeAccount    — '1' | '2', which switchboard can reach it
//   wakeAt         — when it registered (ISO)
// Queue: one doc per chat in `forge-wake-queue` (deckfactory).

const fetch = require('node-fetch');

const QUEUE = 'forge-wake-queue';
const FIRE_BASE = 'https://api.anthropic.com/v1/claude_code/routines/';
// The /fire endpoint ships behind this dated beta header (research preview).
// If Anthropic versions it, the two previous headers keep working — update
// here when the docs move.
const FIRE_BETA = 'experimental-cc-routine-2026-04-01';

// Re-firing the switchboard while it's already waking is a wasted routine run
// (they count against a daily cap), so fires per account are debounced. The
// queue entry still lands — the awake switchboard drains everything pending.
// In-memory is correct here: Render runs a single instance (same reasoning as
// chatfeed's registry cache).
const FIRE_DEBOUNCE_MS = 90 * 1000;
const lastFireAt = {};   // account → ms epoch

// Committed defaults for the trigger IDS only (safe — an id can't be fired
// without its token, same rule as the committed Render service id). Account
// 2's switchboard routine is bound to the chats-app-messaging session, created
// live 2026-07-31 and API-token'd by Sophie the same day. Account 1's gets
// filled in when that switchboard exists.
const DEFAULT_TRIGGERS = { 1: '', 2: 'trig_01JWxYFQzEJVRxToP6EdDbmR' };

function switchboardFor(account) {
  const acct = account === '1' ? '1' : '2';
  const trig = (process.env['WAKE_TRIGGER_' + acct] || DEFAULT_TRIGGERS[acct] || '').trim();
  const token = (process.env['WAKE_FIRE_TOKEN_' + acct] || '').trim();
  return { acct, trig, token, configured: !!(trig && token) };
}

// Pure: what should a /wake request do? Exported for the tests.
//   reg — the chat's registry doc data ({} when none)
//   sb — switchboardFor(...)
//   now / last — ms epochs for the debounce
function decideWake(reg, sb, now, last) {
  if (!reg || !reg.wakeTriggerId) return { fire: false, status: 'not-wakeable' };
  if (!sb.configured) return { fire: false, status: 'no-switchboard' };
  if (last && now - last < FIRE_DEBOUNCE_MS) return { fire: false, status: 'queued' };
  return { fire: true, status: 'fired' };
}

function validTrigger(id) {
  return /^trig_[A-Za-z0-9]{6,40}$/.test(String(id || ''));
}

// Fire a switchboard routine. EMPTY body on purpose — see the header comment.
// Never attach `text` here; that is the one mistake that breaks the whole
// design (the fire would spawn a stray new chat instead of waking anyone).
async function fireSwitchboard(sb) {
  const res = await fetch(FIRE_BASE + encodeURIComponent(sb.trig) + '/fire', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + sb.token,
      'anthropic-beta': FIRE_BETA,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: '{}',
    timeout: 10000,
  });
  const body = await res.text().catch(() => '');
  if (!res.ok) throw new Error('fire ' + res.status + ': ' + body.slice(0, 200));
  return body;
}

// The whole doorbell as one callable — queue the wake, fire the switchboard
// (debounced). The POST /wake route below is this plus body parsing, and a
// server module can ring it IN-PROCESS (witchvideo.js does, when a note lands
// on the review page) instead of HTTP-ing its own server. The message itself
// always rides its own store, never the ping.
async function ring(deps, rawChat) {
  const { db, registry, followMoves } = deps;
  const chat = await followMoves(rawChat);
  const reg = (await registry()).chats[chat] || {};
  const sb = switchboardFor(reg.wakeAccount || reg.account || '2');
  const decision = decideWake(reg, sb, Date.now(), lastFireAt[sb.acct]);
  if (decision.status === 'not-wakeable' || decision.status === 'no-switchboard') {
    // No queue entry — nothing will ever drain it. The message itself is
    // safe wherever it was stored; the chat sees it next time it's awake.
    return { ok: true, status: decision.status, chat };
  }
  // One pending entry per chat; a repeat send just renews it.
  await db().collection(QUEUE).doc(chat).set({
    chat,
    account: sb.acct,
    triggerId: reg.wakeTriggerId,
    requestedAt: new Date().toISOString(),
  }, { merge: true });
  if (decision.fire) {
    lastFireAt[sb.acct] = Date.now();
    try {
      await fireSwitchboard(sb);
    } catch (err) {
      // The entry stays queued — the next send (or the switchboard's next
      // wake for any reason) can still drain it. Say so honestly.
      return { ok: true, status: 'queued', chat, fireError: err.message };
    }
  }
  return { ok: true, status: decision.status, chat };
}

function mount(router, deps) {
  const { db, regRef, registry, followMoves, resolveChat } = deps;

  // A chat registers itself as wakeable — one call, once per session, no
  // token involved (its trigger was created with the session's own MCP
  // tools). Session-first like every other post, so the registration lands
  // on the chat this session actually owns.
  router.post('/wake-register', async (req, res) => {
    try {
      const { chat, session, triggerId, account } = req.body || {};
      if (!chat || !triggerId) return res.status(400).json({ error: 'chat and triggerId required' });
      if (!validTrigger(triggerId)) return res.status(400).json({ error: 'triggerId must look like trig_…' });
      const acct = String(account) === '1' ? '1' : '2';
      const her = await resolveChat(chat, String(session || '').slice(0, 120));
      await regRef(her).set({
        wakeTriggerId: String(triggerId).slice(0, 60),
        wakeAccount: acct,
        wakeAt: new Date().toISOString(),
      }, { merge: true });
      res.json({ ok: true, chat: her });
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  // Who can be woken — readable by ANY chat (the morning fan-out chat looks
  // up siblings here, then fires their triggers itself; same-account only).
  router.get('/wake-registry', async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const want = String(req.query.account || '');
      const reg = await registry();
      const out = [];
      Object.keys(reg.chats).forEach((slug) => {
        const c = reg.chats[slug];
        if (!c.wakeTriggerId || c.movedTo) return;
        if (want && (c.wakeAccount || '2') !== want) return;
        out.push({
          chat: slug,
          displayName: c.displayName || null,
          triggerId: c.wakeTriggerId,
          account: c.wakeAccount || '2',
          registeredAt: c.wakeAt || null,
        });
      });
      res.json({ ok: true, chats: out });
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  // The doorbell. The page calls this right after POST /reply.
  router.post('/wake', async (req, res) => {
    try {
      const raw = req.body && req.body.chat;
      if (!raw) return res.status(400).json({ error: 'chat required' });
      res.json(await ring({ db, registry, followMoves }, raw));
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  // What the switchboard reads when it wakes. Entries carry the trigger id so
  // delivery is one call each, no second lookup.
  router.get('/wake-queue', async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const want = String(req.query.account || '');
      const snap = await db().collection(QUEUE).get();
      const pending = [];
      snap.docs.forEach((d) => {
        const e = d.data();
        if (want && (e.account || '2') !== want) return;
        pending.push({
          chat: e.chat || d.id,
          triggerId: e.triggerId || null,
          account: e.account || '2',
          requestedAt: e.requestedAt || null,
        });
      });
      res.json({ ok: true, pending });
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  // The switchboard marks an entry delivered after it fires the target (or
  // SendMessages it). Also called with no ceremony if the entry is stale.
  router.post('/wake-done', async (req, res) => {
    try {
      const { chat } = req.body || {};
      if (!chat) return res.status(400).json({ error: 'chat required' });
      await db().collection(QUEUE).doc(String(chat).slice(0, 60)).delete();
      res.json({ ok: true });
    } catch (err) { res.status(502).json({ error: err.message }); }
  });
}

// A reply landing FROM a chat is the true "delivered" signal — clear its
// pending wake even if the switchboard died between firing and wake-done.
// Fire-and-forget from chatfeed's message POST; must never fail a post.
function noteReply(dbFn, chat) {
  try {
    dbFn().collection(QUEUE).doc(String(chat).slice(0, 60)).delete().catch(() => {});
  } catch (e) { /* never let cleanup touch the post */ }
}

module.exports = { mount, ring, noteReply, decideWake, switchboardFor, validTrigger, FIRE_DEBOUNCE_MS };

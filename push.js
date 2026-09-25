// Push — real lock-screen notifications for the Chats app (Aug 2026, Sophie:
// "we could make these updates on my phone… through iOS since this is an iOS
// app", and when offered the tiers: "let's build the hardest version").
//
// The shape: the iOS app registers its APNs device token here once
// (POST /device); chatfeed.js calls notifyChat() when a chat finishes a reply
// or posts a Compare page; this module signs a JWT with the APNs auth key and
// POSTs the alert straight to Apple over HTTP/2. No Firebase Messaging, no SDK
// on either side — the server already speaks HTTP and Node's crypto signs
// ES256 natively (dsaEncoding 'ieee-p1363' is what makes that a one-liner:
// it yields the raw r||s signature JOSE wants, no DER surgery).
//
// DORMANT UNTIL THE KEY EXISTS. The three env vars below come from the one
// manual step only Sophie can do (an APNs auth key in her Apple developer
// account) and are read lazily at SEND time — so this ships and sleeps, the
// app can register its token meanwhile, and the moment the key lands in
// Render env the next delivery buzzes her phone. Nothing here may ever fail a
// posting route: every entry point catches and logs.
//
//   APNS_KEY      the .p8 file's contents (raw PEM, base64-of-PEM, or PEM
//                 with literal \n — all accepted, the paste is on a phone-
//                 hostile little file and corruption is the likely failure)
//   APNS_KEY_ID   the 10-char key id shown beside the key
//   APNS_TEAM_ID  her Apple team id (developer.apple.com → Membership)
//   APNS_TOPIC    optional; defaults to the app's bundle id
//
// Routes (STUDIO_TOKEN gate, only GET /status open):
//   GET  /api/push/status  → { configured, devices }
//   POST /api/push/device  → { token } — the app upserts its token per launch
//   POST /api/push/test    → { title?, body? } — one real send to every
//                            device, per-device results back. The end-to-end
//                            check that never waits for a real delivery.
//
// TestFlight builds use the PRODUCTION APNs host — api.push.apple.com, not
// the sandbox. APNS_BASE exists for tests only.

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const http2 = require('http2');

const router = express.Router();
const DEVICES = 'forge-push-devices';
const TOPIC_DEFAULT = 'com.sageryza.imageforge';

const db = () => admin.firestore();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '64kb' }));

// ---- The APNs auth key -----------------------------------------------------
// Tolerant on purpose: the value is pasted by hand into a dashboard, and the
// three likely shapes (raw PEM, base64 of the whole file — the ASC_KEY_P8
// convention next door — and PEM whose newlines arrived as literal "\n")
// should all just work rather than fail with an opaque signing error.
function normalizeKey(raw) {
  let k = String(raw || '').trim();
  if (!k) return null;
  if (!k.includes('BEGIN')) {
    try { k = Buffer.from(k, 'base64').toString('utf8'); } catch (e) { /* fall through */ }
  }
  if (!k.includes('BEGIN')) return null;
  return k.replace(/\\n/g, '\n');
}
// A RENDER SECRET FILE IS THE OTHER (better) HOME FOR THE KEY (Aug 2026,
// Sophie's ask — a private key belongs in the secret-file store, not in an
// env var, and a multi-line PEM pastes more safely there).
//
// Any `.p8` in the usual mount points is taken, so the file Apple downloads
// (AuthKey_<KEYID>.p8) can be uploaded under its own name with nothing else
// to get right. `APNS_KEY_FILE` overrides with an explicit path. Render
// mounts secret files at BOTH /etc/secrets and the project root, and which
// one is documented has changed — so look in all of them rather than betting
// on one.
const KEY_DIRS = ['/etc/secrets', '/opt/render/project/src', process.cwd()];
// Cached once found (a send must not stat the disk every time), but a MISS is
// only cached for 30s: the whole point of reading lazily is that the key can
// land after the deploy and start working on its own.
const keyFile = { key: null, at: 0 };
function keyFromFile() {
  if (keyFile.key) return keyFile.key;
  if (Date.now() - keyFile.at < 30000) return null;
  keyFile.at = Date.now();
  const fs = require('fs');
  const path = require('path');
  const tries = [];
  if (process.env.APNS_KEY_FILE) tries.push(process.env.APNS_KEY_FILE);
  for (const dir of KEY_DIRS) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.toLowerCase().endsWith('.p8')) tries.push(path.join(dir, f));
      }
    } catch (e) { /* dir absent — normal off Render */ }
  }
  for (const p of tries) {
    try {
      const k = normalizeKey(fs.readFileSync(p, 'utf8'));
      if (k) { keyFile.key = k; return k; }
    } catch (e) { /* unreadable — try the next */ }
  }
  return null;
}
// Env var first (it wins everywhere else in this repo), then the secret file.
function apnsKey() {
  return normalizeKey(process.env.APNS_KEY) || keyFromFile();
}
function configured() {
  return !!(apnsKey() && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
}

// Provider JWT, cached 50 minutes (Apple wants 20-60). base64url per JOSE.
const jwtCache = { token: null, at: 0 };
const b64u = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function providerJwt(now) {
  now = now || Date.now();
  if (jwtCache.token && now - jwtCache.at < 50 * 60 * 1000) return jwtCache.token;
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID }));
  const body = b64u(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(now / 1000) }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), {
    key: apnsKey(),
    dsaEncoding: 'ieee-p1363',   // raw r||s — the JOSE ES256 shape, no DER
  });
  jwtCache.token = head + '.' + body + '.' + b64u(sig); jwtCache.at = now;
  return jwtCache.token;
}

// ---- One send over HTTP/2 --------------------------------------------------
// A session per call: pushes here are rare (a few an hour at most), so a kept
// connection is complexity with no payoff. 30s guard timeout — a hung Apple
// connection must never hold anything else up.
function apnsSend(deviceToken, payload, headers) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; try { client.close(); } catch (e) {} resolve(r); } };
    const base = process.env.APNS_BASE || 'https://api.push.apple.com';
    const client = http2.connect(base);
    client.on('error', (e) => finish({ ok: false, status: 0, reason: e.message }));
    setTimeout(() => finish({ ok: false, status: 0, reason: 'timeout' }), 30000).unref();
    const req = client.request({
      ':method': 'POST',
      ':path': '/3/device/' + deviceToken,
      'authorization': 'bearer ' + providerJwt(),
      'apns-topic': process.env.APNS_TOPIC || TOPIC_DEFAULT,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      ...headers,
    });
    let status = 0, body = '';
    req.on('response', (h) => { status = h[':status']; });
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let reason = '';
      try { reason = JSON.parse(body).reason || ''; } catch (e) { /* empty on 200 */ }
      finish({ ok: status === 200, status, reason });
    });
    req.on('error', (e) => finish({ ok: false, status: 0, reason: e.message }));
    req.end(JSON.stringify(payload));
  });
}

// A `__`-PREFIXED DOC IS THIS MODULE'S OWN STATE, NEVER A PHONE — and until
// 2026-09-14 it was pushed to and then DELETED as a dead token. Found in the
// live log the hour the deploy notification shipped:
//   push: send issues [{"device":"__deploy","ok":false,"status":400,
//                       "reason":"BadDeviceToken","removed":true}]
// `__deploy` holds the mark that says a deploy STARTED, so the "start" push
// destroyed the very mark it had just written and the "back up" buzz on the
// next boot then found nothing — and it did it silently, because a dead token
// coming out of the collection is exactly what this is supposed to do. It
// worked on one deploy and not the next, which is the race between the two
// writes. The deploy mark and the undeployed-count mark both live here, so a
// token is a doc with a real token on it and an id that is not reserved.
const STATE_DOC = /^__/;
async function loadDevices() {
  if (!admin.apps.length) return [];
  const snap = await db().collection(DEVICES).get();
  return snap.docs
    .filter((d) => !STATE_DOC.test(d.id) && typeof d.get('token') === 'string' && d.get('token'))
    .map((d) => ({ id: d.id, ...d.data() }));
}

// A token Apple says is dead comes out of the collection, or every future
// send pays for the same failure forever.
const DEAD = /^(BadDeviceToken|Unregistered|DeviceTokenNotForTopic)$/;
async function sendAll(title, body, data) {
  const devices = await loadDevices();
  const out = [];
  for (const d of devices) {
    const r = await apnsSend(d.token, {
      aps: {
        alert: { title, body },
        sound: 'default',
        'thread-id': (data && (data.chat || data.thread)) || 'forge',
      },
      ...data,
    }, (data && (data.chat || data.thread))
      ? { 'apns-collapse-id': String(data.chat || data.thread).slice(0, 60) } : {});
    if (!r.ok && (r.status === 410 || DEAD.test(r.reason))) {
      await db().collection(DEVICES).doc(d.id).delete().catch(() => {});
      r.removed = true;
    }
    out.push({ device: d.id.slice(0, 8), ...r });
  }
  return out;
}

// ---- What the rest of the server calls -------------------------------------
// Fire-and-forget BY CONTRACT: chatfeed calls this inside a posting route, and
// a slow or broken push must never delay a reply landing in the feed. Two
// throttles, both in-memory (a restart forgiving an extra push is fine):
//   • per chat: one push per 10 minutes — a chat shipping six PRs in an
//     evening is a handful, not a drumroll;
//   • global: 60s between pushes — five parallel chats finishing at once
//     stack up as one buzz and the Update tab, not five in a row.
// The dropped ones are not lost news: the Update tab is the catch-all, and
// the pushes are its doorbell, not its replacement.
//
// `{ debounce:false }` OPTS OUT, and the finished-reply caller uses it (Aug
// 2026). Both windows exist because EVERY finished reply used to push;
// `push-gate.js` replaced that with "she spoke and this answers her", which
// is a tighter gate than any clock — and the 10-minute window actively broke
// what she asked for, because she messages a chat again four minutes later
// and the answer to the second message was swallowed. A skipped send still
// takes the global stamp, so a Compare page posted in the same turn as the
// reply stays the one buzz it always was.
const lastByChat = Object.create(null);
let lastAny = 0;
function notifyChat(chat, title, body, opts) {
  try {
    if (!configured()) return;
    const now = Date.now();
    if (!opts || opts.debounce !== false) {
      if (lastByChat[chat] && now - lastByChat[chat] < 10 * 60 * 1000) return;
      if (now - lastAny < 60 * 1000) return;
    }
    lastByChat[chat] = now; lastAny = now;
    sendAll(String(title || chat).slice(0, 120), String(body || '').slice(0, 240), { chat })
      .then((r) => {
        const bad = r.filter((x) => !x.ok);
        if (bad.length) console.warn('push: send issues', JSON.stringify(bad));
      })
      .catch((e) => console.warn('push: send failed', e.message));
  } catch (e) { console.warn('push: notify failed', e.message); }
}

// ---- THE BUZZ WAITS FOR THE TURN TO END ------------------------------------
// (2026-08-28, Sophie: "I get notified on my phone a few seconds before chats
// actually finish their turn.")
//
// The FINISHED-REPLY door has always been honest — it fires from the hook's
// Stop pass, i.e. at the end of the turn. The other three doors are not:
//   • a media pin recording a DELIVERABLE (deliverables.js — the checklist
//     tells a chat to pin its film mid-turn, before its cards and its reply),
//   • a new Compare page (POST /page),
//   • an auto-compare grid the server files when a prompt or caption lands.
// Every one of those is filed WHILE the chat is still working, and each
// pushed the instant it was filed. Measured against her real data
// 2026-08-28, the gap between a deliverable landing and that chat's finished
// reply: 19s, 23s, 42s, 58s, 103s — her "a few seconds before", exactly.
//
// So those doors QUEUE instead of sending, and the finished reply is what
// lets the buzz out. One entry per chat (newest news wins; the banner
// collapses per chat on the phone anyway, so a queue of several would only
// ever show the last one).
//
// Two rules worth not undoing:
//   • A REPLY THAT PUSHES SWALLOWS THE PENDING ONE. Both would arrive in the
//     same second under one collapse-id, so the second is only ever noise —
//     and the reply's own TLDR is the better banner. A chat she has NOT
//     belled still gets its deliverable buzz, because no reply push fires
//     there to swallow it (that bypass is the deliverables list's whole ask).
//   • A FALLBACK TIMER, because not every chat replies. A hookless session,
//     a chat killed mid-turn, a film filed by a script — none of those ever
//     posts a finished reply, and a doorbell that waits forever is a doorbell
//     that never rings. 15 minutes: long enough to sit out the long turns
//     measured above (25 and 42 minutes exist, so a few of these will still
//     ring early — the alternative is holding real news for an hour).
// A deploy restart drops a pending buzz, and that is fine: the deliverables
// list and the Update tab are the catch-all, the push is their doorbell.
const PENDING_MS = 15 * 60 * 1000;
const pending = Object.create(null);
// The one seam the test needs: notifyChat talks to Apple through a module-
// scope sendAll that nothing outside can rebind, so the release goes through
// this indirection and a test can watch it without a device or a socket.
const wire = { notify: (chat, title, body, opts) => notifyChat(chat, title, body, opts) };

/**
 * Hold a buzz until this chat finishes its turn (or the fallback fires).
 * Same arguments as notifyChat — `opts` rides along to the eventual send.
 */
function queueChat(chat, title, body, opts) {
  try {
    if (!configured()) return;
    const key = String(chat || '');
    const prev = pending[key];
    // Keep the ORIGINAL deadline: a chat filing a deliverable every ten
    // minutes must not be able to push its own doorbell out forever.
    if (prev && prev.timer) clearTimeout(prev.timer);
    const at = (prev && prev.at) || Date.now();
    const timer = setTimeout(() => { flushChat(key); },
      Math.max(0, at + PENDING_MS - Date.now()));
    if (timer.unref) timer.unref();
    pending[key] = { title, body, opts, at, timer };
  } catch (e) { console.warn('push: queue failed', e.message); }
}

/**
 * The chat's turn ended — let its held buzz out, or drop it when the reply
 * itself already buzzed her.
 * @param {string} chat
 * @param {{suppress?: boolean}} [opts] suppress: a reply push just fired
 * @returns {boolean} whether a held buzz was sent
 */
function flushChat(chat, opts) {
  try {
    const key = String(chat || '');
    const held = pending[key];
    if (!held) return false;
    delete pending[key];
    if (held.timer) clearTimeout(held.timer);
    if (opts && opts.suppress) return false;
    wire.notify(key, held.title, held.body, held.opts);
    return true;
  } catch (e) { console.warn('push: flush failed', e.message); return false; }
}

// ---- Routes ----------------------------------------------------------------
// WHICH PIECE IS MISSING, not just "not configured" (Aug 2026 — the setup is
// four separate things pasted into two different places on a phone, and a bare
// `configured:false` sends everyone guessing). Booleans and FILENAMES only:
// no key material, no ids, so this stays safe on an open route.
router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let devices = 0;
  try { devices = (await loadDevices()).length; } catch (e) { /* firestore down */ }
  const fs = require('fs');
  const seen = {};
  for (const dir of KEY_DIRS) {
    try { seen[dir] = fs.readdirSync(dir).filter((f) => /\.p8$/i.test(f)); }
    catch (e) { seen[dir] = null; }   // null = no such directory here
  }
  res.json({
    ok: true,
    configured: configured(),
    devices,
    has: {
      key: !!apnsKey(),                             // env var OR secret file
      keyFromEnv: !!normalizeKey(process.env.APNS_KEY),
      keyId: !!process.env.APNS_KEY_ID,
      teamId: !!process.env.APNS_TEAM_ID,
    },
    p8Files: seen,          // where a .p8 was found, by directory
    topic: process.env.APNS_TOPIC || TOPIC_DEFAULT,
  });
});

// The app re-registers on every launch — tokens can rotate, and an upsert
// keyed on the token's own hash makes that free.
router.post('/device', async (req, res) => {
  try {
    const token = String((req.body || {}).token || '').trim();
    if (!/^[0-9a-fA-F]{32,200}$/.test(token)) return res.status(400).json({ error: 'bad token' });
    const id = crypto.createHash('sha1').update(token.toLowerCase()).digest('hex').slice(0, 24);
    await db().collection(DEVICES).doc(id).set({
      token: token.toLowerCase(),
      platform: 'ios',
      seenAt: new Date().toISOString(),
    }, { merge: true });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/test', async (req, res) => {
  try {
    if (!configured()) {
      return res.status(503).json({ error: 'APNs key not set — APNS_KEY / APNS_KEY_ID / APNS_TEAM_ID' });
    }
    const { title, body } = req.body || {};
    const results = await sendAll(
      String(title || 'Deck Factory').slice(0, 120),
      String(body || 'Push is working.').slice(0, 240),
      { chat: 'push-test' },
    );
    res.json({ ok: results.every((r) => r.ok), results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- THE ONE PUSH THAT IS NOT A CHAT: A DEPLOY -----------------------------
// (2026-09-13, Sophie: "can i get a notification when deploy starts and ends
// so i know when to stop making clips and start again".)
//
// A deploy swaps the instance out, and a footage SEND in flight is a request
// the old instance dies holding — so the minute around a deploy is the one
// minute she should not tap the star. The two moments are already known
// exactly, and neither of them is a guess:
//   START — `scripts/deploy-guard.js` is Render's pre-deploy command. It runs
//     after the build and BEFORE the swap, holds until nothing is drawing,
//     pauses new draws, reads once more, and only then lets the deploy go.
//     That last moment is the honest "it is going now", so the guard re-affirms
//     its pause carrying `deploy:true` and the pause route calls this. A guard
//     that gives up, or lifts the pause because a draw started, never gets
//     there — so a held deploy never buzzes her.
//   DONE — the NEW instance booting. Nothing else knows the swap finished, and
//     a boot is exactly "you can send again".
//
// THE MARKER IS WHAT KEEPS A CRASH RESTART QUIET. A boot pushes "back up" only
// when a START was recorded and is recent — so an OOM kill or a Render recycle
// at 3am says nothing, and a deploy whose start push never landed does not get
// a dangling "back up" a week later either. It is cleared on the way past, so
// one deploy is one pair.
//
// NO `chat` KEY, deliberately: PushDelegate opens the chat a push names, and
// there is no chat here — with none it lands on the Update tab, which is the
// right room and needs no new build. `thread` gives it its own collapse id so
// "back up" replaces "starting" in her shade instead of stacking.
const DEPLOY_DOC = 'forge-push-devices/__deploy';
const DEPLOY_THREAD = 'forge-deploy';
const DEPLOY_STALE_MS = 30 * 60 * 1000;
const DEPLOY_WORDS = {
  start: ['Server update starting', 'Give it a minute before you send a clip.'],
  done: ['Back up', 'Send clips again.'],
};

function deployRef() { return db().doc(DEPLOY_DOC); }

/** Push one of the two deploy moments. Fire-and-forget by contract — it is
 *  called from inside a route and from boot, and neither may wait on APNs. */
function notifyDeploy(phase, opts) {
  const words = DEPLOY_WORDS[phase];
  if (!words) return;
  if (configured()) {
    sendAll(words[0], words[1], { thread: DEPLOY_THREAD, deploy: phase })
      .then((r) => console.log(`push: deploy ${phase} -> ${r.length} device(s)`))
      .catch((e) => console.log('push: deploy notify failed — ' + e.message));
  }
  if (phase === 'start' && !(opts && opts.noMark) && admin.apps.length) {
    deployRef().set({ startedAt: Date.now() }, { merge: true })
      .catch((e) => console.log('push: deploy mark failed — ' + e.message));
  }
}

/** Called once on boot. Pushes "back up" only if a start was marked and is
 *  recent, and clears the mark either way so it can never fire twice. */
async function deployBootCheck() {
  if (!admin.apps.length) return { pushed: false, why: 'no-firestore' };
  let snap;
  try { snap = await deployRef().get(); } catch (e) { return { pushed: false, why: e.message }; }
  const at = snap.exists && Number(snap.get('startedAt'));
  if (!at) return { pushed: false, why: 'no-mark' };
  await deployRef().set({ startedAt: 0, doneAt: Date.now() }, { merge: true }).catch(() => {});
  if (Date.now() - at > DEPLOY_STALE_MS) return { pushed: false, why: 'stale' };
  notifyDeploy('done');
  return { pushed: true };
}


// ─── FIVE CHANGES WAITING ──────────────────────────────────────────────
// 2026-09-14, Sophie: "I would like a notification when there are five
// changes undeployed." A merge no longer deploys by itself — the house rule
// is merge with `[skip render]`, then ask — so main runs ahead of the live
// box for hours, and the only way to know by how much was to go and count.
//
// IT IS DERIVED, NOT FILED. Render stamps every instance with the commit it
// was built from (`RENDER_GIT_COMMIT`), and GitHub's compare API says how
// many commits main carries on top of it. Nothing has to be recorded when a
// PR merges, so a chat that forgets to file something cannot make this
// number wrong, and a deploy resets it by construction: the new instance is
// built from a newer commit and starts at zero.
//
// ONE BUZZ PER RUNG, NEVER ONE PER TICK. It fires at five, then again at ten
// and fifteen — a number that keeps climbing is worth hearing again, and the
// same number every hour is not. The rung it last pushed rides on the same
// `__deploy` doc KEYED BY THE COMMIT, so a deploy clears it without anything
// having to remember to.
//
// FREE: one unauthenticated GitHub read an hour (60/hr is the limit and this
// is 1), no model call, and it is skipped entirely off Render.
const BEHIND_STEP = 5;
const BEHIND_REPO = process.env.FORGE_REPO || 'sageryza/imageforge';
const BEHIND_BRANCH = process.env.FORGE_BRANCH || 'main';

/** How far the live commit is behind the branch. -> { ahead, sha } or null. */
async function readBehind(fetchFn, sha) {
  const f = fetchFn || fetch;
  const head = String(sha || process.env.RENDER_GIT_COMMIT || '').trim();
  if (!head) return null;
  const url = `https://api.github.com/repos/${BEHIND_REPO}/compare/${head}...${BEHIND_BRANCH}`;
  const r = await f(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'imageforge' } });
  if (!r.ok) throw new Error(`compare ${r.status}`);
  const j = await r.json();
  const ahead = Number(j.ahead_by);
  if (!Number.isFinite(ahead)) throw new Error('no ahead_by');
  return { ahead, sha: head };
}

/** The whole rule, pure: given how far behind and what was last pushed for
 *  THIS commit, should it buzz, and about what rung? */
function behindPlan(ahead, last, step) {
  const n = Number(ahead) || 0;
  const s = Number(step) || BEHIND_STEP;
  const rung = Math.floor(n / s) * s;           // 0, 5, 10, 15…
  if (rung < s) return { push: false, rung, why: 'under' };
  if (Number(last) >= rung) return { push: false, rung, why: 'said' };
  return { push: true, rung, ahead: n };
}

function behindWords(n) {
  return [`${n} changes waiting`, n === 1 ? 'One change you would notice is merged and not live.' : `${n} changes you would notice are merged and not live yet.`];
}

/** THE NUMBER IS THE CHANGES SHE WOULD NOTICE (2026-09-25, Sophie: "only have
 *  the 'waiting to deploy' mean changes that would change something for me").
 *  waiting.js reads each waiting commit's files and keeps the ones a deploy
 *  carries to her; a docs-only merge or a Compare page's template does not
 *  count. Falls back to the raw ahead_by when the pile could not be sorted
 *  (a refused read, a truncated compare) — the old number, never a smaller
 *  one built on a partial read. */
async function countForHer(fetchFn, st) {
  try {
    const d = await require('./waiting').build({ fetch: fetchFn, sha: st.sha, fresh: true });
    if (d && !d.error && d.classified && Number(d.ahead) === st.ahead) return Number(d.forYou) || 0;
  } catch (e) { /* the raw count below */ }
  return st.ahead;
}

/** The hourly tick. Never throws — a GitHub hiccup must not be a log full of
 *  stack traces, and a number nobody can read is not a reason to say
 *  anything. */
async function behindCheck(opts) {
  const o = opts || {};
  if (!admin.apps.length) return { pushed: false, why: 'no-firestore' };
  let st;
  try { st = await readBehind(o.fetch, o.sha); } catch (e) { return { pushed: false, why: e.message }; }
  if (!st) return { pushed: false, why: 'no-commit' };
  st = { ...st, raw: st.ahead, ahead: await countForHer(o.fetch, st) };
  let last = 0;
  try {
    const snap = await deployRef().get();
    if (snap.exists && snap.get('behindSha') === st.sha) last = Number(snap.get('behindRung')) || 0;
  } catch (e) { return { pushed: false, why: e.message }; }
  const plan = behindPlan(st.ahead, last, o.step);
  if (!plan.push) return { pushed: false, why: plan.why, ahead: st.ahead, rung: plan.rung };
  // Mark BEFORE sending: a push that lands and a mark that did not would buzz
  // her again every hour, which is the one failure this rule exists to avoid.
  await deployRef().set({ behindSha: st.sha, behindRung: plan.rung, behindAt: Date.now() }, { merge: true })
    .catch(() => {});
  const w = behindWords(st.ahead);
  if (configured()) {
    // `open` is the path a TAP lands on — the screen that says what the
    // changes actually are, per chat (2026-09-14, Sophie: "shud go to a screen
    // that says what the unmerged changes are"). An older build ignores the
    // field and lands on the chat list exactly as it did before.
    sendAll(w[0], w[1], { thread: DEPLOY_THREAD, behind: st.ahead, open: '/waiting' })
      .then((r) => console.log(`push: ${st.ahead} undeployed -> ${r.length} device(s)`))
      .catch((e) => console.log('push: behind notify failed — ' + e.message));
  }
  return { pushed: true, ahead: st.ahead, rung: plan.rung };
}

module.exports = { router, notifyChat, queueChat, flushChat, notifyDeploy, deployBootCheck, behindCheck, readBehind, behindPlan, countForHer, BEHIND_STEP, _internals: { providerJwt, apnsKey, apnsSend, sendAll, jwtCache, pending, PENDING_MS, wire } };

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
function apnsKey() {
  let k = String(process.env.APNS_KEY || '').trim();
  if (!k) return null;
  if (!k.includes('BEGIN')) {
    try { k = Buffer.from(k, 'base64').toString('utf8'); } catch (e) { /* fall through */ }
  }
  if (!k.includes('BEGIN')) return null;
  return k.replace(/\\n/g, '\n');
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

async function loadDevices() {
  if (!admin.apps.length) return [];
  const snap = await db().collection(DEVICES).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
        'thread-id': (data && data.chat) || 'forge',
      },
      ...data,
    }, (data && data.chat) ? { 'apns-collapse-id': String(data.chat).slice(0, 60) } : {});
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
//   • per chat: one push per 10 minutes — the finished reply and the Compare
//     page it posted in the same turn are one buzz, and a chat shipping six
//     PRs in an evening is a handful, not a drumroll;
//   • global: 60s between pushes — five parallel chats finishing at once
//     stack up as one buzz and the Update tab, not five in a row.
// The dropped ones are not lost news: the Update tab is the catch-all, and
// the pushes are its doorbell, not its replacement.
const lastByChat = Object.create(null);
let lastAny = 0;
function notifyChat(chat, title, body) {
  try {
    if (!configured()) return;
    const now = Date.now();
    if (lastByChat[chat] && now - lastByChat[chat] < 10 * 60 * 1000) return;
    if (now - lastAny < 60 * 1000) return;
    lastByChat[chat] = now; lastAny = now;
    sendAll(String(title || chat).slice(0, 120), String(body || '').slice(0, 240), { chat })
      .then((r) => {
        const bad = r.filter((x) => !x.ok);
        if (bad.length) console.warn('push: send issues', JSON.stringify(bad));
      })
      .catch((e) => console.warn('push: send failed', e.message));
  } catch (e) { console.warn('push: notify failed', e.message); }
}

// ---- Routes ----------------------------------------------------------------
router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let devices = 0;
  try { devices = (await loadDevices()).length; } catch (e) { /* firestore down */ }
  res.json({ ok: true, configured: configured(), devices });
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

module.exports = { router, notifyChat, _internals: { providerJwt, apnsKey, apnsSend, sendAll, jwtCache } };

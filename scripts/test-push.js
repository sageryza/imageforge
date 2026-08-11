#!/usr/bin/env node
// push.js — the APNs sender behind the Chats app's notifications (Aug 2026).
// Apple can't be called from a test, but the two parts that fail silently in
// production CAN be proven here:
//   1. the key loader takes all three paste shapes (raw PEM, base64-of-PEM,
//      PEM with literal \n) — the value is hand-pasted into Render's env, and
//      a corrupted paste must not become an opaque signing error;
//   2. the provider JWT is real JOSE ES256 — header/payload fields right and
//      the signature VERIFIABLE with the public key (dsaEncoding ieee-p1363
//      is the load-bearing detail: DER-shaped signatures LOOK fine and Apple
//      rejects them) — and it caches;
//   3. apnsSend speaks correct HTTP/2 — path, topic, collapse id, push type,
//      bearer — proven against a real local h2c server, including the error
//      shape (410 + reason parsed out).
//
//   node scripts/test-push.js       (no deps beyond node)

const crypto = require('crypto');
const http2 = require('http2');
const assert = require('assert');

// a real P-256 keypair, exactly what Apple issues
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

process.env.APNS_KEY = pem;
process.env.APNS_KEY_ID = 'TESTKEY123';
process.env.APNS_TEAM_ID = 'TEAM123456';

const push = require('../push.js');
const { providerJwt, apnsKey, apnsSend, jwtCache } = push._internals;

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

// ---- 1. the three paste shapes --------------------------------------------
try {
  assert(apnsKey().includes('BEGIN'), 'raw PEM');
  process.env.APNS_KEY = Buffer.from(pem).toString('base64');
  assert(apnsKey().includes('BEGIN'), 'base64-of-PEM');
  process.env.APNS_KEY = pem.replace(/\n/g, '\\n');
  assert(apnsKey().includes('BEGIN') && apnsKey().includes('\n'), 'literal \\n PEM');
  process.env.APNS_KEY = pem;
} catch (e) { fail('key loader: ' + e.message); }

// ---- 1b. the Render SECRET FILE path --------------------------------------
// The key's other home: a .p8 uploaded as a secret file, found by extension in
// the mount dirs with no name to get right. Proven by pointing APNS_KEY_FILE
// at a real file with APNS_KEY unset — the env var must not be required.
try {
  const fs = require('fs'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-'));
  const file = path.join(dir, 'AuthKey_G8WMZDR4KK.p8');
  fs.writeFileSync(file, pem);
  const savedEnv = process.env.APNS_KEY;
  delete process.env.APNS_KEY;
  process.env.APNS_KEY_FILE = file;
  assert(apnsKey() && apnsKey().includes('BEGIN'), 'reads the key out of a secret file');
  // …and the JWT still signs from it, which is the thing that actually matters
  const jwt = providerJwt(Date.now() + 99 * 60 * 1000);
  assert(jwt.split('.').length === 3, 'signs with the file-sourced key');
  delete process.env.APNS_KEY_FILE;
  process.env.APNS_KEY = savedEnv;
  jwtCache.at = 0; jwtCache.token = null;
} catch (e) { fail('secret file: ' + e.message); }

// ---- 2. the JWT is real ES256 JOSE ----------------------------------------
try {
  const jwt = providerJwt();
  const [h, p, s] = jwt.split('.');
  const un64 = (x) => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const head = JSON.parse(un64(h));
  const body = JSON.parse(un64(p));
  assert.strictEqual(head.alg, 'ES256');
  assert.strictEqual(head.kid, 'TESTKEY123');
  assert.strictEqual(body.iss, 'TEAM123456');
  assert(Math.abs(body.iat - Date.now() / 1000) < 60, 'iat is now');
  const okSig = crypto.verify('sha256', Buffer.from(h + '.' + p),
    { key: publicKey, dsaEncoding: 'ieee-p1363' }, un64(s));
  assert(okSig, 'signature verifies with the public key in JOSE (r||s) form');
  // cached: same token inside the window, new token past it
  assert.strictEqual(providerJwt(), jwt, 'cache hit');
  const t2 = providerJwt(Date.now() + 51 * 60 * 1000);
  assert.notStrictEqual(t2, jwt, 'cache refresh after 50min');
  jwtCache.at = 0; jwtCache.token = null;
} catch (e) { fail('provider JWT: ' + e.message); }

// ---- 3. the wire, against a real local h2c server --------------------------
const seen = [];
let respondWith = { status: 200, body: '' };
const server = http2.createServer((req, res) => {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (c) => body += c);
  req.on('end', () => {
    seen.push({ path: req.headers[':path'], headers: req.headers, body: JSON.parse(body) });
    res.writeHead(respondWith.status);
    res.end(respondWith.body);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  process.env.APNS_BASE = 'http://127.0.0.1:' + server.address().port;

  const r1 = await apnsSend('a'.repeat(64), {
    aps: { alert: { title: 'Deck Factory', body: 'v9 is up' }, sound: 'default', 'thread-id': 'oven' },
    chat: 'oven',
  }, { 'apns-collapse-id': 'oven' });
  if (!r1.ok || r1.status !== 200) fail('send did not succeed: ' + JSON.stringify(r1));
  const req1 = seen[0];
  if (!req1) fail('nothing reached the server');
  else {
    if (req1.path !== '/3/device/' + 'a'.repeat(64)) fail('wrong path: ' + req1.path);
    if (req1.headers['apns-topic'] !== 'com.sageryza.imageforge') fail('wrong topic: ' + req1.headers['apns-topic']);
    if (req1.headers['apns-push-type'] !== 'alert') fail('wrong push type');
    if (req1.headers['apns-collapse-id'] !== 'oven') fail('collapse id missing');
    if (!/^bearer .+\..+\..+$/.test(req1.headers.authorization || '')) fail('no bearer JWT');
    if (req1.body.aps.alert.title !== 'Deck Factory') fail('payload mangled');
  }

  // Apple's error shape: status + {"reason": …} — apnsSend must surface both,
  // because 410/BadDeviceToken is what tells sendAll to drop a dead device.
  respondWith = { status: 410, body: JSON.stringify({ reason: 'Unregistered' }) };
  const r2 = await apnsSend('b'.repeat(64), { aps: { alert: { title: 't', body: 'b' } } }, {});
  if (r2.ok || r2.status !== 410 || r2.reason !== 'Unregistered') {
    fail('error shape wrong: ' + JSON.stringify(r2));
  }

  server.close();
  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: key loader takes all three pastes, the JWT is verifiable ES256, and the wire format is right');
})().catch((e) => { console.error(e); process.exit(1); });

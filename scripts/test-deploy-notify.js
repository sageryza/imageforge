#!/usr/bin/env node
/* A DEPLOY BUZZES HER PHONE — START AND END (2026-09-13, Sophie: "can i get a
 * notification when deploy starts and ends so i know when to stop making clips
 * and start again").
 *
 * The half that can silently be wrong is the MARKER, so that is what is driven
 * here against a fake Firestore: a boot must push "back up" only for a deploy
 * that really started, must clear the mark so one deploy is one pair, and must
 * stay silent for an OOM kill or a Render recycle — which look identical to a
 * deploy from inside a booting process, and which would otherwise buzz her at
 * 3am. The APNs send itself is not exercised (no key in a test container); the
 * wording and the two wirings are pinned by source instead, and the guard's
 * own half — that only the FINAL pause carries the flag — is measured in
 * scripts/test-deploy-guard.js.
 *
 * Run: node scripts/test-deploy-notify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

// ── a Firestore of one document ───────────────────────────────────────────
let store = null;   // null = the doc does not exist
const docStub = {
  async get() { return { exists: store !== null, get: (k) => (store ? store[k] : undefined) }; },
  async set(v, o) { store = (o && o.merge && store) ? { ...store, ...v } : { ...v }; return true; },
};
Object.defineProperty(admin, 'apps', { configurable: true, get() { return [{}]; } });
Object.defineProperty(admin, 'firestore', {
  configurable: true,
  get() { return () => ({ doc: () => docStub, collection: () => ({ get: async () => ({ docs: [] }) }) }); },
});

const push = require('../push');

(async () => {
  // 1. a boot with no mark at all — a cold start, or the very first ever
  store = null;
  let r = await push.deployBootCheck();
  ok('a boot with no mark pushes nothing', r.pushed === false && r.why === 'no-mark');

  // 2. a crash restart: the mark was already spent, so startedAt is 0
  store = { startedAt: 0, doneAt: 111 };
  r = await push.deployBootCheck();
  ok('a restart after the pair is complete stays silent', r.pushed === false && r.why === 'no-mark');

  // 3. a real deploy: start marks, boot pushes
  store = null;
  push.notifyDeploy('start');
  await new Promise((res) => setTimeout(res, 30));
  ok('a start writes the mark', store && Number(store.startedAt) > 0);
  const marked = store.startedAt;
  r = await push.deployBootCheck();
  ok('the boot after it pushes "back up"', r.pushed === true);
  ok('and the mark is cleared, so one deploy is one pair', store.startedAt === 0);
  ok('the clearing keeps the record honest (doneAt stamped)', Number(store.doneAt) >= marked);

  // 4. the same instance booting AGAIN (an OOM kill an hour later) is silent
  r = await push.deployBootCheck();
  ok('a second boot on the spent mark says nothing', r.pushed === false);

  // 5. a mark nobody ever consumed goes stale rather than buzzing a week later
  store = { startedAt: Date.now() - 60 * 60 * 1000 };
  r = await push.deployBootCheck();
  ok('an hour-old mark is stale, not a deploy', r.pushed === false && r.why === 'stale');
  ok('and a stale mark is cleared too', store.startedAt === 0);

  // 6. an unknown phase does nothing at all
  store = null;
  push.notifyDeploy('sideways');
  await new Promise((res) => setTimeout(res, 20));
  ok('an unknown phase writes no mark', store === null);

  // ── the wirings, by source ──────────────────────────────────────────────
  const P = fs.readFileSync(path.join(__dirname, '..', 'push.js'), 'utf8');
  ok('both phases have their own words', /start: \[/.test(P) && /done: \[/.test(P));
  ok('a deploy push names NO chat — PushDelegate would try to open one', !/notifyDeploy[\s\S]{0,900}sendAll\([^)]*chat:/.test(P));
  ok('it carries its own thread, so "back up" replaces "starting"', /thread: DEPLOY_THREAD/.test(P));
  ok('sendAll honours a thread with no chat', /data\.chat \|\| data\.thread/.test(P));

  const S = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  ok('the pause route pushes the start only on the deploy flag', /req\.body\.deploy[\s\S]{0,160}notifyDeploy\('start'\)/.test(S));
  ok('and boot runs the check', /deployBootCheck\(\)/.test(S));
  ok('boot is gated on RENDER_EXTERNAL_URL — a dev box must not eat her push',
    /RENDER_EXTERNAL_URL[\s\S]{0,400}deployBootCheck/.test(S));

  const G = fs.readFileSync(path.join(__dirname, 'deploy-guard.js'), 'utf8');
  ok('the guard flags only the re-affirming pause', /setPause\(fetchFn, true, true\)/.test(G));
  ok('and its first pause is unflagged', /const paused = await setPause\(fetchFn, true\);/.test(G));

  // ── A STATE DOC IS NEVER PUSHED TO ────────────────────────────────────
  // Found in the LIVE log the hour this shipped:
  //   push: send issues [{"device":"__deploy", … "reason":"BadDeviceToken",
  //                       "removed":true}]
  // The deploy mark lives in the DEVICES collection, so `sendAll` pushed to
  // it, Apple refused it, and the mark was deleted as a dead token — by the
  // very "start" push that had just written it. The "back up" buzz on the
  // next boot then found nothing, and it did it SILENTLY, because removing a
  // dead token is exactly what that code is for. It fired on one deploy and
  // not the next: the race between the two writes.
  {
    const P = fs.readFileSync(path.join(__dirname, '..', 'push.js'), 'utf8');
    ok("a `__`-prefixed doc is reserved for this module's own state", /const STATE_DOC = \/\^__\//.test(P));
    const at = P.indexOf('async function loadDevices');
    const load = P.slice(at, at + 600);
    ok('loadDevices skips a state doc', /STATE_DOC\.test\(d\.id\)/.test(load));
    ok('and anything carrying no real token', /typeof d\.get\('token'\) === 'string'/.test(load));
  }

  if (fails.length) {
    console.log('DEPLOY NOTIFY — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('DEPLOY NOTIFY — ' + pass + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });

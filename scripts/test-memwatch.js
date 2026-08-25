/*
 * The OOM tripwire, pure — no network, no server.
 *   node scripts/test-memwatch.js
 */
const assert = require('assert');
const mw = require('../memwatch.js');

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log('  ok ', name); }

ok('the ring keeps only the newest RING_MAX requests', () => {
  mw._reset();
  for (let i = 0; i < mw.RING_MAX + 15; i++) mw.note({ method: 'GET', originalUrl: `/r/${i}` });
  assert.strictEqual(mw.ring.length, mw.RING_MAX);
  assert.strictEqual(mw.ring[mw.ring.length - 1].p, `/r/${mw.RING_MAX + 14}`);
  assert.strictEqual(mw.ring[0].p, '/r/15');
});

ok('a long url is cut, never stored whole', () => {
  mw._reset();
  mw.note({ method: 'GET', originalUrl: '/x'.repeat(400) });
  assert.strictEqual(mw.ring[0].p.length, 120);
});

ok('below the line there is no snapshot', () => {
  mw._reset();
  // this process is far below 100000MB
  assert.strictEqual(mw.check({ alertMb: 100000, throttleMs: 0 }), null);
});

ok('over the line files one snapshot with the recent requests, then throttles', () => {
  mw._reset();
  mw.note({ method: 'POST', originalUrl: '/api/heavy' });
  let now = 1000000;
  const o = { alertMb: 1, throttleMs: 5 * 60 * 1000, now: () => now };
  const snap = mw.check(o);
  assert.ok(snap, 'a snapshot');
  assert.ok(snap.rssMb > 0);
  assert.strictEqual(snap.recent.length, 1);
  assert.strictEqual(snap.recent[0].p, '/api/heavy');
  // inside the throttle window: silent
  now += 60 * 1000;
  assert.strictEqual(mw.check(o), null);
  // past it: files again
  now += 5 * 60 * 1000;
  assert.ok(mw.check(o));
});

ok('a request with no url never throws', () => {
  mw._reset();
  mw.note({ method: 'GET' });
  assert.strictEqual(mw.ring[0].p, '');
});

ok('install wires the middleware and returns the resolved options', () => {
  mw._reset();
  const uses = [];
  const app = { use: (fn) => uses.push(fn) };
  const o = mw.install(app, { apps: [] }, { alertMb: 999, intervalMs: 3600 * 1000 });
  assert.strictEqual(uses.length, 1);
  const next = { called: false };
  uses[0]({ method: 'GET', originalUrl: '/via-mw' }, {}, () => { next.called = true; });
  assert.ok(next.called, 'next() ran');
  assert.strictEqual(mw.ring[0].p, '/via-mw');
  assert.strictEqual(o.alertMb, Number(process.env.MEM_ALERT_MB) || 999);
});

console.log(`\n${passed} checks passed.`);

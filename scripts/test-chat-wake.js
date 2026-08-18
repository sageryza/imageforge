#!/usr/bin/env node
// The wake doorbell's decision table (chat-wake.js) — pure, no network, no
// Firestore. Run: node scripts/test-chat-wake.js
const assert = require('assert');
const { decideWake, switchboardFor, validTrigger, noteReply, FIRE_DEBOUNCE_MS } = require('../chat-wake');

let n = 0;
function ok(name, fn) { fn(); n++; console.log('  ✓ ' + name); }

const sbOn = { acct: '2', trig: 'trig_x', token: 't', configured: true };
const sbOff = { acct: '1', trig: '', token: '', configured: false };
const regd = { wakeTriggerId: 'trig_01AbCdEf' };

ok('unregistered chat → not-wakeable, no fire (no queue entry to strand)', () => {
  assert.deepStrictEqual(decideWake({}, sbOn, 1000, 0), { fire: false, status: 'not-wakeable' });
  assert.deepStrictEqual(decideWake(null, sbOn, 1000, 0), { fire: false, status: 'not-wakeable' });
});

ok('registered but no switchboard token → no-switchboard, no fire', () => {
  assert.deepStrictEqual(decideWake(regd, sbOff, 1000, 0), { fire: false, status: 'no-switchboard' });
});

ok('registered + configured + quiet → fired', () => {
  assert.deepStrictEqual(decideWake(regd, sbOn, 1000, 0), { fire: true, status: 'fired' });
  assert.deepStrictEqual(decideWake(regd, sbOn, 1000, undefined), { fire: true, status: 'fired' });
});

ok('a fire inside the debounce window → queued, not re-fired', () => {
  const now = 1000000;
  assert.deepStrictEqual(decideWake(regd, sbOn, now, now - FIRE_DEBOUNCE_MS + 1),
    { fire: false, status: 'queued' });
  // …and once the window passes, it fires again
  assert.deepStrictEqual(decideWake(regd, sbOn, now, now - FIRE_DEBOUNCE_MS - 1),
    { fire: true, status: 'fired' });
});

ok('switchboardFor: unknown accounts collapse to 2; account-2 trigger id has a committed default', () => {
  delete process.env.WAKE_TRIGGER_2; delete process.env.WAKE_FIRE_TOKEN_2;
  const sb = switchboardFor('nonsense');
  assert.strictEqual(sb.acct, '2');
  assert.ok(/^trig_/.test(sb.trig), 'default trigger id present');
  assert.strictEqual(sb.configured, false, 'no token → not configured');
  process.env.WAKE_FIRE_TOKEN_2 = 'sk-test';
  assert.strictEqual(switchboardFor('2').configured, true);
  delete process.env.WAKE_FIRE_TOKEN_2;
});

ok('switchboardFor: env always beats the committed default', () => {
  process.env.WAKE_TRIGGER_2 = 'trig_override';
  assert.strictEqual(switchboardFor('2').trig, 'trig_override');
  delete process.env.WAKE_TRIGGER_2;
});

ok('validTrigger: trig_… only, sane lengths', () => {
  assert.ok(validTrigger('trig_01JWxYFQzEJVRxToP6EdDbmR'));
  assert.ok(!validTrigger('routine-7'));
  assert.ok(!validTrigger('trig_'));
  assert.ok(!validTrigger(''));
  assert.ok(!validTrigger('trig_' + 'a'.repeat(80)));
  assert.ok(!validTrigger('trig_abc def'));
});

ok('noteReply never throws — not on a dead db, not on a bad chat', () => {
  noteReply(() => { throw new Error('firestore down'); }, 'some-chat');
  noteReply(() => ({ collection: () => ({ doc: () => ({ delete: () => Promise.reject(new Error('x')) }) }) }), 'c');
});

console.log(`\nAll ${n} checks passed.`);

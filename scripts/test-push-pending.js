#!/usr/bin/env node
// push.js — the held buzz (2026-08-28, Sophie: "I get notified on my phone a
// few seconds before chats actually finish their turn").
//
// A deliverable, a Compare page and an auto-compare grid are all filed
// MID-TURN, and each used to push the instant it was filed — measured against
// her real deliverables that day, 19s to 103s before the chat's finished
// reply. They queue now, and the finished reply lets the buzz out.
//
// Apple cannot be called from a test, so this drives the queue against a
// stubbed sender and asserts WHEN a send happens and when one is refused.
//
//   node scripts/test-push-pending.js       (no deps beyond node)

const crypto = require('crypto');
const assert = require('assert');

const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
process.env.APNS_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });
process.env.APNS_KEY_ID = 'TESTKEY123';
process.env.APNS_TEAM_ID = 'TEAM123456';

const push = require('../push.js');
const { pending, PENDING_MS } = push._internals;

// Stub the wire: queueChat/flushChat release through push._internals.wire,
// which exists so this can be watched without a device or a socket.
const calls = [];
push._internals.wire.notify = (chat, title, body, opts) => {
  calls.push({ chat, title, body, opts });
};

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const reset = () => { for (const k of Object.keys(pending)) {
  if (pending[k].timer) clearTimeout(pending[k].timer); delete pending[k];
} calls.length = 0; };

// ---- 1. queueing sends NOTHING --------------------------------------------
try {
  reset();
  push.queueChat('reel-chat', 'New deliverable', 'Evan v18 — reel chat', { debounce: false });
  assert.strictEqual(calls.length, 0, 'queue must not send');
  assert(pending['reel-chat'], 'entry held for the chat');
  console.log('ok 1 — a mid-turn filing queues instead of buzzing');
} catch (e) { fail('1 ' + e.message); }

// ---- 2. the finished reply lets it out ------------------------------------
try {
  const before = calls.length;
  const outcome = push.flushChat('reel-chat', { suppress: false });
  assert.strictEqual(outcome, true, 'flush reports the send');
  assert.strictEqual(calls.length, before + 1, 'exactly one buzz');
  assert.strictEqual(calls[before].body, 'Evan v18 — reel chat', 'the held body');
  assert.strictEqual(calls[before].opts.debounce, false, 'opts ride along');
  assert(!pending['reel-chat'], 'entry cleared');
  console.log('ok 2 — the finished reply releases the held buzz');
} catch (e) { fail('2 ' + e.message); }

// ---- 3. a reply that buzzed her swallows the held one ----------------------
// Same chat, same second, same collapse-id: the second is only ever noise.
try {
  reset();
  push.queueChat('reel-chat', 'New deliverable', 'v19', { debounce: false });
  const outcome = push.flushChat('reel-chat', { suppress: true });
  assert.strictEqual(outcome, false, 'suppressed');
  assert.strictEqual(calls.length, 0, 'no second buzz');
  assert(!pending['reel-chat'], 'entry still cleared, never re-sent later');
  console.log('ok 3 — a reply push swallows the pending one');
} catch (e) { fail('3 ' + e.message); }

// ---- 4. flushing a chat with nothing held is a no-op ----------------------
try {
  reset();
  assert.strictEqual(push.flushChat('quiet-chat'), false, 'nothing to send');
  assert.strictEqual(calls.length, 0, 'and nothing sent');
  console.log('ok 4 — an ordinary reply with nothing held sends nothing');
} catch (e) { fail('4 ' + e.message); }

// ---- 5. newest news wins, and the DEADLINE does not move ------------------
// A chat filing a deliverable every few minutes must not be able to push its
// own doorbell out forever.
try {
  reset();
  push.queueChat('reel-chat', 'New deliverable', 'v1');
  const at = pending['reel-chat'].at;
  pending['reel-chat'].at = at - 60 * 1000;          // pretend a minute passed
  push.queueChat('reel-chat', 'New deliverable', 'v2');
  assert.strictEqual(Object.keys(pending).length, 1, 'one entry per chat');
  assert.strictEqual(pending['reel-chat'].at, at - 60 * 1000, 'deadline kept');
  push.flushChat('reel-chat');
  assert.strictEqual(calls[0].body, 'v2', 'newest news wins');
  console.log('ok 5 — one entry per chat, the original deadline kept');
} catch (e) { fail('5 ' + e.message); }

// ---- 6. the fallback fires for a chat that never replies -------------------
// A hookless session or a script filing a film posts no finished reply, and a
// doorbell that waits forever never rings.
try {
  reset();
  assert(PENDING_MS >= 5 * 60 * 1000, 'the fallback sits out a long turn');
  push.queueChat('scripted', 'New deliverable', 'from a script');
  const held = pending['scripted'];
  clearTimeout(held.timer);
  held.timer = null;
  push.flushChat('scripted');        // what the timer does when it fires
  assert.strictEqual(calls.length, 1, 'the fallback still buzzes');
  console.log('ok 6 — a chat that never replies still rings, eventually');
} catch (e) { fail('6 ' + e.message); }

// ---- 7. the timer never holds the process open ----------------------------
try {
  reset();
  push.queueChat('unref-chat', 'New deliverable', 'x');
  assert(pending['unref-chat'].timer, 'a timer exists');
  assert.strictEqual(typeof pending['unref-chat'].timer.unref, 'function', 'unref-able');
  reset();
  console.log('ok 7 — the fallback timer is unref\'d, so it holds nothing open');
} catch (e) { fail('7 ' + e.message); }

if (!process.exitCode) console.log('\nall push-pending checks passed');

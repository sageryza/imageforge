#!/usr/bin/env node
// GET /api/chatfeed/widget — what the home-screen widget reads (Aug 2026,
// Sophie: "I'd like the widget"). Drives the REAL route against a stubbed
// Firestore, because the question is what the ROUTE decides, which no
// source-shape assertion can answer:
//   1. a chat with a fresh reply is a row; the ✓ she tapped (notifSeenAt
//      newer than the reply) silences it — that stamp is the widget's only
//      floor, since a widget process cannot read the app's localStorage;
//   2. archived chats never show, and neither do HER messages or live drafts
//      (a half-written draft is not a delivery);
//   3. the line follows the same priority the home row uses — her note, then
//      the chat's status card, then the TLDR;
//   4. rows are newest-first and capped by ?limit, and `count` is the FULL
//      number so the badge doesn't lie when the list is cut.
//
//   node scripts/test-widget-feed.js

const assert = require('assert');
const Module = require('module');

const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

const MSGS = [
  { chat: 'fresh', from: 'claude', tldr: 'v8 is up', created: iso(T0 - 5 * 60000) },
  { chat: 'checked', from: 'claude', tldr: 'delivered', created: iso(T0 - 60 * 60000) },
  { chat: 'noted', from: 'claude', tldr: 'the chat TLDR', created: iso(T0 - 20 * 60000) },
  { chat: 'carded', from: 'claude', tldr: 'the chat TLDR', created: iso(T0 - 30 * 60000) },
  { chat: 'archived', from: 'claude', tldr: 'old work', created: iso(T0 - 10 * 60000) },
  { chat: 'hers', from: 'sophie', text: 'my own message', created: iso(T0 - 1 * 60000) },
  { chat: 'drafting', from: 'claude', working: true, text: 'still writing', created: iso(T0 - 2 * 60000) },
];
const REG = {
  fresh: { displayName: 'Cutting blocks' },
  checked: { notifSeenAt: iso(T0 - 30 * 60000) },        // ✓ AFTER its reply
  noted: { sophieNote: 'her own note' },
  carded: { statusNeed: 'pick a palette' },
  archived: { archived: true },
  hers: {}, drafting: {},
};

// stub firebase-admin under the real route
const fakeAdmin = {
  apps: [{}],
  firestore: () => ({
    collection: (name) => ({
      doc: () => ({ set: async () => {}, get: async () => ({ exists: false }) }),
      where: function () { return this; },
      orderBy: function () { return this; },
      limit: function () { return this; },
      get: async () => (name === 'forge-chat-registry'
        ? { docs: Object.keys(REG).map((id) => ({ id, data: () => REG[id] })) }
        : { docs: MSGS.slice().sort((a, b) => (a.created < b.created ? 1 : -1))
            .map((m, i) => ({ id: 'm' + i, data: () => m })) }),
    }),
  }),
  storage: () => ({ bucket: () => ({ name: 'b', file: () => ({}) }) }),
};
fakeAdmin.firestore.FieldValue = { delete: () => 'DELETE' };
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase-admin') return fakeAdmin;
  return origLoad.apply(this, arguments);
};
const { router } = require('../chatfeed.js');
Module._load = origLoad;

function call(query) {
  return new Promise((resolve) => {
    const layer = router.stack.find((l) => l.route && l.route.path === '/widget');
    if (!layer) return resolve({ error: 'no /widget route' });
    layer.route.stack[0].handle(
      { query, get: () => null, method: 'GET', path: '/widget' },
      { set() {}, status() { return this; }, json: (o) => resolve(o) },
      () => {},
    );
  });
}

(async () => {
  const d = await call({});
  if (d.error) return fail(d.error);
  const names = (d.rows || []).map((r) => r.chat);

  // 1. fresh shows, checked-off does not
  if (!names.includes('fresh')) fail('a chat with a fresh reply is missing: ' + names.join(','));
  if (names.includes('checked')) fail('a chat she checked off still shows: ' + names.join(','));
  // 2. archived / hers / drafts never show
  for (const bad of ['archived', 'hers', 'drafting']) {
    if (names.includes(bad)) fail(`"${bad}" should never be a widget row: ` + names.join(','));
  }
  // 3. the line's priority — her note beats the TLDR, a status card beats it too
  const noted = (d.rows || []).find((r) => r.chat === 'noted');
  if (!noted || noted.line !== 'her own note') fail('her note does not win the line: ' + (noted && noted.line));
  const carded = (d.rows || []).find((r) => r.chat === 'carded');
  if (!carded || carded.line !== 'pick a palette') fail('the status card does not win over the TLDR: ' + (carded && carded.line));
  const fresh = (d.rows || []).find((r) => r.chat === 'fresh');
  if (!fresh || fresh.line !== 'v8 is up') fail('the TLDR is not the fallback line: ' + (fresh && fresh.line));
  if (!fresh || fresh.name !== 'Cutting blocks') fail('the row does not use the name she gave the chat');
  // 4. newest first, and count is the FULL number even when rows are cut
  const times = (d.rows || []).map((r) => r.at);
  if (times.join('|') !== times.slice().sort().reverse().join('|')) fail('rows are not newest-first');
  if (d.count !== 3) fail('count should be 3 (fresh, noted, carded), got ' + d.count);
  const one = await call({ limit: '1' });
  if ((one.rows || []).length !== 1) fail('?limit did not cut the rows');
  if (one.count !== 3) fail('count must stay the FULL number when rows are cut, got ' + one.count);

  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: the widget feed shows what is unchecked, in her wording, newest first');
})().catch((e) => { console.error(e); process.exit(1); });

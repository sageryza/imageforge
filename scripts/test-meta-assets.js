#!/usr/bin/env node
// META ASSETS — the aggregation rules, pure, no network.
//   1. every chat's filings appear, ordered by when they were filed (newest
//      first), interleaved across chats;
//   2. two copies of one picture INSIDE one chat collapse to one row (the
//      same union its own tab does), keeping the labeled url;
//   3. the same picture filed in TWO chats stays TWO rows — a vote is keyed
//      chat+url, so each row must belong to exactly one tab;
//   4. equal timestamps page deterministically (a batch filed in one turn);
//   5. a doc with no chat or no url is dropped, never a phantom row.
//
//   node scripts/test-meta-assets.js
'use strict';
const assert = require('assert');
const { buildMetaAssets } = require('../meta-assets');

const iso = (n) => new Date(1700000000000 + n * 1000).toISOString();

// 1 + 2 + 3 together: three chats, one in-chat duplicate, one cross-chat twin.
const rows = buildMetaAssets([
  { chat: 'witch-school', url: 'https://x/a.png', created: iso(10), description: 'Moon lesson card' },
  { chat: 'dating-book', url: 'https://x/b.png', created: iso(30), md5: 'mm1' },
  // the hook's claude-deliveries copy of b.png — same chat, same bytes
  { chat: 'dating-book', url: 'https://x/999-r4nd0m.png', created: iso(31), md5: 'mm1',
    description: 'Penny — the blue Kleenex' },
  { chat: 'evan-film', url: 'https://x/c.png', created: iso(20) },
  // the SAME picture as a.png, filed in a different chat — stays its own row
  { chat: 'evan-film', url: 'https://x/a.png', created: iso(40) },
  { chat: '', url: 'https://x/orphan.png', created: iso(50) },   // no chat → dropped
  { chat: 'witch-school', url: '', created: iso(50) },           // no url → dropped
]);

assert.strictEqual(rows.length, 4, 'four rows: dup collapsed, twin kept, strays dropped');
// newest first, interleaved across chats
assert.deepStrictEqual(rows.map((r) => r.chat),
  ['evan-film', 'dating-book', 'evan-film', 'witch-school'], 'filing order across chats');
// the in-chat duplicate folded onto ONE row carrying the label
const b = rows.find((r) => r.chat === 'dating-book');
assert.strictEqual(b.description, 'Penny — the blue Kleenex', 'label survives the fold');
assert.ok(b.alts.indexOf('https://x/b.png') >= 0, 'the other path rides along as an alt');
// the cross-chat twin is two rows, one per chat, so votes stay unambiguous
assert.strictEqual(rows.filter((r) => r.url === 'https://x/a.png').length, 2,
  'same url in two chats = two rows');

// 4: a same-second batch pages the same way every build.
const batch = [
  { chat: 'zeta', url: 'https://x/2.png', created: iso(0) },
  { chat: 'alpha', url: 'https://x/3.png', created: iso(0) },
  { chat: 'alpha', url: 'https://x/1.png', created: iso(0) },
];
const once = buildMetaAssets(batch).map((r) => r.chat + '|' + r.url);
const again = buildMetaAssets(batch.slice().reverse()).map((r) => r.chat + '|' + r.url);
assert.deepStrictEqual(once, again, 'equal timestamps order deterministically');

console.log('test-meta-assets: all good —', rows.length, 'rows from 7 docs, order + union + twin rules hold');

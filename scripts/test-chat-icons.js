#!/usr/bin/env node
/* The chat-icon sweep's decision table — who gets drawn and who is skipped.
 * Pure, no network, no Firestore: it drives the exported functions against
 * fixture registry rows. Run: node scripts/test-chat-icons.js */
const assert = require('assert');
const { waitingFrom, drawable, lineFor, GENERIC, PER_SHEET } = require('../chaticons');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ok', name); };

const rows = {
  'crystals-etsy-listings': { lastSeen: '2026-08-20T03:00:00Z' },
  'already-drawn': { icon: 'https://…/x.png', lastSeen: '2026-08-20T02:00:00Z' },
  'old-and-filed': { archived: true, displayName: 'a real name', lastSeen: '2026-08-20T01:00:00Z' },
  'binned': { deletedAt: '2026-08-19T00:00:00Z', lastSeen: '2026-08-20T00:00:00Z' },
  'new-session-7f3e9a': { lastSeen: '2026-08-20T04:00:00Z' },
  'new-session-b5902a': { displayName: 'XI DICE', lastSeen: '2026-08-20T05:00:00Z' },
  __settings: { appAccount: '1' },
};

t('archived chats are skipped — her rule, and the reason the sweep is affordable', () => {
  const names = waitingFrom(rows).map((w) => w.chat);
  assert(!names.includes('old-and-filed'), 'an archived chat must never be drawn');
});

t('the trash is skipped', () => {
  assert(!waitingFrom(rows).map((w) => w.chat).includes('binned'));
});

t('a chat that already has one is not redrawn', () => {
  assert(!waitingFrom(rows).map((w) => w.chat).includes('already-drawn'));
});

t('a generic slug with nothing filed is skipped — there is no picture of an unnamed session', () => {
  assert(!waitingFrom(rows).map((w) => w.chat).includes('new-session-7f3e9a'));
  assert.strictEqual(drawable('new-session-7f3e9a', {}), false);
  assert(GENERIC.test('new-session-7f3e9a') && GENERIC.test('session') && GENERIC.test('untitled'));
});

t('...but the SAME slug is drawable the moment she names it', () => {
  assert(waitingFrom(rows).map((w) => w.chat).includes('new-session-b5902a'));
  assert.strictEqual(drawable('new-session-b5902a', { displayName: 'XI DICE' }), true);
});

t('a descriptive slug alone is enough', () => {
  assert(waitingFrom(rows).map((w) => w.chat).includes('crystals-etsy-listings'));
  assert.strictEqual(drawable('crystals-etsy-listings', {}), true);
});

t('__settings is not a chat', () => {
  assert(!waitingFrom(rows).map((w) => w.chat).includes('__settings'));
});

t('most recently active first — the ones she is looking at get drawn first', () => {
  const names = waitingFrom(rows).map((w) => w.chat);
  assert.deepStrictEqual(names, ['new-session-b5902a', 'crystals-etsy-listings']);
});

t('the line carries her words, not the whole thread', () => {
  const line = lineFor('x', {
    displayName: 'chunking', sophieNote: 'the og', updAsked: 'rebuild it',
    statusDoing: 'drawing now', wrapLine: 'done', text: 'a whole conversation',
  });
  assert(line.includes('chunking') && line.includes('the og') && line.includes('rebuild it'));
  assert(!line.includes('a whole conversation'));
  assert(line.length <= 260, 'the line is capped');
});

t('a chat with nothing at all still gets an empty line, not a crash', () => {
  assert.strictEqual(lineFor('x', {}), '');
});

t('one sheet is 25 — the price of an icon depends on it', () => {
  assert.strictEqual(PER_SHEET, 25);
});

console.log(`\n${n} passed`);

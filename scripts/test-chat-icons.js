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

// ---- the silent-skip regression -------------------------------------------
// The first live run drew 76 of 101: one batch's naming call came back
// unparseable, the old code turned that into blank subjects, and the run
// reported `done` with 25 chats quietly missing. subjectsFor must THROW so the
// caller can record the batch instead of losing it.
const chaticons = require('../chaticons');
const anthropic = require('../anthropic');

(async () => {
  let m = 0;
  const ta = async (name, fn) => { await fn(); m++; console.log('  ok', name); };
  const batch = [{ chat: 'a', about: 'x' }, { chat: 'b', about: 'y' }];

  await ta('no key → throws, never blank subjects', async () => {
    anthropic.available = () => false;
    await assert.rejects(() => chaticons.subjectsFor(batch), /ANTHROPIC_API_KEY/);
  });

  await ta('an unparseable answer → throws (this is the 76-of-101 bug)', async () => {
    anthropic.available = () => true;
    anthropic.chatJSON = async () => { throw new Error('no JSON in the reply'); };
    await assert.rejects(() => chaticons.subjectsFor(batch), /no JSON/);
  });

  await ta('an answer with no usable subjects → throws rather than drawing nothing', async () => {
    anthropic.chatJSON = async () => ({ icons: [] });
    await assert.rejects(() => chaticons.subjectsFor(batch), /no subjects/);
  });

  await ta('a good answer maps back by position', async () => {
    anthropic.chatJSON = async () => ({ icons: [{ n: 1, draw: 'a red kettle' }, { n: 2, draw: 'a paper boat' }] });
    assert.deepStrictEqual(await chaticons.subjectsFor(batch),
      [{ chat: 'a', draw: 'a red kettle' }, { chat: 'b', draw: 'a paper boat' }]);
  });

  await ta('a partial answer keeps what came back and blanks the rest', async () => {
    anthropic.chatJSON = async () => ({ icons: [{ n: 2, draw: 'a paper boat' }] });
    assert.deepStrictEqual(await chaticons.subjectsFor(batch),
      [{ chat: 'a', draw: '' }, { chat: 'b', draw: 'a paper boat' }]);
  });

  console.log(`${m} passed`);
})();

// ---- her hours, and one run at a time --------------------------------------
// Both come from live findings: the daily tick fired four minutes into a hand
// run and redrew a sheet's worth of chats for nothing, and Sophie asked for the
// automatic sweep to keep to 11am-11pm on HER clock ("i'm on pst not utc").
(async () => {
  let k = 0;
  const tw = (name, fn) => { fn(); k++; console.log('  ok', name); };
  const { pacificHour, inWindow, WINDOW, STALE_RUN_MS } = chaticons;
  // 2026-08-27 is PDT (UTC-7); 2026-01-15 is PST (UTC-8).
  const utc = (s) => new Date(s);

  tw('the window is her 11am-11pm', () => {
    assert.deepStrictEqual(WINDOW, { from: 11, to: 23 });
  });

  tw('summer: the hour is read in PDT, not UTC', () => {
    assert.strictEqual(pacificHour(utc('2026-08-27T18:30:00Z')), 11);   // 11:30am PDT
    assert.strictEqual(inWindow(utc('2026-08-27T18:30:00Z')), true);
    assert.strictEqual(pacificHour(utc('2026-08-27T17:30:00Z')), 10);   // 10:30am PDT
    assert.strictEqual(inWindow(utc('2026-08-27T17:30:00Z')), false);
  });

  tw('winter: the SAME wall-clock hours, on PST', () => {
    assert.strictEqual(pacificHour(utc('2026-01-15T19:30:00Z')), 11);   // 11:30am PST
    assert.strictEqual(inWindow(utc('2026-01-15T19:30:00Z')), true);
    assert.strictEqual(pacificHour(utc('2026-01-15T18:30:00Z')), 10);
    assert.strictEqual(inWindow(utc('2026-01-15T18:30:00Z')), false);
  });
  // A fixed -8 offset would put both summer cases an hour out — that is the
  // whole reason this reads the IANA zone rather than subtracting.

  tw('11pm is shut, 10:59pm is open — the top of the window is exclusive', () => {
    assert.strictEqual(inWindow(utc('2026-08-28T05:59:00Z')), true);    // 10:59pm PDT
    assert.strictEqual(inWindow(utc('2026-08-28T06:00:00Z')), false);   // 11:00pm PDT
  });

  tw('the middle of the night is shut', () => {
    assert.strictEqual(inWindow(utc('2026-08-27T10:00:00Z')), false);   // 3am PDT
  });

  tw('a run stuck "running" stops blocking after 20 minutes', () => {
    assert.strictEqual(STALE_RUN_MS, 20 * 60 * 1000);
  });

  console.log(`${k} passed`);
})();

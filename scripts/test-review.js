#!/usr/bin/env node
// Tests for the Review Queue's decision table (review.js) — pure, no network,
// no Firestore. `buildQueue` takes plain objects for exactly this reason.
//
// The rules it pins:
//   • a template page is WAITING until every item is decided, then it is DONE
//   • the stock 'later' is "declined to sort now" — still waiting, counted
//     apart; a page with its OWN states counts every one of them
//   • a superseded page is history — on neither list
//   • reviewHidden ("not a review") moves a row to the hidden pile, never
//     deletes it
//   • a page whose data can't be read shows NO wrong numbers — it is skipped
//   • waiting sorts newest post first; her chat's displayName names the row
//   • `reviewDone` — her Done button in the deck's piles area — files a page
//     as done whatever its cards say (Aug 2026 v2)
//   • the queue is DECKS AND ONLY DECKS: a chat carrying `to be reviewed` is
//     NOT a row here any more (same day — the chat is reached from inside its
//     own deck instead)
//
//   node scripts/test-review.js

const { buildQueue, pageItems, pageProgress } = require('../review');

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(`${name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
}
function ok(name, cond) { is(name, Boolean(cond), true); }

const t = (min) => new Date(Date.UTC(2026, 7, 18, 12, min, 0)).toISOString();

const deck = (ids, extra) => ({
  items: ids.map((id) => ({ id, img: `https://storage.googleapis.com/b/${id}.webp` })),
  ...extra,
});

// ── pageItems: deck vs grid vs text-only ───────────────────────────────────
{
  const d = pageItems(deck(['a', 'b']));
  is('deck ids', d.ids, ['a', 'b']);
  is('deck thumb is the first picture', d.thumb, 'https://storage.googleapis.com/b/a.webp');
  is('stock states', d.custom, false);
  is('a picture deck needs no peek', d.peek, '');

  const g = pageItems({ groups: [{ items: [{ id: 'g1' }] }, { items: [{ id: 'g2' }, { id: 'g3' }] }] });
  is('grid ids flatten across groups', g.ids, ['g1', 'g2', 'g3']);

  const txt = pageItems({ items: [{ id: 'm1', text: 'a moment' }], states: [{ key: 'done', label: 'Done' }] });
  is('a text deck has no thumb', txt.thumb, '');
  is('its own states mark it custom', txt.custom, true);
  is('its tile face is the first card\'s words', txt.peek, 'a moment');

  // a moment card may carry no single `text` at all — the peek still finds it
  const mom = pageItems({ items: [
    { id: 'm1' },   // an empty first card yields nothing — the peek moves on
    { id: 'm2', who: 'Blake', sections: [{ label: 'The moment', text: 'he brought a kite' }] },
  ] });
  is('a moment deck peeks the card parts', mom.peek, 'Blake');
}

// ── pageProgress: the 'later' rule ─────────────────────────────────────────
{
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const v = { a: true, b: false, c: 'maybe', d: 'later', e: null };
  is('stock: ♥ ✕ maybe decide, later and null do not',
    pageProgress(ids, false, v), { decided: 3, later: 1 });
  is('custom states: every recorded state decides, even one called later',
    pageProgress(ids, true, v), { decided: 4, later: 0 });
  is('no verdict doc at all', pageProgress(ids, false, undefined), { decided: 0, later: 0 });
  is('a verdict for an item the page does not have is ignored',
    pageProgress(['a'], false, { a: true, ghost: true }), { decided: 1, later: 0 });
}

// ── buildQueue: the piles ──────────────────────────────────────────────────
{
  const q = buildQueue({
    pages: [
      { id: 'p1', chat: 'xi', title: 'Batch 1', created: t(1), template: 'deck' },
      { id: 'p2', chat: 'xi', title: 'Batch 2', created: t(2), template: 'deck' },
      { id: 'p3', chat: 'ig', title: 'Old look', created: t(3), template: 'grid', superseded: true },
      { id: 'p4', chat: 'demo', title: 'Deck demo', created: t(4), template: 'deck', reviewHidden: true },
      { id: 'p5', chat: 'ig', title: 'Finished set', created: t(5), template: 'deck' },
      { id: 'p6', chat: 'ig', title: 'Unreadable', created: t(6), template: 'deck' },
    ],
    items: {
      p1: deck(['a', 'b']),
      p2: deck(['c', 'd']),
      p3: deck(['e']),
      p4: deck(['f']),
      p5: deck(['g', 'h']),
      // p6 absent — its Storage JSON could not be read
    },
    verdicts: {
      xi__page__nope: {},  // wrong key shape — never matches
      'xi__page-p1': { items: { a: true }, updatedAt: t(30) },
      'ig__page-p5': { items: { g: true, h: 'maybe' }, updatedAt: t(31) },
    },
    chats: { xi: { displayName: 'XI Cards' } },
  });

  is('waiting is the unfinished, newest post first',
    q.waiting.map((r) => r.id), ['p2', 'p1']);
  is('done holds the fully decided', q.done.map((r) => r.id), ['p5']);
  is('hidden holds the ✕ row', q.hidden.map((r) => r.id), ['p4']);
  ok('superseded is nowhere',
    !['p3'].some((id) => q.waiting.concat(q.done, q.hidden).some((r) => r.id === id)));
  ok('unreadable data is nowhere (no wrong numbers)',
    !q.waiting.concat(q.done, q.hidden).some((r) => r.id === 'p6'));
  is('progress rides the row', [q.waiting[1].decided, q.waiting[1].total], [1, 2]);
  is('her rename names the row', q.waiting[0].name, 'XI Cards');
  is('a chat she has not renamed shows its slug', q.done[0].name, 'ig');
  is('the tile opens the page CLEAN — straight onto the cards, no h1',
    q.waiting[0].url, '/api/chatfeed/page/p2?clean=1');
  is('counts: pages waiting', q.counts.pages, 2);
  is('counts: cards to go', q.counts.items, 3);
  is('the pane no longer counts chats', q.counts.chats, undefined);
  is('a finished row stamps her last touch', q.done[0].at, t(31));
}

// ── HER DONE BUTTON (Aug 2026 v2, Sophie: "instead offer a skip or done
//    button in the piles area deck") ─────────────────────────────────────────
// "I'm finished with this one" is a real answer even when cards are unmarked —
// a browse she read through, a set she decided about as a whole — so the stamp
// files the page as done without touching a single verdict.
{
  const q = buildQueue({
    pages: [
      { id: 'p1', chat: 'xi', title: 'Read through', created: t(1), template: 'deck', reviewDone: true },
      { id: 'p2', chat: 'xi', title: 'Still going', created: t(2), template: 'deck' },
      // a skipped page is hidden, and hidden beats done — she said it was
      // never a review at all
      { id: 'p3', chat: 'xi', title: 'A demo', created: t(3), template: 'deck',
        reviewDone: true, reviewHidden: true },
    ],
    items: { p1: deck(['a', 'b']), p2: deck(['c', 'd']), p3: deck(['e']) },
    verdicts: {},
    chats: {},
  });
  is('her Done files it as done with nothing marked', q.done.map((r) => r.id), ['p1']);
  is('…and it is not still waiting', q.waiting.map((r) => r.id), ['p2']);
  is('skip wins over done', q.hidden.map((r) => r.id), ['p3']);
  is('the done page stops counting cards to go', q.counts.items, 2);
}

// ── DECKS AND ONLY DECKS (Aug 2026 v2, Sophie: "take away the chat list at
//    the bottom and instead offer a link back to the chat in the piles area")
{
  const chats = {
    'needs-me': { displayName: 'The witch shop', labels: ['witch', 'to be reviewed'],
      statusNeed: 'pick a palette, 10 seconds', updAt: t(40) },
    'old-shape': { category: 'to be reviewed', statusAt: t(20) },
  };
  const q = buildQueue({ pages: [], items: {}, verdicts: {}, chats,
    reviewLabel: 'to be reviewed' });
  is('a tagged chat is no longer a row here — the deck holds the link now',
    [q.waiting.length, q.done.length, q.hidden.length], [0, 0, 0]);
  is('and nothing counts chats any more', q.counts, { pages: 0, items: 0, done: 0 });
}

// ── an empty world stays calm ──────────────────────────────────────────────
{
  const q = buildQueue({ pages: [], items: {}, verdicts: {}, chats: {} });
  is('empty queue', [q.waiting.length, q.done.length, q.hidden.length], [0, 0, 0]);
  is('empty counts', q.counts, { pages: 0, items: 0, done: 0 });
}

if (fails.length) {
  console.error(`review: ${fails.length} FAILED, ${pass} passed\n`);
  fails.forEach((f) => console.error(`  ✗ ${f}\n`));
  process.exit(1);
}
console.log(`review: all ${pass} passed`);

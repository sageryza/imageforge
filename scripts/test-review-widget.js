#!/usr/bin/env node
// GET /api/review/widget — what the home-screen widget reads (2026-09-02,
// Sophie: "the widget / make it 4 icons / decks to swipe / currently / the
// dream factory deck / the wallpapers"). Drives the REAL route against a
// stubbed Firestore and Storage, because the question is what the ROUTE
// decides, which no source-shape assertion can answer:
//   1. it shows WAITING decks and only those — a finished, a skipped and a
//      superseded page are on no widget;
//   2. it is the SAME PILE IN THE SAME ORDER as the /review page, off the
//      same 60s cache, so the widget and the page can never disagree about
//      which deck leads;
//   3. `count` is the FULL number waiting, so four icons never imply four
//      decks;
//   4. every face rides the derived thumb service — a widget process is
//      killed by a 3MB lossless webp, so the original must never be handed
//      over;
//   5. ?limit cuts the icons and nothing else.
//
// The decision table itself (the icon ladder, the caps) is pure and lives in
// scripts/test-review.js.
//
//   node scripts/test-review-widget.js

const Module = require('module');

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const iso = (min) => new Date(Date.UTC(2026, 8, 2, 12, min, 0)).toISOString();

const PAGES = [
  { id: 'p1', chat: 'dream', title: 'Two more sheets — 18 panels', template: 'deck', created: iso(50) },
  { id: 'p2', chat: 'dates', title: 'Moments — first five dates', template: 'deck', created: iso(40) },
  { id: 'p3', chat: 'xi', title: 'XI cards — batch 2', template: 'grid', created: iso(30) },
  { id: 'p4', chat: 'pwc', title: 'PWC memes — round 1', template: 'deck', created: iso(20) },
  { id: 'p5', chat: 'witch', title: 'Style concepts v1', template: 'deck', created: iso(10) },
  { id: 'done', chat: 'dream', title: 'Dream factory — 51 panels', template: 'deck', created: iso(55) },
  { id: 'skip', chat: 'demo', title: 'Deck template demo', template: 'deck', created: iso(56), reviewHidden: true },
  { id: 'old', chat: 'dates', title: 'Moments v1', template: 'deck', created: iso(57), superseded: true },
];

const pic = (n) => `https://storage.googleapis.com/b/dream-factory/${n}.png`;
const DATA = {
  // a picture deck, and a text deck, and one of each again
  p1: { items: [{ id: 'a', img: pic('p01') }, { id: 'b', img: pic('p02') }] },
  p2: { items: [{ id: 'a', text: 'He ordered for both of us' }, { id: 'b', text: 'second' }] },
  p3: { groups: [{ label: 'ladder', items: [{ id: 'a', img: pic('x01') }, { id: 'b', img: pic('x02') }] }] },
  p4: { items: [{ id: 'a', text: 'the one with the pigeon' }] },
  p5: { items: [{ id: 'a', text: 'concept one' }] },
  done: { items: [{ id: 'a', img: pic('d01') }] },
  skip: { items: [{ id: 'a', text: 'demo' }] },
  old: { items: [{ id: 'a', text: 'superseded' }] },
};
const VERDICTS = { 'dream__page-done': { items: { a: 'yes' }, updatedAt: iso(58) } };

const CHATS = {
  dream: { displayName: 'Dream factory' },
  // no picture of its own → its chat's little drawing is the face
  dates: { displayName: 'Portland dates', icon: 'https://storage.googleapis.com/b/chat-feed/icons/dates.png?v=1' },
  xi: { displayName: 'XI cards' },
  pwc: { displayName: 'PWC memes' },
  witch: { displayName: 'Secretly a witch' },
};

const fakeAdmin = {
  apps: [{}],
  firestore: () => ({
    collection: (name) => ({
      where: function () { return this; },
      doc: (id) => ({ id, collectionName: name }),
      get: async () => ({ docs: PAGES.map((p) => ({ id: p.id, data: () => p })) }),
    }),
    getAll: async (...refs) => refs.map((r) => ({
      id: r.id, exists: Boolean(VERDICTS[r.id]), data: () => VERDICTS[r.id],
    })),
  }),
  storage: () => ({
    bucket: () => ({
      file: (path) => ({
        download: async () => {
          const id = String(path).replace('chat-pages/', '').replace('.json', '');
          if (!DATA[id]) throw new Error('no such page data');
          return [Buffer.from(JSON.stringify(DATA[id]), 'utf8')];
        },
      }),
    }),
  }),
};

const origLoad = Module._load;
Module._load = function (req) {
  if (req === 'firebase-admin') return fakeAdmin;
  if (req === './chatfeed') return { registry: async () => ({ chats: CHATS }) };
  return origLoad.apply(this, arguments);
};
const { router } = require('../review.js');
Module._load = origLoad;

function call(path, query) {
  return new Promise((resolve) => {
    const layer = router.stack.find((l) => l.route && l.route.path === path);
    if (!layer) return resolve({ error: 'no ' + path + ' route' });
    layer.route.stack[0].handle(
      { query: query || {}, get: () => null, method: 'GET', path },
      { set() {}, status() { return this; }, json: (o) => resolve(o) },
      () => {},
    );
  });
}

(async () => {
  const w = await call('/widget', {});
  if (w.error) return fail(w.error);
  const ids = (w.decks || []).map((d) => d.id);

  // 1 + 2. the page's own waiting pile, in its own order
  const page = await call('/', {});
  const waiting = (page.waiting || []).map((r) => r.id);
  if (waiting.join(',') !== 'p1,p2,p3,p4,p5') fail('the fixture queue is wrong: ' + waiting.join(','));
  if (ids.join(',') !== 'p1,p2,p3,p4') fail('the widget is not the top of the queue: ' + ids.join(','));
  for (const bad of ['done', 'skip', 'old']) {
    if (ids.includes(bad)) fail(`"${bad}" should never be a widget icon`);
  }

  // 3. four icons, and the pile behind them said honestly
  if ((w.decks || []).length !== 4) fail('four icons by default, got ' + (w.decks || []).length);
  if (w.count !== 5) fail('count must be the FULL waiting pile, got ' + w.count);
  if (w.items !== 8) fail('items must be every card still waiting, got ' + w.items);

  // 4. the faces — never an original, and a text deck wears its chat's drawing
  const byId = Object.fromEntries((w.decks || []).map((d) => [d.id, d]));
  if (!/^\/api\/story\/thumb\?w=\d+&url=/.test(byId.p1.icon)) {
    fail('a picture deck must ride the thumb service: ' + byId.p1.icon);
  }
  if ((w.decks || []).some((d) => /^https:\/\/storage\.googleapis\.com/.test(d.icon))) {
    fail('a raw Storage original reached the widget');
  }
  if (!byId.p2.icon.includes(encodeURIComponent('chat-feed/icons/dates.png'))) {
    fail('a text deck should fall to its chat\'s icon: ' + byId.p2.icon);
  }
  if (byId.p4.icon !== '') fail('a deck with no picture and no chat icon draws none: ' + byId.p4.icon);
  if (byId.p4.peek !== 'the one with the pigeon') fail('and its words must ride along: ' + byId.p4.peek);
  if (byId.p1.name !== 'Dream factory') fail('the icon does not carry the name she gave the chat');
  if (byId.p1.url !== '/api/chatfeed/page/p1?clean=1') fail('the icon does not carry the deck\'s own door');
  if (byId.p1.left !== 2) fail('left must be what she has not swiped, got ' + byId.p1.left);

  // 5. ?limit cuts the icons and nothing else
  const two = await call('/widget', { limit: '2' });
  if ((two.decks || []).length !== 2) fail('?limit did not cut the icons');
  if (two.count !== 5) fail('count must stay the FULL pile when icons are cut, got ' + two.count);

  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: the widget is the top of the review queue, four icons, no originals');
})().catch((e) => { console.error(e); process.exit(1); });

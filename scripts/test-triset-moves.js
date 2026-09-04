#!/usr/bin/env node
/* THE MOVE LOG — every deal, swap, undo, claim and find, per phone
   (2026-09-04, Sophie: "do u have a play by play of her game - which cards she
   moved etc" → "yea i'd like that"). Until this the solitaire's table lived only
   in the phone's localStorage, so Miriam's game came back as nine found sets
   and nothing between them.

   Two halves. The ROUTE, pure, over the in-memory Firestore the two-phone test
   uses: a batch appends in order, a re-sent batch (the page retries a failed
   post) adds nothing twice, an unknown kind and a stray field are dropped, a
   bad player id is refused, and the cap holds. Then the REAL page in headless
   Chromium against a stub server that RECORDS what really lands: a deal posts
   the board and the hand, a two-tap swap posts which card went out, which came
   in and what was drawn, a claim posts the three, and Draw it! posts the find
   carrying the player — every assertion a reading of the request, since a
   `logMove` in the source says nothing about whether a batch ever leaves the
   phone. */
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'public', 'triset.html'), 'utf8');

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

/* ── the route, pure ─────────────────────────────────────────────────────── */
const store = new Map();
const docRef = (id) => ({
  id,
  async get() { return { exists: store.has(id), data: () => JSON.parse(JSON.stringify(store.get(id))) }; },
  async set(v, o) { store.set(id, o && o.merge && store.has(id) ? Object.assign({}, store.get(id), v) : JSON.parse(JSON.stringify(v))); },
});
const fakeDb = {
  collection: () => ({
    doc: docRef,
    where: (f, op, v) => ({ async get() { return { docs: [...store.values()].filter(d => d[f] === v).map(d => ({ data: () => d })) }; } }),
    async get() { return { size: store.size, docs: [] }; },
  }),
  async runTransaction(fn) { return fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) }); },
};
const triset = require('../triset');
const { dreamyStyle } = require('./lib/dreamy-style');
triset.init({ gptStyles: { dreamy: dreamyStyle() }, db: fakeDb, bucket: { name: 'x', file: () => ({ async save() {}, async makePublic() {} }) } });

(async () => {
  console.log('the route');
  const P = 'abcdef123456';
  const t0 = 1700000000000;
  const batch = [
    { k: 'deal', at: t0, board: ['a', 'b', 'c'], hand: ['d', 'e', 'f'], v: 'nature' },
    { k: 'swap', at: t0 + 1000, slot: 'top', out: 'a', in: 'd', drew: 'g', junk: 'dropped' },
    { k: 'nope', at: t0 + 2000 },
    { k: 'found', at: t0 + 3000, cards: ['d', 'b', 'c'], card: 'made1', words: 'Rivulets', v: 'same', by: 'me' },
  ];
  let r = await triset.appendMoves(P, batch);
  ok('three of four land — the unknown kind is dropped', r.added === 3, r);
  r = await triset.appendMoves(P, batch);
  ok('the same batch again adds nothing (a retried post cannot double a move)', r.added === 0, r);
  const doc = [...store.values()][0];
  ok('the doc is one player-day, in order, and a stray field never lands',
    doc && doc.player === P && doc.n === 3 && doc.moves[0].k === 'deal' && doc.moves[1].k === 'swap'
    && doc.moves[1].junk === undefined && doc.moves[1].out === 'a' && doc.moves[1].drew === 'g', doc);
  ok('the find keeps its words and its cards', doc.moves[2].words === 'Rivulets' && doc.moves[2].cards.join() === 'd,b,c');
  ok('a bad player id is refused by the cleaner\'s own rule', !triset.PLAYER_RE.test('../x') && !triset.PLAYER_RE.test('ab'));
  ok('cleanMove: no kind → null; a missing time gets now', triset.cleanMove({ at: 1 }, 5) === null && triset.cleanMove({ k: 'undo' }, 5).at === 5);
  // the cap: 2000 holds, the oldest leave first
  const many = Array.from({ length: 2100 }, (_, i) => ({ k: 'swap', at: t0 + 10000 + i }));
  r = await triset.appendMoves(P, many.slice(0, 200));
  for (let i = 200; i < 2100; i += 200) await triset.appendMoves(P, many.slice(i, i + 200));
  const d2 = [...store.values()][0];
  ok('the doc is capped at 2000 and keeps the NEWEST', d2.n === 2000 && d2.moves[d2.n - 1].at === t0 + 10000 + 2099, d2.n);

  // the read-back route walks the docs oldest first
  const express = require('express');
  const app = express(); app.use('/api/triset', triset.router);
  const srv = await new Promise((res) => { const s = http.createServer(app); s.listen(0, () => res(s)); });
  const base = 'http://127.0.0.1:' + srv.address().port;
  let g = await (await fetch(base + '/api/triset/moves?player=' + P)).json();
  ok('GET /moves answers the player\'s timeline', g.ok && g.n === 2000 && g.player === P, g && g.n);
  g = await (await fetch(base + '/api/triset/moves?player=bad')).json();
  ok('GET /moves refuses a bad id', !!g.error);
  let p = await (await fetch(base + '/api/triset/moves', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ player: 'zz', moves: [] }) })).json();
  ok('POST /moves refuses a bad id', !!p.error);
  srv.close();

  await headless();
  console.log(fails ? `\n${fails} FAILED` : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

/* ── the real page ───────────────────────────────────────────────────────── */
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (_) { try { ({ chromium } = require('playwright-core')); } catch (__) { /* skip */ } }
function exe() {
  const root = '/opt/pw-browsers';
  try { for (const d of fs.readdirSync(root)) { const p = path.join(root, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } } catch (e) { /* */ }
  return undefined;
}
const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');

async function headless() {
  console.log('the page');
  if (!chromium) { console.log('  (playwright missing — skipping the page half)'); return; }
  const posted = [];   // every /moves body, in order
  const founds = [];
  const cards = Array.from({ length: 10 }, (_, i) => ({
    id: 'c' + i, title: 'card ' + i, status: 'ready',
    url: 'https://storage.googleapis.com/x/triset/cards/c' + i + '.webp', createdAt: i,
  }));
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const body = (cb) => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => cb(JSON.parse(b || '{}'))); };
    if (u.pathname === '/api/triset/cards') return json({ ok: true, cards });
    if (u.pathname === '/api/triset/moves') return body(b => { posted.push(b); json({ ok: true, added: (b.moves || []).length }); });
    if (u.pathname === '/api/triset/found') return body(b => { founds.push(b); json({ ok: true, id: 'made1', status: 'drawing' }); });
    if (u.pathname.startsWith('/api/triset/card/')) return json({ ok: true, status: 'drawing' });
    if (u.pathname === '/api/story/thumb') { res.writeHead(200, { 'content-type': 'image/webp' }); return res.end(PIXEL); }
    if (u.pathname === '/triset') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE.replace('__STUDIO_TOKEN__', '')); }
    res.writeHead(404); res.end('no');
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: exe() });
  const pg = await browser.newContext({ viewport: { width: 390, height: 844 } }).then(c => c.newPage());
  await pg.goto(base + '/triset', { waitUntil: 'networkidle' });
  const settle = () => pg.waitForTimeout(1300);
  await settle();
  const all = () => [].concat(...posted.map(b => b.moves || []));
  const players = () => new Set(posted.map(b => b.player));

  const deal = all().find(m => m.k === 'deal');
  ok('the first deal is posted with three board cards and three in hand',
    !!deal && deal.board.length === 3 && deal.board.every(Boolean) && deal.hand.length === 3, deal);
  ok('under a per-phone player id of the right shape', players().size === 1 && /^[a-z0-9]{6,32}$/.test([...players()][0]), [...players()]);

  const before = await pg.evaluate(() => ({ top: document.querySelector('#s-top img').src, h0: document.querySelector('.hcard[data-h="0"] img').src }));
  await pg.click('#s-top'); await pg.click('.hcard[data-h="0"]');
  await settle();
  const swap = all().find(m => m.k === 'swap');
  const idOf = (src) => (decodeURIComponent(String(src)).match(/cards\/(c\d+)\.webp/) || [])[1];
  ok('a two-tap swap posts which card went out, which came in and what was drawn',
    !!swap && swap.slot === 'top' && swap.out === idOf(before.top) && swap.in === idOf(before.h0) && !!swap.drew, swap);

  await pg.click('#undo'); await settle();
  ok('undo posts the board it put back', all().some(m => m.k === 'undo' && m.board && m.board.length === 3));

  // two moves inside the debounce window ride ONE post
  const n0 = posted.length;
  await pg.click('#s-left'); await pg.click('.hcard[data-h="1"]'); await pg.click('#undo');
  await settle();
  ok('two moves inside a second ride one post (the log is batched)',
    posted.length === n0 + 1 && posted[n0].moves.map(m => m.k).join() === 'swap,undo', posted.slice(n0).map(b => b.moves.map(m => m.k)));

  await pg.click('#found'); await settle();
  const claim = all().find(m => m.k === 'claim');
  ok('Set! posts the three claimed cards', !!claim && claim.cards.length === 3, claim);
  await pg.fill('#middle', 'round things');
  await pg.click('#found'); await settle();
  const found = all().find(m => m.k === 'found');
  ok('Draw it! posts the find — its words, its three cards and the made card\'s id',
    !!found && found.words === 'round things' && found.cards.length === 3 && found.card === 'made1' && found.by === 'me', found);
  ok('and the /found request itself carries the player, so the made card can be attributed',
    founds.length === 1 && founds[0].player === [...players()][0], founds[0]);

  // a reload keeps the same player id
  await pg.reload({ waitUntil: 'networkidle' }); await settle();
  ok('a reload keeps the same player id', players().size === 1);
  await browser.close(); srv.close();
}

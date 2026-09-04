#!/usr/bin/env node
// test-triset-match-game.js — the match test's rules (pure), the deck reader,
// the print sheet's geometry, then the REAL built page in headless Chromium
// against a stub verdict store: a tap really POSTs the anchor's list, ›
// really lands on the next unjudged card, a reload really lights the same
// cards, "None of these" really counts as judged, the tally really sorts, the
// cards really sit four across, and the TALLY tab is really tappable under
// the injected pill (elementFromPoint — a covered tab passes every width
// assertion).
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');
const rules = require('../docs/triset/match-rules');
const { readDeck, machineCounts, sharedTags } = require('./lib/dominoes-deck');
const tdeck = require('./lib/triset-deck');
const { build } = require('./triset-match-game');
const print = require('./triset-print-letter');

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(name + '\n    want ' + JSON.stringify(want) + '\n    got  ' + JSON.stringify(got));
}
function ok(name, cond) { is(name, Boolean(cond), true); }

/* ── pure ─────────────────────────────────────────────────────────────── */
const deck = readDeck();
is('the deck is her 61', deck.length, 61);
ok('every card has a cut, an id, a name and tags', deck.every((c) => c.k && c.id && c.n && Array.isArray(c.t) && /^https:/.test(c.url)));
is('ids are unique', new Set(deck.map((c) => c.id)).size, 61);
const machine = machineCounts(deck);
ok('the machine count is per card and never counts the card itself', machine.length === 61 && machine.every((m) => m >= 0 && m <= 60));
is('a weak word alone makes no match', sharedTags({ t: ['green', 'water'] }, { t: ['green', 'water'] }).length, 0);
is('a strong word does', sharedTags({ t: ['green', 'spiral'] }, { t: ['spiral'] }), ['spiral']);

// the edition reader: ready, unhidden, with a picture, one edition or every dealt card
const pool = [
  { id: 'aaaaaaaa11', title: 'a teacup', status: 'ready', edition: 'everyday', cut: 'https://x/a.c4.webp', url: 'https://x/a.webp' },
  { id: 'bbbbbbbb22', title: 'fog', status: 'ready', edition: 'nature', cut: 'https://x/b.c4.webp' },
  { id: 'cccccccc33', title: 'Mess', status: 'ready', edition: 'everyday', cut: 'https://x/c.c5.webp', flip: true },
  { id: 'dddddddd44', title: 'hidden one', status: 'ready', edition: 'everyday', cut: 'https://x/d.webp', hidden: true },
  { id: 'eeeeeeee55', title: 'no edition', status: 'ready', cut: 'https://x/e.webp' },
  { id: 'ffffffff66', title: 'still drawing', status: 'running', edition: 'everyday' },
];
is('everyday is its ready, unhidden cards', tdeck.editionDeck(pool, 'everyday').map((c) => c.id), ['aaaaaaaa11', 'cccccccc33']);
is('the cut wins over the original', tdeck.editionDeck(pool, 'everyday')[0].url, 'https://x/a.c4.webp');
is('a made card carries its flip', tdeck.editionDeck(pool, 'everyday')[1].flip, true);
is('all = every dealt card, never the edition-less', tdeck.editionDeck(pool, 'all').map((c) => c.id), ['aaaaaaaa11', 'bbbbbbbb22', 'cccccccc33']);
is('the editions and their counts', tdeck.editions(pool), { everyday: 2, nature: 1 });

// the id migration: v1/v2 keys were 8-character prefixes
is('migrate: an old key and its list land on the whole ids',
  rules.migrate({ aaaaaaaa: '["bbbbbbbb","zzzzzzzz"]' }, tdeck.editionDeck(pool, 'all')),
  { aaaaaaaa11: '["bbbbbbbb22","zzzzzzzz"]' });
is('migrate: a whole key is untouched', rules.migrate({ aaaaaaaa11: '[]' }, tdeck.editionDeck(pool, 'all')), { aaaaaaaa11: '[]' });

const three = [{ id: 'a', n: 'apple' }, { id: 'b', n: 'bee' }, { id: 'c', n: 'cat' }];
is('parse: a list', rules.parseMatches('["b","c"]'), ['b', 'c']);
is('parse: empty is an answer', rules.parseMatches('[]'), []);
is('parse: nothing filed', rules.parseMatches(undefined), null);
is('parse: garbage is not an answer', rules.parseMatches('{'), null);
const t1 = rules.tally(three, { a: '["b","c"]', c: '[]' }, [5, 6, 7]);
is('tally: judged first, most matches first, unjudged keep deck order', t1.map((r) => r.id), ['a', 'c', 'b']);
is('tally: her count and the machine count ride together', [t1[0].mine, t1[0].machine, t1[2].mine], [2, 5, null]);
is('tally: a self-match never counts', rules.tally(three, { a: '["a","b"]' })[0].mine, 1);
is('summary', rules.summary(t1), { judged: 2, total: 3, min: 0, max: 2, avg: 1 });
is('summary: nothing judged', rules.summary(rules.tally(three, {})), { judged: 0, total: 3, min: null, max: null, avg: null });
is('next unjudged wraps', rules.nextUnjudged(three, { b: '[]', c: '[]' }, 1), 0);
is('next unjudged skips the judged', rules.nextUnjudged(three, { b: '[]' }, 0), 2);
is('all judged → simply the next', rules.nextUnjudged(three, { a: '[]', b: '[]', c: '[]' }, 2), 0);

// the scatter (v2): a new table per seed, the same table for the same seed, nothing overlapping
const sixty = [...Array(61)].map((_, i) => 'c' + i);
const sc1 = rules.scatter(sixty, 11), sc2 = rules.scatter(sixty, 12), sc1b = rules.scatter(sixty, 11);
ok('a different seed is a different table', JSON.stringify(sc1.cards) !== JSON.stringify(sc2.cards));
is('the same seed is the same table', JSON.stringify(sc1b.cards), JSON.stringify(sc1.cards));
is('every card is on the table once', new Set(sc1.cards.map((c) => c.id)).size, 61);
ok('every card leans a little, some way or the other', sc1.cards.some((c) => c.rot > 0) && sc1.cards.some((c) => c.rot < 0));
let overlaps = 0;
for (let i = 0; i < sc1.cards.length; i++) for (let j = i + 1; j < sc1.cards.length; j++) {
  const p = sc1.cards[i], q = sc1.cards[j], h = 78 * 0.866;
  if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + h && q.y < p.y + h) overlaps++;
}
is('no two cards overlap', overlaps, 0);

// the print sheet: letter, 3x4, every card point-up, the cut line outside the picture
const g = print.geometry(2.2, 0.1);
const L = print.layout(g);
is('letter holds 3 x 4', [L.cols, L.rows, L.perPage], [3, 4, 12]);
ok('the rim is real: the cut triangle is bigger than the picture by the rim on every side',
  Math.abs(g.outerSide - (2.2 + 2 * 0.1 * Math.sqrt(3))) < 1e-9 && Math.abs(g.imgY - 0.2) < 1e-9);
ok('three columns and their gaps fit inside the margins', L.cols * g.outerSide + (L.cols - 1) * L.gap <= 8.5 - 2 * L.margin + 1e-9);
ok('four rows fit too', L.rows * g.outerH + (L.rows - 1) * L.gap <= 11 - 2 * L.margin + 1e-9);
const svg = print.cardSvg(g, 'data:x', 'lightning');
ok('a card is point-UP: the outer polygon\'s first point is the top-centre', /points="[\d.]+,0 /.test(svg));
ok('the picture rides inside the white triangle', /<polygon[^>]*fill="#fff"/.test(svg) && svg.indexOf('<polygon') < svg.indexOf('<image'));
ok('the cut line is drawn by default', /stroke="#b9b3a8"/.test(svg));
ok('…and the no-outline version keeps the white rim with no line', !/stroke=/.test(print.cardSvg(g, 'data:x', 'x', false)) && /fill="#fff"/.test(print.cardSvg(g, 'data:x', 'x', false)));

/* ── the real page ────────────────────────────────────────────────────── */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { chromium = null; }
function exe() {
  const root = '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* none */ }
  return null;
}

(async () => {
  if (!chromium) { console.log('match game: page half skipped (no playwright)'); return report(); }
  const docs = {}; const writes = [];
  // two editions, one made (point-down) card, one old 8-char answer to migrate
  const fixture = deck.slice(0, 10).map((c, i) => ({ id: c.id + 'x' + i + 'yz', n: c.n, url: '/cut.png', edition: i < 7 ? 'everyday' : 'nature', flip: i === 6 }));
  const html = build({ deck: fixture });
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'); const u = url.pathname;
    if (servePublic(req, res)) return;
    if (u === '/cut.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(png); }
    if (u === '/api/chatfeed/verdict' && req.method === 'GET') {
      const id = url.searchParams.get('chat') + '__' + url.searchParams.get('sheet');
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, items: {}, texts: docs[id] || {}, at: '' }));
    }
    if (u === '/api/chatfeed/verdict' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; });
      return req.on('end', () => {
        const b = JSON.parse(body || '{}'); const id = b.chat + '__' + b.sheet;
        docs[id] = docs[id] || {};
        if (b.text !== undefined) docs[id][String(b.item)] = String(b.text).slice(0, 2000);
        writes.push(b);
        res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}');
      });
    }
    if (u === '/page') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html + pill); }
    res.writeHead(204); res.end();
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const settle = (ms) => page.waitForTimeout(ms || 500);
  const ids = fixture.map((c) => c.id);
  const layout = () => page.$$eval('.sc', (els) => els.map((e) => e.dataset.id + '@' + e.style.left + ',' + e.style.top));
  const tapCard = async (id) => {
    await page.evaluate((id) => { const b = document.querySelector('.sc[data-id="' + id + '"]'); const r = b.getBoundingClientRect(); window.__tapAt = [r.left + r.width / 2, r.top + r.height * 0.7]; }, id);
    const [x, y] = await page.evaluate(() => window.__tapAt);
    await page.mouse.click(x, y);
  };
  // an old v2 answer on the 8-char key, to be carried over
  docs['triset-matching-balance__match-test'] = { [ids[9].slice(0, 8)]: JSON.stringify([ids[8].slice(0, 8)]) };

  await page.goto(base + '/page'); await settle(600);
  is('no page errors', errors, []);
  is('the chips are the editions plus all, everyday first and lit', await page.$$eval('#eds .chip', (els) => els.map((e) => e.dataset.e + (e.classList.contains('on') ? '*' : ''))), ['everyday*', 'nature', 'all']);
  is('the table is the everyday cards', await page.$$eval('.sc', (els) => els.length), 7);
  ok('the made card is drawn point-down', await page.$eval('.sc[data-id="' + ids[6] + '"] .tri', (e) => e.classList.contains('dn')));
  const lay1 = await layout();
  ok('the cards are scattered, not a grid', lay1.some((s) => !/@0px/.test(s)));
  ok('the strip opens idle', await page.$eval('#strip', (e) => e.classList.contains('idle')));
  const tri = await page.$eval('.sc .tri', (e) => e.getBoundingClientRect());
  ok('a card really draws at its width (' + Math.round(tri.width) + 'px)', tri.width > 60);
  const hit = await page.evaluate(() => {
    const t = document.querySelector('.acctab[data-v="tally"]').getBoundingClientRect();
    const el = document.elementFromPoint(t.left + t.width - 4, t.top + t.height / 2);
    return el && el.closest('.acctab') ? 'tab' : (el && el.closest('.float') ? 'pill' : 'other');
  });
  is('the TALLY tab\'s right end is the tab, not the pill', hit, 'tab');

  // pick a center: it leaves the table for the bench
  await tapCard(ids[0]); await settle(200);
  is('the center sits on the bench', await page.$$eval('#bench .bc', (els) => els.map((e) => e.dataset.id + (e.classList.contains('center') ? '*' : ''))), [ids[0] + '*']);
  ok('…and is gone from the table', await page.$eval('.sc[data-id="' + ids[0] + '"]', (e) => getComputedStyle(e).display === 'none'));
  is('the strip names it', await page.$eval('#sname', (e) => e.textContent), fixture[0].n);
  ok('Done ends before the pill\'s column', await page.$eval('#done', (e) => e.getBoundingClientRect().right) <= 390 - 64);
  // place two next to it, in order
  await tapCard(ids[3]); await tapCard(ids[5]); await settle(700);
  is('the bench is the center then her row, numbered', await page.$$eval('#bench .bc', (els) => els.map((e) => e.dataset.id + ':' + e.querySelector('.n').textContent)), [ids[0] + ':0', ids[3] + ':1', ids[5] + ':2']);
  const benchGeo = await page.$$eval('#bench .bc', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
  ok('the placed cards sit beside the center on one row', benchGeo[1][0] > benchGeo[0][0] && benchGeo[1][1] === benchGeo[0][1] && benchGeo[2][0] > benchGeo[1][0]);
  // the PHOTO showed the bench drawing thumbnails with the name beside them
  const btri = await page.$eval('#bench .bc .tri', (e) => e.getBoundingClientRect());
  const bnm = await page.$eval('#bench .bc .nm', (e) => e.getBoundingClientRect());
  ok('a bench card really draws at its cell\'s width (' + Math.round(btri.width) + 'px)', btri.width > 70);
  ok('…with its name under it, not beside it', bnm.top >= btri.bottom - 1);
  is('the placed cards left the table', await page.$$eval('.sc.placed', (els) => els.map((e) => getComputedStyle(e).display)), ['none', 'none']);
  const last = writes[writes.length - 1];
  is('the write is the center\'s row, in order', [last.item, JSON.parse(last.text)], [ids[0], [ids[3], ids[5]]]);
  // a tap on a placed card sends it back
  await page.click('#bench .bc[data-id="' + ids[3] + '"]'); await settle(600);
  is('sent back: the other renumbers to 1', await page.$$eval('#bench .bc', (els) => els.slice(1).map((e) => e.dataset.id + ':' + e.querySelector('.n').textContent)), [ids[5] + ':1']);
  ok('…and it is on the table again', await page.$eval('.sc[data-id="' + ids[3] + '"]', (e) => getComputedStyle(e).display !== 'none'));
  is('…and the write follows', JSON.parse(writes[writes.length - 1].text), [ids[5]]);
  // Done
  await page.click('#done'); await settle(700);
  ok('Done clears the center', await page.$eval('#strip', (e) => e.classList.contains('idle')));
  is('…and empties the bench', await page.$$eval('#bench .bc', (els) => els.length), 0);
  const lay2 = await layout();
  ok('Done deals a new table', JSON.stringify(lay2) !== JSON.stringify(lay1));
  is('the done card wears its dot', await page.$$eval('.sc.done', (els) => els.map((e) => e.dataset.id)), [ids[0]]);
  ok('the strip counts it', /1 of 7 done/.test(await page.$eval('#sline', (e) => e.textContent)));
  const before = writes.length;
  await page.click('#againbtn'); await settle(300);
  ok('Scatter again is a new table', JSON.stringify(await layout()) !== JSON.stringify(lay2));
  is('…and writes nothing', writes.length, before);

  // the other edition: a different table, the old 8-char answer carried over
  await page.click('#eds .chip[data-e="nature"]'); await settle(300);
  is('the nature chip deals the nature cards', await page.$$eval('.sc', (els) => els.map((e) => e.dataset.id).sort()), [ids[7], ids[8], ids[9]].sort());
  is('a v2 answer on the short id carries over as a done dot', await page.$$eval('.sc.done', (els) => els.map((e) => e.dataset.id)), [ids[9]]);
  await page.goto(base + '/page'); await settle(600);
  is('the edition is remembered', await page.$eval('#eds .chip.on', (e) => e.dataset.e), 'nature');
  await page.click('.acctab[data-v="tally"]'); await settle(300);
  is('tally: the carried-over row leads with its count', await page.$$eval('.trow', (els) => els.slice(0, 1).map((e) => e.dataset.id + ':' + e.dataset.mine)), [ids[9] + ':1']);
  const tc = await page.$eval('.trow .tc', (e) => e.getBoundingClientRect().right);
  ok('the tally count ends before the pill\'s column (' + Math.round(tc) + ' <= 326)', tc <= 390 - 64);
  await page.click('.trow[data-id="' + ids[9] + '"]'); await settle(300);
  is('a tally row restores the center and its row on the bench', await page.$$eval('#bench .bc', (els) => els.map((e) => e.dataset.id)), [ids[9], ids[8]]);

  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

function report() {
  console.log('match game: ' + pass + ' passed' + (fails.length ? ', ' + fails.length + ' FAILED' : ''));
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
}

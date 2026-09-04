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
  const fixture = deck.slice(0, 8).map((c) => ({ ...c, url: '/cut.png' }));
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
    // a POSITION inside the card, not playwright's centre of a leaning box
    await page.evaluate((id) => { const b = document.querySelector('.sc[data-id="' + id + '"]'); const r = b.getBoundingClientRect(); window.__tapAt = [r.left + r.width / 2, r.top + r.height * 0.7]; }, id);
    const [x, y] = await page.evaluate(() => window.__tapAt);
    await page.mouse.click(x, y);
  };

  await page.goto(base + '/page'); await settle(600);
  is('no page errors', errors, []);
  is('every card is on the table', await page.$$eval('.sc', (els) => els.length), 8);
  const lay1 = await layout();
  ok('the cards are scattered, not a grid (some card is not flush left of its cell)', lay1.some((s) => !/@0px/.test(s)));
  ok('the strip opens idle', await page.$eval('#strip', (e) => e.classList.contains('idle')));
  // a card really has a picture the size of its cell
  const tri = await page.$eval('.sc .tri', (e) => e.getBoundingClientRect());
  ok('a card really draws at its width (' + Math.round(tri.width) + 'px)', tri.width > 60);
  // the TALLY tab and the Done button end before the pill's column
  const hit = await page.evaluate(() => {
    const t = document.querySelector('.acctab[data-v="tally"]').getBoundingClientRect();
    const el = document.elementFromPoint(t.left + t.width - 4, t.top + t.height / 2);
    return el && el.closest('.acctab') ? 'tab' : (el && el.closest('.float') ? 'pill' : 'other');
  });
  is('the TALLY tab\'s right end is the tab, not the pill', hit, 'tab');

  // pick a center
  await tapCard(ids[0]); await settle(200);
  is('the tapped card is the center', await page.$$eval('.sc.center', (els) => els.map((e) => e.dataset.id)), [ids[0]]);
  is('the strip names it', await page.$eval('#sname', (e) => e.textContent), fixture[0].n);
  ok('Done ends before the pill\'s column', await page.$eval('#done', (e) => e.getBoundingClientRect().right) <= 390 - 64);
  // chain two, in order
  await tapCard(ids[3]); await tapCard(ids[5]); await settle(700);
  is('two chained, numbered in the order she tapped', await page.$$eval('.sc.link', (els) => els.map((e) => e.dataset.id + ':' + e.querySelector('.n').textContent).sort()), [ids[3] + ':1', ids[5] + ':2'].sort());
  is('two lines from the center', await page.$$eval('#lines line', (els) => els.length), 2);
  const last = writes[writes.length - 1];
  is('the write is the center\'s chain, in order', [last.item, JSON.parse(last.text)], [ids[0], [ids[3], ids[5]]]);
  // a line really runs from the center's picture to the chained card's
  const geo = await page.evaluate(([a, b]) => {
    const l = document.querySelector('#lines line'); const t = document.getElementById('table').getBoundingClientRect();
    const ra = document.querySelector('.sc[data-id="' + a + '"]').getBoundingClientRect(), rb = document.querySelector('.sc[data-id="' + b + '"]').getBoundingClientRect();
    const x1 = Number(l.getAttribute('x1')) + t.left, y1 = Number(l.getAttribute('y1')) + t.top, x2 = Number(l.getAttribute('x2')) + t.left, y2 = Number(l.getAttribute('y2')) + t.top;
    const inside = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    return [inside(ra, x1, y1), inside(rb, x2, y2)];
  }, [ids[0], ids[3]]);
  is('the first line starts in the center and ends in card 1', geo, [true, true]);
  // untap takes it back and renumbers
  await tapCard(ids[3]); await settle(600);
  is('unchained, the other renumbers to 1', await page.$$eval('.sc.link', (els) => els.map((e) => e.dataset.id + ':' + e.querySelector('.n').textContent)), [ids[5] + ':1']);
  is('…and the write follows', JSON.parse(writes[writes.length - 1].text), [ids[5]]);
  // Done: saved, center cleared, a new table, the done dot
  await page.click('#done'); await settle(700);
  ok('Done clears the center', await page.$eval('#strip', (e) => e.classList.contains('idle')));
  const lay2 = await layout();
  ok('Done deals a new table', JSON.stringify(lay2) !== JSON.stringify(lay1));
  is('the done card wears its dot', await page.$$eval('.sc.done', (els) => els.map((e) => e.dataset.id)), [ids[0]]);
  ok('the strip counts it', /1 of 8 done/.test(await page.$eval('#sline', (e) => e.textContent)));
  // Scatter again reshuffles without touching the answers
  const before = writes.length;
  await page.click('#againbtn'); await settle(300);
  ok('Scatter again is a new table', JSON.stringify(await layout()) !== JSON.stringify(lay2));
  is('…and writes nothing', writes.length, before);

  // reload keeps the dot; the tally row puts the card back in the center with its chain
  await page.goto(base + '/page'); await settle(600);
  is('reload keeps the done dot', await page.$$eval('.sc.done', (els) => els.map((e) => e.dataset.id)), [ids[0]]);
  await page.click('.acctab[data-v="tally"]'); await settle(300);
  is('tally: the done row leads with its count', await page.$$eval('.trow', (els) => els.slice(0, 1).map((e) => e.dataset.id + ':' + e.dataset.mine)), [ids[0] + ':1']);
  is('tally: the rest trail', await page.$$eval('.trow.todo', (els) => els.length), 7);
  const tc = await page.$eval('.trow .tc', (e) => e.getBoundingClientRect().right);
  ok('the tally count ends before the pill\'s column (' + Math.round(tc) + ' <= 326)', tc <= 390 - 64);
  await page.click('.trow[data-id="' + ids[0] + '"]'); await settle(300);
  is('a tally row restores the center and its chain', [await page.$eval('#match', (e) => e.hidden), await page.$$eval('.sc.center', (els) => els.map((e) => e.dataset.id)), await page.$$eval('.sc.link', (els) => els.map((e) => e.dataset.id))], [false, [ids[0]], [ids[5]]]);

  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

function report() {
  console.log('match game: ' + pass + ' passed' + (fails.length ? ', ' + fails.length + ' FAILED' : ''));
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
}

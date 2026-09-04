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
  // a tiny fixture deck keeps the page fast; the real deck is checked above
  const fixture = deck.slice(0, 6).map((c) => ({ ...c, url: '/cut.png' }));
  const html = build({ deck: fixture });
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');
  // a 1000x866 transparent png with a filled triangle, so the cards decode
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

  await page.goto(base + '/page'); await settle(600);
  is('no page errors', errors, []);
  is('the anchor opens on the first card', await page.$eval('#aname', (e) => e.textContent), fixture[0].n);
  is('the others are the deck minus the anchor', await page.$$eval('.oc', (els) => els.length), 5);
  // four across, MEASURED off the real cells
  const xs = await page.$$eval('.oc', (els) => els.slice(0, 5).map((e) => Math.round(e.getBoundingClientRect().top)));
  is('four across: the fifth card starts a second row', [xs[0] === xs[3], xs[4] > xs[0]], [true, true]);
  // the picture is really drawn at the cell's width — the first PHOTO showed
  // names with no pictures over them, because an inline span has no width
  const tri = await page.$eval('.oc .tri', (e) => e.getBoundingClientRect());
  ok('a small card really has a picture in it (' + Math.round(tri.width) + 'px wide)', tri.width > 60 && tri.height > 50);
  // the TALLY tab is really tappable under the pill's column
  const hit = await page.evaluate(() => {
    const t = document.querySelector('.acctab[data-v="tally"]').getBoundingClientRect();
    const el = document.elementFromPoint(t.left + t.width - 4, t.top + t.height / 2);
    return el && el.closest ? (el.closest('.acctab') ? 'tab' : (el.closest('.float') ? 'pill' : el.tagName)) : 'none';
  });
  is('the TALLY tab\'s right end is the tab, not the pill', hit, 'tab');

  // tap two cards → one POST per anchor carrying both ids
  const ids = fixture.map((c) => c.id);
  await page.click('.oc[data-id="' + ids[1] + '"]'); await page.click('.oc[data-id="' + ids[2] + '"]'); await settle(700);
  is('two lit', await page.$$eval('.oc.on', (els) => els.map((e) => e.dataset.id)), [ids[1], ids[2]]);
  const last = writes[writes.length - 1];
  is('the write is the anchor\'s list', [last.item, JSON.parse(last.text)], [ids[0], [ids[1], ids[2]]]);
  is('the count line says so', await page.$eval('#acount', (e) => e.textContent), '2 matched');
  // tap again takes it back
  await page.click('.oc[data-id="' + ids[1] + '"]'); await settle(600);
  is('untapped', JSON.parse(writes[writes.length - 1].text), [ids[2]]);
  // › → the next unjudged (card 2), not merely the next
  await page.click('#next'); await settle(300);
  is('› lands on the next card', await page.$eval('#aname', (e) => e.textContent), fixture[1].n);
  await page.click('#nonebtn'); await settle(600);
  is('None of these files an empty list', [writes[writes.length - 1].item, writes[writes.length - 1].text], [ids[1], '[]']);
  is('…and reads as judged', await page.$eval('#acount', (e) => e.textContent), 'none matched');
  await page.click('#next'); await settle(300);
  is('› skips the judged', await page.$eval('#aname', (e) => e.textContent), fixture[2].n);

  // a reload lights the same cards and opens on the first unjudged
  await page.goto(base + '/page'); await settle(600);
  is('reload opens on the first unjudged card', await page.$eval('#aname', (e) => e.textContent), fixture[2].n);
  await page.evaluate(() => window.__matchTest.go(0)); await settle(200);
  is('reload keeps the lit card', await page.$$eval('.oc.on', (els) => els.map((e) => e.dataset.id)), [ids[2]]);

  // the tally
  await page.click('.acctab[data-v="tally"]'); await settle(300);
  is('tally: the judged rows lead, most matches first', await page.$$eval('.trow', (els) => els.slice(0, 2).map((e) => e.dataset.mine)), ['1', '0']);
  is('tally: the unjudged trail', await page.$$eval('.trow.todo', (els) => els.length), 4);
  ok('tally: the line names the spread', /2 of 6 judged/.test(await page.$eval('#sumline', (e) => e.textContent)));
  // the count at a row's right end is clear of the pill's column (measured)
  const tc = await page.$eval('.trow .tc', (e) => e.getBoundingClientRect().right);
  // the pill is conditional and a six-card fixture gives it nothing to scroll,
  // so the column itself is the measure: 64px in from the right at 390pt
  ok('the tally count ends before the pill\'s column (' + Math.round(tc) + ' <= 326)', tc <= 390 - 64);
  await page.click('.trow[data-id="' + ids[1] + '"]'); await settle(200);
  is('a tally row opens that card', [await page.$eval('#match', (e) => e.hidden), await page.$eval('#aname', (e) => e.textContent)], [false, fixture[1].n]);

  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

function report() {
  console.log('match game: ' + pass + ' passed' + (fails.length ? ', ' + fails.length + ' FAILED' : ''));
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
}

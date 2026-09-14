#!/usr/bin/env node
// A MARK ON A SHEET IS A MARK ON ITS PANELS — the REAL public/promptlab.html in
// headless Chromium against a stub API (2026-09-06, Sophie: "when i x a uncut
// panels sheet it shud x every panel in it unless i hearted it or heart it
// after or unex", then "it shud work both ways - heart or x").
//
// EVERY ASSERTION IS A MEASUREMENT of the rendered badge or a reading of what
// the stub server really received. None of this is visible to a source
// assertion: a cascade that plans correctly and never reaches the page, one
// that reaches the page and never reaches the doc, and one that wipes the ♥ she
// left on a panel all look identical in markup.
//
// AND THE PAGE'S OWN COPY IS WHAT IS BEING MEASURED HERE. A vote is followed by
// loadRuns(), which asks for kind=single — so a PANELS run's real votes never
// come back from that read, and the panels sweep is throttled 20s. Everything
// on screen after the tap is the page's optimistic mark; the stub's stored doc
// is the server's. Both are checked, separately.
//
//   npm install playwright --no-save && node scripts/test-playground-sheet-x.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');
const cascade = require('../sheet-cascade');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1787000000000;

// One cut panels run: four panels, the sheet banked beside them. Panel 1 she
// has HEARTED and panel 2 she crossed out HERSELF — the two the cascade must
// treat differently from the rest.
const RUN = {
  id: 'sheetrun', prompt: 'four panels', status: 'done', engine: 'gptimage',
  model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3', sheet: '2336x3504',
  panels: ['one', 'two', 'three', 'four'],
  sheetUrl: '/px.png?p=sheet',
  images: ['/px.png?p=0', '/px.png?p=1', '/px.png?p=2', '/px.png?p=3'],
  votes: { 1: 'like', 2: 'dislike' },
  voteFrom: {},
  createdAt: T0,
};

// The stub applies the REAL rule, exactly as the route does — the page must not
// be measured against a server that agreed with it by doing nothing.
function serverVote(i, vote) {
  const plan = cascade.plan(RUN, vote);
  if (String(i) === cascade.SHEET) {
    plan.changed.forEach((j) => {
      if (plan.votes[j] === null) delete RUN.votes[j]; else RUN.votes[j] = plan.votes[j];
      if (plan.from[j] === null) delete RUN.voteFrom[j]; else RUN.voteFrom[j] = plan.from[j];
    });
  } else {
    delete RUN.voteFrom[String(i)];
  }
  if (vote === null) delete RUN.votes[i]; else RUN.votes[i] = vote;
}

const posts = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const m = /^\/api\/promptlab\/([^/]+)\/vote$/.exec(url.pathname);
  if (m && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      const j = JSON.parse(body || '{}');
      posts.push(j);
      serverVote(Number(j.image), j.vote === 'like' || j.vote === 'dislike' ? j.vote : null);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  }
  if (url.pathname === '/api/promptlab') {
    // The Picture tab's own read must answer with NOTHING, like the real one:
    // it asks kind=single, and this run is panels. That is the whole reason the
    // page has to mark the panels itself.
    const runs = url.searchParams.get('kind') === 'panels' ? [RUN] : [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs, more: false }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

let bad = 0;
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else { console.error('FAIL: ' + m); bad++; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  await page.addInitScript(() => {
    localStorage.setItem('promptlab_tab', 'panels');
    localStorage.setItem('promptlab_sheets', '1');     // the Sheets view — the uncut sheet, alone
  });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);

  // What the page is SHOWING for a picture: 'like' | 'dislike' | '' — read off
  // the badge that really rendered, never off the run object the page holds.
  const badges = () => page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#runs .cell').forEach((c) => {
      const im = c.querySelector('img[data-run]');
      if (!im) return;
      const b = c.querySelector('.badge');
      out[im.getAttribute('data-i')] = b ? (b.classList.contains('like') ? 'like' : 'dislike') : '';
    });
    return out;
  });
  const openCell = async (i) => {
    await page.click(`#runs .cell img[data-i="${i}"]`);
    await page.waitForFunction(() => {
      const el = document.getElementById('clightbox');
      return el && el.style.display !== 'none';
    });
  };
  const closeLB = async () => {
    await page.evaluate(() => window.__assetLightboxClose && window.__assetLightboxClose());
    await page.waitForFunction(() => {
      const el = document.getElementById('clightbox');
      return !el || el.style.display === 'none';
    });
  };
  const sheetsOff = () => page.click('#v-sheets');

  console.log('the Sheets view');
  ok(same(Object.keys(await badges()), ['-1']), 'one cell — the sheet, at the virtual index -1');

  console.log('\n✕ the sheet');
  await openCell('-1');
  await page.click('#clightbox .vote.nope');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell .badge.dislike').length > 0);
  ok(posts.length === 1 && posts[0].image === -1 && posts[0].vote === 'dislike',
    'the sheet’s own ✕ is posted, once, at -1');
  ok(RUN.votes['-1'] === 'dislike' && RUN.votes[0] === 'dislike' && RUN.votes[3] === 'dislike',
    'the server crossed out the panels that had no mark');
  ok(RUN.votes[1] === 'like', 'and left the panel she hearted alone');
  ok(RUN.voteFrom[0] === 'sheet' && RUN.voteFrom[2] === undefined,
    'the cascade’s marks are tagged; her own ✕ on panel 2 is not');

  await closeLB();
  await sheetsOff();
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 4);
  let b = await badges();
  ok(same(b, { 0: 'dislike', 1: 'like', 2: 'dislike', 3: 'dislike' }),
    'ON THE PAGE, without another read: every panel crossed out but the hearted one');

  console.log('\nheart a panel after');
  await openCell('0');
  await page.click('#clightbox .vote.heart');
  // THAT cell's badge, never "a like badge somewhere" — panel 1 has carried one
  // since the fixture loaded, so a loose wait passes before the feed repaints
  // and measures the state before her tap (it did, while this was being
  // written).
  await page.waitForFunction(() => {
    const im = document.querySelector('#runs .cell img[data-i="0"]');
    const c = im && im.parentElement;
    return !!(c && c.querySelector('.badge.like'));
  });
  await closeLB();
  ok(RUN.votes[0] === 'like' && RUN.voteFrom[0] === undefined,
    'the panel is hers now — the ✕ and the tag saying the sheet put it there are gone');
  b = await badges();
  ok(same(b, { 0: 'like', 1: 'like', 2: 'dislike', 3: 'dislike' }),
    'ON THE PAGE: hearting one panel changes that panel and nothing else');

  console.log('\nunex');
  await page.click('#v-sheets');                      // back to the Sheets view
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 1);
  await openCell('-1');
  await page.click('#clightbox .vote.nope');          // tap the lit ✕ again — clear
  await page.waitForFunction(() => !document.querySelector('#runs .cell .badge'));
  await closeLB();
  ok(RUN.votes['-1'] === undefined, 'the sheet is unmarked');
  ok(RUN.votes[3] === undefined, 'the ✕ the cascade put on a panel is lifted');
  ok(RUN.votes[0] === 'like', 'the panel she hearted after keeps its ♥');
  ok(RUN.votes[2] === 'dislike', 'and the ✕ she cast herself survives');

  await sheetsOff();
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 4);
  b = await badges();
  ok(same(b, { 0: 'like', 1: 'like', 2: 'dislike', 3: '' }),
    'ON THE PAGE: the release shows on the panels too, and only where it should');

  console.log('\n♥ the sheet — "it shud work both ways"');
  await page.click('#v-sheets');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 1);
  await openCell('-1');
  await page.click('#clightbox .vote.heart');
  await page.waitForFunction(() => document.querySelector('#runs .cell .badge.like'));
  await closeLB();
  ok(RUN.votes[3] === 'like' && RUN.voteFrom[3] === 'sheet',
    'the panel that had no mark takes the sheet’s ♥');
  ok(RUN.votes[2] === 'dislike', 'and the ✕ she cast herself is still hers');
  await sheetsOff();
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 4);
  b = await badges();
  ok(same(b, { 0: 'like', 1: 'like', 2: 'dislike', 3: 'like' }),
    'ON THE PAGE: hearting the sheet hearts its panels');

  console.log('\nflipping the sheet ♥ → ✕');
  await page.click('#v-sheets');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 1);
  await openCell('-1');
  await page.click('#clightbox .vote.nope');
  await page.waitForFunction(() => document.querySelector('#runs .cell .badge.dislike'));
  await closeLB();
  ok(RUN.votes[3] === 'dislike', 'the cascade’s own panel follows the sheet across');
  ok(RUN.votes[0] === 'like' && RUN.votes[1] === 'like' && RUN.votes[2] === 'dislike',
    'and every mark of hers stays exactly as she left it');
  await sheetsOff();
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 4);
  b = await badges();
  ok(same(b, { 0: 'like', 1: 'like', 2: 'dislike', 3: 'dislike' }),
    'ON THE PAGE: the flip shows on the panel it owns and on no other');

  await browser.close();
  server.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nall good');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

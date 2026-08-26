#!/usr/bin/env node
/*
 * test-playground-more-opener.js — the "… more" opener on a Playground run's
 * words (2026-08-25, Sophie: "why is there only a Seymour… Button for some of
 * the prompts?" — dictation for *see more*).
 *
 * The opener is added by measurement (`scrollHeight` against `clientHeight`),
 * which is the only honest test of whether the two-line cap really cut the
 * words — but a box with NO layout measures 0/0, and 0/0 reads as "nothing was
 * cut". `#runs` is hidden in TILES view, so every card the feed drew while she
 * was on the wall was decided while it had no box; the head html never changes
 * again, so applyClamps never got a second look and those cards had no opener
 * FOREVER, on prompts plainly clipped mid-word.
 *
 * So this drives the REAL page in headless Chromium, twice over the same runs:
 * rendered in LIST (the path that always worked) and rendered in TILES and
 * then switched to LIST (the path that did not). A prompt whose words really
 * overflow must carry the opener in BOTH, and one that fits must carry it in
 * neither — an opener on a prompt that was never cut is the other half of the
 * bug and would fold two lines behind a "… more" that opens nothing.
 *
 * Measured, never assumed: the check is the element's own scrollHeight, so a
 * fixture that happens to fit at another width still tests the right thing.
 *
 *   node scripts/test-playground-more-opener.js
 *   (needs: npm install playwright --no-save)
 */
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

const IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const LONG = 'scientist, looking guy, curly orange hair, a long rat like face, and round wire '
  + 'Glasses, shoving a stack of paper papers into a the face of a girl walking by, in a '
  + 'public studying, the sidewalk near shops. The girl looks bemused.';
// The run cards are keyed by their CONTENT (words + style + quality + shape),
// so two runs of the same words at the same quality are ONE card — the
// fixtures differ in their words on purpose.
const RUNS = [
  { id: 'r1', prompt: LONG, quality: 'medium' },
  { id: 'r2', prompt: LONG + ' The papers are a mess.', quality: 'low' },
  { id: 'r3', prompt: 'a shelf of oddities', quality: 'low' },
].map((r, i) => Object.assign({
  engine: 'gptimage', model: 'gpt-image-2', gptStyle: 'dreamy', aspectRatio: '2:3',
  status: 'done', images: [IMG], createdAt: 9000 - i,
}, r));

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch {
    console.log('SKIP: playwright not installed (npm install playwright --no-save)');
    process.exit(0);
  }
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: RUNS, more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {} }));
    }
    const f = path.join(ROOT, 'public', url.pathname.replace(/^\//, ''));
    if (/\.(js|css)$/.test(url.pathname) && fs.existsSync(f)) {
      res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Every run's words: was it really cut, and does it carry the opener?
  const read = () => page.evaluate(() => Array.from(document.querySelectorAll('#runs .run'))
    .map((el) => {
      const p = el.querySelector('.p');
      return { cut: p.scrollHeight - p.clientHeight > 1, more: !!el.querySelector('.moretxt'),
        txt: p.textContent.replace('… more', '').slice(0, 24) };
    }));

  const check = (rows, where) => {
    ok(rows.length === RUNS.length, where + ': all ' + RUNS.length + ' runs drew');
    ok(rows.filter((r) => r.cut).length === 2, where + ': two prompts really were cut');
    rows.forEach((r) => ok(r.more === r.cut,
      where + ': ' + (r.cut ? 'a cut prompt HAS the opener' : 'a prompt that fits has none')
      + ' — ' + JSON.stringify(r.txt)));
  };

  console.log('\nrendered in LIST view');
  await page.goto(base + '/playground');
  await page.evaluate(() => localStorage.setItem('promptlab_view', 'list'));
  await page.reload();
  await page.waitForFunction((n) => document.querySelectorAll('#runs .run').length === n, RUNS.length);
  check(await read(), 'list');

  console.log('\nrendered in TILES view, then switched to LIST');
  await page.evaluate(() => localStorage.setItem('promptlab_view', 'tiles'));
  await page.reload();
  await page.waitForFunction((n) => document.querySelectorAll('#runs .run').length === n, RUNS.length);
  ok(await page.isHidden('#runs'), 'the list really was hidden while those cards were built');
  await page.click('#v-list');
  await page.waitForTimeout(100);
  check(await read(), 'tiles→list');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

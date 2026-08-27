// Headless check of the REAL posted page, served locally with local clips —
// the browser has no route to the live host from in here.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const servePublic = require('./scripts/lib/public-asset');

const PAGE = fs.readFileSync('/tmp/takes/page.html', 'utf8')
  .replace(/https:\/\/storage\.googleapis\.com\/[^"]*\/takes\/([^"]+)\.mp3/g, '/clip/$1.mp3');
const PILL = fs.readFileSync('public/pill-inject.html', 'utf8');

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const m = req.url.match(/^\/clip\/(.+)\.mp3$/);
  if (m) {
    const f = `/tmp/takes/clips/${m[1]}.mp3`;
    if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
    const b = fs.readFileSync(f);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': b.length, 'Accept-Ranges': 'bytes' });
    res.end(b); return;
  }
  if (req.url.startsWith('/api/chatfeed/verdict')) { res.writeHead(200, {'Content-Type':'application/json'}).end('{"ok":true}'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE + PILL);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + '/page', { waitUntil: 'networkidle' });
  let fail = 0;
  const ok = (name, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra != null ? '  ' + extra : '')); if (!cond) fail++; };

  ok('no page errors (a page-level let kills the pill at parse time)', errs.length === 0, errs[0] || '');
  const secs = await p.locator('details.card').count();
  ok('35 collapsible sections', secs === 35, secs);
  ok('all collapsed at load', (await p.locator('details.card[open]').count()) === 0);
  ok('62 takes total', (await p.locator('.take').count()) === 62);
  ok('every line marks its take in the reel', (await p.locator('.badge').count()) === 35);
  ok('the pill rendered', (await p.locator('.float').count()) === 1);

  const first = p.locator('details.card').first();
  await first.locator('summary').click();
  await p.waitForTimeout(150);
  ok('a tap on the summary opens it', await first.evaluate((e) => e.open));

  await first.locator('.take .pl').first().click();
  await p.waitForTimeout(900);
  const st = await p.evaluate(() => {
    const a = document.querySelector('audio, .take .bar');
    const bar = document.querySelector('.take .bar');
    return { bar: !!bar, w: bar ? parseFloat(bar.style.width) || 0 : -1 };
  });
  ok('the take actually plays (progress moved)', st.bar && st.w > 0, JSON.stringify(st));

  // a second tap WHILE IT IS STILL PLAYING stops it (these clips are ~4s, so a
  // late check is testing 'ended', not the toggle)
  await first.locator('.take .pl').first().click();
  await p.waitForTimeout(150);
  ok('tapping again stops it', (await p.locator('.take .bar').count()) === 0);

  // the play tap must not start the autoscroll (the pill's own rule)
  const y0 = await p.evaluate(() => window.scrollY);
  await first.locator('.take .pl').first().click();
  await p.waitForTimeout(1200);
  ok('playing never starts the autoscroll', (await p.evaluate(() => window.scrollY)) === y0);

  // nothing tappable under the pill's fixed corner
  const pill = await p.locator('.float').boundingBox();
  const row = await first.locator('.take').first().boundingBox();
  ok('take row clears the pill column', row.x + row.width <= pill.x + 1, `row ends ${Math.round(row.x + row.width)}, pill starts ${Math.round(pill.x)}`);

  // the chevron must take its own tap — it is the affordance, so it is the one
  // thing that may never sit under the pill
  const sum = await first.locator('summary').boundingBox();
  const hit = await p.evaluate(({ x, y }) => {
    const e = document.elementFromPoint(x, y);
    return e ? (e.closest('summary') ? 'summary' : e.className || e.tagName) : 'none';
  }, { x: sum.x + 8, y: sum.y + 16 });
  ok('the chevron takes its own tap', hit === 'summary', hit);

  // the note + is a real control and must clear the pill column too
  const plus = await p.locator('.take .cmp-note-open').first().boundingBox();
  if (plus) ok('the note + clears the pill column', plus.x + plus.width <= pill.x + 1,
    `+ ends ${Math.round(plus.x + plus.width)}, pill starts ${Math.round(pill.x)}`);
  else ok('the note + exists', false, 'no + found');

  await b.close(); server.close();
  console.log(fail ? `\n${fail} FAILED` : '\nall good');
  process.exit(fail ? 1 : 0);
})();

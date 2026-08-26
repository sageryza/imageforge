#!/usr/bin/env node
// FILM CLIPS IN THE STORY ROOM (Aug 2026, Sophie: "can u add film clips to
// story room (the new version - aka scratch pad)"). Drives the REAL
// public/scratchpad.html in a headless browser against a stub API and
// asserts what the design has to get right:
//   1. the add sheet has two hairline tabs, and the line MEASURES the lit
//      one (the house rule — no tab count anywhere),
//   2. the CLIPS tab reads the shelf, tiles a clip as its POSTER (never a
//      <video> — a grid of decoding films is what makes a phone crawl) with
//      the film mark, and the search box sends ?q=,
//   3. tapping a clip places it as a beat via POST /clip (never /add, which
//      would file an mp4 as a picture), and its pad tile is the poster + mark,
//   4. the clip's popup PLAYS it — the video showing, the picture hidden —
//      and the picture-makers (draw / Playground / inbox) plus the voice
//      icons are gone, because nothing draws a film and a clip's own sound
//      is its voice in the render,
//   5. a frame color lands on the video, and closing the popup pauses it.
//
//   node scripts/test-scratchpad-clips.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

const CLIPS = [
  { id: 'c1', url: 'http://x/one.mp4', poster: '/px.png?one', title: 'Sheldrake — telepathy bridge', seconds: 8.4, createdAt: 900 },
  { id: 'c2', url: 'http://x/two.mp4', poster: null, title: 'Moon milk', seconds: 4, createdAt: 800 },
];
let beats = [];
const shelfQueries = [];   // every ?q= the page sent
const posted = [];         // [path, body] of every POST

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/clip') {
        const c = b.clip || {};
        beats = beats.concat([{
          id: 'b' + (beats.length + 1), kind: 'clip', url: c.url, poster: c.poster,
          seconds: c.seconds, title: c.title, clipId: c.id, color: null,
        }]);
      }
      if (url.pathname === '/api/scratchpad/color') {
        beats.forEach((x) => { if (x.id === b.id) x.color = b.color; });
      }
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/shelf') {
    shelfQueries.push(url.searchParams.get('q'));
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const out = q ? CLIPS.filter((c) => c.title.toLowerCase().includes(q)) : CLIPS;
    return json({ count: out.length, clips: out });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'clips test', film: null, audios: [] });
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  // The shared three-way toggle: express.static serves both in production.
  // Without the CSS the toggle renders as a 4px sliver; without the JS the page
  // falls back to the old CYCLE, which would green-light the aim bug.
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await page.goto(base + '/scratchpad.html');
  // THE ROOM OPENS ON THE SHELF (2026-08-23, Sophie) — a story is one tap
  // below it, so step into one the way her tap on a tile does.
  await page.evaluate((id) => window.openPad(id), 'pad');

  // 1 — the two tabs, and the line under the lit one
  await page.click('#inboxbtn');
  await page.waitForSelector('#inboxtabs .acctab');
  ok((await page.$$('#inboxtabs .acctab')).length === 2, 'the add sheet has two tabs');
  const lineUnder = async () => page.evaluate(() => {
    const tabs = document.getElementById('inboxtabs');
    const on = tabs.querySelector('.acctab.on');
    const r = tabs.getBoundingClientRect(), t = on.getBoundingClientRect();
    const w = parseFloat(getComputedStyle(tabs).getPropertyValue('--tw'));
    const x = parseFloat(getComputedStyle(tabs).getPropertyValue('--tx'));
    return { w, x, tw: t.width, tx: t.left - r.left, label: on.textContent };
  });
  let L = await lineUnder();
  ok(Math.abs(L.w - L.tw) < 1.5 && Math.abs(L.x - L.tx) < 1.5,
    'the line measures the lit tab (PICTURES), never a tab count');

  // 2 — the CLIPS tab reads the shelf
  await page.click('#tab-clips');
  await page.waitForSelector('#clipgrid button');
  L = await lineUnder();
  ok(L.label === 'Clips' && Math.abs(L.w - L.tw) < 1.5 && Math.abs(L.x - L.tx) < 1.5,
    'the line follows to CLIPS and still measures it');
  ok((await page.$$('#clipgrid button')).length === 2, 'both shelf clips tile');
  ok((await page.$$('#clipgrid .cpost img')).length === 1 &&
     (await page.$$('#clipgrid .cpost .fmark')).length === 2,
    'a clip tiles as its poster, and every tile wears the film mark');
  ok((await page.$$('#clipgrid video')).length === 0, 'no <video> in the picker grid');
  ok(await page.$eval('#inboxno', (el) => el.textContent) === 'From the clip shelf',
    'the header says which shelf this is');

  // the search box sends ?q=
  await page.fill('#clipq', 'moon');
  await page.press('#clipq', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#clipgrid button').length === 1);
  ok(shelfQueries.includes('moon'), 'Return sends the search to the shelf');
  ok(await page.$eval('#clipgrid .cnm', (el) => el.textContent) === 'Moon milk',
    'the shelf answers the search');
  await page.fill('#clipq', '');
  await page.press('#clipq', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#clipgrid button').length === 2);

  // 3 — placing one
  await page.click('#clipgrid button');
  await page.waitForSelector('#pad .beat');
  ok(posted.some(([p]) => p === '/api/scratchpad/clip'), 'a clip is placed with POST /clip');
  ok(!posted.some(([p]) => p === '/api/scratchpad/add'), 'never through /add (that files an mp4 as a picture)');
  ok(await page.$eval('#pad .beat img', (el) => el.src.indexOf('/px.png') > 0),
    'the pad tile is the clip’s poster');
  ok((await page.$$('#pad .beat .fmark')).length === 1, 'the pad tile wears the film mark');
  ok((await page.$$('#pad video')).length === 0, 'the pad itself decodes no video');

  // 4 — the popup plays it, and the picture-makers are gone
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  const shown = (sel) => page.$eval(sel, (el) => !el.hidden);
  ok(await shown('#popvid'), 'the popup shows the clip');
  ok(!(await shown('#popimg')) && !(await shown('#popblank')), 'the picture face is not also showing');
  ok(await page.$eval('#popvid', (el) => el.getAttribute('src').indexOf('.mp4') > 0), 'it is the clip’s own file');
  ok(await page.$eval('#popvid', (el) => (el.getAttribute('poster') || '').indexOf('/px.png') === 0),
    'the poster stands in until she plays it');
  for (const [id, why] of [['artrow', 'the draw/Playground/inbox row'], ['speak', 'the speak icon'], ['micbtn', 'the record icon']]) {
    ok(await page.$eval('#' + id, (el) => el.hidden), why + ' is gone on a clip');
  }
  ok(await page.$eval('#popvid', (el) => el.getBoundingClientRect().width > 200),
    'the clip is watchable — the card’s width, not the 90px tile');

  // 5 — a frame color lands on the video, and closing pauses it.
  // The chips live behind the corner colour square now (Aug 2026), so the
  // drop-down has to be opened before one can be tapped.
  await page.click('#colorbtn');
  await page.click('#colormenu .chip.blue');
  ok(await page.$eval('#popvid', (el) => el.className === 'c-blue'), 'the frame color lands on the clip');
  await page.evaluate(() => { const v = document.getElementById('popvid'); v.__paused = 0; v.pause = function () { v.__paused = 1; }; });
  await page.mouse.click(5, 5);   // the edge around the card — never the video
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);
  ok(await page.evaluate(() => document.getElementById('popvid').__paused === 1),
    'closing the popup pauses the clip');

  await browser.close();
  server.close();
  console.log(failures ? failures + ' FAILED' : 'all good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

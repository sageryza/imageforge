#!/usr/bin/env node
// THE LIGHTBOX'S CAPTION IS NEVER UNDER THE PICTURE (2026-08-26, Sophie: "the
// label is covered by the picture" — reported on the Playground's old hand
// copy, whose 76vh picture cap ignored the room the caption needed).
//
// The Playground opens the SHARED lightbox now (asset-lightbox.js), whose
// picture yields room for everything under it (`hastalk`/`hasacts` caps). This
// sweeps the same heights against that design: the MODEL · QUALITY line and
// the note box must be on screen and reachable, and the picture must end above
// the caption, at every size — including the app's short web view.
//
// It is a MEASUREMENT, and it has to be: the overlap is a few pixels of one
// line, every element is "visible" either way, and `elementFromPoint` is the
// only honest way to ask what is actually on top. The heights are swept because
// this kind of bug does not exist at 844 — a test at one comfortable size sees
// nothing.
//
//   npm install playwright --no-save && node scripts/test-playground-lightbox-caption.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
// Her own prompt from the report — long, the way her dictated ones are.
const PROMPT = 'a group of scientists, on a cloud, dropping solid golden dinosaur '
  + 'chicken nuggets, into random people walking along the street. a little blonde '
  + 'boy catches one, and holds it up, amazed at the treasure, other people look at '
  + 'the dropped golden nuggets on the ground, contemplating what to do';
const RUNS = [{
  id: 'run0', prompt: PROMPT, status: 'done', engine: 'gptimage',
  model: 'gpt-image-2', quality: 'low', aspectRatio: '2:3', style: 'dreamy', res: '2k',
  images: ['/px.png'], votes: {}, createdAt: 1786000000000,
}];

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /asset-lightbox.js, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname === '/api/gallery/assets/note') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ thread: [] }));
  }
  // A REAL-SIZED 2:3 picture — the lightbox sizes itself to the picture, so a
  // 1x1 pixel could never overflow anything.
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">'
      + '<rect width="1024" height="1536" fill="#8a7f70"/></svg>');
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});

  // 560 and 620 are the app's web view with its bottom bar; 844 is the iPhone 13
  // in Safari, where this kind of bug never shows.
  for (const height of [560, 620, 660, 740, 844]) {
    const page = await browser.newPage({ viewport: { width: 390, height } });
    await page.addInitScript(() => localStorage.setItem('promptlab_view', 'tiles'));
    await page.goto(base + '/playground');
    await page.waitForFunction(() => document.querySelectorAll('#tiles .cell:not(.ph) img').length > 0);
    await page.locator('#tiles .cell:not(.ph) img').first().click();
    await page.waitForFunction(() => {
      const lb = document.getElementById('clightbox');
      return !!lb && lb.style.display !== 'none';
    });

    const m = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
      };
      const cap = document.querySelector('#clightbox .clcap');
      const cb = cap.getBoundingClientRect();
      const at = document.elementFromPoint(195, Math.round(cb.top + cb.height / 2));
      return {
        img: box('#clightbox .clwrap img'),
        cap: { top: Math.round(cb.top), bottom: Math.round(cb.bottom) },
        note: box('#clightbox .lbnote'),
        acts: box('#clightbox .lbacts'),
        text: cap.textContent,
        onCap: at ? (at.className || at.id || at.tagName) : null,
      };
    });

    const tag = `at ${height}px`;
    // MODEL · QUALITY · SIZE and nothing else (2026-08-27, Sophie: "extra
    // notes - dreamy etc … just need model quality and pixels + 1/4") — the
    // ratio used to sit on this line and is on the run's CARD now.
    if (!/^gpt-image-2 · low · 2K$/.test(m.text.trim()))
      fail(`${tag}: the MODEL · QUALITY · SIZE line is missing (${m.text})`);
    // The picture must end above the caption, not on top of it.
    if (m.img.bottom > m.cap.top)
      fail(`${tag}: the picture ends at ${m.img.bottom} and the label starts at ${m.cap.top} — covered by ${m.img.bottom - m.cap.top}px`);
    // elementFromPoint is the question that matters: what is actually on top?
    if (String(m.onCap).indexOf('clcap') < 0)
      fail(`${tag}: the middle of the label reaches ${m.onCap}, not the label`);
    // …and everything under the picture is still on the screen.
    if (m.acts.bottom > height) fail(`${tag}: the actions row ends at ${m.acts.bottom}, off a ${height}px screen`);
    if (m.note.bottom > height) fail(`${tag}: the note box ends at ${m.note.bottom}, off a ${height}px screen`);
    if (m.cap.bottom > height) fail(`${tag}: the label ends at ${m.cap.bottom}, off a ${height}px screen`);

    await page.close();
  }

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the lightbox caption is clear of the picture at every height');
})().catch(e => { console.error(e); process.exit(1); });

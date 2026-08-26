#!/usr/bin/env node
// THE LIGHTBOX'S CAPTION IS NEVER UNDER THE PICTURE (2026-08-26, Sophie: "the
// label is covered by the picture").
//
// The stage is `position:relative`, so it and the <img> inside it paint ABOVE
// the static caption below them — and the picture's `max-height:76vh` did not
// shrink when flex squeezed the stage. On a short viewport (the app's web view
// is shorter than Safari's by its bottom bar) the bottom of a portrait 2:3 sat
// on top of the MODEL · QUALITY · SIZE line, which is the one thing she opens a
// picture to check.
//
// It is a MEASUREMENT, and it has to be: the overlap is a few pixels of one
// line, every element is "visible" either way, and `elementFromPoint` is the
// only honest way to ask what is actually on top. The heights are swept because
// the bug does not exist at 844 — a test at one comfortable size sees nothing.
//
//   npm install playwright --no-save && node scripts/test-playground-lightbox-caption.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
// Her own prompt from the report — long enough to fill the caption's scroll box,
// which is what pushes the buttons down and squeezes the stage.
const PROMPT = 'a group of scientists, on a cloud, dropping solid golden dinosaur '
  + 'chicken nuggets, into random people walking along the street. a little blonde '
  + 'boy catches one, and holds it up, amazed at the treasure, other people look at '
  + 'the dropped golden nuggets on the ground, contemplating what to do';
const RUNS = [{
  id: 'run0', prompt: PROMPT, status: 'done', engine: 'gptimage',
  model: 'gpt-image-2', quality: 'low', aspectRatio: '2:3', style: 'dreamy',
  images: ['/px.png'], votes: {}, createdAt: 1786000000000,
}];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
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
  // in Safari, where this always looked fine.
  for (const height of [560, 620, 660, 740, 844]) {
    const page = await browser.newPage({ viewport: { width: 390, height } });
    await page.addInitScript(() => localStorage.setItem('promptlab_view', 'tiles'));
    await page.goto(base + '/playground');
    await page.waitForFunction(() => document.querySelectorAll('#tiles .cell:not(.ph) img').length > 0);
    await page.locator('#tiles .cell:not(.ph) img').first().click();
    await page.waitForSelector('#lb.on');

    const m = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        const b = el.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
      };
      const meta = document.getElementById('lbcapm').getBoundingClientRect();
      const at = document.elementFromPoint(195, Math.round(meta.top + meta.height / 2));
      return {
        img: box('#lbimg'),
        stage: box('.lbstage'),
        meta: { top: Math.round(meta.top), bottom: Math.round(meta.bottom) },
        prompt: box('#lbcapp'),
        btns: box('.lbbtns'),
        text: document.getElementById('lbcapm').textContent,
        onMeta: at ? (at.id || at.className || at.tagName) : null,
      };
    });

    const tag = `at ${height}px`;
    if (!m.text.trim()) fail(`${tag}: the MODEL · QUALITY · SIZE line is empty`);
    // The picture must end above the caption, not on top of it.
    if (m.img.bottom > m.meta.top)
      fail(`${tag}: the picture ends at ${m.img.bottom} and the label starts at ${m.meta.top} — covered by ${m.img.bottom - m.meta.top}px`);
    // …and it must stay inside its own stage, which is what makes that true.
    if (m.img.bottom > m.stage.bottom + 1)
      fail(`${tag}: the picture overflows its stage by ${m.img.bottom - m.stage.bottom}px`);
    // elementFromPoint is the question that matters: what is actually on top?
    if (m.onMeta !== 'lbcapm')
      fail(`${tag}: the middle of the label reaches ${m.onMeta}, not the label`);
    // Her words and the buttons under them still fit on the screen.
    if (m.prompt.top < m.meta.bottom) fail(`${tag}: the prompt overlaps the label`);
    if (m.btns.bottom > height) fail(`${tag}: the ♥/✕ row ends at ${m.btns.bottom}, off a ${height}px screen`);

    await page.close();
  }

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the lightbox caption is clear of the picture at every height');
})().catch(e => { console.error(e); process.exit(1); });

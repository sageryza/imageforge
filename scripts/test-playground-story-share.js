#!/usr/bin/env node
// SEND TO THE STORY ROOM from the Playground lightbox (Aug 2026, Sophie: "add
// a send to story room share icon button in the playground next to the other
// four buttons where I can pick a story and either put it in the inbox of
// that story or put in a specific beat that exists or make a new beat").
//
// Drives the REAL public/promptlab.html in headless Chromium against a stub
// API and asserts:
//   1. the share button is the FIFTH button in the lightbox row and draws
//      an icon,
//   2. tapping it opens the sheet listing the stories the API answered,
//   3. opening a story shows the two doors (inbox · new beat) AND its beats —
//      a beat's row wears its words and its art, the art falling back to the
//      dreamy side when the watercolor slot is empty,
//   4. "Into the inbox" POSTs /api/scratchpad/inbox with the pad and the
//      picture (appending — replace is never sent),
//   5. "As a new beat" POSTs /api/scratchpad/add with the pad's own style and
//      the full provenance src (runId · i · prompt · model · quality),
//   6. tapping an existing beat POSTs /api/scratchpad/image onto THAT beat,
//   7. sending closes the sheet, keeps the lightbox open, and toasts; the
//      back chevron returns to the story list; a backdrop tap closes.
//
//   npm install playwright --no-save && node scripts/test-playground-story-share.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

const RUNS = [{
  id: 'runA', prompt: 'a fox in the rain', status: 'done',
  engine: 'gptimage', model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
  images: ['/px.png?r=runA&i=0', '/px.png?r=runA&i=1'],
  votes: {}, createdAt: T0,
}];

const PADS = [
  { id: 'padX', title: 'The Meteorite', beats: 2, cover: '/px.png?c=x', updatedAt: T0 },
  { id: 'padY', title: 'Moon Milk', beats: 0, cover: null, updatedAt: T0 - 1000 },
];
const PADX = {
  pad: 'padX', title: 'The Meteorite', style: 'watercolor',
  beats: [
    { id: 'b1', text: 'The kitchen floods', url: '/px.png?b=1' },
    // No watercolor art — the row's thumbnail must fall back to the dreamy side.
    { id: 'b2', text: '', alt: { dreamy: { url: '/px.png?b=2' } } },
  ],
};

const posts = [];   // every write the page makes, {path, body}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'POST' && url.pathname.startsWith('/api/scratchpad/')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      posts.push({ path: url.pathname, body: JSON.parse(raw || '{}') });
      json({ ok: true, beats: PADX.beats });
    });
    return;
  }
  if (url.pathname === '/api/scratchpad/pads') return json({ count: PADS.length, pads: PADS });
  if (url.pathname === '/api/scratchpad/') return json(PADX);
  if (url.pathname === '/api/promptlab') return json({ runs: RUNS, more: false });
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">' +
      '<rect width="1024" height="1536" fill="#8a7f70"/></svg>');
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);

  const openLightbox = async () => {
    await page.locator('#runs .cell img[data-run="runA"][data-i="0"]').click();
    await page.waitForSelector('#lb.on');
  };
  const openSheetOnPadX = async () => {
    await page.locator('#lbstory').click();
    await page.waitForFunction(() => document.querySelectorAll('#storysheet .ssrow').length === 2);
    await page.locator('#storysheet .ssrow', { hasText: 'The Meteorite' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#storysheet .ssrow.door').length === 2);
  };

  // 1 — the fifth button, with an icon on it.
  if (await page.locator('.lbbtns .lbbtn').count() !== 5) fail('the lightbox row does not hold five buttons');
  const fifth = await page.locator('.lbbtns .lbbtn').nth(4).getAttribute('id');
  if (fifth !== 'lbstory') fail('the share button is not the fifth in the row (got ' + fifth + ')');
  if (await page.locator('#lbstory svg').count() !== 1) fail('the share button draws no icon');

  // 2 — the sheet lists the stories.
  await openLightbox();
  await page.locator('#lbstory').click();
  await page.waitForFunction(() => document.querySelectorAll('#storysheet .ssrow').length === 2);
  const names = await page.locator('#storysheet .ssrow .t').allTextContents();
  if (names.join('|') !== 'The Meteorite|Moon Milk') fail('the story list shows ' + names.join('|'));

  // 3 — a story's doors and beats.
  await page.locator('#storysheet .ssrow', { hasText: 'The Meteorite' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#storysheet .ssrow.door').length === 2);
  const doors = await page.locator('#storysheet .ssrow.door .t').allTextContents();
  if (!/inbox/i.test(doors[0]) || !/new beat/i.test(doors[1])) fail('the doors read ' + doors.join(' | '));
  const beatRows = page.locator('#storysheet .ssrow:not(.door)');
  if (await beatRows.count() !== 2) fail('expected 2 beat rows, got ' + await beatRows.count());
  if ((await beatRows.nth(0).locator('.t').textContent()) !== 'The kitchen floods') fail('beat 1 row does not wear its words');
  if ((await beatRows.nth(1).locator('.t').textContent()) !== 'Beat 2') fail('a wordless beat row is not named Beat 2');
  const b2thumb = await beatRows.nth(1).locator('img.thumb').getAttribute('src');
  if (!b2thumb || !b2thumb.includes('b=2')) fail('beat 2 did not fall back to its dreamy art (' + b2thumb + ')');

  // 4 — into the inbox.
  await page.locator('#storysheet .ssrow.door', { hasText: 'inbox' }).click();
  await page.waitForFunction(() => document.getElementById('toast').classList.contains('on'));
  let p = posts.pop();
  if (!p || p.path !== '/api/scratchpad/inbox') fail('the inbox door posted ' + (p && p.path));
  else {
    if (p.body.pad !== 'padX') fail('inbox post names pad ' + p.body.pad);
    if (p.body.replace) fail('the inbox post asks to REPLACE — it must append');
    const it = (p.body.items || [])[0] || {};
    if (!/px\.png\?r=runA&i=0/.test(it.url)) fail('inbox item url is ' + it.url);
    if (it.prompt !== 'a fox in the rain') fail('inbox item lost the prompt');
  }
  if (await page.locator('#storysheet.on').count()) fail('the sheet stayed open after sending');
  if (!await page.locator('#lb.on').count()) fail('sending closed the lightbox');

  // 5 — as a new beat, carrying the pad's style and the provenance src.
  await openSheetOnPadX();
  await page.locator('#storysheet .ssrow.door', { hasText: 'new beat' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#storysheet.on').length === 0);
  p = posts.pop();
  if (!p || p.path !== '/api/scratchpad/add') fail('the new-beat door posted ' + (p && p.path));
  else {
    if (p.body.pad !== 'padX') fail('add post names pad ' + p.body.pad);
    if (p.body.style !== 'watercolor') fail('add post carries style ' + p.body.style);
    const s = p.body.src || {};
    if (s.runId !== 'runA' || s.i !== 0 || s.prompt !== 'a fox in the rain'
      || s.model !== 'gpt-image-2' || s.quality !== 'medium') fail('add post src is ' + JSON.stringify(s));
  }

  // 6 — onto an existing beat.
  await openSheetOnPadX();
  await page.locator('#storysheet .ssrow', { hasText: 'The kitchen floods' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#storysheet.on').length === 0);
  p = posts.pop();
  if (!p || p.path !== '/api/scratchpad/image') fail('the beat row posted ' + (p && p.path));
  else {
    if (p.body.id !== 'b1') fail('the beat post targets ' + p.body.id);
    if (p.body.pad !== 'padX' || p.body.style !== 'watercolor') fail('the beat post lost pad/style');
    if (!p.body.src || p.body.src.runId !== 'runA') fail('the beat post lost the src');
  }

  // 7 — the back chevron returns to the shelf; the backdrop closes.
  await openSheetOnPadX();
  await page.locator('#ssback').click();
  await page.waitForFunction(() => document.querySelectorAll('#storysheet .ssrow').length === 2);
  if (!(await page.locator('#ssback').isHidden())) fail('the chevron is still offered on the story list');
  await page.mouse.click(10, 60);   // the dim backdrop, well above the box
  if (await page.locator('#storysheet.on').count()) fail('a backdrop tap did not close the sheet');
  if (!await page.locator('#lb.on').count()) fail('closing the sheet closed the lightbox too');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the share button sends a lightbox picture to a story\'s inbox, a new beat, or an existing beat');
})().catch(e => { console.error(e); process.exit(1); });

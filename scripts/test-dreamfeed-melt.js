#!/usr/bin/env node
// Regression test for Sophie's five notes on the melt feed (2026-08-18), the
// pass she wanted before sending the app to her friends. Drives the REAL
// public/dreamapp.html in a headless browser against a stub API and asserts:
//   1. "see more" sits ON the last line of the words, not under them,
//   2. the words next to a picture are cut to about the picture's height,
//   3. the day divider is a solid terracotta line, not a grey dashed one,
//   4. the end-of-night note carries no glyphs and is neither bold nor italic,
//   5. opened, the picture comes up to full width and the words run UNDER it.
//
//   npm install playwright --no-save && node scripts/test-dreamfeed-melt.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;
const para = (n) => Array.from({ length: n }, (_, i) => `sentence number ${i} of this dream, long enough to wrap.`).join(' ');

const night = (id, extra) => ({
  id, by: id.toUpperCase(), mine: false, feltCount: 2, felt: false, commentCount: 1,
  publicOn: '2026-08-08', panels: [], cover: null, ...extra,
});
// One picture night (the case notes 1, 2 and 5 are about), one wordy night with
// no picture, one short one, and a night on an OLDER day so the divider draws.
const FEED = {
  sealed: false,
  today: '2026-08-08',
  nights: [
    night('pic', { title: 'The Time-Travelling Elevator', createdAt: new Date(T0).toISOString(),
      dreams: [{ id: 'pic', title: 'The Time-Travelling Elevator', words: para(40) }],
      panels: [{ dreamId: 'pic', i: 0, url: '/px.png?i=0', captions: [] }],
      cover: { dreamId: 'pic', i: 0, url: '/px.png?i=0', captions: [] } }),
    night('nopic', { title: 'The Man and the Gas Tank', createdAt: new Date(T0 - 60000).toISOString(),
      dreams: [{ id: 'nopic', title: 'The Man and the Gas Tank', words: para(40) }] }),
    night('short', { title: 'The Short One', createdAt: new Date(T0 - 120000).toISOString(),
      dreams: [{ id: 'short', title: 'The Short One', words: 'a bus. it kept going.' }] }),
    night('older', { title: 'Ian’s Barn Project', publicOn: '2026-08-07',
      createdAt: new Date(T0 - 86400000).toISOString(),
      dreams: [{ id: 'older', title: 'Ian’s Barn Project', words: para(30) }] }),
  ],
};

// A 2:3 pixel, so the opened picture has a real aspect ratio to grow into.
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR42mNk+M9QzzCKRxUAAP//AwAV4gL9AAAAAElFTkSuQmCC',
  'base64');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, type, b) => { res.writeHead(code, { 'content-type': type }); res.end(b); };
  if (url.pathname === '/px.png') return send(200, 'image/png', PX);
  if (url.pathname === '/api/witch/firebase-config') return send(200, 'application/json', JSON.stringify({ apiKey: 'stub', authDomain: 'stub', projectId: 'stub' }));
  if (url.pathname === '/api/dreamapp/feed') return send(200, 'application/json', JSON.stringify(FEED));
  if (url.pathname === '/api/dreamapp/dreams') return send(200, 'application/json', JSON.stringify({ dreams: [] }));
  if (url.pathname === '/dreamfeed') return send(200, 'text/html', fs.readFileSync(path.join(PUB, 'dreamapp.html')));
  return send(404, 'text/plain', 'no');
});

const FAKE_FIREBASE = `
window.firebase = {
  initializeApp: function(){},
  auth: function(){
    return {
      currentUser: { getIdToken: function(){ return Promise.resolve('tok'); } },
      getRedirectResult: function(){ return Promise.resolve({}); },
      onAuthStateChanged: function(cb){ setTimeout(function(){ cb({ uid: 'u1' }); }, 0); },
      signOut: function(){},
    };
  },
};
window.firebase.auth.GoogleAuthProvider = function(){};
window.firebase.auth.OAuthProvider = function(){ this.addScope = function(){}; };
`;

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const found = (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : [])
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).filter((p) => fs.existsSync(p));
  const browser = await chromium.launch(found.length ? { executablePath: found[0] } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone 13

  await page.route(/gstatic\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_FIREBASE }));

  await page.goto(`${base}/dreamfeed`);
  // The cards breathe and wobble forever, so playwright's actionability check
  // never sees a "stable" button and a boundingBox reads the ROTATED box.
  // Killing the animations changes no layout box — every one of them is a
  // transform, an opacity or a border-radius — and leaves the geometry these
  // checks are about exactly as it ships.
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none !important}' });
  await page.waitForSelector('.dcard');
  await page.waitForTimeout(300); // the re-fit that runs once the serif lands

  const box = (sel) => page.locator(sel).first().boundingBox();
  const card = (id) => `.dcard[data-id="${id}"]`;

  // ── 1. the fold is ON the last line of the words, not under them ──
  for (const id of ['pic', 'nopic']) {
    const b = await box(`${card(id)} .dbody`);
    const m = await box(`${card(id)} .dmore`);
    const lh = await page.locator(`${card(id)} .dbody`).evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    check(`${id}: "see more" sits inside the words, on the last line`,
      m && b && m.y + m.height <= b.y + b.height + 1 && m.y >= b.y + b.height - 1.6 * lh,
      m && b ? `button ${Math.round(m.y)}..${Math.round(m.y + m.height)}, words end ${Math.round(b.y + b.height)}` : 'missing');
    check(`${id}: and it is to the RIGHT, with words beside it`,
      m && b && m.x + m.width > b.x + b.width - 2,
      m && b ? `button right ${Math.round(m.x + m.width)} of ${Math.round(b.x + b.width)}` : 'missing');
  }
  // a dream that already fits is offered nothing
  check('a short dream is offered no fold', !(await page.locator(`${card('short')} .dmore`).isVisible()));

  // ── 2. the words are cut to about the picture's height ──
  const blob = await box(`${card('pic')} .blob`);
  const txt = await box(`${card('pic')} .dtxt`);
  check('the words and the picture end at about the same height',
    blob && txt && Math.abs(txt.height - blob.height) <= 26,
    blob && txt ? `words ${Math.round(txt.height)}px vs picture ${Math.round(blob.height)}px` : 'missing');

  // ── 3. the day divider: a solid terracotta line and label ──
  const line = await page.locator('.fdiv span.l').first().evaluate((el) => {
    const c = getComputedStyle(el);
    return { style: c.borderTopStyle, color: c.borderTopColor };
  });
  check('the day divider is a solid line, not dashed', line.style === 'solid', line.style);
  check('and it is the terracotta accent', line.color === 'rgb(122, 74, 58)', line.color);
  const lab = await page.locator('.fdiv span.t').first().evaluate((el) => getComputedStyle(el).color);
  check('the date reads in the accent too, not grey', lab === 'rgb(122, 74, 58)', lab);

  // ── 4. the end-of-night note: no glyphs, not bold, not italic ──
  const fend = await page.locator('.fend').first().evaluate((el) => {
    const c = getComputedStyle(el);
    return { text: el.textContent, style: c.fontStyle, weight: c.fontWeight };
  });
  check('the end-of-night note carries no glyphs', !/[✳✴✵✺]/.test(fend.text), JSON.stringify(fend.text));
  check('it is not italic', fend.style === 'normal', fend.style);
  check('and not bold', Number(fend.weight) <= 400, fend.weight);

  // ── 5. opened, the picture goes full width and the words run under it ──
  await page.locator(`${card('pic')} .dmore`).click();
  await page.waitForTimeout(120);
  const dir = await page.locator(`${card('pic')} .drow`).evaluate((el) => getComputedStyle(el).flexDirection);
  check('opened, the row becomes a column', dir === 'column', dir);
  const openBlob = await box(`${card('pic')} .blob`);
  const openTxt = await box(`${card('pic')} .dtxt`);
  const row = await box(`${card('pic')} .drow`);
  check('the picture comes up to its normal, full width',
    openBlob && row && openBlob.width >= row.width - 1 && openBlob.width > blob.width * 1.5,
    openBlob ? `${Math.round(blob.width)}px -> ${Math.round(openBlob.width)}px of ${Math.round(row.width)}px` : 'missing');
  check('and it is no longer cropped square',
    openBlob && Math.abs(openBlob.height - openBlob.width) > 4,
    openBlob ? `${Math.round(openBlob.width)}x${Math.round(openBlob.height)}` : 'missing');
  check('the words run UNDER the picture',
    openBlob && openTxt && openTxt.y >= openBlob.y + openBlob.height - 1,
    openBlob && openTxt ? `words at ${Math.round(openTxt.y)}, picture ends ${Math.round(openBlob.y + openBlob.height)}` : 'missing');
  check('the words are open, not still cut',
    (await page.locator(`${card('pic')} .dbody`).evaluate((el) => el.scrollHeight - el.clientHeight)) <= 4);
  const less = await page.locator(`${card('pic')} .dmore`).textContent();
  check('the button now reads "see less"', /see less/.test(less), less);

  // closing puts the side-by-side card back exactly as it was
  await page.locator(`${card('pic')} .dmore`).click();
  await page.waitForTimeout(120);
  const back = await box(`${card('pic')} .blob`);
  check('closing restores the square picture beside the words',
    back && Math.abs(back.width - blob.width) < 2 && Math.abs(back.height - blob.height) < 2,
    back ? `${Math.round(back.width)}x${Math.round(back.height)}` : 'missing');
  const reFold = await box(`${card('pic')} .dmore`);
  const reBody = await box(`${card('pic')} .dbody`);
  check('and the fold is back on the last line',
    reFold && reBody && reFold.y + reFold.height <= reBody.y + reBody.height + 1);

  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
  process.exit(fails.length ? 1 : 0);
})();

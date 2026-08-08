#!/usr/bin/env node
// Regression test for Sophie's ask: "the dream text should be truncated so it's
// the same amount of scrolling no matter what … but there always has to be a
// way to close it … so you don't have to wait till you get to the bottom."
//
// Drives the REAL public/dreamapp.html in a headless browser against a stub API
// and asserts the four things the fold has to get right:
//   1. every collapsed dream is the SAME height, however long its words are,
//   2. a dream short enough to fit is offered no button at all,
//   3. opened, the "see less" is ON SCREEN while you are in the MIDDLE of the
//      text — the whole point; a button pinned to the end would pass a naive
//      "it exists" check and fail her,
//   4. closing puts the dream's top back on screen instead of stranding her
//      halfway down what she just collapsed.
// The extra-panels fold gets the same treatment, since it shares wireFold.
//
//   npm install playwright --no-save && node scripts/test-dreamfeed-fold.js
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

const FEED = {
  sealed: false,
  today: '2026-08-08',
  dreams: [
    { id: 'long', title: 'The Long One', by: 'A', words: para(60), panels: [], feltCount: 3, felt: false, commentCount: 0, publicOn: '2026-08-08', createdAt: new Date(T0).toISOString() },
    { id: 'alsolong', title: 'Also Long', by: 'B', words: para(200), panels: [], feltCount: 1, felt: false, commentCount: 0, publicOn: '2026-08-08', createdAt: new Date(T0 - 60000).toISOString() },
    { id: 'short', title: 'The Short One', by: 'C', words: 'a bus. it kept going.', panels: [], feltCount: 0, felt: false, commentCount: 0, publicOn: '2026-08-08', createdAt: new Date(T0 - 120000).toISOString() },
    { id: 'pics', title: 'Many Panels', by: 'D', words: para(3), feltCount: 0, felt: false, commentCount: 0, publicOn: '2026-08-08', createdAt: new Date(T0 - 180000).toISOString(),
      panels: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ i, url: '/px.png?i=' + i, captions: [] })) },
  ],
};

// One transparent pixel, so panel images resolve without any network.
const PX = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
  if (url.pathname === '/px.png') return send(200, 'image/gif', PX);
  if (url.pathname === '/api/witch/firebase-config') return send(200, 'application/json', JSON.stringify({ apiKey: 'stub', authDomain: 'stub', projectId: 'stub' }));
  if (url.pathname === '/api/dreamapp/feed') return send(200, 'application/json', JSON.stringify(FEED));
  if (url.pathname === '/api/dreamapp/dreams') return send(200, 'application/json', JSON.stringify({ dreams: [] }));
  if (url.pathname === '/dreamfeed') return send(200, 'text/html', fs.readFileSync(path.join(PUB, 'dreamapp.html')));
  return send(404, 'text/plain', 'no');
});

// Stands in for the two firebase-compat scripts the page loads from gstatic.
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
  // The host ships a browser under PLAYWRIGHT_BROWSERS_PATH that may not match
  // the installed playwright's expected build — point at it rather than
  // downloading a second copy.
  const found = (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : [])
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).filter((p) => fs.existsSync(p));
  const browser = await chromium.launch(found.length ? { executablePath: found[0] } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone 13

  // A regex, not a glob: "**/gstatic.com/**" never matches, because there is no
  // slash immediately before the host in https://www.gstatic.com/…
  await page.route(/gstatic\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_FIREBASE }));

  await page.goto(`${base}/dreamfeed`);
  await page.waitForSelector('.dream');

  const box = (sel) => page.locator(sel).first().boundingBox();

  // 1. same amount of scrolling, whatever the dream's length
  const hLong = (await box('.dream[data-id="long"]')).height;
  const hAlso = (await box('.dream[data-id="alsolong"]')).height;
  check('two dreams of very different length collapse to the same height',
    Math.abs(hLong - hAlso) < 1, `${Math.round(hLong)}px vs ${Math.round(hAlso)}px`);

  // 2. nothing to open means no button
  const shortBtn = await page.locator('.dream[data-id="short"] [data-wmore]').isVisible();
  const longBtn = await page.locator('.dream[data-id="long"] [data-wmore]').isVisible();
  check('a dream that already fits is offered no fold', !shortBtn);
  check('a clamped dream is offered the fold', longBtn);

  // 3. the close is reachable from the MIDDLE of the opened text
  await page.locator('.dream[data-id="alsolong"] [data-wmore]').click();
  const opened = (await box('.dream[data-id="alsolong"]')).height;
  check('opening really expands it', opened > hAlso * 3, `${Math.round(hAlso)}px -> ${Math.round(opened)}px`);

  const stuck = await page.locator('.dream[data-id="alsolong"] [data-wmore]').evaluate(
    (el) => getComputedStyle(el).position);
  check('the opened button is sticky', stuck === 'sticky', stuck);

  // scroll to the middle of the expanded dream and look for the button
  const dreamTop = await page.locator('.dream[data-id="alsolong"]').evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo(0, y), dreamTop + opened / 2);
  await page.waitForTimeout(120);
  const mid = await page.locator('.dream[data-id="alsolong"] [data-wmore]').boundingBox();
  const vh = 844;
  check('mid-read, "see less" is on screen', mid && mid.y > 0 && mid.y + mid.height <= vh,
    mid ? `y=${Math.round(mid.y)} of ${vh}` : 'not rendered');
  const navTop = await page.locator('nav').evaluate((el) => el.getBoundingClientRect().top);
  check('and it sits clear of the bottom nav', mid && mid.y + mid.height <= navTop + 1,
    mid ? `button bottom ${Math.round(mid.y + mid.height)}, nav top ${Math.round(navTop)}` : '');

  // 4. closing brings the dream's top back
  await page.locator('.dream[data-id="alsolong"] [data-wmore]').click();
  await page.waitForTimeout(120);
  const after = await page.locator('.dream[data-id="alsolong"]').boundingBox();
  check('closing puts the dream back on screen', after && after.y >= -1 && after.y < vh,
    after ? `top at y=${Math.round(after.y)}` : 'gone');
  const reclamped = (await box('.dream[data-id="alsolong"]')).height;
  check('and it is collapsed again', Math.abs(reclamped - hAlso) < 1);

  // the panels fold shares wireFold — same close behaviour. A dream opens on
  // its words, so the pictures have to be asked for first.
  await page.locator('.dream[data-id="pics"] .tab[data-t="pics"]').click();
  const picsBtn = page.locator('.dream[data-id="pics"] [data-more]');
  check('the extra panels offer a fold', await picsBtn.isVisible());
  await picsBtn.click();
  const picsStuck = await picsBtn.evaluate((el) => getComputedStyle(el).position);
  check('the opened panels button is sticky too', picsStuck === 'sticky', picsStuck);
  await picsBtn.click();
  const restHidden = await page.locator('.dream[data-id="pics"] [data-rest]').isHidden();
  check('and it closes the extra panels again', restHidden);

  // header: the app's name and a gear, no date
  const headerText = await page.locator('header').innerText();
  check('the header carries no date', !/\d/.test(headerText), JSON.stringify(headerText));
  check('the gear is there', await page.locator('#gearBtn').isVisible());
  await page.locator('#gearBtn').click();
  check('the gear opens a menu holding sign out', await page.locator('#gearMenu #signOut').isVisible());
  await page.locator('#gearScrim').click({ position: { x: 5, y: 5 } });
  check('tapping away puts it back', (await page.locator('#gearMenu').count()) === 0);

  // lightbox: a tapped panel opens big, locks the page, and gives back the spot
  await page.evaluate(() => window.scrollTo(0, 600));
  const beforeY = await page.evaluate(() => window.scrollY);
  await page.locator('.dream[data-id="pics"] .pgrid img').first().click();
  check('a tapped panel opens the lightbox', await page.locator('#lb').isVisible());
  const locked = await page.evaluate(() => getComputedStyle(document.body).overflow);
  check('the page behind it is locked', locked === 'hidden', locked);
  await page.locator('#lb').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(120);
  check('tapping it closes', await page.locator('#lb').isHidden());
  const afterY = await page.evaluate(() => window.scrollY);
  check('and she lands back where she opened it', Math.abs(afterY - beforeY) < 2, `${beforeY} -> ${afterY}`);

  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

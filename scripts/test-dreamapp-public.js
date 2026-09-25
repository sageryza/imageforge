#!/usr/bin/env node
// THE PUBLIC FEED (2026-09-25, Sophie: "link shud open on public feed not
// login" · "feed shud show mine and friends dream" · "no text - delete").
// Two halves:
//   A. the middleware, pure — GET /feed answers a visitor with no token
//      (req.user null); every other door still 401s; a bad token on /feed is
//      a visitor, not an error.
//   B. the REAL public/dreamapp.html signed OUT in headless Chromium — the feed
//      draws (fetched with NO authorization header), the sign-in sheet stays
//      hidden, the header word reads "sign in", a tap on the confess button
//      opens the sheet, × closes it, a heart opens it too — and once the stub
//      signs her in, the sheet goes and the tap she made is carried out.
//
//   npm install playwright-core --no-save && node scripts/test-dreamapp-public.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
  if (!ok) fails.push(name);
};

// ── A. the middleware ──
const dreamapp = require(path.join(__dirname, '..', 'dreamapp'));
(async () => {
  // no membryAuth wired → identify() answers null for any token
  const run = (method, p, tok) => new Promise((resolve) => {
    const req = { method, path: p, get: () => (tok ? 'Bearer ' + tok : '') };
    const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code || 200, body: b, user: req.user }); } };
    dreamapp.requireUser(req, res, () => resolve({ code: 'next', user: req.user }));
  });
  let r = await run('GET', '/feed');
  check('A1 a visitor reaches GET /feed', r.code === 'next' && r.user === null, JSON.stringify(r));
  r = await run('GET', '/feed/');
  check('A2 with a trailing slash too', r.code === 'next' && r.user === null, JSON.stringify(r));
  r = await run('GET', '/feed', 'garbage');
  check('A3 a token that verifies to nobody is a visitor on /feed', r.code === 'next' && r.user === null, JSON.stringify(r));
  r = await run('GET', '/dreams');
  check('A4 the archive still needs an account', r.code === 401, JSON.stringify(r));
  r = await run('POST', '/feed');
  check('A5 only GET is open', r.code === 401, JSON.stringify(r));
  for (const p of ['/me', '/friends', '/dreamer/x', '/dreams/x/felt', '/dreams/x/comments', '/teams/join']) {
    r = await run(p.includes('felt') || p.includes('join') ? 'POST' : 'GET', p);
    check(`A6 ${p} still 401s`, r.code === 401, JSON.stringify(r));
  }
  check('A7 the open set is exactly the feed', JSON.stringify([...dreamapp.OPEN_ROUTES]) === '["GET /feed"]');

  // ── B. the page, signed out ──
  const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'dreamapp.html'), 'utf8');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const today = '2026-09-25';
  const dreams = [
    { id: 'n1', title: 'The Xylophone Teeth', mine: false, publicOn: '2026-08-21', createdAt: '2026-08-21T08:00:00Z',
      words: 'My teeth were a xylophone.', panels: [{ i: 0, url: '/img/1.png' }], cover: { i: 0, url: '/img/1.png' },
      feltCount: 4, felt: false, commentCount: 1 },
    { id: 'n2', title: 'Weather Chess', mine: false, publicOn: '2026-08-06', createdAt: '2026-08-06T06:00:00Z',
      words: 'Her bishop was a light drizzle.', panels: [], cover: null, feltCount: 1, felt: false, commentCount: 0 },
  ];
  const feedHeaders = [];
  const calls = [];
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    calls.push(req.method + ' ' + u);
    const json = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u === '/' || u === '/dreamfeed') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
    if (u.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    if (u === '/api/witch/firebase-config') return json({ apiKey: 'x', authDomain: 'x', projectId: 'x' });
    if (u === '/api/dreamapp/feed') {
      feedHeaders.push(req.headers.authorization || null);
      return json({ sealed: false, today, signedIn: !!req.headers.authorization, dreams });
    }
    if (!req.headers.authorization) return json({ error: 'sign in first' }, 401);
    if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: [] });
    if (u === '/api/dreamapp/me') return json({ name: 'sage', sharedToday: false, today, count: 0, streak: 0, drawsLeft: 3 });
    if (u === '/api/dreamapp/friends') return json({ friends: [], asks: [] });
    res.writeHead(404); res.end('{}');
  });
  const FIREBASE_STUB = `
    window.firebase = {
      initializeApp: function(){},
      auth: Object.assign(function(){ return window.__auth; }, {
        GoogleAuthProvider: function(){}, OAuthProvider: function(){}
      })
    };
    window.__auth = {
      currentUser: null,
      _cb: null,
      getRedirectResult: function(){ return Promise.resolve({}); },
      onAuthStateChanged: function(cb){ window.__auth._cb = cb; setTimeout(function(){ cb(null); }, 0); },
      signOut: function(){},
      __signIn: function(){
        window.__auth.currentUser = { getIdToken: async function(){ return 'tok'; } };
        window.__auth._cb(window.__auth.currentUser);
      }
    };`;

  let chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) { console.log('SKIP page half: playwright-core not installed'); return done(); }
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium',
    process.env.CHROMIUM_PATH].filter(Boolean).find((p) => fs.existsSync(p));
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://www.gstatic.com/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? FIREBASE_STUB : '/*auth*/' }));
  await page.route(/fonts\.(googleapis|gstatic|cdnfonts)\.com|cdnfonts\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + port + '/dreamfeed');
  await page.waitForSelector('.dcard', { timeout: 8000 });
  // the melt shapes wobble forever; a click waits for "stable" otherwise
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none !important;transition:none !important}' });

  check('B1 the feed draws for a visitor', (await page.$$('.dcard')).length === 2);
  check('B2 fetched with no authorization header', feedHeaders.length >= 1 && feedHeaders.every((h) => h === null), JSON.stringify(feedHeaders));
  check('B3 the sign-in sheet is hidden', await page.$eval('#gate', (el) => el.hidden));
  check('B4 the app is shown', await page.$eval('#app', (el) => !el.hidden));
  check('B5 the header word reads "sign in"', (await page.$eval('#navMine', (el) => el.textContent)) === 'sign in');
  check('B6 no "no dreams in the pile" line', !/no dreams in the pile/.test(await page.$eval('#scr-feed', (el) => el.innerText)));
  check('B7 the older days still divide', (await page.$$('.fdiv')).length === 2);

  // the confess button opens the sheet; × closes it
  await page.click('#confessBtn');
  await page.waitForTimeout(50);
  check('B8 the confess tap opens the sign-in sheet', await page.$eval('#gate', (el) => !el.hidden));
  check('B9 the compose sheet did NOT open', await page.$eval('#sheet', (el) => el.hidden));
  const gx = await page.$eval('#gateX', (el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('B10 the sheet has a way back (×)', gx.w > 10 && gx.h > 10, JSON.stringify(gx));
  await page.click('#gateX');
  check('B11 × puts the sheet away', await page.$eval('#gate', (el) => el.hidden));
  // a heart opens it too
  await page.click('[data-id="n1"] .likebtn');
  await page.waitForTimeout(50);
  check('B12 a heart opens the sign-in sheet', await page.$eval('#gate', (el) => !el.hidden));
  check('B13 and no /felt was posted while signed out', !calls.some((c) => c.includes('/felt')), calls.join(' '));
  await page.click('#gateX');
  // "sign in" in the header opens it
  await page.click('#navMine');
  check('B14 the header word opens the sign-in sheet', await page.$eval('#gate', (el) => !el.hidden));
  check('B15 the archive did not open', await page.$eval('#scr-mine', (el) => el.hidden));
  await page.click('#gateX');

  // she signs in for a reason: the tap she made is carried out
  // (#confessTop is the desk's button — on the phone the bottom bar is the one)
  await page.click('#confessBtn');
  await page.evaluate(() => window.__auth.__signIn());
  await page.waitForSelector('#sheet:not([hidden])', { timeout: 4000 });
  check('B16 signed in, the sign-in sheet goes', await page.$eval('#gate', (el) => el.hidden));
  check('B17 and the compose sheet she asked for opens', await page.$eval('#sheet', (el) => !el.hidden));
  await page.click('#sheetX');
  await page.waitForTimeout(100);
  check('B18 signed in, the header word is "archive" again', (await page.$eval('#navMine', (el) => el.textContent)) === 'archive');
  check('B19 the signed-in feed read carries the token', feedHeaders[feedHeaders.length - 1] === 'Bearer tok', JSON.stringify(feedHeaders));
  check('B20 no page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  srv.close();
  done();
  function done() {
    console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
    process.exit(fails.length ? 1 : 0);
  }
})();

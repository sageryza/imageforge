#!/usr/bin/env node
// A DREAMER'S PROFILE + ask-and-accept friendship (Aug 2026). Drives the REAL
// public/dreamapp.html against a stub API and asserts Sophie's rules:
//   1. an open card of someone else's carries "their dreams"; it opens the
//      profile screen,
//   2. the profile is NAMELESS while you are not friends, and carries the one
//      button — "ask if they want to be friends",
//   3. asking POSTs /friends/ask, flips the row to "you asked", and remembers
//      the pending pair for the asker's holding-hands moment,
//   4. when THEY asked you, the profile offers the yes; accepting raises the
//      holding-hands overlay with their name, and a tap closes it,
//   5. once friends, the profile finally says whose dreams these are.
//
//   npm install playwright-core --no-save && node scripts/test-dreamapp-profile.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'dreamapp.html'), 'utf8');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const today = '2026-08-18';
const nights = [
  { id: 'n1', title: 'The Xylophone Teeth', mine: false, publicOn: today, createdAt: today + 'T08:00:00Z',
    audience: 'everyone',
    dreams: [{ id: 'n1', title: 'The Xylophone Teeth', words: 'My teeth were a xylophone.' }],
    panels: [{ dreamId: 'n1', i: 0, url: '/img/1.png' }], cover: { dreamId: 'n1', i: 0, url: '/img/1.png' },
    feltCount: 4, felt: false, commentCount: 0 },
  { id: 'n2', title: 'The Whale Again', mine: true, publicOn: today, createdAt: today + 'T07:00:00Z',
    audience: 'everyone',
    dreams: [{ id: 'n2', title: 'The Whale Again', words: 'The whale is back.' }],
    panels: [], cover: null, feltCount: 1, felt: false, commentCount: 0 },
];

// the profile the stub serves — the test mutates `state`/`name` between steps
const dreamer = { state: 'none', pairId: null, name: null };
const asks = [];
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u === '/' || u === '/dreamfeed') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (u.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (u === '/api/witch/firebase-config') return json({ apiKey: 'x', authDomain: 'x', projectId: 'x' });
  if (u === '/api/dreamapp/feed') return json({ sealed: false, today, nights });
  if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: [] });
  if (u === '/api/dreamapp/friends' && req.method === 'GET') return json({ friends: [], asks: [], waiting: [] });
  if (u === '/api/dreamapp/dreamer/n1') {
    return json({ by: 'aaaa', state: dreamer.state, pairId: dreamer.pairId, name: dreamer.name,
                  nights: [nights[0]] });
  }
  if (u === '/api/dreamapp/friends/ask' && req.method === 'POST') {
    asks.push(u);
    dreamer.state = 'asked'; dreamer.pairId = 'p1';
    return json({ state: 'asked', id: 'p1', name: null });
  }
  if (u === '/api/dreamapp/friends/accept' && req.method === 'POST') {
    dreamer.state = 'friends'; dreamer.name = 'mira';
    return json({ ok: true, name: 'mira' });
  }
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
    currentUser: { getIdToken: async function(){ return 'tok'; } },
    getRedirectResult: function(){ return Promise.resolve({}); },
    onAuthStateChanged: function(cb){ setTimeout(function(){ cb(window.__auth.currentUser); }, 0); },
    signOut: function(){}
  };`;

(async () => {
  let chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) { console.log('SKIP — playwright-core not installed'); process.exit(0); }
  let fails = 0;
  const ok = (cond, name) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} — ${name}`); if (!cond) fails++; };

  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    process.env.CHROMIUM_PATH].filter(Boolean).find((p) => fs.existsSync(p));
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://www.gstatic.com/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? FIREBASE_STUB : '/*auth*/' }));
  await page.route(/fonts\.(googleapis|gstatic|cdnfonts)\.com|cdnfonts\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/dreamfeed');
  await page.waitForSelector('.dcard');

  // 1 · the way in
  ok(await page.locator('[data-id="n1"] .whobtn').count() === 1, 'someone else’s card carries "their dreams"');
  ok(await page.locator('[data-id="n2"] .whobtn').count() === 0, 'your own card does not');
  await page.click('[data-id="n1"] .whobtn', { force: true });
  await page.waitForSelector('#scr-dreamer:not([hidden])');

  // 2 · nameless until friends, one button
  ok((await page.locator('#scr-dreamer .h2').textContent()) === 'their dreams', 'the profile is nameless');
  ok(await page.locator('#scr-dreamer [data-ask]').count() === 1, 'and carries the one friend button');
  ok(await page.locator('#scr-dreamer .dcard').count() === 1, 'their visible nights are the body');
  ok(await page.locator('#scr-dreamer .whobtn:visible').count() === 0, 'no way-in loop on its own cards');

  // 3 · asking
  await page.click('#scr-dreamer [data-ask]', { force: true });
  await page.waitForFunction(() => document.querySelector('#scr-dreamer') &&
    /you asked/.test(document.querySelector('#scr-dreamer').textContent));
  ok(asks.length === 1, 'asking POSTs /friends/ask');
  ok(await page.evaluate(() => (localStorage.getItem('dreamapp-hands-waiting') || '').includes('p1')),
    'the pending pair is remembered for the asker’s hands');

  // 4 · they asked you → the yes → holding hands
  dreamer.state = 'asks-you'; dreamer.pairId = 'p1'; dreamer.name = null;
  await page.click('#drBack', { force: true });
  await page.waitForSelector('#scr-feed:not([hidden])');
  await page.click('[data-id="n1"] .whobtn', { force: true });
  await page.waitForSelector('#scr-dreamer [data-dyes]');
  await page.click('#scr-dreamer [data-dyes]', { force: true });
  await page.waitForSelector('#handswrap');
  ok(/holding hands/.test(await page.locator('#handswrap').textContent()), 'the yes raises the holding-hands moment');
  ok(/mira/.test(await page.locator('#handswrap').textContent()), 'with their name on it');
  await page.click('#handswrap', { force: true });
  await page.waitForFunction(() => !document.getElementById('handswrap'));
  ok(true, 'a tap closes it');

  // 5 · friends at last — the name appears
  await page.waitForFunction(() => /mira’s dreams|mira's dreams/.test(
    document.querySelector('#scr-dreamer .h2').textContent));
  ok(true, 'once friends, the profile says whose dreams these are');

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

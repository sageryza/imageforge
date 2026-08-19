#!/usr/bin/env node
// THE ARCHIVE + THE DREAM SCREEN (2026-08-19, Sophie's pass through the live
// app). Drives the real public/dreamapp.html against a stub API and asserts:
//   1. the archive lists ONE ROW PER DREAM — two dreams from one night are two
//      rows ("they should save as separate dreams", not appended),
//   2. opening a dream puts the SHARING AT THE TOP as the three-stop dial
//      (everyone / friends / just me) reflecting the dream's state,
//   3. no per-picture share rows, no "share to today's feed" button, and no
//      "In today's feed until midnight." line anywhere,
//   4. a FLOATING close button rides the dream screen (her long rambling dream
//      had no way out but scrolling) and it goes back to the archive,
//   5. tapping a dial stop POSTs /dreams/:id/audience; friends shows the
//      circles-not-open-yet note,
//   6. the share cap answers a pop-up, not a dead toast,
//   7. the wordmark goes home to the feed from the dream screen too.
//
//   npm install playwright-core --no-save && node scripts/test-dreamapp-archive.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'dreamapp.html'), 'utf8');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const today = '2026-08-19';
const LONG = Array(80).fill('The staircase kept adding steps as I climbed and climbed.').join(' ');

// Two dreams from the SAME night — they must be two rows now.
const MINE = [
  { id: 'm1', title: 'The Long One', night: today, createdAt: today + 'T08:00:00Z', text: LONG,
    publicOn: null, audience: 'private', wordsPublic: true, drawJob: null,
    panels: [{ i: 0, url: '/img/a.png', public: false }], feltCount: 0, mood: null, lucid: false, recurring: false, elems: [] },
  { id: 'm2', title: 'And After', night: today, createdAt: today + 'T07:00:00Z', text: 'and then the second part',
    publicOn: today, audience: 'everyone', wordsPublic: true, drawJob: null,
    panels: [{ i: 0, url: '/img/b.png', public: true }], feltCount: 0, mood: null, lucid: false, recurring: false, elems: [] },
];
const state = { audiences: [], refuseShare: false };

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const json = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(b ? JSON.parse(b) : {})); };
  if (u === '/' || u === '/dreamfeed') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (u.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (u === '/api/witch/firebase-config') return json({ apiKey: 'x' });
  if (u === '/api/dreamapp/feed') return json({ sealed: false, today, dreams: [] });
  if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: MINE });
  if (u === '/api/dreamapp/dreams/m1' && req.method === 'GET') return json(MINE[0]);
  if (u === '/api/dreamapp/dreams/m2' && req.method === 'GET') return json(MINE[1]);
  if (/^\/api\/dreamapp\/dreams\/m\d\/audience$/.test(u)) {
    if (state.refuseShare) return json({ error: 'three dreams a day can go out — tomorrow is another night', limit: 'day' }, 429);
    return body((b) => {
      state.audiences.push({ id: u.split('/')[4], ...b });
      const d = MINE.find((x) => x.id === u.split('/')[4]);
      d.audience = b.audience;
      d.publicOn = b.audience === 'private' ? null : today;
      json({ ok: true, audience: b.audience, publicOn: d.publicOn });
    });
  }
  res.writeHead(404); res.end('{}');
});

const FIREBASE_STUB = `
  window.firebase = { initializeApp: function(){},
    auth: Object.assign(function(){ return window.__auth; }, { GoogleAuthProvider: function(){}, OAuthProvider: function(){} }) };
  window.__auth = {
    currentUser: { getIdToken: async function(){ return 'tok'; } },
    getRedirectResult: function(){ return Promise.resolve({}); },
    onAuthStateChanged: function(cb){ setTimeout(function(){ cb(window.__auth.currentUser); }, 0); },
    signOut: function(){} };`;

(async () => {
  let chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) { console.log('SKIP: playwright-core not installed'); process.exit(0); }
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    process.env.CHROMIUM_PATH].filter(Boolean).find((p) => fs.existsSync(p));
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone 13
  await page.route('**://www.gstatic.com/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? FIREBASE_STUB : '/*x*/' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + port + '/dreamfeed');
  await page.waitForSelector('#navMine');

  let fails = 0;
  const ok = (cond, name) => { console.log((cond ? '  ok' : 'FAIL') + ' — ' + name); if (!cond) fails++; };

  // 1: one row per dream
  await page.click('#navMine');
  await page.waitForSelector('.jitem');
  ok((await page.$$('.jitem')).length === 2, 'two dreams from one night are TWO rows');
  const rows = await page.$$eval('.jitem .ttl', (els) => els.map((e) => e.textContent));
  ok(rows.join('|') === 'The Long One|And After', 'each row is its own dream (' + rows.join(', ') + ')');
  const badges = await page.$$eval('.jitem .badge', (els) => els.map((e) => e.textContent));
  ok(badges.join('|') === 'private|shared', 'each row carries its own shared/private badge');

  // 2: the dream screen — sharing at the top
  await page.click('.jitem[data-id="m1"]');
  await page.waitForSelector('#audDial');
  const layout = await page.evaluate(() => {
    const dial = document.getElementById('audDial').getBoundingClientRect();
    const post = document.querySelector('#scr-dream .post').getBoundingClientRect();
    return { dialAbove: dial.bottom <= post.top,
             stops: [...document.querySelectorAll('#audDial button')].map((b) => b.dataset.s),
             on: document.querySelector('#audDial button.on').dataset.s };
  });
  ok(layout.dialAbove, 'the seen-by dial sits ABOVE the dream, at the top');
  ok(layout.stops.join(',') === 'everyone,friends,private', 'three stops: everyone · friends · just me');
  ok(layout.on === 'private', 'and it reflects the dream\'s state (private)');

  // 3: nothing of the per-piece era
  ok(!(await page.$('.share-item')), 'no per-picture share rows');
  ok(!(await page.$('#shareBtn')), 'no separate share button — the dial IS the share');
  const text = await page.$eval('#scr-dream', (el) => el.textContent);
  ok(!/until midnight/.test(text), 'no "In today\'s feed until midnight." line');

  // 4: the floating close, reachable from anywhere in a long dream
  ok(!(await page.$eval('#closewrap', (el) => el.hidden)), 'a floating close rides the dream screen');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(80);
  const deep = await page.$eval('#closewrap button', (el) => {
    const r = el.getBoundingClientRect();
    return r.top > 0 && r.bottom <= window.innerHeight;
  });
  ok(deep, 'it is still on screen at the bottom of a long dream');
  await page.$eval('#closeDream', (el) => el.click());
  await page.waitForSelector('.jitem');
  ok(!(await page.$eval('#scr-mine', (el) => el.hidden)), 'tapping it goes back to the archive');

  // 5: the dial applies on tap
  await page.click('.jitem[data-id="m1"]');
  await page.waitForSelector('#audDial');
  await page.$eval('#audDial button[data-s="friends"]', (el) => el.click());
  await page.waitForFunction(() => document.querySelector('#audDial button.on') &&
    document.querySelector('#audDial button.on').dataset.s === 'friends');
  ok(state.audiences.length === 1 && state.audiences[0].id === 'm1' && state.audiences[0].audience === 'friends',
    'tapping friends posts the audience');
  ok(/circles aren’t open yet/.test(await page.$eval('#scr-dream', (el) => el.textContent)),
    'and the circles-not-open-yet note shows');

  // 6: the share cap answers a pop-up
  state.refuseShare = true;
  await page.$eval('#audDial button[data-s="everyone"]', (el) => el.click());
  await page.waitForSelector('.howwrap .how');
  ok(/tomorrow is another night/.test(await page.$eval('.howwrap .how', (el) => el.textContent)),
    'the three-a-day share refusal is a pop-up');
  await page.$eval('.howwrap [data-howclose]', (el) => el.click());
  state.refuseShare = false;

  // 7: the wordmark goes home from here too
  await page.$eval('#markBtn', (el) => el.click());
  await page.waitForSelector('#scr-feed:not([hidden])');
  ok(!(await page.$eval('#scr-feed', (el) => el.hidden)), 'the wordmark returns to the feed from the dream screen');
  ok(await page.$eval('#closewrap', (el) => el.hidden), 'and the floating close stands down');

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

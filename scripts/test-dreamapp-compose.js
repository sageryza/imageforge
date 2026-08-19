#!/usr/bin/env node
// THE COMPOSE SHEET (Aug 2026) — stage 1 + stage 2 of the Claude Designs
// canvas (docs/dream-feed-designs/), on the real public/dreamapp.html against
// a stub API. Asserts:
//   1. the confess button opens the sheet on stage 1 (question, mic + upload,
//      lucid/recurring chips, shard, the three things, moods, streak line),
//   2. the streak line reads "☾ night N of your streak · last night: …",
//   3. the shard button seeds the box with one of the four openers,
//   4. "illustrate it" POSTs the dream WITH mood/lucid/elems captured, starts
//      the draw, and lands on stage 2,
//   5. stage 2 shows the working line, the three element slots labeled by her
//      three things, and the draft preview with see more past 150 chars,
//   6. the poll swaps the working line for the drawn panel and stops the
//      slot pulses,
//   7. "seen by" defaults to ✳ everyone and shares words + panels; the sheet
//      closes back onto the feed,
//   8. "◦ just me" shares NOTHING — the dream stays private,
//   9. sharing while the ink is still working sends the words now and stores
//      the share-when-drawn intent; the background pass finishes it.
//
//   npm install playwright-core --no-save && node scripts/test-dreamapp-compose.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'dreamapp.html'), 'utf8');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const today = '2026-08-18';
const LONG = Array(30).fill('The staircase kept adding steps as I climbed and climbed.').join(' ');

const state = { posts: [], draws: [], shares: [], drawn: false };
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(b ? JSON.parse(b) : {})); };
  if (u === '/' || u === '/dreamfeed') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (u.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (u === '/api/witch/firebase-config') return json({ apiKey: 'x' });
  if (u === '/api/dreamapp/feed') return json({ sealed: false, today, nights: [] });
  if (u === '/api/dreamapp/me') return json({ name: 'sophie', sharedToday: false, today, count: 3,
    streak: 12, lastNight: 'The Whale' });
  if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: [] });
  if (u === '/api/dreamapp/dreams' && req.method === 'POST') {
    return body((b) => { state.posts.push(b); json({ id: 'd1', text: b.text, panels: [], drawJob: null }); });
  }
  if (u === '/api/dreamapp/dreams/d1/draw') { state.draws.push(1); return json({ id: 'd1', drawJob: { status: 'drawing' } }); }
  if (u === '/api/dreamapp/dreams/d1' && req.method === 'GET') {
    return json(state.drawn
      ? { id: 'd1', panels: [{ i: 0, url: '/img/p0.png' }, { i: 1, url: '/img/p1.png' }], drawJob: null }
      : { id: 'd1', panels: [], drawJob: { status: 'drawing' } });
  }
  if (u === '/api/dreamapp/nights/d1/share') {
    return body((b) => { state.shares.push(b); json({ ok: true }); });
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
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  await page.route('**://www.gstatic.com/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? FIREBASE_STUB : '/*x*/' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + port + '/dreamfeed');
  await page.waitForSelector('#confessBtn');

  let fails = 0;
  const ok = (cond, name) => { console.log((cond ? '  ok' : 'FAIL') + ' — ' + name); if (!cond) fails++; };
  // The sheet scrolls internally and half its controls sit below the fold, so
  // drive them at the DOM — coordinates are not what's under test here.
  const tap = (sel) => page.$eval(sel, (el) => el.click());
  const put = (sel, v) => page.$eval(sel, (el, val) => { el.value = val; }, v);

  // 1-2: open, stage 1, streak
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  ok(!(await page.$eval('#st1', (el) => el.hidden)), 'the sheet opens on stage 1');
  for (const sel of ['#micBtn', '#fileBtn', '#lucidBtn', '#recurBtn', '#shardBtn', '.three', '.moods']) {
    ok(!!(await page.$(sel)), 'stage 1 carries ' + sel);
  }
  await page.waitForFunction(() => document.getElementById('streakLine').textContent.includes('night 12'));
  ok((await page.$eval('#streakLine', (el) => el.textContent)).includes('last night: the whale'),
    'the streak line reads night 12 · last night: the whale');

  // 3: shard
  await tap('#shardBtn');
  const seeded = await page.$eval('#draft', (el) => el.value);
  ok(seeded.length > 10, 'the shard seeds the box ("' + seeded.trim() + '")');

  // 4: illustrate with the marks captured
  await put('#draft', LONG);
  await tap('#lucidBtn');
  await tap('.moods button[data-mood="strange"]');
  await put('.three .el:nth-child(1)', 'the whale');
  await put('.three .el:nth-child(2)', 'wet asphalt');
  await tap('#illusBtn');
  await page.waitForSelector('#st2:not([hidden])');
  ok(state.posts.length === 1, 'illustrate it saved the dream');
  const p = state.posts[0];
  ok(p.lucid === true && p.mood === 'strange' && p.elems.join(',') === 'the whale,wet asphalt',
    'mood, lucid and the three things were captured at write time');
  ok(state.draws.length === 1, 'the drawing started as a background job');

  // 5: stage 2 furniture
  ok((await page.$eval('#illusBox', (el) => el.textContent)).includes('illustrating it in your ink'),
    'the working line pulses in the blob');
  const labs = await page.$$eval('#slots .slab', (els) => els.map((e) => e.textContent));
  ok(labs.join('|') === 'the whale|wet asphalt|…', 'the element slots carry her three things');
  ok((await page.$eval('#preview button', (el) => el.textContent)) === 'see more',
    'the long draft folds behind see more');
  await tap('#preview button');
  ok((await page.$eval('#preview button', (el) => el.textContent)) === 'see less', 'and unfolds');

  // 9 first: share while the ink is still working
  await tap('#shareBtn2');
  await page.waitForSelector('#sheet[hidden]', { state: 'attached' });
  ok(state.shares.length === 1 && state.shares[0].words === true && state.shares[0].panels.length === 0,
    'sharing mid-ink sends the words now');
  // The intent is `id|audience` since the dial grew its friends stop; a bare
  // id from before that still reads as everyone (finishPendingShare).
  ok(await page.evaluate(() => localStorage.getItem('dreamapp-share-when-drawn')) === 'd1|everyone',
    'and stores the share-when-drawn intent with its audience');
  state.drawn = true;
  await page.waitForFunction(() => !localStorage.getItem('dreamapp-share-when-drawn'), { timeout: 15000 });
  ok(state.shares.length === 2 && state.shares[1].panels.length === 2,
    'the background pass shares the pictures when the ink lands');

  // 6-7: a second dream, drawn before sharing
  state.posts.length = state.draws.length = state.shares.length = 0;
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  await put('#draft', 'The whale is back. It has opinions about my parking now.');
  await tap('#illusBtn');
  await page.waitForSelector('#st2:not([hidden])');
  await page.waitForSelector('#illusBox img', { timeout: 10000 });
  ok(true, 'the poll swaps the working line for the drawn panel');
  ok((await page.$$eval('#slots .sq2 span', (els) => els.length)) === 0, 'the slot pulses stop');
  ok(await page.$eval('.dial button[data-s="everyone"]', (el) => el.classList.contains('on')),
    'seen by defaults to ✳ everyone');
  await tap('#shareBtn2');
  await page.waitForSelector('#sheet[hidden]', { state: 'attached' });
  ok(state.shares.length === 1 && state.shares[0].panels.length === 2,
    'share your dream publishes words + both pictures');
  ok(state.shares[0].audience === 'everyone', 'and says who it is for');

  // 8a: the middle stop — ☾ friends rides the share body
  state.posts.length = state.draws.length = state.shares.length = 0;
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  await put('#draft', 'The stairwell went down further than the building did.');
  await tap('#illusBtn');
  await page.waitForSelector('#st2:not([hidden])');
  // drawn first, so no share-when-drawn intent is left behind to fire into
  // the just-me flow below
  await page.waitForSelector('#illusBox img', { timeout: 10000 });
  await tap('.dial button[data-s="friends"]');
  await tap('#shareBtn2');
  await page.waitForSelector('#sheet[hidden]', { state: 'attached' });
  ok(state.shares.length === 1 && state.shares[0].audience === 'friends',
    '☾ friends shares with audience friends');

  // 8: just me
  state.posts.length = state.draws.length = state.shares.length = 0;
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  await put('#draft', 'I proposed to the concept of Wednesday. It said it needed to think.');
  await tap('#illusBtn');
  await page.waitForSelector('#st2:not([hidden])');
  await tap('.dial button[data-s="private"]');
  await tap('#shareBtn2');
  await page.waitForSelector('#sheet[hidden]', { state: 'attached' });
  ok(state.shares.length === 0, '◦ just me shares nothing — the dream stays private');

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

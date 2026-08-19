#!/usr/bin/env node
// THE COMPOSE SHEET (Aug 2026, reworked 2026-08-19 to Sophie's notes) — on the
// real public/dreamapp.html against a stub API. Asserts:
//   1. the confess button opens the sheet on stage 1, which asks "what did you
//      dream last night?" and wears the wordmark at homepage size,
//   2. the streak line is JUST the streak — no "write fast", no "last night:",
//   3. layout: no glyphs on lucid/recurring, the chips sit RIGHT with lucid
//      rightmost, the shard row sits UNDER "illustrate it" as the title of
//      the three boxes (no separate three-head line), the boxes carry no
//      "…" placeholder,
//   4. "illustrate it" saves the dream WITH mood/lucid/elems — including a
//      mood typed into the fifth, fill-in-your-own box,
//   5. stage 2 polls the drawing in; the seen-by dial has THREE stops
//      (everyone / friends / just me), defaults to everyone, and picking
//      friends shows the who-it-reaches note,
//   6. share posts POST /dreams/:id/audience (no night routes, no
//      localStorage intent), and "just me" posts nothing,
//   7. a draw refused at three-a-night (429, limit:'day') still SAVES the
//      dream: the pop-up says come back tomorrow and the archive opens,
//   8. tapping the sheet's wordmark closes it back to the feed.
//
//   npm install playwright-core --no-save && node scripts/test-dreamapp-compose.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'dreamapp.html'), 'utf8');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAABAAAAAQCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const today = '2026-08-18';

const state = { posts: [], draws: [], audiences: [], drawn: false, refuseDraw: false, nextId: 0 };
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const json = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(b ? JSON.parse(b) : {})); };
  if (u === '/' || u === '/dreamfeed') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (u.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (u === '/api/witch/firebase-config') return json({ apiKey: 'x' });
  if (u === '/api/dreamapp/feed') return json({ sealed: false, today, dreams: [] });
  if (u === '/api/dreamapp/me') return json({ name: 'sophie', sharedToday: false, today, count: 3, streak: 12 });
  if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: [] });
  if (u === '/api/dreamapp/dreams' && req.method === 'POST') {
    return body((b) => { state.posts.push(b); json({ id: 'd1', text: b.text, panels: [], drawJob: null }); });
  }
  if (u === '/api/dreamapp/dreams/d1/draw') {
    if (state.refuseDraw) return json({ error: 'three dreams get their ink each night — come back tomorrow', limit: 'day' }, 429);
    state.draws.push(1);
    return json({ id: 'd1', drawJob: { status: 'drawing' } });
  }
  if (u === '/api/dreamapp/dreams/d1/audience') {
    return body((b) => { state.audiences.push(b); json({ ok: true, audience: b.audience, publicOn: today }); });
  }
  if (u === '/api/dreamapp/dreams/d1' && req.method === 'GET') {
    return json(state.drawn
      ? { id: 'd1', panels: [{ i: 0, url: '/img/p0.png' }], drawJob: null }
      : { id: 'd1', panels: [], drawJob: { status: 'drawing' } });
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
  const LONG = Array(30).fill('The staircase kept adding steps as I climbed and climbed.').join(' ');

  // 1: open, the ask, the wordmark
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  ok(!(await page.$eval('#st1', (el) => el.hidden)), 'the sheet opens on stage 1');
  ok((await page.$eval('.srow .sq', (el) => el.textContent)) === 'what did you dream last night?',
    'it asks "what did you dream last night?"');
  const marks = await page.evaluate(() => ({
    home: parseFloat(getComputedStyle(document.querySelector('#app .mark')).fontSize),
    sheet: parseFloat(getComputedStyle(document.getElementById('smarkBtn')).fontSize),
  }));
  ok(marks.sheet === marks.home, 'the sheet wordmark is homepage-size (' + marks.sheet + 'px)');

  // 2: the streak line, alone
  await page.waitForFunction(() => document.getElementById('streakLine').textContent.includes('night 12'));
  const streak = await page.$eval('#streakLine', (el) => el.textContent);
  ok(!/write fast|fade/.test(streak), 'no "write fast" line (' + JSON.stringify(streak) + ')');
  ok(!/last night:/.test(streak), 'no "last night: …" either');

  // 3: layout
  ok((await page.$eval('#lucidBtn', (el) => el.textContent.trim())) === 'lucid', 'lucid wears no glyph');
  ok((await page.$eval('#recurBtn', (el) => el.textContent.trim())) === 'recurring', 'recurring wears no glyph');
  const chips = await page.evaluate(() => {
    const row = document.querySelector('.chips');
    const l = document.getElementById('lucidBtn').getBoundingClientRect();
    const r = document.getElementById('recurBtn').getBoundingClientRect();
    const rowR = row.getBoundingClientRect();
    return { justify: getComputedStyle(row).justifyContent,
             lucidRight: l.left > r.left, nearRight: rowR.right - l.right < 30 };
  });
  ok(chips.justify === 'flex-end', 'the chips sit to the right');
  ok(chips.lucidRight, 'lucid on the right, recurring to its left');
  const order = await page.evaluate(() => {
    const kids = [...document.getElementById('st1').children].map((el) => el.className || el.id);
    return kids.join('|');
  });
  ok(/illusBtn|blobbtn/.test(order.split('|')[3]) && order.split('|')[4] === 'shardrow' && order.split('|')[5] === 'three',
    'the shard row sits under "illustrate it", titling the three boxes (' + order + ')');
  ok(!(await page.$('.threehead')), 'the separate three-head line is gone');
  ok(await page.$$eval('.three .el', (els) => els.every((t) => !t.placeholder)),
    'the three boxes carry no "…" placeholder');
  ok(!!(await page.$('#moodFree')), 'a fifth, fill-in-your-own feeling exists');

  // 4: illustrate captures everything, incl. the typed mood
  await put('#draft', LONG);
  await tap('#lucidBtn');
  await put('#moodFree', 'floaty');
  await put('.three .el:nth-child(1)', 'the whale');
  await put('.three .el:nth-child(2)', 'wet asphalt');
  await tap('#illusBtn');
  await page.waitForSelector('#st2:not([hidden])');
  ok(state.posts.length === 1, 'illustrate it saved the dream');
  const p = state.posts[0];
  ok(p.lucid === true && p.mood === 'floaty' && p.elems.join(',') === 'the whale,wet asphalt',
    'lucid, her OWN mood word and the three things were captured at write time');
  ok(state.draws.length === 1, 'the drawing started as a background job');

  // 5: stage 2 — the dial
  ok((await page.$eval('#illusBox', (el) => el.textContent)).includes('illustrating it in your ink'),
    'the working line pulses in the blob');
  const stops = await page.$$eval('#sheet .dial button', (els) => els.map((b) => b.dataset.s));
  ok(stops.join(',') === 'everyone,friends,private', 'the dial has three stops: everyone · friends · just me');
  ok(await page.$eval('#sheet .dial button[data-s="everyone"]', (el) => el.classList.contains('on')),
    'seen by defaults to ✳ everyone');
  ok(await page.$eval('#friendNote', (el) => el.hidden), 'the who-it-reaches note stays hidden until friends is picked');
  await tap('#sheet .dial button[data-s="friends"]');
  ok(!(await page.$eval('#friendNote', (el) => el.hidden)), 'picking friends says who it reaches');
  await tap('#sheet .dial button[data-s="everyone"]');

  // the drawing lands
  state.drawn = true;
  await page.waitForSelector('#illusBox img', { timeout: 10000 });
  ok(true, 'the poll swaps the working line for the drawn picture');

  // 6: share = one audience POST, nothing else
  await tap('#shareBtn2');
  await page.waitForSelector('#sheet[hidden]', { state: 'attached' });
  ok(state.audiences.length === 1 && state.audiences[0].audience === 'everyone',
    'share posts the audience (everyone)');
  ok(await page.evaluate(() => !localStorage.getItem('dreamapp-share-when-drawn')),
    'no share-when-drawn intent is stored — the server finishes a mid-ink share');

  // just me
  state.posts.length = state.draws.length = state.audiences.length = 0;
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  await put('#draft', 'I proposed to the concept of Wednesday. It said it needed to think.');
  await tap('#illusBtn');
  await page.waitForSelector('#st2:not([hidden])');
  await tap('#sheet .dial button[data-s="private"]');
  await tap('#shareBtn2');
  await page.waitForSelector('#sheet[hidden]', { state: 'attached' });
  ok(state.audiences.length === 0, '◦ just me posts nothing — the dream is already private');

  // 7: the third-of-the-night refusal
  state.posts.length = state.draws.length = 0;
  state.refuseDraw = true;
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  await put('#draft', 'The fourth dream of the night, refused its ink.');
  await tap('#illusBtn');
  await page.waitForSelector('.howwrap .how');
  const popup = await page.$eval('.howwrap .how', (el) => el.textContent);
  ok(/come back tomorrow/.test(popup), 'the pop-up says come back tomorrow');
  ok(/saved in your archive/.test(popup), 'and that the dream is saved');
  ok(state.posts.length === 1, 'the dream WAS saved before the refusal');
  ok(await page.$eval('#sheet', (el) => el.hidden), 'the sheet closed');
  ok(!(await page.$eval('#scr-mine', (el) => el.hidden)), 'and the archive opened to show it');
  await tap('.howwrap [data-howclose]');

  // 8: the sheet wordmark goes home
  state.refuseDraw = false;
  await page.click('#navMine', { force: true });   // to the feed first
  await page.waitForSelector('#scr-feed:not([hidden])');
  await page.click('#confessBtn', { force: true });
  await page.waitForSelector('#sheet:not([hidden])');
  await page.$eval('#smarkBtn', (el) => el.click());
  await page.waitForSelector('#sheet[hidden]', { state: 'attached' });
  ok(!(await page.$eval('#scr-feed', (el) => el.hidden)), 'tapping the sheet wordmark lands on the feed');

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

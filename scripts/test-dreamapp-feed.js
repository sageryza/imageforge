#!/usr/bin/env node
// THE MELT FEED (Aug 2026) — the 2a artboard, one DREAM per card since
// 2026-08-19 (Sophie: "they should save as separate dreams"). Drives the REAL
// public/dreamapp.html against a stub API + stubbed Firebase auth and asserts
// the design facts that make it hers:
//   1. the header wordmark asks for Baveuse, and tapping it goes home to the
//      feed from any view (Sophie: "it should take me back to the feed"),
//   2. cards ALTERNATE dark and the illustration blob alternates sides,
//   3. your own card carries no heart/comment row, and the little ✳ byline
//      stars are GONE (Sophie: "I would get rid of it"),
//   4. the heart is a real outlined SVG in the pale mauve pink, big enough to
//      see — tapping it posts /felt, fills it, and updates the count,
//   5. the comment icon is a BUBBLE (not a pencil ✎), the box says "leave a
//      comment…" (not "whisper back…"), the empty state says "no comments
//      yet.", the thread border is SOLID not dashed — and posting on Enter
//      updates the count,
//   6. "see more" appears only where the six-line clamp really cut,
//   7. tonight's run ends on nothing; older days get the divider,
//   8. the confess button says "it's coming back to me…" with "add last
//      night's dream" as an upright line UNDER it, and leaves with the feed,
//   9. tapping the blob opens the lightbox, locks the page, restores the
//      exact scroll on close (house overlay rule) — no feature button,
//  10. nothing of the old design: no fuchsia, no bottom nav, no page errors.
//
//   npm install playwright-core --no-save && node scripts/test-dreamapp-feed.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'dreamapp.html'), 'utf8');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const today = '2026-08-18';
const LONG = Array(40).fill('The staircase kept adding steps as I climbed.').join(' ');
// One card per DREAM: words ride the entry itself, one cover picture.
const dreams = [
  { id: 'n1', title: 'The Xylophone Teeth', mine: false, publicOn: today, createdAt: today + 'T08:00:00Z',
    words: 'My teeth were a xylophone. Someone played them beautifully. I was furious.',
    panels: [{ i: 0, url: '/img/1.png' }], cover: { i: 0, url: '/img/1.png' },
    feltCount: 41, felt: false, commentCount: 6 },
  { id: 'n2', title: 'The Whale Again', mine: true, publicOn: today, createdAt: today + 'T07:00:00Z',
    words: 'The whale is back. It has opinions about my parking now.',
    panels: [{ i: 0, url: '/img/2.png' }], cover: { i: 0, url: '/img/2.png' },
    feltCount: 17, felt: false, commentCount: 2 },
  { id: 'n3', title: 'The Same Word', mine: false, publicOn: today, createdAt: today + 'T06:00:00Z',
    words: LONG, panels: [], cover: null, feltCount: 9, felt: true, commentCount: 1 },
  { id: 'n4', title: 'The Peephole Moon', mine: false, publicOn: '2026-08-17', createdAt: '2026-08-17T06:00:00Z',
    words: 'The moon was a peephole. Someone knocked.',
    panels: [{ i: 0, url: '/img/4.png' }], cover: { i: 0, url: '/img/4.png' },
    feltCount: 33, felt: false, commentCount: 8 },
  { id: 'n5', title: 'Weather Chess', mine: false, publicOn: '2026-08-16', createdAt: '2026-08-16T06:00:00Z',
    words: 'Her bishop was a light drizzle.',
    panels: [{ i: 0, url: '/img/5.png' }], cover: { i: 0, url: '/img/5.png' },
    feltCount: 12, felt: false, commentCount: 3 },
];

const calls = [];
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  calls.push(req.method + ' ' + u);
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u === '/' || u === '/dreamfeed') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (u.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (u === '/api/witch/firebase-config') return json({ apiKey: 'x', authDomain: 'x', projectId: 'x' });
  if (u === '/api/dreamapp/feed') return json({ sealed: false, today, dreams });
  if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: [] });
  if (/^\/api\/dreamapp\/dreams\/n\d+\/felt$/.test(u)) return json({ felt: true, feltCount: 42 });
  if (/^\/api\/dreamapp\/dreams\/n\d+\/comments$/.test(u)) {
    if (req.method === 'POST') return json({ comment: { name: 'you', text: 'a reply', at: new Date().toISOString() }, commentCount: 7 });
    if (u.includes('/n4/')) return json({ comments: [] });   // the empty-state card
    return json({ comments: [{ name: 'mira', text: 'the ink got this exactly right', at: today + 'T09:00:00Z' }] });
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
  catch (e) { console.log('SKIP: playwright-core not installed (npm install playwright-core --no-save)'); process.exit(0); }
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    process.env.CHROMIUM_PATH].filter(Boolean).find((p) => fs.existsSync(p));
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  await page.route('**://www.gstatic.com/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? FIREBASE_STUB : '/*auth*/' }));
  await page.route(/fonts\.(googleapis|gstatic|cdnfonts)\.com|cdnfonts\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + port + '/dreamfeed');
  await page.waitForSelector('.dcard', { timeout: 8000 });

  let fails = 0;
  const ok = (cond, name) => { console.log((cond ? '  ok' : 'FAIL') + ' — ' + name); if (!cond) fails++; };

  // 1. header — and the wordmark is the way home
  const mark = await page.$eval('#app .mark', (el) => getComputedStyle(el).fontFamily);
  ok(/Baveuse/i.test(mark), 'wordmark asks for Baveuse');
  ok((await page.$$('.fnow')).length === 0, 'no "tonight" in the header');
  ok((await page.$eval('#navMine', (el) => el.textContent)) === 'archive', 'the other view is the archive');
  await page.click('#navMine');
  ok(await page.$eval('#scr-feed', (el) => el.hidden), 'the archive replaces the feed');
  await page.click('#markBtn');
  await page.waitForSelector('.dcard');
  ok(!(await page.$eval('#scr-feed', (el) => el.hidden)), 'tapping the wordmark returns to the feed');

  // 2. alternation
  const cards = await page.$$eval('.dcard', (els) => els.map((el) => ({
    id: el.dataset.id, dark: el.classList.contains('dark'),
    rev: !!el.querySelector('.drow.rev'), img: !!el.querySelector('.blob'),
  })));
  ok(cards.length === 5, 'five dream cards drawn');
  ok(cards.map((c) => c.dark).join() === 'false,true,false,true,false', 'cards alternate dark');
  ok(cards.filter((c) => c.img).map((c) => c.rev).join() === 'false,true,false,true', 'the blob alternates sides');

  // 3. own card, and no byline stars anywhere
  ok(await page.$eval('[data-id="n2"]', (el) => !el.querySelector('.dmeta')), 'own card has no heart/comment row');
  ok((await page.$$('.dby')).length === 0, 'the little ✳ byline stars are gone');

  // 4. the heart: a real outlined SVG, mauve, big enough to see
  const heart = await page.$eval('[data-id="n1"] .likebtn', (el) => {
    const svg = el.querySelector('svg.i');
    const c = getComputedStyle(el);
    const r = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
    return { hasSvg: !!svg, w: r.width, h: r.height, color: c.color,
             fill: svg ? getComputedStyle(svg).fill : '' };
  });
  ok(heart.hasSvg, 'the heart is an SVG icon, not a text glyph');
  ok(heart.w >= 15 && heart.h >= 15, 'and it is big enough to see (' + Math.round(heart.w) + 'px)');
  ok(heart.color === 'rgb(196, 147, 164)', 'in the pale mauve pink (' + heart.color + ')');
  ok(heart.fill === 'none', 'outlined while un-felt');
  await page.click('[data-id="n1"] .likebtn', { force: true });  // the cards never stop breathing
  await page.waitForFunction(() => document.querySelector('[data-id="n1"] .likebtn').textContent.includes('42'));
  ok(true, 'heart posts /felt and repaints the count 42');
  ok(calls.some((c) => c === 'POST /api/dreamapp/dreams/n1/felt'), 'felt call reached the API');
  ok(await page.$eval('[data-id="n1"] .likebtn svg.i', (el) => getComputedStyle(el).fill !== 'none'),
    'a felt heart fills in');

  // 5. comments: bubble icon, plain copy, solid borders
  const bubblePath = await page.$eval('[data-id="n1"] .cmtbtn', (el) => {
    const svg = el.querySelector('svg.i');
    return svg ? svg.querySelector('path').getAttribute('d') : '';
  });
  ok(/^M7\.9 20A9 9/.test(bubblePath), 'the comment icon is the message bubble, not a pencil');
  await page.click('[data-id="n1"] .cmtbtn', { force: true });
  await page.waitForSelector('[data-id="n1"] .whisper');
  ok((await page.$eval('[data-id="n1"] .whisper', (el) => el.placeholder)) === 'leave a comment…',
    'the box says "leave a comment…"');
  const threadLook = await page.$eval('[data-id="n1"] .dthread', (el) => {
    const c = getComputedStyle(el);
    const box = getComputedStyle(el.querySelector('.whisper'));
    return { top: c.borderTopStyle, box: box.borderTopStyle };
  });
  ok(threadLook.top === 'solid' && threadLook.box === 'solid', 'no dashed lines in the thread');
  ok((await page.$eval('[data-id="n1"] .crow .who', (el) => el.textContent)) === 'mira', 'comment rows show who wrote');
  await page.fill('[data-id="n1"] .whisper', 'a reply');
  await page.press('[data-id="n1"] .whisper', 'Enter');
  await page.waitForFunction(() => document.querySelector('[data-id="n1"] .cmtbtn').textContent.includes('7'));
  ok(true, 'the comment box posts on Enter and the count updates');

  // the empty state
  await page.click('[data-id="n4"] .cmtbtn', { force: true });
  await page.waitForSelector('[data-id="n4"] .whisper');
  ok((await page.$eval('[data-id="n4"] [data-empty] .said', (el) => el.textContent)) === 'no comments yet.',
    'an empty thread says "no comments yet."');

  // 6. clamp
  const mores = await page.$$eval('.dcard', (els) => els.map((el) => {
    const m = el.querySelector('.dmore'); return { id: el.dataset.id, more: !!(m && !m.hidden) };
  }));
  ok(mores.every((m) => m.more === (m.id === 'n3')), '"see more" only where the clamp cut (the long dream)');

  // 7. structure: dividers, no sign-off
  const seq = await page.$eval('#scr-feed', (el) =>
    [...el.children].map((c) => c.classList.contains('dcard') ? 'card' : c.classList.contains('fend') ? 'end' : c.classList.contains('fdiv') ? 'div' : '?').join(','));
  ok(seq === 'card,card,card,div,card,div,card', 'tonight, then divided days, with no sign-off line');
  const divs = await page.$$eval('.fdiv .t', (els) => els.map((e) => e.textContent));
  ok(divs[0] === 'last night · monday, august 17', 'yesterday reads "last night · …"');
  ok(divs[1] === 'sunday, august 16', 'older days read as plain lowercase dates');

  // 8. the confess button: the poetic line ON it, the plain ask under it,
  // upright (Sophie's final call, 2026-08-19)
  ok(await page.$eval('#confessBtn', (el) => /coming back to me…/.test(el.textContent)),
    'the button says "it\'s coming back to me…"');
  const sub = await page.$eval('#confess .csub', (el) => {
    const r = el.getBoundingClientRect();
    const b = document.getElementById('confessBtn').getBoundingClientRect();
    return { text: el.textContent, below: r.top >= b.bottom - 1,
             style: getComputedStyle(el).fontStyle };
  });
  ok(/add last night’s dream/.test(sub.text), 'with "add last night\'s dream" as its own line');
  ok(sub.below, 'sitting UNDER the button');
  ok(sub.style === 'normal', 'and not italic (' + sub.style + ')');
  await page.click('#navMine');
  ok(await page.$eval('#confess', (el) => el.hidden), 'leaving the feed takes the button with it');
  ok((await page.$eval('#navMine', (el) => el.textContent)) === 'feed', 'the header word swaps to the way back');
  await page.click('#navMine');
  await page.waitForSelector('.dcard');
  // renderFeed() is async: wait for the round-trip's re-render to LAND (the
  // fresh cards have their threads closed again) before measuring scroll —
  // a re-render arriving mid-lightbox shortens the page under the restore.
  await page.waitForSelector('[data-id="n1"] .dthread[hidden]', { state: 'attached' });

  // 9. lightbox contract
  // Scroll, read, and tap in one evaluate — a playwright click would re-scroll
  // the forever-wobbling card and move the position the close must restore.
  const yBefore = await page.evaluate(() => {
    document.querySelector('[data-id="n4"]').scrollIntoView({ block: 'center' });
    const y = window.scrollY;
    document.querySelector('[data-id="n4"] .blob').click();
    return y;
  });
  await page.waitForSelector('#lb:not([hidden])');
  ok((await page.$eval('body', (el) => el.style.overflow)) === 'hidden', 'the lightbox locks the page behind it');
  ok(!(await page.$('#lbfeat')), 'no feature button — one picture per dream');
  await page.click('.lb', { position: { x: 10, y: 10 }, force: true });
  const after = await page.evaluate(() => ({ hidden: document.getElementById('lb').hidden, y: window.scrollY }));
  ok(after.hidden, 'tapping beside the picture closes the lightbox');
  ok(after.y === yBefore, 'closing restores the exact scroll position (' + after.y + ' = ' + yBefore + ')');

  // 10. nothing of the old design
  ok(!/ff2fa0/i.test(PAGE), 'no fuchsia anywhere');
  ok(!(await page.$('nav')), 'no bottom nav');
  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');

  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

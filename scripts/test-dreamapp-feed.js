#!/usr/bin/env node
// THE MELT FEED (Aug 2026) — the 2a artboard from the Claude Designs canvas
// (docs/dream-feed-designs/), ported onto the live shared dream feed. Drives
// the REAL public/dreamapp.html against a stub API + stubbed Firebase auth
// and asserts the design facts that make it "exact":
//   1. the header wordmark asks for Baveuse; "tonight" sits right of it,
//   2. cards ALTERNATE dark (her alternateDark tweak) and the illustration
//      blob alternates sides among the cards that have one,
//   3. your own card carries no heart/comment row (unattributed feed: the
//      byline slot holds only the audience glyph),
//   4. the heart is a courier span — tapping it posts /felt and flips ♡→♥,
//   5. ✎ opens the inline thread; the whisper box posts on Enter and the
//      count updates,
//   6. "see more" appears only where the six-line clamp really cut,
//   7. tonight's run ends on the end-of-night note; older days get the
//      dashed divider with the artboard's label shape,
//   8. the confess button shows on the feed and leaves with it,
//   9. tapping the blob opens the lightbox, locks the page, restores the
//      exact scroll on close (house overlay rule),
//  10. nothing of the old design survives: no fuchsia, no bottom nav.
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
const nights = [
  { id: 'n1', title: 'The Xylophone Teeth', mine: false, publicOn: today, createdAt: today + 'T08:00:00Z',
    dreams: [{ id: 'n1', title: 'The Xylophone Teeth', words: 'My teeth were a xylophone. Someone played them beautifully. I was furious.' }],
    panels: [{ dreamId: 'n1', i: 0, url: '/img/1.png' }, { dreamId: 'n1', i: 1, url: '/img/1b.png' }],
    cover: { dreamId: 'n1', i: 0, url: '/img/1.png' }, feltCount: 41, felt: false, commentCount: 6 },
  { id: 'n2', title: 'The Whale Again', mine: true, publicOn: today, createdAt: today + 'T07:00:00Z',
    dreams: [{ id: 'n2', title: 'The Whale Again', words: 'The whale is back. It has opinions about my parking now.' }],
    panels: [{ dreamId: 'n2', i: 0, url: '/img/2.png' }], cover: { dreamId: 'n2', i: 0, url: '/img/2.png' },
    feltCount: 17, felt: false, commentCount: 2 },
  { id: 'n3', title: 'The Same Word', mine: false, publicOn: today, createdAt: today + 'T06:00:00Z',
    dreams: [{ id: 'n3', title: 'The Same Word', words: LONG }], panels: [], cover: null,
    feltCount: 9, felt: true, commentCount: 1 },
  { id: 'n4', title: 'The Peephole Moon', mine: false, publicOn: '2026-08-17', createdAt: '2026-08-17T06:00:00Z',
    dreams: [{ id: 'n4', title: 'The Peephole Moon', words: 'The moon was a peephole. Someone knocked.' }],
    panels: [{ dreamId: 'n4', i: 0, url: '/img/4.png' }], cover: { dreamId: 'n4', i: 0, url: '/img/4.png' },
    feltCount: 33, felt: false, commentCount: 8 },
  { id: 'n5', title: 'Weather Chess', mine: false, publicOn: '2026-08-16', createdAt: '2026-08-16T06:00:00Z',
    dreams: [{ id: 'n5', title: 'Weather Chess', words: 'Her bishop was a light drizzle.' }],
    panels: [{ dreamId: 'n5', i: 0, url: '/img/5.png' }], cover: { dreamId: 'n5', i: 0, url: '/img/5.png' },
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
  if (u === '/api/dreamapp/feed') return json({ sealed: false, today, nights });
  if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: [] });
  if (/^\/api\/dreamapp\/dreams\/n\d+\/felt$/.test(u)) return json({ felt: true, feltCount: 42 });
  if (/^\/api\/dreamapp\/dreams\/n\d+\/comments$/.test(u)) {
    if (req.method === 'POST') return json({ comment: { name: 'you', text: 'a whisper', at: new Date().toISOString() }, commentCount: 7 });
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

  // 1. header
  const mark = await page.$eval('#app .mark', (el) => getComputedStyle(el).fontFamily);
  ok(/Baveuse/i.test(mark), 'wordmark asks for Baveuse');
  ok(await page.$eval('.fnow', (el) => el.textContent) === 'tonight', '"tonight" sits in the header');

  // 2. alternation
  const cards = await page.$$eval('.dcard', (els) => els.map((el) => ({
    id: el.dataset.id, dark: el.classList.contains('dark'),
    rev: !!el.querySelector('.drow.rev'), img: !!el.querySelector('.blob'),
  })));
  ok(cards.length === 5, 'five night cards drawn');
  ok(cards.map((c) => c.dark).join() === 'false,true,false,true,false', 'cards alternate dark');
  ok(cards.filter((c) => c.img).map((c) => c.rev).join() === 'false,true,false,true', 'the blob alternates sides');

  // 3. own card, unattributed byline
  ok(await page.$eval('[data-id="n2"]', (el) => !el.querySelector('.dmeta')), 'own card has no heart/comment row');
  const bys = await page.$$eval('.dby', (els) => els.map((e) => e.textContent));
  ok(bys.every((b) => b === '✳'), 'byline slots hold only the audience glyph');

  // 4. heart
  await page.click('[data-id="n1"] .likebtn', { force: true });  // the cards never stop breathing
  await page.waitForFunction(() => document.querySelector('[data-id="n1"] .likebtn').textContent.includes('42'));
  ok(true, 'heart posts /felt and repaints ♥ 42');
  ok(calls.some((c) => c === 'POST /api/dreamapp/dreams/n1/felt'), 'felt call reached the API');

  // 5. comments
  await page.click('[data-id="n1"] .cmtbtn', { force: true });
  await page.waitForSelector('[data-id="n1"] .whisper');
  ok((await page.$eval('[data-id="n1"] .crow .who', (el) => el.textContent)) === 'mira', 'comment rows show who whispered');
  await page.fill('[data-id="n1"] .whisper', 'a whisper');
  await page.press('[data-id="n1"] .whisper', 'Enter');
  await page.waitForFunction(() => document.querySelector('[data-id="n1"] .cmtbtn').textContent.includes('7'));
  ok(true, 'the whisper box posts on Enter and the ✎ count updates');

  // 6. clamp
  const mores = await page.$$eval('.dcard', (els) => els.map((el) => {
    const m = el.querySelector('.dmore'); return { id: el.dataset.id, more: !!(m && !m.hidden) };
  }));
  ok(mores.every((m) => m.more === (m.id === 'n3')), '"see more" only where the clamp cut (the long dream)');

  // 7. structure: end note + dividers
  const seq = await page.$eval('#scr-feed', (el) =>
    [...el.children].map((c) => c.classList.contains('dcard') ? 'card' : c.classList.contains('fend') ? 'end' : c.classList.contains('fdiv') ? 'div' : '?').join(','));
  ok(seq === 'card,card,card,end,div,card,div,card', 'tonight, the end-of-night note, then divided days');
  const divs = await page.$$eval('.fdiv .t', (els) => els.map((e) => e.textContent));
  ok(divs[0] === 'last night · monday, august 17', 'yesterday reads "last night · …"');
  ok(divs[1] === 'sunday, august 16', 'older days read as plain lowercase dates');

  // 8. confess button
  ok(await page.$eval('#confessBtn', (el) => el.textContent.indexOf('coming back to me') !== -1), 'the confess button carries the artboard copy');
  await page.click('#navMine');
  ok(await page.$eval('#confess', (el) => el.hidden), 'leaving the feed takes the button with it');
  ok((await page.$eval('#navMine', (el) => el.textContent)) === 'feed', 'the header word swaps to the way back');
  await page.click('#navMine');
  await page.waitForSelector('.dcard');

  // 9. lightbox contract — click a card already in view, so the scroll the
  // close must restore is the one the tap really happened at
  const yBefore = await page.evaluate(() => {
    document.querySelector('[data-id="n4"]').scrollIntoView({ block: 'center' });
    return window.scrollY;
  });
  await page.click('[data-id="n4"] .blob', { force: true });
  await page.waitForSelector('#lb:not([hidden])');
  ok((await page.$eval('body', (el) => el.style.overflow)) === 'hidden', 'the lightbox locks the page behind it');
  ok(await page.$eval('#lbfeat', (el) => el.hidden), 'feature-this-one stays hidden on a night that is not yours');
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

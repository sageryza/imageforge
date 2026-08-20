#!/usr/bin/env node
// THE DESK — the dream feed's masonry on a real screen (Sophie, Aug 2026:
// "the desktop version of the dream feed. It's a fun masonry layout, and I
// want it to look good on a desktop. But not on the mobile site. The mobile
// site will basically look as it does.")
//
// Drives the REAL public/dreamapp.html against a stub API and asserts:
//   1. wide: the cards are laid into real columns (.mrow / .mcol), balanced,
//      the day's divider rides INSIDE a column like anything else, and the
//      cards genuinely stagger — a grid is the failure this is guarding,
//      and it is what the first port shipped (Sophie: "you didn't even do
//      the masonry layout"): the phone's rule cuts each dream's words to its
//      picture's height, which made every card one picture tall,
//   2. wide: the cards are not all the same object — several melt shapes,
//      several picture proportions, several tilts,
//   3. wide: the header is her artboard's — a big wordmark, the "everyone's
//      still dreaming" line, the ask as a button up there, and the phone's
//      fixed bottom bar stood down,
//   4. NARROW IS UNTOUCHED: no .mrow, no .mcol, every card a direct child of
//      #scr-feed in source order, the bottom bar back and the header line and
//      top button gone,
//   5. opening a dream on the desk does not move the cards in the OTHER
//      columns — the whole reason the columns are built in JS rather than
//      with `column-count`, which re-balances the entire feed,
//   6. crossing a width boundary re-lays it out, and going back to phone
//      width restores exactly the flat DOM of check 4.
//
//   npm install playwright --no-save && node scripts/test-dream-desktop.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const words = (n) => Array.from({ length: n }, (_, i) => `line ${i} of a dream long enough to wrap.`).join(' ');

// Twelve dreams over two nights, some with a picture and some without, so the
// columns have real variety to balance and there is a divider to draw.
const TODAY = '2026-08-20';
const dreams = [];
for (let i = 0; i < 12; i++) {
  const pic = i % 3 !== 2;
  dreams.push({
    id: 'd' + i, title: 'Dream number ' + i, mine: false,
    publicOn: i < 8 ? TODAY : '2026-08-19',
    createdAt: TODAY + 'T0' + (9 - (i % 9)) + ':00:00Z',
    words: i % 4 === 2 ? 'a bus. it kept going.' : words(6 + (i % 9) * 4),
    panels: pic ? [{ i: 0, url: '/px.png' }] : [],
    cover: pic ? { i: 0, url: '/px.png' } : null,
    feltCount: i, felt: false, commentCount: i % 3,
  });
}

const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR42mNk+M9QzzCKRxUAAP//AwAV4gL9AAAAAElFTkSuQmCC',
  'base64');

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const send = (code, type, b) => { res.writeHead(code, { 'content-type': type }); res.end(b); };
  if (u === '/px.png') return send(200, 'image/png', PX);
  if (u === '/api/witch/firebase-config') return send(200, 'application/json', JSON.stringify({ apiKey: 'stub', authDomain: 'stub', projectId: 'stub' }));
  if (u === '/api/dreamapp/feed') return send(200, 'application/json', JSON.stringify({ sealed: false, today: TODAY, dreams }));
  if (u === '/api/dreamapp/dreams') return send(200, 'application/json', JSON.stringify({ dreams: [] }));
  if (u === '/dreamfeed') return send(200, 'text/html', fs.readFileSync(path.join(PUB, 'dreamapp.html')));
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

// what the feed's DOM actually is, one line per top-level child
const shape = (page) => page.$eval('#scr-feed', (el) => [].map.call(el.children, (c) => {
  if (c.classList.contains('mrow')) {
    return 'mrow[' + [].map.call(c.children, (col) =>
      [].map.call(col.children, (card) => card.dataset.id).join(',')).join(' | ') + ']';
  }
  return (c.className || c.tagName) + (c.dataset.id ? ':' + c.dataset.id : '');
}));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const found = (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : [])
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).filter((p) => fs.existsSync(p));
  const browser = await chromium.launch(found.length ? { executablePath: found[0] } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.route(/gstatic\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_FIREBASE }));
  await page.route(/fonts\.(googleapis|gstatic|cdnfonts)\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${base}/dreamfeed`);
  await page.waitForSelector('.dcard');
  await page.waitForTimeout(400);
  // the cards breathe and wobble forever; every one of those is a transform,
  // an opacity or a border-radius, so killing them changes no layout box
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none !important;transition:none !important}' });

  // ── 1. real columns, balanced, with the divider between two mats ──
  const rows = await page.$$('#scr-feed > .mrow');
  check('the desk lays the feed out as ONE flow of columns', rows.length === 1, rows.length + ' .mrow');
  const cols = await page.$$eval('#scr-feed .mcol',
    (els) => els.map((e) => e.querySelectorAll('.dcard').length));
  check('four columns at 1500px', cols.length === 4, JSON.stringify(cols));
  check('every card landed in one of them',
    cols.reduce((a, b) => a + b, 0) === 12, JSON.stringify(cols));
  const heights = await page.$$eval('#scr-feed .mcol',
    (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  const spread = Math.max(...heights) - Math.min(...heights);
  check('and the columns come out roughly level (shortest-first placement)',
    spread < Math.max(...heights) * 0.6, `heights ${heights.join('/')}, spread ${spread}`);

  // the divider is placed like a card, in whichever column was shortest —
  // a full-width band would force every column to end level there
  const div = await page.$eval('#scr-feed .fdiv', (e) => ({
    inCol: !!e.parentElement.classList.contains('mcol'),
    w: Math.round(e.getBoundingClientRect().width),
  }));
  const feedW = await page.$eval('#scr-feed', (e) => Math.round(e.getBoundingClientRect().width));
  check('the day divider rides inside a column, not across the desk',
    div.inCol && div.w < feedW / 2, JSON.stringify(div) + ' of ' + feedW);

  // ── THE MASONRY ITSELF: cards of real, differing heights, staggered ──
  const geo = await page.$$eval('#scr-feed .dcard', (els) => els.map((e) => ({
    top: Math.round(e.offsetTop), h: Math.round(e.offsetHeight),
  })));
  const hs = geo.map((g) => g.h);
  check('the cards are genuinely different heights',
    Math.max(...hs) > Math.min(...hs) * 1.8,
    `${Math.min(...hs)}..${Math.max(...hs)}px`);
  // A GRID of 12 in 4 columns lands on exactly 3 shared tops — one per row.
  // Masonry can only share the FIRST row's top (every column starts level),
  // so anything near the card count is staggered; the check is set well clear
  // of the grid it is ruling out rather than demanding a perfect stagger, two
  // cards happening to land level being ordinary.
  const tops = new Set(geo.map((g) => g.top));
  const gridTops = Math.ceil(geo.length / cols.length);
  check('and they stagger rather than lining up in rows',
    tops.size >= gridTops * 2, `${tops.size} distinct tops for ${geo.length} cards (a grid would be ${gridTops})`);
  // the phone's picture-height cut is off here — that cut is what flattened
  // every card into a row in the first port
  const clamps = await page.$$eval('#scr-feed .dcard .dbody',
    (els) => [...new Set(els.map((e) => e.style.getPropertyValue('--lines')))]);
  check('no card has its words cut to its picture', clamps.every((c) => c === '12'),
    JSON.stringify(clamps));

  // ── 2. no two cards in a column are the same object ──
  const looks = await page.$$eval('#scr-feed .dcard', (els) => {
    const cs = els.map((e) => getComputedStyle(e));
    return {
      radii: [...new Set(cs.map((c) => c.borderRadius))].length,
      tilts: [...new Set(els.map((e) => e.style.getPropertyValue('--r')))].length,
      ratios: [...new Set([].map.call(document.querySelectorAll('#scr-feed .blob'),
        (b) => getComputedStyle(b).aspectRatio))].length,
    };
  });
  check('several melt shapes across the feed', looks.radii >= 4, looks.radii + ' distinct radii');
  check('several tilts', looks.tilts >= 4, looks.tilts + ' distinct --r');
  check('several picture proportions', looks.ratios >= 3, looks.ratios + ' distinct aspect ratios');

  // ── 3. her artboard's header ──
  const head = await page.evaluate(() => ({
    mark: parseFloat(getComputedStyle(document.querySelector('#app .mark')).fontSize),
    now: (document.getElementById('feedNow').textContent || '').trim(),
    nowShown: getComputedStyle(document.getElementById('feedNow')).display !== 'none',
    topBtn: getComputedStyle(document.getElementById('confessTop')).display !== 'none',
    bottomBar: getComputedStyle(document.getElementById('confess')).display !== 'none',
  }));
  check('the wordmark is the artboard\'s size', head.mark >= 48, head.mark + 'px');
  check('the desk line reads under it', head.nowShown && /still dreaming/.test(head.now), head.now);
  check('the ask is a button in the header', head.topBtn);
  check('and the phone\'s fixed bottom bar stands down', !head.bottomBar);

  // ── 5. opening a dream moves only its own column ──
  const where = () => page.$$eval('#scr-feed .dcard', (els) => {
    const o = {};
    els.forEach((e) => { o[e.dataset.id] = e.offsetLeft + ':' + e.offsetTop; });
    return o;
  });
  const openId = await page.$eval('#scr-feed .mcol:nth-child(2) .dcard:first-child',
    (e) => e.dataset.id);
  // its own column grows; nothing else may
  const ownCol = await page.$$eval(`#scr-feed .dcard[data-id="${openId}"]`,
    (els) => [].map.call(els[0].parentElement.children, (c) => c.dataset.id));
  const before = await where();
  await page.click(`.dcard[data-id="${openId}"] .dmore`);
  await page.waitForTimeout(200);
  const after = await where();
  const moved = Object.keys(before).filter((k) => before[k] !== after[k]);
  const strays = moved.filter((k) => ownCol.indexOf(k) < 0);
  check('opening a dream leaves every other column exactly where it was',
    strays.length === 0, strays.length ? 'moved: ' + strays.join(',') : moved.length + ' moved, all in its own column');
  check('and the dream really did open',
    await page.$eval(`.dcard[data-id="${openId}"]`, (e) => e.classList.contains('open')));
  await page.click('#closeDream');
  await page.waitForTimeout(150);

  // ── 6 + 4. back to the phone: the flat DOM, unchanged ──
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const flat = await shape(page);
  check('the phone has no columns at all',
    flat.every((l) => l.indexOf('mrow') < 0), flat.slice(0, 3).join(' / '));
  check('every card is a direct child of the feed, in order',
    flat.filter((l) => l.indexOf('dcard') === 0).length === 12
    && flat.filter((l) => l.indexOf('dcard') === 0)[0].endsWith(':d0'),
    flat.length + ' children');
  const phoneHead = await page.evaluate(() => ({
    now: getComputedStyle(document.getElementById('feedNow')).display,
    topBtn: getComputedStyle(document.getElementById('confessTop')).display,
    bottomBar: getComputedStyle(document.getElementById('confess')).display,
    mark: parseFloat(getComputedStyle(document.querySelector('#app .mark')).fontSize),
  }));
  check('the phone header is what it was',
    phoneHead.now === 'none' && phoneHead.topBtn === 'none'
    && phoneHead.bottomBar !== 'none' && phoneHead.mark < 40, JSON.stringify(phoneHead));

  // and back out to the desk
  await page.setViewportSize({ width: 1200, height: 950 });
  await page.waitForTimeout(400);
  const three = await page.$$eval('#scr-feed .mcol', (els) => els.length);
  check('1200px gets three columns', three === 3, three + ' columns');

  check('no page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
  process.exit(fails.length ? 1 : 0);
})();

#!/usr/bin/env node
/* BUYER PHOTOS ON THE WITCH SITE (2026-09-14, Sophie: "photo reviews with
   [wit]ch website").

   962 of the shop's 7,800 mirrored Etsy reviews carry a photo of the thing in
   somebody's house, and every one of them was buried inside ONE product's
   Reviews tab — 88px of it, not tappable. This covers the strip above the
   shelves, the viewer behind a photo, and the two things that were quietly
   wrong with the reviews already on the page.

   EVERY ASSERTION HERE IS A MEASUREMENT OR A READING OF WHAT THE STUB REALLY
   RECEIVED, because the ways this fails all look fine in the source: a strip
   that renders under the shelves, a viewer whose step zones have no height
   because the photo hasn't loaded, a way-into-the-product button hanging 15px
   past the bottom of its own card, and an entity that reads as `&#39;` only
   once a browser has drawn it.

   It CRASHES against the pre-fix page, which has no `.pw-cell` on it at all.
   The two pre-existing bugs it also pins were measured on the live mirror
   first: 66 of 400 sampled review texts carry HTML entities that esc() then
   escaped again, and the way-in button hung 15px past its card at 390x700.

   Run: node scripts/test-etsy-review-photos.js
*/
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let bad = 0;
const ok = m => console.log('  ok   ' + m);
const fail = m => { console.log('  FAIL ' + m); bad++; };
const is = (m, a, b) => (a === b ? ok(`${m} (${a})`) : fail(`${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`));
const yes = (m, v) => (v ? ok(m) : fail(m));

// Playwright's own download is not always the browser this box has.
async function launch() {
  try { return await chromium.launch(); } catch (e) {
    const alt = process.env.PW_CHROME
      || (fs.existsSync('/opt/pw-browsers')
        ? (fs.readdirSync('/opt/pw-browsers').filter(d => /^chromium-\d/.test(d))
            .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(p => fs.existsSync(p)))
        : null);
    if (!alt) throw e;
    return chromium.launch({ executablePath: alt });
  }
}

/* ────────── pure: the mirror's shape ────────── */
console.log('\nThe flat photo mirror');
const rev = require('../etsy-reviews');
const etsyRow = {
  transaction_id: 5551212, listing_id: 895343160, rating: 5,
  review: 'I didn&#39;t know there was one', create_timestamp: 1700000000,
  image_url_fullxfull: 'https://i.etsystatic.com/x/iap_fullxfull.1_a.jpg',
};
const pd = rev.photoDoc(etsyRow);
is('carries the listing it is of', pd.listing_id, 895343160);
is('carries the photo', pd.photo, etsyRow.image_url_fullxfull);
is('carries the rating', pd.rating, 5);
is('created is milliseconds', pd.created, 1700000000 * 1000);
yes('stores Etsy\'s text exactly as sent — decoding is the display\'s job',
  pd.text === 'I didn&#39;t know there was one');

const src = fs.readFileSync(path.join(__dirname, '..', 'etsy-reviews.js'), 'utf8');
const batchBlock = src.slice(src.indexOf('const batch = db().batch();'), src.indexOf('await batch.commit();'));
yes('a review and its photo are written in ONE batch, so they can never disagree',
  /batch\.set\(x\.ref, reviewDoc/.test(batchBlock) && /batch\.set\(db\(\)\.collection\(PHOTOS\)/.test(batchBlock));
yes('only a review that HAS a photo writes one', /if \(x\.r\.image_url_fullxfull\)/.test(batchBlock));
const photoRoute = src.slice(src.indexOf("router.get('/photos'"), src.indexOf("module.exports"));
yes('the wall is ONE ordered read — no where(), so no hand-made composite index',
  /orderBy\('created', 'desc'\)/.test(photoRoute) && !/\.where\(/.test(photoRoute));
yes('a caller can never ask for more than the cap', /Math\.min\(PHOTO_MAX/.test(photoRoute));
yes('the mirror is only ever written, never deleted', !/collection\(PHOTOS\)[\s\S]{0,60}\.delete\(/.test(src));

/* ────────── the page ────────── */
const PUB = path.join(__dirname, '..', 'public');
const PHOTO = (n, handle, text, when) => ({
  photo: `http://127.0.0.1:PORT/p${n}.png`, rating: 5, text,
  created: Date.UTC(2026, 6, n), handle: handle || null,
});
const LONG = 'I absolutely love this purchase and the price was really good as well, this seller is so amazing! '
  + 'I had a problem once before and she was absolutely amazing about it!!! This purchase was smooth sailing '
  + 'and she even sent me a crystal!!! I highly, HIGHLY RECOMMEND!!! Thank you so much!!!';

// A real 3:4 PNG (120x160) — the viewer is sized by its photo, so a 1x1 pixel
// would put the step zones nowhere near where a real one puts them, and an
// UNDECODABLE one collapses the stage to 0x0 and the test measures nothing.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAHgAAACgCAIAAABIaz/HAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAA5UlEQVR42u3QQQ0AAAgEoAtmCEPYP4Mt9MNGAtI1HIgC0aIRLVq0BdGiES1atAXRohEtWjSiRSNatGhEi0a0aNGIFo1o0aIRLRrRokUjWjSiRYtGtGhEixaNaNGIFi0a0aIRLVo0okUjWrRoRItGtGjRiBaNaNGiES0a0aJFI1o0okWLRrRoRIsWjWjRiBYtGtGiES1aNKJFI1q0aESLRrRo0YgWjWjRohEtGtGiRSNaNKJFi0a0aESLFo1o0YgWLRrRohEtWjSiRSNatGhEi0a0aNGIFo1o0aIRLRrRokUjWjSi/yzmdFQbpBKLUQAAAABJRU5ErkJggg==', 'base64');

function stub(opts = {}) {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    const send = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (/^\/p\d+\.png$/.test(u.pathname)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/witch') { res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'witch.html'), 'utf8')); }
    if (u.pathname === '/api/witch/shop') {
      // Eight, so the page is really taller than a phone: "closing puts her
      // back where she opened it" cannot be measured on a page that never
      // scrolled.
      const img = `http://127.0.0.1:${server.address().port}/p9.png`;
      const prod = (h, t, pr) => ({ handle: h, title: t, image: img, url: '#', price: pr, available: true, category: 'kits' });
      return send({ products: [
        prod('black-salt', 'Black Salt ~ Witchcraft Protection ~ Altar Supplies', '4.00'),
        prod('moon-pouch', 'Moon Pouch', '9.00'),
        prod('p3', 'Candle set', '12.00'), prod('p4', 'Herb chest', '69.00'),
        prod('p5', 'Tarot deck', '28.00'), prod('p6', 'Altar cloth', '18.00'),
        prod('p7', 'Crystal kit', '44.00'), prod('p8', 'Oil set', '9.50'),
      ], categories: [{ key: 'kits', name: 'Kits & sets' }] });
    }
    if (u.pathname === '/api/witch/shop/reviews/photos') {
      if (opts.photosFail) { res.writeHead(500); return res.end('{}'); }
      const p = String(server.address().port);
      opts.sawHandles = u.searchParams.get('handles');
      return send({ photos: (opts.photos || [
        PHOTO(1, 'black-salt', 'shipping was so fast and everything smells amazing'),
        PHOTO(2, null, 'Looks so great amongst my potions bottles!'),
        PHOTO(3, 'black-salt', LONG),
      ]).map(x => Object.assign({}, x, { photo: x.photo.replace('PORT', p) })), nextCursor: null });
    }
    if (u.pathname === '/api/witch/shop/reviews') {
      if (u.searchParams.get('handles')) return send({ global: { count: 4733, average: 4.93 }, items: { 'black-salt': { count: 1110, average: 4.9 } } });
      return send({ global: { count: 4733, average: 4.93 }, count: 2, average: 5, nextCursor: null,
        reviews: [{ rating: 5, text: 'I didn&#39;t know there was one so now I have all three.', photo: `http://127.0.0.1:${server.address().port}/p4.png`, created: Date.UTC(2026, 5, 1) }] });
    }
    if (/^\/api\/witch\/shop\/product\//.test(u.pathname)) return send({
      handle: 'black-salt', title: 'Black Salt ~ Witchcraft Protection ~ Altar Supplies',
      descriptionHtml: '<p>Salt.</p>', images: [`http://127.0.0.1:${server.address().port}/p9.png`],
      options: [], variants: [{ id: 'gid://1', title: 'Large', available: true, price: '17.0', options: {} }] });
    if (u.pathname.startsWith('/api/')) return send({});
    res.writeHead(404); res.end('');
  });
  return server;
}

(async () => {
  const opts = {};
  const server = stub(opts);
  await new Promise(r => server.listen(0, r));
  const PORT = server.address().port;
  const b = await launch();

  async function shop(h = 844) {
    const pg = await b.newPage({ viewport: { width: 390, height: h }, deviceScaleFactor: 1 });
    pg.on('pageerror', e => fail('page error: ' + e.message));
    await pg.goto(`http://127.0.0.1:${PORT}/witch`, { waitUntil: 'domcontentloaded' });
    await pg.click('.nav-btn[data-view="shop"]');
    return pg;
  }
  const R = s => `(() => { const r = document.querySelector('${s}'); return r ? r.getBoundingClientRect() : null; })()`;

  console.log('\nThe strip above the shelves');
  let pg = await shop();
  await pg.waitForSelector('.pw-cell', { timeout: 20000 });
  await pg.waitForTimeout(500);
  const m = await pg.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
    return { cells: document.querySelectorAll('.pw-cell').length,
      wall: g('#shop-photos').bottom, chips: g('#shop-cats').top, grid: g('#shop-grid').top,
      cell: [Math.round(g('.pw-cell').width), Math.round(g('.pw-cell').height)],
      head: document.querySelector('.pw-t').textContent,
      count: document.querySelector('.pw-n').textContent,
      loaded: [...document.querySelectorAll('.pw-cell img')].every(i => i.naturalWidth > 0) };
  });
  is('one cell per photo', m.cells, 3);
  yes('the photos really decode', m.loaded);
  yes('the strip is ABOVE the category chips', m.wall <= m.chips + 1);
  yes('…and above the shelves', m.wall <= m.grid + 1);
  is('a cell is a square', JSON.stringify(m.cell), JSON.stringify([88, 88]));
  is('the head names what it is', m.head, 'Photos from buyers');
  yes('the rating rides along — no second request', /4\.9★/.test(m.count) && /4,733/.test(m.count));
  yes('the shelf\'s handles go with the request, so a photo can be a door',
    (opts.sawHandles || '').includes('black-salt'));

  console.log('\nOne photo, big');
  await pg.click('.pw-cell');
  await pg.waitForSelector('.rvlb');
  await pg.waitForTimeout(400);
  const v = await pg.evaluate(() => {
    const img = document.querySelector('.rvlb-stage img'), r = img.getBoundingClientRect();
    const at = (x, y) => { const e = document.elementFromPoint(Math.round(x), Math.round(y)); return e ? (e.tagName + '.' + e.className) : null; };
    const go = document.querySelector('.rvlb-go'), gb = go && go.getBoundingClientRect();
    const x = document.querySelector('.rvlb-x').getBoundingClientRect();
    const cd = document.querySelector('.rvlb-card').getBoundingClientRect();
    return { imgH: Math.round(r.height), natural: img.naturalWidth,
      mid: at(r.left + r.width / 2, r.top + r.height / 2),
      right: at(r.right - 8, r.top + r.height / 2),
      left: at(r.left + 8, r.top + r.height / 2),
      hitX: at(x.left + x.width / 2, x.top + x.height / 2),
      go: go && go.textContent.trim(), goFits: gb ? gb.bottom <= cd.bottom + 1 : null,
      hitGo: gb ? at(gb.left + gb.width / 2, gb.top + gb.height / 2) : null,
      lock: document.body.style.overflow };
  });
  yes('the photo is really drawn', v.natural > 0 && v.imgH > 100);
  is('the middle of the photo is the photo — a tap there can never close it', v.mid, 'IMG.');
  is('the right of it steps on', v.right, 'BUTTON.rvlb-nav next');
  is('nothing steps back from the first one', v.left, 'IMG.');
  is('the ✕ takes its own tap', v.hitX, 'BUTTON.rvlb-x');
  yes('the way in names the product', /Black Salt/.test(v.go || ''));
  yes('…and is inside its own card', v.goFits);
  is('…and takes its own tap', v.hitGo, 'BUTTON.rvlb-go');
  is('the page behind it is frozen', v.lock, 'hidden');

  console.log('\nStepping');
  await pg.click('.rvlb-nav.next');
  await pg.waitForTimeout(250);
  const s2 = await pg.evaluate(() => ({
    go: !!document.querySelector('.rvlb-go'),
    back: !!document.querySelector('.rvlb-nav.prev'),
    text: (document.querySelector('.rvlb-text') || {}).textContent }));
  yes('a photo whose product can\'t be named is still a photo', /potions bottles/.test(s2.text || ''));
  is('…and offers no door it can\'t open', s2.go, false);
  is('…and steps back', s2.back, true);

  console.log('\nThe entities Etsy sends (measured on the drawn page)');
  await pg.click('.rvlb-x');
  await pg.waitForTimeout(200);
  await pg.click('.shop-item .srev');
  await pg.waitForSelector('#ps-reviews .rv', { timeout: 20000 });
  await pg.waitForTimeout(400);
  const sh = await pg.evaluate(() => ({
    text: document.querySelector('.rv-text').textContent,
    btns: document.querySelectorAll('.rv-photo-btn').length }));
  yes('a review reads as words, not as `&#39;`', /didn't know/.test(sh.text) && !/&#/.test(sh.text));
  is('its photo is a way in', sh.btns, 1);
  await pg.click('.rv-photo-btn');
  await pg.waitForTimeout(400);
  const over = await pg.evaluate(() => {
    const lb = document.querySelector('.rvlb');
    return { open: !!lb, above: lb ? +getComputedStyle(lb).zIndex > +getComputedStyle(document.getElementById('prod-sheet-bg')).zIndex : false };
  });
  yes('it opens over the sheet it was tapped in', over.open && over.above);
  await pg.click('.rvlb-x');
  await pg.waitForTimeout(250);
  is('closing it leaves the sheet\'s own lock alone',
    await pg.evaluate(() => document.body.style.overflow), 'hidden');
  await pg.close();

  console.log('\nThe app\'s own web view (390x700)');
  pg = await shop(700);
  await pg.waitForSelector('.pw-cell', { timeout: 20000 });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => window.scrollTo(0, 120));
  const wasY = await pg.evaluate(() => Math.round(window.scrollY));
  yes('(the stub shop really scrolls, or the next check proves nothing)', wasY > 0);
  await pg.click('.pw-cell:nth-child(3)');   // the long review
  await pg.waitForSelector('.rvlb');
  await pg.waitForTimeout(400);
  const small = await pg.evaluate(() => {
    const cd = document.querySelector('.rvlb-card').getBoundingClientRect();
    const gb = document.querySelector('.rvlb-go').getBoundingClientRect();
    const t = document.querySelector('.rvlb-text');
    const e = document.elementFromPoint(Math.round(gb.left + gb.width / 2), Math.round(gb.top + gb.height / 2));
    return { fits: gb.bottom <= cd.bottom + 1 && gb.bottom <= innerHeight,
      hit: e && e.className,
      // The durable property is WHICH box is capped, not whether this
      // particular review happens to overflow it.
      textCapped: getComputedStyle(t).maxHeight !== 'none',
      cardUncapped: getComputedStyle(document.querySelector('.rvlb-card')).maxHeight === 'none',
      stage: Math.round(document.querySelector('.rvlb-stage').getBoundingClientRect().height) };
  });
  yes('a LONG review still leaves the way in on screen', small.fits);
  is('…and tappable', small.hit, 'rvlb-go');
  yes('…because the WORDS are what scroll, never the card', small.textCapped && small.cardUncapped);
  yes('…and the photo is what gives room', small.stage > 0 && small.stage < 700 * 0.55);
  await pg.click('.rvlb-x');
  await pg.waitForTimeout(300);
  is('closing puts her back where she opened it from',
    await pg.evaluate(() => Math.round(window.scrollY)), wasY);
  await pg.close();

  console.log('\nWhen the photos don\'t come');
  opts.photosFail = true;
  pg = await shop();
  await pg.waitForSelector('.shop-item', { timeout: 20000 });
  await pg.waitForTimeout(900);
  const q = await pg.evaluate(() => ({
    hidden: document.getElementById('shop-photos').hidden,
    shelves: document.querySelectorAll('.shop-item').length }));
  yes('the strip simply isn\'t there', q.hidden);
  is('…and the shop is exactly the shop', q.shelves, 8);
  await pg.close();

  await b.close();
  server.close();
  console.log(bad ? `\n${bad} FAILED\n` : '\nall good\n');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

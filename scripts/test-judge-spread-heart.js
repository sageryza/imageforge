#!/usr/bin/env node
// THE PER-IMAGE HEART ON A SPREAD (Aug 2026, Sophie, on the witch reels page
// in the Review Queue: "the heart doesn't work… per image. they're supposed to
// tie back in to the original chat likes so all likes are synchronized
// everywhere").
//
// A grid-posted page's swipe view puts a whole labeled group on ONE card, and
// the card's ♥/✕ answers the SPREAD. A picture's own heart therefore lives in
// its lightbox — and judge.js's cast used to compare the picture's id against
// the current CARD's, which for a spread's picture never match, so the tap did
// nothing at all: no light, no verdict, no asset vote. The witch reels page is
// 47 pictures in 8 labeled groups, i.e. every picture on it.
//
// What this pins, driving the REAL page files in headless Chromium:
//   • tapping ♥ in a spread picture's lightbox POSTs the ASSETS-tab vote for
//     that picture's url (and lights), and never the spread's page verdict
//   • tapping it again clears it (posts vote:null)
//   • the SPREAD's own ♥ still writes the page verdict, unchanged
//   • a ♥ already on file in the Assets tab comes back lit on the picture —
//     the sync she asked for, in the other direction
//   • a TOP-LEVEL card still casts the page verdict from its lightbox
//
// Playwright is optional — this skips cleanly without it.
//
//   node scripts/test-judge-spread-heart.js

const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('judge spread heart: skipped (no playwright)'); process.exit(0); }

function exe() {
  const roots = ['/opt/pw-browsers'];
  for (const r of roots) {
    let kids = [];
    try { kids = fs.readdirSync(r); } catch (e) { continue; }
    for (const k of kids.filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join(r, k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(`${name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
}
function ok(name, cond) { is(name, Boolean(cond), true); }

const PUB = path.join(__dirname, '..', 'public');
const PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const U = (n) => 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-reels/' + n + '.webp';

const DATA = {
  chat: 'witchcraft-reels-panels',
  sheet: 'page-TEST',
  aspect: 'portrait',
  groups: [{
    label: '"Oh, is it?"',
    items: [
      { id: 'oh-01', label: '01 · the coworker', img: PX, url: U('oh-01') },
      { id: 'oh-02', label: '02 · the mug', img: PX, url: U('oh-02') },
    ],
  }, {
    label: '',
    items: [{ id: 'solo', label: 'a card of its own', img: PX, url: U('solo') }],
  }],
};

const HTML = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/compare.css">
<div class="wrap"><div id="pageviews"></div></div>
<script src="/compare.js"></script>
<script src="/asset-lightbox.js"></script>
<script src="/asset-view.js"></script>
<script src="/judge.js"></script>
<script src="/grid.js"></script>
<script src="/page-views.js"></script>
<script>window.__pageViews({ data: ${JSON.stringify(DATA)}, start: 'swipe' });</script>`;

(async () => {
  const browser = await chromium.launch({ executablePath: exe() });

  /** one page run; `votes` seeds the Assets tab. Returns the driver. */
  async function open(votes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const posts = [];
    await page.route('**/*', async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      const p = u.pathname;
      const json = (o) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
      if (p === '/page') return route.fulfill({ contentType: 'text/html', body: HTML });
      if (req.method() === 'POST') {
        posts.push({ path: p, body: JSON.parse(req.postData() || '{}') });
        return json({ ok: true });
      }
      if (p === '/api/chatfeed/verdict') return json({ ok: true, items: {}, texts: {} });
      if (p === '/api/gallery/assets/notes') return json({ notes: [] });
      if (p === '/api/gallery/assets') {
        return json({ assets: Object.keys(votes || {}).map((url) => ({ url, vote: votes[url] })), total: 0 });
      }
      const f = path.join(PUB, p);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ path: f });
      return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('http://spread.test/page');
    await page.waitForTimeout(500);
    // the tour, when it plays, sits over the whole card — tap it out first
    for (let i = 0; i < 6; i++) {
      const t = await page.$('.cmp-tour');
      if (!t) break;
      await page.mouse.click(195, 780);
      await page.waitForTimeout(120);
    }
    return { page, posts };
  }

  const lb = { heart: '#clightbox .vote.heart', x: '#clightbox .vote.nope' };

  // ── 1. a picture INSIDE a spread ────────────────────────────────────────
  {
    const { page, posts } = await open({});
    await page.click('img[data-zoom="oh-01"]');
    await page.waitForSelector(lb.heart, { timeout: 3000 }).catch(() => {});
    ok('spread picture opens the assets lightbox', await page.$(lb.heart));
    await page.click(lb.heart);
    await page.waitForTimeout(200);
    ok('its heart LIGHTS', await page.$eval(lb.heart, (e) => e.classList.contains('on')));
    const votes = posts.filter((x) => x.path === '/api/gallery/assets/vote');
    is('one asset vote posted', votes.length, 1);
    is('…for THIS picture', votes[0] && votes[0].body.url, U('oh-01'));
    is('…as a like', votes[0] && votes[0].body.vote, 'like');
    is('and NOT the spread\'s page verdict',
      posts.filter((x) => x.path === '/api/chatfeed/verdict').length, 0);
    // tap it again → cleared
    await page.click(lb.heart);
    await page.waitForTimeout(200);
    const last = posts.filter((x) => x.path === '/api/gallery/assets/vote').pop();
    is('tapping the lit heart clears it', last ? last.body.vote : 'nothing posted', null);
    is('…and it goes dark',
      await page.$eval(lb.heart, (e) => e.classList.contains('on')), false);
    await page.close();
  }

  // ── 2. the SPREAD's own heart is untouched ──────────────────────────────
  {
    const { page, posts } = await open({});
    await page.click('[data-act="yes"]');
    await page.waitForTimeout(250);
    const v = posts.filter((x) => x.path === '/api/chatfeed/verdict');
    is('the card\'s ♥ still writes the page verdict', v.length, 1);
    is('…on the spread\'s key', v[0] && String(v[0].body.item).slice(0, 2), 's:');
    is('…and mirrors nothing (a spread has no url)',
      posts.filter((x) => x.path === '/api/gallery/assets/vote').length, 0);
    await page.close();
  }

  // ── 3. a ♥ already in the Assets tab comes back lit ─────────────────────
  {
    const { page } = await open({ [U('oh-02')]: 'like' });
    await page.click('img[data-zoom="oh-02"]');
    await page.waitForSelector(lb.heart, { timeout: 3000 }).catch(() => {});
    is('an Assets-tab ♥ shows on the picture here',
      await page.$eval(lb.heart, (e) => e.classList.contains('on')), true);
    await page.close();
  }

  // ── 4. a TOP-LEVEL card still casts the page verdict ────────────────────
  {
    const { page, posts } = await open({});
    // the spread deliberately sits ABOVE the browse zones, so page it by hand
    await page.$eval('[data-act="next"]', (e) => e.click());
    await page.waitForTimeout(250);
    await page.click('img[data-zoom="solo"]');
    await page.waitForSelector(lb.heart, { timeout: 3000 }).catch(() => {});
    if (await page.$(lb.heart)) {
      await page.click(lb.heart);
      await page.waitForTimeout(200);
      const v = posts.filter((x) => x.path === '/api/chatfeed/verdict');
      is('a lone card\'s lightbox ♥ is still the page verdict', v.length, 1);
      is('…on its own id', v[0] && v[0].body.item, 'solo');
      is('…and mirrors to the Assets tab',
        posts.filter((x) => x.path === '/api/gallery/assets/vote').length, 1);
    }
    await page.close();
  }

  await browser.close();
  console.log(`judge spread heart: ${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
})();

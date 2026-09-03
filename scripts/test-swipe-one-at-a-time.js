#!/usr/bin/env node
// ONE CARD AT A TIME IS THE SWIPE VIEW'S DEFAULT (2026-09-03, Sophie, looking
// at "Playground triangle hearts v1 (19)" in the swipe view: "as a rule tinder
// compare shud default to 1 unless they're comparing something specific").
//
// A grid-posted page turned every group into ONE swipe card holding all of it
// side by side. `.jg-spread` is `flex:1 1 0` with no wrap, so a group of 19
// divided the card into 11px-wide pictures under a row of "this one" buttons
// overlapping into an unreadable stack — the screenshot she sent.
//
// What this pins, driving the REAL page files in headless Chromium at her own
// 390pt viewport. Every assertion is a MEASUREMENT, because a card that draws
// nineteen 11px pictures and a card that draws one are the same markup as far
// as any source assertion is concerned:
//   • a group of 19 becomes NINETEEN cards, one picture each, drawn wide
//   • a group of 3 and a group of 2 STAY one comparison card (her two-up
//     picker, and the quality ladders) — and the spread still marks on `s:`
//   • a split card's ♥ posts its OWN id
//   • a split card carries the group's name as its eyebrow, and the GRID's own
//     item objects are not written to
//   • the COMPARE view is untouched: the group of 19 is still one ruled group
//
// Playwright is optional — this skips cleanly without it.
//
//   node scripts/test-swipe-one-at-a-time.js

const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('swipe one at a time: skipped (no playwright)'); process.exit(0); }

function exe() {
  for (const r of ['/opt/pw-browsers']) {
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
// a real 2:3 picture, so the layout is the layout
const PIC = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">'
  + '<rect width="1024" height="1536" fill="#cbb"/></svg>').toString('base64');
const U = (n) => 'https://storage.googleapis.com/x/triangle/' + n + '.webp';

function bunch(prefix, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: prefix + '-' + (i + 1), label: prefix + ' ' + (i + 1), img: PIC, url: U(prefix + i) });
  }
  return out;
}

const DATA = {
  chat: 'playground-triangle-hearts',
  sheet: 'page-TEST',
  aspect: 'portrait',
  groups: [
    { label: 'bands of colour', items: bunch('many', 19) },   // a LISTING
    { label: 'the quality ladder', items: bunch('three', 3) },  // a comparison
    { label: 'two of them', items: bunch('two', 2) },           // her two-up picker
    { label: '', items: [{ id: 'solo', label: 'a card of its own', img: PIC, url: U('solo') }] },
  ],
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

  async function open() {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const posts = [];
    await page.route('**/*', async (route) => {
      const req = route.request();
      const p = new URL(req.url()).pathname;
      const json = (o) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
      if (p === '/page') return route.fulfill({ contentType: 'text/html', body: HTML });
      if (req.method() === 'POST') {
        posts.push({ path: p, body: JSON.parse(req.postData() || '{}') });
        return json({ ok: true });
      }
      if (p === '/api/chatfeed/verdict') return json({ ok: true, items: {}, texts: {} });
      if (p === '/api/gallery/assets/notes') return json({ notes: [] });
      if (p === '/api/gallery/assets') return json({ assets: [], total: 0 });
      const f = path.join(PUB, p);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ path: f });
      return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('http://swipe.test/page');
    await page.waitForTimeout(500);
    for (let i = 0; i < 6; i++) {           // the tour sits over the card
      if (!(await page.$('.cmp-tour'))) break;
      await page.mouse.click(195, 780);
      await page.waitForTimeout(120);
    }
    return { page, posts };
  }

  /** what is on screen right now: how many pictures, and how wide */
  const shot = (page) => page.evaluate(() => {
    const card = document.querySelector('#judge');
    const sp = card.querySelector('.jg-spread');
    const imgs = [...card.querySelectorAll('.jg-card img, .jg-mom img')]
        .filter((i) => i.getBoundingClientRect().width > 0);
    const eye = card.querySelector('.eyebrow');
    return {
      pics: imgs.length,
      w: imgs.map((i) => Math.round(i.getBoundingClientRect().width)),
      spread: !!sp,
      overflow: sp ? sp.scrollWidth > Math.ceil(sp.getBoundingClientRect().width) + 1 : false,
      eyebrow: eye ? eye.textContent.trim() : '',
    };
  });
  // tolerant on purpose: against the PRE-FIX page the deck is four cards long,
  // so a walk of nineteen runs off the end — that must read as a failed
  // assertion below, never as a crash that hides the other findings
  const next = async (page) => {
    const b = await page.$('[data-act="next"]');
    if (!b) return false;
    await page.$eval('[data-act="next"]', (e) => e.click());
    await page.waitForTimeout(220);
    return true;
  };

  // ── 1. the group of 19 is nineteen cards, one picture each ──────────────
  {
    const { page, posts } = await open();
    const first = await shot(page);
    is('a 19-card group draws ONE picture on the first card', first.pics, 1);
    ok('…drawn at a size she can judge (>200px wide)', first.w[0] > 200);
    is('…with no side-by-side spread at all', first.spread, false);
    is('…and the group\'s name rides as its eyebrow', first.eyebrow, 'bands of colour');

    // its ♥ answers THIS card, not a spread
    await page.click('[data-act="yes"]');
    await page.waitForTimeout(250);
    const v = posts.filter((x) => x.path === '/api/chatfeed/verdict');
    is('marking it posts one verdict', v.length, 1);
    is('…on the CARD\'s own id, never an s: key', v[0] && v[0].body.item, 'many-1');

    // walk to the end of the nineteen
    let seen = 1; let guard = 0;
    while (guard++ < 40) {
      if (!(await next(page))) break;
      const s = await shot(page);
      if (s.spread) break;                 // we have reached the ladder
      seen++;
    }
    is('the whole group is walked one at a time', seen, 19);
    await page.close();
  }

  // ── 2. the ladder of 3 and the pair STAY comparisons ────────────────────
  {
    const { page, posts } = await open();
    // walk to the ladder rather than counting to it, so this section still
    // reports real findings against a page that lays the deck out differently
    let three = await shot(page);
    for (let i = 0; i < 25 && three.pics !== 3; i++) {
      if (!(await next(page))) break;
      three = await shot(page);
    }
    is('a group of 3 is still ONE card', three.pics, 3);
    is('…side by side', three.spread, true);
    is('…fitting inside it', three.overflow, false);
    ok('…at a comparable size (>90px each)', Math.min(...three.w) > 90);

    if (await page.$('[data-act="yes"]')) {
      await page.click('[data-act="yes"]');
      await page.waitForTimeout(250);
    }
    const v = posts.filter((x) => x.path === '/api/chatfeed/verdict');
    is('…and its ♥ still marks the SPREAD',
      v[0] && String(v[0].body.item).slice(0, 2), 's:');

    await next(page);
    const two = await shot(page);
    is('a pair is still her two-up picker', two.pics, 2);
    is('…side by side', two.spread, true);

    await next(page);
    const solo = await shot(page);
    is('a lone card is untouched', solo.pics, 1);
    is('…and wears no eyebrow it was not given', solo.eyebrow, '');
    await page.close();
  }

  // ── 3. COMPARE is untouched — the big group is still one ruled group ────
  {
    const { page } = await open();
    await page.click('.pv button:nth-child(2)');
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#grid .gd-group')];
      return {
        groups: rows.length,
        first: rows[0] ? rows[0].querySelectorAll('img').length : 0,
        // the grid's own item objects must not have been written to
        eyebrows: document.querySelectorAll('#grid .eyebrow').length,
      };
    });
    is('the grid still has its four groups', g.groups, 4);
    is('…the first still holding all 19', g.first, 19);
    is('…and nothing wrote an eyebrow into the grid\'s items', g.eyebrows, 0);
    await page.close();
  }

  await browser.close();
  console.log(`swipe one at a time: ${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
})();

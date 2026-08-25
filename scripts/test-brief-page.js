#!/usr/bin/env node
// The What's New page (public/brief.html), driven for real in headless
// Chromium against a stubbed /api/brief — no server, no Firestore, no network.
//
// What it pins, and why each one is here rather than "it looked fine":
//   • the page's script SURVIVES the injected autoscroll pill. The pill runs in
//     global scope declaring var raf / I / playing; a page-level `let` of the
//     same name kills its script at parse time, and the symptom is a page that
//     renders but does nothing.
//   • the pill's own palette is OUT-SPECIFIED. public/pill-inject.html sets
//     --paper/--ink ON .float, so a page that only sets :root gets a near-black
//     pill on its own paper (measured on /chunking, Aug 2026).
//   • the top card's time is CLEAR of the pill's corner. The pill is fixed over
//     roughly x 326-374 / y 14-192, which is the first card's own top row.
//   • the picture lightbox keeps the whole house contract: page locked, and the
//     scroll position she opened from RESTORED on close.
//   • nothing scrolls sideways on a 390pt phone.
//   • IT OPENS ON THE LAST LIST SHE SAW AND DOES NOT READ (Aug 2026, Sophie:
//     "rather than immediately doing another API read, I'd like to be able to
//     go back and forth … there's a button at the top that says refresh which
//     causes another API read, and it also says last updated and then the
//     time"). Counted, not eyeballed: a second visit must make ZERO calls to
//     /api/brief, and Refresh must make exactly one.
//
// Playwright is optional — this skips cleanly without it, like the other
// headless tests here.
//
//   node scripts/test-brief-page.js

const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('brief page: skipped (no playwright)'); process.exit(0); }

// The bundled browser, wherever this box keeps it.
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

// One card of each kind, enough to draw every branch of the page.
const BRIEF = {
  generatedAt: new Date().toISOString(),
  counts: { chats: 3, needs: 1, unseen: 2, pages: 1, images: 2 },
  top: [
    { chat: 'asks', name: 'lesson cards', why: 'needs you', need: 'pick a palette, 10 seconds',
      line: 'pick a palette, 10 seconds', note: '', at: new Date(Date.now() - 3600e3).toISOString(),
      unseen: true, news: 1, newImages: 2,
      images: [
        { url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          label: 'Penny — the blue Kleenex', caption: 'gpt-image-2 · medium' },
        { url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          label: 'Penny — v2', caption: '' },
      ],
      pages: [{ id: 'p1', title: 'A page whose title runs on and on and on and on', at: '',
        url: '/api/chatfeed/page/p1', isNew: true }],
      pinned: null, score: 200 },
    { chat: 'talks', name: 'the quiet one', why: 'new reply', need: '',
      line: 'sheet stitched, 12 stickers cut', note: 'research it, karaoke, tabs',
      at: new Date(Date.now() - 7200e3).toISOString(), unseen: true, news: 2,
      newImages: 0, images: [], pages: [],
      update: { asked: 'cut the sheet up', did: 'cut it into twelve', next: 'print test' },
      pinned: { url: 'https://x/f.mp4', title: 'Evan — the long cut v6', kind: 'film', current: true },
      score: 120 },
  ],
  // Eight quiet cards, not one: the page has to be TALLER than the viewport
  // for the lightbox's save-and-restore to prove anything — on a short page
  // every scroll position clamps to the same number and the test passes
  // whatever the code does.
  more: Array.from({ length: 8 }, (_, i) => ({
    chat: 'later' + i, name: 'a quieter one ' + i, why: 'new picture', need: '',
    line: 'one more drawing', note: '',
    at: new Date(Date.now() - 86400e3).toISOString(), unseen: false, news: 0,
    newImages: 1, images: [], pages: [], pinned: null, score: 40 - i,
  })),
};

(async () => {
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'brief.html'), 'utf8');
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');

  // Serve the page exactly as serveGated does — the real page plus the real
  // injected pill, which is the combination that has broken pages before.
  let reads = 0, lastRead = '';        // every call to /api/brief, counted
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    // The API first: "/api/brief?…" also ends in "/brief?", so a page-first
    // test answers the page's own fetch with the HTML and the page reports a
    // JSON error instead of drawing.
    if (/\/api\/brief/.test(url)) {
      reads++; lastRead = url;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(BRIEF) });
    }
    if (/\/brief(\?|$)/.test(url)) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html + pill });
    }
    // house.css is what tool.css @imports (2026-08-24). A stub that serves the
    // sheet but not its import drops the WHOLE palette and every var falls
    // back — silently. Same rule the tritoggle stubs already carry.
    if (/\/house\.css/.test(url)) {
      return route.fulfill({ contentType: 'text/css',
        body: fs.readFileSync(path.join(__dirname, '..', 'public', 'house.css'), 'utf8') });
    }
    if (/\/tool\.css/.test(url)) {
      return route.fulfill({ contentType: 'text/css',
        body: fs.readFileSync(path.join(__dirname, '..', 'public', 'tool.css'), 'utf8') });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('https://forge.test/brief', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#cards .card', { timeout: 5000 }).catch(() => {});

  // ── it drew ──────────────────────────────────────────────────────────────
  is('the five (here two) lead cards drew', await page.locator('#cards .card').count(), 2);
  is('the quieter pile drew', await page.locator('#also .card').count(), 8);
  ok('the "Also" heading only shows when there is one',
    await page.locator('#alsohead').isVisible());
  is('the count strip reads', (await page.locator('#strip').textContent()).trim(),
    '1 waiting on you · 2 new · 1 page · 2 pictures');
  is('an ask is marked as one', await page.locator('#cards .card.needs').count(), 1);
  is('pictures drew with their labels', await page.locator('.pics img').count(), 2);
  is('and their labels are the ones filed',
    (await page.locator('.pics figcaption').first().textContent()).trim(),
    'Penny — the blue Kleenex');
  ok('a current pinned deliverable is offered',
    (await page.locator('.lk', { hasText: 'Evan — the long cut v6' }).count()) === 1);
  ok('her own note is shown, not rewritten',
    (await page.locator('.note').first().textContent()).includes('karaoke'));

  // ── the pill contract ────────────────────────────────────────────────────
  ok('the injected pill is there', await page.locator('.float').count() > 0);
  // Compare the pill against THE PAGE, never against a hex — the palette is
  // house.css now (2026-08-24) and a hardcoded value here just re-pins the
  // colour this file was written to stop anyone hardcoding.
  is('and it wears THIS page\'s paper, not its own baked one',
    await page.evaluate(() => {
      const pill = getComputedStyle(document.querySelector('.float'));
      const root = getComputedStyle(document.documentElement);
      return (pill.getPropertyValue('--paper').trim() || root.getPropertyValue('--paper').trim())
        === root.getPropertyValue('--paper').trim() && !!root.getPropertyValue('--paper').trim();
    }), true);
  {
    const ago = await page.locator('#cards .card').first().locator('.ago').boundingBox();
    const float = await page.locator('.float').boundingBox();
    ok('the top card\'s time is clear of the pill\'s corner',
      ago && float && (ago.x + ago.width) <= float.x);
  }
  is('nothing scrolls sideways',
    await page.evaluate(() => document.documentElement.scrollWidth), 390);

  // ── the Update card is behind the ⌄ ──────────────────────────────────────
  is('nothing is expanded on arrival',
    await page.locator('.det:not([hidden])').count(), 0);
  await page.locator('.exp').first().click();
  is('the ⌄ opens one', await page.locator('.det:not([hidden])').count(), 1);
  ok('and it says what she asked for',
    (await page.locator('.det').first().textContent()).includes('cut the sheet up'));

  // ── the lightbox keeps the house contract ────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 220));
  const from = await page.evaluate(() => Math.round(window.scrollY));
  ok('the fixture page is tall enough for this to mean anything', from > 100);
  // dispatchEvent, not click(): Playwright scrolls a target into view before
  // clicking it, which moves the page BEFORE the handler saves where she was —
  // so a .click() here tests Playwright's scrolling, not the page's restore.
  await page.locator('.pics img').first().dispatchEvent('click');
  is('a tapped picture opens', await page.locator('#lb').isVisible(), true);
  is('and the page behind it is locked',
    await page.evaluate(() => document.body.style.overflow), 'hidden');
  // Something restarting the autoscroll under the overlay moves the page —
  // locking alone does not stop window.scrollBy. Restoring the saved position
  // is what guarantees she closes it where she opened it.
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.locator('#lb').click();
  is('closing puts her back where she was',
    await page.evaluate(() => Math.round(window.scrollY)), from);
  is('and unlocks the page', await page.evaluate(() => document.body.style.overflow), '');

  // ── the native chevron asks the page first ───────────────────────────────
  // dispatchEvent, not click(): Playwright scrolls a target into view before
  // clicking it, which moves the page BEFORE the handler saves where she was —
  // so a .click() here tests Playwright's scrolling, not the page's restore.
  await page.locator('.pics img').first().dispatchEvent('click');
  is('__navBack closes an open picture instead of leaving',
    await page.evaluate(() => window.__navBack()), true);
  is('…and reports false once there is nothing to close',
    await page.evaluate(() => window.__navBack()), false);

  // ── the read is behind Refresh ───────────────────────────────────────────
  // The cold visit above is the only one allowed to read on its own: there was
  // nothing on the phone to show her.
  is('a first, cold visit reads once', reads, 1);
  ok('and it says how old what she is looking at is',
    /^Last updated /.test((await page.locator('#lastup').textContent()).trim()));

  reads = 0;
  await page.goto('https://forge.test/brief', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#cards .card', { timeout: 5000 }).catch(() => {});
  is('coming back draws the last list she saw…', await page.locator('#cards .card').count(), 2);
  is('…and reads NOTHING', reads, 0);
  ok('the count strip came back with it',
    (await page.locator('#strip').textContent()).indexOf('waiting on you') > -1);

  await page.locator('#refresh').click();
  await page.waitForFunction(() => !document.getElementById('refresh').disabled, null,
    { timeout: 5000 }).catch(() => {});
  is('Refresh is the one thing that reads', reads, 1);
  // The server holds its answer for 60s; a deliberate tap must skip that hold
  // or Refresh would look broken for a minute after any other read.
  ok('and it asks for a fresh answer, not the held one', /fresh=1/.test(lastRead));

  // ── the way back to the UPDATE tab ───────────────────────────────────────
  ok('the page carries its own chevron (it opens inside the Chats web view)',
    await page.locator('#back').isVisible());

  is('no page errors', errors, []);
  await browser.close();

  if (fails.length) {
    console.error(`\n${fails.length} FAILED (${pass} passed)\n`);
    fails.forEach((f) => console.error('  ✕ ' + f + '\n'));
    process.exit(1);
  }
  console.log(`brief page: ${pass} passed`);
})();

#!/usr/bin/env node
// The Review Queue page (public/review.html), driven for real in headless
// Chromium against a stubbed /api/review — no server, no Firestore, no network.
//
// What it pins:
//   • the page's script SURVIVES the injected autoscroll pill (IIFE rule)
//   • the pill wears THIS page's paper, not its own baked palette
//   • PAGES ARE SQUARE TILES, THREE TO A ROW (Aug 2026 v2) — the face is the
//     first picture, or a text deck's first card's own words; the tile opens
//     the page CLEAN (?clean=1); an untouched tile reads rose; a faceless
//     tile gets the card glyph, never a broken image
//   • NO ✕ on a tile (Skip/Done moved into the deck's piles view) and no chat
//     rows — the queue is decks and only decks
//   • the WAITING · DONE hairline tabs switch panes and the sliding line
//     lands under the lit tab (measured, never a count)
//   • the hidden pile's ↩ still posts hidden:false — the page's one write
//   • nothing scrolls sideways on a 390pt phone
//
// Playwright is optional — this skips cleanly without it.
//
//   node scripts/test-review-page.js

const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('review page: skipped (no playwright)'); process.exit(0); }

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

const PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const row = (o) => ({
  id: o.id, chat: 'xi', name: o.name || 'XI Cards', title: o.title,
  template: o.template || 'deck', created: new Date(Date.now() - 3600e3).toISOString(),
  url: '/api/chatfeed/page/' + o.id + '?clean=1', total: o.total, decided: o.decided || 0,
  later: o.later || 0, thumb: o.thumb || '', peek: o.peek || '', at: new Date().toISOString(),
});
const QUEUE = {
  waiting: [
    // untouched TEXT deck — its tile face is the first card's own words
    row({ id: 'w1', title: 'XI cards — batch 2', total: 131, peek: 'CLIMBED OUT THE WINDOW' }),
    row({ id: 'w2', title: 'Instagram ideas v1', total: 28, decided: 4, later: 2, thumb: PX }),
    // no picture AND no words on file — the card glyph holds the face
    row({ id: 'w3', title: 'Morning ideas', total: 6 }),
  ],
  // the server's own standing grids — their own tab, never the Waiting pile
  auto: [
    row({ id: 'auto-subjects--xi', title: 'Auto-compare — same style',
      template: 'grid', total: 3, thumb: PX }),
    row({ id: 'auto-ladders--dfp', title: 'Auto-compare — settings changed',
      template: 'grid', total: 10, decided: 2, thumb: PX }),
  ],
  done: [row({ id: 'd1', title: 'Style test v1', template: 'grid', total: 16, decided: 16, thumb: PX })],
  hidden: [row({ id: 'h1', title: 'Deck template demo', total: 4 })],
  counts: { pages: 3, items: 161, auto: 2, autoItems: 11, done: 1 },
  generatedAt: new Date().toISOString(),
};

(async () => {
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'review.html'), 'utf8');
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');
  const hides = [];

  // Serve the page exactly as serveGated does — page plus the real injected
  // pill, the combination that has broken pages before.
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/api\/review\/hide/.test(url)) {
      hides.push(JSON.parse(req.postData() || '{}'));
      return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    }
    if (/\/api\/review/.test(url)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(QUEUE) });
    }
    if (/\/review(\?|$)/.test(url)) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html + pill });
    }
    if (/\/tool\.css/.test(url)) {
      return route.fulfill({ contentType: 'text/css',
        body: fs.readFileSync(path.join(__dirname, '..', 'public', 'tool.css'), 'utf8') });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('https://forge.test/review', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pane-wait .qtile', { timeout: 5000 }).catch(() => {});

  // ── it drew: tiles, and nothing but tiles ────────────────────────────────
  ok('no page errors (the pill did not kill the script, nor it the pill)', errors.length === 0);
  is('the page tiles drew', await page.locator('#pane-wait .qtile').count(), 3);
  is('no chat rows — the queue is decks and only decks',
    await page.locator('#pane-wait .qrow').count(), 0);
  is('no ✕ on a tile — Skip and Done live in the deck now',
    await page.locator('#pane-wait [data-hide]').count(), 0);
  is('the strip counts the pile',
    (await page.locator('#strip').textContent()).trim(), '3 waiting · 161 cards to go');
  ok('an untouched tile reads due (rose count), not the one she is part-way through',
    await page.locator('#pane-wait .qtile.due').count() === 2);
  is('a text deck\'s face is its first card\'s own words',
    (await page.locator('#pane-wait .qtile').first().locator('.qface.qwords i').textContent()).trim(),
    'CLIMBED OUT THE WINDOW');
  is('no picture and no words leaves the card glyph, never a broken image',
    await page.locator('#pane-wait .qtile').nth(2).locator('.qface.qwords svg').count(), 1);
  ok('a started tile says how far and what is parked for later',
    (await page.locator('#pane-wait .qtile').nth(1).locator('.qtc').textContent()).trim()
      === '4 of 28 · 2 later');
  is('a tile opens the page CLEAN — straight onto the cards',
    await page.locator('#pane-wait .qtile').first().locator('a.qgo').getAttribute('href'),
    '/api/chatfeed/page/w1?clean=1');

  // ── three to a row, square ───────────────────────────────────────────────
  {
    const boxes = [];
    for (let i = 0; i < 3; i += 1) {
      boxes.push(await page.locator('#pane-wait .qtile').nth(i).locator('.qface').boundingBox());
    }
    ok('the three tiles share one row', Math.abs(boxes[0].y - boxes[1].y) < 1.5
      && Math.abs(boxes[1].y - boxes[2].y) < 1.5);
    ok('…in three columns', boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x);
    ok('…and every face is square',
      boxes.every((b) => Math.abs(b.width - b.height) < 1.5));
  }

  // ── the pill contract ────────────────────────────────────────────────────
  ok('the injected pill is there', await page.locator('.float').count() > 0);
  is('and it wears THIS page\'s paper, not its own baked one',
    await page.evaluate(() => getComputedStyle(document.querySelector('.float'))
      .getPropertyValue('--paper').trim()), '#faf9f7');
  is('nothing scrolls sideways',
    await page.evaluate(() => document.documentElement.scrollWidth), 390);

  // ── the hairline tabs ────────────────────────────────────────────────────
  // AUTO first (Aug 2026, her ask): the server's own comparisons must not be
  // standing in the pile a chat handed her.
  {
    const hrefs = await page.evaluate(() => ({
      wait: [].map.call(document.querySelectorAll('#pane-wait .qgo'), (a) => a.getAttribute('href')),
      auto: [].map.call(document.querySelectorAll('#pane-auto .qgo'), (a) => a.getAttribute('href')),
    }));
    is('the Waiting pile is the three a chat posted', hrefs.wait.length, 3);
    ok('and not one of them is a standing auto grid',
      hrefs.wait.every((h) => !/page\/auto-/.test(h)));
    ok('while both AUTO tiles point at one', hrefs.auto.length === 2
      && hrefs.auto.every((h) => /page\/auto-/.test(h)));
  }
  await page.locator('#tab-auto').click();
  await page.waitForTimeout(280);
  is('AUTO shows its pane', await page.locator('#pane-auto').isHidden(), false);
  is('…and WAITING hides behind it', await page.locator('#pane-wait').isHidden(), true);
  is('both standing grids drew', await page.locator('#pane-auto .qtile').count(), 2);

  await page.locator('#tab-done').click();
  await page.waitForTimeout(280);   // the line's slide settles
  is('DONE shows its pane', await page.locator('#pane-done').isHidden(), false);
  is('and WAITING hides', await page.locator('#pane-wait').isHidden(), true);
  is('the done tile drew', await page.locator('#pane-done .qtile:not(:has([data-unhide]))').count(), 1);
  is('the hidden pile rides behind DONE', await page.locator('[data-unhide]').count(), 1);
  {
    const line = await page.evaluate(() => {
      const tabs = document.getElementById('tabs');
      const on = tabs.querySelector('.acctab.on').getBoundingClientRect();
      const box = tabs.getBoundingClientRect();
      const st = getComputedStyle(tabs);
      // --tx is container-relative (tabLine subtracts the row's own left)
      return { tw: parseFloat(st.getPropertyValue('--tw')),
        tx: parseFloat(st.getPropertyValue('--tx')),
        left: on.left - box.left - tabs.clientLeft, width: on.width };
    });
    ok('the sliding line was MEASURED off the lit tab (width)',
      Math.abs(line.tw - line.width) < 1.5);
    ok('…and sits under it (x)', Math.abs(line.tx - line.left) < 1.5);
  }

  // ── ↩ un-hides (the page's one write) ───────────────────────────────────
  await page.locator('[data-unhide="h1"]').click();
  await page.waitForTimeout(120);
  is('the ↩ posted it back', hides[0], { id: 'h1', hidden: false });

  await browser.close();
  if (fails.length) {
    console.error(`review page: ${fails.length} FAILED, ${pass} passed\n`);
    fails.forEach((f) => console.error(`  ✗ ${f}\n`));
    process.exit(1);
  }
  console.log(`review page: all ${pass} passed`);
})().catch((e) => { console.error('review page: crashed —', e.message); process.exit(1); });

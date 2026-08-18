#!/usr/bin/env node
// The Review Queue page (public/review.html), driven for real in headless
// Chromium against a stubbed /api/review — no server, no Firestore, no network.
//
// What it pins:
//   • the page's script SURVIVES the injected autoscroll pill (IIFE rule)
//   • the pill wears THIS page's paper, not its own baked palette
//   • rows draw with progress; an untouched row reads rose; a text deck gets
//     the card glyph, never a broken image
//   • the WAITING · DONE hairline tabs switch panes and the sliding line
//     lands under the lit tab (measured, never a count)
//   • the ✕ POSTs /api/review/hide for that page and re-reads fresh; the
//     hidden pile's ↩ posts hidden:false
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
  url: '/api/chatfeed/page/' + o.id, total: o.total, decided: o.decided || 0,
  later: o.later || 0, thumb: o.thumb || '', at: new Date().toISOString(),
});
const QUEUE = {
  waiting: [
    row({ id: 'w1', title: 'XI cards — batch 2', total: 131 }),                    // untouched text deck
    row({ id: 'w2', title: 'Instagram ideas v1', total: 28, decided: 4, later: 2, thumb: PX }),
  ],
  done: [row({ id: 'd1', title: 'Style test v1', template: 'grid', total: 16, decided: 16, thumb: PX })],
  hidden: [row({ id: 'h1', title: 'Deck template demo', total: 4 })],
  counts: { pages: 2, items: 155, done: 1 },
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
  await page.waitForSelector('#pane-wait .qrow', { timeout: 5000 }).catch(() => {});

  // ── it drew ──────────────────────────────────────────────────────────────
  ok('no page errors (the pill did not kill the script, nor it the pill)', errors.length === 0);
  is('the waiting rows drew', await page.locator('#pane-wait .qrow').count(), 2);
  is('the strip counts the pile', (await page.locator('#strip').textContent()).trim(),
    '2 waiting · 155 cards to go');
  ok('an untouched row reads due (rose count)',
    await page.locator('#pane-wait .qrow.due').count() === 1);
  is('a text deck draws the card glyph, not a broken image',
    await page.locator('#pane-wait .qrow').first().locator('.qth.ph svg').count(), 1);
  ok('a started row says how far and what is parked for later',
    (await page.locator('#pane-wait .qrow').nth(1).locator('.qn').textContent()).trim()
      === '4 of 28 · 2 later');
  is('a row is a link to the page itself',
    await page.locator('#pane-wait .qrow').first().locator('a.qgo').getAttribute('href'),
    '/api/chatfeed/page/w1');

  // ── the pill contract ────────────────────────────────────────────────────
  ok('the injected pill is there', await page.locator('.float').count() > 0);
  is('and it wears THIS page\'s paper, not its own baked one',
    await page.evaluate(() => getComputedStyle(document.querySelector('.float'))
      .getPropertyValue('--paper').trim()), '#faf9f7');
  is('nothing scrolls sideways',
    await page.evaluate(() => document.documentElement.scrollWidth), 390);

  // ── the hairline tabs ────────────────────────────────────────────────────
  await page.locator('#tab-done').click();
  await page.waitForTimeout(280);   // the line's slide settles
  is('DONE shows its pane', await page.locator('#pane-done').isHidden(), false);
  is('and WAITING hides', await page.locator('#pane-wait').isHidden(), true);
  is('the done row drew', await page.locator('#pane-done .qrow:not(:has([data-unhide]))').count(), 1);
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

  // ── ✕ hides, ↩ un-hides ─────────────────────────────────────────────────
  await page.locator('#tab-wait').click();
  await page.locator('[data-hide="w1"]').click();
  await page.waitForTimeout(120);
  is('the ✕ posted the stamp', hides[0], { id: 'w1', hidden: true });
  await page.locator('#tab-done').click();
  await page.locator('[data-unhide="h1"]').click();
  await page.waitForTimeout(120);
  is('the ↩ posted it back', hides[1], { id: 'h1', hidden: false });

  await browser.close();
  if (fails.length) {
    console.error(`review page: ${fails.length} FAILED, ${pass} passed\n`);
    fails.forEach((f) => console.error(`  ✗ ${f}\n`));
    process.exit(1);
  }
  console.log(`review page: all ${pass} passed`);
})().catch((e) => { console.error('review page: crashed —', e.message); process.exit(1); });

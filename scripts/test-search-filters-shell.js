#!/usr/bin/env node
// THE ADVANCED SEARCH DRAWER — one shell, every page (2026-09-02).
//
//   "can u add settings - a toggle open advanced search in all pages -
//    reusable shell - playground meta assets etc"
//   "search by low medium high, by date"
//   "you can put the heart x thing within the toggle"
//
// TWO HALVES, because the rules and the wiring fail differently.
//
//   1. PURE — the decision table in /searchfilters.js: what NEUTRAL means for
//      each kind of row, that an unknown value WIDENS rather than emptying the
//      list, what a date chip's floor is, and reading a quality off a filed
//      MODEL · QUALITY · SIZE caption. Every one of those is a rule a page
//      would otherwise have re-typed.
//
//   2. HEADLESS — the real Playground and the real Meta Assets. A filter is
//      only worth anything if it is genuinely OPT IN (shut until she taps),
//      if a state she cannot see is WORN by the chip, and if it really hides
//      what it says it hides. Every one of those is a measurement: a chip
//      carrying the right class says nothing about what is on screen.
//
//   npm install playwright-core --no-save && node scripts/test-search-filters-shell.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');
const SF = require('../public/searchfilters.js');

let failed = 0;
const fail = (m) => { console.error('  FAIL ' + m); failed++; };
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else fail(m); };
const is = (m, got, want) => ok(got === want, m + ' — got ' + JSON.stringify(got));

// ── 1. PURE ───────────────────────────────────────────────────────────────
console.log('the neutral of each kind of row');
const tri = { key: 't', kind: 'tri', vals: ['a', 'b', 'c'], neutral: 'b', words: ['A', 'B', 'C'] };
const one = { key: 'o', kind: 'chips', vals: ['x', 'y'], words: ['X', 'Y'] };
const many = { key: 'm', kind: 'chips', multi: true, vals: ['x', 'y'], words: ['X', 'Y'] };
is('a tri row is neutral at its NAMED stop, never at index 0', SF.neutralOf(tri), 'b');
is('a single-pick chip row is neutral when nothing is lit', SF.neutralOf(one), '');
ok(Array.isArray(SF.neutralOf(many)) && SF.neutralOf(many).length === 0,
  'a multi row is neutral when nothing is lit');
ok(SF.isNeutral(many, []) && !SF.isNeutral(many, ['x']), 'and one lit chip is a narrowing');

console.log('\nan unknown value WIDENS — it never empties the list');
is('a tri value the spec never heard of falls back to neutral', SF.clean(tri, 'zz'), 'b');
is('and so does a single-pick chip', SF.clean(one, 'zz'), '');
ok(SF.clean(many, ['x', 'zz']).join() === 'x', 'a multi row keeps the values it knows and drops the rest');
ok(SF.clean(many, 'x').length === 0, 'and a value of the wrong SHAPE is neutral, not a crash');

console.log('\nwhat the chip says');
ok(SF.wordsOf(tri, 'b').length === 0, 'a neutral tri row contributes nothing to the chip');
is('a narrowed one contributes its word', SF.wordsOf(tri, 'c')[0], 'C');
is('and a multi row contributes each lit word', SF.wordsOf(many, ['y', 'x']).join(' '), 'Y X');

console.log('\nthe date floors — days back from now, never "since Sunday"');
const NOW = 1e12;
is('Today is one day back', SF.sinceMs('today', NOW), NOW - 86400000);
is('This week is seven', SF.sinceMs('week', NOW), NOW - 7 * 86400000);
is('This month is thirty', SF.sinceMs('month', NOW), NOW - 30 * 86400000);
is('and no chip lit is NO floor at all', SF.sinceMs('', NOW), 0);
is('as is a value nobody knows', SF.sinceMs('decade', NOW), 0);

console.log('\nquality, read off the filed caption');
is('the house caption', SF.qualityOf('gpt-image-2 · medium · 2K'), 'medium');
is('a style half that says so', SF.qualityOf('Dreamy · high · 4K'), 'high');
is('a picture whose caption never said stays UNKNOWN — never guessed',
  SF.qualityOf('from evan-film'), '');
is('and a word that merely contains one is not a quality',
  SF.qualityOf('a highlight on her cheek'), '');
// The near-twin in /playground-port.js answers the same question for the
// port's own routing. They are pinned together so a reword of one cannot
// silently leave the other reading a different ladder.
const PORT = require('../public/playground-port.js');
['gpt-image-2 · medium · 2K', 'Dreamy · high · 4K', 'from evan-film', 'a highlight on her cheek']
  .forEach((cap) => {
    ok(SF.qualityOf(cap) === PORT.matchQuality('', cap),
      'the port reads the same quality off ' + JSON.stringify(cap));
  });

// ── 2. HEADLESS ───────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.log('\n(playwright-core not installed — pure half only)'); process.exit(failed ? 1 : 0); }

const PUB = path.join(__dirname, '..', 'public');
const DAY = 86400000;
const now = Date.now();
const RUNS = [
  { id: 'r1', status: 'done', prompt: 'a low one from today', quality: 'low',
    createdAt: now - 3600e3, aspectRatio: '2:3', gptStyle: 'dreamy',
    images: [{ url: '/img1.png' }], votes: {} },
  { id: 'r2', status: 'done', prompt: 'a high one from today', quality: 'high',
    createdAt: now - 7200e3, aspectRatio: '2:3', gptStyle: 'dreamy',
    images: [{ url: '/img2.png' }], votes: {} },
  { id: 'r3', status: 'done', prompt: 'a high one from last month', quality: 'high',
    createdAt: now - 20 * DAY, aspectRatio: '2:3', gptStyle: 'dreamy',
    images: [{ url: '/img3.png' }], votes: {} },
];
const ASSETS = [
  { chat: 'a-chat', name: 'A chat', url: '/a1.png', description: 'one — today, medium',
    prompt: 'gpt-image-2 · medium · 2K', created: new Date(now - 3600e3).toISOString() },
  { chat: 'a-chat', name: 'A chat', url: '/a2.png', description: 'two — today, high',
    prompt: 'gpt-image-2 · high · 4K', created: new Date(now - 7200e3).toISOString() },
  { chat: 'b-chat', name: 'B chat', url: '/a3.png', description: 'three — old, high',
    prompt: 'gpt-image-2 · high · 4K', created: new Date(now - 20 * DAY).toISOString() },
];
// A 1x1 png, so every tile really decodes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/promptlab/styles') return json({ styles: [], gpt: {} });
  if (url.pathname === '/api/promptlab/build') return json({ build: 'test' });
  if (url.pathname === '/api/promptlab/characters') return json({ characters: [] });
  if (url.pathname === '/api/promptlab') return json({ runs: RUNS, more: false });
  if (url.pathname === '/api/gallery/assets/all') return json({ assets: ASSETS, total: ASSETS.length, offset: 0, limit: 150 });
  // The derived-thumb service — a tile whose thumb 404s marks itself broken
  // and HIDES, which is indistinguishable from a filter hiding it.
  if (url.pathname === '/api/story/thumb') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname.startsWith('/api/')) return json({ ok: true, assets: [], runs: [], votes: {} });
  if (url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  if (url.pathname === '/assets') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'assets.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(PNG);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: exe }); }

  // ---- the Playground -----------------------------------------------------
  console.log('\nTHE PLAYGROUND');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/playground');
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 3);
    const runs = () => page.$$eval('#runs .run', (es) => es.length);
    // THE DOOR IS ON THE CONTROLS ROW (2026-09-02, Sophie marked the spot:
    // "put the filter button where the pink mark was") — not the feed bar,
    // which got its ♥/✕ pair back in the same breath.
    const chip = '#feedfilters .filtchip';
    const drawerShown = () => page.locator('#feedfilters .filtdrawer').isVisible();

    // OPT IN — shut is the resting state.
    ok(!(await drawerShown()), 'the drawer is SHUT until she taps the chip');
    // THE CHIP IS THE SIFTER GLYPH — no word at rest, just the funnel.
    is('and it says nothing while nothing is narrowed', (await page.textContent(chip)).trim(), '');
    ok(await page.$(chip + ' svg') !== null, 'the door is the sifter glyph, not a word');
    is('and it still names itself to a screen reader',
      await page.$eval(chip, (n) => n.getAttribute('aria-label')), 'Filters');
    await page.click(chip);
    ok(await drawerShown(), 'tapping it opens the drawer');

    // The three rows she asked for, in one drawer.
    const rows = await page.$$eval('#feedfilters .filtrow .filtlab', (es) => es.map((e) => e.textContent));
    ok(rows.join('|') === 'Quality|When',
      'two rows: the quality ladder and the date — got ' + rows.join('|'));
    // THE MARKS ARE NOT IN HERE — they are back on the feed bar, as loose
    // buttons, which is where she put them.
    ok((await page.$$('#feedfilters .filtcbtn[data-v="like"]')).length === 0,
      'and the ♥ is NOT in the drawer');
    ok(await page.isVisible('#v-liked') && await page.isVisible('#v-hidex'),
      '…it is on the feed bar with the ✕, where it was');
    // The door sits in the CONTROLS card, in the gap she marked, and the
    // Generate cluster is still hard right of it.
    const spot = await page.evaluate(() => {
      const c = document.querySelector('#feedfilters .filtchip').getBoundingClientRect();
      const g = document.querySelector('.gogroup').getBoundingClientRect();
      return { inCard: !!document.querySelector('.controls #feedfilters'),
        beforeGo: c.right <= g.left + 1,
        sameLine: Math.abs(c.top - g.top) < 2 };
    });
    ok(spot.inCard, 'the door is on the CONTROLS row, not the feed bar');
    ok(spot.beforeGo && spot.sameLine,
      'and it sits in the gap this row already had, left of Generate');

    // QUALITY really hides runs, and it is a MEASUREMENT of the feed.
    is('all three runs to start', await runs(), 3);
    await page.click('#feedfilters .filtcbtn[data-v="high"]');
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);
    is('High alone leaves the two high runs', await runs(), 2);
    await page.click('#feedfilters .filtcbtn[data-v="low"]');
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 3);
    is('low AND high together is all three — a ladder, not a radio', await runs(), 3);
    await page.click('#feedfilters .filtcbtn[data-v="low"]');
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);

    // DATE, stacking with it.
    await page.click('#feedfilters .filtcbtn[data-v="today"]');
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 1);
    is('and "Today" over it leaves the one high run from today', await runs(), 1);

    // ---- THE SIZES ARE THE ROW'S, MEASURED (2026-09-02, Sophie: "how the
    // fuck did u decide the button sizes"). Every control in this drawer is
    // the house 34px, and the chip matches the view switch it stands beside —
    // which is the only honest way to answer that question.
    const sizes = await page.evaluate(() => {
      const h = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height);
      return { chip: h('#feedfilters .filtchip'), pick: h('#feedfilters .filtcbtn'),
        // `#qpick` is a gpt-only control and this fixture opens on the LoRA
        // tile, so the neighbours asked are the two that are always on the row.
        prompt: h('#promptbtn'), go: h('.gogroup .go'), tri: h('.feedbar') };
    });
    // THE DOOR TAKES ITS ROW'S HEIGHT, whatever that is — no number of its
    // own, so it can never be the one control on the row that is a size
    // nothing else is. Asserted as an EQUALITY against its neighbours rather
    // than against a constant, which is what makes it survive the row moving.
    ok(sizes.chip === sizes.prompt && sizes.chip === sizes.go,
      'the door is exactly its neighbours\' height — chip ' + sizes.chip +
      ', Prompt ' + sizes.prompt + ', generate ' + sizes.go);
    ok(sizes.tri <= 48, 'and the feed bar is still one line (' + sizes.tri + 'px)');
    // Inside the drawer the chips are the house 34 — the height of the
    // three-way toggles they sit beside there.
    ok(sizes.pick === 34, 'a filter chip in the drawer is 34px — got ' + sizes.pick);

    // ---- TAPPING OUT CLOSES IT (her ask) — and the tap still does its own
    // job, because nothing is swallowed and no overlay is put in the way.
    ok(await drawerShown(), 'still open before the tap-out');
    await page.mouse.click(20, 700);
    await page.waitForTimeout(150);
    ok(!(await drawerShown()), 'a tap on the feed closes the drawer');
    await page.click(chip);
    ok(await drawerShown(), 'and the chip still opens it again');

    // THE CHIP WEARS THE STATE while the drawer is shut — a filter she cannot
    // see must never be one she has forgotten she set.
    await page.click(chip);
    ok(!(await drawerShown()), 'tapping the chip again shuts it');
    // THE CHIP COUNTS, it does not spell (2026-09-02, Sophie: "change to # of
    // filters" — two spelled-out filters wrapped it onto a line of its own and
    // pushed the search box down).
    const worn = (await page.textContent(chip)).trim();
    is('and the chip says HOW MANY are on', worn, '2');
    ok(await page.$eval(chip, (n) => n.classList.contains('on')), 'lit, too');
    // NOT RED (her ask the same message): the rose belongs to the marks inside
    // the drawer, not to the door. Measured off what really renders, because a
    // class name says nothing about the colour.
    const lit = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('#feedfilters .filtchip'));
      const m = getComputedStyle(document.querySelector('#feedfilters .filtcbtn[data-v="high"]'));
      return { chip: c.borderTopColor + '|' + c.color, mark: m.backgroundColor };
    });
    ok(!/194, 90, 114/.test(lit.chip),
      'the lit door is not the rose — got ' + lit.chip);
    ok(/194, 90, 114/.test(lit.mark),
      '…while a lit ♥ chip inside still is — got ' + lit.mark);

    // Tapping the lit chip clears that filter — no second "off" control.
    await page.click(chip);
    await page.click('#feedfilters .filtcbtn[data-v="today"]');
    await page.click('#feedfilters .filtcbtn[data-v="high"]');
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 3);
    is('tapping each lit chip clears it and the whole feed is back', await runs(), 3);

    // STICKY — the marks were, and the two new rows are too, so a reload comes
    // back where she left it. (The two mark keys are the ones this page has
    // always written: moving the buttons must not reset a filter she left on.)
    await page.click('#feedfilters .filtcbtn[data-v="high"]');
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);
    is('a reload comes back still narrowed', await runs(), 2);
    ok(!(await drawerShown()), '…with the drawer shut, and the chip saying so');
    is('and the chip counts it after the reload', (await page.textContent(chip)).trim(), '1');

    // The emptied list says WHICH filter emptied it.
    await page.click(chip);
    await page.click('#feedfilters .filtcbtn[data-v="high"]');
    await page.click('#feedfilters .filtcbtn[data-v="medium"]');
    await page.waitForFunction(() => /Nothing at that quality/.test(document.getElementById('runs').textContent));
    ok(true, 'an emptied feed names the filter that emptied it, never "nothing here"');
    await page.click('#feedfilters .filtcbtn[data-v="medium"]');
    await page.close();
  }

  // ---- Meta Assets --------------------------------------------------------
  console.log('\nMETA ASSETS');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/assets');
    await page.waitForFunction(() => document.querySelectorAll('.assetgrid .acell').length === 3);
    const shown = () => page.$$eval('.assetgrid .acell',
      (es) => es.filter((e) => e.style.display !== 'none').length);
    const chip = '.arow .filtchip';

    ok(!(await page.locator('.arow .filtdrawer').isVisible()), 'the drawer is SHUT here too');
    await page.click(chip);
    const rows = await page.$$eval('.arow .filtrow .filtlab', (es) => es.map((e) => e.textContent));
    ok(rows.join('|') === 'Quality|When', 'the same two rows — got ' + rows.join('|'));
    // …and the New · ♥ · Hide ✕ segment is back beside the door, where it was.
    ok((await page.$$('.arow .afilter button')).length === 3,
      'the mark segment is back on the row, not in the drawer');

    is('all three pictures to start', await shown(), 3);
    await page.click('.arow .filtcbtn[data-v="high"]');
    is('High leaves the two whose CAPTION says high', await shown(), 2);
    await page.click('.arow .filtcbtn[data-v="today"]');
    is('and Today over it leaves the one from today', await shown(), 1);

    // TAPPING OUT CLOSES IT HERE TOO — and here the drawer is IN FLOW, so the
    // close MOVES the grid. That is why it closes on the CLICK rather than on
    // pointerdown: the tap has to land on what she aimed at first, and the
    // page may only move once it has. (The pointerdown version is caught by
    // `test-assets-tap-next.js`, which simply stops being able to open a tile
    // once the ♥ filter has narrowed the grid — verified. This assertion is
    // the behaviour; that one is the regression.)
    // …with the filters cleared first, so the tile she aims at is on screen.
    await page.click('.arow .filtcbtn[data-v="today"]');
    await page.click('.arow .filtcbtn[data-v="high"]');
    is('everything back', await shown(), 3);
    ok(await page.locator('.arow .filtdrawer').isVisible(), 'open before the tap-out');
    await page.click('.assetgrid .acell:nth-child(1) > button:not(.vote)');
    await page.waitForSelector('#clightbox .clwrap img');
    ok(!(await page.locator('.arow .filtdrawer').isVisible()),
      'a tap outside closes the drawer');
    // The picture ITSELF, not the caption: the whole risk is opening the WRONG
    // one because the grid moved under the tap.
    ok(/a1\.png/.test(await page.$eval('#clightbox .clwrap img', (n) => n.src)),
      '…and the tap still opened the picture she aimed at, not whatever slid up');
    await page.evaluate(() => window.__assetLightboxClose && window.__assetLightboxClose());
    await page.waitForTimeout(150);
    await page.click(chip);

    // MARKS STAY EXCLUSIVE — three answers to one question, in their own
    // segment on the row.
    await page.click('.afilter button[data-f="new"]');
    await page.click('.afilter button[data-f="like"]');
    const lit = await page.$$eval('.afilter button.on', (es) => es.map((e) => e.dataset.f));
    ok(lit.length === 1 && lit[0] === 'like',
      'picking a second mark REPLACES the first — got ' + lit.join(','));
    await page.click('.afilter button[data-f="like"]');

    // NOT STICKY here, deliberately: this is a place she arrives to look at
    // everything, and a filter left on from last week silently hiding most of
    // her library is what the chip's state-wearing exists to stop.
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.assetgrid .acell').length === 3);
    is('a reload opens on the whole library', await shown(), 3);
    is('and the chip is back to saying nothing',
      (await page.textContent(chip)).trim(), '');

    // The drawer is IN FLOW here, so it can never cover the search box or the
    // first row of pictures — measured with elementFromPoint, which is the
    // only honest way to ask what a tap reaches.
    await page.click(chip);
    const reach = await page.evaluate(() => {
      const hit = (sel) => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        const e = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 20));
        return !!(e && (e === el || el.contains(e)));
      };
      return { search: hit('.asearch input'), tile: hit('.assetgrid .acell') };
    });
    ok(reach.search, 'the open drawer does not cover the search box');
    ok(reach.tile, 'nor the first picture');
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(failed ? '\n' + failed + ' FAILED' : '\nAll good.');
  process.exitCode = failed ? 1 : 0;
})();

#!/usr/bin/env node
// Drive the real /chunking page against a running server: the pill contract,
// the empty search box, the four-across shelf, client/server grammar parity,
// and the lightbox's freeze-and-restore. Free — nothing here generates.
//
//   node scripts/test-clips-page.js
//   FORGE_BASE=http://localhost:3000 node scripts/test-clips-page.js
//
// Needs a server that can reach Firebase and a headless Chromium; SKIPS
// cleanly when either is missing (the house page-test policy).
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'http://localhost:3399';

let failed = 0;
const ok = (good, msg) => { console.log(`${good ? 'ok  ' : 'FAIL'} ${msg}`); if (!good) failed++; };

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.log('SKIP — playwright is not installed'); process.exit(0);
}
const CHROMES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CHROMES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const hit = fs.readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-'));
      const p = hit && path.join('/opt/pw-browsers', hit, 'chrome-linux', 'chrome');
      return p && fs.existsSync(p) ? p : null;
    } catch (_) { return null; }
  })();
if (!chrome) { console.log('SKIP — no Chromium found (set CHROME_PATH to run)'); process.exit(0); }

(async () => {
  let shelf;
  try {
    const st = await fetch(BASE + '/api/clips/status').then((r) => r.json());
    if (!st.firebase) { console.log(`SKIP — the server at ${BASE} has no Firebase`); process.exit(0); }
    shelf = await fetch(BASE + '/api/clips').then((r) => r.json());
  } catch (e) {
    console.log(`SKIP — no server at ${BASE} (${e.message})`); process.exit(0);
  }

  const b = await chromium.launch({ executablePath: chrome });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e.message)));
  // The main checks run with the tour already seen; the tour has its own pass below.
  await pg.addInitScript(() => localStorage.setItem('clips.tourSeen', '1'));

  await pg.goto(BASE + '/chunking?embed=1', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelectorAll('#shelf .clip').length > 0
    || !document.getElementById('stateline').hidden, null, { timeout: 15000 }).catch(() => {});

  // ── the pill contract ────────────────────────────────────────────────
  ok(await pg.evaluate(() => typeof window.__scrollTap === 'function'),
    'the injected pill survived the page script (no global collision)');
  ok(await pg.evaluate(() => ['--paper', '--chg', '--ink2', '--rose', '--ink'].every(
    (t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim())),
  'all five pill tokens are defined on :root');

  // ── the four page rules ──────────────────────────────────────────────
  ok(await pg.locator('.tool-eyebrow').evaluate((el) => getComputedStyle(el).display === 'none'),
    'embedded, the page does not repeat the title (the native bar carries it)');
  ok(await pg.locator('#q').evaluate((el) => !el.placeholder && !el.value),
    'the search box ships empty — no example text, not even a placeholder');
  ok(await pg.locator('#helpcard').isHidden(), 'the explanation hides behind the "?"');
  await pg.locator('#help').click();
  ok(await pg.locator('#helpcard').isVisible(), '…and the "?" shows it');
  // Dispatched on the element, not aimed at a coordinate: the chunks-first
  // shelf can be shorter than the viewport, so a point near the bottom lands
  // on <html> rather than on the page.
  await pg.evaluate(() => document.body.click());
  ok(await pg.locator('#helpcard').isHidden(), '…and any tap closes it');

  const cols = await pg.locator('#shelf').evaluate((el) =>
    getComputedStyle(el).gridTemplateColumns.split(' ').length);
  ok(cols === 4, `the shelf is four to a row (${cols})`);

  // Compare against a fetch made now, not at startup — and while a harvest is
  // RUNNING the library legitimately grows between any two reads, so the check
  // tolerates a small drift then (it is exact when the library is at rest).
  shelf = await fetch(BASE + '/api/clips').then((r) => r.json());
  const harvesting = await fetch(BASE + '/api/clips/harvest').then((r) => r.json())
    .then((h) => h.job && h.job.status === 'running').catch(() => false);
  // ── chunks are the default view; clips are one tap away ──────────────
  const chunks = (shelf.clips || []).filter((c) => !c.hidden && c.kind === 'chunk');
  const atoms = (shelf.clips || []).filter((c) => !c.hidden && c.kind !== 'chunk');
  const chipText = await pg.locator('#kinds .chip').allTextContents();
  ok(chipText[0] === 'chunks' && await pg.locator('#kinds .chip.on').textContent() === 'chunks',
    `it opens on chunks, not on everything (chips: ${chipText.join(' / ')})`);
  ok(!chipText.includes('scenes') && !chipText.includes('bridges'),
    'the atomic kinds are one pile called clips, not five chips');
  const shown = await pg.locator('#shelf .clip').count();
  ok(shown === chunks.length, `only the chunks are on screen (${shown}/${chunks.length})`);
  ok(shown < atoms.length, `the ${atoms.length} clips stay out of the way until asked`);
  await pg.locator('#kinds .chip', { hasText: 'clips' }).click();
  await pg.waitForTimeout(200);
  const tiles = await pg.locator('#shelf .clip').count();
  ok(harvesting ? Math.abs(tiles - atoms.length) <= 3 : tiles === atoms.length,
    `tapping clips shows them (${tiles}/${atoms.length}`
    + (harvesting ? ', harvest running)' : ')'));
  if (!tiles) {
    console.log('(empty library — the search and lightbox checks need a harvest first)');
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close(); return done();
  }

  // ── search: the page must answer exactly like the server ─────────────
  for (const q of ['kind:scene', 'dream OR quick', 'the -bridge', '"dream bridge"']) {
    const server = await fetch(BASE + '/api/clips?q=' + encodeURIComponent(q))
      .then((r) => r.json());
    const serverN = (server.clips || []).filter((c) => !c.hidden && c.kind !== 'chunk').length;
    await pg.locator('#q').fill(q);
    await pg.waitForTimeout(300);
    const clientN = await pg.locator('#shelf .clip').count();
    ok(harvesting ? Math.abs(clientN - serverN) <= 3 : clientN === serverN,
      `"${q}" — page and server agree (${clientN}${harvesting ? ', harvest running' : ''})`);
  }
  await pg.locator('#q').fill('zzqxxjw');
  await pg.waitForTimeout(300);
  ok(await pg.locator('#shelf .clip').count() === 0
    && /nothing matches/i.test(await pg.locator('#stateline').textContent()),
  'a miss says "Nothing matches" instead of showing an empty page');
  // A hit that lives in the OTHER pile is offered rather than being a dead end.
  const chunkWord = chunks.length ? (chunks[0].title || '').split(/\s+/).filter((w) => w.length > 4)[0] : '';
  if (chunkWord) {
    await pg.locator('#q').fill(chunkWord);
    await pg.waitForTimeout(300);
    const hint = await pg.locator('#stateline').textContent();
    ok(/in chunks/.test(hint), `a search that only hits chunks offers them ("${hint.trim()}")`);
    await pg.locator('#stateline button').click();
    await pg.waitForTimeout(200);
    ok(await pg.locator('#kinds .chip.on').textContent() === 'chunks',
      'and tapping it switches the pile');
    await pg.locator('#kinds .chip', { hasText: 'clips' }).click();
    await pg.waitForTimeout(200);
  }
  await pg.locator('#clearq').click();
  await pg.waitForTimeout(300);
  ok(await pg.locator('#shelf .clip').count() === tiles, 'the ✕ clears the search');

  // ── the tiles are SQUARE even with no picture, and nothing hides under
  //    the pill (both were live bugs, found by measuring) ────────────────
  const geo = await pg.evaluate(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width, h: b.height, r: b.right }; };
    const ph = document.querySelector('#shelf .clip .ph');
    const pill = document.querySelector('.vseg');
    return {
      ph: box(ph),
      pillLeft: pill.getBoundingClientRect().left,
      rightmost: ['#help', '#q', '#kinds'].map((s) => box(document.querySelector(s)).r),
    };
  });
  ok(Math.abs(geo.ph.w - geo.ph.h) < 2,
    `a tile is square whatever its poster does (${Math.round(geo.ph.w)}x${Math.round(geo.ph.h)})`);
  ok(geo.rightmost.every((r) => r <= geo.pillLeft + 0.5),
    `no control runs under the pill (edges ${geo.rightmost.map(Math.round).join(',')} vs pill at ${Math.round(geo.pillLeft)})`);

  // ── cream, and a pill that matches it ────────────────────────────────
  const paint = await pg.evaluate(() => {
    const seg = document.querySelector('.vseg');
    const cs = seg && getComputedStyle(seg);
    return {
      body: getComputedStyle(document.body).backgroundColor,
      pillBg: cs && cs.backgroundColor,
      pillInk: cs && cs.borderTopColor,
    };
  });
  ok(paint.body === 'rgb(250, 246, 238)', `the page is cream, not white (${paint.body})`);
  ok(paint.pillBg === paint.body,
    `the pill wears the same cream as the page (${paint.pillBg})`);
  ok(paint.pillInk === 'rgb(58, 53, 48)',
    `and its ink is the page's, not the injected near-black (${paint.pillInk})`);

  // ── back to top ──────────────────────────────────────────────────────
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForTimeout(150);
  ok(await pg.locator('#totop').isHidden(), 'no back-to-top at the top of the page');
  await pg.evaluate(() => window.scrollTo(0, 900));
  await pg.waitForTimeout(200);
  ok(await pg.locator('#totop').isVisible(), 'it appears once there is a scroll worth undoing');
  const corner = await pg.locator('#totop').boundingBox();
  ok(corner.y > 600, `it sits at the BOTTOM, clear of the pill's corner (y=${Math.round(corner.y)})`);
  await pg.locator('#totop').click();
  await pg.waitForTimeout(700);
  ok(await pg.evaluate(() => window.scrollY) === 0, 'and it goes back to the top');

  // ── the lightbox freezes the page and restores the exact spot ────────
  await pg.evaluate(() => window.scrollTo(0, 300));
  await pg.waitForTimeout(100);
  const y = await pg.evaluate(() => window.scrollY);
  // Click via the DOM — locator.click() would scroll the tile into view first,
  // moving the very position this check is about.
  await pg.evaluate(() => {
    const tiles = document.querySelectorAll('#shelf .clip');
    tiles[Math.min(12, tiles.length - 1)].click();
  });
  await pg.waitForTimeout(200);
  ok(await pg.locator('#lb.open').count() === 1, 'tapping a clip opens it');
  ok(await pg.evaluate(() => document.body.style.overflow === 'hidden'),
    'the page behind is locked');
  ok(await pg.locator('#lbVideo').evaluate((el) => Boolean(el.src)), 'the clip is loaded to play');
  await pg.locator('#lbClose').click();
  await pg.waitForTimeout(200);
  ok(await pg.evaluate((was) => document.body.style.overflow === '' && window.scrollY === was, y),
    'closing restores the scroll to the exact spot');
  ok(await pg.locator('#lbVideo').evaluate((el) => !el.getAttribute('src')),
    'and tears the video down so the download stops');

  // ── the tour: first visit offers it, Skip remembers, tap-through works ──
  const pg2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg2.goto(BASE + '/chunking?embed=1', { waitUntil: 'domcontentloaded' });
  await pg2.waitForFunction(() => !document.getElementById('tourAsk').hidden, null, { timeout: 15000 })
    .catch(() => {});
  ok(await pg2.locator('#tourAsk').isVisible(), 'a first visit offers the tour');
  ok(await pg2.locator('#tourSkip').textContent() === 'Skip tutorial', 'with a Skip tutorial button');
  await pg2.locator('#tourGo').click();
  await pg2.waitForTimeout(150);
  ok(await pg2.locator('#tour').isVisible() && await pg2.locator('#tourAsk').isHidden(),
    'Show me dims the page and spotlights the first control');
  ok(/Search everything/.test(await pg2.locator('#tourText').textContent()),
    'the first tip is the search bar');
  ok(await pg2.evaluate(() => document.body.style.overflow === 'hidden'),
    'the page behind the tour is locked');
  const nTips = await pg2.evaluate(() => 4);
  for (let i = 0; i < nTips; i++) { await pg2.locator('#tour').click(); await pg2.waitForTimeout(120); }
  ok(await pg2.locator('#tour').isHidden(), 'tapping through the tips ends the tour');
  ok(await pg2.evaluate(() => document.body.style.overflow === ''), 'and unlocks the page');
  ok(await pg2.evaluate(() => localStorage.getItem('clips.tourSeen') === '1'),
    'the tour is remembered — it never nags twice');
  await pg2.reload({ waitUntil: 'domcontentloaded' });
  await pg2.waitForTimeout(1200);
  ok(await pg2.locator('#tourAsk').isHidden(), 'a return visit goes straight to the shelf');
  await pg2.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  done();

  function done() {
    console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} failed` : '\nthe page works');
    process.exit(failed ? 1 : 0);
  }
})();

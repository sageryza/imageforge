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
  await pg.locator('body').click({ position: { x: 20, y: 800 } });
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
  const visible = (shelf.clips || []).filter((c) => !c.hidden);
  const tiles = await pg.locator('#shelf .clip').count();
  ok(harvesting ? Math.abs(tiles - visible.length) <= 3 : tiles === visible.length,
    `every un-hidden clip is on the shelf (${tiles}/${visible.length}`
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
    const serverN = (server.clips || []).filter((c) => !c.hidden).length;
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
  await pg.locator('#clearq').click();
  await pg.waitForTimeout(300);
  ok(await pg.locator('#shelf .clip').count() === tiles, 'the ✕ clears the search');

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

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  done();

  function done() {
    console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} failed` : '\nthe page works');
    process.exit(failed ? 1 : 0);
  }
})();

#!/usr/bin/env node
// Drive the real /vector page: trace a picture, pick it, recolour it.
//
//   node scripts/test-vector-page.js            # against a local server
//   FORGE_BASE=http://localhost:3000 node scripts/test-vector-page.js
//
// This is the page flow END TO END against the REAL routes — not a stub. The
// trace half is free and the recolour half is free, so the whole run spends
// nothing; the one paid path (drawing a sheet) is deliberately not exercised.
//
// It needs a server that can reach Firebase, and a headless Chromium. Both are
// optional here, so it SKIPS rather than failing when either is missing — the
// same policy as the other page tests.
//
// The picture it traces is one of the committed Gravity Lock fixtures, so this
// needs no set-up and no credential of its own.
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'http://localhost:3399';
const FIXTURES = path.join(__dirname, '..', 'docs', 'gravity-lock', 'trace-fixtures.json');

let failed = 0;
const ok = (good, msg) => { console.log(`${good ? 'ok  ' : 'FAIL'} ${msg}`); if (!good) failed++; };

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.log('SKIP — playwright is not installed'); process.exit(0);
}

// Playwright's bundled-browser number drifts ahead of what this image actually
// carries, so never rely on its default — find a real binary the way the other
// page tests do, and skip when there isn't one.
const CHROMES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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
  try {
    const st = await fetch(BASE + '/api/vector/status').then((r) => r.json());
    if (!st.tracer || !st.firebase) {
      console.log(`SKIP — the server at ${BASE} has tracer=${st.tracer} firebase=${st.firebase}`);
      process.exit(0);
    }
  } catch (e) {
    console.log(`SKIP — no server at ${BASE} (${e.message})`);
    process.exit(0);
  }

  const src = Object.values(JSON.parse(fs.readFileSync(FIXTURES, 'utf8')))[0];
  const b = await chromium.launch({ executablePath: chrome });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e.message)));

  await pg.goto(BASE + '/vector?embed=1', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(400);

  ok(await pg.locator('#s1.open').count() === 1, 'it opens on step 1, and only step 1 shows its controls');
  ok(await pg.locator('#s2 .body').isVisible() === false, 'the later steps are collapsed');

  // The star belongs to the ONE control that spends money, and nothing else.
  ok(await pg.locator('.btn.star').count() === 1, 'exactly one starred button — the sheet, the only paid call');
  ok(await pg.locator('#trace').evaluate((el) => !el.classList.contains('star')),
    'tracing is not starred: it is free');

  // Typing descriptions must price them before she taps anything.
  await pg.locator('#cells').fill('a teacup\na kettle');
  await pg.waitForTimeout(120);
  const price = await pg.locator('#cost').textContent();
  ok(/2 drawings/.test(price) && /¢/.test(price), `the cost is shown before the tap — "${price.trim()}"`);

  // ── trace a real picture (free) ───────────────────────────────────────
  await pg.locator('#mTrace').click();
  await pg.locator('#urls').fill(src);
  await pg.locator('#trace').click();

  await pg.waitForFunction(() => document.querySelectorAll('#items .cell').length > 0, null,
    { timeout: 180000 }).catch(() => {});
  const cells = await pg.locator('#items .cell').count();
  ok(cells === 1, `the traced drawing arrived as a tile (${cells})`);
  if (!cells) { await b.close(); return done(); }

  await pg.waitForFunction(() => document.querySelector('#s2.open'), null, { timeout: 30000 }).catch(() => {});
  ok(await pg.locator('#s2.open').count() === 1, 'it moves her to step 2 when the job finishes');

  // ── the colour boxes ──────────────────────────────────────────────────
  await pg.locator('#items .cell').first().click();
  await pg.waitForTimeout(300);
  ok(await pg.locator('#s3.open').count() === 1, 'picking a drawing opens the colours step');

  const slots = await pg.locator('#slots .slot').count();
  ok(slots >= 3, `one box per colour, plus the line and the paper (${slots})`);

  const filled = await pg.locator('#slots .slot').evaluateAll((els) =>
    els.filter((e) => /^#[0-9a-f]{6}$/i.test(e.querySelector('input[type=text]').value)).length);
  ok(filled === slots - 2, `every colour box is prefilled with its hex (${filled}), line and paper deliberately blank`);

  // A NAME, not a hex — the thing she asked to be able to type.
  await pg.locator('#slots .slot').first().locator('input[type=text]').fill('cornflowerblue');
  const before = await pg.locator('#imgB').getAttribute('src');
  await pg.locator('#apply').click();
  await pg.waitForFunction((was) => {
    const el = document.getElementById('imgB');
    return el && el.src && el.src !== was;
  }, before, { timeout: 120000 }).catch(() => {});
  const after = await pg.locator('#imgB').getAttribute('src');
  ok(after && after !== before, 'a colour NAME recolours the drawing');
  ok(/free/.test(await pg.locator('#st3').textContent() || ''), 'and it says the recolour was free');

  // An unknown name is refused, and the box that caused it is marked.
  await pg.locator('#slots .slot').first().locator('input[type=text]').fill('dusty rose');
  await pg.locator('#apply').click();
  await pg.waitForTimeout(2500);
  ok(await pg.locator('#slots .slot.bad').count() === 1, 'an unknown colour name marks its own box');
  ok(/dusty rose/.test(await pg.locator('#st3').textContent() || ''), 'and says which word it could not read');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  done();

  function done() {
    console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} failed` : '\nthe page works end to end');
    process.exit(failed ? 1 : 0);
  }
})();

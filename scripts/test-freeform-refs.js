#!/usr/bin/env node
/* FREEFORM'S REFERENCE WALL — the fold, the attached strip, and the order
   (Aug 2026, Sophie: "there's like a whole wall of suggested references in the
   Freeform tool. Can you get rid of them or put them behind a recently used
   button?").

   MEASURED BEFORE THE FIX: 17 references on file, painted as uniform squares
   four to a row ABOVE the prompt box — five rows, most of a phone screen to
   scroll past before reaching the words. Nothing about that wall was suggested
   or recent; it was every reference ever uploaded, newest-first.

   THE THREE THINGS THIS PINS.
   1. The grid is FOLDED at load and the button says how many are behind it.
   2. WHAT IS ATTACHED IS NEVER HIDDEN. The tick on a tile used to be the only
      thing saying which references a run would carry, so folding the grid away
      without the strip would mean drawing blind — and attaching is what the
      wall was FOR.
   3. The order is most-recently-USED, falling back to upload date, which is
      what makes `Recently used` an honest label rather than a rename.

   Run: node scripts/test-freeform-refs.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

// ── the order rule, pure ───────────────────────────────────────────────────
{
  const { refOrder } = require('../freeform');
  const ids = (l) => refOrder(l).map((r) => r.id);
  ok('most recently USED leads, however old the upload',
    ids([{ id: 'old-but-used', createdAt: 1, lastUsedAt: 900 },
      { id: 'new', createdAt: 500 }])[0] === 'old-but-used');
  ok('a never-used ref still sorts by upload date',
    JSON.stringify(ids([{ id: 'a', createdAt: 1 }, { id: 'c', createdAt: 9 },
      { id: 'b', createdAt: 5 }])) === '["c","b","a"]');
  ok('a ref with no dates at all is last, not dropped',
    ids([{ id: 'blank' }, { id: 'dated', createdAt: 3 }]).join() === 'dated,blank');
  const input = [{ id: 'a', createdAt: 1 }, { id: 'b', createdAt: 2 }];
  refOrder(input);
  ok('the caller\'s array is not re-ordered under it', input[0].id === 'a');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { chromium = null; }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// 17 references — the number she was actually looking at.
const REFS = Array.from({ length: 17 }, (_, i) => ({
  id: 'r' + i, name: 'ref ' + i,
  url: 'https://example.invalid/r' + i + '.png',
  thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
}));

function serve() {
  return http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/freeform') {
      const h = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      res.setHeader('content-type', 'text/html'); return res.end(h);
    }
    if (p === '/api/freeform/refs') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ refs: REFS }));
    }
    if (p === '/api/freeform/runs') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ runs: [] }));
    }
    res.statusCode = 404; res.end('{}');
  });
}

(async () => {
  if (!chromium) {
    console.log('freeform refs: playwright not installed — the page half skipped');
  } else {
    const srv = serve();
    await new Promise((r) => srv.listen(0, r));
    const port = srv.address().port;
    const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    await pg.goto('http://127.0.0.1:' + port + '/freeform', { waitUntil: 'load' });
    await pg.waitForFunction(() => document.querySelectorAll('.ref').length > 0);

    const shown = (s) => pg.evaluate((sel) => {
      const e = document.querySelector(sel); if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: r.width, h: r.height, d: getComputedStyle(e).display, y: r.y };
    }, s);

    // 1 — the wall is folded, and the prompt box is near the top of the page
    ok('the library grid is not painted on screen at load',
      !(await shown('.refs')) || (await shown('.refs')).h === 0);
    const tog = await shown('#reftog');
    ok('the Recently used button is there instead', !!tog && tog.h > 0);
    ok('it says how many are behind it', /Recently used \(17\)/.test(
      await pg.evaluate(() => (document.getElementById('reftog') || {}).textContent || '')));
    const promptY = ((await shown('#prompt')) || { y: 9999 }).y;
    ok('the prompt box is on the first screen (it was ~5 rows down)', promptY < 400);

    // 2 — opening it shows all 17, four to a row
    if (await pg.$('#reftog')) await pg.click('#reftog');
    await pg.waitForTimeout(80);
    ok('tapping it opens the whole library', (await shown('.refs')).h > 0);
    ok('every reference is there', (await pg.$$('.ref')).length === 17);
    ok('aria-expanded says so', await pg.evaluate(() => {
      const t = document.getElementById('reftog');
      return !!t && t.getAttribute('aria-expanded') === 'true';
    }));

    // 3 — what is attached is never hidden
    if (await pg.$('.ref#ref-r3 img')) await pg.click('.ref#ref-r3 img');
    await pg.waitForTimeout(50);
    ok('attaching one lights its tile', await pg.evaluate(() => {
      const t = document.getElementById('ref-r3');
      return !!t && t.classList.contains('on');
    }));
    ok('and it appears in the attached strip', (await pg.$$('#refpicked .pk')).length === 1);
    if (await pg.$('#reftog')) await pg.click('#reftog');   // fold the library again
    await pg.waitForTimeout(80);
    ok('folding the library keeps the attached strip on screen',
      (await shown('.refs')).h === 0 && (await pg.$$('#refpicked .pk')).length === 1);
    ok('the run still carries it while the grid is closed',
      await pg.evaluate(() => Object.keys(picked).join()) === 'r3');

    // 4 — tapping the strip takes it off, and the tile agrees when reopened
    if (await pg.$('#refpicked .pk')) await pg.click('#refpicked .pk');
    await pg.waitForTimeout(50);
    ok('tapping the attached thumb detaches it', (await pg.$$('#refpicked .pk')).length === 0);
    if (await pg.$('#reftog')) await pg.click('#reftog');
    await pg.waitForTimeout(80);
    ok('the tile is unlit again', await pg.evaluate(() => {
      const t = document.getElementById('ref-r3');
      return !!t && !t.classList.contains('on');
    }));

    await browser.close(); srv.close();
  }

  console.log(fails.length ? `FAIL ${fails.length}/${pass + fails.length}` : `ok ${pass}/${pass}`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
})();

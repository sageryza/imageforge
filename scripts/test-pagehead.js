#!/usr/bin/env node
/* THE PAGE OWNS ITS HEADER INSIDE THE APP — headless, against the real
   public/pagehead.js and the real public/tool.css (Aug 2026, Sophie: "yes,
   definitely pick B … get rid of the apple native bar").

   Two states have to hold, because the two halves ship at different times:
   the web half with a deploy, the Swift half with a TestFlight build.

     • OLD BUILD (no `window.__forgeLeave`): nothing changes. No chevron, no
       body class, the page looks exactly as it does today. This is the one
       that matters most — it is what is on her phone until a build lands.
     • NEW BUILD (the bridge injected): the page draws the row — a back
       chevron at the head of its own header, its title visible again, and
       the chevron walks __navBack → history → leave the tool.

   Run: node scripts/test-pagehead.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', 'public');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('pagehead: playwright not installed — skipped');
    process.exit(0);
  }
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

const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
const is = (what, got, want) => ok(`${what}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`,
  JSON.stringify(got) === JSON.stringify(want));

/* A page in the tool.css kit, the shape every wrapped tool has: a sticky head
   holding the eyebrow title and the "?", and its own #back that hides itself
   when chrome outside the content owns back. */
const page = (bridge) => `<!doctype html>
<link rel="stylesheet" href="/tool.css">
<body class="tool">
<div class="head">
  <button id="back" hidden aria-label="back">‹</button>
  <div class="eyebrow tool-eyebrow">CUTTING ROOM</div>
  <button id="help">?</button>
</div>
<main style="height:1200px">content</main>
<script>
  ${bridge ? `
  window.__nativeNavBar = true;
  window.__forgeNative = true;
  window.__leftTheTool = false;
  window.__forgeLeave = function () { window.__leftTheTool = true; };` : ''}
  // the page's own rule, unchanged: hide my back when outer chrome owns it
  if (window.__nativeNavBar) document.body.classList.add('native');
  document.getElementById('back').hidden = !!window.__nativeNavBar;
  // a two-level page: the first back closes the open recording
  window.__open = true;
  window.__navBack = function () { if (window.__open) { window.__open = false; return true; } return false; };
</script>
<script src="/pagehead.js" defer></script>`;

const server = http.createServer((req, res) => {
  const r = req.url.split('?')[0];
  if (r === '/tool.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    return res.end(fs.readFileSync(path.join(PUB, 'tool.css')));
  }
  if (r === '/pagehead.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, 'pagehead.js')));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(page(r === '/new'));
});

(async () => {
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const base = await new Promise((r) => server.listen(0, '127.0.0.1',
    () => r(`http://127.0.0.1:${server.address().port}`)));
  const open = async (route) => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(base + route, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(350);
    return p;
  };

  // ── THE BUILD SHE HAS TODAY IS UNTOUCHED ────────────────────────────────
  {
    const p = await open('/old');
    is('no bridge → no chevron drawn', await p.locator('#forgeback').count(), 0);
    is('…and no body class', await p.evaluate(() => document.body.className), 'tool');
    await p.close();
  }

  // ── THE BUILD THAT HANDS THE HEADER OVER ────────────────────────────────
  {
    const p = await open('/new');
    is('the chevron is drawn', await p.locator('#forgeback').count(), 1);
    is('…as the FIRST thing in the page\'s own header row',
      await p.evaluate(() => document.querySelector('.head').firstElementChild.id), 'forgeback');
    is('…and the page is marked', await p.evaluate(() => document.body.classList.contains('pagehead')), true);

    // the title the nav bar used to carry comes back
    is('the page\'s own title is visible again',
      await p.evaluate(() => getComputedStyle(document.querySelector('.tool-eyebrow')).display), 'block');
    // and the page's own back stays hidden — never two chevrons
    is('the page\'s own back control stays hidden',
      await p.evaluate(() => document.getElementById('back').hidden), true);

    // it is really tappable, at its own centre — "visible" is not the question
    is('the tap actually reaches it', await p.evaluate(() => {
      const r = document.getElementById('forgeback').getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(el && el.closest('#forgeback'));
    }), true);

    // ── THE ORDER: the page's own levels first, the tool last ─────────────
    await p.locator('#forgeback').click();
    await p.waitForTimeout(60);
    is('first tap steps the PAGE back a level',
      await p.evaluate(() => [window.__open, window.__leftTheTool]), [false, false]);

    await p.evaluate(() => { window.history.pushState({}, '', '#x'); });
    await p.locator('#forgeback').click();
    await p.waitForTimeout(80);
    is('with nothing left in the page, it walks history, not out of the tool',
      await p.evaluate(() => window.__leftTheTool), false);

    // ── AT THE BOTTOM OF HISTORY WITH ENTRIES AHEAD, IT STILL LEAVES ──────
    // (Aug 2026, Sophie: "the back button doesn't work either, or doesn't go
    // anywhere" — the Review Queue after a deck round-trip sits at history
    // index 0 with length 2, where history.back() is a silent no-op. The
    // depth stamp on history.state is what tells 'been somewhere and came
    // back' apart from 'somewhere to go back to'.)
    await p.waitForTimeout(120);   // let the popstate from the walk land
    is('back at the first entry, the walk restored its depth stamp',
      await p.evaluate(() => (window.history.state || {}).__forgeDepth), 0);
    await p.locator('#forgeback').click();
    await p.waitForTimeout(80);
    is('…so the chevron leaves the tool instead of reading as dead',
      await p.evaluate(() => window.__leftTheTool), true);

    // ── THE HEADER PATTERN (Aug 2026, Sophie's screenshots) ───────────────
    is('the chevron wears a small rounded box, not a bare glyph',
      await p.evaluate(() => {
        const s = getComputedStyle(document.getElementById('forgeback'));
        return [s.borderRadius, s.borderTopWidth !== '0px'];
      }), ['6px', true]);
    ok('the title sits in the top middle of the screen',
      await p.evaluate(() => {
        const r = document.querySelector('.tool-eyebrow').getBoundingClientRect();
        const mid = r.left + r.width / 2;
        return Math.abs(mid - 195) < 8;   // centre of a 390pt viewport
      }));
    ok('…and the "?" stays on the right of the row',
      await p.evaluate(() => {
        const r = document.getElementById('help').getBoundingClientRect();
        return r.left > 260;
      }));
    await p.close();
  }

  // ── A PAGE WHOSE __navBack THROWS MUST NOT TRAP HER ─────────────────────
  {
    const p = await open('/new');
    await p.evaluate(() => {
      window.__navBack = function () { throw new Error('page bug'); };
      window.history.replaceState({}, '', location.pathname);   // nothing to go back to
    });
    await p.locator('#forgeback').click();
    await p.waitForTimeout(80);
    ok('a throwing page handler still lets her out of the tool',
      await p.evaluate(() => window.__leftTheTool === true || window.history.length > 1));
    await p.close();
  }

  // ── A PAGE WITH NO HEADER ROW STILL GETS A WAY OUT ──────────────────────
  {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.setContent('<body><script>window.__forgeLeave=function(){window.__left=1};</script>'
      + '<div id="barecontent" style="height:900px">bare</div>'
      + `<script>${fs.readFileSync(path.join(PUB, 'pagehead.js'), 'utf8')}</script>`);
    await p.waitForTimeout(200);
    // It used to FLOAT (position:fixed) — and on every row-less page whose
    // content starts at the top it sat ON the title (measured 2026-08-23:
    // films, instagram, the wall, the drop pages). It rides an in-flow row
    // (#forgehead) at the very top now, so content flows below it and it can
    // never cover anything.
    is('it rides an in-flow row rather than vanishing or floating',
      await p.evaluate(() => {
        const b = document.getElementById('forgeback');
        if (!b) return null;
        const row = b.parentElement;
        return row.id === 'forgehead' && row.parentElement === document.body
          && getComputedStyle(b).position !== 'fixed' ? 'in-flow' : 'wrong';
      }), 'in-flow');
    is('and the page content sits below it, never under it',
      await p.evaluate(() => {
        const row = document.getElementById('forgehead').getBoundingClientRect();
        const content = document.getElementById('barecontent').getBoundingClientRect();
        return content.top >= row.bottom - 1;
      }), true);
    await p.close();
  }

  await browser.close();
  server.close();
  if (fails.length) {
    console.error(`pagehead: ${fails.length} FAILED, ${pass} passed\n`);
    fails.forEach((f) => console.error(`  ✗ ${f}\n`));
    process.exit(1);
  }
  console.log(`pagehead: all ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });

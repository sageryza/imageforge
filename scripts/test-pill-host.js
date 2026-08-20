#!/usr/bin/env node
/* THE PILL SURVIVES ITS HOST — headless, against the real public/pill-inject.html
   and the real public/compare.css (Aug 2026, Sophie: "it's still the wrong pill …
   it looks different" · "it should be a conditional pill that only appears if
   there's actually content to scroll").

   THE BUG THIS PINS. A Compare page's pill is INJECTED — the server appends
   pill-inject.html to a page it has never met — so every property the pill
   leaves unset is a hole the host falls through. compare.css declares
   `button, .btn{…border-radius:6px…}` at specificity (0,0,1); `.vseg button`
   out-specifies it for everything it DECLARES, but it never declared a radius,
   so the 6px stood and each of the three segments became its own rounded box.
   Measured by diffing every computed property of the pill alone against the
   same markup with only compare.css added: FOUR properties moved it —
   border-radius (0 → 6px), box-sizing (the host's `*{border-box}` pulled the
   1.5px stroke inside, 50px → 48), line-height (#spd 12px → 17px, so the whole
   pill grew 5px) and the buttons' font.

   AND THE PALETTE IS READ FROM THE HOST NOW, not baked onto `.float`. The
   injected copy used to carry its own colours plus a dark block, which a host
   could only beat by out-specifying (`body .float{…}` — ten hand-synced lines
   in compare.css). `var(--x, fallback)` instead: the host's `:root` wins by
   itself, a page with no tokens still gets the studio cream, and a cream page
   on a dark phone stays cream.

   Run: node scripts/test-pill-host.js
   Sibling: scripts/test-review-page.js, scripts/test-brief-page.js (each
   asserts the pill on its own real page). */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', 'public');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('pill host: playwright not installed — skipped');
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

const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const doc = (body, withCss) => '<!doctype html>'
  + (withCss ? '<link rel="stylesheet" href="/compare.css">' : '')
  + '<body>' + body + PILL;

const PAGES = {
  // a host that both styles buttons and scrolls — the Compare page's shape
  '/host': doc('<div style="height:3000px"></div>', true),
  // nothing to scroll: the pill has no job here
  '/short': doc('<div style="height:120px"></div>', true),
  // content arrives late, the way every page in this app loads it
  '/grows': doc('<div id="g" style="height:120px"></div>', true)
    + '<script>setTimeout(function(){document.getElementById("g").style.height="3000px";},400);</script>',
  // no tokens at all — the fallback palette has to hold
  '/bare': doc('<div style="height:3000px"></div>', false),
  // a host that opts out entirely
  '/nopill': '<!doctype html><meta name="forge-pill" content="off">'
    + '<body><div style="height:3000px"></div>' + PILL,
};

const server = http.createServer((req, res) => {
  const r = req.url.split('?')[0];
  if (r === '/compare.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    return res.end(fs.readFileSync(path.join(PUB, 'compare.css')));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(PAGES[r] || PAGES['/host']);
});

const readPill = (page) => page.evaluate(() => {
  const f = document.querySelector('.float');
  if (!f) return { gone: true };
  const seg = f.querySelector('.vseg');
  const btn = f.querySelector('.vseg button');
  const spd = document.getElementById('spd');
  const cs = getComputedStyle(f); const sg = getComputedStyle(seg); const bt = getComputedStyle(btn);
  return {
    shown: cs.display !== 'none',
    rad: bt.borderTopLeftRadius,
    segW: Math.round(seg.getBoundingClientRect().width),
    spdH: Math.round(spd.getBoundingClientRect().height),
    paper: cs.getPropertyValue('--paper').trim(),
    segBg: sg.backgroundColor,
    ink: sg.borderTopColor,
    boxSizing: sg.boxSizing,
  };
});

(async () => {
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const base = await new Promise((r) => server.listen(0, '127.0.0.1',
    () => r(`http://127.0.0.1:${server.address().port}`)));
  const open = async (route, scheme) => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 },
      colorScheme: scheme || 'light' });
    await p.goto(base + route, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(600);
    return p;
  };

  // ── THE HOST CANNOT REACH IN ────────────────────────────────────────────
  {
    const p = await open('/host');
    const pill = await readPill(p);
    is('the segments are SQUARE — the capsule is one control, not three boxes',
      pill.rad, '0px');
    is('the capsule keeps its 48px interior, stroke outside (compare.css\'s '
      + '*{border-box} used to pull it in)', pill.segW, 50);
    is('…which is the pill\'s own box-sizing, not the host\'s',
      pill.boxSizing, 'content-box');
    is('the speed label keeps its own line-height', pill.spdH, 12);
    ok('and it is shown, because this page scrolls', pill.shown === true);
    await p.close();
  }

  // ── THE PALETTE COMES FROM THE HOST'S :root, WITH A FALLBACK ────────────
  {
    const p = await open('/host');
    const pill = await readPill(p);
    is('it wears the host page\'s paper', pill.paper, '#faf6ee');
    is('…really painted, not just declared', pill.segBg, 'rgb(250, 246, 238)');
    await p.close();
  }
  {
    // the bug that started this: a cream page on a dark phone drew a
    // near-black pill, because the injected copy carried its own dark block
    const p = await open('/host', 'dark');
    const pill = await readPill(p);
    is('a cream page stays cream on a dark phone', pill.segBg, 'rgb(250, 246, 238)');
    await p.close();
  }
  {
    const p = await open('/bare');
    const pill = await readPill(p);
    is('a page that defines no tokens still gets the studio cream',
      pill.segBg, 'rgb(246, 242, 233)');
    is('…and the studio ink', pill.ink, 'rgb(38, 34, 28)');
    await p.close();
  }

  // ── CONDITIONAL: ONLY WHEN THERE IS SOMETHING TO SCROLL ─────────────────
  {
    const p = await open('/short');
    is('nothing to scroll → no pill', (await readPill(p)).shown, false);
    await p.close();
  }
  {
    // THE CHECK MUST KEEP WATCHING. Almost every page here fetches its content
    // after it loads, so a check at load would hide the pill on nearly all of
    // them — this is the assertion that would fail if it ever became one-shot.
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(base + '/grows', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(200);
    is('short at load → hidden', (await readPill(p)).shown, false);
    await p.waitForTimeout(700);
    is('content arrives → it comes back', (await readPill(p)).shown, true);
    // and back again when the content goes away
    await p.evaluate(() => { document.getElementById('g').style.height = '120px'; });
    await p.waitForTimeout(400);
    is('content goes away → it leaves again', (await readPill(p)).shown, false);
    await p.close();
  }

  // ── THE OPT-OUT STILL WINS ─────────────────────────────────────────────
  {
    const p = await open('/nopill');
    is('forge-pill off removes it outright', (await readPill(p)).gone, true);
    is('…and the hooks are still callable',
      await p.evaluate(() => [typeof window.__scrollStop, typeof window.__pillSync]),
      ['function', 'function']);
    await p.close();
  }

  await browser.close();
  server.close();
  if (fails.length) {
    console.error(`pill host: ${fails.length} FAILED, ${pass} passed\n`);
    fails.forEach((f) => console.error(`  ✗ ${f}\n`));
    process.exit(1);
  }
  console.log(`pill host: all ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });

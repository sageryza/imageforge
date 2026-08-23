#!/usr/bin/env node
/* FREEFORM'S HEADER AND ITS AUTOSCROLL PILL — headless, against the real
   public/freeform.html, the real public/pagehead.js and the real injected
   public/pill-inject.html (Aug 2026, Sophie: "the scroll bar and header are
   broken in freeform").

   TWO BUGS, BOTH MEASURED BEFORE THE FIX.

   1. THE HEADER. The page had no header ELEMENT at all — an .eyebrow div and
      a bare <h1>, nothing pagehead.js recognises — so on the new build it fell
      to its last resort and FLOATED the back chevron at (4,10), on top of her
      own title, and `?embed=1` had no `.app-header` to hide so the old build
      showed the title twice (Apple's bar and the page's). It wears the
      Playground's header band now: one row the chevron goes INTO.

   2. THE PILL. Every button on it was dead. `.vseg button` is a <button>, so
      the page's document-level tap handler called it interactive and stopped
      the scroll play had just started, in the same click — and moving the test
      to `.float` was not enough on its own, because paintPill replaces the
      button's innerHTML the instant the scroll starts, so the tapped <polygon>
      is DETACHED by the time the click bubbles and closest() finds no `.float`
      above it. The question is asked at pointerdown now, per gesture, the way
      chats.html asks its own skip list.

   Run: node scripts/test-freeform-page.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', 'public');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('freeform page: playwright not installed — skipped');
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

// The page as the SERVER assembles it (server.js serveGated + the ?embed=1
// rule + pagehead.js + the injected pill) — never a hand-made copy of it.
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const EMBED = '<style>body.embed .app-header,body.embed .tool-eyebrow{display:none !important}</style>'
  + '<script>if(!window.__forgeLeave)document.body.classList.add("embed")</script>';
// enough runs that the page is genuinely taller than the phone — the pill
// hides itself when there is nothing to scroll, which is correct and would
// make every assertion below vacuous
const RUNS = [];
for (let i = 0; i < 8; i += 1) {
  RUNS.push({ id: 'r' + i, prompt: 'a prompt long enough to fill the card '.repeat(3),
    quality: 'medium', size: 'portrait', status: 'done', images: [], refs: [], outputs: 1 });
}

function serve() {
  return http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/freeform') {
      let h = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      if (/embed=1/.test(req.url)) h += EMBED;
      h += '<script src="/pagehead.js" defer></script>' + PILL;
      res.setHeader('content-type', 'text/html'); return res.end(h);
    }
    if (p === '/api/freeform/refs') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ refs: [] })); }
    if (p === '/api/freeform/runs') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ runs: RUNS })); }
    const f = path.join(PUB, p);
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.setHeader('content-type', path.extname(f) === '.js' ? 'text/javascript' : 'text/css');
      return res.end(fs.readFileSync(f));
    }
    res.statusCode = 404; res.end('{}');
  });
}

const box = (el) => (el ? { x: Math.round(el.x), y: Math.round(el.y), w: Math.round(el.w), h: Math.round(el.h), d: el.d } : null);

(async () => {
  const srv = serve();
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const url = (q) => 'http://127.0.0.1:' + port + '/freeform' + (q || '');
  const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});

  const open = async (opts) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    // the bridge is the feature flag — its presence IS the new build
    if (opts.bridge) await pg.addInitScript(() => { window.__forgeLeave = () => { window.__left = true; }; });
    await pg.goto(url(opts.embed ? '?embed=1' : ''), { waitUntil: 'load' });
    await pg.waitForTimeout(400);
    return { ctx, pg };
  };
  const geom = (pg) => pg.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, d: getComputedStyle(e).display }; };
    return { back: g('#forgeback'), head: g('.app-header'), h1: g('h1'), lede: g('.lede'),
      float: g('.float'), chevronInRow: !!document.querySelector('.app-header #forgeback') };
  });
  const playing = (pg) => pg.evaluate(() => document.getElementById('vmid').classList.contains('on'));

  // ── the new build: the app hid Apple's bar, so the page draws the header ──
  {
    const { ctx, pg } = await open({ bridge: true, embed: true });
    const g = await geom(pg);
    ok('the chevron sits INSIDE the header row, not floating over the title',
      g.chevronInRow && g.back && g.head && g.back.y >= g.head.y - 1 && g.back.y + g.back.h <= g.head.y + g.head.h + 1);
    ok('the title is shown on the new build', !!g.h1 && g.h1.d !== 'none' && g.h1.w > 0);
    ok('the title clears the chevron', !!(g.h1 && g.back) && g.h1.x >= g.back.x + g.back.w);
    ok('the header reserves the pill\'s corner', !!(g.h1 && g.float) && g.h1.x + g.h1.w <= g.float.x);
    ok('the page\'s first paragraph is below the header',
      !!(g.lede && g.head) && g.lede.y >= g.head.y + g.head.h - 1);
    ok('the pill shows while the page has something to scroll', !!g.float && g.float.d !== 'none');

    // THE PILL'S THREE BUTTONS ACTUALLY WORK
    await pg.click('#vmid'); await pg.waitForTimeout(700);
    ok('play starts the autoscroll', await playing(pg));
    ok('the page actually moves', await pg.evaluate(() => window.scrollY) > 4);
    await pg.evaluate(() => { window.__scrollStop(); window.scrollTo(0, 0); });
    await pg.click('#vbot'); await pg.waitForTimeout(600);
    ok('the down arrow scrolls too', await playing(pg) && await pg.evaluate(() => window.scrollY) > 4);
    // and the page's own gesture still behaves
    await pg.mouse.click(195, 700); await pg.waitForTimeout(250);
    ok('a tap on the page stops it', !(await playing(pg)));
    await pg.evaluate(() => window.__scrollStart(1)); await pg.waitForTimeout(150);
    await pg.click('#quality', { force: true }); await pg.waitForTimeout(200);
    ok('a tap on a control stops it', !(await playing(pg)));
    ok('the lightbox is closed', await pg.evaluate(() => getComputedStyle(document.getElementById('lb')).display) === 'none');
    await ctx.close();
  }

  // ── the older build: Apple's bar carries the name — never two titles ──
  {
    const { ctx, pg } = await open({ bridge: false, embed: true });
    const st = await pg.evaluate(() => { const h = document.querySelector('.app-header');
      return { head: h ? getComputedStyle(h).display : 'MISSING',
        back: !!document.getElementById('forgeback') }; });
    ok('the old build hides the page\'s own title (it has an .app-header to hide)', st.head === 'none');
    ok('the old build draws no chevron of its own', st.back === false);
    await ctx.close();
  }

  // ── a plain browser: the page owns its header and nothing is injected ──
  {
    const { ctx, pg } = await open({ bridge: false, embed: false });
    const st = await pg.evaluate(() => { const h = document.querySelector('.app-header');
      return { head: h ? getComputedStyle(h).display : 'MISSING',
        back: !!document.getElementById('forgeback') }; });
    ok('the web keeps the page\'s own title', st.head === 'flex');
    ok('the web draws no chevron', st.back === false);
    await ctx.close();
  }

  await browser.close();
  srv.close();
  if (fails.length) { console.log('FREEFORM PAGE — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FREEFORM PAGE — ' + pass + ' passed');
})();

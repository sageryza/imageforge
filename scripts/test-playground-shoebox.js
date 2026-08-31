#!/usr/bin/env node
/*
 * test-playground-shoebox.js — THE THIRD SHOEBOX DOOR (2026-08-29, Sophie:
 * "how do i send a picture to shoebox in the playground").
 *
 * She could not. The Story Room's beat popup has had an Add-to-Shoebox since
 * 2026-08-28 and Meta Assets got one the same day — and the tool she actually
 * DRAWS in had none, so keeping a Playground picture meant hearting it, going
 * to Meta Assets, finding it again and adding it there.
 *
 * Three things this asks that a source assertion cannot:
 *
 *   1. WHAT THE REQUEST CARRIES. The title becomes the polaroid's title in
 *      her Memory Library, so it has to be HER WORDS — the picture's content
 *      half, which on a panels run is THAT panel's own line, never the style
 *      wrapper and never the MODEL · QUALITY caption.
 *   2. THE RECEIPT. This button walks nowhere, so a tap that worked and a tap
 *      that did nothing look identical without one.
 *   3. THE TWO DOORS DO NOT SHARE A GLYPH. The share mark was the Story Room
 *      WALK's here; it belongs to the Shoebox (the other two doors wear it),
 *      so the walk took the Story Room's own tile glyph. Two buttons in one
 *      row drawn identically is the failure to avoid, and it is invisible to
 *      every label assertion.
 *
 *   node scripts/test-playground-shoebox.js
 *   (needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC',
  'base64');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('playwright not installed — skipped (npm install playwright --no-save)');
    process.exit(0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  if (fs.existsSync(path.join(root, 'chromium'))) return path.join(root, 'chromium');
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const now = Date.now();
const RUNS = [
  // An ordinary single picture: her words are the whole content half.
  { id: 'plain', status: 'done', engine: 'gptimage', prompt: 'meat raining from the ceiling',
    fullPrompt: 'HOUSE PREFIX\n\nmeat raining from the ceiling\n\nHOUSE SUFFIX',
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'medium', size: '1024x1536',
    aspectRatio: '2:3', res: '1k', outputs: 1, images: ['/shot.png'],
    createdAt: now },
  // A PANELS run: picture 1's title must be panel 1's own line, not the
  // whole sheet's prompt.
  { id: 'panels', status: 'done', engine: 'gptimage', kind: 'panels', grid: 2,
    prompt: 'the top one\n\nthe bottom one',
    panels: ['the top one', 'the bottom one'],
    fullPrompt: 'GRID SENTENCE\n\nthe top one\n\nthe bottom one\n\nHOUSE SUFFIX',
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'medium', size: '2336x3504',
    aspectRatio: '2:3', res: '4k', outputs: 2, images: ['/shot.png', '/shot.png'],
    createdAt: now - 1000 },
];

const posts = [];
function serve() {
  const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
  return http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/shot.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/api/scratchpad/shoebox-url') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { /* recorded as null */ }
        posts.push(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: 'sb-fake', url: (parsed || {}).url }));
      });
    }
    if (url.pathname === '/api/promptlab/characters') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ characters: [], max: 6 }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {
          dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX', suffix: 'HOUSE SUFFIX',
                    characterLine: '', refs: [] },
        },
      }));
    }
    if (url.pathname === '/api/promptlab') {
      // The two galleries ask separately — the Picture tab for kind=single and
      // the Panels tab's own sweep for kind=panels — so the stub has to honour
      // the param or the panels run never reaches the page at all.
      const kind = url.searchParams.get('kind');
      const runs = RUNS.filter((r) => (kind === 'panels' ? r.kind === 'panels'
        : kind === 'single' ? r.kind !== 'panels' : true));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs, more: false }));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
}

const tapPicture = async (page, runId, n) => {
  const hit = await page.evaluate(({ id, idx }) => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const hits = imgs.filter((im) => {
      const box = im.closest('[data-id],[data-run]');
      return box && (box.getAttribute('data-id') === id || box.getAttribute('data-run') === id);
    });
    if (!hits[idx]) return false;
    hits[idx].click();
    return true;
  }, { id: runId, idx: n || 0 });
  await page.waitForTimeout(350);
  return hit;
};

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(base + '/playground', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.selectOption('#stylepick', 'dreamy');
  await page.waitForTimeout(300);

  // ── the door exists, and it does not look like its neighbour ───────
  console.log('\nthe door exists');
  ok(await tapPicture(page, 'plain'), 'tapping the picture opens the lightbox');
  ok(await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display === 'flex';
  }), 'the lightbox is up');

  const labels = () => page.evaluate(() => Array.from(
    document.querySelectorAll('#clightbox .lbacts button'))
    .map((b) => b.getAttribute('aria-label') || ''));
  const acts = await labels();
  ok(acts.some((l) => /add to shoebox/i.test(l)),
    'the actions row carries Add to Shoebox');
  ok(acts.some((l) => /story room/i.test(l)),
    'and the Story Room walk is still there beside it');

  // TWO BUTTONS DRAWN IDENTICALLY IS THE BUG NO LABEL ASSERTION SEES. The
  // share mark belongs to the Shoebox (the Story Room's beat popup and Meta
  // Assets both wear it); the walk wears the Story Room's own tile glyph.
  const glyphs = await page.evaluate(() => {
    const out = {};
    Array.from(document.querySelectorAll('#clightbox .lbacts button')).forEach((b) => {
      const svg = b.querySelector('svg');
      out[(b.getAttribute('aria-label') || '').toLowerCase()] = svg ? svg.innerHTML.trim() : '';
    });
    return out;
  });
  const shoeGlyph = glyphs['add to shoebox'];
  const roomGlyph = glyphs['send to the story room'];
  ok(!!shoeGlyph && !!roomGlyph && shoeGlyph !== roomGlyph,
    'the two doors are drawn differently');
  ok(/polyline points="16 6 12 2 8 6"/.test(shoeGlyph || ''),
    'the Shoebox wears the square-and-arrow-up its two sibling doors wear');

  // ── what the request carries ────────────────────────────────
  console.log('\nwhat the request carries');
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#clightbox .lbacts button'))
      .find((x) => /add to shoebox/i.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  ok(posts.length === 1, 'one tap sends one request');
  const p1 = posts[0] || {};
  ok(/\/shot\.png$/.test(String(p1.url || '')),
    'it names the picture she is looking at');
  ok(p1.title === 'meat raining from the ceiling',
    'the title is HER WORDS — the content half, not the caption and not the wrapper');
  ok(!/HOUSE PREFIX|HOUSE SUFFIX/.test(String(p1.title || '')),
    'nothing of the style wrapper rides in the title');
  ok(p1.source === 'playground', 'and it says which door it came through');

  // ── the receipt ────────────────────────────────────────────
  // This button walks nowhere, so without a mark a tap that worked and a tap
  // that did nothing render identically.
  console.log('\nthe receipt');
  const litBg = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#clightbox .lbacts button'))
      .find((x) => /add to shoebox/i.test(x.getAttribute('aria-label') || ''));
    return b ? getComputedStyle(b).backgroundColor : '';
  });
  ok(litBg === 'rgb(58, 53, 48)', 'the button lights once it has landed');
  ok(await page.evaluate(() => {
    const t = document.getElementById('toast');
    return !!t && /shoebox/i.test(t.textContent || '');
  }), 'and it says so');

  // ── a panel's title is that PANEL's line ────────────────────────
  // The whole sheet's prompt is every panel's words joined, so filing that as
  // one panel's title puts the wrong sentence on the polaroid.
  console.log("\na panel's title is that panel's own line");
  await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    if (lb) lb.click();
  });
  await page.waitForTimeout(250);
  await page.click('#t-panels');
  await page.waitForTimeout(600);
  ok(await tapPicture(page, 'panels', 1), 'the second panel opens');
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#clightbox .lbacts button'))
      .find((x) => /add to shoebox/i.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  ok(posts.length === 2, 'the panel sends its own request');
  const p2 = posts[1] || {};
  ok(p2.title === 'the bottom one',
    "panel 2's title is panel 2's line, not the whole sheet's prompt");

  await ctx.close();
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

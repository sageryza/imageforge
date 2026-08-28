#!/usr/bin/env node
/*
 * test-playground-copy-scroll.js — PUTTING A PROMPT BACK MOVES THE SCREEN TO
 * THE BOX (2026-08-28, Sophie: "prompt us back in box shud move screen to
 * box").
 *
 * Every copy path had asked for that scroll since the buttons shipped, and
 * from the LIGHTBOX it never happened. The cause is two house rules meeting:
 * closing an overlay RESTORES the position she opened it from (she closes an
 * image exactly where she opened it), and asset-lightbox.js re-asserts that
 * restore on the NEXT frame — which lands on top of a smooth scroll started in
 * the same tick and cancels it. So the words went into a box she was nowhere
 * near, on the one path where she cannot see the box at all.
 *
 * IT HAS TO BE MEASURED IN A REAL BROWSER: the call was always in the source,
 * so a grep passes against the pre-fix page. The only honest question is where
 * the window ends up a moment after her tap.
 *
 *   node scripts/test-playground-copy-scroll.js
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

// A 3x3 red png — the picture itself does not matter, the page sizes a cell
// from the run's own aspect ratio.
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

// Enough runs that the feed is several screens tall — the whole point is that
// she is somewhere ELSE on the page when she taps.
const now = Date.now();
const RUNS = [];
for (let i = 0; i < 14; i++) {
  RUNS.push({
    id: 'run' + i, status: 'done', engine: 'gptimage',
    prompt: 'a cat on a fence number ' + i,
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1536',
    aspectRatio: '2:3', res: '1k', outputs: 1, images: ['/shot.png'],
    fullPrompt: 'HOUSE PREFIX a cat on a fence number ' + i + ' HOUSE SUFFIX',
    createdAt: now - i * 1000,
  });
}

async function run(browser) {
  const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/shot.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: RUNS, more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {
          dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX ', suffix: ' HOUSE SUFFIX',
                    characterLine: '', refs: [] },
        },
      }));
    }
    if (url.pathname.indexOf('/api/') === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{}');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(base + '/playground', { waitUntil: 'load' });
  await page.waitForSelector('.copybtn[data-copy="run0"]');
  await page.waitForTimeout(400);

  const y = () => page.evaluate(() => window.scrollY);
  // A smooth scroll takes a few frames; give it a real window rather than one
  // tick, and report where it actually settled.
  const settle = async () => {
    let last = -1, same = 0;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(50);
      const v = await y();
      if (v === last) { if (++same > 3) break; } else { same = 0; last = v; }
    }
    return y();
  };
  const scrollDown = async () => {
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(120);
    return y();
  };

  console.log('\nthe page is tall enough to be somewhere else on');
  ok(await page.evaluate(() => document.body.scrollHeight > window.innerHeight * 2),
    'the feed is more than two screens tall');
  ok((await scrollDown()) > 600, 'and she can be scrolled well away from the box');

  console.log('\na run card\'s copy button');
  await page.click('.copybtn[data-copy="run6"]');
  ok((await settle()) === 0, 'the screen moves back to the prompt box');
  ok(await page.evaluate(() => document.getElementById('prompt').value.indexOf('number 6') >= 0),
    'and the words are the ones she tapped');

  console.log('\nthe LIGHTBOX\'s put-it-back action — the path that never moved');
  await scrollDown();
  const openedAt = await y();
  await page.click('#runs img[data-run="run6"]');
  await page.waitForSelector('#clightbox .lbacts button');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() =>
    !!Array.from(document.querySelectorAll('#clightbox .lbacts button'))
      .find((b) => /put this prompt back/i.test(b.getAttribute('aria-label') || '')),
    ), 'the lightbox carries the put-it-back button');
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#clightbox .lbacts button'))
      .find((x) => /put this prompt back/i.test(x.getAttribute('aria-label') || ''));
    b.click();
  });
  const after = await settle();
  ok(after === 0,
    'closing the lightbox and putting the prompt back lands her AT the box'
      + (after === 0 ? '' : ' (settled at ' + after + ', opened at ' + openedAt + ')'));
  ok(await page.evaluate(() => document.getElementById('prompt').value.indexOf('number 6') >= 0),
    'and the words really are in the box she is now looking at');

  console.log('\nthe lightbox\'s own scroll-restore is NOT broken by the fix');
  await page.click('#runs img[data-run="run6"]');
  await page.waitForSelector('#clightbox .lbacts button');
  await page.waitForTimeout(200);
  // Read it AFTER the open: playwright scrolls an element into view before it
  // clicks, so the position the lightbox banked is this one, not the one the
  // test asked for a moment earlier.
  const banked = await y();
  await page.evaluate(() => window.__assetLightboxClose && window.__assetLightboxClose());
  const back = await settle();
  ok(Math.abs(back - banked) < 40,
    'closing it WITHOUT copying still puts her back where she opened it ('
      + back + ' vs ' + banked + ')');

  await ctx.close();
  server.close();
}

(async () => {
  const p = exe();
  const browser = await chromium.launch(p ? { executablePath: p } : {});
  try { await run(browser); } finally { await browser.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();

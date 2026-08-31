#!/usr/bin/env node
/*
 * test-playground-cast-lightbox.js — WHO IS IN THE PICTURE, AND PUTTING THEM
 * BACK (2026-08-29, Sophie: "light box view / characters in playground").
 *
 * Two halves of one gap. Her picked characters have ridden a run and been
 * recorded on its doc (`characters:[{id,name,url}]`) since the picker shipped
 * on 2026-08-27 — and nothing ever read them back:
 *
 *   1. The LIGHTBOX said nothing about them. A picture drawn with a cast was
 *      indistinguishable from one drawn with nobody, except as a sentence
 *      buried in the style half behind the Prompt door.
 *   2. PUTTING THE PROMPT BACK did not put the cast back. The photo reference
 *      has been restored on every copy path since 2026-08-27 ("playground and
 *      other image tools shud save the reference photo and reload when copy to
 *      prompt box"); the characters shipped the same day and were never wired
 *      into it, so a picture drawn with a cast could not be re-run with it.
 *
 * THE HALF THAT IS EASY TO SKIP IS THE CLEAR — copying back a run drawn with
 * NOBODY must put down whoever is picked, or the next run silently carries a
 * paid reference the run she copied never had. A test that only checks the
 * attach passes against a page that never clears.
 *
 * It drives the REAL page in headless Chromium and taps the REAL controls: the
 * restore is a state change across the button's count, the picker's lit cards
 * and the request, and a source assertion cannot see any of it.
 *
 *   node scripts/test-playground-cast-lightbox.js
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
const CHARS = [
  { id: 'c-penny', name: 'Penny', url: '/face.png' },
  { id: 'c-mason', name: 'Mason', url: '/face.png' },
  { id: 'c-jonas', name: 'Jonas', url: '/face.png' },
];
const RUNS = [
  // Drawn WITH two of her characters.
  { id: 'withcast', status: 'done', engine: 'gptimage', prompt: 'Penny and Mason on a roof',
    fullPrompt: 'HOUSE PREFIX\n\nPenny and Mason on a roof\n\nHOUSE SUFFIX',
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1536',
    aspectRatio: '2:3', res: '1k', outputs: 1, images: ['/shot.png'],
    characters: [{ id: 'c-penny', name: 'Penny', url: '/face.png' },
                 { id: 'c-mason', name: 'Mason', url: '/face.png' }],
    createdAt: now },
  // Drawn with NOBODY — what proves the clear.
  { id: 'nocast', status: 'done', engine: 'gptimage', prompt: 'a plain house',
    fullPrompt: 'HOUSE PREFIX\n\na plain house\n\nHOUSE SUFFIX',
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1536',
    aspectRatio: '2:3', res: '1k', outputs: 1, images: ['/shot.png'],
    createdAt: now - 1000 },
];

function serve() {
  const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
  return http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/face.png' || url.pathname === '/shot.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/api/promptlab/characters') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ characters: CHARS, max: 6 }));
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: RUNS, more: false }));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
}

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(base + '/playground', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  // The page opens on the WTR LoRA, which has no attachment slot and so shows
  // no character button at all. Her cast is a gpt-image-2 thing, so stand on a
  // gpt tile — the same tile these runs were drawn on.
  await page.selectOption('#stylepick', 'dreamy');
  await page.waitForTimeout(300);

  // ── the lightbox says who is in it ─────────────────────────────────────
  console.log('\nthe lightbox says who is in it');
  const openLB = async (runId) => {
    await page.evaluate((id) => {
      const card = document.querySelector('[data-run="' + id + '"] img, .runimg[data-run="' + id + '"]');
      if (card) card.click();
    }, runId);
    await page.waitForTimeout(200);
    if (!(await page.evaluate(() => {
      const lb = document.getElementById('clightbox');
      return !!lb && lb.style.display === 'flex';
    }))) {
      // The feed's picture markup differs between views; fall back to the
      // page's own opener, which is what a tap calls.
      await page.evaluate((id) => window.showLB && window.showLB(id, 0), runId);
      await page.waitForTimeout(200);
    }
  };
  // The page keeps showLB private, so open through a real tap on the picture.
  const tapPicture = async (runId) => {
    const hit = await page.evaluate((id) => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const one = imgs.find((im) => {
        const box = im.closest('[data-id],[data-run]');
        return box && (box.getAttribute('data-id') === id || box.getAttribute('data-run') === id);
      });
      if (!one) return false;
      one.click();
      return true;
    }, runId);
    await page.waitForTimeout(300);
    return hit;
  };
  let opened = await tapPicture('withcast');
  if (!opened) await openLB('withcast');
  const lbUp = await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display === 'flex';
  });
  ok(lbUp, 'tapping the picture opens the lightbox');

  const cast = await page.evaluate(() => {
    const row = document.querySelector('#clightbox .clcast');
    if (!row) return null;
    return Array.from(row.querySelectorAll('.clchar')).map((el) => ({
      name: (el.querySelector('span:last-child') || {}).textContent || '',
      loaded: (() => { const im = el.querySelector('img'); return !!im && im.complete && im.naturalWidth > 0; })(),
    }));
  });
  ok(cast && cast.length === 2, 'the cast row names every character that rode the run');
  ok(cast && cast.map((c) => c.name).join(',') === 'Penny,Mason',
    'in the order they were attached — the order the prompt names them in');
  // A face that 404s would draw a broken image beside the name.
  ok(cast && cast.every((c) => c.loaded), 'and every face really decodes');
  // The row is dead space: it must not eat the tap that closes the box.
  ok(await page.evaluate(() => {
    const row = document.querySelector('#clightbox .clcast');
    if (!row) return false;
    const b = row.getBoundingClientRect();
    const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !at || !at.closest('button');
  }), 'nothing in the row is a button — a tap on it still closes the lightbox');

  // ── putting the prompt back puts the cast back ─────────────────────────
  console.log('\nputting the prompt back puts the cast back');
  const castState = () => page.evaluate(() => ({
    badge: (document.getElementById('charsn') || {}).textContent || '',
    lit: document.getElementById('charsbtn').classList.contains('on'),
    prompt: document.getElementById('prompt').value,
  }));
  let before = await castState();
  ok(!before.lit && before.badge === '', 'nobody is picked to start with');

  // The lightbox's own copy action — the path she was pointing at.
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#clightbox .lbacts button'))
      .find((x) => /put this prompt back/i.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  let s = await castState();
  ok(s.prompt === 'Penny and Mason on a roof', 'the prompt lands in the box');
  ok(s.lit && s.badge === '2', 'and the character button lights with the two who rode it');
  // Open the sheet: the cards themselves must be lit, or the count is a
  // number with nothing behind it.
  await page.click('#charsbtn');
  await page.waitForTimeout(400);
  const picked = await page.evaluate(() => Array.from(
    document.querySelectorAll('#charpanel .charcard.on'))
    .map((b) => b.getAttribute('data-id')));
  ok(picked.join(',') === 'c-penny,c-mason', 'the picker has exactly those two lit');
  await page.click('#charsbtn');   // shut it again
  await page.waitForTimeout(200);

  // THE HALF THAT IS EASY TO MISS — a run drawn with nobody clears them.
  await page.click('.copybtn[data-copy="nocast"]');
  await page.waitForTimeout(400);
  s = await castState();
  ok(s.prompt === 'a plain house', 'the second prompt lands');
  ok(!s.lit && s.badge === '',
    'copying back a run drawn with NO cast puts the picked characters down');

  // And back again, so the restore is not a one-shot.
  await page.click('.copybtn[data-copy="withcast"]');
  await page.waitForTimeout(400);
  s = await castState();
  ok(s.lit && s.badge === '2', 'copying back again re-picks them');

  // The across-loads rule is untouched: a cast picked last week must not
  // silently ride today's run.
  const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
  ok(!/localStorage[^\n]*pickedChars|pickedChars[^\n]*localStorage/.test(pageSrc),
    'the picked cast is still NOT persisted across page loads');

  await ctx.close();
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

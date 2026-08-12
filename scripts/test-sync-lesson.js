// Drives the real /witch page in headless Chromium and checks the two Aug 2026
// coincidence-box changes plus the Synchronicity lesson end to end:
//
//   1. "Suspicious coincidence…" sits on ONE line (the old long save label
//      pushed it onto two — Sophie's report).
//   2. The save control reads "Save to book" with nothing saved and flips to
//      "See in book" once a coincidence has been drawn.
//   3. The ⓘ beside the kicker opens the Synchronicity lesson, which taps all
//      the way through (every card, the quiz, the note screen) with no errors.
//
//   node scripts/test-sync-lesson.js
//
// Skips (exit 0) when Playwright or a Chromium build isn't installed, the same
// contract as scripts/test-compare-shell.js.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('skip: playwright not installed'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return null;
  for (const d of fs.readdirSync(base)) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
      const p = path.join(base, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const fails = [];
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails.push(msg); };

(async () => {
  const exe = findChromium();
  if (!exe) { console.log('skip: no chromium build found'); process.exit(0); }

  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/witch') p = '/witch.html';
    const f = path.join(PUB, p);
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    } else { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/witch';

  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));

  // ── 1 + 2: the coincidence head, nothing saved yet ──────────────────────
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const head = await page.evaluate(() => {
    const k = document.querySelector('.coin-head .kicker');
    const cs = getComputedStyle(k);
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const natural = cv.measureText(k.textContent.toUpperCase()).width + (parseFloat(cs.letterSpacing) || 0) * k.textContent.length;
    const r = k.getBoundingClientRect();
    return {
      kickerW: r.width, natural,
      lines: Math.round(r.height / parseFloat(cs.fontSize) / 1.25),
      label: document.querySelector('.coin-saved-lbl').textContent.trim(),
      hasInfo: !!document.getElementById('coin-info'),
      sameRow: Math.abs(document.querySelector('.coin-saved').getBoundingClientRect().top - r.top) < 12,
    };
  });
  ok(head.hasInfo, 'the ⓘ button exists beside the kicker');
  ok(head.kickerW + 1 >= head.natural, `"Suspicious coincidence…" is on one line (box ${Math.round(head.kickerW)}px >= text ${Math.round(head.natural)}px)`);
  ok(head.sameRow, 'the save button still shares the kicker\'s row at 390px');

  // On a narrower phone the SAVE BUTTON wraps to its own line — the phrase
  // itself must still never break, which is the whole point of the fix.
  await page.setViewportSize({ width: 340, height: 800 });
  await page.waitForTimeout(300);
  const narrow = await page.evaluate(() => {
    const k = document.querySelector('.coin-head .kicker');
    const cs = getComputedStyle(k);
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const natural = cv.measureText(k.textContent.toUpperCase()).width + (parseFloat(cs.letterSpacing) || 0) * k.textContent.length;
    return { w: k.getBoundingClientRect().width, natural };
  });
  ok(narrow.w + 1 >= narrow.natural, `the phrase stays on one line at 340px too (box ${Math.round(narrow.w)}px >= text ${Math.round(narrow.natural)}px)`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  ok(head.label === 'Save to book', `unsaved label reads "Save to book" (got "${head.label}")`);

  // Unsaved tap must NOT open an empty book page — it focuses the first box.
  await page.click('#coin-saved');
  await page.waitForTimeout(400);
  const afterUnsavedTap = await page.evaluate(() => ({
    view: document.querySelector('.view.active').id,
    focused: document.activeElement && document.activeElement.id,
  }));
  ok(afterUnsavedTap.view === 'view-home', 'tapping "Save to book" with nothing saved stays on Home');
  ok(afterUnsavedTap.focused === 'coin-0', 'it focuses the first empty coincidence box');

  // ── 2b: with a drawn coincidence on file, the label flips ────────────────
  await page.evaluate(() => {
    localStorage.setItem('witch_coin_done', JSON.stringify({ 0: { desc: 'a test coincidence', v: ['https://example.com/x.png'], i: 0 } }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const savedLabel = await page.evaluate(() => ({
    label: document.querySelector('.coin-saved-lbl').textContent.trim(),
    filled: document.querySelector('.coin-saved').classList.contains('filled'),
  }));
  ok(savedLabel.label === 'See in book', `saved label reads "See in book" (got "${savedLabel.label}")`);
  ok(savedLabel.filled, 'the bookmark is filled once something is saved');

  await page.evaluate(() => localStorage.removeItem('witch_coin_done'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ── 3: the ⓘ opens the lesson, and it taps all the way through ──────────
  await page.click('#coin-info');
  await page.waitForTimeout(600);
  const opened = await page.evaluate(() => {
    const cards = (window.LESSONS && window.LESSONS.sync) || null;
    return {
      lessonOpen: document.getElementById('school-lesson').style.display !== 'none',
      view: document.querySelector('.view.active').id,
      segs: document.querySelectorAll('#deck-prog .deck-seg').length,
      kicker: (document.querySelector('.tcard-kicker') || {}).textContent,
    };
  });
  ok(opened.lessonOpen, 'the ⓘ opens the lesson takeover');
  ok(opened.view === 'view-school', 'it lands on the School view');
  ok(opened.segs === 14, `the lesson has 14 cards (got ${opened.segs})`);
  ok(opened.kicker === 'Synchronicity', `it starts on card 1 (kicker "${opened.kicker}")`);

  // Tap through every card. Quiz cards need their options answered before the
  // stage tap advances, so answer whatever is on screen first.
  const seen = [];
  for (let i = 0; i < 20; i++) {
    const state = await page.evaluate(() => ({
      kicker: (document.querySelector('.tcard-kicker') || {}).textContent || '',
      quiz: !!document.querySelector('.know-opt'),
      note: !!document.querySelector('.deck-note'),
      idx: document.querySelectorAll('#deck-prog .deck-seg.on').length,
    }));
    if (state.note) break;
    seen.push(state.kicker);
    if (state.quiz) {
      // answer + tap the flipped card, once per question
      for (let q = 0; q < 4; q++) {
        const has = await page.evaluate(() => !!document.querySelector('.know-opt'));
        if (!has) break;
        await page.click('.know-opt');
        await page.waitForTimeout(250);
        await page.click('.know-flip');
        await page.waitForTimeout(250);
      }
      continue;
    }
    await page.click('#deck-stage', { position: { x: 300, y: 400 } });
    await page.waitForTimeout(220);
  }
  const end = await page.evaluate(() => ({
    note: !!document.querySelector('.deck-note'),
    cta: !!document.getElementById('deck-cta'),
  }));
  ok(seen.includes('After'), 'the deck reaches the "After" card');
  ok(end.note, 'the lesson ends on the note screen');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

  // ── the last card's CTA goes back to the boxes (the other half of the link)
  await page.evaluate(() => { closeLesson(); go('school'); openLesson('sync'); deckIdx = LESSONS.sync.length - 1; renderDeckCard(); });
  await page.waitForTimeout(400);
  const hasCta = await page.evaluate(() => !!document.getElementById('deck-cta'));
  ok(hasCta, 'the last card carries a CTA button');
  if (hasCta) {
    await page.click('#deck-cta');
    await page.waitForTimeout(700);
    const back = await page.evaluate(() => ({
      view: document.querySelector('.view.active').id,
      closed: document.getElementById('school-lesson').style.display === 'none',
    }));
    ok(back.view === 'view-home' && back.closed, 'the CTA closes the lesson and returns to the coincidence boxes on Home');
  }

  await browser.close();
  srv.close();
  console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

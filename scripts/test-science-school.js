// Drives the REAL /science page in headless Chromium and checks the things
// that break when a deck is wired by hand:
//
//   node scripts/test-science-school.js
//
// Every lesson in LESSONS: it opens, the progress dashes match the card count,
// every card has art or is a quiz, the last card is the "After" card, the deck
// taps all the way through to the end, the ⓘ FAQ opens and closes WITHOUT
// turning the card, and the left edge steps back. No page errors anywhere.
//
// Skips (exit 0) without Playwright or a Chromium build — same contract as
// scripts/test-lesson-deck.js.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('skip: playwright not installed'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
// The notes API, stubbed — the question here is what the PAGE does with it.
const notesStore = {};
let noteWrites = 0;

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
    if (p === '/api/science/notes') {
      const notes = {};
      Object.keys(notesStore).forEach(k => { notes[k] = { text: notesStore[k], at: '2026-08-14T00:00:00Z' }; });
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ notes }));
    }
    if (p === '/api/science/note') {
      let body = '';
      req.on('data', c => { body += c; });
      return req.on('end', () => {
        try {
          const b = JSON.parse(body || '{}');
          noteWrites++;
          if (b.text) notesStore[b.lesson] = b.text; else delete notesStore[b.lesson];
        } catch {}
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
    }
    if (p === '/' || p === '/science') p = '/science.html';
    const f = path.join(PUB, p);
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    } else { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/science';

  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  ok(await page.evaluate(() => typeof window.__sci === 'object'), 'the page boots and exposes its test hooks');

  // The path lists every lesson, and only the built ones are tappable.
  const path0 = await page.evaluate(() => ({
    rows: document.querySelectorAll('#course-list .les').length,
    live: document.querySelectorAll('#course-list [data-lesson]').length,
  }));
  ok(path0.rows >= 1, `the path lists lessons (${path0.rows})`);
  ok(path0.live >= 1, `at least one lesson is tappable (${path0.live})`);

  const keys = await page.evaluate(() => Object.keys(window.__sci.LESSONS));
  for (const key of keys) {
    console.log('\n' + key);
    ok(await page.evaluate(k => !!window.__sci.TITLES[k], key), `"${key}" has a title`);

    const info = await page.evaluate((k) => {
      window.__sci.openLesson(k);
      const cards = window.__sci.cards();
      return {
        n: cards.length,
        segs: document.querySelectorAll('#deck-prog .deck-seg').length,
        noArt: cards.map((c, i) => (!c.img && !c.know) ? i : -1).filter(i => i >= 0),
        lastKicker: cards[cards.length - 1].kicker,
        open: document.getElementById('school-lesson').style.display !== 'none',
        faqIdx: cards.findIndex(c => c.faq),
        knowIdx: cards.findIndex(c => c.know),
      };
    }, key);

    ok(info.open, 'the lesson opens');
    ok(info.segs === info.n, `progress dashes match card count (${info.segs}/${info.n})`);
    ok(info.noArt.length === 0, `every card has art or is a quiz${info.noArt.length ? ' — missing at ' + info.noArt.join(', ') : ''}`);
    ok(info.lastKicker === 'After', `the last card is the "After" card (got "${info.lastKicker}")`);
    ok(info.knowIdx > 0 && info.knowIdx < info.n - 1, `the quiz sits after the facts it tests (card ${info.knowIdx + 1} of ${info.n})`);

    // The ⓘ must open and close without turning the card.
    if (info.faqIdx >= 0) {
      await page.evaluate((i) => { const s = window.__sci; while (s.at() < i) s.next(); while (s.at() > i) s.prev(); }, info.faqIdx);
      await page.waitForTimeout(220);
      const at = await page.evaluate(() => window.__sci.at());
      await page.click('#faq-btn'); await page.waitForTimeout(200);
      const open = await page.evaluate(() => ({ on: document.getElementById('faq-wrap').classList.contains('on'), idx: window.__sci.at() }));
      await page.click('.faq-card'); await page.waitForTimeout(200);
      const shut = await page.evaluate(() => ({ on: document.getElementById('faq-wrap').classList.contains('on'), idx: window.__sci.at() }));
      ok(open.on && !shut.on, 'the ⓘ FAQ opens and closes');
      ok(open.idx === at && shut.idx === at, 'the ⓘ FAQ never turns the card');
    }

    // Tap all the way through, answering the quiz as it comes.
    await page.evaluate((k) => window.__sci.openLesson(k), key);
    await page.waitForTimeout(200);
    let reachedEnd = false;
    for (let i = 0; i < info.n + 10; i++) {
      const st = await page.evaluate(() => ({
        open: document.getElementById('school-lesson').style.display !== 'none',
        quiz: !!document.querySelector('.know-opt'),
      }));
      if (!st.open) { reachedEnd = true; break; }
      if (st.quiz) {
        for (let q = 0; q < 6; q++) {
          if (!await page.evaluate(() => !!document.querySelector('.know-opt'))) break;
          await page.click('.know-opt'); await page.waitForTimeout(180);
          await page.click('.know-flip'); await page.waitForTimeout(180);
        }
        continue;
      }
      await page.click('#deck-stage', { position: { x: 320, y: 400 } });
      await page.waitForTimeout(140);
    }
    ok(reachedEnd, 'the deck taps through to the end and closes');

    // The left edge steps BACK, not forward.
    await page.evaluate((k) => { window.__sci.openLesson(k); window.__sci.next(); }, key);
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => window.__sci.at());
    await page.click('#deck-stage', { position: { x: 20, y: 400 } });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__sci.at());
    ok(after === before - 1, `the left edge steps back (${before} → ${after})`);
    await page.evaluate(() => window.__sci.closeLesson());
    await page.waitForTimeout(120);
  }

  // Every card id the page can ask for must exist as a webp — the same gate
  // scripts/webp-assets-verify.js applies to the witch school art. Checked
  // here only as a NAMING check (no network in the sandbox); the real
  // existence check is the verifier, which must be run before deploying.
  const ids = await page.evaluate(() => Object.values(window.__sci.LESSONS).flat().filter(c => c.img).map(c => c.img));
  ok(ids.every(i => /^[a-z]{2}-\d{2}$/.test(i)), 'every card id looks like a card id (' + ids.length + ' cards)');

  // ── The chrome is PINK and carries NO BLUE (Sophie, Aug 2026) ──
  console.log('\npalette');
  const seg = await page.evaluate(() => {
    const on = document.querySelector('.deck-seg.on');
    return on ? getComputedStyle(on).backgroundColor : null;
  });
  // Opening a lesson is what draws the dashes, so ask again with one open.
  await page.evaluate(() => window.__sci.openLesson('cell'));
  await page.waitForTimeout(150);
  const lit = await page.evaluate(() => getComputedStyle(document.querySelector('.deck-seg.on')).backgroundColor);
  const rgb = (s) => (s.match(/\d+/g) || []).map(Number);
  const [r, g, b] = rgb(lit);
  ok(r > b && r > g, `the lit progress dash is pink, not blue (${lit})`);
  await page.evaluate(() => window.__sci.closeLesson());
  await page.waitForTimeout(120);
  // No token in the stylesheet may be bluer than it is red — that is what
  // "no blue" means for the chrome, and it is what a future palette tweak
  // could quietly undo. The ART is exempt: powder blue is in her palette.
  const src = fs.readFileSync(path.join(PUB, 'science.html'), 'utf8');
  const root = (src.match(/:root\s*\{([\s\S]*?)\}/) || [, ''])[1];
  const bluer = [];
  for (const m of root.matchAll(/--([a-z0-9-]+):\s*#([0-9a-f]{6})/gi)) {
    if (['blue', 'mint'].includes(m[1])) continue;          // the art palette
    const h = m[2];
    const R = parseInt(h.slice(0, 2), 16), B = parseInt(h.slice(4, 6), 16);
    if (B > R + 4) bluer.push('--' + m[1] + ' #' + h);
  }
  ok(bluer.length === 0, 'no chrome token is blue-leaning' + (bluer.length ? ': ' + bluer.join(', ') : ''));

  // ── A note per lesson ──
  console.log('\nnotes');
  const slots = await page.evaluate(() => document.querySelectorAll('#course-list .noteslot').length);
  const rows = await page.evaluate(() => document.querySelectorAll('#course-list .lesrow').length);
  ok(slots === rows && rows > 0, `every lesson row has a note slot (${slots}/${rows})`);
  ok(await page.evaluate(() => document.querySelectorAll('#course-list .note-add').length === document.querySelectorAll('#course-list .lesrow').length),
    'an unwritten note is just the small "+ note"');

  // Tapping + must NOT open the lesson.
  await page.click('#course-list .lesrow:first-child .note-add');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.getElementById('school-lesson').style.display === 'none'),
    'tapping "+ note" does not open the lesson');
  ok(await page.evaluate(() => !!document.querySelector('#course-list textarea')), 'the note box opens');

  await page.fill('#course-list textarea', 'make the second card bigger');
  await page.evaluate(() => document.querySelector('#course-list textarea').blur());
  await page.waitForTimeout(350);
  ok(noteWrites > 0, 'the note is saved to the server');
  ok(notesStore.cell === 'make the second card bigger', `the server got her words ("${notesStore.cell || ''}")`);
  ok(await page.evaluate(() => !document.querySelector('#course-list textarea')), 'the box folds away on blur');
  ok(await page.evaluate(() => (document.querySelector('#course-list .note-txt') || {}).textContent === 'make the second card bigger'),
    'her words show under the row');

  // A note on a lesson that is only WRITTEN, not built — the case a note is
  // most useful for, and the one an over-clever guard would refuse.
  await page.click('#course-list .lesrow:nth-child(2) [data-noteedit]');
  await page.waitForTimeout(150);
  await page.fill('#course-list textarea', 'do this one next');
  await page.evaluate(() => document.querySelector('#course-list textarea').blur());
  await page.waitForTimeout(350);
  ok(notesStore.inside === 'do this one next', 'a not-yet-built lesson takes a note too');

  // Clearing the box takes the note back rather than storing a blank.
  await page.click('#course-list .lesrow:first-child [data-noteedit]');
  await page.waitForTimeout(150);
  await page.fill('#course-list textarea', '');
  await page.evaluate(() => document.querySelector('#course-list textarea').blur());
  await page.waitForTimeout(350);
  ok(!('cell' in notesStore), 'clearing the box deletes the note, never stores a blank');

  // Her notes come back on a reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__sci.notes().inside === 'do this one next'), 'notes come back on reload');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  srv.close();
  console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

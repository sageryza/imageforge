// Taps through any Witch School lesson in headless Chromium and checks the
// things that break when a lesson is wired by hand:
//
//   node scripts/test-lesson-deck.js blood [sync tarot …]
//   node scripts/test-lesson-deck.js --all
//
// Per lesson: the hidden tile exists (the path renderer reads its icon + title
// from it), the key is in LESSONS and LESSON_TITLES, it belongs to exactly one
// course, every card has art or is a quiz, the deck taps all the way to the
// note screen, and the last card is an "After" card. No page errors anywhere.
//
// Skips (exit 0) without Playwright or a Chromium build — same contract as
// scripts/test-compare-shell.js.
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

const args = process.argv.slice(2);
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
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  // The page keeps LESSONS in closure scope, so read the wiring off the source
  // rather than the window — same source of truth the verifier uses.
  const src = fs.readFileSync(path.join(PUB, 'witch.html'), 'utf8');
  const lessonKeys = (src.match(/const LESSONS = \{([^}]*)\}/) || [, ''])[1]
    .split(',').map(s => s.split(':')[0].trim()).filter(Boolean);
  const keys = args.includes('--all') ? lessonKeys : args.filter(a => !a.startsWith('--'));
  if (!keys.length) { console.error('usage: node scripts/test-lesson-deck.js <lessonKey…> | --all'); process.exit(1); }

  for (const key of keys) {
    console.log('\n' + key);
    ok(lessonKeys.includes(key), `"${key}" is in the LESSONS map`);
    ok(new RegExp(`\\b${key}: '`).test((src.match(/const LESSON_TITLES = \{[^\n]*/) || [''])[0]), `"${key}" has a LESSON_TITLES entry`);

    const courses = [...src.matchAll(/\{ id: '([a-z]+)',[^\n]*lessons: \[([^\]]*)\]/g)]
      .filter(m => m[2].split(',').map(s => s.trim().replace(/'/g, '')).includes(key))
      .map(m => m[1]);
    ok(courses.length === 1, `"${key}" belongs to exactly one course (${courses.join(', ') || 'none'})`);
    ok(src.includes(`id="open-${key}"`), `the open-${key} tile exists for the path renderer`);
    ok(src.includes(`$('open-${key}')`), `the open-${key} click handler is wired`);

    const info = await page.evaluate((k) => {
      if (typeof openLesson !== 'function') return { err: 'openLesson missing' };
      go('school'); openLesson(k);
      const cards = LESSONS[k] || [];
      return {
        n: cards.length,
        segs: document.querySelectorAll('#deck-prog .deck-seg').length,
        noArt: cards.map((c, i) => (!c.img && !c.know && !c.brew && !c.html) ? i : -1).filter(i => i >= 0),
        lastKicker: cards[cards.length - 1].kicker,
        lastHasCta: !!cards[cards.length - 1].cta,
        open: document.getElementById('school-lesson').style.display !== 'none',
      };
    }, key);
    if (info.err) { ok(false, info.err); continue; }

    ok(info.open, 'the lesson opens');
    ok(info.segs === info.n, `progress dashes match card count (${info.segs}/${info.n})`);
    ok(info.noArt.length === 0, `every card has art or is a quiz${info.noArt.length ? ' — missing at ' + info.noArt.join(', ') : ''}`);
    ok(info.lastKicker === 'After', `the last card is the "After" card (got "${info.lastKicker}")`);
    // A CTA is optional by design — it only exists when the app can DO the
    // thing the lesson taught. Reported, never failed.
    console.log(`  note   last card ${info.lastHasCta ? 'carries' : 'has no'} CTA`);

    // The last card's CTA must not be clipped by the card's bottom edge, and
    // any ⓘ FAQ must open and close without turning the card.
    if (info.lastHasCta) {
      await page.evaluate((k) => { deckIdx = LESSONS[k].length - 1; renderDeckCard(); }, key);
      await page.waitForTimeout(300);
      const cta = await page.evaluate(() => {
        const c = document.getElementById('deck-cta'), st = document.getElementById('deck-stage');
        if (!c) return null;
        const cb = c.getBoundingClientRect(), sb = st.getBoundingClientRect();
        return { gap: Math.round(sb.bottom - cb.bottom) };
      });
      ok(cta && cta.gap >= 8, `the CTA clears the card's bottom edge (${cta ? cta.gap : '?'}px)`);
    }
    const faqIdx = await page.evaluate((k) => LESSONS[k].findIndex(c => c.faq), key);
    if (faqIdx >= 0) {
      await page.evaluate((i) => { deckIdx = i; renderDeckCard(); }, faqIdx);
      await page.waitForTimeout(300);
      const at = await page.evaluate(() => deckIdx);
      await page.click('#faq-btn'); await page.waitForTimeout(220);
      const open = await page.evaluate(() => ({ on: document.getElementById('faq-wrap').classList.contains('on'), idx: deckIdx }));
      await page.click('.faq-card'); await page.waitForTimeout(220);
      const shut = await page.evaluate(() => ({ on: document.getElementById('faq-wrap').classList.contains('on'), idx: deckIdx }));
      ok(open.on && !shut.on, 'the ⓘ FAQ opens and closes');
      ok(open.idx === at && shut.idx === at, 'the ⓘ FAQ never turns the card');
    }
    await page.evaluate((k) => { deckIdx = 0; renderDeckCard(); }, key);
    await page.waitForTimeout(200);

    // Tap all the way through, answering quiz cards as they come.
    let reachedNote = false;
    for (let i = 0; i < info.n + 8; i++) {
      const st = await page.evaluate(() => ({
        quiz: !!document.querySelector('.know-opt'),
        brew: !!document.querySelector('.brew-ing'),
        note: !!document.querySelector('.deck-note'),
      }));
      if (st.note) { reachedNote = true; break; }
      if (st.brew) {
        // Tap every ingredient (wrong ones just fizz), then advance. The
        // ingredient buttons stopPropagation, so the advancing tap has to land
        // on a non-button part of the card — the head, not the shelf.
        const n = await page.evaluate(() => document.querySelectorAll('.brew-ing').length);
        for (let b = 0; b < n; b++) {
          await page.evaluate((i) => document.querySelectorAll('.brew-ing')[i].click(), b);
          await page.waitForTimeout(120);
        }
        await page.click('.deck-head');
        await page.waitForTimeout(250);
        continue;
      }
      if (st.quiz) {
        for (let q = 0; q < 5; q++) {
          if (!await page.evaluate(() => !!document.querySelector('.know-opt'))) break;
          await page.click('.know-opt'); await page.waitForTimeout(200);
          await page.click('.know-flip'); await page.waitForTimeout(200);
        }
        continue;
      }
      await page.click('#deck-stage', { position: { x: 300, y: 400 } });
      await page.waitForTimeout(180);
    }
    ok(reachedNote, 'the deck taps through to the note screen');
    await page.evaluate(() => closeLesson());
    await page.waitForTimeout(200);
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  srv.close();
  console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// A lesson's own link (Aug 2026, Sophie: "I want to send my friend Richard the
// synchronicity lesson, but there's no direct links to anything").
//
// Drives the REAL public/witch.html in a headless browser and asserts every
// form of the link lands on the RIGHT deck:
//   1. /lesson/sync           — the pretty path, what she sends someone
//   2. /witch?lesson=sync     — the query form
//   3. /witch#lesson-sync     — the hash form
//   4. /lesson/synchronicity  — the friendly name (matched off LESSON_TITLES)
//   5. /lesson/shadow-work    — a two-word title slugified
//   6. /lesson/not-a-lesson   — an unknown key opens NOTHING (openLesson()
//      falls back to Spell Work, and handing someone a different lesson than
//      the one they were sent is worse than landing on the school)
//   7. plain /witch           — unchanged, no deck
// It also checks the deck really is the full-screen overlay OVER the header
// and the bottom nav (that IS the design — this pins it), with its own back
// chevron, and that closing it lands on the lesson's own course road.
//
//   npm install playwright-core --no-save && node scripts/test-lesson-link.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const WITCH = fs.readFileSync(path.join(PUB, 'witch.html'), 'utf8');

// The server serves witch.html for /witch and for /lesson/<key>; every /api/*
// call answers empty so nothing here depends on the network.
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/witch' || /^\/lesson\/[^/]+$/.test(p)) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(WITCH);
  }
  if (p.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{}');
  }
  const f = path.join(PUB, p.replace(/^\//, ''));
  if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200); return res.end(fs.readFileSync(f));
  }
  res.writeHead(404); res.end('');
});

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; };

// What the deck is showing: its title card's words, plus whether the overlay
// is up at all. LESSON_TITLES isn't exposed, so we read the rendered card.
const deckState = (page) => page.evaluate(() => {
  const d = document.getElementById('school-lesson');
  const open = !!d && d.style.display !== 'none';
  const stage = document.getElementById('deck-stage');
  return {
    open,
    locked: document.body.classList.contains('lesson-open'),
    text: open && stage ? (stage.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220) : '',
    school: document.getElementById('view-school').classList.contains('active'),
  };
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  // CHROME_PATH lets a container with a pre-installed Chromium (a different
  // build than playwright-core expects) run this without downloading one.
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => { console.log('  PAGE ERROR ' + e.message); fails++; });

  const open = async (p) => {
    await page.goto(base + p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    return deckState(page);
  };

  console.log('the link forms');
  let s = await open('/lesson/sync');
  ok(s.open && /synchronicit/i.test(s.text), '/lesson/sync opens the Synchronicity deck');
  ok(s.school, '…with the School view up behind it');
  ok(s.locked, '…and the page behind it frozen (body.lesson-open)');

  s = await open('/witch?lesson=sync');
  ok(s.open && /synchronicit/i.test(s.text), '?lesson=sync opens the same deck');

  s = await open('/witch#lesson-sync');
  ok(s.open && /synchronicit/i.test(s.text), '#lesson-sync opens the same deck');

  s = await open('/lesson/synchronicity');
  ok(s.open && /synchronicit/i.test(s.text), 'the friendly name works: /lesson/synchronicity');

  s = await open('/lesson/shadow-work');
  ok(s.open && !/synchronicit/i.test(s.text), 'a two-word title slugifies: /lesson/shadow-work');

  console.log('an unknown key opens nothing (never the wrong lesson)');
  s = await open('/lesson/not-a-lesson');
  ok(!s.open, '/lesson/not-a-lesson opens no deck at all');
  s = await open('/witch');
  ok(!s.open, 'plain /witch is unchanged');

  console.log('the deck really is the full-screen surface');
  await open('/lesson/sync');
  const geom = await page.evaluate(() => {
    const d = document.getElementById('school-lesson').getBoundingClientRect();
    const header = document.querySelector('header');
    const nav = document.getElementById('nav');
    const hitsAt = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return 'hidden';
      const t = document.elementFromPoint(r.left + r.width / 2, Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
      return t ? (t.closest('#school-lesson') ? 'lesson' : 'page') : 'none';
    };
    return {
      full: d.top <= 1 && d.left <= 1 && d.width >= innerWidth - 1 && d.height >= innerHeight - 1,
      onHeader: hitsAt(header), onNav: hitsAt(nav),
      back: !!document.getElementById('lesson-back').offsetParent,
    };
  });
  ok(geom.full, 'the deck covers the whole screen');
  ok(geom.onHeader === 'lesson' || geom.onHeader === 'hidden', 'it is over the header, not under it');
  ok(geom.onNav === 'lesson' || geom.onNav === 'hidden', 'it is over the bottom nav too');
  ok(geom.back, 'and it has its own back chevron (the way out)');

  console.log('closing it lands on the lesson’s own course');
  await page.click('#lesson-back');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    open: document.getElementById('school-lesson').style.display !== 'none',
    school: document.getElementById('view-school').classList.contains('active'),
    road: (document.getElementById('school-path').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    nav: !!document.getElementById('nav').offsetParent,
  }));
  ok(!after.open, 'back closes the deck');
  ok(after.school && after.nav, 'and the School view + bottom nav are back');
  ok(/synchronicity/i.test(after.road), 'on the Divination road, where Synchronicity lives');

  await browser.close();
  server.close();
  console.log(fails ? '\nFAILED (' + fails + ')' : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/* test-timeline-keyboard.js — A BOTTOM MOMENT OPENS ABOVE THE KEYBOARD
 * (2026-09-13, Sophie: "story timeline has an issue - the keyboard popping up
 * when i click the bottom moments makes it impossible to write in them").
 *
 * The real Story Timeline page, with the real injected pill, at her phone's
 * size. Tapping the pencil on the LAST moment (and the + in the last gap) has
 * to put the editor in the top part of the screen BEFORE the box takes focus
 * — the page's own lift, not caretkeep's later correction — so every check is
 * taken synchronously after the tap, before any keeper timer can run, and
 * again a second later to show nothing fights it. A card already high on the
 * screen must not move at all.
 *
 * EVERY ASSERTION IS A MEASUREMENT: a lift that scrolls the wrong way, one
 * that leaves the editor at the middle of the screen (the keyboard's edge),
 * and one that never borrows the room it needs all look identical in source.
 *
 *   node scripts/test-timeline-keyboard.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const ROOT = path.join(__dirname, '..');
const servePublic = require('./lib/public-asset');

const src = fs.readFileSync(path.join(ROOT, 'public/timeline.html'), 'utf8');
const pill = fs.readFileSync(path.join(ROOT, 'public/pill-inject.html'), 'utf8');
const page = src + pill;

const MOM = {}, UNITS = [];
for (let i = 0; i < 18; i += 1) {
  MOM['m' + i] = { text: 'moment ' + (i + 1) + ' — she waits in the hall for a while and then goes in' };
  UNITS.push(['m' + i]);
}
const STORY = { id: 'story1', title: 'A story', moments: MOM, units: UNITS };

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails += 1; };

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const [route] = req.url.split('?');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (route === '/api/timeline/stories') return json({ stories: [STORY] });
  if (route.indexOf('/api/timeline/stories/') === 0) return json(req.method === 'PUT' ? { ok: true } : STORY);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page);
});

// the same figure the page and caretkeep use for a keyboard nobody has
// reported: the visible band on an 844px phone ends at 844 - 360 - 26
const H = 844, SAFE = H - Math.min(360, Math.round(H * 0.46)) - 26;

(async () => {
  // source pin: the add path must not walk the new card to the middle of the
  // screen after the lift — that is the keyboard's own edge
  ok(!/\.scrollIntoView\(/.test(src), 'the page never calls scrollIntoView');

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = (() => {
    if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
    for (const k of (() => { try { return fs.readdirSync('/opt/pw-browsers'); } catch { return []; } })()
      .filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: H }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => ok(false, 'page error: ' + e.message));

  await pg.goto(base + '/timeline?story=story1');
  await pg.waitForSelector('.mcard');
  await pg.waitForTimeout(200);

  const state = () => pg.evaluate(() => {
    const c = document.querySelector('.mcard.editing');
    const head = document.querySelector('.head').getBoundingClientRect();
    const edit = c && c.querySelector('.edit');
    return {
      editing: !!c,
      focused: !!(document.activeElement && document.activeElement.classList.contains('etext')),
      cardTop: c ? c.getBoundingClientRect().top : null,
      editBottom: edit ? edit.getBoundingClientRect().bottom : null,
      headBottom: head.bottom,
      y: window.scrollY,
      room: parseFloat(document.getElementById('tl').style.paddingBottom) || 0,
      docH: document.documentElement.scrollHeight,
    };
  });

  // ── 1. the last moment's pencil ──
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.waitForTimeout(100);
  const docBefore = await pg.evaluate(() => document.documentElement.scrollHeight);
  const pencils = await pg.$$('.mcard .pencil');
  const last = pencils[pencils.length - 1];
  const rb = await last.boundingBox();
  ok(rb.y + rb.height > SAFE, 'before: the last moment sits where the keyboard will land (pencil at y ' + Math.round(rb.y) + ')');
  // the tap, and the state read in the SAME task — before any keeper timer
  const s1 = await pg.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y).closest('button');
    el.click();
    const c = document.querySelector('.mcard.editing');
    const edit = c.querySelector('.edit');
    return { cardTop: c.getBoundingClientRect().top, editBottom: edit.getBoundingClientRect().bottom,
      headBottom: document.querySelector('.head').getBoundingClientRect().bottom,
      focused: document.activeElement === c.querySelector('.etext'),
      room: parseFloat(document.getElementById('tl').style.paddingBottom) || 0 };
  }, [rb.x + rb.width / 2, rb.y + rb.height / 2]);
  ok(s1.focused, 'the pencil opens the editor with the box focused');
  ok(s1.editBottom <= SAFE, 'synchronously, before focus took effect, the whole editor is above the keyboard line ('
    + Math.round(s1.editBottom) + ' <= ' + SAFE + ')');
  ok(s1.cardTop >= s1.headBottom - 1, 'and the card is not under the sticky header (card top ' + Math.round(s1.cardTop)
    + ', head bottom ' + Math.round(s1.headBottom) + ')');
  ok(s1.room > 0, 'the list borrowed the room that scroll needed (' + Math.round(s1.room) + 'px)');
  await pg.waitForTimeout(1100);
  const s2 = await state();
  ok(s2.editing && s2.focused, 'a second later the editor is still open and focused');
  ok(s2.editBottom <= SAFE && Math.abs(s2.cardTop - s1.cardTop) < 2,
    'and nothing has moved it since (card top ' + Math.round(s2.cardTop) + ')');

  // ── 2. typing lands in it ──
  await pg.keyboard.type(' and waits', { delay: 10 });
  await pg.waitForTimeout(100);
  const typed = await pg.evaluate(() => document.querySelector('.mcard.editing .etext').value);
  ok(/and waits$/.test(typed), 'typing goes into the bottom moment');

  // ── 3. closing gives the room back ──
  await pg.evaluate(() => document.activeElement.blur());
  await pg.waitForTimeout(700);
  const s3 = await state();
  ok(!s3.editing, 'blur closes the editor');
  ok(s3.room === 0 && s3.docH <= docBefore + 40, 'and the borrowed room is given back (doc ' + docBefore + ' → ' + s3.docH + ')');

  // ── 4. a card already high on the screen is left where it is ──
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForTimeout(100);
  const first = (await pg.$$('.mcard .pencil'))[0];
  const fb = await first.boundingBox();
  const y0 = await pg.evaluate(() => window.scrollY);
  await pg.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await pg.waitForTimeout(300);
  const s4 = await state();
  ok(s4.editing && s4.y === y0 && s4.room === 0,
    'the first moment opens without moving the page at all (scrollY ' + s4.y + ', room ' + s4.room + ')');
  await pg.evaluate(() => document.activeElement.blur());
  await pg.waitForTimeout(600);

  // ── 5. the + in the last gap ──
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.waitForTimeout(100);
  const adds = await pg.$$('.gap .addb');
  const lastAdd = adds[adds.length - 1];
  const ab = await lastAdd.boundingBox();
  await pg.mouse.click(ab.x + ab.width / 2, ab.y + ab.height / 2);
  const s5 = await state();
  ok(s5.editing && s5.focused, 'the + in the last gap opens an editor');
  ok(s5.editBottom <= SAFE && s5.cardTop >= s5.headBottom - 1,
    'and the new bottom moment sits above the keyboard line too (editor bottom ' + Math.round(s5.editBottom) + ')');
  await pg.waitForTimeout(1100);
  const s6 = await state();
  ok(s6.editing && Math.abs(s6.cardTop - s5.cardTop) < 2, 'and stays there (card top ' + Math.round(s6.cardTop) + ')');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

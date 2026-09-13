#!/usr/bin/env node
/* THE SEVEN THAT WERE NAMED AND LEFT (2026-09-13, Sophie: "good. real bugs.
 * can u fix them all? use agents if u want / then find more") — the findings
 * the first audit wrote down rather than half-fixing, now fixed and pinned.
 *
 * The REAL page headless, and every assertion here is a MEASUREMENT or a
 * reading of what the stub server really received, because in the source:
 *   · an unmark that renumbers the others and never puts the returning
 *     picture's own name back reads as correct arithmetic — and the clip
 *     draws one reference short with its thumb still on screen;
 *   · a wall that re-decodes every poster and a wall that reuses its cells
 *     render the identical grid;
 *   · a cursor taken from the oldest thing in MEMORY and one taken from the
 *     bottom of the walk are the same line until a search has put an old clip
 *     in memory;
 *   · a search answer cut at the cap looks exactly like a complete one;
 *   · an expanded prompt springing shut on the next poll is a class nobody
 *     wrote down;
 *   · a note box that survives a rebuild with its keyboard gone, and a Cancel
 *     that clears `on` off a DETACHED mark while the live one stays lit, both
 *     look like the versions that work;
 *   · and two controls overlapping by 71% pass every width assertion ever
 *     written about them.
 *
 * Run: node scripts/test-footage-audit-2.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) {
    console.log('FOOTAGE AUDIT 2 — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE AUDIT 2 — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage audit 2: playwright not installed — skipped'); report(); return;
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

const F = require('../footage');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const LONG = Array.from({ length: 60 }, (_, i) => 'line ' + (i + 1) + ' — the ward corridor at night').join('\n');
let PORT = 0;
const clip = (i, extra) => Object.assign({
  id: 't' + i, prompt: i === 0 ? LONG : 'the socks on the line ' + i,
  model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 4, resolution: '480p',
  ratio: '16:9', sound: true, refs: [], status: 'done',
  video: 'http://127.0.0.1:' + PORT + '/clip.mp4', poster: 'http://127.0.0.1:' + PORT + '/ref.png?t=' + i,
  cost: 4.4, estimate: 4.4, sentAt: '2026-09-12T1' + i + ':00:00.000Z', vote: '', hidden: false,
}, extra || {});

// `top` is what the newest read answers; `deep` is the pages under it. The
// SEARCH answer deliberately carries one clip far older than anything on the
// page — that is the whole of the cursor bug, since a hit lands in `jobsById`
// like any other card.
let top = [], deep = [];
const ANCIENT = () => Object.assign(clip(9), { id: 'ancient', prompt: 'the ancient socks', sentAt: '2026-01-01T00:00:00.000Z' });
const OLDER_HIT = () => Object.assign(clip(9), { id: 'olderhit', prompt: 'the oldest socks of all', sentAt: '2025-06-01T00:00:00.000Z' });
let qMore = false;                     // the search answer is cut at the cap
const jobReads = [];                   // every `before=` the plain feed asked for
const qAsked = [];                     // every {q, before} a search asked for
const notes = [];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, chat: 'footage',
        balances: { atlascloud: { configured: true } },
        models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
        ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      const q = u.searchParams.get('q') || '';
      const before = u.searchParams.get('before') || '';
      if (q) {
        qAsked.push({ q, before });
        // page one is the loaded feed's matches plus one ancient hit; page
        // two — asked for only when the first said `more` — is older still
        return json({ ok: true, jobs: before ? [OLDER_HIT()] : top.concat([ANCIENT()]), more: qMore && !before, folders: {} });
      }
      jobReads.push(before);
      if (!before) return json({ ok: true, jobs: top, more: deep.length > 0, folders: {} });
      const under = deep.filter((j) => j.sentAt < before).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
      return json({ ok: true, jobs: under.slice(0, 2), more: under.length > 2, folders: {} });
    }
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname) && req.method === 'POST') return json({ ok: true });
    if (u.pathname === '/api/gallery/assets/note' && req.method === 'POST') {
      const b = JSON.parse(body); notes.push(b);
      return json({ ok: true, thread: [{ from: 'sophie', text: b.text, at: new Date().toISOString() }] });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/clip.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(Buffer.alloc(0)); }
    res.writeHead(404); res.end('nope');
  });
});

// a synthetic visibility flip is the page's OWN door into `loadJobs` — the
// poll otherwise only runs while a clip is drawing
const poll = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
// A CONTROL THAT IS NOT THERE IS A FAILURE, NEVER A CRASH — the pre-fix page
// hides `#older` under a search outright, and a timeout that kills the run
// reports nothing about the six sections around it.
const tap = async (page, sel, what) => {
  try { await page.click(sel, { timeout: 3000 }); ok(what, true); }
  catch (e) { ok(what + ' — could not be tapped: ' + String(e).split('\n')[0], false); }
};
// the box a control really occupies, and what a tap at its centre reaches
const boxAt = (page, sel) => page.$eval(sel, (e) => {
  const r = e.getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return { x: r.left, y: r.top, w: r.width, h: r.height, hit: hit ? (hit === e || e.contains(hit) ? 'self' : (hit.className || hit.tagName) + '') : 'none' };
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;
  const base = 'http://127.0.0.1:' + PORT;
  top = [0, 1, 2, 3, 4, 5].map((i) => clip(i));
  deep = [0, 1, 2, 3].map((i) => Object.assign(clip(i), { id: 'd' + i, prompt: 'an older shot ' + i, sentAt: '2026-09-0' + (i + 1) + 'T00:00:00.000Z' }));

  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // ══ 1. A KEYFRAME'S NAME COMES BACK ════════════════════════════════════
  // The strip arrives through the belt's own hand-off door — the one way to
  // put two references and a prompt naming them on the page in a single step.
  {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(`localStorage.setItem('footage_handoff', ${JSON.stringify(JSON.stringify({
      prompt: 'the doctor is the man in [Image1] and the room is [Image2].',
      refs: [{ url: base + '/ref.png?a', kind: 'image' }, { url: base + '/ref.png?b', kind: 'image' }],
      at: Date.now(),
    }))})`);
    await page.goto(base + '/footage');
    await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
    await page.waitForTimeout(500);
    const before = await page.$eval('#prompt', (e) => e.value);
    ok('the hand-off put her words and two references on the page',
      /\[Image1\]/.test(before) && /\[Image2\]/.test(before)
      && (await page.$$eval('#refs .ref', (els) => els.length)) === 2);

    await page.click('#refs .ref:nth-child(1) .kf');
    await page.waitForTimeout(150);
    const marked = await page.$eval('#prompt', (e) => e.value);
    ok('marking it takes its own name out of her words and renumbers the other — ' + JSON.stringify(marked),
      /the room is \[Image1\]/.test(marked) && !/\[Image2\]/.test(marked));

    await page.click('#refs .ref:nth-child(1) .kf');   // first → last
    await page.waitForTimeout(150);
    ok('stepping first → last leaves it out of the list and her words alone',
      (await page.$eval('#prompt', (e) => e.value)) === marked);

    await page.click('#refs .ref:nth-child(1) .kf');   // last → none
    await page.waitForTimeout(150);
    const back = await page.$eval('#prompt', (e) => e.value);
    ok('unmarking puts HER OWN words back, byte for byte — ' + JSON.stringify(back), back === before);
    ok('so the job carries both names again, never one reference short',
      /\[Image1\]/.test(back) && /\[Image2\]/.test(back));
    ok('and the strip is the two pictures with neither flagged',
      (await page.$$eval('#refs .ref', (els) => els.length)) === 2
      && (await page.$$eval('#refs .ref .kf.on', (els) => els.length)) === 0);

    // AN EDIT OF HERS SINCE THE MARK WINS OUTRIGHT — the bank is spent only on
    // words that are still byte-for-byte what the rewrite left.
    await page.click('#refs .ref:nth-child(1) .kf');
    await page.waitForTimeout(120);
    await page.$eval('#prompt', (e) => { e.value = 'a completely different scene with [Image1] in it'; });
    await page.click('#refs .ref:nth-child(1) .kf');
    await page.waitForTimeout(120);
    await page.click('#refs .ref:nth-child(1) .kf');
    await page.waitForTimeout(150);
    ok('her own words since the mark are never overwritten by the bank',
      /a completely different scene/.test(await page.$eval('#prompt', (e) => e.value)));
    ok('no page errors while marking and unmarking — ' + errs.join(' | '), errs.length === 0);
    await page.close();
  }

  // ══ 2. THE WALL REUSES ITS CELLS ═══════════════════════════════════════
  {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(base + '/footage');
    await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
    await page.click('#v-tiles');
    await page.waitForTimeout(400);
    ok('the wall is drawn — a cell per clip',
      (await page.$$eval('#tiles .cell', (els) => els.length)) === top.length);
    const keep = await page.evaluateHandle(() => document.querySelector('#tiles .cell[data-id="t3"] img'));
    top = top.map((j) => (j.id === 't1' ? Object.assign({}, j, { poster: j.poster + 'x' }) : j));
    await poll(page);
    await page.waitForTimeout(400);
    ok('the one clip that changed really did land a new poster',
      await page.$eval('#tiles .cell[data-id="t1"] img', (e) => /x$/.test(e.getAttribute('src'))));
    ok('and every OTHER poster is the SAME node — nothing was re-decoded',
      await page.evaluate((h) => h === document.querySelector('#tiles .cell[data-id="t3"] img'), keep));
    ok('the wall is still in order, newest first',
      await page.$$eval('#tiles .cell', (els) => els.map((e) => e.dataset.id).join() === 't5,t4,t3,t2,t1,t0'));

    // A NEW CLIP LANDS IN ORDER AND COSTS NO OTHER CELL A RE-DECODE — the
    // poll only ever ADDS to the feed (the page's own rule), so this is the
    // one direction the wall really changes under her.
    top = [Object.assign(clip(7), { id: 'fresh', prompt: 'a brand new shot', sentAt: '2026-09-12T23:00:00.000Z' })].concat(top);
    await poll(page); await page.waitForTimeout(400);
    ok('a new clip lands at the front of the wall',
      await page.$$eval('#tiles .cell', (els) => els.map((e) => e.dataset.id).join() === 'fresh,t5,t4,t3,t2,t1,t0'));
    ok('and it cost no other poster a re-decode',
      await page.evaluate((h) => h === document.querySelector('#tiles .cell[data-id="t3"] img'), keep));
    ok('no page errors on the wall — ' + errs.join(' | '), errs.length === 0);

    // ══ 7. FOUR ACROSS: THE ♥ AND THE ▶ ARE NOT ON EACH OTHER ═══════════
    await page.click('#v-cols');
    await page.waitForTimeout(400);
    const cols = await page.$eval('#tiles', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    ok('the wall is four across — ' + cols, cols === 4);
    const cell = await page.$eval('#tiles .cell[data-id="t3"]', (e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, short: e.classList.contains('short') }));
    ok('a 16:9 tile at four across is short — ' + Math.round(cell.w) + 'x' + Math.round(cell.h), cell.h < 64);
    ok('so it wears the short class', cell.short);
    const heart = await boxAt(page, '#tiles .cell[data-id="t3"] .tmark.heart');
    const play = await boxAt(page, '#tiles .cell[data-id="t3"] .tdoor.play');
    const cardd = await boxAt(page, '#tiles .cell[data-id="t3"] .tdoor.card');
    const nope = await boxAt(page, '#tiles .cell[data-id="t3"] .tmark.nope');
    const apart = (a, b) => a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5;
    ok('the ♥ and the ▶ do not overlap — ♥ ' + JSON.stringify(heart) + ' ▶ ' + JSON.stringify(play), apart(heart, play));
    ok('nor the ♥ and the card door', apart(heart, cardd));
    ok('nor the ✕ and either door', apart(nope, play) && apart(nope, cardd));
    ok('a tap at the ♥\'s own centre reaches the ♥ — ' + heart.hit, heart.hit === 'self');
    ok('a tap at the ▶\'s own centre reaches the ▶ — ' + play.hit, play.hit === 'self');
    ok('a tap at the card door\'s centre reaches it — ' + cardd.hit, cardd.hit === 'self');
    ok('a tap at the ✕\'s own centre reaches the ✕ — ' + nope.hit, nope.hit === 'self');
    ok('every control is still on the tile', heart.y >= cell.h - 64 && play.y > 0);
    // THE SCISSORS STAYS — "even in the tile view" is her own ask by name —
    // and it takes the 38px between the two marks rather than the note's band
    top = top.map((j) => (j.id === 't2' ? Object.assign({}, j, { trims: [{ key: 'k', status: 'ready', start: 1, end: 2, seconds: 1, url: j.video }] }) : j));
    await poll(page); await page.waitForTimeout(400);
    const cut = await boxAt(page, '#tiles .cell[data-id="t2"] .tcut');
    const ch = await boxAt(page, '#tiles .cell[data-id="t2"] .tmark.heart');
    const cp = await boxAt(page, '#tiles .cell[data-id="t2"] .tdoor.play');
    ok('a trimmed clip still says so at four across — ' + JSON.stringify(cut), cut.w > 0 && cut.h > 0);
    ok('and the scissors is on neither the marks nor the doors', apart(cut, ch) && apart(cut, cp));
    ok('the note\'s words are what gave up the band',
      await page.$eval('#tiles .cell[data-id="t2"] .tnote', (e) => getComputedStyle(e).display === 'none'));

    // and the one ratio no geometry fits gets a floor under its height
    top = top.concat([Object.assign(clip(8), { id: 'wide', ratio: '21:9', prompt: 'the widest shot' })]);
    await poll(page); await page.waitForTimeout(400);
    const wide = await page.$eval('#tiles .cell[data-id="wide"]', (e) => e.getBoundingClientRect().height);
    ok('a 21:9 tile at four across is floored at 52px rather than 37 — ' + Math.round(wide), wide >= 52);
    const wh = await boxAt(page, '#tiles .cell[data-id="wide"] .tmark.heart');
    const wp = await boxAt(page, '#tiles .cell[data-id="wide"] .tdoor.play');
    ok('so its ♥ and its ▶ clear each other too', apart(wh, wp) && wh.hit === 'self' && wp.hit === 'self');
    await page.close();
  }

  // ══ 3 & 4. THE WALK, AND A SEARCH PAST THE CAP ═════════════════════════
  {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(base + '/footage');
    await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
    await page.click('#v-list');                              // the view is sticky across pages
    await page.waitForTimeout(400);
    const walkBottom = '2026-09-12T10:00:00.000Z';           // the oldest clip on the top page
    qMore = true;
    await page.click('#v-search');
    await page.fill('#q', 'socks');
    await page.waitForTimeout(700);
    ok('the search asked the server over the whole log — ' + JSON.stringify(qAsked),
      qAsked.length >= 1 && qAsked[0].q === 'socks' && !qAsked[0].before);
    ok('and its hits landed as cards, the ancient one among them',
      await page.$('#job-ancient') !== null);

    // 4 — the answer said there is more, so the door stays and says so
    const more = await page.$eval('#older', (e) => ({ hidden: e.hidden, text: e.textContent.trim(), h: e.getBoundingClientRect().height }));
    ok('a capped search keeps the door, and it says `more matches` — ' + JSON.stringify(more),
      !more.hidden && more.h > 0 && /more matches/.test(more.text));
    await tap(page, '#older', 'the door under a capped search takes a tap');
    await page.waitForTimeout(600);
    ok('the tap asked for the page under the OLDEST HIT — ' + JSON.stringify(qAsked[qAsked.length - 1]),
      qAsked[qAsked.length - 1].before === '2026-01-01T00:00:00.000Z');
    ok('the next page of matches landed', await page.$('#job-olderhit') !== null);
    ok('and nothing she was already shown left the screen', await page.$('#job-ancient') !== null);
    ok('the door is gone now the search has no page under it',
      await page.$eval('#older', (e) => e.hidden));

    // 3 — clear the search: the ancient hits are still in memory, and the
    // walk's own cursor must not be taken from them
    await page.click('#qclear');
    await page.waitForTimeout(400);
    await page.click('#v-search');                            // shutting it clears the words
    await page.waitForTimeout(400);
    ok('the plain door is back — there are pages under the feed',
      await page.$eval('#older', (e) => !e.hidden && /older/.test(e.textContent)));
    const oldestOnPage = await page.$$eval('#feed .job', (els) => els.map((e) => e.id));
    ok('the search\'s ancient hits are still on the page — ' + oldestOnPage.length + ' cards',
      oldestOnPage.indexOf('job-ancient') >= 0 || oldestOnPage.indexOf('job-olderhit') >= 0);
    const readsBefore = jobReads.length;
    await tap(page, '#older', 'the plain door takes a tap');
    await page.waitForTimeout(600);
    ok('the walk asked for the page under the BOTTOM OF THE WALK, never under a search hit — asked '
      + jobReads[jobReads.length - 1],
      jobReads.length > readsBefore && jobReads[jobReads.length - 1] === walkBottom);
    ok('so the pages in between really arrived',
      await page.$('#job-d3') !== null && await page.$('#job-d2') !== null);
    await tap(page, '#older', 'and it takes a second tap');
    await page.waitForTimeout(600);
    ok('and the next tap walks under the page it just loaded — asked ' + jobReads[jobReads.length - 1],
      jobReads[jobReads.length - 1] === '2026-09-03T00:00:00.000Z');
    ok('no page errors walking the feed — ' + errs.join(' | '), errs.length === 0);
    qMore = false;
    await page.close();
  }

  // ══ 5 & 6. A REBUILD KEEPS HER PLACE ═══════════════════════════════════
  {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(base + '/footage');
    await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
    await page.click('#v-list');                              // the view is sticky across pages
    await page.waitForTimeout(500);
    ok('the long prompt is cut and carries an opener',
      await page.$eval('#job-t0 .moretxt', (e) => /more/.test(e.textContent)));
    await page.click('#job-t0 .moretxt');
    await page.waitForTimeout(200);
    const tall = await page.$eval('#job-t0 .p', (e) => ({ clamp: e.classList.contains('clamp'), h: e.getBoundingClientRect().height }));
    ok('tapping it really opens the whole scene — ' + Math.round(tall.h) + 'px', !tall.clamp && tall.h > 300);

    // her note box, with words in it and the caret inside it
    await page.click('#job-t0 .acts .note');
    await page.waitForTimeout(200);
    await page.type('#job-t0 .notebox textarea', 'half a sent');
    ok('the box is open with the mark lit and the caret in it',
      await page.$eval('#job-t0 .acts .note', (e) => e.classList.contains('on'))
      && await page.evaluate(() => document.activeElement === document.querySelector('#job-t0 .notebox textarea')));

    // the ordinary rebuild: the server changes something the card PRINTS
    top = top.map((j) => (j.id === 't0' ? Object.assign({}, j, { note: 'the door said something' }) : j));
    await poll(page);
    await page.waitForTimeout(500);
    ok('the card really was rebuilt — the new line is on it',
      await page.$eval('#job-t0', (e) => /the door said something/.test(e.textContent)));
    const after = await page.$eval('#job-t0 .p', (e) => ({ clamp: e.classList.contains('clamp'), h: e.getBoundingClientRect().height }));
    ok('the expanded prompt is still expanded — ' + Math.round(after.h) + 'px', !after.clamp && after.h > 300);
    ok('and its opener still offers the way back', await page.$eval('#job-t0 .moretxt', (e) => /less/.test(e.textContent)));
    ok('her words are still in the box', await page.$eval('#job-t0 .notebox textarea', (e) => e.value) === 'half a sent');
    ok('the caret is still in it — the keyboard never went away',
      await page.evaluate(() => document.activeElement === document.querySelector('#job-t0 .notebox textarea')));
    ok('and it is still at the end of what she typed',
      await page.$eval('#job-t0 .notebox textarea', (e) => e.selectionStart === 11 && e.selectionEnd === 11));
    await page.type('#job-t0 .notebox textarea', 'ence');
    ok('so typing on lands in the box rather than nowhere',
      await page.$eval('#job-t0 .notebox textarea', (e) => e.value) === 'half a sentence');

    // and Cancel clears the LIVE mark, not the one the rebuild threw away
    await page.click('#job-t0 .notebox .ncancel');
    await page.waitForTimeout(200);
    ok('Cancel takes the box away', await page.$('#job-t0 .notebox') === null);
    ok('and the mark she can SEE goes out with it',
      await page.$eval('#job-t0 .acts .note', (e) => !e.classList.contains('on')));
    ok('nothing was filed — Cancel is the deliberate discard', notes.length === 0);

    // a fresh open still starts empty, and collapsing is remembered too
    await page.click('#job-t0 .acts .note');
    await page.waitForTimeout(150);
    ok('the box ships EMPTY on the next open', await page.$eval('#job-t0 .notebox textarea', (e) => e.value) === '');
    await page.click('#job-t0 .notebox .ncancel');
    await page.click('#job-t0 .moretxt');
    await page.waitForTimeout(150);
    top = top.map((j) => (j.id === 't0' ? Object.assign({}, j, { note: 'and then it said something else' }) : j));
    await poll(page);
    await page.waitForTimeout(500);
    ok('a prompt she COLLAPSED stays collapsed through a rebuild too',
      await page.$eval('#job-t0 .p', (e) => e.classList.contains('clamp')));
    ok('no page errors through the rebuilds — ' + errs.join(' | '), errs.length === 0);
    await page.close();
  }

  // ══ THE SOURCE PINS ════════════════════════════════════════════════════
  const src = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
  ok('the banked words are keyed by the url that left, and spent on use',
    /var kfBank = \{\}/.test(src) && /delete kfBank\[url\]/.test(src));
  ok('the wall has a signature PER CELL', /function tileSig\(j\)/.test(src) && /c\.__sig === cs/.test(src));
  ok('the walk has its own cursor, and a search never writes it',
    /var feedMore = false, olderAt = null, walkAt = ''/.test(src) && /walkAt \|\| oldestSentAt\(\)/.test(src));
  ok('the cursor is the smallest sentAt in an answer, never its last element',
    /function minSentAt\(jobs\)/.test(src) && !/jobs\[jobs\.length - 1\]\.sentAt/.test(src));
  ok('the search carries its own `more` and its own cursor',
    /qMore = false, qAt = ''/.test(src) && /runSearch\(qAt\)/.test(src));
  ok('the open prompt lives in memory, keyed by the clip, and never in localStorage',
    /var openPrompt = \{\}/.test(src) && !/openPrompt.*localStorage/.test(src));
  ok('the note mark is asked for, never captured', /function noteMark\(el\)/.test(src));
  ok('the short tile is measured rather than derived from the ratio',
    /function paintShortTiles\(\)/.test(src) && /var SHORT_TILE = 64/.test(src));

  await browser.close(); server.close();
  report();
})();

#!/usr/bin/env node
/* A RED "SENT" / "UNSENT" AT THE TOP OF A COLLAPSED BLOCK (2026-09-14,
 * Sophie: "add a red 'sent' or 'unsent' to top of collapsed block").
 *
 * The REAL page headless, and every assertion is a MEASUREMENT of what really
 * renders or a reading of what the stub server really received. A heading that
 * carries the right markup and paints nothing, a mark whose CSS never landed,
 * one that inherits the row's grey instead of the red, one that reads SENT off
 * a block that was merely TYPED, one that stays SENT after she edits a word,
 * one that sits under the pill's column or pushes her own words off the row,
 * and one that forgets everything on a reload all look identical in the
 * source.
 *
 * It CRASHES against the pre-fix page, where there is no `.bsent` at all.
 *
 * Run: node scripts/test-footage-sent-mark.js
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
    console.log('FOOTAGE SENT MARK — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE SENT MARK — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage sent mark: playwright not installed — skipped'); report(); return;
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
const posted = [];
const jobs = [];

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
      // the story-scoped read `loadHistory` makes — the part's own sent clips
      const story = u.searchParams.get('story') || '';
      return json({ ok: true, jobs: story ? jobs.filter((j) => j.story === story) : jobs, more: false, folders: {} });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      // A CONTENT REFUSAL: nothing drew, nothing was charged — and nothing may
      // be banked as sent either.
      if (/REFUSEME/.test(b.prompt || '')) {
        posted.push(b);
        return json({ ok: false, error: 'refused', refusal: 'content', why: 'A face in a reference', door: 'atlascloud' }, 400);
      }
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, words: b.words || '', unit: b.unit || '', story: b.story || '',
        model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: [], status: 'done',
        video: '', poster: '', seed: 7, sentAt: new Date().toISOString(), estimate: 4.4, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    res.writeHead(404); res.end('nope');
  });
});

const ONE = 'block one — she opens the office door and stops in the doorway';
const TWO = 'block two — the assistant is already standing at the window';

// WHAT THE PAGE REALLY SHOWS. Every field here is read off the rendered box,
// never off a class name: a `.on` whose CSS never landed and a word painted in
// the row's own grey both pass every markup assertion ever written about them.
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const seen = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: r.width, h: r.height, left: r.left, right: r.right, display: cs.display,
      color: cs.color, words: (el.textContent || '').trim() };
  };
  return {
    n: wraps.length,
    values: wraps.map((w) => w.querySelector('.pblock').value),
    shut: wraps.map((w) => w.classList.contains('shut')),
    mark: wraps.map((w) => seen(w.querySelector('.bsent'))),
    head: wraps.map((w) => seen(w.querySelector('.bfold'))),
    ref: wraps.map((w) => seen(w.querySelector('.bref'))),
    lw: wraps.map((w) => (w.querySelector('.lw') || {}).textContent || ''),
    title: wraps.map((w) => (w.querySelector('.bfold') || {}).title || ''),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
const tapHead = (i) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  wraps[i].querySelector('.bfold').click();
};
const writeIn = (a) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const el = wraps[a.i].querySelector('.pblock');
  el.focus();
  el.value = a.text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const tapInto = (i) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  wraps[i].querySelector('.pblock').focus();
  wraps[i].querySelector('.pblock').dispatchEvent(new Event('focus', { bubbles: true }));
  wraps[i].click();
};
const RED = 'rgb(160, 64, 42)';

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(300);

  // ── 1. ONE BLOCK IS BYTE-FOR-BYTE THE PAGE SHE ALREADY HAD ──────────────
  // The heading is drawn only with two or more, so a one-block page cannot
  // fold one and has nothing to say a word on.
  await page.evaluate(writeIn, { i: 0, text: ONE });
  await page.waitForTimeout(200);
  let s = await page.evaluate(read);
  // MEASURED, never asked of the mark's own `display`: the heading it lives in
  // is what is switched off on a one-block page (the `.many` rule the ✕ and
  // the gold line already ride), so the honest question is whether anything
  // renders at all.
  ok('one block, and its heading is not drawn at all — ' + (s.head[0] || {}).display,
    s.n === 1 && s.head[0].display === 'none' && !s.head[0].h);
  ok('so the mark has no box on screen — ' + Math.round((s.mark[0] || {}).w || 0) + 'x' + Math.round((s.mark[0] || {}).h || 0),
    s.mark[0] && !s.mark[0].w && !s.mark[0].h);

  // ── 2. TWO BLOCKS, NOTHING SENT: both say UNSENT, in the page's red ──────
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.click('#divide');
  await page.waitForTimeout(250);
  await page.evaluate(writeIn, { i: 1, text: TWO });
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('two blocks', s.n === 2);
  ok('both headings say UNSENT — "' + s.mark.map((m) => m.words).join('" / "') + '"',
    s.mark.every((m) => m.words === 'unsent' && m.h > 0 && m.w > 0));
  ok('and it is the page\'s own red, not the row\'s grey — ' + s.mark.map((m) => m.color).join(' / '),
    s.mark.every((m) => m.color === RED));
  ok('it is a different colour from the heading it sits on — ' + s.head[0].color,
    s.head[0].color !== s.mark[0].color);
  ok('the title says so for a screen reader — "' + s.title[0] + '"', /not sent yet/.test(s.title[0]));

  // ── 3. IT IS HARD RIGHT, AND IT TAKES NO WIDTH FROM HER OWN WORDS ───────
  // OPEN, `.lw` is :empty and display:none, so `margin-left:auto` is the only
  // thing pushing the word over; SHUT, `.lw` is flex:1 and has eaten the slack
  // already. Both have to land in the same column or four headings do not read
  // as one.
  const openRight = s.mark.map((m) => m.right);
  ok('open, it sits hard right inside its heading (' + openRight.map(Math.round).join(', ') + ')',
    s.mark.every((m, i) => Math.abs(m.right - s.head[i].right) < 2));
  await page.evaluate(tapHead, 0);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('block 1 is folded', s.shut[0] && !s.shut[1]);
  ok('shut, the mark is still drawn — "' + s.mark[0].words + '"', s.mark[0].words === 'unsent' && s.mark[0].h > 0);
  ok('and still hard right, in the same column as the open one (' + Math.round(s.mark[0].right) + ' vs ' + Math.round(openRight[0]) + ')',
    Math.abs(s.mark[0].right - openRight[0]) < 2);
  ok('her own first words are still on the shut heading beside it — "' + s.lw[0] + '"',
    s.lw[0].indexOf('block one') > 0);
  ok('and the heading does not overflow its own row',
    s.head[0].right <= 390 && s.mark[0].right <= s.head[0].right + 1);

  // ── 4. SENDING BLOCK 1 IS WHAT MAKES IT SENT — not typing in it ─────────
  await page.evaluate(tapHead, 0);            // open it again to send from it
  await page.waitForTimeout(200);
  await page.evaluate(tapInto, 0);
  await page.waitForTimeout(200);
  await page.click('#go');
  await page.waitForTimeout(500);
  s = await page.evaluate(read);
  ok('the block that went says SENT — "' + s.mark[0].words + '"', s.mark[0].words === 'sent');
  ok('and it is still red', s.mark[0].color === RED);
  ok('the one that did not is untouched — "' + s.mark[1].words + '"', s.mark[1].words === 'unsent');
  ok('the title says so too — "' + s.title[0] + '"', / · sent/.test(s.title[0]));
  ok('one job really left', posted.length === 1);
  ok('and what went is the block\'s own words', (posted[0].prompt || '').indexOf(ONE) === 0);

  // ── 5. EDITING A SENT BLOCK FLIPS IT BACK — the words sitting there are
  // not the words that went (the Playground's own drawn-array rule) ────────
  await page.evaluate(writeIn, { i: 0, text: ONE + ' and pauses' });
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('one typed word flips it to UNSENT — "' + s.mark[0].words + '"', s.mark[0].words === 'unsent');
  await page.evaluate(writeIn, { i: 0, text: ONE });
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('and putting the words back reads SENT again', s.mark[0].words === 'sent');
  // whitespace she cannot see must not flip a red word
  await page.evaluate(writeIn, { i: 0, text: ONE + '  ' });
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('trailing whitespace is not an edit', s.mark[0].words === 'sent');
  await page.evaluate(writeIn, { i: 0, text: ONE });
  await page.waitForTimeout(200);

  // ── 6. AN EMPTY BLOCK IS NEITHER ────────────────────────────────────────
  await page.evaluate(writeIn, { i: 1, text: '' });
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('an empty block carries no word at all — ' + s.mark[1].display + ' "' + s.mark[1].words + '"',
    s.mark[1].display === 'none' && !s.mark[1].h);
  await page.evaluate(writeIn, { i: 1, text: TWO });
  await page.waitForTimeout(250);

  // ── 7. A REFUSAL IS NOT A SEND ──────────────────────────────────────────
  await page.evaluate(writeIn, { i: 1, text: TWO + ' REFUSEME' });
  await page.waitForTimeout(250);
  await page.evaluate(tapInto, 1);
  await page.waitForTimeout(200);
  const before = posted.length;
  await page.click('#go');
  await page.waitForTimeout(600);
  s = await page.evaluate(read);
  ok('the door really refused it', posted.length === before + 1);
  ok('and the block still says UNSENT — "' + s.mark[1].words + '"', s.mark[1].words === 'unsent');

  // ── 8. IT RIDES THE DRAFT, AND COMES BACK ON A RELOAD ────────────────────
  // The reload she actually meets is the page's own self-heal on a new build,
  // which she never asked for and cannot see coming.
  await page.evaluate(writeIn, { i: 1, text: TWO });
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('the bank is written into the draft beside the words', Array.isArray(s.draft.sent) && s.draft.sent.length === 1);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('both blocks came back', s.n === 2 && s.values[0] === ONE && s.values[1] === TWO);
  ok('and the words still say what they said — "' + s.mark.map((m) => m.words).join('" / "') + '"',
    s.mark[0].words === 'sent' && s.mark[1].words === 'unsent');

  // ── 9. DIVIDING A SENT BLOCK SENDS NEITHER HALF ─────────────────────────
  // The bank is the TEXTS, so this falls out rather than being bookkept: a
  // half is not the block that went.
  await page.evaluate(tapInto, 0);
  await page.waitForTimeout(200);
  await page.evaluate((c) => {
    const el = document.getElementById('prompt');
    el.focus(); el.setSelectionRange(c, c);
  }, ONE.indexOf('and stops'));
  await page.click('#divide');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('three blocks now', s.n === 3);
  ok('and neither half of the sent one claims to have gone — "' + s.mark.slice(0, 2).map((m) => m.words).join('" / "') + '"',
    s.mark[0].words === 'unsent' && s.mark[1].words === 'unsent');

  // ── 10. A PUT-BACK READS SENT — those words came off a clip that drew ────
  await page.waitForFunction(() => !!document.querySelector('#feed .copy'));
  await page.click('#feed .copy');
  await page.waitForTimeout(500);
  s = await page.evaluate(read);
  const back = s.values.map((v, i) => ({ v, i })).filter((x) => x.v.indexOf(ONE) === 0);
  ok('the clip came back into a block of its own', back.length === 1);
  ok('and it reads SENT — "' + (s.mark[back[0].i] || {}).words + '"',
    back.length === 1 && s.mark[back[0].i].words === 'sent');

  // ── 11. A STORY PART READS IT OFF THE SERVER, WITH NO LOCAL BANK AT ALL ──
  // The better of the two sources: #2404 tags every send from a story part with
  // the part and the block's own `words`, and `loadHistory` reads that back over
  // the whole log. So a part reads SENT on a phone that never sent it — which is
  // the case the local bank can never answer, and the reason this runs in a
  // FRESH context (a bank carried over would pass it either way).
  const story = { id: 'st1', title: 'The ward at night' };
  const units = [
    { key: 'm1', ids: ['m1'], text: 'she wakes in the ward and the nurse is at the door' },
    { key: 'm4', ids: ['m4'], text: 'the corridor, and the light at the far end of it' },
    { key: 'm7', ids: ['m7'], text: 'the office, and the chair pulled out from the desk' },
  ];
  // one clip already sent from PART 2, by someone else, before this page existed
  jobs.unshift({ id: 'old1', prompt: 'x', words: units[1].text, unit: 'm4', story: 'st1',
    model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 4, resolution: '480p',
    ratio: '3:4', sound: true, refs: [], status: 'done', video: '', poster: '', seed: 7,
    sentAt: new Date(Date.now() - 6e5).toISOString(), estimate: 4.4, vote: '' });

  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  const errors2 = [];
  p2.on('pageerror', (e) => errors2.push(String(e)));
  await p2.goto(base + '/footage');
  await p2.evaluate((h) => localStorage.setItem('footage_handoff', h),
    JSON.stringify({ prompt: units[0].text, blocks: units.map((u) => u.text), from: 'timeline',
      title: story.title, story, units, at: Date.now() }));
  await p2.goto(base + '/footage');
  await p2.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await p2.waitForTimeout(700);
  let t = await p2.evaluate(read);
  ok('the story landed as three parts', t.n === 3);
  ok('nothing is in this phone\'s bank', !Array.isArray(t.draft.sent) || !t.draft.sent.length);
  ok('the part someone else sent reads SENT off the log — "'
    + t.mark.map((m) => m.words).join('" / "') + '"',
    t.mark[0].words === 'unsent' && t.mark[1].words === 'sent' && t.mark[2].words === 'unsent');
  ok('and it is the same red', t.mark[1].color === RED);
  // and it is still the WORDS, not the part: rewriting the prompt flips it,
  // even though the part it is bound to has not moved
  await p2.evaluate(writeIn, { i: 1, text: units[1].text + ' and a trolley against the wall' });
  await p2.waitForTimeout(300);
  t = await p2.evaluate(read);
  ok('rewriting that part\'s prompt flips it back — "' + t.mark[1].words + '"', t.mark[1].words === 'unsent');
  ok('no page errors on the story page — ' + errors2.join(' | '), errors2.length === 0);

  ok('no page errors — ' + errors.join(' | '), errors.length === 0);

  await browser.close();
  server.close();
  report();
})();

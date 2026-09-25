#!/usr/bin/env node
/* THE RED SENT / UNSENT READS EACH BLOCK'S OWN WORDS OFF THE LOG (2026-09-23,
 * Sophie: "sent/unsent is wrong in footage").
 *
 * The mark asks "are the words in this box words that have gone", and the log
 * carried only `prompt` — what the box's words were MADE INTO: the heads in
 * front and, on an appended send, every block's slot names renumbered onto the
 * joined strip (block 3's `[Image1]` becomes `[Image4]`). So the box's words
 * were never on the log for such a send, and once the page's 20-entry bank
 * rolled off (or a put-back replaced the draft, or another phone opened the
 * page) the block read UNSENT beside the very clip it went in. Every send now
 * files `blocks` — each block's box text as it stood — and every reader of
 * the log matches on it. And one write into the box (a slot name tapped in
 * from the strip) came through no repaint at all, so a sent block kept
 * reading SENT with a new name in it.
 *
 * Pure first: the log helper matches a block through `blocks` where the
 * prompt's run never could, the record keeps the list (capped, empties
 * dropped) and the card hands it back. Then the REAL page headless: a feed
 * clip with a renumbered prompt and its `blocks` reads SENT; the same clip
 * without the list — a clip from before today — reads UNSENT, which is the
 * bug reproduced; an appended send POSTs each picked block's own words; and a
 * slot name tapped into a sent block flips it to UNSENT at once.
 *
 * Run: node scripts/test-footage-sent-blocks.js
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
    console.log('FOOTAGE SENT BLOCKS — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE SENT BLOCKS — ' + pass + ' passed');
}

const F = require('../footage');
const videoLog = require('../video-log');

// ── 1. PURE ────────────────────────────────────────────────────────────────
const BOX3 = 'style: naive painting, like [Image1] [Image2]';       // what block 3's box says
const SENT3 = 'style: naive painting, like [Image4] [Image5]';      // what went, renumbered onto the joined strip
const BOX1 = 'shot 1. Window\nWhat we see: a moon in the pane.';
const LOG = [
  { id: 'appended', d: { status: 'completed', prompt: 'the bedroom\n\n' + BOX1 + '\n\n' + SENT3, blocks: [BOX1, BOX3] } },
  { id: 'older', d: { status: 'completed', prompt: 'the bedroom\n\nan older clip [Image3]', blocks: undefined } },
  { id: 'refused', d: { status: 'failed', prompt: 'never drew', blocks: ['never drew'] } },
];
let got = F.sentAmong(LOG, [BOX3, BOX1, SENT3, 'an older clip [Image3]', 'never drew']);
ok('block 3\'s own words are SENT through `blocks`, though the prompt carries them renumbered', got[BOX3] === true);
ok('block 1 is SENT (it matches either way)', got[F.normWords(BOX1)] === true);
ok('the renumbered text is SENT too — it is a run of the prompt', got[SENT3] === true);
ok('a clip from before today still matches by its prompt', got['an older clip [Image3]'] === true);
ok('a refused clip\'s `blocks` count for nothing', !got['never drew']);
got = F.sentAmong([{ id: 'x', d: { status: 'completed', prompt: 'p', blocks: 'not a list' } }], ['p', 'not a list']);
ok('a malformed `blocks` is ignored, never thrown on', got.p === true && !got['not a list']);

// the record keeps the list: strings only, empties out, capped
const rec = videoLog.sentRecord({ jobId: 'j', prompt: 'p', model: 'm', params: {},
  tag: { chat: 'footage', blocks: ['one', '', '   ', 7, null, 'two', 'x'.repeat(7000)] } });
ok('the doc carries `blocks` — strings, no empties', Array.isArray(rec.blocks) && rec.blocks.length === 3 && rec.blocks[0] === 'one' && rec.blocks[1] === 'two');
ok('each block is capped at 6000', rec.blocks[2].length === 6000);
ok('no list, no field', !('blocks' in videoLog.sentRecord({ jobId: 'j', prompt: 'p', model: 'm', params: {}, tag: { chat: 'footage' } })));
ok('an empty list writes nothing', !('blocks' in videoLog.sentRecord({ jobId: 'j', prompt: 'p', model: 'm', params: {}, tag: { blocks: ['', 3] } })));
const refused = videoLog.refusedRecord({ jobId: 'r', prompt: 'p', model: 'm', params: {}, tag: { blocks: ['b'] }, door: 'atlascloud', refusal: 'content', error: 'no' });
ok('a refused record carries them too', Array.isArray(refused.blocks) && refused.blocks[0] === 'b');
// the card hands them back, and an older doc answers an empty list
const card = F.cardOf('id', { status: 'completed', prompt: 'p', blocks: ['a', 'b', 4] });
ok('the card carries the list, strings only', Array.isArray(card.blocks) && card.blocks.join('|') === 'a|b');
ok('an older doc reads as an empty list', Array.isArray(F.cardOf('id', { status: 'completed', prompt: 'p' }).blocks) && F.cardOf('id', { status: 'completed', prompt: 'p' }).blocks.length === 0);

// ── 2. THE REAL PAGE ───────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage sent blocks: playwright not installed — page half skipped'); report(); return;
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

const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const IMG = (n) => 'https://example.test/pic' + n + '.png';
const posted = [];
// the feed: ONE clip, an appended send of two blocks whose second block was
// renumbered on the way out. `withBlocks` is the switch between today's doc
// and one from before.
let withBlocks = true;
const jobs = () => [{ id: 'app', prompt: BOX1 + '\n\n' + SENT3, blocks: withBlocks ? [BOX1, BOX3] : [],
  words: '', unit: '', story: '', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 8,
  resolution: '480p', ratio: '3:4', sound: true, refs: [], status: 'done', video: '', poster: '', seed: 7,
  sentAt: '2026-09-23T20:54:09.987Z', estimate: 4.4, vote: '' }];
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
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs: jobs(), more: false, folders: {} });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      return json({ ok: true, jobId: 'j' + posted.length, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    // the log knows exactly what the feed knows
    if (u.pathname === '/api/footage/sent' && req.method === 'POST') {
      const b = JSON.parse(body || '{}');
      return json({ ok: true, sent: F.sentAmong(jobs().map((j) => ({ id: j.id, d: { status: 'completed', prompt: j.prompt, blocks: j.blocks } })), b.texts) });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    res.writeHead(404); res.end('nope');
  });
});

const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  return {
    n: wraps.length,
    values: wraps.map((w) => w.querySelector('.pblock').value),
    mark: wraps.map((w) => { const el = w.querySelector('.bsent'); const r = el.getBoundingClientRect(); return { words: (el.textContent || '').trim(), w: r.width, h: r.height }; }),
    slots: Array.from(document.querySelectorAll('button.slot')).map((b) => b.textContent),
  };
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

  // her scene as it stands on the page: block 1 with no pictures, block 3's
  // words in block 2 with its own two pictures — so its names read [Image1]
  // [Image2] in the box, and went out as [Image4] [Image5]
  const draft = { prompt: BOX1, blocks: [BOX3], picks: [true, true],
    jobs: [{ refs: [], first: '', last: '' }, { refs: [{ url: IMG(1), kind: 'image' }, { url: IMG(2), kind: 'image' }], first: '', last: '' }] };
  await page.addInitScript((d) => localStorage.setItem('footage_draft', d), JSON.stringify(draft));

  // a. the clip from BEFORE today — no `blocks` — is the bug reproduced
  withBlocks = false;
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(1800);
  let s = await page.evaluate(read);
  ok('two blocks, the bank empty', s.n === 2);
  ok('block 1 reads SENT off the prompt\'s run — "' + s.mark[0].words + '"', s.mark[0].words === 'sent');
  ok('THE BUG: block 2 reads UNSENT beside the clip it went in, because the prompt carries its names renumbered — "' + s.mark[1].words + '"', s.mark[1].words === 'unsent');

  // b. the same clip filed today carries `blocks`, and the page reads it
  withBlocks = true;
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(1800);
  s = await page.evaluate(read);
  ok('with `blocks` on the clip, block 2 reads SENT — "' + s.mark[1].words + '"', s.mark[1].words === 'sent' && s.mark[1].w > 0 && s.mark[1].h > 0);
  ok('and block 1 still does', s.mark[0].words === 'sent');

  // c. an appended send POSTs each picked block's own words, and the prompt renumbered
  await page.click('#go');
  await page.waitForTimeout(900);
  ok('one job posted — ' + posted.length, posted.length === 1);
  const b = posted[0] || {};
  ok('the prompt is the joined scene with block 2 renumbered onto the strip', typeof b.prompt === 'string' && b.prompt.indexOf(BOX1) === 0 && b.prompt.indexOf('[Image1] [Image2]') > 0);
  ok('`blocks` is each picked block\'s own box text — ' + JSON.stringify(b.blocks), Array.isArray(b.blocks) && b.blocks.length === 2 && b.blocks[0] === BOX1 && b.blocks[1] === BOX3);

  // d. a slot name tapped into a SENT block flips it to UNSENT at once
  await page.evaluate(() => {
    const panel = document.querySelector('.panel');
    const w = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'))[1];
    const el = w.querySelector('.pblock'); el.focus(); el.setSelectionRange(el.value.length, el.value.length);
  });
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('block 2 is the active block and its strip shows two slot names — ' + JSON.stringify(s.slots), s.slots.length === 2 && s.mark[1].words === 'sent');
  // the strip is folded after a send (her rule), so the button is tapped in
  // hand — it is the handler that is under test, not the fold
  await page.evaluate(() => document.querySelector('button.slot').click());
  await page.waitForTimeout(100);
  s = await page.evaluate(read);
  ok('the name landed in the box — "' + s.values[1].slice(-12) + '"', /\[Image1\]$/.test(s.values[1]) && s.values[1] !== BOX3);
  ok('and the mark reads UNSENT before any keystroke — "' + s.mark[1].words + '"', s.mark[1].words === 'unsent');
  const color = await page.evaluate(() => getComputedStyle(document.querySelectorAll('.promptwrap .bsent')[1]).color);
  ok('in the red', color === RED);
  ok('no page errors — ' + errors.join(' | '), errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

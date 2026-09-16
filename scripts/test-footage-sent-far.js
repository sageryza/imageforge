#!/usr/bin/env node
/* THE RED SENT / UNSENT ASKS THE WHOLE LOG (2026-09-16, Sophie:
 * "sent/unsent seems to be wrong or backwards").
 *
 * Measured on her screen that night: block 2 and block 4 had gone out inside
 * twelve longer clips over two days, every one of them past the newest forty
 * in ALL, so both read UNSENT beside a block 7 that had just gone. Every
 * source the mark had was a window — the bank's last 20 sends, a story part's
 * own hist, the forty clips on screen. So the page asks `POST /sent` for the
 * words it does not know, and the server answers off the whole log.
 *
 * First the helper, pure: the match is the page's own — a whole prompt, the
 * `words`, a contiguous run of `\n\n` paragraphs — never a phrase inside one,
 * never a failed clip. Then the REAL page headless against a stub whose FEED
 * IS EMPTY (the clip aged out) and whose log knows the words: the heading has
 * to read SENT off the ask, a block the log never saw stays UNSENT, an edit
 * flips it back, the page asks only for words it does not know, and a page
 * whose blocks are all known asks nothing.
 *
 * Run: node scripts/test-footage-sent-far.js
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
    console.log('FOOTAGE SENT FAR — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE SENT FAR — ' + pass + ' passed');
}

const F = require('../footage');

// ── 1. THE HELPER, PURE ────────────────────────────────────────────────────
const LOG = [
  { id: 'old', d: { status: 'completed', words: '', prompt:
    'the living room\n\nvoiceover (wide warm male baritone): *this* christmas...even your "GLOOmiest" daughter...can be happy.\n\nshot 1: a girl [Image2]coming down the stairs.\n\ncut to: she opens the "huge witchcraft kit"' } },
  { id: 'part', d: { status: 'completed', words: 'the part\'s own words', prompt: 'cast head\n\nthe part\'s own words' } },
  { id: 'gone', d: { status: 'failed', prompt: 'this one never drew' } },
  { id: 'tall', d: { status: 'completed', prompt: Array.from({ length: F.SENT_SEGS_MAX + 1 }, (_, i) => 'para ' + i).join('\n\n') } },
];
const got = F.sentAmong(LOG, [
  'voiceover (wide warm male baritone): *this* christmas...even your "GLOOmiest" daughter...can be happy.',
  'cut to:  she opens the "huge witchcraft kit"',
  'shot 1: a girl [Image2]coming down the stairs.\n\ncut to: she opens the "huge witchcraft kit"',
  'she opens the "huge witchcraft kit"',
  'the part\'s own words',
  'this one never drew',
  'para 3',
  LOG[3].d.prompt,
  '', '   ',
]);
ok('a paragraph of a longer clip is SENT', got['voiceover (wide warm male baritone): *this* christmas...even your "GLOOmiest" daughter...can be happy.'] === true);
ok('whitespace she cannot see is not an edit', got['cut to: she opens the "huge witchcraft kit"'] === true);
ok('a run of two paragraphs is SENT', got['shot 1: a girl [Image2]coming down the stairs. cut to: she opens the "huge witchcraft kit"'] === true);
ok('a phrase INSIDE a paragraph is not', !got['she opens the "huge witchcraft kit"']);
ok('the part\'s own `words` count', got["the part's own words"] === true);
ok('a failed clip counts for nothing', !got['this one never drew']);
ok('past the segment cap a paragraph is not matched by run…', !got['para 3']);
ok('…but the whole prompt still is', got[F.normWords(LOG[3].d.prompt)] === true);
ok('empty asks answer nothing', Object.keys(got).length === 5 && !got['']);
ok('nothing asked, nothing answered', Object.keys(F.sentAmong(LOG, [])).length === 0 && Object.keys(F.sentAmong(LOG, null)).length === 0);

// ── 2. THE REAL PAGE ───────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage sent far: playwright not installed — page half skipped'); report(); return;
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
const FAR = 'voiceover (wide warm male baritone): *this* christmas...even your "GLOOmiest" daughter...can be happy.';
const NEVER = 'block two — the assistant is already standing at the window';
// the log the SERVER holds: the clip that carried FAR is here, and the feed
// the page loads is EMPTY — it aged out of the forty
const serverLog = [{ id: 'aged', d: { status: 'completed', prompt: 'the living room\n\n' + FAR + '\n\nshot 1: a girl coming down the stairs.' } }];
const asks = [];
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
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs: [], more: false, folders: {} });
    if (u.pathname === '/api/footage/sent' && req.method === 'POST') {
      const b = JSON.parse(body || '{}');
      asks.push(b.texts || []);
      return json({ ok: true, sent: F.sentAmong(serverLog, b.texts) });
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
    mark: wraps.map((w) => { const el = w.querySelector('.bsent'); const r = el.getBoundingClientRect(); return { words: (el.textContent || '').trim(), w: r.width, h: r.height, color: getComputedStyle(el).color }; }),
  };
};
const writeIn = (a) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const el = wraps[a.i].querySelector('.pblock');
  el.focus();
  el.value = a.text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
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
  await page.waitForTimeout(1200);
  ok('an empty page asks the log for nothing — ' + asks.length, asks.length === 0);

  // two blocks: one the log carried inside a longer clip, one it never saw
  await page.evaluate(writeIn, { i: 0, text: FAR });
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.click('#divide');
  await page.waitForTimeout(250);
  await page.evaluate(writeIn, { i: 1, text: NEVER });
  await page.waitForTimeout(1500);   // past the debounce and the answer
  let s = await page.evaluate(read);
  ok('two blocks', s.n === 2);
  ok('the feed is empty, and block 1 still reads SENT off the log — "' + s.mark[0].words + '"',
    s.mark[0].words === 'sent' && s.mark[0].w > 0 && s.mark[0].h > 0 && s.mark[0].color === RED);
  ok('the block the log never saw reads UNSENT — "' + s.mark[1].words + '"', s.mark[1].words === 'unsent');
  ok('it asked once, for both — ' + JSON.stringify(asks.map((a) => a.length)), asks.length === 1 && asks[0].length === 2);

  // an edit breaks the match on the keystroke; the unknown words are asked, the known ones are not
  await page.evaluate(writeIn, { i: 0, text: FAR + ' and a word' });
  s = await page.evaluate(read);
  ok('one changed word and it reads UNSENT at once — "' + s.mark[0].words + '"', s.mark[0].words === 'unsent');
  await page.waitForTimeout(1500);
  s = await page.evaluate(read);
  ok('the log does not know the edit either', s.mark[0].words === 'unsent');
  ok('the second ask carried only the edited words — block 2 was asked a minute ago — ' + JSON.stringify(asks[asks.length - 1]),
    asks.length === 2 && asks[1].length === 1 && /and a word$/.test(asks[1][0]));
  // put the word back: SENT again, from memory, with no third ask
  await page.evaluate(writeIn, { i: 0, text: FAR });
  await page.waitForTimeout(1500);
  s = await page.evaluate(read);
  ok('the words restored read SENT again — "' + s.mark[0].words + '"', s.mark[0].words === 'sent');
  ok('and nothing was asked again for them — ' + asks.length, asks.length === 2);

  // a reload: the feed is still empty, the bank never had it, and the log answers again
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(1500);
  s = await page.evaluate(read);
  ok('after a reload block 1 reads SENT off the log alone — "' + (s.mark[0] || {}).words + '"', s.n === 2 && s.mark[0].words === 'sent');
  ok('no page errors — ' + errors.join(' | '), errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

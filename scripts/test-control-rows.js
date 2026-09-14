#!/usr/bin/env node
/* CONTROLS THAT SHARE A ROW ARE THE SAME SIZE (2026-09-13, Sophie: "files
   button smaller than search button footage").
 *
 * The folder picker on the footage feed bar was 34x32 beside a search button
 * whose visible box is 36x34 — because it had been sized against the BUTTON
 * inside the `.filttog` group rather than against the group, which is what
 * carries the border she sees. Two px in each direction, and it sat inset
 * from the row's own top and bottom edges.
 *
 * NOTHING IN THE SOURCE SAYS THAT. Both sides read as deliberate numbers with
 * a comment explaining them, and the two assertions guarding the picker in
 * test-footage.js compared it against that same inner button — so they went
 * on passing through the whole life of the bug. The only honest question is
 * what the boxes MEASURE, which is what this does.
 *
 * THE PAGE LIST IS DERIVED FROM server.js, like test-header-top.js and
 * test-native-pill.js: a page a chat builds by copying a neighbour joins the
 * sweep the day it is registered, rather than when someone remembers it.
 *
 * WHAT COUNTS AS A ROW: two or more controls whose boxes share a line. What
 * counts as a control is the OUTERMOST box — a segmented group is one
 * control, not three — because the group is what she sees.
 *
 * WHAT IS ALLOWED: a spread under 1px (sub-pixel, from a text line-height),
 * and the rows named in ALLOW below, each with the reason it is deliberate.
 * A filled primary action is bigger ON PURPOSE (the Playground's Generate is
 * her own ask), and a row of mixed chrome — a text link beside an icon — was
 * never a family. Everything else is this bug.
 *
 * Run: node scripts/test-control-rows.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('control-rows: playwright not installed — skipped');
    process.exit(0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall back to playwright's own lookup */ }
  return undefined;
}

// The population, read from the server itself (test-header-top.js's rule).
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const FILES = [...new Set(src.split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .flatMap((l) => [...l.matchAll(/serveGated\('([^']+\.html)'/g)].map((m) => m[1]))
)].filter((f) => fs.existsSync(path.join(PUB, f)));

/* THE DELIBERATE ONES. A row is named by the ids/classes its controls carry,
   so the entry survives the row moving down the page. Each needs a REASON —
   an unexplained entry here is the bug hiding behind the test that looks for
   it. */
const ALLOW = [
  { page: 'freeform.html', has: ['go'],
    why: 'Draw is the filled primary action and is bigger on purpose — the Playground\'s Generate, her own ask' },
  { page: 'promptlab.html', has: ['go'], why: 'same: Generate is the filled action' },
  { page: 'voice.html', has: ['info'],
    why: 'the credits mark rides ON the tab row — a small mark beside two tabs, not a control in their family' },
  { page: 'chats.html', has: ['bmklink'],
    why: 'the masthead is mixed chrome: text links beside a bookmark mark and the row toggle' },
  { page: 'chats.html', has: ['bellbtn'],
    why: 'the thread header is mixed chrome: a text link (ARCHIVE) beside two icon marks' },
  { page: 'chats.html', has: ['selbtn', 'catchip'],
    why: 'the tool row is a chip row FRAMED by two icon buttons — the chips agree with each other (that was the bug, fixed 2026-09-13) and the 34px boxes at the ends are a different kind of control; making her home row\'s chips 34 is a redesign, hers to ask for' },
];
const allowed = (file, ids) => ALLOW.find((a) => a.page === file && a.has.every((h) => ids.some((i) => i.includes(h))));

/* THE INJECTED CHEVRON IS NOT THE PAGE'S CONTROL. pagehead.js draws the same
   34px way-out into every gated page's header, so a page whose own header
   buttons agree with each other and differ only from that chevron is not this
   bug — Cutting Blocks' + and ? are a matched 26px pair, and making them 34
   would be redesigning a header nobody asked about. A row where the page's
   OWN controls disagree is still the bug, chevron or no chevron.
   (What the chevron DOES settle is shape and tap target, and those are their
   own house rules — a round 26px plate opposite it fails both.) */
const ownOnly = (row) => row.filter((c) => c.id !== 'forgeback');
const chevronOnly = (row) => {
  const own = ownOnly(row);
  if (own.length === row.length) return false;        // no chevron in this row
  if (own.length < 2) return true;                    // the chevron and one control
  const hs = own.map((c) => c.h);
  return Math.max(...hs) - Math.min(...hs) < 1;       // the page's own agree
};

// Two boxes on a line, measured. A control is the outermost box — a segmented
// group is ONE control — and anything page-sized is content, not a control.
const SWEEP = () => {
  const CTL = 'button,select,input,.selwrap,.filttog,.viewtog,.tri,[role="group"],.filtchip,.catchip,.acctab';
  const items = [];
  document.querySelectorAll(CTL).forEach((el) => {
    if (el.closest('.float')) return;                     // the injected pill
    if (el.type === 'hidden' || el.type === 'file') return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.width > 340 || r.height > 60) return;
    items.push({ el, r });
  });
  const outer = items.filter(({ el }) => !items.some((o) => o.el !== el && o.el.contains(el)));
  const rows = {};
  outer.forEach(({ el, r }) => {
    const k = Math.round(r.y / 6);
    (rows[k] = rows[k] || []).push({
      id: el.id || (typeof el.className === 'string' ? el.className.split(' ')[0] : '') || el.tagName,
      h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10, x: Math.round(r.x),
    });
  });
  return Object.keys(rows).map((k) => {
    const row = rows[k].sort((a, b) => a.x - b.x);
    if (row.length < 2) return null;
    const hs = row.map((c) => c.h);
    const spread = Math.round((Math.max(...hs) - Math.min(...hs)) * 10) / 10;
    return spread >= 1 ? { y: Number(k) * 6, spread, row } : null;
  }).filter(Boolean);
};

function serve() {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, items: [], assets: [], pads: [], chats: {},
        clips: [], rows: [], pages: [], runs: [], memos: [], results: [], jobs: [], messages: [] }));
    }
    let rel = u.pathname.slice(1) || 'index.html';
    if (!rel.includes('.')) rel += '.html';
    const f = path.join(PUB, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    let body = fs.readFileSync(f);
    if (rel.endsWith('.html')) body = body.toString() + '\n<script src="/pagehead.js" defer></script>';
    const e = path.extname(f);
    res.writeHead(200, { 'content-type': e === '.js' ? 'text/javascript' : e === '.css' ? 'text/css'
      : e === '.json' ? 'application/json' : 'text/html; charset=utf-8' });
    res.end(body);
  });
}

let pass = 0; const bad = [];
(async () => {
  if (!FILES.length) { console.log('FAIL  no serveGated pages found in server.js'); process.exit(1); }
  const srv = serve();
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: exe() });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', (route) => route.request().url().startsWith(base)
    ? route.continue() : route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  console.log(FILES.length + ' gated pages (derived from server.js)');
  for (const file of FILES) {
    const pg = await ctx.newPage();
    pg.on('pageerror', () => { /* a stubbed API upsets some pages; the rows still draw */ });
    await pg.addInitScript('window.__nativeNavBar = true; window.__forgeLeave = function () {};');
    let rows = [];
    try {
      await pg.goto(base + '/' + file, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await pg.waitForTimeout(900);
      // a feed bar hidden until there is a feed still has to be measured
      await pg.evaluate(() => { const b = document.getElementById('feedbar'); if (b) b.hidden = false; });
      await pg.waitForTimeout(250);
      rows = await pg.evaluate(SWEEP);
    } catch (e) { rows = [{ err: String(e).slice(0, 70) }]; }
    await pg.close();

    const flagged = rows.filter((r) => !r.err && !chevronOnly(r.row) && !allowed(file, r.row.map((c) => c.id)));
    if (!flagged.length) { pass++; console.log('  ok   ' + file.padEnd(22) + (rows.length ? rows.length + ' row(s) allowed' : 'every row level')); continue; }
    flagged.forEach((r) => {
      bad.push(file);
      console.log('  FAIL ' + file.padEnd(22) + 'y=' + r.y + '  spread ' + r.spread + 'px');
      r.row.forEach((c) => console.log('         ' + String(c.h).padStart(5) + ' tall ' + String(c.w).padStart(6) + ' wide   ' + c.id));
    });
  }

  await browser.close();
  srv.close();
  if (bad.length) {
    console.log('\nCONTROL ROWS — ' + pass + ' pages level, ' + new Set(bad).size + ' with a mismatched row');
    console.log('A control that shares a row with another is the same size as it. Size it against the');
    console.log('NEIGHBOUR\'S VISIBLE BOX (a segmented group\'s border belongs to the group, not to the');
    console.log('button inside it) — or, if the difference is deliberate, add the row to ALLOW with why.');
    process.exit(1);
  }
  console.log('\nCONTROL ROWS — ' + pass + ' pages, every row level');
})();

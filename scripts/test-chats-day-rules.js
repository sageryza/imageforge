#!/usr/bin/env node
// SEPARATED BY DATE, WITH A 5AM PACIFIC CUT (2026-08-28, Sophie: "separate
// chats by date" · "5am pst cut off").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the list is broken by hairline date headings, one per working day, in
//      the same newest-first order the rows already had,
//   2. THE CUT IS 5AM PACIFIC — a chat whose last reply landed at 2am sits
//      under the day BEFORE it, beside the 10pm one, because that is the same
//      working night,
//   3. …and 5:30am starts the new day, so the boundary is the hour and not a
//      fudge that happens to group late nights,
//   4. the newest heading reads Today (or Yesterday when the run itself is
//      before 5am) rather than a date,
//   5. a PINNED chat gets its own heading and never a date one — it sits above
//      the sort by her override, so its date says nothing about its place,
//   6. no key is ever headed twice, and every row sits under its own day,
//   7. the tiles view carries the same headings, spanning the whole grid.
//
//   npm install playwright-core --no-save && node scripts/test-chats-day-rules.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const TZ = 'America/Los_Angeles';
const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const laParts = (ms) => {
  const p = {}; FMT.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24 };
};
// An INDEPENDENT implementation of the rule, so the test is not the page's own
// arithmetic read back to itself.
const keyOf = (ms) => {
  const p = laParts(ms);
  let t = Date.UTC(p.y, p.m - 1, p.d);
  if (p.h < 5) t -= 86400000;
  const q = new Date(t);
  return q.toISOString().slice(0, 10);
};
// The UTC instant of a given LA wall clock — found by measuring, because the
// offset is PST half the year and PDT the other half.
const laInstant = (y, m, d, h) => {
  let t = Date.UTC(y, m - 1, d, h) + 8 * 3600000;
  for (let i = 0; i < 4; i++) {
    const p = laParts(t);
    const drift = (Date.UTC(p.y, p.m - 1, p.d, p.h) - Date.UTC(y, m - 1, d, h));
    if (!drift) break;
    t -= drift;
  }
  return t;
};

const now = Date.now();
const todayKey = keyOf(now);
// A calendar date safely in the past, so nothing here races midnight.
const base = new Date(Date.UTC(+todayKey.slice(0, 4), +todayKey.slice(5, 7) - 1, +todayKey.slice(8, 10)) - 3 * 86400000);
const B = { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
const next = new Date(base.getTime() + 86400000);
const N = { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };

const at = {
  evening: laInstant(B.y, B.m, B.d, 22),      // 10pm  → the base day
  smallhours: laInstant(N.y, N.m, N.d, 2),    // 2am   → STILL the base day
  morning: laInstant(N.y, N.m, N.d, 5) + 30 * 60000, // 5:30am → the next day
  fresh: now - 5 * 60000,
  ancient: laInstant(B.y, B.m, B.d, 9) - 40 * 86400000,
};
const iso = (ms) => new Date(ms).toISOString();
const MSGS = [
  { id: 'm1', chat: 'evening', from: 'claude', text: 'ten at night', tldr: 'evening', created: iso(at.evening), postedAt: iso(at.evening) },
  { id: 'm2', chat: 'smallhours', from: 'claude', text: 'two in the morning', tldr: 'late', created: iso(at.smallhours), postedAt: iso(at.smallhours) },
  { id: 'm3', chat: 'morning', from: 'claude', text: 'half five', tldr: 'morning', created: iso(at.morning), postedAt: iso(at.morning) },
  { id: 'm4', chat: 'fresh', from: 'claude', text: 'just now', tldr: 'fresh', created: iso(at.fresh), postedAt: iso(at.fresh) },
  { id: 'm5', chat: 'pinned', from: 'claude', text: 'old but pinned', tldr: 'pinned', created: iso(at.ancient), postedAt: iso(at.ancient) },
];
const EXPECT = { evening: keyOf(at.evening), smallhours: keyOf(at.smallhours), morning: keyOf(at.morning), fresh: keyOf(at.fresh) };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false, settings: {},
      chats: {
        evening: { lastSeen: MSGS[0].created },
        smallhours: { lastSeen: MSGS[1].created },
        morning: { lastSeen: MSGS[2].created },
        fresh: { lastSeen: MSGS[3].created },
        pinned: { lastSeen: MSGS[4].created, pinTop: true },
      } }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
let checks = 0; const ok = () => { checks++; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(baseUrl + '/chats');
  await page.waitForSelector('#grid .crow[data-chat="fresh"]');

  // The list as she reads it: headings and rows, in order.
  const seq = await page.$$eval('#grid .clist > *', (ns) => ns.map((n) => (
    n.classList.contains('dayrule') ? { rule: n.textContent.trim() } : { chat: n.dataset.chat })));

  // ── 1. there are headings at all, and every row sits under one ────────────
  if (!seq.length || !seq[0].rule) fail('the list does not open with a date heading');
  else ok();
  const under = {}; let cur = null;
  seq.forEach((x) => { if (x.rule) cur = x.rule; else under[x.chat] = cur; });
  if (Object.values(under).some((v) => v == null)) fail('a chat row sits above every heading');
  else ok();

  // ── 5. the pinned chat has its own heading ───────────────────────────────
  if (seq[0].rule !== 'Pinned') fail('the first heading is "' + seq[0].rule + '", not Pinned');
  else ok();
  if (under.pinned !== 'Pinned') fail('the pinned chat is filed under "' + under.pinned + '" — its date says nothing about where it sits');
  else ok();

  // ── 2/3. the 5am cut ─────────────────────────────────────────────────────
  if (EXPECT.evening !== EXPECT.smallhours) fail('the test fixture is wrong: 10pm and 2am should share a working day');
  else ok();
  if (under.smallhours !== under.evening) {
    fail('2am was filed under "' + under.smallhours + '" and 10pm under "' + under.evening + '" — the day turns over at 5am, not midnight');
  } else ok();
  if (under.morning === under.evening) fail('5:30am is still under the night before — the cut is not being applied at 5am');
  else ok();

  // ── 4. today reads Today ─────────────────────────────────────────────────
  const wantFresh = EXPECT.fresh === todayKey ? 'Today' : 'Yesterday';
  if (under.fresh !== wantFresh) fail('the newest chat is headed "' + under.fresh + '", expected ' + wantFresh);
  else ok();
  if (/\d{4}-\d{2}-\d{2}/.test(seq.map((x) => x.rule || '').join(' '))) fail('a heading is showing a raw key rather than a date she can read');
  else ok();

  // ── 6. one heading per day, in order, and the days descend ───────────────
  const rules = seq.filter((x) => x.rule).map((x) => x.rule);
  if (new Set(rules).size !== rules.length) fail('a day is headed twice: ' + rules.join(' | '));
  else ok();
  const keys = seq.filter((x) => x.chat && x.chat !== 'pinned').map((x) => EXPECT[x.chat]);
  const sorted = keys.slice().sort().reverse();
  if (keys.join() !== sorted.join()) fail('the rows are no longer newest-first: ' + keys.join(' > '));
  else ok();
  // Each heading really does cover one day and nothing else.
  const byRule = {};
  seq.forEach((x) => { if (x.chat && x.chat !== 'pinned') (byRule[under[x.chat]] = byRule[under[x.chat]] || []).push(EXPECT[x.chat]); });
  if (Object.values(byRule).some((ks) => new Set(ks).size !== 1)) fail('a heading covers rows from more than one day');
  else ok();

  // ── 7. the tiles view says the same thing, across the grid ───────────────
  // The page's script is one IIFE and the List/Tiles toggle is gone from the
  // tool row (`view` is pinned to 'list'; renderTiles is kept at her ask), so
  // there is no way in from outside: the renderer is pinned by SOURCE and the
  // rule's geometry is MEASURED on the real grid's own CSS.
  const src = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  const tilesFn = src.slice(src.indexOf('function renderTiles('), src.indexOf('function renderTiles(') + 1800);
  if (!/chatDayKey\(name,\s*last\)/.test(tilesFn) || !/mkDayRule\(dk\b/.test(tilesFn)) {
    fail('renderTiles draws no date headings — a marker that works in one of the two views and not the other is a bug');
  } else ok();
  const span = await page.evaluate(() => {
    const g = document.createElement('div'); g.id = 'chatgrid';
    const r = document.createElement('div'); r.className = 'dayrule'; r.innerHTML = '<span>Today</span>';
    g.appendChild(r);
    for (let i = 0; i < 3; i++) { const t = document.createElement('div'); t.className = 'tile'; t.textContent = 'x'; g.appendChild(t); }
    document.getElementById('grid').appendChild(g);
    const w = r.getBoundingClientRect().width / g.getBoundingClientRect().width;
    const top = g.querySelectorAll('.tile')[0].getBoundingClientRect().top > r.getBoundingClientRect().bottom;
    g.remove();
    return { w, top };
  });
  if (span.w < 0.98) fail('a tiles heading spans only ' + Math.round(span.w * 100) + '% of the grid — it must be grid-column:1/-1');
  else ok();
  if (!span.top) fail('the tiles under a heading do not start on a clean row below it');
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.log('\n' + checks + ' passed, with failures above');
  else console.log('\nOK — ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });

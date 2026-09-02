#!/usr/bin/env node
// The work log — `worklogRows` and workday.js pure, then the real
// public/worklog.html in headless Chromium against a stub API.
//
// What it pins, and why each is a measurement rather than a markup assertion:
//   • THE TIMELINE: one lane per project in its own colour, no two neighbours
//     alike (the fill READ off the real paths); a run split by two quiet days
//     draws TWO lumps and a run with one quiet day inside draws ONE (counted
//     off the rendered paths); the board scrolls sideways and the names STAY
//     PUT while it does (their x measured before and after the scroll);
//     tapping a lane opens its chats as links; the window itself has nothing
//     to scroll, which is what lets the injected pill adopt the board.
//   • THE LIST (v1, the record): OLDEST FIRST, BY THE DAY A CHAT BEGAN —
//     `startedAt`, never `lastSeen` (measured 2026-09-02: lastSeen is the
//     NEWEST message on every thread checked). A chat with no stamp falls back
//     honestly and says so.
//   • THE DAY TURNS OVER AT 5AM PACIFIC, checked against an INDEPENDENT copy
//     of the rule here (never workday.js read back to itself): a reply at 2am
//     Pacific sits under the day before — and chats.html's own dayKey is
//     driven over the same instants, so the app and the log cannot drift.
//   • HER OWN SENTENCE LEADS the line and reads italic; a chat's paraphrase
//     does not — the row line is COMPUTED (font-style), not asserted by class.
//   • A ROW IS A LINK TO ITS CHAT, and inside an iframe host the parent's
//     __openThread bridge takes the tap instead of the href.
//   • NO PAGE ERRORS — a page-level `let` sharing a name with the injected
//     pill's own `var` kills the pill's script at parse time.
//
// Run: node scripts/test-worklog-page.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { worklogRows, worklogLine } = require('../chatfeed.js');
const WD = require('../workday.js');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

// ---- the independent 5am rule -------------------------------------------------
function laDay(iso) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' });
  const p = {}; f.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  let t = Date.UTC(+p.year, +p.month - 1, +p.day);
  if ((+p.hour) % 24 < 5) t -= 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

console.log('workday.js');
const INSTANTS = ['2026-08-21T09:30:00.000Z', '2026-08-21T12:00:00.000Z', '2026-08-21T11:59:59.000Z',
  '2026-01-15T12:30:00.000Z', '2026-07-05T06:59:00.000Z', '2026-09-02T04:59:00.000Z'];
ok('dayKey agrees with an independent copy of the 5am rule on six instants (PDT and PST)',
  INSTANTS.every((i) => WD.dayKey(i) === laDay(i)), INSTANTS.map((i) => [WD.dayKey(i), laDay(i)]));
// chats.html's own copy, EXTRACTED from the page and driven over the same instants.
(() => {
  const html = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  const grab = (name) => { const m = html.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')); return m ? m[0] : ''; };
  const src = 'var DAY_TZ="America/Los_Angeles", DAY_CUT_H=5, _dayFmt=null; function pad2(n){return (n<10?"0":"")+n;}\n'
    + grab('laStamp') + '\n' + grab('dayKey') + '\n';
  const ctx = { Intl, Date }; vm.createContext(ctx);
  try { vm.runInContext(src + 'this.out = INSTANTS.map(dayKey);', Object.assign(ctx, { INSTANTS })); } catch (e) { ctx.out = [String(e)]; }
  ok('…and with chats.html\'s own dayKey', JSON.stringify(ctx.out) === JSON.stringify(INSTANTS.map(laDay)), ctx.out);
})();
const runs = WD.runsOf(['2026-08-04', '2026-08-01', '2026-08-02', '2026-08-07', '2026-08-08']);
ok('a one-day gap stays one run, a two-day gap starts another', runs.map((r) => r.from + '..' + r.to).join(' ') === '2026-08-01..2026-08-04 2026-08-07..2026-08-08', runs);
ok('a run knows its days', runs[0].days.length === 3 && runs[1].days.length === 2);
ok('addDays crosses a month', WD.addDays('2026-08-31', 1) === '2026-09-01' && WD.daysBetween('2026-07-30', '2026-08-02') === 3);

// ---- the pure half ---------------------------------------------------------
console.log('worklogRows');
const CHATS = {
  __settings: { anything: true },
  'old-one': { startedAt: '2026-08-10T18:00:00.000Z', lastSeen: '2026-08-12T02:00:00.000Z',
    displayName: 'The old one', wrapAsked: 'make the thing pink', wrapAskedHers: true, archived: true, labels: ['story'] },
  // 2026-08-21T09:30Z = 2:30am Pacific (PDT) → belongs to Aug 20
  'night-owl': { startedAt: '2026-08-21T09:30:00.000Z', lastSeen: '2026-08-21T09:40:00.000Z',
    updAsked: 'a timeline of the work' },
  'noon': { startedAt: '2026-08-21T19:00:00.000Z', lastSeen: '2026-08-21T19:05:00.000Z', wrapLine: 'Built the page' },
  'unstamped': { lastSeen: '2026-08-15T20:00:00.000Z', repliedAt: '2026-08-15T20:00:00.000Z', sophieNote: 'the og' },
  'gone': { startedAt: '2026-08-01T00:00:00.000Z', lastSeen: '2026-08-01T00:00:00.000Z', deletedAt: '2026-08-02T00:00:00.000Z' },
  'moved': { movedTo: 'old-one' },
  'never-posted': { displayName: 'Nothing here' },
};
const rows = worklogRows(CHATS);
ok('settings, the trash, tombstones and never-posted are out', rows.map((r) => r.chat).join() === 'old-one,unstamped,night-owl,noon', rows.map((r) => r.chat));
ok('sorted by start, oldest first', rows[0].chat === 'old-one' && rows[rows.length - 1].chat === 'noon');
ok('a stamped chat lists at its START, not its newest message', rows[0].at === '2026-08-10T18:00:00.000Z' && rows[0].atFrom === 'start');
ok('an unstamped chat falls back to its newest and SAYS SO', rows[1].at === '2026-08-15T20:00:00.000Z' && rows[1].atFrom === 'last');
ok('her verbatim sentence leads, marked hers', rows[0].line === 'make the thing pink' && rows[0].hers === true);
ok('the Update card is next, not hers', rows[2].line === 'a timeline of the work' && rows[2].hers === false);
ok('then the wrap-up line', rows[3].line === 'Built the page');
ok('her note counts as hers', rows[1].line === 'the og' && rows[1].hers === true);
ok('a paraphrased wrapAsked is NOT marked hers', worklogLine({ wrapAsked: 'x', wrapAskedHers: false }).hers === false);
ok('archived and labels ride along', rows[0].archived === true && rows[0].labels[0] === 'story');

// What the route adds for the timeline: days and projects. Two projects, one
// chat on none; `story` worked Aug 10-12 and again Aug 20-21 (a 7-day gap →
// two lumps), `night` on Aug 20 and Aug 22 (one quiet day → one lump).
const days = {
  'old-one': { '2026-08-10': 3, '2026-08-11': 9, '2026-08-12': 2 },
  'noon': { '2026-08-20': 4, '2026-08-21': 1 },
  'night-owl': { '2026-08-20': 2, '2026-08-22': 1 },
  'unstamped': { '2026-08-15': 5 },
};
const projects = { 'old-one': ['story'], 'noon': ['story'], 'night-owl': ['night'], 'unstamped': [] };
rows.forEach((r) => { r.days = days[r.chat]; r.projects = projects[r.chat]; });
const DATA = { ok: true, rows, vocab: { story: 'story', night: 'night' }, today: '2026-09-10' };   // wide enough that the board must scroll at 390pt

// ---- the page ----------------------------------------------------------------
function chromiumExe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((x) => /^chromium-\d/.test(x))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

(async () => {
  let pw;
  try { pw = require('playwright'); } catch { /* not installed here */ }
  if (!pw) { console.log('page tests skipped — playwright not installed'); process.exit(fails ? 1 : 0); }

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/chatfeed/worklog')) {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(DATA));
    }
    if (req.url.startsWith('/host.html')) {
      res.setHeader('content-type', 'text/html');
      return res.end('<script>window.__openThread=function(n){window.__opened=n;return true;};</script>' +
        '<iframe id="f" src="/worklog.html" style="width:390px;height:800px"></iframe>');
    }
    const f = req.url === '/' ? '/worklog.html' : req.url.split('?')[0];
    // /workday.js is served from the repo root by server.js (the pause-plan.js
    // pattern); everything else is public/.
    try {
      const body = fs.readFileSync(path.join(f === '/workday.js' ? ROOT : PUB, f));
      res.setHeader('content-type', f.endsWith('.css') ? 'text/css'
        : f.endsWith('.js') ? 'text/javascript' : 'text/html');
      res.end(body);
    } catch (e) { res.statusCode = 404; res.end(''); }
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const exe = chromiumExe();
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.evaluate(() => { try { localStorage.removeItem('worklog.view'); } catch (e) {} }).catch(() => {});
  await page.goto(base + '/worklog.html', { waitUntil: 'networkidle' });

  console.log('the timeline');
  ok('no page errors (the pill parses)', errs.length === 0, errs);
  ok('it opens on the timeline', await page.locator('#time').isVisible() && await page.locator('#list').isHidden());
  const lanes = await page.$$eval('.lane:not(.sub)', (ls) => ls.map((l) => ({
    name: l.querySelector('.nm span').textContent, n: l.querySelector('.cnt').textContent,
    lumps: l.querySelectorAll('.lump').length, fill: l.querySelector('.lump') && l.querySelector('.lump').getAttribute('fill'),
  })));
  ok('one lane per project, in the order they began, the one-offs last', lanes.map((l) => l.name).join() === 'Story,Night,One-offs', lanes.map((l) => l.name));
  ok('each lane counts its chats', lanes.map((l) => l.n).join() === '2,1,1', lanes.map((l) => l.n));
  ok('a run broken by a week draws TWO lumps', lanes[0].lumps === 2, lanes[0]);
  ok('a run with one quiet day inside draws ONE', lanes[1].lumps === 1, lanes[1]);
  ok('every lane has a colour and no two neighbours share one', lanes.every((l) => l.fill) && lanes[0].fill !== lanes[1].fill && lanes[1].fill !== lanes[2].fill, lanes.map((l) => l.fill));
  ok('the one-offs lane is grey', /^#9/.test(lanes[2].fill), lanes[2].fill);
  const geo = await page.evaluate(() => {
    const b = document.getElementById('time');
    return { sw: b.scrollWidth, cw: b.clientWidth, sl: b.scrollLeft, pageScroll: document.documentElement.scrollHeight - window.innerHeight };
  });
  ok('the board scrolls sideways', geo.sw > geo.cw + 100, geo);
  ok('…and opens on today, the right end', geo.sl > 0 && geo.sl + geo.cw >= geo.sw - 1, geo);
  ok('the window itself has nothing to scroll (the pill adopts the board)', geo.pageScroll <= 2, geo);
  const nmX = () => page.evaluate(() => [...document.querySelectorAll('.lane:not(.sub) .nm')].map((n) => Math.round(n.getBoundingClientRect().x)));
  const before = await nmX();
  await page.evaluate(() => { document.getElementById('time').scrollLeft = 0; });
  await page.waitForTimeout(80);
  const after = await nmX();
  ok('the names stay put while the days scroll', JSON.stringify(before) === JSON.stringify(after) && before.every((x) => x === 0), [before, after]);
  const axisY = await page.evaluate(() => document.querySelector('.axis').getBoundingClientRect().y);
  await page.evaluate(() => { document.getElementById('time').scrollTop = 40; });
  await page.waitForTimeout(80);
  ok('the day axis sticks to the top', (await page.evaluate(() => document.querySelector('.axis').getBoundingClientRect().y)) === axisY);
  const lastDayClear = await page.evaluate(() => {
    const b = document.getElementById('time'); b.scrollLeft = b.scrollWidth;
    const now = document.querySelector('.vline.now').getBoundingClientRect();
    return { x: now.x, cw: b.clientWidth };
  });
  ok('today clears the pill\'s column at the right end', lastDayClear.x < lastDayClear.cw - 64, lastDayClear);

  console.log('a lane opens its chats');
  ok('the chats start folded', await page.locator('.subs[data-for="0"]').isHidden());
  await page.click('.lane[data-lane="0"] .nm');
  ok('a tap opens them', await page.locator('.subs[data-for="0"]').isVisible());
  const subs = await page.$$eval('.subs[data-for="0"] .lane.sub', (ls) => ls.map((l) => [l.querySelector('a').textContent, l.querySelector('a').getAttribute('href'), l.querySelectorAll('.lump').length]));
  ok('…one thin lane per chat, oldest first, each a link to its chat', JSON.stringify(subs) === JSON.stringify([['The old one', '/chats?chat=old-one', 1], ['Noon', '/chats?chat=noon', 1]]), subs);
  await page.click('.lane[data-lane="0"] .nm');
  ok('a second tap folds them', await page.locator('.subs[data-for="0"]').isHidden());

  console.log('the list');
  await page.click('#tabs button[data-v="list"]');
  ok('the tab switches views', await page.locator('#list').isVisible() && await page.locator('#time').isHidden());
  const order = await page.$$eval('#list .wl', (as) => as.map((a) => a.dataset.chat));
  ok('four rows, oldest first', order.join() === 'old-one,unstamped,night-owl,noon', order);
  const dayKeys = await page.$$eval('#list .day', (ds) => ds.map((d) => d.dataset.day));
  ok('a day rule per day, in order', dayKeys.join() === '2026-08-10,2026-08-15,2026-08-20,2026-08-21', dayKeys);
  ok('…the 2:30am chat sits under the day BEFORE (5am Pacific cut)', dayKeys[2] === laDay('2026-08-21T09:30:00.000Z') && dayKeys[2] === '2026-08-20');
  const counts = await page.$$eval('#list .day .n', (ns) => ns.map((n) => n.textContent));
  ok('each rule counts its chats', counts.join() === '1,1,1,1', counts);
  const months = await page.$$eval('#list .lmo', (ms) => ms.map((m) => m.textContent));
  ok('one month rule', months.length === 1 && /August 2026/.test(months[0]), months);
  ok('a nameless slug reads as words', (await page.locator('.wl[data-chat="night-owl"] .nm').innerText()).trim() === 'Night owl');
  const hersStyle = await page.locator('.wl[data-chat="old-one"] .ln').evaluate((el) => getComputedStyle(el).fontStyle);
  const chatStyle = await page.locator('.wl[data-chat="noon"] .ln').evaluate((el) => getComputedStyle(el).fontStyle);
  ok('her sentence renders italic, a chat\'s does not', hersStyle === 'italic' && chatStyle === 'normal', [hersStyle, chatStyle]);
  const tm = await page.locator('.wl[data-chat="old-one"] .tm').innerText();
  ok('a chat that ran on says when it ended', /→ Aug 11/i.test(tm), tm);
  ok('…and a same-day chat says nothing', (await page.locator('.wl[data-chat="noon"] .tm').count()) === 0);
  ok('…and an unstamped chat claims no span', !/→/.test(await page.locator('.wl[data-chat="unstamped"]').innerText()));
  ok('a row links to its chat', (await page.locator('.wl[data-chat="old-one"]').getAttribute('href')) === '/chats?chat=old-one');
  const dotColor = await page.locator('.wl[data-chat="old-one"] .dot').evaluate((el) => el.style.background);
  ok('a row wears its project\'s colour', !!dotColor, dotColor);
  await page.reload({ waitUntil: 'networkidle' });
  ok('the view she left is the one she comes back to', await page.locator('#list').isVisible());

  console.log('inside an iframe host');
  await page.goto(base + '/host.html', { waitUntil: 'networkidle' });
  const frame = page.frames().find((f) => /worklog/.test(f.url()));
  await frame.waitForSelector('.wl');
  await frame.click('.wl[data-chat="noon"]');
  await page.waitForTimeout(150);
  ok('the parent bridge takes the tap', (await page.evaluate(() => window.__opened)) === 'noon');
  ok('…and the frame stays on the log', /worklog/.test(frame.url()));

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILING' : '\nall green');
  process.exit(fails ? 1 : 0);
})();

#!/usr/bin/env node
// The work log — `worklogRows` pure, then the real public/worklog.html in
// headless Chromium against a stub API.
//
// What it pins, and why each is a measurement rather than a markup assertion:
//   • OLDEST FIRST, BY THE DAY A CHAT BEGAN — `startedAt`, never `lastSeen`
//     (measured 2026-09-02: lastSeen is the NEWEST message on every thread
//     checked). A chat with no stamp yet falls back honestly and says so.
//   • THE DAY TURNS OVER AT 5AM PACIFIC, checked against an INDEPENDENT copy
//     of the rule here (never the page's own arithmetic read back to itself):
//     a reply at 2am Pacific sits under the day before.
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
const { worklogRows, worklogLine } = require('../chatfeed.js');

const PUB = path.join(__dirname, '..', 'public');
let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

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
      return res.end(JSON.stringify({ ok: true, rows }));
    }
    if (req.url.startsWith('/host.html')) {
      res.setHeader('content-type', 'text/html');
      return res.end('<script>window.__openThread=function(n){window.__opened=n;return true;};</script>' +
        '<iframe id="f" src="/worklog.html" style="width:390px;height:800px"></iframe>');
    }
    const f = req.url === '/' ? '/worklog.html' : req.url.split('?')[0];
    try {
      const body = fs.readFileSync(path.join(PUB, f));
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
  await page.goto(base + '/worklog.html', { waitUntil: 'networkidle' });

  console.log('the page');
  ok('no page errors (the pill parses)', errs.length === 0, errs);
  const order = await page.$$eval('#list .wl', (as) => as.map((a) => a.dataset.chat));
  ok('four rows, oldest first', order.join() === 'old-one,unstamped,night-owl,noon', order);
  const days = await page.$$eval('#list .day', (ds) => ds.map((d) => d.dataset.day));
  ok('a day rule per day, in order', days.join() === '2026-08-10,2026-08-15,2026-08-20,2026-08-21', days);
  ok('…the 2:30am chat sits under the day BEFORE (5am Pacific cut)', days[2] === laDay('2026-08-21T09:30:00.000Z') && days[2] === '2026-08-20');
  const counts = await page.$$eval('#list .day .n', (ns) => ns.map((n) => n.textContent));
  ok('each rule counts its chats', counts.join() === '1,1,1,1', counts);
  const months = await page.$$eval('#list .mo', (ms) => ms.map((m) => m.textContent));
  ok('one month rule', months.length === 1 && /August 2026/.test(months[0]), months);
  ok('a nameless slug reads as words', (await page.locator('.wl[data-chat="night-owl"] .nm').innerText()) === 'Night owl');
  const hersStyle = await page.locator('.wl[data-chat="old-one"] .ln').evaluate((el) => getComputedStyle(el).fontStyle);
  const chatStyle = await page.locator('.wl[data-chat="noon"] .ln').evaluate((el) => getComputedStyle(el).fontStyle);
  ok('her sentence renders italic, a chat\'s does not', hersStyle === 'italic' && chatStyle === 'normal', [hersStyle, chatStyle]);
  const tm = await page.locator('.wl[data-chat="old-one"] .tm').innerText();
  ok('a chat that ran on says when it ended', /→ Aug 11/i.test(tm), tm);
  ok('…and a same-day chat says nothing', (await page.locator('.wl[data-chat="noon"] .tm').count()) === 0);
  ok('…and an unstamped chat claims no span', !/→/.test(await page.locator('.wl[data-chat="unstamped"]').innerText()));
  ok('a row links to its chat', (await page.locator('.wl[data-chat="old-one"]').getAttribute('href')) === '/chats?chat=old-one');

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

#!/usr/bin/env node
// THE AIM RULE — /tritoggle.js (2026-08-24, Sophie: "when I click the low
// medium high toggle in playground, it always goes to high from medium never
// low even if I click it on that side").
//
// Every copy of the three-way toggle had been wired as a CYCLE —
// `next = (cur + 1) % count`, tap anywhere, advance one — so on medium every
// tap went to high, the far-left L included. Nothing about the control says
// that: it is 78px wide with the value written on the knob and three legible
// stops, which reads as a thing you aim at.
//
// This pins the rule itself (pure, no browser) and then the REAL Playground
// page in headless Chromium, because "she clicked on that side" is a
// COORDINATE and no amount of asserting on `data-n` after a synthetic call
// would have caught the bug she reported.
//
//   node scripts/test-tritoggle-aim.js
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ---- the rule, pure -------------------------------------------------------
// Loaded the way a page loads it: it hangs itself on `window`.
global.window = global;
require(path.join(PUB, 'tritoggle.js'));

// A stand-in for a 78px track sitting at x=100. Only getBoundingClientRect is
// ever asked for.
const el = (left, width) => ({ getBoundingClientRect: () => ({ left, width }) });
const T = el(100, 78);
const tap = (x) => ({ clientX: x, detail: 1 });

console.log('the stop under the thumb');
ok(triStop(T, 3, tap(105)) === 0, 'the left third is stop 0');
ok(triStop(T, 3, tap(139)) === 1, 'the middle third is stop 1');
ok(triStop(T, 3, tap(172)) === 2, 'the right third is stop 2');
ok(triStop(T, 3, tap(100)) === 0, 'the very left edge is stop 0');
ok(triStop(T, 3, tap(178)) === 2, 'the very right edge is stop 2, never a fourth');
ok(triStop(T, 4, tap(120)) === 1, 'nothing counts three — four stops split into four zones');

console.log('THE BUG SHE REPORTED');
// From MEDIUM (cur = 1), a tap on the LOW side used to answer 2.
ok(triNext(T, 3, tap(105), 1) === 0,
  'on medium, a tap on the low side answers LOW (this returned high before)');
ok(triNext(T, 3, tap(172), 1) === 2, 'and a tap on the high side answers high');
ok(triNext(T, 3, tap(139), 1) === 1,
  'a tap on the stop she is already on stays there, never advances past it');

console.log('the KEYBOARD, and nothing else, still steps');
// NO CONTROL CYCLES ON A TAP — not one, since Sophie's second pass ("none of
// them should cycle ... Cycling is a bad idea"). The step survives only where
// there is no coordinate to aim with, or the toggle would be unreachable
// without a pointer.
ok(triNext(T, 3, { detail: 0, clientX: 0 }, 1) === 2,
  'a keyboard activation (detail 0) steps to the next stop');
ok(triNext(T, 3, null, 1) === 2, 'so does a call with no event at all');
ok(triNext(T, 3, null, 2) === 0, 'and that step still wraps');
ok(triNext(T, 3, null, -1) === 0,
  'an unknown value (indexOf -1) lands on the first notch rather than nowhere');
ok(triStop(el(0, 0), 3, tap(5)) === null, 'a zero-width element aims at nothing');

console.log('every page that has one links it');
for (const f of ['promptlab.html', 'panels.html', 'chats.html']) {
  const src = fs.readFileSync(path.join(PUB, f), 'utf8');
  ok(/<script src="\/tritoggle\.js"><\/script>/.test(src), f + ' links /tritoggle.js');
  // The fallback each page carries is the CYCLE and nothing else — a page that
  // grew its own copy of the aim would be exactly the drift this file exists to
  // prevent (the geometry was hand-copied three times before /tritoggle.css).
  ok(!/function triStop/.test(src), f + ' keeps no aim rule of its own');
  ok(/var triNext = window\.triNext \|\| function/.test(src),
    f + ' falls back to the cycle, and only to the cycle, when the file is missing');
}

console.log('nothing wearing the shell cycles on a tap');
{
  const chats = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  // THE ACCOUNT SWITCHER (2026-08-24, Sophie's second pass: "it also applies to
  // the account thing because none of them should cycle"). It was carved out
  // for a few hours on the reasoning that a blank knob gives her nothing to aim
  // at; she overruled that.
  ok(/triNext\(acctog, ACCOUNTS\.length, e, ACCOUNTS\.indexOf\(prev\)\)/.test(chats),
    'the account switcher aims, off ACCOUNTS rather than a typed count');
  ok(!/ACCOUNTS\[\(i ?\+ ?1\) ?% ?ACCOUNTS\.length\]/.test(chats),
    'and its old cycle is gone, not left beside it');
  // The word beside a search-filter row cannot aim — it sits nowhere near the
  // stop it names — so it CLEARS rather than stepping.
  ok(/val\.onclick=function\(\)\{[\s\S]{0,220}state\[k\]=def\.neutral/.test(chats),
    'the filter label clears its filter instead of cycling it');

  // THE NEUTRAL STOP SITS IN THE MIDDLE of every search filter (her ask: "the
  // middle should be the both option ... so I can get to either way with one
  // tap"), and it is NAMED rather than positional.
  const table = /var FILTERS = \{[\s\S]*?\n\};/.exec(chats)[0];
  for (const key of ['who', 'arch']) {
    const row = new RegExp(key + '\\s*:?\\s*\\{[\\s\\S]*?\\},').exec(table)[0];
    const vals = /vals:\[([^\]]*)\]/.exec(row)[1].split(',').map((v) => v.trim().replace(/'/g, ''));
    const neutral = /neutral:'([^']*)'/.exec(row)[1];
    ok(vals.indexOf(neutral) === 1,
      key + ': the neutral stop (' + neutral + ') is the MIDDLE one of ' + vals.join('·'));
  }
  ok(!/state\[k\]='all'/.test(chats) && !/vals\.indexOf\(v\)>0/.test(chats),
    'and nothing still reads "not the first stop" as "narrowed"');
}

// ---- the real page --------------------------------------------------------
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');

(async () => {
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {
        evan: { label: 'ChatGPT', prefix: 'E', suffix: 'E TAIL', refs: [] },
      } }));
    }
    // The shell AND the rule are both served by express.static in production,
    // so a stub has to serve both. Without the .js the page falls back to the
    // old CYCLE — which would pass a test written against the old behaviour and
    // silently fail this one.
    for (const [p, type] of [['/tritoggle.css', 'text/css'], ['/tritoggle.js', 'text/javascript'],
      ['/playground-port.js', 'text/javascript']]) {
      if (url.pathname === p) {
        res.writeHead(200, { 'Content-Type': type });
        return res.end(fs.readFileSync(path.join(PUB, p.slice(1))));
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // A REAL TAP AT A REAL COORDINATE is the only honest way to ask this — a
  // click on the element (playwright's default, its centre) can never tell an
  // aimed toggle from a cycling one that happens to be on the middle stop.
  const tapAt = async (id, frac) => {
    const box = await page.locator('#' + id).boundingBox();
    await page.mouse.click(box.x + box.width * frac, box.y + box.height / 2);
    await page.waitForTimeout(220);
  };
  const at = (id) => page.getAttribute('#' + id, 'data-n');

  console.log('the real Playground');
  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#qpick:not([hidden])');
  ok(await at('qpick') === '1', 'quality opens on medium');

  await tapAt('qpick', 1 / 6);
  ok(await at('qpick') === '0', 'HER BUG: from medium, a tap on the low side lands on LOW');

  await tapAt('qpick', 5 / 6);
  ok(await at('qpick') === '2', 'a tap on the high side lands on high');

  await tapAt('qpick', 1 / 6);
  ok(await at('qpick') === '0', 'and back to low in one aimed tap, not two');

  await tapAt('rpick', 5 / 6);
  ok(await at('rpick') === '2', 'the size toggle beside it obeys the same rule');
  await tapAt('rpick', 1 / 2);
  ok(await at('rpick') === '1', 'including the middle stop, which a cycle can never land on twice');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

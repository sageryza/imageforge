#!/usr/bin/env node
/* THE BOILER STYLE TOGGLE IN FREEFORM (2026-08-28, Sophie: "add a default
   boiler style not content prompt to freeform with a toggle on off button").

   Freeform's whole promise is that nothing is added, so the one thing this
   test really guards is that the toggle can never add words INVISIBLY:

   - OFF is byte-for-byte the verbatim surface it has always been, and files
     NO style half (an empty one would be a reconstruction — prompt-record's
     own rule).
   - ON appends the one served line and marks the seam with [content].
   - The page keeps NO copy of the text: it prints what the SERVER served, so
     the two can never drift.
   - It is OFF on every load and not sticky.
   - Putting a run back restores the toggle to what THAT run had — the same
     "only change what the record knows" rule the references follow.

   Run: node scripts/test-freeform-boiler.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', 'public');
const { BOILER, boilerFields } = require('../freeform.js');

const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

// ── pure: the assembler ────────────────────────────────────────────────────
const off = boilerFields('a cat on a fence', false);
ok('off sends her words untouched', off.sent === 'a cat on a fence');
ok('off files no style half', !('promptStyle' in off));
ok('off files the content half', off.promptContent === 'a cat on a fence');

const on = boilerFields('a cat on a fence', true);
ok('on appends the boiler line', on.sent === 'a cat on a fence\n\n' + BOILER.text);
ok('on keeps her words verbatim at the front', on.sent.startsWith('a cat on a fence'));
ok('on files the whole sent text', on.fullPrompt === on.sent);
ok('on marks the seam with [content]', on.promptStyle === '[content]\n\n' + BOILER.text);
ok('on never puts her words in the style half', !on.promptStyle.includes('a cat'));

// STYLE, NOT CONTENT — her words for it. A boiler line that named a subject
// would fight every prompt it rode on.
ok('the boiler line names no subject', !/\b(a |an |the )\w+ (on|in|at|with) /i.test(BOILER.text));
ok('the boiler line is one short line', BOILER.text.length < 260);

// ── the real page ──────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { chromium = null; }
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

const PRIOR = [
  { id: 'r1', prompt: 'the boiler one', quality: 'medium', size: 'portrait',
    status: 'done', images: [], refs: [], refIds: [], outputs: 1, boiler: true },
  { id: 'r2', prompt: 'the plain one', quality: 'medium', size: 'portrait',
    status: 'done', images: [], refs: [], refIds: [], outputs: 1, boiler: false },
];

let posted = null;
function serve() {
  return http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (p === '/freeform') {
      const h = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      res.setHeader('content-type', 'text/html'); return res.end(h);
    }
    // The REAL constant, served the way the route serves it.
    if (p === '/api/freeform/style') return json({ ok: true, style: BOILER });
    if (p === '/api/freeform/refs') return json({ ok: true, refs: [] });
    if (p === '/api/freeform/runs') return json({ ok: true, runs: PRIOR });
    if (p === '/api/freeform/run' && req.method === 'POST') {
      let body = ''; req.on('data', (c) => { body += c; });
      return req.on('end', () => { posted = JSON.parse(body || '{}'); json({ ok: true, id: 'new1', status: 'drawing' }); });
    }
    const f = path.join(PUB, p);
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.setHeader('content-type', path.extname(f) === '.js' ? 'text/javascript' : 'text/css');
      return res.end(fs.readFileSync(f));
    }
    res.statusCode = 404; return json({});
  });
}

(async () => {
  // THE PAGE MUST NOT CARRY THE WORDS. Checked as source, because a page with
  // its own copy passes every rendered assertion below right up until someone
  // changes the constant.
  const src = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8');
  const firstWords = BOILER.text.split(',')[0];
  ok('the page keeps no copy of the boiler text', !src.includes(firstWords));

  if (!chromium) { report(); return; }
  const srv = serve();
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const path0 = exe();
  const browser = await chromium.launch(path0 ? { executablePath: path0 } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/freeform`);
  await page.waitForFunction(() => document.querySelectorAll('.run').length > 0);

  const state = () => page.evaluate(() => {
    const b = document.getElementById('boiler');
    const t = document.getElementById('boilertext');
    return {
      lit: b.classList.contains('on'),
      pressed: b.getAttribute('aria-pressed'),
      shown: !t.hidden && t.offsetParent !== null,
      text: t.textContent,
      label: b.textContent.trim(),
    };
  });

  let s = await state();
  ok('the toggle is OFF on load', !s.lit && s.pressed === 'false');
  ok('nothing is disclosed while it is off', !s.shown);
  ok('the button says what it is', /boilerplate/i.test(s.label));

  await page.fill('#prompt', 'a cat on a fence');
  await page.click('#boiler');
  s = await state();
  ok('tapping lights it', s.lit && s.pressed === 'true');
  ok('lit, it prints the exact served line', s.shown && s.text.includes(BOILER.text));

  // The tap must reach the button, not something sitting over it.
  const reach = await page.evaluate(() => {
    const r = document.getElementById('boiler').getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el && el.closest('#boiler') ? 'boiler' : 'BLOCKED-by-' + (el && el.className);
  });
  ok('the toggle takes its own tap', reach === 'boiler');

  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('.run').length > 2);
  ok('the run carries boiler:true', posted && posted.boiler === true);
  ok('the run still sends her words alone — the server adds the line',
    posted && posted.prompt === 'a cat on a fence');

  // NOT STICKY: a wrapper remembered across loads is the surprise this
  // surface exists to avoid.
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.run').length > 0);
  s = await state();
  ok('it is off again after a reload', !s.lit);

  // Put-back restores what THAT run had, in both directions.
  await page.click('.run[data-id="r1"] .copybtn, .run:nth-of-type(1) .copybtn');
  await page.waitForFunction(() => document.getElementById('boiler').classList.contains('on'));
  ok('putting back a boiler run turns it ON', (await state()).lit);
  await page.click('.run:nth-of-type(2) .copybtn');
  await page.waitForFunction(() => !document.getElementById('boiler').classList.contains('on'));
  ok('putting back a plain run turns it OFF', !(await state()).lit);

  await browser.close(); srv.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

function report() {
  console.log(`freeform boiler: ${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
}

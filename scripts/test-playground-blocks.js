#!/usr/bin/env node
// THE PLAYGROUND'S DIVIDE AND ✕ (2026-09-26, Sophie: "1 icon playground · 3
// footage → same 3 in my playground"). The real page headless against a
// stubbed API; every check a measurement, since a divide that leaves #prompt
// on the wrong node, a ✕ that drops the wrong half, or a Generate that posts
// the box she is NOT in all look identical in the source.
const fs = require('fs'), path = require('path'), http = require('http');
const servePublic = require('./lib/public-asset');
const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const footage = fs.readFileSync(path.join(ROOT, 'public', 'footage.html'), 'utf8');
let fails = 0;
function ok(c, m) { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fails++; }

// ── source pins ──
ok(/class="boxbtn divide"[^>]*><\/button><button[^>]*class="boxbtn wipeb"[^>]*><\/button><button[^>]*id="bigprompt"/.test(pageSrc),
  'the first box carries divide · ✕ · bigger, in that order');
const glyph = (src) => (src.match(/divide: '([^']+)'/) || [])[1];
ok(glyph(pageSrc) && glyph(pageSrc) === glyph(footage), 'the divide glyph is footage.html\'s, verbatim');
ok(!/document\.getElementById\('prompt'\)\.value\.trim\(\)/.test(pageSrc.replace(/promptBox\(\)/g, '')),
  'no run-path reader still reads #prompt by name');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP the page half: playwright not installed'); process.exit(fails ? 1 : 0); }

(async () => {
  const posted = [];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        posted.push(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'r' + posted.length, poll: '/api/promptlab/r' + posted.length }));
      });
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {
        evan: { label: 'ChatGPT', prefix: '', suffix: '', characterLine: '', refs: [] },
      } }));
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
  await page.goto(base + '/playground?style=chatgpt');
  await page.waitForTimeout(400);
  const HEAD = 'Sophie at the ward window, morning light.';
  const TAIL = 'She turns and walks to the door.';

  // one box: three corner buttons, no gold line
  const n0 = await page.$$eval('.promptwrap', (ws) => ws.length);
  ok(n0 === 1, 'one box to start');
  const corner = await page.$$eval('.promptwrap .boxbtn', (bs) => bs.map((b) => b.className.replace('boxbtn ', '')));
  ok(corner.join(' ') === 'divide wipeb bigger', 'the corner is divide · ✕ · bigger');
  const rights = await page.$$eval('.promptwrap .boxbtn', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().right)));
  ok(rights[0] < rights[1] && rights[1] < rights[2], 'and they sit left to right in that order: ' + rights.join(' '));

  // divide with nothing before the cursor refuses
  await page.fill('#prompt', HEAD + ' ' + TAIL);
  await page.evaluate(() => { const t = document.getElementById('prompt'); t.focus(); t.setSelectionRange(0, 0); });
  await page.click('.promptwrap .divide');
  ok(await page.$$eval('.promptwrap', (ws) => ws.length) === 1, 'a divide at the very start makes no box');

  // divide at the cursor
  await page.evaluate((n) => { const t = document.getElementById('prompt'); t.focus(); t.setSelectionRange(n, n); }, HEAD.length + 1);
  await page.click('.promptwrap .divide');
  ok(await page.$$eval('.promptwrap', (ws) => ws.length) === 2, 'divide makes a second box');
  const vals = await page.$$eval('.promptwrap textarea', (ts) => ts.map((t) => t.value));
  ok(vals[0] === HEAD && vals[1] === TAIL, 'head stays, tail goes below: ' + JSON.stringify(vals));
  ok(await page.$eval('.promptwrap textarea', (t) => t.id) === 'prompt', '#prompt is still the first box');
  const gold = await page.$$eval('.promptwrap', (ws) => ws.map((w) => getComputedStyle(w.querySelector('textarea')).borderColor));
  ok(gold[0] !== gold[1], 'the box she is in wears a different border (the gold line): ' + gold.join(' | '));
  ok(await page.$eval('.promptwrap.active textarea', (t) => t.id) === 'prompt', 'after a real cut she is still standing in the first box');

  // Generate draws the box she is in — tap into the second, run
  await page.locator('.promptwrap').nth(1).locator('textarea').click();
  await page.waitForTimeout(50);
  ok(await page.$eval('.promptwrap.active textarea', (t) => t.value) === TAIL, 'tapping the second box makes it the one Generate draws');
  await page.click('#go');
  await page.waitForTimeout(400);
  ok(posted.length === 1 && posted[0].prompt === TAIL, 'Generate posted the second box\'s words, not the first\'s: ' + (posted[0] && posted[0].prompt));

  // divide at the end → an empty box, and she lands in it
  await page.evaluate(() => { const t = document.querySelectorAll('.promptwrap textarea')[1]; t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  await page.locator('.promptwrap').nth(1).locator('.divide').click();
  ok(await page.$$eval('.promptwrap', (ws) => ws.length) === 3, 'a divide at the end makes an empty third box');
  ok(await page.$eval('.promptwrap.active textarea', (t) => t.value) === '' && await page.evaluate(() => document.activeElement === document.querySelectorAll('.promptwrap textarea')[2]), 'and she lands in it');

  // ✕ the empty one, then ✕ the FIRST — the second's words move up into #prompt
  await page.locator('.promptwrap').nth(2).locator('.wipeb').click();
  ok(await page.$$eval('.promptwrap', (ws) => ws.length) === 2, '✕ takes the third box off');
  await page.locator('.promptwrap').nth(0).locator('.wipeb').click();
  const after = await page.$$eval('.promptwrap textarea', (ts) => ts.map((t) => [t.id, t.value]));
  ok(after.length === 1 && after[0][0] === 'prompt' && after[0][1] === TAIL, '✕ on the first half leaves the second half in #prompt: ' + JSON.stringify(after));
  ok(await page.$eval('#prompt', (t) => getComputedStyle(t).boxShadow) === 'none', 'one box again wears no gold line');

  // ✕ on the only box is the Clear word: words never drawn get the ask
  await page.fill('#prompt', 'never drawn words');
  await page.click('.promptwrap .wipeb');
  await page.waitForTimeout(100);
  const asked = await page.$eval('#ask', (a) => a.classList.contains('on') && getComputedStyle(a).display === 'flex');
  ok(asked, '✕ on the only box asks before clearing words never drawn');
  ok(await page.$eval('#prompt', (t) => t.value) === 'never drawn words', 'and the words are still there until she answers');

  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

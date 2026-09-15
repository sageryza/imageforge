#!/usr/bin/env node
/*
 * test-playground-lora-price.js — WTR says what it costs (2026-09-15, Sophie:
 * "add pricing to wtr in playground").
 *
 * Every gpt style prints its price on the toggle that SETS it — canvas, tier,
 * quality. WTR has none of those knobs, so its one figure has its own quiet
 * line under the controls, and the number is SERVED (`PL_LORA` in server.js),
 * never kept in the page.
 *
 * Source half, always runs:
 *   1. THE ARITHMETIC THE COMMENT CLAIMS IS REALLY THE ARITHMETIC. Replicate
 *      returns no cost field at all, so `cents` is `seconds x rate x 100` and
 *      nothing else. A row whose cents drifted off its own seconds is a price
 *      nobody can re-derive, which is exactly how the old gpt-image-1 figures
 *      outlived their model.
 *   2. IT IS SERVED. `/api/promptlab/styles` answers `lora`, or the page has
 *      nothing to read and prints nothing forever.
 *   3. THE ROW DESCRIBES A REAL RUN. The model id is a live MODELS.replicate
 *      entry and the `steps` on it is the step count the server would actually
 *      send for it — a price measured at a different step count is a price for
 *      a different picture.
 *   4. THE PAGE HOLDS NO COPY OF THE NUMBER (the rule test-playground-res.js
 *      already pins for the tier prices).
 *
 * Page half, headless. Every assertion is a MEASUREMENT off the rendered page,
 * and the stub deliberately serves a number that is NOT the real one: a page
 * quietly printing its own copy would pass any check that used 1.16.
 *
 *   node scripts/test-playground-lora-price.js
 *   (page half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// The real PL_LORA literal out of server.js — never a second copy of it here.
function loraTable() {
  const i = serverSrc.indexOf('\nconst PL_LORA = {');
  if (i < 0) return null;
  const b = serverSrc.slice(i + '\nconst PL_LORA = '.length);
  let lit = b.slice(0, b.indexOf('\n};') + 2).trim().replace(/;$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                      // eslint-disable-line no-eval
}
const LORA = loraTable();

console.log('the server owns a measured price');
ok(!!LORA, 'PL_LORA exists in server.js');
ok(LORA && typeof LORA.rate === 'number' && LORA.rate > 0, 'it names a per-second rate');
ok(LORA && /h100/i.test(String(LORA.hardware || '')), 'and the hardware that rate is for');
const rows = LORA ? Object.keys(LORA.models || {}) : [];
ok(rows.length > 0, 'at least one model has a price');
ok(rows.indexOf('sageryza/watercolordrawings') >= 0, 'WTR is one of them');

console.log('cents is seconds x rate, not a remembered number');
rows.forEach((id) => {
  const m = LORA.models[id];
  ok(typeof m.seconds === 'number' && m.seconds > 0, id + ' carries the measured seconds');
  ok(typeof m.n === 'number' && m.n > 0, id + ' says how many runs it was measured over');
  ok(typeof m.measured === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.measured),
    id + ' is dated — an undated price is a hypothesis');
  const derived = m.seconds * LORA.rate * 100;
  ok(Math.abs(derived - m.cents) < 0.02,
    id + ': ' + m.cents + '¢ really is ' + m.seconds + 's × $' + LORA.rate);
});

console.log('the row describes a run the server would really send');
rows.forEach((id) => {
  const m = LORA.models[id];
  // The live MODELS.replicate entry for this id, read out of server.js.
  const line = serverSrc.split('\n').find((l) => l.indexOf("{ id: '" + id + "'") >= 0);
  ok(!!line, id + ' is a live MODELS.replicate entry');
  if (!line) return;
  const ds = /defaultSteps:\s*(\d+)/.exec(line);
  const steps = ds ? Number(ds[1]) : 28;             // the server's own `?? 28`
  ok(m.steps === steps, id + ' is priced at the step count the server sends (' + steps + ')');
  ok(m.outputs === 1, id + ' is priced per PICTURE — the page sends one output');
});

console.log('it is served, and the page keeps no copy');
ok(/lora: PL_LORA/.test(serverSrc), '/api/promptlab/styles answers `lora`');
ok(/LORA = d\.lora \|\| null/.test(pageSrc), 'the page reads it off that answer');
const numbers = [];
rows.forEach((id) => { numbers.push(String(LORA.models[id].cents), String(LORA.models[id].seconds)); });
if (LORA) numbers.push(String(LORA.rate));
numbers.forEach((n) => ok(pageSrc.indexOf(n) < 0, 'promptlab.html holds no copy of ' + n));

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

// NOT the real figure, on purpose — see the header.
const STUB_CENTS = 3.33;
let serveLora = true;

(async () => {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: 'x1' }));
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: { dreamy: { label: 'Dreamy', prefix: 'P', suffix: 'S', noText: null, refs: [] } },
        res: {
          portrait: { aspectRatio: '2:3', tiers: { '1k': { size: '1024x1536', label: '1K', cents: { low: 1, medium: 2, high: 3 } } } },
          square: { aspectRatio: '1:1', tiers: { '1k': { size: '1024x1024', label: '1K', cents: { low: 1, medium: 2, high: 3 } } } },
        },
        resDefault: '1k',
        lora: serveLora
          ? { rate: 0.001525, hardware: 'Nvidia H100',
              models: { 'sageryza/watercolordrawings': { label: 'WTR', steps: 28, outputs: 1, seconds: 2.18, cents: STUB_CENTS, n: 9, measured: '2026-09-15' } } }
          : { rate: 0.001525, hardware: 'Nvidia H100', models: {} },
      }));
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

  console.log('WTR says what it costs');
  await page.goto(base + '/playground?prompt=a%20cat&style=watercolor');
  await page.waitForSelector('#priceline:not([hidden])', { timeout: 8000 })
    .catch(() => {});
  const shown = await page.isVisible('#priceline').catch(() => false);
  ok(shown, 'the price line is on screen on WTR');
  if (!shown) {
    // Nothing further can be measured off a line that is not there, and a
    // cascade of timeouts reads as a broken test rather than a missing price.
    console.log('  — the rest of the page half needs that line; stopping here');
    await browser.close(); server.close();
    console.log('\n' + fails + ' FAILED');
    process.exit(1);
  }
  const txt = (await page.textContent('#priceline')) || '';
  ok(/WTR/.test(txt), 'it names the style: ' + JSON.stringify(txt));
  // 3.33 prints as 3.3¢ — the SERVED number, rounded by the page's own rule.
  ok(txt.indexOf('3.3¢') >= 0, 'and prints the SERVED price, not a copy of its own');
  ok(/a picture/.test(txt), 'per picture, which is what a run draws');
  // It must really be under the controls and above the feed, where she is
  // looking — a line rendered off screen is a line she never reads.
  const box = await (await page.$('#priceline')).boundingBox();
  ok(!!box && box.y > 0 && box.y < 844, 'it is inside the first screen (y=' + (box && Math.round(box.y)) + ')');

  console.log('×3 prints three pictures’ worth');
  const x3 = await page.getAttribute('#xthree', 'title');
  ok(/10\b/.test(x3 || ''), '×3 says about 10¢ (3 × 3.33): ' + JSON.stringify(x3));

  console.log('the count line prices an expansion on the LoRA too');
  await page.fill('#prompt', 'a {red, blue, green} bird');
  await page.waitForFunction(() => {
    const el = document.getElementById('permline');
    return el && !el.hidden && /prompts/.test(el.textContent || '');
  }, null, { timeout: 4000 }).catch(() => {});
  const perm = (await page.textContent('#permline')) || '';
  ok(/3 prompts/.test(perm), 'it counts the three prompts: ' + JSON.stringify(perm));
  ok(perm.indexOf('10¢') >= 0, 'and prices all three at the served figure');

  console.log('a gpt style is left exactly as it was');
  await page.selectOption('#stylepick', 'dreamy');
  await page.waitForTimeout(150);
  ok(!(await page.isVisible('#priceline')), 'no price line on a gpt style — its toggles carry it');

  console.log('a model with nothing served prints nothing');
  serveLora = false;
  await page.goto(base + '/playground?prompt=a%20cat&style=watercolor');
  await page.waitForFunction(() => window.__plStylesIn !== undefined || true);
  await page.waitForTimeout(600);
  ok(!(await page.isVisible('#priceline')), 'no row, no line — never an invented number');
  const x3b = await page.getAttribute('#xthree', 'title');
  ok(!/¢/.test(x3b || ''), 'and ×3 makes no claim about cost either');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

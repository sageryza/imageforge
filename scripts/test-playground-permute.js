#!/usr/bin/env node
/*
 * test-playground-permute.js — Midjourney's {curly brackets} in the Playground
 * (Aug 2026, Sophie: "u know in midjourney using curly brackets to do multiple
 * prompts" → "yes :)").
 *
 * The PURE half runs the real /permute.js — the one file the page loads — over
 * the grammar: options split on top-level commas, groups multiply and NEST,
 * `\{` `\}` `\,` are literal, an unmatched brace is literal (a typo must not
 * eat the prompt), options trim, duplicates drop, and generation is capped so
 * a pathological prompt cannot hang the tab.
 *
 * The HEADLESS half drives the real promptlab.html:
 *   - a braced prompt shows the count line, PRICED from the SERVED cents (the
 *     page holds no copy of a cost figure — the res-toggle rule);
 *   - one Generate tap POSTs one run per expansion, each body carrying ITS
 *     expanded prompt, never the braces;
 *   - a plain prompt is byte-for-byte the single run it always was, line
 *     hidden;
 *   - over the per-tap cap the tap is REFUSED with the reason on screen and
 *     zero runs started — the cap guards the 512MB box's measured
 *     concurrent-output ceiling, so it must fail closed.
 *
 *   node scripts/test-playground-permute.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const { permutePrompt, CAP } = require(path.join(ROOT, 'public', 'permute'));
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};
const eq = (got, want, what) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  ok(g === w, what + (g === w ? '' : ' — got ' + g));
};

console.log('the grammar (the real /permute.js)');
eq(permutePrompt('a quiet bird').prompts, ['a quiet bird'], 'plain text is itself, once');
eq(permutePrompt('a {red, blue} bird').prompts, ['a red bird', 'a blue bird'], 'one group, two prompts');
eq(permutePrompt('a {cat, dog} in {snow, rain}').prompts,
  ['a cat in snow', 'a cat in rain', 'a dog in snow', 'a dog in rain'],
  'separate groups multiply');
eq(permutePrompt('{a, {b, c} d}').prompts, ['a', 'b d', 'c d'], 'groups nest');
eq(permutePrompt('a \\{red\\} bird').prompts, ['a {red} bird'], '\\{ and \\} are literal braces');
eq(permutePrompt('{red\\, ish, blue}').prompts, ['red, ish', 'blue'], '\\, is a literal comma inside a group');
eq(permutePrompt('a {red bird').prompts, ['a {red bird'], 'an unmatched { is literal — a typo keeps the prompt');
eq(permutePrompt('a red} bird').prompts, ['a red} bird'], 'an unmatched } is literal too');
eq(permutePrompt('a {red,} bird').prompts, ['a red bird', 'a bird'],
  'an empty option means "without it", spaces collapsed');
eq(permutePrompt('{ red , blue }').prompts, ['red', 'blue'], 'options are trimmed');
eq(permutePrompt('a {red, red} bird').prompts, ['a red bird'], 'duplicates drop');
ok(permutePrompt('').prompts.length === 1 && !permutePrompt('').clipped, 'empty text is one empty prompt');

const big = permutePrompt('{1,2,3,4}{1,2,3,4}{1,2,3,4}'); // 64 combos
ok(big.clipped === true, 'past ' + CAP + ' the expansion says clipped');
ok(big.prompts.length <= CAP, 'and never builds more than ' + CAP + ' (' + big.prompts.length + ')');
ok(permutePrompt('{1,2}{1,2}').clipped === false, 'a small product is not clipped');

console.log('\nthe page loads ONE copy of the rule');
ok(pageSrc.indexOf('src="/permute.js"') >= 0, 'promptlab.html links /permute.js');
ok(!/function\s+permutePrompt/.test(pageSrc), 'and holds no second copy of the expansion');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

(async () => {
  const started = []; // every POST /api/promptlab body, in order
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        started.push(JSON.parse(raw));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'run' + started.length }));
      });
      return;
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {},
        res: {
          portrait: { aspectRatio: '2:3', tiers: { '1k': { size: '1024x1536', label: '1K', cents: { low: 0.5, medium: 4.1, high: 16.5 } } } },
          square: { aspectRatio: '1:1', tiers: { '1k': { size: '1024x1024', label: '1K', cents: { low: 0.6, medium: 5.3, high: 21.1 } } } },
        },
        resDefault: '1k',
      }));
    }
    // Poll routes for the pending runs — never finish them; this test is about
    // what gets STARTED.
    if (/^\/api\/promptlab\//.test(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'running', images: [] }));
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
  await page.goto(base + '/playground');
  await page.waitForSelector('#prompt');

  console.log('\nthe count line');
  await page.fill('#prompt', 'a {red, blue} bird');
  await page.waitForFunction(() => !document.getElementById('permline').hidden, null, { timeout: 3000 });
  let line = await page.textContent('#permline');
  ok(/2 prompts/.test(line), 'says 2 prompts (' + line.trim() + ')');
  ok(!/¢|\$/.test(line), 'no price on the LoRA — there is no served figure to show');
  await page.selectOption('#stylepick', 'dreamy');
  await page.waitForFunction(() => /¢|\$/.test(document.getElementById('permline').textContent),
    null, { timeout: 3000 });
  line = await page.textContent('#permline');
  ok(/¢|\$/.test(line), 'a gpt style prices it from the SERVED cents (' + line.trim() + ')');
  await page.selectOption('#stylepick', 'watercolor');
  await page.fill('#prompt', 'a quiet bird');
  await page.waitForFunction(() => document.getElementById('permline').hidden, null, { timeout: 3000 });
  ok(true, 'and hides again on a plain prompt');

  console.log('\none tap, one run per expansion (WTR — the LoRA counts too)');
  await page.fill('#prompt', 'a {red, blue} bird');
  await page.click('#go');
  await page.waitForTimeout(400);
  ok(started.length === 2, 'two POSTs from one Generate (' + started.length + ')');
  eq(started.map((b) => b.prompt).sort(), ['a blue bird', 'a red bird'],
    'each body carries ITS expanded prompt, never the braces');

  console.log('\na plain prompt is the single run it always was');
  started.length = 0;
  await page.fill('#prompt', 'a quiet bird');
  await page.click('#go');
  await page.waitForTimeout(400);
  ok(started.length === 1 && started[0].prompt === 'a quiet bird', 'one POST, exact text');

  console.log('\nover the cap the tap is refused, closed');
  started.length = 0;
  await page.fill('#prompt', '{1,2,3,4,5,6,7,8,9,10,11,12,13}');
  await page.click('#go');
  await page.waitForTimeout(400);
  ok(started.length === 0, 'zero runs started');
  const err = await page.textContent('#err');
  ok(/cap is 12/.test(err), 'and the reason is on screen (' + err.trim() + ')');
  ok(!(await page.isHidden('#err')), 'visibly');

  console.log('\nthe ladder multiplies through the same guard');
  started.length = 0;
  await page.selectOption('#stylepick', 'dreamy');
  await page.fill('#prompt', 'a {red, blue} bird');
  await page.waitForSelector('#medhigh:not([hidden])');
  await page.click('#medhigh');
  await page.waitForTimeout(400);
  ok(started.length === 4, 'medium+high on 2 prompts is 4 runs (' + started.length + ')');
  const pairs = started.map((b) => b.quality + '|' + b.prompt).sort();
  eq(pairs, ['high|a blue bird', 'high|a red bird', 'medium|a blue bird', 'medium|a red bird'],
    'every tier for every prompt');

  started.length = 0;
  await page.fill('#prompt', '{1,2,3,4,5,6,7} bird');
  await page.click('#medhigh');
  await page.waitForTimeout(400);
  ok(started.length === 0, '7 prompts × 2 tiers = 14 is refused — the guard counts TOTAL runs');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

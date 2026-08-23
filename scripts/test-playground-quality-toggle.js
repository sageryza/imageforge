#!/usr/bin/env node
/*
 * test-playground-quality-toggle.js — the Playground's quality control (Aug
 * 2026, Sophie: "make the low medium high drop down in the playground into the
 * exact three way toggle that the account switcher uses … but black not red.
 * and put the initial of the choice - L, M, or H").
 *
 * The word she used is EXACT, so the first half of this pins `.qtog` in
 * promptlab.html against `.swi` in chats.html property by property — the two
 * live in different files with no shared stylesheet between them, so nothing
 * else would ever notice one drifting from the other. The colour is the one
 * declared difference and is asserted as a difference, not skipped.
 *
 * The second half drives the real page in headless Chromium and asks where the
 * knob actually IS at each stop (getComputedStyle on ::after — the letter and
 * the position are one element, so a wrong letter and a wrong stop are the same
 * failure), that a tap cycles and wraps, and that the run carries the quality
 * the knob is showing.
 *
 *   node scripts/test-playground-quality-toggle.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const chatsSrc = fs.readFileSync(path.join(ROOT, 'public', 'chats.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// Pull one rule's body out of a page's inline CSS. Deliberately crude — these
// are hand-maintained files and the rules are single blocks.
function rule(src, selector) {
  const i = src.indexOf('\n' + selector.replace(/^\s+/, ''));
  const j = src.indexOf(selector);
  const at = i >= 0 ? i : j;
  if (at < 0) return '';
  const open = src.indexOf('{', at);
  return src.slice(open + 1, src.indexOf('}', open));
}
// A declaration's value, whitespace-flattened, so `--tw:48px` and `--tw: 48px`
// compare equal.
const decl = (body, prop) => {
  const m = new RegExp('(?:^|[;{\\s])' + prop.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;}]+)').exec(body);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
};

console.log('it IS the account switcher');
const swi = rule(chatsSrc, '.swi{');
const qtog = rule(pageSrc, '.qtog {');
ok(swi && qtog, 'both rules exist to compare');
// The geometry, verbatim. --gap is what puts the three stops where they are, so
// a drift here is a toggle whose middle notch no longer reads as the middle.
['--tw', '--k', '--gap', 'width', 'height', 'border-radius'].forEach((p) => {
  ok(decl(swi, p) && decl(swi, p) === decl(qtog, p),
    p + ' matches the account switcher (' + decl(swi, p) + ')');
});
const swiA = rule(chatsSrc, '.swi::after{');
const qtogA = rule(pageSrc, '.qtog::after {');
['top', 'left', 'width', 'height', 'border-radius', 'transition'].forEach((p) => {
  ok(decl(swiA, p) && decl(swiA, p) === decl(qtogA, p),
    'the knob\'s ' + p + ' matches (' + decl(swiA, p) + ')');
});
// THREE stops, each a multiple of --gap — derived, never typed, exactly as the
// account one derives them. A fourth quality would be one more rule of this
// shape and nothing else.
ok(/\.qtog\[data-q="medium"\]::after\s*\{\s*transform:\s*translateX\(var\(--gap\)\)/.test(pageSrc),
  'the middle stop is one --gap along');
ok(/\.qtog\[data-q="high"\]::after\s*\{\s*transform:\s*translateX\(calc\(var\(--gap\) \* 2\)\)/.test(pageSrc),
  'the last stop is two --gaps along');

console.log('black, not red');
// The one declared difference. chats.html paints the track with its own rose
// token; here it is the page's ink, and the assertion is that they DIFFER —
// otherwise a later copy-paste could quietly bring the rose back.
ok(/var\(--chg\)/.test(decl(swi, 'background') || ''), 'the account switcher is its rose token');
ok(decl(qtog, 'background') === '#2b2622', 'the Playground one is the page ink #2b2622');
ok(decl(qtog, 'border') === '1.5px solid #2b2622', 'and its border is the same ink');
ok(!/--chg|#a1|rgb\(/i.test(qtog), 'no rose anywhere in the rule');
// The knob keeps the paper fill and gains the letter.
ok(decl(qtogA, 'content') === 'attr(data-i)', 'the knob draws its letter from data-i');
ok(decl(qtogA, 'background') === '#faf7f2', 'the knob is still paper');

console.log('the dropdown is gone');
ok(!/<select id="qpick"/.test(pageSrc), 'no <select> left behind');
ok(/<button type="button" id="qpick" class="qtog"/.test(pageSrc), 'it is a button now');
ok(!/qpick'\)\.innerHTML|qpick'\)\.value|qpick\.value/.test(pageSrc),
  'nothing still builds options or reads a .value off it');
ok(/QUALITIES\[\(i \+ 1\) % QUALITIES\.length\]/.test(pageSrc),
  'the tap wraps off the end of QUALITIES, never off a typed count');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

(async () => {
  const posted = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        try { posted.push(JSON.parse(body)); } catch { posted.push(null); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'x' + posted.length }));
      });
    }
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
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
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

  // What the knob is actually showing and where it actually is. The letter and
  // the position ride ONE pseudo-element, so this is the whole control in one
  // read — and `transform` comes back as a matrix, whose last-but-one number is
  // the x offset in real pixels.
  const knob = () => page.evaluate(() => {
    const el = document.getElementById('qpick');
    const cs = getComputedStyle(el, '::after');
    const m = /matrix\(([^)]*)\)/.exec(cs.transform);
    return {
      letter: cs.content.replace(/["']/g, ''),
      x: m ? Math.round(parseFloat(m[1].split(',')[4]) * 10) / 10 : 0,
      q: el.getAttribute('data-q'),
      w: el.getBoundingClientRect().width,
      h: el.getBoundingClientRect().height,
    };
  });

  console.log('the toggle on the real page');
  // The page opens on the WTR LoRA, which has no quality ladder — so the
  // control is only on screen once a gpt-image-2 style is picked.
  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#qpick:not([hidden])');
  let k = await knob();
  ok(k.q === 'medium' && k.letter === 'M', 'it opens on medium, showing M');
  ok(k.w === 48 && k.h === 26, 'it is the switcher\'s own 48x26 box');
  const mid = k.x;
  ok(mid === 11.5, 'medium sits one notch along (11.5px)');

  // 250ms out of the way of the knob's own .18s slide — reading mid-flight
  // gives a real but meaningless x, which is exactly the sort of "flaky test"
  // that gets a correct assertion deleted later.
  await page.click('#qpick'); await page.waitForTimeout(250);
  k = await knob();
  ok(k.q === 'high' && k.letter === 'H', 'a tap moves to high, showing H');
  ok(k.x === 23, 'and the knob is two notches along (23px)');

  await page.click('#qpick'); await page.waitForTimeout(250);
  k = await knob();
  ok(k.q === 'low' && k.letter === 'L', 'the next tap WRAPS to low, showing L');
  ok(k.x === 0, 'and the knob is back at the first stop');

  // The three stops are distinct enough to tell apart — the whole reason the
  // account switcher is 48px wide and not 42.
  ok(mid - 0 >= 10 && 23 - mid >= 10, 'the stops are >=10px apart, readable as three');

  // It is one tap, anywhere on it — no menu to open, which is the point.
  ok(await page.getAttribute('#qpick', 'aria-label') === 'Quality low — tap for the next one',
    'the label says where it is and what a tap does');

  console.log('it still drives the run');
  await page.fill('#prompt', 'a cat');
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings *').length > 0);
  ok(posted.length === 1 && posted[0].quality === 'low', 'the run carries the quality on the knob');

  // Ported in from an Assets image: the knob shows what the link asked for.
  await page.goto(base + '/playground?prompt=a%20cat&style=chatgpt&quality=high');
  await page.waitForFunction(() => document.getElementById('qpick').getAttribute('data-q') === 'high');
  k = await knob();
  ok(k.letter === 'H' && k.x === 23, 'a ported quality moves the knob, not just the variable');

  // Not persisted — a fresh load is back to medium, same as it always was, so
  // an expensive 'high' can never ride along into next time.
  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#qpick:not([hidden])');
  k = await knob();
  ok(k.q === 'medium' && k.letter === 'M', 'a fresh load is back to medium');

  // It hides on the LoRA, exactly as the dropdown did (no quality ladder there).
  await page.selectOption('#stylepick', 'watercolor');
  ok(!(await page.isVisible('#qpick')), 'it hides on the Replicate LoRA');
  await page.selectOption('#stylepick', 'chatgpt');
  ok(await page.isVisible('#qpick'), 'and comes back on a gpt-image-2 style');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

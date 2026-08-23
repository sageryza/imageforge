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

console.log('it is the account switcher\'s SHAPE, at her own width');
const swi = rule(chatsSrc, '.swi{');
const qtog = rule(pageSrc, '.swtog {');
ok(swi && qtog, 'both rules exist to compare');
// WHAT STILL HAS TO MATCH is the shape — a round knob inset in a filled track
// with derived stops. The SIZE deliberately does not: Sophie asked for this
// one wider ("can you make the low medium high quality toggle a little bit
// wider so it's easier to change it"), and "4K" does not fit on an 18px knob.
// So the width is asserted as a DIFFERENCE, the way the colour already is —
// otherwise a later copy-paste would quietly shrink it back.
const px = (v) => parseFloat(v);
ok(px(decl(qtog, '--tw')) > px(decl(swi, '--tw')),
  'the Playground toggle is WIDER than the account switcher ('
  + decl(qtog, '--tw') + ' vs ' + decl(swi, '--tw') + ')');
ok(px(decl(qtog, '--k')) > px(decl(swi, '--k')),
  'and its knob is bigger, because it carries "4K" and not just a letter');
ok(decl(qtog, 'width') === 'var(--tw)' && decl(swi, 'width') === 'var(--tw)',
  'both still take their width from --tw rather than a typed number');
['padding', 'margin', 'flex', 'position', 'box-sizing'].forEach((p) => {
  ok(decl(swi, p) && decl(swi, p) === decl(qtog, p),
    p + ' matches the account switcher (' + decl(swi, p) + ')');
});
const swiA = rule(chatsSrc, '.swi::after{');
const qtogA = rule(pageSrc, '.swtog::after {');
['top', 'left'].forEach((p) => {
  ok(decl(qtogA, p), 'the knob declares its ' + p + ' inset (' + decl(qtogA, p) + ')');
});
ok(decl(swiA, 'border-radius') === decl(qtogA, 'border-radius'),
  'the knob is still round (' + decl(qtogA, 'border-radius') + ')');
ok(decl(swiA, 'transition') === decl(qtogA, 'transition'),
  'and still slides rather than jumping (' + decl(qtogA, 'transition') + ')');
ok(decl(qtogA, 'width') === 'var(--k)' && decl(qtogA, 'height') === 'var(--k)',
  'the knob is a square of --k, so it cannot go oval when the track grows');
// THE GEOMETRY MUST CLOSE. --gap is what puts the three stops where they are,
// and it is typed rather than calc'd, so this is the one place a wrong number
// would show as a knob that overshoots its track or stops short of the end.
{
  const tw = px(decl(qtog, '--tw')), k = px(decl(qtog, '--k')), gap = px(decl(qtog, '--gap'));
  const border = px(decl(qtog, 'border')) || 1.5;
  const inset = px(decl(qtogA, 'left'));
  const travel = tw - 2 * border - 2 * inset - k;
  ok(Math.abs(travel / 2 - gap) < 0.51,
    'two --gaps land the knob exactly at the far end (travel ' + travel + ', gap ' + gap + ')');
  const h = px(decl(qtog, 'height'));
  ok(Math.abs((h - 2 * border - k) / 2 - inset) < 0.51,
    'and the knob is vertically centred in the track');
  ok(Math.abs(px(decl(qtog, 'border-radius')) - h / 2) < 0.51, 'the track is a full capsule');
}
// THREE stops, each a multiple of --gap — derived, never typed, exactly as the
// account one derives them. The stops are NUMBERED, which is what lets the
// resolution toggle share this rule instead of keeping a second copy.
ok(/\.swtog\[data-n="1"\]::after\s*\{\s*transform:\s*translateX\(var\(--gap\)\)/.test(pageSrc),
  'the middle stop is one --gap along');
ok(/\.swtog\[data-n="2"\]::after\s*\{\s*transform:\s*translateX\(calc\(var\(--gap\) \* 2\)\)/.test(pageSrc),
  'the last stop is two --gaps along');
// ONE rule, two toggles — the whole reason the stops are numbered.
ok(!/\.qtog\s*\{/.test(pageSrc) && !/\.rtog\s*\{/.test(pageSrc),
  'there is no second copy of the geometry for the resolution toggle');
ok((pageSrc.match(/class="swtog"/g) || []).length === 2,
  'both toggles wear the one class');

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
ok(/<button type="button" id="qpick" class="swtog"/.test(pageSrc), 'it is a button now');
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
  // Reads either toggle — they share the rule, so they get the same probe.
  const knob = (id) => page.evaluate((sel) => {
    const el = document.getElementById(sel);
    const cs = getComputedStyle(el, '::after');
    const m = /matrix\(([^)]*)\)/.exec(cs.transform);
    const track = getComputedStyle(el);
    return {
      letter: cs.content.replace(/["']/g, ''),
      x: m ? Math.round(parseFloat(m[1].split(',')[4]) * 10) / 10 : 0,
      n: el.getAttribute('data-n'),
      w: el.getBoundingClientRect().width,
      h: el.getBoundingClientRect().height,
      gap: parseFloat(track.getPropertyValue('--gap')),
    };
  }, id || 'qpick');

  console.log('the toggle on the real page');
  // The page opens on the WTR LoRA, which has no quality ladder — so the
  // control is only on screen once a gpt-image-2 style is picked.
  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#qpick:not([hidden])');
  let k = await knob();
  ok(k.n === '1' && k.letter === 'M', 'it opens on medium, showing M');
  const gap = k.gap;
  ok(k.x === gap, 'medium sits one notch along (' + gap + 'px)');

  // 250ms out of the way of the knob's own .18s slide — reading mid-flight
  // gives a real but meaningless x, which is exactly the sort of "flaky test"
  // that gets a correct assertion deleted later.
  await page.click('#qpick'); await page.waitForTimeout(250);
  k = await knob();
  ok(k.n === '2' && k.letter === 'H', 'a tap moves to high, showing H');
  ok(k.x === gap * 2, 'and the knob is two notches along (' + gap * 2 + 'px)');

  await page.click('#qpick'); await page.waitForTimeout(250);
  k = await knob();
  ok(k.n === '0' && k.letter === 'L', 'the next tap WRAPS to low, showing L');
  ok(k.x === 0, 'and the knob is back at the first stop');

  // The three stops are distinct enough to tell apart — the whole reason the
  // account switcher is 48px wide and not 42, and the reason Sophie asked for
  // this one wider still.
  ok(gap >= 10, 'the stops are >=10px apart, readable as three');

  // THE RESOLUTION TOGGLE IS THE SAME CONTROL (Aug 2026, her ask). Same box,
  // same stops, same wrap — and its knob says the VALUE, not an initial.
  const q = await knob('qpick');
  const r = await knob('rpick');
  ok(r.w === q.w && r.h === q.h,
    'it is exactly the same box as the quality toggle (' + r.w + 'x' + r.h + ')');
  ok(r.n === '0' && /^1K$/.test(r.letter), 'it opens on 1K, and the knob says 1K');
  await page.click('#rpick'); await page.waitForTimeout(250);
  const r2 = await knob('rpick');
  ok(r2.n === '1' && r2.letter === '2K', 'a tap moves to 2K');
  ok(r2.x === r.gap, 'and the knob moved one notch');
  await page.click('#rpick'); await page.click('#rpick'); await page.waitForTimeout(250);
  const r4 = await knob('rpick');
  ok(r4.n === '0' && r4.letter === '1K', 'past 4K it WRAPS back to 1K');
  // The knob has to actually FIT its longest word, or "4K" clips.
  const fits = await page.evaluate(() => {
    const el = document.getElementById('rpick');
    const cs = getComputedStyle(el, '::after');
    const c = document.createElement('canvas').getContext('2d');
    c.font = cs.font;
    return { text: c.measureText('4K').width, knob: parseFloat(cs.width) };
  });
  ok(fits.text < fits.knob - 2,
    '"4K" fits inside the knob (' + fits.text.toFixed(1) + 'px of text in ' + fits.knob + 'px)');

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
  await page.waitForFunction(() => document.getElementById('qpick').getAttribute('data-n') === '2');
  k = await knob();
  ok(k.letter === 'H' && k.x === k.gap * 2, 'a ported quality moves the knob, not just the variable');

  // Not persisted — a fresh load is back to medium, same as it always was, so
  // an expensive 'high' can never ride along into next time.
  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#qpick:not([hidden])');
  k = await knob();
  ok(k.n === '1' && k.letter === 'M', 'a fresh load is back to medium');

  // The resolution tier is not persisted either — 4K at high is 47c a picture.
  const rFresh = await knob('rpick');
  ok(rFresh.n === '0' && rFresh.letter === '1K', 'and the resolution is back to 1K');

  // It hides on the LoRA, exactly as the dropdown did (no quality ladder there).
  await page.selectOption('#stylepick', 'watercolor');
  ok(!(await page.isVisible('#qpick')), 'it hides on the Replicate LoRA');
  ok(!(await page.isVisible('#rpick')), 'and so does the resolution toggle');
  await page.selectOption('#stylepick', 'chatgpt');
  ok(await page.isVisible('#qpick'), 'and comes back on a gpt-image-2 style');
  ok(await page.isVisible('#rpick'), 'both of them');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

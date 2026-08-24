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

const px = (v) => parseFloat(v);

console.log('the geometry is the SHARED shell, and this page keeps only its own look');
// The property-by-property comparison against `.swi` in chats.html that used
// to live here is GONE, and so is the reason for it: the geometry moved into
// /tritoggle.css (Aug 2026, Sophie: "make a reusable three toggle shell so we
// can change the styling all at once"), which `scripts/test-tritoggle.js`
// measures in a browser for every instance. What is left to pin HERE is that
// this page did not quietly grow a copy back.
const qtog = rule(pageSrc, '.tri {');
ok(/<link rel="stylesheet" href="\/tritoggle\.css">/.test(pageSrc), 'the page links the shell');
ok(qtog, 'and keeps a .tri rule of its own, for its colour and its size');
ok(!/position\s*:|transition\s*:|border-radius\s*:/.test(qtog),
  'which carries no geometry — no position, no transition, no radius');
ok(!/\.swtog|--tw\s*:|--gap\s*:/.test(pageSrc), 'and no leftover of the old hand-copied rule');
// The SIZE is still hers and still a declared difference from the account
// switcher's ("make the low medium high toggle a little bit wider so it's
// easier to change it"; "4K" does not fit on an 18px knob). The shell's own
// defaults ARE the account switcher, so comparing against them is the same
// assertion it always was, without reaching into another page.
ok(px(decl(qtog, '--tri-w')) > 48, 'the Playground toggle is WIDER than the shell default (' + decl(qtog, '--tri-w') + ' vs 48px)');
ok(px(decl(qtog, '--tri-k')) > 18, 'and its knob is bigger, because it carries "4K" and not just a letter');
// ONE rule, two toggles — the whole reason the stops are numbered.
ok(!/\.qtog\s*\{/.test(pageSrc) && !/\.rtog\s*\{/.test(pageSrc),
  'there is no second copy of the geometry for the resolution toggle');
ok((pageSrc.match(/class="tri"/g) || []).length === 2,
  'both toggles wear the one class');

console.log('black, not red');
// The one declared difference. chats.html paints the track with its own rose
// token; here it is the page's ink, and the assertion is that they DIFFER —
// otherwise a later copy-paste could quietly bring the rose back.
// INK ON PAPER, and since Aug 2026 that means a LINE rather than a slab
// (Sophie: "the buttons are styled so fucking weird. They should have black
// outlines and they're all different sizes") — the toggles were the only
// things on that row with no line at all. Colour only; the geometry is still
// the shell's.
ok(decl(qtog, '--tri-line') === '#2b2622', 'the Playground one draws its line in the page ink #2b2622');
ok(decl(qtog, '--tri-fill') === '#fdfcf9', 'and fills with the row\'s paper, like every control beside it');
ok(decl(qtog, '--tri-knob') === '#2b2622', 'the knob is the dark one — what is lit is the stop, not the whole control');
ok(!/--chg|#a1|rgb\(/i.test(qtog), 'no rose anywhere in the rule');

console.log('the dropdown is gone');
ok(!/<select id="qpick"/.test(pageSrc), 'no <select> left behind');
ok(/<button type="button" id="qpick" class="tri"/.test(pageSrc), 'it is a button now');
ok(!/qpick'\)\.innerHTML|qpick'\)\.value|qpick\.value/.test(pageSrc),
  'nothing still builds options or reads a .value off it');
// The tap AIMS since 2026-08-24 (/tritoggle.js) — but the thing this ever
// cared about is unchanged: the stop count comes from QUALITIES, never from a
// number typed here, so a fourth quality is one entry in that array.
ok(/QUALITIES\[triNext\(qpick, QUALITIES\.length, e, QUALITIES\.indexOf\(quality\)\)\]/.test(pageSrc),
  'the tap reads its stop count off QUALITIES, never off a typed count');

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
    // The geometry is a SHARED stylesheet now — express.static serves it in
    // production, so the stub has to as well. Without it the toggle collapses
    // to a 4px sliver, which is worth knowing: a missing /tritoggle.css is not
    // a subtle degradation.
    if (url.pathname === '/tritoggle.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'tritoggle.css')));
    }
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    // /tritoggle.js — the shared AIM rule (2026-08-24). express.static serves it
    // in production; a stub that does not falls back to the old CYCLE and would
    // green-light the very bug this pins.
    if (url.pathname === '/tritoggle.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'tritoggle.js')));
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
      // `--tri-gap` is a calc() and an UNREGISTERED custom property, so
      // getPropertyValue hands back the unresolved expression, not a number.
      // Measure the real travel instead: park a clone at the middle stop and
      // read where it lands. That is also the honest question — what the
      // browser did, not what the sheet says.
      gap: (function () {
        const c = el.cloneNode(true);
        c.style.position = 'absolute'; c.style.left = '-9999px';
        c.setAttribute('data-n', '1');
        document.body.appendChild(c);
        const cm = /matrix\(([^)]*)\)/.exec(getComputedStyle(c, '::after').transform);
        const v = cm ? Math.round(parseFloat(cm[1].split(',')[4]) * 10) / 10 : 0;
        c.remove();
        return v;
      })(),
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

  // WHERE SHE TAPPED IS THE STOP (2026-08-24, Sophie: "it always goes to high
  // from medium never low even if I click it on that side"). This used to
  // assert a CYCLE — tap anywhere, advance one, wrap — which is exactly the
  // behaviour she was reporting. The track is 78px wide, so the three zones are
  // 26px each and a click position picks one.
  // 250ms out of the way of the knob's own .18s slide — reading mid-flight
  // gives a real but meaningless x, which is exactly the sort of "flaky test"
  // that gets a correct assertion deleted later.
  const tapAt = async (id, frac) => {
    const box = await page.locator('#' + id).boundingBox();
    await page.mouse.click(box.x + box.width * frac, box.y + box.height / 2);
    await page.waitForTimeout(250);
  };

  await tapAt('qpick', 1 / 6);       // the LOW third, from medium
  k = await knob();
  ok(k.n === '0' && k.letter === 'L', 'a tap on the LEFT third goes to low, showing L');
  ok(k.x === 0, 'and the knob is at the first stop');

  await tapAt('qpick', 5 / 6);       // the HIGH third
  k = await knob();
  ok(k.n === '2' && k.letter === 'H', 'a tap on the RIGHT third goes to high, showing H');
  ok(k.x === gap * 2, 'and the knob is two notches along (' + gap * 2 + 'px)');

  await tapAt('qpick', 1 / 2);       // the MIDDLE third
  k = await knob();
  ok(k.n === '1' && k.letter === 'M', 'a tap in the MIDDLE goes to medium, never past it');

  await tapAt('qpick', 1 / 2);       // the stop it is already on
  k = await knob();
  ok(k.n === '1', 'and tapping the stop it is already on leaves it there');

  await tapAt('qpick', 1 / 6);

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
  await tapAt('rpick', 1 / 2);
  const r2 = await knob('rpick');
  ok(r2.n === '1' && r2.letter === '2K', 'a tap in the middle picks 2K');
  ok(r2.x === r.gap, 'and the knob moved one notch');
  await tapAt('rpick', 5 / 6);
  const r4 = await knob('rpick');
  ok(r4.n === '2' && r4.letter === '4K', 'a tap on the right picks 4K');
  await tapAt('rpick', 1 / 6);
  const r1 = await knob('rpick');
  ok(r1.n === '0' && r1.letter === '1K', 'and the left third comes straight back to 1K');
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

  // It is one tap — no menu to open, which is the point — and the label says
  // the tap AIMS, since 2026-08-24.
  ok(await page.getAttribute('#qpick', 'aria-label') === 'Quality low — tap a side to pick one',
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

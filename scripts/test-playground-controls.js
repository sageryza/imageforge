#!/usr/bin/env node
/*
 * test-playground-controls.js — the Playground's control row (Aug 2026,
 * Sophie, five asks in one message):
 *   "add a little oval next to the pyramid, colored on top, white empty on
 *    bottom, signifying medium, and high. when pressed, it kicks off 1 medium
 *    and 1 high job"
 *   "move the pyramid and the oval to the right side so they're next to the
 *    generate button but still to the left of it"
 *   "make the generate button a square"
 *   "make the selected style dropdown not filled in w black (just white, even
 *    tho it's selected)"
 *   "make it not default to square, but just whatever the last option was"
 *
 * Every one of these is a thing you can only really check by MEASURING the
 * rendered page — "colored on top" is a fill's bounding box against the oval's
 * centre, "square" is two numbers that have to match, and "to the left of it"
 * is an x coordinate. So the headless half is the test and the source half only
 * pins the couple of rules a screenshot could never show (the ladder's two
 * tiers, the storage key).
 *
 *   node scripts/test-playground-controls.js
 *   (needs: npm install playwright --no-save)
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

console.log('the rules a picture cannot show');
ok(/ladder\(this, \['low', 'low', 'medium'\]\)/.test(pageSrc), 'the pyramid is still two lows and a medium');
ok(/ladder\(this, \['medium', 'high'\]\)/.test(pageSrc), 'the oval is ONE medium and ONE high');
// Both ladders go through one starter, so a fix to either reaches both.
ok(/function ladder\(btn, tiers\)/.test(pageSrc), 'and both go through one shared starter');
// The shape is remembered; the quality deliberately is NOT (a remembered
// `high` would be 16.5-21.1c a tap arriving unasked).
ok(/localStorage\.setItem\('promptlab_canvas', shape\)/.test(pageSrc), 'the canvas is written to storage');
ok(!/promptlab_quality/.test(pageSrc), 'the QUALITY is still not persisted — she named the canvas only');
ok(/catch \(e\) \{ \/\* private mode \*\/ \}/.test(pageSrc), 'a storage write that throws cannot break the tap');

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
    // The toggle's shell must really be served or `.tri` renders as a 4px
    // sliver and every measurement of it is meaningless (the house note on
    // tritoggle.css says exactly this).
    if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
      res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', url.pathname.slice(1))));
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
  // Her phone. The control row wraps at this width, which is what makes the
  // right-hand group's alignment worth measuring at all.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const box = (sel) => page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);

  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#medhigh:not([hidden])');

  console.log('the oval');
  // "colored on top, white empty on bottom" — asked of the RENDERED geometry,
  // not of the path string, because a wrong arc sweep flag produces perfectly
  // valid markup that fills the wrong half.
  const fill = await page.evaluate(() => {
    const svg = document.querySelector('#medhigh svg');
    const outline = svg.querySelector('ellipse');
    const filled = [...svg.querySelectorAll('path')]
      .find((p) => p.getAttribute('fill') === 'currentColor');
    if (!filled) return null;
    const b = filled.getBBox();
    return {
      top: b.y, bottom: b.y + b.height, left: b.x, right: b.x + b.width,
      cy: +outline.getAttribute('cy'),
      rx: +outline.getAttribute('rx'), ry: +outline.getAttribute('ry'),
    };
  });
  ok(fill, 'the oval has a filled half');
  ok(Math.abs(fill.bottom - fill.cy) < 0.5, 'the fill STOPS at the middle of the oval');
  ok(fill.top < fill.cy - 5, 'and everything it covers is ABOVE that middle — the top is coloured');
  ok(fill.ry > fill.rx, 'it is an oval, taller than it is wide — not a circle');
  // It is a picture of how many, like the pyramid: two tiers, one draw each, so
  // no vertical divider (that is what says "two lows" on the pyramid's base).
  const verticals = await page.evaluate(() => [...document.querySelectorAll('#medhigh svg path')]
    .filter((p) => /^M[\d.]+ [\d.]+v/.test(p.getAttribute('d') || '')).length);
  ok(verticals === 0, 'no vertical divider — each tier is ONE draw');

  console.log('one tap, one medium and one high');
  await page.fill('#prompt', 'a cat');
  await page.click('#medhigh');
  await page.waitForFunction(() => document.querySelectorAll('#pendings *').length > 0);
  await page.waitForTimeout(200);
  ok(posted.length === 2, 'it starts exactly two jobs');
  ok(posted.map((p) => p.quality).sort().join(',') === 'high,medium', 'one medium and one high');
  ok(posted.every((p) => p.prompt === 'a cat'), 'both on the same prompt');
  // The ladder must not move what the toggle says — she can tap it again.
  ok(await page.getAttribute('#qpick', 'data-n') === '1', 'the quality knob is where she left it');

  console.log('the right-hand group');
  const g = await box('.gogroup');
  const row = await box('.controls');
  const py = await box('#lowmed'); const ov = await box('#medhigh'); const go = await box('#go');
  ok(Math.abs(g.right - row.right) <= 1, 'the group is flush with the right of the row');
  ok(py.x < ov.x && ov.right <= go.x, 'pyramid, then oval, then Generate — both ladders LEFT of it');
  ok(Math.abs(go.right - g.right) <= 1, 'and Generate is the rightmost thing in it');
  // The three sit together on one line — the group exists so a wrap cannot
  // scatter them, which per-button `margin-left:auto` would have done.
  // Their CENTRES, not their tops — the group centres them and the ladders are
  // shorter than Generate, so equal tops would be the wrong question.
  const mids = await page.evaluate(() => ['#lowmed', '#medhigh', '#go'].map((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return Math.round(r.y + r.height / 2);
  }));
  ok(mids[0] === mids[1] && mids[1] === mids[2],
    'all three share one line, whatever the row wrapped around them');

  console.log('Generate is a square');
  ok(go.w === go.h, 'its width equals its height (' + go.w + 'x' + go.h + ')');
  // It was a flat 38 until Aug 2026, when Sophie asked for the whole row to
  // share one height at lower padding ("can you make them all have lower
  // padding") — so the number now comes from --ctl-h rather than being typed
  // here, and what this guards is that Generate is still square and still the
  // same box as its neighbours rather than a size of its own.
  const rowH = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.controls')).getPropertyValue('--ctl-h')));
  ok(go.w === rowH, 'and it is the row\'s own height, ' + rowH + 'px');
  // The seed button is the LoRA's, so it is off screen on a gpt-image-2 style —
  // un-hide it to measure rather than reading 0 off a hidden box.
  const seedH = await page.evaluate(() => {
    const b = document.querySelector('.seedbtn');
    b.hidden = false; b.style.display = 'flex';
    const h = Math.round(b.getBoundingClientRect().height);
    return h;
  });
  ok(seedH === rowH, 'the same box the seed button is (' + seedH + ')');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('go')).borderRadius) === '6px',
    'still a 6px rounded rectangle — the house rule, not sharp corners');

  console.log('the style picker is not filled black');
  const sp = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('stylepick'));
    return { bg: cs.backgroundColor, fg: cs.color, img: cs.backgroundImage, border: cs.borderTopColor };
  });
  ok(sp.bg === 'rgb(253, 252, 249)', 'its fill is the page white, not the ink');
  ok(sp.fg === 'rgb(43, 38, 34)', 'and its words are ink on it');
  ok(sp.img.indexOf('faf7f2') < 0 && sp.img.indexOf('2b2622') >= 0,
    'the chevron went dark with the words — a paper chevron would be invisible now');
  ok(sp.border === 'rgb(43, 38, 34)',
    'the ink BORDER stays — it is what still marks the one control that decides the run');

  console.log('the canvas is remembered');
  ok(await page.evaluate(() => document.getElementById('c-square').classList.contains('on')),
    'a phone that never picked one opens on square');
  await page.click('#c-portrait');
  ok(await page.evaluate(() => localStorage.getItem('promptlab_canvas')) === 'portrait',
    'picking one writes it on the TAP, before any run');
  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#canvastog');
  ok(await page.evaluate(() => document.getElementById('c-portrait').classList.contains('on')),
    'and a fresh load comes back on it, not on square');
  // …and it is really the shape the run is sent with, not just a lit button.
  posted.length = 0;
  await page.fill('#prompt', 'a dog');
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings *').length > 0);
  ok(posted.length === 1 && posted[0].canvas === 'portrait', 'the run carries the remembered shape');

  // A junk value cannot ride through as an invented shape.
  await page.evaluate(() => localStorage.setItem('promptlab_canvas', 'triangle'));
  await page.goto(base + '/playground');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#canvastog');
  ok(await page.evaluate(() => document.getElementById('c-square').classList.contains('on')),
    'an unknown stored shape falls back to square');

  // ONE FAMILY — every control on the row (Aug 2026, Sophie: "the buttons are
  // styled so fucking weird. They should have black outlines and they're all
  // different sizes"). Measured, because that complaint is entirely about
  // rendered boxes: the two three-way toggles were solid ink slabs with no
  // line at all, the seed button was the row's one circle, and the style
  // picker stood a pixel taller than everything under it because its height
  // rule was written as `.controls #stylepick` and it does not live in
  // `.controls`.
  console.log('one family');
  await page.selectOption('#stylepick', 'chatgpt');
  await page.waitForSelector('#qpick');
  const family = await page.evaluate(() => {
    const want = ['#stylepick', '#promptbtn', '#photopick', '#rpick', '#qpick', '#canvastog'];
    const out = {};
    want.forEach((sel) => {
      const e = document.querySelector(sel);
      if (!e || !e.getBoundingClientRect().height) return;
      const cs = getComputedStyle(e);
      out[sel] = { h: Math.round(e.getBoundingClientRect().height),
        line: cs.borderTopColor, bg: cs.backgroundColor, bw: cs.borderTopWidth };
    });
    return out;
  });
  const seen = Object.keys(family);
  ok(seen.length >= 5, `the row's controls are all on screen (${seen.length})`);
  const heights = [...new Set(seen.map((k) => family[k].h))];
  ok(heights.length === 1 && heights[0] === 34,
    `all one height (${heights.join(', ')})`);
  const lines = [...new Set(seen.map((k) => family[k].line))];
  ok(lines.length === 1, `all one line colour (${lines.join(' | ')})`);
  ok(/^rgb\(4[0-9], 3[0-9], 3[0-9]\)$/.test(lines[0]), `and that colour is the ink (${lines[0]})`);
  ok(seen.every((k) => parseFloat(family[k].bw) > 0), 'every one of them actually draws its line');
  // The toggles: paper behind the knob, not a solid slab. This is the whole
  // difference she was looking at, and it is a per-instance token on the
  // shared shell — never a second copy of the toggle.
  ['#rpick', '#qpick'].forEach((sel) => {
    ok(family[sel] && family[sel].bg !== family[sel].line,
      `${sel} is paper with a line, not filled ink (${family[sel] && family[sel].bg})`);
  });
  // The seed button belongs to the LoRA style, and it was the one circle.
  await page.selectOption('#stylepick', 'watercolor');
  await page.waitForSelector('.seedbtn');
  const seedR = await page.locator('.seedbtn').evaluate((e) => getComputedStyle(e).borderRadius);
  ok(seedR === '6px', `the seed button is a rounded square, not a circle (${seedR})`);

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

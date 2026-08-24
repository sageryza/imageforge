#!/usr/bin/env node
/*
 * test-playground-res.js — the Playground's resolution tiers (Aug 2026,
 * Sophie: "adding the size as a toggle in the playground for things I want to
 * print versus things I'm using for like videos").
 *
 * Source half, always runs:
 *   1. EVERY TIER IS A LEGAL gpt-image-2 CANVAS. Long edge <= 3840, both edges
 *      a multiple of 16, ratio <= 3:1, 655,360 <= pixels <= 8,294,400. A bad
 *      size is a 400 from OpenAI after the refs have already gone up, so it is
 *      worth catching here rather than in her hands.
 *   2. THE SHAPES ARE EXACT. A "portrait" tier really is 2:3 and a "square"
 *      tier really is 1:1 — the tiers are the same picture at more pixels, so
 *      a tier that quietly changes the crop would be a different composition.
 *   3. 4K IS ACTUALLY THE CEILING. Stepping either 4K canvas up by one legal
 *      increment must break the pixel cap; otherwise the tier is leaving
 *      resolution on the table and the comment claiming it is the maximum is
 *      wrong.
 *   4. 1K IS UNCHANGED AND IS THE DEFAULT. Every run before this shipped was a
 *      1K run, and a page cached on her phone sends no `res` at all — so the
 *      absent value must land on the old canvas, never a dearer one.
 *   5. THE PRICES ARE ON THE SERVER, NOT IN THE PAGE. Same rule the baked
 *      prompts follow: promptlab.html must hold no copy of a cost figure.
 *
 * Page half, headless: the row shows for gpt-image-2 and not for the LoRA, the
 * tier rides the POST, the prices in the tooltips are the SERVER's, and the
 * whole control row still fits — the row already wrapped once when it gained a
 * button, and a control clipped off the screen is one she cannot reach.
 *
 *   node scripts/test-playground-res.js
 *   (page half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// The real `res` literal out of server.js — not a second copy of the numbers.
function resTable() {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                      // eslint-disable-line no-eval
}
const RES = resTable();
const MAX_PX = 8294400, MIN_PX = 655360;
const dim = (s) => s.split('x').map(Number);

console.log('every tier is a canvas gpt-image-2 will actually draw');
Object.keys(RES).forEach((shape) => {
  Object.keys(RES[shape].tiers).forEach((id) => {
    const t = RES[shape].tiers[id];
    const [w, h] = dim(t.size);
    const px = w * h, long = Math.max(w, h), short = Math.min(w, h);
    ok(long <= 3840 && w % 16 === 0 && h % 16 === 0 && long / short <= 3
      && px <= MAX_PX && px >= MIN_PX, shape + ' ' + id + ' ' + t.size + ' is legal');
  });
});

console.log('the shapes are exact');
Object.keys(RES.portrait.tiers).forEach((id) => {
  const [w, h] = dim(RES.portrait.tiers[id].size);
  ok(h * 2 === w * 3, 'portrait ' + id + ' is exactly 2:3');
});
Object.keys(RES.square.tiers).forEach((id) => {
  const [w, h] = dim(RES.square.tiers[id].size);
  ok(w === h, 'square ' + id + ' is exactly 1:1');
});
ok(RES.portrait.aspectRatio === '2:3' && RES.square.aspectRatio === '1:1',
  'and the aspectRatio filed on the run says so');

console.log('4K really is the ceiling');
// The next legal step up for an exact 2:3 is m += 16, i.e. +32 x +48.
{
  const [w, h] = dim(RES.portrait.tiers['4k'].size);
  ok((w + 32) * (h + 48) > MAX_PX, 'no bigger exact 2:3 canvas fits under the cap');
  const [sw] = dim(RES.square.tiers['4k'].size);
  ok((sw + 16) * (sw + 16) > MAX_PX, 'no bigger exact square fits under the cap');
  ok(sw * sw === MAX_PX, 'and the square 4K lands exactly ON the cap');
}

console.log('1K is untouched and is the default');
ok(RES.portrait.tiers['1k'].size === '1024x1536', 'portrait 1K is the old canvas');
ok(RES.square.tiers['1k'].size === '1024x1024', 'square 1K is the old canvas');
ok(/resDefault: '1k'/.test(serverSrc), 'the server default is 1k');
// The absent value must land on 1k — this is the cached-page case.
ok(/const resId = shape\.tiers\[String\(req\.body\.res \|\| ''\)\] \? String\(req\.body\.res\) : PL_GPT\.resDefault/
  .test(serverSrc), 'an unknown or absent res falls back to the default, never an invented size');
ok(/res: resId/.test(serverSrc), 'the run records which tier drew it');
ok(/sizes: PL_GPT\.sizes/.test(serverSrc),
  'the old flat `sizes` is still served, so a cached page keeps working');

console.log('every price is the server\'s, and measured');
Object.keys(RES).forEach((shape) => {
  Object.keys(RES[shape].tiers).forEach((id) => {
    const c = RES[shape].tiers[id].cents || {};
    ok(typeof c.low === 'number' && typeof c.medium === 'number' && typeof c.high === 'number',
      shape + ' ' + id + ' carries all three prices');
  });
});
// Cheap sanity on the measurements: high is 4x medium at every size tested.
Object.keys(RES).forEach((shape) => {
  Object.keys(RES[shape].tiers).forEach((id) => {
    const c = RES[shape].tiers[id].cents;
    ok(Math.abs(c.high / c.medium - 4) < 0.05, shape + ' ' + id + ': high is 4x medium');
  });
});
// The page must hold NO copy of a tier price — the prompts rule, applied to costs.
['6.55', '11.74', '9.83', '17.79', '26.21', '46.94'].forEach((n) => {
  ok(pageSrc.indexOf(n) < 0, 'promptlab.html holds no copy of ' + n + '¢');
});

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
        res.end(JSON.stringify({ id: 'x1' }));
      });
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {
          dreamy: { label: 'Dreamy', prefix: 'P', suffix: 'S', noText: null, refs: [] },
        },
        res: RES, resDefault: '1k',
      }));
    }
    // The three-way toggle's geometry is a SHARED stylesheet since Aug 2026
    // (/tritoggle.css, served by express.static in production). A stub that
    // does not serve it collapses the toggle to a 4px sliver — which is worth
    // knowing: a missing shell is not a subtle degradation.
    if (url.pathname === '/tritoggle.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'tritoggle.css')));
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
  // Her phone. The control row already wrapped once at this width.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  console.log('the toggle on the real page');
  await page.goto(base + '/playground?prompt=a%20cat&style=dreamy');
  await page.waitForSelector('#rpick:not([hidden])');
  ok(await page.isVisible('#rpick'), 'the tier toggle shows on a gpt-image-2 style');
  ok(await page.getAttribute('#rpick', 'data-n') === '0', '1K starts lit');

  // syncControls runs BEFORE /styles answers, so wait for the prices rather
  // than racing them. Until they land the knob carries the tier name and no
  // claim about cost, which is the intended state.
  await page.waitForFunction(() => (document.getElementById('rpick').title || '').length > 0);
  const tip = () => page.getAttribute('#rpick', 'title');
  // SQUARE is the page's remembered default canvas on a clean profile.
  await page.click('#c-square');
  await page.click('#rpick');                       // 1K → 2K
  ok(/1920x1920/.test(await tip()), 'the 2K tooltip names the real canvas for the square');
  ok((await tip()).indexOf(String(RES.square.tiers['2k'].cents.medium)) >= 0,
    'and prints the SERVER\'s measured medium price');
  await page.click('#c-portrait');
  ok(/1568x2352/.test(await tip()),
    'switching to portrait swaps the ladder to the portrait canvases');

  // EVERY control must actually be reachable — the honest question is what a
  // tap at its own centre lands on, not whether the element "is visible".
  for (const id of ['rpick', 'qpick', 'c-portrait', 'c-square', 'promptbtn', 'go']) {
    const hit = await page.evaluate((sel) => {
      const b = document.getElementById(sel);
      const r = b.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return 'squashed';
      if (r.right > innerWidth || r.left < 0) return 'off-screen';
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return b.contains(el) || el === b ? 'ok' : 'covered';
    }, id);
    ok(hit === 'ok', '#' + id + ' is tappable at its own centre (' + hit + ')');
  }

  // ONE HEIGHT DOWN THE WHOLE ROW (Aug 2026, Sophie: "the prompt button seems
  // to be taller than the other buttons … can you make them all have lower
  // padding"). Prompt was the tall one, so it is named here explicitly.
  const heights = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.controls button, .controls select, .controls .canvastog')
      .forEach((b) => {
        if (!b.offsetParent && b.id !== 'go') return;             // hidden controls don't count
        if (b.closest('.canvastog') && !b.classList.contains('canvastog')) return;  // the halves
        out[b.id || b.className] = Math.round(b.getBoundingClientRect().height);
      });
    return out;
  });
  const hs = Object.values(heights);
  ok(hs.length >= 5, 'measured ' + hs.length + ' controls');
  ok(new Set(hs).size === 1,
    'every control on the row is the same height (' + JSON.stringify(heights) + ')');
  ok(hs[0] <= 36, 'and that height is ' + hs[0] + 'px, lower than the old 38');

  // BLACK OUTLINES (her ask, same message) — the warm #d8d0c4 read as gold.
  const inks = await page.evaluate(() => {
    const ids = ['promptbtn', 'rpick', 'qpick', 'stylepick'];
    const out = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.offsetParent) out[id] = getComputedStyle(el).borderTopColor;
    });
    out.canvastog = getComputedStyle(document.getElementById('canvastog')).borderTopColor;
    return out;
  });
  Object.keys(inks).forEach((id) => {
    ok(inks[id] === 'rgb(43, 38, 34)', id + ' has a black outline (' + inks[id] + ')');
  });

  // NO BOX on the two ladders (her ask: "I want it back the other way no box").
  await page.evaluate(() => {
    document.getElementById('lowmed').hidden = false;
    document.getElementById('medhigh').hidden = false;
  });
  const ladder = await page.evaluate(() => {
    const c = getComputedStyle(document.getElementById('lowmed'));
    return { w: c.borderTopWidth, bg: c.backgroundColor,
      h: Math.round(document.getElementById('lowmed').getBoundingClientRect().height) };
  });
  ok(ladder.w === '0px', 'the pyramid has no border');
  ok(/rgba\(0, 0, 0, 0\)|transparent/.test(ladder.bg), 'and no fill behind it');
  ok(ladder.h === hs[0], 'but it still stands the row\'s full height as a tap target');

  console.log('it rides the POST');
  // Tap until it IS on 4K rather than counting taps from a state earlier
  // assertions have already moved — a wrap makes a fixed count wrong.
  for (let i = 0; i < 3 && await page.getAttribute('#rpick', 'data-n') !== '2'; i++) {
    await page.click('#rpick');
  }
  ok(await page.getAttribute('#rpick', 'data-n') === '2', 'tapping to 4K lights the last stop');
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings *').length > 0);
  ok(posted.length === 1 && posted[0].res === '4k', 'the run carries res:"4k"');
  ok(posted[0].canvas === 'portrait', 'with the shape alongside it');

  // NOT persisted — 4K high is 47c a picture and must never carry over unmeant.
  await page.goto(base + '/playground?style=dreamy');
  await page.waitForSelector('#rpick:not([hidden])');
  ok(await page.getAttribute('#rpick', 'data-n') === '0', 'a fresh load is back to 1K');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

#!/usr/bin/env node
// THE PLAYGROUND'S LIGHTBOX — THE PICTURE IS THERE AT ONCE, THERE IS A WAY
// OUT, AND THE PROMPT SAYS WHICH HALF IS WHICH (2026-08-26, Sophie: "it seems
// like it takes quite a while to load the images in light box view. Could that
// be fixed? Also, it's a little hard to tap out of them. Could you have some
// room at the top or something to get rid of to get back to the playground …
// can you have it say prompt and have the prompt in there instead of below
// split into the style and the content and the style shouldn't be the default
// it should actually look at what it was that time since I can change it").
//
// Three asks, three measurements, and each one has to be a measurement:
//
//   1. SLOW — the wall loads a 480px derived thumb and the lightbox loaded the
//      untouched original, so every tap was a fresh 1-3MB download with the
//      PREVIOUS picture still on screen. The original here is served with a
//      real delay and the test asks what is PAINTED before it lands: a src
//      assertion alone cannot tell a picture on screen from a pending one.
//   2. HARD TO TAP OUT — the two step zones are 28% of the width each and run
//      the stage's full height, and nothing is drawn in them, so more than
//      half the picture area pages instead of closing. `elementFromPoint` is
//      the only honest way to ask what a tap at a given spot actually reaches.
//   3. THE STYLE HALF IS THIS RUN'S — a run whose prefix she edited must show
//      the text that really wrapped her words, never the tile's baked default.
//      The fixture's edited run says so in a word the default does not contain.
//
//   npm install playwright --no-save && node scripts/test-playground-lightbox.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const servePublic = require('./lib/public-asset');
const PUB = path.join(__dirname, '..', 'public');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

// A real Storage host, so `thumbFor` rewrites it the way it does in her hand.
// Nothing reaches the network: the https request is routed in the browser.
const STORED = 'https://storage.googleapis.com/bucket/promptlab/big-2k.webp';
const PLAIN = 'https://storage.googleapis.com/bucket/promptlab/plain.webp';

// Her words, and the exact string that was sent around them. The prefix is
// EDITED — "chalky" appears nowhere in the tile's house prefix — which is the
// whole point of ask 3.
const TYPED = 'a woman in a yellow raincoat feeding crows on a park bench at dusk';
const EDITED_PREFIX = 'Copy the drawing style of the attached reference, chalky and dry.';
const TAIL = 'Draw it inside a hand-drawn border. no text.';
const RUNS = [
  { id: 'edited', prompt: TYPED, fullPrompt: EDITED_PREFIX + '\n\n' + TYPED + '\n\n' + TAIL,
    engine: 'gptimage', model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'medium',
    aspectRatio: '2:3', status: 'done', images: [STORED], votes: {}, createdAt: 3000 },
  // The plain ChatGPT tile attaches nothing and wraps nothing: her words ARE
  // the whole prompt, so there is no style half to show and no STYLE button.
  { id: 'plain', prompt: 'a shelf of oddities', fullPrompt: 'a shelf of oddities',
    engine: 'gptimage', model: 'gpt-image-2', gptStyle: 'plain', quality: 'low',
    aspectRatio: '2:3', status: 'done', images: [PLAIN], votes: {}, createdAt: 2000 },
];

const svg = (w, h, fill) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
  + '<rect width="' + w + '" height="' + h + '" fill="' + fill + '"/></svg>';

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, … A
  // page whose kit 404s throws on its first line and nothing renders at all,
  // which is exactly how this harness timed out the day /feedkit.js landed.
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname === '/api/promptlab/styles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ styles: {}, sizes: {}, res: {} }));
  }
  // The derived display copy — small, and instant, exactly as the cached one
  // behind a tile she has just been looking at is.
  if (url.pathname === '/api/story/thumb') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end(svg(480, 720, '#8a7f70'));
  }
  if (url.pathname === '/playground-port.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, 'playground-port.js')));
  }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // The ORIGINAL is slow — that is the whole complaint. 1200ms stands in for a
  // 2K webp over cell.
  // Counted per picture — the page's own Sophie-character button loads a
  // Storage image of its own at startup, which is not a run's picture.
  const originals = {};
  await page.route('https://storage.googleapis.com/**', async (route) => {
    const u = route.request().url();
    originals[u] = (originals[u] || 0) + 1;
    if (u === STORED || u === PLAIN) await new Promise(r => setTimeout(r, 1200));
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(1024, 1536, '#4a4038') });
  });
  const pulled = (u) => originals[u] || 0;

  await page.addInitScript(() => localStorage.setItem('promptlab_view', 'tiles'));
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell:not(.ph) img').length > 1);
  // The wall itself must not have pulled a single original — it is thumbs.
  ok(pulled(STORED) === 0 && pulled(PLAIN) === 0,
    'the wall pulls no full-size picture at all (' + pulled(STORED) + ')');

  // ── 1. THE PICTURE IS ON SCREEN BEFORE THE ORIGINAL LANDS ────────────────
  console.log('\nthe picture is there at once');
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForSelector('#lb.on');
  // Straight away — no waiting. A painted <img> reports a natural size and a
  // box with real height; a pending one reports 0.
  const early = await page.evaluate(() => {
    const im = document.getElementById('lbimg');
    const b = im.getBoundingClientRect();
    return { w: im.naturalWidth, h: Math.round(b.height), src: im.getAttribute('src') };
  });
  ok(early.w > 0 && early.h > 20,
    'a picture is painted immediately (' + early.w + 'px natural, ' + early.h + 'px tall)');
  ok(early.src.indexOf('/api/story/thumb') === 0,
    'and it is the derived thumb the wall already had, not a fresh download');

  // …then the original takes its place, at full resolution.
  await page.waitForFunction(
    () => document.getElementById('lbimg').naturalWidth > 900, null, { timeout: 8000 });
  const settled = await page.evaluate(() => {
    const im = document.getElementById('lbimg');
    return { w: im.naturalWidth, src: im.getAttribute('src'), save: window.lbSrc };
  });
  ok(settled.w === 1024, 'the original swaps in behind it (' + settled.w + 'px)');
  ok(settled.src.indexOf('/api/story/thumb') !== 0, 'the thumb is not what she is left looking at');
  ok(settled.save === STORED, 'Save and the app bridge still get the untouched original url');
  ok(pulled(STORED) === 1, 'ONE download of the original, not two (' + pulled(STORED) + ')');

  // ── 2. THE WAY OUT AT THE TOP ────────────────────────────────────────────
  console.log('\nthere is room at the top to get out');
  const top = await page.evaluate(() => {
    const bar = document.getElementById('lbtop').getBoundingClientRect();
    const stage = document.querySelector('.lbstage').getBoundingClientRect();
    const back = document.getElementById('lbback').getBoundingClientRect();
      // An SVG's className is an SVGAnimatedString, not a string.
      const name = (el) => !el ? null
        : String(el.id || (typeof el.className === 'string' ? el.className : '') || el.tagName);
    // What a tap in the middle of the band, and on the chevron, actually hits.
    const mid = document.elementFromPoint(195, Math.round(bar.top + bar.height / 2));
    const onBack = document.elementFromPoint(Math.round(back.left + back.width / 2),
      Math.round(back.top + back.height / 2));
    return {
      barH: Math.round(bar.height), barBottom: Math.round(bar.bottom),
      stageTop: Math.round(stage.top), backLeft: Math.round(back.left),
      backW: Math.round(back.width), backH: Math.round(back.height),
      mid: name(mid), onBack: name(onBack),
      backHit: !!(onBack && onBack.closest && onBack.closest('#lbback')),
      midIsNav: !!(mid && mid.closest && mid.closest('.lbnav')),
      backIsNav: !!(onBack && onBack.closest && onBack.closest('.lbnav')),
    };
  });
  ok(top.barH >= 34, 'the band is a real strip (' + top.barH + 'px)');
  ok(top.barBottom <= top.stageTop + 1,
    'it sits ABOVE the picture area (' + top.barBottom + ' vs stage ' + top.stageTop + ')');
  ok(!top.midIsNav && !top.backIsNav, 'no step zone reaches into it');
  ok(top.backLeft < 60, 'the chevron is at the left, clear of the pill\'s corner');
  ok(top.backW >= 30 && top.backH >= 30,
    'and it is a real tap target (' + top.backW + 'x' + top.backH + ')');
  ok(top.backHit, 'a tap on the chevron reaches the chevron (' + top.onBack + ')');
  // The tap itself — anywhere in the strip, not only on the glyph.
  await page.mouse.click(300, top.barBottom - Math.round(top.barH / 2));
  ok(!(await page.locator('#lb.on').count()), 'tapping the empty part of the band closes it');
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForSelector('#lb.on');
  await page.click('#lbback');
  ok(!(await page.locator('#lb.on').count()), 'and so does the chevron');

  // ── 3. IT SAYS PROMPT, SPLIT, AND THE STYLE IS THIS RUN'S ────────────────
  console.log('\nthe prompt, split, as this run really sent it');
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForSelector('#lb.on');
  const opened = await page.evaluate(() => {
    const words = document.getElementById('lbpwrap');
    // What a tap in the middle of the picture reaches — the honest way to ask
    // whether anything is sitting on the art she opened.
    const r = document.getElementById('lbimg').getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      title: document.querySelector('#lb .capttl').textContent.trim(),
      rowShown: !document.getElementById('lbcaphd').hidden,
      wordsShown: !words.hidden,
      segShown: !document.getElementById('lbcapseg').hidden,
      onMiddle: hit ? (hit.id || hit.className) : '',
      // The band between the picture and the ♥/✕ row, which is where the
      // words used to be printed.
      capH: Math.round(document.querySelector('#lb .cap').getBoundingClientRect().height),
    };
  });
  ok(/^prompt$/i.test(opened.title), 'it says Prompt (' + opened.title + ')');
  ok(opened.rowShown, 'the door is there on a run with a prompt on file');
  // HER REPORT, 2026-08-26: "something strange is going on with the prompt. It
  // shouldn't be there" — the whole content half was printed under the picture.
  ok(!opened.wordsShown, 'the words are NOT printed under the picture');
  ok(!opened.segShown, 'and Content/Style is not offered while they are shut');
  ok(opened.capH <= 60, 'so the caption band is a line, not a paragraph (' + opened.capH + 'px)');
  ok(opened.onMiddle.indexOf('lbpwrap') < 0,
    'and nothing covers the picture (' + opened.onMiddle + ')');

  await page.click('#lbpbtn');
  const shownNow = await page.evaluate(() => {
    const r = document.getElementById('lbimg').getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      shown: document.getElementById('lbcapp').textContent,
      contentOn: document.getElementById('lbhalfc').classList.contains('on'),
      styleShown: !document.getElementById('lbhalfs').hidden,
      segShown: !document.getElementById('lbcapseg').hidden,
      // The words themselves are what a tap in the middle lands on; either the
      // overlay or its text answers "something is over the picture".
      over: hit ? (hit.closest('.lbpwrap') ? 'lbpwrap' : (hit.id || hit.className)) : '',
      lit: document.getElementById('lbpbtn').classList.contains('on'),
    };
  });
  ok(shownNow.segShown && shownNow.styleShown, 'tapping PROMPT offers both halves');
  ok(shownNow.contentOn, 'it opens on CONTENT — the house rule');
  ok(shownNow.shown === TYPED, 'and content is her words, verbatim');
  ok(String(shownNow.over).indexOf('lbpwrap') >= 0,
    'the words cover the picture, the way the Assets overlay does (' + shownNow.over + ')');
  ok(shownNow.lit, 'and the door says it is open');

  await page.click('#lbhalfs');
  const styled = await page.evaluate(() => ({
    shown: document.getElementById('lbcapp').textContent,
    open: !!document.querySelector('#lb.on'),
  }));
  ok(styled.open, 'switching halves does not close the lightbox');
  ok(styled.shown.indexOf('chalky') >= 0,
    'STYLE is the wrapper THIS run really sent (her edited prefix), not the tile default');
  ok(styled.shown.indexOf('[content]') >= 0, 'with the seam marked where her words went');
  ok(styled.shown.indexOf(TAIL) >= 0, 'and the tail that rode behind them');
  ok(styled.shown.indexOf(TYPED) < 0, 'her words are not repeated inside the style half');

  // Tapping the words hands the picture back — and does NOT leave the lightbox.
  await page.click('#lbpwrap');
  const put = await page.evaluate(() => ({
    open: !!document.querySelector('#lb.on'),
    wordsShown: !document.getElementById('lbpwrap').hidden,
  }));
  ok(put.open, 'tapping the words does not close the lightbox');
  ok(!put.wordsShown, 'it puts them away');

  // The plain tile wraps nothing — no style half, and no button offering one.
  await page.click('#lbnext');
  await page.click('#lbpbtn');
  const plain = await page.evaluate(() => ({
    shown: document.getElementById('lbcapp').textContent,
    styleShown: !document.getElementById('lbhalfs').hidden,
    contentOn: document.getElementById('lbhalfc').classList.contains('on'),
  }));
  ok(!plain.styleShown, 'a run that wrapped nothing offers NO style button');
  ok(plain.contentOn && plain.shown === 'a shelf of oddities',
    'and falls back to her words rather than an empty box');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

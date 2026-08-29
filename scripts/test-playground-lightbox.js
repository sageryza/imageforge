#!/usr/bin/env node
// THE PLAYGROUND'S LIGHTBOX IS THE SHARED ASSETS ONE (2026-08-26, Sophie:
// "I tried to port that exact design into the playground … but the design is
// different in playground, people keep fixing parts of it, but it should be
// the exact same design — can it not be the same exact code?"). It is: the
// page opens `asset-lightbox.js` — the file the Assets tab, Meta Assets,
// Panels and the grid pages already share — and builds NO lightbox of its
// own. What this page adds rides that file's hooks (the step zones, the
// prompt state across steps), never a fork.
//
// What this drives on the REAL page, in headless Chromium:
//   0. the SOURCE PIN — promptlab.html links the shared file and carries no
//      copy (the Meta Assets migration's own step 0; the copy is how every
//      settled fix reached Sophie a second time),
//   1. SLOW — the wall's cached 480px thumb paints in the same frame and the
//      original swaps in behind it, ONE download (her 2026-08-26 report),
//   2. the way out — dead space closes (the Assets rule: "anywhere not a
//      button or image or chat"), measured with elementFromPoint,
//   3. the PROMPT — the Assets overlay itself: PROMPT in the top row, the
//      words covering the picture, Content first, Style the wrapper THIS run
//      really sent (never the tile's baked default), no Style|Content pair on
//      a run that wrapped nothing,
//   4. the door's state RIDES A STEP and dies with a fresh open (her rule:
//      "the half she picked rides along as she steps"),
//   5. the actions row — put the prompt back in the box, Save, Add to
//      Shoebox, Story Room.
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
  // the whole prompt, so there is no style half and no Style|Content pair.
  { id: 'plain', prompt: 'a shelf of oddities', fullPrompt: 'a shelf of oddities',
    engine: 'gptimage', model: 'gpt-image-2', gptStyle: 'plain', quality: 'low',
    aspectRatio: '2:3', status: 'done', images: [PLAIN], votes: {}, createdAt: 2000 },
];

const svg = (w, h, fill) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
  + '<rect width="' + w + '" height="' + h + '" fill="' + fill + '"/></svg>';

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /asset-lightbox.js,
  // /tritoggle.*, … A page whose kit 404s throws on its first line and nothing
  // renders at all, which is exactly how this harness timed out the day
  // /feedkit.js landed.
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
  if (url.pathname === '/api/gallery/assets/note') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ thread: [] }));
  }
  // The derived display copy — small, and instant, exactly as the cached one
  // behind a tile she has just been looking at is.
  if (url.pathname === '/api/story/thumb') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end(svg(480, 720, '#8a7f70'));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
});

(async () => {
  // ── 0. THE SOURCE PIN — the page opens the shared lightbox and builds none
  //       of its own. The hand copy is how every settled fix reached Sophie a
  //       second time; this is the assertion that it can never come back. ────
  console.log('the page keeps no lightbox of its own');
  const LAB = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
  ok(/<script src="\/asset-lightbox\.js">/.test(LAB), 'promptlab.html links /asset-lightbox.js');
  ok(!/id="lb"/.test(LAB) && !/lbpwrap|lbstage|lbcaphd|capseg/.test(LAB),
    'and carries no lightbox markup of its own');
  ok(!/#lb\s*\{|\.lbnav\s*\{|\.lbtop\s*\{/.test(LAB), 'nor any lightbox CSS of its own');
  ok(/__assetLightbox\(/.test(LAB), 'it opens window.__assetLightbox');

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

  const shown = () => page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });

  await page.addInitScript(() => localStorage.setItem('promptlab_view', 'tiles'));
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell:not(.ph) img').length > 1);
  // The wall itself must not have pulled a single original — it is thumbs.
  ok(pulled(STORED) === 0 && pulled(PLAIN) === 0,
    'the wall pulls no full-size picture at all (' + pulled(STORED) + ')');

  // ── 1. THE PICTURE IS ON SCREEN BEFORE THE ORIGINAL LANDS ────────────────
  console.log('\nthe picture is there at once');
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForSelector('#clightbox');
  ok(await shown(), 'the shared lightbox opened');
  // Straight away — no waiting. A painted <img> reports a natural size and a
  // box with real height; a pending one reports 0.
  const early = await page.evaluate(() => {
    const im = document.querySelector('#clightbox .clwrap img');
    const b = im.getBoundingClientRect();
    return { w: im.naturalWidth, h: Math.round(b.height), src: im.getAttribute('src') };
  });
  ok(early.w > 0 && early.h > 20,
    'a picture is painted immediately (' + early.w + 'px natural, ' + early.h + 'px tall)');
  ok(early.src.indexOf('/api/story/thumb') === 0,
    'and it is the derived thumb the wall already had, not a fresh download');

  // …then the original takes its place, at full resolution.
  await page.waitForFunction(
    () => document.querySelector('#clightbox .clwrap img').naturalWidth > 900, null, { timeout: 8000 });
  const settled = await page.evaluate(() => {
    const im = document.querySelector('#clightbox .clwrap img');
    return { w: im.naturalWidth, src: im.getAttribute('src'), save: window.lbSrc };
  });
  ok(settled.w === 1024, 'the original swaps in behind it (' + settled.w + 'px)');
  ok(settled.src.indexOf('/api/story/thumb') !== 0, 'the thumb is not what she is left looking at');
  ok(settled.save === STORED, 'Save and the app bridge still get the untouched original url');
  ok(pulled(STORED) === 1, 'ONE download of the original, not two (' + pulled(STORED) + ')');

  // ── 2. THE WAY OUT — dead space closes, the Assets rule ─────────────────
  console.log('\ndead space closes it');
  // The empty half of the top band beside the Prompt button (the ♥/✕ live in
  // the row under the picture now — see 2b).
  const strip = await page.evaluate(() => {
    const pb = document.querySelector('#clightbox .promptbtn').getBoundingClientRect();
    const gap = { x: Math.round(pb.left / 2), y: Math.round(pb.top + pb.height / 2) };
    const el = document.elementFromPoint(gap.x, gap.y);
    return { gap, gapIs: el ? el.className : '' };
  });
  ok(String(strip.gapIs).indexOf('lbtop') >= 0,
    'the gap beside the Prompt button is the strip itself, not a control (' + strip.gapIs + ')');
  await page.mouse.click(strip.gap.x, strip.gap.y);
  ok(!(await shown()), 'a tap in the empty space beside a button closes it');

  // ── 2b. THE OLD ARRANGEMENT IS BACK (2026-08-26, Sophie: "put the heart
  //    where they were before exactly … the quality model etc. should go
  //    right under the picture not below the note area") — the port had
  //    moved ♥/✕ to the screen's top corners and left the tag below the
  //    note box. ──────────────────────────────────────────────────────────
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForFunction(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  const layout = await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    const img = lb.querySelector('.clwrap img').getBoundingClientRect();
    // this page has no per-picture label, so the meta tag renders as .clcap
    const tag = lb.querySelector('.cltag, .clcap').getBoundingClientRect();
    const acts = lb.querySelector('.lbacts').getBoundingClientRect();
    const heart = lb.querySelector('.vote.heart');
    const hb = heart.getBoundingClientRect();
    const note = lb.querySelector('.lbnote').getBoundingClientRect();
    return {
      topVotes: lb.querySelectorAll('.lbtop .vote').length,
      heartInRow: !!heart.closest('.lbacts'),
      first: lb.querySelector('.lbacts button').getAttribute('aria-label'),
      tagUnderImg: tag.top >= img.bottom - 1 && tag.bottom <= acts.top + 1,
      heartAboveNotes: hb.top >= img.bottom - 1 && hb.bottom <= note.top + 1,
      // ONE SIZE FOR EVERY BUTTON UNDER THE PICTURE (2026-08-27). The row
      // mixes .vote (38px) with .lbacts button (34px), so this is MEASURED
      // off the real boxes — a class assertion cannot see two rules winning
      // on two different buttons. The numbers are the Playground's own from
      // the day before the port onto the shared file (.lbbtn, 46 / 21).
      btns: Array.prototype.map.call(
        lb.querySelectorAll('.lbacts button, .lbnote .notesend'),
        function (b) {
          var r = b.getBoundingClientRect(), s = b.querySelector('svg');
          var sr = s ? s.getBoundingClientRect() : { width: 0, height: 0 };
          return {
            label: b.getAttribute('aria-label') || 'send',
            w: Math.round(r.width), h: Math.round(r.height),
            sw: Math.round(sr.width), sh: Math.round(sr.height),
          };
        }),
      // and the row still fits the phone it is read on
      rowFits: acts.left >= 0 && acts.right <= window.innerWidth,
    };
  });
  ok(layout.topVotes === 0, 'no ♥/✕ in the top band');
  ok(layout.heartInRow, 'the ♥ rides the button row under the picture');
  ok(layout.first === 'Heart', 'and it is the FIRST button in that row');
  ok(layout.tagUnderImg, 'MODEL · QUALITY sits right under the picture, above the buttons');
  ok(layout.heartAboveNotes, 'the ♥ sits under the picture, above the note box');
  // SEVEN since 2026-08-29 — Add to Shoebox joined the row ("how do i send a
  // picture to shoebox in the playground"). The COUNT is not the point; the
  // sizes below are, and a button that joins the row has to join at the row's
  // one size.
  ok(layout.btns.length === 7,
    'seven buttons under the picture (♥ ✕ · copy · save · shoebox · story)');
  const odd = layout.btns.filter((b) => b.w !== 46 || b.h !== 46);
  ok(odd.length === 0, 'every one of them is 46x46 — the size they were before the port ('
    + (odd.length ? odd.map((b) => b.label + ' ' + b.w + 'x' + b.h).join(', ') : 'all 46') + ')');
  const oddg = layout.btns.filter((b) => b.sw !== 21 || b.sh !== 21);
  ok(oddg.length === 0, 'and every glyph inside them is 21x21 ('
    + (oddg.length ? oddg.map((b) => b.label + ' ' + b.sw + 'x' + b.sh).join(', ') : 'all 21') + ')');
  ok(layout.rowFits, 'the row still fits the screen at this width');
  await page.evaluate(() => document.getElementById('clightbox').click());
  ok(!(await shown()), '(closed again)');
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForFunction(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  // …and the backdrop beside the picture closes too.
  const beside = await page.evaluate(() => {
    const r = document.querySelector('#clightbox .clwrap img').getBoundingClientRect();
    return { x: 4, y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.click(beside.x, beside.y);
  ok(!(await shown()), 'and so does the backdrop beside the picture');

  // ── 3. IT SAYS PROMPT, SPLIT, AND THE STYLE IS THIS RUN'S ────────────────
  console.log('\nthe prompt, split, as this run really sent it');
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForFunction(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  const opened = await page.evaluate(() => {
    const btn = document.querySelector('#clightbox .promptbtn');
    const ov = document.querySelector('#clightbox .lbp');
    const r = document.querySelector('#clightbox .clwrap img').getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return {
      title: btn ? btn.textContent.trim() : '',
      inTop: !!(btn && btn.closest('.lbtop')),
      wordsShown: !!(ov && ov.style.display !== 'none'),
      overMiddle: hit ? !!hit.closest('.lbp') : false,
    };
  });
  ok(/^prompt$/i.test(opened.title), 'it says Prompt (' + opened.title + ')');
  ok(opened.inTop, 'the door rides the top row, beside the ♥/✕ — the Assets shape');
  ok(!opened.wordsShown && !opened.overMiddle, 'the words are shut on a fresh open');

  await page.evaluate(() => document.querySelector('#clightbox .promptbtn').click());
  const shownNow = await page.evaluate(() => {
    const r = document.querySelector('#clightbox .clwrap img').getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    const btns = [...document.querySelectorAll('#clightbox .lbptog button')];
    return {
      shown: document.querySelector('#clightbox .lbptext').textContent,
      contentOn: btns[1] && btns[1].classList.contains('on'),
      pairShown: document.querySelector('#clightbox .lbptog').getClientRects().length > 0,
      over: hit ? !!hit.closest('.lbp') : false,
      lit: document.querySelector('#clightbox .promptbtn').classList.contains('on'),
    };
  });
  ok(shownNow.pairShown, 'tapping PROMPT offers both halves');
  ok(shownNow.contentOn, 'it opens on CONTENT — the house rule');
  ok(shownNow.shown === TYPED, 'and content is her words, verbatim');
  ok(shownNow.over, 'the words cover the picture, the way the Assets overlay does');
  ok(shownNow.lit, 'and the door says it is open');

  await page.evaluate(() => document.querySelectorAll('#clightbox .lbptog button')[0].click());
  const styled = await page.evaluate(() => ({
    shown: document.querySelector('#clightbox .lbptext').textContent,
    open: document.getElementById('clightbox').style.display !== 'none',
  }));
  ok(styled.open, 'switching halves does not close the lightbox');
  ok(styled.shown.indexOf('chalky') >= 0,
    'STYLE is the wrapper THIS run really sent (her edited prefix), not the tile default');
  ok(styled.shown.indexOf('[content]') >= 0, 'with the seam marked where her words went');
  ok(styled.shown.indexOf(TAIL) >= 0, 'and the tail that rode behind them');
  ok(styled.shown.indexOf(TYPED) < 0, 'her words are not repeated inside the style half');

  // ── 4. THE DOOR'S STATE RIDES A STEP, AND DIES WITH A FRESH OPEN ─────────
  console.log('\nthe half she picked rides along as she steps');
  await page.evaluate(() => document.querySelector('#clightbox .lbzone.next').click());
  const stepped = await page.evaluate(() => {
    const ov = document.querySelector('#clightbox .lbp');
    return {
      cur: window.lbCur.id,
      wordsShown: !!(ov && ov.style.display !== 'none'),
      shown: ov ? document.querySelector('#clightbox .lbptext').textContent : '',
      pairShown: document.querySelector('#clightbox .lbptog')
        ? document.querySelector('#clightbox .lbptog').getClientRects().length > 0 : false,
    };
  });
  ok(stepped.cur === 'plain', 'the invisible zone steps to the next picture (' + stepped.cur + ')');
  ok(stepped.wordsShown, 'the open door rides the step');
  // The plain run wrapped nothing: no style half to hold onto, so it falls
  // back to her words — and offers no Style|Content pair at all.
  ok(!stepped.pairShown, 'a run that wrapped nothing offers NO Style|Content pair');
  ok(stepped.shown === 'a shelf of oddities', 'and shows her words rather than an empty box');

  // A fresh open starts shut, on content — whatever the last open was doing.
  await page.evaluate(() => document.getElementById('clightbox').click());
  ok(!(await shown()), '(closed again)');
  await page.locator('#tiles .cell:not(.ph) img').first().click();
  await page.waitForFunction(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  const fresh = await page.evaluate(() => {
    const ov = document.querySelector('#clightbox .lbp');
    return { wordsShown: !!(ov && ov.style.display !== 'none') };
  });
  ok(!fresh.wordsShown, 'a fresh open starts with the door shut');

  // ── 5. THE ACTIONS ROW — copy back, Save, Shoebox, Story Room ───────────
  console.log('\nthe actions row');
  const acts = await page.$$eval('#clightbox .lbacts button',
    (es) => es.map((e) => e.getAttribute('aria-label')));
  ok(JSON.stringify(acts) === JSON.stringify(
    ['Heart', 'Reject', 'Put this prompt back in the box', 'Save to Photos',
     'Add to Shoebox', 'Send to the Story Room']),
  '♥ ✕ then the four actions, in order (' + acts.join(' · ') + ')');
  await page.evaluate(() => document.querySelector(
    '#clightbox .lbacts button[aria-label="Put this prompt back in the box"]').click());
  const copied = await page.evaluate(() => ({
    open: document.getElementById('clightbox').style.display !== 'none',
    box: document.getElementById('prompt').value,
  }));
  ok(!copied.open, 'the copy action closes the lightbox');
  ok(copied.box === TYPED, 'and lands the prompt back in the box');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

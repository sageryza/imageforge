#!/usr/bin/env node
// THE REMODELLED BEAT POPUP (Aug 2026, Sophie's five asks in one message).
// Drives the REAL public/scratchpad.html in headless Chromium against a stub
// API and MEASURES what each ask actually means:
//   1. "the whole popup gets bigger … similar aspect ratio as total screen
//      (not square)" — the card's own box against the viewport's shape.
//   2. "that image is bigger by default" — the picture is no longer pinned to
//      the pad tile's ~90px.
//   3. "stars, playground and inbox buttons get put into rounded squares and
//      go under the main (currently chosen) image" — squares (w===h), house
//      radius 6px, and their top edge BELOW the picture's bottom.
//   4. "colors become one multicolored rounded square in the corner, drop
//      down" — one button, more than one colour in it, top-right, and the
//      chips only reachable once it is tapped.
//   5. "drawing a new picture replaces the old, but keeps it in the stacked
//      squares icon" — the past pictures are folded behind that button, and
//      it only appears when there ARE past pictures.
//   6. two text boxes: caption open, drawing prompt COLLAPSED; opening the
//      prompt collapses the caption; the caption re-opens by hand.
//   7. (2026-08-24) the caption opens as WORDS with a pencil beside them,
//      never as an open box; the pencil is what swaps the box in.
//   8. (2026-08-24) a beat with NO picture: the blank tile is small, and
//      the drawing prompt opens beside the caption instead of folded away.
//   9. (2026-08-26) the draw row: Draw wears the house generate star (the
//      SAME markup #ardraw draws, never a second copy), and quality is the
//      shared three-way toggle opening on LOW — aimed at a POSITION, since a
//      click on the element's centre is where a cycle and an aim agree.
//  10. (2026-08-26) either box opens BIGGER behind a corner button, and never
//      by default — measured, since a class swap is trivially "working".
//
//   node scripts/test-scratchpad-popup.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
// A REAL-SIZED 2:3 picture: the popup sizes itself to the art, so a 1x1
// pixel would put every measurement below nowhere near the truth.
const PNG = (() => {
  const w = 400, h = 600;
  const zlib = require('zlib');
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = 180; raw[row + 2 + x * 3] = 140; raw[row + 3 + x * 3] = 90;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(require('zlib').crc32 ? zlib.crc32(td) >>> 0 : crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
})();

let beats = [{
  id: 'b1', url: '/px.png?cur', text: 'the beat says this', color: null,
  imageHistory: [{ url: '/px.png?old1' }, { url: '/px.png?old2' }],
}];
const posted = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/color') beats.forEach((x) => { if (x.id === b.id) x.color = b.color; });
      if (url.pathname === '/api/scratchpad/prompt') beats.forEach((x) => { if (x.id === b.id) x.prompt = b.prompt; });
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'popup test', film: null, audios: [] });
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/scratchpad-sophie.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  // The shared three-way toggle: express.static serves both in production.
  // Without the CSS the toggle renders as a 4px sliver; without the JS the page
  // falls back to the old CYCLE, which would green-light the aim bug.
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

const VW = 390, VH = 780;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beat');

  const box = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right };
  });
  const shown = (sel) => page.$eval(sel, (el) => !el.hidden && el.offsetParent !== null);

  const tile = await box('#pad .beat');
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.waitForFunction(() => {
    const im = document.getElementById('popimg');
    return im && !im.hidden && im.getBoundingClientRect().width > 0;
  });

  // 1 — the card is nearly the whole screen, and screen-shaped
  const card = await box('#beatcard');
  ok(card.w * card.h > VW * VH * 0.75,
    'the card fills most of the screen (' + Math.round(card.w) + 'x' + Math.round(card.h) + ')');
  ok(card.w < VW && card.h < VH, 'a strip of pad still shows all round it');
  const cardAR = card.w / card.h, screenAR = VW / VH;
  ok(Math.abs(cardAR - screenAR) < 0.12,
    'it is screen-shaped, not square (card ' + cardAR.toFixed(2) + ' vs screen ' + screenAR.toFixed(2) + ')');
  ok(Math.abs(cardAR - 1) > 0.25, 'and it is nowhere near square');

  // 1b — IT LEAVES THE HEADER AND PART OF THE NAME SHOWING (2026-08-24,
  // Sophie: "it shud comfortably show the story room header, and part of the
  // story name"). Both are MEASUREMENTS against the real chrome behind the
  // card, not a pixel constant: the card's top edge must clear the header
  // outright and land INSIDE the name's own line, so a slice of the story's
  // name is still readable above it.
  const hdr = await box('header');
  const ttl = await box('#title');
  ok(card.y >= hdr.b, 'the card starts below the Story room header (card ' +
    Math.round(card.y) + ' vs header bottom ' + Math.round(hdr.b) + ')');
  ok(card.y > ttl.y && card.y < ttl.b, 'and cuts through the story name, so part of it shows (' +
    'name ' + Math.round(ttl.y) + '-' + Math.round(ttl.b) + ', card ' + Math.round(card.y) + ')');
  ok(card.y - ttl.y >= 12, 'with a comfortable slice of it — not a sliver');

  // 2 — the picture is big now, not the pad tile's width
  const img = await box('#popimg');
  ok(img.w > tile.w * 2, 'the picture is far bigger than its pad tile (' +
    Math.round(img.w) + 'px vs ' + Math.round(tile.w) + ')');
  ok(img.h <= card.h, 'and it still fits inside the card');
  ok(Math.abs((img.w / img.h) - (2 / 3)) < 0.06, 'it keeps its 2:3 shape');

  // 3 — the ways to art: rounded SQUARES, UNDER the picture
  ok(await shown('#artrow'), 'the art row is showing');
  const arts = ['#ardraw', '#arplay', '#arinbox'];
  for (const sel of arts) {
    const b = await box(sel);
    ok(Math.abs(b.w - b.h) < 1.5, sel + ' is a square (' + Math.round(b.w) + 'x' + Math.round(b.h) + ')');
    ok(b.y >= img.b - 1, sel + ' sits under the picture');
  }
  const rad = await page.$eval('#ardraw', (el) => getComputedStyle(el).borderRadius);
  ok(rad === '6px', 'they wear the house radius, never a pill (' + rad + ')');

  // 4 — ONE multicoloured square in the corner, dropping down
  ok(await shown('#colorbtn'), 'the colour square is showing');
  ok((await page.$$('#cardin .chip')).length === 0, 'no chip row on the card itself');
  const cb = await box('#colorbtn');
  ok(cb.r > card.r - 60 && cb.y < card.y + 60, 'it is in the top-right corner of the card');
  const fills = await page.$eval('#colorbtn svg', (svg) =>
    [...new Set([...svg.querySelectorAll('rect[fill]')].map((r) => r.getAttribute('fill')))]
      .filter((f) => f && f !== 'none'));
  ok(fills.length >= 4, 'the square really is multicoloured (' + fills.length + ' fills)');
  ok(!(await shown('#colormenu')), 'the chips are folded away until it is tapped');
  await page.click('#colorbtn');
  ok(await shown('#colormenu'), 'tapping it drops the chips down');
  await page.click('#colormenu .chip.blue');
  await page.waitForFunction(() => document.getElementById('colormenu').hidden);
  ok(posted.some(([p, b]) => p === '/api/scratchpad/color' && b.color === 'blue'), 'a chip still sets the colour');
  ok(await page.$eval('#popimg', (el) => el.className === 'c-blue'), 'and it lands on the picture');

  // 4b — HER OWN WORDS ARE ON THE CHIPS (2026-08-26, "label them in the
  // drop-down"). The words are the ones she dictated into the memo that
  // designed this pad, so they are pinned VERBATIM rather than described —
  // a reworded label is the paraphrase this repo keeps having to undo.
  // The same measurement also pins the half she corrected in 2026: the pad,
  // the beat frames and the picture still say NOTHING.
  await page.click('#colorbtn');
  await page.waitForFunction(() => !document.getElementById('colormenu').hidden);
  const chipWords = await page.$$eval('#colormenu .chip', (els) =>
    els.map((e) => e.textContent.trim()));
  ok(JSON.stringify(chipWords) ===
    JSON.stringify(['No frame', 'Examples', 'Explanations', 'The main idea', 'A bridge']),
    'each chip carries her meaning, in her order (' + chipWords.join(' · ') + ')');
  const dots = await page.$$eval('#colormenu .chip .dot', (els) =>
    els.map((e) => getComputedStyle(e).backgroundColor));
  ok(new Set(dots).size === 5, 'and every one still shows its own colour (' + dots.length + ' dots)');
  const menu = await box('#colormenu');
  ok(menu.x >= card.x && menu.r <= card.r + 1,
    'the labelled column still fits inside the card (' + Math.round(menu.w) + 'px wide)');
  const padWords = await page.$eval('#pad', (el) => el.textContent.toLowerCase());
  ok(!/examples|explanations|main idea|a bridge/.test(padWords),
    'the pad itself names none of them — the colour is still the indicator');
  const artWords = await page.$eval('#artwrap', (el) => el.textContent.toLowerCase());
  ok(!/examples|explanations|main idea|a bridge/.test(artWords),
    'and neither does the picture the colour frames');
  await page.click('#colorbtn');
  await page.waitForFunction(() => document.getElementById('colormenu').hidden);

  // 5 — past pictures behind the stacked squares
  ok(await shown('#arvers'), 'the stacked-squares button is there (this beat has history)');
  ok(!(await shown('#verrow')), 'the past pictures are folded away');
  await page.click('#arvers');
  ok(await shown('#verrow'), 'tapping it opens them');
  ok((await page.$$('#verrow button')).length === 3, 'current + two older');
  await page.click('#arvers');
  ok(!(await shown('#verrow')), 'and folds them back');

  // 6 — the two text boxes
  ok(await shown('#capview'), 'the caption is open by default');
  ok(!(await shown('#drawbox')), 'the drawing prompt is collapsed by default');
  await page.click('#promlab');
  ok(await shown('#drawbox'), 'tapping Drawing prompt opens it');
  ok(!(await shown('#capview')), 'and that automatically collapses the caption');
  await page.click('#caplab');
  ok(await shown('#capview'), 'the caption can be expanded again by hand');
  ok(await shown('#drawbox'), 'with the prompt still open beside it');

  // 6b — THE CAPTION IS WORDS PLUS A PENCIL, NOT AN OPEN BOX (2026-08-24,
  // Sophie: "the caption shows not in a edit box but default to just the ...
  // text and then there's an edit pencil button next to it").
  ok(!(await shown('#pnote')), 'the caption is NOT an open edit box');
  ok(await shown('#captext'), 'its words show as text instead');
  ok((await page.$eval('#captext', (el) => el.textContent)).includes('the beat says this'),
    'and the text really is the beat\'s caption');
  ok(await shown('#capedit'), 'a pencil sits beside them');
  const cvw = await box('#captext'), pen = await box('#capedit');
  ok(pen.x >= cvw.r - 1, 'the pencil is NEXT TO the words, not under them');
  await page.click('#capedit');
  ok(await shown('#pnote'), 'tapping the pencil swaps the box in');
  ok(!(await shown('#captext')), 'and the read-only words step aside');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'pnote'),
    'with the caret already in it');
  ok(await shown('#capedit'), 'the pencil keeps its place while she edits');
  await page.fill('#pnote', 'a caption she just wrote');
  await page.click('#capedit');
  ok(!(await shown('#pnote')), 'tapping it again puts the box away');
  ok((await page.$eval('#captext', (el) => el.textContent)) === 'a caption she just wrote',
    'and the words she wrote are what reads back');
  ok(posted.some(([p2, b2]) => p2 === '/api/scratchpad/text' && b2.text === 'a caption she just wrote'),
    'it saved on the way out — no save button');

  // 6c — A DRAW LANDING MID-TYPE MUST NOT EAT THE CAPTION (2026-08-26,
  // Sophie: "when I make an image in story room, if I'm typing in the
  // caption box, it gets rid of my caption"). The gen poll re-opens the SAME
  // beat when a picture lands, with no tap of hers — openBeat used to reset
  // #pnote to the beat's saved text, wiping everything typed since the last
  // blur. While a box holds her caret, a same-beat re-open keeps the value,
  // the pencil state and the caret; a re-open she caused HERSELF (Draw, a
  // chunk link) has already blurred and saved and still resets to the read
  // faces — the "reopening the prompt shows words" assertion below pins
  // that half.
  await page.click('#capedit');           // swap the box back in
  await page.click('#pnote');
  await page.keyboard.type(' plus words she typed while it drew');
  // The poll's re-open, verbatim: same beat, no tap of hers.
  await page.evaluate(() => window.openBeat(window.beats.find((x) => x.id === 'b1')));
  ok(await shown('#pnote'), 'a draw landing mid-type leaves the caption box open');
  ok((await page.$eval('#pnote', (el) => el.value)).includes('plus words she typed while it drew'),
    'and her typing is still in it');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'pnote'),
    'with the caret still there');
  await page.click('#capedit');           // put it away, saving
  // 7 — THE PROMPT BOX IS NOT THE CAPTION (2026-08-24, Sophie: "it sent the
  // wrong prompt. I think it sent it from the caption part not the drawing
  // part"). The box used to seed with the caption's words, so a beat with no
  // prompt of its own showed the caption in the prompt box and nothing on
  // screen told her which text a draw was about to send.
  ok(await page.$eval('#dprompt', (el) => el.value === ''),
    'a beat with no prompt of its own opens with an EMPTY prompt box');
  ok(await shown('#promhint'), 'and the hint says what an empty box will draw');
  ok(/caption/i.test(await page.$eval('#promhint', (el) => el.textContent)),
    'it names the caption by name');
  // Empty still DRAWS — from the caption as it reads right now, which is the
  // old "it doesn't take the words I put in" fix and must stay fixed.
  if (!(await shown('#pnote'))) await page.click('#capedit');
  await page.fill('#pnote', 'A RED DOOR IN THE SNOW');
  await page.click('#dgo');
  await page.waitForTimeout(300);
  let gen = posted.filter(([p]) => p === '/api/scratchpad/generate');
  ok(gen.length === 1 && gen[0][1].prompt === 'A RED DOOR IN THE SNOW',
    'an empty box draws the caption LIVE, not its last saved text');

  // 7b — THE PROMPT READS AS WORDS TOO (2026-08-26, Sophie: "can you make the
  // default for the caption in the drawing prompt? that they're not in a edit
  // text box and that I press the pencil to edit them"). The caption's rule,
  // on the box beside it.
  await page.waitForSelector('#beatpop:not([hidden])');
  if (await page.$eval('#drawbox', (el) => el.hidden)) await page.click('#promlab');
  ok(!(await shown('#dprompt')), 'the drawing prompt is NOT an open edit box');
  ok(await shown('#promtext'), 'its words show as text instead');
  ok(await shown('#promedit'), 'a pencil sits beside them');
  const pvw = await box('#promtext'), ppen = await box('#promedit');
  ok(ppen.x >= pvw.r - 1, 'the pencil is NEXT TO the words, not under them');
  await page.click('#promedit');
  ok(await shown('#dprompt'), 'tapping the pencil swaps the box in');
  ok(!(await shown('#promtext')), 'and the read-only words step aside');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'dprompt'),
    'with the caret already in it');

  // Her own prompt wins, and the hint goes away the moment she types one.
  await page.fill('#dprompt', 'MY OWN DRAWING PROMPT');
  await page.waitForFunction(() => document.getElementById('promhint').hidden);
  ok(true, 'the hint clears as soon as the box has words');
  await page.click('#dgo');
  await page.waitForTimeout(300);
  gen = posted.filter(([p]) => p === '/api/scratchpad/generate');
  ok(gen.length === 2 && gen[1][1].prompt === 'MY OWN DRAWING PROMPT',
    'a written prompt is what gets drawn, never the caption');
  ok(posted.some(([p, b]) => p === '/api/scratchpad/prompt' && b.prompt === 'MY OWN DRAWING PROMPT'),
    'and it saved itself on the way');

  // 7c — A STALE SNAPSHOT MUST NEVER BE SAVED BACK (2026-08-26, Sophie: "it
  // doesn't have my last version of the drawing prompt … it reverted back to
  // an old one"). The Draw handler used to fire savePrompt and /generate
  // loose: /generate could read the pad BEFORE the save committed, its
  // response re-opened the beat and reset the box to the OLD prompt, the
  // save's own response then updated popBeat to the NEW one — and the next
  // blur/close saved the OLD box back over the prompt she had already drawn
  // with. Two guards, both pinned: the saves land before /generate is asked,
  // and a save only ever sends words SHE changed — a box the PAGE wrote is
  // baselined and never posted back.
  const pIdx = posted.findIndex(([p, b]) => p === '/api/scratchpad/prompt' && b.prompt === 'MY OWN DRAWING PROMPT');
  const gIdx = posted.findIndex(([p, b]) => p === '/api/scratchpad/generate' && b.prompt === 'MY OWN DRAWING PROMPT');
  ok(pIdx >= 0 && gIdx >= 0 && pIdx < gIdx,
    'the prompt save reaches the server BEFORE the draw is asked for');
  const preStale = posted.length;
  await page.evaluate(() => {
    // The race's aftermath, verbatim. The beat is MID-DRAW (that is her
    // scenario — she had just used the prompt to make images), so `noart`
    // keeps the drawing box OPEN through the re-open; a stale snapshot
    // resets the box to the OLD prompt…
    const stale = Object.assign({}, window.beats.find((x) => x.id === 'b1'),
      { prompt: 'THE STALE OLD PROMPT',
        gen: { status: 'drawing', prompt: 'x', at: Date.now() } });
    window.openBeat(stale);
    // …and the save's own response then lands, so popBeat carries her NEW
    // prompt while the box still shows the old one.
    window.popBeat = window.beats.find((x) => x.id === 'b1');
  });
  ok(!(await page.$eval('#drawbox', (el) => el.hidden)),
    'mid-draw the drawing box is open — the state the revert needed');
  ok((await page.$eval('#dprompt', (el) => el.value)) === 'THE STALE OLD PROMPT',
    'and the stale repaint really did reset the box');
  await page.evaluate(() => window.closeBeat());
  await page.waitForTimeout(200);
  ok(!posted.slice(preStale).some(([p, b]) => p === '/api/scratchpad/prompt' && /STALE/.test(b.prompt || '')),
    'closing after a stale repaint saves NOTHING back — the revert is dead');
  ok((await page.evaluate(() => window.beats.find((x) => x.id === 'b1').prompt)) === 'MY OWN DRAWING PROMPT',
    'her last version is still the one on the beat');
  // Put the popup back the way section 8 expects it: open on b1.
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  // Drawing re-opens the beat, so the prompt is back to its read face — the
  // words she wrote, not the box she wrote them in.
  await page.waitForSelector('#beatpop:not([hidden])');
  if (await page.$eval('#drawbox', (el) => el.hidden)) await page.click('#promlab');
  ok(!(await shown('#dprompt')), 'reopening the prompt shows words, never the box');
  ok((await page.$eval('#promtext', (el) => el.textContent))
    === (await page.$eval('#dprompt', (el) => el.value)),
    'and the words read back are exactly what the box holds');
  // The STAR is the one way in that skips the pencil — "draw it here" is her
  // saying she wants to write the prompt.
  await page.click('#ardraw');
  ok(await shown('#dprompt'), 'the star opens straight into the box');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'dprompt'),
    'with the caret in it');
  await page.click('#promlab');
  await page.click('#promlab');
  ok(!(await shown('#dprompt')), 'folding the prompt away and back puts it back to words');

  // 8 — A BEAT WITH NO PICTURE (2026-08-24, Sophie: "if there's no image then
  // make the image box smaller / and show the caption and the drawing prompt
  // by default instead of just the caption"). Both halves MEASURED against
  // the same card with a picture in it, because "smaller" is a comparison.
  const artH = (await box('#artwrap')).h;
  await page.evaluate(() => window.closeBeat());
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);
  await page.evaluate(() => {
    window.beats.push({ id: 'b2', text: 'a beat with nothing drawn yet', color: null });
    window.render();
  });
  await page.waitForFunction(() => document.querySelectorAll('#pad .beat').length > 1);
  await page.evaluate(() => {
    const b = window.beats.find((x) => x.id === 'b2');
    window.openBeat(b);
  });
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(await shown('#popblank'), 'the blank paper is what shows');
  ok(!(await shown('#popimg')), 'and no picture');
  const blank = await box('#popblank'), wrap = await box('#artwrap');
  ok(blank.h < 200, 'the empty tile is small (' + Math.round(blank.h) + 'px tall)');
  ok(wrap.h < artH * 0.6, 'the image box gave its room back (' +
    Math.round(wrap.h) + 'px vs ' + Math.round(artH) + ' with a picture)');
  ok(await shown('#capview'), 'the caption shows');
  ok(await shown('#drawbox'), 'AND the drawing prompt is open beside it, not folded away');
  ok(!(await shown('#pnote')), 'the caption is still words-plus-pencil here too');
  ok(!(await shown('#dprompt')) && (await shown('#promtext')),
    'and so is the drawing prompt — neither opens as a box');
  ok((await box('#drawbox')).b <= (await box('#beatcard')).b + 1,
    'both boxes fit inside the card');

  // 8 — THE DRAW ROW (2026-08-26, Sophie: "can you make the draw button the
  // stars logo we use for generate and can you change the default to low
  // instead of medium and can you make the three-way toggle for the quality
  // instead of the drop-down"). The drawing box is already open on this
  // picture-less beat, which is where she reads it.
  ok(await shown('#dgo'), 'the Draw button is showing');
  // ONE generate glyph: it is the SAME drawing as the art row's star, compared
  // as markup rather than against a path copied into this test — a second copy
  // anywhere is what the house rule exists to stop.
  const [drawSvg, artSvg] = await page.evaluate(() => [
    document.getElementById('dgo').innerHTML.trim(),
    document.getElementById('ardraw').innerHTML.trim(),
  ]);
  ok(drawSvg === artSvg, 'Draw wears the house generate star, the same one #ardraw does');
  ok(!/[A-Za-z]/.test(await page.$eval('#dgo', (el) => el.textContent)),
    'and it is the glyph alone — the word "Draw" is gone');
  const dgo = await box('#dgo');
  ok(Math.abs(dgo.w - dgo.h) < 1.5,
    'it is a square (' + Math.round(dgo.w) + 'x' + Math.round(dgo.h) + ')');
  ok(await page.$eval('#dgo', (el) => getComputedStyle(el).borderRadius) === '6px',
    'at the house radius, never a pill');

  // The quality is the shared three-way toggle, and it opens on LOW.
  const qTag = await page.$eval('#dq', (el) => el.tagName + '.' + el.className);
  ok(qTag === 'BUTTON.tri', 'quality is the shared .tri toggle, not a <select> (' + qTag + ')');
  ok(await page.$eval('#dq', (el) => el.dataset.n) === '0'
    && await page.$eval('#dq', (el) => el.dataset.i) === 'L',
    'it opens on LOW');
  ok(await page.$eval('#bq', (el) => el.dataset.n) === '0',
    'and so does the draw-them-all one');
  // The shell really loaded: a missing /tritoggle.css renders it as a sliver.
  const qb = await box('#dq');
  ok(qb.w > 60 && qb.h > 25,
    'the shell is on it (' + Math.round(qb.w) + 'x' + Math.round(qb.h) + ')');
  // WHERE SHE TAPPED IS THE STOP SHE MEANT — a POSITION, not the element:
  // playwright aims at an element's centre, where a cycle and an aim agree.
  await page.mouse.click(qb.x + qb.w * 0.85, qb.y + qb.h / 2);
  ok(await page.$eval('#dq', (el) => el.dataset.i) === 'H', 'a tap on the right lands on HIGH');
  await page.mouse.click(qb.x + qb.w * 0.5, qb.y + qb.h / 2);
  ok(await page.$eval('#dq', (el) => el.dataset.i) === 'M', 'the middle stop is reachable in one tap');
  await page.mouse.click(qb.x + qb.w * 0.15, qb.y + qb.h / 2);
  ok(await page.$eval('#dq', (el) => el.dataset.i) === 'L', 'and back to LOW, never a cycle');

  // What the toggle says is what the draw spends. Draw now lands its saves
  // BEFORE asking /generate, so give the chain a beat to reach the server.
  await page.click('#dgo');
  await page.waitForTimeout(300);
  const drew = posted.filter(([p]) => p === '/api/scratchpad/generate').pop();
  ok(drew && drew[1].quality === 'low', 'Draw sends the quality on the knob (' +
    (drew ? drew[1].quality : 'nothing posted') + ')');

  // 10 — THE BIGGER BOX, ON BOTH (2026-08-26, Sophie: "make it possible to open
  // the caption and the drawing prompt in bigger boxes so I can edit them but
  // don't make that the default"). Every assertion here is a MEASUREMENT: a
  // toggle that swaps a class is trivially "working" while the box on screen
  // is the same three rows, and a corner button that reads as visible can
  // still be sitting under nothing she can tap.
  // Both boxes read as WORDS until a pencil is tapped (2026-08-26), so the
  // bigger-box button belongs to the EDIT box and comes in with the pencil.
  ok(!(await shown('#dpromptbig')), 'no bigger-box button while the prompt reads as words');
  await page.click('#promedit');
  ok(await shown('#dpromptbig'), 'the pencil brings the box AND its button in');
  const dSmall = (await box('#dprompt')).h;
  ok(!(await page.$eval('#dprompt', (el) => el.classList.contains('big'))),
    'and it is NOT big by default');
  // The button is inside the box's own bottom-right corner — measured, and
  // asked with elementFromPoint, the only honest way to know a tap reaches it.
  const dBox = await box('#dprompt'), dBtn = await box('#dpromptbig');
  ok(dBtn.r <= dBox.r && dBtn.b <= dBox.b && dBtn.x > dBox.x + dBox.w / 2,
    'the button sits INSIDE the box\'s bottom-right corner');
  const hits = await page.evaluate(() => {
    const b = document.getElementById('dpromptbig').getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    // The glyph is an SVG child of the button, so closest() is the question.
    return el && el.closest && el.closest('#dpromptbig') ? 'ok'
      : 'BLOCKED-by-' + (el && (el.id || el.tagName));
  });
  ok(hits === 'ok', 'and a tap on it really reaches it (' + hits + ')');
  // Her last line must never be typed under the button.
  const pad = await page.$eval('#dprompt', (el) =>
    parseFloat(getComputedStyle(el).paddingBottom));
  ok(pad >= dBtn.h + 6, 'the box reserves that corner (' + Math.round(pad) +
    'px of padding under ' + Math.round(dBtn.h) + 'px of button)');
  await page.click('#dpromptbig');
  const dBig = (await box('#dprompt')).h;
  ok(dBig > dSmall, 'tapping it really makes the box bigger (' +
    Math.round(dSmall) + ' → ' + Math.round(dBig) + 'px)');
  // The card is a SCROLLER, so the honest question is not whether the box fits
  // under everything else — it is whether she is looking at it after the tap.
  // Measure how much of it shows inside #cardin's own visible box.
  const seen = await page.evaluate(() => {
    const s = document.getElementById('cardin').getBoundingClientRect();
    const t = document.getElementById('dprompt').getBoundingClientRect();
    return Math.min(s.bottom, t.bottom) - Math.max(s.top, t.top);
  });
  ok(seen > 150, 'and the tap leaves her looking at it (' + Math.round(seen) +
    'px of the big box in view)');

  // IT FITS THE WORDS, IT IS NOT A FIXED SIZE (2026-08-27, Sophie: "why not
  // expand based on text, not static"). A flat height is what this replaces,
  // so the assertion that matters is that a SHORT box and a LONG one open at
  // DIFFERENT heights — a check against one number passes against either.
  const floor = await page.evaluate(() => Math.round(innerHeight * 0.24));
  const cap = await page.evaluate(() => Math.round(innerHeight * 0.46));
  ok(Math.abs(dBig - floor) <= 3, 'an EMPTY prompt still opens to the floor — ' +
    'these are fields she writes IN (' + Math.round(dBig) + 'px, floor ' + floor + ')');
  const dGrown = await page.evaluate(() => {
    const t = document.getElementById('dprompt');
    t.value = new Array(40).join('a red door in the snow, and the light behind it. ');
    t.dispatchEvent(new Event('input'));
    return t.getBoundingClientRect().height;
  });
  ok(dGrown > dBig, 'a long prompt opens taller than a short one (' +
    Math.round(dBig) + ' → ' + Math.round(dGrown) + 'px)');
  ok(Math.abs(dGrown - cap) <= 3, 'and stops at the cap (' + Math.round(dGrown) + 'px)');
  // The `height:auto` reset is the whole of this one: scrollHeight on a box
  // already sized to its old height reports that height, so without it the box
  // can only ever grow.
  const dShrunk = await page.evaluate(() => {
    const t = document.getElementById('dprompt');
    t.value = '';
    t.dispatchEvent(new Event('input'));
    return t.getBoundingClientRect().height;
  });
  ok(dShrunk < dGrown - 20, 'and it shrinks back when she deletes it (' +
    Math.round(dGrown) + ' → ' + Math.round(dShrunk) + 'px)');

  await page.click('#dpromptbig');
  ok(Math.abs((await box('#dprompt')).h - dSmall) < 2, 'tapping it again shrinks it back');

  // The caption's copy lives with the EDIT box, so it comes and goes with it.
  ok(!(await shown('#pnotebig')), 'the caption shows no bigger-box button while it reads as words');
  await page.click('#capedit');
  ok(await shown('#pnotebig'), 'the pencil brings the box AND its button in');
  const cSmall = (await box('#pnote')).h;
  await page.click('#pnotebig');
  const cBig = (await box('#pnote')).h;
  ok(cBig > cSmall, 'the caption box opens bigger too (' +
    Math.round(cSmall) + ' → ' + Math.round(cBig) + 'px)');
  ok(await page.$eval('#pnote', (el) => el.value === 'A RED DOOR IN THE SNOW' ||
    typeof el.value === 'string'), 'and it is the SAME textarea — nothing to sync');

  // NOT THE DEFAULT means not sticky either: the next card opens small.
  await page.evaluate(() => window.closeBeat());
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(!(await page.$eval('#dprompt', (el) => el.classList.contains('big'))),
    'opening a card again puts the prompt box back small');
  ok(!(await page.$eval('#pnote', (el) => el.classList.contains('big'))),
    'and the caption box with it');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

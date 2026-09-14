#!/usr/bin/env node
// THE STORY ROOM'S LIGHTBOX SAYS WHAT DREW THE PICTURE (2026-09-06, Sophie:
// "the prompt, when things get drawn in the story room - does it get attached.
// i don't see 'prompt' at the top w style and content, nor model - it's not
// like the other light boxes. it shud be").
//
// The beat had stored all of it since the pad first drew — `src` carries her
// words, the exact text that was sent (`promptUsed`), the model and the
// quality, and since this fix the canvas — and the page handed the shared
// lightbox nothing but the url. So the Prompt door, the Style|Content pair
// and the MODEL · QUALITY · SIZE line every other surface shows were missing
// on exactly the pictures this page makes.
//
// Every assertion is a MEASUREMENT of the rendered box: a door that exists in
// no DOM and a caption that never renders look identical to any source
// assertion. Three pictures on one beat, one of each provenance:
//   the CURRENT one — drawn by the pad (words + sent text + model + quality +
//     canvas) → door with both halves, content first, `[content]` seam in the
//     style half, caption `gpt-image-2 · low · 1K`;
//   an OLDER one picked out of the Playground inbox (its src carries the run's
//     words, model and quality, NOT its wrapper) → door with the words alone,
//     no Style|Content pair, caption with no size slot — nothing invented;
//   an OLDER one with no provenance at all → no door, no caption line.
// And the door's state rides a STEP (open on one, still open on the next) and
// dies with a fresh open.
//
//   node scripts/test-storyroom-lightbox-prompt.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

function png(r, g, b) {
  const w = 400, h = 600;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = r; raw[row + 2 + x * 3] = g; raw[row + 3 + x * 3] = b;
    }
  }
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PIC = png(180, 140, 90);

const CUR = '/px.png?cur', PL = '/px.png?pl', BARE = '/px.png?bare';
const WORDS = 'a fox asleep in a snowdrift';
const PREFIX = 'Copy the drawing style of the attached reference exactly.';
const SUFFIX = 'Do not draw its content.';
const beats = [{
  id: 'b1', url: CUR, text: 'the fox beat', color: null,
  // What the pad's own draw stores (scratchpad.js, swapArt's src).
  src: { engine: 'gptimage', model: 'gpt-image-2', prompt: WORDS, quality: 'low',
    promptUsed: PREFIX + '\n\n' + WORDS + '\n\n' + SUFFIX, canvas: '1024x1536',
    characters: ['Mason'] },
  imageHistory: [
    // banked with NO provenance (a phone upload, or a version from before src)
    { url: BARE, at: 1 },
    // a Playground inbox pick: the run's words, model, quality — no wrapper
    { url: PL, at: 2, src: { runId: 'r1', i: 0, prompt: 'a fox in a bowler hat',
      model: 'gpt-image-2', engine: 'gptimage', quality: 'medium' } },
  ],
}];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => json({ ok: true, beats }));
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'prompt test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/scratchpad-sophie.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PIC);
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

(async () => {
  // SOURCE PIN: the server records the canvas on a draw's provenance, which is
  // the only honest source for the caption's third slot.
  const srv = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
  ok(/swapArt\(slot, url, \{[\s\S]*?canvas: canvas\.size,[\s\S]*?\}\)/.test(srv),
    'scratchpad.js stamps the canvas onto the draw\'s src');
  const gen = fs.readFileSync(path.join(__dirname, 'gen-scratchpad.py'), 'utf8');
  ok(/<script src="\/size-tier\.js"><\/script>/.test(gen), 'the page loads /size-tier.js — the tier is derived, never a table here');
  ok(!/['"]1K['"]/.test(gen.slice(gen.indexOf('function lbAssetFor'), gen.indexOf('function openLbAt'))),
    'and lbAssetFor hardcodes no tier');

  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beat');

  const waitLbOpen = () => page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display === 'flex';
  });
  const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  const text = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? (el.textContent || '').trim() : null; }, sel);
  const shown = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s); if (!el) return false;
    const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0;
  }, sel);
  const at = () => page.$eval('#clightbox img', (el) => new URL(el.src).search);
  const waitAt = (q) => page.waitForFunction((want) => {
    const im = document.querySelector('#clightbox img');
    return im && new URL(im.src).search === want && im.getBoundingClientRect().height > 0;
  }, q);
  // The MODEL · QUALITY · SIZE line: the shared lightbox draws it as .cltag over
  // a label, or as the caption row itself (.clcap) when — like the Playground —
  // the caller passes no label. Either is the line; read whichever rendered.
  const capLine = () => page.evaluate(() => {
    const el = document.querySelector('#clightbox .cltag') || document.querySelector('#clightbox .clcap');
    return el ? (el.textContent || '').trim() : null;
  });
  // A STEP BY THE ZONE'S OWN HANDLER. The words overlay sits ABOVE the zones
  // by design (a tap on the words puts them away, never steps), so with the
  // door open a pointer cannot reach a zone — the carry is asked of the
  // handler directly. The pointer path is test-storyroom-lightbox-nav.js's.
  const stepJs = (which) => page.evaluate((w) => { document.querySelector('#clightbox .lbzone.' + w).click(); }, which);
  const box = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  });

  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.waitForFunction(() => {
    const im = document.getElementById('popimg');
    return im && !im.hidden && im.getBoundingClientRect().width > 0;
  });
  await page.click('#popimg');
  await waitLbOpen();
  ok(await at() === '?cur', 'opens on the beat\'s own picture');

  // ── THE PAD-DRAWN PICTURE: the door, both halves, the full caption ──────
  ok(await shown('#clightbox .promptbtn'), 'a Prompt button is drawn (the shared lightbox\'s own door)');
  ok(await text('#clightbox .promptbtn') === 'Prompt', 'and it says Prompt');
  const pb = await box('#clightbox .promptbtn'), im0 = await box('#clightbox img');
  ok(pb.b <= im0.y + 1, 'the door sits ABOVE the picture, at the top like the other lightboxes (' + Math.round(pb.b) + ' vs ' + Math.round(im0.y) + ')');
  ok(await capLine() === 'gpt-image-2 · low · 1K',
    'the MODEL · QUALITY · SIZE line reads what the record says: ' + JSON.stringify(await capLine()));
  ok(!(await shown('#clightbox .lbp')), 'the words are shut on a fresh open');
  await page.click('#clightbox .promptbtn');
  ok(await shown('#clightbox .lbp'), 'tapping Prompt opens them');
  ok(await shown('#clightbox .lbptog'), 'with the Style | Content pair');
  ok(await page.$eval('#clightbox .lbptog button.on', (el) => el.textContent) === 'Content', 'content is the side it opens on');
  ok(await text('#clightbox .lbptext') === WORDS, 'the content half is her words, verbatim');
  await page.click('#clightbox .lbptog button:first-child');
  const styleTxt = await text('#clightbox .lbptext');
  ok(styleTxt === PREFIX + '\n\n[content]\n\n' + SUFFIX,
    'the style half is the exact sent text with her words cut out and [content] at the seam: ' + JSON.stringify(styleTxt));
  ok(await text('#clightbox .clcast') === 'Mason', 'and the character that rode the draw is named under the caption');
  ok(await has('#clightbox .lbcta') === false, 'the current picture still offers no Use button');

  // ── A STEP carries the door's state; the Playground pick shows the words alone
  ok(await has('#clightbox .lbzone.next'), 'there is a way onward');
  await stepJs('next');
  await waitAt('?pl');
  ok(await shown('#clightbox .lbp'), 'the open door rides the step');
  ok(!(await shown('#clightbox .lbptog')), 'a picture with only its words shows no Style | Content pair');
  ok(await text('#clightbox .lbptext') === 'a fox in a bowler hat', 'the words are the run\'s, from the pick\'s own src');
  ok(await capLine() === 'gpt-image-2 · medium',
    'its caption carries model and quality and NO size slot — nothing the record does not say: ' + JSON.stringify(await capLine()));
  ok(await has('#clightbox .lbcta'), 'an older picture carries Use this one');

  // ── NO PROVENANCE: no door, no line — the Assets tab's silence ──────────
  await stepJs('next');
  await waitAt('?bare');
  ok(!(await has('#clightbox .promptbtn')), 'a picture with no provenance draws no Prompt button');
  ok(!(await has('#clightbox .cltag')) && !(await has('#clightbox .clcap')), 'and no caption line is invented for it');

  // ── back to the first: its own record, the side she picked still lit ────
  await stepJs('prev');
  await waitAt('?pl');
  await stepJs('prev');
  await waitAt('?cur');
  ok(await capLine() === 'gpt-image-2 · low · 1K', 'stepping back finds the first picture\'s own record again');
  ok(await shown('#clightbox .lbp'), 'the door is still open after the round trip');
  ok(await page.$eval('#clightbox .lbptog button.on', (el) => el.textContent) === 'Style',
    'and the STYLE side she picked rode along through pictures that had no style half');
  // a FRESH open starts shut, on content
  await page.mouse.click(4, 4);   // dead space closes
  await page.waitForFunction(() => document.getElementById('clightbox').style.display !== 'flex');
  await page.click('#popimg');
  await waitLbOpen();
  ok(!(await shown('#clightbox .lbp')), 'a fresh open starts with the words shut again');
  await page.click('#clightbox .promptbtn');
  ok(await page.$eval('#clightbox .lbptog button.on', (el) => el.textContent) === 'Content', 'and on content');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

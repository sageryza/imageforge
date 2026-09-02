#!/usr/bin/env node
// TAP TO NEXT ON ASSETS — the chat's Assets tab AND Meta Assets, in one sweep
// (2026-08-31, Sophie: "add tap to next on assets like playground").
//
// The zones themselves are the SHARED lightbox's `nav` hook and are already
// pinned by test-storyroom-lightbox-nav / test-playground-liked-arrows. What
// is new here is what each assets surface tells it comes next, so that is
// what this measures:
//   1. the middle picture draws BOTH zones; the ENDS draw only the one they
//      have (a null side draws nothing, so a tap there closes like any other
//      dead space — asked with elementFromPoint, the only honest way);
//   2. a tap on the next zone really STEPS — a different picture, a different
//      caption, without leaving the lightbox;
//   3. THE ORDER IS THE GRID SHE IS LOOKING AT: with the ♥ filter lit, the
//      walk skips the unhearted tile in between by itself, because it reads
//      the tiles still on screen rather than a second copy of the filter;
//   4. the picture she stepped TO is the live one — its ♥ posts that url;
//   5. the prompt door rides a STEP and dies with a fresh open (the shared
//      file's rule; these items are long-lived objects the lightbox writes
//      onto, so a fresh open has to clear what the last visit left there).
//
// BOTH PAGES, one file, because that is exactly the drift she has caught
// before ("it's not in meta assets?").
//
//   node scripts/test-assets-tap-next.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// A REAL-SIZED 2:3 picture — the lightbox sizes its zones to the ART, so a
// 1x1 pixel would put them nowhere near it (the Story Room test's lesson).
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

// Four pictures, filing order. The MIDDLE two differ by vote so the ♥ filter
// has something real to skip: one · TWO(♥) · three · FOUR(♥).
const CHAT = 'evan-film';
const ASSETS = [
  { chat: CHAT, name: 'Evan', url: '/px.png?one', description: 'one — the window',
    prompt: 'gpt-image-2 · medium · 2K', promptContent: 'a man at a window',
    promptStyle: 'wtr watercolor drawing', created: iso(T0 - 1000) },
  { chat: CHAT, name: 'Evan', url: '/px.png?two', description: 'two — the corridor',
    prompt: 'gpt-image-2 · medium · 2K', promptContent: 'a lit corridor',
    promptStyle: 'wtr watercolor drawing', vote: 'like', created: iso(T0 - 2000) },
  { chat: CHAT, name: 'Evan', url: '/px.png?three', description: 'three — the car',
    prompt: 'gpt-image-2 · low · 1K', promptContent: 'a car in the rain',
    promptStyle: 'wtr watercolor drawing', created: iso(T0 - 3000) },
  { chat: CHAT, name: 'Evan', url: '/px.png?four', description: 'four — the field',
    prompt: 'gpt-image-2 · low · 1K', promptContent: 'a field at dusk',
    promptStyle: 'wtr watercolor drawing', vote: 'like', created: iso(T0 - 4000) },
];

const votes = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;          // /asset-lightbox.js, /feedkit.js, …
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/px.png' || url.pathname === '/api/story/thumb') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PIC);
  }
  if (url.pathname === '/api/gallery/assets/vote' && req.method === 'POST') {
    let body = ''; req.on('data', (d) => { body += d; });
    return req.on('end', () => { votes.push(JSON.parse(body)); json({ ok: true }); });
  }
  if (url.pathname === '/api/gallery/assets' || url.pathname === '/api/gallery/assets/all') {
    // a deep copy per request: the pages write onto their items
    const a = JSON.parse(JSON.stringify(ASSETS));
    return json({ assets: a, total: a.length, offset: 0, limit: 300 });
  }
  if (url.pathname === '/api/chatfeed') {
    return json({
      build: 'test', settings: {}, truncated: [], delta: false,
      messages: [{ id: 'm1', chat: CHAT, from: 'claude', text: 'four pictures up',
        tldr: 'four up', created: iso(T0 - 500), postedAt: iso(T0 - 500) }],
      chats: { [CHAT]: { lastSeen: iso(T0 - 500), displayName: 'Evan' } },
    });
  }
  if (url.pathname === '/chats' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  if (url.pathname === '/assets') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'assets.html'), 'utf8'));
  }
  if (req.method === 'POST') {
    let body = ''; req.on('data', () => {}); return req.on('end', () => json({ ok: true }));
  }
  json({});
});

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // ── the questions this asks of a page, whichever page it is ──────────────
  const capOf = () => page.evaluate(() => {
    const c = document.querySelector('#clightbox .clcap');
    return c ? c.textContent : '';
  });
  const zones = () => page.evaluate(() => ({
    prev: !!document.querySelector('#clightbox .lbzone.prev'),
    next: !!document.querySelector('#clightbox .lbzone.next'),
  }));
  const isOpen = () => page.evaluate(() => {
    const el = document.getElementById('clightbox');
    return !!el && el.style.display !== 'none' && el.style.display !== '';
  });
  const tapZone = (side) => page.click('#clightbox .lbzone.' + side);
  // A tap where the missing zone WOULD be. elementFromPoint first, because a
  // covered control passes every width assertion ever written about it.
  const tapDead = (side) => page.evaluate((s) => {
    const im = document.querySelector('#clightbox .clwrap img');
    const r = im.getBoundingClientRect();
    const x = s === 'prev' ? r.left + r.width * 0.08 : r.right - r.width * 0.08;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    return hit === im ? 'img' : (hit.className || hit.tagName);
  }, side);
  const closeLb = () => page.evaluate(() => {
    if (window.__assetLightboxClose) window.__assetLightboxClose();
  });
  // Open the Nth tile FROM A CLOSED BOX — the open lightbox covers the grid,
  // so a test that forgets to close first is clicking through nothing.
  const openTile = async (n) => {
    await closeLb();
    await page.click('.assetgrid .acell:nth-child(' + n + ') > button:not(.vote)');
    await page.waitForSelector('#clightbox .clwrap img');
  };
  // Every tile on screen, in the order the walk should take them.
  const shownCaps = () => page.evaluate(() => Array.prototype.filter
    .call(document.querySelectorAll('.assetgrid .acell'), (c) => c.style.display !== 'none')
    .map((c) => { const l = c.querySelector('.lbl'); return l ? l.textContent : ''; }));

  async function sweep(label, open) {
    console.log('\n── ' + label + ' ──');
    await open();
    const caps = await shownCaps();
    ok(caps.length === 4, label + ': the grid drew all four tiles');

    // 1. the ends draw only the zone they have; the middle draws both
    await openTile(1);
    let z = await zones();
    ok(!z.prev && z.next, label + ': the FIRST picture draws no prev zone');
    await openTile(2);
    z = await zones();
    ok(z.prev && z.next, label + ': a middle picture draws both zones');

    // 2. tapping next really steps — a different picture, no close
    let before = await capOf();
    await tapZone('next');
    let after = await capOf();
    ok(after && after !== before, label + ': tapping the next zone steps to another picture ('
      + before + ' → ' + after + ')');
    ok(after === 'three — the car', label + ': it steps to the tile that is actually next on screen');
    ok(await isOpen(), label + ': stepping never leaves the lightbox');
    await tapZone('prev');
    ok(await capOf() === before, label + ': the prev zone steps back');

    // 1b. the LAST picture has no next zone at all, so a tap out there steps
    //     nowhere — it lands on the picture, which is on the shared close
    //     skip list everywhere (never a step off the end of the walk).
    await openTile(4);
    z = await zones();
    ok(z.prev && !z.next, label + ': the LAST picture draws no next zone');
    const hit = await tapDead('next');
    ok(hit === 'img', label + ': past the end there is no zone under her thumb');
    ok(await capOf() === 'four — the field', label + ': …so the tap steps nowhere');
    ok(await isOpen(), label + ': …and the picture keeps the box open, as everywhere');

    // 5. THE PROMPT DOOR. The half she picked rides a STEP; a FRESH open
    //    starts shut and on content. The door itself cannot be open ACROSS a
    //    step — `.lbp` covers the picture above the zones by design — so the
    //    honest question is what the next picture opens on.
    await openTile(2);
    await page.click('#clightbox .promptbtn');
    ok(await page.$eval('#clightbox .lbp', (n) => n.style.display !== 'none'),
      label + ': the prompt door opens');
    await page.click('#clightbox .lbp .lbptog button:nth-child(1)');   // Style
    await page.click('#clightbox .promptbtn');                         // shut it again
    await tapZone('next');
    await page.click('#clightbox .promptbtn');
    ok(await page.$eval('#clightbox .lbp .lbptext', (n) => /watercolor/.test(n.textContent)),
      label + ': the half she picked rides the step');
    await openTile(2);
    ok(await page.$eval('#clightbox .lbp', (n) => n.style.display === 'none'),
      label + ': a FRESH open starts with the door shut again');
    await page.click('#clightbox .promptbtn');
    ok(await page.$eval('#clightbox .lbp .lbptext', (n) => /a lit corridor/.test(n.textContent)),
      label + ': …and on content, whatever she picked last time');
    await closeLb();

    // 3. the ORDER is what is on screen — light ♥ and the walk skips the rest
    // The ♥ lives inside the filters drawer on BOTH pages since 2026-09-02
    // (/searchfilters.js) — open it, tap the chip.
    await page.click('.arow .filtchip');
    await page.waitForSelector('.arow .filtdrawer:not([hidden])');
    await page.click('.arow .filtcbtn[data-v="like"]');
    const lit = await shownCaps();
    ok(lit.length === 2 && lit[0] === 'two — the corridor',
      label + ': the ♥ filter leaves two tiles on screen');
    await openTile(2);
    z = await zones();
    ok(!z.prev && z.next, label + ': the first HEARTED picture is now the start of the walk');
    before = await capOf();
    await tapZone('next');
    after = await capOf();
    ok(after === 'four — the field',
      label + ': the walk skips the filtered-out tile in between (' + before + ' → ' + after + ')');
    z = await zones();
    ok(z.prev && !z.next, label + ': …and that is the end of the filtered walk');

    // 4. the picture she stepped TO is the live one — its ♥ posts THAT url
    votes.length = 0;
    await page.click('#clightbox .lbacts .vote.heart');
    await page.waitForTimeout(150);
    ok(votes.length === 1 && /four/.test(votes[0].url || ''),
      label + ': ♥ after a step casts on the picture she stepped to');
    await closeLb();
  }

  await sweep('Assets tab', async () => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="' + CHAT + '"]');
    await page.click('#grid .crow[data-chat="' + CHAT + '"]');
    await page.click('.tg-assets');
    await page.waitForSelector('.assetgrid .acell');
  });

  await sweep('Meta Assets', async () => {
    await page.goto(base + '/assets');
    await page.waitForSelector('.assetgrid .acell');
  });

  // A SOURCE PIN: neither page may grow its own zones — the walk is the
  // shared file's `nav` hook, and a page drawing its own is the fourth copy
  // this whole lightbox exists to prevent.
  ['chats.html', 'assets.html'].forEach((f) => {
    const src = fs.readFileSync(path.join(PUB, f), 'utf8');
    ok(/it\.nav\s*=/.test(src), f + ' hands the shared lightbox a nav hook');
    ok(!/lbzone/.test(src), f + ' draws no step zones of its own');
  });

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

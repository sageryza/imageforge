#!/usr/bin/env node
// THE DOORS UNDER A PICTURE — one set, on both assets surfaces
// (2026-08-31, Sophie: "why the fuck different buttons in assets ex no
// playground button").
//
// The LIGHTBOX has been one shared file since 2026-08-28. The BUTTONS were
// not: `actions` is a hook and every caller hand-wrote its own array, so the
// surface she reviews EVERY picture in — the chat's own Assets tab — had NONE.
// /asset-actions.js is the shared set now, and this is what keeps it shared.
//
// EVERY ASSERTION IS A MEASUREMENT OF THE REAL PAGE, because the failure mode
// here is a door that is missing or that goes somewhere else, and both look
// perfectly fine to any markup assertion: a `location.href` is only honest if
// you read the url the tap really produced, and a Shoebox POST is only honest
// if the server saw it.
//
//   node scripts/test-asset-doors.js
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

// A REAL-SIZED 2:3 picture — the lightbox sizes itself to the ART, so a 1x1
// pixel puts the row nowhere near where it really sits.
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); raw[row] = 0;
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = 180; raw[row + 2 + x * 3] = 140; raw[row + 3 + x * 3] = 90;
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
const PIC = png(400, 600);

// TWO pictures on purpose: one with its exact prompt on file (the Playground
// door PORTS it) and one with nothing filed (the door has nothing to port
// honestly, so the picture itself rides as the photo reference).
const CHAT = 'evan-film';
const ASSETS = [
  { chat: CHAT, name: 'Evan', url: '/px.png?one', description: 'one — the window',
    prompt: 'gpt-image-2 · medium · 2K', promptContent: 'a man at a window',
    promptStyle: 'wtr watercolor drawing, white background', created: iso(T0 - 1000) },
  { chat: CHAT, name: 'Evan', url: '/px.png?two', description: 'two — a phone photo',
    created: iso(T0 - 2000) },
];

const shoeboxed = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;   // /asset-lightbox.js, /asset-actions.js, …
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/px.png' || url.pathname === '/api/story/thumb') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PIC);
  }
  if (url.pathname === '/api/scratchpad/shoebox-url' && req.method === 'POST') {
    let body = ''; req.on('data', (d) => { body += d; });
    return req.on('end', () => { shoeboxed.push(JSON.parse(body)); json({ ok: true, id: 'sb-test' }); });
  }
  if (url.pathname === '/api/gallery/assets' || url.pathname === '/api/gallery/assets/all') {
    const a = JSON.parse(JSON.stringify(ASSETS));   // the pages write onto their items
    return json({ assets: a, total: a.length, offset: 0, limit: 300 });
  }
  if (url.pathname === '/api/chatfeed') {
    return json({
      build: 'test', settings: {}, truncated: [], delta: false,
      messages: [{ id: 'm1', chat: CHAT, from: 'claude', text: 'two pictures up',
        tldr: 'two up', created: iso(T0 - 500), postedAt: iso(T0 - 500) }],
      chats: { [CHAT]: { lastSeen: iso(T0 - 500), displayName: 'Evan' } },
    });
  }
  if (url.pathname === '/playground') {
    // The Playground door really NAVIGATES, so it needs somewhere to land:
    // the url the browser ends up on is the only honest record of where a
    // door goes (stubbing `location` is impossible — it is non-configurable).
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>playground stub</title>');
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

  // Every action button's LABEL — the aria-label the shared file writes from
  // each action's `label`, which is the only name a bare glyph has.
  const doorLabels = () => page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#clightbox .lbacts button:not(.vote)'),
    (b) => b.getAttribute('aria-label') || ''));
  const closeLb = () => page.evaluate(() => {
    if (window.__assetLightboxClose) window.__assetLightboxClose();
  });
  const openTile = async (n) => {
    await closeLb();
    await page.click('.assetgrid .acell:nth-child(' + n + ') > button:not(.vote)');
    await page.waitForSelector('#clightbox .clwrap img');
  };
  // WHERE A DOOR GOES, read off the browser after it has gone there. There is
  // no stubbing `location` — it is non-configurable — and reading the handler's
  // source would only pin the test against itself, so the door is TAPPED and
  // the resulting url is the answer. `open()` puts the surface back after.
  const tapDoor = async (label) => {
    await page.click('#clightbox .lbacts button[aria-label="' + label + '"]');
    await page.waitForTimeout(150);
  };
  const tapDoorTo = async (label) => {
    await Promise.all([
      page.waitForURL(/\/playground/, { timeout: 5000 }),
      page.click('#clightbox .lbacts button[aria-label="' + label + '"]'),
    ]);
    return page.url();
  };

  async function sweep(label, open, opts) {
    console.log('\n── ' + label + ' ──');
    await open();

    // 1 — THE SET. Same doors, same order, on both surfaces; the ONE
    //     difference is deliberate and is stated in code, not by accident:
    //     "Open the chat" is a button back to the screen she is standing on
    //     inside a chat's own Assets tab, so only the mixed grid draws it.
    await openTile(1);
    const labels = await doorLabels();
    const want = (opts.chatDoor ? ['Open the chat'] : [])
      .concat(['Open in Playground', 'Add to Shoebox', 'Save to Photos']);
    ok(JSON.stringify(labels) === JSON.stringify(want),
      label + ': the doors are ' + JSON.stringify(want) + ' — got ' + JSON.stringify(labels));

    // 2 — THE ROW FITS. Five or six 46px buttons in one un-wrapping flex row
    //     is what this change puts on a 390pt phone, so the buttons are
    //     measured rather than counted: a squashed row renders and passes
    //     every assertion above.
    const fit = await page.evaluate(() => {
      const bs = Array.prototype.slice.call(document.querySelectorAll('#clightbox .lbacts button'));
      const rs = bs.map((b) => b.getBoundingClientRect());
      return {
        n: bs.length,
        minW: Math.min.apply(null, rs.map((r) => r.width)),
        left: Math.min.apply(null, rs.map((r) => r.left)),
        right: Math.max.apply(null, rs.map((r) => r.right)),
        vw: window.innerWidth,
      };
    });
    ok(fit.minW >= 40, label + ': no button is squashed (narrowest ' + Math.round(fit.minW) + 'px)');
    ok(fit.left >= 0 && fit.right <= fit.vw,
      label + ': the whole row is on screen (' + Math.round(fit.left) + '–' + Math.round(fit.right)
      + ' of ' + fit.vw + ')');

    // 3 — THE PLAYGROUND DOOR CARRIES THE FILED PROMPT. `sameref=1` is the
    //     port saying it RECOGNISED the style half; a guess would say 0.
    const went = await tapDoorTo('Open in Playground');
    ok(/\/playground\?/.test(went || ''), label + ': the Playground door goes to /playground');
    ok(/prompt=a%20man%20at%20a%20window/.test(went || ''),
      label + ': …carrying the exact filed content half — ' + went);
    ok(/sameref=1/.test(went || ''),
      label + ': …and saying the reference really is the one behind the picture');

    // 4 — A PICTURE WITH NOTHING FILED STILL HAS THE DOOR, and it is honest:
    //     nothing to port, so the picture rides as the PHOTO REFERENCE rather
    //     than a prompt someone invented for it.
    await open();
    await openTile(2);
    const went2 = await tapDoorTo('Open in Playground');
    ok(/\/playground\?photo=/.test(went2 || ''),
      label + ': a picture with no filed prompt rides as the photo reference — ' + went2);
    ok(!/prompt=/.test(went2 || ''), label + ': …and no prompt is invented for it');

    // 5 — THE SHOEBOX DOOR REACHES THE ROUTE, with the label she reviews by
    //     as the polaroid's title, and LIGHTS: it walks nowhere, so without
    //     the receipt a tap that landed and a tap that did nothing are the
    //     same picture.
    shoeboxed.length = 0;
    await open();
    await openTile(1);
    await tapDoor('Add to Shoebox');
    ok(shoeboxed.length === 1 && /one/.test(shoeboxed[0].url || ''),
      label + ': the Shoebox door POSTs the picture');
    ok(shoeboxed.length === 1 && shoeboxed[0].title === 'one — the window',
      label + ': …titled with the label she reviews by — ' + JSON.stringify(shoeboxed[0] && shoeboxed[0].title));
    const lit = await page.$eval('#clightbox .lbacts button[aria-label="Add to Shoebox"]',
      (b) => getComputedStyle(b).backgroundColor);
    ok(lit === 'rgb(58, 53, 48)', label + ': …and the button lights as the receipt (' + lit + ')');

    // 6 — A tap on a door NEVER closes the lightbox (the shared close rule
    //     asks the tap's TARGET; these are buttons, the space beside them is
    //     what closes).
    ok(await page.evaluate(() => {
      const el = document.getElementById('clightbox');
      return !!el && el.style.display !== 'none' && el.style.display !== '';
    }), label + ': a tap on a door leaves the box open');
    await closeLb();
  }

  await sweep('Assets tab', async () => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="' + CHAT + '"]');
    await page.click('#grid .crow[data-chat="' + CHAT + '"]');
    await page.click('.tg-assets');
    await page.waitForSelector('.assetgrid .acell');
  }, { chatDoor: false });

  await sweep('Meta Assets', async () => {
    await page.goto(base + '/assets');
    await page.waitForSelector('.assetgrid .acell');
  }, { chatDoor: true });

  // ── A SOURCE PIN — the whole point of the change ──────────────────────────
  // Neither page may grow its own row again. A hand-typed action array is how
  // the two surfaces drifted into different doors in the first place, and a
  // page that types out one more icon looks completely fine until she opens
  // the other one.
  console.log('\n── the shared set ──');
  // THE LIST IS DERIVED, NOT TYPED (2026-09-01). This pin named chats.html and
  // assets.html by hand — the two pages the 2026-08-31 survey had looked at —
  // and the Compare/deck pages' adapter (asset-view.js) and Freeform, both
  // callers of the same lightbox, went on drawing ♥/✕ and nothing else until
  // Sophie tapped a hot tub and asked why there was no Playground button. So
  // every caller of the shared lightbox in public/ is swept: it builds its
  // doors from the shared set, or it is on the EXEMPT list with its reason.
  const EXEMPT = {
    'asset-lightbox.js': 'the lightbox itself',
    'promptlab.html': 'its own row — put the prompt back and the Story Room walk carry a RUN id',
    'scratchpad.html': 'a picker over a beat\'s past pictures; the beat popup carries its own Playground walk',
    'character.html': 'a bare open of a face — nothing filed, no prompt, nothing to port',
  };
  const callers = fs.readdirSync(PUB).filter((f) => /\.(html|js)$/.test(f))
    .filter((f) => /__assetLightbox\(/.test(fs.readFileSync(path.join(PUB, f), 'utf8')));
  ok(callers.length >= 8, 'the sweep found the lightbox\'s callers (' + callers.length + '): ' + callers.join(', '));
  callers.filter((f) => !EXEMPT[f]).forEach((f) => {
    const src = fs.readFileSync(path.join(PUB, f), 'utf8');
    const rendered = /\.js$/.test(f);   // a shared script is linked by the page that renders it
    if (!rendered) ok(/<script src="\/asset-actions\.js"><\/script>/.test(src), f + ' loads /asset-actions.js');
    // the page reads the global into a guarded local (like every other shared
    // script it links), so the pin is on the shared object arriving and on
    // `.build(` being what makes the row.
    ok(/ForgeAssetActions/.test(src) && /\.build\(/.test(src),
      f + ' builds its doors from the shared set');
    for (const own of ["label:'Open in Playground'", "label:'Add to Shoebox'",
      "label:'Save to Photos'", "label:'Open the chat'"]) {
      ok(!src.includes(own), f + ' does not hand-type a door: ' + own);
    }
    // The port script is what makes the Playground door honest about whether
    // it knows the style — without it every picture would fall through to the
    // photo reference, silently.
    if (!rendered) ok(/<script src="\/playground-port\.js"><\/script>/.test(src), f + ' loads /playground-port.js');
  });
  // the template pages render their scripts server-side — page-templates.js
  // is the "page" for asset-view.js
  {
    const tpl = fs.readFileSync(path.join(__dirname, '..', 'page-templates.js'), 'utf8');
    ok(/asset-actions\.js/.test(tpl) && /playground-port\.js/.test(tpl),
      'page-templates.js links /asset-actions.js and /playground-port.js for the Compare/deck pages');
  }

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

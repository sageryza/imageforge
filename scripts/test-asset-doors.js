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
const ROOT = path.join(__dirname, '..');
const sheetGrid = require(path.join(ROOT, 'sheet-grid.js'));
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const playgroundSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
const T0 = Date.now();

// The REAL Playground lands behind the door now (2026-09-06): the url a door
// produces is only half the answer for a sheet — the other half is whether
// the page it lands on really puts nine panels in nine boxes. So /playground
// serves the real promptlab.html over the same stubs test-playground-panel-
// seed.js uses, with the `res` literal read out of server.js, never copied.
function resTable() {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                      // eslint-disable-line no-eval
}
const RES = resTable();
function panelsPayload() {
  const panels = { grids: {}, sheets: {}, story: { line: 'STORYLINE', layout: '' } };
  Object.keys(sheetGrid.GRIDS).forEach((g) => {
    const pin = sheetGrid.GRIDS[g].shape;
    panels.grids[g] = {
      ...sheetGrid.GRIDS[g],
      count: sheetGrid.GRIDS[g].across * sheetGrid.GRIDS[g].down,
      positions: sheetGrid.positions(g),
      layout: sheetGrid.layoutWords(g),
      sentence: sheetGrid.panelBlock(g, []),
      aspectRatio: pin ? sheetGrid.SHAPES[pin].aspectRatio : null,
    };
  });
  Object.keys(sheetGrid.SHAPES).filter((sh) => RES[sh]).forEach((shape) => {
    panels.sheets[shape] = {};
    Object.keys(sheetGrid.GRIDS).forEach((g) => {
      panels.sheets[shape][g] = {};
      Object.keys(RES[shape].tiers).forEach((tier) => {
        const plan = sheetGrid.sheetFor(shape, Number(g), tier, RES);
        if (plan) panels.sheets[shape][g][tier] = { sheet: plan.sheet, cell: plan.cell };
      });
    });
  });
  return panels;
}
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
const SHEET_PANELS = [
  'i was in the cafeteria alone w the jail guy when he told me that.\nhe said he went to jail',
  'we were all playing cards in the main area',
  'shot of her car, us three watching through the screen',
  '(close up of her hand trying to shove them all through)\nhe yelled at her "not a single one survived"',
  'they caught us in the bathroom',
  'then they sedated her',
  'then at night we colored together in the hallway',
  'they changed the pills to huge horse lookin pills',
  'snow on the ground\nturning in circles',
];
const ASSETS = [
  { chat: CHAT, name: 'Evan', url: '/px.png?one', description: 'one — the window',
    prompt: 'gpt-image-2 · medium · 2K', promptContent: 'a man at a window',
    promptStyle: 'wtr watercolor drawing, white background', created: iso(T0 - 1000) },
  { chat: CHAT, name: 'Evan', url: '/px.png?two', description: 'two — a phone photo',
    created: iso(T0 - 2000) },
  // AN UNCUT SHEET (2026-09-06, Sophie: "when i press copy on the original
  // uncut grid it shud slot all 9 into panels") — filed the way the
  // mental-hospital-storyboard chat filed hers: the wrapper with [content] in
  // the style half, the nine panels joined by a blank line in the content
  // half, "3x3" in the label, a plain caption with no cut fraction.
  { chat: CHAT, name: 'Evan', url: '/px.png?sheet', description: 'The whole 3x3 sheet — Sandy mirror, uncut',
    prompt: 'gpt-image-2 · medium · 4K',
    promptStyle: 'Use only the style of the attached style reference and ignore its content.\n\n'
      + sheetGrid.castBlock([{ name: 'me', description: 'hair shorter' }]) + '\n\n[content]\n\nDo not include any text in the image.',
    promptContent: SHEET_PANELS.join('\n\n'), created: iso(T0 - 3000) },
  // …and ONE PANEL CUT OUT OF IT — the `1/9 (4K)` caption, one panel's words.
  // It goes to the single box (her 2026-08-27 rule) and must keep doing so.
  { chat: CHAT, name: 'Evan', url: '/px.png?cut', description: '4. Her hand at the screen — 9-panel sheet',
    prompt: 'gpt-image-2 · medium · 1/9 (4K)',
    promptStyle: 'Use only the style of the attached style reference and ignore its content.\n\n[content]\n\nDo not include any text in the image.',
    promptContent: SHEET_PANELS[3], created: iso(T0 - 4000) },
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
    // It is the REAL page since 2026-09-06, because a sheet's door is judged
    // by what the page does with `?panels=` — nine boxes filled, or not.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(playgroundSrc);
  }
  if (url.pathname === '/api/promptlab/styles') {
    return json({
      styles: {
        evan: { label: 'Sandy mirror', prefix: 'PREFIX', suffix: 'TAIL', refs: ['sage-sandy-mirror.png'] },
        dreamy: { label: 'Dreamy', prefix: 'DPREF', suffix: 'DTAIL', refs: ['dream-mystery.jpg'] },
        wtr: { label: 'WTR', prefix: '', suffix: '', refs: [] },
      },
      sizes: {}, res: RES, resDefault: '1k', max: 4000, photoLine: '',
      panels: panelsPayload(),
    });
  }
  if (url.pathname === '/api/promptlab' || /^\/api\/promptlab\//.test(url.pathname)) {
    return json({ runs: [], more: false, assets: [] });
  }
  if (url.pathname === '/api/gallery/assets/notes') return json({ assets: [] });
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
  // Nothing leaves the stub — the real Playground asks for refs and thumbs by
  // absolute url, and an external fetch hangs behind the sandbox proxy.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());

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
      // 'commit', not 'load': the real Playground page keeps a poll and a
      // few images in flight, and the url is the fact being read here.
      page.waitForURL(/\/playground/, { timeout: 5000, waitUntil: 'commit' }),
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

  // ── AN UNCUT SHEET GOES TO THE PANEL BOXES; A CUT PANEL STILL GOES TO THE
  //    ONE BOX (2026-09-06, Sophie: "when i press copy on the original uncut
  //    grid it shud slot all 9 into panels"). Judged on the REAL Playground:
  //    the url is read off the browser after the door, and then the boxes on
  //    the page it landed on are COUNTED and READ — a link that carries
  //    panels= and a page that puts them in the boxes are two different facts.
  console.log('\n── the uncut sheet ──');
  const openAssets = async () => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="' + CHAT + '"]');
    await page.click('#grid .crow[data-chat="' + CHAT + '"]');
    await page.click('.tg-assets');
    await page.waitForSelector('.assetgrid .acell');
  };
  // The seed lands only once the styles fetch does, so wait for the BOXES
  // (or give up after 3s and let the assertions say so) — the two tab buttons
  // are static markup and prove nothing.
  const settled = async () => {
    await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0,
      null, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
  };
  const boxes = () => page.$$eval('#panelgrid textarea', (t) => t.map((x) => x.value));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await openAssets();
  await openTile(3);
  const wentSheet = await tapDoorTo('Open in Playground');
  ok(/[?&]panels=/.test(wentSheet || '') && /[?&]grid=9\b/.test(wentSheet || ''),
    'the sheet\'s door carries panels= and grid=9 — ' + (wentSheet || '').slice(0, 120) + '…');
  ok(!/[?&]prompt=/.test(wentSheet || ''), '…and NOT the wall of text as one prompt');
  ok(/style=chatgpt/.test(wentSheet || '') && /sameref=1/.test(wentSheet || '') && /quality=medium/.test(wentSheet || ''),
    '…still carrying the tile, the reference answer and the quality, as the door always did');
  ok(/cast=/.test(wentSheet || '') && /hair%20shorter/.test(wentSheet || ''),
    '…and the cast read out of the sheet\'s own style half');
  {
    const m = /[?&]panels=([^&]+)/.exec(wentSheet || '');
    let sent = null;
    try { sent = JSON.parse(decodeURIComponent(m[1])); } catch (e) { sent = null; }
    ok(Array.isArray(sent) && JSON.stringify(sent) === JSON.stringify(SHEET_PANELS),
      'the nine panels ride the link VERBATIM, in order, a two-line panel intact');
  }
  await settled();
  ok(await page.evaluate(() => document.getElementById('t-panels').classList.contains('on')),
    'the Playground lands on the PANELS tab');
  const filled = await boxes();
  ok(filled.length === 9 && filled.every((v) => v.trim()),
    'with nine boxes and every one of them filled (' + filled.filter((v) => v.trim()).length + ' of ' + filled.length + ')');
  ok(JSON.stringify(filled) === JSON.stringify(SHEET_PANELS),
    'each box holding its own panel\'s words, in reading order');
  ok(await page.$eval('#panelgrid', (el) => el.offsetHeight > 0), 'the fold is open — the boxes are on screen');
  ok(!/panels=/.test(await page.evaluate(() => location.search)),
    'the link is spent on arrival, so a reload cannot seed twice');

  console.log('\n── a cut panel, untouched ──');
  await openAssets();
  await openTile(4);
  const wentCut = await tapDoorTo('Open in Playground');
  ok(/[?&]prompt=/.test(wentCut || '') && !/[?&]panels=/.test(wentCut || ''),
    'a cut panel\'s door still sends ONE prompt — ' + (wentCut || '').slice(0, 90) + '…');
  await settled();
  ok(await page.evaluate(() => document.getElementById('t-picture').classList.contains('on')),
    'and the Playground lands on the PICTURE tab');
  ok((await page.$eval('#prompt', (el) => el.value)) === SHEET_PANELS[3],
    'with that panel\'s own words in the single box');

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

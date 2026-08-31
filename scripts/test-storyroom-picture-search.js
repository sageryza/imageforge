#!/usr/bin/env node
// SEARCHING THE PICTURES IN THE ADD SHEET (2026-08-28, Sophie: "add search in
// story room - pictures").
//
// The whole inbox arrives in one read, so this is a client-side filter over
// the grid she is looking at — and that is what has to be measured, because
// almost every way of getting it wrong renders as a page that looks fine:
//   - the box speaks the HOUSE grammar (/feedkit.js, never a copy), so bare
//     words AND within one picture, `-word` excludes, "quoted" is a phrase;
//   - it searches the words that MADE a picture (prompt, recipe, an upload's
//     name) and never the url, whose Storage filename is a random id;
//   - it is drawn from the UNFILTERED inbox, so her own query can never take
//     the box off the screen mid-search — and it stays away entirely when
//     nothing in the inbox carries a word at all;
//   - RETURN runs it and drops the keyboard, the house rule an <input
//     type=search> outside a <form> gets nothing for free.
//
//   node scripts/test-storyroom-picture-search.js
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

function png() {
  const w = 40, h = 60;
  const raw = Buffer.alloc((w * 3 + 1) * h);
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
const PIC = png();

// Four pictures and one phone upload. `crow` appears in two prompts and
// `raincoat` in one of those, so an AND of the two is a real narrowing; the
// url tag of the moon picture is deliberately `crowless` — a url match would
// light it and nothing else would explain why.
const ITEMS = [
  { url: '/px.png?rain', prompt: 'a woman in a yellow raincoat feeding crows on a bench', model: 'gpt-image-2', quality: 'medium' },
  { url: '/px.png?crow', prompt: 'crows over a wheat field', model: 'gpt-image-2', quality: 'low' },
  { url: '/px.png?crowless', prompt: 'the moon behind a chimney', style: 'dreamy', model: 'gpt-image-2' },
  { url: '/px.png?wtr', prompt: 'a bucket of milk', style: 'watercolor', model: 'flux' },
];
const UP = { url: '/px.png?up', kind: 'image', title: 'raincoat photo off my phone' };

// A story whose gathered art carries no words at all — the case the box must
// stay away from rather than sit there matching nothing.
let wordless = false;

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => json({ ok: true, beats: [] }));
  }
  if (url.pathname === '/api/scratchpad/inbox') {
    return json(wordless
      ? { count: 2, source: 'story', items: [{ url: '/px.png?a' }, { url: '/px.png?b' }], uploads: [] }
      : { count: ITEMS.length, source: 'playground', items: ITEMS, uploads: [UP] });
  }
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats: [], title: 'search test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/scratchpad-sophie.png' || url.pathname === '/api/story/thumb') {
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
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  // The kit is LINKED, not copied — if it 404s the search is dead and every
  // "nothing matched" assertion below would pass vacuously.
  ok(fs.readFileSync(path.join(PUB, 'scratchpad.html'), 'utf8').includes('src="/feedkit.js"'),
    'the page links /feedkit.js rather than carrying a copy of the grammar');

  await page.goto(base + '/scratchpad.html');
  ok(await page.evaluate(() => Boolean(window.FeedKit && window.FeedKit.qparse)),
    'and the kit really loaded');

  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.click('#inboxbtn');
  await page.waitForSelector('#inbox:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#inboxgrid button').length === 5);

  const tiles = () => page.$$eval('#inboxgrid button img',
    (im) => im.map((i) => (decodeURIComponent(i.src).match(/px\.png\?(\w+)/) || [])[1] || '?'));
  const type = async (q) => {
    await page.fill('#picq', q);
    await page.waitForTimeout(120);
  };

  ok(await page.$eval('#picq', (el) => !el.hidden), 'the box is there when there are words to search');
  ok((await tiles()).length === 5, 'and it starts showing everything');

  await type('crow');
  let t = await tiles();
  ok(t.length === 2 && t.includes('rain') && t.includes('crow'),
    'one word filters the grid as she types (' + t.join(',') + ')');
  ok(!t.includes('crowless'),
    'and it never reads the url — the tile whose FILENAME says crow is gone');

  await type('crow raincoat');
  t = await tiles();
  ok(t.length === 1 && t[0] === 'rain', 'bare words AND within one picture');

  await type('crow -raincoat');
  t = await tiles();
  ok(t.length === 1 && t[0] === 'crow', '-word excludes');

  await type('"wheat field"');
  t = await tiles();
  ok(t.length === 1 && t[0] === 'crow', 'a quoted phrase keeps the words adjacent');

  await type('watercolor');
  t = await tiles();
  ok(t.length === 1 && t[0] === 'wtr', 'the recipe is searchable too — style');
  await type('flux');
  t = await tiles();
  ok(t.length === 1 && t[0] === 'wtr', '…and model');

  // Her phone upload is found by the name it arrived with, and it still leads
  // the grid — the thing she just added is the thing she came to place.
  await type('raincoat');
  t = await tiles();
  ok(t.length === 2 && t[0] === 'up', 'an upload is found by its name, and still leads the grid');

  await type('zzzz');
  t = await tiles();
  ok(t.length === 0, 'a query that matches nothing empties the grid');
  ok(await page.$eval('#inboxempty', (el) => !el.hidden && /match/i.test(el.textContent)),
    'and the empty line says it was the SEARCH, not an empty inbox');
  ok(await page.$eval('#picq', (el) => !el.hidden),
    'the box survives its own empty result — it is drawn from the unfiltered inbox');

  // RETURN runs it and drops the keyboard: what she is left looking at is the
  // pictures. A lone <input type=search> outside a <form> does neither.
  await page.focus('#picq');
  await page.fill('#picq', 'crow');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  t = await tiles();
  ok(t.length === 2, 'RETURN runs the search');
  ok(await page.evaluate(() => document.activeElement.id !== 'picq'), 'and drops the keyboard');

  // Clearing puts everything back.
  await type('');
  ok((await tiles()).length === 5, 'clearing the box puts the whole inbox back');

  // A tap in the box must not reach the sheet's own cancel handlers.
  await page.click('#picq');
  ok(await page.$eval('#inbox', (el) => !el.hidden), 'tapping the box does not close the sheet');

  // A STORY WHOSE ART CARRIES NO WORDS: a box that could never match anything
  // is a dead control, so it is not drawn at all.
  wordless = true;
  await page.click('#inboxclose');
  await page.evaluate(() => { window.inboxItems = []; });
  await page.click('#inboxbtn');
  await page.waitForFunction(() => document.querySelectorAll('#inboxgrid button').length === 2);
  ok(await page.$eval('#picq', (el) => el.hidden),
    'no box at all when nothing in the inbox carries a word');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})();

#!/usr/bin/env node
// ADD TO SHOEBOX (2026-08-28, Sophie: "add to shoebox button option in share
// in story room" → "this is too complicated" → the settled one-button
// version): a beat popup's share icon files the picture she is looking at as
// a MEMORY in her Memory Library, so it shows in the Shoebox as a polaroid.
//
// Two halves:
//   1. the SERVER CONTRACT, by source — the route exists, is handed the
//      membry Firestore by server.js, writes createdAt (the library's one
//      query ORDERS BY IT — a doc without it is silently omitted, the
//      Firestore orderBy trap), content-addresses by the picture so a second
//      tap updates one memory, and never guesses a uid on a tie.
//   2. the PAGE, headless — the button in #artrow, hidden without a picture,
//      the POST body (/cover's shape: beat id + the side she is looking at),
//      the lit receipt, and that the tap does not stale the film.
//
//   node scripts/test-storyroom-shoebox.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (c, n) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) failures++; };

// ── 1. the server contract, by source ────────────────────────────────────
const sp = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
const sv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const route = sp.slice(sp.indexOf("router.post('/shoebox'"), sp.indexOf('// The inbox.'));
ok(route.length > 100, 'the /shoebox route exists in scratchpad.js');
ok(/doc\.createdAt = FV\.serverTimestamp\(\)/.test(route),
  'a NEW memory is stamped createdAt (the library orders by it — absent means invisible)');
ok(route.indexOf('if (!snap.exists) { doc.content = \'\'; doc.createdAt') >= 0,
  'a re-add keeps the original createdAt (only a missing doc gets one)');
ok(/sha1/.test(route) && /'sb-'/.test(route),
  'the memory id is content-addressed off the picture — a second tap updates, never twins');
ok(/slotFace\(artSlot\(beat, style\)\)/.test(route),
  "the picture comes off the side she is LOOKING at — /cover's own rule");
ok(/illustration: \{ url: art \}/.test(route) && /title: String\(beat\.text/.test(route),
  'the doc is what the Shoebox reads: illustration.url + the beat words as the title');
const uidFn = sp.slice(sp.indexOf('async function shoeboxUid'), sp.indexOf("router.post('/shoebox'"));
ok(/SHOEBOX_UID/.test(uidFn) && /collectionGroup\('memories'\)/.test(uidFn),
  'her uid is env override or DISCOVERED by ranking (find-gallery-uid technique) — never committed');
ok(/ranked\[1\] && ranked\[1\]\[1\] === ranked\[0\]\[1\]/.test(uidFn),
  'a tie refuses rather than guessing whose library it is');
ok(/scratchpadMod\.init\(\{ membryDb: storyDb \}\)/.test(sv),
  'server.js hands the membry Firestore in (the dreamapp init pattern)');
ok(!/sageryza|@gmail/.test(sp), 'no email or personal id committed in scratchpad.js');

// ── 2. the real page, headless ───────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed — page half skipped'); return done(); }

const PUB = path.join(__dirname, '..', 'public');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    .replace('ABAAAAAQCAYAAAAf8/9h', 'AAEAAAABCAYAAAAfFcSJ'),
  'base64');

let beats = [
  { id: 'b1', url: '/px.png?one', text: 'Penny finds the blue Kleenex', color: null },
  { id: 'b2', text: 'no picture yet', color: null },
];
let shoeboxPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      if (url.pathname === '/api/scratchpad/shoebox') { shoeboxPosts.push(JSON.parse(body)); return json({ ok: true, id: 'sb-x' }); }
      return json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'shoebox test', film: null, audios: [] });
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/scratchpad-sophie.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
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

function done() {
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beat');

  // beat WITH a picture: the button shows, taps, lights, and the POST is
  // /cover's shape — the beat id and the style side, never a url the popup
  // could have gone stale about.
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(await page.$eval('#arshoe', (el) => !el.hidden), 'the share button shows on a beat with a picture');
  await page.click('#arshoe');
  await page.waitForFunction(() => document.getElementById('arshoe').classList.contains('on'));
  ok(shoeboxPosts.length === 1, 'one tap, one POST');
  ok(shoeboxPosts[0] && shoeboxPosts[0].id === 'b1' && 'style' in shoeboxPosts[0],
    'the POST names the beat and the side she is looking at');
  ok(await page.$eval('#arshoe', (el) => el.classList.contains('on')), 'the lit button is the receipt');
  ok(await page.evaluate(() => !window.dirtySinceFilm), 'adding to the shoebox does not stale the film');

  // beat WITHOUT a picture: no button (there is nothing to add).
  await page.evaluate(() => window.closeBeat());
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);
  await (await page.$$('#pad .beat'))[1].click();
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(await page.$eval('#arshoe', (el) => el.hidden), 'no picture, no button');
  ok(!(await page.$eval('#arshoe', (el) => el.classList.contains('on'))), 'and the receipt reset with the beat');

  await browser.close();
  server.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });

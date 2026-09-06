#!/usr/bin/env node
// CHAPTERS IN THE STORY ROOM (2026-09-06, Sophie: "i want the chapter within
// a story. arrow buttons at the top, and a contents page w all the stories
// and thumbnails"). Drives the REAL public/scratchpad.html in headless
// Chromium against a stub API and MEASURES:
//   1. the ‹ chapter › row shows only once the story has a chapter, names the
//      one she is in with its place (1/3), and ends before the pill's column;
//   2. › and ‹ REALLY scroll the window — the next chapter's first tile lands
//      just under the sticky block, and the row renames itself;
//   3. scrolling by hand renames the row too;
//   4. the CONTENTS sheet lists every chapter with its first beat's picture as
//      the thumbnail and its beat count, lights the one she is in, and a tap
//      on a row closes the sheet and jumps;
//   5. the beat card's field: empty by default, the bookmark swaps in an
//      EMPTY box, Return saves (POST /chapter {id,title}), the row and the
//      count follow, clearing the box takes the chapter off — and none of it
//      stales the film;
//   6. a beat that opens a chapter shows its name on the Caption line.
//   node scripts/test-storyroom-chapters.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

// A real 2:3 picture (the tiles size themselves to the story's shape).
const PNG = (() => {
  const w = 200, h = 300;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); raw[row] = 0;
    for (let x = 0; x < w; x++) { raw[row + 1 + x * 3] = 180; raw[row + 2 + x * 3] = 140; raw[row + 3 + x * 3] = 90; }
  }
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();

// Eighty beats — twenty rows at four across, so the page really scrolls —
// with three chapters marked on beats 0, 12 and 28.
const CH = { b0: 'Before', b12: 'The ER', b28: 'The ward' };
let beats = [];
for (let i = 0; i < 80; i++) {
  const b = { id: 'b' + i, url: '/px.png?' + i, text: i % 3 ? 'beat ' + i : '', color: null };
  if (CH[b.id]) b.chapter = CH[b.id];
  beats.push(b);
}
const posted = [];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/chapter') {
        beats.forEach((x) => { if (x.id === b.id) { if (b.title) x.chapter = b.title; else delete x.chapter; } });
      }
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'chapters test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/api/story/thumb' || url.pathname === '/scratchpad-sophie.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG);
  }
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
function ok(cond, name, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond || extra === undefined ? '' : '  — ' + JSON.stringify(extra)));
  if (!cond) failures++;
}
const VW = 390, VH = 780;

(async () => {
  // Source pins: the route exists, and the built page carries the three surfaces.
  const srv = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');
  ok(/router\.post\('\/chapter'/.test(srv), 'scratchpad.js has POST /chapter');
  const html = fs.readFileSync(path.join(PUB, 'scratchpad.html'), 'utf8');
  ok(html.includes('id="chaprow"') && html.includes('id="chapsheet"') && html.includes('id="pchap"'),
    'the built page carries the row, the contents sheet and the field');
  ok(!/id="pchap"[^>]*value=/.test(html), 'the chapter box ships empty (no value attribute)');

  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beatwrap');
  await page.waitForTimeout(150);

  const rowState = () => page.evaluate(() => {
    const row = document.getElementById('chaprow');
    const r = row.getBoundingClientRect();
    return {
      hidden: row.hidden, title: row.querySelector('.chapt').textContent, n: row.querySelector('.chapn').textContent,
      prevOff: document.getElementById('chapprev').disabled, nextOff: document.getElementById('chapnext').disabled,
      right: document.getElementById('chapnext').getBoundingClientRect().right, y: window.scrollY,
      topBottom: document.getElementById('topchrome').getBoundingClientRect().bottom,
    };
  });
  const wrapTop = (id) => page.evaluate((id) => {
    const w = document.querySelector('#pad .beatwrap[data-beats~="' + id + '"]');
    return w ? w.getBoundingClientRect().top : null;
  }, id);

  // 1. the row
  let s = await rowState();
  ok(!s.hidden, 'the chapter row shows on a story with chapters');
  ok(s.title === 'Before' && s.n === '1/3', 'it names the first chapter and its place', s);
  ok(s.prevOff && !s.nextOff, '‹ is off at the first chapter, › is on', s);
  ok(s.right <= VW - 56 + 1, 'the row\'s last button ends before the pill\'s column', s.right);
  const canScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight * 1.5);
  ok(canScroll, 'the fixture is long enough to scroll');

  // 2. › really scrolls
  await page.click('#chapnext');
  await page.waitForTimeout(80);
  s = await rowState();
  const t12 = await wrapTop('b12');
  ok(s.y > 0, '› moved the window', s.y);
  ok(t12 !== null && Math.abs(t12 - (s.topBottom + 6)) <= 2, 'The ER\'s first tile sits just under the sticky block', { t12, topBottom: s.topBottom });
  ok(s.title === 'The ER' && s.n === '2/3' && !s.prevOff && !s.nextOff, 'the row renamed itself to The ER 2/3', s);
  await page.click('#chapnext');
  await page.waitForTimeout(80);
  s = await rowState();
  ok(s.title === 'The ward' && s.n === '3/3' && s.nextOff, 'second › reaches The ward 3/3 and › goes off', s);
  await page.click('#chapprev');
  await page.waitForTimeout(80);
  s = await rowState();
  ok(s.title === 'The ER', '‹ walks back to The ER', s);

  // 3. scrolling by hand renames it
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  s = await rowState();
  ok(s.title === 'Before' && s.y === 0, 'scrolling to the top by hand names Before again', s);

  // 4. the contents sheet
  await page.click('#chapname');
  await page.waitForTimeout(120);
  let c = await page.evaluate(() => {
    const sh = document.getElementById('chapsheet');
    const rows = Array.from(document.querySelectorAll('#chaplist .chrow'));
    return {
      hidden: sh.hidden, header: sh.querySelector('.sheethead .no').textContent,
      hasX: !!sh.querySelector('.sheethead [aria-label="Close"]'),
      rows: rows.map((r) => ({
        nm: r.querySelector('.chnm').textContent, ct: r.querySelector('.chcount').textContent,
        img: (r.querySelector('img') || {}).src || '', on: r.classList.contains('on'),
        w: r.querySelector('.chthumb').getBoundingClientRect().width,
      })),
    };
  });
  ok(!c.hidden && c.header === 'Contents' && !c.hasX, 'the contents sheet opens with the page\'s own header and no ✕', c.header);
  ok(c.rows.length === 3 && c.rows.map((r) => r.nm).join('|') === 'Before|The ER|The ward', 'it lists the three chapters in order', c.rows.map((r) => r.nm));
  ok(c.rows.map((r) => r.ct).join('|') === '12 beats|16 beats|52 beats', 'each row counts its beats', c.rows.map((r) => r.ct));
  ok(c.rows.every((r, k) => decodeURIComponent(r.img).includes('/px.png?' + [0, 12, 28][k])), 'each thumbnail is the chapter\'s first beat\'s picture', c.rows.map((r) => r.img));
  ok(c.rows.every((r) => r.w > 30), 'the thumbnails have a real box', c.rows.map((r) => r.w));
  ok(c.rows[0].on && !c.rows[1].on, 'the chapter she is in is lit', c.rows.map((r) => r.on));
  const decoded = await page.evaluate(() => Array.from(document.querySelectorAll('#chaplist img')).every((i) => i.complete && i.naturalWidth > 0));
  ok(decoded, 'the thumbnails really decode');
  await page.click('#chaplist .chrow:nth-child(3)');
  await page.waitForTimeout(100);
  s = await rowState();
  const shHidden = await page.evaluate(() => document.getElementById('chapsheet').hidden);
  ok(shHidden && s.title === 'The ward' && s.y > 0, 'tapping a row closes the sheet and jumps to The ward', s);
  const bodyFree = await page.evaluate(() => document.body.style.overflow !== 'hidden');
  ok(bodyFree, 'the page is unlocked again after the sheet');

  // 5. the beat card's field
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => window.openBeat(window.beatById('b5')));
  await page.waitForTimeout(80);
  let f = await page.evaluate(() => ({
    txtHidden: document.getElementById('chaptxt').hidden, boxHidden: document.getElementById('pchap').hidden,
    on: document.getElementById('chapbtn').classList.contains('on'), dirty: window.dirtySinceFilm,
    sameLine: Math.abs(document.getElementById('chapbtn').getBoundingClientRect().top - document.getElementById('caplab').getBoundingClientRect().top) < 12,
  }));
  ok(f.txtHidden && f.boxHidden && !f.on, 'a beat with no chapter shows only the quiet bookmark', f);
  ok(f.sameLine, 'the bookmark sits on the Caption line', f);
  await page.click('#chapbtn');
  await page.waitForTimeout(50);
  f = await page.evaluate(() => ({
    boxHidden: document.getElementById('pchap').hidden, val: document.getElementById('pchap').value,
    focused: document.activeElement && document.activeElement.id === 'pchap',
    w: document.getElementById('pchap').getBoundingClientRect().width,
  }));
  ok(!f.boxHidden && f.val === '' && f.focused && f.w > 80, 'the bookmark swaps in an EMPTY, focused box', f);
  const before = posted.length;
  await page.keyboard.type('The boys');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const chapPosts = posted.slice(before).filter((p) => p[0] === '/api/scratchpad/chapter');
  ok(chapPosts.length === 1 && chapPosts[0][1].id === 'b5' && chapPosts[0][1].title === 'The boys', 'Return saves: POST /chapter {id, title}', chapPosts);
  f = await page.evaluate(() => ({
    txt: document.getElementById('chaptxt').textContent, txtHidden: document.getElementById('chaptxt').hidden,
    on: document.getElementById('chapbtn').classList.contains('on'), dirty: window.dirtySinceFilm,
    n: document.querySelector('#chaprow .chapn').textContent,
  }));
  ok(f.txt === 'The boys' && !f.txtHidden && f.on, 'the card now names the chapter beside a lit bookmark', f);
  const boxGone = await page.evaluate(() => document.getElementById('pchap').hidden);
  ok(boxGone, 'Return puts the box away — the name reads as words');
  ok(f.n === '1/4', 'the row counts four chapters now', f.n);
  ok(f.dirty === false, 'naming a chapter does not stale the film', f.dirty);
  // clear it
  await page.click('#chapbtn');
  await page.waitForTimeout(40);
  f = await page.evaluate(() => ({ boxHidden: document.getElementById('pchap').hidden, val: document.getElementById('pchap').value, focused: document.activeElement && document.activeElement.id === 'pchap' }));
  ok(!f.boxHidden && f.val === 'The boys' && f.focused, 'the bookmark reopens the box holding her own saved word', f);
  await page.evaluate(() => { document.getElementById('pchap').value = ''; });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const clr = posted.filter((p) => p[0] === '/api/scratchpad/chapter').pop();
  f = await page.evaluate(() => ({ on: document.getElementById('chapbtn').classList.contains('on'), n: document.querySelector('#chaprow .chapn').textContent }));
  ok(clr && clr[1].id === 'b5' && clr[1].title === '', 'an emptied box POSTs title "" — the chapter comes off', clr);
  ok(!f.on && f.n === '1/3', 'and the bookmark goes quiet, the count back to three', f);
  await page.evaluate(() => window.closeBeat());

  // 6. a beat that opens a chapter
  await page.evaluate(() => window.openBeat(window.beatById('b12')));
  await page.waitForTimeout(60);
  f = await page.evaluate(() => ({ txt: document.getElementById('chaptxt').textContent, hidden: document.getElementById('chaptxt').hidden, on: document.getElementById('chapbtn').classList.contains('on') }));
  ok(f.txt === 'The ER' && !f.hidden && f.on, 'opening The ER\'s first beat shows its chapter name', f);
  await page.evaluate(() => window.closeBeat());

  // 7. no chapters, no row
  await page.evaluate(() => { window.beats.forEach((b) => { delete b.chapter; }); window.renderChapters(); });
  const hid = await page.evaluate(() => document.getElementById('chaprow').hidden);
  ok(hid, 'with no chapters the row is gone');

  ok(errors.length === 0, 'no page errors', errors);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall green');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

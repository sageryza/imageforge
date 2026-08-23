#!/usr/bin/env node
// THE STYLE TOGGLE + THE PHONE UPLOADS + THE + THAT CHANGES ITS MIND
// (Aug 2026, Sophie: "a style toggle at the top of a story that alternates
// between dreamy and watercolor … the same format that the account's toggle
// is" · "if I click the plus button … and then change my mind and click it
// again, the lines between the clips should disappear" · "add clips right
// from my phone into the inbox").
//
// Pure first: the pad's DREAMY prefix/suffix in scratchpad.js must be
// byte-for-byte PL_GPT_STYLES.dreamy's in server.js — the same keep-the-
// copies-identical rule ART.prefix already lives under.
//
// Then the REAL public/scratchpad.html in headless Chromium against a stub
// API:
//   1. the toggle is the account switcher's format — 48px track, 26 tall,
//      18px knob that actually MOVES (the far stop's 23px offset is the same
//      arithmetic as the account one's third stop), on its own line at the
//      top of the story,
//   2. flipping to DREAMY keeps the beats and the words and empties the art
//      that isn't drawn in that style yet — a beat with a dreamy slot shows
//      it, one without goes honestly blank — and POSTs /style,
//   3. a blank beat's draw box under dreamy hides the Sophie card and sends
//      style:'dreamy' with character off,
//   4. + arms the placement lines; + again un-arms them (the second tap is
//      changing her mind, and it must not need a tap somewhere else),
//   5. the add sheet's upload button feeds the system picker into the Dump's
//      upload-file route, files the result with POST /upload, and a movie
//      tiles at the top of the grid with the film mark and places as a CLIP
//      beat via POST /clip.
//
//   node scripts/test-scratchpad-style.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

// ── pure: the DREAMY recipe is the Playground's, byte for byte ────────
// Both files write the halves as concatenated string literals; pull each
// value out by evaluating just that expression (comments in between are
// stripped by the parse), so a reworded Playground prompt fails HERE
// instead of silently drawing two different dreamys.
function extractHalf(file, key, anchor) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error(`${file}: no ${anchor}`);
  const re = new RegExp(`${key}:\\s*((?:'(?:[^'\\\\]|\\\\.)*'\\s*\\+?\\s*)+)`, 'g');
  re.lastIndex = at;
  const m = re.exec(src);
  if (!m) throw new Error(`${file}: no ${key} after ${anchor}`);
  return new Function(`return (${m[1]});`)();
}
try {
  for (const key of ['prefix', 'suffix']) {
    const pad = extractHalf('scratchpad.js', key, 'const DREAMY');
    const play = extractHalf('server.js', key, 'dreamy: {');
    ok(pad === play, `DREAMY.${key} is PL_GPT_STYLES.dreamy.${key}, byte for byte`);
  }
  ok(extractHalf('scratchpad.js', 'styleFile', 'const DREAMY') === 'dream-mystery.jpg',
    'DREAMY draws from dream-mystery.jpg');
} catch (e) { ok(false, 'recipe extraction: ' + e.message); }

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP: playwright not installed (npm install playwright --no-save)');
  process.exit(failures ? 1 : 0);
}

const PUB = path.join(__dirname, '..', 'public');
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

// b1 is watercolor-only (goes blank under dreamy); b2 already has a dreamy
// slot (its dreamy picture shows there instead).
let beats = [
  { id: 'b1', url: 'http://127.0.0.1:0/px.png?w1', color: null, text: 'the phone call' },
  { id: 'b2', url: 'http://127.0.0.1:0/px.png?w2', color: null, text: 'the drive home', alt: { dreamy: { url: 'http://127.0.0.1:0/px.png?d2' } } },
];
let padStyle = 'watercolor';
let uploads = [];
const posted = [];        // [path, body]
const dumpUploads = [];   // [query, content-type]

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST' && url.pathname === '/api/drop/upload-file') {
    dumpUploads.push([url.search, req.headers['content-type'] || '']);
    req.resume();
    return req.on('end', () => json({
      ok: true, session: 's1',
      item: { id: 'd1', url: 'http://127.0.0.1:0/up1.mp4', media: 'video', posterUrl: '/px.png?po1' },
    }));
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/style') padStyle = b.style;
      if (url.pathname === '/api/scratchpad/generate') {
        const t = beats.find((x) => x.id === b.id);
        const slot = b.style === 'dreamy' ? ((t.alt = t.alt || {}), (t.alt.dreamy = t.alt.dreamy || {})) : t;
        slot.gen = { status: 'drawing', at: Date.now() };
      }
      if (url.pathname === '/api/scratchpad/upload') {
        uploads = [b.item].concat(uploads.filter((x) => x.url !== b.item.url));
        return json({ ok: true, uploads });
      }
      if (url.pathname === '/api/scratchpad/clip') {
        const c = b.clip || {};
        const beat = { id: 'b' + (beats.length + 1), kind: 'clip', url: c.url, poster: c.poster, title: c.title, color: null };
        beats.splice(Number.isInteger(b.at) ? b.at : beats.length, 0, beat);
      }
      json({ ok: true, beats, style: padStyle });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground', uploads });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'style test', style: padStyle, film: null, audios: [], uploads });
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname.startsWith('/api/story/thumb')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  // The fixture art has to be same-origin so the tiles load; rewrite now the
  // port is known.
  const fix = (u) => u.replace('http://127.0.0.1:0', base);
  beats.forEach((b) => { b.url = fix(b.url); if (b.alt) b.alt.dreamy.url = fix(b.alt.dreamy.url); });

  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await page.goto(base + '/scratchpad.html');
  await page.waitForSelector('#pad .beat');

  // 1 — the account switcher's format, measured
  const tog = await page.evaluate(() => {
    const t = document.getElementById('styletog');
    const cs = getComputedStyle(t);
    const knob = getComputedStyle(t, '::after');
    return {
      a: t.getAttribute('data-a'), w: t.getBoundingClientRect().width,
      h: t.getBoundingClientRect().height, radius: cs.borderRadius,
      knobW: parseFloat(knob.width), knobT: knob.transform,
      row: t.closest('.stylerow').getBoundingClientRect().top
        > document.getElementById('title').getBoundingClientRect().top,
    };
  });
  ok(Math.abs(tog.w - 48) < 0.5 && Math.abs(tog.h - 26) < 0.5 && Math.abs(tog.knobW - 18) < 0.5,
    'the toggle is the account switcher’s 48×26 track with the 18px knob');
  ok(tog.a === '1' && (tog.knobT === 'none' || /matrix\(1, 0, 0, 1, 0,/.test(tog.knobT)),
    'it opens on WATERCOLOR, knob at the near stop');
  ok(tog.row, 'the toggle sits on its own line under the title');
  ok(await page.$eval('#swwater', (el) => el.classList.contains('on')) &&
     !(await page.$eval('#swdreamy', (el) => el.classList.contains('on'))),
    'the lit word is the side the knob is on');

  // 2 — flip to DREAMY: same beats, same words, per-style art
  ok((await page.$$('#pad .beat img')).length === 2, 'both beats show watercolor art before the flip');
  await page.click('#styletog');
  await page.waitForFunction(() => document.getElementById('styletog').getAttribute('data-a') === '2');
  // The knob slides (transition .18s) — wait for it to LAND at the far stop.
  const knobMoved = await page.waitForFunction(() =>
    /matrix\(1, 0, 0, 1, 23,/.test(getComputedStyle(document.getElementById('styletog'), '::after').transform),
  null, { timeout: 3000 }).then(() => true).catch(() => false);
  ok(knobMoved, 'the knob actually moves — 23px to the far stop');
  ok(posted.some(([p, b]) => p === '/api/scratchpad/style' && b.style === 'dreamy'),
    'the flip is saved with POST /style');
  ok((await page.$$('#pad .beat')).length === 2, 'the beats themselves stay — the toggle never touches the order');
  ok((await page.$$('#pad .bcap')).length === 2, 'the writing stays under every beat');
  const arts = await page.$$eval('#pad .beat img', (els) => els.map((e) => e.src));
  ok(arts.length === 1 && arts[0].includes('d2'),
    'a beat with dreamy art shows it; one without goes honestly blank');
  ok(await page.$eval('#swdreamy', (el) => el.classList.contains('on')), 'DREAMY is the lit word now');

  // 3 — the draw box under dreamy: no Sophie card, style on the wire
  await page.click('#pad .beat');   // b1 — blank under dreamy
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(await page.$eval('#popblank', (el) => !el.hidden), 'the blank face shows under dreamy');
  await page.click('#pbdraw');
  await page.waitForSelector('#drawbox:not([hidden])');
  ok(await page.$eval('#dchar', (el) => el.hidden), 'the Sophie card is off the dreamy draw box');
  await page.click('#dgo');
  // The response re-opens the popup on the fresh beat — wait for that
  // repaint before closing, or the close races the reopen.
  await page.waitForFunction(() => {
    const st = document.getElementById('genstate');
    return !st.hidden && /drawing/.test(st.textContent);
  });
  const gen = posted.find(([p]) => p === '/api/scratchpad/generate');
  ok(Boolean(gen) && gen[1].style === 'dreamy' && gen[1].character === false,
    'Draw sends style:dreamy and never the character card');
  await page.mouse.click(5, 5);   // close the popup
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);

  // 4 — + arms the lines; + again un-arms them
  await page.click('#addbtn');
  ok((await page.$$('#pad .slot')).length > 0, '+ arms the placement lines');
  await page.click('#addbtn');
  ok((await page.$$('#pad .slot')).length === 0, '+ again makes the lines disappear');

  // 5 — the phone upload: picker → Dump → /upload → the grid → a clip beat
  await page.click('#inboxbtn');
  await page.waitForSelector('#inbox:not([hidden])');
  ok(await page.$eval('#upbtn', (el) => !el.hidden), 'the add sheet has the upload button');
  ok(await page.$eval('#upfile', (el) => el.accept === 'image/*,video/*' && el.multiple),
    'the picker asks her Photos for movies AND photos, several at once');
  await page.setInputFiles('#upfile', {
    name: 'kitchen dance.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not really a movie'),
  });
  await page.waitForFunction(() => document.querySelectorAll('#inboxgrid button').length === 1);
  ok(dumpUploads.length === 1 && /filename=kitchen(%20|\+)dance\.mp4/.test(dumpUploads[0][0])
     && dumpUploads[0][1] === 'video/mp4',
    'the bytes ride the Dump’s upload-file route, named and typed');
  const up = posted.find(([p]) => p === '/api/scratchpad/upload');
  ok(Boolean(up) && up[1].item.kind === 'clip' && up[1].item.url.includes('up1.mp4')
     && String(up[1].item.poster || '').includes('po1'),
    'the movie is filed on the story as a clip with its poster');
  ok(await page.$eval('#inboxgrid button', (el) => Boolean(el.querySelector('.fmark'))),
    'it tiles in the grid wearing the film mark');
  ok((await page.$$('#inboxgrid video')).length === 0, 'no <video> in the grid');

  // placing it: tap → the lines → a slot → POST /clip
  await page.click('#inboxgrid button');
  await page.waitForSelector('#pad .slot');
  await page.click('#pad .slot');
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 0);
  const placed = posted.find(([p]) => p === '/api/scratchpad/clip');
  ok(Boolean(placed) && placed[1].clip.url.includes('up1.mp4'),
    'placing the movie makes a CLIP beat via POST /clip, never /add');

  await browser.close();
  server.close();
  console.log(failures ? failures + ' FAILED' : 'all good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

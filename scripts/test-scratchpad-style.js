#!/usr/bin/env node
// THE STYLE TOGGLE + THE PHONE UPLOADS + THE + THAT CHANGES ITS MIND
// (Aug 2026, Sophie: "a style toggle at the top of a story that alternates
// between dreamy and watercolor … the same format that the account's toggle
// is" · "if I click the plus button … and then change my mind and click it
// again, the lines between the clips should disappear" · "add clips right
// from my phone into the inbox"; PASTEL added 2026-08-26, "another style in
// the story room called pastel besides watercolor and dreamy").
//
// Pure first: the pad's recipe for EVERY non-watercolor style must be
// byte-for-byte its Playground tile's in server.js — the same keep-the-
// copies-identical rule ART.prefix already lives under. The list is derived
// from scratchpad.js's own STYLE_ART, so a fourth style is covered the day it
// is added and nothing here counts to three.
//
// Then the REAL public/scratchpad.html in headless Chromium against a stub
// API:
//   1. the toggle is the SHARED three-way shell (/tritoggle.css — never a
//      copy), one stop per style with the initial on the knob, on its own
//      line at the top of the story, and a tap LANDS ON THE STOP under it,
//   2. flipping to DREAMY keeps the beats and the words and empties the art
//      that isn't drawn in that style yet — a beat with a dreamy slot shows
//      it, one without goes honestly blank — and POSTs /style,
//   3. a blank beat's draw box under a non-watercolor style hides the Sophie
//      card and sends that style with character off,
//   4. + arms the placement lines; + again un-arms them (the second tap is
//      changing her mind, and it must not need a tap somewhere else),
//   5. the add sheet's upload button feeds the system picker into the Dump's
//      upload-file route, files the result with POST /upload, and a movie
//      tiles at the top of the grid with the film mark and places as a CLIP
//      beat via POST /clip — on the side she is showing, and only there,
//   6. DELETING IS PER SIDE (2026-08-23, Sophie: "if I delete a beat in one
//      of the styles … leave it in the other style cause that one might have
//      an image for that"): with art still on ANY other side the beat keeps
//      its place and its words there and only this side goes — and the box
//      NAMES the sides that keep it; with nothing left anywhere the whole
//      beat goes, exactly as it always did.
//   7. PASTEL is a real third side: flipping to it empties the art, a draw
//      sends style:'pastel', and the film/clip/delete rules all treat it as
//      an equal side.
//
//   node scripts/test-scratchpad-style.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

// ── pure: every pad recipe is its Playground tile's, byte for byte ───
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
// THE LIST IS DERIVED, never typed here: whatever styles the pad carries
// recipes for are the ones checked, so a fourth one cannot ship unchecked.
const padSrc = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
const PAD_STYLES = (() => {
  const at = padSrc.indexOf('const STYLE_ART = {');
  const body = padSrc.slice(at, padSrc.indexOf('\n};', at));
  return [...body.matchAll(/^  (\w+): \{/gm)].map((m) => m[1]);
})();
ok(PAD_STYLES.length >= 2 && PAD_STYLES.includes('dreamy') && PAD_STYLES.includes('pastel'),
  `the pad carries a recipe per style: ${PAD_STYLES.join(', ')}`);
try {
  for (const style of PAD_STYLES) {
    for (const key of ['prefix', 'suffix']) {
      const pad = extractHalf('scratchpad.js', key, `  ${style}: {`);
      const play = extractHalf('server.js', key, `  ${style}: {`);
      ok(pad === play, `${style}.${key} is PL_GPT_STYLES.${style}.${key}, byte for byte`);
    }
  }
  ok(extractHalf('scratchpad.js', 'styleFile', '  dreamy: {') === 'dream-mystery.jpg',
    'DREAMY draws from dream-mystery.jpg');
  // Pastel's references live in STORAGE, which is the one thing that makes it
  // different to wire up — pinned against the Playground's own storageRefs.
  const padPastel = padSrc.slice(padSrc.indexOf('  pastel: {'));
  const srvSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const srvPastel = srvSrc.slice(srvSrc.indexOf('  pastel: {'));
  const files = (t, key) => (t.slice(0, t.indexOf('},')).match(new RegExp(`${key}: \\[([^\\]]*)\\]`)) || [, ''])[1]
    .split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  const a = files(padPastel, 'storageFiles'); const b = files(srvPastel, 'storageRefs');
  ok(a.length === 2 && a.join('|') === b.join('|'),
    'PASTEL attaches the Playground tile\'s own Storage refs: ' + a.join(' + '));
  ok(/whiten: true/.test(padPastel.slice(0, padPastel.indexOf('},'))),
    'PASTEL keeps the whiten pass, like the Playground tile');
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
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
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
        const slot = b.style === 'watercolor' ? t : ((t.alt = t.alt || {}), (t.alt[b.style] = t.alt[b.style] || {}));
        slot.gen = { status: 'drawing', at: Date.now() };
      }
      if (url.pathname === '/api/scratchpad/remove') {
        // Mirrors the real route: art still on the OTHER side → only this
        // side goes (emptied + off); nothing anywhere else → the whole beat.
        const i = beats.findIndex((x) => x.id === b.id);
        const t = beats[i];
        const slot = (st) => (st === 'watercolor' ? t : ((t.alt && t.alt[st]) || {}));
        const keeps = ['watercolor', 'dreamy', 'pastel'].some((st) => st !== b.style && slot(st).url);
        if (keeps) {
          const mine = b.style === 'watercolor' ? t : ((t.alt = t.alt || {}), (t.alt[b.style] = t.alt[b.style] || {}));
          ['url', 'src', 'gen', 'imageHistory', 'kind', 'poster', 'seconds', 'title', 'clipId']
            .forEach((k) => { delete mine[k]; });
          mine.off = true;
          return json({ ok: true, beats, whole: false });
        }
        beats.splice(i, 1);
        return json({ ok: true, beats, whole: true });
      }
      if (url.pathname === '/api/scratchpad/upload') {
        uploads = [b.item].concat(uploads.filter((x) => x.url !== b.item.url));
        return json({ ok: true, uploads });
      }
      if (url.pathname === '/api/scratchpad/clip') {
        // Mirrors the real route: the clip lands in the STYLE's slot — the
        // beat root for watercolor, alt.dreamy under dreamy.
        const c = b.clip || {};
        const fields = { kind: 'clip', url: c.url, poster: c.poster, title: c.title };
        const beat = { id: 'b' + (beats.length + 1), color: null };
        if (b.style === 'watercolor') Object.assign(beat, fields); else beat.alt = { [b.style]: fields };
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
  // express.static serves these in production; without the CSS the toggle
  // renders as a 4px sliver, and without the JS the page falls back to the
  // one-step floor — which would green-light a cycling toggle.
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
  // THE ROOM OPENS ON THE SHELF (2026-08-23, Sophie) — a story is one tap
  // below it, so step into one the way her tap on a tile does.
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beat');

  // 1 — the SHARED three-way shell, measured
  const tog = await page.evaluate(() => {
    const t = document.getElementById('styletog');
    const knob = getComputedStyle(t, '::after');
    const words = [...document.querySelectorAll('.stylerow .sw')].map((b) => b.dataset.style);
    return {
      n: t.getAttribute('data-n'), i: t.getAttribute('data-i'),
      cls: t.className, w: t.getBoundingClientRect().width,
      h: t.getBoundingClientRect().height,
      knobW: parseFloat(knob.width), knobT: knob.transform, knobTxt: knob.content,
      words,
      // the whole row, clear of the injected pill's 56px column
      right: t.closest('.stylerow').getBoundingClientRect().right,
      // The last WORD — not `.sw:last-child`, because the row's last child is
      // the SHAPE button now (2026-08-28) and that selector silently matched
      // nothing the day it landed.
      lastRight: [...document.querySelectorAll('.stylerow .sw')].pop().getBoundingClientRect().right,
      oneLine: [...document.querySelectorAll('.stylerow .sw')]
        .every((b, _, all) => Math.abs(b.getBoundingClientRect().top - all[0].getBoundingClientRect().top) < 1),
      row: t.closest('.stylerow').getBoundingClientRect().top
        > document.getElementById('title').getBoundingClientRect().top,
    };
  });
  ok(/\btri\b/.test(tog.cls) && tog.w > 10 && Math.abs(tog.knobW - 18) < 0.5,
    'the toggle is the shared .tri shell, laid out (18px knob) — the CSS really loaded');
  ok(tog.words.join(',') === 'watercolor,dreamy,pastel',
    'one word per style, in order: ' + tog.words.join(' · '));
  ok(tog.n === '0' && tog.i === 'W' && (tog.knobT === 'none' || /matrix\(1, 0, 0, 1, 0,/.test(tog.knobT)),
    'it opens on WATERCOLOR, knob at the near stop with its initial on it');
  ok(tog.row, 'the toggle sits on its own line under the title');
  ok(tog.oneLine && tog.lastRight <= tog.right + 0.5,
    'all three words fit ONE line inside the pill’s reserved column');
  ok(await page.$eval('#swwater', (el) => el.classList.contains('on')) &&
     !(await page.$eval('#swdreamy', (el) => el.classList.contains('on'))),
    'the lit word is the side the knob is on');

  // 2 — flip to DREAMY: same beats, same words, per-style art.
  // TAPPED AT THE MIDDLE STOP'S OWN COORDINATE, not at the element's centre:
  // clicking the element is what makes a cycling toggle look aimed.
  ok((await page.$$('#pad .beat img')).length === 2, 'both beats show watercolor art before the flip');
  const tapStop = async (n) => {
    const b = await page.$eval('#styletog', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top + r.height / 2, w: r.width };
    });
    await page.mouse.click(b.x + (b.w / 3) * (n + 0.5), b.y);
  };
  await tapStop(1);
  await page.waitForFunction(() => document.getElementById('styletog').getAttribute('data-n') === '1');
  // The knob slides (transition .18s) — wait for it to LAND, don't read it
  // the instant the attribute flips.
  const knobMoved = await page.waitForFunction(() => {
    const m = /matrix\(1, 0, 0, 1, ([\d.]+),/.exec(
      getComputedStyle(document.getElementById('styletog'), '::after').transform);
    return Boolean(m) && parseFloat(m[1]) > 5;
  }, null, { timeout: 3000 }).then(() => true).catch(() => false);
  ok(knobMoved, 'the knob actually moves to the middle stop');
  ok(await page.$eval('#styletog', (el) => el.getAttribute('data-i')) === 'D',
    'the knob wears the style’s initial');
  ok(posted.some(([p, b]) => p === '/api/scratchpad/style' && b.style === 'dreamy'),
    'the flip is saved with POST /style');
  ok((await page.$$('#pad .beat')).length === 2, 'the beats themselves stay — the toggle never touches the order');
  ok((await page.$$('#pad .bcap')).length === 2, 'the writing stays under every beat');
  const arts = await page.$$eval('#pad .beat img', (els) => els.map((e) => e.src));
  ok(arts.length === 1 && arts[0].includes('d2'),
    'a beat with dreamy art shows it; one without goes honestly blank');
  ok(await page.$eval('#swdreamy', (el) => el.classList.contains('on')), 'DREAMY is the lit word now');

  // 2b — a tap on the stop she is ALREADY on does nothing (never a cycle)
  const before2b = posted.filter(([p]) => p === '/api/scratchpad/style').length;
  await tapStop(1);
  await page.waitForTimeout(150);
  ok(posted.filter(([p]) => p === '/api/scratchpad/style').length === before2b
     && await page.$eval('#styletog', (el) => el.getAttribute('data-n')) === '1',
    'tapping the stop it is already on changes nothing — no cycle');

  // 3 — the draw box under dreamy: no Sophie card, style on the wire
  await page.click('#pad .beat');   // b1 — blank under dreamy
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(await page.$eval('#popblank', (el) => !el.hidden), 'the blank face shows under dreamy');
  // The blank tile no longer carries its own star — the ways to art live in
  // ONE row under the picture whether or not there is one (Aug 2026).
  await page.click('#ardraw');
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

  // placing it: tap → the lines → a slot → POST /clip, carrying the style
  await page.click('#inboxgrid button');
  await page.waitForSelector('#pad .slot');
  await page.click('#pad .slot >> nth=-1');   // the last line — the movie goes at the end
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 0);
  const placed = posted.find(([p]) => p === '/api/scratchpad/clip');
  ok(Boolean(placed) && placed[1].clip.url.includes('up1.mp4'),
    'placing the movie makes a CLIP beat via POST /clip, never /add');
  ok(Boolean(placed) && placed[1].style === 'dreamy',
    'the clip carries the style — it lands on the side she is showing');
  await page.waitForFunction(() => document.querySelectorAll('#pad .fmark').length === 1);
  ok(true, 'under dreamy the new beat tiles as the movie (film mark on)');

  // 6 — the movie belongs to the DREAMY side only (2026-08-23, Sophie: "the
  // beats should be added, but the Art should not"): back on watercolor the
  // beat is there and honestly blank.
  await page.click('#swwater');
  await page.waitForFunction(() => document.getElementById('styletog').getAttribute('data-n') === '0');
  ok((await page.$$('#pad .beat')).length === 3, 'the placed beat stays in the order on watercolor');
  ok((await page.$$('#pad .fmark')).length === 0 &&
     (await page.$$eval('#pad .beat img', (els) => els.map((e) => e.src)))
       .every((s) => !s.includes('po1')),
    'but the movie itself is not on the watercolor side — no poster, no film mark');

  // 7 — DELETING IS PER SIDE (2026-08-23, Sophie: "if I delete a beat in one
  // of the styles … leave it in the other style cause that one might have an
  // image for that"). b2 has art on BOTH sides: delete it from watercolor and
  // the beat has to survive, whole, on dreamy.
  const beatCount = () => page.$$eval('#pad .beat, #pad .chunk', (els) => els.length);
  const before = await beatCount();
  ok(before === 3, 'watercolor is showing all three beats to start');
  await page.click('#pad .beatwrap:nth-child(2) .beat');   // b2 — art on both sides
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.click('#delbtn');
  await page.waitForSelector('#delask:not([hidden])');
  const line = await page.$eval('#delline', (el) => el.textContent);
  ok(/from Watercolor/.test(line) && /stays in Dreamy/.test(line),
    'the box says which side is going, and which one keeps it');
  await page.click('#delyes');
  await page.waitForFunction((n) => document.querySelectorAll('#pad .beat, #pad .chunk').length === n - 1, before);
  const rm = posted.find(([p]) => p === '/api/scratchpad/remove');
  ok(Boolean(rm) && rm[1].style === 'watercolor', 'delete carries the side she is on');
  ok(beats.some((b) => b.id === 'b2'), 'the beat itself is NOT thrown away');
  ok((beats.find((b) => b.id === 'b2').text || '') === 'the drive home',
    'its words survive — they belong to both sides');

  await page.click('#swdreamy');
  await page.waitForFunction(() => document.getElementById('styletog').getAttribute('data-n') === '1');
  const dreamySrcs = await page.$$eval('#pad .beat img', (els) => els.map((e) => e.src));
  ok(dreamySrcs.some((s) => s.includes('d2')),
    'on the other side it is still there, with its own picture');

  // and with nothing left on the other side, a delete is a real delete —
  // the movie beat (b3) is dreamy-only, so deleting it here ends the beat.
  const gone = await beatCount();
  await page.click('#pad .beatwrap:nth-child(3) .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.click('#delbtn');
  await page.waitForSelector('#delask:not([hidden])');
  ok(!/stays in/.test(await page.$eval('#delline', (el) => el.textContent)),
    'a beat with nothing on the other side promises no survivor');
  await page.click('#delyes');
  await page.waitForFunction((n) => document.querySelectorAll('#pad .beat, #pad .chunk').length === n - 1, gone);
  ok(!beats.some((b) => b.id === 'b3'), 'that one leaves the pad entirely, as it always did');

  // 7 — PASTEL is a real third side (2026-08-26, Sophie: "another style in
  // the story room called pastel besides watercolor and dreamy"). b1 has
  // watercolor art only, so under pastel it is honestly blank; a draw there
  // sends style:'pastel' with no Sophie card; and its picture belongs to that
  // side alone.
  await page.click('#swpastel');
  await page.waitForFunction(() => document.getElementById('styletog').getAttribute('data-n') === '2');
  ok(await page.$eval('#styletog', (el) => el.getAttribute('data-i')) === 'P'
     && await page.$eval('#swpastel', (el) => el.classList.contains('on')),
    'PASTEL is the third stop, lit and initialled');
  ok(posted.some(([p, b]) => p === '/api/scratchpad/style' && b.style === 'pastel'),
    'the flip to pastel is saved with POST /style');
  ok((await page.$$('#pad .beat img')).length === 0,
    'no beat has pastel art yet — every one is honestly blank');
  ok((await page.$$('#pad .beat')).length === (await page.$$('#pad .bcap')).length,
    'the beats and their words are still there — the toggle never touches them');

  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.click('#ardraw');
  await page.waitForSelector('#drawbox:not([hidden])');
  ok(await page.$eval('#dchar', (el) => el.hidden), 'the Sophie card is off the pastel draw box too');
  await page.click('#dgo');
  await page.waitForFunction(() => {
    const st = document.getElementById('genstate');
    return !st.hidden && /drawing/.test(st.textContent);
  });
  const pgen = posted.filter(([p]) => p === '/api/scratchpad/generate').pop();
  ok(Boolean(pgen) && pgen[1].style === 'pastel' && pgen[1].character === false,
    'Draw sends style:pastel and never the character card');
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);

  // and the delete box NAMES every side that keeps the beat — b2 now has art
  // on watercolor AND dreamy, so from pastel it must name both.
  beats.find((b) => b.id === 'b2').url = fix('http://127.0.0.1:0/px.png?w2');
  await page.evaluate(() => window.load && window.load());
  await page.waitForTimeout(200);
  await page.click('#pad .beatwrap:nth-child(2) .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.click('#delbtn');
  await page.waitForSelector('#delask:not([hidden])');
  const pline = await page.$eval('#delline', (el) => el.textContent);
  ok(/from Pastel/.test(pline) && /Watercolor/.test(pline) && /Dreamy/.test(pline),
    'the box names EVERY side that keeps it: ' + pline.trim());
  await page.click('#delno');

  await browser.close();
  server.close();
  console.log(failures ? failures + ' FAILED' : 'all good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

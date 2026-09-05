#!/usr/bin/env node
// test-filmeditor-timeline.js — the Film Editor's TIMELINE as a time axis,
// measured on a cut the size of Sophie's real ones (2026-09-05: photographed
// on her 14- and 16-piece cuts, every tile drew at its 34px min-width whether
// the piece was 1s or 15.5s, the same 4.2s sound drew 31px in one place and
// 53px in another, the playhead ran off the right of the screen from the
// tenth piece on, and a chat-written piece with poster:null was a blank grey
// box labelled "00:0"). The existing page test uses 2-4 pieces and never saw
// any of it, so this one uses 16 of mixed length and a dozen sounds:
//   - MEASURED tile widths are proportional to the pieces' seconds (a 0.5s
//     sliver keeps the 24px tap floor and its label drops to the number)
//   - a sound bar's x and width are xOfTime of its real start and length,
//     read off the tiles' real boxes, and equal lengths draw equal widths
//     wherever they start
//   - seeking to the last piece SCROLLS #tlwrap so the playhead is in view;
//     play carries the strip along; a drag of hers is never fought
//   - a poster arriving on the proxies answer lands on its tile's background
//     without the strip being rebuilt; until then the tile wears the film glyph
// Run: node scripts/test-filmeditor-timeline.js  (skips cleanly without playwright)
// Verified failing 19 against the pre-fix page (8 passed, 19 failed).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const servePublic = require('./lib/public-asset');

let pw = null;
try { pw = require('playwright'); } catch { /* not installed here */ }
if (!pw) { console.log('timeline tests skipped — playwright not installed'); process.exit(0); }

const exe = (() => {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((x) => /^chromium-\d/.test(x))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
})();

let pass = 0;
let failCount = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok — ' + name); }
  else { failCount++; console.log('  FAIL — ' + name); }
}

(async () => {
  const FF = require('ffmpeg-static');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-tl-'));
  // WebM/VP8 — playwright's Chromium has no H.264/AAC (see test-filmeditor-page.js)
  const mk = (name, hue, secs) => {
    const f = path.join(dir, name);
    execFileSync(FF, ['-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `color=c=${hue}:size=320x240:rate=30:duration=${secs}`,
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`,
      '-c:v', 'libvpx', '-b:v', '200k', '-c:a', 'libvorbis', '-shortest', f]);
    return fs.readFileSync(f);
  };
  const vidShort = mk('a.webm', 'tomato', 2);
  const vidLong = mk('long.webm', 'teal', 16);
  const pngS = path.join(dir, 's.png');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gold:size=320x240', '-frames:v', '1', pngS]);
  const imgS = fs.readFileSync(pngS);
  const oggF = path.join(dir, 't.ogg');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=520:duration=6', '-c:a', 'libvorbis', oggF]);
  const audT = fs.readFileSync(oggF);

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'filmeditor.html'), 'utf8');
  const FX = 'https://forge.test/fx/';
  // 16 pieces of mixed length, 0.5s to 15s — the shape of her real cuts.
  // Anything over 2s cuts out of the 16s file; poster:null on every clip,
  // exactly as a chat writes them.
  const DURS = [0.5, 15, 1, 2, 4.5, 0.8, 3, 1.2, 6, 2.5, 1.5, 8, 0.6, 3.3, 2, 10];
  const clips = DURS.map((d, i) => {
    if (i === 3 || i === 12) {   // two STILLS among them
      return { key: 'p' + i, kind: 'image', url: FX + 's.png', title: 'still ' + i, poster: null, seconds: null, in: 0, out: d, mute: true, gain: 0 };
    }
    const file = d > 2 ? 'long.webm' : 'a.webm';
    return { key: 'p' + i, kind: 'video', url: FX + file, title: 'clip ' + i, poster: null, seconds: d > 2 ? 16 : 2, in: 0, out: d, mute: false, gain: 0 };
  });
  const total = DURS.reduce((a, b) => a + b, 0);
  const snd = (key, name, at, secs, extra) => Object.assign({ key, url: FX + 't.ogg', name, seconds: secs, in: 0, out: secs, at, gain: 0, fadeIn: 0, fadeOut: 0, mute: false, anchor: null }, extra || {});
  // a dozen sounds: a bed, a pair of EQUAL 3s sounds at very different
  // places (one over the 15s shot, one over the 0.5s+1s+2s run), six 1s
  // lines stacked over one 4.5s shot, and a few more
  const sounds = [
    snd('bed', 'music bed', 0, 6),
    snd('eqA', 'whoosh A', 2, 3),
    snd('eqB', 'whoosh B', 17, 3),
    snd('v1', 'line 1', 19.5, 1), snd('v2', 'line 2', 20.2, 1), snd('v3', 'line 3', 20.9, 1),
    snd('v4', 'line 4', 21.6, 1), snd('v5', 'line 5', 22.3, 1), snd('v6', 'line 6', 23.0, 1),
    snd('hit', 'hit', 30, 0.4),
    snd('tail', 'tail', 40, 5),
    snd('end', 'ending', total - 4, 4),
  ];
  const DOC = { id: 'tl1', title: 'Sixteen pieces', clips, sounds, renders: [], job: null, updatedAt: 1000 };
  const DOCS = { tl1: DOC };

  let PROX = {};
  let PROX_DELAY = 0;   // ms to hold the proxies answer — the poster arrives AFTER the strip is built
  let upd = 1000;

  const serveMedia = (route, contentType, body) => {
    const m = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? Math.min(parseInt(m[2], 10), body.length - 1) : body.length - 1;
      return route.fulfill({
        status: 206, contentType,
        headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}` },
        body: body.slice(start, end + 1),
      });
    }
    return route.fulfill({ contentType, headers: { 'accept-ranges': 'bytes' }, body });
  };
  const viaPublic = (route) => {
    const u = new URL(route.request().url());
    let head = null, body = null;
    const hit = servePublic({ url: u.pathname + u.search },
      { writeHead(s, h) { head = { s, h }; }, end(b) { body = b; } });
    if (!hit) return false;
    route.fulfill({ status: head.s, headers: { 'content-type': head.h['Content-Type'] }, body });
    return true;
  };
  const json = (route, obj, status) => route.fulfill({ status: status || 200, contentType: 'application/json', body: JSON.stringify(obj) });

  const browser = await pw.chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const routeHandler = (route) => {
    const req = route.request();
    const u = req.url();
    const post = () => { try { return JSON.parse(req.postData() || '{}'); } catch { return {}; } };
    if (u.includes('/fx/a.webm')) return serveMedia(route, 'video/webm', vidShort);
    if (u.includes('/fx/long.webm')) return serveMedia(route, 'video/webm', vidLong);
    if (u.includes('/fx/s.png') || u.includes('/api/story/thumb')) return route.fulfill({ contentType: 'image/png', body: imgS });
    if (u.includes('/fx/t.ogg')) return serveMedia(route, 'audio/ogg', audT);
    if (u.includes('/api/filmeditor/proxies')) {
      const answer = () => json(route, { proxies: PROX, audio: {} });
      if (PROX_DELAY) { const wait = PROX_DELAY; PROX_DELAY = 0; return new Promise((r) => setTimeout(r, wait)).then(answer); }
      return answer();
    }
    if (u.includes('/api/filmeditor/telemetry')) return json(route, { ok: true });
    if (u.includes('/api/filmeditor/build')) return json(route, { build: 'match-me' });
    const m = /\/api\/filmeditor\/(tl\d+)(\/[a-z]+)?/.exec(u);
    if (m && DOCS[m[1]]) {
      const sub = m[2] || '';
      if (sub === '/pieces') { post(); upd += 1; return json(route, { ok: true, updatedAt: upd, doc: null }); }
      if (sub === '/job') return json(route, { job: null, renders: [] });
      return json(route, DOCS[m[1]]);
    }
    if (u.includes('/filmeditor')) return route.fulfill({ contentType: 'text/html', body: html });
    if (viaPublic(route)) return;
    return route.fulfill({ status: 404, body: '' });
  };
  await page.route('**/*', routeHandler);
  const openCut = async (pg, id) => {
    await pg.goto('http://forge.test/filmeditor?c=' + id);
    await pg.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  };
  // the geometry, MEASURED off the real boxes: every tile's width, the lane's
  // origin, and an xOfTime of the test's own (never the page's) built from
  // the tiles' rects — the same rule the page claims to follow
  const measure = () => page.evaluate((durs) => {
    const wrap = document.getElementById('tlwrap');
    const lane = document.getElementById('lane');
    const lr = lane.getBoundingClientRect();
    const tiles = [...document.querySelectorAll('.seg')].map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left - lr.left, width: r.width, lbl: el.querySelector('.lbl').textContent,
        bg: el.style.backgroundImage || '', glyph: (() => { const g = el.querySelector('.fg'); return g ? getComputedStyle(g).display : 'absent'; })(),
        mark: el.__mark || 0 };
    });
    let t0 = 0;
    const axis = tiles.map((t, i) => { const a = { start: t0, dur: durs[i], left: t.left, width: t.width }; t0 += durs[i]; return a; });
    const xOf = (t) => {
      for (let i = 0; i < axis.length; i++) {
        const a = axis[i];
        if (t < a.start + a.dur - 1e-4 || i === axis.length - 1) return a.left + Math.min(1, (t - a.start) / a.dur) * a.width;
      }
      return 0;
    };
    const bars = [...document.querySelectorAll('.snd')].map((el) => {
      const r = el.getBoundingClientRect();
      return { key: el.getAttribute('data-key'), x: r.left - lr.left, w: r.width, top: r.top - lr.top };
    });
    const ph = document.getElementById('lph').getBoundingClientRect();
    const padL = parseFloat(getComputedStyle(wrap).paddingLeft);
    return {
      tiles, bars, xOf: { s2: xOf(2), s5: xOf(5), s17: xOf(17), s20: xOf(20), s40: xOf(40), s45: xOf(45), last: xOf(t0 - 0.001) },
      scrollLeft: wrap.scrollLeft, scrollWidth: wrap.scrollWidth, vis: wrap.clientWidth, padL,
      phRel: ph.left - wrap.getBoundingClientRect().left,   // the playhead line against the scroller's box
      stripW: document.getElementById('strip').getBoundingClientRect().width,
      laneW: lane.getBoundingClientRect().width,
    };
  }, DURS);

  console.log('a true time axis:');
  await openCut(page, 'tl1');
  await page.waitForTimeout(500);
  let g = await measure();
  ok(g.tiles.length === 16, 'sixteen pieces on the strip');
  // pps read off the 15s tile; every unfloored tile must sit on the same line
  const pps = g.tiles[1].width / 15;
  const unfloored = g.tiles.map((t, i) => ({ t, d: DURS[i] })).filter((x) => x.d * pps >= 24.5);
  const off = unfloored.map((x) => Math.abs(x.t.width / x.d - pps) / pps);
  ok(pps >= 39.5 && pps <= 41, 'the 15s piece sets the scale at ~40 px/s (' + pps.toFixed(2) + ')');
  ok(unfloored.length >= 13 && Math.max(...off) < 0.03,
    'every tile\'s MEASURED width is its seconds x that scale (worst off by ' + (Math.max(...off) * 100).toFixed(1) + '%)');
  ok(g.tiles[1].width > g.tiles[2].width * 10, 'a 15s tile is over ten times a 1s tile (was 34px each)');
  ok(g.tiles[0].width >= 24 && g.tiles[0].width < 26 && g.tiles[0].lbl === '01',
    'the 0.5s sliver keeps the 24px tap floor and shows its number alone (' + g.tiles[0].width.toFixed(1) + 'px, "' + g.tiles[0].lbl + '")');
  ok(g.tiles[1].lbl === '02 · 00:15.00', 'a wide tile carries the full label (' + g.tiles[1].lbl + ')');
  ok(g.tiles[2].lbl === '03', 'a 1s tile at 40px shows the number alone, measured (' + g.tiles[2].lbl + ')');
  ok(g.stripW > g.vis * 5 && g.scrollWidth > g.vis,
    'the strip is really wider than the scroller (' + g.stripW.toFixed(0) + 'px in ' + g.vis + ') and it scrolls');
  ok(Math.abs(g.laneW - g.stripW) < 3, 'the lane is as wide as the strip (' + g.laneW.toFixed(0) + ' vs ' + g.stripW.toFixed(0) + ')');

  console.log('the sounds sit on the axis:');
  const bar = (k) => g.bars.find((b) => b.key === k);
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  ok(near(bar('eqA').x, g.xOf.s2, 1.5) && near(bar('eqA').x + bar('eqA').w, g.xOf.s5, 1.5),
    'a 3s sound at 2s spans xOfTime(2)..xOfTime(5) off the real tiles (x ' + bar('eqA').x.toFixed(1) + ', w ' + bar('eqA').w.toFixed(1) + ')');
  ok(near(bar('eqB').x, g.xOf.s17, 1.5) && near(bar('eqB').x + bar('eqB').w, g.xOf.s20, 1.5),
    'and the one at 17s spans xOfTime(17)..xOfTime(20) (x ' + bar('eqB').x.toFixed(1) + ', w ' + bar('eqB').w.toFixed(1) + ')');
  ok(Math.abs(bar('eqA').w - bar('eqB').w) / bar('eqA').w < 0.08,
    'two 3s sounds are the SAME width wherever they start (' + bar('eqA').w.toFixed(1) + ' vs ' + bar('eqB').w.toFixed(1) + ')');
  ok(near(bar('tail').x, g.xOf.s40, 1.5) && near(bar('tail').x + bar('tail').w, g.xOf.s45, 1.5),
    'a 5s sound at 40s lands on xOfTime(40)..xOfTime(45), past a dozen tiles');
  const lines = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map(bar);
  ok(lines.every((b) => b.w >= 38), 'six 1s lines over a 4.5s shot draw at true length, ~40px each, not 24px stubs (' + lines.map((b) => b.w.toFixed(0)).join(',') + ')');
  const overlap = (a, b) => a.top === b.top && a.x < b.x + b.w && b.x < a.x + a.w;
  let clash = 0;
  for (let i = 0; i < g.bars.length; i++) for (let j = i + 1; j < g.bars.length; j++) if (overlap(g.bars[i], g.bars[j])) clash++;
  ok(clash === 0, 'no two bars overlap on one row (the packer over real x\'s)');

  console.log('the strip follows the playhead:');
  ok(g.scrollLeft === 0 && g.phRel >= g.padL - 1 && g.phRel <= g.vis, 'a fresh cut opens at its top with the line in view');
  await page.$$eval('.seg', (els) => els[els.length - 1].click());   // the last piece — off the right, no scroll of hers
  await page.waitForTimeout(300);
  g = await measure();
  ok(g.scrollLeft > g.vis && g.phRel >= 0 && g.phRel <= g.vis,
    'seeking to the last piece scrolls the strip so the playhead is IN VIEW (scrollLeft ' + g.scrollLeft.toFixed(0) + ', line at ' + g.phRel.toFixed(0) + ' of ' + g.vis + ')');
  ok(Math.abs(g.phRel - g.vis / 2) < g.vis / 4, 'a seek centres it (' + g.phRel.toFixed(0) + ' ≈ ' + (g.vis / 2).toFixed(0) + ')');
  const before = g.scrollLeft;
  await page.click('#backSec');
  await page.waitForTimeout(200);
  g = await measure();
  ok(g.scrollLeft === before && g.phRel >= 0 && g.phRel <= g.vis, 'a step that stays in view does not move the strip');
  // her own finger wins: a drag of the strip, then a step — no auto-scroll for 1.5s
  await page.evaluate(() => {
    const w = document.getElementById('tlwrap');
    w.dispatchEvent(new Event('touchmove', { bubbles: true }));
    w.scrollLeft = 0;
  });
  await page.waitForTimeout(150);
  await page.click('#backSec');
  await page.waitForTimeout(200);
  g = await measure();
  ok(g.scrollLeft < 5, 'a step right after she dragged the strip leaves it where she put it (scrollLeft ' + g.scrollLeft.toFixed(0) + ')');
  await page.waitForTimeout(1600);
  await page.click('#fwdSec');
  await page.waitForTimeout(200);
  g = await measure();
  ok(g.scrollLeft > g.vis && g.phRel >= 0 && g.phRel <= g.vis, 'and 1.5s later a step brings the playhead back into view');
  // during play: seek to a point, the window's right edge is ~4.5s ahead at
  // 40px/s; play 6s and the strip must have carried the line along
  await page.$$eval('.seg', (els) => els[6].click());   // piece 7, 3s, starts at 23.8s
  await page.waitForTimeout(300);
  const g0 = await measure();
  await page.click('#play');
  await page.waitForTimeout(6000);
  g = await measure();
  await page.click('#play');
  ok(g.scrollLeft > g0.scrollLeft + 100 && g.phRel >= 0 && g.phRel <= g.vis,
    'while playing, the strip scrolls along and the line stays on screen (scrollLeft ' + g0.scrollLeft.toFixed(0) + ' → ' + g.scrollLeft.toFixed(0) + ', line at ' + g.phRel.toFixed(0) + ')');

  console.log('posters:');
  ok(g.tiles[2].glyph === 'flex' && g.tiles[2].bg === '', 'a video tile with no poster wears the film glyph, not a blank box');
  ok(g.tiles[3].glyph === 'absent' && /s\.png/.test(g.tiles[3].bg), 'a still shows its own picture');
  PROX = { [FX + 'long.webm']: { status: 'ready', proxyUrl: FX + 'long.webm', poster: FX + 's.png' } };
  PROX_DELAY = 900;   // the strip is built first; the poster lands after
  await openCut(page, 'tl1');
  await page.$$eval('.seg', (els) => els.forEach((el) => { el.__mark = 1; }));
  await page.waitForTimeout(1400);
  g = await measure();
  const longIdx = DURS.map((d, i) => i).filter((i) => DURS[i] > 2 && i !== 3 && i !== 12);
  ok(longIdx.every((i) => /s\.png/.test(g.tiles[i].bg) && g.tiles[i].glyph === 'none'),
    'a poster from the proxies answer lands on every tile of that source and the glyph goes');
  ok(g.tiles.every((t) => t.mark === 1), 'without the strip being rebuilt (the same elements)');
  ok(g.tiles[2].glyph === 'flex' && g.tiles[2].bg === '', 'a source with no poster yet still wears the glyph');

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('');
  console.log(pass + ' passed, ' + failCount + ' failed');
  process.exit(failCount ? 1 : 0);
})().catch((e) => { console.error('test crashed —', e.message); process.exit(1); });

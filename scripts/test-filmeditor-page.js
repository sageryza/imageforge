#!/usr/bin/env node
// test-filmeditor-page.js — the Film Editor's PLAYBACK ENGINE, driven for real:
// headless Chromium plays actual generated videos through the real page, so
// the bugs Sophie kept finding by hand get found here first. Every assertion
// is pinned to a live report or a real regression:
//   - the pause icon (SVG .hidden property is a dead expando — 2026-08-22)
//   - the playhead line draws and MOVES with the picture
//   - crossing a source boundary keeps playing (two-element swap)
//   - the film STOPS at the end (the last-clip-forever loop)
//   - pressing play again starts clean (the stale-clock leap)
//   - split → play still runs through and stops
//   - a refused trim says why
//   - a joint NEVER seeks the element on screen (the little-pauses chop,
//     2026-08-23) — measured by counting `seeking` events on the visible
//     element mid-play, across a source swap, a split, and a same-source jump
//   - TWO LANES (2026-09-02): a still plays — its own picture until the baked
//     proxy is ready, then the proxy through the two-video player; a sound
//     bar selects and the tool row relabels; sync moves the bar to the
//     playhead's x AND the saved `at`; level −/+ moves the stored gain and the
//     element's volume; two sounds play at once; ride anchors a sound and it
//     follows its shot through a reorder; a 409 reloads the chat's doc and
//     says so; the films sheet says who made each render; the Dump door; and
//     the whole thing is ONE SCREEN at 390x700 with no scroll and no pill.
// Run: node scripts/test-filmeditor-page.js  (skips cleanly without playwright)
//
// MEDIA FIXTURES MUST BE SERVED WITH RANGE SUPPORT (serveMedia below).
// route.fulfill with a plain 200 makes Chromium report seekable [0,0], so
// every currentTime write silently clamps to 0 — the player restarts pieces
// from the top and no seek assertion measures anything real (found
// 2026-08-23, while these tests were green over exactly that behaviour).
//
// SHARED FILES GO THROUGH scripts/lib/public-asset.js (viaPublic below) —
// /cut-model.js, /tool.css and /house.css are served exactly as the real
// server serves them, so the page under test is the page she gets and the
// one-screen numbers are measured against the real chrome.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const servePublic = require('./lib/public-asset');

let pw = null;
try { pw = require('playwright'); } catch { /* not installed here */ }
if (!pw) { console.log('page tests skipped — playwright not installed'); process.exit(0); }

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
  // ── fixtures: tiny real videos, different colors, with sound; a still and
  // its "baked 60s proxy"; two sounds ──
  const FF = require('ffmpeg-static');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-test-'));
  // WebM/VP8 — playwright's Chromium ships WITHOUT the proprietary H.264/AAC
  // decoders, so an mp4 fixture never plays and every playback assertion
  // fails for the wrong reason (measured 2026-08-22)
  const mk = (name, hue, freq, secs) => {
    const f = path.join(dir, name);
    const args = ['-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `color=c=${hue}:size=320x240:rate=30:duration=${secs || 2}`];
    if (freq) args.push('-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${secs || 2}`);
    args.push('-c:v', 'libvpx', '-b:v', '200k');
    if (freq) args.push('-c:a', 'libvorbis', '-shortest'); else args.push('-an');
    args.push(f);
    execFileSync(FF, args);
    return fs.readFileSync(f);
  };
  const vidA = mk('a.webm', 'tomato', 440);
  const vidB = mk('b.webm', 'teal', 660);
  const vidStill = mk('still.webm', 'gold', 0, 6);   // the still's baked proxy: silent, longer than any hold
  const pngS = path.join(dir, 's.png');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gold:size=320x240', '-frames:v', '1', pngS]);
  const imgS = fs.readFileSync(pngS);
  const mkAud = (name, freq) => {
    const f = path.join(dir, name);
    execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=6`,
      '-c:a', 'libvorbis', f]);
    return fs.readFileSync(f);
  };
  const audT = mkAud('t.ogg', 520);
  const audU = mkAud('u.ogg', 300);

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'filmeditor.html'), 'utf8');
  const FX = 'https://forge.test/fx/';
  const clip = (key, file, title, tIn, tOut) => ({ key, kind: 'video', url: FX + file, title, poster: null, seconds: 2, in: tIn || 0, out: tOut == null ? 2 : tOut, mute: false, gain: 0 });
  const still = (key, hold) => ({ key, kind: 'image', url: FX + 's.png', title: 'gold still', poster: null, seconds: null, in: 0, out: hold, mute: true, gain: 0 });
  const sound = (key, file, name, extra) => Object.assign({ key, url: FX + file, name, seconds: 6, in: 0, out: 6, at: 0, gain: 0, fadeIn: 0, fadeOut: 0, mute: false, anchor: null }, extra || {});
  const docOf = (id, title, clips, extra) => Object.assign({ id, title, clips, sounds: [], renders: [], job: null, updatedAt: 1000 }, extra || {});

  const DOC = docOf('t1', 'Test cut', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal')]);
  const DOC2 = docOf('t2', 'Empty cut', []);
  // TRIMMED pieces on purpose (out < the file's end): the joint then fires
  // mid-file, while a lagging playhead is still behind real time — the exact
  // shape that made the old drift guard yank the music backward on the phone.
  // And its music is the LEGACY single `audio` field — an old doc must open
  // with that track as its first sound.
  const DOC3 = { id: 't3', title: 'Cut with music',
    clips: [clip('pA', 'a.webm', 'red', 0, 1.8), clip('pB', 'b.webm', 'teal', 0, 1.8)],
    audio: { url: FX + 't.ogg', name: 'song', offset: 0 }, renders: [], job: null, updatedAt: 1000 };
  // ONE source with the middle trimmed out — her core flow, and a joint that
  // is a JUMP inside the same file: it must swap to the parked idle element,
  // never seek the one on screen.
  const DOC4 = docOf('t4', 'Middle out', [clip('j1', 'a.webm', 'a1', 0, 0.8), clip('j2', 'a.webm', 'a2', 1.4, 2)]);
  // two clips with a STILL between them, held 1.5s
  const DOC5 = docOf('t5', 'With a still', [clip('pA', 'a.webm', 'red'), still('st', 1.5), clip('pB', 'b.webm', 'teal')]);
  // one sound at the top, for the sound tools
  const DOC6 = docOf('t6', 'One sound', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal')],
    { sounds: [sound('s1', 't.ogg', 'song')] });
  // two sounds overlapping — both must play at once
  const DOC7 = docOf('t7', 'Two sounds', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal')],
    { sounds: [sound('s1', 't.ogg', 'song'), sound('s2', 'u.ogg', 'hum', { at: 0.5 })] });
  // the chat changes this cut under her: the first save is refused 409
  const DOC8 = docOf('t8', 'Contested', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal')]);
  const DOC8_CHAT = docOf('t8', 'Contested', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal'), clip('pC', 'a.webm', 'red again')],
    { sounds: [sound('sx', 't.ogg', 'the chat’s bed')], updatedAt: 2000 });
  // versions: the chat's render is newest and newer than any visit here
  const DOC9 = docOf('t9', 'Versioned', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal')], {
    renders: [
      { url: FX + 'b.webm', at: new Date().toISOString(), by: 'chat', seconds: 4, cut: { clips: DOC.clips, sounds: [] } },
      { url: FX + 'a.webm', at: new Date(Date.now() - 3600e3).toISOString(), by: 'sophie', seconds: 4, pieces: 2 },
    ],
  });
  // the Dump door
  const DOC10 = docOf('t10', 'From the Dump', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal')]);
  // ride: the sound sits inside piece B (2.5s in), then B moves first
  const DOC11 = docOf('t11', 'Ride', [clip('pA', 'a.webm', 'red'), clip('pB', 'b.webm', 'teal')],
    { sounds: [sound('s1', 't.ogg', 'scream', { at: 2.5, seconds: 2, out: 2 })] });
  const DOCS = { t1: DOC, t2: DOC2, t3: DOC3, t4: DOC4, t5: DOC5, t6: DOC6, t7: DOC7, t8: DOC8, t9: DOC9, t10: DOC10, t11: DOC11 };

  let PROX = {};      // what /proxies answers — flipped per scenario
  let AUDPROX = {};   // the audio-proxy half of the same answer
  let AUD_DELAY = 0;  // ms to hold the audio fixture's next response — the late-start shape
  const TELEMETRY = [];   // every play-session beacon the page posts
  const SAVES = {};       // every /pieces body the page posts, per cut
  const RENDERS = [];     // every /render body
  let SERVER_BUILD = 'match-me';   // what /build answers — flipped to test the self-heal
  let STALE_ONCE = false;          // the next /pieces on t8 is refused with the chat's doc
  let upd = 1000;

  // Serve media like a real server: honoring Range. A bare route.fulfill 200
  // leaves Chromium's `seekable` at [0,0] and every seek clamps to 0.
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
  // the house helper speaks node's http — hand it a tiny req/res and fulfill
  // the route with what it wrote. A file it does not know falls through.
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
    if (u.includes('/fx/a.webm')) return serveMedia(route, 'video/webm', vidA);
    if (u.includes('/fx/b.webm')) return serveMedia(route, 'video/webm', vidB);
    if (u.includes('/fx/still.webm')) return serveMedia(route, 'video/webm', vidStill);
    if (u.includes('/fx/s.png') || u.includes('/api/story/thumb')) return route.fulfill({ contentType: 'image/png', body: imgS });
    if (u.includes('/api/filmeditor/proxies')) return json(route, { proxies: PROX, audio: AUDPROX });
    if (u.includes('/fx/t.ogg')) {
      // AUD_DELAY holds the track's FIRST byte back — the "starts late" shape
      // (Sophie, 2026-08-23): the film rolls while the music is still fetching.
      if (AUD_DELAY) {
        const wait = AUD_DELAY; AUD_DELAY = 0;
        return new Promise((r) => setTimeout(r, wait)).then(() => serveMedia(route, 'audio/ogg', audT));
      }
      return serveMedia(route, 'audio/ogg', audT);
    }
    if (u.includes('/fx/t2.ogg')) return serveMedia(route, 'audio/ogg', audT);
    if (u.includes('/fx/u.ogg')) return serveMedia(route, 'audio/ogg', audU);
    if (u.includes('/api/filmeditor/telemetry')) {
      TELEMETRY.push(post());
      return json(route, { ok: true });
    }
    if (u.includes('/api/filmeditor/build')) return json(route, { build: SERVER_BUILD });
    if (u.includes('/api/assembly/sources')) {
      return json(route, { albums: [{ album: 'alb', name: 'Dinner party', images: 1, videos: 1, cover: FX + 's.png' }] });
    }
    if (u.includes('/api/drop/items')) {
      return json(route, { items: [
        { id: 'd1', url: FX + 's.png', media: 'image', photoIndex: 0, name: 'the table' },
        { id: 'd2', url: FX + 'still.webm', media: 'video', posterUrl: null, photoIndex: 1, name: 'toast' },
        { id: 'd3', url: FX + 'x.m4a', media: 'audio', photoIndex: 2, name: 'a voice note' },
      ] });
    }
    const m = /\/api\/filmeditor\/(t\d+)(\/[a-z]+)?/.exec(u);
    if (m && DOCS[m[1]]) {
      const id = m[1], sub = m[2] || '';
      if (sub === '/pieces') {
        const body = post();
        (SAVES[id] = SAVES[id] || []).push(body);
        if (id === 't8' && STALE_ONCE) { STALE_ONCE = false; return json(route, { error: 'stale', doc: DOC8_CHAT }, 409); }
        upd += 1;
        return json(route, { ok: true, updatedAt: upd, doc: null });
      }
      if (sub === '/render') { RENDERS.push(post()); return json(route, { ok: true, status: 'rendering' }); }
      if (sub === '/job') return json(route, { job: null, renders: DOCS[id].renders || [] });
      return json(route, DOCS[id]);
    }
    if (u.includes('/filmeditor')) return route.fulfill({ contentType: 'text/html', body: html });
    if (viaPublic(route)) return;
    return route.fulfill({ status: 404, body: '' });
  };
  await page.route('**/*', routeHandler);

  const disp = (id) => page.$eval('#' + id, (el) => getComputedStyle(el).display);
  const tc = () => page.$eval('#tc', (el) => el.textContent);
  const playing = () => page.evaluate(() => {
    const a = document.getElementById('vA');
    const b = document.getElementById('vB');
    return (!a.hidden && !a.paused) || (!b.hidden && !b.paused);
  });
  const lastSave = (id) => (SAVES[id] || [])[(SAVES[id] || []).length - 1];
  const openCut = async (pg, id) => {
    await pg.goto('http://forge.test/filmeditor?c=' + id);
    await pg.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  };

  console.log('the editor opens on a real cut:');
  await openCut(page, 't1');
  ok(await page.evaluate(() => typeof window.CutModel === 'object' && typeof window.CutModel.soundStart === 'function'),
    '/cut-model.js is loaded through the real shared-file route (public-asset.js)');
  ok((await page.$$('.seg')).length === 2, 'two pieces on the timeline');
  ok(await page.$eval('.seg .ph', (el) => !el.hidden && el.offsetHeight > 0),
    'the playhead line is VISIBLE in the first piece');
  ok((await disp('pauseIco')) === 'none' && (await disp('playIco')) !== 'none',
    'idle shows the play icon');

  // The joint discipline (2026-08-23, "little pauses between all the clips"):
  // the element ON SCREEN must never seek — that decoder flush is the visible
  // hiccup. The warm element parks itself with hidden seeks, which are fine.
  const armSeekCounter = () => page.evaluate(() => {
    window.__visSeeks = 0;
    ['vA', 'vB'].forEach((id) => {
      const el = document.getElementById(id);
      if (el.__seekCounted) return;
      el.__seekCounted = true;
      el.addEventListener('seeking', () => { if (!el.hidden) window.__visSeeks++; });
    });
  });
  const visSeeks = () => page.evaluate(() => window.__visSeeks);

  console.log('play:');
  await page.waitForTimeout(400);   // the open's own seek + warm settle first
  await armSeekCounter();
  ok(await page.evaluate(() => {
    const a = document.getElementById('vA');
    const b = document.getElementById('vB');
    const idle = a.hidden ? a : b;
    return idle.getAttribute('data-src') === 'https://forge.test/fx/b.webm' && idle.muted;
  }), 'the idle element is PARKED on the next source, muted, before play');
  await page.click('#play');
  await page.waitForTimeout(500);
  ok((await disp('pauseIco')) !== 'none' && (await disp('playIco')) === 'none',
    'the button becomes a PAUSE button while playing (the SVG-hidden bug)');
  const t1 = await tc();
  await page.waitForTimeout(700);
  ok((await tc()) !== t1, 'the timecode advances — it is actually playing');
  ok(await playing(), 'a video element is really unpaused');

  console.log('the boundary and the end:');
  await page.waitForFunction(() => {
    const segs = document.querySelectorAll('.seg');
    const ph = segs[1] && segs[1].querySelector('.ph');
    return ph && !ph.hidden;
  }, { timeout: 6000 }).catch(() => {});
  ok(await page.$$eval('.seg', (els) => els[1] && !els[1].querySelector('.ph').hidden),
    'the playhead crosses into the second piece (source swap survives)');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 8000 }).catch(() => {});
  ok((await disp('playIco')) !== 'none', 'the film STOPS at the end (no last-clip loop)');
  const swapSeeks = await visSeeks();
  ok(swapSeeks === 0,
    'the source swap never seeks the element on screen (visible seeks: ' + swapSeeks + ')');
  const tcEnd = await tc();
  await page.waitForTimeout(900);
  ok((await tc()) === tcEnd && !(await playing()), 'and STAYS stopped');

  console.log('play again after stopping:');
  await page.click('#play');
  await page.waitForTimeout(600);
  const t2 = await tc();
  ok(/^00:00\.|^00:01\./.test(t2) && (await disp('pauseIco')) !== 'none',
    'restarts from the top, no stale-clock leap (was ' + t2.split(' ')[0] + ')');
  await page.click('#play');   // pause for the editing checks
  await page.waitForTimeout(200);

  console.log('the tools:');
  await page.$$eval('.seg', (els) => els[0].click());   // playhead → piece 1 start
  await page.waitForTimeout(200);
  await page.click('#trimOutBtn');   // out at the piece's start = a sliver, refused
  ok((await page.$eval('#msg', (el) => el.textContent.trim().length)) > 0,
    'a refused trim says why in the quiet line');
  await page.click('#fwdSec');   // step 1s into piece 1
  await page.waitForTimeout(150);
  await page.click('#splitBtn');
  await page.waitForTimeout(900);
  ok((await page.$$('.seg')).length === 3, 'split makes three pieces');
  const sv = lastSave('t1');
  ok(sv && Array.isArray(sv.clips) && sv.clips.length === 3 && Array.isArray(sv.sounds)
    && sv.base === 1000 && sv.by === 'sophie' && !('audio' in sv),
    'a save carries BOTH lanes, the base it opened on, by:sophie — and never `audio`');

  console.log('play through the split:');
  await page.$$eval('.seg', (els) => els[0].click());
  await page.waitForTimeout(200);
  await armSeekCounter();
  await page.evaluate(() => { window.__visSeeks = 0; });
  await page.click('#play');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 9000 }).catch(() => {});
  ok((await disp('playIco')) !== 'none', 'a split cut still plays through and stops');
  const splitSeeks = await visSeeks();
  ok(splitSeeks === 0,
    'a split joint just ROLLS ON — no seek at all (visible seeks: ' + splitSeeks + ')');

  console.log('delete:');
  await page.$$eval('.seg', (els) => els[1].click());
  await page.waitForTimeout(200);
  await page.click('#delBtn');
  await page.waitForTimeout(300);
  ok((await page.$$('.seg')).length === 2, 'delete takes the piece off');

  console.log('the progress line is visible on a first upload:');
  await page.goto('http://forge.test/filmeditor?c=t2');
  await page.waitForSelector('#emptyBox:not([hidden])', { timeout: 8000 });
  ok(await page.$eval('#msg', (el) => el.offsetParent !== null),
    'the quiet line shows even while the empty state is up');

  console.log('an old doc with one `audio` track opens as one sound:');
  await openCut(page, 't3');
  ok((await page.$$('.snd')).length === 1 && (await page.$$('audio')).length === 1,
    'the legacy track is the lane’s one sound, with one audio element');
  ok(await page.evaluate(() => {
    const bar = document.querySelector('.snd').getBoundingClientRect();
    const seg = document.querySelector('.seg').getBoundingClientRect();
    return Math.abs(bar.left - seg.left) < 2 && /song/.test(document.querySelector('.snd .nm').textContent);
  }), 'its bar starts on the first shot’s left edge — FROM START, never "synced to piece 1"');
  await page.evaluate(() => {
    window.__seeks = 0;
    document.querySelector('audio').addEventListener('seeking', () => { window.__seeks++; });
  });
  await page.click('#play');
  await page.waitForTimeout(700);
  ok(await page.$eval('audio', (el) => !el.paused), 'the track plays from the top');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 9000 }).catch(() => {});
  const seeks = await page.evaluate(() => window.__seeks);
  ok(seeks <= 2, 'the track is NOT re-seeked at every piece boundary (seeks: ' + seeks + ')');
  ok(await page.$eval('audio', (el) => el.currentTime >= 3.2), 'it rolled through the whole film');

  console.log('a same-source jump (the middle trimmed out — her core flow):');
  await openCut(page, 't4');
  await page.waitForTimeout(500);   // the open's warm parks the idle element
  await armSeekCounter();
  await page.evaluate(() => { window.__visSeeks = 0; });
  await page.click('#play');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 9000 }).catch(() => {});
  ok((await disp('playIco')) !== 'none', 'plays through the jump and stops');
  const jumpSeeks = await visSeeks();
  ok(jumpSeeks === 0,
    'the jump swaps to the PARKED element — no visible seek (visible seeks: ' + jumpSeeks + ')');
  ok(await page.evaluate(() => {
    const a = document.getElementById('vA');
    const b = document.getElementById('vB');
    const act = a.hidden ? b : a;
    return act.currentTime > 1.7;
  }), 'the second piece really played ITS OWN span (ended near the source end, not at 0.6)');

  console.log('preview proxies take over the player:');
  PROX = {
    'https://forge.test/fx/a.webm': { status: 'ready', proxyUrl: 'https://forge.test/fx/b.webm' },
    'https://forge.test/fx/b.webm': { status: 'ready', proxyUrl: 'https://forge.test/fx/a.webm' },
  };
  await openCut(page, 't1');
  await page.waitForTimeout(600);   // the proxies answer lands and is adopted
  await page.click('#play');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => {
    const a = document.getElementById('vA');
    const b = document.getElementById('vB');
    const act = a.hidden ? b : a;
    return act.getAttribute('data-src') === 'https://forge.test/fx/b.webm';
  }), 'playback runs on the baked preview copy, not the heavy original');
  await page.click('#play');
  PROX = {};

  // ── A STILL: two clips with a held picture between them. Until its 60s
  // proxy is baked the stage shows the picture ITSELF, and the playhead walks
  // its hold on the wall clock; with the proxy ready it is a clip like any
  // other, through the two-video player. ──
  console.log('a still, before its proxy is baked:');
  await openCut(page, 't5');
  ok((await page.$$('.seg')).length === 3, 'two clips and a still: three pieces');
  ok(await page.$$eval('.seg', (els) => /api\/story\/thumb/.test(els[1].style.backgroundImage)
    && els[1].querySelector('.kd') && els[1].querySelector('.kd').offsetWidth > 0
    && /00:01\.15/.test(els[1].querySelector('.lbl').textContent)),
    'the still’s tile shows its thumb, wears the picture mark, and its hold is its length');
  await page.waitForTimeout(400);
  await page.click('#play');
  await page.waitForFunction(() => {
    const segs = document.querySelectorAll('.seg');
    return segs[1] && !segs[1].querySelector('.ph').hidden;
  }, { timeout: 6000 }).catch(() => {});
  const stillShown = await page.evaluate(() => {
    const im = document.getElementById('still');
    const st = document.getElementById('stage').getBoundingClientRect();
    const top = document.elementFromPoint(st.left + st.width / 2, st.top + st.height / 2);
    return { shown: !im.hidden && im.offsetWidth > 0 && /fx\/s\.png/.test(im.getAttribute('src') || ''), onTop: top === im, tc: document.getElementById('tc').textContent };
  });
  ok(stillShown.shown && stillShown.onTop, 'inside the still, the stage shows the PICTURE itself, on top (at ' + stillShown.tc.split(' ')[0] + ')');
  await page.waitForFunction(() => {
    const segs = document.querySelectorAll('.seg');
    return segs[2] && !segs[2].querySelector('.ph').hidden;
  }, { timeout: 6000 }).catch(() => {});
  ok(await page.$$eval('.seg', (els) => els[2] && !els[2].querySelector('.ph').hidden),
    'the playhead walks the hold and crosses into the clip after it');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => {
    const im = document.getElementById('still');
    const v = [document.getElementById('vA'), document.getElementById('vB')].find((x) => !x.hidden);
    return im.hidden && v && !v.paused && /b\.webm/.test(v.getAttribute('data-src') || '');
  }), 'and the picture gives way to the playing clip');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 8000 }).catch(() => {});
  ok((await disp('playIco')) !== 'none', 'the film with a still still stops at the end');

  console.log('a still, with its proxy baked:');
  PROX = { 'https://forge.test/fx/s.png': { status: 'ready', still: true, proxyUrl: 'https://forge.test/fx/still.webm' } };
  await openCut(page, 't5');
  await page.waitForTimeout(600);   // adopted
  await page.$$eval('.seg', (els) => els[1].click());   // step into the still
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => {
    const im = document.getElementById('still');
    const v = [document.getElementById('vA'), document.getElementById('vB')].find((x) => !x.hidden);
    return im.hidden && v && v.getAttribute('data-src') === 'https://forge.test/fx/still.webm';
  }), 'the still plays through the two-video player on its baked proxy, the picture overlay down');
  await page.click('#play');
  await page.waitForFunction(() => {
    const segs = document.querySelectorAll('.seg');
    return segs[2] && !segs[2].querySelector('.ph').hidden;
  }, { timeout: 6000 }).catch(() => {});
  ok(await page.$$eval('.seg', (els) => els[2] && !els[2].querySelector('.ph').hidden),
    'and its hold ends on time — the clip after it comes on');
  await page.click('#play');
  PROX = {};

  console.log('a still’s trim edits its hold through the same tools:');
  await openCut(page, 't5');
  await page.$$eval('.seg', (els) => els[1].click());
  await page.click('#fwdSec');   // 1s into the 1.5s hold
  await page.waitForTimeout(150);
  await page.click('#trimOutBtn');
  await page.waitForTimeout(900);
  const stSave = lastSave('t5');
  ok(stSave && stSave.clips[1].kind === 'image' && stSave.clips[1].in === 0 && Math.abs(stSave.clips[1].out - 1) < 0.02,
    'trim out on a still sets its hold (in stays 0): out ' + (stSave && stSave.clips[1].out));

  // ── THE SOUND LANE ──
  console.log('a sound bar selects, and the tool row relabels:');
  await openCut(page, 't6');
  ok((await page.$$('.snd')).length === 1 && (await page.$eval('#syncBtn .w', (el) => el.textContent)) === 'add sound'
    && (await page.$eval('#sndtools', (el) => el.hidden)),
    'on the picture lane the sync slot reads ADD SOUND and the sound tools are away');
  await page.click('.snd');
  await page.waitForTimeout(150);
  const selState = await page.evaluate(() => ({
    barSel: document.querySelector('.snd').classList.contains('sel'),
    label: document.querySelector('#syncBtn .w').textContent,
    icoAt: !document.getElementById('syncIcoAt').hasAttribute('hidden') && document.getElementById('syncIcoAdd').hasAttribute('hidden'),
    tools: !document.getElementById('sndtools').hidden && document.getElementById('sndtools').offsetHeight > 0,
    lvl: document.getElementById('lvl').textContent,
    segSel: document.querySelectorAll('.seg.sel').length,
  }));
  ok(selState.barSel && selState.label === 'start here' && selState.icoAt, 'tapping the bar selects it and sync reads START HERE');
  ok(selState.tools && selState.lvl === '0 dB' && selState.segSel === 0,
    'the sound tools appear with the level at 0 dB, and no piece reads as selected');

  console.log('sync moves the sound to the playhead:');
  await page.click('#fwdSec');   // playhead → 1.0s (the sound stays selected while she steps)
  await page.waitForTimeout(150);
  ok(await page.$eval('.snd', (el) => el.classList.contains('sel')), 'stepping the playhead keeps the sound selected');
  await page.click('#syncBtn');
  await page.waitForTimeout(900);
  const syncGeo = await page.evaluate(() => {
    const bar = document.querySelector('.snd').getBoundingClientRect();
    const ph = document.getElementById('lph').getBoundingClientRect();
    return { off: Math.abs(bar.left - ph.left), msg: document.getElementById('msg').textContent };
  });
  const syncSave = lastSave('t6');
  ok(syncGeo.off < 2, 'the bar’s left edge sits on the lane’s playhead line (off by ' + syncGeo.off.toFixed(1) + 'px)');
  ok(syncSave && Math.abs(syncSave.sounds[0].at - 1) < 0.02, 'and the saved doc says at: ' + (syncSave && syncSave.sounds[0].at));
  ok(/sound starts here/.test(syncGeo.msg), 'the quiet line says so');

  console.log('level −/+:');
  await page.click('#lvDn'); await page.click('#lvDn');
  await page.waitForTimeout(900);
  const lv = await page.evaluate(() => ({ txt: document.getElementById('lvl').textContent, vol: document.querySelector('audio').volume }));
  const lvSave = lastSave('t6');
  ok(lv.txt === '−2 dB' && lvSave && lvSave.sounds[0].gain === -2, 'two taps down: the readout and the saved gain say −2 dB');
  ok(Math.abs(lv.vol - Math.pow(10, -2 / 20)) < 0.01, 'and the audio element’s volume is 10^(−2/20) = ' + lv.vol.toFixed(3));
  await page.click('#lvUp'); await page.click('#lvUp'); await page.click('#lvUp');
  await page.waitForTimeout(900);
  const lv2 = await page.evaluate(() => ({ txt: document.getElementById('lvl').textContent, vol: document.querySelector('audio').volume }));
  ok(lv2.txt === '+1 dB' && lastSave('t6').sounds[0].gain === 1 && lv2.vol === 1,
    'up to +1 dB: stored as +1, previewed at unity (an element’s volume tops out at 1)');

  console.log('fade chips, mute, and the way back:');
  await page.click('#fades button[data-side="fadeOut"][data-v="2"]');
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => document.querySelector('#fades button[data-side="fadeOut"][data-v="2"]').classList.contains('on')
    && document.querySelector('.snd .fo').offsetWidth > 4), 'a fade-out chip lights and the bar shows the fade as a flat block');
  await page.click('#muteBtn');
  await page.waitForTimeout(900);
  ok((await page.$eval('.snd', (el) => el.classList.contains('mute'))) && lastSave('t6').sounds[0].mute === true
    && lastSave('t6').sounds[0].fadeOut === 2, 'mute dims the bar and is saved, beside the fade');
  await page.click('#muteBtn');
  await page.click('.snd');   // tap the bar again → back to the picture lane
  await page.waitForTimeout(150);
  ok((await page.$eval('#syncBtn .w', (el) => el.textContent)) === 'add sound' && (await page.$$('.seg.sel')).length === 1
    && (await page.$eval('#sndtools', (el) => el.hidden)), 'tapping the selected bar again returns to the picture lane');

  console.log('two sounds play at once:');
  await openCut(page, 't7');
  ok((await page.$$('.snd')).length === 2 && (await page.$$('audio')).length === 2, 'two bars, two audio elements');
  ok(await page.$$eval('.snd', (els) => Math.abs(els[0].getBoundingClientRect().top - els[1].getBoundingClientRect().top) >= 18),
    'overlapping sounds stack on two rows');
  await page.waitForTimeout(400);
  await page.click('#play');
  await page.waitForTimeout(1000);
  const s1 = await page.$$eval('audio', (els) => els.map((a) => ({ paused: a.paused, t: a.currentTime })));
  await page.waitForTimeout(400);
  const s2 = await page.$$eval('audio', (els) => els.map((a) => ({ paused: a.paused, t: a.currentTime })));
  ok(s1.length === 2 && !s1[0].paused && !s1[1].paused && !s2[0].paused && !s2[1].paused,
    'both elements are unpaused mid-film');
  ok(s2[0].t - s1[0].t > 0.2 && s2[1].t - s1[1].t > 0.2,
    'and both are ADVANCING (' + (s2[0].t - s1[0].t).toFixed(2) + 's, ' + (s2[1].t - s1[1].t).toFixed(2) + 's over 0.4s)');
  await page.click('#play');

  console.log('ride: a sound anchors to its shot and follows it:');
  await openCut(page, 't11');
  const rideGeo0 = await page.evaluate(() => {
    const bar = document.querySelector('.snd').getBoundingClientRect();
    const seg = document.querySelectorAll('.seg')[1].getBoundingClientRect();
    return Math.abs(bar.left - (seg.left + seg.width * 0.25));
  });
  ok(rideGeo0 < 2, 'the sound at 2.5s sits a quarter into the second shot (off by ' + rideGeo0.toFixed(1) + 'px)');
  await page.click('.snd');
  await page.click('#rideBtn');
  await page.waitForTimeout(900);
  const rideSave = lastSave('t11');
  ok(rideSave && rideSave.sounds[0].anchor && rideSave.sounds[0].anchor.piece === 'pB' && Math.abs(rideSave.sounds[0].anchor.offset - 0.5) < 0.01,
    'ride saves anchor {piece:pB, offset:0.5}');
  ok((await page.$eval('#rideBtn', (el) => el.classList.contains('on'))) && /rides piece 02/.test(await page.$eval('#msg', (el) => el.textContent)),
    'the ride chip lights and the quiet line names the shot');
  await page.$$eval('.seg', (els) => els[1].click());   // the picture lane, piece B
  await page.waitForTimeout(150);
  await page.click('#moveL');   // B goes first
  await page.waitForTimeout(900);
  const rideSave2 = lastSave('t11');
  const rideGeo1 = await page.evaluate(() => {
    const bar = document.querySelector('.snd').getBoundingClientRect();
    const seg = document.querySelectorAll('.seg')[0].getBoundingClientRect();
    return Math.abs(bar.left - (seg.left + seg.width * 0.25));
  });
  ok(rideSave2 && rideSave2.clips[0].key === 'pB' && Math.abs(rideSave2.sounds[0].at - 0.5) < 0.01 && rideSave2.sounds[0].anchor,
    'after the shot moves first, the saved `at` is 0.5 and the anchor holds');
  ok(rideGeo1 < 2, 'and the bar FOLLOWED the shot — a quarter into the first tile now (off by ' + rideGeo1.toFixed(1) + 'px)');
  await page.click('.snd');
  await page.click('#rideBtn');   // lit → let go
  await page.waitForTimeout(900);
  ok(lastSave('t11').sounds[0].anchor === null && Math.abs(lastSave('t11').sounds[0].at - 0.5) < 0.01,
    'tapping a lit ride lets go — the anchor drops and the sound stays where it was');

  console.log('the chat changed this cut under her (a stale save):');
  STALE_ONCE = true;
  await openCut(page, 't8');
  await page.$$eval('.seg', (els) => els[0].click());
  await page.click('#fwdSec');
  await page.waitForTimeout(150);
  await page.click('#splitBtn');
  await page.waitForTimeout(1200);   // the save (600ms) is refused 409 with the chat's doc
  const staleState = await page.evaluate(() => ({
    keys: [...document.querySelectorAll('.seg')].map((e) => e.getAttribute('data-key')),
    snd: document.querySelectorAll('.snd').length,
    msg: document.getElementById('msg').textContent,
  }));
  ok(staleState.keys.join(',') === 'pA,pB,pC' && staleState.snd === 1,
    'the page reloads the CHAT’s doc — its three pieces and its sound, not her split');
  ok(/the chat changed this cut — reloaded/.test(staleState.msg), 'and says so in the quiet line');
  await page.waitForTimeout(900);
  ok((SAVES.t8 || []).length === 1, 'and does NOT re-send her save (pieces POSTs: ' + (SAVES.t8 || []).length + ')');

  console.log('versions — who made each render:');
  await page.evaluate(() => { try { localStorage.removeItem('forge.fe.seen.t9'); } catch (e) {} });
  await openCut(page, 't9');
  ok(/the chat rendered a new version/.test(await page.$eval('#msg', (el) => el.textContent)),
    'opening a cut whose newest render is the chat’s says so once');
  await page.click('#filmsBtn');
  await page.waitForTimeout(150);
  const filmRows = await page.$$eval('#films button', (els) => els.map((b) => b.textContent));
  ok(filmRows.length === 2 && /by the chat/.test(filmRows[0]) && /new from the chat/.test(filmRows[0]) && /by you/.test(filmRows[1]),
    'the films sheet names the maker of each render and marks the chat’s newest as new');
  await page.click('#renderBtn');
  await page.waitForTimeout(400);
  ok(RENDERS.length === 1 && RENDERS[0].by === 'sophie', 'Render posts by:sophie');
  await page.click('#filmsClose');
  await openCut(page, 't9');
  await page.click('#filmsBtn');
  await page.waitForTimeout(150);
  ok(!/new from the chat/.test((await page.$$eval('#films button', (els) => els.map((b) => b.textContent)))[0])
    && !/the chat rendered/.test(await page.$eval('#msg', (el) => el.textContent)),
    'once she has been here, the mark and the line are gone');
  await page.click('#filmsClose');

  console.log('add from the Dump:');
  await openCut(page, 't10');
  await page.click('#dumpBtn');
  await page.waitForSelector('#dumpSheet:not([hidden]) .arow', { timeout: 4000 });
  ok(/Dinner party/.test(await page.$eval('#dumpSheet .arow', (el) => el.textContent)), 'the Dump’s albums list in a sheet');
  await page.click('#dumpSheet .arow');
  await page.waitForFunction(() => document.querySelectorAll('.seg').length === 4, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  const dumpSave = lastSave('t10');
  ok((await page.$$('.seg')).length === 4 && (await page.$eval('#dumpSheet', (el) => el.hidden)),
    'the album’s photo and clip join the picture lane; the sheet closes');
  ok(dumpSave && dumpSave.clips.length === 4 && dumpSave.clips[2].kind === 'image' && dumpSave.clips[2].out === 4
    && dumpSave.clips[3].kind === 'video' && /still\.webm/.test(dumpSave.clips[3].url),
    'saved as a still held 4s and a clip, in album order — the voice note skipped');
  ok(/Added 2 from/.test(await page.$eval('#msg', (el) => el.textContent)), 'the quiet line counts what came in');

  console.log('music drift is PACED, never yanked:');
  await openCut(page, 't3');
  await page.waitForTimeout(300);
  await page.click('#play');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__aSeeks = 0;
    const a = document.querySelector('audio');
    a.addEventListener('seeking', () => { window.__aSeeks++; });
    a.currentTime += 0.6;   // moderate drift — 1 seek, ours
  });
  await page.waitForTimeout(400);
  ok(await page.$eval('audio', (a) => Math.abs(a.playbackRate - 0.96) < 0.001),
    'a moderate drift leans the rate 4% down');
  ok((await page.evaluate(() => window.__aSeeks)) === 1,
    'and the page adds NO seek of its own');
  await page.evaluate(() => { document.querySelector('audio').currentTime += 2.5; });   // now >2s out
  await page.waitForTimeout(400);
  ok((await page.evaluate(() => window.__aSeeks)) === 3,
    'a drift past 2s is hard-resynced — one seek, once');
  ok(await page.$eval('audio', (a) => a.playbackRate === 1),
    'and the rate comes back to 1 with it');
  await page.click('#play');
  await page.waitForTimeout(200);

  console.log('the music plays its audio-only baked copy:');
  AUDPROX = { 'https://forge.test/fx/t.ogg': { status: 'ready', proxyUrl: 'https://forge.test/fx/t2.ogg' } };
  await openCut(page, 't3');
  await page.waitForTimeout(600);   // the proxies answer lands and is adopted
  await page.click('#play');
  await page.waitForTimeout(400);
  ok(await page.$eval('audio', (a) => a.getAttribute('data-src') === 'https://forge.test/fx/t2.ogg' && !a.paused),
    'the track streams the baked audio copy, not the heavy original');
  await page.click('#play');
  AUDPROX = {};

  // ── the track is PRIMED before the play tap (Sophie, 2026-08-23: the music
  // "starts late" — iOS treats preload=auto as a suggestion on <audio> exactly
  // as on <video>, so the fetch used to begin AT the tap). The prime is a
  // muted play parked at the track's spot; by the time she taps play, real
  // bytes are buffered and nothing is left muted. Per element now.
  console.log('the track is primed before the play tap:');
  PROX = {}; AUDPROX = {};   // earlier scenarios remap the video sources — a
                             // stale map here mis-derives the playhead below
  await openCut(page, 't3');
  await page.waitForTimeout(800);   // the proxies answer lands → adoptProxies → primeAudio
  ok(await page.$eval('audio', (a) => a.buffered.length > 0 && a.buffered.end(0) > 0),
    'the audio element holds REAL buffered data before any play tap');
  ok(await page.$eval('audio', (a) => a.paused && !a.muted),
    'and the prime parked it — paused, sound back on');

  // ── a track whose bytes arrive LATE enters IN SYNC (the other half of the
  // same report: a late start used to keep the whole song shifted behind the
  // picture for the rest of the film — the 4% pacing lean needs ~25s to
  // absorb one late second). The 'playing' entry realign is what fixes it.
  console.log('a late-arriving track enters in sync:');
  await openCut(page, 't3');
  AUD_DELAY = 1200;                    // the next audio fetch stalls 1.2s
  // wiping data-src makes the play tap re-set src → a fresh fetch, under the delay
  await page.$eval('audio', (a) => { a.removeAttribute('src'); a.removeAttribute('data-src'); });
  await page.click('#play');
  await page.waitForTimeout(2300);     // film at ~2.2s; the track came in ~1.2s late
  const late = await page.evaluate(() => {
    const a = document.querySelector('audio');
    // the page's playhead lives inside its IIFE — derive it from the visible
    // video: t3 is a.webm [0,1.8) then b.webm from 1.8
    const v = [document.getElementById('vA'), document.getElementById('vB')].find((x) => !x.hidden);
    const ph = ((v.getAttribute('data-src') || '').includes('b.webm') ? 1.8 : 0) + (v.currentTime || 0);
    return { paused: a.paused, off: Math.abs((a.currentTime || 0) - ph) };
  });
  ok(!late.paused, 'the late track did start');
  ok(late.off < 0.45,
    'and it entered mid-song, in step with the picture (off by ' + late.off.toFixed(2) + 's)');
  await page.click('#play');
  await page.waitForTimeout(400);

  // ── the play-session beacon (2026-08-23, round three): every fix so far
  // was verified here, in Chromium, while her phone kept failing — the page
  // now reports what the DEVICE did, so the next diagnosis reads data
  // instead of guessing. The sessions above must have posted.
  console.log('the telemetry beacon:');
  ok(TELEMETRY.length > 0, 'a play session posts one beacon when playback stops');
  const tl = TELEMETRY[TELEMETRY.length - 1];
  ok(tl && /^fe-/.test(tl.build || ''), 'the beacon carries the page build id (the stale-page question)');
  ok(tl && Array.isArray(tl.rvfc) && (tl.rvfc[0] + tl.rvfc[1]) > 0,
    'and the rVFC fire counts — whether the frame truth is alive on the device');
  ok(tl && tl.aud && typeof tl.aud.startMs === 'number',
    'and the music start latency (aud.startMs: ' + (tl && tl.aud && tl.aud.startMs) + 'ms)');

  // ── the page heals its own staleness (the round-three FINDING): the iOS
  // app keeps recent tools alive in a ZStack, so the page loads once per app
  // process — no deploy can reach a page that never reloads. Stale build +
  // idle → the page reloads itself in place; mid-play it never does.
  console.log('the page heals its own staleness:');
  const REAL_BUILD = /var BUILD = '([^']+)'/.exec(html)[1];
  SERVER_BUILD = REAL_BUILD;
  await openCut(page, 't3');
  ok(await page.evaluate(() => window.__buildCheck().then((r) => r === false)),
    'a CURRENT page never reloads itself');
  SERVER_BUILD = 'fe-newer-build';
  await page.click('#play');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__buildCheck().then((r) => r === false)),
    'a stale page never reloads MID-PLAY');
  await page.click('#play');   // stop
  await page.click('.snd');    // a sound in her hands
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__buildCheck().then((r) => r === false)),
    'a stale page never reloads while a SOUND is selected (a state the reload cannot put back)');
  await page.click('.snd');    // put it down
  await page.waitForTimeout(500);
  const nav = page.waitForNavigation({ timeout: 5000 }).catch(() => null);
  await page.evaluate(() => { window.__buildCheck(); });
  ok((await nav) !== null, 'a stale IDLE page reloads itself');
  ok(page.url().includes('c=t3'), 'and comes back inside the same cut (?c survives the reload)');
  SERVER_BUILD = REAL_BUILD;
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });

  // ── ONE SCREEN at 390x700 — the app's web view (the phone with its own
  // bottom bar taken off). With a sound selected the page carries its most
  // chrome: strip, lane, the tool row AND the sound tools. Every control's
  // box must sit inside the viewport, nothing may scroll, no pill anywhere.
  console.log('one screen at 390x700, with the most chrome up:');
  const pageS = await browser.newPage({ viewport: { width: 390, height: 700 } });
  await pageS.route('**/*', routeHandler);
  await openCut(pageS, 't7');
  await pageS.click('.snd');
  await pageS.waitForTimeout(200);
  const fit = await pageS.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const del = r('delBtn');
    const under = document.elementFromPoint(del.left + del.width / 2, del.top + del.height / 2);
    const fadeBtn = document.querySelector('#fades button[data-side="fadeOut"][data-v="4"]').getBoundingClientRect();
    const underFade = document.elementFromPoint(fadeBtn.left + fadeBtn.width / 2, fadeBtn.top + fadeBtn.height / 2);
    return {
      inner: window.innerHeight,
      docH: document.documentElement.scrollHeight, bodyH: document.body.scrollHeight,
      lvOpenBottom: r('lvOpen').bottom, msgBottom: r('msg').bottom, toolsBottom: r('tools').bottom,
      sndBottom: r('sndtools').bottom, laneBottom: r('lane').bottom, stageH: r('stage').height,
      stripRows: r('strip').height, laneH: r('lane').height, sndH: r('sndtools').height,
      delReachable: Boolean(under && document.getElementById('delBtn').contains(under)),
      fadeReachable: Boolean(underFade && underFade.closest('#fades')),
      pill: Boolean(document.querySelector('.float, #vbot, #ptop, .vseg')),
      scrollY: window.scrollY,
    };
  });
  ok(fit.docH <= fit.inner && fit.bodyH <= fit.inner && fit.scrollY === 0,
    'nothing scrolls: document ' + fit.docH + 'px, body ' + fit.bodyH + 'px in a ' + fit.inner + 'px viewport');
  ok(fit.msgBottom <= fit.inner && fit.toolsBottom <= fit.inner && fit.sndBottom <= fit.inner && fit.lvOpenBottom <= fit.inner + 0.5,
    'the tools, the sound tools and the quiet line all end inside the screen (tools ' + fit.toolsBottom.toFixed(0)
    + ', sound tools ' + fit.sndBottom.toFixed(0) + ', line ' + fit.msgBottom.toFixed(0) + ' of ' + fit.inner + ')');
  ok(fit.delReachable && fit.fadeReachable, 'delete and the last fade chip are really under the finger (elementFromPoint)');
  ok(fit.stageH >= 120, 'the preview keeps a usable stage (' + fit.stageH.toFixed(0) + 'px tall)');
  ok(!fit.pill, 'no autoscroll pill on a one-screen page');
  console.log('    measured: stage ' + fit.stageH.toFixed(0) + 'px · strip ' + fit.stripRows.toFixed(0)
    + 'px · lane ' + fit.laneH.toFixed(0) + 'px (2 rows) · sound tools ' + fit.sndH.toFixed(0) + 'px');
  await pageS.close();

  // ── the iPHONE SHAPE: a frozen getVideoPlaybackQuality counter (iOS WebKit
  // batches or flatlines totalVideoFrames). The old tick trusted that counter
  // alone, so the playhead lagged whole beats behind the picture and then
  // leapt to catch up — and the lagging playhead made syncAudio read ">0.35s
  // drift" at every joint and yank the MUSIC backward: the stop-start chop
  // (Sophie, 2026-08-23). rVFC is the frame truth now, so a lying counter
  // must change nothing. ──
  const pageF = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pageF.addInitScript(() => {
    Object.defineProperty(HTMLVideoElement.prototype, 'getVideoPlaybackQuality', {
      value: () => ({ totalVideoFrames: 0 }),
    });
  });
  await pageF.route('**/*', routeHandler);
  const tcSecs = (t) => {
    const m = /^(\d+):(\d+)\.(\d+)/.exec(t.split(' ')[0]);
    return m ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 30 : 0;
  };

  console.log('the playhead with a frozen frame counter (the iOS shape):');
  await openCut(pageF, 't1');
  await pageF.waitForTimeout(400);
  await pageF.click('#play');
  await pageF.waitForTimeout(1300);
  const lagTc = tcSecs(await pageF.$eval('#tc', (el) => el.textContent));
  ok(lagTc > 0.8,
    'the playhead TRACKS the picture — no lag-and-leap (at +1.3s it reads ' + lagTc.toFixed(2) + 's)');
  await pageF.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 9000 }).catch(() => {});
  ok(await pageF.$eval('#playIco', (el) => getComputedStyle(el).display !== 'none'),
    'and the film still plays through and stops');

  console.log('the music with a frozen frame counter:');
  await openCut(pageF, 't3');
  await pageF.waitForTimeout(400);
  await pageF.click('#play');
  await pageF.waitForTimeout(400);   // past the start-up seek — joints only from here
  await pageF.evaluate(() => {
    const a = document.querySelector('audio');
    window.__audSeeks = 0;
    window.__audBack = 0;
    let last = a.currentTime || 0;
    a.addEventListener('seeking', () => { window.__audSeeks++; });
    setInterval(() => {
      const ct = a.currentTime || 0;
      if (ct < last - 0.05) window.__audBack++;
      last = ct;
    }, 100);
  });
  await pageF.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 9000 }).catch(() => {});
  // trimmed pieces never fire `ended`, so under the old counter-held playhead
  // this film HUNG short of its first joint forever — finishing at all is the
  // assertion here, and only then do the music counts mean anything
  ok(await pageF.$eval('#playIco', (el) => getComputedStyle(el).display !== 'none'),
    'a TRIMMED cut still reaches its joints and stops under a lying counter');
  const audSeeks = await pageF.evaluate(() => window.__audSeeks);
  const audBack = await pageF.evaluate(() => window.__audBack);
  ok(audSeeks === 0,
    'the music is never re-seeked at a joint, even with a lying counter (seeks: ' + audSeeks + ')');
  ok(audBack === 0,
    'the music never jumps BACKWARD mid-film (backward jumps: ' + audBack + ')');

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('');
  console.log(pass + ' passed, ' + failCount + ' failed');
  process.exit(failCount ? 1 : 0);
})().catch((e) => { console.error('test crashed —', e.message); process.exit(1); });

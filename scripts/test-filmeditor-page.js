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
// Run: node scripts/test-filmeditor-page.js  (skips cleanly without playwright)
//
// MEDIA FIXTURES MUST BE SERVED WITH RANGE SUPPORT (serveMedia below).
// route.fulfill with a plain 200 makes Chromium report seekable [0,0], so
// every currentTime write silently clamps to 0 — the player restarts pieces
// from the top and no seek assertion measures anything real (found
// 2026-08-23, while these tests were green over exactly that behaviour).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

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
  // ── fixtures: two tiny real videos, different colors, with sound ──
  const FF = require('ffmpeg-static');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-test-'));
  // WebM/VP8 — playwright's Chromium ships WITHOUT the proprietary H.264/AAC
  // decoders, so an mp4 fixture never plays and every playback assertion
  // fails for the wrong reason (measured 2026-08-22)
  const mk = (name, hue, freq) => {
    const f = path.join(dir, name);
    execFileSync(FF, ['-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `color=c=${hue}:size=320x240:rate=30:duration=2`,
      '-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=2`,
      '-c:v', 'libvpx', '-b:v', '200k', '-c:a', 'libvorbis', '-shortest', f]);
    return fs.readFileSync(f);
  };
  const vidA = mk('a.webm', 'tomato', 440);
  const vidB = mk('b.webm', 'teal', 660);
  const oggT = path.join(dir, 't.ogg');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=520:duration=6',
    '-c:a', 'libvorbis', oggT]);
  const audT = fs.readFileSync(oggT);

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'filmeditor.html'), 'utf8');
  const DOC = {
    id: 't1', title: 'Test cut',
    clips: [
      { key: 'pA', url: 'http://forge.test/fx/a.webm', title: 'red', poster: null, seconds: 2, in: 0, out: 2 },
      { key: 'pB', url: 'http://forge.test/fx/b.webm', title: 'teal', poster: null, seconds: 2, in: 0, out: 2 },
    ],
    audio: null, renders: [], job: null,
  };

  let PROX = {};      // what /proxies answers — flipped per scenario
  let AUDPROX = {};   // the audio-proxy half of the same answer
  let AUD_DELAY = 0;  // ms to hold the audio fixture's next response — the late-start shape
  const TELEMETRY = [];   // every play-session beacon the page posts
  const DOC2 = { id: 't2', title: 'Empty cut', clips: [], audio: null, renders: [], job: null };
  // TRIMMED pieces on purpose (out < the file's end): the joint then fires
  // mid-file, while a lagging playhead is still behind real time — the exact
  // shape that made the old drift guard yank the music backward on the phone.
  const DOC3 = { id: 't3', title: 'Cut with music',
    clips: JSON.parse(JSON.stringify(DOC.clips)).map((c) => ({ ...c, out: 1.8 })),
    audio: { url: 'http://forge.test/fx/t.ogg', name: 'song', offset: 0 }, renders: [], job: null };
  // ONE source with the middle trimmed out — her core flow, and a joint that
  // is a JUMP inside the same file: it must swap to the parked idle element,
  // never seek the one on screen.
  const DOC4 = { id: 't4', title: 'Middle out', clips: [
    { key: 'j1', url: 'http://forge.test/fx/a.webm', title: 'a1', poster: null, seconds: 2, in: 0, out: 0.8 },
    { key: 'j2', url: 'http://forge.test/fx/a.webm', title: 'a2', poster: null, seconds: 2, in: 1.4, out: 2 },
  ], audio: null, renders: [], job: null };

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

  const browser = await pw.chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const routeHandler = (route) => {
    const u = route.request().url();
    if (u.includes('/fx/a.webm')) return serveMedia(route, 'video/webm', vidA);
    if (u.includes('/fx/b.webm')) return serveMedia(route, 'video/webm', vidB);
    if (u.includes('/api/filmeditor/proxies')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ proxies: PROX, audio: AUDPROX }) });
    }
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
    if (u.includes('/api/filmeditor/telemetry')) {
      try { TELEMETRY.push(JSON.parse(route.request().postData() || '{}')); } catch { /* not json */ }
      return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    }
    if (u.includes('/api/filmeditor/t3/pieces')) {
      return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    }
    if (u.includes('/api/filmeditor/t3')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(DOC3) });
    }
    if (u.includes('/api/filmeditor/t4/pieces')) {
      return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    }
    if (u.includes('/api/filmeditor/t4')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(DOC4) });
    }
    if (u.includes('/api/filmeditor/t2')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(DOC2) });
    }
    if (u.includes('/api/filmeditor/t1/pieces')) {
      return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    }
    if (u.includes('/api/filmeditor/t1/job')) {
      return route.fulfill({ contentType: 'application/json', body: '{"job":null,"renders":[]}' });
    }
    if (u.includes('/api/filmeditor/t1')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(DOC) });
    }
    if (u.includes('/filmeditor')) return route.fulfill({ contentType: 'text/html', body: html });
    if (u.includes('/tool.css')) return route.fulfill({ contentType: 'text/css', body: '' });
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

  console.log('the editor opens on a real cut:');
  await page.goto('http://forge.test/filmeditor?c=t1');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
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
    return idle.getAttribute('data-src') === 'http://forge.test/fx/b.webm' && idle.muted;
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
  await page.waitForTimeout(300);
  ok((await page.$$('.seg')).length === 3, 'split makes three pieces');

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

  console.log('the audio track:');
  await page.goto('http://forge.test/filmeditor?c=t3');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  ok((await page.$eval('#audSyncT', (el) => el.textContent)) === 'from start',
    'an untouched track says FROM START, never "synced to piece 1"');
  await page.evaluate(() => {
    window.__seeks = 0;
    document.getElementById('audEl').addEventListener('seeking', () => { window.__seeks++; });
  });
  await page.click('#play');
  await page.waitForTimeout(700);
  ok(await page.$eval('#audEl', (el) => !el.paused), 'the track plays from the top');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 9000 }).catch(() => {});
  const seeks = await page.evaluate(() => window.__seeks);
  ok(seeks <= 2, 'the track is NOT re-seeked at every piece boundary (seeks: ' + seeks + ')');
  ok(await page.$eval('#audEl', (el) => el.currentTime >= 3.2), 'it rolled through the whole film');

  console.log('a same-source jump (the middle trimmed out — her core flow):');
  await page.goto('http://forge.test/filmeditor?c=t4');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
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
    'http://forge.test/fx/a.webm': { status: 'ready', proxyUrl: 'http://forge.test/fx/b.webm' },
    'http://forge.test/fx/b.webm': { status: 'ready', proxyUrl: 'http://forge.test/fx/a.webm' },
  };
  await page.goto('http://forge.test/filmeditor?c=t1');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(600);   // the proxies answer lands and is adopted
  await page.click('#play');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => {
    const a = document.getElementById('vA');
    const b = document.getElementById('vB');
    const act = a.hidden ? b : a;
    return act.getAttribute('data-src') === 'http://forge.test/fx/b.webm';
  }), 'playback runs on the baked preview copy, not the heavy original');
  await page.click('#play');

  console.log('music drift is PACED, never yanked:');
  await page.goto('http://forge.test/filmeditor?c=t3');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.click('#play');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__aSeeks = 0;
    document.getElementById('audEl').addEventListener('seeking', () => { window.__aSeeks++; });
    document.getElementById('audEl').currentTime += 0.6;   // moderate drift — 1 seek, ours
  });
  await page.waitForTimeout(400);
  ok(await page.$eval('audio', (a) => Math.abs(a.playbackRate - 0.96) < 0.001),
    'a moderate drift leans the rate 4% down');
  ok((await page.evaluate(() => window.__aSeeks)) === 1,
    'and the page adds NO seek of its own');
  await page.evaluate(() => { document.getElementById('audEl').currentTime += 2.5; });   // now >2s out
  await page.waitForTimeout(400);
  ok((await page.evaluate(() => window.__aSeeks)) === 3,
    'a drift past 2s is hard-resynced — one seek, once');
  ok(await page.$eval('audio', (a) => a.playbackRate === 1),
    'and the rate comes back to 1 with it');
  await page.click('#play');
  await page.waitForTimeout(200);

  console.log('the music plays its audio-only baked copy:');
  AUDPROX = { 'http://forge.test/fx/t.ogg': { status: 'ready', proxyUrl: 'http://forge.test/fx/t2.ogg' } };
  await page.goto('http://forge.test/filmeditor?c=t3');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(600);   // the proxies answer lands and is adopted
  await page.click('#play');
  await page.waitForTimeout(400);
  ok(await page.$eval('audio', (a) => a.getAttribute('data-src') === 'http://forge.test/fx/t2.ogg' && !a.paused),
    'the track streams the baked audio copy, not the heavy original');
  await page.click('#play');
  AUDPROX = {};

  // ── the track is PRIMED before the play tap (Sophie, 2026-08-23: the music
  // "starts late" — iOS treats preload=auto as a suggestion on <audio> exactly
  // as on <video>, so the fetch used to begin AT the tap). The prime is a
  // muted play parked at the track's spot; by the time she taps play, real
  // bytes are buffered and nothing is left muted.
  console.log('the track is primed before the play tap:');
  PROX = {}; AUDPROX = {};   // earlier scenarios remap the video sources — a
                             // stale map here mis-derives the playhead below
  await page.goto('http://forge.test/filmeditor?c=t3');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
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
  await page.goto('http://forge.test/filmeditor?c=t3');
  await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  AUD_DELAY = 1200;                    // the next audio fetch stalls 1.2s
  // wiping data-src makes the play tap re-set src → a fresh fetch, under the delay
  await page.$eval('audio', (a) => { a.removeAttribute('src'); a.removeAttribute('data-src'); });
  await page.click('#play');
  await page.waitForTimeout(2300);     // film at ~2.2s; the track came in ~1.2s late
  const late = await page.evaluate(() => {
    const a = document.getElementById('audEl');
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
  await pageF.goto('http://forge.test/filmeditor?c=t1');
  await pageF.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
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
  await pageF.goto('http://forge.test/filmeditor?c=t3');
  await pageF.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  await pageF.waitForTimeout(400);
  await pageF.click('#play');
  await pageF.waitForTimeout(400);   // past the start-up seek — joints only from here
  await pageF.evaluate(() => {
    const a = document.getElementById('audEl');
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

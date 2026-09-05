#!/usr/bin/env node
// test-filmeditor-live.js — three of the four bugs read off Sophie's two live
// cuts and their page beacons (2026-09-05), driven on the real page:
//   - LEAVING THE APP MID-PLAY STOPS PLAYBACK: iOS pauses the videos but the
//     <audio> elements kept sounding, and on her return the tick found them
//     seconds ahead and hard-resynced every one at once. visibilitychange →
//     hidden and pagehide must both leave playing false and every sound paused.
//   - ONLY WHAT IS COMING PRIMES: the matrix cut has 17 sounds and the first
//     pointerdown started a muted play on all of them — 17 fetches competing
//     with the video proxies at the play tap (her beacon: one session ran
//     268s with the playhead reaching 18s). With a dozen sounds spread over a
//     minute, the first tap + play at 0s may give a src to at most THREE
//     elements; a seek to 40s gives the ones starting within the next 15s
//     theirs, and a few seconds of play brings in the next one as the
//     playhead approaches it. A sound whose moment is never near keeps none.
//   - THE BEACON SAYS WHERE A PLAY FROZE: n (the sound count), stuckAt /
//     stuckMs (the playhead at the longest hold, and its length), playRefused
//     / refusedName ride every session.
// (The fourth — a stale save keeps her edit — is measured in
// test-filmeditor-page.js beside the older stale-save contract.)
// Run: node scripts/test-filmeditor-live.js  (skips cleanly without playwright)
// Verified failing against the pre-fix page: 10 of 19 (every src on all
// twelve elements at the first tap, a sound still sounding after the page
// went hidden, and none of the new beacon fields).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const servePublic = require('./lib/public-asset');

let pw = null;
try { pw = require('playwright'); } catch { /* not installed here */ }
if (!pw) { console.log('live tests skipped — playwright not installed'); process.exit(0); }

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-live-'));
  // WebM/VP8 — playwright's Chromium has no H.264/AAC (see test-filmeditor-page.js)
  const mk = (name, hue, secs) => {
    const f = path.join(dir, name);
    execFileSync(FF, ['-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `color=c=${hue}:size=320x240:rate=30:duration=${secs}`,
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`,
      '-c:v', 'libvpx', '-b:v', '200k', '-c:a', 'libvorbis', '-shortest', f]);
    return fs.readFileSync(f);
  };
  const vidLong = mk('long.webm', 'teal', 16);
  const oggF = path.join(dir, 't.ogg');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=520:duration=6', '-c:a', 'libvorbis', oggF]);
  const audT = fs.readFileSync(oggF);

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'filmeditor.html'), 'utf8');
  const FX = 'https://forge.test/fx/';
  // four 16s pieces of one file = 64s of picture; a dozen 3s sounds every
  // six seconds from 0 to 66 (the last one past the end of the picture, which
  // is a shape her cuts have too)
  const clips = [0, 1, 2, 3].map((i) => ({ key: 'p' + i, kind: 'video', url: FX + 'long.webm', title: 'clip ' + i, poster: null, seconds: 16, in: 0, out: 16, mute: false, gain: 0 }));
  const sounds = [];
  for (let i = 0; i < 12; i++) {
    sounds.push({ key: 's' + i, url: FX + 't.ogg', name: 'hit ' + i, seconds: 3, in: 0, out: 3, at: i * 6, gain: 0, fadeIn: 0, fadeOut: 0, mute: false, anchor: null });
  }
  const DOC = { id: 'lv1', title: 'A dozen sounds', clips, sounds, renders: [], job: null, updatedAt: 1000 };
  const DOCS = { lv1: DOC };
  const TELEMETRY = [];
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
  await page.route('**/*', (route) => {
    const req = route.request();
    const u = req.url();
    const post = () => { try { return JSON.parse(req.postData() || '{}'); } catch { return {}; } };
    if (u.includes('/fx/long.webm')) return serveMedia(route, 'video/webm', vidLong);
    if (u.includes('/fx/t.ogg')) return serveMedia(route, 'audio/ogg', audT);
    if (u.includes('/api/filmeditor/proxies')) return json(route, { proxies: {}, audio: {} });
    if (u.includes('/api/filmeditor/telemetry')) { TELEMETRY.push(post()); return json(route, { ok: true }); }
    if (u.includes('/api/filmeditor/build')) return json(route, { build: 'match-me' });
    const m = /\/api\/filmeditor\/(lv\d+)(\/[a-z]+)?/.exec(u);
    if (m && DOCS[m[1]]) {
      const sub = m[2] || '';
      if (sub === '/pieces') { post(); upd += 1; return json(route, { ok: true, updatedAt: upd, doc: null }); }
      if (sub === '/job') return json(route, { job: null, renders: [] });
      return json(route, DOCS[m[1]]);
    }
    if (u.includes('/filmeditor')) return route.fulfill({ contentType: 'text/html', body: html });
    if (viaPublic(route)) return;
    return route.fulfill({ status: 404, body: '' });
  });
  const openCut = async (id) => {
    await page.goto('http://forge.test/filmeditor?c=' + id);
    await page.waitForSelector('#editBox:not([hidden])', { timeout: 8000 });
  };
  // which sounds hold a src (or are loading one) — read off the real elements
  const srcs = () => page.evaluate(() => [...document.querySelectorAll('#audbank audio')]
    .filter((a) => a.getAttribute('data-src') || a.getAttribute('src') || a.networkState === 2 || a.readyState > 0)
    .map((a) => a.id.replace('aud-', '')).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))));
  const playingNow = () => page.evaluate(() => {
    const a = document.getElementById('vA'), b = document.getElementById('vB');
    return (!a.hidden && !a.paused) || (!b.hidden && !b.paused);
  });
  const audioState = () => page.evaluate(() => [...document.querySelectorAll('#audbank audio')]
    .map((a) => ({ id: a.id, paused: a.paused })));

  console.log('only what is coming primes:');
  await openCut('lv1');
  await page.waitForTimeout(600);   // the proxies answer → adoptProxies → primeAudio
  let have = await srcs();
  ok(have.length <= 3 && have.length > 0 && have.every((k) => Number(k.slice(1)) <= 2),
    'after opening, at most three sounds hold a src — the ones under and just past the playhead (' + have.join(',') + ')');
  await page.click('#play');       // a real pointerdown, then play at 0s
  await page.waitForTimeout(700);
  have = await srcs();
  ok(have.length <= 3, 'after the first tap and play at 0s, still at most three of twelve are loading (' + have.join(',') + ')');
  ok(have.indexOf('s5') < 0 && have.indexOf('s9') < 0, 'a sound half a minute away holds no src at all');
  ok(await page.$eval('#aud-s9', (a) => a.preload === 'none' && !a.getAttribute('src')),
    'and its element is preload:none with no src set, measured');
  await page.click('#play');       // stop
  await page.waitForTimeout(300);
  // seek to ~40s: the third piece's tile (32s) then eight seconds forward
  await page.$$eval('.seg', (els) => els[2].click());
  for (let i = 0; i < 8; i++) { await page.click('#fwdSec'); }
  await page.waitForTimeout(700);
  const tc = await page.$eval('#tc', (el) => el.textContent);
  have = await srcs();
  ok(/^00:40/.test(tc), 'the playhead sits at 40s (' + tc + ')');
  ok(have.indexOf('s7') >= 0 && have.indexOf('s8') >= 0 && have.indexOf('s9') >= 0,
    'after the seek the sounds starting at 42, 48 and 54 hold theirs (' + have.join(',') + ')');
  ok(have.indexOf('s10') < 0 && have.indexOf('s3') < 0 && have.indexOf('s4') < 0,
    'the one at 60s is still outside the window, and the ones at 18s and 24s never came near');
  await page.click('#play');
  await page.waitForTimeout(9000);   // 40 → ~49s: 60 came inside 15s (the tick primes every 2s), and the 48s sound is under the playhead
  have = await srcs();
  ok(have.indexOf('s10') >= 0, 'nine seconds of play brought the 60s sound into the window and it got its src (' + have.join(',') + ')');
  ok(await page.$eval('#aud-s8', (a) => !a.paused), 'and the sound under the playhead (48s) is sounding');
  await page.click('#play');
  await page.waitForTimeout(400);

  console.log('leaving the app stops the film:');
  await page.$$eval('.seg', (els) => els[0].click());
  await page.waitForTimeout(200);
  await page.click('#play');
  await page.waitForTimeout(900);
  ok(await playingNow(), 'playing (the control case)');
  ok((await audioState()).some((a) => !a.paused), 'with a sound rolling');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  const afterHide = { v: await playingNow(), a: await audioState(), ico: await page.$eval('#playIco', (e) => e.hasAttribute('hidden')) };
  ok(!afterHide.v && afterHide.a.every((a) => a.paused) && !afterHide.ico,
    'visibilitychange → hidden: playing false, every audio paused, the play icon back (' + afterHide.a.filter((a) => !a.paused).length + ' still sounding)');
  await page.evaluate(() => { delete document.visibilityState; });
  await page.click('#play');
  await page.waitForTimeout(900);
  ok(await playingNow(), 'playing again');
  await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
  await page.waitForTimeout(300);
  const afterPagehide = { v: await playingNow(), a: await audioState() };
  ok(!afterPagehide.v && afterPagehide.a.every((a) => a.paused), 'pagehide: the same');
  // the films sheet is NOT leaving — opening it must not stop the film
  await page.click('#play');
  await page.waitForTimeout(700);
  await page.click('#filmsBtn');
  await page.waitForTimeout(300);
  ok(await playingNow(), 'opening a sheet is not leaving — the film keeps playing');
  await page.click('#filmsClose');
  await page.click('#play');
  await page.waitForTimeout(400);

  console.log('the beacon says where a play froze:');
  const tl = TELEMETRY[TELEMETRY.length - 1];
  ok(tl && tl.n === 12, 'the beacon carries the sound count (n: ' + (tl && tl.n) + ')');
  ok(tl && typeof tl.stuckAt === 'number' && typeof tl.stuckMs === 'number' && tl.stuckMs >= 0,
    'and the playhead at the longest hold with its length (stuckAt ' + (tl && tl.stuckAt) + 's, stuckMs ' + (tl && tl.stuckMs) + ')');
  ok(tl && typeof tl.playRefused === 'number' && typeof tl.refusedName === 'string',
    'and whether a play() was refused, with the first error name (playRefused ' + (tl && tl.playRefused) + ')');
  ok(tl && !('holdRun' in tl) && typeof tl.joints === 'number', 'the running counter never leaves the page; joints still ride');

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('');
  console.log(pass + ' passed, ' + failCount + ' failed');
  process.exit(failCount ? 1 : 0);
})().catch((e) => { console.error('test crashed —', e.message); process.exit(1); });

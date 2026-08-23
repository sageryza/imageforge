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
// Run: node scripts/test-filmeditor-page.js  (skips cleanly without playwright)

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

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'filmeditor.html'), 'utf8');
  const DOC = {
    id: 't1', title: 'Test cut',
    clips: [
      { key: 'pA', url: 'http://forge.test/fx/a.webm', title: 'red', poster: null, seconds: 2, in: 0, out: 2 },
      { key: 'pB', url: 'http://forge.test/fx/b.webm', title: 'teal', poster: null, seconds: 2, in: 0, out: 2 },
    ],
    audio: null, renders: [], job: null,
  };

  let PROX = {};   // what /proxies answers — flipped per scenario
  const DOC2 = { id: 't2', title: 'Empty cut', clips: [], audio: null, renders: [], job: null };

  const browser = await pw.chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.includes('/fx/a.webm')) return route.fulfill({ contentType: 'video/webm', body: vidA });
    if (u.includes('/fx/b.webm')) return route.fulfill({ contentType: 'video/webm', body: vidB });
    if (u.includes('/api/filmeditor/proxies')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ proxies: PROX }) });
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
  });

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

  console.log('play:');
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
  await page.click('#play');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('playIco')).display !== 'none',
    { timeout: 9000 }).catch(() => {});
  ok((await disp('playIco')) !== 'none', 'a split cut still plays through and stops');

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

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('');
  console.log(pass + ' passed, ' + failCount + ' failed');
  process.exit(failCount ? 1 : 0);
})().catch((e) => { console.error('test crashed —', e.message); process.exit(1); });

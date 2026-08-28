#!/usr/bin/env node
/* Tests the Story Room's LISTEN rows — every recording attached to a story,
 * behind the waveform button (Aug 2026, Sophie: the NDE montages "should be
 * connected to their stories so I can listen to them when I go to their
 * story", then "a story can hold multiple audios … hide them all behind a
 * single icon that has a wave form").
 *
 *   node scripts/test-storyroom-listen.js
 *
 * Drives the REAL built page (public/scratchpad.html) in headless Chromium
 * against a stub API. Checks:
 *   1. the rows live behind the waveform button, not in the page flow, and
 *      the button opens them
 *   2. one row per attached recording — play button, its title, its m:ss
 *      length — episodes and source memos alike, and a memo carries its date
 *   3. tapping play points the page's ONE shared player at that url and flips
 *      the row's glyph to pause; tapping again pauses
 *   4. starting a second row replaces the first (never stacks)
 *   5. a story with nothing attached shows no waveform button at all
 *
 * Skips with exit 0 if playwright/Chromium isn't installed.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.log('playwright not installed — skipping'); process.exit(0);
}

function browserPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return null; }
  for (const d of dirs.sort().reverse()) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = path.join(root, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const PUB = path.join(__dirname, '..', 'public');

const AUDIOS = [
  { kind: 'episode', episodeId: 'ep1', title: 'Telepathy', url: 'https://storage.example.test/editor/ep1-1.mp3', seconds: 649, at: '2026-08-02T19:37:27.543Z' },
  { kind: 'episode', episodeId: 'ep2', title: 'The Grass', url: 'https://storage.example.test/editor/ep2-1.mp3', seconds: 40.3, at: '2026-08-02T20:11:15.431Z' },
  // A source recording — a voice memo the story came out of. Its url is the
  // gated proxy, and it is the one kind that carries a date.
  { kind: 'source', src: '2026-07-09_1048', title: 'Reflections on Intention and Visualization', url: 'https://stub.test/api/search/audio/2026-07-09_1048', seconds: 736, date: '2026-07-09' },
];

// ?pad=empty answers with no audios — case 4.
function padDoc(url) {
  const empty = /pad=empty/.test(url);
  return {
    title: empty ? 'set theory' : 'NDE · Telepathy', beats: [], film: null,
    films: [], inbox: null, description: '', descriptionAudio: null,
    voiceover: null,
    episodes: empty ? [] : AUDIOS.filter((a) => a.episodeId).map((a) => a.episodeId),
    sources: empty ? [] : [{ src: '2026-07-09_1048', kind: 'memo', title: 'Reflections on Intention and Visualization', date: '2026-07-09', seconds: 736 }],
    audios: empty ? [] : AUDIOS, updatedAt: 5, pad: empty ? 'empty' : 'ndepad',
  };
}

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const u = req.url;
  if (u.startsWith('/api/scratchpad/inbox')) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ count: 0, items: [] }));
  }
  if (u.startsWith('/api/scratchpad')) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(padDoc(u)));
  }
  const file = path.join(PUB, u.split('?')[0].replace(/^\//, '') || 'index.html');
  if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html'
      : file.endsWith('.css') ? 'text/css'
      : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    return res.end(fs.readFileSync(file));
  }
  res.statusCode = 404; res.end('not found');
});

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok  ' : '  FAIL ') + msg);
  if (!cond) failed = 1;
}

(async () => {
  const exe = browserPath();
  if (!exe) { console.log('no chromium on disk — skipping'); process.exit(0); }
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // Media loads would 404 against the stub host; stub play/pause so glyph
  // logic (which reads player.paused) is what's under test.
  await page.addInitScript(() => {
    localStorage.setItem('scratchpad_pad', 'ndepad');
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      get() { return !this._playing; }, configurable: true,
    });
    HTMLMediaElement.prototype.play = function () { this._playing = true; this.dispatchEvent(new Event('play')); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this._playing = false; this.dispatchEvent(new Event('pause')); };
  });
  await page.goto(base + '/scratchpad.html');
  // THE ROOM OPENS ON THE SHELF (2026-08-23, Sophie) — a story is one tap
  // below it, so step into one the way her tap on a tile does.
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#audios .aurow', { state: 'attached' });

  // 1 — behind the waveform button, not in the page flow
  ok(await page.$eval('#ausheet', (el) => el.hidden), 'the rows start hidden behind the button');
  ok(!(await page.$eval('#audiobtn', (el) => el.hidden)), 'the waveform button shows when audio is attached');
  await page.click('#audiobtn');
  ok(!(await page.$eval('#ausheet', (el) => el.hidden)), 'tapping the waveform opens the list');

  // 2 — the rows
  const rows = await page.$$eval('#audios .aurow', (els) => els.map((el) => ({
    name: el.querySelector('.aunm').textContent,
    dur: el.querySelector('.audur').textContent,
    date: el.querySelector('.audate') ? el.querySelector('.audate').textContent : '',
    hasBtn: Boolean(el.querySelector('.iconbtn')),
  })));
  ok(rows.length === 3, `three listen rows render (got ${rows.length})`);
  ok(rows[0].name === 'Telepathy' && rows[0].dur === '10:49', `first row is Telepathy · 10:49 (got ${rows[0].name} · ${rows[0].dur})`);
  ok(rows[1].name === 'The Grass' && rows[1].dur === '0:40', `second row is The Grass · 0:40 (got ${rows[1].name} · ${rows[1].dur})`);
  ok(rows[2].name.startsWith('Reflections') && rows[2].dur === '12:16', `the memo rides the same list (got ${rows[2].name} · ${rows[2].dur})`);
  ok(rows[2].date === '2026-07-09', `the memo carries its date (got "${rows[2].date}")`);
  ok(rows[0].date === '' && rows[1].date === '', 'an episode shows no date line');
  ok(rows.every((r) => r.hasBtn), 'every row carries a play button');

  // 3 — play → shared player src + pause glyph; tap again pauses
  await page.click('#audios .aurow:nth-child(1) .iconbtn');
  let st = await page.evaluate(() => ({
    src: player.src, playing: !player.paused,
    glyph1: document.querySelector('#audios .aurow:nth-child(1) .iconbtn svg path') ? 'play' : 'pause',
  }));
  ok(st.src === AUDIOS[0].url, `tap points the shared player at the render (got ${st.src})`);
  ok(st.playing, 'player is playing after the tap');
  ok(st.glyph1 === 'pause', 'the playing row shows the pause glyph');
  await page.click('#audios .aurow:nth-child(1) .iconbtn');
  st = await page.evaluate(() => ({ playing: !player.paused, glyph1: document.querySelector('#audios .aurow:nth-child(1) .iconbtn svg path') ? 'play' : 'pause' }));
  ok(!st.playing, 'second tap pauses');
  ok(st.glyph1 === 'play', 'glyph flips back to play');

  // 4 — a second row replaces the first
  await page.click('#audios .aurow:nth-child(1) .iconbtn');
  await page.click('#audios .aurow:nth-child(2) .iconbtn');
  st = await page.evaluate(() => ({
    src: player.src, playing: !player.paused,
    glyph1: document.querySelector('#audios .aurow:nth-child(1) .iconbtn svg path') ? 'play' : 'pause',
    glyph2: document.querySelector('#audios .aurow:nth-child(2) .iconbtn svg path') ? 'play' : 'pause',
  }));
  ok(st.src === AUDIOS[1].url && st.playing, 'starting a second row replaces the first');
  ok(st.glyph1 === 'play' && st.glyph2 === 'pause', 'only the speaking row wears the pause glyph');

  // 5 — a story with nothing attached shows no button (fresh page: the
  // shared page's init script would put the NDE pad back on navigation)
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page2.addInitScript(() => { localStorage.setItem('scratchpad_pad', 'empty'); });
  await page2.goto(base + '/scratchpad.html');
  await page2.evaluate(() => window.openPad('empty'));
  await page2.waitForFunction(() => document.getElementById('title').textContent.length > 0);
  const hidden = await page2.$eval('#audiobtn', (el) => el.hidden);
  const norows = await page2.$eval('#audios', (el) => el.children.length === 0);
  ok(hidden && norows, 'a story with nothing attached shows no waveform button');

  await browser.close();
  server.close();
  console.log(failed ? 'FAILED' : 'all good');
  process.exit(failed);
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/* Tests the Episode Editor → Cutting Room hand-off, end to end, in a real
 * browser against the REAL pages.
 *
 *   node scripts/test-cutroom-handoff.js
 *
 * The hand-off is a contract between two pages that never call each other's
 * code — editor.html builds a URL, cuttingroom.html reads it — so nothing but
 * driving both pages can prove it works. Checks:
 *   1. every render row carries a scissors button
 *   2. tapping it navigates to /cuttingroom?url=…&name=…, with the cut number
 *      taken from the render's FILE (renders is capped at 10 and newest-first,
 *      so a list position is the wrong number)
 *   3. the Cutting Room boots on that url, POSTs it to /open, and enters the
 *      room instead of showing the recordings list
 *   4. it strips the param afterwards, so a reload doesn't yank her back in
 *   5. no url param → the normal recordings list, unchanged
 *
 * The API is stubbed by a local server: this is testing the two pages' wiring,
 * not the cutter. Skips with exit 0 if playwright/Chromium isn't installed
 * (it's an optionalDependency).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.log('playwright not installed — skipping'); process.exit(0);
}

// Playwright only finds the browser build its own version pins, and a host can
// have a different one already installed (PLAYWRIGHT_BROWSERS_PATH). Fall back
// to whatever chromium IS on disk rather than downloading one.
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
const EPISODE = {
  id: 'eptest1234', title: 'Evan — Sheldrake telephone telepathy',
  sources: [{ videoId: 'vid1', experiencer: 'Rupert Sheldrake', timeSec: 100, audioUrl: 'https://example.test/a.webm' }],
  snippets: [], sequence: [], job: null,
  // Newest first, and deliberately NOT starting at 1: the cut number must come
  // from the file, not the row's position.
  renders: [
    { url: 'https://storage.example.test/nde-episodes/editor/eptest1234-7.mp3', at: '2026-08-07T02:09:00.000Z', seconds: 61.4, cards: 6, notes: [] },
    { url: 'https://storage.example.test/nde-episodes/editor/eptest1234-6.mp3', at: '2026-08-07T02:07:00.000Z', seconds: 64.8, cards: 6, notes: [] },
  ],
};

const calls = { open: [] };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (obj, code = 200) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  if (u.pathname === '/editor' || u.pathname === '/cuttingroom') {
    const file = u.pathname === '/editor' ? 'editor.html' : 'cuttingroom.html';
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, file), 'utf8'));
  }
  // ── editor API ──
  if (u.pathname === '/api/editor/') return json({ episodes: [{ id: EPISODE.id, title: EPISODE.title }] });
  if (u.pathname === `/api/editor/${EPISODE.id}`) return json({ episode: EPISODE, transcripts: [] });
  if (u.pathname.startsWith('/api/editor')) return json({ ok: true });
  // ── cutroom API ──
  if (u.pathname === '/api/cutroom/sources') return json({ items: [], projects: {} });
  if (u.pathname === '/api/cutroom/open') {
    let body = '';
    req.on('data', c => { body += c; });
    return req.on('end', () => {
      calls.open.push(JSON.parse(body || '{}'));
      json({ id: 'cr-handed-off', status: 'processing' });
    });
  }
  if (/^\/api\/cutroom\/[^/]+$/.test(u.pathname)) {
    return json({ id: 'cr-handed-off', title: 'handed off', status: 'processing', source: { url: 'x' }, pauses: [], cuts: [], pins: [], clips: [], renders: [], job: { status: 'running', label: 'listening' } });
  }
  if (u.pathname.startsWith('/api/cutroom')) return json({ ok: true });
  res.writeHead(404); res.end('nope');
});

let failures = 0;
function check(name, got, want) {
  const ok = got === want;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const exe = browserPath();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {}).catch(err => {
    console.log('no usable Chromium — skipping:', err.message.split('\n')[0]);
    return null;
  });
  if (!browser) { server.close(); process.exit(0); }
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });
  // The navigated-to URL must be captured as the REQUEST goes out: the Cutting
  // Room strips the params on boot (that's check 4), so reading page.url()
  // afterwards races the page and sees the stripped one.
  const navs = [];
  page.on('request', r => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs.push(r.url()); });

  // ── 1 + 2: the editor's scissors, and the cut number ──
  await page.goto(`${base}/editor`);
  await page.click(`#episodes [data-open="${EPISODE.id}"]`);
  await page.waitForSelector('#renders [data-cutroom]', { timeout: 8000 });

  const buttons = await page.$$('#renders [data-cutroom]');
  check('a scissors button per render row', buttons.length, EPISODE.renders.length);

  const names = await page.$$eval('#renders [data-cutroom]', bs => bs.map(b => b.dataset.cutname));
  check('newest row names itself by its FILE number (cut 7, not cut 2)',
    names[0], 'Evan — Sheldrake telephone telepathy — cut 7');
  check('older row too (cut 6, not cut 1)',
    names[1], 'Evan — Sheldrake telephone telepathy — cut 6');

  await buttons[0].click();
  await page.waitForFunction(() => !!document.getElementById('srclist'), { timeout: 8000 });
  const handed = new URL(navs.find(u => u.includes('/cuttingroom')) || 'http://x/none');
  check('scissors navigates to the Cutting Room',
    handed.pathname, '/cuttingroom');
  check('carrying the render url',
    handed.searchParams.get('url'), EPISODE.renders[0].url);
  check('carrying the name',
    handed.searchParams.get('name'), 'Evan — Sheldrake telephone telepathy — cut 7');

  // ── 3 + 4: the Cutting Room consumes it ──
  await page.waitForFunction(() => !document.getElementById('room').hidden, { timeout: 8000 });
  check('the Cutting Room POSTed /open once', calls.open.length, 1);
  check('/open got the handed-off url', calls.open[0] && calls.open[0].url, EPISODE.renders[0].url);
  check('/open got the name', calls.open[0] && calls.open[0].name, 'Evan — Sheldrake telephone telepathy — cut 7');
  check('it entered the room, not the recordings list',
    await page.$eval('#home', el => el.hidden), true);
  check('the url param is stripped (a reload must not re-yank her in)',
    new URL(page.url()).search, '');

  // ── 5: no param → the ordinary list ──
  calls.open.length = 0;
  const fresh = await browser.newPage();
  fresh.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });
  await fresh.goto(`${base}/cuttingroom`);
  await fresh.waitForFunction(() => !document.getElementById('home').hidden, { timeout: 8000 });
  check('a plain visit shows the recordings list', calls.open.length, 0);

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch(err => { console.error('ERROR', err.message); server.close(); process.exit(1); });

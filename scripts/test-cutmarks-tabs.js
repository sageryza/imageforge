#!/usr/bin/env node
/* Cut Marks: the two hairline tabs (PIECES · MARKS), driven in a real
 * browser against the REAL page.
 *
 *   node scripts/test-cutmarks-tabs.js
 *
 * Sophie's ask (Aug 2026): "I have to scroll down to see the pieces I cut
 * out." So what this asserts is the SCREEN, not the markup:
 *   1. the row appears once there is something to list, and opens on PIECES
 *   2. the pieces card is fully on screen without scrolling (an iPhone 13
 *      viewport, a video at its tallest) — the whole point of the change
 *   3. the player, transport and strip stay put on both tabs (a piece's ▶
 *      preview has to be visible while she reviews pieces)
 *   4. the sliding line measures the LIT tab — no tab count anywhere
 *   5. marking from the pieces tab grows the list under her, no tab jump
 *   6. an old doc with renders but no marks keeps its Cuts (MARKS dims)
 *
 * The API is stubbed by a local server — this is the page's wiring, not the
 * cutter. Skips with exit 0 if playwright/Chromium isn't installed.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

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
// A video with five marks → six pieces, two dropped, and one finished cut.
const DOC = {
  id: 'cm-test-1', title: 'Evan — the long take', kind: 'video', status: 'ready',
  seconds: 620, hasAudio: true, posterUrl: null,
  source: { url: 'https://storage.example.test/dump/evan.mp4', itemId: 'i1' },
  marks: [42.5, 130.25, 260, 388.75, 500],
  dropped: ['130.25-260.00', '388.75-500.00'],
  renders: [{ url: 'https://storage.example.test/cutmarks/cm-test-1/render-1.mp4', at: Date.now(), seconds: 397.5, kept: 4, removed: 222.5 }],
  job: null,
};
// The same recording before anything was marked, but carrying an old cut.
const RENDERS_ONLY = { ...DOC, id: 'cm-test-2', marks: [], dropped: [] };
// The same marks on a RECORDING — its card is small, so the list has room.
const AUDIO = { ...DOC, id: 'cm-test-3', kind: 'audio', renders: [] };

let live = DOC;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/cutmarks') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'cutmarks.html'), 'utf8'));
  }
  if (u.pathname === '/api/cutmarks/sources') return json({ audio: [], videos: [], projects: {} });
  if (u.pathname === '/api/audioproject/walk') return json({ up: [], down: [] });
  if (u.pathname === '/api/cutmarks/open') return json({ id: live.id });
  if (/^\/api\/cutmarks\/[^/]+$/.test(u.pathname) && req.method === 'GET') return json(live);
  if (u.pathname.startsWith('/api/cutmarks')) { req.resume(); return json({ ok: true }); }
  res.writeHead(404); res.end('nope');
});

let failures = 0;
function check(name, got, want) {
  const ok = got === want;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
}
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${got}, wanted ${want} ±${tol}`}`);
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const exe = browserPath();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {}).catch(err => {
    console.log('no usable Chromium — skipping:', err.message.split('\n')[0]); return null;
  });
  if (!browser) { server.close(); process.exit(0); }
  // iPhone 13, the phone she reads on.
  const page = await browser.newPage({ viewport: { width: 390, height: 750 } });
  page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });

  await page.goto(`${base}/cutmarks?url=${encodeURIComponent(DOC.source.url)}&name=Evan&kind=video`);
  await page.waitForSelector('#roomtabs:not([hidden])', { timeout: 8000 });

  // ── 1: the row, opening on PIECES ──
  check('two tabs and nothing more', await page.$$eval('#roomtabs button', b => b.length), 2);
  check('opens on PIECES', await page.$eval('#tabpieces', b => b.classList.contains('on')), true);
  check('the pieces pane is the one showing', await page.$eval('#panepieces', el => el.hidden), false);
  check('the marks pane is not', await page.$eval('#panemarks', el => el.hidden), true);
  check('PIECES counts the pieces (5 marks → 6)', (await page.$eval('#npieces', el => el.textContent)).trim(), '6');
  check('MARKS counts the marks', (await page.$eval('#nmarks', el => el.textContent)).trim(), '5');
  check('six piece rows', await page.$$eval('#pieces .prow', r => r.length), 6);
  check('the two dropped ones are struck out', await page.$$eval('#pieces .prow.dropped', r => r.length), 2);

  // ── 2: no scrolling to reach them ──
  // A tab on its own would only have MOVED the scroll (a video is ~30vh and
  // six pieces still ran off the bottom), so the pane owns the room that is
  // left and scrolls INSIDE it. The assertion is therefore about the PAGE.
  const fit = await page.evaluate(() => {
    const pane = document.getElementById('panepieces');
    const bar = document.getElementById('bbar').getBoundingClientRect();
    const rows = [...document.querySelectorAll('#pieces .prow')]
      .filter(r => r.getBoundingClientRect().bottom <= bar.top).length;
    return {
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
      paneBottom: pane.getBoundingClientRect().bottom, barTop: bar.top,
      listTop: document.getElementById('pieces').getBoundingClientRect().top,
      paneScrolls: pane.scrollHeight > pane.clientHeight, rows,
    };
  });
  check('the PAGE does not scroll at all — the whole ask', fit.pageScrolls, false);
  check('the list starts on screen', fit.listTop < fit.barTop, true);
  check('the pane stops above the bottom bar', fit.paneBottom <= fit.barTop, true);
  // Measured 390x750: four of six rows at once under a video, five under a
  // recording's smaller card (below) — the rest is one flick INSIDE the list,
  // with the player, the strip and MARK all still on screen while she does it.
  check('four of the six rows are on screen at once', fit.rows >= 4, true);
  check('the overflow scrolls inside the pane, not the page', fit.paneScrolls, true);

  // ── 3: the instrument never tabs away ──
  const instrument = () => page.evaluate(() => ({
    vid: !document.getElementById('vid').hidden,
    seg: !!document.querySelector('.hseg').getClientRects().length,
    strip: !!document.getElementById('strip').getClientRects().length,
    mark: !document.getElementById('bbar').hidden,
  }));
  check('on PIECES: player + transport + strip + MARK all live',
    JSON.stringify(await instrument()), JSON.stringify({ vid: true, seg: true, strip: true, mark: true }));
  await page.click('#tabmarks');
  check('on MARKS too', JSON.stringify(await instrument()),
    JSON.stringify({ vid: true, seg: true, strip: true, mark: true }));
  check('MARKS shows the mark rows', await page.$$eval('#marks .mrow', r => r.length), 5);
  check('switching tabs still leaves the page unscrollable',
    await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1), false);
  check('and hides the pieces', await page.$eval('#panepieces', el => el.hidden), true);

  // ── 4: the line measures the lit tab ──
  const lineOn = async () => page.evaluate(() => {
    const on = document.querySelector('#roomtabs button.on').getBoundingClientRect();
    const l = document.querySelector('#roomtabs .tline').getBoundingClientRect();
    return { dw: l.width - on.width, dx: l.left - on.left };
  });
  await page.waitForTimeout(300);
  let L = await lineOn();
  near('the line is as wide as the lit tab (MARKS)', L.dw, 0, 1.5);
  near('and sits under it', L.dx, 0, 1.5);
  await page.click('#tabpieces');
  await page.waitForTimeout(300);
  L = await lineOn();
  near('follows to PIECES — width', L.dw, 0, 1.5);
  near('follows to PIECES — position', L.dx, 0, 1.5);

  // ── 5: marking from the pieces tab grows the list under her ──
  await page.evaluate(() => { document.getElementById('vid').currentTime = 300; });
  await page.click('#mark');
  await page.waitForTimeout(200);
  check('a new mark splits a piece in front of her', await page.$$eval('#pieces .prow', r => r.length), 7);
  check('and she is still on PIECES', await page.$eval('#tabpieces', b => b.classList.contains('on')), true);
  check('the count followed', (await page.$eval('#npieces', el => el.textContent)).trim(), '7');

  // ── 6: renders but no marks — the Cuts survive, MARKS dims ──
  live = RENDERS_ONLY;
  const p2 = await browser.newPage({ viewport: { width: 390, height: 750 } });
  p2.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });
  await p2.goto(`${base}/cutmarks?url=${encodeURIComponent(DOC.source.url)}&name=Evan&kind=video`);
  await p2.waitForSelector('#roomtabs:not([hidden])', { timeout: 8000 });
  check('the row is still there for an old cut', await p2.$eval('#roomtabs', el => el.hidden), false);
  check('the Cuts are showing', await p2.$eval('#rendersWrap', el => el.hidden), false);
  check('no pieces list', await p2.$eval('#piecesWrap', el => el.hidden), true);
  check('MARKS is dimmed out', await p2.$eval('#tabmarks', b => b.disabled), true);
  check('and the counts stay off', (await p2.$eval('#nmarks', el => el.textContent)).trim(), '');

  // ── 7: audio — the card is small, so every piece fits with room to spare ──
  live = AUDIO;
  const p3 = await browser.newPage({ viewport: { width: 390, height: 750 } });
  p3.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });
  await p3.goto(`${base}/cutmarks?url=${encodeURIComponent(AUDIO.source.url)}&name=Evan&kind=audio`);
  await p3.waitForSelector('#roomtabs:not([hidden])', { timeout: 8000 });
  const afit = await p3.evaluate(() => {
    const pane = document.getElementById('panepieces');
    const barTop = document.getElementById('bbar').getBoundingClientRect().top;
    return {
      rows: [...document.querySelectorAll('#pieces .prow')]
        .filter(r => r.getBoundingClientRect().bottom <= barTop).length,
      paneScrolls: pane.scrollHeight > pane.clientHeight,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
    };
  });
  check('five of the six on screen for a recording (the smaller card)', afit.rows >= 5, true);
  check('and the page still does not scroll', afit.pageScrolls, false);

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch(err => { console.error('ERROR', err.message); server.close(); process.exit(1); });

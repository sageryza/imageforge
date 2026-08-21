#!/usr/bin/env node
/* Cut Marks: the two hairline tabs (CUT · MARKS & PIECES), driven in a real
 * browser against the REAL page.
 *
 *   node scripts/test-cutmarks-tabs.js
 *
 * Sophie's ask (Aug 2026): "tabs at the top and one of them is for cutting
 * out of the video and the other tab is for looking at all the marks and
 * pieces you've made." So what this asserts is the SCREEN, not the markup:
 *   1. the row is the FIRST thing in the room, above the picture, and opens
 *      on CUT
 *   2. CUT is the cutting and nothing else: picture, transport, strip — no
 *      lists under it to scroll past
 *   3. the other tab holds all three lists (pieces, marks, cuts) with the
 *      first of them on screen without scrolling, and the picture put away
 *   4. the sliding line measures the LIT tab — no tab count anywhere
 *   5. the MARK bar works from both, and marking grows the lists
 *   6. ▶ on a piece and a tap on a mark's time go back to CUT, where the
 *      picture and the playhead are
 *   7. nothing marked yet → the lists tab says so rather than going blank
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
  await page.waitForSelector('#markui:not([hidden])', { timeout: 8000 });

  // ── 1: at the top, opening on CUT ──
  check('two tabs and nothing more', await page.$$eval('#roomtabs button', b => b.length), 2);
  check('the row is the FIRST thing in the room',
    await page.$eval('#markui', el => el.firstElementChild.id
      || el.children[1].id), 'roomtabs');
  check('above the picture', await page.evaluate(() =>
    document.getElementById('roomtabs').getBoundingClientRect().bottom
      <= document.getElementById('vid').getBoundingClientRect().top), true);
  check('opens on CUT', await page.$eval('#tabcut', b => b.classList.contains('on')), true);

  // ── 2: CUT is the cutting and nothing else ──
  const cut = await page.evaluate(() => ({
    vid: !document.getElementById('vid').hidden,
    seg: !!document.querySelector('.hseg').getClientRects().length,
    strip: !!document.getElementById('strip').getClientRects().length,
    mark: !document.getElementById('bbar').hidden,
    lists: !!document.getElementById('panelists').getClientRects().length,
    scrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
  }));
  check('picture, transport, strip and MARK are all there',
    JSON.stringify([cut.vid, cut.seg, cut.strip, cut.mark]), JSON.stringify([true, true, true, true]));
  check('no lists under them', cut.lists, false);
  check('so the cutting tab does not scroll at all', cut.scrolls, false);

  // ── 3: the other tab is everything she has made ──
  await page.click('#tablists');
  const lists = await page.evaluate(() => {
    const bar = document.getElementById('bbar').getBoundingClientRect().top;
    const first = document.getElementById('pieces').getBoundingClientRect();
    return {
      pieces: document.querySelectorAll('#pieces .prow').length,
      dropped: document.querySelectorAll('#pieces .prow.dropped').length,
      marks: document.querySelectorAll('#marks .mrow').length,
      cuts: document.querySelectorAll('#renders .rrow').length,
      vid: !!document.getElementById('vid').getClientRects().length,
      mark: !document.getElementById('bbar').hidden,
      scroll: window.scrollY,
      firstTop: first.top, firstBottom: first.bottom, barTop: bar,
      rowsOnScreen: [...document.querySelectorAll('#pieces .prow')]
        .filter(r => r.getBoundingClientRect().bottom <= bar).length,
    };
  });
  check('six pieces (five marks)', lists.pieces, 6);
  check('the two dropped ones are struck out', lists.dropped, 2);
  check('all five marks', lists.marks, 5);
  check('and the finished cut', lists.cuts, 1);
  check('the picture is put away', lists.vid, false);
  check('the MARK bar still works from here', lists.mark, true);
  check('it opens at the top of the list, unscrolled', lists.scroll, 0);
  check('the whole pieces card is on screen without scrolling',
    lists.firstBottom <= lists.barTop, true);
  check('every piece row too', lists.rowsOnScreen, 6);

  // ── 4: the line measures the lit tab ──
  const lineOn = async () => page.evaluate(() => {
    const on = document.querySelector('#roomtabs button.on').getBoundingClientRect();
    const l = document.querySelector('#roomtabs .tline').getBoundingClientRect();
    return { dw: l.width - on.width, dx: l.left - on.left };
  });
  await page.waitForTimeout(300);
  let L = await lineOn();
  near('the line is as wide as the lit tab (MARKS & PIECES)', L.dw, 0, 1.5);
  near('and sits under it', L.dx, 0, 1.5);
  await page.click('#tabcut');
  await page.waitForTimeout(300);
  L = await lineOn();
  near('follows to CUT — width', L.dw, 0, 1.5);
  near('follows to CUT — position', L.dx, 0, 1.5);

  // ── 5: marking, from the cutting tab ──
  await page.evaluate(() => { document.getElementById('vid').currentTime = 300; });
  await page.click('#mark');
  await page.waitForTimeout(200);
  check('marking leaves her on CUT', await page.$eval('#tabcut', b => b.classList.contains('on')), true);
  await page.click('#tablists');
  check('and the new piece is waiting on the other tab',
    await page.$$eval('#pieces .prow', r => r.length), 7);

  // ── 6: playing a piece goes where the picture is ──
  await page.click('#pieces .prow:nth-child(2) .pplay');
  check('▶ on a piece hands her back to CUT',
    await page.$eval('#tabcut', b => b.classList.contains('on')), true);
  await page.click('#tablists');
  await page.click('#marks .mrow:nth-child(2) .t');
  check('so does tapping a mark\'s time — the playhead is there',
    await page.$eval('#tabcut', b => b.classList.contains('on')), true);
  check('the playhead moved with her',
    await page.$eval('#vid', v => Math.round(v.currentTime)), 130);

  // ── 6b: a recording always OPENS on the cutting, whatever she left lit ──
  await page.click('#tablists');
  await page.reload();
  await page.waitForSelector('#markui:not([hidden])', { timeout: 8000 });
  check('reopening lands on CUT, not on the list she left lit',
    await page.$eval('#tabcut', b => b.classList.contains('on')), true);
  check('and the picture is back', await page.$eval('#vid', v => !!v.getClientRects().length), true);

  // ── 7: nothing marked yet ──
  live = { ...DOC, id: 'cm-test-2', marks: [], dropped: [], renders: [] };
  const p2 = await browser.newPage({ viewport: { width: 390, height: 750 } });
  p2.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });
  await p2.goto(`${base}/cutmarks?url=${encodeURIComponent(DOC.source.url)}&name=Evan&kind=video`);
  await p2.waitForSelector('#markui:not([hidden])', { timeout: 8000 });
  check('the row is there before anything is marked',
    await p2.$eval('#roomtabs', el => !!el.getClientRects().length), true);
  await p2.click('#tablists');
  check('and the empty tab says so rather than going blank',
    await p2.$eval('#listsempty', el => el.hidden), false);
  check('no pieces card', await p2.$eval('#piecesWrap', el => el.hidden), true);

  // ── 8: an old cut with no marks still lists its Cuts ──
  live = { ...DOC, id: 'cm-test-3', marks: [], dropped: [] };
  const p3 = await browser.newPage({ viewport: { width: 390, height: 750 } });
  p3.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });
  await p3.goto(`${base}/cutmarks?url=${encodeURIComponent(DOC.source.url)}&name=Evan&kind=video`);
  await p3.waitForSelector('#markui:not([hidden])', { timeout: 8000 });
  await p3.click('#tablists');
  check('the Cuts are there', await p3.$eval('#rendersWrap', el => el.hidden), false);
  check('and no empty line beside them', await p3.$eval('#listsempty', el => el.hidden), true);

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch(err => { console.error('ERROR', err.message); server.close(); process.exit(1); });

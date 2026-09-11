#!/usr/bin/env node
// EACH REPLY IN A RUN FOLDS ON ITS OWN (2026-09-11, Sophie: "messages w two
// replies - make it so i can collapse each reply individually"). The dribble
// merge draws a run of replies as ONE row with every part open — right, and
// her own correction to the first cut, which hid them — so a run of four long
// turns is four long turns of scrolling with nothing to put any of them away.
// The part's own small time line IS the fold now.
//
// EVERY ASSERTION HERE IS A MEASUREMENT. A heading that carries the right
// markup and never folds anything, one folded with CSS that never landed, a
// fold that springs open on the next poll, and a tap that also starts the
// reading-aid autoscroll all look identical to any source assertion.
//
//   npm install playwright-core --no-save && node scripts/test-chats-part-fold.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const M = 60 * 1000;
// Long bodies on purpose: the complaint is the scrolling, so a part has to be
// tall enough that folding it is worth a tap.
const body = (id) => 'reply ' + id + ' body\n' + Array.from({ length: 24 }, (_, i) => id + ' line ' + i).join('\n');
const c = (id, at) => ({ id, chat: 'watcher', from: 'claude', text: body(id), tldr: 'reply ' + id, created: iso(at), postedAt: iso(at) });
const MSGS = [
  c('m4', T0), c('m3', T0 - 4 * M), c('m2', T0 - 7 * M), c('m1', T0 - 10 * M),
  { id: 's1', chat: 'watcher', from: 'sophie', text: 'ok', created: iso(T0 - 30 * M), postedAt: iso(T0 - 30 * M) },
  c('m0', T0 - 40 * M),   // alone — no run, so nothing to fold
];

const servePublic = require('./lib/public-asset');
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'b1', chats: { watcher: { account: '1' } }, settings: {}, truncated: [], messages: since ? [] : MSGS, delta: !!since }));
  }
  if (url.pathname === '/api/chatfeed/search') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ results: [{ chat: 'watcher', id: 'm1', snippet: 'm1 line 3', created: iso(T0 - 10 * M) }], chatMatches: [] }));
  }
  if (url.pathname === '/api/chatfeed/thread') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages: MSGS }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [], questions: [] }));
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('ok - ' + m);

// What the screen really shows for each part: the height of its BODY (0 when
// folded away), and whether the first-line preview is painted beside the time.
const parts = (page) => page.evaluate(() => {
  const r = document.querySelector('#thread .msg[data-mid="m4"]');
  if (!r) return null;
  return [...r.querySelectorAll('.m-part')].map((p) => {
    const b = p.querySelector('.m-partb'), h = p.querySelector('.m-partt'), pv = p.querySelector('.mp-pv');
    return {
      mid: p.dataset.mid,
      body: b ? Math.round(b.getBoundingClientRect().height) : -1,
      head: h ? Math.round(h.getBoundingClientRect().height) : -1,
      headw: h ? Math.round(h.getBoundingClientRect().width) : -1,
      pv: pv && pv.getBoundingClientRect().height > 0 ? pv.textContent.trim() : '',
      aria: h ? h.getAttribute('aria-expanded') : null,
    };
  });
});
// Which element a tap at the heading's own centre would actually reach.
const reaches = (page, mid) => page.evaluate((id) => {
  const h = document.querySelector('#thread .msg[data-mid="m4"] .m-part[data-mid="' + id + '"] .m-partt');
  if (!h) return 'none';
  const r = h.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !el ? 'nothing' : (h.contains(el) || el === h) ? 'the heading' : (el.className || el.tagName);
}, mid);
// The run is four long replies, so a heading is usually below the fold: bring
// it on screen FIRST, so what is measured next is the tap she really makes.
const bring = async (page, mid) => {
  await page.evaluate((id) => {
    const h = document.querySelector('#thread .msg[data-mid="m4"] .m-part[data-mid="' + id + '"] .m-partt');
    if (h) window.scrollTo(0, window.scrollY + h.getBoundingClientRect().top - 300);
  }, mid);
  await page.waitForTimeout(120);
};
const tapHead = async (page, mid) => {
  const sel = '#thread .msg[data-mid="m4"] .m-part[data-mid="' + mid + '"] .m-partt';
  if (!(await page.$(sel))) { fail('no fold control on part ' + mid); return false; }
  await bring(page, mid);
  // Guarded: on a page with no fold the heading is still THERE (it is the
  // part's time line), so a bare click hangs on an element that never becomes
  // tappable. A failure has to read as a failure, not as a timeout.
  try { await page.click(sel, { timeout: 2500 }); }
  catch (e) { fail('the heading on part ' + mid + ' does not take a tap'); return false; }
  await page.waitForTimeout(160);
  return true;
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=watcher', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  await page.click('#thread .msg[data-mid="m4"] .m-preview');
  await page.waitForTimeout(200);

  // 1. OPEN BY DEFAULT — her correction to the first cut of the merge stands
  let ps = await parts(page);
  if (!ps || ps.length !== 4) { fail('the run did not draw four parts: ' + JSON.stringify(ps)); }
  else if (ps.every((p) => p.body > 40)) ok('every part opens showing its whole reply — nothing is hidden until she taps');
  else fail('part body heights on open: ' + JSON.stringify(ps.map((p) => p.body)));
  if (ps && ps.every((p) => !p.pv)) ok('open, no first-line preview — the words are right there');
  else fail('a preview shows while the part is open: ' + JSON.stringify(ps && ps.map((p) => p.pv)));

  // 2. the heading is a real target, and the pill is not sitting on it
  if (ps && ps.every((p) => p.head >= 28)) ok('each fold heading is at least 28px tall');
  else fail('heading heights: ' + JSON.stringify(ps && ps.map((p) => p.head)));
  if (ps && ps.every((p) => p.headw > 200)) ok('the whole line is the target, not a caret to hit');
  else fail('heading widths: ' + JSON.stringify(ps && ps.map((p) => p.headw)));
  await bring(page, 'm2');
  const hit = await reaches(page, 'm2');
  if (hit === 'the heading') ok('a tap at the heading’s own centre reaches it'); else fail('the tap reaches ' + hit);

  // 3. ONE part folds, and only that one
  if (await tapHead(page, 'm2')) {
    ps = await parts(page);
    const m2 = ps.find((p) => p.mid === 'm2'), rest = ps.filter((p) => p.mid !== 'm2');
    if (m2 && m2.body === 0) ok('tapping a part’s heading folds that reply away'); else fail('m2 body after the tap: ' + (m2 && m2.body));
    if (rest.every((p) => p.body > 40)) ok('the other three replies are untouched'); else fail('others after the tap: ' + JSON.stringify(rest.map((p) => p.body)));
    if (m2 && m2.pv === 'reply m2') ok('shut, the part still names itself — its first line beside its time');
    else fail('the shut heading shows: ' + JSON.stringify(m2 && m2.pv));
    if (m2 && m2.aria === 'false') ok('the heading says it is collapsed'); else fail('aria-expanded: ' + (m2 && m2.aria));
  }

  // 4. the tap is not also the reading-aid autoscroll — a tap on `.m-full` is,
  //    so the page would be walking itself down a second after her tap. Judged
  //    over an INTERVAL that begins after the tap has settled: the click's own
  //    scroll-into-view is not the autoscroll.
  const at1 = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(900);
  const at2 = await page.evaluate(() => window.scrollY);
  if (Math.abs(at2 - at1) < 6) ok('folding a part never starts the page moving under her');
  else fail('the page kept moving after the tap (' + at1 + ' → ' + at2 + ')');

  // 5. THE FOLD SURVIVES A REPAINT — the thread rebuilds on every poll, and
  //    a fold that lives on the node alone springs open a few seconds later
  await page.evaluate(() => window.__openChat('watcher'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { const r = document.querySelector('#thread .msg[data-mid="m4"]'); if (r) r.classList.add('open'); });
  ps = await parts(page);
  let m2 = ps && ps.find((p) => p.mid === 'm2');
  if (m2 && m2.body === 0) ok('a rebuilt thread keeps the fold — it cannot spring open under her');
  else fail('m2 body after a rebuild: ' + (m2 && m2.body));

  // 6. tapping again puts it back
  if (await tapHead(page, 'm2')) {
    ps = await parts(page);
    m2 = ps.find((p) => p.mid === 'm2');
    if (m2 && m2.body > 40 && !m2.pv && m2.aria === 'true') ok('tapping the heading again opens the reply');
    else fail('m2 after the second tap: ' + JSON.stringify(m2));
  }

  // 7. a jump to a folded part OPENS it — landing on a collapsed reply is
  //    landing on nothing
  await tapHead(page, 'm1');
  await page.evaluate(() => { const b = document.getElementById('back'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.click('#searchbtn');
  await page.waitForSelector('#qsearch', { state: 'visible' });
  await page.fill('#qsearch', 'm1 line 3');
  await page.waitForSelector('#searchresults .sres', { timeout: 4000 });
  await page.click('#searchresults .sres');
  await page.waitForTimeout(400);
  ps = await parts(page);
  const m1 = ps && ps.find((p) => p.mid === 'm1');
  if (m1 && m1.body > 40) ok('a jump to a folded turn opens it'); else fail('m1 after the jump: ' + JSON.stringify(m1));

  // 8. a message that is not a run has no fold at all — a dead control on a
  //    single reply would be one more thing on screen doing nothing
  const lone = await page.$$eval('#thread .msg[data-mid="m0"] .m-partt', (ns) => ns.length);
  if (lone === 0) ok('a message that is not a run carries no fold'); else fail(lone + ' fold controls on a lone message');

  await browser.close();
  server.close();
  console.log(failed ? '\n' + failed + ' FAILED' : '\nall good');
})().catch((e) => { console.error(e); process.exit(1); });

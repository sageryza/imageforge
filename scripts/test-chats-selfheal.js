#!/usr/bin/env node
// THE CHATS PAGE HEALS ITS OWN STALENESS (2026-09-02, Sophie: "build self heal").
//
// #2048's stale merge put a clobbered chats.html live for two hours, and every
// phone that loaded it in that window kept it — the app holds the Chats web
// view for the whole app process — so the repair could not reach her without a
// force-quit. The Playground's rule, ported (test-playground-selfheal.js is
// the model): the build id is a HASH stamped by serveGated, read LAZILY, and
// the page reloads ONLY when nothing she holds would be lost.
//
// Drives the REAL public/chats.html against a stub that stamps the page the
// way serveGated does and answers /api/chatfeed/build with a build it can
// change under the page:
//   1. the stamp is on the page and the check really asks the server,
//   2. same build → nothing happens,
//   3. a new build with nothing held → the page reloads, onto the HOME with no
//      stale `?chat=` on it,
//   4. …and from inside a thread, onto THAT thread (`?chat=<slug>`),
//   5. each guard holds the reload: words in a composer, an open sheet, an open
//      Compare page, an open picture, Select mode, a running autoscroll, a tap
//      in the last ten seconds — and RELEASING the guard lets it through, so a
//      broken check cannot pass as a cautious one,
//   6. coming back to the tab runs the check.
//
//   npm install playwright-core --no-save && node scripts/test-chats-selfheal.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const MSGS = [
  { id: 'm1', chat: 'triset', from: 'claude', text: 'the venn centre', tldr: 'triset', created: iso(T0 - 3600e3), postedAt: iso(T0 - 3600e3) },
  { id: 'm2', chat: 'other',  from: 'claude', text: 'another chat',    tldr: 'other',  created: iso(T0 - 7200e3), postedAt: iso(T0 - 7200e3) },
];
const CHATS = { triset: { lastSeen: MSGS[0].created }, other: { lastSeen: MSGS[1].created } };

let STAMP = 'aaaaaaaaaaaa';   // what the served page carries
let LIVE = 'aaaaaaaaaaaa';    // what /build answers
let loads = 0, buildHits = 0;
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed/build') {
    buildHits++;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ build: LIVE }));
  }
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      settings: { categories: [], pileLabels: [] }, chats: CHATS }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    loads++;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    // serveGated's shape: the page, then the stamp APPENDED after it.
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8')
      + '<script>window.__forgeBuild=' + JSON.stringify(STAMP) + '</script>');
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
let checks = 0;
const ok = (c, m) => { if (c) checks++; else fail(m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  const check = () => page.evaluate(() => window.__chBuildCheck());
  const fresh = () => page.evaluate(() => window.__chHeal.touch(0));   // the tap that set things up is not a hold
  const settle = () => page.waitForTimeout(500);

  await page.goto(base + '/chats');
  await page.waitForSelector('#listrow .acctab');
  await settle();

  // ── 1. the stamp, read lazily, and a real ask ─────────────────────────────
  ok(await page.evaluate(() => window.__forgeBuild) === STAMP, 'the served page carries the stamp');
  ok(await page.evaluate(() => typeof window.__chBuildCheck === 'function'), 'the check is exposed');
  const hits0 = buildHits;
  // ── 2. same build → nothing ───────────────────────────────────────────────
  ok(await check() === false, 'same build: the check answers false');
  ok(buildHits === hits0 + 1, 'the check really asked /api/chatfeed/build (a cached stamp would have skipped it)');
  await settle();
  ok(loads === 1, 'same build: no reload (' + loads + ' loads)');

  // ── 3. a new build, nothing held → reload onto the home ───────────────────
  LIVE = 'bbbbbbbbbbbb';
  await fresh();
  const nav = page.waitForNavigation({ timeout: 4000 }).catch(() => null);
  const r3 = await check();
  await nav;
  await settle();
  ok(r3 === true, 'new build, nothing held: the check reloads');
  ok(loads === 2, 'the page loaded again (' + loads + ')');
  ok(new URL(page.url()).search === '', 'a home reload carries no stale ?chat= — it is ' + page.url());
  STAMP = LIVE;   // the reloaded page is the new build now

  // ── 4. from inside a thread → back onto that thread ───────────────────────
  await page.goto(base + '/chats?chat=triset');
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await settle();
  ok(await page.evaluate(() => window.__chHeal.cur()) === 'triset', 'the thread is open (cur = triset)');
  ok(await page.evaluate(() => window.__chHeal.reloadTo()) === '/chats?chat=triset', 'a reload from a thread aims at that thread');
  LIVE = 'cccccccccccc';
  await fresh();
  const nav4 = page.waitForNavigation({ timeout: 4000 }).catch(() => null);
  const r4 = await check();
  await nav4; await settle();
  ok(r4 === true, 'new build from inside a thread: it reloads');
  // The page SPENDS the `?chat=` door on arrival (replaceState), so the url
  // says nothing — the thread being open is the only honest question.
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  ok(await page.evaluate(() => window.__chHeal.cur()) === 'triset', 'and lands back in the thread (cur = triset after the heal)');
  STAMP = LIVE;

  // ── 5. the guards — each holds, and releasing it lets the reload through ──
  // A guard is only proven by BOTH halves: held → false, released → true.
  const guard = async (name, hold, release, keepTouch) => {
    LIVE = 'd' + Math.random().toString(16).slice(2, 13).padEnd(11, '0');
    // A hold set up by a CLICK also stamps a tap; clear that so the guard under
    // test is the only thing holding — except for the tap guard itself.
    await hold(); if (!keepTouch) await fresh();
    const held = await check();
    await settle();
    ok(held === false, name + ': the check holds');
    ok(!page.isClosed() && await page.evaluate(() => !!window.__chBuildCheck), name + ': the page is still the one she was on');
    await release(); await fresh();
    const nav = page.waitForNavigation({ timeout: 4000 }).catch(() => null);
    const freed = await check();
    await nav; await settle();
    ok(freed === true, name + ': released, it reloads');
    STAMP = LIVE;
    // back to a clean thread for the next guard
    await page.goto(base + '/chats?chat=triset');
    await page.waitForSelector('#thread .msg', { timeout: 6000 });
    await settle();
  };
  // words in the composer (a message she is half-way through)
  await page.goto(base + '/chats?chat=triset'); await page.waitForSelector('#thread .msg', { timeout: 6000 }); await settle();
  await guard('a half-typed message',
    () => page.evaluate(() => { const t = document.querySelector('#thread textarea'); t.value = 'wait, also the glove ones'; }),
    () => page.evaluate(() => { document.querySelectorAll('textarea').forEach((t) => { t.value = ''; }); document.activeElement && document.activeElement.blur(); }));
  // an open sheet
  await guard('an open sheet',
    async () => { await page.click('.orgbtn'); await page.waitForSelector('.askwrap'); },
    () => page.evaluate(() => { document.querySelectorAll('.askwrap').forEach((w) => w.remove()); }));
  // an open Compare page / deck
  await guard('an open Compare page',
    () => page.evaluate(() => { const v = document.createElement('div'); v.className = 'pageview'; document.body.appendChild(v); }),
    () => page.evaluate(() => { document.querySelectorAll('.pageview').forEach((v) => v.remove()); }));
  // an open picture
  await guard('an open picture',
    () => page.evaluate(() => { document.getElementById('clightbox').appendChild(document.createElement('div')); }),
    () => page.evaluate(() => { document.getElementById('clightbox').innerHTML = ''; }));
  // Select mode
  await guard('Select mode',
    () => page.evaluate(() => window.__chHeal.set('selMode', true)),
    () => page.evaluate(() => window.__chHeal.set('selMode', false)));
  // a running autoscroll
  await guard('a running autoscroll',
    () => page.evaluate(() => window.__chHeal.set('playing', true)),
    () => page.evaluate(() => window.__chHeal.set('playing', false)));
  // a tap in the last ten seconds
  await guard('a recent tap',
    () => page.evaluate(() => window.__chHeal.touch(Date.now())),
    () => page.evaluate(() => window.__chHeal.touch(0)), true);

  // ── 6. coming back to the tab runs the check ──────────────────────────────
  const hits6 = buildHits;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(300);
  ok(buildHits === hits6 + 1, 'visibilitychange → visible asks the server (' + (buildHits - hits6) + ' asks)');

  await browser.close();
  server.close();
  if (process.exitCode) console.error('\n' + checks + ' checks passed before the failures above');
  else console.log('OK — ' + checks + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });

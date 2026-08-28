#!/usr/bin/env node
// THE PLAYGROUND HEALS ITS OWN STALENESS (2026-08-27, Sophie: "it's not
// there" — about the back-to-top arrow — then "self heal").
//
// The arrow had been live and correct on the served page for a day: measured
// that hour, the bytes Render answers with carry it and the live html renders
// it at her viewport with the iPhone 13's 47px safe-area inset. What she was
// looking at was an OLD PAGE. The iOS app keeps the three recent tools alive
// in a ZStack, so /playground loads ONCE per app process and re-entering the
// tool shows the same one — no deploy can reach it.
//
// Two halves, and the second is the one this page needed that the Film Editor
// did not:
//
//   1. THE BUILD ID IS DERIVED (page-build.js, pure) — a hash of the page file
//      PLUS the pill. A hand-bumped const is one forgotten edit away from a
//      self-heal that never fires, and the pill half is load-bearing: the
//      back-to-top arrow that started this is a pill change and nothing else,
//      so a page-only hash would be blind to exactly the edit it exists for.
//
//   2. IT RELOADS ONLY WHEN NOTHING WOULD BE LOST. The Film Editor's state is
//      all server-side; the Playground holds real unsaved things — her typed
//      prompt, an attached photo, a picked cast, a quality/size moved off
//      default, a search in progress, an open sheet. A silent reload that
//      threw any of those away would be a worse bug than the one being fixed.
//      Every guard is driven here against the REAL page.
//
//   npm install playwright --no-save && node scripts/test-playground-selfheal.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const servePublic = require('./lib/public-asset');
const pageBuild = require('../page-build');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

// ── 1. THE ID IS DERIVED — pure, no browser ────────────────────────────────
console.log('THE BUILD ID IS A HASH, NOT A CONST');
{
  const a = pageBuild.pageBuildId('promptlab.html', true);
  ok(/^[0-9a-f]{12}$/.test(a), 'it is a content hash');
  ok(pageBuild.pageBuildId('promptlab.html', true) === a, 'and it is stable for one deploy');
  ok(pageBuild.pageBuildId('promptlab.html', false) !== a,
    'the PILL is part of it — a pill-less page hashes differently');

  // Edit each source in a scratch copy and ask again: BOTH must move the id,
  // because from her side a pill change is a page change (the arrow itself).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pgbuild-'));
  const scratch = path.join(tmp, 'public');
  fs.mkdirSync(scratch);
  const page = path.join(scratch, 'promptlab.html');
  const pill = path.join(scratch, pageBuild.PILL);
  fs.copyFileSync(path.join(PUB, 'promptlab.html'), page);
  fs.copyFileSync(path.join(PUB, pageBuild.PILL), pill);
  // A second instance rooted at the scratch dir — same code, different files.
  const mod = path.join(tmp, 'page-build.js');
  fs.writeFileSync(mod, fs.readFileSync(path.join(__dirname, '..', 'page-build.js')));
  const scratchBuild = require(mod);
  const before = scratchBuild.pageBuildId('promptlab.html', true);
  fs.appendFileSync(page, '\n<!-- a page edit -->\n');
  scratchBuild.forget();
  const afterPage = scratchBuild.pageBuildId('promptlab.html', true);
  ok(afterPage !== before, 'a change to the PAGE moves it');
  fs.appendFileSync(pill, '\n<!-- a pill edit -->\n');
  scratchBuild.forget();
  ok(scratchBuild.pageBuildId('promptlab.html', true) !== afterPage,
    'a change to the PILL moves it too — the arrow lives there');
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── 2. THE PAGE, DRIVEN ────────────────────────────────────────────────────
const RUNS = Array.from({ length: 6 }, (_, r) => ({
  id: 'run' + r, prompt: 'a fox asleep on a radiator ' + r, status: 'done',
  engine: 'gptimage', model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
  images: Array.from({ length: 3 }, (_, i) => '/px.png?r=' + r + '&i=' + i),
  votes: {}, createdAt: T0 - r * 60000,
}));

const SERVED = pageBuild.pageBuildId('promptlab.html', true);
let currentBuild = SERVED;          // what GET /build answers — the test moves it
let buildCalls = 0;

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab/build') {
    buildCalls++;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ build: currentBuild }));
  }
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname === '/api/promptlab/styles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ styles: {} }));
  }
  if (url.pathname === '/api/promptlab/characters') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ characters: [], max: 4 }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    // Served the way serveGated serves it: the page, the shared pill, and the
    // build stamp. The stamp is what the page compares itself against.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8')
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8')
      + '<script>window.__forgeBuild=' + JSON.stringify(SERVED) + '</script>');
  }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js'
      || url.pathname === '/playground-port.js') {
    const f = path.join(PUB, url.pathname.slice(1));
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404).end();
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => fail('page error: ' + e.message));

  // "Did it reload?" is asked of the DOCUMENT itself: performance.timeOrigin
  // is stamped when a document is created, so a new one is a different number.
  // (page.waitForLoadState resolves at once when the current document is
  // already loaded, so it cannot tell a reload from no reload at all.)
  const docId = () => page.evaluate(() => performance.timeOrigin)
    .catch(() => docId());                       // mid-navigation: ask again
  const waitNewDoc = async (was) => {
    for (let i = 0; i < 100; i++) {
      const now = await docId();
      if (now !== was) return now;
      await page.waitForTimeout(50);
    }
    return was;
  };

  const open = async () => {
    await page.goto(base + '/playground');
    await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);
    // Step past the 10s "under her thumb" guard without waiting 10 real
    // seconds: the guard is about a tap she JUST made, and every case below is
    // about what she is HOLDING.
    await page.evaluate(() => { window.__plTouchReset = true; });
  };
  // The page stamps plTouchedAt from a capture-phase pointerdown/keydown, so
  // anything playwright clicks arms it. Rewind it before each ask.
  const check = () => page.evaluate(() => {
    // eslint-disable-next-line no-undef
    plTouchedAt = 0;
    return window.__plBuildCheck();
  });

  await open();

  console.log('\nTHE STAMP REACHES THE PAGE');
  ok(await page.evaluate(() => window.__forgeBuild) === SERVED,
    'serveGated injects window.__forgeBuild');
  ok(await page.evaluate(() => typeof window.__plBuildCheck) === 'function',
    'and the page exposes its check');

  console.log('\nSAME BUILD — IT NEVER RELOADS');
  let doc = await docId();
  const asked = buildCalls;
  ok(await check() === false, 'a matching build is a no-op');
  // NOT VACUOUSLY: it has to have ASKED. The first cut read window.__forgeBuild
  // at parse time — before serveGated's appended stamp existed — so the check
  // returned false without ever making the request, and this assertion was the
  // only thing that could tell the two apart.
  ok(buildCalls > asked, 'and it really asked the server');
  ok(await docId() === doc, 'and the page did not reload');

  console.log('\nA NEW BUILD, NOTHING HELD — IT HEALS');
  currentBuild = 'deadbeefcafe';
  ok(await check() === true, 'it takes the reload');
  const healed = await waitNewDoc(doc);
  ok(healed !== doc, 'the page really reloaded');
  doc = healed;
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);

  console.log('\nBUT NEVER WHILE SHE IS HOLDING SOMETHING');
  // Each of these is unsaved on purpose (see the page's comment), so a silent
  // reload would throw her work away. Each is set, asked, and put back.
  const held = async (name, set, clear) => {
    await page.evaluate(set);
    const took = await check();
    ok(took === false && await docId() === doc, name);
    await page.evaluate(clear);
  };
  await held('a typed prompt',
    () => { document.getElementById('prompt').value = 'meat raining from the ceiling'; },
    () => { document.getElementById('prompt').value = ''; });
  await held('an attached photo reference',
    () => { window.photoRef = { data: 'x', name: 'p.png' }; },
    () => { window.photoRef = null; });
  await held('a picked character',
    () => { window.pickedChars.push('c1'); },
    () => { window.pickedChars.length = 0; });
  await held('a quality moved off default',
    () => { window.quality = 'high'; },
    () => { window.quality = window.plQ0; });
  await held('a size tier moved off default',
    () => { window.resTier = '4k'; },
    () => { window.resTier = window.plR0; });
  await held('a search in progress',
    () => { document.getElementById('q').value = 'fox'; },
    () => { document.getElementById('q').value = ''; });
  await held('the cancel dialog open',
    () => { document.getElementById('ask').classList.add('on'); },
    () => { document.getElementById('ask').classList.remove('on'); });
  await held('the prompt panel open',
    () => { document.getElementById('promptpanel').classList.add('on'); },
    () => { document.getElementById('promptpanel').classList.remove('on'); });
  await held('the character picker open',
    () => { window.charsOpen = true; },
    () => { window.charsOpen = false; });

  console.log('\nAND IT PUTS ITSELF BACK WHEN SHE LETS GO');
  {
    ok(await check() === true, 'with everything released it heals');
    const after = await waitNewDoc(doc);
    ok(after !== doc, 'the reload landed');
    doc = after;
    await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);
  }

  console.log('\nCOMING BACK TO THE TOOL IS WHAT ASKS');
  // The moment a stale page is about to be USED. The 5-minute timer is only
  // the fallback for a page left open.
  {
    currentBuild = SERVED;                       // not stale — so it cannot reload here
    await page.evaluate(() => { plTouchedAt = 0; });
    const n = buildCalls;
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);
    ok(buildCalls > n, 'becoming visible asks the server');
  }

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();

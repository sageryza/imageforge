#!/usr/bin/env node
// RETURN SENDS THE SEARCH — ON EVERY SEARCH BOX, NOT JUST THE CHATS APP
// (Aug 2026, Sophie, reporting it a second time: "I asked a chat to make
// `return` catalyze a search, in addition to the checkmark — what happened").
//
// What had happened: it shipped, and it shipped ONLY in public/chats.html.
// Three more live boxes were left on `liveInput` alone, so Return did nothing
// in any of them — a lone <input type=search> outside a <form> has nothing to
// submit to. /search was the worst of the three: its box asks iOS for a SEARCH
// key with `enterkeyhint="search"`, so the keyboard offered her a key that was
// wired to nothing.
//
// Drives the REAL pages headless against a stub API and asserts, for each:
//   1. Return RUNS the search — the results on screen are the filtered ones,
//   2. Return DROPS THE KEYBOARD — the box is no longer the focused element,
//      because what she wants to be looking at afterwards is the answer,
//   3. it works on DICTATED text — the value is set with no event fired at
//      all, which is how iOS dictation actually arrives, and Return still
//      has to pick it up (this is the case a plain `input` listener misses).
//
//   npm install playwright-core --no-save && node scripts/test-search-return-everywhere.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
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
const iso = (ms) => new Date(ms).toISOString();
const T0 = Date.parse('2026-08-19T17:00:00Z');

// One clip that matches "raincoat" and one that cannot, on every shelf, so
// "the search ran" and "the search did nothing" can never look the same.
const CLIPS = [
  { id: 'c1', kind: 'chunk', title: 'Yellow raincoat on the bench', url: 'https://x/1.mp4',
    poster: '', start: 0, end: 4, dur: 4, from: 'evan', createdAt: iso(T0) },
  { id: 'c2', kind: 'chunk', title: 'Crows at dusk', url: 'https://x/2.mp4',
    poster: '', start: 0, end: 4, dur: 4, from: 'evan', createdAt: iso(T0 - 1000) },
];
// The urls are served by the stub below and must really LOAD: assets.html
// marks an image `_broken` on an `error` event and hides its cell for good, so
// a fake url would leave the grid empty and the filter assertion would pass
// for the wrong reason.
const ASSETS = [
  { chat: 'ret', url: '/img/a1.png', description: 'Yellow raincoat study', createdAt: iso(T0) },
  { chat: 'ret', url: '/img/a2.png', description: 'Crows at dusk', createdAt: iso(T0 - 1000) },
];
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const searched = [];   // every query /api/search actually received

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(o));
  };
  const page = (f) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(PUB, f), 'utf8'));
  };
  if (url.pathname === '/chunking' || url.pathname === '/clips') return page('clips.html');
  if (url.pathname === '/assets') return page('assets.html');
  if (url.pathname === '/search') return page('search.html');

  // assets.html loads every tile through the server-side thumbnailer, so the
  // stub has to answer THAT rather than the asset url itself — an image that
  // 404s is marked `_broken` and its cell is hidden for good.
  if (url.pathname.startsWith('/img/') || url.pathname === '/api/story/thumb') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PNG);
  }
  if (url.pathname === '/api/clips') return json({ clips: CLIPS });
  if (url.pathname === '/api/clips/harvest') return json({ job: null });
  if (url.pathname === '/api/gallery/assets/all') return json({ assets: ASSETS, total: ASSETS.length });
  if (url.pathname === '/api/search' || url.pathname === '/api/search/') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    searched.push(q);
    // The server is the filter here — /search is a network search, unlike the
    // other two, so "did Return run it" is a question about what was sent.
    const hits = CLIPS.filter((c) => c.title.toLowerCase().includes(q)).map((c, i) => ({
      id: 'h' + i, kind: 'memo', title: c.title, text: c.title, snippet: c.title,
      url: c.url, start: 0, end: 4, date: iso(T0), score: 1,
    }));
    return json({ hits, results: hits });
  }
  json({ ok: true, clips: [], assets: [], hits: [], results: [], total: 0 });
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };

// Dictation, as faithfully as a browser can be made to do it: the text lands
// in the field and NO event is dispatched. This is the case that separates the
// house pair from a plain `input` listener.
const dictate = (page, sel, text) => page.evaluate(([s, t]) => {
  const el = document.querySelector(s);
  el.focus();
  el.value = t;
}, [sel, text]);

const focusedIs = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return !!el && document.activeElement === el;
}, sel);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});

  const open = async (route) => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', (e) => fail(route + ' threw: ' + e.message));
    await p.goto(base + route);
    return p;
  };

  // ── /chunking — the clip library ─────────────────────────────────────
  {
    const p = await open('/chunking');
    await p.waitForSelector('#shelf .clip, #shelf .card, #shelf a, #shelf button', { timeout: 5000 })
      .catch(() => {});
    const before = await p.$$eval('#shelf *', (ns) =>
      ns.filter((n) => /Yellow raincoat|Crows at dusk/.test(n.textContent || '')).length);
    if (!before) fail('/chunking never rendered the shelf, so the search proves nothing');
    await dictate(p, '#q', 'raincoat');
    await p.press('#q', 'Enter');
    await p.waitForTimeout(300);
    const txt = await p.$eval('#shelf', (n) => n.textContent || '');
    if (!/raincoat/i.test(txt)) fail('/chunking: Return lost the matching clip');
    if (/Crows at dusk/i.test(txt)) fail('/chunking: Return did not run the search — the non-match is still on the shelf');
    if (await focusedIs(p, '#q')) fail('/chunking: Return left the box focused — the keyboard stays over the shelf');
    await p.close();
  }

  // ── /assets — every chat's images on one page ────────────────────────
  {
    const p = await open('/assets');
    await p.waitForSelector('.asearch input', { timeout: 5000 })
      .catch(() => fail('/assets never drew its search box'));
    const sel = '.asearch input';
    await p.waitForTimeout(400);
    const lit = await p.evaluate(() => [].filter.call(document.querySelectorAll('.acell'),
      (n) => getComputedStyle(n).display !== 'none').length);
    if (lit !== 2) fail('/assets never drew both tiles, so the filter proves nothing (' + lit + ')');
    await dictate(p, sel, 'raincoat');
    await p.press(sel, 'Enter');
    await p.waitForTimeout(300);
    const shown = await p.evaluate(() => [].filter.call(
      document.querySelectorAll('.acell'),
      (n) => getComputedStyle(n).display !== 'none').length);
    if (shown !== 1) fail('/assets: Return did not filter to the one match (showing ' + shown + ')');
    if (await focusedIs(p, sel)) fail('/assets: Return left the box focused');
    await p.close();
  }

  // ── /search — the one that ASKS iOS for a Search key ─────────────────
  {
    const p = await open('/search');
    searched.length = 0;
    await dictate(p, '#q', 'raincoat');
    await p.press('#q', 'Enter');
    await p.waitForTimeout(400);
    if (!searched.includes('raincoat')) {
      fail('/search: Return never sent the query — the box wears enterkeyhint="search" '
        + 'and the key was wired to nothing (sent: ' + JSON.stringify(searched) + ')');
    }
    const res = await p.$eval('#results', (n) => n.textContent || '');
    if (!/raincoat/i.test(res)) fail('/search: the results never came up');
    if (await focusedIs(p, '#q')) fail('/search: Return left the box focused');
    await p.close();
  }

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: Return runs the search and drops the keyboard on /chunking, /assets and /search');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });

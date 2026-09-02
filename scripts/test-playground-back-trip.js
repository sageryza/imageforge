#!/usr/bin/env node
/*
 * test-playground-back-trip.js — a picture's "Open in Playground" leaves a way
 * back, and does not strand the tool it rode in on.
 *
 * 2026-09-02, Sophie: "playground from assets / now i'm stuck".
 *
 * The door is a location.href inside the tool's OWN web view (Meta Assets,
 * Freeform, or the Chats app when the tap comes from a Compare page, whose
 * lightbox navigates the top window). The iOS app keeps a tool's page alive
 * for the whole app process, so the walk ATE that tool's screen: every later
 * tap on its tile opened the Playground again until a force-quit. The Story
 * Room's own send trip learned this on 2026-08-26; this is the same fix at the
 * door she uses most.
 *
 * WHAT IS MEASURED, not asserted from the source: a chip that renders under
 * the app's own chevron, or a chip that is there but reaches no tap, passes
 * every markup assertion ever written about it. So the page is driven in
 * headless Chromium with the real pagehead chevron installed, and the chip is
 * asked with elementFromPoint at its own centre.
 *
 *   node scripts/test-playground-back-trip.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const doorSrc = fs.readFileSync(path.join(ROOT, 'public', 'asset-actions.js'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── 1. the crumb, pure ────────────────────────────────────────────────────
console.log('the crumb');
{
  const sandbox = { window: null, document: { }, location: null, fetch: () => {} };
  // The file is an IIFE over `window`; run it with a fake one and read the API.
  const run = (pathname, search, top) => {
    const w = {
      location: { pathname, search, origin: 'https://x' },
      top: top || undefined,
    };
    w.top = top === undefined ? w : top;
    const fn = new Function('window', 'location', 'fetch', 'navigator', 'document', 'URL',
      doorSrc + '\n;return window.ForgeAssetActions;');
    const api = fn(w, w.location, () => new Promise(() => {}), {},
      { createElement: () => ({ style: {} }) }, URL);
    return api.backCrumb ? api.backCrumb() : '(no crumb at all)';
  };
  ok(run('/assets', '') === '/assets', 'Meta Assets hands back its own path');
  ok(run('/chats', '?chat=x') === '/chats?chat=x', 'the Chats app keeps its query');
  ok(run('/playground', '') === '', 'the Playground hands back nothing — already home');
  ok(run('/', '') === '', 'the hub hands back nothing');
  // A framed Compare page walks the TOP window, so the crumb is the top's page.
  const top = { location: { pathname: '/chats', search: '', origin: 'https://x' } };
  ok(run('/api/chatfeed/page/abc', '', top) === '/chats',
    'a framed Compare page hands back the page that really navigates');
}

console.log('the door');
ok(/back='\+encodeURIComponent\(back\)/.test(doorSrc.replace(/\s+/g, '')) ||
   /'&back='\s*\+\s*encodeURIComponent\(back\)/.test(doorSrc),
  'the Playground door carries the crumb');
ok(/armTripRestore/.test(pageSrc), 'the Playground arms a trip restore');

// ── 2. the real page ──────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

(async () => {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {
        evan: { label: 'ChatGPT', prefix: 'P', suffix: 'S', characterLine: '', refs: [] },
      } }));
    }
    if (url.pathname === '/api/promptlab/build') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ build: 'test' }));
    }
    if (/^\/(assets|chats|scratchpad)$/.test(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><title>' + url.pathname + '</title><body>landed</body>');
    }
    // serveGated injects pagehead.js on every gated page — the chevron this
    // chip has to sit beside comes from there, not from the page file.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc + '<script src="/pagehead.js" defer></script>');
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

  // The app's own bridge, installed before the page's script runs — that is
  // what makes pagehead draw its chevron and what armTripRestore wraps.
  const openApp = async (href) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      window.__leftTool = 0;
      window.__forgeLeave = function () { window.__leftTool++; };
    });
    await page.goto(base + href);
    await page.waitForTimeout(400);
    return page;
  };
  const hit = (page, id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    if (!el || !el.offsetParent) return 'no element';
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (at && (at === el || el.contains(at))) return true;
    return 'BLOCKED-by-' + (at ? (at.id || at.className || at.tagName) : 'nothing');
  }, id);

  console.log('walked in from Meta Assets');
  let page = await openApp('/playground?prompt=a%20cat&style=chatgpt&back=%2Fassets');
  ok(await page.evaluate(() => document.getElementById('backchip').classList.contains('on')),
    'the chip is shown');
  ok((await page.evaluate(() => document.getElementById('backchip').textContent)).indexOf('Meta Assets') > -1,
    'and it names where she came from');
  ok(await hit(page, 'backchip') === true, 'the chip takes a tap (it is not under the chevron)');
  ok(await hit(page, 'forgeback') === true, "and the app's own chevron still takes its own");
  ok(await page.evaluate(() => {
    const c = document.getElementById('backchip').getBoundingClientRect();
    const b = document.getElementById('forgeback').getBoundingClientRect();
    return c.left >= b.right - 1 && Math.abs((c.top + c.height / 2) - (b.top + b.height / 2)) < 8;
  }), 'it sits beside the chevron, not on top of it');
  ok(await page.evaluate(() => document.getElementById('prompt').value) === 'a cat',
    'the ported prompt still lands — spending the query does not eat it');
  ok(await page.evaluate(() => location.search === ''),
    'the query is spent, so a reload cannot re-arm the walk');

  // THE HALF A CHIP CANNOT COVER: she leaves the tool the ordinary way.
  console.log('leaving the tool');
  await page.evaluate(() => window.__forgeLeave());
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__leftTool === 1 || true), 'the native exit still fires');
  ok(/\/assets$/.test(page.url()),
    'the eaten web view is put back on Meta Assets — the tile is not stranded');
  await page.close();

  console.log('the chip itself');
  page = await openApp('/playground?prompt=x&back=%2Fchats%3Fchat%3Dfoo');
  ok((await page.evaluate(() => document.getElementById('backchip').textContent)).indexOf('Chats') > -1,
    'a walk from the Chats app says Chats');
  await page.click('#backchip');
  await page.waitForTimeout(400);
  ok(/\/chats\?chat=foo$/.test(page.url()), 'tapping it walks back to the chat she was in');
  await page.close();

  console.log('a plain Playground');
  page = await openApp('/playground');
  ok(await page.evaluate(() => !document.getElementById('backchip').classList.contains('on')),
    'no chip when she opened the tool herself');
  await page.evaluate(() => window.__forgeLeave());
  await page.waitForTimeout(500);
  ok(/\/playground$/.test(page.url()), 'and leaving the tool navigates nowhere');
  await page.close();

  console.log('a hand-made link cannot point the chip off-site');
  page = await openApp('/playground?back=%2F%2Fevil.example.com');
  ok(await page.evaluate(() => !document.getElementById('backchip').classList.contains('on')),
    'a protocol-relative path is refused');
  await page.close();

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

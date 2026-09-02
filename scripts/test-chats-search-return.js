#!/usr/bin/env node
// Two more behaviours on the /chats home search bar (Aug 2026, Sophie):
//
//   A. "Right now, only the check mark sends the search on its way. I'd like
//      the return button to do the same. Also send it on its way. period."
//      — the ✓ that ends dictation was the only key that finished a query;
//      Return did nothing, because a lone <input type=search> outside a
//      <form> has nothing to submit to. Now Return runs it and drops the
//      keyboard, so she is left looking at the answer.
//
//   B. "I'd also like it to show the last search that was made if it was made
//      in the last, say, one minute." — opening the bar seconds after closing
//      it is the same hunt continuing, so the words (and the results) come
//      back. Past the minute the box opens empty, which is the old rule.
//      Tapping the glass to start a NEW search forgets them outright.
//
//   npm install playwright-core --no-save && node scripts/test-chats-search-return.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const MSGS = [
  { id: 'm1', chat: 'ret-one', from: 'claude', created: iso(T0 - 1000), postedAt: iso(T0 - 1000),
    tldr: 'the one', text: 'A woman in a yellow raincoat feeding crows on a bench.' },
];
const CHATS = { 'ret-one': { account: '1', lastSeen: MSGS[0].created } };
const searched = [];

const server = http.createServer((req, res) => {
  // THE SHARED FILES chats.html LINKS, served the way express.static serves
  // them (scripts/lib/public-asset.js). This harness used to fall through to
  // its catch-all for every one of them, which is the quiet failure that file
  // exists to end: the page guards the global it could not load, so the harness
  // renders a page missing that behaviour and passes — or, when the catch-all's
  // body is not valid JS, throws a page error nobody asked about.
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: CHATS, settings: { appAccount: '1', categories: [] },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/search') {
    searched.push(url.searchParams.get('q') || '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: [{ id: 'm1', chat: 'ret-one', snippet: 'a yellow raincoat', created: MSGS[0].created }],
      chatMatches: [],
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  // The page loads real assets from public/ (`/asset-lightbox.js` since Aug
  // 2026), and express.static serves them live. Answering those with the JSON
  // fallthrough below hands the browser `{"ok":true,…}` as a SCRIPT, which
  // throws "Unexpected token ':'" and kills the page before any of this file's
  // assertions can run — so serve the real file whenever one exists.
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
    const type = url.pathname.endsWith('.js') ? 'text/javascript'
      : url.pathname.endsWith('.css') ? 'text/css'
      : url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    return res.end(fs.readFileSync(asset));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

// Dictation, as faithfully as a browser can be made to do it: the text appears
// in the field and NO event is dispatched.
const dictate = (page, sel, text) => page.evaluate(([s, t]) => {
  const el = document.querySelector(s);
  el.focus();
  el.value = t;
}, [sel, text]);

const boxValue = (page) => page.$eval('#qsearch', (n) => n.value);
const resultsUp = (page) => page.evaluate(() => {
  const sr = document.getElementById('searchresults');
  return !!(sr && getComputedStyle(sr).display !== 'none' && sr.querySelector('.sres'));
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="ret-one"]');

  // ---- A. Return sends it, and the keyboard goes -------------------------
  await page.click('#searchbtn');
  await dictate(page, '#qsearch', 'raincoat');
  await page.press('#qsearch', 'Enter');
  await page.waitForSelector('#searchresults .sres', { timeout: 4000 })
    .catch(() => fail('Return did not send the search'));
  if (!searched.includes('raincoat')) fail('the query never reached the server: ' + JSON.stringify(searched));
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  if (focused === 'qsearch') fail('Return left the field focused — the keyboard stays over the results');

  // ---- B. closing and coming back inside the minute ----------------------
  await page.click('#qclear');                       // ✕ leaves the search
  if (await boxValue(page) !== '') fail('the ✕ left words in the box');
  await page.click('#searchbtn');                    // straight back in
  await page.waitForFunction(() => {
    const q = document.getElementById('qsearch');
    return q && q.value === 'raincoat';
  }, null, { timeout: 4000 }).catch(() => fail('the last search was not put back inside the minute'));
  await page.waitForFunction(() => {
    const sr = document.getElementById('searchresults');
    return !!(sr && getComputedStyle(sr).display !== 'none' && sr.querySelector('.sres'));
  }, null, { timeout: 4000 }).catch(() => fail('the restored search showed its words but not its results'));

  // ---- the glass, while open, means a NEW search: the old one is gone -----
  await page.click('#searchbtn');                    // glass while open = clear
  if (await boxValue(page) !== '') fail('the glass did not clear the box');
  await page.click('#qclear');
  await page.click('#searchbtn');
  await page.waitForTimeout(300);
  if (await boxValue(page) !== '') fail('a search cleared with the glass came back anyway: '
    + JSON.stringify(await page.evaluate(() => ({ v: document.getElementById('qsearch').value,
      ss: sessionStorage.getItem('forgeLastSearch') }))));
  if (await resultsUp(page)) fail('the grid should be standing after a cleared search');

  // ---- past the minute it opens empty ------------------------------------
  await dictate(page, '#qsearch', 'crows');
  await page.waitForFunction(() => {
    const sr = document.getElementById('searchresults');
    return !!(sr && sr.querySelector('.sres'));
  }, null, { timeout: 4000 }).catch(() => fail('the second search never ran'));
  await page.evaluate(() => {                        // age it by 90 seconds
    const r = JSON.parse(sessionStorage.getItem('forgeLastSearch') || 'null');
    r.at = Date.now() - 90000;
    sessionStorage.setItem('forgeLastSearch', JSON.stringify(r));
  });
  await page.click('#qclear');
  await page.click('#searchbtn');
  await page.waitForTimeout(300);
  if (await boxValue(page) !== '') fail('a search older than a minute was put back: ' + await boxValue(page));
  if (await resultsUp(page)) fail('a stale search left its results on screen');

  if (errors.length) fail('page errors: ' + errors.join(' | '));

  await browser.close();
  server.close();
  if (!process.exitCode) {
    console.log('PASS: Return sends the search and drops the keyboard; the last one comes back for a minute');
  }
})();

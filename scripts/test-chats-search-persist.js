#!/usr/bin/env node
// THE SEARCH SURVIVES A BACK-OUT (Aug 2026, Sophie: "when I search something
// and then I click on one of the options if it's not the one I want when I go
// back I want that to still be active so that search is still on the search bar
// rather than clearing automatically").
//
// A search is a list she is working through — opening a hit is TRYING one of
// them, not finishing — so the back chevron has to land her on the same results
// with the same words in the bar, ready for the next one. She dictates her
// queries, so retyping one to get back to result #3 is the expensive part.
//
// The exception this also pins: the ways out that END with that chat (archive,
// hide, delete) still clear the box, because they change the list underneath
// the results and a row pointing at a chat she just put away is worse than an
// empty bar.
//
//   npm install playwright-core --no-save && node scripts/test-chats-search-persist.js
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
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Two chats, so the results list is a list she can work through: the first hit
// is the wrong one and the second is the one she wanted.
const MSGS = [
  { id: 'm1', chat: 'raincoat-one', from: 'claude', created: iso(T0 - 1000), postedAt: iso(T0 - 1000),
    tldr: 'first hit', text: 'A woman in a yellow raincoat feeding crows.' },
  { id: 'm2', chat: 'raincoat-two', from: 'claude', created: iso(T0 - 2000), postedAt: iso(T0 - 2000),
    tldr: 'second hit', text: 'The raincoat sketch she actually meant.' },
];
const CHATS = {
  'raincoat-one': { account: '1', lastSeen: MSGS[0].created },
  'raincoat-two': { account: '1', lastSeen: MSGS[1].created },
};

const server = http.createServer((req, res) => {
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: MSGS.map(m => ({ id: m.id, chat: m.chat, snippet: m.text, created: m.created })),
      chatMatches: [],
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  // The page loads real assets from public/ (`/asset-lightbox.js` since Aug
  // 2026) and express.static serves them live. Answering those with the JSON
  // fallthrough below hands the browser `{"ok":true,…}` as a SCRIPT, which
  // throws "Unexpected token ':'" and kills the page before the assertions run.
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

// What the home screen is showing right now, in one read.
const state = (page) => page.evaluate(() => ({
  q: (document.getElementById('qsearch') || {}).value || '',
  results: getComputedStyle(document.getElementById('searchresults')).display,
  hits: document.querySelectorAll('#searchresults .sres').length,
  grid: getComputedStyle(document.getElementById('grid')).display,
  barOpen: document.getElementById('searchrow').classList.contains('on'),
  reading: document.body.classList.contains('reading'),
}));

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
  await page.waitForSelector('#grid [data-chat="raincoat-one"]');

  // ---- search, open the wrong one, come back ------------------------------
  await page.click('#searchbtn');
  await page.fill('#qsearch', 'raincoat');
  await page.waitForSelector('#searchresults .sres', { timeout: 4000 })
    .catch(() => fail('the search never produced any results to work through'));

  await page.click('#searchresults .sres');            // …not the one she wanted
  await page.waitForSelector('#thread header h1');
  await page.click('#back');
  await page.waitForFunction(() => !document.body.classList.contains('reading'));

  let s = await state(page);
  if (s.q !== 'raincoat') fail('the words were cleared out of the bar on the way back: ' + JSON.stringify(s.q));
  if (!s.barOpen) fail('the search bar folded itself back to the glass on the way back');
  if (s.results === 'none') fail('the results list was thrown away on the way back');
  if (s.hits !== 2) fail('the results came back short: ' + s.hits + ' rows');
  if (s.grid !== 'none') fail('the chat list came back over the results');

  // With the results gone there is nothing left to try, so say what broke and
  // stop rather than timing out on a row that cannot exist.
  if (process.exitCode) { await browser.close(); server.close(); return; }

  // …and the next one along is still one tap away.
  await page.click('#searchresults .sres:nth-of-type(2)');
  await page.waitForSelector('#thread header h1');
  const name = await page.$eval('#thread header h1', (n) => n.textContent.trim());
  if (name !== 'raincoat-two') fail('the second result opened the wrong chat: ' + name);
  await page.click('#back');
  await page.waitForFunction(() => !document.body.classList.contains('reading'));
  s = await state(page);
  if (s.q !== 'raincoat' || s.results === 'none') fail('the search did not survive the second try');

  // ---- hiding ENDS with that chat, so it clears the box --------------------
  // (Hide is the one-tap member of the family — archive asks which pile first
  // and delete asks to confirm, but all three leave through goHome(true).)
  await page.click('#searchresults .sres');
  await page.waitForSelector('#thread .archlink.hide-r');
  await page.click('#thread .archlink.hide-r');
  await page.waitForFunction(() => !document.body.classList.contains('reading'), null, { timeout: 4000 })
    .catch(() => fail('hiding never returned to the list'));
  s = await state(page);
  if (s.q !== '') fail('hiding left a stale query in the bar: ' + JSON.stringify(s.q));
  if (s.results !== 'none') fail('hiding left the stale results on screen');
  if (s.grid === 'none') fail('hiding left the chat list hidden behind nothing');

  if (errors.length) fail('page errors: ' + errors.join(' | '));

  await browser.close();
  server.close();
  if (!process.exitCode) {
    console.log('PASS: the search is still there on the way back, and hiding still clears it');
  }
})();

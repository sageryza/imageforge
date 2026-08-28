#!/usr/bin/env node
// Two behaviours on the /chats search boxes (Aug 2026, Sophie):
//
//   A. "Can you change it so that it starts searching as soon as I type it in
//      without having to press the checkmark."  — she DICTATES; iOS can hold
//      the words in the field without ever firing an `input` event until she
//      taps the ✓ that ends dictation, so an oninput-only box sat there doing
//      nothing through a whole sentence. `liveInput` polls the value while the
//      field has focus, so the search runs however the text arrived. The test
//      simulates dictation exactly: set `.value` and dispatch NOTHING.
//
//   B. "Sometimes I want to narrow it down by finding two words I know were in
//      the same message but one of the words might appear tons of times."  —
//      bare words are AND'd across the one message, so "prompt raincoat" finds
//      the message holding both and not the two holding one each.
//
//   npm install playwright-core --no-save && node scripts/test-chats-live-search.js
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

// One chat, three messages: the rare word and the common word share exactly
// one of them.
const MSGS = [
  { id: 'm1', chat: 'live-one', from: 'claude', created: iso(T0 - 1000), postedAt: iso(T0 - 1000),
    tldr: 'both', text: 'The prompt overlay opens on content — a woman in a yellow raincoat.' },
  { id: 'm2', chat: 'live-one', from: 'claude', created: iso(T0 - 2000), postedAt: iso(T0 - 2000),
    tldr: 'common only', text: 'Filed the prompt for every image in the batch.' },
  { id: 'm3', chat: 'live-one', from: 'claude', created: iso(T0 - 3000), postedAt: iso(T0 - 3000),
    tldr: 'rare only', text: 'A yellow raincoat, feeding crows on a bench.' },
];
// The snippet the bold rule is measured on: `red` as a real word-START hit
// (inside "redraw", which the matcher DOES match), `red` buried mid-word in
// "tired", which it does not, and the whole word she typed.
const BOLD_SNIP = "say so and I'll redraw. Older, thinner, tired, plain — the red dress.";
const CHATS = { 'live-one': { account: '1', lastSeen: MSGS[0].created } };
const searched = [];

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
    // Record what the box actually asked for — the server's own grammar has
    // its own test (scripts/test-search-grammar.js); this one only proves the
    // query left the page without a checkmark.
    const q = url.searchParams.get('q') || '';
    searched.push(q);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: [{ id: 'm1', chat: 'live-one', created: MSGS[0].created,
        snippet: /dress/.test(q) ? BOLD_SNIP : 'a yellow raincoat' }],
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
  await page.waitForSelector('#grid [data-chat="live-one"]');

  // ---- A. the home search runs on dictated text, with no event ------------
  await page.click('#searchbtn');
  await dictate(page, '#qsearch', 'raincoat');
  await page.waitForSelector('#searchresults .sres', { timeout: 4000 })
    .catch(() => fail('dictated text never searched — the box still waits for the checkmark'));
  if (!searched.includes('raincoat')) fail('the dictated query never reached the server: ' + JSON.stringify(searched));

  // …and it stops again when the words go away, without her tapping anything.
  await dictate(page, '#qsearch', '');
  await page.waitForFunction(() => {
    const sr = document.getElementById('searchresults');
    return sr && getComputedStyle(sr).display === 'none';
  }, null, { timeout: 4000 }).catch(() => fail('clearing the dictated text left the results on screen'));

  // ---- A2. the BOLD says the same thing the MATCH says --------------------
  // 2026-08-28, from her `red dress` screenshot: the highlight had no word
  // anchor, so `red` lit up inside "tired" — a word the search itself would
  // never match — and the mark was claiming a row was found for a reason it
  // was not.
  await dictate(page, '#qsearch', 'red dress');
  await page.waitForSelector('#searchresults .sres b', { timeout: 4000 })
    .catch(() => fail('nothing bolded in the snippet at all'));
  const bolds = await page.$$eval('#searchresults .sres b', (ns) => ns.map((n) => n.textContent));
  if (!bolds.some((b) => /^dress$/i.test(b))) fail('the whole word she typed was not bolded: ' + JSON.stringify(bolds));
  const tired = await page.$eval('#searchresults .sres', (n) => {
    const b = Array.from(n.querySelectorAll('b'));
    return b.some((x) => /tired/i.test((x.parentNode.textContent || '')) && /^red$/i.test(x.textContent)
      && /ti$/i.test(((x.previousSibling && x.previousSibling.textContent) || '').slice(-2)));
  });
  if (tired) fail('`red` was bolded inside "tired" — the bold and the match disagree');
  await dictate(page, '#qsearch', '');
  await page.waitForFunction(() => {
    const sr = document.getElementById('searchresults');
    return sr && getComputedStyle(sr).display === 'none';
  }, null, { timeout: 4000 }).catch(() => fail('clearing the dictated text left the results on screen'));
  await page.click('#qclear');   // fold the bar away again

  // ---- B. two words, one message ------------------------------------------
  await page.click('#grid [data-chat="live-one"]');
  await page.waitForSelector('.threadsearch');
  await page.click('.threadsearch');
  await page.waitForSelector('.msgsearch.open input');

  const count = async () => page.$eval('.msgcount', (n) => n.textContent.trim());
  const type = async (t) => {
    await page.fill('.msgsearch input', t);
    await page.waitForTimeout(250);
  };

  await type('prompt raincoat');
  if (await count() !== '1 message') fail('two words did not narrow to the one message holding both: ' + await count());

  await type('prompt');
  if (await count() !== '2 messages') fail('the common word alone should still find both: ' + await count());

  await type('"prompt raincoat"');
  if (await count() !== 'No messages match that') fail('a quoted phrase must stay adjacent: ' + await count());

  await type('prompt -raincoat');
  if (await count() !== '1 message') fail('-word did not exclude: ' + await count());

  await type('batch OR crows');
  if (await count() !== '2 messages') fail('OR did not take either: ' + await count());

  // OR binds tighter than the implicit AND: prompt AND (batch OR crows), so
  // the message with crows but no prompt is out.
  await type('prompt batch OR crows');
  if (await count() !== '1 message') fail('OR bound looser than AND: ' + await count());

  // The in-thread box is dictated into as well.
  await page.fill('.msgsearch input', '');
  await dictate(page, '.msgsearch input', 'crows');
  await page.waitForFunction(() => {
    const n = document.querySelector('.msgcount');
    return n && n.textContent.trim() === '1 message';
  }, null, { timeout: 4000 }).catch(() => fail('the in-thread box ignored dictated text'));

  if (errors.length) fail('page errors: ' + errors.join(' | '));

  await browser.close();
  server.close();
  if (!process.exitCode) {
    console.log('PASS: dictated text searches with no checkmark, and two words mean the same message');
  }
})();

#!/usr/bin/env node
// A DEPLOY MUST NOT PULL HER OUT OF WHAT SHE IS READING (Aug 2026, Sophie:
// "if I'm on the update tab — I guess it's when a chat finishes, but I don't
// know — it brings me out automatically, and then I have to go back to the
// update tab and click into the artifact again").
//
// It was never a chat finishing. chats.html reloads itself when the server's
// build stamp changes, so a page change reaches her phone at all — and five
// deploys shipped the evening she hit this. The old guard only knew about an
// open THREAD and a focused text field, so a full-screen Compare page was
// reloaded away, and the reload then landed her on the chat list because
// `homeView` is a variable a reload resets.
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. with an artifact open full-screen, a changed build does NOT reload —
//      the viewer is still there after a poll,
//   2. once she closes it, the next poll DOES reload (a build has to be able
//      to reach her, or the whole mechanism is pointless),
//   3. …and she comes back on the VIEW SHE WAS IN, not the chat list,
//   4. a plain first load with no reload flag still opens on the chat list.
//
// HER VIEW HERE IS **STATUS**, NOT UPDATE. This was written on the Update tab
// — the screen she was actually on — and that tab came off on 2026-09-14
// ("get rid of the updates tab in chats"). Status is the same shape for this
// test's purpose: it is in `RELOAD_VIEW`'s restore list and it lists Compare
// pages as `.pagerow`s that open the full-screen viewer.
//
//   npm install playwright-core --no-save && node scripts/test-chats-build-reload.js
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
let BUILD = 'build-1';                      // flipped mid-test = a deploy landing

const MSGS = [
  { id: 'm1', chat: 'chat-oven', from: 'claude', text: 'v4 is up', tldr: 'artifact v4', created: iso(T0 - 2 * 3600000), postedAt: iso(T0 - 2 * 3600000) },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: BUILD, chats: { 'chat-oven': { account: '1' } }, settings: {},
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [
      { id: 'p1', title: 'Oven artifact v4', chat: 'chat-oven', created: iso(T0 - 90 * 60000) },
    ] }));
  }
  if (url.pathname.startsWith('/api/chatfeed/page/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>page</title><p>the artifact</p>');
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ assets: [], pages: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const titleOf = (page) => page.textContent('#htxt');

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid');

  // her position: the Status view, inside the artifact. (Status has no button
  // of its own — `__setHomeView` is the documented way in, kept for exactly
  // this.)
  await page.evaluate(() => window.__setHomeView('status'));
  await page.waitForSelector('#grid .pagerow', { timeout: 4000 })
    .catch(() => fail('the artifact row never rendered'));
  await page.click('#grid .pagerow');
  await page.waitForSelector('.pageview .pv-frame', { timeout: 4000 })
    .catch(() => fail('the Compare viewer never opened'));

  // 1. a deploy lands while she is reading it — the poll must NOT reload
  BUILD = 'build-2';
  await page.evaluate(() => window.__poll());
  await page.waitForTimeout(700);
  if (!(await page.$('.pageview .pv-frame'))) fail('a deploy reloaded the artifact out from under her');

  // 2/3. she closes it; now the reload may happen — and must put her back on
  //      the view she was in rather than the chat list
  await page.click('.pageview .pv-back');
  await page.waitForFunction(() => !document.querySelector('.pageview'), null, { timeout: 4000 });
  // Mark THIS document so the reload is PROVABLE rather than inferred — the
  // title would still read "Status" if nothing had reloaded at all — and so
  // the checks below can wait for the new document instead of racing it.
  await page.evaluate(() => { window.__beforeReload = 1; });
  // the reload lands mid-evaluate by design, tearing the context down: that IS
  // the pass condition here, so the throw is expected
  await page.evaluate(() => window.__poll()).catch(() => {});
  await page.waitForFunction(() => !window.__beforeReload && !!document.getElementById('htxt'),
    null, { timeout: 8000 })
    .catch(() => fail('the deferred reload never happened once she closed the artifact'));
  await page.waitForFunction(() => document.getElementById('htxt')
    && document.getElementById('htxt').textContent === 'Status', null, { timeout: 6000 })
    .catch(async () => fail('after the deferred reload she is not back on Status (title "'
      + await titleOf(page) + '")'));
  const reloaded = await page.evaluate(() => ({
    flag: sessionStorage.getItem('chats-reload-view'),
  }));
  if (reloaded.flag) fail('the restore flag was left behind in sessionStorage');

  // 4. a launch she started still opens on the chat list
  const fresh = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await fresh.goto(base + '/chats');
  await fresh.waitForSelector('#grid');
  if ((await fresh.textContent('#htxt')) !== 'Chats') {
    fail('a plain first load did not open on the chat list: ' + await fresh.textContent('#htxt'));
  }

  // 5. `?view=news` opened the Update tab until 2026-09-14. The tab is gone
  //    and the param is still SWALLOWED — an older push, an older iOS build
  //    and any saved link still carry it, and a leftover ?view would ride
  //    checkBuild's reload forever. It lands her on the chat list.
  const pushed = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await pushed.goto(base + '/chats?view=news');
  await pushed.waitForFunction(() => document.getElementById('htxt')
    && document.getElementById('htxt').textContent === 'Chats', null, { timeout: 5000 })
    .catch(() => fail('?view=news did not land on the chat list'));
  if ((await pushed.evaluate(() => location.search)) !== '') fail('?view=news not stripped after boot');
  await pushed.close();

  // 6. …and a push that names its chat opens THAT CHAT (Aug 2026, Sophie:
  //    tapping the banner consumes it, so a list left her with no way to tell
  //    which chat spoke). Same stripping rule: a leftover ?chat= would
  //    re-open the thread on every deploy reload, forever.
  const toChat = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await toChat.goto(base + '/chats?chat=chat-oven');
  await toChat.waitForFunction(() => document.getElementById('thread')
    && document.getElementById('thread').style.display !== 'none', null, { timeout: 5000 })
    .catch(() => fail('?chat= did not open that chat'));
  if ((await toChat.evaluate(() => location.search)) !== '') fail('?chat= not stripped after boot');
  await toChat.close();

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: a deploy waits for the artifact to close, then puts her back where she was');
})().catch((e) => { console.error(e); process.exit(1); });

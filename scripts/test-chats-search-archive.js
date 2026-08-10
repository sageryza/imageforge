#!/usr/bin/env node
// Two behaviours on the /chats home (Aug 2026, Sophie):
//
//   A. "Make the search bar collapse into just a magnifying glass button
//      unless I click it, and then it expands into the search bar as it is
//      right now."  — the row is a glass until tapped; tapping opens the real
//      bar, focused; the ✕ clears the words and, on an empty field, folds the
//      bar back (there is no second close button to find); leaving a chat
//      lands on a folded bar; and the glass must not push the category chips
//      onto a second line, which is what putting it in the tool row did.
//
//   B. "When I take something out of the archive it should go straight to
//      that chat, and when I get out of that chat I shouldn't be in the
//      archive."  — Unarchive keeps her in the chat (with the word flipped
//      back to Archive) instead of bouncing her home, and the back chevron
//      then lands on the LIVE list, not the archive she took it out of.
//      Archiving still leaves, because that gesture means "away for good".
//
//   npm install playwright-core --no-save && node scripts/test-chats-search-archive.js
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

const MSGS = [
  { id: 'm1', chat: 'live-one', from: 'claude', text: 'hello there', tldr: 'a', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'live-two', from: 'claude', text: 'second', tldr: 'b', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'in-archive', from: 'claude', text: 'archived one', tldr: 'c', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
];
const CHATS = {
  'live-one': { account: '1', lastSeen: MSGS[0].created },
  'live-two': { account: '1', lastSeen: MSGS[1].created },
  'in-archive': { account: '1', lastSeen: MSGS[2].created, archived: true },
};
const archivePosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: CHATS,
      settings: { appAccount: '1', categories: ['stories', 'tech'] },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/search') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: [{ id: 'm1', chat: 'live-one', snippet: 'hello there', created: MSGS[0].created }],
      chatMatches: [],
    }));
  }
  if (url.pathname === '/api/chatfeed/archive' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      archivePosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const vis = (page, sel) => page.evaluate((s) => {
  const n = document.querySelector(s);
  return !!(n && n.getBoundingClientRect().width > 0 && getComputedStyle(n).display !== 'none');
}, sel);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="live-one"]');

  // ---- A. the collapsing search bar ---------------------------------------
  // A1. shut on arrival: the glass, not the bar
  if (!(await vis(page, '#searchbtn'))) fail('the magnifying glass is missing');
  if (await vis(page, '#qsearch')) fail('the search bar is open before she tapped anything');

  // A2. the chips must still be on ONE line at every width — a third icon in
  //     the tool row is exactly what wrapped them, which is why the glass
  //     keeps the bar's own place
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    // group by top with slack — the ★ chip is a pixel shorter than a word
    // chip, so exact tops differ by 1 on a single line
    const lines = await page.$$eval('#catrow .catchip', (ns) => {
      const tops = [];
      ns.forEach((n) => {
        const t = n.getBoundingClientRect().top;
        if (!tops.some((v) => Math.abs(v - t) < 8)) tops.push(t);
      });
      return tops.length;
    });
    if (lines !== 1) fail('the category chips wrapped onto ' + lines + ' lines at ' + width + 'px');
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // A3. tapping the glass opens the real bar, focused, with the glass gone
  await page.click('#searchbtn');
  if (!(await vis(page, '#qsearch'))) fail('tapping the glass did not open the search bar');
  if (await vis(page, '#searchbtn')) fail('the glass is still there beside the open bar');
  if (!(await page.evaluate(() => document.activeElement && document.activeElement.id === 'qsearch'))) {
    fail('the search bar opened without the keyboard — it was not focused');
  }

  // A4. it searches exactly as before
  await page.fill('#qsearch', 'hello');
  await page.waitForSelector('#searchresults .sres', { timeout: 4000 })
    .catch(() => fail('the open bar did not search'));

  // A5. the ✕ clears the words but leaves the bar open…
  await page.click('#qclear');
  if (await page.$eval('#qsearch', (n) => n.value !== '')) fail('the ✕ did not clear the words');
  if (!(await vis(page, '#qsearch'))) fail('clearing the words folded the bar away too');
  await page.waitForFunction(() => !document.querySelector('#searchresults .sres'), null, { timeout: 4000 })
    .catch(() => fail('the results stayed up after the clear'));

  // A6. …and on an EMPTY field the same ✕ folds it back to the glass, which
  //     is the only way out — there is no second close button
  await page.click('#qclear');
  if (await vis(page, '#qsearch')) fail('the ✕ on an empty field did not fold the bar away');
  if (!(await vis(page, '#searchbtn'))) fail('the glass did not come back');

  // A6b. the glass AND the ✕ must really be tappable at every width. The ✕
  //      sits at the right end of the bar, inside the autoscroll pill's band,
  //      and it really was buried under the pill's own down-arrow before the
  //      row reserved that corner — which mattered the moment the ✕ became
  //      the way to fold the bar away. Hit-test rather than trust the numbers.
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => { window.scrollTo(0, 0); window.__setSearchOpen(false); });
    let buried = await page.evaluate(() => {
      const r = document.getElementById('searchbtn').getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(hit && hit.closest('#searchbtn'));
    });
    if (buried) fail('the magnifying glass is untappable at ' + width + 'px');
    await page.evaluate(() => window.__setSearchOpen(true));
    buried = await page.evaluate(() => {
      const r = document.getElementById('qclear').getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(hit && hit.closest('#qclear'));
    });
    if (buried) fail('the search ✕ is under the pill at ' + width + 'px');
    await page.evaluate(() => window.__setSearchOpen(false));
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // A7. leaving a chat lands on a folded bar
  await page.evaluate(() => window.__setSearchOpen(true));
  await page.click('#grid .crow[data-chat="live-one"]');
  await page.waitForFunction(() => document.getElementById('thread').style.display !== 'none');
  await page.click('#back');
  if (await vis(page, '#qsearch')) fail('coming back from a chat left the search bar open');

  // ---- B. taking a chat out of the archive --------------------------------
  await page.click('#archlink');
  await page.waitForSelector('#grid .crow[data-chat="in-archive"]', { timeout: 4000 })
    .catch(() => fail('the archived chat is not in the archive view'));
  await page.click('#grid .crow[data-chat="in-archive"]');
  await page.waitForFunction(() => document.getElementById('thread').style.display !== 'none');

  const unarch = await page.$$eval('#thread .archlink', (ns) => ns.map((n) => n.textContent.trim()));
  if (unarch.indexOf('Unarchive') < 0) fail('no Unarchive button in the thread: ' + unarch.join(','));
  await page.$$eval('#thread .archlink', (ns) => ns.find((n) => n.textContent.trim() === 'Unarchive').click());

  // B1. it goes STRAIGHT to that chat — she stays in it, not bounced home
  await page.waitForFunction(
    () => [...document.querySelectorAll('#thread .archlink')].some((n) => n.textContent.trim() === 'Archive'),
    null, { timeout: 4000 }).catch(() => fail('Unarchive did not keep her in the chat with the word flipped back'));
  if (await page.$eval('#thread', (n) => n.style.display === 'none')) {
    fail('Unarchive bounced her out of the chat');
  }
  const post = archivePosts.find((p) => p.chat === 'in-archive');
  if (!post || post.archived !== false) fail('POST /archive wrong: ' + JSON.stringify(archivePosts));

  // B2. …and getting out of that chat lands on the LIVE list, not the archive
  await page.click('#back');
  await page.waitForFunction(() => document.getElementById('home').style.display !== 'none');
  const title = await page.$eval('#htxt', (n) => n.textContent.trim());
  if (title !== 'Chats') fail('leaving the chat landed back in ' + title + ', not the live list');
  const rows = await page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
  if (rows.indexOf('in-archive') < 0) fail('the restored chat is not on the live list: ' + rows.join(','));

  // B3. ARCHIVING still leaves — that gesture means "away for good"
  await page.click('#grid .crow[data-chat="live-two"]');
  await page.waitForFunction(() => document.getElementById('thread').style.display !== 'none');
  await page.$$eval('#thread .archlink', (ns) => ns.find((n) => n.textContent.trim() === 'Archive').click());
  // archiving asks first (askFirst → .askbox, confirm is the .go button)
  await page.waitForSelector('.askbox .go', { timeout: 4000 })
    .catch(() => fail('archiving did not ask first'));
  await page.click('.askbox .go');
  await page.waitForFunction(() => document.getElementById('home').style.display !== 'none', null, { timeout: 4000 })
    .catch(() => fail('archiving did not leave the chat'));

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: search folds to a glass; unarchive keeps her in the chat and out of the archive');
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// PICKING A CARD MUST NOT PAINT OVER THE PILL, AND IT PUTS A TAG ICON ON THE
// ROW (Aug 2026, Sophie, from a screenshot with one card picked: "something
// weird - covering the pill" · "add the tag icon to allow me to put any tag on
// a selected chat — add it next to done, it only shows if something is
// selected").
//
// Picking pins the tool row (`body.newspick #toolrow` — sticky, z-index 30, on
// the page's own paper) and that row sits inside the autoscroll pill's fixed
// band, so the row was painting straight over it: what she saw was the pill's
// outline with its glyphs covered. Select mode already hides the pill for the
// identical collision; this is the same fix on the Update screen.
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. with nothing picked the pill is on screen and the tag icon is NOT,
//   2. picking a card hides the pill outright — asked with elementFromPoint at
//      the pill's own centre, which is the only honest way to ask whether
//      something is sitting on it,
//   3. …and gives the row the corner back: the notch stops reserving 64px for
//      a pill that is not there,
//   4. the tag icon appears beside DONE and opens a sheet of her whole
//      vocabulary,
//   5. tapping a word POSTs it for EVERY picked chat (add, not set — a chat
//      keeps the words it already had), and the picking survives the sheet,
//   6. and a word every picked chat carries comes back off on the next tap.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-tag.js
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
  { id: 'm1', chat: 'chat-a', from: 'claude', text: 'the six cards are drawn', tldr: 'six cards drawn', created: iso(T0 - 600000), postedAt: iso(T0 - 600000) },
  { id: 'm2', chat: 'chat-b', from: 'claude', text: 'palette options are up', tldr: 'palettes up', created: iso(T0 - 900000), postedAt: iso(T0 - 900000) },
];
// chat-b already carries `witch`, chat-a does not — which is what makes the
// half-and-half case real: the chip must read unlit and ADD, never replace.
const reg = {
  'chat-a': { lastSeen: MSGS[0].created },
  'chat-b': { lastSeen: MSGS[1].created, labels: ['witch'] },
};
const labelPosts = [];

const server = http.createServer((req, res) => {
  // THE SHARED FILES chats.html LINKS, served the way express.static serves
  // them (scripts/lib/public-asset.js). This harness used to fall through to
  // its catch-all for every one of them, which is the quiet failure that file
  // exists to end: the page guards the global it could not load, so the harness
  // renders a page missing that behaviour and passes — or, when the catch-all's
  // body is not valid JS, throws a page error nobody asked about.
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(JSON.parse(b || '{}'))); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: reg, settings: { categories: ['witch', 'stories'] },
      truncated: [], messages: url.searchParams.get('since') ? [] : MSGS,
      delta: !!url.searchParams.get('since'),
    }));
  }
  if (url.pathname === '/api/chatfeed/labels' && req.method === 'POST') {
    return body((p) => {
      labelPosts.push(p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  }
  // The page loads two real scripts; the catch-all below would hand them JSON
  // and the page would throw on parse instead of running them.
  if (/^\/[\w-]+\.js$/.test(url.pathname) && fs.existsSync(path.join(PUB, url.pathname.slice(1)))) {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1)), 'utf8'));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ assets: [], pages: [], items: [], ok: true }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

// What is actually at the pill's centre — "is it visible" answers yes for an
// element with something painted on top of it, which is the whole bug.
const pillState = (page) => page.evaluate(() => {
  const f = document.querySelector('body > .float');
  if (!f) return { there: false };
  const r = f.getBoundingClientRect();
  const shown = !!f.getClientRects().length;
  const at = shown ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  const notch = document.getElementById('pillnotch').getBoundingClientRect().height;
  return { there: true, shown, mine: !!(at && f.contains(at)), notch: Math.round(notch) };
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('the page threw: ' + e.message));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat]');
  await page.evaluate(() => window.__setHomeView('news'));
  await page.waitForSelector('#grid .nwcard');

  // ---- 1. nothing picked: the pill is there and the tag icon is not -------
  const idle = await pillState(page);
  if (!idle.there) fail('the page has no pill at all, so this proves nothing');
  if (!idle.shown) fail('the pill is hidden with nothing picked');
  if (!idle.mine) fail('something is already covering the pill with nothing picked');
  if (await page.$('#catrow .nwtag')) fail('the tag icon is on the row with nothing picked');
  if (await page.$('#catrow .nwdone')) fail('DONE is on the row with nothing picked');

  // ---- 2 + 3. pick two cards ---------------------------------------------
  await page.click('#grid .nwcard[data-chat="chat-a"] .nwck');
  await page.click('#grid .nwcard[data-chat="chat-b"] .nwck');
  await page.waitForTimeout(150);
  if (!(await page.evaluate(() => document.body.classList.contains('newspick')))) {
    fail('picking a card did not pin the row (body.newspick)');
  }
  const picked = await pillState(page);
  if (picked.shown) fail('the pill is still painted while the pinned row runs through it');
  if (picked.notch > 1) fail('the notch still reserves ' + picked.notch + 'px for a pill that is gone');

  // ---- 4. the tag icon, beside DONE --------------------------------------
  const row = await page.evaluate(() => {
    const t = document.querySelector('#catrow .nwtag'), d = document.querySelector('#catrow .nwdone');
    if (!t || !d) return null;
    return { hasSvg: !!t.querySelector('svg'), text: (t.textContent || '').trim(),
      afterDone: !!(d.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  if (!row) return fail('no tag icon beside DONE while two cards are picked'), browser.close(), server.close();
  if (!row.hasSvg) fail('the tag chip has no glyph in it');
  if (row.text) fail('the tag chip carries words as well as the glyph: ' + row.text);
  if (!row.afterDone) fail('the tag chip is not next to DONE, where she asked for it');

  await page.click('#catrow .nwtag');
  await page.waitForSelector('.askwrap .arctags .catchip');
  const words = await page.$$eval('.askwrap .arctags .catchip', (bs) => bs.map((b) => b.textContent.trim()));
  if (words.indexOf('Witch') < 0) fail('her own vocabulary is missing from the sheet: ' + words.join(','));
  if (words.indexOf('Story') < 0) fail('the fixed tag list is missing from the sheet: ' + words.join(','));
  if (!(await page.$('.askwrap .arctags input'))) fail('the sheet offers no way to make a NEW word');

  // ---- 5. a tap writes it for both, and adds rather than replaces ---------
  const witch = await page.evaluateHandle(() =>
    [].find.call(document.querySelectorAll('.askwrap .arctags .catchip'), (b) => b.textContent.trim() === 'Witch'));
  if (await witch.evaluate((b) => b.classList.contains('on'))) {
    fail('Witch is lit although only one of the two picked chats carries it');
  }
  await witch.asElement().click();
  await page.waitForTimeout(200);
  const add = labelPosts[labelPosts.length - 1];
  if (!add || !add.add || add.add[0] !== 'witch') fail('tapping a word posted no add: ' + JSON.stringify(add));
  if (add.labels) fail('the sheet REPLACED the words instead of adding one: ' + JSON.stringify(add));
  if (!add.chats || add.chats.length !== 2) fail('the word did not go to both picked chats: ' + JSON.stringify(add));

  // ---- 6. now both have it, so the same chip takes it off -----------------
  const lit = await page.$eval('.askwrap .arctags .catchip.on', (b) => b.textContent.trim()).catch(() => '');
  if (lit !== 'Witch') fail('the word both chats now carry did not light up: ' + lit);
  await page.click('.askwrap .arctags .catchip.on');
  await page.waitForTimeout(200);
  const off = labelPosts[labelPosts.length - 1];
  if (!off || !off.remove || off.remove[0] !== 'witch') fail('tapping a lit word did not take it off: ' + JSON.stringify(off));

  // …and the picking survived the sheet, so she can tag again without re-picking
  await page.click('.askwrap .askrow .go');
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => document.body.classList.contains('newspick')))) {
    fail('shutting the sheet threw the selection away');
  }
  if (!(await page.$('#catrow .nwtag'))) fail('the tag icon left the row while cards were still picked');

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: picking hides the pill and gives back its corner, and the tag icon tags everything picked');
})().catch((e) => { console.error(e); process.exit(1); });

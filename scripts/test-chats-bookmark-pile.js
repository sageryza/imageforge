#!/usr/bin/env node
// test-chats-bookmark-pile.js — the keep-pile: CHATS · ARTIFACTS · MESSAGES.
//
//   node scripts/test-chats-bookmark-pile.js
//
// Sophie, Aug 2026: "I should be able to bookmark chats, compare pages and
// messages and they should all live in the same place… the hairline underline
// pattern with chats on the left, pages in the middle and messages on the
// right — except rather than Pages I want it called artifacts, cause that's
// the name I used for it myself."
//
// Drives the REAL public/chats.html headless and asserts:
//   1. every Compare row carries the bookmark, lit only where she kept it,
//   2. tapping it POSTs {bookmarked:true} and does NOT open the artifact,
//   3. a SUPERSEDED page can be kept too (the old version is often the point),
//   4. Bookmarks is THREE hairline tabs reading Chats / Artifacts / Messages,
//      in that order — never "Pages", which is the code's word, not hers,
//   5. each tab shows only its own kind, and Messages is where she lands,
//   6. a kept ARTIFACT opens full-screen; a kept CHAT opens its thread,
//   7. notes save to each kind's OWN route carrying no keep-flag — writing
//      why she kept something can never un-keep it,
//   8. all three tabs are tappable at 375/390/430 (this row sits inside the
//      autoscroll pill's band, so the right-hand tab is the one at risk),
//   9. the sliding underline is exactly one tab wide despite that reserve.
//
// Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const PAGES = [
  { id: 'p1', title: 'Cutting blocks v6 (s96)', created: iso(T0 - 6e5), superseded: false },
  { id: 'p2', title: 'Pausing tool', created: iso(T0 - 9e5), superseded: false },
  { id: 'p3', title: 'Cutting blocks v5 (s96)', created: iso(T0 - 12e5), superseded: true },
];
// one starred chat (= a kept chat) and one ordinary one
const CHATS = {
  'chat-a': { lastSeen: iso(T0 - 36e5) },
  'chat-keep': { lastSeen: iso(T0 - 2e5), starred: true, displayName: 'Imprint',
                 sophieNote: 'research it, karaoke, tabs', statusNeed: 'pick a palette' },
};
const bmk = {};                     // page id -> {bookmarked, note}
const posts = [];                   // {route, id, body} for every note/keep write

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  const read = (cb) => { let b = ''; req.on('data', (d) => b += d); req.on('end', () => cb(JSON.parse(b || '{}'))); };
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));

  if (p.startsWith('/api/chatfeed/page/') && p.endsWith('/bookmark')) {
    return read((body) => {
      const id = p.split('/')[4];
      posts.push({ route: 'page-bookmark', id, body });
      bmk[id] = bmk[id] || {};
      if (body.bookmarked !== undefined) bmk[id].bookmarked = !!body.bookmarked;
      if (body.note !== undefined) bmk[id].note = body.note;
      json({ ok: true, id });
    });
  }
  if (p === '/api/chatfeed/chatnote') {
    return read((body) => {
      posts.push({ route: 'chatnote', id: body.chat, body });
      if (CHATS[body.chat]) CHATS[body.chat].sophieNote = body.note;
      json({ ok: true, chat: body.chat });
    });
  }
  if (p === '/api/chatfeed/bookmark') {
    return read((body) => { posts.push({ route: 'bookmark', id: body.id, body }); json({ ok: true }); });
  }
  if (p.startsWith('/api/chatfeed/page/') && p.endsWith('/supersede')) return read(() => json({ ok: true }));
  if (p.startsWith('/api/chatfeed/page/')) return send('text/html; charset=utf-8', '<h1>the artifact</h1>');

  if (p === '/api/chatfeed/pages') return json({
    pages: PAGES.map((x) => Object.assign({}, x, {
      bookmarked: !!(bmk[x.id] && bmk[x.id].bookmarked),
      bookmarkNote: (bmk[x.id] && bmk[x.id].note) || '',
    })),
  });

  // the merged pile — messages, pages AND starred chats, exactly as the server
  if (p === '/api/chatfeed/bookmarks') {
    const items = [
      { id: 'm1', chat: 'chat-a', from: 'claude', created: iso(T0 - 3e5),
        snippet: 'an ordinary kept reply', note: '', kind: 'read' },
      { id: 'm2', chat: 'chat-a', from: 'claude', created: iso(T0 - 4e5),
        snippet: 'the one with the commands', note: '', kind: 'code' },
    ].concat(PAGES.filter((x) => bmk[x.id] && bmk[x.id].bookmarked).map((x) => ({
      id: x.id, chat: 'chat-a', from: '', created: x.created,
      title: x.title, snippet: x.title,
      note: (bmk[x.id] && bmk[x.id].note) || '', kind: 'page', superseded: x.superseded,
    }))).concat(Object.keys(CHATS).filter((c) => CHATS[c].starred).map((c) => ({
      id: c, chat: c, from: '', created: CHATS[c].lastSeen,
      title: CHATS[c].displayName || c,
      snippet: CHATS[c].statusNeed || '', note: CHATS[c].sophieNote || '', kind: 'chat',
    }))).sort((a, b) => (a.created < b.created ? 1 : -1));
    return json({ items, chats: CHATS });
  }

  if (p === '/api/chatfeed') {
    const t = iso(T0 - 36e5);
    return json({
      build: 't', settings: {}, truncated: [], delta: false, chats: CHATS,
      messages: [{ id: 'm1', chat: 'chat-a', from: 'claude', text: 'hi', tldr: 'hi', created: t, postedAt: t }],
    });
  }
  if (p.startsWith('/api/')) return json({ ok: true, assets: [], items: {}, texts: {}, pages: [] });
  try { return send('text/plain', fs.readFileSync(path.join(PUB, p.slice(1)))); }
  catch (_) { res.writeHead(404); res.end(''); }
});

(async () => {
  let pw; try { pw = require('playwright'); }
  catch (_) { try { pw = require('playwright-core'); } catch (_2) { console.log('playwright not installed — skipping'); process.exit(0); } }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((f) => { try { fs.accessSync(f); return true; } catch (_) { return false; } });
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || preinstalled || undefined, args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++; };
  const tabTexts = () => page.$$eval('#grid .acctabs.bmktabs .acctab', (n) => n.map((x) => x.textContent.trim()));
  const openTab = async (i) => { await page.$$eval('#grid .acctabs.bmktabs .acctab', (ns, k) => ns[k].click(), i); await page.waitForTimeout(300); };

  // ---- keeping an artifact from the Compare tab ---------------------------
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForTimeout(300);
  await page.click('.tg-compare'); await page.waitForTimeout(500);

  ok(await page.$$eval('.pagerow .pr-bmk', (n) => n.length) === 2, 'every page row carries a bookmark');
  ok(await page.$$eval('.pagerow .pr-bmk', (n) => n.every((x) => !x.classList.contains('on'))), 'none is lit yet');
  await page.$$eval('.pagerow .pr-bmk', (ns) => ns[0].click());
  await page.waitForTimeout(400);
  ok(await page.$eval('.pagerow .pr-bmk', (n) => n.classList.contains('on')), 'it lights up on the tap');
  ok(posts.length === 1 && posts[0].id === 'p1' && posts[0].body.bookmarked === true,
     'it POSTed {bookmarked:true} to that page’s own route');
  ok(await page.$$eval('.pageview', (n) => n.length) === 0, 'keeping a page does NOT open the artifact');

  // a SUPERSEDED page can be kept too
  await page.$$eval('#thread .acctab', (ns) => ns[0].click());
  await page.waitForTimeout(400);
  await page.$$eval('.pagerow .pr-bmk', (ns) => ns[0].click());
  await page.waitForTimeout(400);
  ok(posts.length === 2 && posts[1].id === 'p3', 'a superseded page can be kept');

  // ---- the pile -----------------------------------------------------------
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#bmklink', { timeout: 8000 });
  await page.click('#bmklink');
  await page.waitForTimeout(600);

  const tt = await tabTexts();
  ok(tt.length === 3 && tt[0] === 'Chats' && tt[1] === 'Artifacts' && tt[2] === 'Messages',
     'three tabs, her order and her word: ' + tt.join(' · '));
  ok(!/Pages/i.test(tt.join(' ')), 'it never says "Pages" — that is the code’s word, not hers');
  ok(await page.$$eval('#grid .bmkfilter', (n) => n.length) === 0, 'the old chip row is gone');
  ok((await page.$eval('#grid .acctabs.bmktabs', (n) => n.dataset.on)) === '2', 'Messages is where she lands');
  ok(await page.$$eval('#grid .bmkrow', (n) => n.length) === 2, 'Messages shows both kept messages');
  ok(await page.$$eval('#grid .bmkrow .sr-kind', (n) => n.filter((x) => x.textContent === 'code').length) === 1,
     'the code badge still splits things inside Messages');

  // ARTIFACTS
  await openTab(1);
  ok(await page.$$eval('#grid .bmkrow', (n) => n.length) === 2, 'Artifacts shows both kept pages');
  ok((await page.$eval('#grid .acctabs.bmktabs', (n) => n.dataset.on)) === '1', 'the underline slid to the middle');
  ok(await page.$$eval('#grid .bmkrow .sr-kind', (n) => n.length) === 0, 'no redundant badge — the tab already says it');

  // CHATS
  await openTab(0);
  ok(await page.$$eval('#grid .bmkrow', (n) => n.length) === 1, 'Chats shows the starred chat');
  ok(/Imprint/.test(await page.$eval('#grid .bmkrow .sr-chat', (n) => n.textContent)), 'under the name she gave it');
  ok((await page.$eval('#grid .bmkrow .sr-note-in', (n) => n.value)) === 'research it, karaoke, tabs',
     'carrying her existing note for that chat');

  // her note on a chat goes to the chat-note route, with no keep-flag
  let before = posts.length;
  await page.$eval('#grid .bmkrow .sr-note-in', (n) => { n.focus(); n.value = 'compare and Tinder templates'; });
  await page.$eval('#grid .bmkrow .sr-note-in', (n) => n.blur());
  await page.waitForTimeout(400);
  let last = posts[posts.length - 1];
  ok(posts.length === before + 1 && last.route === 'chatnote' && last.body.chat === 'chat-keep'
     && last.body.note === 'compare and Tinder templates', 'a chat’s note saves to /chatnote');
  ok(!('starred' in last.body) && !('bookmarked' in last.body), 'and carries no keep-flag');

  // tapping a kept CHAT opens its thread
  await page.click('#grid .bmkrow .sr-chat');
  await page.waitForTimeout(500);
  ok(await page.$eval('#thread', (n) => n.style.display !== 'none'), 'tapping a kept chat opens the thread');
  ok(await page.$$eval('.pageview', (n) => n.length) === 0, 'and not an artifact viewer');

  // tapping a kept ARTIFACT opens it full-screen
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#bmklink', { timeout: 8000 });
  await page.click('#bmklink'); await page.waitForTimeout(600);
  await openTab(1);
  before = posts.length;
  await page.$eval('#grid .bmkrow .sr-note-in', (n) => { n.focus(); n.value = 'the one she marked up'; });
  await page.$eval('#grid .bmkrow .sr-note-in', (n) => n.blur());
  await page.waitForTimeout(400);
  last = posts[posts.length - 1];
  ok(posts.length === before + 1 && last.route === 'page-bookmark' && last.body.note === 'the one she marked up'
     && !('bookmarked' in last.body), 'an artifact’s note saves to its page route with no keep-flag');
  await page.click('#grid .bmkrow .sr-snip');
  await page.waitForTimeout(600);
  ok(await page.$$eval('.pageview', (n) => n.length) === 1, 'tapping a kept artifact opens it full-screen');

  // ---- the pill's corner --------------------------------------------------
  // This row sits high on the screen, so the RIGHT tab is the one that gets
  // buried under the autoscroll pill. Hit-test rather than trust the numbers.
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#bmklink', { timeout: 8000 });
  await page.click('#bmklink'); await page.waitForTimeout(600);
  for (const w of [375, 390, 430]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(200);
    const reach = await page.$$eval('#grid .acctabs.bmktabs .acctab', (ns) => ns.map((x) => {
      const r = x.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(hit && (hit === x || x.contains(hit)));
    }));
    ok(reach.length === 3 && reach.every(Boolean), 'all three tabs are tappable at ' + w + 'px');
    // the sliding line must be exactly one tab wide (the padding-box trap)
    const fit = await page.$eval('#grid .acctabs.bmktabs', (n) => {
      const line = parseFloat(getComputedStyle(n, '::after').width);
      const tab = n.querySelector('.acctab').getBoundingClientRect().width;
      return Math.abs(line - tab);
    });
    ok(fit < 1.5, 'the underline is one tab wide at ' + w + 'px (off by ' + fit.toFixed(2) + 'px)');
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  console.log(fails ? fails + ' failed' : 'all checks passed');
  await b.close(); server.close();
  process.exit(fails ? 1 : 0);
})();

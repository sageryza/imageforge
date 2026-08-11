#!/usr/bin/env node
// test-chats-bookmark-pages.js — bookmarking a COMPARE PAGE, and finding it
// again in the Bookmarks view.
//
//   node scripts/test-chats-bookmark-pages.js
//
// Sophie, Aug 2026: "I'd like to be able to bookmark or star artifacts in the
// compare tab as well as messages, and they could show up in the same place."
// Bookmarks is already the one "things I kept, across every chat" pile, so a
// kept page joins it as a third KIND rather than starting a second pile.
//
// Drives the REAL public/chats.html headless, the honest way in (home list ->
// thread -> Compare tab -> the rows -> back out to Bookmarks) and asserts:
//   1. every Compare row carries the bookmark, lit only where she kept it,
//   2. tapping it POSTs {bookmarked:true} and does NOT open the artifact,
//   3. a SUPERSEDED page can be kept too (the old version is often the point),
//   4. the kept page shows in Bookmarks with a `page` badge beside its chat,
//   5. the Pages chip filters to exactly the kept pages,
//   6. tapping a kept page opens the ARTIFACT full-screen, never a thread,
//   7. a note typed on that row saves to the PAGE's route carrying NO
//      `bookmarked` field — writing why she kept it can't un-keep it,
//   8. the four chips still fit/reach on a 375px screen.
//
// Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// two current pages + one already superseded
const PAGES = [
  { id: 'p1', title: 'Cutting blocks v6 (s96)', created: iso(T0 - 6e5), superseded: false },
  { id: 'p2', title: 'Pausing tool', created: iso(T0 - 9e5), superseded: false },
  { id: 'p3', title: 'Cutting blocks v5 (s96)', created: iso(T0 - 12e5), superseded: true },
];
const bmk = {};                     // id -> {bookmarked, note}
const posts = [];                   // every page-bookmark POST body, in order

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));

  // the new route — must be matched BEFORE the page-serving one below
  if (p.startsWith('/api/chatfeed/page/') && p.endsWith('/bookmark')) {
    let b = ''; req.on('data', (d) => b += d);
    return req.on('end', () => {
      const id = p.split('/')[4], body = JSON.parse(b || '{}');
      posts.push({ id, body });
      bmk[id] = bmk[id] || {};
      if (body.bookmarked !== undefined) bmk[id].bookmarked = !!body.bookmarked;
      if (body.note !== undefined) bmk[id].note = body.note;
      json({ ok: true, id });
    });
  }
  if (p.startsWith('/api/chatfeed/page/') && p.endsWith('/supersede')) {
    let b = ''; req.on('data', (d) => b += d);
    return req.on('end', () => json({ ok: true }));
  }
  if (p.startsWith('/api/chatfeed/page/')) return send('text/html; charset=utf-8', '<h1>the artifact</h1>');

  if (p === '/api/chatfeed/pages') return json({
    pages: PAGES.map((x) => Object.assign({}, x, {
      bookmarked: !!(bmk[x.id] && bmk[x.id].bookmarked),
      bookmarkNote: (bmk[x.id] && bmk[x.id].note) || '',
    })),
  });

  // the merged pile: messages AND pages, newest first — what the server does
  if (p === '/api/chatfeed/bookmarks') {
    const items = [{
      id: 'm1', chat: 'chat-a', from: 'claude', created: iso(T0 - 3e5),
      snippet: 'an ordinary kept reply', note: '', kind: 'read',
    }].concat(PAGES.filter((x) => bmk[x.id] && bmk[x.id].bookmarked).map((x) => ({
      id: x.id, chat: 'chat-a', from: '', created: x.created,
      title: x.title, snippet: x.title,
      note: (bmk[x.id] && bmk[x.id].note) || '', kind: 'page', superseded: x.superseded,
    }))).sort((a, b) => (a.created < b.created ? 1 : -1));
    return json({ items, chats: { 'chat-a': { lastSeen: iso(T0 - 3e5) } } });
  }

  if (p === '/api/chatfeed') {
    const t = iso(T0 - 36e5);
    return json({
      build: 't', settings: {}, truncated: [], delta: false,
      chats: { 'chat-a': { lastSeen: t } },
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

  // ---- the Compare tab ----------------------------------------------------
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForTimeout(300);
  await page.click('.tg-compare'); await page.waitForTimeout(500);

  ok(await page.$$eval('.pagerow', (n) => n.length) === 2, 'the two current pages show');
  ok(await page.$$eval('.pagerow .pr-bmk', (n) => n.length) === 2, 'every page row carries a bookmark');
  ok(await page.$$eval('.pagerow .pr-bmk', (n) => n.every((x) => !x.classList.contains('on'))),
     'none is lit before she keeps one');

  // tap the first one's bookmark
  await page.$$eval('.pagerow .pr-bmk', (ns) => ns[0].click());
  await page.waitForTimeout(400);
  ok(await page.$eval('.pagerow .pr-bmk', (n) => n.classList.contains('on')), 'it lights up on the tap');
  ok(posts.length === 1 && posts[0].id === 'p1' && posts[0].body.bookmarked === true,
     'it POSTed {bookmarked:true} to that page’s own route');
  ok(await page.$$eval('.pageview', (n) => n.length) === 0,
     'keeping a page does NOT open the artifact');

  // the lit mark survives a reload — it is on the page doc, not the session
  await page.click('.tg-chat'); await page.waitForTimeout(200);
  await page.click('.tg-compare'); await page.waitForTimeout(500);
  ok(await page.$eval('.pagerow .pr-bmk', (n) => n.classList.contains('on')), 'the mark is still lit after a repaint');

  // a SUPERSEDED page can be kept too — often the version worth keeping
  await page.$$eval('#thread .acctab', (ns) => ns[0].click());
  await page.waitForTimeout(400);
  ok(await page.$$eval('.pagerow .pr-bmk', (n) => n.length) === 1, 'the superseded tab’s row has one too');
  await page.$$eval('.pagerow .pr-bmk', (ns) => ns[0].click());
  await page.waitForTimeout(400);
  ok(posts.length === 2 && posts[1].id === 'p3' && posts[1].body.bookmarked === true,
     'a superseded page can be kept');

  // ---- the Bookmarks view -------------------------------------------------
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#bmklink', { timeout: 8000 });
  await page.click('#bmklink');
  await page.waitForTimeout(600);
  ok(await page.$$eval('.bmkrow', (n) => n.length) === 3, 'the kept message and both kept pages are in one pile');
  ok(await page.$$eval('.bmkrow .sr-kind', (n) => n.filter((x) => x.textContent === 'page').length) === 2,
     'each kept page wears a `page` badge');

  // the chips
  const chips = await page.$$eval('.bmkfilter .tbtn', (n) => n.map((x) => x.textContent.trim()));
  ok(chips.length === 4 && /Pages 2/.test(chips[3]), 'a Pages chip counts them: ' + chips.join(' | '));
  // …and they are all reachable at the narrow width (the row wraps rather
  // than pushing the fourth chip off the screen)
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(150);
  const reach = await page.$$eval('.bmkfilter .tbtn', (ns) => ns.map((x) => {
    const r = x.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(hit && (hit === x || x.contains(hit)));
  }));
  ok(reach.every(Boolean), 'all four chips are tappable at 375px');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(150);

  await page.$$eval('.bmkfilter .tbtn', (ns) => ns[3].click());
  await page.waitForTimeout(300);
  ok(await page.$$eval('.bmkrow', (n) => n.length) === 2, 'the Pages chip narrows to just the pages');

  // a note on a kept page — saves to the PAGE route, and carries NO
  // `bookmarked` field, so naming it can never un-keep it
  const before = posts.length;
  await page.$eval('.bmkrow .sr-note-in', (n) => { n.focus(); n.value = 'the one she marked up'; });
  await page.$eval('.bmkrow .sr-note-in', (n) => n.blur());
  await page.waitForTimeout(400);
  const note = posts[posts.length - 1];
  ok(posts.length === before + 1 && note.body.note === 'the one she marked up',
     'the note saved from the row itself');
  ok(note.id === 'p1' || note.id === 'p3', 'it went to the page’s own route, not /bookmark');
  ok(!('bookmarked' in note.body), 'and it carried no `bookmarked` field — a note can’t un-keep it');

  // tapping the NOTE FIELD must never launch anything — she is naming it
  await page.click('.bmkrow .sr-note-in');
  await page.waitForTimeout(300);
  ok(await page.$$eval('.pageview', (n) => n.length) === 0, 'tapping the note field opens nothing');

  // tapping the row itself opens the ARTIFACT, not a thread
  await page.click('.bmkrow .sr-snip');
  await page.waitForTimeout(500);
  ok(await page.$$eval('.pageview', (n) => n.length) === 1, 'tapping a kept page opens it full-screen');
  ok(await page.$$eval('#thread', (n) => n.filter((x) => x.style.display !== 'none').length) === 0,
     'and it did not open a thread instead');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  console.log(fails ? fails + ' failed' : 'all checks passed');
  await b.close(); server.close();
  process.exit(fails ? 1 : 0);
})();

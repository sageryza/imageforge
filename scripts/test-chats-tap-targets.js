#!/usr/bin/env node
// THE ⌄ FOR MORE INFORMATION WAS TOO SMALL TO TAP (Aug 2026, Sophie: "the
// arrow for more information on the chats and the update tab is too small of
// a tap target").
//
// Measured on her phone's width before the fix:
//   • the Update tab's ⌄ (`.nwmore`)  — 19 x 29
//   • the wrap-up's ⌄ (`.wrapmore`), in a thread and on an archive row
//                                    — 32.6 x 23
// Against the 44px a thumb actually needs, that is a third of the area on the
// Update tab and half on the other two — on the one control whose whole job is
// "show me more".
//
// This asserts both of them, and the things that had to stay true while they
// grew:
//   1. THE UPDATE TAB'S ⌄ DOES NOT MOVE. Only the box around it grew; the
//      negative margins absorb the extra height, so it lands on the pixel it
//      always did.
//   2. THE ✓ IS STILL OUT OF REACH. The timestamp was moved between them for
//      exactly this reason ("I'm worried I'll tap that by accident"), and the
//      Update tab's ⌄ widens into `.nwtop`'s own gaps, not past them.
//   3. THE CHAT NAME LOSES NO WIDTH. 83 of her 144 names already truncate, so
//      the Update tab's extra width is an ::after over space that belonged to
//      nothing — `.crow` must measure the same as before.
//
// THE WRAP-UP'S ⌄ ITSELF IS GONE (Aug 2026 v2, Sophie: "get rid of the
// chevron, put a 'see more...' link under it instead"; v3, same day, after a
// first swap gave it button padding: "part of the summary at the top just
// happens to also be a link and have a line under it" — she does NOT want a
// 44px control here, she wants it to cost no extra space at all). In a
// thread it is now literally appended INSIDE the summary paragraph, so it
// has no box of its own to measure. On an archive row it still has to be a
// sibling (a row is a `<button>` and cannot nest another one), but it is
// plain inline text at the summary's own size — no minimum height is
// enforced here on purpose, this time. What's still asserted: the two
// archived rows never overlap, and the link opens only its own row.
//
//   npm install playwright-core --no-save && node scripts/test-chats-tap-targets.js
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

// A thumb needs 44. The boxes are allowed to be a little under in ONE
// dimension where the layout genuinely cannot give it (the Update tab's width
// is bounded by the chat name), but never under this.
const MIN = 36;

const MSGS = [
  { id: 'm1', chat: 'noted', from: 'claude', text: 'a yellow raincoat', tldr: 'the one', created: iso(T0 - 6e5), postedAt: iso(T0 - 6e5) },
];
const CHATS = {
  // the Update tab needs an unchecked reply AND an update card to draw a ⌄;
  // the thread needs the three depths of a wrap-up
  noted: {
    account: '1', sophieNote: 'waiting on the palette',
    updAsked: 'a bigger arrow', updDid: 'grew the box around it', updNext: '',
    wrapLine: 'Built the pause timeline and shipped v7b.',
    wrapUp: 'Built the pause timeline. Shipped v7b. Lengths are stored per paragraph.',
    wrapOpen: 'Whether the 45 percent line still reads bungled.',
  },
  // two archived chats, so the row BELOW an arrow is a different chat
  arch1: { account: '1', archived: true, archivedAt: iso(T0 - 1e6),
    wrapLine: 'An archived chat with a summary.', wrapUp: 'Three sentences. And more. And more.', wrapOpen: 'One thing.' },
  arch2: { account: '1', archived: true, archivedAt: iso(T0 - 2e6),
    wrapLine: 'A second archived chat with a summary.', wrapUp: 'More sentences. And more.', wrapOpen: 'Another thing.' },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'b1', chats: CHATS, settings: { categories: [] },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/thread') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages: MSGS }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(asset));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [], assets: [], total: 0, pages: [] }));
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('the page threw: ' + e.message));

  // THE HONEST QUESTION IS WHAT THE TAP REACHES, not what the box measures —
  // the Update tab's width is an ::after, which no getBoundingClientRect sees.
  // So walk out from the glyph's centre and ask the document at each pixel.
  const reach = (sel) => page.evaluate((s) => {
    const n = document.querySelector(s);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const mine = (x, y) => { const e = document.elementFromPoint(x, y); return !!(e && (e === n || n.contains(e))); };
    const walk = (dx, dy) => { let d = 0; while (d < 80 && mine(cx + dx * (d + 1), cy + dy * (d + 1))) d++; return d; };
    return {
      w: walk(-1, 0) + walk(1, 0) + 1, h: walk(0, -1) + walk(0, 1) + 1,
      cx: +cx.toFixed(1), cy: +cy.toFixed(1),
    };
  }, sel);

  // ---- 1. the Update tab's ⌄ -------------------------------------------
  await page.goto(base + '/chats?view=news');
  await page.waitForSelector('.nwcard .nwmore', { timeout: 8000 })
    .catch(() => fail('the Update tab drew no ⌄ at all'));
  const nw = await reach('.nwcard .nwmore');
  if (!nw) fail('no .nwmore');
  else {
    if (nw.h < 44) fail('the Update tab\'s ⌄ is ' + nw.h + 'px tall — a thumb needs 44');
    if (nw.w < MIN) fail('the Update tab\'s ⌄ is only ' + nw.w + 'px wide (was 19)');
  }
  // …and the chat NAME paid nothing for it: `.crow` is `flex:1`, so any width
  // the button takes in LAYOUT comes straight off the name. The reach above is
  // an ::after, which occupies no layout at all — so the button's own box must
  // still measure what it always did.
  const boxW = await page.$eval('.nwcard .nwmore', (n) => n.getBoundingClientRect().width);
  if (boxW > 20) fail('the ⌄ grew in LAYOUT (' + boxW + 'px) — that width comes off the chat name');
  // …and it cannot reach the ✓, which is the tap she was worried about
  const ck = await page.evaluate(() => {
    const b = document.querySelector('.nwcard .nwck'), r = b.getBoundingClientRect();
    const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest('button'); };
    return { self: hit(r.left + r.width / 2, r.top + r.height / 2) === b,
      edge: (hit(r.left + 1, r.top + r.height / 2) || {}).className || '' };
  });
  if (!ck.self) fail('the ✓ is no longer the thing you hit at its own centre');
  if (/nwmore/.test(ck.edge)) fail('the ⌄ now reaches the ✓ — that is the tap she asked to be kept apart');

  // ---- 2. the wrap-up's "see more" link in a thread ----------------------
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="noted"]');
  await page.click('#grid [data-chat="noted"]');
  await page.waitForSelector('#thread .threadwrap .wrapmore');
  // IT IS PART OF THE SUMMARY, NOT A CONTROL UNDER IT (Aug 2026 v3, Sophie:
  // "part of the summary at the top just happens to also be a link"). So no
  // minimum box size here — the two things that matter are that it is really
  // nested inside the summary paragraph, and that it reads at the same size
  // and font as the rest of the sentence.
  const twFonts = await page.$eval('#thread .threadwrap .twline', (p) => {
    const link = p.querySelector('.wrapmore');
    if (!link) return null;
    const ps = getComputedStyle(p), ls = getComputedStyle(link);
    return { nested: p.contains(link), pFont: ps.fontFamily, lFont: ls.fontFamily, pSize: ps.fontSize, lSize: ls.fontSize };
  });
  if (!twFonts) fail('no "see more" link under her note');
  else {
    if (!twFonts.nested) fail('the "see more" link is not inside the summary paragraph');
    if (twFonts.lFont !== twFonts.pFont) fail('the link\'s font is ' + twFonts.lFont + ', the summary\'s is ' + twFonts.pFont);
    if (twFonts.lSize !== twFonts.pSize) fail('the link\'s size is ' + twFonts.lSize + ', the summary\'s is ' + twFonts.pSize);
  }
  // it still does its one job
  await page.click('#thread .threadwrap .wrapmore');
  if (await page.$eval('#thread .threadwrap .wrapfull', (b) => b.hidden)) {
    fail('the "see more" link stopped opening the summary');
  }

  // ---- 3. the wrap-up's "see more" link on an archive row ---------------
  await page.goto(base + '/chats');
  await page.waitForSelector('#archlink');
  await page.evaluate(() => document.getElementById('archlink').click());
  await page.waitForSelector('#grid .wrapmore', { timeout: 5000 })
    .catch(() => fail('the archive drew no "see more" link'));
  // Same size and font as the row's own summary line, here too.
  const awFonts = await page.$eval('#grid .crow[data-chat] + .wrapmore', (link) => {
    const note = link.previousElementSibling.querySelector('.cr-note');
    if (!note) return null;
    const ns = getComputedStyle(note), ls = getComputedStyle(link);
    return { nFont: ns.fontFamily, lFont: ls.fontFamily, nSize: ns.fontSize, lSize: ls.fontSize };
  });
  if (!awFonts) fail('the archived row has no .cr-note to compare the link against');
  else {
    if (awFonts.lFont !== awFonts.nFont) fail('the archive link\'s font is ' + awFonts.lFont + ', the row\'s is ' + awFonts.nFont);
    if (awFonts.lSize !== awFonts.nSize) fail('the archive link\'s size is ' + awFonts.lSize + ', the row\'s is ' + awFonts.nSize);
  }
  // A plain link sits in its own slot rather than overhanging the row above,
  // so the two archived rows must never overlap.
  const rows = await page.$$eval('#grid .crow', (els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { name: e.dataset.chat, top: r.top, bottom: r.bottom };
  }));
  if (rows.length < 2) fail('only ' + rows.length + ' archived rows — this check needs two');
  else if (rows[1].top < rows[0].bottom) {
    fail('the archive rows overlap: ' + rows[1].name + ' starts at ' + rows[1].top +
      ' before ' + rows[0].name + ' ends at ' + rows[0].bottom);
  }
  // and it still opens only ITS OWN row's summary, never the next one's
  await page.click('#grid .wrapmore');
  const opened = await page.$$eval('#grid .wrapfull', (bs) => bs.map((b) => !b.hidden));
  if (!opened[0]) fail('the "see more" link did not open its own row\'s summary');
  if (opened[1]) fail('it opened the OTHER row\'s summary instead');

  await browser.close();
  server.close();
  console.log(failed ? '\n' + failed + ' failure(s).' : '\nOK — every ⌄ is a real tap target, and nothing else lost one.');
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// test-chats-tab-lines.js — the hairline rows' sliding line sits under the word.
//
//   node scripts/test-chats-tab-lines.js
//
// Sophie, Aug 2026: "close it so it can't happen again." The line used to be a
// PERCENTAGE of the row (a width per row class) plus a translateX step per
// slot, so every row declared its own tab count in CSS — and the Compare row
// ended up declaring the wrong one without anybody writing anything wrong: it
// was authored against the two-tab rule on its own branch and merged four
// minutes after a third tab landed on main from another chat (a576e08 →
// 38aa56e, 2026-08-11). Clean merge, no failure, wrong line for two days.
//
// The line now MEASURES `.acctab.on`, so there is no count to disagree with.
// This test is the guard on that: it drives the real page to every one of the
// five rows, at three widths, and asserts the line's own rect against the lit
// tab's — which is the same question Sophie asked by eye ("the words in the
// middle and on the edge rather than under the line"), asked in numbers.
//
// It also pins the two things the measuring approach can get wrong and a
// percentage could not: an unmeasured row must draw NO line rather than a
// guessed one, and the observer that repaints must not write the style
// attribute it is itself watching (an rAF loop forever).
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
  { id: 'm1', chat: 'alpha', from: 'claude', text: 'a', tldr: 'a', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'beta', from: 'claude', text: 'b', tldr: 'b', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'gone', from: 'claude', text: 'c', tldr: 'c', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
];
// 'beta' carries a two-digit unread badge on purpose: a badge makes its tab
// WIDER than its neighbours, which a percentage line can never follow and a
// measured one gets for free.
const CHATS = {
  alpha: { account: '1', lastSeen: iso(T0 - 1000) },
  beta: { account: '2', lastSeen: iso(T0 - 2000) },
  gone: { account: '1', archived: true, lastSeen: iso(T0 - 3000) },
};
const PAGES = [
  { id: 'p1', title: 'A current artifact', created: iso(T0 - 4000), superseded: false },
  { id: 'p2', title: 'An older artifact', created: iso(T0 - 9000), superseded: true },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  if (url.pathname === '/' || url.pathname === '/chats') {
    return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return send('application/json', JSON.stringify({
      build: 'b1', chats: CHATS, settings: { appAccount: '1' },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/pages') return send('application/json', JSON.stringify({ pages: PAGES }));
  if (url.pathname === '/api/chatfeed/bookmarks') {
    return send('application/json', JSON.stringify({
      bookmarks: [
        { kind: 'msg', id: 'm1', chat: 'alpha', text: 'kept message', created: iso(T0 - 1000) },
        { kind: 'page', id: 'p1', chat: 'alpha', title: 'kept artifact', created: iso(T0 - 4000) },
        { kind: 'chat', chat: 'alpha', created: iso(T0 - 1000) },
      ],
    }));
  }
  if (url.pathname.startsWith('/api/')) {
    return send('application/json', '{"ok":true,"assets":[],"items":{},"texts":{},"pages":[],"todos":[],"bookmarks":[]}');
  }
  try { return send('text/plain', fs.readFileSync(path.join(PUB, url.pathname.slice(1)))); }
  catch { res.writeHead(404); res.end(''); }
});

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++; };

// The whole assertion, in one place: the ::after's real rect against the lit
// tab's. getComputedStyle on the pseudo-element is what makes this honest —
// it resolves the custom properties and the transform, so it measures what is
// actually painted rather than what the markup intends.
async function lineVsTab(page, sel) {
  return page.$eval(sel, (row) => {
    const on = row.querySelector('.acctab.on');
    if (!on) return { err: 'no lit tab' };
    const cs = getComputedStyle(row, '::after');
    const r = row.getBoundingClientRect();
    const t = on.getBoundingClientRect();
    const w = parseFloat(cs.width) || 0;
    const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
    const left = r.left + row.clientLeft + parseFloat(cs.left || 0) + m.m41;
    return {
      tabs: row.querySelectorAll('.acctab').length,
      label: (on.textContent || '').trim().split('\n')[0],
      dw: Math.abs(w - t.width), dx: Math.abs(left - t.left),
      w, tw: t.width,
    };
  });
}

async function checkRow(page, sel, what, widths) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    // The line TRANSITIONS (.2s) — measure the settled state, not a frame
    // partway through the slide, or the tab with furthest to travel reads as
    // misplaced by a pixel or two when it is only still moving.
    await page.waitForTimeout(340);
    const g = await lineVsTab(page, sel);
    if (g.err) { ok(false, what + ' at ' + width + ': ' + g.err); continue; }
    ok(g.dw <= 1 && g.dx <= 1,
      what + ' (' + g.tabs + ' tabs) — line is exactly under "' + g.label + '" at ' + width +
      ' (width off by ' + g.dw.toFixed(1) + 'px, left off by ' + g.dx.toFixed(1) + 'px)');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(340);
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || preinstalled || undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  const WIDTHS = [375, 390, 430];

  await page.goto(base + '/chats', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#grid .crow[data-chat="alpha"]', { timeout: 8000 });

  // ── 1. the account row — three tabs, and every one of them ──────────────
  const accTabs = await page.$$eval('#accrow .acctab', ns => ns.length);
  ok(accTabs === 3, 'the account row still has three tabs (Update · 1 · 2)');
  for (let i = 0; i < accTabs; i++) {
    await page.$$eval('#accrow .acctab', (ns, j) => ns[j].click(), i);
    await page.waitForTimeout(340);
    await checkRow(page, '#accrow', 'account row, tab ' + (i + 1), WIDTHS);
  }
  // back to a list view
  await page.$$eval('#accrow .acctab', ns => ns[1].click());
  await page.waitForTimeout(250);

  // ── 2. Bookmarks — three tabs ───────────────────────────────────────────
  await page.evaluate(() => window.__setHomeView('bookmarks'));
  await page.waitForSelector('.acctabs.bmktabs', { timeout: 5000 });
  const bmk = await page.$$eval('.bmktabs .acctab', ns => ns.length);
  ok(bmk === 3, 'the keep-pile still has three tabs');
  for (let i = 0; i < bmk; i++) {
    await page.$$eval('.bmktabs .acctab', (ns, j) => ns[j].click(), i);
    await page.waitForTimeout(340);
    await checkRow(page, '.acctabs.bmktabs', 'bookmarks, tab ' + (i + 1), WIDTHS);
  }

  // ── 3. (was the archive's two piles) ────────────────────────────────────
  // The BUILT / OTHER hairline row is GONE (Aug 2026): her tags replaced the
  // piles, and a tag filter is a chip row, not a measured-underline tab row.
  // scripts/test-chats-archive-tags.js owns what stands there now. The view
  // still has to come back to the chat list for section 4.
  await page.evaluate(() => window.__setHomeView('chats'));
  await page.waitForTimeout(200);

  // ── 4. the Compare row — the one that was wrong ─────────────────────────
  await page.click('#grid .crow[data-chat="alpha"]');
  await page.waitForTimeout(300);
  await page.click('.tg-compare');
  await page.waitForSelector('#thread .acctabs.cmptabs', { timeout: 5000 });
  const cmp = await page.$$eval('#thread .cmptabs .acctab', ns => ns.length);
  ok(cmp === 2, 'the Compare row has two tabs');
  for (let i = 0; i < cmp; i++) {
    await page.$$eval('#thread .cmptabs .acctab', (ns, j) => ns[j].click(), i);
    await page.waitForTimeout(340);
    await checkRow(page, '#thread .acctabs.cmptabs', 'compare, tab ' + (i + 1), WIDTHS);
  }

  // ── 5. (was the archive sheet's pile picker) ────────────────────────────
  // Also gone with the piles — the sheet asks for tags now, as chips. What a
  // row born inside a popup has to do is unchanged and still worth knowing;
  // if another hairline row ever opens in an overlay, measure it here.

  // ── 6. an unmeasured row draws NO line, never a guessed one ─────────────
  // This is the half a percentage could not give: with no measurement there is
  // no number to be wrong, so silence is the honest default.
  const bare = await page.evaluate(() => {
    const d = document.createElement('div');
    d.className = 'acctabs';
    d.innerHTML = '<button class="acctab">One</button><button class="acctab">Two</button>';
    document.body.appendChild(d);
    const w = getComputedStyle(d, '::after').width;
    d.remove();
    return w;
  });
  ok(parseFloat(bare) === 0 || bare === 'auto',
    'a row with nothing lit draws no line at all (got "' + bare + '")');

  // ── 7. the repaint observer must not feed itself ────────────────────────
  // It watches the style attribute and the repaint WRITES the style attribute,
  // so an unconditional write is an rAF loop that never idles. Count real
  // frames of work over ~1s of a quiet page.
  const spun = await page.evaluate(() => new Promise((resolve) => {
    let writes = 0;
    const obs = new MutationObserver((recs) => {
      recs.forEach(r => { if (r.target.classList && r.target.classList.contains('acctabs')) writes++; });
    });
    obs.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['style'] });
    setTimeout(() => { obs.disconnect(); resolve(writes); }, 1000);
  }));
  ok(spun === 0, 'the line settles and stops writing (' + spun + ' style writes in a quiet second)');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  console.log(fails ? fails + ' failed' : 'all checks passed');
  await browser.close();
  server.close();
  process.exit(fails ? 1 : 0);
})();

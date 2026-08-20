#!/usr/bin/env node
// PIN A CHAT TO THE TOP · ORGANIZE FROM INSIDE A CHAT · THE SELECT BAR AT THE
// TOP (Aug 2026, Sophie, over two passes).
//
// Pass 1: "an option to pin chat to the top so they always show first when
// they come out of hiding and they never disappeared to the bottom if I don't
// look at them for a while, and I guess I can just unpin them if necessary".
// Pass 2, three corrections and asks in one message:
//   • "sorry I was talking about the pin that's like round with a metal thing
//     sticking down from it. That's a different one that you made" — a
//     PUSHPIN, not the Maps teardrop it shipped as,
//   • "I was assuming it would go right on the main page not inside of it" —
//     the control belongs on the home row, not in the thread header,
//   • "an ability to tag or categorize something from within the chat itself
//     … an icon that says organize and then it pulls up the ability to tag and
//     categorize which is already on the front page",
//   • "when I am selecting things to change their category right now the
//     selection is at the bottom instead. Can you pin it to the top".
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. THE SORT, which is the whole point — a pinned chat leads the home list
//      even when its newest message is the OLDEST on screen, including one
//      that has just come back out of the hidden pile, and the rest still sort
//      by recency underneath it,
//   2. the pin is a CONTROL ON THE ROW (and on the tile), lit on a pinned chat
//      and unlit on the others — and there is NO second copy of it as a mark
//      at the front of the row,
//   3. it is NOT in the thread header any more,
//   4. tapping it POSTs /api/chatfeed/pin-top with the flipped value AND moves
//      the row to the top,
//   5. tapping it again unpins and POSTs `pinTop:false`,
//   6. a failed POST rolls it back — nothing lies about being pinned,
//   7. the glyph is the PUSHPIN, not the map pin: a round head with a straight
//      spike, and the head is STROKED even when unpinned (fill-only made the
//      unpinned button read as a bare stick),
//   8. ONLY THE HEAD GOES RED — the head fills and strokes in the red while the
//      spike does not,
//   9. ORGANIZE opens from the thread header and carries BOTH halves: the
//      folders (one at a time, the one it is in already lit) and the tags
//      (many), each writing to its own route,
//  10. the select bar is pinned to the TOP of the screen, keeps the top-right
//      corner clear of the autoscroll pill, and holds room so the first chat
//      is not buried under it.
//
//   npm install playwright-core --no-save && node scripts/test-chats-pin-top.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
// `sunk` is the oldest thing on the screen AND it is pinned — that is the
// whole feature: without the pin it sorts last, with it, first. Its `hiddenAt`
// is older than its own newest message, which is how the page reads "this one
// came back out of the hidden pile".
const MSGS = [
  { id: 'm1', chat: 'sunk', from: 'claude', text: 'quiet for days', tldr: 'quiet', created: iso(T0 - 72 * HOUR), postedAt: iso(T0 - 72 * HOUR) },
  { id: 'm2', chat: 'middle', from: 'claude', text: 'an hour ago', tldr: 'middle', created: iso(T0 - HOUR), postedAt: iso(T0 - HOUR) },
  { id: 'm3', chat: 'newest', from: 'claude', text: 'just now', tldr: 'newest', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
];
const posted = { pin: [], labels: [] };
let pinFails = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      settings: { categories: ['tech', 'stories'] },
      chats: {
        sunk: { lastSeen: MSGS[0].created, pinTop: true, hiddenAt: iso(T0 - 96 * HOUR) },
        // Deliberately UNFILED, all three: filing a chat takes it off the
        // unfiled home list, so a fixture chat in a folder would simply not be
        // on the screen this test is about.
        middle: { lastSeen: MSGS[1].created },
        newest: { lastSeen: MSGS[2].created },
      } }));
  }
  const sink = { '/api/chatfeed/pin-top': 'pin', '/api/chatfeed/labels': 'labels' }[url.pathname];
  if (sink && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      posted[sink].push(JSON.parse(body || '{}'));
      const bad = sink === 'pin' && pinFails;
      res.writeHead(bad ? 500 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(bad ? { error: 'nope' } : { ok: true }));
    });
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
let checks = 0;
const ok = () => { checks++; };
const RED = /rgb\(179,\s*68,\s*63\)/;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const home = async () => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid .crow[data-chat="newest"]');
  };
  const order = () => page.$$eval('#grid .crow', (ns) => ns.map((n) => n.dataset.chat));
  const rowPin = (chat) => '#grid .crow[data-chat="' + chat + '"] .pinrow';
  // Tappable where drawn, or something is sitting on top of it.
  const hitTest = async (sel, what) => {
    const box = await page.$eval(sel, (n) => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const hit = await page.evaluate(({ x, y, s }) => {
      const e = document.elementFromPoint(x, y);
      return e && e.closest(s) ? 'ok' : (e ? (e.className || e.tagName) : 'none');
    }, { ...box, s: sel });
    if (hit !== 'ok') fail(what + ' is buried under ' + hit); else ok();
  };

  // ── 1. the sort ───────────────────────────────────────────────────────────
  await home();
  const first = await order();
  if (first[0] !== 'sunk') fail('the pinned chat did not lead the list — ' + JSON.stringify(first));
  else ok();
  if (first.slice(1).join(',') !== 'newest,middle') {
    fail('pinning disturbed the recency sort under it — ' + JSON.stringify(first));
  } else ok();

  // ── 2/3. the control is on the ROW, not in the header, and not doubled ────
  if (!await page.$(rowPin('sunk') + '.on')) fail('the pinned row has no lit pin control');
  else ok();
  if (await page.$(rowPin('newest') + '.on')) fail('an unpinned row drew a lit pin');
  else ok();
  if (!await page.$(rowPin('newest'))) fail('an unpinned row has no pin control at all — it can never be pinned');
  else ok();
  if (await page.$('#grid .crow .cr-pin')) {
    fail('the row still draws a separate pin MARK as well as the control — the state is shown twice');
  } else ok();
  await hitTest(rowPin('sunk'), 'the row pin');

  await page.click('#grid .crow[data-chat="newest"]');
  await page.waitForSelector('#thread header .no .orgbtn', { timeout: 4000 });
  if (await page.$('#thread header .no .pinbtn')) {
    fail('the pin is still in the thread header — she asked for it on the main page instead');
  } else ok();

  // ── 9. ORGANIZE — one row of words, from inside the chat ─────────────────
  // It shipped as FOLDER (one) over TAGS (many) and the two became ONE field in
  // Aug 2026 at her ask ("let you be in multiple categories or tags at once"),
  // so the sheet is one row of chips now: several lit at once, each tap its own
  // add or remove, and None the way out of all of them.
  await page.click('#thread header .no .orgbtn');
  await page.waitForSelector('.askwrap .askbox .arctags', { timeout: 3000 })
    .catch(() => fail('the organize button opened nothing'));
  ok();
  const groups = await page.$$eval('.askwrap .orggrp', (ns) => ns.length);
  if (groups) fail('the sheet still splits into sections — there is one kind of chip now');
  else ok();
  const rows9 = await page.$$eval('.askwrap .arctags', (ns) => ns.length);
  if (rows9 !== 1) fail('the sheet should hold exactly one row of chips, saw ' + rows9);
  else ok();
  const chips = () => page.$$eval('.askwrap .arctags button',
    (ns) => ns.map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')));
  const words = await chips();
  if (!words.includes('Tech') || !words.includes('Stories')) {
    fail('the sheet does not offer her folders — ' + JSON.stringify(words));
  } else ok();
  // `Story` and not `Bug fix`: the four outcome words (built · failure · bug
  // fix · new feature) are offered in the ARCHIVE sheet only since Aug 2026 —
  // ARCHIVE_ONLY in chats.html — so Organize must NOT show them.
  if (!words.includes('Story')) {
    fail('the sheet does not offer the old tag words — ' + JSON.stringify(words));
  } else ok();
  if (words.includes('Bug fix') || words.includes('Built')) {
    fail('the sheet still offers the archive-only words — ' + JSON.stringify(words));
  } else ok();
  if (!words.includes('None*')) fail('an unlabelled chat did not arrive with None lit — ' + JSON.stringify(words));
  else ok();
  // Filing writes the SAME route the select bar uses, one chat at a time…
  const tap = async (label) => {
    await (await page.$('.askwrap .arctags button:text-is("' + label + '")')).click();
    await page.waitForTimeout(200);
  };
  await tap('Tech');
  const cat = posted.labels[0];
  if (!cat || JSON.stringify(cat.add) !== '["tech"]' || !Array.isArray(cat.chats) || cat.chats[0] !== 'newest') {
    fail('filing from the sheet did not POST /labels for this chat — ' + JSON.stringify(cat || null));
  } else ok();
  // …and the sheet repaints, so the word it now carries is the lit one and None
  // has gone out.
  const after = await chips();
  if (!after.includes('Tech*') || after.includes('None*')) {
    fail('the sheet did not light the word it just filed — ' + JSON.stringify(after));
  } else ok();
  // MANY AT ONCE — the whole point of the merge. A second word joins the first
  // rather than replacing it.
  await tap('Images');
  const both = await chips();
  if (!both.includes('Tech*') || !both.includes('Images*')) {
    fail('a second word did not join the first — ' + JSON.stringify(both));
  } else ok();
  if (JSON.stringify((posted.labels[1] || {}).add) !== '["images"]') {
    fail('the second tap was not its own add — ' + JSON.stringify(posted.labels));
  } else ok();
  // Tapping a lit word takes it back off — one control, both ways.
  // (Also what puts this chat back on the unfiled list for the rest of the
  // test: filing it really did take it off.)
  await tap('Tech');
  await tap('Images');
  const out = await chips();
  if (!out.includes('None*') || out.includes('Tech*') || out.includes('Images*')) {
    fail('tapping the lit words did not take the chat out of them — ' + JSON.stringify(out));
  } else ok();
  await page.click('.askwrap .askrow button.go');
  await page.waitForFunction(() => !document.querySelector('.askwrap'), null, { timeout: 2000 })
    .catch(() => fail('Done did not shut the organize sheet'));
  ok();

  // ── 7/8. the glyph, and only the head red ─────────────────────────────────
  await home();
  const shape = await page.$eval(rowPin('newest') + ' svg', (n) => ({
    head: !!n.querySelector('circle.pinhead'),
    spike: (n.querySelector('path') || {}).getAttribute ? n.querySelector('path').getAttribute('d') : '',
    paths: n.querySelectorAll('path').length,
  }));
  if (!shape.head) fail('the glyph has no round head');
  else ok();
  // A straight spike hanging off the head — one vertical line, not a teardrop
  // arc. An `A` command in there means the map pin came back.
  if (!/^M12 [\d.]+V[\d.]+$/.test(shape.spike || '')) {
    fail('the spike is not a straight vertical line (the map pin is back?) — ' + shape.spike);
  } else ok();
  const off = await page.$eval(rowPin('newest') + ' .pinhead', (n) => {
    const cs = getComputedStyle(n); return { fill: cs.fill, stroke: cs.stroke };
  });
  if (/none/.test(off.stroke)) {
    fail('the head is not stroked while unpinned — the button reads as a bare stick: ' + JSON.stringify(off));
  } else ok();
  if (!/none/.test(off.fill)) fail('the head is filled while unpinned: ' + off.fill);
  else ok();
  const lit = await page.$eval(rowPin('sunk'), (n) => ({
    fill: getComputedStyle(n.querySelector('.pinhead')).fill,
    headStroke: getComputedStyle(n.querySelector('.pinhead')).stroke,
    spike: getComputedStyle(n.querySelector('path')).stroke,
  }));
  if (!RED.test(lit.fill) || !RED.test(lit.headStroke)) {
    fail('the pinned head is not red: ' + JSON.stringify(lit));
  } else ok();
  if (RED.test(lit.spike)) {
    fail('the whole pin went red — she asked for just the top part: ' + JSON.stringify(lit));
  } else ok();

  // ── NO CIRCLE ON A LIST ROW, and the hide is a CROSSED EYE ────────────────
  // (Aug 2026, Sophie: "I don't want in a circle, can you take it out of the
  // circle, and also there's a hide button next to it, can you take that out of
  // the circle also and can you make it an eye that's crossed out".)
  const flat = await page.$eval('#grid .crow[data-chat="newest"]', (row) => {
    const read = (sel) => { const cs = getComputedStyle(row.querySelector(sel));
      return { bg: cs.backgroundColor, shadow: cs.boxShadow, radius: cs.borderRadius, w: cs.width }; };
    return { pin: read('.pinrow'), hide: read('.hidebtn'),
      hideSvg: row.querySelector('.hidebtn').innerHTML };
  });
  ['pin', 'hide'].forEach((k) => {
    const s = flat[k];
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(s.bg)) fail('the row ' + k + ' still has a plate behind it: ' + s.bg);
    else ok();
    if (s.shadow !== 'none') fail('the row ' + k + ' still has the circle shadow: ' + s.shadow);
    else ok();
    if (/50%/.test(s.radius)) fail('the row ' + k + ' is still a circle: ' + s.radius);
    else ok();
    // The plate went, the tap target did not.
    if (parseFloat(s.w) < 28) fail('the row ' + k + ' lost its tap target with its plate: ' + s.w);
    else ok();
  });
  // Lucide `eye-off` — the `m2 2 20 20` crossing stroke is the tell, and it is
  // there in BOTH states (her ask carried no "if it's hidden" condition, unlike
  // the thread header's).
  if (!/m2 2 20 20/.test(flat.hideSvg)) {
    fail('the row hide is not a crossed-out eye — ' + flat.hideSvg.slice(0, 120));
  } else ok();
  // The de-plating is written `.crow`-scoped so the TILE cover keeps its
  // plate — `.t-cover` sits on the chat's picture, which is the one case a
  // plate exists for. Not asserted here because the tile view is unreachable
  // (`view` is pinned to 'list'; renderTiles is kept code, not a screen).
  const tilePlate = await page.evaluate(() => {
    const el = document.createElement('div'); el.className = 't-cover';
    const b = document.createElement('button'); b.className = 'hidebtn';
    el.appendChild(b); document.body.appendChild(el);
    const bg = getComputedStyle(b).backgroundColor; el.remove(); return bg;
  });
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(tilePlate)) {
    fail('the de-plating leaked off the row onto `.t-cover`, which sits on a photo: ' + tilePlate);
  } else ok();

  // ── 4/5. tapping writes it, both ways, and MOVES the row ──────────────────
  await page.click(rowPin('middle'));
  await page.waitForTimeout(200);
  const afterPin = await order();
  if (afterPin[0] !== 'middle' && afterPin[1] !== 'middle') {
    fail('pinning did not move the row up — ' + JSON.stringify(afterPin));
  } else ok();
  if (!posted.pin.length || posted.pin[0].chat !== 'middle' || posted.pin[0].pinTop !== true) {
    fail('the row pin did not POST pinTop:true — ' + JSON.stringify(posted.pin[0] || null));
  } else ok();
  await page.click(rowPin('middle'));
  await page.waitForTimeout(200);
  if (await page.$(rowPin('middle') + '.on')) fail('tapping the lit pin did not unpin it');
  else ok();
  if (posted.pin.length !== 2 || posted.pin[1].pinTop !== false) {
    fail('unpinning did not POST pinTop:false — ' + JSON.stringify(posted.pin[1] || null));
  } else ok();

  // ── 6. a failed POST rolls it back ────────────────────────────────────────
  pinFails = true;
  await home();
  await page.click(rowPin('newest'));
  await page.waitForFunction(() => {
    const b = document.querySelector('#grid .crow[data-chat="newest"] .pinrow');
    return b && !b.classList.contains('on');
  }, null, { timeout: 3000 }).catch(() => fail('a failed save left the pin lit — it would lie about being pinned'));
  ok();
  pinFails = false;

  // ── 10. the select bar is at the TOP ──────────────────────────────────────
  await home();
  await page.click('#selbtn');
  await page.waitForSelector('#selbar', { timeout: 3000 });
  const bar = await page.$eval('#selbar', (n) => {
    const r = n.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, h: r.height,
      pill: getComputedStyle(document.querySelector('.float')).display,
      bodyPad: parseFloat(getComputedStyle(document.body).paddingTop) };
  });
  if (bar.top > 2) fail('the select bar is not pinned to the top — top=' + bar.top);
  else ok();
  if (bar.bottom > 400) fail('the select bar is still hanging at the bottom — bottom=' + bar.bottom);
  else ok();
  // The bar runs through the autoscroll pill's corner now, and the pill is
  // layer-promoted so iOS can paint it over the bar whatever the z-index says.
  if (bar.pill !== 'none') fail('the autoscroll pill is still up under the select bar — display=' + bar.pill);
  else ok();
  // Room held for it, measured off the real bar rather than guessed.
  if (Math.abs(bar.bodyPad - bar.h) > 2) {
    fail('the page does not hold exactly the bar height (' + bar.h + ') — padding-top=' + bar.bodyPad);
  } else ok();
  // …and the first chat really is reachable under it.
  const firstRowTop = await page.$eval('#grid .crow', (n) => n.getBoundingClientRect().top);
  if (firstRowTop < bar.bottom) fail('the first chat row is buried under the select bar');
  else ok();
  // The row's own pin and ⊖ step aside while picking — one control per row.
  if (await page.$('#grid .crow .pinrow:not([hidden])')) {
    const vis = await page.$eval('#grid .crow .pinrow', (n) => getComputedStyle(n).display);
    if (vis !== 'none') fail('the row pin is still up in select mode: ' + vis); else ok();
  } else ok();
  await page.click('#selbar .catchip:text-is("Done")');
  await page.waitForFunction(() => !document.getElementById('selbar'), null, { timeout: 2000 });
  const cleared = await page.evaluate(() => getComputedStyle(document.body).paddingTop);
  if (parseFloat(cleared) > 2) fail('leaving select mode left the top padding behind — ' + cleared);
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.error('\n' + checks + ' checks passed, some FAILED');
  else console.log('OK — ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });

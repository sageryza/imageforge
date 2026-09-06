#!/usr/bin/env node
// CHAPTER BUTTONS ON THE NAME LINE (2026-09-06, Sophie, on the hospital chat:
// "there's two distinct chapters, can u add two buttons at the top same line as
// the name, one per chapter").
//
// Drives the REAL public/chats.html against a stub API and asserts, every one a
// MEASUREMENT (a button drawn on the wrong line, or one whose tap moves the
// page to the wrong place, passes every markup assertion ever written):
//   1. a chat with chapters draws one `.chapbtn` per chapter, oldest first,
//      wearing the chapter's own title; a chat with none draws NO strip,
//   2. they sit ON THE NAME LINE — vertical centre within 3px of the h1's —
//      left of the rename pencil and clear of the pill's fixed column, and the
//      name keeps real width beside them (it ellipsizes, it is not crushed),
//   3. a tap — asked with elementFromPoint at the button's own centre, since a
//      covered button passes every width assertion — scrolls the window so
//      that chapter's hairline heading lands at the top of the screen, and the
//      heading it landed on is the right chapter's (its `data-chap` stamp),
//   4. the newest chapter's button brings her back to the top,
//   5. a chapter whose heading the feed's window never reached is fetched: the
//      stub's feed carries only the newest chapter, the thread route the whole
//      history, and the tap still lands on the old chapter's heading.
//
//   npm install playwright-core --no-save && node scripts/test-chats-chapter-buttons.js
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
const LONG = 'A long paragraph so the thread is taller than the screen. '.repeat(6);

// Two chapters: FILM (the older, messages 1-8) and MEMORIES (the newer, 9-20).
// Alternating her/claude so the dribble merge (a run of replies is one row)
// cannot fold the thread short of a scroll.
const ALL = [];
for (let i = 1; i <= 20; i++) {
  ALL.push({ id: 'h' + i, chat: 'hosp', from: i % 2 ? 'sophie' : 'claude',
    text: (i % 2 ? 'her message ' : 'the reply ') + i + '. ' + LONG, tldr: i % 2 ? '' : 'reply ' + i,
    created: iso(T0 - (40 - i) * HOUR), postedAt: iso(T0 - (40 - i) * HOUR) });
}
const CHAPTERS = [
  { title: 'The hospital film', at: ALL[0].created },
  { title: 'Little memories', at: ALL[8].created },
];
const PLAIN = [{ id: 'p1', chat: 'plain', from: 'claude', text: 'nothing here', tldr: 'plain',
  created: iso(T0 - HOUR), postedAt: iso(T0 - HOUR) }];
// A LONG chat name beside the same two buttons: the name ellipsizes (as it
// always has) and the buttons stay whole — the name is known, the buttons are
// what she has to read.
const LONGN = [
  { id: 'l1', chat: 'longname', from: 'sophie', text: 'first', created: iso(T0 - 5 * HOUR), postedAt: iso(T0 - 5 * HOUR) },
  { id: 'l2', chat: 'longname', from: 'claude', text: 'second', tldr: 'second', created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
];

// `feedOnlyNewest` is case 5: the feed window stops at chapter 2 and the thread
// route holds the rest.
let feedOnlyNewest = false;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const msgs = (feedOnlyNewest ? ALL.slice(8) : ALL).concat(PLAIN, LONGN);
    return res.end(JSON.stringify({ build: 'test', truncated: feedOnlyNewest ? ['hosp'] : [], messages: msgs, delta: false,
      settings: {},
      chats: {
        hosp: { lastSeen: ALL[19].created, displayName: 'hospital', chapters: CHAPTERS },
        plain: { lastSeen: PLAIN[0].created },
        longname: { lastSeen: LONGN[1].created, displayName: 'A very long chat name that runs on and on past the row',
          chapters: [{ title: 'Film', at: LONGN[0].created }, { title: 'Memories', at: LONGN[1].created }] },
      } }));
  }
  if (url.pathname === '/api/chatfeed/thread') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages: ALL }));
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const row = (c) => '#grid .crow[data-chat="' + c + '"]';
  const rect = (sel) => page.$eval(sel, (n) => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const tapAt = async (sel, what) => {
    const r = await rect(sel);
    const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.chapbtn') ? 'chapbtn' : (e.id || e.className || e.tagName)) : 'nothing'; }, [r.cx, r.cy]);
    if (hit !== 'chapbtn') { fail(what + ': the tap at its centre reaches ' + hit + ', not the button'); return false; }
    ok();
    await page.mouse.click(r.cx, r.cy);
    return true;
  };

  await page.goto(base + '/chats');
  await page.waitForSelector(row('hosp'));

  // ── 1. who draws them ──────────────────────────────────────────────────────
  await page.click(row('plain'));
  await page.waitForSelector('#thread .thread-head h1');
  if (await page.$('#thread .chapbtns')) fail('a chat with no chapters drew the strip');
  else ok();
  await page.goto(base + '/chats');
  await page.waitForSelector(row('hosp'));
  await page.click(row('hosp'));
  await page.waitForSelector('#thread .thread-head .chapbtns');
  await page.waitForSelector('#thread .chapdiv[data-chap="0"]');
  const titles = await page.$$eval('#thread .thread-head .chapbtn', (ns) => ns.map((n) => n.textContent.trim()));
  if (titles.join('|') !== 'The hospital film|Little memories') fail('buttons are ' + JSON.stringify(titles) + ' — want one per chapter, oldest first');
  else ok();

  // ── 2. the line they sit on ────────────────────────────────────────────────
  const h1 = await rect('#thread .thread-head h1');
  const b0 = await rect('#thread .chapbtn[data-chap="0"]');
  const b1 = await rect('#thread .chapbtn[data-chap="1"]');
  const pen = await rect('#thread .thread-head .renamebtn');
  const th = await rect('#thread .thread-head');
  if (Math.abs(b0.cy - h1.cy) > 3 || Math.abs(b1.cy - h1.cy) > 3) fail('the buttons are not on the name line: h1 centre ' + h1.cy + ', buttons ' + b0.cy + '/' + b1.cy);
  else ok();
  if (b0.x < h1.x + h1.w - 1 || b1.x < b0.x + b0.w - 1) fail('the buttons are not in order to the right of the name');
  else ok();
  // BOTH buttons are inside the strip's box — a strip that scrolls hides the
  // second one entirely, which is what the first cut did with two long titles.
  const strip = await rect('#thread .thread-head .chapbtns');
  if (b1.x + b1.w > strip.x + strip.w + 1) fail('the second button is past the strip’s clip (' + (b1.x + b1.w) + ' vs ' + (strip.x + strip.w) + ') — she cannot see it');
  else ok();
  if (b1.x + b1.w > pen.x + 1) fail('the strip runs under the rename pencil');
  else ok();
  // the pill's fixed column is the last 56px of the row's box
  if (b1.x + b1.w > th.x + th.w - 56 + 1) fail('the strip reaches into the pill’s column: right edge ' + (b1.x + b1.w) + ' vs ' + (th.x + th.w - 56));
  else ok();
  if (h1.w < 60) fail('the name is crushed to ' + h1.w + 'px beside the buttons');
  else ok();
  const h1cut = await page.$eval('#thread .thread-head h1', (n) => n.scrollWidth > Math.ceil(n.getBoundingClientRect().width) + 1);
  if (h1cut) fail('the short name "hospital" is ellipsized beside the buttons — it has to stand whole when the row has room');
  else ok();
  if (b0.w < 40 || b1.w < 40) fail('a button is too narrow to read: ' + b0.w + '/' + b1.w);
  else ok();
  const font = await page.$eval('#thread .chapbtn', (n) => { const c = getComputedStyle(n); return { tt: c.textTransform, fw: c.fontWeight, br: c.borderRadius }; });
  if (font.tt !== 'uppercase' || !/^(400|normal)$/.test(font.fw)) fail('the button is not in the heading’s voice: ' + JSON.stringify(font));
  else ok();
  if (font.br !== '6px') fail('the button is not the house rounded square: radius ' + font.br);
  else ok();

  // ── 3. the tap lands on the heading ────────────────────────────────────────
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  if (total < 1400) fail('fixture too short to scroll (' + total + 'px) — the test cannot see a jump');
  else ok();
  const before = await page.evaluate(() => window.scrollY);
  const headBefore = await rect('#thread .chapdiv[data-chap="0"]');
  if (headBefore.y < 844) fail('chapter 1’s heading is already on screen (' + headBefore.y + ') — the jump is unmeasurable');
  else ok();
  if (await tapAt('#thread .chapbtn[data-chap="0"]', 'chapter 1 button')) {
    await sleep(150);
    const after = await page.evaluate(() => window.scrollY);
    const head = await rect('#thread .chapdiv[data-chap="0"]');
    if (after <= before) fail('the tap did not move the page (scrollY ' + before + ' → ' + after + ')');
    else ok();
    if (head.y < -2 || head.y > 40) fail('the heading did not land at the top: it is at y=' + head.y);
    else ok();
    const stamp = await page.$eval('#thread .chapdiv[data-chap="0"] span', (n) => n.textContent);
    if (stamp !== 'The hospital film') fail('landed under the wrong heading: ' + stamp);
    else ok();
    // the heading it aimed at really owns the message right under it
    const under = await page.evaluate(() => { const h = document.querySelector('#thread .chapdiv[data-chap="0"]'); const m = h && h.nextElementSibling; return m && (m.dataset.mid || ''); });
    if (under !== 'h8') fail('the heading is not over the newest FILM message: ' + under);
    else ok();
  }

  // ── 4. the newest chapter's button ─────────────────────────────────────────
  // The row is NOT sticky (her ask was "at the top", the way the name is), so
  // after the jump above the buttons have scrolled off with the header and the
  // pill's back-to-top is the way back to them. From the top, the newest
  // chapter's button puts its heading — right under the header — at the top.
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(50);
  if (await tapAt('#thread .chapbtn[data-chap="1"]', 'chapter 2 button')) {
    await sleep(150);
    const head1 = await rect('#thread .chapdiv[data-chap="1"]');
    if (head1.y < -2 || head1.y > 40) fail('chapter 2’s heading did not land at the top: y=' + head1.y);
    else ok();
    // and every button is still on screen after the jump (the header scrolled with the page — no sticky here)
  }

  // ── 4b. a long name gives way; the buttons do not ──────────────────────────
  await page.goto(base + '/chats');
  await page.waitForSelector(row('longname'));
  await page.click(row('longname'));
  await page.waitForSelector('#thread .thread-head .chapbtns');
  const ln = await page.$$eval('#thread .chapbtn', (ns) => ns.map((n) => ({ w: n.getBoundingClientRect().width, cut: n.scrollWidth > Math.ceil(n.getBoundingClientRect().width) + 1, t: n.textContent })));
  if (ln.length !== 2 || ln.some((b) => b.cut)) fail('beside a long name a short button is ellipsized: ' + JSON.stringify(ln));
  else ok();
  const lh = await page.$eval('#thread .thread-head h1', (n) => ({ w: n.getBoundingClientRect().width, cut: n.scrollWidth > Math.ceil(n.getBoundingClientRect().width) + 1 }));
  if (!lh.cut || lh.w < 60) fail('the long name did not ellipsize beside the buttons the way it always has: ' + JSON.stringify(lh));
  else ok();
  const lrow = await rect('#thread .thread-head');
  const lpen = await rect('#thread .thread-head .renamebtn');
  if (lpen.x + lpen.w > lrow.x + lrow.w - 56 + 1) fail('with a long name the pencil ran into the pill’s column');
  else ok();

  // ── 5. a chapter the feed's window never reached ───────────────────────────
  feedOnlyNewest = true;
  await page.goto(base + '/chats');
  await page.waitForSelector(row('hosp'));
  await page.click(row('hosp'));
  await page.waitForSelector('#thread .thread-head .chapbtns');
  // the strip is drawn from the REGISTRY, so both buttons exist before the history lands
  const n = await page.$$eval('#thread .chapbtn', (ns) => ns.length);
  if (n !== 2) fail('the strip is drawn from the loaded messages, not the registry: ' + n + ' buttons');
  else ok();
  await tapAt('#thread .chapbtn[data-chap="0"]', 'chapter 1 (unloaded)');
  // the full thread lands (this tap's own fetch, and/or ensureFullThread's)
  await page.waitForSelector('#thread .msg[data-mid="h1"]', { timeout: 5000 }).catch(() => fail('the older chapter never loaded'));
  await sleep(400);
  const hOld = await rect('#thread .chapdiv[data-chap="0"]').catch(() => null);
  if (!hOld) fail('the old chapter has no heading after the fetch');
  else if (hOld.y < -2 || hOld.y > 40) fail('after fetching, the old chapter’s heading did not land at the top: y=' + hOld.y);
  else ok();

  await browser.close();
  server.close();
  console.log((process.exitCode ? 'FAILED' : 'ok') + ' — ' + checks + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });

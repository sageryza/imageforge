#!/usr/bin/env node
// THE BELL AND THE TWO PICTURE BUTTONS in a chat's header (Aug 2026, Sophie:
// "add a little bell next to the star that I can click in. This will enable
// notifications for this chat and un-click and it will turn them off — only
// the ones I clicked the bell on will notify me. Also, can you make the delete
// button a picture of a trash can and the hide button a picture of an eye
// that's crossed out if it's hidden").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the bell sits beside the star, and is OFF on a chat she has never belled,
//   2. it lights on a chat carrying `notify:true` from the registry,
//   3. tapping it POSTs /api/chatfeed/notify with the flipped value and lights,
//   4. tapping again turns it back off (and POSTs `notify:false`),
//   5. a failed POST rolls the light back — nothing lies about being on,
//   6. HIDE is an eye, OPEN on a live chat and CROSSED on a hidden one,
//   7. DELETE is a trash can, and neither word is left in the row,
//   8. every one of them is tappable where it is drawn (the autoscroll pill
//      owns the top-right corner and has buried real controls before).
//
// …and the second pass (Aug 2026, Sophie: "change the bell colour to yellow
// and make it filled in rather than just the outline, and make the trash not
// red until I click it and the hidden icon should also not be red until I
// click it"):
//   9. the bell is FILLED, not stroked, in both states,
//  10. it is GOLD when on and grey when off — never the ⊖'s red,
//  11. neither the eye nor the can is red at rest,
//  12. the eye goes red only WITH its crossing stroke (i.e. really hidden).
//
//   npm install playwright-core --no-save && node scripts/test-chats-bell.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const MSGS = [
  { id: 'm1', chat: 'no-bell', from: 'claude', text: 'quiet chat', tldr: 'quiet', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'belled', from: 'claude', text: 'loud chat', tldr: 'loud', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'parked', from: 'claude', text: 'in the hidden pile', tldr: 'parked', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
];
// What the page POSTed, in order, so the test can assert the wire and not just
// the paint.
const posted = [];
let notifyFails = false;

const server = http.createServer((req, res) => {
  // THE SHARED FILES chats.html LINKS, served the way express.static serves
  // them (scripts/lib/public-asset.js). This harness used to fall through to
  // its catch-all for every one of them, which is the quiet failure that file
  // exists to end: the page guards the global it could not load, so the harness
  // renders a page missing that behaviour and passes — or, when the catch-all's
  // body is not valid JS, throws a page error nobody asked about.
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: {
        'no-bell': { lastSeen: MSGS[0].created },
        // Belled, and hidden LONG ago so it still reads as live (hiddenAt older
        // than its newest message is how the page decides it came back).
        belled: { lastSeen: MSGS[1].created, notify: true },
        parked: { lastSeen: MSGS[2].created, hiddenAt: iso(T0) },
      } }));
  }
  if (url.pathname === '/api/chatfeed/notify' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      posted.push(JSON.parse(body || '{}'));
      res.writeHead(notifyFails ? 500 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(notifyFails ? { error: 'nope' } : { ok: true }));
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

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const open = async (chat) => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="' + chat + '"]');
    await page.click('#grid .crow[data-chat="' + chat + '"]');
    // THE MARKS LIVE IN THE ORGANIZE SHEET NOW (Aug 2026, Sophie: "take them
    // out of the main thing and put them in little boxes like the … category
    // tag things"), so every one of these checks opens it first.
    await page.waitForSelector('#thread header .no .orgbtn', { timeout: 4000 });
    await page.click('#thread header .no .orgbtn');
    await page.waitForSelector('.askwrap .orgmarks .starbtn', { timeout: 4000 });
  };
  // Tappable where drawn, or something is sitting on top of it.
  const hitTest = async (sel, what) => {
    const box = await page.$eval(sel, (n) => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const hit = await page.evaluate(({ x, y, s }) => {
      const e = document.elementFromPoint(x, y);
      return e && e.closest(s) ? 'ok' : (e ? (e.className || e.tagName) : 'none');
    }, { ...box, s: sel });
    if (hit !== 'ok') fail(what + ' is buried under ' + hit); else ok();
  };

  // ── 1. off by default, and next to the star ───────────────────────────────
  await open('no-bell');
  if (!await page.$('.askwrap .orgmarks .bellbtn')) fail('no bell in the Organize sheet');
  else ok();
  const order = await page.$$eval('.askwrap .orgmarks > *', (ns) => ns.map((n) => n.className));
  const iStar = order.findIndex((c) => /starbtn/.test(c));
  const iBell = order.findIndex((c) => /bellbtn/.test(c));
  if (iStar < 0 || iBell !== iStar + 1) fail('the bell is not beside the star: ' + JSON.stringify(order));
  else ok();
  if (await page.$('.askwrap .orgmarks .bellbtn.on')) fail('an unbelled chat drew a lit bell');
  else ok();

  // ── 6/7. the two picture buttons, and no words left behind ────────────────
  if (!await page.$('.askwrap .orgmarks .eyebtn svg')) fail('HIDE is not a picture');
  else ok();
  if (!await page.$('.askwrap .orgmarks .trashbtn.delbtn svg')) fail('DELETE is not a picture');
  else ok();
  // …and the thread header is DOWN TO ARCHIVE AND THE TAG ICON — the five
  // marks left it (Aug 2026, her ask). Archive is deliberately still a word.
  const words = await page.$eval('#thread header .no', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  if (!/archive/i.test(words)) fail('the Archive word went missing: ' + words);
  else ok();
  // …EXCEPT THE BELL, which came back to this row on 2026-08-25 ("add the bell
  // icon back to the main chat screen instead of just in the tag organizer
  // area, put it in both places … right next to the picture of the tag"). It
  // is in BOTH now, so it is no longer on the gone list — see step 13 below.
  for (const gone of ['.eyebtn', '.trashbtn', '.starbtn', '.bmk.chatbmk']) {
    if (await page.$('#thread header .no ' + gone)) fail('the header still carries ' + gone);
    else ok();
  }
  // A live chat's eye is OPEN: the crossing stroke (m2 2 20 20) is the tell.
  const liveEye = await page.$eval('.askwrap .orgmarks .eyebtn', (n) => n.innerHTML);
  if (/m2 2 20 20/.test(liveEye)) fail('a live chat drew the CROSSED eye');
  else ok();

  await hitTest('.askwrap .orgmarks .bellbtn', 'the bell');
  await hitTest('.askwrap .orgmarks .eyebtn', 'the eye');
  await hitTest('.askwrap .orgmarks .trashbtn.delbtn', 'the trash can');

  // ── 9/11. filled bell, and nothing red sitting at rest ────────────────────
  // Read the PAINTED values, not the markup: a stray `.bmk`-style rule landing
  // on one of these is exactly the failure worth catching, and it only shows
  // up in the computed style.
  const paint = (sel) => page.$eval(sel + ' svg', (n) => {
    const cs = getComputedStyle(n);
    return { fill: cs.fill, stroke: cs.stroke, color: getComputedStyle(n.parentElement).color };
  });
  const bellOff = await paint('.askwrap .orgmarks .bellbtn');
  if (/none/.test(bellOff.fill)) fail('the bell is not filled: ' + JSON.stringify(bellOff));
  else ok();
  const RED = /rgb\(179,\s*68,\s*63\)/;
  const rest = {
    eye: await paint('.askwrap .orgmarks .eyebtn'),
    can: await paint('.askwrap .orgmarks .trashbtn.delbtn'),
  };
  if (RED.test(rest.eye.color)) fail('the eye is red at rest');
  else ok();
  if (RED.test(rest.can.color)) fail('the trash can is red at rest');
  else ok();

  // ── 3/4. tapping writes it, both ways ─────────────────────────────────────
  await page.click('.askwrap .orgmarks .bellbtn');
  await page.waitForSelector('.askwrap .orgmarks .bellbtn.on', { timeout: 2000 })
    .catch(() => fail('tapping the bell did not light it'));
  ok();
  if (!posted.length || posted[0].chat !== 'no-bell' || posted[0].notify !== true) {
    fail('the bell did not POST notify:true — ' + JSON.stringify(posted[0] || null));
  } else ok();
  await page.click('.askwrap .orgmarks .bellbtn');
  await page.waitForFunction(() => !document.querySelector('.askwrap .orgmarks .bellbtn.on'), null, { timeout: 2000 })
    .catch(() => fail('tapping the lit bell did not turn it off'));
  ok();
  if (posted.length !== 2 || posted[1].notify !== false) {
    fail('turning it off did not POST notify:false — ' + JSON.stringify(posted[1] || null));
  } else ok();

  // ── 2/10. a belled chat arrives lit, and lit means GOLD ───────────────────
  await open('belled');
  if (!await page.$('.askwrap .orgmarks .bellbtn.on')) fail('a chat carrying notify:true drew an unlit bell');
  else ok();
  const lit = await page.$eval('.askwrap .orgmarks .bellbtn', (n) => getComputedStyle(n).color);
  if (RED.test(lit)) fail('the lit bell is the ⊖ red, not gold: ' + lit);
  else ok();
  // Gold, not merely "not red": more red than blue and a real green channel is
  // what separates a yellow from this page's rose, red and ink.
  const rgb = (lit.match(/\d+/g) || []).map(Number);
  if (!(rgb.length >= 3 && rgb[0] > rgb[2] + 60 && rgb[1] > rgb[2] + 30 && rgb[1] > 90)) {
    fail('the lit bell does not read as a yellow: ' + lit);
  } else ok();

  // ── 5. a failed POST rolls the light back ─────────────────────────────────
  notifyFails = true;
  await open('no-bell');
  await page.click('.askwrap .orgmarks .bellbtn');
  await page.waitForFunction(() => !document.querySelector('.askwrap .orgmarks .bellbtn.on'), null, { timeout: 3000 })
    .catch(() => fail('a failed save left the bell lit — it would lie about being on'));
  ok();
  notifyFails = false;

  // ── 6b. the hidden pile's chat draws the CROSSED eye ──────────────────────
  // A hidden chat is not on the live list, so go in the way she does: tap the
  // red HIDDEN bar to open the pile, then its row.
  await page.goto(base + '/chats');
  await page.waitForSelector('.hidebar', { timeout: 4000 }).catch(() => fail('no hidden bar to open the pile with'));
  await page.click('.hidebar');
  await page.waitForSelector('#grid .crow[data-chat="parked"]', { timeout: 4000 })
    .catch(() => fail('the hidden pile never showed its chat'));
  await page.click('#grid .crow[data-chat="parked"]');
  await page.waitForSelector('#thread header .no .orgbtn', { timeout: 4000 });
  await page.click('#thread header .no .orgbtn');
  await page.waitForSelector('.askwrap .orgmarks .eyebtn', { timeout: 4000 });
  const eye = await page.$eval('.askwrap .orgmarks .eyebtn', (n) => n.innerHTML);
  if (!/m2 2 20 20/.test(eye)) fail('a hidden chat did not draw the crossed eye');
  else ok();
  // 12. …and THAT is the one state the eye is allowed to be red in.
  const hiddenEyeColor = await page.$eval('.askwrap .orgmarks .eyebtn', (n) => getComputedStyle(n).color);
  if (!RED.test(hiddenEyeColor)) fail('a hidden chat\'s crossed eye is not red: ' + hiddenEyeColor);
  else ok();

  // ── 13. THE BELL IS IN BOTH PLACES (2026-08-25, Sophie: "add the bell icon
  // back to the main chat screen instead of just in the tag organizer area,
  // put it in both places it doesn't need the box around it. It should go
  // right next to the picture of the tag"). Whether a chat may buzz her is a
  // thing she flips while READING it, so it is no longer two taps behind a
  // sheet — and the sheet keeps its copy, so the two have to agree. ─────────
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow[data-chat="no-bell"]');
  await page.click('#grid .crow[data-chat="no-bell"]');
  await page.waitForSelector('#thread header .no .bellbtn', { timeout: 4000 })
    .catch(() => fail('the bell never came back to the thread header'));
  ok();
  // Right next to the tag: the two are adjacent, and the tag stays last.
  const hrow = await page.$$eval('#thread header .no > *', (ns) => ns.map((n) => n.className));
  const hBell = hrow.findIndex((c) => /bellbtn/.test(c));
  const hTag = hrow.findIndex((c) => /orgbtn/.test(c));
  if (hBell < 0 || hTag !== hBell + 1) fail('the header bell is not beside the tag icon: ' + JSON.stringify(hrow));
  else ok();
  // NO BOX, her ask — this is the bare-glyph style, not the sheet's chip.
  const boxed = await page.$eval('#thread header .no .bellbtn', (n) => {
    const c = getComputedStyle(n);
    return { bw: c.borderTopWidth, bs: c.borderTopStyle, bg: c.backgroundColor, color: c.color };
  });
  if (boxed.bs !== 'none' && parseFloat(boxed.bw) > 0) fail('the header bell drew a box: ' + boxed.bw + ' ' + boxed.bs);
  else ok();
  if (!/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(boxed.bg)) fail('the header bell drew a filled plate: ' + boxed.bg);
  else ok();
  if (await page.$('#thread header .no .bellbtn.on')) fail('an unbelled chat drew a lit header bell');
  else ok();
  await hitTest('#thread header .no .bellbtn', 'the header bell');
  // Tapping it lights and POSTs.
  const before = posted.length;
  await page.click('#thread header .no .bellbtn');
  await page.waitForSelector('#thread header .no .bellbtn.on', { timeout: 2000 })
    .catch(() => fail('the header bell did not light on the tap'));
  ok();
  await page.waitForTimeout(200);
  const last = posted[posted.length - 1];
  if (posted.length <= before || !last || last.chat !== 'no-bell' || last.notify !== true) {
    fail('the header bell did not POST notify:true — ' + JSON.stringify(last));
  } else ok();
  // …and the SHEET's copy agrees, in both directions: it opens lit, and
  // tapping it there repaints the one she is standing on.
  await page.click('#thread header .no .orgbtn');
  await page.waitForSelector('.askwrap .orgmarks .bellbtn', { timeout: 4000 });
  if (!await page.$('.askwrap .orgmarks .bellbtn.on')) fail('the sheet\'s bell did not pick up the header tap');
  else ok();
  await page.click('.askwrap .orgmarks .bellbtn');
  await page.waitForTimeout(250);
  if (await page.$('#thread header .no .bellbtn.on')) fail('the sheet\'s bell left the header bell lit — the two disagree');
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.error(`\n${checks} checks passed before the failure(s) above`);
  else console.log(`chats bell + picture buttons: ${checks} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });

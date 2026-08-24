#!/usr/bin/env node
// The down arrow lands on the END OF THE OPEN MESSAGE (Aug 2026, Sophie: "a
// floating down button that gets me just to the bottom of the current message
// that's open and visible on the screen — there's already a down button, so
// you could co-opt it and make it work only when there's an open message
// visible").
// Drives the REAL public/chats.html headless against a stub feed and asserts:
//   1. with a long message OPEN, one tap lands on that message's end — not
//      the page bottom, which is screens further down,
//   2. it lands INSIDE the message's end, not past it (its last line is on
//      screen when the jump finishes),
//   3. a SECOND tap then carries on to the page bottom, so the takeover never
//      strands her half way down a thread,
//   4. with the message COLLAPSED again the arrow is the page-bottom jump it
//      has always been — the takeover is "only when there's an open message",
//   5. the arrow still shows while the message has a screen to go even when
//      the page bottom is close, and
//   6. it still stops the autoscroll first (the whole point of the pair).
//
//   npm install playwright-core --no-save && node scripts/test-chats-jump-message.js
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

// One very long reply with plenty of short ones BELOW it, so "the end of this
// message" and "the end of the page" are far apart and can't be confused.
// The thread renders NEWEST FIRST, so the long one has to be the newest to sit
// at the top — dating it oldest put it at the bottom, where its end and the
// page's end are the same place and the test proved nothing.
const LONG = Array.from({ length: 60 }, (_, i) => 'Paragraph ' + (i + 1) + ' of a long reply that runs for several screens.').join('\n\n');
// the url is what gives a message its Open-in-Claude button — the very thing
// the floating arrows must not land on
const MSGS = [{ id: 'long', chat: 'reader', from: 'claude', text: LONG, tldr: 'a long one', url: 'https://claude.ai/code/session_test', created: iso(T0), postedAt: iso(T0) }];
for (let i = 0; i < 30; i++) {
  MSGS.push({ id: 'tail' + i, chat: 'reader', from: 'claude', text: 'Short follow-up ' + i, tldr: 'short ' + i, created: iso(T0 - 60000 - i * 1000), postedAt: iso(T0 - 60000 - i * 1000) });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: { reader: { account: '1', lastSeen: MSGS[MSGS.length - 1].created } },
      settings: { appAccount: '1' }, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
// wait for the smooth scroll to land rather than guessing a delay
const settle = (page) => page.evaluate(async () => {
  let last = -1, same = 0;
  for (let i = 0; i < 40 && same < 3; i++) {
    await new Promise((r) => setTimeout(r, 80));
    if (window.scrollY === last) same++; else { same = 0; last = window.scrollY; }
  }
  return window.scrollY;
});
const shown = (page, id) => page.evaluate((i) => document.getElementById(i).classList.contains('show'), id);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow[data-chat="reader"]');
  await page.click('#grid .crow[data-chat="reader"]');
  await page.waitForSelector('#thread .msg', { timeout: 4000 });

  // open the long message (tapping its preview is how she opens one)
  await page.evaluate(() => {
    const row = document.querySelector('#thread .msg[data-mid="long"]');
    row.querySelector('.m-preview').click();
  });
  await page.waitForFunction(() => document.querySelector('#thread .msg[data-mid="long"]').classList.contains('open'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);

  const geom = await page.evaluate(() => {
    const r = document.querySelector('#thread .msg[data-mid="long"]').getBoundingClientRect();
    return {
      msgEnd: Math.round(window.scrollY + r.bottom),
      pageEnd: Math.round(document.documentElement.scrollHeight - window.innerHeight),
      vh: window.innerHeight,
      // the page reserves whatever the floating pair is occupying, so the
      // expected landing is measured, not a magic number. It reserves room
      // for BOTH arrows even though only the down one shows from the top:
      // the jump brings the up arrow out and the column grows upward (a copy
      // of `bottomReserve` in chats.html — if one moves, so must the other)
      reserve: (function(){
        const j = document.querySelector('.jumps');
        if (!j) return 14;
        const btn = j.querySelector('.totop.show');
        if (!btn) return 14;
        const jr = j.getBoundingClientRect(), br = btn.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(j).rowGap) || 0;
        return Math.max(14, Math.round(window.innerHeight - jr.bottom + br.height * 2 + gap + 10));
      })(),
    };
  });
  if (geom.pageEnd - geom.msgEnd < 600) {
    fail('fixture too small: the message end and the page end are not far enough apart to tell them apart');
  }

  // 5. the arrow is offering something
  if (!(await shown(page, 'tobot'))) fail('the down arrow is missing with a long open message below');

  // 6. it stops the autoscroll first — start it for real, or this proves nothing
  await page.evaluate(() => window.__scrollStart(1));
  const moved = await page.evaluate(async () => {
    const a = window.scrollY;
    await new Promise((r) => setTimeout(r, 400));
    return window.scrollY - a;
  });
  if (moved <= 2) fail('the autoscroll never started, so the stop is untested');

  // 1 + 2. one tap lands on the END OF THE MESSAGE, with its last line on screen
  await page.click('#tobot');
  const y1 = await settle(page);
  const at = await page.evaluate(() => {
    const r = document.querySelector('#thread .msg[data-mid="long"]').getBoundingClientRect();
    return { bottom: Math.round(r.bottom), vh: window.innerHeight };
  });
  if (Math.abs(y1 - (geom.msgEnd - geom.vh + geom.reserve)) > 6) {
    fail('the jump did not land on the message end: y=' + y1 + ', wanted ~' + (geom.msgEnd - geom.vh + geom.reserve));
  }
  if (at.bottom > at.vh) fail('the message end is still below the fold after the jump');
  if (y1 > geom.pageEnd - 400) fail('the jump went to the page bottom, not the message end: ' + y1);

  // 2b. THE ARROWS MUST NOT LAND ON THE OPEN-IN-CLAUDE BUTTON. A message's
  //     last row is bookmark + Open, so a flush landing parks the floating
  //     pair exactly on top of it (Sophie caught this the first time she
  //     used the jump). Hit-test the button's own centre.
  const covered = await page.evaluate(() => {
    const btn = document.querySelector('#thread .msg[data-mid="long"] .openrow .openclaude');
    if (!btn) return 'no Open button on the message';
    const r = btn.getBoundingClientRect();
    if (r.bottom > window.innerHeight) return 'the Open button is below the fold after the jump';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return 'nothing at the Open button';
    if (hit.closest('.jumps')) return 'the jump arrows are sitting on the Open button';
    return hit.closest('.openclaude') ? '' : 'something else covers the Open button';
  });
  if (covered) fail(covered);

  // 3. a SECOND tap carries on to the page bottom
  await page.click('#tobot');
  const y2 = await settle(page);
  if (geom.pageEnd - y2 > 4) fail('the second tap did not reach the page bottom: ' + y2 + ' of ' + geom.pageEnd);

  // 4. with nothing open, the arrow is the plain page-bottom jump again
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const row = document.querySelector('#thread .msg[data-mid="long"]');
    row.classList.remove('open');
  });
  await page.waitForTimeout(120);
  await page.click('#tobot');
  const y3 = await settle(page);
  const pageEnd2 = await page.evaluate(() => Math.round(document.documentElement.scrollHeight - window.innerHeight));
  if (pageEnd2 - y3 > 4) fail('with nothing open the arrow did not go to the page bottom: ' + y3 + ' of ' + pageEnd2);

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the down arrow lands on the end of the open message, then the page');
})().catch((e) => { console.error(e); process.exit(1); });

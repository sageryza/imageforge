#!/usr/bin/env node
// A LIT TAG SHOWS EVERYTHING WEARING IT (2026-08-31, Sophie: "things get hidden
// in chats in multiple ways" · "come back to shud show allll not just ones not
// on another list" · "any tag shud show all").
//
// A chip used to NARROW whichever list she was standing on, so every filter that
// list already applied went on applying — and they stack. Measured against her
// live feed the morning she asked: `come back to` is on 34 chats and the lit
// chip rendered ONE row. The four filters that ate the other 33 are one
// assertion each below, and every one of them is a chat she filed under the
// word herself:
//
//   • the HIDDEN pile (23 of the 28 live ones),
//   • the ACCOUNT tabs (the survivors were 10/9/8 across accounts 1/2/3, so no
//     single tab could ever show her the pile),
//   • the BUG-FIX carve-out on ALL, which drops a chat wearing both words,
//   • the seven-day MORE fold.
//
// THE ARCHIVE IS THE ONE THAT STAYS OUT, and that is her rule (2026-08-28:
// "archive doesn't pop out ur insane that's the point of archive") — so it gets
// two assertions: the archived chat must NOT be in the list, and the footnote
// must say it is there, because silently dropping it is the whole complaint.
//
// EVERY ASSERTION IS A MEASUREMENT OF THE REAL PAGE. A source assertion cannot
// tell a chat folded behind "More" from one that is not rendered at all, and
// cannot see the account filter at all.
//
// Run: node scripts/test-chats-tag-shows-all.js
// playwright is an optionalDependency, so this skips cleanly without it.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); } catch { chromium = null; } }

const T0 = Date.now();
const D = 864e5;
const iso = (ms) => new Date(ms).toISOString();
const WORD = 'come back to';

// One message each for the chats that are meant to be ordinary — the traps are
// deliberately given NO message, which is the real shape: one feed read carries
// ~260 messages for ~770 chats.
const MSGS = [
  { id: 'm1', chat: 'plain', from: 'claude', text: 'hi', tldr: 'a', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'untagged', from: 'claude', text: 'hi', tldr: 'b', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'stale', from: 'claude', text: 'hi', tldr: 'c', created: iso(T0 - 30 * D), postedAt: iso(T0 - 30 * D) },
];
const CHATS = {
  // the ordinary case — carries the word, on her account, nothing else wrong
  plain: { account: '1', labels: [WORD], filedAt: iso(T0 - 3 * D), lastSeen: MSGS[0].created },
  // TRAP 1 — parked, with the reply that unparked it long since aged out of the
  // feed. `repliedAt` is the registry's own proof (see repliedSince).
  parked: { account: '1', labels: [WORD], filedAt: iso(T0 - 3 * D),
    hiddenAt: iso(T0 - 5 * D), repliedAt: iso(T0 - 4 * D) },
  // TRAP 1b — parked and has genuinely said nothing since. It must show under
  // the lit tag too (the tag is a place she went), which is the difference
  // between this pile and the ordinary list.
  'parked-silent': { account: '1', labels: [WORD], filedAt: iso(T0 - 3 * D), hiddenAt: iso(T0 - 5 * D) },
  // TRAP 2 — the other accounts
  'acct-two': { account: '2', labels: [WORD], filedAt: iso(T0 - 3 * D) },
  'acct-three': { account: '3', labels: [WORD], filedAt: iso(T0 - 3 * D) },
  // TRAP 3 — wearing the word AND `bug fix`
  'also-a-bug': { account: '1', labels: [WORD, 'bug fix'], filedAt: iso(T0 - 3 * D) },
  // TRAP 4 — nothing for a month, i.e. behind the seven-day More fold
  stale: { account: '1', labels: [WORD], filedAt: iso(T0 - 30 * D), lastSeen: MSGS[2].created },
  // HER RULE: the archive does not pop out — but the count is named
  archived: { account: '1', labels: [WORD], archived: true, filedAt: iso(T0 - 3 * D) },
  // controls
  untagged: { account: '1', lastSeen: MSGS[1].created },
  binned: { account: '1', labels: [WORD], deletedAt: iso(T0 - D) },
};

async function main() {
  console.log('a lit tag shows everything wearing it:');
  if (!chromium) { console.log('  SKIP: playwright not installed'); return; }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
      const since = url.searchParams.get('since');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        build: 'test-build-1', chats: CHATS,
        settings: { appAccount: '1', categories: [WORD] },
        truncated: [], messages: since ? [] : MSGS, delta: !!since,
      }));
    }
    if (url.pathname === '/' || url.pathname === '/chats') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
    }
    // the shared files the page links; a harness that hand-lists them is one
    // shared file away from a silent timeout
    const local = path.join(PUB, url.pathname.replace(/^\//, ''));
    if (url.pathname !== '/' && fs.existsSync(local) && fs.statSync(local).isFile()) {
      res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' });
      return res.end(fs.readFileSync(local));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // What is really ON SCREEN — rendered rows/tiles, so a chat folded behind
  // "More" (which renders into its own collapsed bar) is not counted as shown.
  const shown = () => page.$$eval('#grid [data-chat]', (ns) => ns
    .filter((n) => !n.closest('.morelist') && !n.closest('.hidelist'))
    .map((n) => n.getAttribute('data-chat')));

  try {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat]');

    // ── the park's registry fallback, on the ordinary list ──────────────────
    // Before the tag is lit at all: `parked` replied AFTER the park and its
    // message has aged out, so it belongs on the list. This is the 122-of-125
    // case, and it is the biggest of the "multiple ways".
    let now = await shown();
    ok('a park whose reply has aged out of the feed is back on the list',
      now.indexOf('parked') > -1, now.join(' · '));
    ok('…and one that has genuinely said nothing since is still parked',
      now.indexOf('parked-silent') < 0, now.join(' · '));

    // ── light the tag ──────────────────────────────────────────────────────
    await page.click('#catrow .tagsbtn');
    await page.waitForTimeout(80);
    const hit = await page.$$eval('#catrow .catchip', (ns, l) => {
      const b = ns.find((n) => n.textContent.trim().toLowerCase().indexOf(l) === 0);
      if (b) b.click();
      return !!b;
    }, WORD);
    ok('the tag has a chip to tap', hit);
    await page.waitForTimeout(120);
    now = await shown();

    ok('the ordinary one shows', now.indexOf('plain') > -1, now.join(' · '));
    ok('a PARKED chat shows under the lit tag', now.indexOf('parked-silent') > -1, now.join(' · '));
    ok('a chat on ANOTHER ACCOUNT shows', now.indexOf('acct-two') > -1, now.join(' · '));
    ok('…both of them', now.indexOf('acct-three') > -1, now.join(' · '));
    ok('a chat also wearing `bug fix` shows', now.indexOf('also-a-bug') > -1, now.join(' · '));
    ok('a chat nothing has landed in for a month is not folded behind More',
      now.indexOf('stale') > -1, now.join(' · '));
    ok('every chat wearing the word is on screen', now.length === 7, now.join(' · '));

    // her rule, and the two halves of it
    ok('an ARCHIVED chat still does not pop out', now.indexOf('archived') < 0, now.join(' · '));
    const foot = await page.$eval('#grid .catarch', (n) => n.textContent.trim()).catch(() => '');
    ok('…but the list says it is in there', /1 more is in the Archive\./.test(foot), foot || '(no footnote)');

    // controls — the pile is the WORD, not everything
    ok('a chat without the word is not in the pile', now.indexOf('untagged') < 0, now.join(' · '));
    ok('a trashed chat is not in the pile', now.indexOf('binned') < 0, now.join(' · '));

    // no hidden bar: the parked ones are folded IN, not behind a second door
    ok('nothing is left behind the hidden bar', !(await page.$('#grid .hidwrap')));

    // and tapping the chip again puts the ordinary list back
    // the WORD's own chip, never `.catchip.on` as a set — the Tags button
    // carries `.on` too and clicking it clears `cat`, so a blanket click would
    // close the row and then re-light the word.
    await page.$$eval('#catrow .catchip', (ns, l) => {
      const b = ns.find((n) => n.textContent.trim().toLowerCase().indexOf(l) === 0);
      if (b) b.click();
    }, WORD);
    await page.waitForTimeout(120);
    now = await shown();
    // The pile really hands control back: the unfiled inbox is showing again
    // (`untagged` never carried a word), and all four filters are back on.
    // `plain` and `parked` are on this list by her OWN rule — a filed chat pops
    // back out when it answers — so they are not what this asks about.
    ok('unlighting it returns the unfiled inbox', now.indexOf('untagged') > -1, now.join(' · '));
    ok('…with the account filter back on', now.indexOf('acct-two') < 0 && now.indexOf('acct-three') < 0,
      now.join(' · '));
    ok('…and the bug-fix chat off the list again', now.indexOf('also-a-bug') < 0, now.join(' · '));
  } finally {
    await browser.close();
    server.close();
  }
}

main().then(() => {
  console.log(fails ? '\n' + fails + ' failed' : '\nall passed');
  process.exit(fails ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });

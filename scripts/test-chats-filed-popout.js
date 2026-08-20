#!/usr/bin/env node
// A filed chat COMES BACK when it answers (Aug 2026, Sophie: "it's been a
// problem when chats are in story and they don't pop out back into the main
// list when they're done, so I think let's have them pop back out"). Filing
// means "not in my way", not "gone" — the same shape as the hidden pile.
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. a filed chat is off the main list even when its last reply is unread —
//      filing has to STICK, or filing a chat she hadn't opened would put it
//      straight back and read as the feature doing nothing,
//   2. a reply that lands AFTER she filed it puts the chat back on the main
//      list, while it stays in its folder — it is in two places, not moved,
//   3. reading it does NOT settle it — only re-filing or responding does
//      (Sophie, v2: "it should stay in both places until I file it away
//      again or respond"),
//   4. a chat filed before `filedAt` existed never pops out on its own (those
//      were backfilled once by scripts/backfill-filedat.js — this is the guard
//      that a missing stamp can't dump a whole folder onto the list),
//   5. an archived filed chat stays archived either way.
//
//   npm install playwright-core --no-save && node scripts/test-chats-filed-popout.js
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

// chat-filed  — filed an hour ago, its only reply is OLDER than that and unread
// chat-legacy — filed, but from before filedAt existed (no stamp at all)
// chat-open   — never filed, the control that must always be on the list
// chat-gone   — filed AND archived
const MSGS = [
  { id: 'm1', chat: 'chat-filed', from: 'claude', text: 'the storyboard', tldr: 'storyboard', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm2', chat: 'chat-legacy', from: 'claude', text: 'an old reply', tldr: 'old', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-open', from: 'claude', text: 'unfiled reply', tldr: 'unfiled', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm4', chat: 'chat-gone', from: 'claude', text: 'archived reply', tldr: 'archived', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
];
// flipped by the test: the filed chat finishes and answers her; then she
// responds; then she re-files it (filedAt jumps past the reply)
let answered = false;
let responded = false;
let refiledAt = '';
const ANSWER = { id: 'm5', chat: 'chat-filed', from: 'claude', text: 'it came back', tldr: 'came back',
                 created: iso(T0 + 3600000), postedAt: iso(T0 + 3600000) };
const HER = { id: 'm6', chat: 'chat-filed', from: 'sophie', text: 'thanks — one more thing', tldr: '',
              created: iso(T0 + 7200000), postedAt: iso(T0 + 7200000) };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({
      build: 'test-build-1',
      chats: {
        'chat-filed': { lastSeen: MSGS[0].created, category: 'story', filedAt: refiledAt || iso(T0 - 3600000) },
        'chat-legacy': { lastSeen: MSGS[1].created, category: 'story' },
        'chat-open': { lastSeen: MSGS[2].created },
        'chat-gone': { lastSeen: MSGS[3].created, category: 'story', filedAt: iso(T0 - 3600000), archived: true },
      },
      settings: {}, truncated: [],
      messages: (() => {
        const extra = (answered ? [ANSWER] : []).concat(responded ? [HER] : []);
        return since ? extra : MSGS.concat(extra);
      })(),
      delta: !!since,
    });
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat).sort());
const openFolder = async (page, on) => {
  // The folders live behind the TAGS button now (Aug 2026) and the row starts
  // shut on every load — open it before reaching for a chip.
  if (!(await page.$('#catrow .tagsbtn.on'))) await page.click('#catrow .tagsbtn');
  // Category words live behind SEE MORE now (Aug 2026) — unfold them too.
  if (await page.$('#catrow .morechip')) await page.click('#catrow .morechip');
  await page.$$eval('#catrow .catchip', (ns) => {
    const c = ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Story');
    if (c) c.click();
  });
  await page.waitForTimeout(80);
  return on;
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const forcePoll = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-open"]');

  // 1 + 4 + 5. filing STICKS: an unread older reply is not a reason to come
  // back, a legacy chat with no stamp never comes back, archived stays away
  let rows = await listed(page);
  if (JSON.stringify(rows) !== JSON.stringify(['chat-open'])) {
    fail('the unfiled list should hold only chat-open, got: ' + rows.join(','));
  }

  // 2. it answers → back on the main list, and STILL in its folder
  answered = true;
  await forcePoll();
  await page.waitForFunction(() => !!document.querySelector('#grid > .clist .crow[data-chat="chat-filed"]'),
    null, { timeout: 5000 }).catch(() => fail('the filed chat answered but never came back to the list'));
  rows = await listed(page);
  if (JSON.stringify(rows) !== JSON.stringify(['chat-filed', 'chat-open'])) {
    fail('wrong list after the answer: ' + rows.join(','));
  }
  if (rows.includes('chat-legacy')) fail('a stampless filed chat came back too');
  await openFolder(page);
  rows = await listed(page);
  if (!rows.includes('chat-filed')) fail('coming back took the chat OUT of its folder: ' + rows.join(','));
  await openFolder(page);   // back to the unfiled list

  // 3. READING IT DOES NOT SETTLE IT (Sophie, v2: "reading it shouldn't send
  //    it back to story — it should stay in both places until I file it
  //    away again or respond"). Mark it seen the way opening it does; it must
  //    still be in both places after a full reload.
  await page.evaluate(() => {
    const seen = JSON.parse(localStorage.getItem('chats-seen-v1') || '{}');
    seen['chat-filed'] = new Date(Date.now() + 7200000).toISOString();
    localStorage.setItem('chats-seen-v1', JSON.stringify(seen));
  });
  await page.reload();
  await page.waitForSelector('#grid [data-chat="chat-open"]');
  rows = await listed(page);
  if (!rows.includes('chat-filed')) fail('reading it sent the chat back to its folder: ' + rows.join(','));

  // 6. she RESPONDS → her message is newest, so the pop-out ends (the server
  //    also parks the chat on this path; the stub only models the message)
  responded = true;
  await forcePoll();
  await page.waitForFunction(() => !document.querySelector('#grid > .clist .crow[data-chat="chat-filed"]'),
    null, { timeout: 5000 }).catch(() => fail('her response did not end the pop-out'));
  await openFolder(page);
  rows = await listed(page);
  if (!rows.includes('chat-filed')) fail('responding lost the chat from its folder: ' + rows.join(','));
  await openFolder(page);

  // 7. …and the next reply after a RE-FILING stays put: filedAt renewed past
  //    the reply means the reply is old news, not a comeback
  responded = false;               // her message gone from the tail…
  refiledAt = iso(T0 + 10800000);  // …and she re-filed AFTER the reply
  await page.reload();
  await page.waitForSelector('#grid [data-chat="chat-open"]');
  rows = await listed(page);
  if (rows.includes('chat-filed')) fail('re-filing did not settle the chat: ' + rows.join(','));
  await openFolder(page);
  rows = await listed(page);
  if (!rows.includes('chat-filed')) fail('re-filing lost the chat from its folder: ' + rows.join(','));

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: filing sticks, an answer pops the chat out, and only re-filing or responding settles it');
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * check-chats-newbar.mjs — drive public/chats.html in a real browser and prove
 * a message landing mid-read never moves the page under her.
 *
 * WHY THIS EXISTS
 * The poll used to rebuild the view the moment a reply arrived. New messages
 * come in at the TOP, so the rebuild pushed everything down (her restored
 * scrollY landed somewhere else entirely) and collapsed whatever she had
 * expanded — she lost her place every time a chat finished a reply. Now the
 * message is buffered and a "New message" bar appears instead; tapping it is
 * what shows it. That's easy to regress in a way nothing else catches, so this
 * serves the page against a stub feed and checks the actual scroll position
 * and open/closed state after a poll.
 *
 *   node scripts/check-chats-newbar.mjs
 *
 * Needs playwright + a chromium (optionalDependency here; PLAYWRIGHT_CHROMIUM
 * overrides the executable). It SKIPS with exit 0 when neither is available,
 * so it's safe to run anywhere.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'public', 'chats.html'), 'utf8');
const PORT = Number(process.env.PORT_CHECK || 8799);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
  catch { console.log('SKIP — playwright not installed'); process.exit(0); }
}
const exe = process.env.PLAYWRIGHT_CHROMIUM
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => fs.existsSync(p));

// ---- a stub feed: 14 chats x 12 messages, so both views actually scroll -----
const CHATS = Array.from({ length: 14 }, (_, i) => 'chat-' + String(i + 1).padStart(2, '0'));
const msgs = [];
let n = 0, t = 0;
// '#' is stripped as markdown in the rendered status line — label with 'no'.
const stamp = () => '2026-07-28T' + String(Math.floor(t / 60) + 1).padStart(2, '0')
  + ':' + String(t++ % 60).padStart(2, '0') + ':00.000Z';
const mk = (chat, i) => ({
  id: 'm' + ++n, chat, created: stamp(),
  tldr: 'TLDR for ' + chat + ' no' + i,
  text: ('Message ' + i + ' in ' + chat + '. ').repeat(40),
});
for (let i = 1; i <= 12; i++) for (const c of CHATS) msgs.push(mk(c, i));

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/' || u.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE);
  }
  if (u.pathname === '/api/chatfeed') {
    const since = u.searchParams.get('since');
    const list = (since ? msgs.filter((m) => m.created > since) : msgs.slice())
      .sort((a, b) => (a.created < b.created ? 1 : -1));   // newest first
    return send({ chats: Object.fromEntries(CHATS.map((c) => [c, {}])), settings: {}, messages: list, truncated: [], delta: !!since });
  }
  if (u.pathname === '/api/chatfeed/thread') {
    return send({ messages: msgs.filter((m) => m.chat === u.searchParams.get('chat')) });
  }
  if (u.pathname.startsWith('/api/gallery/assets')) return send({ assets: [] });
  if (u.pathname.startsWith('/api/chatfeed/pages')) return send({ pages: [] });
  return send({ ok: true });
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
let failed = 0;
page.on('pageerror', (e) => { failed++; console.log('PAGE ERROR: ' + e.message); });
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || !extra ? '' : '   ' + extra));
};

await page.goto('http://localhost:' + PORT + '/');
await page.waitForFunction(() => !document.querySelector('#grid .state'));

// The page polls on a 20s timer and whenever it becomes visible — the second
// one is what we fire to run a poll on demand.
const poll = async () => {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(250);
};
const barShown = () => page.evaluate(() => document.getElementById('newbar').classList.contains('show'));
const barText = () => page.evaluate(() => document.getElementById('newtxt').textContent);
const shows = (s) => page.evaluate((x) => document.body.innerText.includes(x), s);
const y = () => page.evaluate(() => window.scrollY);
const openMsgs = () => page.evaluate(() => document.querySelectorAll('#thread .msg.open').length);

// 1. at the very top of the feed there's no place to lose — show it straight away
msgs.push(mk(CHATS[0], 99));
await poll();
check('at top of home: no bar', (await barShown()) === false);
check('at top of home: shown straight away', await shows('TLDR for ' + CHATS[0] + ' no99'));

// 2. scrolled down the feed → bar, and nothing moves
await page.evaluate(() => window.scrollTo(0, 400));
const yHome = await y();
msgs.push(mk(CHATS[1], 100));
await poll();
check('scrolled home: bar shows', (await barShown()) === true);
check('scrolled home: place kept', (await y()) === yHome, 'y=' + (await y()) + ' was ' + yHome);
check('scrolled home: not rendered yet', !(await shows('TLDR for ' + CHATS[1] + ' no100')));
msgs.push(mk(CHATS[2], 101));
await poll();
check('bar counts up', (await barText()) === '2 new messages', await barText());

// 3. tapping it is what shows them
await page.click('#newbar');
await page.waitForTimeout(200);
check('tap: bar hidden', (await barShown()) === false);
check('tap: at top', (await y()) === 0);
check('tap: messages shown', await shows('TLDR for ' + CHATS[2] + ' no101'));

// 4. reading a thread: scroll spot AND the expanded message survive
await page.click('.crow');
await page.waitForTimeout(300);
const open = await page.evaluate(() => document.querySelector('#thread h1').textContent);
await page.evaluate(() => document.querySelectorAll('#thread .msg')[3].querySelector('.m-preview').click());
await page.evaluate(() => window.scrollTo(0, 500));
await page.waitForTimeout(150);
const yThread = await y();
check('thread: a message is expanded', (await openMsgs()) === 1);
msgs.push(mk(open, 200));
await poll();
check('thread: bar shows', (await barShown()) === true);
check('thread: place kept', (await y()) === yThread, 'y=' + (await y()) + ' was ' + yThread);
check('thread: still expanded', (await openMsgs()) === 1);
check('thread: not rendered yet', !(await shows('TLDR for ' + open + ' no200')));

// 5. another chat's reply must not raise the bar on the one she's reading
msgs.push(mk(CHATS.find((c) => c !== open), 300));
await poll();
check('thread: other chat does not count', (await barText()) === 'New message', await barText());

// 6. tap → thread rebuilt, newest at the top
await page.click('#newbar');
await page.waitForTimeout(250);
check('thread tap: bar hidden', (await barShown()) === false);
check('thread tap: at top', (await y()) === 0);
check('thread tap: new message present', await shows('TLDR for ' + open + ' no200'));

// 7. back home picks up everything that landed elsewhere
await page.click('#back');
await page.waitForTimeout(250);
check('home: other chat folded in', await shows('no300'));
check('home: no stale bar', (await barShown()) === false);

// 8. the two floating bars stack instead of overlapping
check('stacks under the now-playing bar', await page.evaluate(() => {
  const np = document.getElementById('nowplaying'), nb = document.getElementById('newbar');
  np.classList.add('show'); nb.classList.add('show');
  const a = np.getBoundingClientRect(), b = nb.getBoundingClientRect();
  const ok = b.top >= a.bottom;
  np.classList.remove('show'); nb.classList.remove('show');
  return ok;
}));

await browser.close();
server.close();
console.log(failed ? '\n' + failed + ' FAILED' : '\nall checks passed');
process.exit(failed ? 1 : 0);

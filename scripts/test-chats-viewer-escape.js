#!/usr/bin/env node
// test-chats-viewer-escape.js — A SAME-ORIGIN LINK INSIDE A COMPARE PAGE
// NAVIGATED THE VIEWER'S IFRAME TO THE WHOLE CHATS APP (2026-08-26, Sophie,
// live: "two pills on top of each other. I see a medium and fast at the same
// time … I can't pause it. I can't click on the screen or the pill itself").
//
//   node scripts/test-chats-viewer-escape.js
//
// The page viewer (openPage) is a same-origin iframe, so a plain
// `/chats?chat=…` link inside a posted page — the morning brief's own
// fallback href when __openThread answers false, or any hand-authored page —
// loads the ENTIRE Chats app inside the viewer. The nested app bakes its own
// pill, which stacks on the viewer's pill in the same corner (two speed
// labels at once), and every tap toggles BOTH scrollers: pausing one starts
// the other, so the scroll never stops, and it runs past the thread into the
// viewer's cream. The fix: the frame's load handler closes the viewer and
// opens the destination thread in the app itself the moment the frame loads
// anything that is not a served page.
//
// Verified FAILING against the pre-fix page (the nested app stayed inside
// the viewer, two .float elements, both tap handlers live).
//
// Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const CHATS = { 'chat-a': { lastSeen: iso(T0 - 2e5) }, 'chat-b': { lastSeen: iso(T0 - 3e5) } };
const MSGS = [];
for (let i = 0; i < 30; i++) {
  MSGS.push({ id: 'fa' + i, chat: 'chat-a', from: i % 5 === 0 ? 'sophie' : 'claude', created: iso(T0 - 9e5 + i * 1000),
    postedAt: iso(T0 - 9e5 + i * 1000), text: 'filler reply ' + i + '\n\n' + 'x'.repeat(400), tldr: 'filler ' + i });
  MSGS.push({ id: 'fb' + i, chat: 'chat-b', from: 'claude', created: iso(T0 - 8e5 + i * 1000),
    postedAt: iso(T0 - 8e5 + i * 1000), text: 'other chat reply ' + i + '\n\n' + 'y'.repeat(400), tldr: 'other ' + i });
}
// A posted page carrying the two links that can spring the trap: ANOTHER
// known chat's thread (the brief's fallback shape) and a chat this feed
// never met. (A link back to the SAME chat also escapes; it just lands on
// the tab she left, so the OTHER-chat link is the one asserted on.)
const PAGEHTML = '<!doctype html><html><head><meta charset="utf-8"><title>t</title></head>' +
  '<body style="background:#f4ead8"><h1>Test page</h1>' +
  '<div style="height:3000px">tall content</div>' +
  '<a id="knownlink" href="/chats?chat=chat-b">open the chat</a>' +
  '<a id="strangelink" href="/chats?chat=nobody-here">open a stranger</a></body></html>';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  if (p === '/api/chatfeed/thread') return json({ messages: MSGS.filter((m) => m.chat === (url.searchParams.get('chat') || 'chat-a')) });
  if (p === '/api/chatfeed/pages') return json({ pages: [{ id: 'p1', title: 'Test page', created: iso(T0 - 3e5) }] });
  if (p.startsWith('/api/chatfeed/page/')) return send('text/html; charset=utf-8', PAGEHTML);
  if (p === '/api/chatfeed') return json({ build: 't', settings: {}, truncated: [], delta: false, chats: CHATS, messages: MSGS });
  if (p.startsWith('/api/')) return json({ ok: true, assets: [], items: {}, texts: {}, pages: [] });
  try { return send('text/plain', fs.readFileSync(path.join(PUB, p.slice(1)))); }
  catch (_) { res.writeHead(404); res.end(''); }
});

const PROBE = `(function(){
  var fl=[...document.querySelectorAll('.float')];
  return { floats: fl.length,
    hidden: fl.filter(f=>getComputedStyle(f).display==='none').length,
    ontop: document.body.classList.contains('ontop'),
    overflow: document.body.style.overflow,
    viewer: !!document.querySelector('.pageview'),
    thread: !![...document.querySelectorAll('.msg')].find(m=>m.offsetParent),
    sh: document.documentElement.scrollHeight };
})()`;

async function openViewer(page) {
  await page.evaluate(() => { const t = [...document.querySelectorAll('button,.acctab')].find(b => /compare/i.test(b.textContent)); if (t) t.click(); });
  await page.waitForSelector('.pagerow', { timeout: 8000 });
  await page.click('.pagerow');
  await page.waitForSelector('.pageview iframe', { timeout: 8000 });
  await page.waitForTimeout(500);
}

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
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++; };

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForSelector('.msg', { timeout: 8000 });

  // ---- the viewer itself is untouched: pill pair with the baked one hidden
  await openViewer(page);
  let st = await page.evaluate(PROBE);
  ok(st.viewer, 'viewer open');
  ok(st.floats === 2 && st.hidden === 1, 'viewer: two pills exist, the baked one hidden (' + st.floats + '/' + st.hidden + ' hidden)');
  ok(st.ontop, 'viewer: body.ontop set');

  // ---- a link to a KNOWN chat: viewer closes, the thread opens HERE
  await page.evaluate(() => { document.querySelector('.pageview iframe').contentDocument.getElementById('knownlink').click(); });
  await page.waitForTimeout(1200);
  st = await page.evaluate(PROBE);
  ok(!st.viewer, 'known chat link: viewer closed');
  ok(st.floats === 1, 'known chat link: exactly one pill left (' + st.floats + ')');
  ok(!st.ontop && st.overflow === '', 'known chat link: ontop off, body scroll unlocked');
  ok(st.thread, 'known chat link: the thread is open in the app itself');
  const hdr = await page.evaluate(() => (document.querySelector('#thread h1') || {}).textContent || '');
  ok(/chat-b/.test(hdr), 'known chat link: it is the LINKED chat\'s thread (' + hdr.trim() + ')');

  // ---- the ONE pill left still owns the page after the escape: its play
  // button starts the scroll and a second press stops it — the exact gesture
  // the nested-app state broke (each press toggled the OTHER pill back on).
  // Let the reopened thread's own fetch land first: its repaint holds the
  // scroll spot, which would read as "the scroll never started".
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.querySelector('#vmid').click());
  await page.waitForTimeout(700);
  const y1 = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => document.querySelector('#vmid').click());
  await page.waitForTimeout(250);
  const y2 = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(600);
  const y3 = await page.evaluate(() => window.scrollY);
  ok(y1 > 2, 'after escape: the pill starts a scroll (' + y1 + 'px)');
  ok(Math.abs(y3 - y2) < 2, 'after escape: a second press stops it (' + y2 + ' → ' + y3 + ')');

  // ---- a link to a chat this feed never met: still no nested app — the
  // TOP window navigates to that thread's own URL (the app then spends the
  // deep link and cleans its URL, so the ADDRESS is not the assertion: no
  // viewer, one pill, and the app running at the top is).
  await openViewer(page);
  page.evaluate(() => { document.querySelector('.pageview iframe').contentDocument.getElementById('strangelink').click(); }).catch(() => {});
  await page.waitForTimeout(2000);
  st = await page.evaluate(PROBE).catch(() => null) ||
       (await page.waitForSelector('.float', { timeout: 8000 }), await page.evaluate(PROBE));
  ok(!st.viewer && st.floats === 1, 'unknown chat link: no nested app — viewer gone, one pill (' + st.floats + ')');

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nAll good.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

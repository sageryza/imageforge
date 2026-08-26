#!/usr/bin/env node
// test-chats-pin-pill.js — THE PINNED DELIVERABLE RAN UNDER THE AUTOSCROLL
// PILL (2026-08-26, from Sophie's screenshot of `people-watching-club-reel`:
// the row read "PWC ep006 — the building across the street (0:41)Fastest",
// with the pill's own speed label printing onto the end of the title).
//
//   node scripts/test-chats-pin-pill.js
//
// The pinned row is `width:100%` inside the thread header, and the pill is
// fixed in the top-right corner with `#spd` drawn underneath it — so on a
// 390pt phone the row's right end sits inside that column, exactly the
// collision `.noterow` already learned about with the QUESTIONS button.
//
// Every assertion is a MEASUREMENT of the real page, and the ones that matter
// use `elementFromPoint`: a covered row passes `offsetParent !== null` and
// every width assertion while its last word is unreadable.
//
// Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Her real pin, title and all — long enough that the row runs the full width.
const PIN = { url: 'https://storage.googleapis.com/x/pwc/ep006.mp4',
  title: 'PWC ep006 — the building across the street (0:41)',
  kind: 'film', at: iso(T0 - 6e5), turns: 3 };
const CHATS = { 'chat-a': { lastSeen: iso(T0 - 2e5), pinned: PIN } };
const MSGS = [];
for (let i = 0; i < 30; i++) {
  MSGS.push({ id: 'f' + i, chat: 'chat-a', from: 'claude', created: iso(T0 - 9e5 + i * 1000),
    postedAt: iso(T0 - 9e5 + i * 1000), text: 'filler reply ' + i + '\n\n' + 'x'.repeat(400), tldr: 'filler ' + i });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  if (p === '/api/chatfeed/thread') return json({ messages: MSGS });
  if (p === '/api/chatfeed') return json({ build: 't', settings: {}, truncated: [], delta: false, chats: CHATS, messages: MSGS });
  if (p.startsWith('/api/')) return json({ ok: true, assets: [], items: {}, texts: {}, pages: [] });
  try { return send('text/plain', fs.readFileSync(path.join(PUB, p.slice(1)))); }
  catch (_) { res.writeHead(404); res.end(''); }
});

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
  await page.waitForTimeout(700);          // the reserve is measured on a delay

  const pillOn = await page.$$eval('body > .float', (n) => n.filter((x) => x.getClientRects().length).length);
  ok(pillOn === 1, 'the autoscroll pill is on screen (' + pillOn + ')');
  ok(await page.$$eval('#thread .pinned', (n) => n.length) === 1, 'the chat shows its pinned deliverable');

  const m = await page.evaluate(() => {
    const row = document.querySelector('#thread .pinned');
    const ti = row.querySelector('.ti');
    const pill = document.querySelector('body > .float');
    const spd = document.getElementById('spd');
    const r = row.getBoundingClientRect(), p = pill.getBoundingClientRect(), s = spd.getBoundingClientRect();
    const t = ti.getBoundingClientRect();
    // What a tap at the right end of the row actually reaches — the only
    // honest question, and the one the QUESTIONS button's own fix turned on.
    const hit = document.elementFromPoint(r.right - 6, r.top + r.height / 2);
    return {
      right: Math.round(r.right), pillLeft: Math.round(p.left),
      titleRight: Math.round(t.right), rowH: Math.round(r.height),
      // The speed label is drawn UNDER the capsule, which is where it lands on
      // this row: its own box against the row's.
      spdOverRow: s.right > r.left && s.left < r.right && s.bottom > r.top && s.top < r.bottom,
      spdText: spd.textContent,
      reaches: !!(hit && hit.closest('.pinned')),
      hit: hit ? (hit.id || hit.className || hit.tagName) : '',
    };
  });

  ok(m.right <= m.pillLeft, 'the row ends left of the pill (' + m.right + ' vs ' + m.pillLeft + ')');
  ok(!m.spdOverRow, 'the pill’s speed label ("' + m.spdText + '") is not printing on the row');
  ok(m.titleRight <= m.pillLeft, 'and the title itself stops before that column (' + m.titleRight + ')');
  ok(m.reaches, 'a tap at the row’s right edge reaches the row, not the pill (' + m.hit + ')');
  ok(m.rowH < 70, 'the title still ellipsises rather than wrapping the row taller (' + m.rowH + 'px)');

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

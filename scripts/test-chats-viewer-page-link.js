#!/usr/bin/env node
// test-chats-viewer-page-link.js — A LINK FROM ONE SERVED PAGE TO ANOTHER,
// INSIDE THE VIEWER, DREW TWO PILLS (2026-09-11, Sophie: "pill is double
// pill in some places · it was in light blue 3d button ward etc · y dies
// that happen always").
//
//   node scripts/test-chats-viewer-page-link.js
//
// The page viewer (openPage) opens a page at `/api/chatfeed/page/<id>?embed=1`
// — the server injects no pill for an embed, and the viewer's own pill
// (mkPagePill) drives the frame. A scenes-index key links to its belt as
// `/api/chatfeed/page/<belt>#j-<key>`, and the click interceptor let that
// load in place AS WRITTEN — no `?embed=1` — so the server dressed the belt
// for a browser and pill-inject ran inside the frame: its capsule under the
// viewer's, two speed labels, and a ▶ the viewer could not stop. Every
// page-to-page link did it, which is her "always".
//
// Two nets, both measured here on the real chats.html with the real
// pill-inject served into the second page the way chatfeed.js serves it:
//   1. the CLICK is rewritten onto the embed url (hash kept, so the key
//      still lands on its scene);
//   2. a navigation the interceptor cannot see (a script setting location)
//      still arrives dressed for a browser — the load handler takes the
//      frame's own pill out and blanks its hooks.
// Either way: ONE visible pill, the bar names the page she is on, and a
// hash-only hop on the page she is already on is left to the browser.
//
// Verified FAILING against the pre-fix page (3 visible .float elements, the
// frame's own #vtop live, the bar still naming the index page).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const CHATS = { 'chat-a': { lastSeen: iso(T0 - 2e5) } };
const MSGS = [];
for (let i = 0; i < 6; i++) {
  const ta = T0 - 9e5 - (6 - i) * 2 * 3600 * 1000;
  MSGS.push({ id: 'fa' + i, chat: 'chat-a', from: i % 3 === 0 ? 'sophie' : 'claude', created: iso(ta),
    postedAt: iso(ta), text: 'filler reply ' + i + '\n\n' + 'x'.repeat(200), tldr: 'filler ' + i });
}
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
// the "scenes index": a wall of keys, each a link to the belt page's scene
const INDEX = '<!doctype html><html><head><meta charset="utf-8"><title>Light blue ward — scenes</title></head>' +
  '<body style="background:#dbe9f4"><h1>Scenes</h1>' +
  '<a id="key1" href="/api/chatfeed/page/belt#j-s1">scene 1</a>' +
  '<a id="samehash" href="/api/chatfeed/page/index#here">same page, a hash</a>' +
  '<div style="height:2400px">keys</div><div id="here">here</div></body></html>';
// the "belt": tall, with the scene anchor far down
const BELT = '<!doctype html><html><head><meta charset="utf-8"><title>Light blue ward — belt v9</title></head>' +
  '<body style="background:#dbe9f4"><h1>Belt</h1><div style="height:1800px">cards</div>' +
  '<div id="j-s1">scene one card</div><div style="height:1800px">more cards</div></body></html>';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  if (p === '/api/chatfeed/thread') return json({ messages: MSGS });
  if (p === '/api/chatfeed/pages') return json({ pages: [{ id: 'index', title: 'Scenes index', created: iso(T0 - 3e5) }] });
  if (p.startsWith('/api/chatfeed/page/')) {
    // chatfeed.js's own rule: the shared pill is injected for a browser and
    // skipped for the app's viewer (?embed=1)
    const id = p.slice('/api/chatfeed/page/'.length);
    let html = id === 'belt' ? BELT : INDEX;
    if (url.searchParams.get('embed') !== '1') html += PILL;
    return send('text/html; charset=utf-8', html);
  }
  if (p === '/api/chatfeed') return json({ build: 't', settings: {}, truncated: [], delta: false, chats: CHATS, messages: MSGS });
  if (p.startsWith('/api/')) return json({ ok: true, assets: [], items: {}, texts: {}, pages: [] });
  try { return send('text/plain', fs.readFileSync(path.join(PUB, p.slice(1)))); }
  catch (_) { res.writeHead(404); res.end(''); }
});

// What is REALLY on screen: every .float in the parent AND in the frame,
// counted by whether it paints.
const PROBE = `(function(){
  function vis(f){ var cs=getComputedStyle(f); return cs.display!=='none' && cs.visibility!=='hidden' && f.getBoundingClientRect().height>0; }
  var out={ parentFloats:[...document.querySelectorAll('.float')].filter(vis).length, frameFloats:-1, frameVtop:false, href:'', title:'', frameY:-1, hooks:'' };
  var fr=document.querySelector('.pageview iframe');
  try{ var d=fr.contentDocument, w=fr.contentWindow;
    out.frameFloats=[...d.querySelectorAll('.float')].filter(vis).length;
    var vt=d.getElementById('vtop'); out.frameVtop=!!(vt && vt.getBoundingClientRect().height>0 && getComputedStyle(vt.closest('.float')||vt).display!=='none');
    out.href=w.location.href; out.frameY=w.scrollY;
    out.hooks=(typeof w.__scrollTap)+'/'+(typeof w.__scrollStop);
  }catch(_){}
  out.title=(document.querySelector('.pv-title')||{}).textContent||'';
  return out;
})()`;

async function openViewer(page) {
  await page.evaluate(() => { const t = [...document.querySelectorAll('button,.acctab')].find(b => /compare/i.test(b.textContent)); if (t) t.click(); });
  await page.waitForSelector('.pagerow', { timeout: 8000 });
  await page.click('.pagerow');
  await page.waitForSelector('.pageview iframe', { timeout: 8000 });
  await page.waitForTimeout(600);
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
  page.on('pageerror', (e) => console.log('PAGE ERROR: ' + e.message));
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++; };

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForSelector('.msg', { timeout: 8000 });
  await openViewer(page);
  let st = await page.evaluate(PROBE);
  ok(/embed=1/.test(st.href), 'the index opens as an embed (' + st.href.replace(base, '') + ')');
  ok(st.parentFloats === 1 && st.frameFloats === 0, 'index: one visible pill, the viewer\'s (' + st.parentFloats + ' parent / ' + st.frameFloats + ' frame)');

  // ---- 1. a scene key: the click is rewritten onto the embed url, hash kept
  await page.evaluate(() => { document.querySelector('.pageview iframe').contentDocument.getElementById('key1').click(); });
  await page.waitForTimeout(900);
  st = await page.evaluate(PROBE);
  ok(/\/api\/chatfeed\/page\/belt\?embed=1/.test(st.href) && /#j-s1$/.test(st.href), 'key: the belt loads as an embed with the scene hash kept (' + st.href.replace(base, '') + ')');
  ok(st.parentFloats === 1 && st.frameFloats === 0 && !st.frameVtop, 'key: ONE visible pill, the frame drew none (' + st.parentFloats + ' parent / ' + st.frameFloats + ' frame)');
  ok(st.frameY > 1000, 'key: the frame landed on the scene (' + st.frameY + 'px down)');
  ok(/belt v9/.test(st.title), 'key: the bar names the belt she is on now (' + st.title + ')');

  // ---- the viewer's pill still drives the belt, and a tap on the page
  // toggles ONE scroller: start, then a second tap stops it
  await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollTo(0, 0));
  await page.evaluate(() => document.querySelector('.pageview .float #vmid, .pageview .float button').click());
  await page.waitForTimeout(700);
  let y1 = await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollY);
  await page.evaluate(() => { const d = document.querySelector('.pageview iframe').contentDocument; d.querySelector('h1').click(); });
  await page.waitForTimeout(250);
  let y2 = await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollY);
  await page.waitForTimeout(600);
  let y3 = await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollY);
  ok(y1 > 2, 'the viewer\'s pill scrolls the belt (' + y1 + 'px)');
  ok(Math.abs(y3 - y2) < 2, 'a tap on the belt stops it — one scroller, not two (' + y2 + ' → ' + y3 + ')');

  // ---- 2. a navigation the interceptor cannot see: a script sends the frame
  // to the belt WITHOUT embed. The server injects a pill; the net removes it.
  await page.evaluate(() => { document.querySelector('.pageview iframe').contentWindow.location.href = '/api/chatfeed/page/belt'; });
  await page.waitForTimeout(1200);
  st = await page.evaluate(PROBE);
  ok(!/embed=1/.test(st.href), 'script nav: the belt really arrived dressed for a browser (' + st.href.replace(base, '') + ')');
  ok(st.parentFloats === 1 && st.frameFloats === 0 && !st.frameVtop, 'script nav: the frame\'s injected pill is taken out — ONE visible pill (' + st.parentFloats + ' parent / ' + st.frameFloats + ' frame, vtop=' + st.frameVtop + ')');
  ok(/belt v9/.test(st.title), 'script nav: the bar names the belt (' + st.title + ')');
  // the frame's own scroller is stopped and its hooks blanked, so a tap
  // toggles ONE scroller here too
  await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollTo(0, 0));
  await page.evaluate(() => document.querySelector('.pageview .float #vmid, .pageview .float button').click());
  await page.waitForTimeout(700);
  y1 = await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollY);
  await page.evaluate(() => { const d = document.querySelector('.pageview iframe').contentDocument; d.querySelector('h1').click(); });
  await page.waitForTimeout(250);
  y2 = await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollY);
  await page.waitForTimeout(600);
  y3 = await page.evaluate(() => document.querySelector('.pageview iframe').contentWindow.scrollY);
  ok(y1 > 2, 'script nav: the viewer\'s pill scrolls the belt (' + y1 + 'px)');
  ok(Math.abs(y3 - y2) < 2, 'script nav: a tap stops it — the frame\'s own scroller is dead (' + y2 + ' → ' + y3 + ')');

  // ---- 3. a hash-only hop on the page she is on is the browser's: no reload
  await page.evaluate(() => { document.querySelector('.pageview iframe').contentWindow.location.href = '/api/chatfeed/page/index?embed=1'; });
  await page.waitForTimeout(900);
  const before = await page.evaluate(() => { const w = document.querySelector('.pageview iframe').contentWindow; w.__probeMark = 1; return w.location.href; });
  await page.evaluate(() => { document.querySelector('.pageview iframe').contentDocument.getElementById('samehash').click(); });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => { const w = document.querySelector('.pageview iframe').contentWindow; return { href: w.location.href, mark: w.__probeMark, y: w.scrollY }; });
  ok(/#here$/.test(after.href) && after.mark === 1, 'hash hop: same document, no reload (' + after.href.replace(base, '') + ')');
  ok(after.y > 1000, 'hash hop: the page scrolled to the anchor (' + after.y + 'px)');
  void before;

  await b.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

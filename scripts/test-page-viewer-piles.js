#!/usr/bin/env node
/* THE APP'S PILL DRIVES WHATEVER IS ACTUALLY SCROLLING INSIDE THE FRAME
 * (2026-09-02, Sophie: "why does autos roll not work in piles fix it").
 *
 * A Compare page opened in the Chats app runs in an IFRAME, and the pill she
 * taps there is `mkPagePill` in chats.html — a second implementation living in
 * the parent page, because iOS renders position:fixed unreliably inside a
 * frame. It only ever asked the frame's WINDOW, so a page whose content
 * scrolls inside its own box could not be moved at all — and a DECK's piles
 * view is exactly that box (`flex:1; overflow-y:auto`), the one screen in a
 * deck that is genuinely long.
 *
 * Measured before the fix, at her viewport, on the REAL rendered deck
 * template: 672px of piles below the fold, the frame's own document with
 * NOTHING to scroll, and a tap on play moving the piles 0px. judge.js's own
 * little side-button (2026-09-01) works and is not what she reaches for.
 *
 * Every assertion is a MEASUREMENT — a pill that is present and drives
 * nothing looks identical to any markup assertion, and that IS the bug.
 * Verified failing 3 against the pre-fix chats.html.
 *
 *   node scripts/test-page-viewer-piles.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  console.log('no playwright — skipping (npm install playwright --no-save)');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const { renderTemplatePage } = require(path.join(ROOT, 'page-templates.js'));
const chats = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');

// The real function, lifted out of the real page — never a copy.
const m = chats.match(/function mkPagePill\(getWin\)\{[\s\S]*?\n  return pill;\n\}/);
if (!m) { console.log('FAIL could not find mkPagePill in chats.html'); process.exit(1); }

let bad = 0;
const ok = (c, msg) => { console.log((c ? 'PASS: ' : 'FAIL: ') + msg); if (!c) bad += 1; };

const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23c99'/%3E%3C/svg%3E";
const items = [];
for (let i = 0; i < 44; i += 1) items.push({ id: 'c' + i, label: 'card ' + i, img: IMG });

// The deck exactly as the server renders it for the viewer, plus a few marks
// so the piles have something in them, then straight to the piles view.
const DECK = renderTemplatePage({
  template: 'deck', title: 'Piles', chat: 't', sheet: 's',
  data: { items, browse: true, look: 'mom' },
}) + `<script>
setTimeout(function(){
  var m=document.querySelector('#judge')||document;
  function tap(s){ var b=m.querySelector(s); if(b) b.click(); return !!b; }
  [['yes',4],['no',3],['maybe',1]].forEach(function(mk){
    for(var k=0;k<mk[1];k++){ tap('[data-act="'+mk[0]+'"]'); tap('[data-act="next"]'); }
  });
  setTimeout(function(){ tap('[data-act="piles"]'); window.__ready=1; }, 400);
}, 600);
</script>`;

// An ordinary scrolling Compare page — the regression guard: the window is
// still the thing the pill drives wherever the page itself has room.
const LONG = '<p style="margin:0 0 14px">The prompt is the treasure and the image is a throwaway probe. </p>'.repeat(220);
const PLAIN = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:16px;font:16px/1.6 sans-serif}
.sheet{height:60vh;overflow-y:auto;border:1px solid #ccc}</style>
<div class="sheet">${LONG}</div>${LONG}`;

const host = (src) => `<!doctype html><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/compare.css">
<style>html,body{margin:0;height:100%}
.pageview{position:fixed;inset:0;display:flex;flex-direction:column}
.pv-frame{flex:1;width:100%;border:none}
.float{position:fixed;top:14px;right:14px;z-index:9;display:flex;flex-direction:column;gap:8px;align-items:center}
.vseg{display:flex;flex-direction:column}
.ptop{display:none}.ptop.on{display:flex}</style>
<div class="pageview"><iframe class="pv-frame" id="f" src="${src}"></iframe></div>
<script>
${m[0]}
var frame=document.getElementById('f');
var pill=mkPagePill(function(){ try{ return frame.contentWindow; }catch(_){ return null; } });
document.body.appendChild(pill);
// openPage's own wiring, including the capture-phase listener that is the only
// thing that hears a box INSIDE the page scrolling.
frame.addEventListener('load', function(){
  try{
    var w=frame.contentWindow, doc=frame.contentDocument;
    if(w && pill._topSync){
      w.addEventListener('scroll', pill._topSync, {passive:true});
      if(doc) doc.addEventListener('scroll', pill._topSync, true);
      pill._topSync();
    }
  }catch(_){}
});
</script>`;

const files = {};
['compare.css', 'compare.js', 'judge.js', 'grid.js', 'page-views.js', 'asset-lightbox.js',
 'playground-port.js', 'asset-actions.js', 'asset-view.js'].forEach((f) => {
  files['/' + f] = [f.endsWith('.css') ? 'text/css' : 'application/javascript',
    fs.readFileSync(path.join(PUB, f), 'utf8')];
});

const server = http.createServer((req, res) => {
  const r = req.url.split('?')[0];
  if (r === '/api/chatfeed/verdict') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"items":{},"texts":{}}');
  }
  const hit = files[r];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  const pages = { '/deck': DECK, '/plain': PLAIN, '/host-deck': host('/deck'), '/host-plain': host('/plain') };
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pages[r] || pages['/host-deck']);
});

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const launch = { args: ['--no-sandbox'] };
  const cands = [process.env.CHROME_PATH, process.env.PW_CHROME,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
  const hit = cands.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } });
  if (hit) launch.executablePath = hit;
  let browser;
  try { browser = await chromium.launch(launch); }
  catch (e) { console.log('no Chromium — skipping (' + e.message.split('\n')[0] + ')'); server.close(); process.exit(0); }

  // her phone: the app's web view, its own bottom bar taken off
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  await page.goto(base + '/host-deck');
  await page.waitForTimeout(2200);
  const fr = page.frames().find((f) => f.url().endsWith('/deck'));

  const before = await fr.evaluate(() => {
    const b = document.querySelector('.jg-piles');
    return {
      piles: !!b,
      over: b ? b.scrollHeight - b.clientHeight : 0,
      doc: document.documentElement.scrollHeight - window.innerHeight,
      top: b ? b.scrollTop : -1,
    };
  });
  ok(before.piles, 'the piles are on screen');
  ok(before.over > 100, `the piles really do overflow (${before.over}px below the fold)`);
  ok(before.doc <= 4, `and the frame's own document has nothing to scroll (${before.doc}px) — `
    + 'a window-only pill has nowhere to go');

  await page.click('.float .ppm');           // play, the way she taps it
  await page.waitForTimeout(900);
  const moved = await fr.evaluate(() => document.querySelector('.jg-piles').scrollTop);
  ok(moved > 10, `tapping the app's pill scrolls the piles (moved ${moved}px)`);
  await page.click('.float .ppm');           // stop

  // the back-to-top watches the box it is driving, not the frame's window
  await fr.evaluate(() => { document.querySelector('.jg-piles').scrollTop = 400; });
  await page.waitForTimeout(250);
  const lit = await page.evaluate(() => document.querySelector('.ptop').classList.contains('on'));
  ok(lit, 'the back-to-top lights on a scrolled piles box');
  // asked rather than clicked blind: on a pill that never adopted the box the
  // button is display:none, and a blind click would hang the run instead of
  // naming the next failure
  if (lit) {
    await page.click('.float .ptop');
    await page.waitForTimeout(700);
    const home = await fr.evaluate(() => document.querySelector('.jg-piles').scrollTop);
    ok(home < 20, `and it takes the piles home (${home}px)`);
  } else {
    ok(false, 'and it takes the piles home — the button never lit, so nothing to tap');
  }

  // ── THE REGRESSION GUARD ────────────────────────────────────────────────
  // A page that scrolls itself must still be scrolled itself: a small inner
  // scroller must never steal the pill from the page behind it.
  await page.goto(base + '/host-plain');
  await page.waitForTimeout(600);
  await page.click('.float .ppm');
  await page.waitForTimeout(900);
  const plain = await page.frames().find((f) => f.url().endsWith('/plain'))
    .evaluate(() => ({ win: window.scrollY, box: document.querySelector('.sheet').scrollTop }));
  ok(plain.win > 10, `an ordinary page still scrolls its own window (${plain.win}px)`);
  ok(plain.box === 0, 'and the inner sheet is left alone');

  await browser.close();
  server.close();
  if (bad) { console.log(`${bad} failed`); process.exit(1); }
  console.log('all checks passed');
  process.exit(0);
});

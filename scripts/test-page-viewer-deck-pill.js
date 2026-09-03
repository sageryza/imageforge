#!/usr/bin/env node
/* THE APP'S PILL STANDS DOWN ON A DECK'S CARD, AND COMES BACK ON THE PILES
 * (2026-09-03, Sophie: "spacing is weird", with a screenshot of the viewer's
 * pill sitting on a deck's top row).
 *
 * A Compare page in the app runs in an IFRAME and the pill she taps lives in
 * the PARENT (chats.html mkPagePill), so page-views' own
 * `.jg-mombg .float{display:none}` — which hides the INJECTED pill — could
 * never reach it. Measured before the fix at 390x844 with her 47px inset: the
 * pill spans y 47-239 over a deck top row at 130-174, and elementFromPoint on
 * the deck's "?" answers the pill's play button. The button was not merely
 * covered: it could not be tapped at all.
 *
 * The card view has nothing to scroll (the deck is a fixed one-screen box), so
 * the pill is asked down there — and BACK on the piles, which is the one
 * screen in a deck that is genuinely long and the autoscroll she asked for on
 * 2026-09-01. That second half is why this cannot simply hide the pill.
 *
 * Every assertion is a MEASUREMENT: a pill that is present and covering a
 * button looks identical to any markup assertion, and that IS the bug.
 *
 *   node scripts/test-page-viewer-deck-pill.js
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

// BOTH halves lifted out of the real page — never a copy.
const mk = chats.match(/function mkPagePill\(getWin\)\{[\s\S]*?\n  return pill;\n\}/);
const hook = chats.match(/window\.__pagePill=function\(show\)\{[\s\S]*?\n  \};/);
if (!mk) { console.log('FAIL could not find mkPagePill in chats.html'); process.exit(1); }
if (!hook) { console.log('FAIL could not find __pagePill in chats.html'); process.exit(1); }

let bad = 0;
const ok = (c, msg) => { console.log((c ? 'PASS: ' : 'FAIL: ') + msg); if (!c) bad += 1; };

const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23c99'/%3E%3C/svg%3E";
const items = [];
for (let i = 0; i < 40; i += 1) items.push({ id: 'c' + i, label: 'card ' + i, img: IMG });

// A GRID-posted page, which is what she was looking at: its swipe view is the
// same deck, and its <h1> is the one page-views now hides per view.
const PAGE = renderTemplatePage({
  template: 'grid', title: 'Hearts v2 (40)', chat: 't', sheet: 'page-x',
  data: { groups: items.map((it) => ({ items: [it] })), browse: true, start: 'swipe' },
});

const files = {};
['compare.css', 'compare.js', 'judge.js', 'grid.js', 'page-views.js', 'asset-lightbox.js',
  'playground-port.js', 'asset-actions.js', 'asset-view.js'].forEach((f) => {
  files['/' + f] = [f.endsWith('.css') ? 'text/css' : 'application/javascript',
    fs.readFileSync(path.join(PUB, f), 'utf8')];
});

// the viewer, as chats.html builds it: a bar, the frame, the parent's pill —
// and her 47px safe-area inset, which is 0 in headless and is what puts the
// pill down onto the deck's own top row.
const host = `<!doctype html><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/compare.css">
<style>html,body{margin:0;height:100%}
.pageview{position:fixed;inset:0;display:flex;flex-direction:column;z-index:40}
.pv-bar{display:flex;align-items:center;gap:10px;padding:47px 12px 8px;border-bottom:1px solid #DDD3C0;flex:none}
.pv-frame{flex:1;width:100%;border:none}
.float{position:fixed;top:47px;right:14px;z-index:9;display:flex;flex-direction:column;gap:8px;align-items:center}
.vseg{display:flex;flex-direction:column;width:48px;border:1.5px solid #26221c;border-radius:999px;overflow:hidden;background:#FFFDF8}
.vseg button{border:none;background:transparent;width:48px;height:52px}
.ptop{display:none}.ptop.on{display:flex}</style>
<div class="pageview"><div class="pv-bar">Hearts v2 (40)</div><iframe class="pv-frame" id="f" src="/page"></iframe></div>
<script>
${mk[0]}
var v=document.querySelector('.pageview');
var frame=document.getElementById('f');
var pill=mkPagePill(function(){ try{ return frame.contentWindow; }catch(_){ return null; } });
v.appendChild(pill);
${hook[0]}
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

const server = http.createServer((req, res) => {
  const r = req.url.split('?')[0];
  if (r.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"items":{},"texts":{},"assets":[],"total":0}');
  }
  const hit = files[r];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(r === '/page' ? PAGE : host);
});

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const exe = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
    .filter(Boolean).find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } });
  let browser;
  try { browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] }); }
  catch (e) { console.log('no Chromium — skipping (' + e.message.split('\n')[0] + ')'); server.close(); process.exit(0); }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base);
  await page.waitForTimeout(2200);
  const fr = page.frames().find((f) => f.url().endsWith('/page'));

  // 1 — the CARD view: the pill is down, and the deck's "?" takes its own tap
  const card = await page.evaluate(() => {
    const f = document.querySelector('#f'); const d = f.contentDocument;
    const ft = f.getBoundingClientRect().top;
    const q = d.querySelector('.jg-momq');
    const b = q && q.getBoundingClientRect();
    const el = b ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2 + ft) : null;
    const h1 = d.querySelector('h1');
    return {
      pill: getComputedStyle(document.querySelector('.float')).display,
      q: !!q,
      qHits: el ? (el.className || el.tagName) + '' : 'none',
      h1w: h1 ? Math.round(h1.getBoundingClientRect().width) : -1,
      deck: d.body.className,
    };
  });
  ok(card.deck.indexOf('jg-mombg') >= 0, 'the swipe view of a grid-posted page really is her deck');
  ok(card.pill === 'none', `the app's pill stands down on the card (display ${card.pill})`);
  ok(card.q, 'the deck draws its own "?"');
  ok(card.qHits.indexOf('pp') !== 0 && card.qHits !== 'float',
    `and the "?" takes its own tap (elementFromPoint → ${card.qHits})`);
  ok(card.h1w === 0, `the page's own title is not drawn over her deck (h1 width ${card.h1w})`);

  // 2 — the PILES: the pill comes back and still drives the box (2026-09-01)
  await fr.evaluate(() => { const b = document.querySelector('[data-act="piles"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const shown = await page.evaluate(() => getComputedStyle(document.querySelector('.float')).display);
  ok(shown !== 'none', `and it comes back on the piles (display ${shown})`);
  const over = await fr.evaluate(() => {
    const b = document.querySelector('.jg-piles');
    return b ? b.scrollHeight - b.clientHeight : 0;
  });
  ok(over > 100, `the piles really do overflow (${over}px below the fold)`);
  await page.click('.float .ppm');
  await page.waitForTimeout(900);
  const moved = await fr.evaluate(() => document.querySelector('.jg-piles').scrollTop);
  ok(moved > 10, `and tapping it still scrolls them (moved ${moved}px)`);
  await page.click('.float .ppm');

  // 3 — the COMPARE view: it scrolls, so the pill and the title are both its own
  await fr.evaluate(() => { const b = document.querySelectorAll('.pv button')[1]; if (b) b.click(); });
  await page.waitForTimeout(900);
  const cmp = await page.evaluate(() => {
    const d = document.querySelector('#f').contentDocument;
    const h1 = d.querySelector('h1');
    return {
      pill: getComputedStyle(document.querySelector('.float')).display,
      h1w: h1 ? Math.round(h1.getBoundingClientRect().width) : -1,
    };
  });
  ok(cmp.pill !== 'none', `the compare view gets the pill back (display ${cmp.pill})`);
  ok(cmp.h1w > 100, `and its own heading (h1 width ${cmp.h1w})`);

  console.log(bad ? `\n${bad} failure(s)` : '\nall checks passed');
  await browser.close(); server.close(); process.exit(bad ? 1 : 0);
});

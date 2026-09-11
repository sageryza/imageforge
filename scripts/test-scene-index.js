#!/usr/bin/env node
/* THE SCENES-INDEX KIT (2026-09-10) — /scene-index.js driven on the REAL
 * three shapes: a bare page (Ticky Tack, neither half), a page that already
 * has its own footage keys (the ward film), and one that already has its own
 * fold and rail (the Nautchaug Boyfriend's).
 *
 * EVERY ASSERTION IS A MEASUREMENT. A fold that adds a class and hides
 * nothing, a rail button that scrolls the wrong way, a second set of footage
 * keys stacked on the ward page's own, and a hand-off carrying the ORIGINAL
 * belt text instead of what she has since typed all pass any markup assertion
 * ever written about them.
 *
 *   node scripts/test-scene-index.js
 *   node scripts/test-scene-index.js --live   # the real posted pages too
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const servePublic = require('./lib/public-asset');

const BELT = 'BELTPAGEID01';
// The three chapters and their tiles, exactly the shape all three pages share:
// a .grid whose children are chapter headings and keys, each key an <a class="b">
// pointing at a card on a belt page.
const CH = [
  { head: 'Part one — the city', keys: ['storm', 'city', 'taxi'] },
  { head: 'The ward — the pills', keys: ['pills', 'cup'] },
  { head: 'Five moments with Thomas that must stay', keys: ['ducks'] },
];
let n = 0;
const keyId = (w) => 'p1-' + w;
function tiles(wrapCell) {
  const out = [];
  CH.forEach((c) => {
    out.push('<p class="ep">' + c.head + '</p>');
    c.keys.forEach((w) => {
      n += 1;
      const a = '<a class="b" href="/api/chatfeed/page/' + BELT + '#j-' + keyId(w) + '"'
        + ' aria-label="' + n + ' · The ' + w + ' scene" title="' + n + ' · The ' + w + ' scene">'
        + '<svg viewBox="0 0 24 24"></svg><span>' + w + '</span></a>';
      out.push(wrapCell ? '<div class="cell">' + a + '</div>' : a);
    });
  });
  return out.join('\n');
}
const HEAD = '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + '<link rel="stylesheet" href="/compare.css">\n<style>\n'
  + ':root{--cols:5;--tile:#cfe3f2;--edge:#98bcd8;--tileink:#12212b}\n'
  + '.grid{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:11px 6px;margin-right:64px}\n'
  + '.b{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;'
  + 'background:var(--tile);border:1.5px solid var(--tileink);border-radius:8px;color:var(--tileink);text-decoration:none}\n'
  + '.b span{font:700 8px/1 sans-serif;text-transform:uppercase}\n'
  + '.ep{grid-column:1/-1;font:700 10px/1.2 sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6b6255;margin:14px 0 0}\n'
  + '.ep:first-child{margin-top:2px}\n';
const TAIL = '<script src="/compare.js"></script>\n<script src="/scene-index.js"></script>\n';

// TICKY TACK — neither half.
function bare() {
  n = 0;
  return HEAD + '</style>\n<div class="wrap">\n<h1>Ticky Tack — the scenes v2</h1>\n'
    + '<div class="grid">' + tiles(false) + '</div>\n<div style="height:1400px"></div></div>\n' + TAIL
    + '<script>(function(){window.__compareHelp({html:"<p>Every scene that has to be shot.</p>"});})();</script>\n';
}
// THE WARD FILM — its own footage keys already in the markup, its own CSS.
function ward() {
  n = 0;
  const t = tiles(true).replace(/<\/a><\/div>/g, (m, i) => m);
  const withFf = t.replace(/(<a class="b" href="\/api\/chatfeed\/page\/([A-Za-z0-9]+)#j-([a-z0-9-]+)"[\s\S]*?<\/a>)/g,
    (m, a, page, key) => a + '<a class="ff" href="https://x/footage" target="_blank" rel="noopener"'
      + ' data-page="' + page + '" data-key="' + key + '" title="Send to Footage"><svg viewBox="0 0 24 24"></svg></a>');
  return HEAD
    + '.cell{position:relative}\n.cell .b{width:100%;box-sizing:border-box;padding-top:9px}\n'
    + '.ff{position:absolute;top:2px;right:2px;width:16px;height:16px;display:flex;align-items:center;'
    + 'justify-content:center;background:#fff;border:1.5px solid var(--tileink);border-radius:4px}\n'
    + '.ff svg{width:10px;height:10px;display:block}\n</style>\n'
    + '<div class="wrap">\n<h1>The ward film — the scenes v3</h1>\n'
    + '<div class="grid">' + withFf + '</div>\n<div style="height:1400px"></div></div>\n' + TAIL;
}
// THE NAUTCHAUG BOYFRIEND'S — its own fold and rail already wired.
function nautch() {
  n = 0;
  let body = '';
  let i = -1;
  CH.forEach((c) => {
    i += 1;
    body += '<button class="ep" type="button" data-ch="' + i + '" data-tag="E' + (i + 1) + '" data-name="OWN"'
      + ' aria-expanded="true"><svg class="epv" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>'
      + '<span class="epc">' + c.keys.length + ' scenes</span>' + c.head + '</button>';
    c.keys.forEach((w) => {
      n += 1;
      body += '<a class="b" href="/api/chatfeed/page/' + BELT + '#j-' + keyId(w) + '"'
        + ' title="' + n + ' · The ' + w + ' scene"><svg viewBox="0 0 24 24"></svg><span>' + w + '</span></a>';
    });
  });
  return HEAD
    + '.rail{position:fixed;right:6px;bottom:10px;width:56px;z-index:8;display:flex;flex-direction:column;gap:5px}\n'
    + '.rl{min-height:38px;background:#f0eadf;border:1px solid #d9d2c4;border-radius:6px}\n'
    + '.b.hid{display:none}\n.ep.shut .epc{display:inline}\n</style>\n'
    + '<div class="wrap">\n<h1>The Nautchaug Boyfriend&#x27;s — the scenes v6</h1>\n'
    + '<div class="grid">' + body + '</div>\n<div style="height:1400px"></div></div>\n' + TAIL
    // its own rail AND its own fold, the way the live page has them: the fold
    // holds references to the bare <a class="b"> and toggles `hid` on THEM,
    // which is the case the kit's wrapper has to survive
    + '<script>(function(){var g=document.querySelector(".grid");'
    + 'var heads=[].slice.call(document.querySelectorAll(".ep"));'
    + 'var own=heads.map(function(){return [];}),at=-1;'
    + '[].slice.call(g.children).forEach(function(el){if(el.classList.contains("ep"))at=+el.dataset.ch;'
    + 'else if(at>=0&&el.classList.contains("b"))own[at].push(el);});'
    + 'heads.forEach(function(h,i){h.addEventListener("click",function(){'
    + 'var on=!h.classList.contains("shut");h.classList.toggle("shut",on);'
    + 'own[i].forEach(function(b){b.classList.toggle("hid",on);});});});'
    + 'var r=document.createElement("div");r.className="rail";'
    + 'heads.forEach(function(h){var b=document.createElement("button");'
    + 'b.className="rl";b.textContent=h.dataset.tag;r.appendChild(b);});document.body.appendChild(r);})();</script>\n';
}

// THE BELT the keys read. Its own text is what the chat wrote; HER edit lives
// on the verdict sheet, and the page fills its boxes from there at runtime —
// which never happens in a document the kit only parsed. So the sheet has to
// win, and a fixture that agrees with the html cannot prove it.
function belt() {
  const cards = [];
  CH.forEach((c) => c.keys.forEach((w) => {
    const k = keyId(w);
    cards.push('<section class="card" id="j-' + k + '" data-key="' + k + '" data-item="' + k + '">'
      + '<h2>The ' + w + ' scene</h2>'
      + '<details class="text"><summary>header lines</summary>'
      + '<textarea class="p" data-key="' + k + '" data-field="mine">setting: the ' + w + '.</textarea></details>'
      + '<details class="text" open><summary>your words</summary>'
      + '<textarea class="p" data-key="' + k + '">ORIGINAL words for ' + w + '</textarea></details>'
      + '<div class="attached"><div class="row"><label>seconds '
      + '<input class="secs" data-key="' + k + '" value="4"></label></div>'
      + (w === 'storm'
        ? '<div class="refs"><figure><img src="https://s/img2.png"><figcaption>image 2 — the second one</figcaption></figure>'
          + '<figure><img src="https://s/img1.png"><figcaption>image 1 — the first one</figcaption></figure></div>'
        : '<script type="application/json" class="refjson" data-key="' + k + '">'
          + JSON.stringify([{ url: 'https://s/' + w + '.png', kind: 'image', name: w + ' ref' }]) + '</scr' + 'ipt>')
      + '</div></section>');
  }));
  return '<meta charset="utf-8"><div class="wrap"><h1>The belt</h1>' + cards.join('') + '</div>'
    + '<script>var CHAT=\'a-belt-chat\', SHEET=\'belt-fixture\', LIMIT=8000;\nvar PROJECT=\'ward\';</script>';
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

const SHEET_TEXTS = {
  // what she has typed since the page was posted — the seconds too
  'p1-storm': 'HER edited words for storm',
  'p1-storm.s': '9',
};

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const html = (h) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(h); };
  if (url.pathname === '/api/chatfeed/verdict') {
    return json(url.searchParams.get('sheet') === 'belt-fixture'
      ? { ok: true, texts: SHEET_TEXTS } : { ok: true, texts: {} });
  }
  if (url.pathname === '/api/chatfeed/page/' + BELT) return html(belt());
  if (url.pathname === '/footage') return html('<h1>Footage</h1>');
  if (url.pathname === '/bare') return html(bare());
  if (url.pathname === '/ward') return html(ward());
  if (url.pathname === '/nautch') return html(nautch());
  res.writeHead(404); res.end('nope');
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = (() => {
    if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
    for (const k of (() => { try { return fs.readdirSync('/opt/pw-browsers'); } catch { return []; } })()
      .filter((x) => /^chromium-\d/.test(x))) {
      const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ok(false, 'page error: ' + e.message));

  const shown = () => page.evaluate(() => [].slice.call(document.querySelectorAll('.grid a.b'))
    .filter((a) => a.getBoundingClientRect().height > 0).length);
  const railWords = () => page.evaluate(() => [].slice.call(document.querySelectorAll('.rail .rl'))
    .map((b) => (b.querySelector('b') ? b.querySelector('b').textContent : b.textContent)
      + (b.querySelector('i') ? '/' + b.querySelector('i').textContent : '')));

  // ── 1. TICKY TACK: a page with neither half gets both ───────────────────
  await page.goto(base + '/bare');
  await page.waitForTimeout(350);
  ok(await page.evaluate(() => document.querySelectorAll('.grid button.ep').length) === 3,
    'bare: every chapter heading became a real button');
  ok(await page.evaluate(() => document.querySelectorAll('.grid .ff').length) === 6,
    'bare: a footage key on every one of the six tiles');
  ok(await page.evaluate(() => document.querySelectorAll('.grid .cell').length) === 6,
    'bare: each key is wrapped in its own .cell');
  const rw = await railWords();
  ok(rw.length === 3, 'bare: a rail button per chapter (' + rw.length + ')');
  ok(rw[0] === 'CITY/PART ONE', 'bare: "Part one — the city" reads CITY over PART ONE (' + rw[0] + ')');
  ok(rw[1] === 'PILLS/WARD', 'bare: "The ward — the pills" reads PILLS over WARD (' + rw[1] + ')');
  // a phrase too long for a 56px key is boiled down to its LONGEST word, and
  // the rest hangs under it — the difference between a rail of words and a
  // rail of "FIVE MOM…"
  ok(rw[2] === 'MOMENTS/WITH THOMAS THAT MUST STAY',
    'bare: a long heading with no dash keeps its one distinctive word (' + rw[2] + ')');
  const cut = await page.evaluate(() => [].slice.call(document.querySelectorAll('.rail .rl b'))
    .filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
  ok(cut.length === 0, 'bare: no rail label is cut off (' + cut.join(', ') + ')');

  // the key is a real tap target that does not overflow its tile
  const geo = await page.evaluate(() => {
    const c = document.querySelector('.grid .cell'), f = c.querySelector('.ff');
    const cr = c.getBoundingClientRect(), fr = f.getBoundingClientRect();
    const hit = document.elementFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2);
    return { inside: fr.right <= cr.right + 1 && fr.top >= cr.top - 1, hit: hit && hit.className,
      w: cr.width, right: document.querySelector('.grid').getBoundingClientRect().right };
  });
  ok(geo.inside, 'bare: the key sits inside its own tile, never over the neighbour');
  ok(/ff/.test(geo.hit || ''), 'bare: a tap at the key\'s centre reaches the key (' + geo.hit + ')');
  ok(geo.right <= 390 - 64 + 1, 'bare: the grid still ends before the pill\'s column (' + geo.right + ')');

  // the fold really hides tiles, and says how many while it is shut
  ok(await shown() === 6, 'bare: all six keys show to start');
  await page.click('.grid button.ep');
  await page.waitForTimeout(120);
  ok(await shown() === 3, 'bare: folding chapter one hides its three keys (' + (await shown()) + ' left)');
  ok(await page.evaluate(() => document.querySelector('.grid button.ep .epc').textContent) === '3 scenes',
    'bare: a shut heading says how many are under it');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.grid button.ep .epc')).display) !== 'none',
    'bare: the count is painted while it is shut');
  // it is remembered under the page's NAME, so a re-post keeps her folds
  await page.reload();
  await page.waitForTimeout(350);
  ok(await shown() === 3, 'bare: the fold is remembered across a reload');
  ok(await page.evaluate(() => Object.keys(localStorage).some((k) => /^sceneindex\.shut\.ticky-tack/.test(k))),
    'bare: remembered under the page title, not its url');
  await page.click('.grid button.ep');
  await page.waitForTimeout(120);
  ok(await shown() === 6, 'bare: tapping the heading again brings them back');

  // the rail jumps — and it OPENS a chapter she had folded before going there
  await page.click('.grid button.ep');            // shut chapter one again
  await page.waitForTimeout(120);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.rail .rl:nth-child(3)');
  await page.waitForTimeout(600);
  const jumped = await page.evaluate(() => ({
    y: window.scrollY,
    top: document.querySelectorAll('.grid button.ep')[2].getBoundingClientRect().top,
  }));
  ok(jumped.y > 40, 'bare: the rail really moved the page (y ' + jumped.y + ')');
  ok(Math.abs(jumped.top - 14) < 6, 'bare: it lands the chapter 14px down (' + Math.round(jumped.top) + ')');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.rail .rl:nth-child(1)');
  await page.waitForTimeout(400);
  ok(await shown() === 6, 'bare: jumping to a folded chapter opens it on the way');

  // ── 2. the hand-off it writes ───────────────────────────────────────────
  const hand = await page.evaluate(async () => {
    localStorage.removeItem('footage_handoff');
    const a = document.querySelector('.grid .cell .ff');
    a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 60; i += 1) {
      const v = localStorage.getItem('footage_handoff');
      if (v) return JSON.parse(v);
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  });
  ok(!!hand, 'hand-off: the tap wrote footage_handoff');
  ok(hand && /HER edited words for storm/.test(hand.prompt),
    'hand-off: HER edit off the sheet wins over the posted html');
  ok(hand && /^setting: the storm\./.test(hand.prompt),
    'hand-off: the header lines lead her words');
  ok(hand && hand.seconds === 9, 'hand-off: the seconds come off the sheet too (' + (hand && hand.seconds) + ')');
  ok(hand && hand.model === 'mini' && hand.res === '480p' && hand.ratio === '16:9',
    'hand-off: Mini · 480p · 16:9');
  ok(hand && hand.from === 'a-belt-chat', 'hand-off: it names the belt\'s own chat (' + (hand && hand.from) + ')');
  ok(hand && hand.project === 'ward', 'hand-off: a belt that declares PROJECT hands it over (' + (hand && hand.project) + ')');
  ok(hand && /storm/.test(hand.title || '') && !/^1 · /.test(hand.title || ''),
    'hand-off: the title is the scene, without its number (' + (hand && hand.title) + ')');
  ok(hand && hand.refs.length === 2 && /img1/.test(hand.refs[0].url),
    'hand-off: scraped references come back IN SLOT ORDER, image 1 first');
  ok(hand && hand.refs[0].name === 'the first one',
    'hand-off: the slot is stripped off the reference name (' + (hand && hand.refs[0].name) + ')');

  const hand2 = await page.evaluate(async () => {
    localStorage.removeItem('footage_handoff');
    const a = document.querySelectorAll('.grid .cell .ff')[3];   // a card with refjson
    a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 60; i += 1) {
      const v = localStorage.getItem('footage_handoff');
      if (v) return JSON.parse(v);
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  });
  ok(hand2 && hand2.refs.length === 1 && /pills\.png/.test(hand2.refs[0].url),
    'hand-off: a belt that publishes its refs as JSON is read from that');
  ok(hand2 && /ORIGINAL words for pills/.test(hand2.prompt),
    'hand-off: a card she has not edited keeps the belt\'s own words');
  ok(hand2 && hand2.seconds === 4, 'hand-off: and its own seconds (' + (hand2 && hand2.seconds) + ')');

  // ── 3. THE WARD FILM: its own footage keys are left alone ───────────────
  await page.goto(base + '/ward');
  await page.waitForTimeout(350);
  ok(await page.evaluate(() => document.querySelectorAll('.grid .ff').length) === 6,
    'ward: its own six footage keys, not twelve');
  ok(await page.evaluate(() => document.querySelectorAll('.grid .cell').length) === 6,
    'ward: no second .cell wrapped around anything');
  ok(await page.evaluate(() => document.querySelectorAll('.grid button.ep').length) === 3,
    'ward: it gains the chapter fold');
  ok((await railWords()).length === 3, 'ward: it gains the rail');
  ok(await page.evaluate(() => !!document.getElementById('sx-ff-css')) === false,
    'ward: the kit does not inject footage CSS over the page\'s own');

  // ── 4. THE NAUTCHAUG PAGE: its own fold and rail are left alone ─────────
  await page.goto(base + '/nautch');
  await page.waitForTimeout(350);
  ok(await page.evaluate(() => document.querySelectorAll('.rail').length) === 1,
    'nautch: one rail, not two');
  ok(await page.evaluate(() => document.querySelectorAll('.grid button.ep').length) === 3
    && await page.evaluate(() => !document.getElementById('sx-fold-css')),
    'nautch: its own fold is left alone');
  ok((await railWords())[0] === 'E1', 'nautch: its own rail words survive (' + (await railWords())[0] + ')');
  ok(await page.evaluate(() => document.querySelectorAll('.grid .ff').length) === 6,
    'nautch: it gains a footage key on every tile');
  ok(await page.evaluate(() => document.querySelectorAll('.grid .cell').length) === 6,
    'nautch: its bare tiles get wrapped');
  // THE WRAPPER FOLLOWS ITS OWN TILE DOWN. Its fold hides the <a>, not the
  // wrapper this kit put around it — without the `:has()` rule a folded
  // chapter is a row of empty grid cells, which every markup assertion passes.
  const before = await page.evaluate(() => document.querySelector('.grid').getBoundingClientRect().height);
  await page.click('.grid .ep');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    h: document.querySelector('.grid').getBoundingClientRect().height,
    cells: [].slice.call(document.querySelectorAll('.grid .cell'))
      .filter((c) => c.getBoundingClientRect().height > 0).length,
  }));
  ok(after.cells === 3, 'nautch: its own fold still hides three tiles through the wrapper ('
    + after.cells + ' cells still standing)');
  ok(after.h < before - 20, 'nautch: and the grid really got shorter ('
    + Math.round(before) + ' → ' + Math.round(after.h) + ')');

  // ── 5. the live pages, on request ───────────────────────────────────────
  if (process.argv.includes('--live')) {
    const B = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
    for (const chat of ['ward-film-page-duplicate', 'new-script-draft', 'icon-styling-beige-3d',
      'ticky-tack-film-page-dupe']) {
      const d = await (await fetch(B + '/api/chatfeed/pages?chat=' + chat)).json();
      for (const p of (Array.isArray(d) ? d : d.pages || [])) {
        if (p.superseded) continue;
        const h = await (await fetch(B + '/api/chatfeed/page/' + p.id)).text();
        if (!/class="grid"/.test(h) || !/<a class="b"[^>]*#j-/.test(h)) continue;
        ok(h.includes('/scene-index.js'), 'live: ' + p.title + ' links the kit');
      }
    }
  }

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();

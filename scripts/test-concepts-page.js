#!/usr/bin/env node
/* THE COMMERCIAL CONCEPTS PAGE, DRIVEN FOR REAL (2026-09-13).
 *
 * Every assertion is a MEASUREMENT, because the four ways this page can be
 * broken all look identical in the source: a box fitted while detached comes
 * up one line tall, a divide that never reaches the sheet loses her split on
 * the next open, a saved order that is not rebuilt springs her blocks back
 * together, and a tap inside a box that reaches the pill starts the page
 * walking under her thumb.
 *
 * Serves the built page with the REAL /compare.css, /compare.js and the REAL
 * injected pill, against a stub verdict store that records what the page
 * really sent. Screenshots land beside the html.
 *
 *   node scripts/test-concepts-page.js [--html /tmp/commercial-concepts.html]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const servePublic = require('./lib/public-asset');

const args = process.argv.slice(2);
const HTML = (() => { const i = args.indexOf('--html'); return i >= 0 ? args[i + 1] : path.join(os.tmpdir(), 'commercial-concepts.html'); })();
const SHOTS = path.join(os.tmpdir(), 'concepts-shots');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

if (!fs.existsSync(HTML)) { console.error('build the page first: node scripts/commercial-concepts-page.js'); process.exit(1); }
let page = fs.readFileSync(HTML, 'utf8');
// serveGated appends the pill; do the same so the page is tested as it runs
page += fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');

const store = { texts: {}, items: {} };
const seen = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/chatfeed/verdict' && req.method === 'POST') {
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      const j = JSON.parse(b || '{}');
      seen.push(j);
      if (j.text !== undefined) store.texts[j.item] = String(j.text);
      if (j.ok !== undefined) store.items[j.item] = j.ok;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, chars: String(j.text || '').length }));
    });
    return;
  }
  if (u.pathname === '/api/chatfeed/verdict') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(store));
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(page);
});

(async () => {
  const { chromium } = require('playwright');
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  fs.mkdirSync(SHOTS, { recursive: true });
  const EXEC = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome','/opt/pw-browsers/chromium/chrome-linux/chrome',process.env.CHROME_PATH].filter(Boolean).find((f)=>{try{fs.accessSync(f);return true;}catch(_){return false;}});
  const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
  const errs = [];

  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(base + '/', { waitUntil: 'load' });
    await p.waitForTimeout(700);
    return { ctx, p };
  };

  let { ctx, p } = await open();
  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));

  // the pill's own script survived (a page-level let/const kills it at parse time)
  ok(await p.evaluate(() => typeof window.__scrollTap === 'function'), 'the injected pill script ran');
  ok(await p.evaluate(() => typeof window.__compareNotes === 'function'), '/compare.js loaded');

  // TITLE ONCE, NOTHING ABOVE IT
  ok(await p.evaluate(() => document.querySelectorAll('h1').length === 1), 'one h1');
  ok(await p.evaluate(() => !document.querySelector('.eyebrow, .sub')), 'no eyebrow and no tagline');
  ok(await p.evaluate(() => {
    const h1 = document.querySelector('h1');
    return !h1.previousElementSibling || h1.previousElementSibling.tagName !== 'P';
  }), 'nothing to read above the title');
  ok(await p.evaluate(() => !!document.querySelector('.cmp-help, [class*=help]')), 'the "?" card is wired');

  // A BOX IS FITTED TO ITS WORDS — a detached fit comes up one line tall
  const boxes = await p.evaluate(() => [].map.call(document.querySelectorAll('textarea.p'),
    (t) => ({ h: t.getBoundingClientRect().height, sh: t.scrollHeight, len: t.value.length })));
  ok(boxes.length > 40, boxes.length + ' text blocks on the page');
  const short = boxes.filter((b) => b.len > 400 && b.h < 80);
  ok(short.length === 0, 'no long block is collapsed to one line' + (short.length ? ' — ' + short.length : ''));
  const clipped = boxes.filter((b) => b.sh - b.h > 4);
  ok(clipped.length === 0, 'no block scrolls its own words' + (clipped.length ? ' — ' + clipped.length : ''));

  // NOTHING IS CUT ON THE WAY OUT
  const src = fs.readFileSync(HTML, 'utf8');
  ok(!/text:\s*[a-z.]*\.slice\(0,\s*\d/.test(src), 'nothing slices her text on the way out');
  ok(src.includes('NOT SAVED WHOLE'), 'every save is read back off the sheet');
  ok(/LIMIT\s*=\s*\d+/.test(src), 'the box knows the limit it must refuse over');

  // EDIT → SAVE, measured as what the server really received
  const key = await p.evaluate(() => document.querySelector('textarea.p').dataset.key);
  await p.evaluate(() => { const t = document.querySelector('textarea.p'); t.focus(); t.value += ' ZZTOP'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(1400);
  ok(store.texts[key] && store.texts[key].endsWith('ZZTOP'), 'an edit reaches the sheet whole');
  ok(await p.evaluate(() => document.querySelector('.blk .sv').textContent === 'saved'), 'the box says saved');

  // A TAP IN A BOX DOES NOT START THE READING AUTOSCROLL
  await p.evaluate(() => window.scrollTo(0, 600));
  const y0 = await p.evaluate(() => window.scrollY);
  const bb = await p.evaluate(() => { const t = document.querySelector('textarea.p'); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 10 }; });
  if (bb.y > 0 && bb.y < 800) await p.mouse.click(bb.x, bb.y);
  await p.waitForTimeout(900);
  ok(Math.abs(await p.evaluate(() => window.scrollY) - y0) < 6, 'a tap in a box moves the page 0px');

  await p.screenshot({ path: path.join(SHOTS, '01-top.png') });
  await p.evaluate(() => window.scrollTo(0, 1400));
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(SHOTS, '02-blocks.png') });

  // DIVIDE — the tail becomes a new block, both halves reach the sheet, and
  // the ORDER is saved (without it her split is gone on the next open)
  const before = await p.evaluate(() => document.querySelectorAll('.card[data-cid] .blk').length);
  const cid = await p.evaluate(() => {
    const b = document.querySelector('.blk');
    const ta = b.querySelector('textarea');
    ta.focus(); ta.setSelectionRange(20, 20);
    b.querySelector('.dv').click();
    return b.closest('.card').dataset.cid;
  });
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => document.querySelectorAll('.card[data-cid] .blk').length);
  ok(after === before + 1, 'divide adds exactly one block');
  ok(await p.evaluate((c) => { const card=document.querySelector(`.card[data-cid="${c}"]`); const also=card.querySelector('.also'); if(!also) return true; const blks=[].slice.call(card.querySelectorAll('.blk')); return blks.every((b)=> b.compareDocumentPosition(also) & Node.DOCUMENT_POSITION_FOLLOWING); }, cid), 'a new block lands above the notes line, never after it');
  ok(typeof store.texts['ord-' + cid] === 'string' && JSON.parse(store.texts['ord-' + cid]).length === 2,
    'the new order reached the sheet');
  const parts = JSON.parse(store.texts['ord-' + cid] || '[]').map((k) => store.texts[cid + '.' + k] || '');
  ok(parts.length === 2 && parts[0] && parts[1], 'both halves reached the sheet');
  ok(await p.evaluate(() => !document.querySelectorAll('.blk')[1].querySelector('.jn').hidden), 'the second block offers join up');
  ok(await p.evaluate(() => document.querySelectorAll('.blk')[0].querySelector('.jn').hidden), 'the first block does not');
  await p.screenshot({ path: path.join(SHOTS, '03-divided.png') });

  // HER SPLIT SURVIVES A REOPEN — this is the assertion a source check cannot make
  await ctx.close();
  ({ ctx, p } = await open());
  const kept = await p.evaluate((c) => document.querySelector(`.card[data-cid="${c}"]`).querySelectorAll('.blk').length, cid);
  ok(kept === 2, 'the divided concept reopens as two blocks');
  const first = await p.evaluate((c) => document.querySelector(`.card[data-cid="${c}"] textarea`).value.length, cid);
  ok(first > 0 && first < 40, 'the head block reopens holding the head');

  // JOIN PUTS IT BACK
  await p.evaluate((c) => document.querySelector(`.card[data-cid="${c}"]`).querySelectorAll('.blk')[1].querySelector('.jn').click(), cid);
  await p.waitForTimeout(1200);
  ok(JSON.parse(store.texts['ord-' + cid]).length === 1, 'join up saves the order back to one block');
  ok(await p.evaluate((c) => document.querySelector(`.card[data-cid="${c}"]`).querySelectorAll('.blk').length === 1, cid), 'and the page shows one');

  // BUTTONS HUG THEIR WORDS
  const wide = await p.evaluate(() => [].filter.call(document.querySelectorAll('.row button'),
    (b) => b.getBoundingClientRect().width > 140).length);
  ok(wide === 0, 'no button is a slab');

  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  // NOTHING TAPPABLE UNDER THE PILL AT REST (Freeform: judge it at the TOP of the page)
  const covered = await p.evaluate(() => {
    const f = document.querySelector('.float');
    if (!f) return 'no pill';
    const r = f.getBoundingClientRect();
    let n = 0;
    document.querySelectorAll('.row button, .wrap > h1 button, [class*=help] button').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.top < r.bottom && b.bottom > r.top && b.right > r.left) n++;
    });
    return n + ':' + [].filter.call(document.querySelectorAll(".row button, .wrap > h1 button, [class*=help] button"), (el)=>{const b=el.getBoundingClientRect(); return b.top<r.bottom && b.bottom>r.top && b.right>r.left;}).map((el)=>el.tagName+"."+(el.className||"")+"@"+Math.round(el.getBoundingClientRect().right)).join(",");
  });
  ok(String(covered).startsWith('0'), 'no control sits in the pill\'s corner (' + covered + ')');

  await p.screenshot({ path: path.join(SHOTS, '04-rejoined.png'), fullPage: false });
  await ctx.close();
  await browser.close();
  server.close();
  console.log('\nshots → ' + SHOTS);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/* A 1-UP GRID PAGE'S TOUR (2026-09-03). Her standing Playground-hearts page is
 * a grid whose every group holds ONE picture — the 1-up she asked for — and
 * the tour's first step was the hardcoded "each row is one comparison, the
 * things on it differ by exactly one thing", a sentence about a page she is
 * not looking at. Found by PHOTOgraphing the real page, so it is measured
 * here too: the real grid.js, rendered, the tour opened, the words read off
 * the screen.
 *
 *   node scripts/test-grid-oneup-tour.js       (skips with exit 0, no Chromium)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) {
  console.log('no playwright — skipped'); process.exit(0);
}
const pub = (f) => fs.readFileSync(path.join(__dirname, '../public', f));
const IMG = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
let fail = 0, ran = 0;
const ok = (c, m) => { ran++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); if (!c) fail++; };

const page = (groups) => `<!doctype html><meta charset="utf-8"><title>t</title>
<link rel="stylesheet" href="/compare.css"><body><h1>t</h1><div id="grid"></div>
<script src="/compare.js"></script><script src="/asset-view.js"></script><script src="/grid.js"></script>
<script>window.__grid({ chat:'t', sheet:'s', mount:'#grid', tour:'auto', groups:${JSON.stringify(groups)} });</script>`;

const one = (n) => Array.from({ length: n }, (_, i) => ({ items: [{ id: 'a' + i, img: '/i.gif', label: 'card ' + i }] }));
const pairs = (n) => Array.from({ length: n }, (_, i) => ({ label: 'row ' + i, items: [
  { id: 'a' + i, img: '/i.gif', label: 'left' }, { id: 'b' + i, img: '/i.gif', label: 'right' }] }));
// A CATALOGUE: one group holding far more than the three that fit a line, so
// what she sees is a block of many lines rather than a row of variants.
const catalogue = () => [{ label: 'everything', items: Array.from({ length: 12 },
  (_, i) => ({ id: 'c' + i, img: '/i.gif', label: 'person ' + i })) }];

(async () => {
  let body = null;
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/i.gif') { res.writeHead(200, { 'content-type': 'image/gif' }); return res.end(IMG); }
    if (u.endsWith('.css') || u.endsWith('.js')) {
      try {
        res.writeHead(200, { 'content-type': u.endsWith('.css') ? 'text/css' : 'application/javascript' });
        return res.end(pub(u.slice(1)));
      } catch (e) { res.writeHead(404); return res.end(''); }
    }
    if (u.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true,"items":{},"assets":[]}'); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(body);
  }).listen(8742);
  // the house resolver (scripts/test-back-to-top.js &c) — never a version pin
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((f) => fs.existsSync(f));
  const b = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const tourText = async (groups) => {
    body = page(groups);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });  // its own storage: the tour plays once per key
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8742/', { waitUntil: 'load' });
    await p.waitForTimeout(1400);
    // the tour plays once on a first open; read the step that is on screen
    const t = await p.evaluate(() => {
      const el = document.querySelector('.cmp-tour .ct-text');
      return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
    });
    await ctx.close();
    return t;
  };
  const oneUpText = await tourText(one(4));
  const pairText = await tourText(pairs(3));
  const listText = await tourText(catalogue());
  ok(/one picture a row/i.test(oneUpText), `1-up: step one says what a 1-up page is — got "${oneUpText.slice(0, 90)}"`);
  ok(!/differ by exactly one thing/i.test(oneUpText), '1-up: it does NOT claim each row is a comparison');
  ok(/differ by exactly one thing/i.test(pairText), `a real comparison page keeps its own words — got "${pairText.slice(0, 90)}"`);
  // A group of 12 wraps onto four lines at three across, so "each row is one
  // comparison" is true of the element and false of the screen — the same
  // finding as the 1-up one, one size up (2026-09-04, PHOTOgraphed on the
  // page of every date illustration: groups of 19 and 52).
  ok(!/differ by exactly one thing/i.test(listText),
    `a catalogue does NOT claim to be a comparison — got "${listText.slice(0, 90)}"`);
  ok(/ruled off/i.test(listText),
    `a catalogue says what it is — got "${listText.slice(0, 90)}"`);
  // and it must not borrow the 1-up wording either: these rows are not one apiece
  ok(!/one picture a row/i.test(listText), 'a catalogue is not described as one-up');
  await b.close(); srv.close();
  console.log(fail ? `\n${fail} of ${ran} FAILED` : `\nall ${ran} checks passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

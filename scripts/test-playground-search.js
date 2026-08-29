#!/usr/bin/env node
/*
 * test-playground-search.js — the Playground's search bar (Aug 2026, Sophie:
 * "can u add a little search bar that fits in the space between the heart
 * toggle (next to tiles/grid) on the playground").
 *
 * Two halves.
 *
 * The PURE half runs the server's own matcher, lifted out of server.js by
 * source rather than re-implemented: the house grammar (AND / OR / -exclude /
 * "phrase"), word-start anchoring, and the haystack — which is pinned against
 * the PAGE's own `runHay`, because the page filters the loaded runs instantly
 * while the server answers over the whole history, and two haystacks that
 * disagree would make the view change under her a beat after she typed.
 *
 * The HEADLESS half drives the real promptlab.html at 390pt:
 *   - the row still fits on ONE LINE, and the box sits in the gap it was asked
 *     for — right of the heart, left of the 56px the autoscroll pill owns.
 *     (`isVisible` is not the question: the canvas toggle was "visible" while
 *     clipped off the row. Measure the boxes.)
 *   - 16px input, the iOS auto-zoom floor this page's user-scalable=no makes
 *     unrecoverable.
 *   - typing filters, Return runs it, the ✕ clears without dismissing.
 *   - the server is asked, and its answer can carry a run the feed never paged
 *     in — the Assets tab's lesson, which is the whole reason this is not a
 *     filter over what happens to be loaded.
 *
 *   node scripts/test-playground-search.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const searchGrammar = require(path.join(ROOT, 'search-grammar'));

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// Lift a function out of server.js by source, so this tests the real one.
function lift(name) {
  const i = serverSrc.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no such function in server.js: ' + name);
  const body = serverSrc.slice(i);
  return body.slice(0, body.indexOf('\n}\n') + 2);
}
// A const the lifted functions close over — same rule as the functions: the
// real line out of server.js, never a second copy of the values.
function liftConst(name) {
  const m = new RegExp('^const ' + name + ' = .*;$', 'm').exec(serverSrc);
  if (!m) throw new Error('no such const in server.js: ' + name);
  return m[0] + '\n';
}
const PL_GPT_STYLES = { evan: { label: 'ChatGPT' }, dreamy: { label: 'Dreamy' } };
/* eslint-disable no-eval */
const { promptlabHay, plSearchRuns } = eval(
  '(function (searchGrammar, PL_GPT_STYLES) {'
  + liftConst('PL_SHAPE_WORD')
  + lift('promptlabHay') + lift('plCompileQuery') + lift('plSearchRuns')
  + 'return { promptlabHay, plSearchRuns };})'
)(searchGrammar, PL_GPT_STYLES);
/* eslint-enable no-eval */

const RUNS = [
  { id: 'a', prompt: 'a brown horse in the desert', gptStyle: 'dreamy', model: 'gpt-image-2',
    quality: 'medium', aspectRatio: '2:3' },
  { id: 'b', prompt: 'a crow on a fence', gptStyle: 'evan', model: 'gpt-image-2',
    quality: 'low', aspectRatio: '1:1', photoRef: 'x.png' },
  { id: 'c', prompt: 'boundaries between two houses', model: 'sageryza/watercolordrawings',
    quality: null, aspectRatio: null, status: 'failed' },
];
const ids = (q) => plSearchRuns(RUNS, q).map((r) => r.id).join('');

console.log('the grammar, server-side');
ok(ids('horse') === 'a', 'one word');
ok(ids('horse desert') === 'a', 'bare words AND within one run');
ok(ids('horse crow') === '', 'and AND really means both — not either');
ok(ids('horse OR crow') === 'ab', 'OR takes either');
ok(ids('horse -desert') === '', '-word excludes');
ok(ids('"brown horse"') === 'a', 'a quoted phrase keeps its words adjacent');
ok(ids('"horse brown"') === '', 'and in that order');
ok(ids('aries') === '', '"aries" does not find "boundaries" — terms anchor at a word START');
ok(ids('bound') === 'c', 'but the prefix "bound" still finds it');
ok(ids('') === 'abc' && ids('   ') === 'abc', 'an empty query filters nothing');

console.log('what a search reaches');
ok(ids('dreamy') === 'a', 'the style by its key');
ok(ids('chatgpt') === 'b', 'and by the LABEL she sees, which no doc stores');
ok(ids('medium') === 'a' && ids('low') === 'b', 'the quality');
ok(ids('square') === 'b' && ids('portrait') === 'a',
  'the canvas by the word on the button, not just the stored ratio');
ok(ids('1:1') === 'b', 'and by the ratio the card shows');
ok(ids('photo ref') === 'b', 'a run drawn with a photo attached');
ok(ids('failed') === 'c', 'a failed run');
ok(promptlabHay({ prompt: 'x' }) === 'x', 'a bare run is just its words — no empty fields joined in');

console.log('the two haystacks agree');
const pageHay = pageSrc.slice(pageSrc.indexOf('function runHay('));
const pageHayBody = pageHay.slice(0, pageHay.indexOf('\n  }') + 4);
const srvHay = lift('promptlabHay');
['r.prompt', 'r.gptStyle', 'r.model', 'r.quality', 'r.aspectRatio', 'shape', 'photo ref',
  'failed', 'cancelled'].forEach((f) => {
  ok(pageHayBody.indexOf(f) >= 0 && srvHay.indexOf(f) >= 0,
    'both the page and the server search ' + f);
});
// The canvas WORD is one map in each file now (PL_SHAPE_WORD — pinned equal
// by test-playground-panels.js), so what this asks is that both haystacks
// read it rather than keeping a ternary of their own that can drift.
ok(/PL_SHAPE_WORD\[r\.aspectRatio\]/.test(pageHayBody)
  && /PL_SHAPE_WORD\[r\.aspectRatio\]/.test(srvHay),
  'and both read the canvas the same way');
// The 2 option's panels are landscape (sheet-grid.js pins that grid's shape),
// so the word has to reach them — asserted on the haystack rather than by
// adding a run to the fixture above, which every count here reads.
ok(/\blandscape\b/.test(promptlabHay({ prompt: 'a dog / a cat', aspectRatio: '3:2' })),
  'a landscape run is searchable by that word too');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

// The browse feed is page one; the OLD run exists only behind a search, which
// is the case a filter over the loaded tiles can never answer.
const LOADED = [
  { id: 'r1', prompt: 'a brown horse in the desert', engine: 'gptimage', model: 'gpt-image-2',
    gptStyle: 'dreamy', quality: 'medium', aspectRatio: '2:3', status: 'done',
    images: ['data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='],
    createdAt: 2000 },
  { id: 'r2', prompt: 'a crow on a fence', engine: 'gptimage', model: 'gpt-image-2',
    gptStyle: 'evan', quality: 'low', aspectRatio: '1:1', status: 'done',
    images: ['data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='],
    createdAt: 1000 },
];
const OLD = { id: 'r9', prompt: 'a horse nobody has scrolled back to', engine: 'gptimage',
  model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'high', aspectRatio: '2:3', status: 'done',
  images: ['data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='],
  createdAt: 5 };

(async () => {
  const asked = [];
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab') {
      const q = (url.searchParams.get('q') || '').trim();
      if (q) asked.push(q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (q) {
        const hits = plSearchRuns(LOADED.concat([OLD]), q);
        return res.end(JSON.stringify({ runs: hits, more: false, matched: hits.length }));
      }
      return res.end(JSON.stringify({ runs: LOADED, more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {} }));
    }
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);

  console.log('\nwhere the box sits, measured at 390pt');
  const box = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
    const bar = r('.feedbar');
    return { bar, tog: r('.viewtog'), heart: r('.likefilt'), search: r('.feedsearch'),
      input: r('.feedsearch input'),
      pad: parseFloat(getComputedStyle(document.querySelector('.feedbar')).paddingRight),
      fs: parseFloat(getComputedStyle(document.querySelector('.feedsearch input')).fontSize) };
  });
  ok(box.search && box.search.width > 40, 'the search box has real width (' + Math.round(box.search.width) + 'px)');
  ok(Math.abs(box.tog.top - box.search.top) < 2 && Math.abs(box.heart.top - box.search.top) < 2,
    'the whole row is on ONE line — nothing wrapped to make room');
  ok(box.search.left >= box.heart.right - 1, 'it starts to the RIGHT of the heart');
  // The FIELD runs INTO the pill's column since 2026-08-28 (Sophie: "I said I
  // wanted it in the pill column") — the ✕ moved to its left end, so nothing
  // on its right is a control. The other controls still reserve those 56px.
  ok(box.search.right >= box.bar.right - 1,
    'and it runs to the edge of the page, into the pill column');
  ok(box.tog.right <= box.bar.right - box.pad + 1,
    'while the controls still end before the 56px the pill owns');
  ok(box.fs >= 16, 'the input is 16px or more — under it iOS zooms and cannot zoom back');

  console.log('\ntyping');
  await page.fill('#q', 'horse');
  await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 1);
  ok((await page.textContent('#runs')).indexOf('brown horse') >= 0, 'the matching run stays');
  ok((await page.textContent('#runs')).indexOf('crow') < 0, 'the others drop out');
  ok(await page.isVisible('#qclear'), 'the clear ✕ appears with something to wipe');
  ok(!(await page.isVisible('#more .morebtn')), '"Older" is gone — a search is already answered whole');

  // The server is asked a beat later, and it can answer with a run the browse
  // feed has never paged in.
  await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2, null,
    { timeout: 4000 }).catch(() => {});
  ok(asked.indexOf('horse') >= 0, 'the SERVER was asked, not just the loaded runs');
  ok((await page.textContent('#runs')).indexOf('nobody has scrolled back to') >= 0,
    'and a run behind the paged feed comes back — the Assets tab lesson');

  console.log('\nthe heart still stacks with it');
  await page.click('#v-liked');
  await page.waitForFunction(() => /Nothing hearted yet|Nothing matches/.test(
    document.getElementById('runs').textContent));
  ok(/Nothing hearted yet|Nothing matches/.test(await page.textContent('#runs')),
    'hearts-only over a search says so rather than showing everything');
  await page.click('#v-liked');

  console.log('\ntiles');
  await page.click('#v-tiles');
  await page.waitForFunction(() => !document.getElementById('tiles').hidden);
  const tiles = await page.$$eval('#tiles img[data-run]', (els) => els.map((e) => e.dataset.run));
  ok(tiles.length === 2 && tiles.indexOf('r2') < 0, 'the wall is the same filtered feed');
  await page.click('#v-list');

  console.log('\nno match, and getting out');
  await page.fill('#q', 'zzzznothing');
  await page.waitForFunction(() => /Nothing matches/.test(document.getElementById('runs').textContent));
  ok(true, 'an empty result says "Nothing matches" rather than sitting blank');

  await page.click('#qclear');
  await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);
  ok(await page.inputValue('#q') === '', 'the ✕ empties the box');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'q',
    'and keeps her IN it — clear is not dismiss');
  ok(!(await page.isVisible('#qclear')), 'it hides itself once there is nothing to wipe');

  console.log('\nReturn');
  await page.click('#q');
  await page.type('#q', 'crow');
  await page.press('#q', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 1);
  ok((await page.textContent('#runs')).indexOf('crow') >= 0, 'Return runs the search');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id) !== 'q',
    'and drops the keyboard, so what she is left looking at is the pictures');

  console.log('\nnot sticky');
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);
  ok(await page.inputValue('#q') === '', 'a reload opens on the whole feed, never yesterday\'s query');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();

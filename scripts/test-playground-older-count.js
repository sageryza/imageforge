#!/usr/bin/env node
// 2026-09-21, Sophie: "make the older button reveal a set number not time
// period." A tap of Older used to append one server page — the 40 RUNS behind
// the cursor — so what landed on the wall was whatever those runs held once the
// heart, the ✕ and the drawer's chips had run over them: 160 pictures one tap,
// three the next, none on a hearts-only wall. A tap now adds MORE (40)
// pictures, counted AFTER the filters, walking as many pages as that takes.
//
// Drives the REAL public/promptlab.html headless against a stub API, twice:
//   A. 4 pictures a run, nothing filtered — the first page is the server's 160;
//      Older adds exactly 40 (the cap cuts the 240 loaded to 200), stays on
//      screen past the end of the history while the cap still hides something,
//      and the list view's boxes agree with the wall; a run landing at the top
//      grows the cap instead of pushing one off the bottom.
//   B. hide-✕ lit, one keeper in every fourth run — Older walks FOUR pages to
//      find its 40, and stops at the end of the history with what there is.
//
//   npm install playwright --no-save && node scripts/test-playground-older-count.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const PAGE = 40, MORE = 40;
const T0 = 1786000000000;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function mkRuns(total, votesOf) {
  return Array.from({ length: total }, (_, i) => ({
    id: 'run' + String(i).padStart(3, '0'),
    prompt: 'prompt number ' + i,
    status: 'done', engine: 'gptimage', model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
    images: [0, 1, 2, 3].map(k => '/px.png?r=' + i + '&i=' + k),
    votes: votesOf(i),
    createdAt: T0 - i * 60000,
  }));
}

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

async function scenario(browser, name, ALL, init) {
  let apiCalls = 0;
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab') {
      apiCalls++;
      const limit = Math.min(Number(url.searchParams.get('limit')) || PAGE, 100);
      const before = Number(url.searchParams.get('before')) || 0;
      const pool = before ? ALL.filter(r => r.createdAt < before) : ALL;
      const runs = pool.slice(0, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs, more: pool.length > runs.length }));
    }
    if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    if (url.pathname === '/' || url.pathname === '/playground') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
    }
    res.writeHead(404).end();
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(init);
  await page.goto(base + '/playground');
  const tiles = () => page.locator('#tiles .cell:not(.ph)').count();
  const boxes = () => page.locator('#runs .run').count();
  const older = () => page.locator('#more .morebtn');
  const tap = async () => {
    const before = await tiles();
    await older().click();
    await page.waitForFunction(() => !document.querySelector('#more .morebtn[disabled]'));
    await page.waitForFunction(n => document.querySelectorAll('#tiles .cell:not(.ph)').length !== n, before).catch(() => {});
    await page.waitForTimeout(150);
  };
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell').length > 0);
  const t = { name, page, tiles, boxes, older, tap, calls: () => apiCalls, ALL };
  return { t, close: async () => { await page.close(); server.close(); } };
}

(async () => {
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : []).find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});

  // A — nothing filtered: a tap is 40 pictures, whatever the runs hold.
  {
    const ALL = mkRuns(60, () => ({}));
    const { t, close } = await scenario(browser, 'A', ALL, () => localStorage.setItem('promptlab_view', 'tiles'));
    if (await t.tiles() !== PAGE * 4) fail(`A: first page showed ${await t.tiles()}, expected ${PAGE * 4}`);
    await t.tap();
    if (await t.tiles() !== PAGE * 4 + MORE) fail(`A: one Older showed ${await t.tiles()}, expected ${PAGE * 4 + MORE} (a set number, not the whole page)`);
    if (await t.older().count() !== 1) fail('A: Older went away while the cap still hid loaded pictures');
    if (await t.calls() !== 2) fail(`A: ${await t.calls()} requests, expected 2`);
    // The boxes show the same pictures the wall does: 50 runs' worth.
    if (await t.boxes() !== 50) fail(`A: list view has ${await t.boxes()} boxes, expected 50`);
    // A run landing at the top grows the cap — nothing falls off the bottom.
    const shownBefore = await t.page.locator('#tiles .cell:not(.ph) img').evaluateAll(e => e.map(i => i.getAttribute('data-run')));
    await t.page.evaluate((T0) => landRun({ id: 'runNEW', prompt: 'fresh', status: 'done', engine: 'gptimage', model: 'gpt-image-2',
      quality: 'medium', aspectRatio: '2:3', images: ['/px.png?new=0', '/px.png?new=1'], votes: {}, createdAt: T0 + 60000 }), T0);
    await t.page.waitForTimeout(300);
    const shownAfter = await t.page.locator('#tiles .cell:not(.ph) img').evaluateAll(e => e.map(i => i.getAttribute('data-run')));
    if (shownAfter.length !== shownBefore.length + 2) fail(`A: a new run changed the wall by ${shownAfter.length - shownBefore.length}, expected +2`);
    if (shownAfter[shownAfter.length - 1] !== shownBefore[shownBefore.length - 1]) fail('A: a new run pushed the oldest revealed picture off the wall');
    // Reveal the rest; nothing behind and nothing hidden → no button.
    await t.tap();
    if (await t.tiles() !== 60 * 4 + 2) fail(`A: after the last Older ${await t.tiles()}, expected ${60 * 4 + 2}`);
    if (await t.older().count() !== 0) fail('A: Older is still offered with nothing left to reveal');
    await close();
  }

  // B — hide-✕ lit, one keeper in every fourth run: the walk goes as far as
  // it has to for its 40, and ends at the end of the history.
  {
    const ALL = mkRuns(200, (i) => (i % 4 === 0 ? { 1: 'dislike', 2: 'dislike', 3: 'dislike' }
      : { 0: 'dislike', 1: 'dislike', 2: 'dislike', 3: 'dislike' }));
    const { t, close } = await scenario(browser, 'B', ALL, () => {
      localStorage.setItem('promptlab_view', 'tiles');
      localStorage.setItem('promptlab_hidex', '1');
    });
    // THE FIRST PAGE FILLS THE SAME WAY (2026-09-26, Sophie: "filters ex
    // trimmed shud always load a set number not by a set date"): the page she
    // opens on walks until it holds PAGE keepers — four pages here — where it
    // used to show the ten the newest forty runs happened to hold.
    await t.page.waitForFunction((n) => document.querySelectorAll('#tiles .cell:not(.ph)').length >= n, PAGE).catch(() => {});
    await t.page.waitForFunction(() => !document.querySelector('#more .morebtn[disabled]')).catch(() => {});
    await t.page.waitForTimeout(150);
    if (await t.tiles() !== PAGE) fail(`B: first page showed ${await t.tiles()} keepers, expected ${PAGE} — it must walk pages until it has a page's worth`);
    if (await t.calls() !== 4) fail(`B: ${await t.calls()} requests to fill the first page, expected 4`);
    if (await t.older().count() !== 1) fail('B: no Older button with history behind the page');
    await t.tap();
    if (await t.tiles() !== 50) fail(`B: one Older showed ${await t.tiles()} keepers, expected 50 — it must walk pages until it has its 40`);
    if (await t.calls() !== 5) fail(`B: ${await t.calls()} requests, expected 5 (four for the first page + one walked)`);
    if (await t.older().count() !== 0) fail('B: Older is still offered at the end of the history');
    await close();
  }

  await browser.close();
  if (!process.exitCode) console.log('PASS: Older reveals a set number of pictures, walking as many pages as that takes');
})().catch(e => { console.error(e); process.exit(1); });

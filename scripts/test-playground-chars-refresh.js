#!/usr/bin/env node
/*
 * test-playground-chars-refresh.js — the character picker RE-READS the
 * library (2026-09-06).
 *
 * Sophie saved her own picture in the Character Creator, opened the Panels
 * tab's character sheet, and it was not there: "i uploaded but don't see my
 * pic in character … in panels". The server listed it FIRST the whole time.
 * The page fetched the library once per page life, and the app keeps the
 * Playground alive for the whole app process — so a character saved after
 * the page loaded could never reach the picker until a force-quit.
 *
 * The honest question is not "does the page fetch" but "does a character
 * that appears on the server AFTER the first open reach the sheet on the
 * next open" — so the stub's library GROWS between two opens, and the
 * throttle is shortened so a repeated tap inside it is measured too.
 *
 *   node scripts/test-playground-chars-refresh.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const padChars = require('../pad-characters');
let fails = 0;
const ok = (c, w) => { console.log((c ? '  ok   ' : '  FAIL ') + w); if (!c) fails++; };

console.log('the source');
ok(/function loadChars\(force\)/.test(pageSrc), 'loadChars takes a force flag');
ok(/charsAt = Date\.now\(\)/.test(pageSrc), 'and stamps when the library landed');
ok(!/if \(charList\) return Promise\.resolve\(charList\);/.test(pageSrc), 'the once-per-page latch is gone');
ok(/document\.hidden && charsOpen\) loadChars\(true\)/.test(pageSrc), 'coming back with the sheet open asks past the throttle');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const cast = [{ id: 'c0', name: 'doug', url: '/face.png', aliases: [], usedAt: 1000 }];
let reads = 0;

let chromium;
try { chromium = require('playwright').chromium; } catch { console.log('  skip playwright not installed'); process.exit(fails ? 1 : 0); }

(async () => {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/face.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    if (url.pathname === '/pad-characters.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'pad-characters.js')));
    }
    if (url.pathname === '/api/promptlab/characters') {
      reads++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ characters: cast.slice(), max: padChars.MAX_PICKED }));
    }
    if (url.pathname === '/api/promptlab' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ photoLine: 'P', photoLineWithChars: 'PC', maxChars: padChars.MAX_PICKED,
        styles: { dreamy: { label: 'Dreamy', prefix: 'A', suffix: 'B', characterLine: '', refs: [] } } }));
    }
    if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{}'); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc + fs.readFileSync(path.join(ROOT, 'public', 'pill-inject.html'), 'utf8'));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/playground?style=dreamy');
  await page.waitForTimeout(400);
  const names = () => page.evaluate(() => [...document.querySelectorAll('#charrecent .nm, #charall .nm')].map((n) => n.textContent));

  console.log('the sheet grows with the library');
  await page.click('#charsbtn'); await page.waitForTimeout(300);
  ok((await names()).join() === 'doug', 'first open shows the one character on file');
  const r1 = reads;
  // She saves her own picture in the Character Creator — the server now leads
  // with it, exactly as the live route did on 2026-09-06.
  cast.unshift({ id: 'c9', name: 'sophie', url: '/face.png', aliases: [], usedAt: 2000 });
  await page.click('#charsbtn'); await page.waitForTimeout(100);          // shut
  // A tap she repeats inside the throttle is ONE query — the old list, instantly.
  await page.click('#charsbtn'); await page.waitForTimeout(300);          // open again, inside 20s
  ok(reads === r1, 'a re-open inside the throttle asks nothing (' + reads + ' reads)');
  // Past the throttle the next open re-reads and the new face lands.
  await page.evaluate(() => { window.__t = Date.now; });
  await page.click('#charsbtn'); await page.waitForTimeout(100);          // shut
  await page.addInitScript(() => {});
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 25000; });
  await page.click('#charsbtn'); await page.waitForTimeout(400);          // open, "20s later"
  ok(reads === r1 + 1, 'past the throttle the open re-reads the library (' + reads + ' reads)');
  ok((await names())[0] === 'sophie', 'and the character saved AFTER the first open is on the sheet, first');

  console.log('coming back to the tool');
  cast.unshift({ id: 'c10', name: 'nicholas', url: '/face.png', aliases: [], usedAt: 3000 });
  const r2 = reads;
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(400);
  ok(reads === r2 + 1, 'a visibility flip with the sheet open asks PAST the throttle');
  ok((await names())[0] === 'nicholas', 'and paints what landed');

  await browser.close(); server.close();
  console.log(fails ? fails + ' FAILED' : 'all green');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

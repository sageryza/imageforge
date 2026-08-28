#!/usr/bin/env node
/*
 * test-playground-deploy-error.js — what Generate says when the server never
 * answers properly (2026-08-28, Sophie: "playground error: the string did not
 * match the expected pattern").
 *
 * That sentence is Safari's own — its `response.json()` rejects with it when
 * the body isn't JSON — and it reached the error line verbatim because the
 * three run starters piped `r.json()` straight into `showErr`. The honest
 * moment it happens is a deploy window: Render answers the POST with its 502
 * page while the new instance boots (three deploys in a row did exactly that
 * the night before this was reported).
 *
 * The SOURCE half pins that all three starters read through `readJson` — the
 * helper that reads the body as text and names the status — so a fourth
 * starter copied from a neighbour inherits it. The HEADLESS half drives the
 * real page against a server whose POST answers 502 HTML, taps Generate, and
 * reads the error line: it must say what happened, and never the WebKit
 * sentence.
 *
 *   node scripts/test-playground-deploy-error.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('the source: every starter reads through readJson');
ok(pageSrc.indexOf('function readJson(') >= 0, 'the helper exists');
ok((pageSrc.match(/\.then\(readJson\)/g) || []).length >= 3,
  'all three run starters use it (single picture, panels, story)');
ok(!/api\/promptlab',[\s\S]{0,200}?return r\.json\(\)/.test(pageSrc),
  'no starter pipes r.json() straight to the error line any more');
ok(/did not match the expected pattern/.test(pageSrc),
  'showErr still translates the WebKit sentence for any other path');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

(async () => {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      // Render's deploy-window answer: an HTML error page, not JSON.
      res.writeHead(502, { 'Content-Type': 'text/html' });
      return res.end('<html><body><h1>502 Bad Gateway</h1></body></html>');
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
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
  await page.waitForSelector('#prompt');

  console.log('\na Generate tap during a deploy');
  await page.fill('#prompt', 'a horse in the rain');
  await page.click('#go');
  await page.waitForFunction(() => {
    const e = document.getElementById('err');
    return e && !e.hidden && e.textContent.trim();
  });
  const err = (await page.textContent('#err')).trim();
  ok(/502/.test(err) && /mid-deploy|try again/i.test(err),
    'the error names what happened ("' + err + '")');
  ok(!/expected pattern/i.test(err), 'and never the WebKit sentence');
  ok(!(await page.isDisabled('#go')), 'Generate is tappable again — the finally still ran');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

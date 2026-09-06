#!/usr/bin/env node
// THE "ALSO ADDED BEFORE YOUR WORDS" BLOCK IS HERS TO EDIT (2026-09-06,
// Sophie, circling it in the Prompt panel: "why is there no way to edit
// this??").
//
// That block is DERIVED — the Sophie card's line, the photo line, the picked
// cards' sentence, her typed cast's clause, the story line — and it was
// printed read-only because each line is tied to an attachment. It is a third
// editable box now. The rule that makes that safe: her edit is stored beside
// the text it replaced and a run sends it ONLY while the derived block is
// still that text, so an edit written for one cast can never ride the next
// run silently.
//
// Drives the REAL public/promptlab.html headless against a stub that RECORDS
// what a run really POSTs — a source assertion cannot tell a box that is
// merely drawn from one whose words reach the request.
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const padChars = require('../pad-characters');
const sheetGrid = require('../sheet-grid');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('the contract, by source');
ok(/function extraBlock\(\)/.test(pageSrc) && /function extraSent\(\)/.test(pageSrc),
  'one derivation of the block, one reader of what a run sends');
ok((pageSrc.match(/extra: extraSent\(\)/g) || []).length === 3,
  'every run starter sends it (single, grid, story)');
ok(/typeof req\.body\.extra === 'string'/.test(serverSrc),
  'the server takes it only as a STRING — absent keeps every derived line');
ok(/extra !== null\s*\?\s*\[prefix\.trim\(\), extra\]/.test(serverSrc)
  && /castOrExtra = extra !== null \? extra : castTxt/.test(serverSrc)
  && /\[p0, extra\]\.filter\(Boolean\)/.test(serverSrc),
  'and it stands in on all three assemblies');
ok(/\|\| extra !== null;/.test(serverSrc), 'an edited block marks the run promptEdited');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

(async () => {
  const posts = [];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/pad-characters.js' || url.pathname === '/sheet-grid.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, url.pathname.slice(1))));
    }
    if (url.pathname === '/api/promptlab/characters') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ characters: [], max: padChars.MAX_PICKED }));
    }
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        posts.push(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'run' + posts.length, status: 'running' }));
      });
      return;
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname.startsWith('/api/promptlab/run')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: 'run1', status: 'running' }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        photoLine: ' PL.', photoLineWithChars: ' PLC.', maxChars: padChars.MAX_PICKED,
        styles: { dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX', suffix: 'HOUSE SUFFIX',
          characterLine: '', refs: [] } },
      }));
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
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  await page.goto(base + '/playground?prompt=doug%20on%20a%20bench&style=dreamy');
  await page.waitForTimeout(400);

  const box = () => page.$('#promptpanel textarea[data-part="extra"]');
  const boxVal = async () => { const b = await box(); return b ? (await b.inputValue()).trim() : null; };

  console.log('nothing riding');
  await page.click('#promptbtn');
  await page.waitForTimeout(200);
  ok((await box()) === null, 'no derived block → no box (an empty cast sends nothing)');

  console.log('her typed cast');
  await page.click('#charsbtn');
  await page.waitForTimeout(200);
  await page.click('.chartabs button[data-ct="desc"]');
  await page.click('#castadd');
  await page.fill('.castrow .cnm', 'Penny');
  await page.fill('.castrow .cds', 'a small dog in a red coat');
  await page.waitForTimeout(200);
  await page.click('#charsbtn');
  await page.waitForTimeout(200);
  const house = sheetGrid.castBlock([{ name: 'Penny', description: 'a small dog in a red coat' }], true).trim();
  ok((await boxVal()) === house, 'the box is drawn and holds the derived block verbatim');

  await page.click('#go');
  await page.waitForTimeout(300);
  ok(posts.length === 1 && !('extra' in posts[0]), 'an unedited box sends NO extra — the run is what it always was');

  console.log('her edit');
  const MINE = 'Penny is a small dog in a red coat, and she is always in the frame.';
  await page.fill('#promptpanel textarea[data-part="extra"]', MINE);
  await page.waitForTimeout(150);
  ok(await page.$eval('#promptpanel .pnote', (e) => e.textContent) === 'Your wording',
    'the panel says it is her wording');
  await page.click('#go');
  await page.waitForTimeout(300);
  ok(posts.length === 2 && posts[1].extra === MINE, 'the run carries her block word for word');
  ok([undefined, 'HOUSE PREFIX'].includes(posts[1].prefix) && [undefined, 'HOUSE SUFFIX'].includes(posts[1].suffix),
    'the two halves she did not touch still say the house text');

  console.log('the block moves on');
  await page.click('#charsbtn');
  await page.waitForTimeout(200);
  await page.fill('.castrow .cds', 'a big dog in a blue coat');
  await page.waitForTimeout(200);
  await page.click('#charsbtn');
  await page.waitForTimeout(200);
  const house2 = sheetGrid.castBlock([{ name: 'Penny', description: 'a big dog in a blue coat' }], true).trim();
  ok((await boxVal()) === house2, 'a changed cast puts the derived block back in the box — the old edit is not shown over it');
  await page.click('#go');
  await page.waitForTimeout(300);
  ok(posts.length === 3 && !('extra' in posts[2]), 'and the stale edit does NOT ride the run');

  console.log('and comes back');
  await page.click('#charsbtn');
  await page.waitForTimeout(200);
  await page.fill('.castrow .cds', 'a small dog in a red coat');
  await page.waitForTimeout(200);
  await page.click('#charsbtn');
  await page.waitForTimeout(200);
  ok((await boxVal()) === MINE, 'the same cast again shows her edit again');

  console.log('reset');
  await page.click('#promptpanel .prow button');
  await page.waitForTimeout(200);
  ok((await boxVal()) === house, 'Reset puts the house block back');
  await page.click('#go');
  await page.waitForTimeout(300);
  ok(posts.length === 4 && !('extra' in posts[3]), 'and sends none');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

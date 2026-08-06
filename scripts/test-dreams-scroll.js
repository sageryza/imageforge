#!/usr/bin/env node
// Regression test for the 2026-08-06 report: scrolling through dreams while a
// render was running made the page "flicker and restart". The poll loop called
// render() every 3.2s, which reassigns root.innerHTML — throwing away scroll
// position and re-decoding every image. Drives the REAL public/dreams.html in a
// headless browser against a stub API and asserts that a running render no
// longer disturbs the page under her thumb, on both the main and archive views.
//
//   npm install playwright --no-save && node scripts/test-dreams-scroll.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const PAGES = n => Array.from({ length: n }, (_, i) => ({ url: `/dream-sunflowers.png?p=${i}` }));
const TYPES = { '.html': 'text/html', '.png': 'image/png', '.css': 'text/css', '.js': 'text/javascript' };

// A dream that keeps drawing: the job stays 'running' and a new page lands on
// every poll, which is exactly the state Sophie was scrolling through.
let polls = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (url.pathname === '/api/movies/dream/testid') {
    polls++;
    return send({
      id: 'testid', title: 'Test dream', dreamText: 'a dream',
      pages: PAGES(6 + polls),
      job: { kind: 'render', status: 'running', done: polls, total: 20, label: 'drawing pages' },
    });
  }
  if (url.pathname === '/api/movies/dream') {
    return send({ dreams: [{ id: 'arch1', title: 'Older dream', createdAt: '2026-08-01T00:00:00Z' }] });
  }
  if (url.pathname === '/api/movies/dream/arch1') {
    return send({ id: 'arch1', title: 'Older dream', pages: PAGES(12) });
  }
  const file = path.join(PUB, url.pathname === '/' ? 'dreams.html' : url.pathname.slice(1));
  if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(404); res.end('nope');
});

const results = [];
const check = (name, cond, detail = '') => {
  results.push([!!cond, name + (cond ? '' : ` — ${detail}`)]);
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // Use whatever Chromium the host already has when playwright's pinned build
  // isn't downloaded (the cloud sessions ship one under /opt/pw-browsers).
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  // Pretend a render was already going, so the page resumes polling on open.
  await page.addInitScript(() => localStorage.setItem('dreams_active', 'testid'));

  const settle = async () => { await page.waitForTimeout(1200); };
  // The page must survive ~3 poll cycles (3.2s each) untouched.
  const THREE_POLLS = 10500;

  // ── Main view: scrolling while pages land ──
  await page.goto(`${base}/dreams.html`);
  await page.waitForSelector('#root .page', { timeout: 10000 });
  await settle();
  await page.evaluate(() => window.scrollTo(0, 500));
  await settle();
  const before = await page.evaluate(() => {
    // Tag live nodes: if the view is rebuilt, the tags vanish with them.
    document.querySelector('#root .section').dataset.probe = 'main';
    document.querySelector('#root .page').dataset.probe = 'firstpage';
    return { y: window.scrollY, pages: document.querySelectorAll('#root .page').length };
  });
  await page.waitForTimeout(THREE_POLLS);
  const after = await page.evaluate(() => ({
    y: window.scrollY,
    stackKept: document.querySelector('#root .section')?.dataset.probe === 'main',
    firstKept: document.querySelector('#root .page')?.dataset.probe === 'firstpage',
    pages: document.querySelectorAll('#root .page').length,
    label: document.querySelector('.progress span')?.textContent || '',
  }));

  check('main view keeps its scroll position while a render polls', after.y === before.y,
    `scrollY ${before.y} → ${after.y}`);
  check('main view is patched, not rebuilt', after.stackKept && after.firstKept,
    `stackKept=${after.stackKept} firstKept=${after.firstKept}`);
  check('new pages still appear as they land', after.pages > before.pages,
    `${before.pages} → ${after.pages} pages`);
  check('the status line still updates', /drawing|illustrat/i.test(after.label), `label was "${after.label}"`);

  // ── Archive view: this is the one she was scrolling ("Past dreams") ──
  await page.click('#navLeft');
  await page.waitForSelector('#agrid .page', { timeout: 10000 });
  await settle();
  await page.evaluate(() => window.scrollTo(0, 400));
  await settle();
  const aBefore = await page.evaluate(() => {
    document.getElementById('agrid').dataset.probe = 'grid';
    return { y: window.scrollY, tiles: document.querySelectorAll('#agrid .page').length };
  });
  await page.waitForTimeout(THREE_POLLS);
  const aAfter = await page.evaluate(() => ({
    y: window.scrollY,
    gridKept: document.getElementById('agrid')?.dataset.probe === 'grid',
    tiles: document.querySelectorAll('#agrid .page').length,
  }));

  check('archive keeps its scroll position while a render polls', aAfter.y === aBefore.y,
    `scrollY ${aBefore.y} → ${aAfter.y}`);
  check('archive grid is never rebuilt behind her', aAfter.gridKept, 'the grid was replaced');
  check('archive tiles stay put', aAfter.tiles === aBefore.tiles,
    `${aBefore.tiles} → ${aAfter.tiles} tiles`);

  // Going back to the main view must still show everything drawn meanwhile.
  await page.click('#navLeft');
  await page.waitForSelector('#root .page', { timeout: 10000 });
  const back = await page.evaluate(() => document.querySelectorAll('#root .page').length);
  check('returning to the main view shows the pages drawn while away', back > after.pages,
    `${after.pages} → ${back} pages`);

  await browser.close();
  server.close();

  results.forEach(([ok, n]) => console.log(`${ok ? '  ok  ' : ' FAIL '} ${n}`));
  const bad = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });

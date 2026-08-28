#!/usr/bin/env node
/**
 * THE + (NEW STORY) BUTTON IN CUTTING BLOCKS — the real page, headless.
 *
 * A "new story" here is a recording nothing has come apart yet, so the button
 * cannot create anything on its own: it puts her on the RECORDINGS list, which
 * is where opening one starts a project. Three things are worth measuring
 * rather than reading off the markup:
 *
 *   - it is REACHABLE. The header reserves 56px for the injected autoscroll
 *     pill's fixed corner and this button sits inside that row, so the only
 *     honest question is what a tap at its own centre actually hits
 *     (`elementFromPoint` — a covered control passes every width assertion).
 *   - it RE-READS the library. The sources list caches itself with
 *     `dataset.done`, so a deliberate tap must clear it or a recording she
 *     added since the page loaded — exactly the one she is reaching for — is
 *     not on the list.
 *   - from INSIDE a project it steps back to the shelf first, or she lands on
 *     a Recordings tab hidden behind the open project.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'public', 'blocks.html'), 'utf8');

let pass = 0; let failed = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass += 1; console.log('  ok ', name); }
  else { failed += 1; console.log('  FAIL', name, extra === undefined ? '' : `— ${extra}`); }
};

// the library grows between page load and her tap — that is the point of test 6
let SOURCES = [
  { itemId: 'a1', url: 'https://storage.googleapis.com/b/one.mp3', name: 'the first recording', seconds: 61 },
];
const PROJECT = {
  id: 'p1', title: 'a project', status: 'ready', seconds: 61, blockCount: 2,
  source: { url: SOURCES[0].url }, marks: {}, custom: {}, whoOver: {}, added: {},
  ttsUrls: {}, order: [], secMeld: {}, place: {}, renders: [], job: null,
};

function json(res, body) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/api/blocks/') return json(res, { projects: [{ id: 'p1', title: 'a project', status: 'ready', blockCount: 2, updatedAt: '2026-08-28' }] });
  if (p === '/api/blocks/sources') return json(res, { sources: SOURCES });
  if (p === '/api/blocks/p1') return json(res, { project: PROJECT });
  if (p === '/api/blocks/p1/job') return json(res, { job: null, status: 'ready', renders: [] });
  if (p.startsWith('/api/blocks/')) return json(res, { ok: true });
  if (p.endsWith('.json')) return json(res, { v: 1, blocks: [], sections: [], words: [] });
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(PAGE);
});

(async () => {
  const { chromium } = require('playwright');
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // PW_CHROMIUM lets a container whose pinned build differs from the installed
  // playwright point at the browser it does have; unset is the normal path.
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/blocks`);
  await page.waitForSelector('#newbtn');

  const btn = page.locator('#newbtn');
  ok('the + is on the header, on the home screen', await btn.isVisible());
  ok('it says what it is', (await btn.getAttribute('aria-label')) === 'new story');

  // 1. reachable — not under the pill's reserved corner
  const hit = await page.evaluate(() => {
    const b = document.getElementById('newbtn');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { id: el && el.id, inside: b.contains(el), w: Math.round(r.width), h: Math.round(r.height) };
  });
  ok('a tap at its centre reaches the +', hit.inside, `hit ${hit.id}`);
  ok('it is a real tap target (>=24px)', hit.w >= 24 && hit.h >= 24, `${hit.w}x${hit.h}`);

  // 2. rounded square, never a circle (the house icon-button rule)
  const radius = await btn.evaluate((el) => getComputedStyle(el).borderRadius);
  ok('rounded square, not a circle', /^6px/.test(radius), radius);

  // 3. the tap opens the Recordings list
  ok('opens on Working on', await page.locator('#projects').isVisible() && !(await page.locator('#sources').isVisible()));
  await btn.click();
  await page.waitForFunction(() => !document.getElementById('sources').hidden);
  ok('the + shows the Recordings list', await page.locator('#sources').isVisible());
  ok('and the Recordings tab is the lit one', await page.locator('.tabs button[data-tab="1"]').evaluate((el) => el.classList.contains('on')));
  await page.waitForFunction(() => document.querySelectorAll('#sources [data-url]').length > 0);
  ok('the library is listed', (await page.locator('#sources [data-url]').count()) === 1);

  // 4. from inside a project it steps back out to the shelf first
  await page.locator('.tabs button[data-tab="0"]').click();
  await page.locator('#projects [data-pid]').click();
  await page.waitForFunction(() => !document.getElementById('work').hidden);
  ok('the + is still there inside a project', await btn.isVisible());
  await btn.click();
  await page.waitForFunction(() => !document.getElementById('home').hidden);
  ok('it comes back out to the shelf', await page.locator('#home').isVisible() && !(await page.locator('#work').isVisible()));
  ok('…on the Recordings list', await page.locator('#sources').isVisible());

  // 5. a deliberate tap re-reads the library
  SOURCES = SOURCES.concat([{ itemId: 'a2', url: 'https://storage.googleapis.com/b/two.mp3', name: 'recorded since', seconds: 30 }]);
  await page.locator('.tabs button[data-tab="0"]').click();
  await btn.click();
  await page.waitForFunction(() => document.querySelectorAll('#sources [data-url]').length === 2, null, { timeout: 4000 })
    .then(() => ok('a recording added since the page loaded is on the list', true))
    .catch(() => ok('a recording added since the page loaded is on the list', false, 'the list was served from its cache'));

  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

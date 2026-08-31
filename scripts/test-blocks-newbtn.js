#!/usr/bin/env node
/**
 * THE + (NEW STORY) BUTTON IN CUTTING BLOCKS — the real page, headless.
 *
 * The + makes a BLANK story — no recording, just the lines she types or sends
 * over from the Voice Studio — and opens it. Starting from a recording is the
 * Recordings tab and is untouched. Three things are worth measuring rather
 * than reading off the markup:
 *
 *   - it is REACHABLE. The header reserves 56px for the injected autoscroll
 *     pill's fixed corner and this button sits inside that row, so the only
 *     honest question is what a tap at its own centre actually hits
 *     (`elementFromPoint` — a covered control passes every width assertion).
 *   - the blank story's one section OPENS. Folded it draws nothing at all —
 *     a story with no lines and no way to see the ones you add — and the
 *     slots a line is added through only exist at the deepest level.
 *   - a line already on a blank story is DRAWN. `build()` hangs an added line
 *     off `.s .l3`, so a project with no section at all silently shows an
 *     empty screen rather than her words.
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

const SOURCES = [
  { itemId: 'a1', url: 'https://storage.googleapis.com/b/one.mp3', name: 'the first recording', seconds: 61 },
];
// the blank story the stub's /blank mints — one line already on it, the shape
// a Voice Studio hand-off leaves behind
const BLANK = {
  id: 'blank1', title: 'New story', status: 'ready', blank: true, seconds: 0,
  blockCount: 0, source: null,
  marks: {}, custom: {}, whoOver: {},
  added: { n0: 'we call that retroactive pattern recognition.' },
  ttsUrls: { n0: 'https://storage.googleapis.com/b/vl0.mp3' },
  order: [], secMeld: {}, place: {}, renders: [], job: null,
};
let blankMade = 0;

function json(res, body) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/api/blocks/') {
    return json(res, { projects: [
      { id: 'p1', title: 'a project', status: 'ready', blockCount: 2, updatedAt: '2026-08-28' },
      { id: 'blank1', title: 'New story', status: 'ready', blank: true, blockCount: 0, lineCount: 1, updatedAt: '2026-08-28' },
    ] });
  }
  if (p === '/api/blocks/sources') return json(res, { sources: SOURCES });
  if (p === '/api/blocks/blank') { blankMade += 1; return json(res, { id: 'blank1', blank: true }); }
  if (p === '/api/blocks/blank1') return json(res, { project: { ...BLANK, blocksUrl: '/blank-blocks.json' } });
  if (p === '/api/blocks/blank1/job') return json(res, { job: null, status: 'ready', renders: [] });
  if (p.startsWith('/api/blocks/')) return json(res, { ok: true });
  // what the server writes for a blank story: no blocks, one seeded section
  if (p === '/blank-blocks.json') return json(res, { v: 1, blocks: [], sections: [{ key: 's0', title: 'New story', blocks: [] }] });
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

  // 3. the shelf says a blank story is empty rather than "0 lines"
  await page.waitForFunction(() => document.querySelectorAll('#projects [data-pid]').length === 2);
  ok('a blank story with a line reads as lines', (await page.locator('#projects [data-pid="blank1"] .mt').textContent()).trim() === '1 lines');

  // 4. the + makes a blank story and opens it
  await btn.click();
  await page.waitForFunction(() => !document.getElementById('work').hidden);
  ok('the + made exactly one blank story', blankMade === 1, `made ${blankMade}`);
  ok('and opened it', await page.locator('#work').isVisible() && !(await page.locator('#home').isVisible()));
  ok('the story wears its name', (await page.locator('header h1').textContent()) === 'New story');

  // 5. its one section is OPEN, and the line already on it is drawn
  await page.waitForSelector('.s');
  ok('the blank story opens its paragraph', (await page.locator('.s').getAttribute('data-lv')) === '3');
  ok('the line already on it is drawn', (await page.locator('.s .l3 .c').count()) === 1);
  ok('…with her words in it', (await page.locator('.s .l3 .c .ed').textContent()).indexOf('retroactive pattern recognition') >= 0);
  ok('and it can be rendered (the bar is up)', await page.locator('#bar').isVisible());

  // 6. the way back out, and the Recordings tab is untouched
  await page.locator('#back').click();
  await page.waitForFunction(() => !document.getElementById('home').hidden);
  await page.locator('.tabs button[data-tab="1"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#sources [data-url]').length > 0);
  ok('starting from a recording still works', (await page.locator('#sources [data-url]').count()) === 1);

  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

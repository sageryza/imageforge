#!/usr/bin/env node
// A NEW STORY LANDS IN THE PILE SHE IS LOOKING AT (2026-09-14, Sophie: "story
// room shud add to current lu selected category").
//
// Drives the REAL public/scratchpad.html in a headless browser against a stub
// API and reads what the + really POSTs — which is the only honest question
// here: a page that reads `shelfCat` correctly and never puts it in the body,
// one that sends the default pile as a real field, and one that files by a
// chip it is not even showing all look identical in the source.
//
//   1. on the DEFAULT chip the body carries NO category — an untagged story
//      falls into Unsorted by itself, so a plain new story is written
//      byte-for-byte the doc it always was,
//   2. on WITCH it carries `witch`, and on NDE `nde` — the pile she is
//      standing on, whichever it is,
//   3. INSIDE A FOLDER it carries the folder and NO category: the chips come
//      off in there, so shelfCat is the pile she came in from and is on no
//      screen,
//   4. the page still opens the story it just made (the + is unchanged in
//      every other way),
//   5. a source pin that scratchpad.js's /pads route actually WRITES the
//      field, cleaned the way /pads/category cleans it — the page can send a
//      category to a route that drops it and every assertion above still
//      passes.
//
//   npm install playwright --no-save && node scripts/test-storyroom-new-in-category.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

// One story per pile, plus a folder, so every chip has something on it and
// stepping into a folder is one tap.
const PADS = [
  { id: 'u1', title: 'set theory', beats: 3, cover: null, category: null, updatedAt: 900 },
  { id: 'm1', title: 'Mason — the shape', beats: 2, cover: null, category: null, folder: 'Mason', updatedAt: 880 },
  { id: 'm2', title: 'Valued Customer', beats: 2, cover: null, category: null, folder: 'Mason', updatedAt: 860 },
  { id: 'p1', title: 'The Meteorite', beats: 0, cover: null, category: 'personal', updatedAt: 800 },
  { id: 'w1', title: 'Moon milk', beats: 0, cover: null, category: 'witch', updatedAt: 700 },
  { id: 'n1', title: 'NDE · Telepathy', beats: 0, cover: null, category: 'nde', updatedAt: 600 },
];

const newPosts = [];   // bodies POSTed to /pads
const padLoads = [];   // stories the page opened afterwards

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/scratchpad/pads' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      newPosts.push(b);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, pad: 'made' + newPosts.length }));
    });
  }
  if (url.pathname === '/api/scratchpad/pads') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ count: PADS.length, pads: PADS }));
  }
  if (url.pathname === '/api/scratchpad') {
    padLoads.push(url.searchParams.get('pad'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ beats: [], title: 'stub', film: null }));
  }
  if (url.pathname === '/api/story/thumb') {
    res.writeHead(302, { Location: '/px.png' });
    return res.end();
  }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/' || url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

// The route is behind express + Firestore, neither of which this harness has,
// so the server half is a SOURCE pin: the field has to be read, cleaned and
// written, and absent has to write nothing at all.
function pinRoute() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
  const i = src.indexOf("router.post('/pads',");
  const body = i < 0 ? '' : src.slice(i, i + 2000);
  ok(/const category = String\(req\.body\.category \|\| ''\)/.test(body),
    'the /pads route reads a category off the body');
  ok(/\.toLowerCase\(\)\.slice\(0, 24\)\.trim\(\)/.test(body),
    'and cleans it the way /pads/category cleans it — one word, one meaning');
  ok(/\.\.\.\(category \? \{ category \} : \{\}\)/.test(body),
    'an absent category writes NO field — a plain new story is the doc it always was');
}

async function tapNew(page) {
  const before = newPosts.length;
  await page.click('#newstory');
  for (let i = 0; i < 80 && newPosts.length === before; i++) await page.waitForTimeout(50);
  return newPosts[newPosts.length - 1];
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  // 1 — the default pile sends nothing
  await page.goto(base + '/scratchpad.html');
  await page.waitForSelector('.stile');
  ok(await page.$eval('#shelfcats .scat.on', (el) => el.textContent) === 'Unsorted',
    'the shelf opens on Unsorted (the default pile)');
  let b = await tapNew(page);
  ok(b && !b.category,
    'on the default pile the + sends NO category (' + JSON.stringify(b && b.category) + ')');
  for (let i = 0; i < 80 && padLoads[padLoads.length - 1] !== 'made1'; i++) await page.waitForTimeout(50);
  ok(padLoads[padLoads.length - 1] === 'made1',
    'and it still opens the story it just made');

  // 2 — the pile she is standing on
  for (const [word, key] of [['Witch', 'witch'], ['NDE', 'nde'], ['Personal', 'personal']]) {
    await page.goto(base + '/scratchpad.html');
    await page.waitForSelector('.stile');
    await page.click(`#shelfcats .scat:text-is("${word}")`);
    await page.waitForFunction((w) =>
      document.querySelector('#shelfcats .scat.on') &&
      document.querySelector('#shelfcats .scat.on').textContent === w, word);
    b = await tapNew(page);
    ok(b && b.category === key,
      `on ${word} the + files the story under "${key}" (${JSON.stringify(b && b.category)})`);
    ok(b && !b.folder, `and no folder rides along from the ${word} shelf`);
  }

  // 3 — inside a folder: the folder, and no chip she cannot see
  await page.goto(base + '/scratchpad.html');
  await page.waitForSelector('.stile');
  await page.click('#shelfcats .scat:text-is("Witch")');
  await page.waitForFunction(() =>
    document.querySelector('#shelfcats .scat.on').textContent === 'Witch');
  await page.click('#shelfcats .scat:text-is("Unsorted")');
  await page.waitForFunction(() => document.querySelectorAll('.stile.fold').length === 1);
  await page.click('.stile.fold');
  await page.waitForFunction(() => document.getElementById('shelfcats').hidden);
  ok(await page.$eval('#shelfno', (el) => el.textContent) === 'Mason',
    'stepping into a folder renames the header to it');
  b = await tapNew(page);
  ok(b && b.folder === 'Mason', 'inside a folder the + joins that folder');
  ok(b && !b.category,
    'and sends NO category — the chips are off screen in there (' + JSON.stringify(b && b.category) + ')');

  await browser.close();
  server.close();
  pinRoute();
  console.log(failures ? failures + ' FAILED' : 'all good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

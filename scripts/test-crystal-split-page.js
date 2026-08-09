// test-crystal-split-page.js — drives the real /crystalsplit page in headless
// Chromium against a stub API. Playwright is an optionalDependency, so this
// skips cleanly when it isn't installed.
//
//   node scripts/test-crystal-split-page.js

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('playwright not installed — skipping'); process.exit(0); }

const fs = require('fs');
const http = require('http');
const path = require('path');

const PHOTOS = Array.from({ length: 9 }, (_, i) => ({
  id: 'p' + i, url: 'about:blank', thumb: 'about:blank', media: i === 8 ? 'video' : 'image',
}));
let state = { marks: [], skip: [], names: {}, treatment: {} };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  if (u.pathname === '/crystalsplit') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(fs.readFileSync(path.join(__dirname, '../public/crystalsplit.html'), 'utf8'));
  }
  if (u.pathname === '/api/crystals/split/albums') {
    return json({ count: 1, albums: [{ bundle: 'demo', bundleName: 'Demo album', photos: 8, videos: 1, cover: 'about:blank', started: false, stones: 0, marks: 0 }] });
  }
  if (u.pathname === '/api/crystals/split/demo' && req.method === 'GET') {
    return json({ bundle: 'demo', bundleName: 'Demo album', photos: PHOTOS, ...state, thumbsMissing: 0, stones: [] });
  }
  if (u.pathname === '/api/crystals/split/demo' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      try { state = { ...state, ...JSON.parse(body || '{}') }; } catch {}
      json({ ok: true, bundle: 'demo', stones: [] });
    });
  }
  res.statusCode = 404; res.end('{}');
});

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`); }
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // The sandbox pins one Chromium build under /opt/pw-browsers, which may not
  // match the playwright version installed here — fall back to it by path
  // rather than failing (or trying to download a browser).
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) {
    const glob = require('fs').readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-'))[0];
    const exe = glob && `/opt/pw-browsers/${glob}/chrome-linux/chrome`;
    if (!exe || !fs.existsSync(exe)) { console.log('no usable Chromium — skipping'); server.close(); process.exit(0); }
    browser = await chromium.launch({ executablePath: exe });
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/crystalsplit');
  await page.waitForSelector('.album');

  await page.click('.album');
  await page.waitForSelector('.tiles');
  check('one stone before any mark', await page.$$eval('.stone', (n) => n.length), 1);
  check('all nine photos rendered', await page.$$eval('.tile', (n) => n.length), 9);
  check('the count reads 1', await page.textContent('#count'), '1');

  // Cut at photo 3 → two stones.
  await page.click('[data-cut="p3"]');
  await page.waitForFunction(() => document.querySelectorAll('.stone').length === 2);
  check('cut splits into two', await page.textContent('#count'), '2');
  check('the new stone leads with a lit scissors',
    await page.$eval('[data-id="p3"]', (n) => n.classList.contains('first')), true);

  // The album's FIRST photo can never be marked — it would be a no-op button.
  await page.click('[data-cut="p0"]');
  await page.waitForTimeout(80);
  check('photo 0 stays unmarkable', await page.textContent('#count'), '2');

  // Skipping from the middle of a run must not break that run in two.
  await page.click('[data-cut="p6"]');
  await page.waitForFunction(() => document.querySelectorAll('.stone').length === 3);
  await page.click('[data-zoom="p4"]');
  await page.waitForSelector('#lb:not([hidden])');
  await page.click('#lbskip');
  await page.click('#lbclose');
  await page.waitForFunction(() => document.getElementById('lb').hidden);
  check('skipping mid-run keeps three stones', await page.textContent('#count'), '3');
  check('the skipped photo is still reachable',
    await page.$$eval('.tile.skipped', (n) => n.length), 1);

  // Treatment + name land on the stone and survive a re-render.
  await page.click('.stone:nth-of-type(2) [data-t="own"]');
  await page.waitForTimeout(60);
  check('own is lit', await page.$eval('.stone:nth-of-type(2) [data-t="own"]',
    (n) => n.classList.contains('on')), true);
  check('too-few-photos warning shows', await page.$$eval('.warn', (n) => n.length > 0), true);

  await page.waitForTimeout(800);   // let the debounced save land
  check('marks reached the server', state.marks.sort(), ['p3', 'p6']);
  check('skip reached the server', state.skip, ['p4']);

  check('no page errors', errors, []);

  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

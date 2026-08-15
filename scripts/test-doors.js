#!/usr/bin/env node
/* Tests public/doors.html — the corridor prototype — in headless Chromium.
 *
 *   node scripts/test-doors.js
 *
 * What it pins is the RULE, because the rule is the whole point of the page:
 * doors are chosen blind, the two you didn't take close and stay closed, a
 * reload cannot undo a choice, the corridor is seven doors and then it ends.
 * Plus the house constraint that nothing on this page scrolls.
 *
 * Skips (exit 0) when Chromium or playwright-core is absent, the same way
 * test-compare-shell.js does — playwright-core is NOT a repo dependency, so
 * install it alongside to run this:  npm i playwright-core
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

let failures = 0;
function ok(cond, label) {
  console.log((cond ? '  ok   ' : '  FAIL ') + label);
  if (!cond) failures++;
}

// Runs FIRST and needs no browser, because this is the bug that actually
// shipped: public/doors/ was added as the room-art folder, and
// express.static — registered long before any route — answers a request for a
// DIRECTORY with a 301 to its trailing-slash form. So /doors stopped serving
// the page and started redirecting to an empty folder listing. Any tool whose
// route name matches a folder in public/ dies the same way, silently.
console.log('routes vs folders in public/');
{
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const pub = path.join(__dirname, '..', 'public');
  const routes = [...server.matchAll(/app\.get\(\s*'\/([a-z0-9-]+)'\s*,\s*serveGated/g)].map((m) => m[1]);
  const clash = routes.filter((r) => {
    try { return fs.statSync(path.join(pub, r)).isDirectory(); } catch (_) { return false; }
  });
  ok(routes.length > 5, `found the served routes (${routes.length})`);
  ok(clash.length === 0, 'no served route is shadowed by a public/ folder' +
    (clash.length ? ` — express.static will 301 these: ${clash.join(', ')}` : ''));
}

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (_) {
  console.log('\nno playwright-core — skipping the browser half (npm i playwright-core to run)');
  process.exit(failures ? 1 : 0);
}

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } });
if (!chrome) {
  console.log('\nno Chromium found — skipping the browser half (set CHROME_PATH to run)');
  process.exit(failures ? 1 : 0);
}

const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, req.url.split('?')[0]);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/doors.html`;
  const browser = await chromium.launch({ executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector('.door');

  console.log('corridor');
  ok((await page.locator('.door').count()) === 3, 'three doors');
  ok((await page.locator('.ticks i').count()) === 7, 'seven ticks — the budget is visible');
  ok((await page.locator('.ticks i.spent').count()) === 0, 'nothing spent yet');
  const frags = await page.locator('.door .frag').allTextContents();
  ok(frags.every((f) => f.trim().length > 3), 'every door carries a fragment');
  ok(await page.locator('#room').isHidden(), 'no room showing');

  console.log('the one-way rule');
  await page.locator('.door').nth(1).click();
  ok((await page.locator('.door.shut').count()) === 2, 'the two unchosen doors close');
  ok((await page.locator('.door.taken').count()) === 1, 'the chosen one is marked taken');
  await page.waitForTimeout(650); // the label fades over .55s; the room lands at .9s
  const shutOpacity = await page.locator('.door.shut .frag').first().evaluate(
    (n) => getComputedStyle(n).opacity);
  ok(Number(shutOpacity) < 0.5, 'a closed door’s label goes unreadable');
  await page.waitForSelector('#room:not([hidden])');
  ok((await page.locator('#roomScene').textContent()).length > 100, 'the room has a scene');
  ok((await page.locator('#roomFrag').textContent()).trim() === frags[1].trim(),
    'the room names the fragment you chose');
  ok((await page.locator('.ticks i.spent').count()) === 1, 'one tick spent');

  console.log('the room art');
  ok(await page.locator('#roomArt').isVisible(), 'the room shows its picture');
  const art = await page.locator('#roomImg').evaluate((n) => ({
    src: n.getAttribute('src'), w: n.naturalWidth, alt: n.alt,
  }));
  ok(/^\/door-rooms\/[a-z0-9-]+\.webp$/.test(art.src || ''), 'it points at a display copy — got: ' + art.src);
  ok(art.w > 0, 'the picture actually loaded');
  ok(art.alt === frags[1].trim(), 'the picture is described by its fragment');

  console.log('a reload cannot undo a choice');
  await page.reload();
  await page.waitForSelector('.door');
  ok((await page.locator('.ticks i.spent').count()) === 1, 'the spent door survives a reload');
  const frags2 = await page.locator('.door .frag').allTextContents();
  ok(frags2.join('|') !== frags.join('|'), 'and it resumes at the NEXT corridor, not the old one');

  console.log('nothing scrolls');
  const scrolls = await page.evaluate(() => ({
    over: document.documentElement.scrollHeight - window.innerHeight,
    y: (window.scrollBy(0, 400), window.scrollY),
  }));
  ok(scrolls.over <= 1, 'the page is not taller than the screen');
  ok(scrolls.y === 0, 'it does not scroll');

  console.log('walking the whole corridor');
  // the reload left us standing in the corridor at depth 1, so a door comes
  // first and "go on" only between rooms
  // ART and CORRIDOR are separate tables; walking every depth is what proves
  // no door quietly lost its picture.
  let roomsWithArt = 1; // depth 0 was checked above
  for (let d = 1; d < 7; d++) {
    await page.locator('.door').nth(d % 3).click();
    await page.waitForSelector('#room:not([hidden])');
    const w = await page.locator('#roomImg').evaluate((n) => n.naturalWidth);
    if (w > 0) roomsWithArt++;
    if (d < 6) {
      await page.locator('#onward').click();
      await page.waitForSelector('.corridor:not([hidden]) .door');
    }
  }
  ok(roomsWithArt === 7, `every depth's room drew its picture (${roomsWithArt}/7)`);
  ok((await page.locator('.ticks i.spent').count()) === 7, 'all seven doors spent');
  ok((await page.locator('#onward').textContent()).includes('See the corridor'),
    'the last room offers the ending');
  await page.locator('#onward').click();
  await page.waitForSelector('#end:not([hidden])');
  ok((await page.locator('.walked li').count()) === 7, 'the ending lists all seven, readable again');
  const closed = await page.locator('#closed').textContent();
  ok(/14 closed behind you/.test(closed), 'it counts the fourteen that closed — got: ' + closed);
  ok((await page.locator('#shape').textContent()).length > 20, 'the ending names a shape');

  console.log('walk again');
  await page.locator('#again').click();
  await page.waitForSelector('.corridor:not([hidden]) .door');
  ok((await page.locator('.ticks i.spent').count()) === 0, 'a fresh corridor');

  console.log('the "?"');
  await page.locator('#help').click();
  ok(await page.locator('#helpcard').isVisible(), 'the ? opens the card');

  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

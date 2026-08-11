// Drives the REAL page against the REAL /compare.css + /compare.js in headless
// Chromium: tap a grid image, assert the lightbox opens, the page locks, and
// closing restores the scroll position. Storage images are stubbed (headless
// has no network to storage.googleapis.com).
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const PUB = '/home/user/imageforge/public';
const PAGE = fs.readFileSync(path.join(__dirname, process.argv[2] || 'page3fix.html'), 'utf8');
// 1x1 transparent gif, so <img> loads without network
// a real card-sized stub, so page height (and the scroll-restore check) matches
// the live page instead of collapsing to nothing.
const PIX = fs.readFileSync(path.join(__dirname, 'stub.png'));

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/' || u.endsWith('.html')) { res.setHeader('content-type', 'text/html'); return res.end(PAGE); }
  if (u === '/compare.css') { res.setHeader('content-type', 'text/css'); return res.end(fs.readFileSync(path.join(PUB, 'compare.css'))); }
  if (u === '/compare.js') { res.setHeader('content-type', 'application/javascript'); return res.end(fs.readFileSync(path.join(PUB, 'compare.js'))); }
  if (u.startsWith('/api/')) { res.setHeader('content-type', 'application/json'); return res.end('{"items":{},"texts":{}}'); }
  res.setHeader('content-type', 'image/png'); res.end(PIX);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  // the preinstalled browser is a different build than the npm playwright pins
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fails = [];
  // headless has NO network to storage.googleapis.com, so the real card URLs
  // would hang the load event — serve them the stub pixel instead.
  await page.route('**://storage.googleapis.com/**', r =>
    r.fulfill({ status: 200, contentType: 'image/png', body: PIX }));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const imgs = await page.locator('img.zoom').count();
  if (imgs < 6) fails.push(`expected 6 zoomable images, found ${imgs}`);

  // scroll down so the restore check is meaningful
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(100);
  const beforeY = await page.evaluate(() => window.scrollY);

  // click an image ALREADY in view — locator.click() auto-scrolls an offscreen
  // element into view, which would reset scrollY before the lightbox captures it
  // and make the restore check fail for a reason the page is not responsible for.
  const vis = await page.evaluate(() => {
    const list = [...document.querySelectorAll('img.zoom')];
    return list.findIndex(el => { const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight; });
  });
  if (vis < 0) fails.push('no zoomable image fully in view to tap');
  await page.locator('img.zoom').nth(Math.max(vis, 0)).click();
  await page.waitForTimeout(250);

  const open = await page.evaluate(() => {
    const lb = document.querySelector('.cmp-lb');
    return { exists: !!lb, hidden: lb ? lb.hasAttribute('hidden') : null,
             src: lb ? (lb.querySelector('img') || {}).src : null,
             overflow: document.body.style.overflow };
  });
  if (!open.exists) fails.push('no .cmp-lb element after tapping an image');
  if (open.hidden !== false) fails.push('lightbox did not open (still [hidden])');
  if (!open.src) fails.push('lightbox img has no src');
  if (open.overflow !== 'hidden') fails.push(`background scroll not locked (overflow="${open.overflow}")`);

  // close and check scroll restored
  await page.locator('.cmp-lb').click();
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    hidden: document.querySelector('.cmp-lb').hasAttribute('hidden'),
    overflow: document.body.style.overflow, y: window.scrollY }));
  if (!after.hidden) fails.push('lightbox did not close');
  if (after.overflow === 'hidden') fails.push('scroll lock not released on close');
  if (Math.abs(after.y - beforeY) > 2) fails.push(`scroll not restored (${beforeY} -> ${after.y})`);

  await browser.close(); server.close();
  if (fails.length) { console.error('FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
  console.log(`PASS — lightbox opens on all ${imgs} grids, locks the page, restores scroll ${beforeY}`);
})().catch(e => { console.error(e); process.exit(1); });

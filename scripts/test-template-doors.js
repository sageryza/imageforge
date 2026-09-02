#!/usr/bin/env node
// A TEMPLATE PAGE'S LIGHTBOX HAS THE DOORS (2026-09-01, Sophie, on a Compare
// page's swipe card: "why is there no playground button??? there shud always
// be a playground button / as long as there's a prompt there should be a
// playground button"). The grid and deck pages open THE shared lightbox
// through /asset-view.js, and that adapter passed no `actions` — so the one
// surface she reviews a batch on drew ♥/✕ and nothing else.
//
// Drives a page rendered by the REAL renderTemplatePage in headless Chromium:
//   1. the doors are the shared set — Playground · Shoebox · Save to Photos
//   2. the Playground door carries the FILED content half and says the port
//      recognised the style (sameref=1) — read off the url the browser lands on
//   3. a picture with no prompt still has the door, riding as the photo ref
//   4. INSIDE AN IFRAME (how the app shows a Compare page) the door moves the
//      TOP window, never the frame — or the Playground loads inside the viewer
//   5. a source pin: the renderer links both scripts the doors need
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const { validateTemplate, renderTemplatePage } = require('../page-templates');
const servePublic = require('./lib/public-asset');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQAB'
  + 'h6FO1AAAAABJRU5ErkJggg==', 'base64');
let SG = 'http://127.0.0.1:0';   // set once the stub is listening (a local picture, so it decodes)
const DREAMY = 'The FIRST attached image (refs/dream-mystery.jpg) is a STYLE reference — copy its drawing style. [content]';

function pageHtml() {
  const P = (n) => SG + '/px-' + n + '.png';
  const v = validateTemplate('grid', { groups: [
    { label: 'hot tubs', items: [
      { id: 'tub', label: 'a hot tub under the moon', img: P('tub'), full: P('tub'), url: P('tub'), model: 'gpt-image-2', quality: 'low',
        promptStyle: DREAMY, promptContent: 'a hot tub with magnificent tiles' },
      { id: 'bare', label: 'nothing filed', img: P('bare'), full: P('bare'), url: P('bare') },
    ] },
  ] });
  if (!v.ok) throw new Error(v.error);
  return renderTemplatePage({ title: 'Doors', template: 'grid', data: v.data,
    chat: 'test', sheet: 'page-doors' });
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/story/thumb' || url.pathname.startsWith('/px')) {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG);
  }
  if (url.pathname === '/api/chatfeed/verdict') return json({ ok: true, items: {}, texts: {} });
  if (url.pathname.startsWith('/api/gallery')) return json({ ok: true, assets: [], notes: [] });
  if (url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>playground stub</title>');
  }
  if (url.pathname === '/host') {
    // the app's page viewer: the Compare page in a same-origin iframe
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>host</title><iframe id="f" src="/page" style="width:390px;height:800px"></iframe>');
  }
  if (req.method === 'POST') { req.on('data', () => {}); return req.on('end', () => json({ ok: true })); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageHtml());
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  SG = base;
  const exe = (() => {
    if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
    for (const k of (() => { try { return fs.readdirSync('/opt/pw-browsers'); } catch { return []; } })()
      .filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => ok(false, 'page error: ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('cmp-tour-grid', '1'); localStorage.setItem('cmp-tour-deck', '1'); } catch (_) {} });

  const openTile = async (root, n) => {
    await root.click('.gd-it:nth-child(' + n + ') img');
    await root.waitForSelector('#clightbox .clwrap img');
  };
  const doorLabels = (root) => root.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#clightbox .lbacts button:not(.vote)'),
    (b) => b.getAttribute('aria-label') || ''));

  // 1 — the set
  await page.goto(base + '/page');
  await page.waitForSelector('.gd-it img');
  await openTile(page, 1);
  const labels = await doorLabels(page);
  ok(JSON.stringify(labels) === JSON.stringify(['Open in Playground', 'Add to Shoebox', 'Save to Photos']),
    'a Compare page picture has the shared doors — got ' + JSON.stringify(labels));

  // 2 — the Playground door carries the filed prompt, and the port knows the tile
  await Promise.all([
    page.waitForURL(/\/playground/, { timeout: 5000 }),
    page.click('#clightbox .lbacts button[aria-label="Open in Playground"]'),
  ]);
  let went = page.url();
  ok(/prompt=a%20hot%20tub%20with%20magnificent%20tiles/.test(went), 'the Playground door carries the exact content half — ' + went);
  ok(/style=dreamy/.test(went) && /sameref=1/.test(went), '…on the tile the port recognised, saying so — ' + went);

  // 3 — no prompt → the picture rides as the photo reference
  await page.goto(base + '/page');
  await page.waitForSelector('.gd-it img');
  await openTile(page, 2);
  await Promise.all([
    page.waitForURL(/\/playground/, { timeout: 5000 }),
    page.click('#clightbox .lbacts button[aria-label="Open in Playground"]'),
  ]);
  went = page.url();
  ok(/\/playground\?photo=/.test(went) && !/prompt=/.test(went), 'a picture with nothing filed rides as the photo reference, no prompt invented — ' + went);

  // 4 — inside the app's iframe the door moves the TOP window
  await page.goto(base + '/host');
  await page.waitForSelector('#f');
  const frame = page.frames().find((f) => f !== page.mainFrame());
  await frame.waitForSelector('.gd-it img');
  await openTile(frame, 1);
  await Promise.all([
    page.waitForURL(/\/playground/, { timeout: 5000 }),
    frame.click('#clightbox .lbacts button[aria-label="Open in Playground"]'),
  ]);
  ok(/\/playground\?/.test(page.url()), 'inside an iframe the door moves the top window, not the frame — ' + page.url());

  // 5 — source pin
  const html = pageHtml();
  ok(/<script src="\/asset-actions\.js"><\/script>/.test(html), 'the renderer links /asset-actions.js');
  ok(/<script src="\/playground-port\.js"><\/script>/.test(html), 'the renderer links /playground-port.js');
  ok(html.indexOf('/playground-port.js') < html.indexOf('/asset-view.js')
    && html.indexOf('/asset-actions.js') < html.indexOf('/asset-view.js'),
  '…both before the adapter that builds the row');

  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

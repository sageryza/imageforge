#!/usr/bin/env node
/* The hearts pages (run gen-triset-hearts.js first). Asserts ONE picture per
   row full width (never a 3-across wall), a kept pair sitting BACK TO BACK in
   quality order, no picture appearing twice, her notes rendered under the
   picture, the shared Assets lightbox opening on the original and stepping,
   and the injected pill surviving. */
const http = require('http'); const fs = require('fs');
const { chromium } = require('playwright');
const pill = fs.existsSync('public/pill-inject.html') ? fs.readFileSync('public/pill-inject.html', 'utf8') : '';
const PNG = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const data = JSON.parse(fs.readFileSync('docs/triset/hearts.json', 'utf8'));
const pages = { '/cur': '/tmp/hearts-current.html', '/ret': '/tmp/hearts-retired.html' };
const srv = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  if (pages[u]) { rs.setHeader('Content-Type', 'text/html'); return rs.end(fs.readFileSync(pages[u], 'utf8') + pill); }
  if (fs.existsSync('public' + u) && /\.(js|css)$/.test(u)) {
    rs.setHeader('Content-Type', u.endsWith('.css') ? 'text/css' : 'text/javascript');
    return rs.end(fs.readFileSync('public' + u));
  }
  if (u.startsWith('/api/story/thumb')) { rs.setHeader('Content-Type', 'image/webp'); return rs.end(PNG); }
  if (u.startsWith('/api/')) { rs.setHeader('Content-Type', 'application/json'); return rs.end('{"ok":true,"assets":[]}'); }
  rs.statusCode = 404; rs.end('');
});
srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
  const p = await b.newPage({ viewport: { width: 390, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.route('https://storage.googleapis.com/**', (r) => r.fulfill({ contentType: 'image/webp', body: PNG }));
  const fails = []; const ok = (n, c) => { if (!c) fails.push(n); };

  await p.goto(base + '/cur'); await p.waitForTimeout(900);
  const rows = await p.$$eval('.one', (els) => els.length);
  ok('every current heart has a row', rows === data.counts.current);
  // ONE AT A TIME: no two pictures share a row top, and each is full width
  const layout = await p.evaluate(() => {
    const im = [...document.querySelectorAll('.one img')];
    const tops = im.map((i) => Math.round(i.getBoundingClientRect().top));
    const wrap = document.querySelector('.wrap').getBoundingClientRect().width;
    return { sameTop: tops.length - new Set(tops).size, wide: im[0].getBoundingClientRect().width / wrap };
  });
  ok('never two on a row', layout.sameTop === 0);
  ok('full width', layout.wide > 0.9);
  // a kept pair is back to back and low comes first
  const pair = await p.evaluate(() => {
    const w = document.querySelector('.pairwrap'); if (!w) return null;
    const qs = [...w.querySelectorAll('.tq')].map((e) => e.textContent);
    const between = w.querySelectorAll('.one').length;
    return { qs, between, hd: (w.querySelector('.pairhd') || {}).textContent || '' };
  });
  ok('a kept pair exists', pair && pair.between >= 2);
  ok('low before medium', pair && /low/.test(pair.qs[0]) && /medium|high/.test(pair.qs[1]));
  ok('the pair is named', pair && /kept/i.test(pair.hd));
  // no picture twice
  const dupes = await p.$$eval('.one img', (els) => {
    const s = els.map((e) => e.dataset.u); return s.length - new Set(s).size;
  });
  ok('no picture appears twice', dupes === 0);
  // her notes render
  const noteCount = await p.$$eval('.note', (els) => els.length);
  ok('her notes are on the page', noteCount > 0);
  // the shared lightbox opens on the ORIGINAL and steps
  await p.$eval('.one img', (el) => el.click()); await p.waitForTimeout(400);
  const lbFull = await p.evaluate(() => ((document.querySelector('#clightbox img') || {}).src || '').includes('storage.googleapis'));
  ok('lightbox opens the original', lbFull);
  const cap1 = await p.evaluate(() => (document.getElementById('clightbox') || {}).textContent || '');
  await p.evaluate(() => { const im = document.querySelector('#clightbox img'); const r = im.getBoundingClientRect();
    const el = document.elementFromPoint(r.right - r.width * 0.1, r.top + r.height / 2); if (el) el.click(); });
  await p.waitForTimeout(400);
  const cap2 = await p.evaluate(() => (document.getElementById('clightbox') || {}).textContent || '');
  ok('the edge zone steps', cap1 !== cap2);
  ok('the pill survives', await p.evaluate(() => !!document.querySelector('.float') && typeof window.__scrollTap === 'function'));

  await p.goto(base + '/ret'); await p.waitForTimeout(700);
  const rRows = await p.$$eval('.one', (els) => els.length);
  ok('every retired heart has a row', rRows === data.counts.retired);
  ok('no kept pair was left on the retired page', await p.$$eval('.pairwrap', (els) => els.length) === 0);
  ok('no page errors', errs.length === 0);

  console.log(fails.length ? 'FAIL: ' + fails.join(' · ') : 'ok — 13 checks');
  if (errs.length) console.log(errs.slice(0, 2));
  await b.close(); srv.close(); process.exit(fails.length || errs.length ? 1 : 0);
});

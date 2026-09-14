#!/usr/bin/env node
/* FOOTAGE — THE RECENT DRAWER: SEE OLDER, AND ORGANIZE (2026-09-14, Sophie:
   "add a more / see older references / and organize button mode / to delete
   and add recent references without using them").

   Two complaints in one. The drawer was the newest 24 references with nothing
   behind them reachable at all, and every tap on it meant ATTACH — so the only
   thing she could do with a tile was use it.

   EVERY ASSERTION HERE IS A MEASUREMENT of the rendered drawer, of what the
   send really POSTs, or of what is really in localStorage. A tile that wears a
   ✕ and attaches anyway, an opener that widens nothing, a removal that never
   reached storage and an upload that lands on the job as well as the drawer
   are all the same markup to any source assertion.

   Run: node scripts/test-footage-recent-organize.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE RECENT ORGANIZE — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE RECENT ORGANIZE — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage recent organize: playwright not installed — skipped'); report(); return; }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const F = require('../footage');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const posted = [];

// 30 jobs, one distinct reference each — more than the drawer's page of 24, so
// the opener has something real behind it.
let jobs = [];
for (let i = 0; i < 30; i++) {
  const n = String(i).padStart(2, '0');
  jobs.push({
    id: 'j' + n, prompt: 'shot ' + n, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/clip-' + n + '.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    refs: [{ url: 'http://127.0.0.1:PORT/still-' + n + '.png', kind: 'image', name: 'still ' + n }],
    // newest first: still-00 is the newest
    sentAt: new Date(Date.UTC(2026, 8, 10, 8, 0, 0) - i * 60000).toISOString(),
    cost: 4, estimate: 4, vote: '', hidden: false,
  });
}

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname.endsWith('.png')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname.endsWith('.mp4')) { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(''); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
        models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      posted.push(JSON.parse(body));
      return json({ ok: true, jobId: 'new1', door: 'atlascloud', fellBack: false, estimate: 4 }, 202);
    }
    if (u.pathname === '/api/drop/upload-file') {
      return json({ ok: true, item: { url: 'http://127.0.0.1:' + server.address().port + '/uploaded.png', posterUrl: '' } });
    }
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) return json({ ok: true });
    res.writeHead(404); res.end('nope');
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  jobs = JSON.parse(JSON.stringify(jobs).replace(/PORT/g, String(port)));
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#job-j00');
  await page.waitForTimeout(400);

  const tiles = () => page.$$eval('#recent .rcw', (els) => els.length);
  const labels = () => page.$$eval('#recent .rc', (els) => els.map((e) => e.getAttribute('aria-label') || ''));
  const opener = () => page.$$eval('#recent .olderbtn', (els) => els.map((e) => e.textContent.trim()));
  const shown = () => page.evaluate(() => {
    const el = document.getElementById('recent');
    return !el.hidden && el.getBoundingClientRect().height > 0;
  });
  const attached = () => page.$$eval('#refs .ref', (els) => els.length);

  ok('no page errors', errors.length === 0);

  // ── … OLDER REFERENCES ───────────────────────────────────────────────────
  await page.click('#rectog');
  await page.waitForTimeout(200);
  ok('the drawer opens on one page of 24', (await tiles()) === 24);
  ok('and it says there are older ones behind them', (await opener()).length === 1 && (await opener())[0] === '… older references');
  ok('the newest reference leads', /still 00/.test((await labels())[0]));
  ok('the 25th is NOT drawn yet', !(await labels()).some((a) => /still 24/.test(a)));

  await page.click('#recent .olderbtn');
  await page.waitForTimeout(150);
  ok('the opener really widens the drawer', (await tiles()) === 30);
  ok('and the older reference is on screen now', (await labels()).some((a) => /still 29/.test(a)));
  ok('with nothing left behind it, the opener is gone', (await opener()).length === 0);

  // A widened drawer is a MOMENT, not a setting — closing it puts it back to
  // the calm 24.
  await page.click('#rectog');
  await page.waitForTimeout(120);
  ok('closing it hides it', !(await shown()));
  await page.click('#rectog');
  await page.waitForTimeout(150);
  ok('and reopening is one page again', (await tiles()) === 24);

  // ── ORGANIZE: A TAP NO LONGER USES ONE ───────────────────────────────────
  ok('no tile wears a ✕ before she organizes', (await page.$$('#recent .rcw .rx')).length === 0);
  ok('the picture button still says it adds a reference',
    (await page.$eval('#add', (e) => e.getAttribute('aria-label'))) === 'Add a reference');

  await page.click('#recorg');
  await page.waitForTimeout(150);
  ok('lit, every tile wears a ✕', (await page.$$('#recent .rcw .rx')).length === 24);
  ok('and the button says it is on', await page.$eval('#recorg', (e) => e.classList.contains('on') && e.getAttribute('aria-pressed') === 'true'));
  ok('the picture button says what it will do instead',
    /without attaching/.test(await page.$eval('#add', (e) => e.getAttribute('aria-label'))));

  ok('nothing is attached yet', (await attached()) === 0);
  await page.$$eval('#recent .rc', (els) => els[0].click());
  await page.waitForTimeout(200);
  // THE WHOLE OF HER ASK: organizing never uses one. Measured off the strip,
  // since a tap that attaches and one that opens a lightbox are the same
  // handler to any source assertion.
  ok('a tap on a tile while organizing attaches NOTHING', (await attached()) === 0);
  await page.evaluate(() => { const p = document.getElementById('shot'); if (p) p.hidden = true; const q = document.getElementById('player'); if (q) q.hidden = true; });

  // ── DELETE, AND THE UNDO ─────────────────────────────────────────────────
  const before = await labels();
  await page.$$eval('#recent .rcw .rx', (els) => els[0].click());
  await page.waitForTimeout(200);
  const after = await labels();
  // the page stays a page: taking one off pulls the next older one in behind
  // it, which is what "24 at a time" means
  ok('the ✕ takes that one off the drawer', !after.some((a) => /still 00/.test(a)));
  ok('and an older one slides in behind it', after.length === before.length && after.some((a) => /still 24/.test(a)));
  ok('and it really reached her phone',
    (await page.evaluate(() => JSON.parse(localStorage.getItem('footage_rechide') || '[]'))).some((u) => /still-00\.png/.test(u)));
  ok('an undo is offered', (await page.$$('#recent .recundo')).length === 1);
  await page.click('#recent .recundo');
  await page.waitForTimeout(200);
  ok('and it puts it back where it was', (await labels())[0] === before[0]);
  ok('with nothing left hidden on her phone',
    (await page.evaluate(() => JSON.parse(localStorage.getItem('footage_rechide') || '[]'))).length === 0);
  ok('and the undo is gone with it', (await page.$$('#recent .recundo')).length === 0);

  // A REMOVAL OUTLIVES THE PAGE — the drawer is derived, so this is the one
  // half of it that has to be written down.
  await page.$$eval('#recent .rcw .rx', (els) => els[1].click());
  await page.waitForTimeout(200);
  ok('a second removal takes a different one off', !(await labels()).some((a) => /still 01/.test(a)));
  await page.reload();
  await page.waitForSelector('#job-j00');
  await page.waitForTimeout(400);
  await page.click('#rectog');
  await page.waitForTimeout(200);
  ok('it is still off after a reload', !(await labels()).some((a) => /still 01/.test(a)));
  ok('and the mode did not survive the reload', (await page.$$('#recent .rcw .rx')).length === 0);

  // ── ADD WITHOUT USING IT ─────────────────────────────────────────────────
  await page.click('#recorg');
  await page.waitForTimeout(150);
  const was = await tiles();
  await page.setInputFiles('#file', { name: 'a-new-one.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(500);
  ok('the upload lands ON THE DRAWER', (await labels()).some((a) => /a-new-one\.png/.test(a)) && (await tiles()) === was);
  ok('and it attaches to nothing', (await attached()) === 0);
  ok('a reference she added leads the drawer', /a-new-one\.png/.test((await labels())[0]));

  // ── DONE ORGANIZING: A TAP MEANS ATTACH AGAIN ────────────────────────────
  await page.click('#recorg');
  await page.waitForTimeout(150);
  ok('the ✕ marks come off', (await page.$$('#recent .rcw .rx')).length === 0);
  ok('and the picture button says it attaches again',
    (await page.$eval('#add', (e) => e.getAttribute('aria-label'))) === 'Add a reference');
  await page.$$eval('#recent .rc', (els) => els[0].click());
  await page.waitForSelector('#refs .ref');
  ok('a tap attaches the one she added', (await attached()) === 1);

  await page.fill('#prompt', 'the room again');
  await page.click('#go');
  await page.waitForTimeout(400);
  const sent = posted[0] || {};
  ok('and it really rides the job', (sent.refs || []).some((r) => /uploaded\.png/.test(r.url)));
  ok('carrying nothing she only looked at', (sent.refs || []).length === 1);
  ok('still no page errors', errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

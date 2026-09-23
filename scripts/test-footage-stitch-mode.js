#!/usr/bin/env node
/* FOOTAGE — STITCH MODE (2026-09-23, Sophie: "make a version of stitch mode
   where i press the stitch mode icon in footage and then i select the clips
   and add numbers to them · and then they go to the stitch area in that
   order").

   The real public/footage.html in headless Chromium against a stub that
   RECORDS what the page really POSTs — a lit number on a tile says nothing
   about what left the phone. Every check a measurement: the number READ off
   the tile, the doors really gone under the mode, a heart in the mode still
   a heart, the order surviving a reload, the list card's picture picking
   rather than playing, and the ids the stub received in the order she tapped.

   Run: node scripts/test-footage-stitch-mode.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE STITCH MODE — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE STITCH MODE — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage stitch mode: playwright not installed — skipped'); report(); return; }
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
// REAL-SHAPED IDS (test-stitch's own lesson): a part's id is `<job>:<sha1>`.
const J1 = '27fcbe6e73354f0599715eb38dee352f';
const J2 = 'aY9LbIGMe9T5lEcA984a';
const J3 = 'bZ8KaHFLd8S4kDbZ873b';   // trimmed — two baked parts
const JD = 'ee0f9a48-57c5-4e91-b222-90fe5fd489ab';   // still drawing
const K1 = crypto.createHash('sha1').update('b|1|5').digest('hex');
const K2 = crypto.createHash('sha1').update('b|8|14').digest('hex');
const base = { model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 4, resolution: '480p', ratio: '3:4', sound: true, refs: [], vote: '', hidden: false, project: 'witch', folder: '' };
const jobs = [
  { ...base, id: J1, prompt: 'the first clip', status: 'done', video: '/a.mp4', source: '/a.mp4', poster: '/a.png', sentAt: '2026-09-23T08:03:00.000Z', trims: [] },
  { ...base, id: J2, prompt: 'the second clip', status: 'done', video: '/b.mp4', source: '/b.mp4', poster: '/b.png', sentAt: '2026-09-23T08:02:00.000Z', trims: [] },
  { ...base, id: J3, prompt: 'the trimmed clip', status: 'done', video: '/c.mp4', source: '/c.mp4', poster: '/c.png', sentAt: '2026-09-23T08:01:00.000Z',
    trims: [{ key: K1, status: 'ready', url: '/c1.mp4', poster: '/c.png', start: 1, end: 5, seconds: 4 }, { key: K2, status: 'ready', url: '/c2.mp4', poster: '', start: 8, end: 14, seconds: 6 }] },
  { ...base, id: JD, prompt: 'still drawing', status: 'drawing', video: '', source: '', poster: '', sentAt: '2026-09-23T08:00:00.000Z', trims: [] },
];
const posted = [];   // every body the stub received on /api/stitch/from-footage
const votes = [];

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
    if (u.pathname === '/stitch') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>Stitch stub</title><h1 id="stub">stitch</h1>'); }
    if (u.pathname.endsWith('.png') || u.pathname === '/api/story/thumb') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
        models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, chat: 'footage' });
    }
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'witch', name: 'Secretly a Witch', order: 0 }] });
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/shelf') return json({ ok: true, shelf: {}, folders: { witch: [] } });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs, more: false, folders: { witch: [] } });
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) { votes.push(u.pathname); return json({ ok: true }); }
    if (u.pathname === '/api/stitch/from-footage' && req.method === 'POST') {
      let b = {}; try { b = JSON.parse(body); } catch (e) {}
      posted.push(b);
      return json({ ok: true, id: 'st1', title: 'Stitch · Sep 23', clips: (b.ids || []).length, seconds: 10, missing: [], dropped: [] });
    }
    if (u.pathname.startsWith('/api/')) return json({ ok: true });
    res.writeHead(404); res.end('nope');
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#job-' + J1);
  await page.click('#v-tiles');
  await page.waitForSelector('#tiles .cell');
  await page.waitForTimeout(300);
  const cell = (id) => `#tiles .cell[data-id="${id}"]`;
  const num = (id) => page.$eval(cell(id) + ' .snum', (e) => e.textContent);
  const shown = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; });

  ok('no page errors on load', errors.length === 0);
  ok('the mode button wears Stitch\'s own glyph', await page.$eval('#v-stitch svg rect', (e) => !!e));
  ok('OFF: the row under the bar is not drawn and the doors are on the tiles',
    !(await shown('#stitchrow')) && await shown(cell(J1) + ' .tdoor.play'));
  ok('OFF: a tile wears no number', (await num(J1)) === '' && !(await shown(cell(J1) + ' .snum')));

  // ── ON ──────────────────────────────────────────────────────────────────
  await page.click('#v-stitch');
  await page.waitForTimeout(100);
  ok('ON: the button lights and the body says so', await page.$eval('#v-stitch', (e) => e.classList.contains('on') && e.getAttribute('aria-pressed') === 'true') && await page.$eval('body', (b) => b.classList.contains('stitching')));
  ok('ON: the row appears, saying what to do, with Send off until something is numbered',
    await shown('#stitchrow') && /Tap clips/.test(await page.$eval('#stcount', (e) => e.textContent)) && await page.$eval('#stsend', (e) => e.disabled));
  ok('ON: the doors leave the tiles — the whole tile is the pick', !(await shown(cell(J1) + ' .tdoor.play')));

  // tap in HER order: second, first, the trimmed one
  const tapCell = async (id) => { const b = await page.$eval(cell(id), (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await page.mouse.click(b.x, b.y); await page.waitForTimeout(80); };
  await tapCell(J2);
  ok('the first tap puts 1 on that tile, READ off it', (await num(J2)) === '1' && await shown(cell(J2) + ' .snum'));
  ok('and the player did not open', await page.$eval('#player', (e) => e.hidden));
  await tapCell(J1);
  ok('the next tap is 2', (await num(J1)) === '2' && (await num(J2)) === '1');
  await tapCell(J3);
  ok('a trimmed clip puts its PARTS in, one number each, and reads as a range', (await num(J3)) === '3–4');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });   // the PHOTO for her
  ok('Send stays clear of the pill\'s column (the bar is sticky at the bottom too)', (await page.$eval('#stsend', (e) => e.getBoundingClientRect().right)) <= 390 - 64);
  ok('the count says four', /^4 clips numbered$/.test(await page.$eval('#stcount', (e) => e.textContent)) && !(await page.$eval('#stsend', (e) => e.disabled)));
  await tapCell(JD);
  ok('a clip still drawing takes no number', (await num(JD)) === '' && /^4 clips/.test(await page.$eval('#stcount', (e) => e.textContent)));
  ok('a picked tile is outlined, an unpicked one is not', await page.$eval(cell(J1), (e) => e.classList.contains('picked')) && !(await page.$eval(cell(JD), (e) => e.classList.contains('picked'))));

  // the second tap takes the number off and the ones after move up
  await tapCell(J2);
  ok('un-numbering 1 moves the rest up: the first clip is now 1, the parts 2–3',
    (await num(J2)) === '' && (await num(J1)) === '1' && (await num(J3)) === '2–3');

  // a heart in the mode is still a heart
  await page.click(cell(J1) + ' .tmark.heart');
  await page.waitForTimeout(100);
  ok('a heart tapped in the mode votes and does NOT change the number', votes.length === 1 && (await num(J1)) === '1');

  // ── the order survives a reload (the self-heal, the poll) ──────────────
  await page.reload();
  await page.waitForSelector('#tiles .cell');
  await page.waitForTimeout(300);
  ok('after a reload the mode is still on and the numbers are still there',
    await page.$eval('body', (b) => b.classList.contains('stitching')) && (await num(J1)) === '1' && (await num(J3)) === '2–3');

  // ── the list view: the card's picture picks rather than plays ──────────
  await page.click('#v-list');
  await page.waitForTimeout(150);
  const cardNum = (id) => page.$eval('#job-' + id + ' .thumb .snum', (e) => e.textContent);
  ok('the list card wears the same number on its picture', (await cardNum(J1)) === '1' && (await cardNum(J3)) === '2–3' && await shown('#job-' + J1 + ' .thumb .snum'));
  await page.click('#job-' + J2 + ' .thumb');
  await page.waitForTimeout(100);
  ok('tapping a card\'s picture in the mode numbers it (3) and does not open the player', (await cardNum(J2)) === '4' && await page.$eval('#player', (e) => e.hidden));

  // ── SEND: what left the phone is the order she tapped ──────────────────
  await page.click('#stsend');
  await page.waitForURL(/\/stitch\?s=st1$/, { timeout: 5000 }).catch(() => {});
  ok('one POST left, carrying the ids in her order — the parts by their own ids', posted.length === 1
    && JSON.stringify(posted[0].ids) === JSON.stringify([J1, J3 + ':' + K1, J3 + ':' + K2, J2]) && posted[0].project === '');
  ok('and the page went to the stitch it made', /\/stitch\?s=st1$/.test(page.url()));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#job-' + J1);
  await page.waitForTimeout(200);
  ok('back on Footage the numbers are gone and the mode is off — they became the stitch',
    !(await page.$eval('body', (b) => b.classList.contains('stitching'))) && (await page.evaluate(() => (JSON.parse(sessionStorage.getItem('footage_stitch') || '{}').order || []).length)) === 0);

  // ── clear ──────────────────────────────────────────────────────────────
  await page.click('#v-stitch');
  await page.click('#job-' + J1 + ' .thumb');
  await page.waitForTimeout(80);
  ok('clear shows once something is numbered', !(await page.$eval('#stclear', (e) => e.hidden)));
  await page.click('#stclear');
  await page.waitForTimeout(80);
  ok('clear takes every number off and hides itself', (await cardNum(J1)) === '' && await page.$eval('#stclear', (e) => e.hidden) && await page.$eval('#stsend', (e) => e.disabled));
  ok('turning the mode off takes the numbers off the screen, not out of the list', await (async () => {
    await page.click('#job-' + J1 + ' .thumb'); await page.click('#v-stitch'); await page.waitForTimeout(80);
    const off = (await cardNum(J1)) === '' && !(await page.$eval('body', (b) => b.classList.contains('stitching')));
    await page.click('#v-stitch'); await page.waitForTimeout(80);
    return off && (await cardNum(J1)) === '1';
  })());
  ok('the help names the mode', /Stitch mode\./.test(await page.$eval('#helpcard', (e) => e.textContent)));
  ok('no page errors throughout', errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });

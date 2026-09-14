#!/usr/bin/env node
/* FOOTAGE — THE FOLDER PICKER IS A POSTER SHEET (2026-09-13, Sophie, after
   four mocked options: "i like poster" · "more per row so all fit" · "5!").

   The picker was a <select> drawn as a folder icon and its rows were a LIST —
   the one shape a shelf of films should not be, since every folder here
   already has a picture: the last clip drawn in it. Now the icon opens a
   sheet of poster tiles, five across, WIDENING itself when five would push a
   row off the bottom.

   Every assertion is a MEASUREMENT of the rendered sheet or a reading of what
   the stub really received. A grid that sets --c and never reflows, one that
   narrows on a small project, a tile wearing another folder's picture, and a
   sheet that repaints its <img> on every poll all look identical in the
   source — and the last one strobes every poster blank on iOS.

   Run: node scripts/test-footage-shelf.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE SHELF — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE SHELF — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage shelf: playwright not installed — skipped'); report(); return; }
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

// ── the shelf's own rule, pure (footage.js's shelfOf) ─────────────────────
{
  const rows = [
    { d: { project: 'witch', folder: 'doctor', poster: 'p-old.jpg', sentAt: '2026-09-01' } },
    { d: { project: 'witch', folder: 'doctor', poster: 'p-new.jpg', sentAt: '2026-09-05' } },
    { d: { project: 'witch', folder: 'doctor', poster: 'p-hidden.jpg', sentAt: '2026-09-09', hidden: true } },
    { d: { project: 'witch', folder: 'salem', poster: '', sentAt: '2026-09-04' } },
    { d: { project: 'witch', poster: 'loose.jpg', sentAt: '2026-09-02' } },
    { d: { poster: 'nowhere.jpg', sentAt: '2026-09-03' } },
  ];
  const out = F.shelfOf(rows);
  ok('the face is the NEWEST clip that really drew', out['witch/doctor'].poster === 'p-new.jpg');
  ok('a hidden clip faces nothing and is counted by nobody', out['witch/doctor'].n === 2 && out['witch/doctor'].poster !== 'p-hidden.jpg');
  ok('a project counts every clip in it, its folders included — ' + out.witch.n, out.witch.n === 4);
  ok('a folder with no finished clip still gets a count and NO face', out['witch/salem'].n === 1 && out['witch/salem'].poster === '');
  ok('a clip filed nowhere is on no tile', !Object.keys(out).some((k) => /nowhere/.test(JSON.stringify(out[k]))));
}

// ── the page ──────────────────────────────────────────────────────────────
// ONE project with MANY folders, so the widening really has to fire: at five
// across these would run past the bottom of a 390x844 sheet.
const FOLDERS = ['doctor', 'school-lecture', 'normal-girl', 'travel-kit', 'home-away', 'b-roll',
  'influencer', 'tree-stolen', 'its-sophie', 'packing-orders', 'garage', 'christmas',
  'pill', 'salem', 'huge-kit', 'not-always']
  .concat('abcdefghijklmnopqrstuvwxyz'.split(''))
  .concat('abcdefghijklmnopqrstuvwxyz'.split('').map((c) => c + c));
const FILMS = [{ slug: 'witch', name: 'Secretly a Witch', order: 0 }, { slug: 'ward', name: 'The ward', order: 1 }];
let shelfReads = 0;
const jobs = [
  { id: 'j1', prompt: 'a clip', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 4,
    resolution: '480p', ratio: '16:9', sound: true, status: 'done', video: '', poster: '',
    refs: [], sentAt: '2026-09-10T08:00:00.000Z', vote: '', hidden: false, project: 'witch', folder: 'doctor' },
];

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
    if (u.pathname.endsWith('.png') || u.pathname === '/api/story/thumb') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
        models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, chat: 'footage' });
    }
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: FILMS });
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/shelf') {
      shelfReads += 1;
      const shelf = { witch: { n: 143, poster: '/face.png' }, ward: { n: 5, poster: '/face.png' } };
      FOLDERS.forEach((f, i) => { shelf['witch/' + f] = { n: i + 1, poster: i === 3 ? '' : '/face.png' }; });
      const folders = { witch: FOLDERS.slice(), ward: [] };
      return json({ ok: true, shelf, folders });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      const proj = u.searchParams.get('project') || '';
      const fold = proj ? (u.searchParams.get('folder') || '') : '';
      const mine = jobs.filter((j) => (!proj || j.project === proj) && (!fold || j.folder === fold));
      return json({ ok: true, jobs: mine, more: false, folders: { witch: FOLDERS.slice() } });
    }
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) return json({ ok: true });
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
  await page.waitForSelector('#job-j1');
  await page.waitForTimeout(400);

  ok('no page errors', errors.length === 0);
  ok('the sheet is shut until she taps the folder icon', await page.$eval('#shelf', (e) => e.hidden));
  ok('nothing read the faces before it opened', shelfReads === 0);

  await page.click('#projwrap');
  await page.waitForSelector('#shgrid .shtile');
  await page.waitForTimeout(500);
  ok('opening it reads the faces once', shelfReads === 1);

  // ── LEVEL 1: the films ──────────────────────────────────────────────────
  const l1 = await page.evaluate(() => {
    const g = document.getElementById('shgrid');
    const t = [...g.children];
    return { rows: t.map((b) => (b.getAttribute('data-go') || '') + '=' + b.querySelector('i').textContent),
      cols: getComputedStyle(g).getPropertyValue('--c').trim(),
      overflow: g.scrollHeight - g.clientHeight,
      into: t.filter((b) => b.getAttribute('data-into')).map((b) => b.getAttribute('data-into')),
      faces: t.filter((b) => b.querySelector('img')).length,
      counts: t.map((b) => (b.querySelector('b') || {}).textContent || '') };
  });
  ok('level 1 is All, the films, then New project — ' + l1.rows.join(' '),
    l1.rows[0] === '=All' && l1.rows[1] === 'witch=Secretly a Witch' && l1.rows[l1.rows.length - 1] === '__new=New project');
  ok('a film with folders descends, one without does not — ' + l1.into.join(','), l1.into.join(',') === 'witch');
  ok('the tiles wear faces and counts — ' + l1.counts.join(','), l1.faces >= 2 && l1.counts.includes('143'));
  ok('five across on a short level, never narrower — ' + l1.cols, l1.cols === '5');

  // ── LEVEL 2: 36 folders, so five across does NOT fit ────────────────────
  await page.click('.shtile[data-into="witch"]');
  await page.waitForSelector('#shgrid .shtile[data-go="witch/doctor"]');
  await page.waitForTimeout(300);
  const l2 = await page.evaluate(() => {
    const g = document.getElementById('shgrid');
    const t = [...g.children];
    const rowTops = [...new Set(t.map((b) => Math.round(b.getBoundingClientRect().top)))];
    return { n: t.length, cols: getComputedStyle(g).getPropertyValue('--c').trim(),
      overflow: g.scrollHeight - g.clientHeight,
      perRow: t.filter((b) => Math.round(b.getBoundingClientRect().top) === rowTops[0]).length,
      rows: rowTops.length, tileW: Math.round(t[0].getBoundingClientRect().width),
      first: t[0].querySelector('i').textContent,
      last: t[t.length - 1].querySelector('i').textContent,
      title: document.getElementById('shtitle').textContent,
      back: !document.getElementById('shback').hidden,
      tuck: document.getElementById('shtuck').textContent,
      faceless: t.filter((b) => !b.querySelector('img') && !b.classList.contains('dash')).map((b) => b.querySelector('i').textContent),
      pretty: t.map((b) => b.querySelector('i').textContent) };
  });
  ok('level 2 leads with Everything and ends with New folder — ' + l2.first + ' … ' + l2.last,
    l2.first === 'Everything' && l2.last === 'New folder' && l2.title === 'Secretly a Witch' && l2.back);
  ok('the tuck is a word in the sheet\'s header, inside a project only — ' + l2.tuck, /Hide from All/.test(l2.tuck));
  // THE WIDENING — the point of the whole thing, MEASURED off the real boxes
  ok('with ' + (FOLDERS.length + 2) + ' tiles it widened past five — ' + l2.cols + ' across, ' + l2.perRow + ' on the first row',
    Number(l2.cols) > 5 && l2.perRow === Number(l2.cols));
  ok('and it stops at eight — ' + l2.cols, Number(l2.cols) <= 8);
  ok('the grid still scrolls when even eight cannot hold them, rather than hiding one — ' + l2.n + ' tiles, overflow ' + l2.overflow,
    l2.n === FOLDERS.length + 2 && (l2.overflow <= 1 || (await page.evaluate(() => getComputedStyle(document.getElementById('shgrid')).overflowY)) === 'auto'));
  // a folder nothing finished in shows an EMPTY square, never a neighbour's picture
  ok('a folder with no finished clip draws no face — ' + l2.faceless.join(','), l2.faceless.length === 1 && l2.faceless[0] === 'Travel kit');
  ok('a folder slug reads back as words — ' + l2.pretty.slice(1, 4).join(','), l2.pretty.includes('School lecture') && l2.pretty.includes('Travel kit'));

  // ── A REPAINT NEVER REBUILDS WHAT DID NOT CHANGE ────────────────────────
  const same = await page.evaluate(() => {
    const g = document.getElementById('shgrid');
    const before = g.children[1];
    window.__shelfRepaint = true;
    // the page repaints the sheet on every paintProject — poll, vote, films
    document.getElementById('title').dispatchEvent(new Event('x'));
    return new Promise((r) => setTimeout(() => {
      const im = g.querySelector('img');
      r({ sameNode: g.children[1] === before, decoded: !!im });
    }, 400));
  });
  ok('the tiles are not rebuilt under her — the posters keep their nodes', same.sameNode);

  // ── PICKING ─────────────────────────────────────────────────────────────
  await page.click('.shtile[data-go="witch/doctor"]');
  await page.waitForTimeout(400);
  const picked = await page.evaluate(() => ({
    shut: document.getElementById('shelf').hidden,
    title: document.getElementById('title').textContent,
    lit: document.getElementById('projwrap').classList.contains('on'),
    saved: localStorage.getItem('footage_project') + '/' + localStorage.getItem('footage_folder') }));
  ok('picking a folder closes the sheet, lights the icon and names it in the header — ' + picked.title,
    picked.shut && picked.lit && picked.title === 'Secretly a Witch › Doctor' && picked.saved === 'witch/doctor');

  // reopening lands where she is, and the tile she is on is the lit one
  await page.click('#projwrap');
  await page.waitForSelector('#shgrid .shtile');
  const back = await page.evaluate(() => ({
    title: document.getElementById('shtitle').textContent,
    lit: [...document.querySelectorAll('#shgrid .shtile.on')].map((b) => b.getAttribute('data-go')) }));
  ok('reopening lands inside the project she is in, with her folder lit — ' + back.lit.join(','),
    back.title === 'Secretly a Witch' && back.lit.join(',') === 'witch/doctor');

  // the way out
  await page.click('#shclose');
  await page.waitForTimeout(150);
  ok('the ✕ closes it', await page.$eval('#shelf', (e) => e.hidden));
  await page.click('#projwrap');
  await page.waitForSelector('#shgrid .shtile');
  const navBack = await page.evaluate(() => { const r = window.__navBack(); return { took: r, shut: document.getElementById('shelf').hidden }; });
  ok('and the app\'s chevron closes it first rather than leaving the tool', navBack.took && navBack.shut);

  // the self-heal holds while it is open
  await page.click('#projwrap');
  await page.waitForSelector('#shgrid .shtile');
  const held = await page.evaluate(() => { if (!window.__ftHeal) return 'no heal'; window.__ftHeal.reset(); return window.__ftHeal.holding(); });
  ok('a silent reload is held while the sheet is open — ' + held, /folder sheet/.test(String(held)));

  ok('still no page errors', errors.length === 0);
  await browser.close(); server.close();
  report();
})();

#!/usr/bin/env node
/* lightroom.js + public/lightroom-sync.py + public/lightroom.html.

   Pure: her mom's title rules (N + a number is a piece; sold / sample bag /
   gave / gifted / donated are out; anything else is "other"), the grouping
   (photos of one piece in file order, front first), the judge item shape
   (one card, every photo on it), and the send plan (stars first, never a
   piece already sent, capped).

   The script: a SYNTHETIC Lightroom Classic catalog (the SQLite tables the
   script reads — Adobe_images, AgLibraryFile, AgLibraryFolder,
   AgLibraryRootFolder, Adobe_AdditionalMetadata with dc:title XMP,
   AgLibraryCollection*), a previews.db and .lrprev files holding three JPEG
   levels each, driven against a stub server: the necklace folder is sent
   and the rest is not, the level around 1,000px is the one chosen, titles
   come out of the XMP, /have makes a second run send nothing.
   THE REAL CATALOG'S SCHEMA IS AN ASSUMPTION THIS TEST ENCODES, not proves —
   the first run on her mom's PC is the measurement; `--dry` prints it.

   The page (headless Chromium, skipped without playwright): the real
   lightroom.html over a stubbed API — the judge deck draws one card per
   piece with all its photos, her four words as chips, a chip saves a
   verdict, and Send arms then POSTs with confirm:true.

   Run: node scripts/test-lightroom.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'lightroom.js'));
let pass = 0, failed = 0;
const ok = (c, m) => { if (c) pass++; else { failed++; console.log('  ✗ ' + m); } };

// ── her rules ──
{
  ok(L.classify('N 123').key === 'N123' && L.classify('N 123').kind === 'piece', 'N 123 is piece N123');
  ok(L.classify('n0045').key === 'N45', 'n0045 → N45 (case and zeros folded)');
  ok(L.classify('N-7').key === 'N7', 'N-7 → N7');
  ok(L.classify('N 12 sold').kind === 'excluded', 'sold is out');
  ok(L.classify('N 12 Sample Bag').kind === 'excluded', 'sample bag is out');
  ok(L.classify('gave to Ruth').kind === 'excluded' && L.classify('N3 gifted').kind === 'excluded' && L.classify('donated N9').kind === 'excluded', 'gave / gifted / donated are out');
  ok(L.classify('N 12 blue').kind === 'other', 'N with words is other, not a piece');
  ok(L.classify('').kind === 'untitled' && L.classify(null).kind === 'untitled', 'no title is untitled');
  const docs = [
    { kind: 'piece', piece: 'N12', title: 'N 12', file: 'IMG_0012-2.jpg', url: 'u2', thumb: 't2', image: '2' },
    { kind: 'piece', piece: 'N12', title: 'N 12', file: 'IMG_0012.jpg', url: 'u1', thumb: 't1', image: '1' },
    { kind: 'piece', piece: 'N3', title: 'N3', file: 'a.jpg', url: 'u3', thumb: 't3', image: '3' },
    { kind: 'other', piece: '', title: 'necklace blue', file: 'b.jpg' },
    { kind: 'excluded', piece: '', title: 'N 4 sold', file: 'c.jpg' },
    { kind: 'untitled', piece: '', title: '', file: 'd.jpg' },
  ];
  const g = L.groupPieces(docs);
  ok(g.pieces.map(p => p.key).join() === 'N3,N12', 'pieces sorted by number');
  ok(g.pieces[1].photos.map(p => p.file).join() === 'IMG_0012.jpg,IMG_0012-2.jpg', 'photos in file order, the front first');
  ok(g.counts.pieces === 2 && g.counts.other === 1 && g.counts.excluded === 1 && g.counts.untitled === 1 && g.counts.photos === 6, 'counts');
  const it = L.judgeItem(g.pieces[1]);
  ok(it.id === 'N12' && it.pair.length === 2 && it.pair[0].label === 'front' && /2 photos/.test(it.label), 'a two-photo piece is one card with both on it');
  ok(L.judgeItem(g.pieces[0]).img === 'u3' && !L.judgeItem(g.pieces[0]).pair, 'a one-photo piece is a plain card');
  ok(L.STATES.map(s => s.key).join() === 'star,yes,maybe,no', 'her four words');
  const pieces = [{ key: 'N1' }, { key: 'N2' }, { key: 'N3' }, { key: 'N4' }, { key: 'N5' }];
  const v = { N1: 'yes', N2: 'star', N3: 'no', N4: 'star', N5: 'yes' };
  let plan = L.sendPlan({ pieces, verdicts: v, pick: 'star', limit: 5 });
  ok(plan.pieces.map(p => p.key).join() === 'N2,N4' && plan.cost === 0.6, 'starred only');
  plan = L.sendPlan({ pieces, verdicts: v, pick: 'both', limit: 3, sent: { N2: true } });
  ok(plan.pieces.map(p => p.key).join() === 'N4,N1,N5' && plan.skipped === 0, 'both: stars first, a sent one skipped, capped');
  plan = L.sendPlan({ pieces, verdicts: v, pick: 'both', limit: 2 });
  ok(plan.pieces.length === 2 && plan.skipped === 2, 'the cap leaves the rest for next time');
  plan = L.sendPlan({ pieces, verdicts: v, keys: ['N3', 'N5'], limit: 99 });
  ok(plan.pieces.map(p => p.key).join() === 'N3,N5' && plan.pieces.length === 2, 'named keys win over the verdicts');
  ok(L.sendPlan({ pieces, verdicts: v, pick: 'star', limit: 1000 }).pieces.length === 2 && L.MAX_SEND === 40, 'limit clamps');
}
console.log(`lightroom pure: ${pass} passed, ${failed} failed`);

// ── the script against a synthetic catalog ──
(async () => {
  const sharp = require('sharp');
  const py = spawnSync('python3', ['--version']);
  if (py.status !== 0) { console.log('lightroom script: python3 not here — skipped'); return finish(); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lrcat-'));
  const cat = path.join(dir, 'Mom.lrcat');
  const pdir = path.join(dir, 'Mom Previews.lrdata');
  const jpg = async (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#c9a' } }).jpeg().toBuffer();
  // .lrprev: AgHg chunks around three JPEG levels (the scanner needs none of the container)
  const lrprev = async (base) => Buffer.concat([Buffer.from('AgHg\0\0\0\x10header'), Buffer.from('level_1'), await jpg(base / 4, base / 4 * 0.75),
    Buffer.from('AgHg\0\0\0\x10level_2'), await jpg(base / 2, base / 2 * 0.75), Buffer.from('AgHg'), await jpg(base, base * 0.75)]);
  const previews = {};
  const mk = async (uuid, base) => {
    const digest = 'd' + uuid.slice(0, 6);
    const p = path.join(pdir, uuid[0], uuid.slice(0, 4), `${uuid}-${digest}.lrprev`);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, await lrprev(base));
    return digest;
  };
  const rows = [ // id, file, folder, title, uuid, base level
    [1, 'IMG_0001.jpg', 'Jewelry/Necklaces/', 'N 12', 'aaaa1111', 2048],
    [2, 'IMG_0002.jpg', 'Jewelry/Necklaces/', 'N 12', 'bbbb2222', 2048],
    [3, 'IMG_0003.jpg', 'Jewelry/Necklaces/', 'N 12 sold', 'cccc3333', 1440],
    [4, 'IMG_0004.jpg', 'Jewelry/Necklaces/', '', 'dddd4444', 640],
    [5, 'IMG_0005.jpg', 'Family/Xmas/', 'N 99', 'eeee5555', 2048],
    [6, 'IMG_0006.jpg', 'Jewelry/Necklaces/', 'N 7', 'ffff6666', 2048],
  ];
  const sql = [`CREATE TABLE Adobe_images(id_local INTEGER PRIMARY KEY, id_global TEXT, captureTime TEXT, fileFormat TEXT, orientation TEXT, rootFile INTEGER);`,
    `CREATE TABLE AgLibraryFile(id_local INTEGER PRIMARY KEY, baseName TEXT, extension TEXT, folder INTEGER, idx_filename TEXT);`,
    `CREATE TABLE AgLibraryFolder(id_local INTEGER PRIMARY KEY, pathFromRoot TEXT, rootFolder INTEGER);`,
    `CREATE TABLE AgLibraryRootFolder(id_local INTEGER PRIMARY KEY, absolutePath TEXT, name TEXT);`,
    `CREATE TABLE AgLibraryIPTC(id_local INTEGER PRIMARY KEY, image INTEGER, caption TEXT, copyright TEXT);`,
    `CREATE TABLE Adobe_AdditionalMetadata(id_local INTEGER PRIMARY KEY, image INTEGER, xmp TEXT);`,
    `CREATE TABLE AgLibraryCollection(id_local INTEGER PRIMARY KEY, name TEXT);`,
    `CREATE TABLE AgLibraryCollectionImage(id_local INTEGER PRIMARY KEY, collection INTEGER, image INTEGER);`,
    `INSERT INTO AgLibraryRootFolder VALUES(1,'C:/Users/Mom/Pictures/','Pictures');`,
    `INSERT INTO AgLibraryFolder VALUES(10,'Jewelry/Necklaces/',1);`, `INSERT INTO AgLibraryFolder VALUES(11,'Family/Xmas/',1);`,
    `INSERT INTO AgLibraryCollection VALUES(50,'Necklace favorites');`, `INSERT INTO AgLibraryCollectionImage VALUES(1,50,5);`];
  const pdb = [`CREATE TABLE ImageCacheEntry(imageId INTEGER, uuid TEXT, digest TEXT, orientation TEXT);`];
  for (const [id, file, folder, title, uuid, base] of rows) {
    const [b, e] = file.split('.');
    sql.push(`INSERT INTO AgLibraryFile VALUES(${100 + id},'${b}','${e}',${folder.startsWith('Jewelry') ? 10 : 11},'${file}');`);
    sql.push(`INSERT INTO Adobe_images VALUES(${id},'g${id}','2026-01-0${id}T10:00:00','JPG','AB',${100 + id});`);
    if (title) sql.push(`INSERT INTO Adobe_AdditionalMetadata VALUES(${id},${id},'<x:xmpmeta><rdf:Description><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title></rdf:Description></x:xmpmeta>');`);
    if (id !== 4) { const digest = await mk(uuid, base); pdb.push(`INSERT INTO ImageCacheEntry VALUES(${id},'${uuid}','${digest}','AB');`); }
  }
  spawnSync('python3', ['-c', `import sqlite3,sys;d=sqlite3.connect(sys.argv[1]);d.executescript(sys.stdin.read());d.commit()`, cat], { input: sql.join('\n') });
  fs.mkdirSync(pdir, { recursive: true });
  spawnSync('python3', ['-c', `import sqlite3,sys;d=sqlite3.connect(sys.argv[1]);d.executescript(sys.stdin.read());d.commit()`, path.join(pdir, 'previews.db')], { input: pdb.join('\n') });
  // photo 4 has no preview and no original on disk → skipped, counted

  const got = [];
  const haveBy = {};
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const chunks = []; req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      if (u.pathname === '/api/lightroom/have') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ images: [...(haveBy[u.searchParams.get('catalog')] || [])] })); }
      if (u.pathname === '/api/lightroom/photo') {
        const q = Object.fromEntries(u.searchParams.entries());
        let m = {};
        try { m = await sharp(body).metadata(); } catch (e) { m = { width: 'bad:' + e.message }; }
        got.push({ ...q, bytes: body.length, w: m.width, h: m.height, ct: req.headers['content-type'] });
        (haveBy[q.catalog] = haveBy[q.catalog] || new Set()).add(q.image);
        res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}');
      }
      res.writeHead(404); res.end();
    });
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // async, never spawnSync: the stub server lives in THIS process and a
  // blocking wait would leave it unable to answer (measured — every upload
  // timed out)
  const run = (args) => new Promise((resolve) => {
    const c = spawn('python3', [path.join(ROOT, 'public/lightroom-sync.py'), '--catalog', cat, '--server', base, ...args]);
    let stdout = '', stderr = '';
    c.stdout.on('data', d => { stdout += d; }); c.stderr.on('data', d => { stderr += d; });
    const t = setTimeout(() => c.kill(), 60000);
    c.on('close', (status) => { clearTimeout(t); resolve({ status, stdout, stderr }); });
  });
  let r = await run(['--dry']);
  ok(r.status === 0, 'dry run exits 0: ' + (r.stderr || '').slice(0, 200));
  ok(/6 pictures in the catalog, 6 in "necklace"/.test(r.stdout), 'the necklace folder (5) + the necklace collection (1) (' + (r.stdout.match(/\d+ pictures.*/) || [''])[0] + ')');
  ok(/5 of them have a title/.test(r.stdout), 'titles read out of the XMP (5 of 6)');
  ok(/5 of them have a preview/.test(r.stdout), 'previews indexed for 5 of 6');
  ok(got.length === 0, 'a dry run sends nothing');
  r = await run([]);
  ok(r.status === 0, 'sync exits 0: ' + (r.stderr || '').slice(0, 300));
  ok(got.length === 5, `five previews arrive (${got.length})`);
  const by = Object.fromEntries(got.map(g => [g.image, g]));
  ok(by['1'] && by['1'].title === 'N 12' && by['1'].folder === 'Jewelry/Necklaces/' && by['1'].file === 'IMG_0001.jpg', 'title, folder and file ride the query');
  ok(by['1'] && by['1'].w === 1024 && Number(by['1'].w) === 1024, 'the level around 1,000px is the one sent, not the 2048 (got ' + (by['1'] && by['1'].w) + ')');
  ok(by['3'] && by['3'].w === 1440, 'a 1440-only pyramid sends its 1440 (the smallest level at least 1,000)');
  ok(by['5'] && /Necklace favorites/.test(by['5'].collections), 'a collection member from another folder comes along, collections named');
  ok(!by['4'], 'no preview and no original on disk → skipped');
  ok(got.every(g => g.ct === 'image/jpeg' && g.catalog === 'mom'), 'JPEG bodies under the catalog slug');
  ok(/1 without a preview/.test(r.stdout), 'the skip is counted in her words');
  const n = got.length;
  r = await run([]);
  ok(r.status === 0 && got.length === n && /already there/.test(r.stdout), 'a second run sends nothing — /have made it resumable');
  r = await run(['--limit', '1', '--all', '--name', 'Everything']);
  ok(r.status === 0 && /6 in "everything"/.test(r.stdout) && got.length === n + 1 && got[n].catalog === 'everything' && /5 left for the next run/.test(r.stdout), '--all takes every folder, --limit caps and says what is left, --name names the catalog: ' + (r.stdout.match(/Done.*/) || [''])[0]);
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`lightroom script: ${pass} passed, ${failed} failed`);
  await pageTest();
  finish();
})().catch(e => { console.log('  ✗ ' + e.stack); process.exit(1); });

function finish() { process.exit(failed ? 1 : 0); }

async function pageTest() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) {
    try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('lightroom page: playwright not installed — skipped'); return; }
  }
  const exe = () => { try { for (const d of fs.readdirSync('/opt/pw-browsers')) { const p = path.join('/opt/pw-browsers', d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } } catch (e) { /* */ } return undefined; };
  const PUB = path.join(ROOT, 'public');
  const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const pieces = [{ key: 'N3', title: 'N3', photos: [{ url: PX, thumb: PX, file: 'a.jpg' }], sent: null },
    { key: 'N12', title: 'N 12', photos: [{ url: PX, thumb: PX, file: 'b.jpg' }, { url: PX, thumb: PX, file: 'b-2.jpg' }, { url: PX, thumb: PX, file: 'b-3.jpg' }], sent: null }];
  const items = pieces.map(require(path.join(ROOT, 'lightroom.js')).judgeItem);
  let verdictItems = {}; const calls = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const chunks = []; req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      const send = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      calls.push({ m: req.method, p: u.pathname, body: body && /json/.test(req.headers['content-type'] || '') ? JSON.parse(body) : null });
      if (u.pathname === '/lightroom') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'lightroom.html'), 'utf8')); }
      if (/\.(css|js)$/.test(u.pathname) && fs.existsSync(path.join(PUB, u.pathname))) { res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(PUB, u.pathname))); }
      if (u.pathname === '/api/lightroom/catalogs') return send({ catalogs: [{ catalog: 'mom' }] });
      if (u.pathname === '/api/lightroom/pieces') return send({ catalog: 'mom', chat: 'jewelry-upload-website', sheet: 'lr-mom', states: L.STATES, counts: { pieces: 2, photos: 4 }, pieces, items, costEach: 0.3 });
      if (u.pathname === '/api/chatfeed/verdict' && req.method === 'GET') return send({ ok: true, items: verdictItems, texts: {} });
      if (u.pathname === '/api/chatfeed/verdict' && req.method === 'POST') { const b = JSON.parse(body); if (b.item) verdictItems[b.item] = b.ok; return send({ ok: true }); }
      if (u.pathname === '/api/lightroom/send') return send({ ok: true, sent: [{ key: 'N12', item: 'it9', ok: true }], cost: 0.3 });
      res.writeHead(404); res.end('{}');
    });
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: exe() });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => { failed++; console.log('  ✗ page error: ' + e.message); });
  await page.goto(base + '/lightroom');
  await page.waitForSelector('#judge .jg', { timeout: 8000 });
  ok((await page.$$eval('#judge img', els => els.length)) >= 1, 'the first card draws');
  ok((await page.$$eval('#judge .jg-chip', els => els.map(e => e.textContent.trim()).join())) === 'Star,Yes,Maybe,No', 'her four words are the chips');
  ok(!(await page.$eval('#bar', el => el.hidden)), 'the send bar shows');
  ok(await page.$eval('#send', el => el.disabled), 'Send is off with nothing starred');
  await page.click('#judge .jg-chip:nth-child(1)');
  await page.waitForFunction(() => Object.keys(window.__lrv || {}).length >= 0, null, { timeout: 100 }).catch(() => {});
  await page.waitForTimeout(600);
  const vpost = calls.find(c => c.p === '/api/chatfeed/verdict' && c.m === 'POST');
  ok(vpost && vpost.body.sheet === 'lr-mom' && vpost.body.ok === 'star', 'a chip saves her word on the chat verdict doc (' + JSON.stringify(vpost && vpost.body).slice(0, 80) + ')');
  // the quick deck moved on; the second card carries all three photos
  await page.waitForFunction(() => document.querySelectorAll('#judge img').length === 3, null, { timeout: 4000 }).catch(() => {});
  ok((await page.$$eval('#judge img', els => els.length)) === 3, 'the three-photo piece is ONE card with all three on it');
  if (process.env.LR_SHOTS) { fs.mkdirSync(process.env.LR_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.LR_SHOTS, 'picker.png') }); }
  await page.waitForFunction(() => !document.querySelector('#send').disabled, null, { timeout: 6000 });
  ok(/1.*starred/.test(await page.$eval('#counts', el => el.textContent)), 'the count says one starred');
  await page.click('#send');
  await page.waitForFunction(() => /about/.test(document.querySelector('#sendLbl').textContent), null, { timeout: 4000 }).catch(() => {});
  ok(/send 1 \(about \$0\.30\)/.test(await page.$eval('#sendLbl', el => el.textContent)), 'the first tap arms and names the count and the cost: ' + await page.$eval('#sendLbl', el => el.textContent));
  ok(!calls.some(c => c.p === '/api/lightroom/send'), 'nothing sent on the first tap');
  await page.click('#send');
  await page.waitForFunction(() => /sent to listings/.test(document.querySelector('#note').textContent), null, { timeout: 4000 });
  const sp = calls.find(c => c.p === '/api/lightroom/send');
  ok(sp && sp.body.confirm === true && sp.body.pick === 'star' && sp.body.limit === 5, 'the second tap sends with confirm:true');
  ok(await page.$eval('#note a', el => /\/jewelry\?item=it9/.test(el.getAttribute('href'))), 'the note links to the first listing');
  await browser.close(); server.close();
  console.log(`lightroom page: ${pass} passed, ${failed} failed`);
}

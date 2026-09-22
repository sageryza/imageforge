/* test-pattern.js — the Pattern tool (pattern.js + pattern-plan.js + public/pattern.html).

   Pure half: the plan's arithmetic (wrap copies, the three layouts, scatter,
   the free spot, spin), the PATCH whitelist, and a real sharp render whose
   seam is MEASURED — the left column of a tile and the right column of the
   same tile rendered one tile over must be the same pixels, or the export is
   not seamless whatever the preview looked like.

   Page half (headless Chromium, skipped cleanly without playwright): the REAL
   public/pattern.html against a stubbed /api/pattern — the shelf renders,
   a tap ticks a piece onto the tile, a drag MOVES it (the saved x/y change),
   the degrees box turns it, the spacing slider grows the tile, the tri toggle
   changes the layout, Export starts a job and the poll lands the file. Every
   check is a measurement off the page or off what the page POSTed.

   Run: node scripts/test-pattern.js  (PATTERN_SHOTS=dir also photographs it) */
const fs = require('fs');
const path = require('path');
const http = require('http');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'pattern-plan.js'));
const M = require(path.join(ROOT, 'pattern.js'));

let pass = 0, failed = 0;
function ok(c, msg) { if (c) { pass++; } else { failed++; console.log('  ✗ ' + msg); } }

// ── the plan ──
{
  const pieces = { sq: { w: 100, h: 100 }, wide: { w: 200, h: 100 } };
  const one = { tile: { w: 1000, h: 1000 }, items: [{ k: 'a', piece: 'sq', x: 0.5, y: 0.5, size: 200, rot: 0 }] };
  ok(P.tileDraws(one, pieces).length === 1, 'a piece in the middle draws once');
  const edge = { tile: { w: 1000, h: 1000 }, items: [{ k: 'a', piece: 'sq', x: 0.98, y: 0.5, size: 200 }] };
  const ed = P.tileDraws(edge, pieces);
  ok(ed.length === 2 && ed.some(d => d.cx < 0) && ed.filter(d => d.home).length === 1, 'a piece over the right edge draws again at the left, one of them home');
  const corner = { tile: { w: 1000, h: 1000 }, items: [{ k: 'a', piece: 'sq', x: 0.02, y: 0.02, size: 200 }] };
  ok(P.tileDraws(corner, pieces).length === 4, 'a piece on a corner draws four times');
  const wide = P.tileDraws({ tile: { w: 1000, h: 1000 }, items: [{ k: 'a', piece: 'wide', x: 0.5, y: 0.5, size: 300 }] }, pieces)[0];
  ok(wide.w === 300 && wide.h === 150, 'size is the longest side; the box keeps the cut-out’s shape');
  ok(P.draws(one, pieces).W === 1000 && P.draws(one, pieces).H === 1000, 'grid: the output is the tile');
  const half = P.draws({ ...one, layout: { kind: 'half' } }, pieces);
  ok(half.W === 2000 && half.H === 1000, 'half-drop: two tiles wide');
  ok(half.draws.length === 3 && half.draws.some(d => d.cx === 1500 && d.cy === 1000) && half.draws.some(d => d.cx === 1500 && d.cy === 0), 'half-drop: the second column is dropped by half a tile, and wraps');
  const mir = P.draws({ ...one, layout: { kind: 'mirror' } }, pieces);
  ok(mir.W === 2000 && mir.H === 2000 && mir.draws.length === 4, 'mirror: 2x2, four copies');
  ok(mir.draws.filter(d => d.mx).length === 2 && mir.draws.filter(d => d.my).length === 2, 'mirror: two are reflected across, two down');
  const mirEdge = P.draws({ ...edge, layout: { kind: 'mirror' } }, pieces);
  ok(mirEdge.draws.some(d => d.mx && Math.abs(d.cx - 1020) < 1e-6), 'a reflected copy lands mirrored across the tile’s edge');
  ok(P.layoutOf({ layout: { kind: 'nope' } }) === 'grid', 'an unknown layout is the grid');
  const t = P.tileOf({ tile: { w: 50, h: 99999, bg: 'red' } });
  ok(t.w === 200 && t.h === 6000 && t.bg === P.DEFAULT_TILE.bg, 'a tile is clamped and a bad colour falls back');
  const it = P.itemOf({ piece: 'x', rot: -30, size: 5, x: 9 });
  ok(it.rot === 330 && it.size === 20 && it.x === 1.5, 'an item’s numbers are normalised');
  const sc = P.scatter(6);
  ok(sc.length === 6 && sc.every(s => s.x >= 0 && s.x < 1 && s.y > 0 && s.y < 1), 'scatter places n inside the tile');
  ok(sc[0].y === sc[1].y && sc[3].y !== sc[0].y && sc[3].x !== sc[0].x, 'scatter is rows, the second row staggered');
  const fs1 = P.freeSpot([{ x: 0.25, y: 0.5 }]);
  ok(Math.abs(fs1.x - 0.75) < 1e-9, 'the free spot is the far side of one placed item');
  const spun = P.spin([{ rot: 0 }, { rot: 90 }, { rot: 180 }], 20, 42);
  ok(spun.length === 3 && spun.every((r, i) => { const d = ((r - [0, 90, 180][i]) % 360 + 540) % 360 - 180; return Math.abs(d) <= 20; }), 'spin stays within ±spread of each item’s own turn');
  ok(P.spin([{ rot: 0 }], 20, 1)[0] !== P.spin([{ rot: 0 }], 20, 2)[0] || P.spin([{ rot: 0 }], 20, 3)[0] !== P.spin([{ rot: 0 }], 20, 4)[0], 'two seeds are two spins');
  ok(P.spin([{ rot: 45 }], 0, 9)[0] === 45, 'spread 0 turns nothing');
}

// ── the whitelist ──
{
  const { patch, dropped } = M.cleanPatternPatch({ name: '  fruit  salad ', tile: { w: 1200, h: 1200, bg: '#ABCDEF' }, layout: { kind: 'half' },
    items: [{ piece: 'p', x: 0.2, y: 0.3, rot: 400 }, { x: 0.5 }], url: 'nope', createdAt: 'nope' });
  ok(patch.name === 'fruit salad', 'name is trimmed and squeezed');
  ok(patch.tile.w === 1200 && patch.tile.bg === '#abcdef', 'tile goes through the plan’s own clamp');
  ok(patch.layout.kind === 'half', 'layout is kept');
  ok(patch.items.length === 1 && patch.items[0].rot === 40 && patch.items[0].k.length > 0, 'an item without a piece is dropped; a key is minted');
  ok(dropped.join() === 'url,createdAt', 'server-owned fields are named, not written');
  const big = M.cleanPatternPatch({ items: Array.from({ length: 80 }, () => ({ piece: 'p' })) });
  ok(big.patch.items.length === 60, 'items are capped');
  const pc = M.cleanPiecePatch({ name: 'Bear', kind: 'dragon', hidden: 1, cut: 'x' });
  ok(pc.patch.kind === 'other' && pc.patch.hidden === true && pc.dropped.join() === 'cut', 'a piece patch: unknown kind is other, cut is server-owned');
  ok(M.hexRgb('#ff0080').r === 255 && M.hexRgb('#ff0080').g === 0 && M.hexRgb('#ff0080').b === 128, 'hex → rgb');
  ok(/sage-sandy-mirror\.png$/.test(M.DRAW.ref) && fs.existsSync(M.DRAW.ref), 'the draw recipe attaches the fruit chart’s own style reference');
  ok(M.DRAW.style.includes('[content]') && M.DRAW.content('bear').includes('bear'), 'the prompt is style [content] with her word inside');
}

// ── the render, seam measured ──
(async () => {
  // A 60x40 piece: solid rose, so any pixel of it is unmistakable.
  const piece = await sharp({ create: { width: 60, height: 40, channels: 4, background: { r: 200, g: 60, b: 60, alpha: 1 } } }).png().toBuffer();
  const pieces = { r: { id: 'r', cut: 'x', w: 60, h: 40 } };
  const pat = { tile: { w: 200, h: 200, bg: '#ffffff' }, layout: { kind: 'grid' },
    items: [{ k: 'a', piece: 'r', x: 0.97, y: 0.5, size: 60, rot: 20 }, { k: 'b', piece: 'r', x: 0.3, y: 0.02, size: 40, rot: 0, flip: true }] };
  const out = await M.renderPattern(pat, pieces, 200, async () => piece);
  ok(out.W === 200 && out.H === 200, 'the export is the tile at the asked width');
  const { data, info } = await sharp(out.png).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => data.slice((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
  const isRose = (p) => p[0] > 150 && p[1] < 120;
  let roseLeft = 0, roseRight = 0, seamDiff = 0, roseTop = 0, roseBottom = 0;
  for (let y = 0; y < 200; y++) {
    if (isRose(px(0, y))) roseLeft++;
    if (isRose(px(199, y))) roseRight++;
  }
  for (let x = 0; x < 200; x++) { if (isRose(px(x, 0))) roseTop++; if (isRose(px(x, 199))) roseBottom++; }
  ok(roseLeft > 5 && roseRight > 5, 'the edge piece is on BOTH edges — it wrapped (' + roseLeft + ' left, ' + roseRight + ' right)');
  ok(roseTop > 5 && roseBottom > 5, 'the top piece wraps to the bottom too');
  // Seamless means the tile is a torus: every item moved half a tile across
  // must render the SAME picture rolled by half a tile (100px, an integer, so
  // rounding cannot differ). Any byte off is a seam.
  const rolled = { ...pat, items: pat.items.map(it => ({ ...it, x: (it.x + 0.5) % 1 })) };
  const out2 = await M.renderPattern(rolled, pieces, 200, async () => piece);
  const d2 = (await sharp(out2.png).raw().toBuffer({ resolveWithObject: true })).data;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
    const a = (y * 200 + x) * info.channels, b = (y * 200 + ((x + 100) % 200)) * info.channels;
    for (let c = 0; c < 3; c++) if (data[a + c] !== d2[b + c]) seamDiff++;
  }
  ok(seamDiff === 0, 'rolled half a tile, the render is the same picture rolled — no seam (' + seamDiff + ' bytes differ)');
  const half = await M.renderPattern({ ...pat, layout: { kind: 'half' } }, pieces, 100, async () => piece);
  ok(half.W === 200 && half.H === 100, 'a half-drop export is twice as wide');
  const mir = await M.renderPattern({ ...pat, layout: { kind: 'mirror' } }, pieces, 100, async () => piece);
  ok(mir.W === 200 && mir.H === 200, 'a mirror export is 2x2');
  const md = (await sharp(mir.png).raw().toBuffer({ resolveWithObject: true }));
  const mp = (x, y) => md.data.slice((y * 200 + x) * md.info.channels, (y * 200 + x) * md.info.channels + 3);
  let mirrorDiff = 0;
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) { const a = mp(x, y), b = mp(199 - x, y); if (Math.abs(a[0] - b[0]) > 8) mirrorDiff++; }
  // A rotated raster's edge pixels round differently once mirrored — the
  // differences are anti-aliasing along the 20° edge, never a whole piece.
  ok(mirrorDiff < 200, 'the right half of a mirror export is the left half reflected (' + mirrorDiff + ' px differ)');

  console.log(`pattern (pure): ${pass} passed, ${failed} failed`);
  await pageHalf();
})().catch((e) => { console.error(e); process.exit(1); });

// ── the page ──
async function pageHalf() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) {
    try { ({ chromium } = require('playwright-core')); } catch (__) {
      console.log('pattern page: playwright not installed — skipped');
      process.exit(failed ? 1 : 0);
    }
  }
  function exe() {
    const root = '/opt/pw-browsers';
    try {
      for (const d of fs.readdirSync(root)) {
        const p = path.join(root, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(p)) return p;
      }
    } catch (e) { /* playwright's own lookup */ }
    return undefined;
  }
  const PUB = path.join(ROOT, 'public');
  const PNG = await sharp({ create: { width: 80, height: 60, channels: 4, background: { r: 60, g: 120, b: 60, alpha: 1 } } }).png().toBuffer();
  const shelf = [
    { id: 'bear', name: 'bear', kind: 'animal', status: 'ready', cut: '/px/bear.png', thumb: '/px/bear.png', w: 80, h: 60 },
    { id: 'pear', name: 'pear', kind: 'fruit', status: 'ready', cut: '/px/pear.png', thumb: '/px/pear.png', w: 80, h: 60 },
    { id: 'kale', name: 'kale', kind: 'vegetable', status: 'cutting', cut: null, thumb: null, w: null, h: null },
  ];
  const pat = { id: 'p1', name: '', tile: { w: 1000, h: 1000, bg: '#faf6ee' }, layout: { kind: 'grid' }, items: [], exports: [], job: null, updatedAt: 'now' };
  const calls = [];
  let polls = 0;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      const body = raw && /json/.test(req.headers['content-type'] || '') ? JSON.parse(raw) : null;
      calls.push({ m: req.method, p: u.pathname, body });
      if (u.pathname === '/pattern') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'pattern.html'), 'utf8').replace('__STUDIO_TOKEN__', '')); }
      if (u.pathname === '/pattern-plan.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'pattern-plan.js'))); }
      if (u.pathname.startsWith('/px/')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
      if (/\.(css|js)$/.test(u.pathname)) {
        const f = path.join(PUB, u.pathname);
        if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(f)); }
        res.writeHead(404); return res.end();
      }
      if (u.pathname === '/api/pattern/pieces' && req.method === 'GET') return send(200, { pieces: shelf });
      if (u.pathname === '/api/pattern/patterns' && req.method === 'GET') return send(200, { patterns: [{ id: 'p1', name: '', count: 0, layout: { kind: 'grid' } }] });
      if (u.pathname === '/api/pattern/patterns/p1' && req.method === 'GET') {
        if (pat.job && pat.job.status === 'running' && ++polls >= 1) { pat.job = { ...pat.job, status: 'done' }; pat.exports = [{ size: '2K', url: 'https://x/out.png', thumb: '/px/out.png', W: 2048, H: 2048, layout: pat.layout.kind }]; }
        return send(200, { pattern: pat });
      }
      if (u.pathname === '/api/pattern/patterns/p1' && req.method === 'PATCH') { const { patch } = M.cleanPatternPatch(body); Object.assign(pat, patch); return send(200, { pattern: pat, dropped: [] }); }
      if (u.pathname === '/api/pattern/patterns/p1/export') { pat.job = { kind: 'export', size: body.size, status: 'running', startedAt: new Date().toISOString() }; return send(200, { pattern: pat }); }
      send(404, { error: 'no such route' });
    });
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: exe() });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => { failed++; console.log('  ✗ page error: ' + e.message); });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } }).catch(() => {});
  await page.goto(base + '/pattern');
  await page.waitForTimeout(400);
  const shots = process.env.PATTERN_SHOTS;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };

  // the four rules
  ok(await page.$eval('.tool .eyebrow', el => el.textContent.trim()) === 'PATTERN', 'the title, once');
  ok(await page.$eval('#helpcard', el => el.hidden), 'the explanation is behind the ?');
  ok((await page.$$eval('input[type=text]', els => els.map(el => el.value + (el.getAttribute('placeholder') || '')).join(''))) === '', 'every text box ships empty, no placeholder');
  const btn = await page.$eval('#draw', el => el.getBoundingClientRect().width);
  ok(btn < 120, 'the Draw button hugs its word (' + Math.round(btn) + 'px)');
  const line = await page.$eval('#tabs', el => getComputedStyle(el, '::after').width);
  ok(parseFloat(line) > 60, 'the hairline tab row measured its line (' + line + ')');

  // the shelf
  ok((await page.$$eval('.pc', els => els.length)) === 3, 'three pieces on the shelf');
  ok((await page.$$eval('.kindh', els => els.map(e => e.textContent).join())) === 'animals,fruits,vegetables', 'grouped by kind');
  ok(await page.$eval('.pc[data-id=kale]', el => el.classList.contains('wait')), 'a piece still cutting is dimmed');
  await shot('1-pieces');
  await page.click('.pc[data-id=bear]');
  await page.waitForTimeout(700);
  ok(await page.$eval('.pc[data-id=bear]', el => el.classList.contains('on')), 'tapping a piece ticks it');
  let saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved && saved.body.items.length === 1 && saved.body.items[0].piece === 'bear', 'the tick saved one item on the pattern');
  await page.click('.pc[data-id=pear]');
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.items.length === 2 && Math.abs(saved.body.items[0].x - saved.body.items[1].x) >= 0.2, 'the second piece lands away from the first');
  await page.click('.pc[data-id=kale]');
  await page.waitForTimeout(100);
  ok(/cutting/.test(await page.$eval('#shelfmsg', el => el.textContent)), 'a piece still cutting says so instead of ticking');

  // the tile
  await page.click('.acctab[data-t="1"]');
  await page.waitForTimeout(300);
  ok(!(await page.$eval('#pane-tile', el => el.hidden)) && (await page.$eval('#pane-pieces', el => el.hidden)), 'the TILE tab shows the tile and hides the shelf');
  const cvr = await page.$eval('#tile', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  ok(Math.abs(cvr.w - cvr.h) < 2, 'the tile is square on screen');
  ok((await page.$eval('#band', el => el.style.backgroundImage)).startsWith('url("data:image/png'), 'the repeat band is painted from the tile');
  await shot('2-tile');
  // the pear is item 2; find it on screen from the saved x/y and drag it
  const pear = saved.body.items[1];
  const sx = cvr.x + pear.x * cvr.w, sy = cvr.y + pear.y * cvr.h;
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.mouse.move(sx + 40, sy + 30, { steps: 6 }); await page.mouse.move(sx + 80, sy + 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  const moved = saved.body.items[1];
  ok(Math.abs(moved.x - (pear.x + 80 / cvr.w)) < 0.02 && Math.abs(moved.y - (pear.y + 60 / cvr.h)) < 0.02, 'dragging moved the pear by exactly the drag (' + moved.x.toFixed(3) + ',' + moved.y.toFixed(3) + ')');
  ok(!(await page.$eval('#selbox', el => el.hidden)) && (await page.$eval('#selname', el => el.textContent)) === 'pear', 'the touched piece is selected and named');
  await page.click('#rotp');
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.items[1].rot === 15 && (await page.$eval('#rot', el => el.value)) === '15', '+15 turns the piece and the box says 15');
  await page.fill('#rot', '200');
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.items[1].rot === 200, 'a typed number is the turn');
  await page.$eval('#space', el => { el.value = '1600'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.tile.w === 1600 && saved.body.tile.h === 1600, 'spacing grows the tile');
  ok(saved.body.items[1].x === moved.x, 'growing the tile leaves the fractions — the pieces spread');
  await page.click('#again');
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.items.length === 3 && saved.body.items[2].piece === 'pear' && saved.body.items[2].rot === 200, '"again" adds another pear with the same turn');
  await page.click('#spin');
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.items.every((it, i) => { const was = [0, 200, 200][i]; const d = ((it.rot - was) % 360 + 540) % 360 - 180; return Math.abs(d) <= 20; }), 'spin keeps every piece within ±20 of where it was');
  await shot('3-tile-moved');

  // the repeat
  await page.click('.acctab[data-t="2"]');
  await page.waitForTimeout(300);
  ok((await page.$eval('#big', el => el.style.backgroundImage)).startsWith('url("data:image/png'), 'the big repeat is painted');
  const tri = await page.$eval('#layout', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(tri.x + tri.w * 0.5, tri.y + tri.h / 2);
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.layout.kind === 'half' && (await page.$eval('#layoutword', el => el.textContent)) === 'half-drop', 'a tap on the middle stop is half-drop');
  await page.mouse.click(tri.x + tri.w * 0.85, tri.y + tri.h / 2);
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.layout.kind === 'mirror', 'a tap on the right stop is mirror');
  await page.click('.sw[data-c="#2a2620"]');
  await page.waitForTimeout(700);
  saved = calls.filter(c => c.m === 'PATCH').pop();
  ok(saved.body.tile.bg === '#2a2620', 'a swatch sets the colour behind');
  await page.click('#export');
  await page.waitForTimeout(200);
  const ex = calls.find(c => c.p === '/api/pattern/patterns/p1/export');
  ok(ex && ex.body.size === '2K', 'Export asks for the lit size');
  ok(await page.$eval('#export', el => el.disabled), 'Export is off while the job runs');
  await page.waitForTimeout(2600);
  ok((await page.$$eval('#exports a', els => els.length)) === 1 && (await page.$eval('#exports a', el => el.href)) === 'https://x/out.png', 'the poll lands the export as a link');
  ok(!(await page.$eval('#export', el => el.disabled)), 'Export is back on');
  await shot('4-repeat');

  // reopen: the tab and the pattern are remembered
  await page.reload(); await page.waitForTimeout(500);
  ok(!(await page.$eval('#pane-repeat', el => el.hidden)), 'reopening lands on the tab she was on');
  ok((await page.$eval('#layoutword', el => el.textContent)) === 'mirror', '…on the same pattern');

  await browser.close();
  server.close();
  console.log(`pattern (page): ${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

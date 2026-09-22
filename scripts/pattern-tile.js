#!/usr/bin/env node
// pattern-tile.js — a repeating pattern made from the cards she already has
// (2026-09-22, Sophie: "i want to make repeating patterns with my animals and
// fruits" · "a script is fine but i also want to be able to arrange them
// myself · try it ur way first").
//
// No model call anywhere. Each card (fruit, vegetable, animal, plant — the
// square pictures on white the decks are made of) is downloaded once, its
// white background is made transparent, and the cut-outs are placed on a
// square tile that repeats without a seam: a picture that runs off the right
// edge comes back in on the left, and the same top to bottom. The PLACEMENTS
// are written to a JSON file (scripts/patterns/<name>.json) — that file is the
// pattern, this script only draws it — so a page where she drags the pictures
// around herself can write the same file and be drawn by the same code.
//
//   node scripts/pattern-tile.js --name "fruit salad" --pick strawberry,lemon,cherries
//        [--layout tossed|halfdrop|grid] [--cols 4] [--bg "#f6efe3"] [--tile 2048]
//        [--fill 0.78] [--seed 1] [--post] [--chat animal-fruit-patterns] [--dry]
//   node scripts/pattern-tile.js --batch scripts/patterns/batch-v1.json [--post]
//   node scripts/pattern-tile.js --file scripts/patterns/fruit-salad.json [--post]
//
// --dry says what it would draw and draws nothing. Without --post the tile and
// the repeat preview are written under the scratch dir only. With --post they
// go to the Dump (so there is a save link), the previews are filed into the
// chat's Assets tab, and ONE Compare page shows every pattern in the run:
// the 3x3 repeat on the left, the single tile on the right, notes on each.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
const has = (n) => args.includes('--' + n);
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const CHAT = flag('chat', 'animal-fruit-patterns');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const DRY = has('dry');
const POST = has('post');
const VERSION = flag('v', '1');
const SUPERSEDE = (flag('supersede', '') || '').split(',').filter(Boolean);
const SCRATCH = process.env.CLAUDE_SCRATCH || path.join(process.env.TMPDIR || '/tmp', 'pattern-tile');
const CACHE = path.join(SCRATCH, 'cards');
const CUT = path.join(SCRATCH, 'cut');
const OUT = flag('out', path.join(SCRATCH, 'out'));
const SPECDIR = path.join(__dirname, 'patterns');
for (const d of [CACHE, CUT, OUT, SPECDIR]) fs.mkdirSync(d, { recursive: true });

// ---- the cards ------------------------------------------------------------
// Later files win on a shared id (a v2 redraw replaces the first take), the
// same rule fruit-compare-page.js uses.
const SETS = [
  ['fruit', ['fruit-chart/uploaded.json', 'fruit-chart/v2-uploaded.json', 'fruit-chart/v3-uploaded.json']],
  ['veg', ['fruit-chart/veg-uploaded.json']],
  ['animal', ['decks/animals-drawn.json']],
  ['plant', ['decks/plants-drawn.json']],
];
function catalog() {
  const byKey = new Map();
  for (const [set, files] of SETS) {
    const byId = new Map();
    for (const f of files) {
      const p = path.join(__dirname, f);
      if (!fs.existsSync(p)) continue;
      for (const r of JSON.parse(fs.readFileSync(p, 'utf8'))) if (r.id && (r.full || r.url)) byId.set(r.id, r);
    }
    for (const r of byId.values()) {
      const rec = { set, id: `${set}:${r.id}`, name: r.name || r.id, url: r.full || r.url };
      const bare = String(r.id).replace(/^\d+-/, '').replace(/-v\d+$/, '');
      for (const k of [rec.id, `${set}:${bare}`, bare, String(r.name || '').toLowerCase().trim(), String(r.name || '').toLowerCase().replace(/\s+/g, '-')]) {
        if (k && !byKey.has(k)) byKey.set(k, rec);
      }
    }
  }
  return byKey;
}
const CARDS = catalog();
function find(q) {
  const k = String(q).trim().toLowerCase();
  const rec = CARDS.get(k) || CARDS.get(k.replace(/\s+/g, '-')) || CARDS.get(k.replace(/-/g, ' '));
  if (!rec) throw new Error(`no card called "${q}" — try \`--list\``);
  return rec;
}
if (has('list')) {
  const seen = new Set();
  for (const r of CARDS.values()) if (!seen.has(r.id)) { seen.add(r.id); console.log(r.id.padEnd(28), r.name); }
  process.exit(0);
}

// ---- the cut-out ----------------------------------------------------------
// The white around the drawing goes transparent: every near-white pixel that
// touches the border (or touches one that does) is background; a white
// highlight INSIDE a drawing is not, because the flood never reaches it. The
// rim gets a soft edge from how light each pixel is, so the cut does not read
// as a sticker with a hard outline.
const WHITE = 236;
async function cutout(rec) {
  const safe = rec.id.replace(/[^a-z0-9]+/gi, '-');
  const cutPath = path.join(CUT, `${safe}.png`);
  if (fs.existsSync(cutPath)) return cutPath;
  const src = path.join(CACHE, `${safe}${path.extname(new URL(rec.url).pathname) || '.webp'}`);
  if (!fs.existsSync(src)) {
    const r = await fetch(rec.url);
    if (!r.ok) throw new Error(`${rec.id}: ${r.status} fetching ${rec.url}`);
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
  }
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const light = new Uint8Array(N); // 1 = near white
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const m = Math.min(data[o], data[o + 1], data[o + 2]);
    if (m >= WHITE) light[i] = 1;
  }
  const bg = new Uint8Array(N);
  const stack = [];
  const push = (i) => { if (light[i] && !bg[i]) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i - x) / W;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }
  // Soft rim: a foreground pixel next to background fades by its lightness.
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (bg[i]) { data[o + 3] = 0; continue; }
    const x = i % W, y = (i - x) / W;
    const edge = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W]);
    if (edge) {
      const m = Math.min(data[o], data[o + 1], data[o + 2]);
      data[o + 3] = Math.max(0, Math.min(255, Math.round((255 - m) * 255 / (255 - 180))));
    }
    if (data[o + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) throw new Error(`${rec.id}: nothing but white`);
  const pad = 2;
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  const width = Math.min(W, maxX + pad + 1) - left, height = Math.min(H, maxY + pad + 1) - top;
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width, height }).png().toFile(cutPath);
  return cutPath;
}

// ---- the layout -----------------------------------------------------------
// Positions are FRACTIONS of the tile (0..1), rotation in degrees, scale a
// multiple of the cell's motif size — so the file reads the same at any tile
// size and a hand-arranged page can write the same numbers.
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function layout(spec) {
  const kind = spec.layout || 'tossed';
  const ids = spec.pick;
  let cols = Math.max(1, Math.round(spec.cols || 4));
  if (kind !== 'grid' && cols % 2) cols += 1; // a half-drop only repeats cleanly on an even column count
  const rows = cols;
  const rnd = mulberry32(Number(spec.seed || 1));
  const out = [];
  // Which picture goes in which cell: cycle through them in order for a grid
  // or a half-drop (the repeat IS the point there), and for a tossed pattern
  // pick by seed, never the same picture as the one to the left or above
  // (the neighbours across the tile's edge count too, since it repeats).
  const order = [];
  const at = (r, c) => order[((r + rows) % rows) * cols + ((c + cols) % cols)];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const n = r * cols + c;
    if (kind !== 'tossed' || ids.length < 3) { order.push(ids[(n + (cols % ids.length === 0 ? r : 0)) % ids.length]); continue; }
    const avoid = new Set([at(r, c - 1), at(r - 1, c), c === cols - 1 ? at(r, 0) : null, r === rows - 1 ? at(0, c) : null].filter(Boolean));
    const pool = ids.filter((id) => !avoid.has(id));
    // Keep the counts even: prefer whichever allowed picture has been used least.
    const used = new Map(ids.map((id) => [id, 0]));
    for (const id of order) used.set(id, used.get(id) + 1);
    const least = Math.min(...pool.map((id) => used.get(id)));
    const best = pool.filter((id) => used.get(id) === least);
    order.push(best[Math.floor(rnd() * best.length)]);
  }
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const drop = kind === 'grid' ? 0 : (c % 2 ? 0.5 : 0);
      let x = (c + 0.5) / cols, y = (r + 0.5 + drop) / rows, rot = 0, scale = 1;
      if (kind === 'tossed') {
        x += (rnd() - 0.5) * 0.5 / cols;
        y += (rnd() - 0.5) * 0.5 / rows;
        rot = (rnd() - 0.5) * 2 * (spec.tilt == null ? 40 : Number(spec.tilt));
        scale = 0.82 + rnd() * 0.24;
      } else if (spec.tilt) {
        rot = (rnd() - 0.5) * 2 * Number(spec.tilt);
      }
      out.push({ id: order[i++], x: ((x % 1) + 1) % 1, y: ((y % 1) + 1) % 1, rot: Math.round(rot * 10) / 10, scale: Math.round(scale * 100) / 100 });
    }
  }
  return { cols, rows, placements: out };
}

// ---- the drawing ----------------------------------------------------------
function hexToRgb(h) {
  const m = String(h || '#ffffff').replace('#', '');
  const s = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
async function render(spec, motifs) {
  const T = Number(spec.tile || 2048);
  const cell = T / spec.cols;
  const fill = Number(spec.fill == null ? 0.78 : spec.fill);
  const [br, bgG, bb] = hexToRgb(spec.bg);
  const tile = Buffer.alloc(T * T * 4);
  for (let i = 0; i < T * T; i++) { const o = i * 4; tile[o] = br; tile[o + 1] = bgG; tile[o + 2] = bb; tile[o + 3] = 255; }
  for (const p of spec.placements) {
    const cut = motifs[p.id];
    const size = Math.max(4, Math.round(cell * fill * (p.scale || 1)));
    const { data, info } = await sharp(cut).resize({ width: size, height: size, fit: 'inside' })
      .rotate(p.rot || 0, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    const x0 = Math.round(p.x * T - w / 2), y0 = Math.round(p.y * T - h / 2);
    for (let y = 0; y < h; y++) {
      const ty = (((y0 + y) % T) + T) % T;
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 4;
        const a = data[s + 3];
        if (!a) continue;
        const tx = (((x0 + x) % T) + T) % T;
        const d = (ty * T + tx) * 4;
        const f = a / 255;
        tile[d] = Math.round(data[s] * f + tile[d] * (1 - f));
        tile[d + 1] = Math.round(data[s + 1] * f + tile[d + 1] * (1 - f));
        tile[d + 2] = Math.round(data[s + 2] * f + tile[d + 2] * (1 - f));
      }
    }
  }
  return sharp(tile, { raw: { width: T, height: T, channels: 4 } }).png();
}

async function preview(tilePng, reps, px) {
  const each = Math.round(px / reps);
  const small = await sharp(tilePng).resize(each, each).png().toBuffer();
  const comps = [];
  for (let r = 0; r < reps; r++) for (let c = 0; c < reps; c++) comps.push({ input: small, left: c * each, top: r * each });
  return sharp({ create: { width: each * reps, height: each * reps, channels: 4, background: '#fff' } }).composite(comps).webp({ quality: 88 }).toBuffer();
}

// ---- the run --------------------------------------------------------------
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function upload(buf, filename, ct) {
  const q = new URLSearchParams({ session: 'pattern-tile', bundle: `patterns v${VERSION}`, filename });
  const r = await fetch(`${BASE}/api/drop/upload-file?${q}`, { method: 'POST', headers: { 'Content-Type': ct }, body: buf });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${filename}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.item;
}
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function specsFromArgs() {
  if (flag('batch')) return JSON.parse(fs.readFileSync(flag('batch'), 'utf8'));
  if (flag('file')) return [JSON.parse(fs.readFileSync(flag('file'), 'utf8'))];
  if (!flag('pick')) { console.error('usage: --name "…" --pick a,b,c [--layout tossed|halfdrop|grid] … | --batch file | --file file | --list'); process.exit(2); }
  return [{
    name: flag('name', 'pattern'), pick: flag('pick').split(',').map((s) => s.trim()).filter(Boolean),
    layout: flag('layout', 'tossed'), cols: Number(flag('cols', 4)), bg: flag('bg', '#f6efe3'),
    tile: Number(flag('tile', 2048)), fill: flag('fill') ? Number(flag('fill')) : undefined,
    seed: Number(flag('seed', 1)), tilt: flag('tilt') ? Number(flag('tilt')) : undefined,
  }];
}

(async () => {
  const specs = specsFromArgs();
  const results = [];
  for (const raw of specs) {
    const spec = { ...raw };
    spec.pick = spec.pick.map((q) => find(q).id);
    // A file that already carries placements is drawn as written — that is
    // the door a hand-arranged page comes in through.
    if (!spec.placements) Object.assign(spec, layout(spec));
    spec.tile = Number(spec.tile || 2048);
    const file = path.join(SPECDIR, `${slug(spec.name)}.json`);
    console.log(`${spec.name}: ${spec.layout || 'as placed'} · ${spec.placements.length} pictures from ${spec.pick.length} cards · ${spec.cols} across · ${spec.bg || '#ffffff'} · ${spec.tile}px`);
    if (DRY) { for (const id of spec.pick) console.log('   ', id, '←', find(id).url); continue; }
    const motifs = {};
    for (const id of spec.pick) motifs[id] = await cutout(find(id));
    const tilePng = await (await render(spec, motifs)).toBuffer();
    const rep = await preview(tilePng, 3, 1536);
    const one = await sharp(tilePng).resize(1024, 1024).webp({ quality: 90 }).toBuffer();
    const base = slug(spec.name);
    fs.writeFileSync(path.join(OUT, `${base}.png`), tilePng);
    fs.writeFileSync(path.join(OUT, `${base}-3x3.webp`), rep);
    fs.writeFileSync(path.join(OUT, `${base}-tile.webp`), one);
    fs.writeFileSync(file, JSON.stringify(spec, null, 1));
    console.log(`    → ${path.join(OUT, base)}.png · spec ${path.relative(process.cwd(), file)}`);
    results.push({ spec, base, tilePng, rep, one });
  }
  if (DRY || !POST || !results.length) return;

  const items = [];
  for (const r of results) {
    const tile = await upload(r.tilePng, `${r.base}-tile-${r.spec.tile}.png`, 'image/png');
    const rep = await upload(r.rep, `${r.base}-repeat.webp`, 'image/webp');
    const one = await upload(r.one, `${r.base}-one-tile.webp`, 'image/webp');
    const what = `${r.spec.layout || 'hand placed'} · ${r.spec.pick.map((id) => find(id).name).join(', ')}`;
    for (const [it, label] of [[rep, `${r.spec.name} — the repeat (3x3)`], [one, `${r.spec.name} — one tile`]]) {
      await post(`${BASE}/api/gallery`, { assetsOnly: true, chat: CHAT, session: SESSION, url: it.url, description: `${label} · ${what}`, prompt: `pattern-tile.js · ${r.spec.layout || 'placed'} · ${r.spec.tile}px` });
    }
    items.push({ name: r.spec.name, what, rep: rep.url, one: one.url, save: `/api/drop/file/${tile.id}`, px: r.spec.tile, key: r.base });
    console.log(`  ${r.spec.name}: repeat ${rep.url}`);
  }
  const title = `Patterns v${VERSION} — ${items.length} to look at`;
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>figcaption{font-size:12px;color:var(--ink2);text-align:center;margin-top:4px}.imgrow figure{margin:0}h2{margin:18px 0 6px}.what{font-size:13px;color:var(--ink2);margin:0 0 8px}.save{font-size:13px;margin:6px 0 0}</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
${items.map((it) => `  <div class="card" data-item="${esc(it.key)}">
    <h2>${esc(it.name)}</h2>
    <p class="what">${esc(it.what)}</p>
    <div class="imgrow">
      <figure><img src="${esc(it.rep)}" alt="${esc(it.name)} repeated" width="1536" height="1536" loading="lazy"><figcaption>repeated 3x3</figcaption></figure>
      <figure><img src="${esc(it.one)}" alt="${esc(it.name)} one tile" width="1024" height="1024" loading="lazy"><figcaption>one tile</figcaption></figure>
    </div>
    <p class="save"><a href="${esc(it.save)}">save the tile (png, ${it.px}px, repeats without a seam)</a></p>
  </div>`).join('\n')}
</div>
<script src="/compare.js"></script>
<script>(function(){
  if (window.__compareNotes) window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: 'patterns-v${VERSION}' });
  if (window.__compareHelp) window.__compareHelp({ html: '<b>Each pattern twice:</b> the left picture is the tile repeated three by three, so you see how it reads as fabric or paper; the right picture is the one tile it is built from. The save link under it is the full-size tile. Tap + on a pattern to say what to change.' });
})();</script>
`;
  const posted = await post(`${BASE}/api/chatfeed/page`, { chat: CHAT, session: SESSION, title, html });
  console.log('page', JSON.stringify(posted));
  for (const id of SUPERSEDE) console.log('superseded', id, (await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, { method: 'POST' })).status);
  fs.writeFileSync(path.join(SPECDIR, `posted-v${VERSION}.json`), JSON.stringify({ page: posted.id, items }, null, 1));
  console.log(`\npage: ${BASE}/api/chatfeed/page/${posted.id}`);
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * Tutorial-card illustrations for Gravity Lock, drawn as GRIDS.
 *
 * Sophie's instruction: ask for a grid of a few pictures in ONE image and
 * describe each cell, rather than one call per picture. Two reasons it is the
 * right call here — the cells come out as a SET (one palette, one line weight,
 * drawn together), and eight pictures cost two calls instead of eight.
 *
 * Same Pastel recipe as scripts/gravity-lock-art.js, verbatim from server.js.
 * Each finished sheet is sliced on its own midlines, then every cell is cut off
 * its white ground, trimmed and re-padded square.
 *
 *   node scripts/gravity-lock-cards.js [--sheet a|b] [--quality medium] [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OUT = path.join(__dirname, '..', '.artout', 'gravity-lock-cards');

const PASTEL = {
  refs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
  prefix: 'Use the attached images ONLY as a STYLE reference for the linework: ' +
    'bold confident black ink outlines, flat colors with NO gradients and minimal ' +
    'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, ' +
    'on a plain white background, playful modern editorial illustration.',
  suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
};

// The grid instruction is deliberately emphatic about gutters and about nothing
// crossing between cells — a sheet whose drawings touch cannot be sliced.
const GRID = 'A 2x2 grid of four completely separate small illustrations on a plain white ' +
  'background. Wide clean white gutters between them, each drawing sitting well inside ' +
  'its own quarter, nothing crossing or touching between the cells, no grid lines, no ' +
  'borders, no frames.';

const SHEETS = {
  a: {
    cells: ['weight', 'inverse', 'repel', 'hole'],
    text:
      'TOP LEFT: a hammer and a feather falling side by side at exactly the same height above a small cratered moon. ' +
      'TOP RIGHT: one planet on the left, and three little astronauts in a row going away from it, the nearest with a big thick arrow pulling him toward the planet, the middle one with a much smaller arrow, the farthest with a tiny arrow. ' +
      'BOTTOM LEFT: two round planets pushing apart from each other, with short arrows between them pointing outward in opposite directions. ' +
      'BOTTOM RIGHT: a solid black circle with a bright ring around it, one dashed circle drawn further out around the whole thing, and a little astronaut inside the dashed circle spiralling inward toward the black circle.',
  },
  b: {
    cells: ['kepler', 'portal', 'wind', 'mirror'],
    text:
      'TOP LEFT: a planet with a curved dotted path swinging past it, the dots far apart where the path is close to the planet and bunched close together where the path is far away. ' +
      'TOP RIGHT: two separate round rings standing apart, with a little astronaut going into the first ring and coming out of the second one. ' +
      'BOTTOM LEFT: a tall vertical band of small arrows all pointing the same way, with a little astronaut inside the band being carried along by them. ' +
      'BOTTOM RIGHT: a flat angled mirror panel with a little astronaut arriving at it along one line and leaving along another line at the mirrored angle, like a ball bouncing.',
  },
  c: {
    cells: ['capture', 'escape', 'slingshot', 'coorbit'],
    text:
      'TOP LEFT: a big bright sun on the right side, a little astronaut on the left aiming at it, and in between a planet with the astronaut caught going round and round it in a circle instead of reaching the sun. ' +
      'TOP RIGHT: one planet with two little astronauts leaving it, the slower one on a curve that bends back down to the planet, the faster one on a curve that flies away off the edge and never comes back. ' +
      'BOTTOM LEFT: a planet moving along with a motion arrow behind it, and a little astronaut swinging around behind the planet and shooting away much faster, with speed lines showing he sped up. ' +
      'BOTTOM RIGHT: a sun in the middle with one big circular orbit ring drawn around it, a planet sitting on that ring, and a little astronaut sitting on the SAME ring a little way ahead of the planet, both going the same way round.',
  },
};

// A one-off card gets ONE call, not a sheet of four — the grid earns its keep
// when several pictures are wanted together, and wastes three when they are not.
const SINGLES = {
  tour:
    'A single illustration: a bright sun on the far left, and one long curving dotted flight path ' +
    'sweeping out to the right past nine planets, each planet a little further from the sun than ' +
    'the last and sitting right on the path, the nearest ones small and the outer ones larger with ' +
    'one ringed planet among them, and a tiny astronaut travelling along the path near the middle.',
};

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const QUALITY = flag('quality', 'medium');
const WANT = (flag('sheet', 'a,b') || '').split(',').filter(Boolean);
const SINGLE = (flag('single', '') || '').split(',').filter(Boolean);
const DRY = argv.includes('--dry-run');

let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(cred), storageBucket: `${cred.project_id}.firebasestorage.app` });
  bucket = admin.storage().bucket();
}
const refCache = new Map();
async function loadRef(p) {
  if (!refCache.has(p)) refCache.set(p, (await bucket.file(p).download())[0]);
  return refCache.get(p);
}

async function editWithRefs(prompt, refBufs, quality) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('quality', quality);
  refBufs.forEach((b, i) => form.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i}.png`));
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: form,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `openai ${r.status}`);
  return Buffer.from(j.data[0].b64_json, 'base64');
}

// same corner flood fill as the art script — alpha 0, edge-connected only
async function cutBackground(buf, tol = 46) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const idx = (x, y) => (y * W + x) * C;
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const tol2 = tol * tol;
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= tol2; };
  const visited = new Uint8Array(W * H), stack = [];
  const pushIf = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (visited[p] || !close(idx(x, y))) return; visited[p] = 1; stack.push(p); };
  for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
  for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p - x) / W; pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < W * H; p++) if (visited[p]) out[p * C + 3] = 0;
  return sharp(out, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}

async function trimSquare(png) {
  const t = await sharp(png).trim({ threshold: 1 }).toBuffer();
  const m = await sharp(t).metadata();
  const side = Math.round(Math.max(m.width, m.height) * 1.1);
  return sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: t, gravity: 'center' }]).png().toBuffer();
}

(async () => {
  const est = (WANT.length * (QUALITY === 'high' ? 0.25 : QUALITY === 'low' ? 0.02 : 0.06)).toFixed(2);
  console.log(`${WANT.length} sheet(s) of 4 = ${WANT.length * 4} pictures at quality ${QUALITY} — estimated $${est}`);
  if (DRY) return;
  initFirebase();
  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const refs = await Promise.all(PASTEL.refs.map(loadRef));

  for (const key of WANT) {
    const sh = SHEETS[key];
    const prompt = `${PASTEL.prefix} ${GRID} ${sh.text} ${PASTEL.suffix}`;
    process.stdout.write(`sheet ${key} … `);
    const sheet = await editWithRefs(prompt, refs, QUALITY);
    fs.writeFileSync(path.join(OUT, `sheet-${key}.png`), sheet);
    const meta = await sharp(sheet).metadata();
    const hw = Math.floor(meta.width / 2), hh = Math.floor(meta.height / 2);
    const boxes = [[0, 0], [hw, 0], [0, hh], [hw, hh]];
    for (let i = 0; i < 4; i++) {
      const [left, top] = boxes[i];
      const cell = await sharp(sheet).extract({ left, top, width: hw, height: hh }).png().toBuffer();
      const cut = await trimSquare(await cutBackground(cell));
      const id = sh.cells[i];
      fs.writeFileSync(path.join(OUT, `${id}.png`), cut);
      const p = `gravity-lock/cards/${id}.png`;
      await bucket.file(p).save(cut, { contentType: 'image/png', metadata: { cacheControl: 'public,max-age=31536000,immutable' } });
      await bucket.file(p).makePublic();
      manifest.push({ id, sheet: key, cell: i, prompt, quality: QUALITY,
        url: `https://storage.googleapis.com/${bucket.name}/${p}`, madeAt: Date.now() });
    }
    // the whole sheet too, so the un-sliced original is never only on scratch disk
    const sp = `gravity-lock/cards/sheet-${key}-raw.png`;
    await bucket.file(sp).save(sheet, { contentType: 'image/png', metadata: { cacheControl: 'public,max-age=31536000,immutable' } });
    await bucket.file(sp).makePublic();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('ok — 4 cells');
  }

  for (const id of SINGLE) {
    const subj = SINGLES[id];
    if (!subj) { console.log('no single named', id); continue; }
    const prompt = `${PASTEL.prefix} ${subj} ${PASTEL.suffix}`;
    process.stdout.write(`single ${id} … `);
    const img = await editWithRefs(prompt, refs, QUALITY);
    const cut = await trimSquare(await cutBackground(img));
    fs.writeFileSync(path.join(OUT, `${id}.png`), cut);
    const pth = `gravity-lock/cards/${id}.png`;
    await bucket.file(pth).save(cut, { contentType: 'image/png', metadata: { cacheControl: 'public,max-age=31536000,immutable' } });
    await bucket.file(pth).makePublic();
    manifest.push({ id, sheet: null, cell: null, prompt, quality: QUALITY,
      url: `https://storage.googleapis.com/${bucket.name}/${pth}`, madeAt: Date.now() });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('ok');
  }
  console.log('manifest:', manifestPath);
})();

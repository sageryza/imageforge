#!/usr/bin/env node
// pattern-tile.js — real photos → a seamless repeating tile (wallpaper,
// wrapping paper, fabric).
//
// Photos of Sophie's actual crystals, cut out and scattered. Two things make
// the result genuinely tileable rather than just "a square of stuff":
//
//   1. WRAP-AROUND PLACEMENT. Everything is drawn onto a 3x3 canvas at all
//      nine offsets and the CENTRE tile is extracted. Anything crossing an
//      edge therefore continues exactly on the opposite edge — no seam, no
//      element clipped in half.
//   2. A JITTERED GRID, not pure randomness. Random placement clumps and leaves
//      holes; one element per grid cell, nudged, reads as scattered while
//      staying even at any zoom.
//
// Backgrounds are removed by Replicate (birefnet) and cached to disk, so
// re-running with different colours or densities costs nothing.
//
//   node scripts/pattern-tile.js --album amethyst-cluster:0 --album pink-quartz:23
//   node scripts/pattern-tile.js --motifs motifs.json --size 1800 --density 5
//
// Needs REPLICATE_API_TOKEN and FIREBASE_SERVICE_ACCOUNT (Deck Factory).

const admin = require('firebase-admin');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { removeBackground } = require('../pipeline');

const CACHE = path.join(os.homedir(), '.pattern-cutouts');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : fallback;
}
function args(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === '--' + name) out.push(process.argv[i + 1]); });
  return out;
}

// Flat colours only — no gradients, ever.
const COLORWAYS = {
  cream: '#F0E7DA',
  ink: '#171526',
  plum: '#2E1F34',
  sage: '#C3CBBD',
  clay: '#B8836B',
  bone: '#FBF8F3',
};

function init() {
  if (admin.apps.length) return;
  const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(cred),
    storageBucket: `${cred.project_id}.firebasestorage.app`,
  });
}

// Deterministic RNG so a tile you like can be regenerated exactly.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Replicate can't read HEIC, and some of the Dump is still HEIC until the
// backfill finishes. Convert it in place — same destination the backfill uses,
// so the two can't fight.
async function ensureJpeg(doc) {
  if (!/\.heic$/i.test(doc.storagePath || '')) return doc.url;
  const bucket = admin.storage().bucket();
  let buf;
  try {
    [buf] = await bucket.file(doc.storagePath).download();
  } catch (e) {
    // The backfill may have converted and deleted this object since the read.
    const snap = await admin.firestore().collection('forge-drops').where('hash', '==', doc.hash).limit(1).get();
    const fresh = snap.empty ? null : snap.docs[0].data();
    if (fresh && !/\.heic$/i.test(fresh.storagePath || '')) return fresh.url;
    throw e;
  }
  let jpg;
  try { jpg = await sharp(buf, { unlimited: true }).jpeg({ quality: 95 }).toBuffer(); }
  catch { jpg = await require('heic-convert')({ buffer: buf, format: 'JPEG', quality: 0.95 }); }
  const newPath = `drops/_/${doc.hash}.jpg`;
  const file = bucket.file(newPath);
  await file.save(jpg, { metadata: { contentType: 'image/jpeg' } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${newPath}`;
  const snap = await admin.firestore().collection('forge-drops').where('hash', '==', doc.hash).get();
  for (const d of snap.docs) {
    await d.ref.update({ url, storagePath: newPath, bytes: jpg.length, updatedAt: Date.now() });
  }
  return url;
}

// The matte usually keeps a few crumbs — a chip of gravel, a shadow fleck —
// as separate islands of opacity. Scattered across a pattern they read as
// dirt on the paper, so keep only the biggest connected blob and drop the rest.
async function despeckle(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const solid = (i) => data[i * ch + 3] > 24;
  const label = new Int32Array(w * h).fill(-1);
  let best = -1;
  let bestSize = 0;
  let next = 0;
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || !solid(i)) continue;
    const id = next++;
    let size = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0) { const q = p - 1; if (label[q] === -1 && solid(q)) { label[q] = id; stack.push(q); } }
      if (x < w - 1) { const q = p + 1; if (label[q] === -1 && solid(q)) { label[q] = id; stack.push(q); } }
      if (y > 0) { const q = p - w; if (label[q] === -1 && solid(q)) { label[q] = id; stack.push(q); } }
      if (y < h - 1) { const q = p + w; if (label[q] === -1 && solid(q)) { label[q] = id; stack.push(q); } }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  for (let i = 0; i < w * h; i++) if (label[i] !== best) data[i * ch + 3] = 0;
  return { buf: await sharp(data, { raw: info }).png().toBuffer(), area: bestSize };
}

async function cutout(id, url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const cached = path.join(CACHE, `${id}.png`);
  if (fs.existsSync(cached)) {
    return { buf: fs.readFileSync(cached), ...JSON.parse(fs.readFileSync(cached + '.json', 'utf8')) };
  }
  console.log(`  cutting out ${id}…`);
  const out = await removeBackground(url);
  const raw = Buffer.from(await (await fetch(out)).arrayBuffer());
  const cleaned = await despeckle(raw);
  // Trim the transparent margin so the motif's real size is what gets scaled,
  // not the photo's framing.
  const trimmed = await sharp(cleaned.buf).trim().png().toBuffer();
  // How much of its own square does this motif actually cover, once placed?
  // A sphere fills nearly all of it; a long thin cluster covers a sliver. This
  // ratio — not the pixel count, which only reflects how close the camera was —
  // is what makes two motifs read as the same size on the paper.
  const t = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 0; i < t.info.width * t.info.height; i++) if (t.data[i * t.info.channels + 3] > 24) opaque++;
  const fill = opaque / Math.pow(Math.max(t.info.width, t.info.height), 2);
  fs.writeFileSync(cached, trimmed);
  fs.writeFileSync(cached + '.json', JSON.stringify({ fill }));
  return { buf: trimmed, fill };
}

async function buildTile({ motifs, size, density, background, seed, rotate }) {
  const rand = rng(seed);
  const cell = size / density;
  const placements = [];
  for (let gy = 0; gy < density; gy++) {
    for (let gx = 0; gx < density; gx++) {
      placements.push({
        motif: motifs[Math.floor(rand() * motifs.length)],
        // Jitter within the cell — even coverage, scattered look.
        cx: (gx + 0.2 + rand() * 0.6) * cell,
        cy: (gy + 0.2 + rand() * 0.6) * cell,
        scale: 0.78 + rand() * 0.34,
        angle: rotate ? Math.round((rand() * 2 - 1) * 55) : 0,
      });
    }
  }

  // Fitting each motif to the same box made a sphere twice the visual weight
  // of a long cluster, because the cluster only covers a sliver of its box.
  // Equalise covered area instead.
  const refFill = motifs.reduce((a, m) => a + m.fill, 0) / motifs.length;

  const composites = [];
  for (const p of placements) {
    const weight = Math.sqrt(refFill / Math.max(0.02, p.motif.fill));
    const target = Math.round(cell * 0.95 * p.scale * Math.min(1.6, Math.max(0.65, weight)));
    let img = sharp(p.motif.buf).resize(target, target, {
      fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if (p.angle) img = img.rotate(p.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const buf = await img.png().toBuffer();
    const m = await sharp(buf).metadata();
    const px = Math.round(p.cx - m.width / 2);
    const py = Math.round(p.cy - m.height / 2);
    // Nine copies, one per neighbouring tile. The centre tile is what we keep,
    // so an element leaving one edge arrives on the opposite one.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        composites.push({ input: buf, left: size + px + dx * size, top: size + py + dy * size });
      }
    }
  }

  return sharp({
    create: { width: size * 3, height: size * 3, channels: 4, background },
  })
    .composite(composites)
    .extract({ left: size, top: size, width: size, height: size })
    .png()
    .toBuffer();
}

async function main() {
  init();
  const size = Number(arg('size', 1800));
  const density = Number(arg('density', 5));
  const seed = Number(arg('seed', 7));
  const rotate = arg('rotate', '1') !== '0';
  const ways = (arg('colors', 'cream,ink') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const outDir = arg('out', '/tmp/pattern');
  fs.mkdirSync(outDir, { recursive: true });

  // --album <bundle>:<photoIndex>, repeatable
  const picks = args('album').map((a) => {
    const [bundle, idx] = a.split(':');
    return { bundle, photoIndex: Number(idx || 0) };
  });
  if (!picks.length) throw new Error('pass at least one --album <bundle>:<photoIndex>');

  const snap = await admin.firestore().collection('forge-drops').get();
  const docs = snap.docs.map((d) => d.data());

  const motifs = [];
  for (const p of picks) {
    const d = docs.find((x) => x.bundle === p.bundle && x.photoIndex === p.photoIndex);
    if (!d) { console.log(`  no photo ${p.bundle}#${p.photoIndex}`); continue; }
    motifs.push(await cutout(`${p.bundle}-${p.photoIndex}`, await ensureJpeg(d)));
  }
  if (!motifs.length) throw new Error('no motifs');
  console.log(`${motifs.length} motifs, ${density}x${density} per tile, ${size}px`);

  const made = [];
  for (const way of ways) {
    const hex = COLORWAYS[way] || way;
    const tile = await buildTile({ motifs, size, density, seed, rotate, background: hex });
    const tilePath = path.join(outDir, `tile-${way}.png`);
    fs.writeFileSync(tilePath, tile);

    // Proof that it repeats: the same tile 3x3, seams invisible if it worked.
    // Two passes on purpose: sharp resizes BEFORE it composites within one
    // pipeline, so chaining .resize() here would shrink the canvas first and
    // then refuse the full-size tiles.
    const wall = await sharp({ create: { width: size * 3, height: size * 3, channels: 4, background: hex } })
      .composite([0, 1, 2].flatMap((x) => [0, 1, 2].map((y) => ({ input: tile, left: x * size, top: y * size }))))
      .png({ compressionLevel: 1 })
      .toBuffer();
    await sharp(wall).resize(1600, 1600).jpeg({ quality: 88 })
      .toFile(path.join(outDir, `repeat-${way}.jpg`));
    made.push({ way, tilePath, proof: path.join(outDir, `repeat-${way}.jpg`) });
    console.log(`  ${way}: ${tilePath}`);
  }
  return made;
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { buildTile, cutout, COLORWAYS };

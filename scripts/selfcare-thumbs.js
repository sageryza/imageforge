// Sticker Day — make display-size copies of the art.
//
//   node scripts/selfcare-thumbs.js [--force]
//
// The generated PNGs are 1024px and 400-700KB each. A sheet shows seven of
// them at 78px and the stamp library shows twenty at ~150px, so serving the
// originals meant several megabytes on a phone for pictures displayed thumb-
// sized. This makes a 512px webp of every sticker, stamp and asset and writes
// it alongside as `thumb`; the page uses `thumb` and keeps `img` as the
// full-resolution original (never overwritten — see the repo rule about never
// downscaling the only copy).
//
// Costs nothing: it re-encodes what's already in Storage, no model calls.
//
// Env: FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_KEY_FILE.
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BUCKET = 'deckfactory-43176.firebasestorage.app';
const SIZE = 512;
const FORCE = process.argv.includes('--force');

const FILES = [
  path.join(__dirname, '..', 'public', 'selfcare-stickers.json'),
  path.join(__dirname, '..', 'public', 'selfcare-stamps.json'),
];

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.FIREBASE_KEY_FILE, 'utf8');
initializeApp({ credential: cert(JSON.parse(saJson)), storageBucket: BUCKET });

async function fetchBuffer(url, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      last = e;
      if (i < tries) await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
  throw new Error('download failed: ' + last.message);
}

// Walk every {img} object in a manifest, whatever nesting it sits in.
function* entries(node) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.img === 'string') { yield node; return; }
  for (const v of Object.values(node)) yield* entries(v);
}

async function thumbFor(entry) {
  const buf = await fetchBuffer(entry.img);
  const webp = await sharp(buf)
    .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  // Mirror the original's path, so a thumb always sits next to its source.
  const rel = decodeURIComponent(entry.img.split(`${BUCKET}/`)[1] || '');
  if (!rel) throw new Error('not a bucket url: ' + entry.img);
  const out = rel.replace(/\.(png|webp|jpg)$/i, '') + '-512.webp';
  const file = getStorage().bucket().file(out);
  await file.save(webp, { metadata: { contentType: 'image/webp' }, resumable: false });
  await file.makePublic();
  return { url: `https://storage.googleapis.com/${BUCKET}/${out}`, bytes: webp.length, was: buf.length };
}

(async () => {
  let made = 0, skipped = 0, saved = 0;
  for (const f of FILES) {
    if (!fs.existsSync(f)) continue;
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    const list = [...entries(m)];
    for (const e of list) {
      if (e.thumb && !FORCE) { skipped++; continue; }
      try {
        const t = await thumbFor(e);
        e.thumb = t.url;
        saved += t.was - t.bytes;
        made++;
        fs.writeFileSync(f, JSON.stringify(m, null, 2) + '\n');   // after each, so a crash keeps what landed
        process.stdout.write('.');
      } catch (err) {
        console.log('\nFAILED ' + e.img + ' — ' + err.message);
      }
    }
    fs.writeFileSync(f, JSON.stringify(m, null, 2) + '\n');
    console.log(`\n${path.basename(f)}: ${list.length} image(s)`);
  }
  console.log(`made ${made}, skipped ${skipped}, saved ~${(saved / 1048576).toFixed(1)} MB of page weight`);
})();

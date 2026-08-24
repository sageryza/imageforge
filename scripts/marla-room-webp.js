#!/usr/bin/env node
/**
 * marla-room-webp.js — the DERIVED display copies the Marla story's beats are
 * drawn from in the Story Room.
 *
 * THE HOUSE RULE, applied literally: never serve a raw generated PNG to a
 * page. Marla's art is 2.7–3.9MB a picture, and a beat with a versions row
 * behind it is asking her phone for up to fourteen of them at once — the
 * cover's row alone would be ~40MB. The same drawings at 1100px webp are
 * ~200KB, about 14x lighter.
 *
 * NOTHING IS COMPRESSED AT BIRTH AND NOTHING IS REPLACED. The full-size PNGs
 * in `storybook/marla/art/` (and the fishbowl tests, the splits, the WTR runs)
 * stay exactly as they are and remain what the book, the Assets tab and any
 * reprint read. This only ADDS a copy under `storybook/marla/room/`.
 *
 * WHY NOT REUSE `pages/*.webp` — those already exist and are the right weight,
 * but they are the composited BOOK PAGE: her words are painted into the
 * bottom of the picture. A beat carries her words itself, so using them would
 * print every caption twice.
 *
 * Idempotent: a copy that already exists is skipped, so a re-run after a new
 * round only encodes what is new. `--force` re-encodes everything.
 *
 *   node scripts/marla-room-webp.js [--force]
 * Needs STORY_FIREBASE_SERVICE_ACCOUNT (membry).
 */
const admin = require('firebase-admin');
const sharp = require('sharp');

const WIDTH = 1100;
const QUALITY = 82;
const OUT = 'storybook/marla/room/';
const FORCE = process.argv.includes('--force');

const sa = JSON.parse(process.env.STORY_FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: `${sa.project_id}.firebasestorage.app`,
});

// Every folder the beats and their versions rows can point at.
const SOURCES = ['art/', 'extra/', 'fishbowl-test/', 'wtr/', 'pages/p01-cover-painted.png'];
// A version's copy is named for its source folder + file, so two different
// pictures called p01-f.png in different folders can never collide.
const nameFor = (path) => `${OUT}${path.replace(/^storybook\/marla\//, '').replace(/\//g, '__').replace(/\.(png|webp|jpe?g)$/i, '')}.webp`;

async function main() {
  const bucket = admin.storage().bucket();
  const files = [];
  for (const src of SOURCES) {
    if (src.endsWith('.png')) { files.push(`storybook/marla/${src}`); continue; }
    const [list] = await bucket.getFiles({ prefix: `storybook/marla/${src}` });
    list.forEach((f) => { if (/\.png$/i.test(f.name)) files.push(f.name); });
  }
  console.log(`${files.length} source pictures`);
  let made = 0, skipped = 0, bytesIn = 0, bytesOut = 0;
  for (const path of files) {
    const dest = nameFor(path);
    const out = bucket.file(dest);
    if (!FORCE) {
      const [exists] = await out.exists();
      if (exists) { skipped++; continue; }
    }
    const [buf] = await bucket.file(path).download();
    const webp = await sharp(buf).resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY }).toBuffer();
    await out.save(webp, { contentType: 'image/webp', metadata: { cacheControl: 'public, max-age=31536000' } });
    await out.makePublic();
    bytesIn += buf.length; bytesOut += webp.length; made++;
    console.log(`  ${dest.split('/').pop()}  ${(buf.length / 1024 / 1024).toFixed(1)}MB → ${(webp.length / 1024).toFixed(0)}KB`);
  }
  console.log(`\nmade ${made}, skipped ${skipped}` + (made ? `, ${(bytesIn / 1048576).toFixed(0)}MB → ${(bytesOut / 1048576).toFixed(1)}MB` : ''));
}

main().catch((e) => { console.error(e.message); process.exit(1); });

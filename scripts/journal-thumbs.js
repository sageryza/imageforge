#!/usr/bin/env node
// Journal shelf covers — render page 1 of every scan in membry Storage
// `journal-scans/` to `journal-scans/thumbs/<name>.png` (~500px wide, TRUE
// aspect ratio, PRIVATE — these are Sophie's journals, never makePublic).
//
// The upload route (`POST /api/journal/upload-file`) already does this in the
// background for anything it receives, but it SKIPS bodies over 40MB — the
// free Render instance has 512MB for the whole app and a big scan plus the
// WASM copy of it doesn't fit. This is the backfill for those, and for
// anything that landed before covers existed.
//
//   node scripts/journal-thumbs.js --dry-run     # list what's missing
//   node scripts/journal-thumbs.js               # render the missing ones
//   node scripts/journal-thumbs.js --force       # re-render everything
//   node scripts/journal-thumbs.js --only "kraft journals 2.pdf"
//
// Needs STORY_FIREBASE_SERVICE_ACCOUNT (membry-df528). Run it from the repo
// root — `mupdf` is an ESM package resolved out of ./node_modules.

const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const FOLDER = 'journal-scans';
const WIDTH = 500;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');
const ONLY = (() => {
  const i = argv.indexOf('--only');
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
})();

(async () => {
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('STORY_FIREBASE_SERVICE_ACCOUNT not set'); process.exit(1); }
  const app = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
    storageBucket: 'membry-df528.firebasestorage.app',
  }, 'journal-thumbs');
  const bucket = app.storage().bucket();

  const [files] = await bucket.getFiles({ prefix: `${FOLDER}/` });
  const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) && !f.name.includes('/thumbs/'));
  const have = new Set(files.filter((f) => f.name.startsWith(`${FOLDER}/thumbs/`)).map((f) => f.name));

  const todo = pdfs.filter((f) => {
    const name = path.basename(f.name);
    if (ONLY && name !== ONLY) return false;
    return FORCE || !have.has(`${FOLDER}/thumbs/${name}.png`);
  });

  if (!todo.length) { console.log('nothing to render'); process.exit(0); }
  console.log(`${todo.length} cover(s) to render:`);
  todo.forEach((f) => console.log('  ' + path.basename(f.name)));
  if (DRY) process.exit(0);

  const mupdf = await import('mupdf');

  for (const f of todo) {
    const name = path.basename(f.name);
    const tmp = path.join(os.tmpdir(), `jt-${Date.now()}-${Math.round(Math.random() * 1e6)}.pdf`);
    try {
      const [meta] = await f.getMetadata();
      const mb = Math.round(Number(meta.size || 0) / 1048576);
      console.log(`downloading ${name} (${mb}MB)…`);
      await f.download({ destination: tmp });

      const doc = mupdf.Document.openDocument(fs.readFileSync(tmp), 'application/pdf');
      const page = doc.loadPage(0);
      const b = page.getBounds();
      const zoom = WIDTH / Math.max(1, b[2] - b[0]);
      const pix = page.toPixmap(mupdf.Matrix.scale(zoom, zoom), mupdf.ColorSpace.DeviceRGB, false, true);
      const png = Buffer.from(pix.asPNG());
      console.log(`  ${pix.getWidth()}x${pix.getHeight()} — ${png.length} bytes`);

      await bucket.file(`${FOLDER}/thumbs/${name}.png`).save(png, {
        contentType: 'image/png', resumable: false,
      });
      console.log(`✓ ${name}`);
    } catch (e) {
      console.error(`✗ ${name}: ${e.message}`);
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }
  console.log('done');
  process.exit(0);
})();

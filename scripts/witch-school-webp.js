#!/usr/bin/env node
/**
 * Witch School art → webp display copies.
 *
 * WHY: every card in witch-school/assets/ is a 1024×1024 PNG at ~1MB. The
 * Lessons tab shows five of them as small tiles (~5.8MB), the app preloads the
 * first card of all 16 lessons at boot (~16MB), and opening one lesson pulls
 * its whole deck (Spell Work = 10MB). That is the entire reason the tab is slow
 * — nothing about it is the network.
 *
 * WHAT: the same image, same 1024px, re-encoded as webp. No downscaling, so
 * nothing is lost off the top: ~1109KB → ~50KB, about 22×. The PNG stays where
 * it is as the untouched original (witch-school-cards.js keeps writing them);
 * this only adds a display copy beside it. Same idea as
 * scripts/selfcare-thumbs.js, which does this for the sticker art.
 *
 * The webp copies are uploaded with a ONE YEAR immutable cache header. The
 * PNGs come back from Firebase with max-age=3600, so a repeat visit later the
 * same day re-downloaded all of it; these never will. Safe because a changed
 * card is a new id, never a new body at the same name.
 *
 *   node scripts/witch-school-webp.js [--dry-run] [--force] [--only a,b]
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) — the same credential
 * witch-school-cards.js uses.
 */
const admin = require('firebase-admin');
const sharp = require('sharp');

const SRC_DIR = 'witch-school/assets/';
const OUT_DIR = 'witch-school/webp/';
const QUALITY = 84;                 // 84 keeps the line art crisp; 78 saves ~8KB and shows it
const CACHE = 'public, max-age=31536000, immutable';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY = has('--dry-run'), FORCE = has('--force');
const ONLY = (val('--only') || '').split(',').map(s => s.trim()).filter(Boolean);

function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set (needs the Deck Factory service account)');
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred), storageBucket: `${cred.project_id}.firebasestorage.app` });
  return admin.storage().bucket();
}

(async () => {
  const bucket = initFirebase();
  const [files] = await bucket.getFiles({ prefix: SRC_DIR });
  const pngs = files.filter(f => f.name.endsWith('.png'));
  const [outFiles] = await bucket.getFiles({ prefix: OUT_DIR });
  const done = new Set(outFiles.map(f => f.name.replace(OUT_DIR, '').replace(/\.webp$/, '')));

  let todo = pngs.map(f => ({ file: f, id: f.name.replace(SRC_DIR, '').replace(/\.png$/, '') }));
  if (ONLY.length) todo = todo.filter(t => ONLY.includes(t.id));
  const skipped = FORCE ? [] : todo.filter(t => done.has(t.id));
  if (!FORCE) todo = todo.filter(t => !done.has(t.id));

  console.log(`${pngs.length} PNGs in ${SRC_DIR} · ${done.size} already converted · ${todo.length} to do${skipped.length ? ` (${skipped.length} skipped, --force to redo)` : ''}`);
  if (DRY) { todo.slice(0, 10).forEach(t => console.log('  would convert', t.id)); if (todo.length > 10) console.log(`  … and ${todo.length - 10} more`); return; }
  if (!todo.length) return;

  let inBytes = 0, outBytes = 0, n = 0, failed = 0;
  for (const t of todo) {
    try {
      const [buf] = await t.file.download();
      // No resize — the sources are already 1024², so the whole win is the
      // format. Resizing here would cost sharpness for almost no extra bytes.
      const webp = await sharp(buf).webp({ quality: QUALITY }).toBuffer();
      await bucket.file(`${OUT_DIR}${t.id}.webp`).save(webp, {
        metadata: { contentType: 'image/webp', cacheControl: CACHE },
        resumable: false,
      });
      await bucket.file(`${OUT_DIR}${t.id}.webp`).makePublic();
      inBytes += buf.length; outBytes += webp.length; n++;
      console.log(`  ${t.id}  ${(buf.length / 1024).toFixed(0)}KB → ${(webp.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      failed++;
      console.log(`  ${t.id}  FAILED: ${e.message}`);
    }
  }
  console.log(`\n${n} converted${failed ? `, ${failed} failed` : ''}: ${(inBytes / 1048576).toFixed(1)}MB → ${(outBytes / 1048576).toFixed(1)}MB (${(inBytes / Math.max(1, outBytes)).toFixed(0)}× smaller)`);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

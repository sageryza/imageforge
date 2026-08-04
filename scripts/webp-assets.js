#!/usr/bin/env node
/**
 * Firebase Storage image folder → webp display copies.
 *
 * THE RULE THIS EXISTS FOR: a page must never serve a raw generated PNG.
 * gpt-image-2 writes 1024x1024 PNGs at ~1MB each. The Witch School Lessons tab
 * was serving five of them as small tiles (~5.8MB), one lesson's deck ran to
 * ~10MB, and the app preloaded the first card of all 16 lessons at boot (~16MB)
 * starting on the HOME screen — so the tab you'd just opened queued behind it.
 * Same image as webp: ~50KB. About 22x, and NOTHING is lost, because this does
 * not resize — the sources are already display-sized, so the whole win is the
 * format.
 *
 * WHAT IT DOES, per set: reads <src> in the Deck Factory bucket, writes
 * <name>.webp into <out> beside it, public, with a ONE YEAR immutable cache
 * header (Firebase hands PNGs back as max-age=3600, so a repeat visit later the
 * same day re-downloaded everything). Safe because a changed picture is a new
 * id in these pipelines — never new bytes at an existing name. The originals
 * are never touched or deleted; the generators keep writing them.
 *
 *   node scripts/webp-assets.js                 # every set below
 *   node scripts/webp-assets.js school          # one set
 *   node scripts/webp-assets.js --src a/ --out b/
 *   node scripts/webp-assets.js school --only qz-q1,qz-q2 --force
 *   node scripts/webp-assets.js --dry-run
 *
 * ADDING A NEW IMAGE SET: add it to SETS here, add its page constant to
 * scripts/webp-assets-verify.js, and have the page point at <out> through an
 * extension constant (never a hard-coded '.png'). Run this, then the verifier,
 * and only then deploy.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory).
 */
const admin = require('firebase-admin');
const sharp = require('sharp');

// name -> { src, out, note }. The page constant that reads each one is named in
// the note so a chat can find both ends.
const SETS = {
  school: {
    src: 'witch-school/assets/',
    out: 'witch-school/webp/',
    note: 'Witch School lesson cards, Book-of-Shadows section covers, brew ingredients AND the qz-* quiz cards — witch.html SW_IMG/SW_EXT (QZ_IMG is the same folder)',
  },
  quiz: {
    src: 'witch-quiz/assets/',
    out: 'witch-quiz/webp/',
    note: 'witch.html QUIZ_ASSETS — mostly .mp4 today; only images are converted',
  },
};

const QUALITY = 84;                 // 84 keeps the line art crisp; 78 saves ~8KB and shows it
const CACHE = 'public, max-age=31536000, immutable';
const IMAGE = /\.(png|jpe?g)$/i;

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY = has('--dry-run'), FORCE = has('--force');
const ONLY = (val('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const named = args.filter(a => !a.startsWith('--') && SETS[a]);

function targets() {
  const src = val('--src'), out = val('--out');
  if (src) return [{ name: 'custom', src, out: out || src.replace(/\/?$/, '').replace(/[^/]+$/, 'webp/') }];
  const keys = named.length ? named : Object.keys(SETS);
  return keys.map(k => ({ name: k, ...SETS[k] }));
}

function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set (needs the Deck Factory service account)');
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred), storageBucket: `${cred.project_id}.firebasestorage.app` });
  return admin.storage().bucket();
}

async function convertSet(bucket, set) {
  const [files] = await bucket.getFiles({ prefix: set.src });
  const srcs = files.filter(f => IMAGE.test(f.name));
  const [outFiles] = await bucket.getFiles({ prefix: set.out });
  const done = new Set(outFiles.map(f => f.name.replace(set.out, '').replace(/\.webp$/, '')));

  let todo = srcs.map(f => ({ file: f, id: f.name.replace(set.src, '').replace(IMAGE, '') }));
  if (ONLY.length) todo = todo.filter(t => ONLY.includes(t.id));
  const skipped = FORCE ? 0 : todo.filter(t => done.has(t.id)).length;
  if (!FORCE) todo = todo.filter(t => !done.has(t.id));

  console.log(`\n[${set.name}] ${set.src} → ${set.out}`);
  console.log(`  ${srcs.length} images · ${done.size} converted · ${todo.length} to do${skipped ? ` (${skipped} skipped, --force to redo)` : ''}`);
  if (DRY) { todo.slice(0, 10).forEach(t => console.log('    would convert', t.id)); if (todo.length > 10) console.log(`    … and ${todo.length - 10} more`); return { in: 0, out: 0, n: 0, failed: 0 }; }

  let inB = 0, outB = 0, n = 0, failed = 0;
  for (const t of todo) {
    try {
      const [buf] = await t.file.download();
      // No resize: these are already display-sized, and resizing would cost
      // sharpness for almost no extra bytes.
      const webp = await sharp(buf).webp({ quality: QUALITY }).toBuffer();
      const dest = bucket.file(`${set.out}${t.id}.webp`);
      await dest.save(webp, { metadata: { contentType: 'image/webp', cacheControl: CACHE }, resumable: false });
      await dest.makePublic();
      inB += buf.length; outB += webp.length; n++;
      if (n % 25 === 0 || todo.length < 25) console.log(`    ${t.id}  ${(buf.length / 1024).toFixed(0)}KB → ${(webp.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      failed++;
      console.log(`    ${t.id}  FAILED: ${e.message}`);
    }
  }
  console.log(`  ${n} converted${failed ? `, ${failed} FAILED` : ''}${n ? `: ${(inB / 1048576).toFixed(1)}MB → ${(outB / 1048576).toFixed(1)}MB (${(inB / Math.max(1, outB)).toFixed(0)}× smaller)` : ''}`);
  return { in: inB, out: outB, n, failed };
}

(async () => {
  const bucket = initFirebase();
  let tot = { in: 0, out: 0, n: 0, failed: 0 };
  for (const set of targets()) {
    const r = await convertSet(bucket, set);
    tot = { in: tot.in + r.in, out: tot.out + r.out, n: tot.n + r.n, failed: tot.failed + r.failed };
  }
  if (tot.n) console.log(`\nTOTAL ${tot.n} converted${tot.failed ? `, ${tot.failed} FAILED` : ''}: ${(tot.in / 1048576).toFixed(1)}MB → ${(tot.out / 1048576).toFixed(1)}MB`);
  if (tot.failed) process.exit(1);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

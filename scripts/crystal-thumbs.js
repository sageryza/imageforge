#!/usr/bin/env node
// crystal-thumbs.js — display copies for the crystal splitter.
//
// The Dump stores what the phone sent: full-resolution listing photos, ~3.7MB
// each. That's correct for the Dump (Etsy wants 2000px+ on the short side and
// nothing may downscale the original) and unusable for a page — the splitter
// shows a whole album at once, and one album is 100 photos, so pointing tiles
// at the originals is a third of a gigabyte to scroll past one album. The house
// rule is the same one webp-assets.js exists for: never serve the raw original
// to a page.
//
// So: a 480px webp beside each photo, content-addressed off the source object
// (same bytes → same thumb → re-running is free), uploaded with a one-year
// immutable cache header. The original is never touched and never replaced;
// `thumbUrl` is added to the drop doc as a server-owned field, so the Dump's
// own pages can use it too.
//
//   node scripts/crystal-thumbs.js                 # every Crystals album
//   node scripts/crystal-thumbs.js --track "Foo"   # some other Dump folder
//   node scripts/crystal-thumbs.js --bundle amethyst-cluster
//   node scripts/crystal-thumbs.js --force         # rebuild existing thumbs
//   node scripts/crystal-thumbs.js --dry-run
//
// Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) and sharp.

const admin = require('firebase-admin');
const sharp = require('sharp');
const crypto = require('crypto');

const WIDTH = 480;        // ~2x a 3-up tile on a phone; still ~40KB
const CONCURRENCY = 6;

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf('--' + n);
  return i === -1 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true);
};
const DRY = args.includes('--dry-run');
const FORCE = args.includes('--force');
const TRACK = flag('track', 'Crystals');
const BUNDLE = flag('bundle', null);

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
  const cred = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(cred),
    storageBucket: `${cred.project_id}.firebasestorage.app`,
  });
}

async function main() {
  init();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  let q = db.collection('forge-drops');
  q = BUNDLE ? q.where('bundle', '==', BUNDLE) : q.where('track', '==', TRACK);
  const snap = await q.get();

  const todo = [];
  snap.forEach((d) => {
    const v = d.data();
    // Videos already carry a poster frame from the Dump's own ingest.
    if ((v.media || 'image') === 'video') return;
    if (v.thumbUrl && !FORCE) return;
    if (!v.storagePath) return;
    todo.push({ id: d.id, path: v.storagePath, bundle: v.bundle });
  });

  console.log(`${snap.size} files in scope · ${todo.length} need a thumb` + (DRY ? ' (dry run)' : ''));
  if (DRY || !todo.length) return;

  let done = 0, failed = 0;
  async function one(it) {
    try {
      const [buf] = await bucket.file(it.path).download();
      const out = await sharp(buf).rotate().resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: 78 }).toBuffer();
      // Keyed by the SOURCE bytes, so the same photo in two albums is one thumb
      // and a re-run overwrites in place rather than piling up copies.
      const key = crypto.createHash('md5').update(buf).digest('hex');
      const dest = `drops/_thumb/${key}.webp`;
      const file = bucket.file(dest);
      await file.save(out, {
        contentType: 'image/webp',
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
      await file.makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
      await db.collection('forge-drops').doc(it.id).update({ thumbUrl: url });
      done++;
      if (done % 25 === 0) console.log(`  ${done}/${todo.length}`);
    } catch (e) {
      failed++;
      console.log(`  ! ${it.bundle}/${it.id}: ${e.message}`);
    }
  }

  // A small pool: the downloads are the slow part and the instance has 512MB
  // for the whole app, so a few megabytes in flight at once is the ceiling.
  const queue = todo.slice();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await one(queue.shift());
  }));

  console.log(`\n${done} thumbs written, ${failed} failed`);
}

main().catch((e) => { console.error(e); process.exit(1); });

// fruit-upload.js — put the watercolour fruit deck into Storage and build the poll.
//
// Reads the images `scripts/nde-watercolor.py` wrote for `scripts/fruit-chart/fruits.json`
// and uploads TWO copies of each: the model's full-size output (never touched —
// CLAUDE.md's "always save at full resolution") and an extra ~640px display copy
// the swipe deck actually loads, because 27 × ~800KB is not a phone-friendly deck.
//
//   node scripts/fruit-upload.js <imagedir> [--poll fridge-fruit] [--dry-run]
//
// Needs FIREBASE_SERVICE_ACCOUNT (deckfactory-43176). Prints the fruits[] array
// the poll wants; pass --poll to also POST it to /api/fruit/poll.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--')) || '/home/user/out/fruit';
const dry = args.includes('--dry-run');
const pollIx = args.indexOf('--poll');
const pollId = pollIx >= 0 ? args[pollIx + 1] : null;

const jobs = JSON.parse(fs.readFileSync(path.join(__dirname, 'fruit-chart/fruits.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  storageBucket: `${JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id}.firebasestorage.app`,
});
const bucket = admin.storage().bucket();

async function put(localPath, dest, contentType) {
  await bucket.upload(localPath, { destination: dest, metadata: { contentType } });
  await bucket.file(dest).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

(async () => {
  const out = [];
  for (const job of jobs) {
    const src = path.join(dir, job.id + '.webp');
    if (!fs.existsSync(src)) { console.log(`  -- ${job.id}: no file, skipped`); continue; }

    if (dry) { console.log(`  DRY ${job.id} (${(fs.statSync(src).size / 1024) | 0} KB)`); continue; }

    // Full resolution first, exactly as the model wrote it.
    const full = await put(src, `fruit/full/${job.id}.webp`, 'image/webp');

    // The display copy is an EXTRA file, never a replacement.
    const small = path.join(dir, job.id + '.640.webp');
    await sharp(src).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toFile(small);
    const disp = await put(small, `fruit/card/${job.id}.webp`, 'image/webp');

    out.push({ id: job.id, name: job.name, url: disp, full });
    console.log(`  OK  ${job.name.padEnd(14)} ${(fs.statSync(small).size / 1024) | 0} KB card`);
  }

  fs.writeFileSync(path.join(dir, 'fruits-uploaded.json'), JSON.stringify(out, null, 1));
  console.log(`\n${out.length} uploaded → ${path.join(dir, 'fruits-uploaded.json')}`);

  if (pollId && out.length) {
    const res = await fetch(`${BASE}/api/fruit/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pollId, title: 'Favorite fruit', fruits: out }),
    });
    console.log('poll →', JSON.stringify(await res.json(), null, 1));
  }
})().catch(e => { console.error(e); process.exit(1); });

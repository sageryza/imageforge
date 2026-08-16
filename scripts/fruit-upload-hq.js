// fruit-upload-hq.js — put a batch of cut fruit/vegetable cards into Storage.
//
//   node scripts/fruit-upload-hq.js <carddir> [--out scripts/fruit-chart/hq-uploaded.json] [--dry-run]
//
// The generic sibling of fruit-upload.js, which reads the deck's own
// fruits.json and can therefore only ever upload the ORIGINAL 27. A redraw
// batch (a high-quality pass, a two-up re-cut) has no such file — what it has
// is whatever fruit-cut.js just wrote, described by the `*-cells.json`
// manifests beside the images. So this reads those.
//
// THE STORAGE PATH KEEPS THE SUFFIX, THE DECK ID DROPS IT. A redraw is written
// to `fruit/card/08-blueberries-hq.webp` so it can never overwrite the picture
// it replaces (nothing is deleted — the old card stays in Storage and in the
// gallery), but its RECORD is filed under `08-blueberries`, because
// fruit-poll.js builds the deck with later records winning per id, and an id
// that changed would orphan every ballot already cast against it and every
// personal link already sitting in somebody's inbox.
//
// TWO copies of every card, exactly as the deck's own uploader does: the cut
// output untouched (full resolution — never downscale the only copy on disk)
// and an extra ~640px display copy the swipe deck actually loads.
//
// Needs FIREBASE_SERVICE_ACCOUNT (deckfactory-43176).

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) || '/home/user/out/fruit-hq-cards';
const dry = args.includes('--dry-run');
const outIx = args.indexOf('--out');
const outFile = outIx >= 0 ? args[outIx + 1] : path.join(dir, 'uploaded.json');

// Every cell manifest fruit-cut.js left in the directory, in filename order.
const cells = fs.readdirSync(dir)
  .filter((f) => f.endsWith('-cells.json'))
  .sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

if (!cells.length) {
  console.error(`no *-cells.json in ${dir} — run fruit-cut.js first`);
  process.exit(1);
}

// `08-blueberries-hq` → `08-blueberries`. A version suffix names the FILE, not
// the fruit; the deck asks about the fruit.
const deckId = (id) => String(id).replace(/-(hq|v\d+)$/, '');

const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(key),
  storageBucket: `${key.project_id}.firebasestorage.app`,
});
const bucket = admin.storage().bucket();

async function put(localPath, dest, contentType) {
  await bucket.upload(localPath, { destination: dest, metadata: { contentType } });
  await bucket.file(dest).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

(async () => {
  const out = [];
  for (const cell of cells) {
    const src = cell.file && fs.existsSync(cell.file) ? cell.file : path.join(dir, cell.id + '.webp');
    if (!fs.existsSync(src)) { console.log(`  -- ${cell.id}: no file, skipped`); continue; }
    if (dry) { console.log(`  DRY ${cell.id} (${(fs.statSync(src).size / 1024) | 0} KB)`); continue; }

    const full = await put(src, `fruit/full/${cell.id}.webp`, 'image/webp');

    const small = path.join(dir, cell.id + '.640.webp');
    await sharp(src).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toFile(small);
    const url = await put(small, `fruit/card/${cell.id}.webp`, 'image/webp');

    out.push({ id: deckId(cell.id), name: cell.name, url, full });
    console.log(`  OK  ${String(cell.name).padEnd(14)} ${(fs.statSync(small).size / 1024) | 0} KB card`);
  }

  if (dry) return;
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(`\n${out.length} uploaded → ${outFile}`);
})().catch((e) => { console.error(e); process.exit(1); });

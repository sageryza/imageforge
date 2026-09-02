#!/usr/bin/env node
/* Seed HEX COLOR CARDS into the Triset pool — the color edition's digital
   form (2026-08-31, Sophie: "for now the digital version just hex colors").
   A hex card is a doc carrying `hex` and no picture: nothing is drawn,
   nothing is uploaded, NOTHING IS SPENT — twelve Firestore writes. The page
   renders it as a flat color triangle, the edition chip deals it as a deck,
   and a found set of three mixes in code (triset.js mixHex), free.

   Cards come from a batch file with `hex` per card (`name` is the display
   title; `title` is ignored here — nothing is prompted). Content-addressed
   by edition+slug, so re-running updates hues in place.

   Run:  node scripts/seed-triset-hex.js --file scripts/triset-batches/color-edition.json --dry
         node scripts/seed-triset-hex.js --file … --go
   Env:  FIREBASE_SERVICE_ACCOUNT (deckfactory). */
const fs = require('fs');
const crypto = require('crypto');
const admin = require('firebase-admin');

const argOf = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const file = argOf('file', '');
if (!file) { console.error('pass --file <batch.json>'); process.exit(1); }
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const cards = (Array.isArray(batch) ? batch : batch.cards || []).filter(c => c.hex);
const EDITION = argOf('edition', batch.edition || '');
const DRY = process.argv.includes('--dry') || !process.argv.includes('--go');
const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

async function main() {
  console.log(`${cards.length} hex cards${EDITION ? ' · edition ' + EDITION : ''} · free (no model call)`);
  for (const c of cards) console.log('  ' + c.slug.padEnd(22) + (c.hex || '').padEnd(9) + (c.name || c.title || ''));
  if (DRY) { console.log('(dry — pass --go to write)'); return; }

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  for (const c of cards) {
    const id = sha1('triset-hex:' + EDITION + ':' + c.slug);
    const ref = db.collection('forge-triset-cards').doc(id);
    const had = (await ref.get()).exists;
    await ref.set({
      title: c.name || c.title || c.slug, hex: c.hex,
      source: 'seed', status: 'ready',
      ...(EDITION ? { edition: EDITION } : {}),
      ...(had ? {} : { createdAt: Date.now() }),
    }, { merge: true });
    console.log((had ? 'updated ' : 'filed   ') + c.slug);
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/* Hide Triset pool cards by url substring — the retire step after a REDRAW
   (2026-08-31, Sophie: "can u redo them all at medium"). A redraw at another
   quality is a NEW url and a new doc, so without this the pool holds both
   the old and the new picture of every subject.

   Nothing is deleted — `hidden` is the verb (triset.js's own rule), so a
   hidden card is one flag away from coming back.

   Run:  node scripts/triset-hide.js --match /web1- /web2-      (dry)
         node scripts/triset-hide.js --match /web1- /web2- --go
         node scripts/triset-hide.js --match /web1- --unhide --go
   Env:  FIREBASE_SERVICE_ACCOUNT (deckfactory) */
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const GO = argv.includes('--go');
const UNHIDE = argv.includes('--unhide');
const mi = argv.indexOf('--match');
const MATCH = mi > -1 ? argv.slice(mi + 1).filter(a => !a.startsWith('--')) : [];
if (!MATCH.length) { console.error('need --match <substring> [more…]'); process.exit(1); }

async function main() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  const snap = await db.collection('forge-triset-cards').get();
  const hit = [];
  snap.forEach((d) => {
    const c = d.data() || {};
    const url = String(c.url || '');
    if (!MATCH.some(m => url.includes(m))) return;
    if (!!c.hidden === !UNHIDE) return; // already in the wanted state
    hit.push({ id: d.id, title: c.title, url });
  });
  console.log(`${hit.length} cards to ${UNHIDE ? 'unhide' : 'hide'}  (match: ${MATCH.join(' ')})`);
  for (const h of hit.slice(0, 8)) console.log('  ' + h.title);
  if (hit.length > 8) console.log(`  …and ${hit.length - 8} more`);
  if (!GO) { console.log('\n(dry — pass --go to write)'); return; }
  // batched: 500 is Firestore's per-commit cap
  for (let i = 0; i < hit.length; i += 400) {
    const b = db.batch();
    for (const h of hit.slice(i, i + 400)) {
      b.set(db.collection('forge-triset-cards').doc(h.id), { hidden: !UNHIDE }, { merge: true });
    }
    await b.commit();
  }
  console.log('done — ' + hit.length + (UNHIDE ? ' back in the pool' : ' hidden'));
}
main().catch((e) => { console.error(e); process.exit(1); });

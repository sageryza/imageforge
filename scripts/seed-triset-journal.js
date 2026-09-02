#!/usr/bin/env node
/* Seed the JOURNAL EDITION of the Triset/Similitude pool — Sophie's own
   hand-drawn journal cutouts, the pool the JournalReader app calls
   "Set → Drawings" (membry Firestore `sagediagram`, ~316 pieces of ink on
   white, already cut out one object to a square).

   NOTHING IS DRAWN AND NOTHING IS SPENT. These are her drawings; the only
   work here is a Firestore write per card and, afterwards, the same measured
   die-cut every other card gets (scripts/triset-recut.js).

   THEY ARE SEEDED `hidden:true`, AND THAT IS THE WHOLE SEPARATION (2026-09-01,
   "a separate version of the triangle set game ... no render deploy, just a
   compare page"). `GET /api/triset/cards` is the ONLY route that filters
   hidden, so:
     • her live /similitude never deals one, and its edition row — hidden
       today because every visible card is `nature` — does not appear;
     • the Compare page copy carries the deck embedded, so it deals exactly
       these;
     • /found, /opponent and /challenge read cards BY DOC ID with no hidden
       filter, so every server feature still works for the copy with no
       deploy.

   THE TITLE IS HER CAPTION, NEVER AN INVENTED ONE. 40 of the 316 carry one
   she wrote in the journal app; the rest are named for the page they came
   off ("April · 004"), which is honest and says nothing the drawing doesn't.
   Re-running is idempotent (the doc id is sha1(url)) and REFRESHES titles,
   so captioning more in the journal app and re-running is how the names
   fill in.

   Run:  node scripts/seed-triset-journal.js          (dry — prints the plan)
         node scripts/seed-triset-journal.js --go
         node scripts/seed-triset-journal.js --go --unhide   (put them in the
            live pool as a real edition — HER CALL, not a default)
   Env:  STORY_FIREBASE_SERVICE_ACCOUNT (membry, reads sagediagram)
         FIREBASE_SERVICE_ACCOUNT       (deckfactory, writes the cards)      */
const crypto = require('crypto');
const admin = require('firebase-admin');

const GO = process.argv.includes('--go');
const UNHIDE = process.argv.includes('--unhide');
const EDITION = 'journal';
const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

// "april_special_stickers_copy_017" → "April · 017"; the month is the field
// the journal app already sorts by, so the fallback name is the page it came
// off and nothing more.
function fallbackTitle(id, month) {
  const n = (/_(\d{2,4})$/.exec(id) || [])[1] || '';
  const m = month && month !== 'Unsorted' ? month : 'Journal';
  return n ? `${m} · ${n}` : m + ' drawing';
}

async function main() {
  const membry = admin.initializeApp(
    { credential: admin.credential.cert(JSON.parse(process.env.STORY_FIREBASE_SERVICE_ACCOUNT)) }, 'membry');
  const deckSa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const deck = admin.initializeApp(
    { credential: admin.credential.cert(deckSa), storageBucket: `${deckSa.project_id}.firebasestorage.app` }, 'deck');

  const snap = await membry.firestore().collection('sagediagram').get();
  const draw = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => /^https?:\/\//.test(d.url || ''));
  const captioned = draw.filter((d) => (d.caption || '').trim()).length;
  console.log(`sagediagram: ${draw.length} drawings · ${captioned} with a caption of hers`);

  const cards = deck.firestore().collection('forge-triset-cards');
  const existing = new Map();
  (await cards.where('edition', '==', EDITION).get()).docs.forEach((d) => existing.set(d.id, d.data()));
  console.log(`journal edition already in the pool: ${existing.size}`);

  let made = 0; let renamed = 0; let same = 0;
  for (const d of draw) {
    const id = sha1(d.url);
    const title = (d.caption || '').trim() || fallbackTitle(d.id, d.month);
    const was = existing.get(id);
    if (!was) made += 1;
    else if ((was.title || '') !== title) renamed += 1;
    else { same += 1; continue; }
    if (!GO) continue;
    await cards.doc(id).set({
      title, url: d.url, source: 'journal', status: 'ready',
      edition: EDITION, hidden: !UNHIDE,
      journal: { id: d.id, month: d.month || 'Unsorted', captioned: !!(d.caption || '').trim() },
      // no model, no quality, no size: she drew these by hand, and a caption
      // slot filled with a model's name would be a lie about where they came
      // from (the exact-prompt rule's own answer — file nothing).
      createdAt: was ? (was.createdAt || Date.now()) : Date.now(),
    }, { merge: true });
  }
  console.log(`${made} new · ${renamed} retitled · ${same} unchanged`
    + (UNHIDE ? ' · VISIBLE in the live pool' : ' · hidden from the live pool'));
  if (!GO) console.log('(dry — pass --go to write)');
  else console.log('next: node scripts/triset-recut.js --go   (bakes the die-cuts)');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/* Hide Triset cards whose Storage filename starts with a prefix — what a
   REDRAW needs: the new generation lands at `<ver>-<slug>.webp` (immutable
   objects, so a redraw is always a new url), and the generation it replaces
   is put away rather than deleted. `hidden` is the verb in this module;
   nothing here removes a doc or an object, so an unhide is one flag away.

   Dry by default (the house rule for any sweep that writes):
     node scripts/triset-hide.js --prefix seed2-            (names them)
     node scripts/triset-hide.js --prefix seed2- --go       (hides them)
     node scripts/triset-hide.js --prefix seed2- --unhide --go

   --only <json>: restrict to the slugs in a batch file ([{slug,…}, …]), so
   redrawing 50 of 200 cards puts away exactly those 50. Without it every
   card carrying the prefix is swept.

   Env: FIREBASE_SERVICE_ACCOUNT (deckfactory). */
const fs = require('fs');
const admin = require('firebase-admin');

const flag = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const PREFIX = flag('prefix', '');
const ONLY = flag('only', '');
const GO = process.argv.includes('--go');
const HIDDEN = !process.argv.includes('--unhide');

if (!PREFIX) { console.error('--prefix required (e.g. seed2-)'); process.exit(1); }

const slugs = ONLY
  ? new Set(JSON.parse(fs.readFileSync(ONLY, 'utf8')).map(s => s.slug))
  : null;

(async () => {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  const snap = await db.collection('forge-triset-cards').get();

  const hits = [];
  for (const d of snap.docs) {
    const c = d.data();
    const file = String(c.url || '').split('/').pop();
    if (!file.startsWith(PREFIX)) continue;
    if (slugs && !slugs.has(file.slice(PREFIX.length).replace(/\.webp$/, ''))) continue;
    if (Boolean(c.hidden) === HIDDEN) continue;   // already where it should be
    hits.push({ ref: d.ref, file, title: c.title, quality: c.quality });
  }

  console.log(`${hits.length} cards to ${HIDDEN ? 'hide' : 'unhide'} (prefix "${PREFIX}"${ONLY ? ', from ' + ONLY : ''})`);
  for (const h of hits) console.log('  ' + h.file.padEnd(34) + (h.quality || '?') + '  ' + (h.title || ''));
  if (!GO) { console.log('\n(dry — pass --go to write)'); process.exit(0); }

  for (const h of hits) await h.ref.set({ hidden: HIDDEN }, { merge: true });

  const left = (await db.collection('forge-triset-cards').get()).docs
    .map(d => d.data()).filter(c => !c.hidden);
  console.log(`done — ${hits.length} ${HIDDEN ? 'hidden' : 'unhidden'}; ${left.length} cards visible in the pool`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

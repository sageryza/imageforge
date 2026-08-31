#!/usr/bin/env node
/* Bake the Triset die-cuts from a CONTAINER — the same measured cut a made
   card gets at render time (triset-cut.js), run over the pool: flood-fill
   the white paper away, fit the whole drawn card (outline and cream rim
   included) inside the equilateral slot triangle, transparent around it.
   Costs nothing — no model call; a download, sharp, an upload per card.

   Run:  node scripts/triset-recut.js           (dry — names who needs one)
         node scripts/triset-recut.js --go
         node scripts/triset-recut.js --go --force   (re-bake ALL — only
            useful after a CUT_VERSION bump; the objects are immutable)
   Env:  FIREBASE_SERVICE_ACCOUNT (deckfactory). */
const admin = require('firebase-admin');
const { bakeCut, cutPath, CUT_VERSION } = require('../triset-cut');

const GO = process.argv.includes('--go');
const FORCE = process.argv.includes('--force');

async function main() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: `${sa.project_id}.firebasestorage.app`,
  });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const snap = await db.collection('forge-triset-cards').get();
  const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const need = cards.filter(c => c.status === 'ready' && c.url && (FORCE || !c.cut));
  console.log(`${cards.length} cards · ${need.length} need a ${CUT_VERSION} cut${FORCE ? ' (forced)' : ''}`);
  if (!GO) {
    for (const c of need) console.log('  ' + c.id.slice(0, 12) + '  ' + (c.flip ? 'down ' : 'up   ') + (c.title || '').slice(0, 50));
    console.log('(dry — pass --go to bake)');
    return;
  }
  let done = 0; let failed = 0;
  for (const c of need) {
    try {
      const r = await fetch(c.url);
      if (!r.ok) throw new Error('fetch ' + r.status);
      const { buf, fullBleed } = await bakeCut(Buffer.from(await r.arrayBuffer()), { flip: !!c.flip });
      const p = cutPath(c.id);
      const file = bucket.file(p);
      await file.save(buf, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }, resumable: false });
      await file.makePublic();
      const cut = `https://storage.googleapis.com/${bucket.name}/${p}`;
      await db.collection('forge-triset-cards').doc(c.id).set({ cut }, { merge: true });
      done++;
      console.log('cut    ' + c.id.slice(0, 12) + '  ' + (buf.length / 1024).toFixed(0) + 'KB'
        + (fullBleed ? '  (full-bleed — masked to the ideal triangle)' : '') + '  ' + (c.title || '').slice(0, 40));
    } catch (e) { failed++; console.log('FAILED ' + c.id.slice(0, 12) + ': ' + e.message); }
  }
  console.log(`done — ${done} cut${failed ? ', ' + failed + ' failed' : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// THE PHOTO A PICTURE WAS DRAWN FROM, PUT BACK ON ITS RECORD (2026-09-22,
// Sophie, sending a picture from its tile to the Playground: "did not include
// original reference"). A Playground run doc has always kept `photoRef` /
// `photoRefs` — the picture(s) she attached — but the My Creations doc filed
// from it dropped them, so the Playground door had a prompt to port and no
// photo. fileRunToCreations writes them now; this repairs what is already on
// file, from the run doc and nothing else.
//
//   node scripts/backfill-photo-ref.js          # dry — counts and names
//   node scripts/backfill-photo-ref.js --go     # writes photoRef(/photoRefs)
//
// Join: run doc `images[]` url → creation `url` (and a forge-chat-assets doc
// at the same url). Only a record with NO photoRef is touched; nothing else on
// it moves. A run with no photo is not a gap.
'use strict';
const admin = require('firebase-admin');
const GO = process.argv.includes('--go');
const svc = (name) => { const raw = process.env[name]; if (!raw) { console.error(`missing ${name}`); process.exit(1); } return JSON.parse(raw); };
admin.initializeApp({ credential: admin.credential.cert(svc('FIREBASE_SERVICE_ACCOUNT')) });
const storyApp = admin.initializeApp({ credential: admin.credential.cert(svc('STORY_FIREBASE_SERVICE_ACCOUNT')) }, 'story');
const uk = (u) => String(u || '').split('?')[0].split('#')[0].trim().toLowerCase();
const HTTPS = (u) => /^https?:\/\//.test(String(u || ''));

async function galleryUid() {
  const snap = await storyApp.firestore().collectionGroup('creations').select().get();
  const counts = new Map();
  snap.docs.forEach((d) => { const uid = d.ref.parent.parent.id; counts.set(uid, (counts.get(uid) || 0) + 1); });
  let best = null; let bestN = 0;
  counts.forEach((n, uid) => { if (n > bestN) { best = uid; bestN = n; } });
  if (!best) throw new Error('no creations owner found');
  return best;
}
function fields(r) {
  const list = (Array.isArray(r.photoRefs) && r.photoRefs.length ? r.photoRefs : [r.photoRef]).map((u) => String(u || '')).filter(HTTPS).slice(0, 8);
  if (!list.length) return null;
  return list.length > 1 ? { photoRef: list[0], photoRefs: list } : { photoRef: list[0] };
}
(async () => {
  // 1. every run that carried a photo → url → fields
  const runs = await admin.firestore().collection('forge-promptlab').get();
  const byUrl = new Map(); let runsWithPhoto = 0;
  runs.docs.forEach((d) => {
    const r = d.data() || {}; const f = fields(r); if (!f) return;
    runsWithPhoto += 1;
    (r.images || []).forEach((u) => { if (u) byUrl.set(uk(u), f); });
  });
  console.log(`runs: ${runs.size}, with a photo: ${runsWithPhoto}, pictures drawn from one: ${byUrl.size}`);
  // 2. creations missing it
  const uid = await galleryUid();
  const col = storyApp.firestore().collection('users').doc(uid).collection('creations');
  const cs = await col.select('url', 'photoRef').get();
  let cFix = 0; let cHas = 0;
  for (const d of cs.docs) {
    const c = d.data(); if (c.photoRef) { cHas += 1; continue; }
    const f = byUrl.get(uk(c.url)); if (!f) continue;
    cFix += 1; if (GO) await d.ref.update(f);
  }
  console.log(`creations: ${cs.size}, already carrying one: ${cHas}, ${GO ? 'repaired' : 'would repair'}: ${cFix}`);
  // 3. forge-chat-assets at the same urls
  const as = await admin.firestore().collection('forge-chat-assets').select('url', 'photoRef').get();
  let aFix = 0;
  for (const d of as.docs) {
    const a = d.data(); if (a.photoRef) continue;
    const f = byUrl.get(uk(a.url)); if (!f) continue;
    aFix += 1; if (GO) await d.ref.update(f);
  }
  console.log(`chat assets: ${as.size}, ${GO ? 'repaired' : 'would repair'}: ${aFix}`);
  if (!GO) console.log('dry run — add --go to write');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

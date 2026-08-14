#!/usr/bin/env node
// Verify the book the way the tool reads it: the Storybook tool asks for every
// creation of type "storybook" and shows them oldest-first, so this asserts the
// docs come back in page order with no gaps, no duplicates and no dead urls.
const admin = require('firebase-admin');
const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });

(async () => {
  const uid = process.env.GALLERY_UID;
  const snap = await admin.firestore().collection('users').doc(uid)
    .collection('creations').where('type', '==', 'storybook').get();
  const docs = snap.docs
    .map((d) => ({ at: d.get('createdAt').toMillis(), page: d.get('page'), url: d.get('url'), words: d.get('prompt'), q: d.get('quality'), m: d.get('model') }))
    .sort((a, b) => a.at - b.at);

  console.log(`the tool would show ${docs.length} pages, in this order:`);
  const order = docs.map((d) => d.page);
  const expected = docs.map((_, i) => i + 1);
  console.log(order.join(' '));
  console.log(JSON.stringify(order) === JSON.stringify(expected)
    ? 'order: correct (page 1 first)'
    : 'ORDER WRONG');
  const dupes = order.filter((p, i) => order.indexOf(p) !== i);
  console.log(dupes.length ? `DUPLICATES: ${dupes.join(',')}` : 'no duplicates');
  console.log(docs.every((d) => d.q && d.m) ? 'every page carries model + quality' : 'MISSING model/quality');

  let bad = 0;
  for (const d of docs) {
    const r = await fetch(d.url, { method: 'HEAD' });
    if (!r.ok) { console.log(`  page ${d.page}: ${r.status} ${d.url}`); bad++; }
  }
  console.log(bad ? `${bad} unreachable pages` : 'all page images reachable');
  process.exit(0);
})();

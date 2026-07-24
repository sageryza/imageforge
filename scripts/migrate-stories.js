#!/usr/bin/env node
// One-time migration: move the saved-text story library from the old
// `forge-stories` collection (Deck Factory / deckfactory-43176, the server's
// default Firebase project) into `forge-story` (membry-df528, the story
// boards) as text-only story docs — part of the July 2026 merge of the three
// story surfaces into the Story Room. After this runs clean, `forge-stories`
// is retired (stories.js already reads forge-story only).
//
//   node scripts/migrate-stories.js --dry-run   # list what would move
//   node scripts/migrate-stories.js             # migrate (skips ids that exist)
//
// Needs BOTH service accounts in the environment:
//   FIREBASE_SERVICE_ACCOUNT        = deckfactory-43176 (source)
//   STORY_FIREBASE_SERVICE_ACCOUNT  = membry-df528      (destination)

const admin = require('firebase-admin');

const DRY = process.argv.includes('--dry-run');

function initApp(envVar, name) {
  const raw = process.env[envVar];
  if (!raw) { console.error(`${envVar} not set`); process.exit(1); }
  const sa = JSON.parse(raw);
  return admin.initializeApp({ credential: admin.credential.cert(sa) }, name);
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

(async () => {
  const src = initApp('FIREBASE_SERVICE_ACCOUNT', 'src').firestore();
  const dst = initApp('STORY_FIREBASE_SERVICE_ACCOUNT', 'dst').firestore();

  const all = (await src.collection('forge-stories').get()).docs.map(d => d.data());
  console.log(`source: ${all.length} doc(s) in forge-stories`);
  // Skip obvious test junk (a real story is longer than a few characters) —
  // pass --all to migrate everything anyway.
  const MIN = process.argv.includes('--all') ? 0 : 20;
  const stories = all.filter(s => String(s.text || '').trim().length >= MIN);
  for (const s of all) {
    if (!stories.includes(s)) console.log(`skipping junk doc "${String(s.text || '').slice(0, 20)}" (${String(s.text || '').length} chars; --all to include)`);
  }
  if (!stories.length) { console.log('nothing to migrate'); process.exit(0); }

  const boards = await dst.collection('forge-story').get();
  const existingIds = new Set(boards.docs.map(d => d.id));
  let maxOrder = boards.docs.reduce((mx, d) => Math.max(mx, d.data().order ?? 0), 0);

  for (const s of stories) {
    const title = s.title || (String(s.text || '').split(/\s+/).slice(0, 6).join(' ') + '…');
    let id = slug(title) || 'story';
    const base = id; let n = 1;
    while (existingIds.has(id)) { n++; id = base + '-' + n; }
    existingIds.add(id);
    const doc = {
      id, title: String(title).slice(0, 120),
      text: String(s.text || '').slice(0, 60000),
      order: ++maxOrder, beats: [],
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || s.createdAt || new Date().toISOString(),
      migratedFrom: 'forge-stories:' + (s.id || '?'),
    };
    if (DRY) {
      console.log(`[dry] would write forge-story/${id}  "${doc.title}"  (${doc.text.length} chars)`);
    } else {
      await dst.collection('forge-story').doc(id).set(doc);
      console.log(`wrote forge-story/${id}  "${doc.title}"  (${doc.text.length} chars)`);
    }
  }
  console.log(DRY ? 'dry run complete — nothing written' :
    'done. forge-stories left in place as a backup; delete it once the shelf looks right.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

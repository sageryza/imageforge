#!/usr/bin/env node
// drop-dedupe.js — one-time repair of the Dump's existing data, and the tool to
// re-run if anything ever doubles up again.
//
// Three things, in this order:
//
//   1. HASH every file that doesn't have one. No downloading: Cloud Storage
//      already stores each object's md5, so this reads metadata only.
//   2. DELETE exact duplicates inside the same album (the album being its slug,
//      across every dump — so the same album sent twice collapses into one).
//      The earliest copy of each photo survives. The same photo in two
//      DIFFERENT albums is left alone: that's real album membership, not a
//      mistake. Bytes are only removed when no surviving doc points at them.
//   3. RENUMBER each album's photoIndex 0..n-1 in arrival order, and seed the
//      bundle registry the server now allocates from. The old indexes were
//      assigned by a racy read, so they collided and left holes that looked
//      like missing files.
//
// Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) or GOOGLE_APPLICATION_CREDENTIALS.
//
//   node scripts/drop-dedupe.js --dry-run
//   node scripts/drop-dedupe.js

const admin = require('firebase-admin');

const COL = 'forge-drops';
const BUNDLES = 'forge-drop-bundles';
const META = '__meta';

const DRY = process.argv.includes('--dry-run');

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const cred = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(cred),
      storageBucket: `${cred.project_id}.firebasestorage.app`,
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
  } else {
    throw new Error('set FIREBASE_SERVICE_ACCOUNT (Deck Factory) or GOOGLE_APPLICATION_CREDENTIALS');
  }
}

const hex = (md5b64) => Buffer.from(md5b64, 'base64').toString('hex');

async function main() {
  init();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const snap = await db.collection(COL).get();
  const docs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  console.log(`${docs.length} files in ${COL}`);

  // ---- 1. hashes, from object metadata --------------------------------------
  const need = docs.filter((d) => !d.hash && d.storagePath);
  if (need.length) {
    console.log(`hashing ${need.length} files from Storage metadata…`);
    const [files] = await bucket.getFiles({ prefix: 'drops/' });
    const byPath = new Map(files.map((f) => [f.name, f.metadata && f.metadata.md5Hash]));
    let done = 0;
    let batch = db.batch();
    let n = 0;
    for (const d of need) {
      const md5 = byPath.get(d.storagePath);
      if (!md5) continue;                       // object gone; leave the doc alone
      d.hash = hex(md5);
      done++;
      if (DRY) continue;
      batch.update(d.ref, { hash: d.hash });
      if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (!DRY && n) await batch.commit();
    console.log(`  hashed ${done}${DRY ? ' (dry run — nothing written)' : ''}`);
  }

  // ---- 2. duplicates inside one album ---------------------------------------
  const groups = new Map();
  for (const d of docs) {
    if (!d.hash) continue;
    const key = (d.bundle || 'loose:' + d.id) + '|' + d.hash;
    (groups.get(key) || groups.set(key, []).get(key)).push(d);
  }
  const doomed = [];
  for (const [, v] of groups) {
    if (v.length < 2) continue;
    v.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id));
    doomed.push(...v.slice(1));                 // keep the first arrival
  }
  const byAlbum = {};
  doomed.forEach((d) => { byAlbum[d.bundle || 'loose'] = (byAlbum[d.bundle || 'loose'] || 0) + 1; });
  console.log(`\n${doomed.length} redundant copies to remove:`);
  Object.entries(byAlbum).sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));

  const survivors = new Set(docs.filter((d) => !doomed.includes(d)).map((d) => d.storagePath));
  let bytesFreed = 0;
  if (!DRY) {
    for (const d of doomed) {
      await d.ref.delete();
      // Old files still live at their per-session path, so two docs can share a
      // path only by pointing at the same object — check before removing bytes.
      if (d.storagePath && !survivors.has(d.storagePath)) {
        try { await bucket.file(d.storagePath).delete(); bytesFreed += d.bytes || 0; } catch { /* gone */ }
        if (d.posterPath) { try { await bucket.file(d.posterPath).delete(); } catch { /* gone */ } }
      }
    }
    console.log(`  deleted ${doomed.length} docs, freed ~${(bytesFreed / 1e6).toFixed(0)} MB`);
  }

  // ---- 3. renumber + seed the registry --------------------------------------
  const live = docs.filter((d) => !doomed.includes(d));
  const albums = new Map();
  for (const d of live) {
    if (!d.bundle) continue;
    const e = albums.get(d.bundle) || {
      bundle: d.bundle, bundleName: d.bundleName || d.bundle, session: d.session, seq: 0, files: [],
    };
    if (d.session < e.session) e.session = d.session;
    if ((Number(d.seq) || 0) > e.seq) e.seq = Number(d.seq) || 0;
    e.files.push(d);
    albums.set(d.bundle, e);
  }
  // An album's number used to be handed out per dump, so two albums from
  // different dumps could both be "3". Now that a bundle spans dumps, the
  // number has to be unique across all of them — nothing has been labelled or
  // printed off these yet, so renumbering costs nothing.
  const ordered = [...albums.values()].sort((a, b) =>
    (a.session < b.session ? -1 : a.session > b.session ? 1 : 0)
    || a.seq - b.seq || a.bundle.localeCompare(b.bundle));
  ordered.forEach((e, i) => { e.seq = i + 1; });

  let renumbered = 0;
  let maxSeq = 0;
  let batch = db.batch();
  let n = 0;
  for (const e of ordered) {
    // Arrival order is the best signal left — the album's real order was lost
    // when the indexes collided. Uploads are queued in album order a few at a
    // time, so this is close, and it is at least stable and hole-free.
    e.files.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id));
    if (e.seq > maxSeq) maxSeq = e.seq;
    for (let i = 0; i < e.files.length; i++) {
      const d = e.files[i];
      const patch = {};
      if (d.photoIndex !== i) patch.photoIndex = i;
      if (d.session !== e.session) patch.session = e.session;   // re-dumps roll up with the album
      if ((Number(d.seq) || 0) !== e.seq) patch.seq = e.seq;
      if (!Object.keys(patch).length) continue;
      renumbered++;
      if (DRY) continue;
      batch.update(d.ref, patch);
      if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
    }
  }
  if (!DRY && n) await batch.commit();
  console.log(`\nrenumbered ${renumbered} files across ${albums.size} albums`);

  if (!DRY) {
    let b2 = db.batch();
    let m = 0;
    for (const e of ordered) {
      b2.set(db.collection(BUNDLES).doc(e.bundle), {
        bundle: e.bundle, bundleName: e.bundleName, session: e.session,
        seq: e.seq, files: e.files.length,
      });
      if (++m >= 400) { await b2.commit(); b2 = db.batch(); m = 0; }
    }
    if (m) await b2.commit();
    await db.collection(BUNDLES).doc(META).set({ maxSeq });
    console.log(`registry seeded: ${albums.size} albums, maxSeq ${maxSeq}`);
  }

  console.log(`\n${live.length} files remain${DRY ? ' (dry run — nothing changed)' : ''}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

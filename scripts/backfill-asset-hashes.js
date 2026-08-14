#!/usr/bin/env node
/*
 * backfill-asset-hashes.js — give every OLD Assets record its content hash, so
 * duplicates already sitting in Sophie's tabs collapse the way new ones now do.
 *
 * WHY. A picture reaches a chat's Assets tab by more than one road: the storage
 * object where it was generated, and the `claude-deliveries/<random>` copy the
 * server makes when the same image is ALSO sent as a chat file. The tab used to
 * join those copies by FILENAME, which the random name defeats — so Sophie saw
 * her labeled portrait beside an unlabeled twin. `GET /api/gallery/assets` now
 * joins on CONTENT too (asset-union.js), and POST /api/gallery records each new
 * record's md5 at filing time. This script is the other half: the md5 for
 * everything filed BEFORE that, which is what makes the existing duplicates
 * merge instead of only the future ones.
 *
 * NO DOWNLOADS. Cloud Storage stores every object's md5 and hands it back in
 * the object's metadata — the same technique scripts/drop-dedupe.js used to
 * hash a 2,717-file library for nothing. Bytes are never fetched.
 *
 * IT ONLY EVER ADDS `md5`. No record is deleted, no url is rewritten, no label
 * or prompt is touched — so a wrong run costs nothing but the metadata calls,
 * and re-running is free (records that already have one are skipped).
 *
 * USAGE
 *   node scripts/backfill-asset-hashes.js --dry-run        # count first, write nothing
 *   node scripts/backfill-asset-hashes.js                  # every chat
 *   node scripts/backfill-asset-hashes.js --chat <slug>    # one chat
 *   node scripts/backfill-asset-hashes.js --limit 500      # stop after N records
 *
 * ENV: FIREBASE_SERVICE_ACCOUNT (Deck Factory — holds forge-chat-assets and its
 * own bucket) and STORY_FIREBASE_SERVICE_ACCOUNT (membry — where the iOS
 * gallery's copies live). Either alone works; objects in the project whose
 * credential is missing are simply reported unreachable.
 */
'use strict';

const admin = require('firebase-admin');
const { storageRef, readMd5 } = require('../asset-hash');

const COL = 'forge-chat-assets';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DRY = flag('--dry-run');
const ONE = val('--chat');
const LIMIT = Number(val('--limit') || 0) || Infinity;

/* ── the two apps, each with the bucket only its own credential can read ── */
let deckApp = null;
let storyApp = null;

function initApps() {
  const deck = process.env.FIREBASE_SERVICE_ACCOUNT;
  const story = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (deck) {
    const cred = JSON.parse(deck);
    deckApp = admin.initializeApp({
      credential: admin.credential.cert(cred),
      storageBucket: `${cred.project_id}.firebasestorage.app`,
    }, 'deck');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    deckApp = admin.initializeApp({}, 'deck');
  }
  if (story) {
    const cred = JSON.parse(story);
    storyApp = admin.initializeApp({
      credential: admin.credential.cert(cred),
      storageBucket: `${cred.project_id}.firebasestorage.app`,
    }, 'story');
  }
  if (!deckApp) {
    throw new Error('set FIREBASE_SERVICE_ACCOUNT (Deck Factory) or GOOGLE_APPLICATION_CREDENTIALS'
      + ' — forge-chat-assets lives there');
  }
}

/** The url names its bucket; the bucket picks the credential. Same rule as the server. */
function bucketNamed(name) {
  const apps = [deckApp, storyApp].filter(Boolean);
  for (const app of apps) {
    try { const b = app.storage().bucket(); if (b && b.name === name) return b; } catch (e) { /* none */ }
  }
  const project = String(name).split('.')[0];
  for (const app of apps) {
    try {
      const b = app.storage().bucket();
      if (b && String(b.name).split('.')[0] === project) return app.storage().bucket(name);
    } catch (e) { /* not this app's project */ }
  }
  return null;
}

async function main() {
  initApps();
  const db = deckApp.firestore();
  const cache = new Map();

  let q = db.collection(COL);
  if (ONE) q = q.where('chat', '==', String(ONE).slice(0, 60));
  const snap = await q.get();
  console.log(`${snap.size} records in ${COL}${ONE ? ` for chat "${ONE}"` : ''}`
    + `${DRY ? '  (dry run — nothing will be written)' : ''}`);

  // Per chat, so the report says whose tab is about to get tidier.
  const stats = new Map();
  const bump = (chat, key) => {
    const s = stats.get(chat) || { have: 0, hashed: 0, unreachable: 0, external: 0 };
    s[key]++; stats.set(chat, s);
  };

  let batch = db.batch();
  let pending = 0;
  let looked = 0;

  for (const doc of snap.docs) {
    const a = doc.data() || {};
    const chat = a.chat || '(no chat)';
    if (a.md5) { bump(chat, 'have'); continue; }
    const url = String(a.url || '');
    if (!storageRef(url)) { bump(chat, 'external'); continue; }   // not a Storage object at all
    if (looked >= LIMIT) break;
    looked++;
    const md5 = await readMd5(url, bucketNamed, { cache, timeoutMs: 15000 });
    if (!md5) { bump(chat, 'unreachable'); continue; }
    bump(chat, 'hashed');
    if (DRY) continue;
    batch.update(doc.ref, { md5 });
    // Firestore caps a batch at 500 writes.
    if (++pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
  }
  if (!DRY && pending) await batch.commit();

  const rows = Array.from(stats.entries()).sort((x, y) => y[1].hashed - x[1].hashed);
  console.log('');
  let tot = { have: 0, hashed: 0, unreachable: 0, external: 0 };
  for (const [chat, s] of rows) {
    tot = {
      have: tot.have + s.have, hashed: tot.hashed + s.hashed,
      unreachable: tot.unreachable + s.unreachable, external: tot.external + s.external,
    };
    if (!s.hashed && !s.unreachable) continue;              // nothing changed for this chat
    const bits = [`${s.hashed} hashed`];
    if (s.unreachable) bits.push(`${s.unreachable} object(s) unreachable`);
    if (s.have) bits.push(`${s.have} already had one`);
    console.log(`  ${chat} — ${bits.join(', ')}`);
  }
  console.log(`\n  ${tot.hashed} record(s) ${DRY ? 'would gain' : 'gained'} an md5`
    + ` · ${tot.have} already had one`
    + ` · ${tot.unreachable} unreachable (deleted object, or a bucket this credential can't read)`
    + ` · ${tot.external} not Firebase Storage urls`);
  if (DRY) console.log('  dry run — nothing was written.');
  console.log('');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });

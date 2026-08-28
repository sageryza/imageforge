#!/usr/bin/env node
// Move Playground runs to the TOP of their gallery by re-dating them.
//
// Sophie, 2026-08-27: "put the creepy guy images old and new every version at
// the top of panels - alter their date or copy" — the Playground's feed (and
// the panels tab's own gallery) is ordered by `createdAt` desc, so a set of
// runs she wants to look at as a group is only reachable by scrolling past
// everything newer. Re-dating is the cheap, reversible half of her two
// options; copying would double the records and the tiles.
//
// THE ORIGINAL DATE IS NEVER LOST — it moves to `createdAtWas` on the first
// bump (and is never overwritten by a second one), so `--undo` puts every run
// back exactly where it was. A run that already carries one is being re-bumped,
// not re-stamped.
//
// Dry by default (the /wrapup/trim + asset-cleanup pattern); `--go` writes.
//
//   node scripts/playground-bump.js --ids a,b,c            # dry run
//   node scripts/playground-bump.js --ids a,b,c --go       # write
//   node scripts/playground-bump.js --ids a,b,c --undo --go
//
// Ids are listed TOP FIRST: the first id gets the newest stamp, and each one
// after it is `--gap` seconds older, so the order she typed is the order she
// sees. `--at <ISO|ms>` sets where the top of the block lands (default: now).
'use strict';

const admin = require('firebase-admin');

const COLL = 'forge-promptlab';

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : dflt;
}
const has = (name) => process.argv.includes('--' + name);

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT missing (the deckfactory service account)');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

async function main() {
  const ids = String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) {
    console.error('usage: playground-bump.js --ids <id,id,…, top first> [--at <ISO>] [--gap 60] [--undo] [--go]');
    process.exit(1);
  }
  const go = has('go');
  const undo = has('undo');
  const gap = Number(arg('gap', 60)) * 1000;
  const atRaw = arg('at', '');
  const top = atRaw ? (/^\d+$/.test(atRaw) ? Number(atRaw) : Date.parse(atRaw)) : Date.now();
  if (!Number.isFinite(top)) throw new Error('--at could not be read as a date');

  initAdmin();
  const db = admin.firestore();

  const rows = [];
  for (let i = 0; i < ids.length; i++) {
    const ref = db.collection(COLL).doc(ids[i]);
    const snap = await ref.get();
    if (!snap.exists) { rows.push({ id: ids[i], skip: 'no such run' }); continue; }
    const d = snap.data();
    const was = d.createdAtWas?.toMillis?.() || null;
    const now = d.createdAt?.toMillis?.() || null;
    if (undo) {
      if (!was) { rows.push({ id: ids[i], from: now, skip: 'never bumped' }); continue; }
      rows.push({ id: ids[i], from: now, to: was, undo: true, ref });
    } else {
      rows.push({ id: ids[i], from: now, to: top - i * gap, keepWas: was == null ? now : was, ref });
    }
  }

  for (const r of rows) {
    const line = [
      r.id.padEnd(28),
      r.from ? new Date(r.from).toISOString().slice(0, 16) : '—',
      '->',
      r.to ? new Date(r.to).toISOString().slice(0, 16) : '—',
      r.skip ? '(skipped: ' + r.skip + ')' : '',
    ].join(' ');
    console.log(line);
  }

  const writes = rows.filter(r => !r.skip);
  if (!go) {
    console.log(`\nDRY RUN — ${writes.length} run(s) would move. Re-run with --go to write.`);
    return;
  }
  for (const r of writes) {
    const patch = { createdAt: admin.firestore.Timestamp.fromMillis(r.to) };
    if (r.undo) patch.createdAtWas = admin.firestore.FieldValue.delete();
    else patch.createdAtWas = admin.firestore.Timestamp.fromMillis(r.keepWas);
    await r.ref.set(patch, { merge: true });
  }
  console.log(`\nWrote ${writes.length} run(s).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * Delete `<wake …>` system envelopes that a STALE hook lifted into the feed as
 * if Sophie had written them (found live 2026-08-13, six of them across three
 * chats).
 *
 * The cause is distribution, not logic: the hook's message filter drops
 * `<task-notification>` / `<github-webhook-activity>` / `[SYSTEM NOTIFICATION]`
 * and the CURRENT repo copy also drops `<wake`, but a container still holding a
 * pre-`<wake>` hook keeps posting them. Healing the hook stops new ones; this
 * removes the ones already in her app.
 *
 *   node scripts/purge-wake-messages.js            # scan, write nothing
 *   node scripts/purge-wake-messages.js --apply    # delete what it found
 *   node scripts/purge-wake-messages.js --chat <slug>
 *
 * Deliberately NARROW: it only ever matches a message whose text STARTS with
 * `<wake` and that is filed `from:'sophie'`. A real message of hers can quote
 * one mid-text and is never touched. Needs FIREBASE_SERVICE_ACCOUNT
 * (deckfactory) in the environment.
 */
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const only = (() => { const i = argv.indexOf('--chat'); return i > -1 ? argv[i + 1] : ''; })();

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

// Her real messages are short; a leaked envelope opens with the tag on line one.
const isWake = (t) => /^\s*<wake\b/.test(String(t || ''));

(async () => {
  // ONE equality filter and no orderBy — the house rule everywhere in this
  // codebase, so Firestore needs no composite index (adding `.orderBy` here
  // fails with FAILED_PRECONDITION). Her side of the feed is ~1.6k docs; a
  // one-off repair can read them all and sort in memory.
  let q = db.collection('forge-chat-feed').where('from', '==', 'sophie');
  if (only) q = q.where('chat', '==', only);
  const snap = await q.get();

  const hits = snap.docs.filter((d) => isWake(d.data().text));
  const byChat = {};
  for (const d of hits) (byChat[d.data().chat] = byChat[d.data().chat] || []).push(d.data().created);

  console.log(`scanned ${snap.size} of her messages · ${hits.length} leaked envelopes`);
  for (const [chat, times] of Object.entries(byChat)) {
    console.log(`  ${chat} — ${times.length}`);
    times.sort().forEach((t) => console.log(`      ${t}`));
  }
  if (!hits.length) return;
  if (!APPLY) return console.log('\nscan only — pass --apply to delete these');

  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < hits.length; i += 400) {
    const b = db.batch();
    hits.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  console.log(`\ndeleted ${hits.length}`);
})().catch((e) => { console.error(e.message); process.exit(1); });

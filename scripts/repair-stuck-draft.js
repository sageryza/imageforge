#!/usr/bin/env node
/**
 * Repair a chat's ORPHANED live drafts — the "still writing…" messages that
 * never got finalized (Aug 2026).
 *
 *   node scripts/repair-stuck-draft.js --chat <slug> [--apply]
 *
 * WHY THEY HAPPEN. A live draft and its final post upsert onto the same doc
 * only when they carry the same turn key — the doc id is
 * sha1(session|turn), and `turn` is the transcript uuid of the user message
 * that STARTED the turn. A long turn that takes a background-task
 * notification or a GitHub wake event mid-flight gets a NEW user message in
 * its transcript, so the turn key moves and the final post lands on a fresh
 * doc. The draft is left behind forever with working:true, and the app keeps
 * rendering it as "still writing…" next to the finished reply.
 *
 * WHAT THIS DOES. For each orphan (working:true with a NEWER finished message
 * in the same chat) it folds the draft's opening prose onto the FRONT of that
 * finished message — which is where it belongs, since the draft holds the
 * turn's first line and the final post does not — fixes the working-fold
 * boundaries to match, and deletes the orphan.
 *
 * Reads/writes forge-chat-feed directly with the deckfactory Admin SDK, so it
 * works even where the API is blocked. DRY BY DEFAULT — pass --apply to write.
 */
const admin = require('firebase-admin');

const MSGS = 'forge-chat-feed';
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const CHAT = arg('--chat');
const APPLY = process.argv.includes('--apply');
if (!CHAT) { console.error('--chat <slug> required'); process.exit(1); }

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT missing (deckfactory)'); process.exit(1); }
const sa = JSON.parse(raw);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : new Date(v || 0).getTime());

(async () => {
  const snap = await db.collection(MSGS).where('chat', '==', CHAT).get();
  const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.from !== 'sophie')
    .sort((a, b) => ms(a.postedAt) - ms(b.postedAt));

  const orphans = msgs.filter((m) => m.working
    && msgs.some((o) => !o.working && ms(o.postedAt) > ms(m.postedAt)));

  if (!orphans.length) { console.log(`no orphaned drafts in "${CHAT}"`); return; }
  console.log(`${orphans.length} orphaned draft(s) in "${CHAT}"${APPLY ? '' : '  (dry run)'}\n`);

  for (const o of orphans) {
    // The finished message this draft belongs in front of: the next
    // non-working one after it.
    const host = msgs.find((m) => !m.working && ms(m.postedAt) > ms(o.postedAt));
    const opener = String(o.text || '').trim();
    const joined = `${opener}\n\n${host.text || ''}`;
    const shift = opener.length + 2;

    console.log(`draft   ${o.id}  ${opener.length} chars`);
    console.log(`  → into ${host.id}  (${(host.text || '').length} → ${joined.length} chars)`);
    console.log(`  head ${host.head} → ${shift}   tail ${host.tail} → ${(host.tail || 0) + shift}`);
    console.log(`  opener: ${JSON.stringify(opener.slice(0, 90))}\n`);

    if (!APPLY) continue;
    await db.collection(MSGS).doc(host.id).update({
      text: joined,
      head: shift,
      tail: (host.tail || 0) + shift,
    });
    await db.collection(MSGS).doc(o.id).delete();
    console.log(`  applied\n`);
  }

  if (!APPLY) console.log('nothing written — re-run with --apply');
})().catch((e) => { console.error(e); process.exit(1); });

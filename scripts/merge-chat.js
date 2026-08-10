#!/usr/bin/env node
// Merge a mis-filed span of one chat into another — the repair tool for slug
// collisions and orphaned threads (built for the "Imprint" incident: a
// placeholder session claim orphaned the thread, forking its real session's
// posts into a new chat while another session's posts sat interleaved in the
// original).
//
// What it can do, each step optional:
//   --from <slug> --into <slug>       move feed messages (forge-chat-feed)
//   --since <ISO> --until <ISO>       bound the move by `created` (inclusive)
//   --assets                          also move forge-chat-assets docs in the
//                                     same window, re-keying their vote docs
//                                     (forge-asset-votes ids hash chat|url)
//   --tombstone                       leave { movedTo: <into> } on the source
//                                     registry doc so stale posts addressed to
//                                     the old slug land in the target (the
//                                     server follows it), and clear its
//                                     sessionId
//   --bind <sessionId> --chat <slug>  bind a chat to its REAL session id and
//                                     clear that id off every other registry
//                                     doc (session-first resolution then sends
//                                     the session's posts there). Use the real
//                                     id — a placeholder orphans the thread.
//   --delete-registry <slug>          remove a leftover fork's registry doc
//   --dry-run                         print the plan, write nothing
//
// Needs FIREBASE_SERVICE_ACCOUNT (deckfactory) in the environment.
//
// The Imprint repair (2026-08-02) was:
//   node scripts/merge-chat.js --from deck-factory-story-room \
//     --into deck-factory-story-room-015rj9 \
//     --since 2026-08-01T19:50:00Z --until 2026-08-01T21:47:00Z --assets
//   node scripts/merge-chat.js --from deck-factory-story-room-01trzd \
//     --into deck-factory-story-room --assets --tombstone
//   node scripts/merge-chat.js --chat deck-factory-story-room \
//     --bind 01TrZDCSokDmdvHvAykycDun

const admin = require('firebase-admin');

const argv = process.argv.slice(2);
function flag(name) { return argv.includes('--' + name); }
function val(name) {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
}

const FROM = val('from');
const INTO = val('into');
const SINCE = val('since');
const UNTIL = val('until');
const BIND = val('bind');
const CHAT = val('chat');
const DELREG = val('delete-registry');
const DRY = flag('dry-run');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('FIREBASE_SERVICE_ACCOUNT (deckfactory) is required');
  process.exit(1);
}
if (!FROM && !BIND && !DELREG) {
  console.error('nothing to do — pass --from/--into, --bind/--chat, or --delete-registry');
  process.exit(1);
}
if (FROM && !INTO) { console.error('--from needs --into'); process.exit(1); }
if (BIND && !CHAT) { console.error('--bind needs --chat'); process.exit(1); }

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();
const sha1 = (s) => require('crypto').createHash('sha1').update(s).digest('hex');
const inWindow = (c) => (!SINCE || c >= SINCE) && (!UNTIL || c <= UNTIL);

(async () => {
  if (FROM) {
    // ── feed messages ──
    const snap = await db.collection('forge-chat-feed').where('chat', '==', FROM).get();
    const move = snap.docs.filter((d) => inWindow(d.data().created || ''));
    console.log(`messages: ${move.length} of ${snap.size} in "${FROM}" move to "${INTO}"`);
    let newest = '';
    for (const d of move) {
      const c = d.data().created || '';
      if (c > newest) newest = c;
      console.log('  ', c, (d.data().from || 'claude').padEnd(6), (d.data().tldr || d.data().text || '').replace(/\s+/g, ' ').slice(0, 60));
      if (!DRY) await d.ref.update({ chat: INTO });
    }
    // keep the target's lastSeen honest so tile/search ordering holds
    if (!DRY && newest) {
      const reg = await db.collection('forge-chat-registry').doc(INTO).get();
      if (!reg.exists || (reg.data().lastSeen || '') < newest) {
        await reg.ref.set({ lastSeen: newest }, { merge: true });
      }
    }

    // ── assets (+ re-keyed votes) ──
    if (flag('assets')) {
      const asnap = await db.collection('forge-chat-assets').where('chat', '==', FROM).get();
      const amove = asnap.docs.filter((d) => inWindow(d.data().created || ''));
      console.log(`assets: ${amove.length} of ${asnap.size} in "${FROM}" move to "${INTO}"`);
      for (const d of amove) {
        const url = d.data().url || '';
        console.log('  ', d.data().created || '?', (d.data().description || url).slice(0, 60));
        if (DRY) continue;
        await d.ref.update({ chat: INTO });
        // a ♥/note on this image lives under sha1(chat|url) — carry it along
        const old = await db.collection('forge-asset-votes').doc(sha1(FROM + '|' + url)).get();
        if (old.exists) {
          await db.collection('forge-asset-votes').doc(sha1(INTO + '|' + url))
            .set({ ...old.data(), chat: INTO }, { merge: true });
          await old.ref.delete();
        }
      }
    }

    if (flag('tombstone')) {
      console.log(`tombstone: "${FROM}" → movedTo "${INTO}" (sessionId cleared)`);
      if (!DRY) {
        await db.collection('forge-chat-registry').doc(FROM).set({
          movedTo: INTO,
          sessionId: admin.firestore.FieldValue.delete(),
        }, { merge: true });
      }
    }
  }

  if (BIND) {
    const dupes = await db.collection('forge-chat-registry').where('sessionId', '==', BIND).get();
    for (const d of dupes.docs) {
      if (d.id === CHAT) continue;
      console.log(`unbind: "${d.id}" no longer owns session ${BIND}`);
      if (!DRY) await d.ref.set({ sessionId: admin.firestore.FieldValue.delete() }, { merge: true });
    }
    console.log(`bind: "${CHAT}" ← session ${BIND}`);
    if (!DRY) {
      await db.collection('forge-chat-registry').doc(CHAT)
        .set({ sessionId: BIND }, { merge: true });
    }
  }

  if (DELREG) {
    console.log(`delete registry doc: "${DELREG}"`);
    if (!DRY) await db.collection('forge-chat-registry').doc(DELREG).delete();
  }

  console.log(DRY ? 'dry run — nothing written' : 'done');
})().catch((e) => { console.error(e); process.exit(1); });

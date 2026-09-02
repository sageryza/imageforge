#!/usr/bin/env node
// Stamp `startedAt` on every chat's registry doc — the OLDEST `created` on any
// message of the chat, hers included. The work log (/worklog) lists chats by
// the day they BEGAN, and until 2026-09-02 nothing on the registry carried
// that: `lastSeen` is rewritten on every post (measured on twelve real threads:
// it matched the newest message on all twelve). The server stamps it on a
// chat's first post from now on; this fills in everything from before.
//
// Same rules as POST /api/chatfeed/startedat-backfill, run from a container
// with the Deck Factory service account (FIREBASE_SERVICE_ACCOUNT) so it needs
// no deploy. DRY BY DEFAULT — `--go` writes. A stamp only ever moves BACKWARDS.
//
//   node scripts/backfill-started-at.js            # report only
//   node scripts/backfill-started-at.js --go       # write
//   node scripts/backfill-started-at.js --chat x   # one chat
'use strict';
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const GO = args.includes('--go');
const ONLY = (() => { const i = args.indexOf('--chat'); return i >= 0 ? String(args[i + 1] || '') : ''; })();

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT (Deck Factory) is not set'); process.exit(2); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
const db = admin.firestore();
const REG = 'forge-chat-registry';
const MSGS = 'forge-chat-feed';

(async () => {
  const snap = await db.collection(REG).get();
  const todo = [];
  snap.docs.forEach((d) => {
    if (d.id === '__settings') return;
    if (ONLY && d.id !== ONLY) return;
    const r = d.data() || {};
    if (r.movedTo) return;
    todo.push({ chat: d.id, had: r.startedAt || '' });
  });
  let changed = 0, noMsgs = 0, kept = 0;
  const sample = [];
  for (const t of todo) {
    let oldest = '';
    try {
      const ms = await db.collection(MSGS).where('chat', '==', t.chat).select('created').get();
      ms.docs.forEach((m) => {
        const at = (m.data() || {}).created || '';
        if (at && (!oldest || at < oldest)) oldest = at;
      });
    } catch (e) { console.warn('skip', t.chat, e.message); continue; }
    if (!oldest) { noMsgs++; continue; }
    if (t.had && t.had <= oldest) { kept++; continue; }
    changed++;
    if (sample.length < 12) sample.push(`${t.chat}: ${t.had || '—'} → ${oldest}`);
    if (GO) await db.collection(REG).doc(t.chat).set({ startedAt: oldest }, { merge: true });
  }
  console.log(`${GO ? 'wrote' : 'would write'} ${changed} of ${todo.length} chats · ${kept} already stamped · ${noMsgs} with no messages`);
  sample.forEach((s) => console.log('  ' + s));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

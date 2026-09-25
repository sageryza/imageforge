#!/usr/bin/env node
'use strict';
// Stamp `from: 'sophie' | 'claude'` on every Dump file made before the field
// existed (2026-09-25, Sophie: "hide every single thing a chat has ever
// uploaded or make a new tab. make it like 'from claude' and from me").
//
// Judged album by album — the rule and the vote are dropbox.js's own
// (`guessFrom`, `albumFrom`), so the script and the /dump page can never
// disagree about a file. DRY BY DEFAULT: prints the plan and writes nothing.
//
//   node scripts/dump-from-backfill.js            # the plan
//   node scripts/dump-from-backfill.js --go       # write `from`, nothing else
//   node scripts/dump-from-backfill.js --live     # ask the live server instead
//                                                 # (POST /api/drop/from-backfill)
//
// Needs FIREBASE_SERVICE_ACCOUNT (the Deck Factory key) unless --live. A doc
// that already carries `from` is never touched, so re-running is safe.
const admin = require('firebase-admin');

async function main() {
  const go = process.argv.includes('--go');
  const live = process.argv.includes('--live');
  let out;
  if (live) {
    const base = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
    const r = await fetch(`${base}/api/drop/from-backfill`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dry: !go }),
    });
    out = await r.json();
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set (or use --live)');
    const cred = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(cred), projectId: cred.project_id });
    out = await require('../dropbox.js').backfillFrom({ dry: !go });
  }
  const { albums, ...rest } = out;
  console.log(JSON.stringify(rest));
  for (const a of albums || []) console.log(`  ${a.from.padEnd(6)} ${String(a.files).padStart(4)}  ${a.name || a.key}`);
  console.log(out.dry ? '(dry — nothing written; --go to write)' : `wrote ${out.wrote}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });

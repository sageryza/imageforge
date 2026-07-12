// gdrive-move.js — execute a Google Drive cleanup plan in one command.
//
// Reads a JSON plan file — an array of operations — and runs each against the
// owner's Drive by reusing the helpers in gdrive.js (the same OAuth refresh-token
// logic + Firestore/file token store the server uses). This is the "one command"
// that performs the actual moves/renames/trashes after a plan has been reviewed.
//
// Plan shape (array):
//   [
//     { "id": "abc", "addParents": "folderId", "removeParents": "root" },  // move
//     { "id": "def", "name": "Renamed file.pdf" },                          // rename
//     { "id": "ghi", "addParents": ["f1"], "name": "New name", ... },       // move + rename
//     { "id": "jkl", "trash": true }                                        // trash (recoverable)
//   ]
// addParents/removeParents accept an id, an array of ids, or a comma string.
//
// Auth: the module loads the stored refresh token from Firestore (when
// FIREBASE_SERVICE_ACCOUNT is set) or the gitignored .gdrive-tokens.json for
// local dev — authorize once at <app>/api/gdrive/connect first.
//
// Usage:
//   node scripts/gdrive-move.js plan.json          # execute
//   node scripts/gdrive-move.js plan.json --dry-run # print what would happen
//
// Optional: set FIREBASE_SERVICE_ACCOUNT to read tokens from Firestore. Nothing
// secret is ever printed.

const fs = require('fs');
const path = require('path');

function die(msg) { console.error(msg); process.exit(1); }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const planPath = args.find(a => !a.startsWith('--'));
if (!planPath) die('Usage: node scripts/gdrive-move.js <plan.json> [--dry-run]');

let plan;
try {
  plan = JSON.parse(fs.readFileSync(path.resolve(planPath), 'utf8'));
} catch (e) {
  die(`Could not read/parse plan file "${planPath}": ${e.message}`);
}
if (!Array.isArray(plan)) die('Plan must be a JSON array of { id, addParents?, removeParents?, name?, trash? }.');

// Best-effort Firebase init so gdrive.js can read the token doc from Firestore.
// Without it, gdrive.js falls back to the local .gdrive-tokens.json file.
try {
  const admin = require('firebase-admin');
  if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (sa.project_id) admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
} catch (e) {
  console.warn('gdrive-move: Firebase not initialized (' + e.message + ') — using local token file if present.');
}

const gdrive = require('../gdrive');

// Describe an op for the printed summary (no secrets, just ids/names).
function describe(op) {
  const bits = [];
  if (op.trash) bits.push('trash');
  if (op.addParents) bits.push(`add→${[].concat(op.addParents).join(',')}`);
  if (op.removeParents) bits.push(`remove→${[].concat(op.removeParents).join(',')}`);
  if (op.name) bits.push(`rename→"${op.name}"`);
  return bits.join(' ') || '(no-op)';
}

async function runOp(op) {
  const steps = [];
  if (op.trash) {
    const r = await gdrive.trashFile(op.id);
    steps.push({ step: 'trash', ok: r.ok, status: r.status, ...(r.ok ? {} : { error: r.body }) });
    return steps; // trashing supersedes any move/rename
  }
  if (op.addParents || op.removeParents) {
    const r = await gdrive.moveFile({ id: op.id, addParents: op.addParents, removeParents: op.removeParents });
    steps.push({ step: 'move', ok: r.ok, status: r.status, ...(r.ok ? {} : { error: r.body }) });
  }
  if (op.name) {
    const r = await gdrive.renameFile({ id: op.id, name: op.name });
    steps.push({ step: 'rename', ok: r.ok, status: r.status, ...(r.ok ? {} : { error: r.body }) });
  }
  if (!steps.length) steps.push({ step: 'noop', ok: true });
  return steps;
}

(async () => {
  if (!gdrive.configured()) {
    console.warn('Note: GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET not set in this environment — refresh will fail unless they are configured.');
  }
  console.log(`Plan: ${plan.length} operation(s)${dryRun ? ' [DRY RUN]' : ''}`);

  if (dryRun) {
    plan.forEach((op, i) => console.log(`  ${i + 1}. ${op.id || '(no id)'} — ${describe(op)}`));
    console.log('Dry run — nothing was changed.');
    process.exit(0);
  }

  let okCount = 0, failCount = 0;
  for (let i = 0; i < plan.length; i++) {
    const op = plan[i];
    const label = `${i + 1}/${plan.length} ${op.id || '(no id)'}`;
    if (!op.id) { console.log(`  ✗ ${label} — missing id, skipped`); failCount++; continue; }
    try {
      const steps = await runOp(op);
      const allOk = steps.every(s => s.ok);
      if (allOk) { okCount++; console.log(`  ✓ ${label} — ${describe(op)}`); }
      else {
        failCount++;
        const failed = steps.filter(s => !s.ok).map(s => `${s.step}(${s.status}): ${JSON.stringify(s.error)}`).join('; ');
        console.log(`  ✗ ${label} — ${failed}`);
      }
    } catch (err) {
      failCount++;
      console.log(`  ✗ ${label} — ${err.message}`);
      if (err.message === 'not_connected') {
        die('Not connected to Google Drive. Authorize once at <app-url>/api/gdrive/connect, then retry.');
      }
    }
  }

  console.log(`Done. ${okCount} ok, ${failCount} failed.`);
  process.exit(failCount ? 1 : 0);
})().catch(err => die('Fatal: ' + err.message));

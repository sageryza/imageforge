// Push new Voice Memos recordings into the archive — NO keys needed.
//
// Everything that needs a credential happens on the server: this script only
// reads the Mac's Voice Memos database and POSTs the audio of recordings that
// aren't archived yet. Nothing to install, nothing to paste, safe to re-run.
//
//     node push-memos.mjs
//
// Flags:
//     --dry-run       list what's new, send nothing
//     --limit 5       only send the first 5 (test run)
//     --db <path>     a different CloudRecordings.db
//     --base <url>    a different server
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

// The audio fingerprint, from the SAME module the server dedupes with — a
// hand-copied second implementation would drift, and a fingerprint that
// drifts stops matching silently. Optional on purpose: if this file is run
// from outside the repo the push still works, it just can't heal dates.
let audioHash = null;
try {
  audioHash = createRequire(import.meta.url)('../memo-fingerprint.js').audioHash;
} catch { /* healing pass is skipped below */ }

const HOME = os.homedir();
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf('--' + n); return i < 0 ? d : (argv[i + 1] || true); };
const DRY = argv.includes('--dry-run');
const LIMIT = flag('limit') ? Number(flag('limit')) : Infinity;
const BASE = String(flag('base', process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');
const DB = flag('db') || path.join(HOME, 'Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/CloudRecordings.db');

const p2 = (n) => String(n).padStart(2, '0');
// The recording's local wall-clock stamp — the archive's join key.
const stampOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;

function readVoiceMemos() {
  if (!fs.existsSync(DB)) {
    console.error(`\n❌ No Voice Memos database at:\n   ${DB}\n   Open the Voice Memos app once, then run this again.\n`);
    process.exit(1);
  }
  // Snapshot it so the live database is never locked while Voice Memos is open.
  const snap = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-'));
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.copyFileSync(DB + ext, path.join(snap, 'db' + ext)); } catch {}
  }
  const sql = "SELECT COALESCE(ZDATE,''),COALESCE(ZPATH,''),COALESCE(ZCUSTOMLABEL,''),COALESCE(ZDURATION,0) FROM ZCLOUDRECORDING ORDER BY ZDATE;";
  let rows;
  try {
    rows = execFileSync('sqlite3', ['-separator', '\x1f', path.join(snap, 'db'), sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    console.error('\n❌ Could not read the Voice Memos database: ' + err.message + '\n');
    process.exit(1);
  } finally { fs.rmSync(snap, { recursive: true, force: true }); }

  const recDir = path.dirname(DB);
  return rows.split('\n').filter(Boolean).map(line => {
    const [zdate, zpath, label, dur] = line.split('\x1f');
    // Core Data counts seconds from 2001-01-01.
    const when = zdate ? new Date((Number(zdate) + 978307200) * 1000) : null;
    const src = zpath ? path.join(recDir, zpath) : null;
    return {
      when, title: label || 'Recording', dur: Math.round(Number(dur) || 0),
      src, downloaded: !!(src && fs.existsSync(src)),
    };
  }).filter(r => r.when);
}

console.log('\nArchive: ' + BASE + '/api/memos\n');
const statusRes = await fetch(BASE + '/api/memos/status');
if (!statusRes.ok) { console.error(`❌ Server said ${statusRes.status}. Is the app awake? Open ${BASE} and try again.`); process.exit(1); }
const status = await statusRes.json();
if (!status.ok) { console.error('❌ ' + (status.error || 'the archive is not reachable')); process.exit(1); }
// Skip on stamp AND duration, never the stamp alone: Sophie records several
// short thoughts back to back, and a recording made in the same minute as one
// already archived would be filtered out HERE and never even reach the server
// (it refused a real 28-minute recording that way). Duration comes free from
// the Voice Memos database. `keys` is the server's list; older servers only
// answer `stamps`, so fall back to the old behaviour rather than re-sending
// the whole archive.
const keyOf = (r) => `${stampOf(r.when)}|${Math.round(r.dur)}`;
const byKey = Array.isArray(status.keys);
const known = new Set(byKey ? status.keys : (status.stamps || []));
const seen = (r) => known.has(byKey ? keyOf(r) : stampOf(r.when));
console.log(`Already archived: ${status.count} recordings, newest ${status.newest}.`);

const all = readVoiceMemos();
const missing = all.filter(r => !r.downloaded);
const fresh = all.filter(r => r.downloaded && !seen(r));
console.log(`On this Mac: ${all.length} recordings.`);
console.log(`New: ${fresh.length}\n`);

if (missing.length) {
  console.log(`⚠️  ${missing.length} recording(s) aren't downloaded to this Mac, so they can't be read yet:`);
  missing.slice(0, 10).forEach(r => console.log(`     ${stampOf(r.when)}  ${r.title}`));
  if (missing.length > 10) console.log(`     …and ${missing.length - 10} more`);
  console.log('   Open Voice Memos and scroll through them so they download, then run this again.\n');
}
// Before the early exit below: healing is independent of pushing, and the
// usual run has nothing new to send. Putting this after that exit meant it
// only ever ran on the rare push — the opposite of what it is for.
await healDates(all);

if (!fresh.length) { console.log('✅ Nothing new — the archive is already up to date.\n'); process.exit(0); }

const batch = fresh.slice(0, LIMIT);
const mins = batch.reduce((a, r) => a + r.dur / 60, 0);
console.log(`Sending ${batch.length} recording(s), ${mins.toFixed(0)} minutes total.`);
batch.slice(0, 20).forEach(r => console.log(`     ${stampOf(r.when)}  ${String(Math.round(r.dur / 60)).padStart(3)}min  ${r.title}`));
if (batch.length > 20) console.log(`     …and ${batch.length - 20} more`);
if (DRY) { console.log('\n(dry run — nothing sent)\n'); process.exit(0); }

console.log('\nWorking… (each one is transcribed and sorted on the server)\n');
const filed = [];
for (const [i, r] of batch.entries()) {
  const stamp = stampOf(r.when);
  const q = new URLSearchParams({ stamp, iso: r.when.toISOString(), title: r.title, dur: String(r.dur), ext: 'm4a' });
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/memos/ingest?${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/mp4' },
        body: fs.readFileSync(r.src),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        ok = true;
        if (j.skipped) console.log(`  ${i + 1}/${batch.length}  ${stamp}  already there`);
        else {
          filed.push(j.memo);
          console.log(`  ${i + 1}/${batch.length}  ${stamp}  [${j.memo.cat}]  ${j.memo.title || ''}`);
        }
      } else if (res.status === 429) {
        console.log(`  ${i + 1}/${batch.length}  ${stamp}  rate limited — waiting`);
        await new Promise(s => setTimeout(s, 60000));
      } else if (attempt === 3) {
        console.log(`  ${i + 1}/${batch.length}  ${stamp}  ✕ ${j.error || res.status}`);
      }
    } catch (err) {
      if (attempt === 3) console.log(`  ${i + 1}/${batch.length}  ${stamp}  ✕ ${err.message}`);
      else await new Promise(s => setTimeout(s, attempt * 2000));
    }
  }
}

// ── give the guessed dates their real ones ──────────────────────────────────
//
// A recording that reached the archive any other way — a chat upload, the iOS
// share sheet — has no true date on it. iOS rewrites the m4a's QuickTime clock
// on every export and Voice Memos writes no date atom into the shared copy, so
// the server could only derive "when it was shared" and it marked those
// records as guesses. This Mac is the only machine that can do better, because
// Apple keeps the real date in the Voice Memos database.
//
// Matched on the AUDIO FINGERPRINT, never on duration or title: the local file
// and the shared copy differ only in their date fields, so the fingerprint is
// identical and there is no way to re-date the wrong recording by accident.
// Duration only narrows which local files are worth reading off disk.
async function healDates(local) {
  if (!audioHash) return;
  let list;
  try {
    const res = await fetch(BASE + '/api/memos/unstamped');
    if (!res.ok) return;
    ({ records: list } = await res.json());
  } catch { return; }
  if (!Array.isArray(list) || !list.length) return;

  const fixable = list.filter(r => r.ahash);
  if (!fixable.length) return;
  console.log(`\nChecking ${fixable.length} recording(s) filed without a real date…`);

  const cache = new Map();
  const fingerprint = (src) => {
    if (!cache.has(src)) {
      try { cache.set(src, audioHash(fs.readFileSync(src))); }
      catch { cache.set(src, null); }
    }
    return cache.get(src);
  };

  let fixed = 0, unmatched = 0;
  for (const rec of fixable) {
    // Only files of the same length can be the same recording, so this reads
    // a couple of files rather than the whole Voice Memos folder.
    const near = local.filter(r => r.downloaded && Math.abs(r.dur - rec.dur) <= 1);
    const hit = near.find(r => fingerprint(r.src) === rec.ahash);
    if (!hit) { unmatched++; continue; }
    const stamp = stampOf(hit.when);
    if (rec.id.startsWith(stamp + '_')) continue; // already the right minute
    if (DRY) { console.log(`  would fix ${rec.date} → ${stamp.slice(0, 10)}  ${rec.title || hit.title}`); fixed++; continue; }
    try {
      const res = await fetch(BASE + '/api/memos/restamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, stamp, iso: hit.when.toISOString() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        fixed++;
        console.log(`  ${rec.date} → ${stamp.slice(0, 10)}  ${rec.title || hit.title}`);
      } else {
        console.log(`  ✕ ${rec.id}: ${j.error || res.status}`);
      }
    } catch (err) {
      console.log(`  ✕ ${rec.id}: ${err.message}`);
    }
  }
  if (fixed) console.log(DRY ? `(dry run — ${fixed} date(s) would be corrected)` : `✅ Corrected ${fixed} date(s) from the Voice Memos database.`);
  if (unmatched) console.log(`   ${unmatched} still unmatched — the original may no longer be on this Mac.`);
}

const dreams = filed.filter(m => m.cat === 'dream');
console.log(`\n✅ Filed ${filed.length} recording(s).`);
console.log(`   Dreams in this batch: ${dreams.length}`);
dreams.forEach(d => console.log(`     ${d.date}  ${d.title}`));
console.log('\nTell Claude it finished.\n');

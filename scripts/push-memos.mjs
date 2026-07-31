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
const known = new Set(status.stamps || []);
console.log(`Already archived: ${status.count} recordings, newest ${status.newest}.`);

const all = readVoiceMemos();
const missing = all.filter(r => !r.downloaded);
const fresh = all.filter(r => r.downloaded && !known.has(stampOf(r.when)));
console.log(`On this Mac: ${all.length} recordings.`);
console.log(`New: ${fresh.length}\n`);

if (missing.length) {
  console.log(`⚠️  ${missing.length} recording(s) aren't downloaded to this Mac, so they can't be read yet:`);
  missing.slice(0, 10).forEach(r => console.log(`     ${stampOf(r.when)}  ${r.title}`));
  if (missing.length > 10) console.log(`     …and ${missing.length - 10} more`);
  console.log('   Open Voice Memos and scroll through them so they download, then run this again.\n');
}
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

const dreams = filed.filter(m => m.cat === 'dream');
console.log(`\n✅ Filed ${filed.length} recording(s).`);
console.log(`   Dreams in this batch: ${dreams.length}`);
dreams.forEach(d => console.log(`     ${d.date}  ${d.title}`));
console.log('\nTell Claude it finished.\n');

// Hand Apple's own Voice Memos transcripts to the archive — NO keys needed.
//
// 94 of the archive's recordings have no transcript at all: too long for the
// server's ceiling, over Whisper's size cap, heard as empty, or a failed
// enrich. Search searches WORDS, so those recordings are invisible in it —
// and a search that finds nothing reads as a recording that doesn't exist.
// Voice Memos already transcribed them, on the phone, for free, including the
// long ones. Only this Mac can read that database, so this script reads the
// words and POSTs them; everything privileged stays on the server.
//
//     node import-apple-transcripts.mjs
//
// Safe to re-run: it only ever fills records that have NO words, and the
// server refuses to overwrite one that does.
//
// Flags:
//     --dry-run       show what it found and what it would send, send nothing
//     --report        print the transcript schema it found and stop
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
const REPORT_ONLY = argv.includes('--report');
const LIMIT = flag('limit') ? Number(flag('limit')) : Infinity;
const BASE = String(flag('base', process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');
const DB = flag('db') || path.join(HOME, 'Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/CloudRecordings.db');

const p2 = (n) => String(n).padStart(2, '0');
// The recording's local wall-clock stamp — the archive's join key, computed
// exactly as push-memos.mjs does it (a second, drifting copy would silently
// stop matching).
const stampOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
const SEP = '\x1f';

// ── the database, snapshotted ───────────────────────────────────────────────
if (!fs.existsSync(DB)) {
  console.error(`\n❌ No Voice Memos database at:\n   ${DB}\n   Open the Voice Memos app once, then run this again.\n`);
  process.exit(1);
}
// Copy it so the live database is never locked while Voice Memos is open.
const SNAP = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-tx-'));
for (const ext of ['', '-wal', '-shm']) {
  try { fs.copyFileSync(DB + ext, path.join(SNAP, 'db' + ext)); } catch {}
}
const SNAP_DB = path.join(SNAP, 'db');
const cleanup = () => { try { fs.rmSync(SNAP, { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);

function sql(query) {
  try {
    const out = execFileSync('sqlite3', ['-separator', SEP, SNAP_DB, query],
      { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    return out.split('\n').filter(Boolean).map(l => l.split(SEP));
  } catch (err) {
    throw new Error(`sqlite3 failed: ${String(err.message || err).split('\n')[0]}`);
  }
}

// ── find where Apple keeps the words ────────────────────────────────────────
// Nothing here assumes a schema. Voice Memos has moved transcripts between
// layouts across OS versions, and guessing a column name that isn't there
// fails silently (zero matches reads exactly like "no transcripts yet"). So
// it looks, says what it found, and only sends what it can actually read.
const tables = sql("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").map(r => r[0]);
const columnsOf = (t) => sql(`PRAGMA table_info('${t.replace(/'/g, "''")}');`).map(r => ({ cid: r[0], name: r[1], type: r[2] }));
const schema = new Map(tables.map(t => [t, columnsOf(t)]));

const isTx = (s) => /TRANSCRI/i.test(s);
const candidates = [];
for (const [t, cols] of schema) {
  for (const c of cols) if (isTx(c.name) || isTx(t)) candidates.push({ table: t, column: c.name, type: c.type });
}

// What each candidate column actually HOLDS, sampled — the name says
// "transcription", the value says whether it is the text, a link to it, or an
// archived blob, and those need three different readers.
function probe(table, column) {
  const q = `SELECT typeof("${column}"), COUNT(*), MAX(LENGTH("${column}")) FROM "${table}" WHERE "${column}" IS NOT NULL GROUP BY typeof("${column}");`;
  let rows = [];
  try { rows = sql(q); } catch { return null; }
  const kinds = rows.map(r => ({ kind: r[0], rows: Number(r[1]) || 0, maxLen: Number(r[2]) || 0 }));
  kinds.sort((a, b) => b.rows - a.rows);
  return kinds[0] || null;
}

const probed = [];
for (const c of candidates) {
  const p = probe(c.table, c.column);
  if (p && p.rows) probed.push({ ...c, ...p });
}

console.log(`\nVoice Memos database: ${DB}`);
console.log(`Tables: ${tables.length}. Columns that mention transcription: ${candidates.length}.`);
if (!probed.length) {
  console.log('\n  …and none of them holds any data.');
} else {
  console.log('\n  what they hold:');
  for (const p of probed) {
    console.log(`    ${p.table}.${p.column}  →  ${p.kind}, ${p.rows} rows, longest ${p.maxLen}`);
  }
}
// A sidecar file next to the audio is another layout Apple has used; list any
// non-audio extensions sitting in the Recordings folder so an unknown one
// shows up here instead of looking like "no transcripts".
try {
  const recDir = path.dirname(DB);
  const exts = new Set();
  for (const f of fs.readdirSync(recDir)) {
    const e = path.extname(f).toLowerCase();
    if (e && !['.m4a', '.db', '.db-wal', '.db-shm', '.plist', '.caf', '.wav'].includes(e)) exts.add(e);
  }
  if (exts.size) console.log(`\n  other file types beside the recordings: ${[...exts].join(' ')}`);
} catch { /* not readable — the schema is the real answer anyway */ }

if (REPORT_ONLY) {
  console.log('\n(--report: stopping here. Paste this back and the reader can be fitted to it.)\n');
  process.exit(0);
}

// ── read the transcripts ────────────────────────────────────────────────────
// Text runs of ≥25 printable characters containing a space. Only used on a
// blob plutil could not open — marked as such in the report, and every result
// still has to pass `looksLikeSpeech` before it is sent anywhere.
function textRuns(buf) {
  const s = buf.toString('utf8');
  const runs = s.match(/[\x20-\x7E -￿]{25,}/g) || [];
  return runs.filter(r => r.includes(' ')).join(' ').replace(/\s+/g, ' ').trim();
}

// Apple archives structured text as a binary plist more often than not, so
// try plutil (always present on macOS) and walk whatever it gives back.
function fromBlobHex(hex) {
  if (!hex) return null;
  const buf = Buffer.from(hex, 'hex');
  const tmp = path.join(SNAP, 'blob.bin');
  fs.writeFileSync(tmp, buf);
  try {
    const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', tmp], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const parsed = JSON.parse(json);
    const out = [];
    const walk = (v) => {
      if (typeof v === 'string') { if (v.trim()) out.push(v); return; }
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (v && typeof v === 'object') { Object.values(v).forEach(walk); }
    };
    walk(parsed);
    // An NSKeyedArchiver dump carries its own class names and keys; the words
    // are the long ones.
    const words = out.filter(t => t.length > 12 && t.includes(' '));
    const text = (words.length ? words : out).join(' ').replace(/\s+/g, ' ').trim();
    return text ? { text, how: 'plist' } : null;
  } catch {
    const text = textRuns(buf);
    return text ? { text, how: 'text-runs (plutil could not open it)' } : null;
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch {}
  }
}

const looksLikeSpeech = (t) => {
  const s = String(t || '').trim();
  if (s.length < 20) return false;
  if ((s.match(/ /g) || []).length < 3) return false;
  const printable = (s.match(/[\x20-\x7E -￿]/g) || []).length;
  return printable / s.length > 0.85;
};

// Z_PK of the recording → { text, how }
function readTranscripts() {
  const byPk = new Map();
  const notes = [];

  // 1. straight on the recording row
  for (const p of probed.filter(x => x.table === 'ZCLOUDRECORDING')) {
    if (p.kind === 'text' && p.maxLen > 20) {
      for (const [pk, val] of sql(`SELECT Z_PK, REPLACE("${p.column}", char(10), ' ') FROM ZCLOUDRECORDING WHERE "${p.column}" IS NOT NULL AND LENGTH("${p.column}") > 20;`)) {
        if (!byPk.has(pk)) byPk.set(pk, { text: String(val).trim(), how: `ZCLOUDRECORDING.${p.column}` });
      }
      notes.push(`read ${byPk.size} from ZCLOUDRECORDING.${p.column}`);
    } else if (p.kind === 'blob') {
      let n = 0;
      for (const [pk, hex] of sql(`SELECT Z_PK, hex("${p.column}") FROM ZCLOUDRECORDING WHERE "${p.column}" IS NOT NULL;`)) {
        const got = fromBlobHex(hex);
        if (got && !byPk.has(pk)) { byPk.set(pk, { text: got.text, how: `ZCLOUDRECORDING.${p.column} (${got.how})` }); n++; }
      }
      notes.push(`read ${n} from the blob in ZCLOUDRECORDING.${p.column}`);
    }
  }

  // 2. a table of its own, linked back to the recording
  for (const t of tables) {
    if (t === 'ZCLOUDRECORDING') continue;
    const cols = schema.get(t) || [];
    if (!isTx(t) && !cols.some(c => isTx(c.name))) continue;
    const link = cols.find(c => /RECORDING/i.test(c.name));
    if (!link) { notes.push(`${t}: no column links it back to a recording — skipped`); continue; }
    // The words are whichever text column actually holds long strings.
    const textCol = cols
      .map(c => ({ c, p: probe(t, c.name) }))
      .filter(x => x.p && x.p.kind === 'text' && x.p.maxLen > 20)
      .sort((a, b) => b.p.maxLen - a.p.maxLen)[0];
    if (!textCol) { notes.push(`${t}: no column in it holds long text — skipped`); continue; }
    const order = cols.find(c => /ORDER|INDEX|START|TIME|OFFSET/i.test(c.name));
    const rows = sql(`SELECT "${link.name}", REPLACE("${textCol.c.name}", char(10), ' ') FROM "${t}" WHERE "${textCol.c.name}" IS NOT NULL${order ? ` ORDER BY "${link.name}", "${order.name}"` : ''};`);
    const joined = new Map();
    for (const [pk, val] of rows) {
      if (!pk) continue;
      joined.set(pk, (joined.get(pk) ? joined.get(pk) + ' ' : '') + String(val).trim());
    }
    let added = 0;
    for (const [pk, text] of joined) if (!byPk.has(pk)) { byPk.set(pk, { text: text.replace(/\s+/g, ' ').trim(), how: `${t}.${textCol.c.name}` }); added++; }
    if (added) notes.push(`read ${added} from ${t}.${textCol.c.name}${order ? ` (ordered by ${order.name})` : ''}`);
  }

  return { byPk, notes };
}

const { byPk, notes } = readTranscripts();
console.log('\nHow it read them:');
for (const n of notes) console.log('  · ' + n);
if (!byPk.size) {
  console.log('\n❌ Found no transcript text. Run it again with --report and paste that back —');
  console.log('   the layout changes between OS versions and the reader can be fitted to yours.\n');
  process.exit(1);
}

// ── match them to the archive ───────────────────────────────────────────────
const recDir = path.dirname(DB);
const recordings = sql("SELECT Z_PK, COALESCE(ZDATE,''), COALESCE(ZDURATION,0), COALESCE(ZCUSTOMLABEL,'') FROM ZCLOUDRECORDING;")
  .map(([pk, zdate, dur, label]) => {
    // Core Data counts seconds from 2001-01-01.
    const when = zdate ? new Date((Number(zdate) + 978307200) * 1000) : null;
    return { pk, when, dur: Math.round(Number(dur) || 0), label };
  })
  .filter(r => r.when);

console.log(`\nArchive: ${BASE}/api/memos`);
const res = await fetch(BASE + '/api/memos/untranscribed');
if (!res.ok) { console.error(`❌ Server said ${res.status}. Is the app awake? Open ${BASE} and try again.`); process.exit(1); }
const list = await res.json();
if (!list.ok) { console.error('❌ ' + (list.error || 'the archive is not reachable')); process.exit(1); }
console.log(`Recordings in the archive with no words: ${list.count} of ${list.total}.`);

// One key can name two recordings (same minute, same rounded length). Sending
// either one's words would be a guess, so those are reported and left alone.
const mine = new Map();
const ambiguous = new Set();
for (const r of recordings) {
  const key = `${stampOf(r.when)}|${r.dur}`;
  if (mine.has(key)) ambiguous.add(key); else mine.set(key, r);
}

const plan = [];
const misses = { nomatch: 0, notranscript: 0, unreadable: 0, ambiguous: 0 };
for (const rec of list.records) {
  if (ambiguous.has(rec.key)) { misses.ambiguous++; continue; }
  const local = mine.get(rec.key);
  if (!local) { misses.nomatch++; continue; }
  const got = byPk.get(local.pk);
  if (!got) { misses.notranscript++; continue; }
  if (!looksLikeSpeech(got.text)) { misses.unreadable++; continue; }
  plan.push({ id: rec.id, date: rec.date, dur: rec.dur, text: got.text, how: got.how });
}

console.log(`\nCan fill: ${plan.length}`);
console.log(`  no matching recording on this Mac: ${misses.nomatch}`);
console.log(`  matched, but Voice Memos has no transcript for it: ${misses.notranscript}`);
if (misses.unreadable) console.log(`  matched, but the text came out unreadable: ${misses.unreadable}`);
if (misses.ambiguous) console.log(`  two recordings share that minute and length: ${misses.ambiguous}`);

if (plan.length) {
  const s = plan[0];
  console.log(`\nFirst one, so you can see it is really the words:`);
  console.log(`  ${s.id}  (${Math.round(s.dur / 60)} min, via ${s.how})`);
  console.log(`  "${s.text.slice(0, 220).replace(/\s+/g, ' ')}…"`);
}

if (!plan.length) { console.log('\nNothing to send.\n'); process.exit(0); }
if (DRY) { console.log('\n--dry-run: nothing sent.\n'); process.exit(0); }

// ── send ────────────────────────────────────────────────────────────────────
// One at a time, like the push: each fill re-files the recording under a real
// category and the server's own index picks it up afterwards.
let sent = 0, skipped = 0, failed = 0, n = 0;
for (const item of plan) {
  if (n >= LIMIT) break;
  n++;
  process.stdout.write(`  ${n}/${Math.min(plan.length, LIMIT)}  ${item.id} … `);
  try {
    const r = await fetch(BASE + '/api/memos/transcript', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: item.id, transcript: item.text, source: 'apple-voice-memos' }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { failed++; console.log('failed — ' + (j.error || r.status)); continue; }
    if (j.skipped) { skipped++; console.log('skipped — ' + (j.reason || 'already had words')); continue; }
    sent++;
    console.log(`filed as ${(j.memo && j.memo.cat) || 'ok'}`);
  } catch (err) {
    failed++;
    console.log('failed — ' + err.message);
  }
}

console.log(`\nDone. Filled ${sent}, skipped ${skipped}, failed ${failed}.`);
console.log('They become searchable in Search within a minute or two — the index catches itself up.\n');

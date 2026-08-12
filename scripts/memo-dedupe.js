// memo-dedupe.js — find and repair duplicates in the Voice Memo archive.
//
// Companion to the three dedupe layers in memos.js. Those stop NEW duplicates;
// this one reports and repairs what is already in the manifest, and backfills
// the audio fingerprint onto the records that predate it.
//
//     node scripts/memo-dedupe.js                    # scan, change nothing
//     node scripts/memo-dedupe.js --fingerprints     # stamp `ahash` on every record
//     node scripts/memo-dedupe.js --merge            # merge the duplicate pairs
//     node scripts/memo-dedupe.js --orphans          # sweep unreferenced audio
//     node scripts/memo-dedupe.js --all --dry-run    # everything, printed only
//
// NOTHING IS EVER DELETED. A merged-away recording's audio moves to
// `memo-audio/_removed/`, and the manifest is backed up beside itself before
// any write — so every repair here can be undone by hand.
//
// Needs STORY_FIREBASE_SERVICE_ACCOUNT (the membry admin JSON).
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const has = (n) => argv.includes('--' + n);
const DRY = has('dry-run');
const ALL = has('all');
const DO_FP = ALL || has('fingerprints');
const DO_MERGE = ALL || has('merge');
const DO_ORPHANS = ALL || has('orphans');
const PREFIX = String(process.env.MEMO_PREFIX || 'memo-audio').replace(/\/+$/, '');
const QUARANTINE = PREFIX + '/_removed';

process.env.MEMO_PREFIX = PREFIX;

let bucket = null;
function init() {
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('STORY_FIREBASE_SERVICE_ACCOUNT not set');
  const sa = JSON.parse(raw);
  const app = admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: `${sa.project_id}.firebasestorage.app`,
  }, 'memo-dedupe');
  bucket = app.storage().bucket();
}

const mf = () => bucket.file(PREFIX + '/manifest.json');
async function readManifest() {
  const [buf] = await mf().download();
  const [meta] = await mf().getMetadata();
  return { manifest: JSON.parse(buf.toString()), generation: meta.generation };
}
async function writeManifest(manifest, generation, label) {
  manifest.memos.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  manifest.count = manifest.memos.length;
  if (DRY) { console.log(`  (dry run — manifest not saved, would be ${manifest.count} records)`); return; }
  await mf().save(JSON.stringify(manifest), {
    contentType: 'application/json',
    preconditionOpts: { ifGenerationMatch: generation },
  });
  console.log(`  manifest saved — ${manifest.count} records (${label}).`);
}
async function backup(manifest, tag) {
  if (DRY) return;
  const name = `${PREFIX}/manifest-backup-${new Date().toISOString().slice(0, 10)}-${tag}.json`;
  await bucket.file(name).save(JSON.stringify(manifest), { contentType: 'application/json' });
  console.log(`  backup written: ${name}`);
}

// ── pairing ────────────────────────────────────────────────────────────────
// Two records are the same recording when the bytes say so (identical file, or
// identical audio once the shared-file date rewrites are zeroed) or when the
// words say so (memos.js's calibrated backstop: exact duration, >=40 words,
// >=90% agreement). Anything weaker is a re-take, not a duplicate — Sophie
// records the same line over and over and those must never be merged.
function findPairs(memos) {
  const { transcriptTwin } = require('../memos');
  const pairs = [];
  const taken = new Set();
  for (let i = 0; i < memos.length; i++) {
    if (taken.has(memos[i].id)) continue;
    const rest = memos.slice(i + 1).filter((m) => !taken.has(m.id));
    for (const other of rest) {
      const a = memos[i];
      const byBytes = (a.hash && a.hash === other.hash) || (a.ahash && a.ahash === other.ahash);
      const byWords = !!transcriptTwin([other], { dur: a.dur, transcript: a.transcript });
      if (!byBytes && !byWords) continue;
      pairs.push({ keep: a, drop: other, why: byBytes ? 'same audio' : 'same words, same length' });
      taken.add(other.id);
    }
  }
  return pairs;
}

// The survivor is the record whose id tells the truth about WHEN the recording
// was made: the plain id over an export collision's `_1`, and the earlier stamp
// over a later one (a re-share is always filed after the original, and the
// bogus "now" stamps are always the later of the pair). Whichever copy has the
// fuller transcript wins the words, because Whisper sometimes drops a trailing
// segment and the longer read is the more complete one.
function choose(a, b) {
  const legacyA = /_\d+$/.test(a.id), legacyB = /_\d+$/.test(b.id);
  if (legacyA !== legacyB) return legacyA ? [b, a] : [a, b];
  return String(a.id) <= String(b.id) ? [a, b] : [b, a];
}

// ── phases ─────────────────────────────────────────────────────────────────
async function fingerprints() {
  const { audioHash, md5Of } = require('../memos');
  console.log('\n── fingerprints ──');
  // Computed fingerprints survive a losing race on the manifest. Without this
  // cache a single concurrent upload — one memo shared from her phone while
  // this is running — would cost a second pass over the whole 4.9GB archive.
  const seen = new Map();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { manifest, generation } = await readManifest();
    manifest.memos.forEach((m) => { if (seen.has(m.file)) Object.assign(m, seen.get(m.file)); });
    const todo = manifest.memos.filter((m) => !m.ahash);
    console.log(`  ${manifest.memos.length} records, ${todo.length} without a fingerprint.`);
    if (!todo.length) return;
    let done = 0, failed = 0, bytes = 0;
    for (const rec of todo) {
      try {
        const [buf] = await bucket.file(`${PREFIX}/${rec.file}`).download();
        bytes += buf.length;
        const ah = audioHash(buf);
        if (ah) rec.ahash = ah;
        if (!rec.hash) rec.hash = md5Of(buf);
        seen.set(rec.file, { ahash: rec.ahash, hash: rec.hash });
        done++;
      } catch (e) {
        failed++;
        console.warn(`  ⚠ ${rec.id}: ${e.code || e.message}`);
      }
      if ((done + failed) % 100 === 0) console.log(`  …${done + failed}/${todo.length} (${(bytes / 1e9).toFixed(2)}GB read)`);
    }
    console.log(`  fingerprinted ${done}, unreadable ${failed}, ${(bytes / 1e9).toFixed(2)}GB read.`);
    try {
      await backup(manifest, 'prefingerprint');
      await writeManifest(manifest, generation, 'fingerprints');
      return;
    } catch (e) {
      if ((e.code || e.status) !== 412 || attempt === 3) throw e;
      console.log('  manifest moved underneath us — re-reading');
    }
  }
}

async function merge() {
  console.log('\n── duplicates ──');
  const { manifest, generation } = await readManifest();
  const pairs = findPairs(manifest.memos).map((p) => {
    const [keep, drop] = choose(p.keep, p.drop);
    return { ...p, keep, drop };
  });
  if (!pairs.length) { console.log('  none — the archive is clean.'); return; }
  console.log(`  ${pairs.length} duplicate pair(s):\n`);
  for (const p of pairs) {
    const better = (p.drop.transcript || '').length > (p.keep.transcript || '').length;
    console.log(`  ${p.keep.dur}s  ${p.why}`);
    console.log(`    keep  ${p.keep.id}`);
    console.log(`    drop  ${p.drop.id}${better ? '   (its transcript is longer — adopting it)' : ''}`);
  }
  if (DRY) { console.log('\n  (dry run — nothing merged)'); return; }
  await backup(manifest, 'predupe');
  const dropping = new Set();
  for (const p of pairs) {
    const keep = manifest.memos.find((m) => m.id === p.keep.id);
    if ((p.drop.transcript || '').length > (keep.transcript || '').length) {
      keep.transcript = p.drop.transcript;
      if (p.drop.desc && !keep.desc) keep.desc = p.drop.desc;
    }
    keep.mergedFrom = [...(keep.mergedFrom || []), p.drop.id];
    dropping.add(p.drop.id);
  }
  manifest.memos = manifest.memos.filter((m) => !dropping.has(m.id));
  await writeManifest(manifest, generation, 'duplicates merged');
  for (const p of pairs) await quarantine(p.drop.file);
}

// Moved, never deleted — a merge decision I got wrong must be reversible.
async function quarantine(file) {
  try {
    await bucket.file(`${PREFIX}/${file}`).move(`${QUARANTINE}/${file}`);
    console.log(`  moved to _removed/: ${file}`);
  } catch (e) {
    console.warn(`  ⚠ could not move ${file}: ${e.code || e.message}`);
  }
}

async function orphans() {
  console.log('\n── orphan audio ──');
  const { manifest } = await readManifest();
  const known = new Set(manifest.memos.map((m) => m.file));
  const [files] = await bucket.getFiles({ prefix: PREFIX + '/' });
  const loose = files
    .map((f) => f.name.slice(PREFIX.length + 1))
    .filter((n) => n && !n.includes('/') && !n.endsWith('.json') && !known.has(n));
  if (!loose.length) { console.log('  none.'); return; }
  const size = (n) => Number((files.find((f) => f.name.endsWith('/' + n)) || {}).metadata.size || 0);
  loose.forEach((n) => console.log(`  ${n}  (${(size(n) / 1e6).toFixed(1)}MB)`));
  console.log(`  ${loose.length} object(s), ${(loose.reduce((a, n) => a + size(n), 0) / 1e6).toFixed(1)}MB — audio no record points at.`);
  if (DRY) { console.log('  (dry run — nothing moved)'); return; }
  for (const n of loose) await quarantine(n);
}

async function scan() {
  const { manifest } = await readManifest();
  console.log(`\n── scan ──\n  ${manifest.memos.length} records.`);
  console.log(`  without a fingerprint: ${manifest.memos.filter((m) => !m.ahash).length}`);
  console.log(`  without a file hash:   ${manifest.memos.filter((m) => !m.hash).length}`);
  const pairs = findPairs(manifest.memos);
  console.log(`  duplicate pairs:       ${pairs.length}`);
  pairs.forEach((p) => {
    const [keep, drop] = choose(p.keep, p.drop);
    console.log(`    ${String(keep.dur).padStart(4)}s  ${keep.id}  ←  ${drop.id}  (${p.why})`);
  });
}

(async () => {
  init();
  if (DO_FP) await fingerprints();
  if (DO_MERGE) await merge();
  if (DO_ORPHANS) await orphans();
  if (!DO_FP && !DO_MERGE && !DO_ORPHANS) await scan();
  console.log('\nDone.\n');
})().catch((err) => { console.error('\n✕ ' + err.message + '\n'); process.exit(1); });

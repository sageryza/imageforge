// memo-unify-backfill.js — one-time repairs for the ONE-library rule (Aug 2026).
//
// Phase A — HASHES: stamp every existing archive record with the md5 of its
// stored bytes, read from Storage object metadata (no downloads). Until this
// runs, the md5 half of the belt-and-braces dedupe can't catch a re-upload of
// an already-archived recording.
//
// Phase B — MERGE: walk `forge-audio` (the audio drop / share-sheet
// collection) and file anything the archive doesn't have into it, via the
// live server's POST /api/memos/ingest (so the server's keys do the
// transcribe/classify work). Skips items whose md5 is already archived.
//
//     node scripts/memo-unify-backfill.js [--dry-run] [--skip-hashes]
//         [--skip-audio] [--base <url>] [--limit N]
//
// Phase A needs STORY_FIREBASE_SERVICE_ACCOUNT (the membry admin JSON).
// Phase B needs the NEW server code deployed (optional-stamp ingest).
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const flag = (n, d = null) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const BASE = String(flag('base', process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');
const LIMIT = flag('limit') ? Number(flag('limit')) : Infinity;
const PREFIX = String(process.env.MEMO_PREFIX || 'memo-audio').replace(/\/+$/, '');

function membryBucket() {
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('STORY_FIREBASE_SERVICE_ACCOUNT not set');
  const sa = JSON.parse(raw);
  const app = admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: `${sa.project_id}.firebasestorage.app`,
  }, 'membry-backfill');
  return app.storage().bucket();
}

// ── Phase A ────────────────────────────────────────────────────────────────
async function backfillHashes() {
  const bucket = membryBucket();
  const mf = bucket.file(PREFIX + '/manifest.json');

  for (let attempt = 1; attempt <= 3; attempt++) {
    const [buf] = await mf.download();
    const [meta] = await mf.getMetadata();
    const m = JSON.parse(buf.toString());
    const missing = m.memos.filter(x => !x.hash);
    console.log(`Phase A: ${m.memos.length} records, ${missing.length} without a hash.`);
    if (!missing.length) return;

    let done = 0, gone = 0;
    for (const rec of missing) {
      try {
        const [fm] = await bucket.file(`${PREFIX}/${rec.file}`).getMetadata();
        // Storage keeps the md5 of the stored bytes as base64 — same bytes the
        // server hashes on ingest, so the two compare directly once hexed.
        if (fm.md5Hash) { rec.hash = Buffer.from(fm.md5Hash, 'base64').toString('hex'); done++; }
      } catch (e) {
        gone++;
        console.warn(`  ⚠ no object for ${rec.file} (${e.code || e.message}) — left unhashed`);
      }
      if ((done + gone) % 100 === 0) console.log(`  …${done + gone}/${missing.length}`);
    }
    console.log(`Phase A: hashed ${done}, missing objects ${gone}.`);
    if (DRY) { console.log('(dry run — manifest not saved)'); return; }
    try {
      await mf.save(JSON.stringify(m), {
        contentType: 'application/json',
        preconditionOpts: { ifGenerationMatch: meta.generation },
      });
      console.log('Phase A: manifest saved.');
      return;
    } catch (e) {
      if ((e.code || e.status) !== 412 || attempt === 3) throw e;
      console.log('  manifest moved underneath us — re-reading');
    }
  }
}

// ── Phase B ────────────────────────────────────────────────────────────────
async function mergeForgeAudio() {
  const status = await (await fetch(`${BASE}/api/memos/status`)).json();
  if (!status.ok) throw new Error('archive unreachable: ' + (status.error || '?'));
  const hashes = new Set(status.hashes || []);
  if (!status.hashes) console.warn('  ⚠ server has no `hashes` on /status — new code not deployed yet? md5 skip runs server-side only.');

  const items = (await (await fetch(`${BASE}/api/audio/items`)).json()).items || [];
  console.log(`Phase B: ${items.length} recording(s) in forge-audio; archive holds ${status.count}.`);

  let sent = 0;
  for (const it of items) {
    if (sent >= LIMIT) break;
    if (it.hash && hashes.has(it.hash)) { console.log(`  = ${it.name} — already archived`); continue; }
    if (it.memoId) { console.log(`  = ${it.name} — already filed (${it.memoId})`); continue; }
    console.log(`  → ${it.name} (${Math.round(it.seconds || 0)}s, batch ${it.batch})${DRY ? ' [dry run]' : ''}`);
    if (DRY) { sent++; continue; }

    const audio = await fetch(it.url);
    if (!audio.ok) { console.warn(`    ✕ fetch ${audio.status}`); continue; }
    const buf = Buffer.from(await audio.arrayBuffer());
    const q = new URLSearchParams({
      title: it.name || '', dur: String(Math.round(it.seconds || 0)),
      ext: it.ext || 'm4a', source: 'audio-backfill',
    });
    const r = await fetch(`${BASE}/api/memos/ingest?${q}`, {
      method: 'POST', headers: { 'Content-Type': it.mime || 'audio/mp4' }, body: buf,
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      console.log(`    ${j.skipped ? '= skipped (' + (j.reason || 'duplicate') + ')' : '✓ filed as ' + j.memo.id + ' [' + j.memo.cat + ']'}`);
      sent++;
    } else console.warn(`    ✕ ${j.error || r.status}`);
  }
  console.log(`Phase B: ${sent} processed.`);
}

(async () => {
  if (!argv.includes('--skip-hashes')) await backfillHashes();
  if (!argv.includes('--skip-audio')) await mergeForgeAudio();
  console.log('Done.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

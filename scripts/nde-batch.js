#!/usr/bin/env node
/**
 * nde-batch.js — bulk-run the Anthony Chene NDE pipeline.
 *
 * For each video: fetch metadata → captions transcript → extract 3-5 unique,
 * illustratable moments via OpenAI → save to Firestore (`forge-nde-videos`).
 * Idempotent — videos already extracted are skipped unless --force is set.
 *
 * WHERE VIDEOS COME FROM (in order of precedence)
 *   --video-ids a,b,c      explicit list of videoIds (or full URLs)
 *   --file <path>          newline-delimited list of videoIds/URLs
 *   --channel <handle|id>  every uploaded video on that channel (default:
 *                          NDE_CHANNEL_HANDLE env or "anthonychene")
 *
 * OTHER FLAGS
 *   --max <n>              cap channel discovery / batch size (default 25)
 *   --skip-existing        default; use --force to re-process finished videos
 *   --force                re-fetch transcript AND re-extract for every video
 *   --force-extract        re-run extraction only (keep cached transcript)
 *   --dry-run              print plan, don't call any external APIs
 *   --json                 print each result as JSON (default: human summary)
 *   --out <path>           also write the full result set as JSON to this path
 *
 * ENV
 *   OPENAI_API_KEY         required (moment extraction)
 *   YOUTUBE_API_KEY        required for --channel discovery / metadata; not
 *                          needed if you pass explicit video ids
 *   FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS
 *                          required to persist to Firestore; without it the
 *                          script still runs and prints results but nothing
 *                          survives the process (in-memory fallback).
 *   STUDIO_TOKEN           ignored (the router uses it; CLI writes directly)
 *
 * EXAMPLES
 *   # Explicit videos
 *   node scripts/nde-batch.js --video-ids dQw4w9WgXcQ,abcd1234567
 *
 *   # First 25 uploads from the channel
 *   node scripts/nde-batch.js --channel anthonychene --max 25
 *
 *   # Re-extract with a tuned prompt
 *   node scripts/nde-batch.js --channel anthonychene --max 25 --force-extract
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function flag(name) { return process.argv.includes(`--${name}`); }

function initFirebase() {
  if (admin.apps.length) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    return true;
  }
  if (keyPath && fs.existsSync(keyPath)) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return true;
  }
  console.warn('Firebase not initialized — results will not persist (set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS).');
  return false;
}

async function readIdList(fp) {
  const txt = await fs.promises.readFile(fp, 'utf8');
  return txt.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
}

function summarize(record) {
  const m = record.moments || [];
  return [
    `[${record.status || '?'}] ${record.videoId} — ${record.title || '(no title)'}`,
    record.experiencerName ? `  experiencer: ${record.experiencerName}` : null,
    record.summary ? `  summary: ${record.summary}` : null,
    m.length ? `  ${m.length} moment${m.length === 1 ? '' : 's'}:` : '  (no moments extracted)',
    ...m.map(x => `    • ${x.title} — ${x.description.split(/\s+/).slice(0, 20).join(' ')}${x.description.split(/\s+/).length > 20 ? '…' : ''}`),
    record.error ? `  ERROR: ${record.error}` : null,
  ].filter(Boolean).join('\n');
}

async function main() {
  initFirebase();
  // require AFTER firebase-admin is initialized so nde.js sees the app.
  const nde = require('..' + path.sep + 'nde');

  const dryRun = flag('dry-run');
  const asJson = flag('json');
  const skipExisting = !flag('force');
  const forceExtract = flag('force') || flag('force-extract');
  const forceTranscript = flag('force');
  const max = Math.min(500, Math.max(1, parseInt(arg('max', '25'), 10) || 25));
  const outPath = arg('out', null);

  // Resolve the target video list.
  let targets = [];
  const idsCsv = arg('video-ids', null);
  const idsFile = arg('file', null);
  const channel = arg('channel', null);
  if (idsCsv) {
    targets = idsCsv.split(',').map(s => s.trim()).filter(Boolean);
  } else if (idsFile) {
    targets = await readIdList(idsFile);
  } else {
    const handle = channel || process.env.NDE_CHANNEL_HANDLE || nde.DEFAULT_CHANNEL_HANDLE;
    console.log(`Discovering up to ${max} videos from @${handle}…`);
    if (!process.env.YOUTUBE_API_KEY) {
      console.error('YOUTUBE_API_KEY not set — cannot discover from a channel. Pass --video-ids or --file, or set the key.');
      process.exit(2);
    }
    const disc = await nde.listChannelVideos({ handle, max });
    console.log(`Found ${disc.length} video(s).`);
    targets = disc.map(v => v.videoId);
  }
  targets = targets.map(t => nde.parseVideoId(t)).filter(Boolean);
  if (!targets.length) {
    console.error('No videoIds to process.');
    process.exit(2);
  }

  console.log(`Target set: ${targets.length} video(s). ${dryRun ? '(dry run)' : ''}`);
  if (dryRun) {
    for (const id of targets) console.log(`  ${id}  https://youtu.be/${id}`);
    process.exit(0);
  }

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const id = targets[i];
    const existing = await nde.getVideo(id);
    if (existing && existing.status === 'extracted' && skipExisting && !forceExtract) {
      console.log(`\n[${i + 1}/${targets.length}] SKIP ${id} (already extracted, ${existing.moments?.length || 0} moments) — use --force or --force-extract to re-run.`);
      results.push(existing);
      continue;
    }
    console.log(`\n[${i + 1}/${targets.length}] ${id} …`);
    try {
      const record = await nde.processVideo(id, { forceTranscript, forceExtract });
      results.push(record);
      console.log(asJson ? JSON.stringify(record, null, 2) : summarize(record));
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      results.push({ videoId: id, status: 'failed', error: err.message });
    }
  }

  if (outPath) {
    await fs.promises.writeFile(outPath, JSON.stringify(results, null, 2));
    console.log(`\nWrote ${results.length} record(s) to ${outPath}`);
  }

  // Totals.
  const done = results.filter(r => r.status === 'extracted').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const totalMoments = results.reduce((n, r) => n + (r.moments?.length || 0), 0);
  console.log(`\nDone. extracted=${done}  failed=${failed}  moments=${totalMoments}  total=${results.length}`);
}

main().catch(err => { console.error(err.stack || err.message); process.exit(1); });

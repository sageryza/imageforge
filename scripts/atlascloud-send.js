#!/usr/bin/env node
// atlascloud-send.js — send ONE job through the Atlas door FROM A CONTAINER,
// through the module itself, so the job is LOGGED the moment it is sent
// (forge-video-jobs, provider 'atlascloud', the literal prompt and every
// reference — her rule) and the finished clip is mirrored to Storage by the
// same poll the server runs. Seedance or Wan 3.0: whatever
// atlascloud.js's buildRequest takes.
//
//   ATLASCLOUD_API_KEY=… FIREBASE_SERVICE_ACCOUNT='<deckfactory json>' \
//     node scripts/atlascloud-send.js --job job.json [--dry]
//
// job.json: { chat, scene, title, session?, note?, prompt | promptFile,
//   model, seconds, res, ratio, audio (default true), seed?, fileUrl?,
//   images: [url…], videos: [url…], audios: [url…] }
//
// `--dry` builds and prints the exact body and stops — nothing sent, nothing
// logged. Her "go" rule lives in the chat, not here: show the model, seconds,
// resolution, the exact prompt and every reference, wait for "go", THEN run
// this without --dry. A refusal is terminal — never retried, never reshaped.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const a = require('../atlascloud');

const args = process.argv.slice(2);
let jobPath = '', dry = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--job') { jobPath = args[i + 1]; i++; }
  else if (args[i] === '--dry') dry = true;
  else { console.error('unknown arg', args[i]); process.exit(2); }
}
if (!jobPath) { console.error('--job job.json required'); process.exit(2); }
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const prompt = job.promptFile ? fs.readFileSync(path.resolve(path.dirname(jobPath), job.promptFile), 'utf8') : job.prompt;

const body = {
  prompt, model: job.model, duration: job.seconds, resolution: job.res, aspectRatio: job.ratio,
  generateAudio: job.audio == null ? true : Boolean(job.audio), seed: job.seed, fileUrl: job.fileUrl,
  referenceImageUrls: job.images || [], referenceVideoUrls: job.videos || [], referenceAudioUrls: job.audios || [],
  chat: job.chat, scene: job.scene, title: job.title, session: job.session, note: job.note,
};
const built = a.buildRequest(body);
if (built.error) { console.error('REFUSED before sending:', built.error); process.exit(2); }
console.log('EXACT BODY:'); console.log(JSON.stringify(built.body, null, 1));
if (dry) { console.log('(dry — nothing sent)'); process.exit(0); }

if (!process.env.ATLASCLOUD_API_KEY) { console.error('ATLASCLOUD_API_KEY not set'); process.exit(2); }
if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT not set — the log and the mirror need the Deck Factory service account'); process.exit(2); }
  const sa = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const r = await a.startVideo(body);
  console.log('ACCEPTED', r.jobId, '— logged; polling every 10s');
  console.log('SENT (as Atlas received it):'); console.log(JSON.stringify(r.sent, null, 1));
  for (;;) {
    await sleep(10000);
    let p;
    try { p = await a.pollVideo(r.jobId); } catch (e) { console.log(new Date().toISOString(), 'poll error', e.message); continue; }
    console.log(new Date().toISOString(), p.status, p.tokens ? `tokens ${p.tokens.completion}/${p.tokens.total}` : '');
    if (p.status === 'completed' || p.status === 'succeeded') {
      console.log('DONE →', p.video, p.lastFrame ? `| last frame ${p.lastFrame}` : '');
      console.log('raw:', JSON.stringify(p.raw).slice(0, 800));
      return;
    }
    if (['failed', 'timeout', 'cancelled', 'canceled'].includes(p.status)) {
      console.error('ENDED', JSON.stringify(p.raw).slice(0, 1200));
      process.exit(1);
    }
  }
})().catch((e) => { console.error('ERROR', e.status || '', e.message, e.refusal ? `refusal:${e.refusal}` : '', e.hint || ''); process.exit(1); });

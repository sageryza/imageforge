#!/usr/bin/env node
// apiframe-send.js — send ONE job through the APIFRAME door FROM A CONTAINER,
// through the module itself, so the job is LOGGED the moment it is sent
// (forge-video-jobs, the literal prompt and every reference), exactly as
// atlascloud-send.js does for the Atlas door. A container is immune to a
// deploy restarting the box mid-draw.
//
//   node scripts/apiframe-send.js --job job.json [--dry]
//
// job.json: the SAME shape atlascloud-send.js reads — { chat, scene, title,
// session?, note?, prompt | promptFile, model, seconds, res, ratio,
// audio (default true), seed?, images[], videos[], audios[] }.
//
// `--dry` prints the exact body and stops — nothing sent, nothing logged.
// Her "go" rule lives in the chat, not here: show the model, seconds,
// resolution, the exact prompt and every reference, and wait for her word
// before running this without --dry. A refusal is terminal — never retried
// with the prompt changed, never reshaped.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const af = require('../apiframe');

const args = process.argv.slice(2);
let jobPath = '', dry = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--job') { jobPath = args[i + 1]; i++; }
  else if (args[i] === '--dry') dry = true;
}
if (!jobPath) { console.error('--job job.json required'); process.exit(2); }
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const prompt = job.promptFile
  ? fs.readFileSync(path.resolve(path.dirname(jobPath), job.promptFile), 'utf8')
  : job.prompt;

const body = {
  prompt, model: job.model, duration: job.seconds, resolution: job.res,
  aspectRatio: job.ratio, generateAudio: job.audio == null ? true : Boolean(job.audio),
  seed: job.seed,
  referenceImageUrls: job.images || [], referenceVideoUrls: job.videos || [],
  referenceAudioUrls: job.audios || [],
  chat: job.chat, scene: job.scene, title: job.title, session: job.session, note: job.note,
};
console.log('EXACT BODY:');
console.log(JSON.stringify(body, null, 1));
if (dry) { console.log('(dry — nothing sent)'); process.exit(0); }

if (!process.env.APIFRAME_KEY && !process.env.APIFRAME_API_KEY) { console.error('APIFRAME_KEY not set'); process.exit(2); }
if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT not set — the log and the mirror need the Deck Factory service account'); process.exit(2); }
  const sa = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const r = await af.startVideo(body);
  console.log('ACCEPTED', r.jobId, '— logged; polling every 10s');
  console.log('SENT (as APIFRAME received it):');
  console.log(JSON.stringify(r.params, null, 1));
  for (;;) {
    await sleep(10000);
    let p;
    try { p = await af.pollVideo(r.jobId); }
    catch (e) { console.log(new Date().toISOString(), 'poll error', e.message); continue; }
    console.log(new Date().toISOString(), p.status || '?', p.video || '');
    const s = String(p.status || '').toLowerCase();
    if (s === 'completed' || s === 'done' || s === 'failed' || s === 'error') {
      console.log('ENDED', JSON.stringify(p.raw || p).slice(0, 1200));
      break;
    }
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });

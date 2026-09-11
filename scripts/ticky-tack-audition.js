#!/usr/bin/env node
// ticky-tack-audition.js — send the three Thomas audition clips through Atlas
// Cloud FROM A CONTAINER, in process (atlascloud.js's own startVideo/pollVideo),
// so the exact prompts land in the forge-video-jobs log tagged with this chat
// and the clips mirror to Storage exactly as the server route would.
//   FIREBASE_SERVICE_ACCOUNT=… ATLASCLOUD_API_KEY=… node scripts/ticky-tack-audition.js [--dry]
const fs = require('fs'), path = require('path');
const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const a = require('../atlascloud');
const dry = process.argv.includes('--dry');
const CHAT = 'tiki-tack-draft-commit';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
const dir = path.join(__dirname, '..', 'docs', 'ticky-tack', 'thomas-audition');
const CLIPS = [
  { file: '1-meeting.txt', scene: 'audition-1', title: 'Thomas audition 1 — the meeting (he gets mad)' },
  { file: '2-winning-spot.txt', scene: 'audition-2', title: 'Thomas audition 2 — the Winning Spot (curled up, the $5)' },
  { file: '3-ducks.txt', scene: 'audition-3', title: 'Thomas audition 3 — the ducks (all the signs)' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const jobs = [];
  for (const c of CLIPS) {
    const body = { prompt: fs.readFileSync(path.join(dir, c.file), 'utf8').trim(), model: 'mini', duration: 15,
      resolution: '480p', aspectRatio: '16:9', generateAudio: true, chat: CHAT, scene: c.scene, title: c.title, session: SESSION };
    if (dry) { console.log(JSON.stringify(a.buildRequest(body).body, null, 1)); continue; }
    try {
      const r = await a.startVideo(body);
      console.log('SENT', c.scene, r.jobId); console.log(JSON.stringify(r.sent, null, 1));
      jobs.push({ ...c, id: r.jobId });
    } catch (e) { console.error('REFUSED', c.scene, e.status, e.refusal, e.message); }
  }
  if (dry) return;
  const out = {};
  while (jobs.some((j) => !out[j.id])) {
    await sleep(15000);
    for (const j of jobs) {
      if (out[j.id]) continue;
      const p = await a.pollVideo(j.id).catch((e) => ({ status: 'error', err: e.message }));
      console.log(new Date().toISOString(), j.scene, p.status, p.tokens ? JSON.stringify(p.tokens) : '', p.err || '');
      if (p.status === 'completed' || p.status === 'succeeded') out[j.id] = { ...j, video: p.video, tokens: p.tokens };
      else if (/failed|timeout|cancel|error/.test(p.status)) out[j.id] = { ...j, error: p.err || JSON.stringify(p.raw && p.raw.error) };
    }
  }
  fs.writeFileSync(path.join(dir, 'jobs.json'), JSON.stringify(Object.values(out), null, 2));
  console.log(JSON.stringify(Object.values(out), null, 2));
  process.exit(0);
})();

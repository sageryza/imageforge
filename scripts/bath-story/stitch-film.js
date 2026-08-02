// Stitch the bath-story draft film: each panel held for the exact duration of
// its verified voiceover cut, hard cuts, native 2:3 (1024x1536). Animation
// between panel pairs is a later pipeline stage — this is the draft assembly.
// The two narration stretches with no image yet ride on placeholder panels
// (s06 → bath-bubble-normal, s07 → bath-calm) so the film plays end to end.
// Run from /home/user/imageforge.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');

const SCRATCH = process.env.BATH_SCRATCH || '/tmp/claude-0/-home-user/3f02d84e-abbd-5c13-b33d-ae39d8184c4b/scratchpad';
const OUT = path.join(SCRATCH, 'bath-film');
const FFMPEG = require('/home/user/imageforge/node_modules/ffmpeg-static');
const PANELS = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'bath/panels.json'), 'utf8'));
const TIMELINE = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'bath-audio/timeline.json'), 'utf8'));

const PLACEHOLDER = { s06: 'bath-bubble-normal', s07: 'bath-calm' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const byId = Object.fromEntries(PANELS.map(p => [p.id, p]));

  const parts = [];
  for (const seg of TIMELINE.segments) {
    const panelId = seg.panel || PLACEHOLDER[seg.id];
    const img = path.join(SCRATCH, 'bath', `${panelId}.webp`);
    const audio = path.join(SCRATCH, 'bath-audio', `${seg.id}-${seg.panel || 'no-panel'}.mp3`);
    if (!fs.existsSync(img) || !fs.existsSync(audio)) throw new Error(`missing input for ${seg.id}`);
    const clip = path.join(OUT, `${seg.id}.mp4`);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', img, '-i', audio,
      '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1024:1536', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '1',
      '-shortest', clip]);
    parts.push(clip);
    console.log(`${seg.id}: ${panelId}${seg.panel ? '' : ' (placeholder)'} × ${seg.seconds.toFixed(1)}s`);
  }

  const listFile = path.join(OUT, 'concat.txt');
  fs.writeFileSync(listFile, parts.map(f => `file '${f}'`).join('\n'));
  const film = path.join(OUT, 'bath-draft-film.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy', '-movflags', '+faststart', film]);
  const bytes = fs.statSync(film).size;
  console.log(`film: ${film} (${(bytes / 1e6).toFixed(1)} MB)`);

  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();
  const dest = 'story-shorts/bath-thought-experiment/bath-draft-film.mp4';
  await bucket.upload(film, { destination: dest, metadata: { contentType: 'video/mp4' } });
  await bucket.file(dest).makePublic();
  console.log(`uploaded → https://storage.googleapis.com/${bucket.name}/${dest}`);
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

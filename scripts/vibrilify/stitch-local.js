// stitch-local.js — the timeline stitch, run in the session container.
// The server's stitchTimeline died twice on the 512MB Render box while
// encoding beat 1 (job doc frozen at "building beat 1/12" with zero writes
// for 19+ min — measured 2026-08-20), so this mirrors its recipe exactly
// (buildTimelineSegment → concatClips → VO mux, same filters, same encoder
// flags) on local ffmpeg-static, uploads the film to movies/films/ in the
// deckfactory bucket, and writes onto the forge-movies doc what
// stitchTimeline would have written (movieUrl, duration, cut record, job
// done). Usage: FIREBASE_SERVICE_ACCOUNT=… node scripts/vibrilify/stitch-local.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const admin = require('firebase-admin');

const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;
const state = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.VIB_STATE || 'state.json'), 'utf8'));
const TARGET = { width: 1080, height: 1920 };

const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(svc),
  storageBucket: `${svc.project_id}.firebasestorage.app`,
});

function run(bin, args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)}: ${err.message}\n${String(stderr).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
  });
}
async function probe(file) {
  const { stdout } = await run(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_format', file]);
  return { duration: Number(JSON.parse(stdout).format?.duration) || 0 };
}
async function fetchToFile(url, file) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('http ' + r.status);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      return file;
    } catch (e) { if (a === 2) throw e; await new Promise(r => setTimeout(r, 1500 * (a + 1))); }
  }
}

const enc = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];

// Mirror of movies.js buildTimelineSegment (edits are all defaults here),
// plus two v3 behaviours: `scene.fitSpeed` retimes a morph clip to fill its
// window exactly (a morph trimmed mid-transformation never completes), and
// `windowSec` may include a dissolve tail added by the caller.
async function buildSegment(scene, windowSec, tmpDir, i) {
  const out = path.join(tmpDir, `seg-${i}.mp4`);
  const useClip = scene.clip?.url && !scene.clip.url.startsWith('data:') && !scene.still;
  if (useClip) {
    const inFile = await fetchToFile(scene.clip.url, path.join(tmpDir, `clip-${i}.mp4`));
    const mid = path.join(tmpDir, `mid-${i}.mp4`);
    const filters = [
      'setpts=PTS/1',
      `scale=${TARGET.width}:${TARGET.height}:force_original_aspect_ratio=decrease`,
      `pad=${TARGET.width}:${TARGET.height}:(ow-iw)/2:(oh-ih)/2`,
      'fps=30', 'format=yuv420p',
    ];
    await run(FFMPEG, ['-y', '-i', inFile, '-vf', filters.join(','), '-an', ...enc, mid]);
    const { duration } = await probe(mid);
    const factor = windowSec / duration; // setpts multiplier: <1 speeds up
    if (scene.fitSpeed && factor >= 0.25 && factor <= 4) {
      await run(FFMPEG, ['-y', '-i', mid, '-vf', `setpts=PTS*${factor.toFixed(4)},fps=30,setsar=1`, ...enc, '-an', out]);
    } else if (duration >= windowSec - 0.05) {
      await run(FFMPEG, ['-y', '-i', mid, '-t', String(windowSec), '-vf', 'fps=30,setsar=1', ...enc, '-an', out]);
    } else {
      const pad = Math.max(0, windowSec - duration);
      await run(FFMPEG, ['-y', '-i', mid, '-vf', `tpad=stop_mode=clone:stop_duration=${pad},fps=30,setsar=1`, ...enc, '-an', out]);
    }
  } else {
    const img = await fetchToFile(scene.panel.url, path.join(tmpDir, `panel-${i}.webp`));
    const lb = `scale=${TARGET.width}:${TARGET.height}:force_original_aspect_ratio=decrease,` +
      `pad=${TARGET.width}:${TARGET.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
    await run(FFMPEG, ['-y', '-loop', '1', '-t', String(windowSec), '-i', img,
      '-vf', `${lb},fps=30,setsar=1`, ...enc, '-an', out]);
  }
  return out;
}

(async () => {
  const movie = await (await fetch('https://imageforge-q125.onrender.com/api/movies/' + state.movieId)).json();
  const voDur = Number(movie.voiceover.duration);
  const seq = movie.scenes
    .filter(s => s.edits?.enabled !== false && typeof s.startAt === 'number' && s.panel?.url)
    .sort((a, b) => a.startAt - b.startAt);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibrilify-'));

  // Soft pharma dissolves (VIB_XFADE seconds, 0 = the old hard-cut concat).
  // Each segment is built with a dissolve tail; xfade offsets are chosen so
  // every dissolve is CENTERED on its beat boundary and the total still
  // lands exactly on the VO clock (the last tail is X/2 for that reason).
  const X = Math.max(0, Number(process.env.VIB_XFADE) || 0);
  const segments = [];
  const used = [];
  const windows = [];
  for (let i = 0; i < seq.length; i++) {
    const start = Math.max(0, seq[i].startAt);
    const end = i + 1 < seq.length ? Math.max(start, seq[i + 1].startAt) : voDur;
    const win = end - start;
    if (win < 0.15) continue;
    windows.push(win);
    const extra = X > 0 ? (i + 1 < seq.length ? X : X / 2) : 0;
    process.stderr.write(`beat ${i + 1}/${seq.length} "${seq[i].title}" ${win.toFixed(2)}s\n`);
    segments.push(await buildSegment(seq[i], win + extra, tmpDir, i));
    used.push(seq[i]);
  }

  process.stderr.write('joining…\n');
  const silent = path.join(tmpDir, 'silent.mp4');
  if (X > 0 && segments.length > 1) {
    const inputs = segments.flatMap(f => ['-i', f]);
    let cum = 0;
    const parts = [];
    for (let k = 1; k < segments.length; k++) {
      cum += windows[k - 1];
      const src = k === 1 ? '[0:v]' : `[x${k - 1}]`;
      const label = k === segments.length - 1 ? '[vout]' : `[x${k}]`;
      parts.push(`${src}[${k}:v]xfade=transition=fade:duration=${X}:offset=${(cum - X / 2).toFixed(3)}${label}`);
    }
    await run(FFMPEG, ['-y', ...inputs, '-filter_complex', parts.join(';'),
      '-map', '[vout]', ...enc, '-an', '-movflags', '+faststart', silent], 1800000);
  } else {
    const listFile = silent + '.txt';
    fs.writeFileSync(listFile, segments.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', silent]);
  }

  process.stderr.write('voiceover…\n');
  const voFile = await fetchToFile(movie.voiceover.url, path.join(tmpDir, 'vo.wav'));
  const outFile = path.join(tmpDir, 'movie.mp4');
  await run(FFMPEG, ['-y', '-i', silent, '-i', voFile,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile]);
  const { duration } = await probe(outFile);

  process.stderr.write('uploading…\n');
  const b = admin.storage().bucket();
  const filename = `movies/films/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`;
  await b.file(filename).save(fs.readFileSync(outFile), { metadata: { contentType: 'video/mp4' } });
  await b.file(filename).makePublic();
  const url = `https://storage.googleapis.com/${b.name}/${filename}`;

  // Write what stitchTimeline would have written (movies.js recordCut shape).
  const now = new Date().toISOString();
  const cut = {
    id: 'c' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
    url, duration: Math.round(duration * 10) / 10,
    name: 'first cut (stitched locally — server stitch died on the 512MB box)',
    stitchedAt: now,
    frames: used.map(s => ({ sceneId: s.id, title: s.title, panelUrl: s.panel?.url || null, bridge: false })),
  };
  const sig = used.map(s => ({ id: s.id, clipUrl: s.clip?.url || null, tier: s.clip?.tier || null, edits: { ...(s.edits || {}) } }));
  await admin.firestore().collection(process.env.MOVIES_COLLECTION || 'forge-movies').doc(movie.id).set({
    movieUrl: url,
    movieDuration: Math.round(duration * 10) / 10,
    movieStitchedAt: now,
    cuts: [...(movie.cuts || []), cut].slice(-20),
    lastCutSig: sig,
    lastCutBridges: 0,
    job: { kind: 'stitch', status: 'done', done: 14, total: 14, label: 'done (local)', error: null, startedAt: movie.job?.startedAt || now },
    updatedAt: now,
  }, { merge: true });

  const local = process.argv[2];
  if (local) fs.copyFileSync(outFile, local);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(JSON.stringify({ url, duration: +duration.toFixed(2), beats: used.length }));
})().catch(e => { console.error(e.message); process.exit(1); });

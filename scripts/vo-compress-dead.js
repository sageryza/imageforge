#!/usr/bin/env node
// vo-compress-dead.js — compress the dead-air runs vo-verify itself reports.
//
//   node scripts/vo-compress-dead.js in.wav out.wav
//
// Why this exists (2026-08-31, the ant-story cut): vo-remove-pauses and
// vo-tighten-gaps can both leave ~1.0-1.7s runs that vo-verify FAILs on —
// the tightener protects every keep edge across bins above floor+8dB, capped
// at 0.5s+0.06 per side, so around a real cut up to ~1.1s of breathy room
// tone (between floor+8 and speech85-20) survives both tools while the
// verifier calls it dead. This pass closes that gap by asking THE VERIFIER'S
// OWN QUESTION (20ms RMS bins, runs >= 1s below speech85-20dB) and
// compressing each run to ~0.7s (was 0.3 until 2026-08-31 — Sophie: "change the
// rules so long pauses cut to longer - they're too short"; 0.7 stays under the
// verifier's own 1s bar).
//
// The laugh guard is load-bearing: a run holding >= 0.35s SUSTAINED energy
// above floor+10dB is KEPT and named (her laugh measures 0.40s above
// floor+10; breath peaks sit at -27..-33dB with only ~0.2s above it).
// Run it on the OUTPUT of the other tools — it cuts only what the delivery
// gate would reject, so it cannot eat a pause detection protected. A pause
// she ASKED for still needs protecting by name (vo-verify --keep), same as
// ever. Splice boundaries move, so runs can shift/merge across a pass —
// iterate with vo-verify until PASS (2 passes sufficed on the ant story).
// Output is PCM in a .wav (like vo-tighten-gaps — an .mp3 OUT fails ffmpeg).
const fs = require('fs'), path = require('path'), os = require('os'), { execFile } = require('child_process');
const FF = process.env.FFMPEG_PATH || require('ffmpeg-static');
const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('usage: vo-compress-dead.js in.wav out.wav'); process.exit(1); }
const run = (a, t = 600000) => new Promise((res, rej) => execFile(FF, a, { timeout: t, maxBuffer: 1 << 27 }, (e, so, se) => e ? rej(new Error(String(se || e.message).slice(-400))) : res({ stderr: se })));
(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-'));
  const raw = path.join(TMP, 'r.pcm');
  await run(['-y', '-i', IN, '-f', 's16le', '-ac', '1', '-ar', '16000', raw]);
  const b = fs.readFileSync(raw), bin = 320, n = Math.floor(b.length / 2 / bin), p = new Float32Array(n);
  for (let i = 0; i < n; i++) { let a = 0; for (let j = 0; j < bin; j++) { const v = b.readInt16LE((i * bin + j) * 2) / 32768; a += v * v; } p[i] = 10 * Math.log10(a / bin + 1e-10); }
  const D = n * 0.02;
  const S = [...p].sort((a, b) => a - b), floor = S[Math.floor(n * .08)], sp = S[Math.floor(n * .85)];
  const dead = sp - 20, laugh = floor + 10;
  const runs = []; let s = -1;
  for (let i = 0; i <= n; i++) { const d = i < n && p[i] < dead; if (d && s < 0) s = i; if (!d && s >= 0) { if ((i - s) * 0.02 >= 1.0) runs.push([s * 0.02, i * 0.02]); s = -1; } }
  const cuts = [];
  for (const [a, bb] of runs) {
    let best = 0, cur = 0;
    for (let i = Math.round(a / 0.02); i < Math.round(bb / 0.02); i++) { if (p[i] > laugh) { cur += 0.02; best = Math.max(best, cur); } else cur = 0; }
    if (best >= 0.35) { console.log(`keep ${a.toFixed(1)}-${bb.toFixed(1)} (sustained voicing ${best.toFixed(2)}s — laugh guard)`); continue; }
    cuts.push([a + 0.35, bb - 0.35]);
  }
  if (!cuts.length) { console.log('nothing to cut'); fs.copyFileSync(IN, OUT); fs.rmSync(TMP, { recursive: true, force: true }); return; }
  const segs = []; let cur2 = 0; for (const [a, bb] of cuts) { if (a - cur2 > 0.02) segs.push([cur2, a]); cur2 = bb; } if (D - cur2 > 0.02) segs.push([cur2, D]);
  const parts = segs.map((g, i) => `[0:a]atrim=start=${g[0].toFixed(3)}:end=${g[1].toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.012,afade=t=out:st=${Math.max(0, g[1] - g[0] - 0.012).toFixed(3)}:d=0.012[a${i}]`).join(';');
  await run(['-y', '-i', IN, '-filter_complex', `${parts};${segs.map((_, i) => `[a${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[o]`, '-map', '[o]', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', OUT]);
  const rem = cuts.reduce((x, [a, bb]) => x + (bb - a), 0);
  console.log(`${cuts.length} runs compressed, ${rem.toFixed(1)}s removed | ${D.toFixed(1)}s -> ${(D - rem).toFixed(1)}s`);
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch(e => { console.error('FAILED ' + e.message); process.exit(1); });

#!/usr/bin/env node
// vo-verify.js — VERIFY a finished cut of Sophie's voice before delivering it.
//
//   node scripts/vo-verify.js cut.mp4|cut.mp3 [--script script.txt] [--min 1.0]
//
// Why this exists (Aug 2026, learned on the Evan film): a chat delivered two
// films it described as "dead air gone" that were full of gaps, then delivered
// the FIX and would have reported it clean too — because the verifier measured
// silence against the room-tone FLOOR. Sophie's floor wobbles several dB (fan,
// blanket), so a genuinely dead 6.8s stretch keeps breaking on noise blips and
// reports as "no runs". "The code removed them" is not verification.
//
// Two checks, both required before handing a cut back:
//   1. DEAD AIR — 20ms RMS profile, silence defined RELATIVE TO SPEECH
//      (speech85 - 20dB), with a blip tolerance so a noise tick inside a gap
//      doesn't split the run. Never `silencedetect`, never floor-relative.
//   2. SPEECH LOSS — chunked re-transcription vs the expected script, aligned
//      with an LCS so CONTIGUOUS missing runs (a deleted sentence) are
//      separated from scattered ASR noise. A bag-of-words ratio cannot tell
//      those apart and will pass a cut that ate a whole line.
//
// The transcription chunker RETRIES: a single DNS blip once put the literal
// words "dns resolution failed" into a transcript and faked a 31.5% loss.
//
// Env: OPENAI_API_KEY (only needed for --script). ffmpeg from ffmpeg-static.
const fs = require('fs');
const { spawn, spawnSync, execFileSync } = require('child_process');
const FFMPEG = process.env.FFMPEG_PATH || require('ffmpeg-static');
const FFPROBE = process.env.FFPROBE_PATH || require('ffprobe-static').path;
const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const FILE = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--script' && args[args.indexOf(a) - 1] !== '--min');
const SCRIPT = flag('script'); const MINRUN = Number(flag('min', '1.0'));
if (!FILE) { console.error('usage: vo-verify.js cut.mp4 [--script script.txt] [--min 1.0]'); process.exit(1); }
const BIN = 320, BLIP = 3; // 20ms bins @16k; <=60ms above threshold doesn't break a run

function profile(file) {
  return new Promise((res) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '16000', '-']);
    const prof = []; let carry = Buffer.alloc(0);
    // folded STREAMING — an hour of decoded PCM is ~115MB and the server has 512MB
    p.stdout.on('data', (d) => {
      const buf = carry.length ? Buffer.concat([carry, d]) : d;
      const n = Math.floor(buf.length / 2 / BIN);
      for (let i = 0; i < n; i++) { let a = 0;
        for (let k = 0; k < BIN; k++) { const v = buf.readInt16LE((i * BIN + k) * 2) / 32768; a += v * v; }
        prof.push(10 * Math.log10(a / BIN + 1e-10)); }
      carry = buf.subarray(n * BIN * 2);
    });
    p.on('close', () => res(prof));
  });
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const BADBODY = /dns resolution|resolver error|bad gateway|<html/i;
async function transcribeChunk(f, at) {
  for (let a = 1; a <= 5; a++) {
    try {
      const fd = new FormData();
      fd.append('file', new Blob([fs.readFileSync(f)], { type: 'audio/mpeg' }), 'c.mp3');
      fd.append('model', 'whisper-1'); fd.append('response_format', 'text');
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, body: fd });
      const t = (await r.text()).trim();
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 80));
      if (BADBODY.test(t) && t.split(/\s+/).length < 25) throw new Error('error body returned as text');
      return t;
    } catch (e) { if (a === 5) throw e; await new Promise(x => setTimeout(x, 2000 * a)); }
  }
}
function missingRuns(want, got) { // LCS backtrack -> contiguous runs of script words never heard
  const n = want.length, m = got.length; let prev = new Int32Array(m + 1); const bt = [];
  for (let i = 1; i <= n; i++) { const cur = new Int32Array(m + 1), row = new Uint8Array(m + 1);
    for (let k = 1; k <= m; k++) {
      if (want[i - 1] === got[k - 1]) { cur[k] = prev[k - 1] + 1; row[k] = 1; }
      else if (prev[k] >= cur[k - 1]) { cur[k] = prev[k]; row[k] = 2; } else { cur[k] = cur[k - 1]; row[k] = 3; } }
    bt.push(row); prev = cur; }
  let i = n, k = m; const miss = [];
  while (i > 0 && k > 0) { const r = bt[i - 1][k]; if (r === 1) { i--; k--; } else if (r === 2) { miss.push(i - 1); i--; } else k--; }
  while (i > 0) { miss.push(i - 1); i--; }
  miss.reverse();
  const runs = []; for (const x of miss) { const l = runs[runs.length - 1];
    if (l && x === l[l.length - 1] + 1) l.push(x); else runs.push([x]); }
  return { miss, runs };
}
(async () => {
  let fail = false;
  const prof = await profile(FILE);
  const sorted = [...prof].sort((a, b) => a - b);
  const speech = sorted[Math.floor(prof.length * 0.85)], floor = sorted[Math.floor(prof.length * 0.08)];
  const thr = speech - 20;
  const quiet = prof.map(v => v < thr); const runs = []; let s = -1, blip = 0;
  for (let i = 0; i < quiet.length; i++) {
    if (quiet[i]) { if (s < 0) s = i; blip = 0; }
    else if (s >= 0) { if (++blip > BLIP) { const e = i - blip; if ((e - s) * 0.02 >= MINRUN) runs.push([s * 0.02, e * 0.02]); s = -1; blip = 0; } } }
  if (s >= 0 && (quiet.length - s) * 0.02 >= MINRUN) runs.push([s * 0.02, quiet.length * 0.02]);
  const fmt = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');
  console.log(`${FILE}`);
  console.log(`  ${(prof.length * 0.02 / 60).toFixed(2)} min | speech ${speech.toFixed(1)}dB | floor ${floor.toFixed(1)}dB | silence < ${thr.toFixed(1)}dB`);
  console.log(`  dead-air runs >= ${MINRUN}s: ${runs.length}${runs.length ? ` (${runs.reduce((a, [x, y]) => a + (y - x), 0).toFixed(1)}s)` : ''}`);
  runs.slice(0, 25).forEach(([a, b]) => console.log(`    ${fmt(a)} -> ${fmt(b)}  (${(b - a).toFixed(2)}s)`));
  if (runs.length) fail = true;
  if (SCRIPT) {
    if (!process.env.OPENAI_API_KEY) { console.error('  OPENAI_API_KEY required for --script'); process.exit(1); }
    const d = Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FILE]).toString().trim());
    const parts = [];
    for (let t = 0; t < d; t += 75) {
      execFileSync(FFMPEG, ['-y', '-ss', String(t), '-t', '75', '-i', FILE, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '4', '/tmp/_vv.mp3'], { stdio: 'ignore' });
      parts.push(await transcribeChunk('/tmp/_vv.mp3', t));
    }
    const got = norm(parts.join(' ')), want = norm(fs.readFileSync(SCRIPT, 'utf8'));
    const { miss, runs: mr } = missingRuns(want, got);
    const match = 2 * (want.length - miss.length) / (want.length + got.length);
    const long = mr.filter(r => r.length >= 4);
    console.log(`  script ${want.length} | heard ${got.length} | match ${(match * 100).toFixed(1)}%`);
    console.log(`  contiguous missing runs >= 4 words: ${long.length}`);
    long.slice(0, 15).forEach(r => console.log(`    @${r[0]} (${r.length}) ${want.slice(r[0], r[0] + r.length).join(' ')}`));
    if (match < 0.93 || long.length) fail = true;
  }
  console.log(fail ? '\nFAIL — do not deliver this cut' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('vo-verify FAILED: ' + e.message); process.exit(1); });

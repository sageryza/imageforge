#!/usr/bin/env node
// vo-remove-pauses.js — remove NOISY pauses from voice-memo narration.
//
//   node scripts/vo-remove-pauses.js in.mp3 out.mp3 [--script script.txt]
//                                    [--edits edits.json] [--keep 0.28]
//
// Why this exists (Aug 2026, learned on the Tolle shorts): breath/mouth/room
// noise in a phone recording sits at ~-20dB RMS after loudnorm — only 4-7dB
// under quiet speech — so NO absolute silence threshold can find those pauses
// (silencedetect at -32dB reported "no pauses" in audio a human heard as full
// of them). Full-file Whisper is no help either: it drops whole stretches on
// long files and fakes multi-second phantom gaps. What works is below; see
// docs/nde-precise-cutting.md ("Noisy pauses") for the full findings.
//
// Pass 1 — breath pauses, located by WORD TIMING + relative energy:
//   * chunked whisper-1 word timestamps (75s chunks — short files stay honest)
//   * a hidden pause shows as an inflated word span (a short word "lasting"
//     >0.55s + 0.07s/char — whisper folds trailing noise into the word) or an
//     inter-word gap > 0.4s
//   * inside [word.start, nextWord.start]: 20ms RMS profile; speech ends at
//     the last bin within 6dB of the window's OWN peak; safety: skip if any
//     bin in the would-be cut is within 5dB of that peak
// Pass 2 — room-tone runs: floor = 8th percentile of all 20ms bins; any run
//   >= 0.45s within 4dB of the floor is a residual gap.
// Both passes COMPRESS a pause to ~KEEP seconds (default 0.28) — never delete.
// Verification (with --script): chunked re-transcription word-ratio >= 0.93 or
// the run FAILS. Machine verification, never by ear.
//
// Env: OPENAI_API_KEY. ffmpeg from ffmpeg-static (or FFMPEG_PATH).
//
// IT CAN UNDER-CUT A NOISY ROOM — measured 2026-08-25 on the dating-reel takes.
// This ran clean, reported 30.7s removed, and left ~95s of gaps (one 25.4s
// hole): pass 2's floor-relative bar (floor+4dB) never fires when the room
// tone itself wobbles within 3dB of the floor, and pass 1's sustained-energy
// veto protects handling noise that whisper transcribes as nothing but that
// sits at speech level. vo-verify PASSES such a cut — its bar is DEAD air
// (speech85-20dB), not gaps. When the output still feels loose, check the
// word timings for gaps and reach for scripts/vo-tighten-gaps.js, which cuts
// from word timing on the ORIGINAL and caps the laugh/breath protection.
// Full measurement: docs/dating-book/reel/README.md.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

const FFMPEG = process.env.FFMPEG_PATH || (() => { try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; } })();
const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const [IN, OUT] = args.filter(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--script' && args[args.indexOf(a) - 1] !== '--edits' && args[args.indexOf(a) - 1] !== '--keep');
const KEEP = Number(flag('keep', '0.28'));
const SCRIPT = flag('script');
const EDITS = flag('edits');
if (!IN || !OUT) { console.error('usage: vo-remove-pauses.js in.mp3 out.mp3 [--script t.txt] [--edits e.json] [--keep 0.28]'); process.exit(1); }
if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY required'); process.exit(1); }
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vorp-'));

const run = (a, t = 600000) => new Promise((res, rej) =>
  execFile(FFMPEG, a, { timeout: t, maxBuffer: 128 * 1024 * 1024 }, (e, so, se) => e ? rej(Object.assign(new Error((se || e.message).slice(-300)), { stderr: se })) : res({ stdout: so, stderr: se })));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

async function duration(file) {
  const { stderr } = await run(['-i', file, '-f', 'null', '-']).catch(e => e);
  const m = String(stderr || '').match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 0;
}
async function whisperWords(file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'w.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, body: form,
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.words || []).map(w => ({ word: String(w.word || '').trim(), start: +w.start || 0, end: +w.end || 0 }));
}
async function chunkWords(file) {
  const dur = await duration(file);
  const all = [];
  for (let s = 0; s < dur; s += 75) {
    const c = path.join(TMP, 'chunk.mp3');
    await run(['-y', '-ss', String(s), '-t', '75', '-i', file, '-c:a', 'libmp3lame', '-q:a', '3', c]);
    for (const w of await whisperWords(c)) all.push({ word: w.word, start: w.start + s, end: w.end + s });
  }
  return { words: all, dur };
}
async function rmsProfile(file) {
  const raw = path.join(TMP, 'raw.pcm');
  await run(['-y', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '16000', raw]);
  const buf = fs.readFileSync(raw);
  const bin = 320; // 20ms @16k
  const n = Math.floor(buf.length / 2 / bin);
  const prof = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let j = 0; j < bin; j++) { const v = buf.readInt16LE((i * bin + j) * 2) / 32768; acc += v * v; }
    prof[i] = 10 * Math.log10(acc / bin + 1e-10);
  }
  return prof;
}
const at = (prof, t) => prof[Math.max(0, Math.min(prof.length - 1, Math.round(t / 0.02)))];

function breathCuts(words, prof, speechRef) {
  // v2 (thump-and-drift fix): a loud TRANSIENT inside a pause (a phone set
  // down) must not veto the cut — only SUSTAINED speech-level audio does —
  // and the cut's END comes from sustained energy resume, not the next
  // word's whisper start (whisper inflates that backward across a pause).
  const at = (t) => prof[Math.max(0, Math.min(prof.length - 1, Math.round(t / 0.02)))];
  const sustained = (i, thr, k) => { for (let j = 0; j < k; j++) { if (i + j >= prof.length || prof[i + j] <= thr) return false; } return true; };
  const thr = speechRef - 7;
  const raw = [];
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i], nx = words[i + 1];
    const inflated = (w.end - w.start) > 0.55 + 0.07 * w.word.length;
    const nxInflated = (nx.end - nx.start) > 0.55 + 0.07 * nx.word.length;
    if ((nx.start - w.end) < 0.4 && !inflated && !nxInflated) continue;
    const a = Math.round(w.start / 0.02), b = Math.min(prof.length - 1, Math.round(Math.min(nx.end, w.start + 10) / 0.02));
    if ((b - a) * 0.02 < 0.5) continue;
    let se = a;
    for (let j = a; j < b; j++) if (prof[j] > thr && (j - a) * 0.02 < 1.2) se = j; else if ((j - a) * 0.02 >= 1.2) break;
    let rs = -1;
    for (let j = se + Math.round(0.25 / 0.02); j < b; j++) if (sustained(j, thr, 8)) { rs = j; break; }
    if (rs === -1) continue;
    const cs = se * 0.02 + 0.10, ce = rs * 0.02 - 0.10;
    if (ce - cs < 0.35) continue;
    let veto = false;
    for (let j = Math.round(cs / 0.02); j < Math.round(ce / 0.02); j++) if (sustained(j, thr, 10)) { veto = true; break; }
    if (veto) continue;
    raw.push([cs + KEEP / 2, ce - KEEP / 2]);
  }
  // merge overlaps: adjacent inflated words flag the SAME pause; unmerged
  // overlaps double-count removal and corrupt arithmetic timing remaps.
  raw.sort((x, y) => x[0] - y[0]);
  const cuts = [];
  for (const c of raw.filter(([x, y]) => y - x > 0.05)) {
    if (cuts.length && c[0] <= cuts[cuts.length - 1][1] + 0.05) cuts[cuts.length - 1][1] = Math.max(cuts[cuts.length - 1][1], c[1]);
    else cuts.push([c[0], c[1]]);
  }
  return cuts;
}
function roomToneCuts(prof) {
  const sorted = [...prof].sort((a, b) => a - b);
  const floor = sorted[Math.floor(prof.length * 0.08)];
  const cuts = []; let s = -1;
  for (let i = 0; i < prof.length; i++) {
    if (prof[i] < floor + 4) { if (s < 0) s = i; }
    else { if (s >= 0 && (i - s) * 0.02 >= 0.45) cuts.push([s * 0.02 + KEEP / 2, i * 0.02 - KEEP / 2]); s = -1; }
  }
  if (s >= 0 && (prof.length - s) * 0.02 >= 0.45) cuts.push([s * 0.02 + KEEP / 2, prof.length * 0.02 - KEEP / 2]);
  return cuts.filter(([a, b]) => b - a > 0.05);
}
async function applyCuts(inFile, cuts, outFile, dur) {
  if (!cuts.length) { fs.copyFileSync(inFile, outFile); return; }
  const segs = []; let cur = 0;
  for (const [s, e] of cuts) { segs.push([cur, s]); cur = e; }
  segs.push([cur, dur]);
  const parts = segs.map((sg, i) => `[0:a]atrim=start=${sg[0].toFixed(3)}:end=${sg[1].toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`).join(';');
  const graph = `${parts};${segs.map((_, i) => `[a${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[out]`;
  // Codec must match the output container. This always wrote libmp3lame, so a
  // .wav out-name produced mp3-in-wav — which decoded 15s SHORT on a real memo
  // (tail truncated: the Mason metaphor-machine ending was silently lost).
  const codec = /\.wav$/i.test(outFile) ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-q:a', '2'];
  await run(['-y', '-i', inFile, '-filter_complex', graph, '-map', '[out]', '-ar', '44100', '-ac', '1', ...codec, outFile]);
}
// difflib-style ratio over token arrays (same idea editor.js uses)
function ratio(a, b) {
  const m = new Map();
  let matches = 0;
  for (const t of a) m.set(t, (m.get(t) || 0) + 1);
  for (const t of b) { const c = m.get(t) || 0; if (c > 0) { matches++; m.set(t, c - 1); } }
  return (2 * matches) / (a.length + b.length || 1);
}

(async () => {
  console.log('pass 1: breath pauses (word timing + relative energy)');
  const { words, dur } = await chunkWords(IN);
  const prof1 = await rmsProfile(IN);
  const sortedRef = [...prof1].sort((a, b) => a - b);
  const speechRef = sortedRef[Math.floor(prof1.length * 0.85)];
  const cuts1 = breathCuts(words, prof1, speechRef);
  const mid = path.join(TMP, 'mid.mp3');
  await applyCuts(IN, cuts1, mid, dur);
  const rm1 = cuts1.reduce((x, [a, b]) => x + (b - a), 0);
  console.log(`  ${cuts1.length} cuts, ${rm1.toFixed(1)}s removed`);

  console.log('pass 2: room-tone runs');
  const prof2 = await rmsProfile(mid);
  const cuts2 = roomToneCuts(prof2);
  const dur2 = await duration(mid);
  await applyCuts(mid, cuts2, OUT, dur2);
  const rm2 = cuts2.reduce((x, [a, b]) => x + (b - a), 0);
  console.log(`  ${cuts2.length} cuts, ${rm2.toFixed(1)}s removed`);
  console.log(`total: ${(rm1 + rm2).toFixed(1)}s removed → ${(dur - rm1 - rm2).toFixed(1)}s`);

  if (EDITS) fs.writeFileSync(EDITS, JSON.stringify({ pass1: cuts1, pass2: cuts2, keep: KEEP, inDur: dur }, null, 1));

  if (SCRIPT) {
    console.log('verify: chunked re-transcription vs script');
    const { words: vw } = await chunkWords(OUT);
    const score = ratio(vw.flatMap(w => norm(w.word)), norm(fs.readFileSync(SCRIPT, 'utf8')));
    console.log(`  word match ${(score * 100).toFixed(1)}%`);
    if (score < 0.93) { console.error('FAILED verification (<93%) — do not ship this output'); process.exit(1); }
  }
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch(e => { console.error('FAILED: ' + e.message); process.exit(1); });

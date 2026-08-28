// evan-v18 — her note "cut sweet lady jane part", applied to v17.
//
// v17 says "I was walking to Sweet Lady Jane when I found this video about
// this guy." She asked for the Sweet Lady Jane part gone. The shot under it
// is the SAME still either side of the cut (her walking, looking at her
// phone — units 7/8 'walking' in build-v17's PLAN), and "I was walking" is
// what gives that picture its line, so ONLY the words "to Sweet Lady Jane"
// come out: "I was walking when I found this video about this guy."
//
// This is a surgical cut on the FINISHED v17, not a re-derivation from her
// Cutting Blocks marks — the whole span sits inside one shot, so removing
// the same span from both streams leaves every later shot where it was.
//
// THE BOUNDARY WAS MEASURED, NOT READ OFF A WORD LIST. Whisper's word times
// put "walking" ending at 53.80 and "to" at 53.80-54.00; a 20ms RMS profile
// says the voiced run ends at 53.86, then a 0.13s stop closure, then "to"
// at 54.00-54.07. Cutting at 54.10 (the word list's answer) left "to"
// audible — the read-back came back "I was walking to sleep when", and
// probe cuts ending at 53.87 / 53.95 / 54.00 read "I was walking." /
// "I was walking to school." / "I was walking to school." That is the
// README's own rule from v17: word times LOCATE, energy TRIMS.
//
//   cut = [53.8667, 54.7000]  (frames 1616..1640 at 30fps, 25 frames)
//
// The tail lands 0.155s before "when", which is the gap that was there in
// v17 (54.700-54.855) — cutting to the frame nearest the words instead left
// 0.075s and the join read as one word.
//
// DO NOT rebuild the video with `select`+`setpts` in one pass: it silently
// ends the video stream at ~204s while the container still reports the
// audio's 263s duration, i.e. the v13 defect (video < audio) with nothing
// erroring. Two segment encodes plus the concat demuxer is the house
// recipe and is what this script does.
//
// Free — ffmpeg on our own box, no model call. Whisper was used only to
// verify (~10c across the read-backs).
//
// Run:  node scripts/evan-v14-rebuild/build-v18.js [--out <dir>]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const FFMPEG = require(path.join(REPO, 'node_modules', 'ffmpeg-static'));
const FFPROBE = require(path.join(REPO, 'node_modules', 'ffprobe-static')).path;

const SRC = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v17.mp4';
const FPS = 30;
const F0 = 1616;            // first frame removed
const F1 = 1641;            // first frame kept again
const CUT0 = F0 / FPS;      // 53.8667
const CUT1 = F1 / FPS;      // 54.7000
const FADE = 0.012;         // the house 12ms seam fade

const argOut = process.argv.indexOf('--out');
const DIR = argOut > -1 ? process.argv[argOut + 1]
  : fs.mkdtempSync(path.join(os.tmpdir(), 'evan-v18-'));
fs.mkdirSync(DIR, { recursive: true });
const p = (f) => path.join(DIR, f);
const run = (args) => execFileSync(FFMPEG, ['-nostdin', '-v', 'error', ...args], { stdio: 'inherit' });
const dur = (f) => Number(execFileSync(FFPROBE,
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).toString().trim());

(async () => {
  const src = p('v17.mp4');
  if (!fs.existsSync(src)) {
    console.log('fetching v17…');
    const r = await fetch(SRC);
    if (!r.ok) throw new Error('v17 fetch ' + r.status);
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
  }

  // ── audio: splice the span out of the decoded master, fade the seam ──────
  run(['-i', src, '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', p('a.wav'), '-y']);
  spliceWav(p('a.wav'), p('a18.wav'), CUT0, CUT1, FADE);

  // ── video: two segment encodes, then the concat demuxer ─────────────────
  const V = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an'];
  run(['-i', src, '-t', CUT0.toFixed(6), ...V, p('segA.mp4'), '-y']);
  run(['-ss', CUT1.toFixed(6), '-i', src, ...V, p('segB.mp4'), '-y']);
  fs.writeFileSync(p('list.txt'), "file 'segA.mp4'\nfile 'segB.mp4'\n");

  const out = p('evan-v18.mp4');
  run(['-f', 'concat', '-safe', '0', '-i', p('list.txt'), '-i', p('a18.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', out, '-y']);

  // the v13 gate: the picture must never run short of the voice
  const v = dur(p('segA.mp4')) + dur(p('segB.mp4'));
  const a = dur(p('a18.wav'));
  if (v + 1e-3 < a) throw new Error(`video ${v.toFixed(3)} < audio ${a.toFixed(3)}`);
  console.log(`v18: ${dur(out).toFixed(3)}s  (video ${v.toFixed(3)}, audio ${a.toFixed(3)})`);
  console.log(out);
})();

function spliceWav(inFile, outFile, t0, t1, fade) {
  const b = fs.readFileSync(inFile);
  // minimal canonical-wav reader: find 'data', keep everything before it
  let off = 12, dataOff = -1, dataLen = 0, sr = 44100;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const len = b.readUInt32LE(off + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(off + 12);
    if (id === 'data') { dataOff = off + 8; dataLen = len; break; }
    off += 8 + len + (len % 2);
  }
  if (dataOff < 0) throw new Error('no data chunk');
  const head = b.subarray(0, dataOff);
  const pcm = b.subarray(dataOff, dataOff + dataLen);
  const i0 = Math.round(t0 * sr) * 2;
  const i1 = Math.round(t1 * sr) * 2;
  const a = Buffer.from(pcm.subarray(0, i0));
  const c = Buffer.from(pcm.subarray(i1));
  const F = Math.round(fade * sr);
  for (let k = 0; k < F; k++) {
    const ai = a.length - (F - k) * 2;
    if (ai >= 0) a.writeInt16LE(Math.round(a.readInt16LE(ai) * ((F - 1 - k) / F)), ai);
    const ci = k * 2;
    if (ci + 1 < c.length) c.writeInt16LE(Math.round(c.readInt16LE(ci) * (k / F)), ci);
  }
  const body = Buffer.concat([a, c]);
  const out = Buffer.from(head);
  out.writeUInt32LE(body.length, dataOff - 4);
  out.writeUInt32LE(36 + body.length, 4);
  fs.writeFileSync(outFile, Buffer.concat([out, body]));
}

// evan-v19 — her Spider-Man reorder, read off her live Cutting Blocks marks.
//
// Her note was two words, "spider-man switches", and the answer was not in
// the film — it was in the PAGE. She split b05 in the Cutting Blocks page
// (`GET /api/chatfeed/verdict?chat=cutting-blocks-artifact&sheet=blocks-s96`)
// and moved a piece, so the whole instruction is in `__order`:
//
//   was  … b04, b05,                    b06 …
//   now  … b04, b05@0, b05@17, b05@11,  b06 …
//
// with `__seg:b05@11 = "b05:11-17"` and `__seg:b05@17 = "b05:17-27"`.
// b05's 27 words are "He said, wouldn't it be cool to live in a world |
// where everything's like Spider Man, and | people can do stuff and they
// have special powers. I—", so 0/17/11 puts the Spider-Man clause LAST:
//
//   "…wouldn't it be cool to live in a world — people can do stuff and
//    they have special powers — where everything's like Spider-Man, and"
//
// READ HER MARKS, DON'T GUESS FROM THE FILM. Diffing the verdict doc
// against an earlier pull named the change exactly; reading the three
// segment texts flat (without hearing the liaison at the seam) made it
// look like broken English, which it is not.
//
// The whole reorder happens INSIDE one shot (shot 4, 21.6-35.8s, the
// Spider-Man wall) and the three spans keep their total length, so
// NOTHING downstream moves and the VIDEO IS NOT RE-ENCODED — v19 is v18's
// video stream with a new audio track (`-c:v copy`). Seconds, not minutes.
//
// Boundaries measured on a 10ms RMS profile, per v17's rule (word times
// LOCATE, energy TRIMS):
//   "world" | "where"   dip 23.52-23.62, bottom 23.56  -> split 23.565
//   "and"   | "people"  dip 25.89-26.01               -> split 25.95
//   "powers."  ends 28.07, silence to 28.39           -> end   28.10
// Ending C at 28.10 leaves the 0.3s beat before her "I said, no…" in the
// TAIL, which is what keeps the moved "…and" from running into her line.
//
// Free — ffmpeg on our own box. Whisper only for the read-back gate.
//
// Run:  node scripts/evan-v14-rebuild/build-v19.js [--out <dir>]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const FFMPEG = require(path.join(REPO, 'node_modules', 'ffmpeg-static'));
const FFPROBE = require(path.join(REPO, 'node_modules', 'ffprobe-static')).path;

const SRC = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v18.mp4';
const AB = 23.565;   // A | B  ("…in a world" | "where everything's…")
const BC = 25.950;   // B | C  ("…Spider Man, and" | "people can do stuff…")
const C1 = 28.100;   // end of C ("…special powers.")
const FADE = 0.012;  // the house 12ms seam fade

const argOut = process.argv.indexOf('--out');
const DIR = argOut > -1 ? process.argv[argOut + 1]
  : fs.mkdtempSync(path.join(os.tmpdir(), 'evan-v19-'));
fs.mkdirSync(DIR, { recursive: true });
const p = (f) => path.join(DIR, f);
const run = (args) => execFileSync(FFMPEG, ['-nostdin', '-v', 'error', ...args], { stdio: 'inherit' });
const dur = (f) => Number(execFileSync(FFPROBE,
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).toString().trim());

(async () => {
  const src = p('v18.mp4');
  if (!fs.existsSync(src)) {
    console.log('fetching v18…');
    const r = await fetch(SRC);
    if (!r.ok) throw new Error('v18 fetch ' + r.status);
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
  }

  run(['-i', src, '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', p('a18.wav'), '-y']);
  const before = swapWav(p('a18.wav'), p('a19.wav'), AB, BC, C1, FADE);

  const out = p('evan-v19.mp4');
  run(['-i', src, '-i', p('a19.wav'), '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out, '-y']);

  // the reorder must not change the length — anything else means a bad span
  const after = dur(p('a19.wav'));
  if (Math.abs(after - before) > 1e-3) throw new Error(`length moved ${before} -> ${after}`);
  console.log(`v19: ${dur(out).toFixed(3)}s (audio unchanged in length: ${after.toFixed(4)}s)`);
  console.log(out);
})();

/** Swap the two spans [ab,bc) and [bc,c1) in a canonical mono s16 wav,
 *  fading 12ms at each of the three new seams. Returns the input length. */
function swapWav(inFile, outFile, ab, bc, c1, fade) {
  const b = fs.readFileSync(inFile);
  let off = 12, dataOff = -1, dataLen = 0, sr = 44100;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const len = b.readUInt32LE(off + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(off + 12);
    if (id === 'data') { dataOff = off + 8; dataLen = len; break; }
    off += 8 + len + (len % 2);
  }
  if (dataOff < 0) throw new Error('no data chunk');
  const head0 = b.subarray(0, dataOff);
  const pcm = b.subarray(dataOff, dataOff + dataLen);
  const s = (t) => Math.round(t * sr) * 2;

  const head = Buffer.from(pcm.subarray(0, s(ab)));
  const B = Buffer.from(pcm.subarray(s(ab), s(bc)));
  const C = Buffer.from(pcm.subarray(s(bc), s(c1)));
  const tail = pcm.subarray(s(c1));

  const F = Math.round(fade * sr);
  const fadeIn = (buf) => { for (let k = 0; k < F && k * 2 + 1 < buf.length; k++) buf.writeInt16LE(Math.round(buf.readInt16LE(k * 2) * (k / F)), k * 2); };
  const fadeOut = (buf) => { for (let k = 0; k < F; k++) { const i = buf.length - (F - k) * 2; if (i >= 0) buf.writeInt16LE(Math.round(buf.readInt16LE(i) * ((F - 1 - k) / F)), i); } };
  fadeOut(head); fadeIn(C); fadeOut(C); fadeIn(B); fadeOut(B);

  const body = Buffer.concat([head, C, B, tail]);
  const outHead = Buffer.from(head0);
  outHead.writeUInt32LE(body.length, dataOff - 4);
  outHead.writeUInt32LE(36 + body.length, 4);
  fs.writeFileSync(outFile, Buffer.concat([outHead, body]));
  return dataLen / 2 / sr;
}

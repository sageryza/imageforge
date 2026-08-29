// evan-v20 — the "where" put back in, and the walking line crossed out.
//
// Two of her notes on v19, and one answer that was already in her marks:
//
// 1. "Can you make the Spider-Man thing make sense with the word where added
//    in the right place?" — v19's reorder leaves "…live in a world | people
//    can do stuff…". A COPY of her own "where" (the one now leading the
//    Spider-Man clause) goes in after "world", so it reads:
//      "…live in a world WHERE people can do stuff and they have special
//       powers, WHERE everything's like Spider-Man, and"
//    Her word, her voice, twice — nothing synthesised.
//
// 2. "What you call a pink highlight was me crossing that part out, get rid
//    of it." Her pink covered "when I found this video about this guy." —
//    and "to Sweet Lady Jane" was already out in v18, so the whole sentence
//    goes. "I was walking" goes with it: on its own it is a two-word
//    sentence about nothing, and the walking picture still carries "Later,
//    I found out the science behind it." Named here because it is two words
//    more than she struck through.
//      → "Later, I found out the science behind it. He's a scientist in
//         England. So I decided to test that hypothesis."
//
// 3. "did u cut the wish we didn't line?" — NO. `b07@8` ("I said, we do
//    live in that world, and I wish we didn't.") is marked `cut` in HER
//    Cutting Blocks marks, in the same pull that predates every build in
//    this directory. She cut it in the original marking session, so per her
//    instruction it stays cut. Nothing to do, and this note is the record.
//
// EVERYTHING IS FRAME-QUANTISED AT 30fps, because this is the first version
// where the picture has to change too — an insert and a cut, both entirely
// inside ONE shot each (the insert in the Spider-Man wall 21.6-35.8, the cut
// in the walking shot 46.5-58.5), so the shot is only made longer or
// shorter and no boundary moves relative to the words.
//
//   insert 13 frames at frame 707   (0.4333s of "where")
//   drop  frames 1587..1694          (3.6000s, the walking sentence)
//   7903 + 13 - 108 = 7808 frames = 260.2667s   (audio 260.2431s)
//
// The inserted picture is a still lifted from v19 at the insert point and
// held — a duplicate of the frame already on screen, so it is invisible.
// Four segment encodes plus the concat demuxer, the house recipe (never
// `select`+`setpts` in one pass — see the v18 note in the README).
//
// Free — ffmpeg on our own box. Whisper only for the read-back gates.
//
// Run:  node scripts/evan-v14-rebuild/build-v20.js [--out <dir>]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const FFMPEG = require(path.join(REPO, 'node_modules', 'ffmpeg-static'));
const FFPROBE = require(path.join(REPO, 'node_modules', 'ffprobe-static')).path;

const SRC = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v19.mp4';
const FPS = 30;
const INS_F = 707;                 // insert here (inside the Spider-Man shot)
const WLEN_F = 13;                 // length of the "where"
const CUT_F0 = 1587, CUT_F1 = 1695; // drop these frames (the walking sentence)
const W0 = 23.565;                 // the "where" in v19's own audio, at 25.715
const W0_IN_V19 = 25.715;          // …where the v19 reorder actually left it
const FADE = 0.012;

const INS = INS_F / FPS, WLEN = WLEN_F / FPS;
const C0 = CUT_F0 / FPS, C1 = CUT_F1 / FPS;

const argOut = process.argv.indexOf('--out');
const DIR = argOut > -1 ? process.argv[argOut + 1]
  : fs.mkdtempSync(path.join(os.tmpdir(), 'evan-v20-'));
fs.mkdirSync(DIR, { recursive: true });
const p = (f) => path.join(DIR, f);
const run = (args) => execFileSync(FFMPEG, ['-nostdin', '-v', 'error', ...args], { stdio: 'inherit' });
const dur = (f) => Number(execFileSync(FFPROBE,
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).toString().trim());

(async () => {
  const src = p('v19.mp4');
  if (!fs.existsSync(src)) {
    console.log('fetching v19…');
    const r = await fetch(SRC);
    if (!r.ok) throw new Error('v19 fetch ' + r.status);
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
  }

  run(['-i', src, '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', p('a19.wav'), '-y']);
  editWav(p('a19.wav'), p('a20.wav'));

  const V = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an'];
  run(['-ss', INS.toFixed(6), '-i', src, '-frames:v', '1', p('hold.png'), '-y']);
  run(['-i', src, '-t', INS.toFixed(6), ...V, p('s1.mp4'), '-y']);
  run(['-loop', '1', '-i', p('hold.png'), '-t', WLEN.toFixed(6),
    '-vf', 'scale=1000:1500,setsar=1', ...V, p('s2.mp4'), '-y']);
  run(['-ss', INS.toFixed(6), '-i', src, '-t', (C0 - INS).toFixed(6), ...V, p('s3.mp4'), '-y']);
  run(['-ss', C1.toFixed(6), '-i', src, ...V, p('s4.mp4'), '-y']);
  fs.writeFileSync(p('list.txt'), ['s1', 's2', 's3', 's4'].map((s) => `file '${s}.mp4'`).join('\n') + '\n');

  const out = p('evan-v20.mp4');
  run(['-f', 'concat', '-safe', '0', '-i', p('list.txt'), '-i', p('a20.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', out, '-y']);

  const v = ['s1', 's2', 's3', 's4'].reduce((n, s) => n + dur(p(s + '.mp4')), 0);
  const a = dur(p('a20.wav'));
  if (v + 1e-3 < a) throw new Error(`video ${v.toFixed(3)} < audio ${a.toFixed(3)}`);
  console.log(`v20: ${dur(out).toFixed(3)}s (video ${v.toFixed(3)}, audio ${a.toFixed(3)})`);
  console.log(out);
})();

/** head + WHERE + mid + tail, 12ms fades at each of the three seams. */
function editWav(inFile, outFile) {
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

  const head = Buffer.from(pcm.subarray(0, s(INS)));
  const WHERE = Buffer.from(pcm.subarray(s(W0_IN_V19), s(W0_IN_V19) + s(WLEN)));
  const mid = Buffer.from(pcm.subarray(s(INS), s(C0)));
  const tail = Buffer.from(pcm.subarray(s(C1)));

  const F = Math.round(FADE * sr);
  const fi = (x) => { for (let k = 0; k < F && k * 2 + 1 < x.length; k++) x.writeInt16LE(Math.round(x.readInt16LE(k * 2) * (k / F)), k * 2); };
  const fo = (x) => { for (let k = 0; k < F; k++) { const i = x.length - (F - k) * 2; if (i >= 0) x.writeInt16LE(Math.round(x.readInt16LE(i) * ((F - 1 - k) / F)), i); } };
  fo(head); fi(WHERE); fo(WHERE); fi(mid); fo(mid); fi(tail);

  const body = Buffer.concat([head, WHERE, mid, tail]);
  const outHead = Buffer.from(head0);
  outHead.writeUInt32LE(body.length, dataOff - 4);
  outHead.writeUInt32LE(36 + body.length, 4);
  fs.writeFileSync(outFile, Buffer.concat([outHead, body]));
}

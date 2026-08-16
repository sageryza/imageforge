// Build the reel: cut each beat out of the local source, butt them together
// with a short breath between, encode once.
//
// These are a commercial narrator's recordings, not Sophie's voice, and every
// boundary is a sentence edge read straight off the transcript — so this cuts
// on known timestamps rather than going through editor.js's phrase-matching
// cutter, which exists to FIND a span from its words. Boundaries are checked
// afterwards by re-transcribing, not assumed.
const fs = require('fs'), path = require('path');
const FFMPEG = require('ffmpeg-static');
const { execFile } = require('child_process');
const D = process.env.HORNS_DIR || '/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns';
const run = a => new Promise((res, rej) =>
  execFile(FFMPEG, a, { maxBuffer: 1 << 26, timeout: 900000 }, (e, so, se) => e ? rej(new Error(String(se).slice(-500))) : res()));

const GAP = 0.45;          // a breath between beats, not a hard cut
const FADE = 0.05;         // kills the click at each edge
const BEATS = JSON.parse(fs.readFileSync(path.join(__dirname, 'reel-beats.json')));

(async () => {
  const dir = D + '/reel';
  fs.mkdirSync(dir, { recursive: true });
  const parts = [];
  for (const [i, b] of BEATS.entries()) {
    const dur = b.t1 - b.t0;
    const f = `${dir}/b${String(i + 1).padStart(2, '0')}.wav`;
    await run(['-y', '-ss', String(b.t0), '-t', String(dur), '-i', `${D}/${b.src}.webm`, '-vn',
      '-af', `afade=t=in:st=0:d=${FADE},afade=t=out:st=${(dur - FADE).toFixed(3)}:d=${FADE}`,
      '-ar', '44100', '-ac', '1', f]);
    parts.push(f);
    console.log(`b${i + 1}`, b.label, dur.toFixed(1) + 's');
  }
  const sil = `${dir}/gap.wav`;
  await run(['-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-t', String(GAP), sil]);

  const list = `${dir}/list.txt`;
  fs.writeFileSync(list, parts.flatMap((p, i) => i ? [`file '${sil}'`, `file '${p}'`] : [`file '${p}'`]).join('\n'));
  const out = `${D}/clips/reel-v1.mp3`;
  await run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-q:a', '4', out]);
  const total = BEATS.reduce((n, b) => n + (b.t1 - b.t0), 0) + GAP * (BEATS.length - 1);
  console.log('\nreel-v1.mp3', (fs.statSync(out).size / 1e6).toFixed(1) + 'MB',
    `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

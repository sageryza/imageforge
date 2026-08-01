// Align the 8 beat texts to the whisper word timestamps, then cut a tightened
// per-beat audio file from the original recording (internal gaps capped at
// 0.45s kept / replaced by 0.35s silence when longer). Outputs beat-<i>.wav
// (44.1k mono) + timing.json with per-beat durations.
const fs = require('fs');
const { execFileSync } = require('child_process');
const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;

const OUT = '/tmp/claude-0/-home-user/5cf8109c-feb1-5772-9302-0197d40bce90/scratchpad/destiny';
const VO = OUT + '/vo.m4a';
const words = require(OUT + '/vo-words.json').words;

const BEATS = [
  "Here's the honest truth. I didn't know I was a witch. Until one day I got so angry, I made something happen that I couldn't ignore.",
  "Then I thought back through all those weird coincidences in my life that I thought had just been the universe trying to tell me something.",
  "And I realized what I must have known all along. That I wasn't a bystander watching the strange things happen in my life.",
  "But that I was the one causing them. Not literally causing every single thing to happen, but with my emotion, my intention, and my will.",
  "Subtly changing the way my life had been flowing to match what I wanted.",
  "I realized that I had wished for things and then gotten them, almost immediately.",
  "The universe quietly rearranging events to match my desire.",
  "This was a powerful realization, but a little scary. I could no longer be a victim, because I was controlling my own destiny.",
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Sequential alignment: walk the transcript pointer forward beat by beat.
let ptr = 0;
const ranges = [];
for (let bi = 0; bi < BEATS.length; bi++) {
  const beatWords = norm(BEATS[bi]).split(' ');
  const start = ptr;
  let matched = 0;
  while (ptr < words.length && matched < beatWords.length) {
    const tw = norm(words[ptr].word);
    if (tw === beatWords[matched] || matched === beatWords.length - 1) matched++;
    else matched++; // sequential trust: beat texts ARE the transcript in order
    ptr++;
  }
  ranges.push({ beat: bi, from: start, to: ptr - 1 });
}
// sanity: counts
ranges.forEach(r => console.log(`beat ${r.beat}: words ${r.from}-${r.to} | "${words[r.from].word}…${words[r.to].word}" | ${words[r.from].start.toFixed(1)}s-${words[r.to].end.toFixed(1)}s`));
if (ranges[7].to !== words.length - 1) console.warn('WARN: alignment did not consume all words:', ranges[7].to, 'vs', words.length - 1);

const GAP_KEEP = 0.45, GAP_SIL = 0.35, PAD = 0.12;
const timing = [];
for (const r of ranges) {
  // merge words into contiguous segments where gap < GAP_KEEP
  const segs = [];
  let s = words[r.from].start, e = words[r.from].end;
  for (let i = r.from + 1; i <= r.to; i++) {
    const g = words[i].start - e;
    if (g < GAP_KEEP) { e = words[i].end; }
    else { segs.push([s, e]); s = words[i].start; e = words[i].end; }
  }
  segs.push([s, e]);
  // build ffmpeg filter: atrim each seg (with small pad), silence between
  const parts = [];
  const inputs = [];
  segs.forEach((seg, i) => {
    const a = Math.max(0, seg[0] - PAD), b = seg[1] + PAD;
    parts.push(`[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS[s${i}]`);
    inputs.push(`[s${i}]`);
    if (i < segs.length - 1) {
      parts.push(`anullsrc=r=44100:cl=mono,atrim=duration=${GAP_SIL}[g${i}]`);
      inputs.push(`[g${i}]`);
    }
  });
  const filter = parts.join(';') + `;${inputs.join('')}concat=n=${inputs.length}:v=0:a=1,aformat=sample_rates=44100:channel_layouts=mono[out]`;
  const dest = `${OUT}/beat-${r.beat}.wav`;
  execFileSync(FFMPEG, ['-y', '-i', VO, '-filter_complex', filter, '-map', '[out]', dest], { stdio: 'pipe' });
  const dur = parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest]).toString());
  timing.push({ beat: r.beat, duration: dur, segments: segs.length });
  console.log(`beat ${r.beat}: ${dur.toFixed(2)}s (${segs.length} segments)`);
}
fs.writeFileSync(OUT + '/timing.json', JSON.stringify(timing, null, 2));
console.log('total speech:', timing.reduce((a, t) => a + t.duration, 0).toFixed(1), 's');

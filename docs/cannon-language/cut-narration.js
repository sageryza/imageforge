#!/usr/bin/env node
// Cut each shot's narration line out of the audiobook's own voice.
//
// Per shot: extract a ~45s window around the transcript anchor, run whisper-1
// with word timestamps, locate the line by a CONTIGUOUS best-match slide (a
// repeated word later in the window can't stretch the cut), then cut on the
// matched words' own times.
//
// Pads are 0.06s lead / 0.12s tail. They started at 0.18/0.30 on the earlier
// film and dragged the neighbouring word in on four of sixteen cuts.
//
//   node cut-narration.js [--only 3,7] [--window 45]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const AUDIO = process.env.CANNON_AUDIO ||
  '/tmp/claude-0/-home-user/f2896c89-febe-5a45-b7dd-d2f403c0f14e/scratchpad';
const OUTDIR = process.env.CANNON_WORK ||
  '/tmp/claude-0/-home-user/f2896c89-febe-5a45-b7dd-d2f403c0f14e/scratchpad/narration';
const FFMPEG = require('/home/user/imageforge/node_modules/ffmpeg-static');
const KEY = process.env.OPENAI_API_KEY;

const LEAD = 0.06, TAIL = 0.12;
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = argOf('--only', '');
const WIN = Number(argOf('--window', '45'));

fs.mkdirSync(OUTDIR, { recursive: true });
const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots;
// The quoted audiobook lines live outside the repo (it is public), so shots.json
// carries only citations. lines.local.json maps shot number -> the line to cut.
const LINES = JSON.parse(fs.readFileSync(path.join(DIR, 'lines.local.json'), 'utf8'));
for (const s of shots) s.line = LINES[s.n] || s.line;
const want = ONLY ? new Set(ONLY.split(',').map(s => Number(s.trim()))) : null;

const norm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '');

// Contiguous best-match slide, POSITIONAL. Each candidate window is scored by
// how many words match at the same offset, normalised by the longer side, so a
// window shifted by one still-plausible word scores badly instead of perfectly.
//
// This matters: an earlier order-insensitive version ("does the window contain
// this word anywhere") scored an off-by-one window on shot 11 at a clean 1.00,
// and the cut opened on the PREVIOUS sentence's last word and dropped its own.
function locate(words, line) {
  const target = line.split(/\s+/).map(norm).filter(Boolean);
  const hay = words.map(w => norm(w.word));
  let best = { score: -1, i: 0, len: target.length };
  for (let len = Math.max(1, target.length - 2); len <= target.length + 2; len++) {
    for (let i = 0; i + len <= hay.length; i++) {
      let hit = 0;
      const n = Math.min(len, target.length);
      for (let k = 0; k < n; k++) if (hay[i + k] === target[k]) hit++;
      const score = hit / Math.max(len, target.length);
      if (score > best.score) best = { score, i, len };
    }
  }
  return best;
}

const run = (a) => execFileSync(FFMPEG, a, { stdio: ['ignore', 'ignore', 'pipe'] });

async function whisperWords(file) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: fd,
  });
  if (!r.ok) throw new Error(`whisper ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

(async () => {
  const results = {};
  const OUT = path.join(DIR, 'narration.json');
  if (fs.existsSync(OUT)) Object.assign(results, JSON.parse(fs.readFileSync(OUT, 'utf8')));

  for (const s of shots) {
    if (want && !want.has(s.n)) continue;
    const src = path.join(AUDIO, `${s.videoId}.webm`);
    const winStart = Math.max(0, s.anchor - WIN / 2);
    const probe = path.join(OUTDIR, `w${s.n}.mp3`);
    run(['-v', 'error', '-ss', String(winStart), '-t', String(WIN), '-i', src,
      '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '64k', probe, '-y']);

    const j = await whisperWords(probe);
    const words = j.words || [];
    const m = locate(words, s.line);
    const span = words.slice(m.i, m.i + m.len);
    if (!span.length) { console.error(`[${s.n}] NO MATCH`); continue; }

    const start = Math.max(0, span[0].start - LEAD);
    const end = span[span.length - 1].end + TAIL;
    const heard = span.map(w => w.word).join(' ');
    const clip = path.join(OUTDIR, `n${String(s.n).padStart(2, '0')}.wav`);
    run(['-v', 'error', '-ss', String(winStart + start), '-t', String(end - start),
      '-i', src, '-ac', '1', '-ar', '44100', '-af',
      'afade=t=in:st=0:d=0.012,afade=t=out:st=' + Math.max(0, (end - start) - 0.012) + ':d=0.012',
      '-c:a', 'pcm_s16le', clip, '-y']);

    results[s.n] = {
      n: s.n, book: s.book, videoId: s.videoId,
      absStart: +(winStart + start).toFixed(3), absEnd: +(winStart + end).toFixed(3),
      seconds: +(end - start).toFixed(3),
      lineAsPlanned: s.line, lineAsHeard: heard, matchScore: +m.score.toFixed(3),
      wav: clip,
    };
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(`[${String(s.n).padStart(2)}] ${String(results[s.n].seconds).padStart(6)}s  score ${m.score.toFixed(2)}  ${heard.slice(0, 88)}`);
  }
  console.log(`\n${Object.keys(results).length} lines cut → ${OUT}`);
})();

#!/usr/bin/env node
/**
 * SECOND TIGHTENING PASS — repair the edges of a Darius film's clips.
 *
 *   node scripts/darius-retighten.js <heart|proof> [--lead 0.30] [--trail 0.25]
 *
 * Sophie heard the proof film's first clip open on "years" when the line is
 * "I spent … about three years". The cutter is doing its job — it pads the head
 * by at most 0.15s (clampBounds) and the fresh-listen match on these spans came
 * back at 80-82%, so the attack of a short unstressed first word gets shaved.
 *
 * This pass does NOT re-decide which words a clip carries. It takes the clip the
 * Episode Editor already made as the authority on that, finds exactly where it
 * sits in the source interview, and re-cuts the same span with more room at both
 * ends. Nothing about the shared cutter changes — the Cutting Room, Search and
 * every existing episode in the repo use it and must keep the cut they have.
 *
 * FINDING THE CLIP: by RMS ENVELOPE CORRELATION against the source, which is the
 * settling measurement the sophie-audio skill names for exactly this question.
 * Transcribing a clip cannot answer it — whisper drops the opening words of an
 * abruptly-starting clip, so the transcript of a correct cut and of a clipped
 * one read the same.
 *
 * The head is then placed inside real silence where there is any: the extra lead
 * is only useful if it is room tone rather than the tail of the previous word.
 *
 * Needs the source webm in .darius-film/src/<videoId>.webm.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SET = process.argv[2] || 'proof';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? +process.argv[i + 1] : d; };
const LEAD = arg('lead', 0.30);
const TRAIL = arg('trail', 0.03);
/* The head is the only end that needed help. clipDur ALREADY carries the
   editor's own tail padding and its forward-only silence snap, capped at the
   next word — so anything added there just opens the next word and leaves a
   dangling fragment ("...and this is in every near..."). Measured at 0.25s
   trail on the proof clips: s01, s02 and s04 all grew a hanging start-of-word.
   MAXLEAD is only a runaway guard, deliberately generous. Capping it tight was
   wrong and measurably so: the silence-placed start already sits 0.30s of room
   tone before speech RESUMES, so everything between there and the editor's cut
   is speech the editor trimmed — the words we are trying to get back. Capping
   s07 at 0.45s turned "Even the pyramids themselves" back into "The pyramids
   themselves". */
const MAXLEAD = arg('maxlead', 1.5);
/* PHRASE MODE (default on): if the clip still opens mid-sentence, walk back to
   the last real PAUSE and start there. A >=0.25s gap in speech is a sentence
   boundary, and these clips were entering on fragments that change the meaning
   — the heart film's second clip opened on "necessarily a pump" when the line
   is "your heart is NOT necessarily a pump". Bounded by MAXBACK, and hard-
   stopped by the end of any other clip taken from the same interview so two
   shots can never grow into each other and play the same words twice. */
const MAXBACK = arg('maxback', 5.0);
const PHRASE = !process.argv.includes('--no-phrase');
/* TAIL TRIM (default on). The head fix left the ends where the editor put them,
   and Sophie's next listen caught what that leaves: seven of eighteen clips run
   past the end of the thought into the first words of the next one — "And this
   is in every…", "So there's", "Because…". Symmetric to the head: pull the end
   back to the last real pause, bounded, so a clip finishes on a finished
   sentence. Bounded because an unbounded search would happily lop off the last
   proper sentence of a clip to find a pause. */
const MAXTRIM = arg('maxtrim', 2.6);
const TAILCUT = !process.argv.includes('--no-tailcut');

/* Two clips the automatic rule cannot get right, because Darius pauses INSIDE
   the sentence: "I spent, [pause] I would say, about three years" and "and when
   you're in this state, [pause] a controlled state". The >=0.22s sentence-pause
   rule lands on that interior pause and opens the clip on the back half. These
   starts were read off whisper word timestamps for the source window, so they
   are measured, not guessed. Value = an absolute source time in seconds. */
const OVERRIDES = {
  'proof:s01': 374.31,   // "I spent" begins 374.56 — the words Sophie named
  'heart:s04': 282.60,   // "And when you're in this state" begins 282.84
};

/* Three tails the pause rule cannot land, because he pauses AFTER the hanging
   word rather than before it — so the last real silence sits past "which",
   "So" and "And this is". Ends read off whisper word timestamps. */
const TAIL_OVERRIDES = {
  'heart:s03': 275.53,   // ends on "...panic, anxiety, fear" (fear ends 275.28)
  'heart:s07': 864.64,   // ends on "...the entirety of the field" (864.34)
  'proof:s02': 483.58,   // ends on "...you're seeing the truth" (483.28)
};

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, '.darius-film');
const SRC = path.join(DIR, 'src');
const FFMPEG = process.env.FFMPEG_PATH || require('ffmpeg-static');
const FFPROBE = process.env.FFPROBE_PATH || require('ffprobe-static').path;

const HOP = 0.02;           // 20ms envelope, the repo's standard grain
const RATE = 16000;
const SEARCH = 200;         // seconds either side of the anchor to look in

const sh = (b, a) => execFileSync(b, a, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 30 });
const dur = (f) => +sh(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).toString().trim();

/* 20ms RMS envelope of a file, as Float64. Read as raw s16le so nothing has to
   hold a decoded copy of a 90-minute interview as anything but one Buffer. */
function envelope(file, ss, t) {
  const a = ['-v', 'error'];
  if (ss != null) a.push('-ss', String(ss));
  a.push('-i', file);
  if (t != null) a.push('-t', String(t));
  a.push('-ac', '1', '-ar', String(RATE), '-f', 's16le', '-');
  const pcm = sh(FFMPEG, a);
  const per = Math.round(RATE * HOP);
  const n = Math.floor(pcm.length / 2 / per);
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < per; j++) { const v = pcm.readInt16LE((i * per + j) * 2); s += v * v; }
    env[i] = Math.sqrt(s / per);
  }
  return env;
}

/* Normalised cross-correlation of the clip envelope over the source envelope.
   Both are mean-removed so a level difference cannot beat a shape match. */
function locate(src, clip) {
  const m = clip.length;
  let cm = 0; for (let i = 0; i < m; i++) cm += clip[i]; cm /= m;
  const c = new Float64Array(m);
  let cn = 0;
  for (let i = 0; i < m; i++) { c[i] = clip[i] - cm; cn += c[i] * c[i]; }
  cn = Math.sqrt(cn) || 1;

  let best = -Infinity, at = 0;
  for (let o = 0; o + m <= src.length; o++) {
    let sm = 0; for (let i = 0; i < m; i++) sm += src[o + i]; sm /= m;
    let dot = 0, sn = 0;
    for (let i = 0; i < m; i++) { const s = src[o + i] - sm; dot += s * c[i]; sn += s * s; }
    const r = dot / ((Math.sqrt(sn) || 1) * cn);
    if (r > best) { best = r; at = o; }
  }
  return { at, r: best };
}

/* Silences in a small window, so the extra lead lands in room tone rather than
   on the tail of the previous word. */
function silences(file, ss, t) {
  // silencedetect writes to STDERR, and execFileSync only hands back stdout —
  // reading it the easy way returned an empty list every time, which is why the
  // first run gave every clip the flat lead instead of one placed in room tone.
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-ss', String(ss), '-t', String(t),
    '-i', file, '-af', 'silencedetect=noise=-32dB:d=0.12', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  const err = String(r.stderr || '');
  const out = [];
  const re = /silence_start:\s*(-?[\d.]+)[\s\S]*?silence_end:\s*([\d.]+)/g;
  let m;
  while ((m = re.exec(err))) out.push([ss + +m[1], ss + +m[2]]);
  return out;
}

(async () => {
  const st = JSON.parse(fs.readFileSync(path.join(DIR, SET + '.json'), 'utf8'));
  const audio = path.join(DIR, 'audio-' + SET);
  const out = path.join(DIR, 'audio-' + SET + '-v2');
  fs.mkdirSync(out, { recursive: true });
  const report = [];
  const placed = {};   // shot id → {start,end} in source seconds, for the overlap guard

  for (const shot of st.shots) {
    const clipFile = path.join(audio, shot.id + '.mp3');
    const src = path.join(SRC, shot.videoId + '.webm');
    if (!fs.existsSync(clipFile)) throw new Error('no clip for ' + shot.id);
    if (!fs.existsSync(src)) throw new Error('no source ' + shot.videoId);

    const clipDur = dur(clipFile);
    const from = Math.max(0, shot.timeSec - SEARCH);
    const span = SEARCH * 2 + clipDur;

    const sEnv = envelope(src, from, span);
    const cEnv = envelope(clipFile, null, null);
    const { at, r } = locate(sEnv, cEnv);
    const t0 = from + at * HOP;

    // Place the head inside the last silence before the speech, if there is one
    // in reach; otherwise take the flat lead and let the fade handle it.
    const back = PHRASE ? MAXBACK : 1.2;
    const win = silences(src, Math.max(0, t0 - back - 0.4), back + 0.8);
    let start = t0 - LEAD;
    // A SENTENCE pause wins over a nearer breath. Preferring whatever silence
    // was closest left two clips opening mid-phrase ("Is the gateway to the
    // other side", "controlled state and you allow yourself") because a short
    // in-sentence breath sat between the cut and the real sentence start. A gap
    // of >=0.22s is a sentence boundary; anything shorter is breathing.
    const sent = PHRASE ? win.filter(([s, e]) => e <= t0 - 0.05 && (e - s) >= 0.22) : [];
    const near = win.filter(([s, e]) => e <= t0 + 0.06 && e >= t0 - 0.9);
    if (sent.length) {
      const [, e] = sent[sent.length - 1];
      start = Math.max(e - LEAD, t0 - MAXBACK);
    } else if (near.length) {
      const [s, e] = near[near.length - 1];
      start = Math.max(s + 0.03, e - LEAD);       // sit in room tone, not in the previous word
      start = Math.max(start, t0 - MAXLEAD);
    } else start = Math.max(start, t0 - MAXLEAD);

    const forced = OVERRIDES[SET + ':' + shot.id];
    if (forced != null) start = forced;

    // Never grow into another shot cut from the same interview.
    const floor = st.shots
      .filter((o) => o !== shot && o.videoId === shot.videoId && (placed[o.id] || {}).end <= t0)
      .reduce((a, o) => Math.max(a, placed[o.id].end + 0.05), 0);
    start = Math.max(start, floor);
    let end = t0 + clipDur + TRAIL;
    let trimmed = 0;
    if (TAILCUT) {
      const tw = silences(src, end - MAXTRIM - 0.4, MAXTRIM + 1.0)
        .filter(([a, b]) => a <= end - 0.05 && a >= end - MAXTRIM && (b - a) >= 0.22);
      if (tw.length) {
        const [a, b] = tw[tw.length - 1];
        const cut = a + Math.min(0.18, Math.max(0.05, (b - a) * 0.4));
        if (cut > start + 1.5) { trimmed = end - cut; end = cut; }
      }
    }
    const forcedEnd = TAIL_OVERRIDES[SET + ':' + shot.id];
    if (forcedEnd != null) { trimmed = (t0 + clipDur + TRAIL) - forcedEnd; end = forcedEnd; }
    placed[shot.id] = { start, end };

    const dest = path.join(out, shot.id + '.mp3');
    sh(FFMPEG, ['-y', '-ss', start.toFixed(3), '-t', (end - start).toFixed(3), '-i', src,
      '-af', 'afade=t=in:st=0:d=0.012,afade=t=out:st=' + (end - start - 0.012).toFixed(3) + ':d=0.012,loudnorm=I=-16:TP=-1.5:LRA=11',
      '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '3', dest]);

    const gained = (t0 - start);
    void trimmed;
    report.push({ id: shot.id, r: +r.toFixed(3), at: +t0.toFixed(2), lead: +gained.toFixed(3), was: +clipDur.toFixed(2), now: +dur(dest).toFixed(2) });
    console.log(`  ${shot.id}  r=${r.toFixed(3)}  +${gained.toFixed(2)}s head  -${trimmed.toFixed(2)}s tail  ${clipDur.toFixed(1)}s → ${dur(dest).toFixed(1)}s`);
  }

  fs.writeFileSync(path.join(DIR, SET + '-retighten.json'), JSON.stringify(report, null, 1));
  const weak = report.filter((x) => x.r < 0.8);
  console.log(`\n${report.length} clips re-cut into ${path.relative(ROOT, out)}`);
  if (weak.length) console.log('LOW CORRELATION (check these by ear): ' + weak.map((x) => `${x.id} r=${x.r}`).join(', '));
})().catch((e) => { console.error(e.message); process.exit(1); });

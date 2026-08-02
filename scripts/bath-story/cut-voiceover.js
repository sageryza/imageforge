// Cut the "bath" story voiceover into per-panel segments, the precise-cutting
// way (docs/nde-precise-cutting.md): Whisper word timestamps → contiguous
// phrase match → gap-aware padding → silence snapping → micro-fades +
// loudnorm → re-Whisper verification. Reuses editor.js's exported cutting
// functions (the validated JS port) rather than reimplementing them.
// Run from /home/user/imageforge. Needs OPENAI_API_KEY + FIREBASE_SERVICE_ACCOUNT.
// Inputs (already fetched): vo-main.wav + vo-words.json in SCRATCH.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const admin = require('firebase-admin');
const { phraseSpan, clampBounds, snapToSilence, normWords } = require('/home/user/imageforge/editor.js');

const SCRATCH = process.env.BATH_SCRATCH || '/tmp/claude-0/-home-user/3f02d84e-abbd-5c13-b33d-ae39d8184c4b/scratchpad';
const OUT = path.join(SCRATCH, 'bath-audio');
const WAV = path.join(SCRATCH, 'vo-main.wav');
const WORDS_JSON = path.join(SCRATCH, 'vo-words.json');
const FFMPEG = require('/home/user/imageforge/node_modules/ffmpeg-static');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// The whole voiceover, contiguous, in order. `panel` = rendered panel id
// (null = narration stretch with no image described yet — cut anyway so the
// material is ready once Sophie decides its visual).
const SEGMENTS = [
  { id: 's01', panel: 'bath-calm', text: "I've been thinking about how we're kind of a thought experiment that God was having. Imagine you had a thought experiment in the bath," },
  { id: 's02', panel: 'bath-bubble-normal', text: "you're thinking, what would happen if I ran into my ex and then like, I saw him and he had another girlfriend or something. So in your mind, you plan all sorts of possibilities that might take place. But of course, you're controlling the people in your mind, and they do what you say, except sometimes they don't do exactly what you say, and you run the experiment to see what exactly would happen in each set of circumstances." },
  { id: 's03', panel: 'market-good', text: "Like suppose you looked really good that day," },
  { id: 's04', panel: 'market-poof', text: "or suppose you looked really bad." },
  { id: 's05', panel: 'market-bad', text: "You run the experiment and you see the results." },
  { id: 's06', panel: null, text: "Now imagine that in that experiment, these people were actually real people. They had their own mind, and they could make choices that you didn't understand or didn't know about. And you could learn about them through these, you could learn about what would happen through these choices." },
  { id: 's07', panel: null, text: "This I think is what it's like when God created us. He created us in this world where we can experience things, and it's like he's not there thinking about us, even though he actually is, because he wanted us to feel like we were really doing stuff and immersed in the experience to see what would happen. If you want to perform an accurate thought experiment, you can get involved in the choices, right?" },
  { id: 's08', panel: 'bath-bubble-return', text: "Anyway, this got me thinking, what if you had a thought experiment, and then the people in your thought experiment actually came, they actually existed, and the world that you created in your head for the experiment was actually a real world? And it started acting independently of you. I think that is true, actually, to some extent, in that you can't 100% predict what will happen." },
  { id: 's09', panel: 'tree-materialize', text: "But if you were as powerful as God, then you could actually create entire worlds and they would actually become physical." },
  { id: 's10', panel: 'room-materialize', text: "I think Jesus or somebody said this, that the weirdest thing or the most amazing thing is how the mental became physical, meaning that everything you see started as a thought, someone else's thought." },
];

function run(cmd, args, ms = 300000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: ms, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; reject(err); } else resolve({ stdout, stderr });
    });
  });
}

// editor.js doesn't export detectSilences — same ffmpeg silencedetect params.
async function detectSilences(file) {
  let stderr = '';
  try {
    const out = await run(FFMPEG, ['-i', file, '-af', 'silencedetect=noise=-32dB:d=0.2', '-f', 'null', '-']);
    stderr = out.stderr || '';
  } catch (err) { stderr = err.stderr || ''; }
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => parseFloat(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => parseFloat(m[1]));
  const sil = []; let ei = 0;
  for (const s of starts) {
    while (ei < ends.length && ends[ei] <= s) ei++;
    sil.push([s, ei < ends.length ? ends[ei] : s + 0.5]);
  }
  return sil;
}

async function whisperText(file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), path.basename(file));
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, body: form,
  });
  return (await res.text()).trim();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const words = JSON.parse(fs.readFileSync(WORDS_JSON, 'utf8')).words;
  console.log(`words: ${words.length}`);
  const silences = await detectSilences(WAV);
  console.log(`silences: ${silences.length}`);

  // 1) locate every segment, then sanity-check order/coverage
  const located = [];
  for (const seg of SEGMENTS) {
    const span = phraseSpan(words, seg.text);
    if (!span) throw new Error(`${seg.id}: phrase not found`);
    located.push({ ...seg, span });
    console.log(`${seg.id} [${seg.panel || 'no-panel'}]: words ${span.start}-${span.end} score ${span.score.toFixed(3)}`);
  }
  for (let i = 1; i < located.length; i++) {
    const prev = located[i - 1], cur = located[i];
    if (cur.span.start <= prev.span.end) console.warn(`WARN overlap ${prev.id}/${cur.id}`);
    else if (cur.span.start !== prev.span.end + 1) console.warn(`WARN gap ${prev.id}→${cur.id}: words ${prev.span.end + 1}-${cur.span.start - 1} unassigned`);
  }

  // 2) bounds: gap-aware pad + silence snap (end capped at next word's start)
  const manifest = [];
  for (const seg of located) {
    const [p0, p1] = clampBounds(words, seg.span.start, seg.span.end);
    const maxEnd = seg.span.end < words.length - 1 ? words[seg.span.end + 1].start : null;
    const [t0, t1] = snapToSilence(p0, p1, silences, maxEnd);
    const clip = path.join(OUT, `${seg.id}-${seg.panel || 'no-panel'}.mp3`);
    const dur = t1 - t0;
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(t0), '-to', String(t1), '-i', WAV,
      '-af', `afade=t=in:st=0:d=0.03,afade=t=out:st=${Math.max(0, dur - 0.1)}:d=0.1,loudnorm=I=-16:TP=-1.5:LRA=11`,
      '-ac', '1', '-ar', '44100', '-b:a', '192k', clip]);
    manifest.push({ id: seg.id, panel: seg.panel, text: seg.text, wordStart: seg.span.start, wordEnd: seg.span.end,
      start: +t0.toFixed(3), end: +t1.toFixed(3), seconds: +dur.toFixed(2), file: clip });
    console.log(`${seg.id}: cut ${t0.toFixed(2)}s → ${t1.toFixed(2)}s (${dur.toFixed(1)}s)`);
  }

  // 3) tight stitched preview (all segments joined = pauses trimmed)
  const listFile = path.join(OUT, 'concat.txt');
  fs.writeFileSync(listFile, manifest.map(m => `file '${m.file}'`).join('\n'));
  const stitched = path.join(OUT, 'bath-vo-tight.mp3');
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '44100', '-b:a', '192k', stitched]);
  console.log('stitched:', stitched);

  // 4) verify: re-Whisper every clip, compare first/last words
  let allOk = true;
  for (const m of manifest) {
    const heard = normWords(await whisperText(m.file));
    const want = normWords(m.text);
    const okFirst = heard[0] === want[0], okLast = heard[heard.length - 1] === want[want.length - 1];
    const extra = heard.length - want.length;
    m.verify = { okFirst, okLast, wantWords: want.length, heardWords: heard.length,
      heardFirst: heard.slice(0, 3).join(' '), heardLast: heard.slice(-3).join(' ') };
    const flag = okFirst && okLast && Math.abs(extra) <= 1 ? 'OK' : 'CHECK';
    if (flag !== 'OK') allOk = false;
    console.log(`verify ${m.id}: ${flag} first="${m.verify.heardFirst}" last="${m.verify.heardLast}" (${heard.length}/${want.length} words)`);
  }

  // 5) upload clips + stitched + timeline
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();
  for (const m of manifest) {
    const dest = `story-shorts/bath-thought-experiment/audio/${path.basename(m.file)}`;
    await bucket.upload(m.file, { destination: dest, metadata: { contentType: 'audio/mpeg' } });
    await bucket.file(dest).makePublic();
    m.url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    delete m.file;
  }
  const stDest = 'story-shorts/bath-thought-experiment/audio/bath-vo-tight.mp3';
  await bucket.upload(stitched, { destination: stDest, metadata: { contentType: 'audio/mpeg' } });
  await bucket.file(stDest).makePublic();
  const timeline = { source: 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/vo-i-ve-been-thinking-about-how-we-re-1785468461594-ynu1es.m4a',
    stitched: `https://storage.googleapis.com/${bucket.name}/${stDest}`, segments: manifest, verifiedClean: allOk, cutAt: Date.now() };
  const tlLocal = path.join(OUT, 'timeline.json');
  fs.writeFileSync(tlLocal, JSON.stringify(timeline, null, 2));
  await bucket.upload(tlLocal, { destination: 'story-shorts/bath-thought-experiment/audio/timeline.json', metadata: { contentType: 'application/json' } });
  await bucket.file('story-shorts/bath-thought-experiment/audio/timeline.json').makePublic();
  console.log('ALL DONE — verifiedClean:', allOk);
  console.log(JSON.stringify(timeline.segments.map(s => ({ id: s.id, panel: s.panel, start: s.start, end: s.end, seconds: s.seconds })), null, 1));
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

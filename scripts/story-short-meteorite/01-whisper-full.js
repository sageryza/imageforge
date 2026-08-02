// Pass 1: whisper-1 word timestamps over the WHOLE recording (16k mono mp3,
// well under the 25MB cap). These full-file times only pick the right
// OCCURRENCE of each span (the recording has repeated takes); the precise cut
// times come from the per-window re-listen in 02-cut-beats.js, exactly like
// editor.js's no-align-cache fallback path.
const fs = require('fs');
const { execFileSync } = require('child_process');
const FFMPEG = require('ffmpeg-static');
const { OUT, VO_URL } = require('./beats');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const vo = OUT + '/vo.m4a';
  if (!fs.existsSync(vo)) {
    console.log('downloading voiceover…');
    const res = await fetch(VO_URL);
    fs.writeFileSync(vo, Buffer.from(await res.arrayBuffer()));
  }
  const mp3 = OUT + '/vo-16k.mp3';
  if (!fs.existsSync(mp3)) {
    execFileSync(FFMPEG, ['-y', '-i', vo, '-ac', '1', '-ar', '16000', '-b:a', '32k', mp3], { stdio: 'pipe' });
  }
  console.log('whispering full file…', fs.statSync(mp3).size, 'bytes');
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(mp3)], { type: 'audio/mpeg' }), 'vo.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  fs.writeFileSync(OUT + '/vo-words.json', JSON.stringify({ duration: data.duration, words: data.words }, null, 1));
  console.log('words:', data.words.length, 'duration:', data.duration);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

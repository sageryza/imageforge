#!/usr/bin/env node
/**
 * Check where every clip of a Darius film ACTUALLY starts and ends, against
 * the words the span was supposed to carry.
 *
 *   node scripts/darius-verify-cuts.js <heart|proof> [--v2]
 *
 * Sophie caught the proof film's first clip opening on "years" when the line
 * is "I spent … about three years". phraseSpan trims edge words it cannot
 * match in the fresh listen, so a boundary can quietly move inward — the cut
 * is clean, it just starts at the wrong word.
 *
 * THE ONE RULE THAT MAKES THIS MEASUREMENT VALID (sophie-audio skill, learned
 * the expensive way): whisper DROPS the opening words of a clip that starts
 * abruptly mid-speech, so raw-transcribing a cut to check its first words
 * reports "starts late" on audio that is complete. Every clip here is given
 * ~1s of leading silence with `adelay` BEFORE it is transcribed. Without that
 * pad this script would invent the very bug it is looking for.
 *
 * Prints, per clip: the first six words wanted vs heard, the last four wanted
 * vs heard, and flags the ones that disagree. Costs ~$0.006 a minute.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SET = process.argv[2] || 'proof';
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, '.darius-film');
const FFMPEG = process.env.FFMPEG_PATH || require('ffmpeg-static');
const KEY = process.env.OPENAI_API_KEY;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);

async function transcribe(file) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  fd.append('model', 'whisper-1');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + KEY }, body: fd,
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.text || '';
}

(async () => {
  const st = JSON.parse(fs.readFileSync(path.join(DIR, SET + '.json'), 'utf8'));
  const audio = path.join(DIR, 'audio-' + SET + (process.argv.includes('--v2') ? '-v2' : ''));
  const work = fs.mkdtempSync(path.join(DIR, 'verify-'));
  const bad = [];

  for (const shot of st.shots) {
    const mp3 = path.join(audio, shot.id + '.mp3');
    if (!fs.existsSync(mp3)) { console.log(shot.id, 'no audio on disk'); continue; }

    // ~1s of leading silence, or whisper eats the first fast words.
    const padded = path.join(work, shot.id + '.mp3');
    execFileSync(FFMPEG, ['-y', '-i', mp3, '-af', 'adelay=1000|1000', padded], { stdio: 'ignore' });

    const heard = norm(await transcribe(padded));
    const want = norm(shot.text);
    const headW = want.slice(0, 6).join(' ');
    const headH = heard.slice(0, 6).join(' ');
    const tailW = want.slice(-4).join(' ');
    const tailH = heard.slice(-4).join(' ');

    // Did the first wanted word survive anywhere near the front?
    const startOk = heard.slice(0, 4).includes(want[0]) || headH.startsWith(want.slice(0, 2).join(' '));
    const endOk = heard.slice(-4).includes(want[want.length - 1]);
    if (!startOk || !endOk) bad.push({ id: shot.id, startOk, endOk });

    console.log(`\n${shot.id} ${startOk ? '   ' : 'IN '}${endOk ? '   ' : 'OUT'} ${shot.name.slice(0, 46)}`);
    console.log(`   head want: ${headW}`);
    console.log(`   head hear: ${headH}`);
    console.log(`   tail want: ${tailW}`);
    console.log(`   tail hear: ${tailH}`);
  }

  fs.rmSync(work, { recursive: true, force: true });
  console.log(`\n${bad.length} of ${st.shots.length} clips disagree at an edge`);
  bad.forEach((b) => console.log(`  ${b.id}${b.startOk ? '' : ' — starts late'}${b.endOk ? '' : ' — ends early'}`));
})().catch((e) => { console.error(e.message); process.exit(1); });

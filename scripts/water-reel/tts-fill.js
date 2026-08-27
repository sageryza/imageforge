#!/usr/bin/env node
/* tts-fill.js — render ONE stand-in narration line set in a stock voice.
 *
 * Sophie recorded the water reel herself, but the ear-goblins sheet never got
 * a take ("I missed one… just use Laura's voice for that for now",
 * 2026-08-25). This renders that block so the sheet can be in the cut, and it
 * is a PLACEHOLDER by design — when she records it, the source swaps to her
 * wav in build-vo.js and this file is not called again.
 *
 * Laura is the stock voice the earlier TTS cuts (v5-v7) used, so the reel's
 * one borrowed section sounds like the version she already approved.
 * `eleven_multilingual_v2` — never v3 (house rule).
 *
 *   ELEVENLABS_API_KEY=… node scripts/water-reel/tts-fill.js --out b.wav \
 *     --text "One. Water flushes out…"
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const ffmpeg = require('ffmpeg-static');

const VOICE = 'FGY2WhTYpPnrIDTdsKH5'; // Laura — Enthusiast, Quirky Attitude
const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const OUT = args.out, TEXT = args.text;
if (!OUT || !TEXT) { console.error('need --out <wav> --text "…"'); process.exit(1); }
const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
if (!key) { console.error('no ELEVENLABS_API_KEY'); process.exit(1); }

(async () => {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: TEXT,
      model_id: 'eleven_multilingual_v2',
      // excited, at her ask on v6 ("can you make her more excited?"): low
      // stability lets the read move, style pushes the performance.
      voice_settings: { stability: 0.32, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true },
    }),
  });
  if (!r.ok) { console.error(`elevenlabs ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
  const mp3 = `${OUT}.mp3`;
  fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  // pad half a second either side so whisper never clips the opening word —
  // the same margin her own sliced takes get in build-vo.js
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', mp3,
    '-af', 'adelay=500|500,apad=pad_dur=0.5', '-c:a', 'pcm_s16le', OUT]);
  console.log(`${OUT} — ${(fs.statSync(mp3).size / 1024).toFixed(0)}KB of mp3, padded to wav`);
})().catch((e) => { console.error(e.message); process.exit(1); });

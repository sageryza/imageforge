#!/usr/bin/env node
// openrouter-video.js — send ONE Seedance job through OpenRouter, from a
// container. The second Seedance door (CLAUDE.md, "A SEEDANCE JOB WITH NO
// VIDEO REFERENCE GOES THROUGH OPENROUTER"): OpenRouter bills ByteDance's
// list price (480p 2.5 ≈ 10.9¢/s all in against APIFRAME's 13¢), but
// ByteDance's own filter refuses reference VIDEOS with people that APIFRAME
// accepts (measured 2026-09-08), so this door takes text, pictures and audio
// only and REFUSES a --video outright.
//
//   OPENROUTER_API_KEY=… node scripts/openrouter-video.js \
//     --prompt-file scene.txt --seconds 4 --res 480p --ratio 3:4 \
//     [--img <url>]… [--audio <url>]… [--model bytedance/seedance-2.5] \
//     [--no-audio] [--out clip.mp4] [--dry]
//
// Her "go" rule is unchanged and lives in the chat, not here: show the
// model, seconds, resolution, the exact prompt and every reference, wait for
// "go", THEN run this. It prints the exact body before sending and the job's
// usage after. A content refusal from ByteDance (…SensitiveContent…) is
// terminal — it never retries, never changes the prompt, never tries another
// envelope (the mistake that drew an unapproved clip on 2026-09-08). There is
// no cancel on OpenRouter: the charge lands the moment a job is accepted.
// No server door and no video-log entry yet — file the prompt and the
// references in the reply by hand.
const fs = require('fs');

const args = process.argv.slice(2);
const opt = { img: [], audio: [], video: [], model: 'bytedance/seedance-2.5', res: '480p', ratio: '3:4', seconds: 4, genAudio: true };
for (let i = 0; i < args.length; i++) {
  const a = args[i], v = args[i + 1];
  if (a === '--prompt-file') { opt.prompt = fs.readFileSync(v, 'utf8'); i++; }
  else if (a === '--prompt') { opt.prompt = v; i++; }
  else if (a === '--img') { opt.img.push(v); i++; }
  else if (a === '--audio') { opt.audio.push(v); i++; }
  else if (a === '--video') { opt.video.push(v); i++; }
  else if (a === '--seconds') { opt.seconds = Number(v); i++; }
  else if (a === '--res') { opt.res = v; i++; }
  else if (a === '--ratio') { opt.ratio = v; i++; }
  else if (a === '--model') { opt.model = v; i++; }
  else if (a === '--out') { opt.out = v; i++; }
  else if (a === '--no-audio') opt.genAudio = false;
  else if (a === '--dry') opt.dry = true;
  else { console.error('unknown arg', a); process.exit(2); }
}
if (opt.video.length) { console.error('REFUSED: a reference video goes through APIFRAME (POST /api/apiframe/video), not this door — see CLAUDE.md.'); process.exit(2); }
if (!opt.prompt) { console.error('--prompt-file or --prompt required'); process.exit(2); }
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY && !opt.dry) { console.error('OPENROUTER_API_KEY not set'); process.exit(2); }

const body = {
  model: opt.model, prompt: opt.prompt, duration: opt.seconds, resolution: opt.res,
  aspect_ratio: opt.ratio, generate_audio: opt.genAudio,
};
const refs = [
  ...opt.img.map((url) => ({ type: 'image_url', image_url: { url } })),
  ...opt.audio.map((url) => ({ type: 'audio_url', audio_url: { url } })),
];
if (refs.length) body.input_references = refs;

console.log('SENDING (exact body):'); console.log(JSON.stringify(body, null, 1));
if (opt.dry) process.exit(0);

const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const r = await fetch('https://openrouter.ai/api/v1/videos', { method: 'POST', headers: H, body: JSON.stringify(body) });
  const txt = await r.text();
  if (r.status !== 202 && r.status !== 200) {
    console.error('REFUSED', r.status, txt.slice(0, 1200));
    process.exit(1); // terminal: never retried, never reshaped
  }
  const job = JSON.parse(txt);
  console.log('accepted', job.id, '— polling every 15s (no cancel exists; the charge has landed)');
  for (;;) {
    await sleep(15000);
    const pr = await fetch(job.polling_url || `https://openrouter.ai/api/v1/videos/${job.id}`, { headers: H });
    const d = await pr.json();
    console.log(new Date().toISOString(), d.status, d.usage ? JSON.stringify(d.usage) : '');
    if (d.status === 'completed') {
      const url = (d.unsigned_urls || [])[0] || `https://openrouter.ai/api/v1/videos/${job.id}/content?index=0`;
      const vr = await fetch(url, { headers: H });
      const buf = Buffer.from(await vr.arrayBuffer());
      const out = opt.out || `openrouter-${job.id}.mp4`;
      fs.writeFileSync(out, buf);
      console.log('saved', buf.length, 'bytes →', out, '| usage', JSON.stringify(d.usage || {}));
      return;
    }
    if (['failed', 'cancelled', 'expired'].includes(d.status)) { console.error('ENDED', JSON.stringify(d).slice(0, 1200)); process.exit(1); }
  }
})().catch((e) => { console.error(e); process.exit(1); });

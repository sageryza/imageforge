#!/usr/bin/env node
// atlascloud-video.js — send ONE Seedance job through Atlas Cloud's
// reference-to-video endpoint, from a container (the third door; see
// atlascloud.js). Nothing has been measured on this door yet — no price, no
// canvas, no face-filter behaviour — so the first run is the measurement.
//
//   ATLASCLOUD_API_KEY=… node scripts/atlascloud-video.js \
//     --prompt-file scene.txt --seconds 4 --res 480p --ratio 16:9 \
//     [--img <url>]… [--video <url>]… [--audio <url>]… \
//     [--model bytedance/seedance-2.0-mini/reference-to-video] \
//     [--no-audio] [--seed N] [--out clip.mp4] [--dry]
//
// Her "go" rule is unchanged and lives in the chat, not here: show the
// model, seconds, resolution, the exact prompt and every reference, wait for
// "go", THEN run this. It prints the exact body before sending and the
// prediction's token counts after. A refusal is terminal — it never retries,
// never changes the prompt, never tries another shape. No server door and
// no video-log entry from here — prefer POST /api/atlascloud/video, which
// logs; if you must run this, write the prompt and references up by hand.
const fs = require('fs');
const a = require('../atlascloud');

const args = process.argv.slice(2);
const opt = { img: [], audio: [], video: [], model: a.DEFAULT_MODEL, res: '480p', ratio: '16:9', seconds: 4, genAudio: true };
for (let i = 0; i < args.length; i++) {
  const x = args[i], v = args[i + 1];
  if (x === '--prompt-file') { opt.prompt = fs.readFileSync(v, 'utf8'); i++; }
  else if (x === '--prompt') { opt.prompt = v; i++; }
  else if (x === '--img') { opt.img.push(v); i++; }
  else if (x === '--audio') { opt.audio.push(v); i++; }
  else if (x === '--video') { opt.video.push(v); i++; }
  else if (x === '--seconds') { opt.seconds = Number(v); i++; }
  else if (x === '--res') { opt.res = v; i++; }
  else if (x === '--ratio') { opt.ratio = v; i++; }
  else if (x === '--model') { opt.model = v; i++; }
  else if (x === '--seed') { opt.seed = Number(v); i++; }
  else if (x === '--out') { opt.out = v; i++; }
  else if (x === '--no-audio') opt.genAudio = false;
  else if (x === '--dry') opt.dry = true;
  else { console.error('unknown arg', x); process.exit(2); }
}
if (!opt.prompt) { console.error('--prompt-file or --prompt required'); process.exit(2); }
const KEY = process.env.ATLASCLOUD_API_KEY;
if (!KEY && !opt.dry) { console.error('ATLASCLOUD_API_KEY not set'); process.exit(2); }

const built = a.buildRequest({ prompt: opt.prompt, model: opt.model, duration: opt.seconds, resolution: opt.res,
  aspectRatio: opt.ratio, generateAudio: opt.genAudio, seed: opt.seed,
  referenceImageUrls: opt.img, referenceVideoUrls: opt.video, referenceAudioUrls: opt.audio });
if (built.error) { console.error('REFUSED before sending:', built.error); process.exit(2); }
const body = built.body;
console.log('SENDING (exact body):'); console.log(JSON.stringify(body, null, 1));
if (opt.dry) process.exit(0);

const BASE = 'https://api.atlascloud.ai/api/v1';
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const r = await fetch(BASE + '/model/generateVideo', { method: 'POST', headers: H, body: JSON.stringify(body) });
  const txt = await r.text();
  if (!r.ok) { console.error('REFUSED', r.status, txt.slice(0, 1200)); process.exit(1); } // terminal
  const j = JSON.parse(txt);
  const id = j.data && j.data.id;
  if (!id) { console.error('no prediction id', txt.slice(0, 600)); process.exit(1); }
  console.log('accepted', id, '— polling every 10s');
  for (;;) {
    await sleep(10000);
    const pr = await fetch(`${BASE}/model/prediction/${id}`, { headers: { Authorization: `Bearer ${KEY}` } });
    const d = ((await pr.json()) || {}).data || {};
    console.log(new Date().toISOString(), d.status, d.total_tokens != null ? `tokens ${d.completion_tokens}/${d.total_tokens}` : '');
    const st = a.apiframeStatus(d.status);
    if (st === 'COMPLETED') {
      const url = (d.outputs || [])[0];
      const vr = await fetch(url);
      const buf = Buffer.from(await vr.arrayBuffer());
      const out = opt.out || `atlascloud-${id}.mp4`;
      fs.writeFileSync(out, buf);
      console.log('saved', buf.length, 'bytes →', out, '| tokens', d.completion_tokens, '/', d.total_tokens, '| source', url);
      return;
    }
    if (st === 'FAILED') { console.error('ENDED', JSON.stringify(d).slice(0, 1200)); process.exit(1); }
  }
})().catch((e) => { console.error(e); process.exit(1); });

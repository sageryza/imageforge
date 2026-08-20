// shoot-v2.js — the LIVE-ACTION re-shoot of the Vibrilify MAX spot.
// Sophie (2026-08-20): "i thought these would be live action" — the Movies
// pipeline attaches a drawn style ref to every panel with no per-movie
// opt-out, so the photoreal panels render HERE, with the pipeline's own
// params mirrored exactly (gpt-image-2, 1024x1536, medium, output_format
// webp, NO output_compression) and the same chained-continuity technique
// (first photo + previous photo attached to every edit). Uploads land in
// movies/panels/ in the deckfactory bucket; urls + the exact sent prompt go
// to state-v2-shots.json for the movie doc and the asset filing.
// Usage: node scripts/vibrilify/shoot-v2.js [startIndex]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const KEY = process.env.OPENAI_API_KEY;
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec-v2.json'), 'utf8'));
const outFile = path.join(__dirname, 'state-v2-shots.json');
const shots = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};

const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });

// The style halves (Claude's wording, disclosed in the delivery reply).
const PHOTO = 'Cinematic still from a glossy American TV pharmaceutical commercial, photorealistic, shot on a digital cinema camera, shallow depth of field, soft diffused light, real people with natural skin texture. ';
const GRADE = {
  cold: PHOTO + 'Cold, desaturated blue-gray color grade, quiet suburban gloom. ',
  warm: PHOTO + 'Golden-hour warm color grade, gently overexposed, dreamlike serenity. ',
  card: '', // the end card's whole description lives in its content prompt
};
const CONTINUITY = 'For continuity: the attached photos are earlier shots of this same commercial — the SAME actress (a woman in her mid-30s with shoulder-length wavy brown hair, wearing a lavender cardigan over a white tee) and the same suburban world; keep her face, hair and wardrobe IDENTICAL and the world consistent; do not recast her. ';

async function generate(prompt) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1536', quality: 'medium', output_format: 'webp' }),
    timeout: 300000,
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return Buffer.from(d.data[0].b64_json, 'base64');
}

async function edit(prompt, refs) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  refs.forEach((buf, i) => form.append('image[]', buf, { filename: `ref${i}.webp`, contentType: 'image/webp' }));
  form.append('size', '1024x1536');
  form.append('quality', 'medium');
  form.append('output_format', 'webp');
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, ...form.getHeaders() }, body: form, timeout: 300000,
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return Buffer.from(d.data[0].b64_json, 'base64');
}

async function upload(buf) {
  const b = admin.storage().bucket();
  const filename = `movies/panels/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webp`;
  await b.file(filename).save(buf, { metadata: { contentType: 'image/webp' } });
  await b.file(filename).makePublic();
  return `https://storage.googleapis.com/${b.name}/${filename}`;
}

(async () => {
  const start = Number(process.argv[2]) || 0;
  const bufs = {};
  const fetchShot = async i => Buffer.from(await (await fetch(shots[i].url)).arrayBuffer());
  for (let i = start; i < spec.scenes.length; i++) {
    const s = spec.scenes[i];
    if (shots[i]?.url) { process.stderr.write(`shot ${i} already done\n`); continue; }
    const isCard = s.grade === 'card';
    let prompt, buf;
    if (isCard || i === 0) {
      prompt = GRADE[s.grade] + s.imagePrompt;
      if (i === 0) buf = await generate(prompt);
      else buf = await generate(prompt);
    } else {
      const refs = [];
      if (!bufs[0]) bufs[0] = shots[0] ? await fetchShot(0) : null;
      if (bufs[0]) refs.push(bufs[0]);
      const prevIdx = i - 1 >= 0 && spec.scenes[i - 1].grade !== 'card' ? i - 1 : null;
      if (prevIdx !== null && prevIdx !== 0) {
        if (!bufs[prevIdx]) bufs[prevIdx] = await fetchShot(prevIdx);
        refs.push(bufs[prevIdx]);
      }
      prompt = CONTINUITY + GRADE[s.grade] + s.imagePrompt;
      buf = await edit(prompt, refs);
    }
    bufs[i] = buf;
    const url = await upload(buf);
    shots[i] = { url, promptUsed: prompt, quality: 'medium', at: Date.now() };
    fs.writeFileSync(outFile, JSON.stringify(shots, null, 1));
    process.stderr.write(`shot ${i} "${s.title}" → ${url.slice(-24)}\n`);
  }
  console.log(JSON.stringify({ done: Object.keys(shots).length }));
})().catch(e => { console.error(e.message); process.exit(1); });

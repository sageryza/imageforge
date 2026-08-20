// shoot-v3.js — the v3 pickup shots from Sophie's v2 review (new MoA blob
// pair, moon wink, with-the-chimes, tell-everyone; re-shot market + picnic).
// Only scenes marked shoot:true render; everything else keeps its v2 photo.
// Refs policy is HER note ("getting grainy — I think you keep reattaching
// them"): people-shots chain ONLY the first-generation kitchen photo as the
// identity ref — never generated-from-generated chains. matchShot attaches
// one named v2 shot as the same-shot-moments-earlier composition ref (the
// chimes pair needs it). MoA renders attach nothing.
// Usage: node scripts/vibrilify/shoot-v3.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const KEY = process.env.OPENAI_API_KEY;
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec-v3.json'), 'utf8'));
const v2shots = JSON.parse(fs.readFileSync(path.join(__dirname, 'state-v2-shots.json'), 'utf8'));
const outFile = path.join(__dirname, 'state-v3-shots.json');
const shots = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};

const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });

// Style halves (Claude's wording, disclosed in the delivery reply). PHOTO /
// cold / warm are verbatim from shoot-v2; night and moa are new for v3.
const PHOTO = 'Cinematic still from a glossy American TV pharmaceutical commercial, photorealistic, shot on a digital cinema camera, shallow depth of field, soft diffused light, real people with natural skin texture. ';
const GRADE = {
  cold: PHOTO + 'Cold, desaturated blue-gray color grade, quiet suburban gloom. ',
  warm: PHOTO + 'Golden-hour warm color grade, gently overexposed, dreamlike serenity. ',
  night: PHOTO + 'Cool blue moonlit night grade, serene and slightly uncanny. ',
  moa: 'Frame from the 3D mechanism-of-action animation inside a TV pharmaceutical commercial: glossy soft-body render, smooth blobby translucent shapes with subsurface glow, clean pale background, soft studio lighting, shallow depth of field. ',
  card: '',
};
const CONTINUITY = 'For continuity: the FIRST attached photo is an earlier shot of this same commercial — the SAME actress (a woman in her mid-30s with shoulder-length wavy brown hair, wearing a lavender cardigan over a white tee) and the same suburban world; keep her face, hair and wardrobe IDENTICAL and the world consistent; do not recast her. ';
const MATCH = 'The SECOND attached photo is the SAME SHOT of this commercial a few moments LATER — compose this frame to match its framing, location and lighting exactly, showing the moment BEFORE it: her hair and sleeves still fully normal, not yet turning into wind chimes. ';

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
  const fetchUrl = async u => Buffer.from(await (await fetch(u)).arrayBuffer());
  let identity = null;
  for (let i = 0; i < spec.scenes.length; i++) {
    const s = spec.scenes[i];
    if (!s.shoot) continue;
    if (shots[i]?.url) { process.stderr.write(`shot ${i} already done\n`); continue; }
    let prompt, buf;
    if (s.grade === 'moa') {
      prompt = GRADE.moa + s.imagePrompt;
      buf = await generate(prompt);
    } else {
      if (!identity) identity = await fetchUrl(v2shots[0].url);
      const refs = [identity];
      let pre = CONTINUITY;
      if (typeof s.matchShot === 'number' && v2shots[s.matchShot]) {
        refs.push(await fetchUrl(v2shots[s.matchShot].url));
        pre += MATCH;
      }
      prompt = pre + GRADE[s.grade] + s.imagePrompt;
      buf = await edit(prompt, refs);
    }
    const url = await upload(buf);
    shots[i] = { url, promptUsed: prompt, quality: 'medium', at: Date.now() };
    fs.writeFileSync(outFile, JSON.stringify(shots, null, 1));
    process.stderr.write(`shot ${i} "${s.title}" → ${url.slice(-24)}\n`);
  }
  console.log(JSON.stringify({ done: Object.keys(shots).length }));
})().catch(e => { console.error(e.message); process.exit(1); });

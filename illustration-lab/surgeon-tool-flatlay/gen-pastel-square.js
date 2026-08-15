// One-off: the Playground's Pastel recipe, but SQUARE (1024x1024) instead of
// its fixed 2:3. Same refs, same prefix, same suffix, same whiten pass.
const admin = require('firebase-admin');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: `${sa.project_id}.firebasestorage.app`,
});
const bucket = admin.storage().bucket();

const PREFIX = 'Use the attached images ONLY as a STYLE reference for the linework: ' +
  'bold confident black ink outlines, flat colors with NO gradients and minimal ' +
  'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, ' +
  'on a plain white background, playful modern editorial illustration.';
const SUFFIX = 'Absolutely no text, no words, no letters, no numbers, no captions.';
const CONTENT = process.argv[2];
const FULL = `${PREFIX}\n\n${CONTENT}\n\n${SUFFIX}`;
const REFS = ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'];
const QUALITY = 'medium', SIZE = '1024x1024';

async function whitenBackground(buf, tol = 46) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const idx = (x, y) => (y * W + x) * C;
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const tol2 = tol * tol;
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= tol2; };
  const visited = new Uint8Array(W * H), stack = [];
  const pushIf = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (visited[p] || !close(idx(x, y))) return; visited[p] = 1; stack.push(p); };
  for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
  for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p - x) / W; pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < W * H; p++) if (visited[p]) { const i = p * C; out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; if (C === 4) out[i + 3] = 255; }
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).webp().toBuffer();
}

(async () => {
  const refs = await Promise.all(REFS.map(async p => (await bucket.file(p).download())[0]));
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', FULL);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'webp');
  form.append('output_compression', '80');
  refs.forEach((b, i) => form.append('image[]', b, { filename: `ref${i + 1}.png`, contentType: 'image/png' }));
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form, timeout: 300000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  let buf = Buffer.from(data.data[0].b64_json, 'base64');
  try { buf = await whitenBackground(buf); } catch (e) { console.warn('whiten failed:', e.message); }
  const name = `promptlab/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const file = bucket.file(name);
  await file.save(buf, { metadata: { contentType: 'image/webp' } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${name}`;
  fs.writeFileSync(process.argv[3] || '/tmp/out.webp', buf);
  console.log(JSON.stringify({ url, ms: Date.now() - started, created: started, fullPrompt: FULL }, null, 2));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

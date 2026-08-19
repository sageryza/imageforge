// One pastel 2:3 PORTRAIT panel per beat (1024x1536 = exactly 2:3) —
// gpt-image-2 EDITS with the witch-school style refs, house character + a
// consistent ex-boyfriend design, whitened background. Same style constants
// as server.js MODELS.house[house-pastel]; concurrency 3 with retry.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { OUT, BEATS, PROJECT } = require('./beats');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const STYLE = 'Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration. ';
const CHAR = 'Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants. ';
const CHAR2 = 'Where the ex-boyfriend appears, keep him consistent: a tall young man with short dark brown hair, a plain grey crewneck sweatshirt and dark trousers, clean-shaven. ';
const END = ' Vertical 2:3 portrait composition. Absolutely no text, no words, no letters, no numbers, no captions.';

async function whiten(buf) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const idx = (x, y) => (y * W + x) * C;
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const tol2 = 46 * 46;
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= tol2; };
  const visited = new Uint8Array(W * H), stack = [];
  const pushIf = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (visited[p] || !close(idx(x, y))) return; visited[p] = 1; stack.push(p); };
  for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
  for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p - x) / W; pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < W * H; p++) if (visited[p]) { const i = p * C; out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; if (C === 4) out[i + 3] = 255; }
  return await require('sharp')(out, { raw: { width: W, height: H, channels: C } }).webp({ lossless: true }).toBuffer();
}

async function editWithRefs(prompt, refs, retries = 2) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', '1024x1536');
      form.append('quality', 'medium');
      form.append('output_format', 'webp');
      refs.forEach((b, i) => form.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i + 1}.png`));
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'edit error');
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image returned');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      console.warn(`  attempt ${a + 1} failed: ${err.message}`);
      if (a < retries) await new Promise(r => setTimeout(r, 2000 * (a + 1)));
    }
  }
  throw lastErr;
}

(async () => {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();

  console.log('downloading style refs…');
  const refs = [];
  for (const p of ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png']) {
    const [buf] = await bucket.file(p).download();
    refs.push(buf);
  }
  console.log('refs ok:', refs.map(r => r.length));

  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  const jobs = BEATS.map((b, i) => ({ beat: i, content: b.content }))
    .filter(p => !only || only.includes(p.beat));

  const manifest = [];
  const queue = [...jobs];
  const failures = [];
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const local = path.join(OUT, `panel-${p.beat}.webp`);
      try {
        if (fs.existsSync(local) && !process.env.FORCE) { console.log(`beat ${p.beat}: exists, skip render`); }
        else {
          console.log(`beat ${p.beat}: rendering…`);
          const t0 = Date.now();
          let buf = await editWithRefs(STYLE + CHAR + CHAR2 + p.content + END, refs);
          try { buf = await whiten(buf); } catch (e) { console.warn('whiten failed:', e.message); }
          fs.writeFileSync(local, buf);
          console.log(`  beat ${p.beat} done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${buf.length} bytes)`);
        }
        const dest = `story-shorts/${PROJECT}/panel-${p.beat}.webp`;
        await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/webp' } });
        await bucket.file(dest).makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
        console.log(`  beat ${p.beat} uploaded → ${url}`);
        manifest.push({ beat: p.beat, content: p.content, url, madeAt: Date.now() });
      } catch (e) {
        console.error(`beat ${p.beat} FAILED: ${e.message}`);
        failures.push(p.beat);
      }
    }
  });
  await Promise.all(workers);
  manifest.sort((a, b) => a.beat - b.beat);
  fs.writeFileSync(path.join(OUT, 'panels.json'), JSON.stringify(manifest, null, 2));
  if (failures.length) { console.error('FAILURES:', failures); process.exit(1); }
  console.log('ALL DONE', manifest.length, 'panels');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

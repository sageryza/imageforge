// Render "Controlling My Own Destiny" beats as vertical house-pastel panels.
// Style = the Test Station "Pastel (house)" (MODELS.house house-pastel in
// server.js): gpt-image-2 EDITS with the witch-school style refs, whitened bg.
// Run from /home/user/imageforge so node_modules resolve.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const OUT = '/tmp/claude-0/-home-user/5cf8109c-feb1-5772-9302-0197d40bce90/scratchpad/destiny';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Same values as server.js MODELS.house[house-pastel] + witch-school-cards DEFAULT_CHAR
const STYLE = 'Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration. ';
const CHAR = 'Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants. ';
const END = ' Vertical composition. Absolutely no text, no words, no letters, no numbers, no captions.';

const PANELS = [
  { beat: 0, content: 'The woman stands in a small kitchen at night, fists clenched at her sides, face furious, as a drinking glass on the counter beside her shatters into pieces that hover in the air, with small sparks drifting around them.' },
  { beat: 1, content: 'The woman sits cross-legged on the floor, looking up at a swirl of floating round thought bubbles orbiting her head, each bubble holding one tiny odd coincidence: a ringing telephone, a black cat, a four-leaf clover, a falling star.' },
  { beat: 2, content: 'A small crowd of onlookers in the background points up at a glowing spiral of stars in the sky, while the woman stands apart in the foreground, looking down quietly at her own softly glowing hands.' },
  { beat: 3, content: 'Close portrait of the woman with eyes closed and a calm slight smile, three thin ribbons of light curling out from her heart and her temples, with small objects riding the ribbons: a coin, a leaf, a tiny star.' },
  { beat: 4, content: 'The woman kneels beside a winding stream that flows across the scene, touching the water with one fingertip, and downstream of her finger the stream visibly bends away into a new path.' },
  { beat: 5, content: 'The woman whispers into her cupped hands, releasing a tiny glowing star that arcs up into the air, and the same star curves back down toward her other open palm carrying a small wrapped gift.' },
  { beat: 6, content: 'The woman walks calmly forward along a garden path while behind and ahead of her, faint constellation lines like gentle puppet strings slide paving stones and a little garden gate into place along her way, like puzzle pieces.' },
  { beat: 7, content: 'The woman stands tall on a small hill under a starry night sky, holding thin glowing thread reins that rise up into the sky and connect to a constellation, her expression awed and a little scared, her hair lifted by a light breeze.' },
];

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
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
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
      form.append('output_compression', '90');
      refs.forEach((b, i) => form.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i + 1}.png`));
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: form,
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
  for (const p of ['witch-school/refs/style-1.png', 'witch-school/refs/style-2.png']) {
    const [buf] = await bucket.file(p).download();
    refs.push(buf);
  }
  console.log('refs ok:', refs.map(r => r.length));

  const manifest = [];
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  for (const p of PANELS) {
    if (only && !only.includes(p.beat)) continue;
    const local = path.join(OUT, `panel-${p.beat}.webp`);
    if (fs.existsSync(local) && !process.env.FORCE) { console.log(`beat ${p.beat}: exists, skip`); }
    else {
      console.log(`beat ${p.beat}: rendering…`);
      const t0 = Date.now();
      let buf = await editWithRefs(STYLE + CHAR + p.content + END, refs);
      try { buf = await whiten(buf); } catch (e) { console.warn('whiten failed:', e.message); }
      fs.writeFileSync(local, buf);
      console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${local} (${buf.length} bytes)`);
    }
    const dest = `story-shorts/controlling-my-own-destiny/panel-${p.beat}.webp`;
    await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/webp' } });
    await bucket.file(dest).makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    console.log(`  uploaded → ${url}`);
    manifest.push({ beat: p.beat, content: p.content, url, madeAt: Date.now() });
  }
  fs.writeFileSync(path.join(OUT, 'panels.json'), JSON.stringify(manifest, null, 2));
  console.log('ALL DONE', manifest.length, 'panels');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

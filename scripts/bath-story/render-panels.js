// Render the "bath" thought-experiment story as vertical pastel panels.
// Pipeline (Sophie's recording, 2026-08-02): Test Station "Pastel (house)"
// pastel-variant-2 look (gpt-image-2 EDITS with the witch-school style refs,
// whitened bg), PORTRAIT 2:3 for the phone, and the literal → metaphorical
// pairing formula — a realistic panel of what's happening, then the
// dream-sequence take on the same moment. Animation between pairs comes later.
// Run from /home/user/imageforge so node_modules resolve.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const OUT = process.env.BATH_OUT || '/tmp/claude-0/-home-user/3f02d84e-abbd-5c13-b33d-ae39d8184c4b/scratchpad/bath';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Same values as server.js MODELS.house[house-pastel]
const STYLE = 'Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration. ';
const END = ' Vertical composition. Absolutely no text, no words, no letters, no numbers, no captions.';

// Character continuity tokens — repeated verbatim wherever a character appears.
const HER = 'a young woman with long wavy chestnut-brown hair';
const EX = 'her ex-boyfriend, a tall young man with short dark hair wearing a denim jacket';
const GF = 'his new girlfriend, a woman with a blonde ponytail wearing a mint-green sundress';
const GUY = 'a heavyset man with a scruffy neckbeard and round glasses, wearing a gray t-shirt and plaid pajama pants';

const PANELS = [
  { id: 'bath-calm', label: 'The bath — thinking begins', content: `${HER}, hair pinned up loosely, relaxes in a white clawfoot bathtub full of foamy bubbles in a small cozy bathroom, eyes closed, a calm thoughtful face. A few small round thought circles rise from her head toward the top of the frame.` },
  { id: 'bath-bubble-normal', label: 'Thought bubble — running into the ex (normal clothes)', content: `${HER}, hair pinned up, soaks in a white clawfoot bathtub full of foamy bubbles in the lower third of the scene. Above her a huge cloud-shaped thought bubble with small trailing circles fills the top of the frame. Inside the thought bubble: the same young woman stands in a supermarket aisle wearing a plain white t-shirt and blue jeans, coming face to face with ${EX}, who stands beside ${GF}, next to shelves of groceries.` },
  { id: 'market-good', label: 'What if she looked really good — the polka-dot dress', content: `In a supermarket aisle lined with shelves of groceries, ${HER} wears a knee-length bright red dress with large white polka dots and a fancy wide-brimmed straw hat with a ribbon. She fawns over herself, one hand raised gracefully near her cheek, chin up, quietly delighted with herself. Facing her: ${EX} and ${GF}, both looking surprised.` },
  { id: 'market-poof', label: 'The poof — she vanishes mid-thought', content: `The same supermarket aisle lined with shelves of groceries: where the young woman stood there is now only a soft cartoon poof cloud with motion lines radiating out around it — she has vanished. ${EX} and ${GF} stare at the poof cloud, startled.` },
  { id: 'market-bad', label: 'What if she looked really bad — the shabby version', content: `In the same supermarket aisle lined with shelves of groceries, ${HER} now looks shabby: her hair loose and messy, no hat, wearing a black t-shirt that is much too loose for her and green pants torn unevenly so one leg is longer than the other. She looks anguished and disgruntled, shoulders slumped. Facing her: ${EX} and ${GF}.` },
  { id: 'bath-bubble-return', label: 'Back in the bath — what if the world became real', content: `${HER}, hair pinned up, in the white clawfoot bathtub with foamy bubbles, seen from further back, gazing up at a huge cloud-shaped thought bubble with small trailing circles that fills most of the frame above her. Inside the bubble a faint sunny outdoor scene with grass and a quiet street is just beginning to form, half-sketched.` },
  { id: 'tree-materialize', label: 'The tree materializes', content: `The scene is framed by soft cloud-like thought-bubble edges curving in at the four corners of the frame. A sunny outdoor scene with grass and a quiet street where a large tree is materializing out of thin air: its trunk already solid, its leafy canopy still dissolving into thousands of tiny floating mint-green and pale-yellow particles drifting into place.` },
  { id: 'room-materialize', label: 'His room materializes around him', content: `The scene is framed by soft cloud-like thought-bubble edges curving in at the four corners of the frame. A dingy basement bedroom where ${GUY} lies back on his unmade bed. Around him his belongings are materializing out of thin air from tiny floating colored particles: a retro video game console half-formed from lilac particles, a microwave assembling from pale-yellow particles, an old boxy television still dissolving into mint specks. A crumpled fast-food box sits on the floor.` },
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
  fs.mkdirSync(OUT, { recursive: true });
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

  const manifestPath = path.join(OUT, 'panels.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  for (const p of PANELS) {
    if (only && !only.includes(p.id)) continue;
    const local = path.join(OUT, `${p.id}.webp`);
    let madeAt = Date.now();
    if (fs.existsSync(local) && !process.env.FORCE) { console.log(`${p.id}: exists, skip render`); madeAt = fs.statSync(local).mtimeMs; }
    else {
      console.log(`${p.id}: rendering…`);
      const t0 = Date.now();
      let buf = await editWithRefs(STYLE + p.content + END, refs);
      try { buf = await whiten(buf); } catch (e) { console.warn('whiten failed:', e.message); }
      fs.writeFileSync(local, buf);
      madeAt = Date.now();
      console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${local} (${buf.length} bytes)`);
    }
    const dest = `story-shorts/bath-thought-experiment/${p.id}.webp`;
    await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/webp' } });
    await bucket.file(dest).makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    console.log(`  uploaded → ${url}`);
    const entry = { id: p.id, label: p.label, content: p.content, url, madeAt };
    const i = manifest.findIndex(m => m.id === p.id);
    if (i >= 0) manifest[i] = entry; else manifest.push(entry);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  console.log('ALL DONE', manifest.length, 'panels');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

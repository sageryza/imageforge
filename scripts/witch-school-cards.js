// Witch School lesson-card pipeline: generate the tap-card illustrations in
// Sophie's line-art style, upload them to Firebase, and sample each image's
// background color so the lesson screen can tint to match it exactly.
//
//   node scripts/witch-school-cards.js lesson-spec.json
//
// Spec: { "refs": ["storage:witch-school/refs/style-1.png", ...], "cards":
//         [{ "id": "pm-01", "prompt": "..." }, ...] }  — refs are Sophie's
// style-anchor images ("storage:<path>" fetches them from the private bucket,
// so any session can run this; local paths also work). Full workflow:
// docs/witch-school-lessons.md. Card prompts get the house STYLE
// prefix + no-text suffix automatically; include CHAR yourself when the
// recurring woman should appear (spec key "char": true on a card).
//
// Env: OPENAI_API_KEY + FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_KEY_FILE.
// Output: witch-school/assets/<id>.png (public) and, when all cards are done,
// a ready-to-paste `{ img, bg }` line per card — the bg hex is sampled from
// the finished image's own corner pixels (average of the four corners), which
// is what makes the art float seamlessly on the lesson screen. ALWAYS carry
// that bg into the card entry in witch.html; never assume one shared cream.
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');
const fs = require('fs');

const DEFAULT_STYLE = 'Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, playful modern editorial illustration, flat colors with NO gradients and minimal shading, lots of generous negative space. Draw a brand-new, SIMPLE, uncluttered illustration with one clear subject (not a busy scene). ';
const DEFAULT_CHAR = 'Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. ';
const DEFAULT_END = ' Subject centered with lots of empty cream space around it. Absolutely no text, no words, no letters, no numbers, no captions.';

// A recolored variant (e.g. the pastel lessons) sets these in its spec:
//   "style": "...pastel palette on a PLAIN WHITE background...", "charDesc": "...",
//   "end": "...empty white space...", "whiten": true   (see docs/witch-school-lessons.md)
// The models still tint the "white" slightly, so `whiten: true` flood-fills the
// border-connected background to pure white after generation (per-card
// "whitenMode": "all" | "top" — use "top" when foreground content bleeds to the
// bottom/side edge in a near-background color).

const specPath = process.argv[2];
if (!specPath) { console.error('usage: node scripts/witch-school-cards.js lesson-spec.json'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const STYLE = spec.style || DEFAULT_STYLE;
const CHAR = spec.charDesc || DEFAULT_CHAR;
const END = spec.end || DEFAULT_END;
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY required'); process.exit(1); }

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.FIREBASE_KEY_FILE, 'utf8');
initializeApp({ credential: cert(JSON.parse(saJson)), storageBucket: 'deckfactory-43176.firebasestorage.app' });

// Refs may be local paths OR "storage:<path>" — Sophie's style anchors live
// privately at storage:witch-school/refs/style-1.png / style-2.png so ANY
// session can run this without her re-uploading them.
async function materializeRefs(refs) {
  const out = [];
  for (const r of refs) {
    if (!r.startsWith('storage:')) { out.push(r); continue; }
    const remote = r.slice('storage:'.length);
    const local = '/tmp/ref-' + remote.split('/').pop();
    if (!fs.existsSync(local)) await getStorage().bucket().file(remote).download({ destination: local });
    out.push(local);
  }
  return out;
}

async function generate(prompt) {
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', STYLE + prompt + END);
  fd.append('size', '1024x1024');
  fd.append('quality', 'medium');
  fd.append('n', '1');
  for (const p of spec.refs) {
    fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), p.split('/').pop());
  }
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: 'Bearer ' + KEY }, body: fd,
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error).slice(0, 220));
  return Buffer.from(d.data[0].b64_json, 'base64');
}

// Average the four corner pixels — on this flat line-art style the background
// is uniform, so the corners ARE the background.
async function sampleBg(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
  const m = 5, corners = [px(m, m), px(info.width - 1 - m, m), px(m, info.height - 1 - m), px(info.width - 1 - m, info.height - 1 - m)];
  const avg = [0, 1, 2].map(i => Math.round(corners.reduce((s, c) => s + c[i], 0) / corners.length));
  return '#' + avg.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Flood-fill the border-connected background to pure white (for recolored specs
// with `whiten: true`). Interior colors that match the background but are walled
// off by the black outlines (a bubble, a thought cloud) are preserved because
// they aren't reachable from the border. mode 'top' seeds only the top edge —
// use it when foreground content bleeds to the bottom/side in a near-bg color.
async function whitenBg(buf, mode = 'all', tol = 46) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const idx = (x, y) => (y * W + x) * C;
  const topOnly = mode === 'top';
  const corners = topOnly ? [[2, 2], [W - 3, 2]] : [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2]; }
  br /= corners.length; bg /= corners.length; bb /= corners.length;
  const tol2 = tol * tol;
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= tol2; };
  const visited = new Uint8Array(W * H), stack = [];
  const pushIf = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (visited[p] || !close(idx(x, y))) return; visited[p] = 1; stack.push(p); };
  if (topOnly) { for (let x = 0; x < W; x++) pushIf(x, 0); }
  else { for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); } for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); } }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p - x) / W; pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < W * H; p++) if (visited[p]) { const i = p * C; out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; if (C === 4) out[i + 3] = 255; }
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}

(async () => {
  const bucket = getStorage().bucket();
  spec.refs = await materializeRefs(spec.refs);
  const results = [];
  for (const card of spec.cards) {
    const prompt = (card.char ? CHAR : '') + card.prompt;
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        let buf = await generate(prompt);
        if (spec.whiten) buf = await whitenBg(buf, card.whitenMode || 'all');
        const dest = `witch-school/assets/${card.id}.png`;
        await bucket.file(dest).save(buf, { metadata: { contentType: 'image/png' } });
        await bucket.file(dest).makePublic();
        const bg = await sampleBg(buf);
        results.push({ img: card.id, bg });
        console.log(`${card.id} bg ${bg} => https://storage.googleapis.com/${bucket.name}/${dest}`);
        ok = true;
      } catch (e) {
        console.error(card.id, 'attempt', attempt, 'failed:', e.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt));
      }
    }
    if (!ok) console.error('GAVE UP on', card.id);
  }
  console.log('\nPaste into the lesson cards in witch.html:');
  for (const r of results) console.log(`  { img: '${r.img}', bg: '${r.bg}', ... },`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });

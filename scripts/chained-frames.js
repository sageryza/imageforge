// Sequential "growing image" generator: like witch-school-cards.js but each
// card attaches the PREVIOUS frame as a composition anchor (plus a style ref),
// so a sequence reads as ONE scene accumulating elements frame by frame.
//
//   node scripts/chained-frames.js sequence-spec.json
//
// Spec: { "refs": ["storage:..."], "outPrefix": "witch-school/assets/",
//         "seedFrames": { "orig": "storage:witch-school/refs/sophie-sky.png" },
//         "chainStyle": "...", "freshStyle": "...", "charDesc": "...", "end": "...",
//         "cards": [{ "id": "sk-01", "prompt": "...", "fresh": true },
//                   { "id": "sk-02", "prompt": "ADD: ..." }, ...] }
// A card with "fresh": true composes from scratch (style refs only); all
// others get [previous frame, style ref] and their prompt should describe
// only what changes. "anchor": "<id>" overrides which earlier frame anchors —
// it can name a seedFrame, so a sequence can grow out of a real source image.
// chainStyle/freshStyle/charDesc/end override the default prompt scaffolding.
//
// Env: OPENAI_API_KEY + FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_KEY_FILE.
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');
const fs = require('fs');

const CHAIN_STYLE = 'The FIRST attached image is the previous frame of this sequence: keep its exact composition, character, colors and every existing element unchanged — this frame only adds or changes what the instruction says. The LAST attached image is a pure STYLE reference: bold confident black ink outlines, flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, flat colors with NO gradients. ';
const FRESH_STYLE = 'Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, playful modern editorial illustration, flat colors with NO gradients and minimal shading, generous negative space. ';
const CHAR = 'The woman: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. ';
const END = ' Absolutely no text, no words, no letters, no numbers, no captions.';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: node scripts/chained-frames.js sequence-spec.json'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const CHAIN = spec.chainStyle || CHAIN_STYLE;
const FRESH = spec.freshStyle || FRESH_STYLE;
const CHARD = spec.charDesc !== undefined ? spec.charDesc : CHAR;
const ENDT = spec.end !== undefined ? spec.end : END;
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY required'); process.exit(1); }

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.FIREBASE_KEY_FILE, 'utf8');
initializeApp({ credential: cert(JSON.parse(saJson)), storageBucket: 'deckfactory-43176.firebasestorage.app' });

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

async function generate(prompt, imagePaths) {
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', prompt);
  fd.append('size', '1024x1024');
  fd.append('quality', 'medium');
  fd.append('n', '1');
  for (const p of imagePaths) {
    fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), p.split('/').pop());
  }
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: 'Bearer ' + KEY }, body: fd,
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error).slice(0, 220));
  return Buffer.from(d.data[0].b64_json, 'base64');
}

async function sampleBg(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
  const m = 5, corners = [px(m, m), px(info.width - 1 - m, m), px(m, info.height - 1 - m), px(info.width - 1 - m, info.height - 1 - m)];
  const avg = [0, 1, 2].map(i => Math.round(corners.reduce((s, c) => s + c[i], 0) / corners.length));
  return '#' + avg.map(v => v.toString(16).padStart(2, '0')).join('');
}

(async () => {
  const bucket = getStorage().bucket();
  const styleRefs = await materializeRefs(spec.refs);
  const outPrefix = spec.outPrefix || 'witch-school/assets/';
  const local = {}; // id -> local path of finished frame (or seed source)
  for (const [id, src] of Object.entries(spec.seedFrames || {})) {
    local[id] = (await materializeRefs([src]))[0];
  }
  const results = [];
  for (const card of spec.cards) {
    let inputs, prompt;
    if (card.fresh) {
      inputs = styleRefs;
      prompt = FRESH + CHARD + card.prompt + ENDT;
    } else {
      const anchorId = card.anchor || results[results.length - 1]?.img;
      if (!anchorId || !local[anchorId]) throw new Error('no anchor frame for ' + card.id);
      inputs = [local[anchorId], styleRefs[0]];
      prompt = CHAIN + CHARD + card.prompt + ENDT;
    }
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const buf = await generate(prompt, inputs);
        const lp = '/tmp/frame-' + card.id + '.png';
        fs.writeFileSync(lp, buf);
        local[card.id] = lp;
        const dest = outPrefix + card.id + '.png';
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
    if (!ok) { console.error('GAVE UP on', card.id, '- aborting (later frames need this anchor)'); process.exit(1); }
  }
  console.log('\nDone:');
  for (const r of results) console.log(`  { img: '${r.img}', bg: '${r.bg}' },`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });

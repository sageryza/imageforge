// Sticker Day art pipeline: draw one die-cut sticker per self-care task in
// Sophie's line-art style (the SAME style as the Witch School lesson cards),
// cut the background out so it's a real transparent sticker, upload it, and
// write the URLs back into public/selfcare-stickers.json.
//
//   node scripts/selfcare-stickers.js                 # every task missing art
//   node scripts/selfcare-stickers.js --only water,food
//   node scripts/selfcare-stickers.js --pack ink --force
//   node scripts/selfcare-stickers.js --dry-run       # print the plan + cost
//
// Why the extra steps vs witch-school-cards.js: a lesson card sits on a cream
// panel, so the card keeps its background and the page tints to match. A
// sticker has to be a SHAPE — the app derives the un-earned silhouette by
// masking the very same PNG, so anything left of the background would show up
// as a grey rectangle instead of the sticker's outline. So each image goes
// generate -> background-remover -> alpha-trim -> upload.
//
// Env: OPENAI_API_KEY, REPLICATE_API_TOKEN, and FIREBASE_SERVICE_ACCOUNT (JSON)
// or FIREBASE_KEY_FILE. Style refs are pulled from the private bucket, so any
// session can run this with no files from Sophie.
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BUCKET = 'deckfactory-43176.firebasestorage.app';
const REFS = ['storage:witch-school/refs/style-1.png', 'storage:witch-school/refs/style-2.png'];
const BG_REMOVE_MODEL = '851-labs/background-remover';
const MANIFEST = path.join(__dirname, '..', 'public', 'selfcare-stickers.json');

// Same house style as the lesson cards, then the sticker-specific framing: one
// object, nothing else in the frame, flat background the remover can take out
// cleanly (a drawn shadow would survive it and read as grime round the edge).
const STYLE = 'Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black), playful modern editorial illustration, flat colors with NO gradients and minimal shading. Draw a brand-new, SIMPLE, uncluttered illustration of ONE single object. ';
const END = ' The object is centered and complete, drawn large and filling most of the frame, on a plain flat solid cream off-white background with nothing else in the frame — no scenery, no surface, no table, no cast shadow, no drop shadow, no frame or border. Absolutely no text, no words, no letters, no numbers, no captions.';

// One object per self-care task. Deliberately plain: the style reference does
// the styling, so these only have to say WHAT to draw.
const PROMPTS = {
  water:   'A tall clear drinking glass filled most of the way with water, seen straight on.',
  food:    'A round bowl holding a good meal — leafy greens, a halved boiled egg and some beans — seen from a slight angle.',
  move:    'A single well-worn running shoe, seen from the side.',
  outside: 'A bright sun with simple straight rays coming off it.',
  sleep:   'A crescent moon with one small star beside it.',
  thanks:  'Three hearts together — one larger and two smaller.',
  call:    'An old telephone handset with a curly cord, held at a slight diagonal.',
  journal: 'A closed notebook with an elastic band round it and a pen resting on top.',
  make:    'A paintbrush at a diagonal with a bright blob of wet paint on the bristles.',
  read:    'An open book lying flat with both pages showing.',
  music:   'A cassette tape, seen straight on.',
  wash:    'A bar of soap with a few round bubbles floating above it.',
  tidy:    'A broom standing upright with stiff bristles.',
  quiet:   'A teacup on a saucer with two curls of steam rising.',
  meds:    'One two-tone capsule pill and one small round tablet beside it.',
  plant:   'A small potted plant with a few broad leaves in a simple round pot.',
  write:   'A closed envelope with a small stamp in the top corner, at a slight tilt.',
};

// gpt-image-2 medium 1024x1024 is ~$0.04; background removal is ~$0.002.
const COST_PER = 0.042;

const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const has = (n) => args.includes('--' + n);
const PACK = flag('pack', 'ink');
const ONLY = (flag('only') || '').split(',').map(s => s.trim()).filter(Boolean);
const FORCE = has('force');
const DRY = has('dry-run');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
if (!manifest.packs[PACK]) { console.error(`no pack "${PACK}" in the manifest`); process.exit(1); }
manifest.packs[PACK].art = manifest.packs[PACK].art || {};

const allIds = [...(manifest.core || []), ...(manifest.extra || [])];
const todo = allIds.filter(id => {
  if (ONLY.length && !ONLY.includes(id)) return false;
  if (!PROMPTS[id]) { console.warn(`! no prompt for "${id}" — skipping`); return false; }
  return FORCE || !(manifest.packs[PACK].art[id] && manifest.packs[PACK].art[id].img);
});

console.log(`pack "${PACK}" · ${todo.length} sticker(s) to draw${FORCE ? ' (forced)' : ''}`);
console.log(`estimated cost: $${(todo.length * COST_PER).toFixed(2)}`);
if (DRY) { console.log(todo.join(', ') || '(nothing to do)'); process.exit(0); }
if (!todo.length) process.exit(0);

const OPENAI = process.env.OPENAI_API_KEY;
const REPLICATE = process.env.REPLICATE_API_TOKEN;
if (!OPENAI) { console.error('OPENAI_API_KEY required'); process.exit(1); }
if (!REPLICATE) { console.error('REPLICATE_API_TOKEN required'); process.exit(1); }
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.FIREBASE_KEY_FILE, 'utf8');
initializeApp({ credential: cert(JSON.parse(saJson)), storageBucket: BUCKET });

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

async function generate(prompt, refs) {
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', STYLE + prompt + END);
  fd.append('size', '1024x1024');
  fd.append('quality', 'medium');
  fd.append('n', '1');
  for (const p of refs) {
    fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), path.basename(p));
  }
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: 'Bearer ' + OPENAI }, body: fd,
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error).slice(0, 220));
  return Buffer.from(d.data[0].b64_json, 'base64');
}

let bgVersion = null;
async function removeBackground(imageUrl) {
  if (!bgVersion) {
    const mr = await fetch(`https://api.replicate.com/v1/models/${BG_REMOVE_MODEL}`, {
      headers: { Authorization: 'Bearer ' + REPLICATE },
    });
    const mj = await mr.json();
    if (!mj.latest_version) throw new Error('could not resolve bg-removal model version');
    bgVersion = mj.latest_version.id;
  }
  const create = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REPLICATE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: bgVersion, input: { image: imageUrl } }),
  });
  let p = await create.json();
  if (p.error) throw new Error(p.error.detail || JSON.stringify(p.error));
  if (!p.urls || !p.urls.get) throw new Error(p.detail || 'no polling url from Replicate');
  let n = 0;
  while (!['succeeded', 'failed', 'canceled'].includes(p.status) && n < 60) {
    await new Promise(r => setTimeout(r, 2000));
    p = await (await fetch(p.urls.get, { headers: { Authorization: 'Bearer ' + REPLICATE } })).json();
    n++;
  }
  if (p.status !== 'succeeded') throw new Error(`bg-removal ${p.status}: ${p.error || ''}`);
  const out = Array.isArray(p.output) ? p.output[0] : p.output;
  if (!out) throw new Error('bg-removal produced no image');
  return out;
}

async function upload(buf, remotePath, contentType = 'image/png') {
  const file = getStorage().bucket().file(remotePath);
  await file.save(buf, { metadata: { contentType }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${BUCKET}/${remotePath}`;
}

// The subject sits in a sea of empty space; after the cut-out that space is
// transparent, so trim to the alpha bounding box and re-pad square. Without
// this every sticker renders at a different visual size in the same tile.
async function trimSquare(buf) {
  const trimmed = await sharp(buf).trim({ threshold: 1 }).toBuffer();
  const m = await sharp(trimmed).metadata();
  const side = Math.max(m.width, m.height);
  const pad = Math.round(side * 0.04);          // a little breathing room
  return sharp({
    create: { width: side + pad * 2, height: side + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed, left: pad + Math.round((side - m.width) / 2), top: pad + Math.round((side - m.height) / 2) }])
    .png()
    .toBuffer();
}

(async () => {
  const refs = await materializeRefs(REFS);
  const done = [], failed = [];

  for (const id of todo) {
    process.stdout.write(`${id} … `);
    try {
      let buf = null;
      for (let attempt = 1; attempt <= 3 && !buf; attempt++) {
        try { buf = await generate(PROMPTS[id], refs); }
        catch (e) {
          if (attempt === 3) throw e;
          process.stdout.write(`retry(${attempt}) `);
          await new Promise(r => setTimeout(r, 3000 * attempt));
        }
      }
      // The remover needs a URL, so the raw drawing is parked in Storage first.
      // It's kept: it's the only record of what the model actually drew.
      const rawUrl = await upload(buf, `selfcare/stickers/${PACK}/_raw/${id}.png`);
      process.stdout.write('cut … ');
      const cutUrl = await removeBackground(rawUrl);
      const cut = Buffer.from(await (await fetch(cutUrl)).arrayBuffer());
      const final = await trimSquare(cut);
      const url = await upload(final, `selfcare/stickers/${PACK}/${id}.png`);
      manifest.packs[PACK].art[id] = { img: url };
      // Written after every sticker, so a crash halfway keeps what landed.
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
      done.push(id);
      console.log('ok');
    } catch (e) {
      failed.push(id);
      console.log('FAILED: ' + e.message);
    }
  }

  console.log(`\ndrew ${done.length}/${todo.length}${failed.length ? ' · failed: ' + failed.join(', ') : ''}`);
  console.log(`manifest updated: ${path.relative(process.cwd(), MANIFEST)}`);
  if (failed.length) process.exitCode = 1;
})();

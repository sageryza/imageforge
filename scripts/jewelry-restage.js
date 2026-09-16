#!/usr/bin/env node
/**
 * jewelry-restage.js — take a REAL photo of a real piece of jewelry and make a
 * new picture of that same piece: lifted off whatever it was shot on, or worn.
 *
 * WHY THE EDIT ENDPOINT, NOT A GENERATION
 * The piece is real and somebody made it by hand, so the picture has to be of
 * THAT piece — every bead in the same order, the same clasp, the same wire.
 * That is what `images/edits` with `input_fidelity: high` is for, and it is the
 * same ladder photostudio.js walks: gpt-image-1 keeps the real subject, and
 * gpt-image-2 is the fallback if gpt-image-1 is ever off the account (it
 * refuses the fidelity flag — "does not support the 'input_fidelity'
 * parameter" — so the fallback is degraded, not equivalent; the run says which
 * one drew it, because the caption has to be true).
 *
 * THE PROMPTS SAY WHAT HAPPENS TO THE PIECE, NEVER WHAT THE PIECE LOOKS LIKE.
 * The photo carries the piece; words about its colour or its beads only argue
 * with it. So every scene below is a staging instruction plus "unchanged".
 *
 * USAGE
 *   node scripts/jewelry-restage.js --in raw/123_0.jpg --scene white --out out/
 *   node scripts/jewelry-restage.js --in raw/123_0.jpg --scene necklace-model \
 *       --out out/ --quality medium --dry
 *
 * --dry prints the exact prompt, the model, the size and the estimated price
 * and sends nothing. Scenes: white · necklace-model · earring-model ·
 * bracelet-model. Nothing is sent without a scene that exists.
 */
const fs = require('fs');
const path = require('path');

const KEY = process.env.OPENAI_API_KEY;
// photostudio.js's ladder, same order and the same reason.
const EDIT_MODELS = [
  { model: 'gpt-image-1', inputFidelity: true },
  { model: 'gpt-image-2', inputFidelity: false },
];

// Every scene is one situation, told short. "unchanged" is the load-bearing
// word and it is in all of them.
const SCENES = {
  white: {
    label: 'lifted onto white',
    size: '1024x1024',
    prompt: 'Place this exact piece of jewelry, unchanged, on a pure white seamless background, '
      + 'with a soft contact shadow under it. Clean e-commerce product photography, soft even lighting. '
      + 'Remove the mannequin, the fabric and the surface it was photographed on. '
      + 'Keep the piece identical in shape, colour, material and every detail. No text, no props.',
  },
  'necklace-model': {
    label: 'worn',
    size: '1024x1536',
    prompt: 'A woman wearing this exact necklace, unchanged, photographed from collarbone to chin '
      + 'against a warm neutral background. Natural daylight, editorial jewelry photography. '
      + 'Keep the necklace identical in shape, colour, material and every bead.',
  },
  'earring-model': {
    label: 'worn',
    size: '1024x1536',
    prompt: 'A woman wearing these exact earrings, unchanged, her head turned so one ear is in profile, '
      + 'against a warm neutral background. Natural daylight, editorial jewelry photography. '
      + 'Keep the earrings identical in shape, colour, material and every detail.',
  },
  'bracelet-model': {
    label: 'worn',
    size: '1024x1536',
    prompt: 'A woman wearing this exact bracelet, unchanged, her forearm resting across the frame '
      + 'against a warm neutral background. Natural daylight, editorial jewelry photography. '
      + 'Keep the bracelet identical in shape, colour, material and every bead.',
  },
};

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const has = (name) => process.argv.includes(`--${name}`);

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// gpt-image-1, Sept 2026: $10/1M image input tokens, $40/1M image output.
// A square high-fidelity input is ~4160 tokens; a medium 1024x1024 output is
// ~1056 and a medium 1024x1536 is ~1584. Rounded, and printed so a run says
// what it costs before it costs it.
function priceOf(size, quality) {
  const out = { '1024x1024': { low: 272, medium: 1056, high: 4160 }, '1024x1536': { low: 408, medium: 1584, high: 6240 } }[size] || {};
  return ((out[quality] || 1056) * 40 + 4160 * 10) / 1e6;
}

async function editImage({ buffer, mime, prompt, size, quality, retries = 1 }) {
  let lastErr;
  for (const cfg of EDIT_MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const form = new FormData();
        form.append('model', cfg.model);
        form.append('prompt', prompt);
        form.append('image', new Blob([buffer], { type: mime }), `piece.${(mime.split('/')[1] || 'png').replace('jpeg', 'jpg')}`);
        if (cfg.inputFidelity) form.append('input_fidelity', 'high');
        form.append('size', size);
        form.append('quality', quality);
        form.append('output_format', 'png');
        const res = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${KEY}` },
          body: form,
        });
        const data = await res.json();
        if (data.error) throw new Error(`${cfg.model}: ${data.error.message || 'edit error'}`);
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) throw new Error(`${cfg.model} returned no image`);
        // The model that DREW it, so the caption can be true.
        return { buffer: Buffer.from(b64, 'base64'), model: cfg.model, fidelity: cfg.inputFidelity };
      } catch (err) {
        lastErr = err;
        console.log(`  … ${err.message}`);
        if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

(async () => {
  const inFile = arg('in');
  const sceneKey = arg('scene');
  const scene = SCENES[sceneKey];
  if (!inFile || !scene) {
    console.error(`usage: --in <photo> --scene <${Object.keys(SCENES).join('|')}> [--out dir] [--quality medium] [--dry]`);
    process.exit(1);
  }
  const quality = arg('quality', 'medium');
  const size = arg('size', scene.size);
  const outDir = arg('out', path.dirname(inFile));
  const stem = arg('name', path.basename(inFile).replace(/\.[^.]+$/, ''));
  const outFile = path.join(outDir, `${stem}--${sceneKey}.png`);

  console.log(`source   ${inFile}`);
  console.log(`scene    ${sceneKey} (${scene.label})`);
  console.log(`model    gpt-image-1 · ${quality} · ${size} · input_fidelity high`);
  console.log(`price    ~$${priceOf(size, quality).toFixed(2)}`);
  console.log(`prompt   ${scene.prompt}`);
  if (has('dry')) { console.log('\n--dry: nothing sent.'); return; }
  if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

  const buffer = fs.readFileSync(inFile);
  const mime = MIME[path.extname(inFile).toLowerCase()] || 'image/jpeg';
  const started = Date.now();
  const { buffer: png, model, fidelity } = await editImage({ buffer, mime, prompt: scene.prompt, size, quality });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, png);
  const meta = { source: inFile, scene: sceneKey, prompt: scene.prompt, model, inputFidelity: fidelity, quality, size, createdAt: started, ms: Date.now() - started, bytes: png.length };
  fs.writeFileSync(outFile.replace(/\.png$/, '.json'), JSON.stringify(meta, null, 1));
  console.log(`\ndrew     ${outFile} (${(png.length / 1e6).toFixed(2)} MB, ${((Date.now() - started) / 1000).toFixed(0)}s, ${model}${fidelity ? ' · fidelity high' : ' · NO fidelity flag'})`);
})().catch(err => { console.error(err.message); process.exit(1); });

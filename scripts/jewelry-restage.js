#!/usr/bin/env node
/**
 * jewelry-restage.js — take a REAL photo of a real piece of jewelry and make a
 * new picture of that same piece: lifted off whatever it was shot on, or worn.
 *
 * WHY THE EDIT ENDPOINT, NOT A GENERATION
 * The piece is real and somebody made it by hand, so the picture has to be of
 * THAT piece — every bead in the same order, the same clasp, the same wire.
 * `images/generations` draws from words alone; `images/edits` takes her photo
 * in and changes it, and that is the only door where the piece can survive.
 *
 * WHICH MODEL — read off OpenAI's own docs 2026-09-16, not off a repo note.
 * The first run (2026-09-16) copied photostudio.js's ladder and led with
 * gpt-image-1 + `input_fidelity: high`, on the strength of a comment there
 * saying gpt-image-2 refuses the flag "so the fallback is degraded". Half
 * true: gpt-image-2 does refuse the flag — BECAUSE IT RUNS EVERY INPUT AT HIGH
 * FIDELITY AUTOMATICALLY, so there is nothing to set. And there is a newer
 * pair, gpt-image-2.5-sunburst / -flare (on this key, dated 2026-09-08), which
 * OpenAI describes as "Sunburst for workflows where editing precision matters
 * most". So the ladder now leads with sunburst, then gpt-image-2, and only
 * then gpt-image-1 with its flag — and `--model` picks one outright. The run
 * prints which model really drew it, because the caption has to be true.
 *
 * A MASK IS GUIDANCE ON GPT IMAGE, NOT A LOCK. OpenAI: "Masking with GPT Image
 * is entirely prompt-based. The model uses the mask as guidance, but may not
 * follow its exact shape with complete precision." So a mask cannot promise
 * her pixels come back untouched; a pixel-exact result is a composite WE make
 * (cut the piece out of her photo, paste it over the drawn scene), not a flag.
 *
 * THE BILL IS READ BACK, NOT ESTIMATED. Every response carries `usage`; it is
 * saved beside the picture and the price printed is computed from it. The
 * first run estimated instead and could not answer "was that really high
 * fidelity?" with a number — this is what makes the next one able to.
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
// Newest first. Only gpt-image-1 takes (and needs) the fidelity flag; 2 and
// 2.5 refuse it because they are always high. `--model` narrows this to one.
const EDIT_MODELS = [
  { model: 'gpt-image-2.5-sunburst', inputFidelity: false },
  { model: 'gpt-image-2', inputFidelity: false },
  { model: 'gpt-image-1', inputFidelity: true },
];
// $ per 1M tokens, OpenAI pricing page 2026-09-16 (standard tier).
const RATES = {
  'gpt-image-2.5-sunburst': { text: 5, imageIn: 8, imageOut: 30 },
  'gpt-image-2.5-flare':    { text: 5, imageIn: 8, imageOut: 30 },
  'gpt-image-2':            { text: 5, imageIn: 8, imageOut: 30 },
  'gpt-image-1':            { text: 5, imageIn: 10, imageOut: 40 },
};
// What the response's usage block says a request cost, in dollars.
function costOf(model, usage) {
  const r = RATES[model] || RATES['gpt-image-2'];
  const d = (usage && usage.input_tokens_details) || {};
  const textIn = d.text_tokens || 0, imgIn = d.image_tokens || 0, out = (usage && usage.output_tokens) || 0;
  return { textIn, imgIn, out, usd: (textIn * r.text + imgIn * r.imageIn + out * r.imageOut) / 1e6 };
}

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

// The --dry figure only. OpenAI's OLDER-model table (gpt-image-1): a square
// high-fidelity input is ~4160 image tokens at $10/1M, a medium 1024x1024
// output ~1056 and a medium 1024x1536 ~1584 at $40/1M. The 2.5 models price
// the same request differently and publish no table — "use the response's
// usage" — so the real number is read back after the run, never from here.
function guessPrice(size, quality) {
  const out = { '1024x1024': { low: 272, medium: 1056, high: 4160 }, '1024x1536': { low: 408, medium: 1584, high: 6240 } }[size] || {};
  return ((out[quality] || 1056) * 40 + 4160 * 10) / 1e6;
}

async function editImage({ buffer, mime, prompt, size, quality, only, retries = 1 }) {
  let lastErr;
  const ladder = only ? [EDIT_MODELS.find(m => m.model === only) || { model: only, inputFidelity: /^gpt-image-1(?!\.)/.test(only) }] : EDIT_MODELS;
  for (const cfg of ladder) {
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
        // The model that DREW it, so the caption can be true — and what it
        // billed, so the price is a reading rather than a guess.
        return { buffer: Buffer.from(b64, 'base64'), model: cfg.model, fidelity: cfg.inputFidelity, usage: data.usage || null };
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

  const only = arg('model');
  const lead = only || EDIT_MODELS[0].model;
  console.log(`source   ${inFile}`);
  console.log(`scene    ${sceneKey} (${scene.label})`);
  console.log(`model    ${lead} · ${quality} · ${size}${only ? '' : ` (falls back: ${EDIT_MODELS.slice(1).map(m => m.model).join(' → ')})`}`);
  console.log(`price    ~$${guessPrice(size, quality).toFixed(2)} by gpt-image-1's table; the real bill is read back after the run`);
  console.log(`prompt   ${scene.prompt}`);
  if (has('dry')) { console.log('\n--dry: nothing sent.'); return; }
  if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

  const buffer = fs.readFileSync(inFile);
  const mime = MIME[path.extname(inFile).toLowerCase()] || 'image/jpeg';
  const started = Date.now();
  const { buffer: png, model, fidelity, usage } = await editImage({ buffer, mime, prompt: scene.prompt, size, quality, only });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, png);
  const cost = costOf(model, usage);
  const meta = { source: inFile, scene: sceneKey, prompt: scene.prompt, model, inputFidelity: fidelity, quality, size, createdAt: started, ms: Date.now() - started, bytes: png.length, usage, costUsd: usage ? +cost.usd.toFixed(4) : null };
  fs.writeFileSync(outFile.replace(/\.png$/, '.json'), JSON.stringify(meta, null, 1));
  const flag = /^gpt-image-1(?!\.)/.test(model) ? (fidelity ? ' · input_fidelity high' : ' · NO fidelity flag') : ' · always high fidelity';
  console.log(`\ndrew     ${outFile} (${(png.length / 1e6).toFixed(2)} MB, ${((Date.now() - started) / 1000).toFixed(0)}s, ${model}${flag})`);
  if (usage) console.log(`billed   $${cost.usd.toFixed(3)} — ${cost.imgIn} image tokens in, ${cost.textIn} text in, ${cost.out} out (read off the response)`);
  else console.log('billed   (no usage block on the response — price unknown)');
})().catch(err => { console.error(err.message); process.exit(1); });

#!/usr/bin/env node
/**
 * marla-wtr.js — run finished Marla pages back through the WTR watercolour
 * LoRA as IMAGE-TO-IMAGE, to see what her own trained model does with art the
 * gpt-image-2 style reference drew.
 *
 * Sophie's ask (Aug 2026): "look at some of the pictures I hearted and run them
 * through image to image with my WTR LoRA just to see what will happen."
 *
 * It feeds the BARE ART, never the finished page. A finished page carries the
 * caption band, and handing the model a picture with text in it invites it to
 * redraw the lettering as gibberish — the whole reason the caption is
 * composited after the drawing rather than prompted into it.
 *
 * PROMPT_STRENGTH is the knob worth understanding: it is how much of the
 * original survives. Low keeps the composition and re-inks it; high treats the
 * source as a loose suggestion and draws its own picture. Sweeping one image
 * across a few values says more than three images at one guessed value, so
 * --sweep does exactly that.
 *
 * USAGE
 *   node scripts/marla-wtr.js --pages 2,11,26 [--strength 0.65]
 *   node scripts/marla-wtr.js --sweep 11 --values 0.45,0.65,0.85
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'docs/marla/pages.json');
const REV = path.join(ROOT, 'docs/marla/revisions.json');

// The Watercolor Drawings LoRA, exactly as server.js pins it.
const MODEL = 'sageryza/watercolordrawings';
const VERSION = 'a6749d940388a669f79efc36018b93436568ca6a6a59c57ddd87dc43fa3e6c1f';
const TRIGGER = 'wtr';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
const rev = JSON.parse(fs.readFileSync(REV, 'utf8'));
const sceneFor = (n) => rev.scenes[String(n)] || plan.pages.find((p) => p.n === n).scene;

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}
async function upload(buf, dest) {
  const bucket = admin.storage().bucket();
  const tmp = path.join(os.tmpdir(), path.basename(dest));
  fs.writeFileSync(tmp, buf);
  await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'image/png' } });
  await bucket.file(dest).makePublic();
  fs.unlinkSync(tmp);
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

// Which source art exists for a page: the v3 redraw if this page has one,
// else the original. Bare art, no caption band.
function sourceArt(n, bucket) {
  const stamp = String(n).padStart(2, '0');
  return `https://storage.googleapis.com/${bucket}/storybook/marla/art/p${stamp}.png`;
}

async function run(imageUrl, prompt, strength) {
  const create = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: VERSION,
      input: {
        prompt, image: imageUrl, model: 'dev', go_fast: false,
        lora_scale: 1, megapixels: '1', num_outputs: 1,
        aspect_ratio: '2:3', output_format: 'png',
        guidance_scale: 3, output_quality: 100,
        prompt_strength: strength, num_inference_steps: 28,
      },
    }),
  });
  let pred = await create.json();
  if (pred.error) throw new Error(pred.error);
  const started = Date.now();
  while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled') {
    if (Date.now() - started > 300000) throw new Error('replicate timed out');
    await new Promise((r) => setTimeout(r, 2500));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(pred.error || pred.status);
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const r = await fetch(out);
  return Buffer.from(await r.arrayBuffer());
}

(async () => {
  if (!process.env.REPLICATE_API_TOKEN) throw new Error('No REPLICATE_API_TOKEN.');
  initAdmin();
  const bucket = admin.storage().bucket().name;
  const results = [];

  const sweep = arg('sweep');
  const jobs = [];
  if (sweep) {
    const n = Number(sweep);
    for (const v of String(arg('values', '0.45,0.65,0.85')).split(',')) {
      jobs.push({ n, strength: Number(v), tag: `s${String(v).replace('.', '')}` });
    }
  } else {
    const strength = Number(arg('strength', '0.65'));
    for (const p of String(arg('pages', '2,11,26')).split(',')) {
      jobs.push({ n: Number(p.trim()), strength, tag: `s${String(strength).replace('.', '')}` });
    }
  }

  for (const j of jobs) {
    const src = sourceArt(j.n, bucket);
    const prompt = `${TRIGGER} ${sceneFor(j.n)}`;
    process.stdout.write(`page ${j.n} @ strength ${j.strength} … `);
    try {
      const buf = await run(src, prompt, j.strength);
      const url = await upload(buf, `storybook/marla/wtr/p${String(j.n).padStart(2, '0')}-${j.tag}.png`);
      results.push({ n: j.n, strength: j.strength, src, url, prompt });
      console.log('✓');
    } catch (e) { console.log('FAILED —', e.message); }
  }
  fs.writeFileSync(path.join(ROOT, 'docs/marla/wtr-tests.json'),
    JSON.stringify(results, null, 2) + '\n');
  console.log(`\n${results.length} done → docs/marla/wtr-tests.json`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });

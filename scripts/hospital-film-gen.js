#!/usr/bin/env node
/**
 * hospital-film-gen.js — generate art for the "In the Hospital" watercolor film.
 *
 * Runs the WTR watercolor LoRA on Replicate, uploads each result to Firebase
 * Storage (Deck Factory), files it into the chat's Assets tab with a label and
 * its exact prompt split, and — for grid runs — slices the 2x2 sheet into four
 * separate panel images so each one can be its own shot in the film.
 *
 * Usage:
 *   node scripts/hospital-film-gen.js <jobs.json> [--dry-run] [--chat <slug>]
 *
 * jobs.json is an array of:
 *   { "id": "cr1", "label": "…", "prompt": "…",
 *     "grid": false,            // true = also slice the result into 4 panels
 *     "seed": 85,               // optional, default 85
 *     "loraScale": 1,           // optional, default 1
 *     "aspect": "2:3" }         // optional, default 2:3 ("1:1" for grids)
 *
 * Env: REPLICATE_API_TOKEN, FIREBASE_SERVICE_ACCOUNT (Deck Factory).
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const WTR = {
  id: 'sageryza/watercolordrawings',
  version: 'a6749d940388a669f79efc36018b93436568ca6a6a59c57ddd87dc43fa3e6c1f',
  trigger: 'wtr',
  suffix: 'White background',
};
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const OUT_DIR = process.env.HOSPITAL_OUT || '/tmp/hospital-film';
const PRICE_PER_IMAGE = 0.012;   // flux-dev LoRA, 28 steps, ~1MP — for the estimate line

const argv = process.argv.slice(2);
const jobsPath = argv.find(a => !a.startsWith('--'));
const DRY = argv.includes('--dry-run');
const chatArg = argv.indexOf('--chat');
const CHAT = chatArg >= 0 ? argv[chatArg + 1] : 'hospital-story-images';

if (!jobsPath) { console.error('usage: hospital-film-gen.js <jobs.json> [--dry-run]'); process.exit(1); }
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));

const token = process.env.REPLICATE_API_TOKEN;
if (!token && !DRY) { console.error('REPLICATE_API_TOKEN not set'); process.exit(1); }

let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  const creds = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    storageBucket: `${creds.project_id}.firebasestorage.app`,
  });
  bucket = admin.storage().bucket();
}

/** The literal text sent to Replicate, built exactly like the server does. */
function fullPrompt(content) {
  return `${WTR.trigger} ${String(content).replace(/\.+$/, '')}. ${WTR.suffix} `;
}

async function replicate(job) {
  const input = {
    prompt: fullPrompt(job.prompt), model: 'dev', go_fast: false,
    lora_scale: job.loraScale ?? 1, megapixels: '1', num_outputs: 1,
    // A 2x2 sheet of 2:3 portrait panels is 4:3 overall, so each sliced panel
    // comes out in the film's own aspect instead of needing a letterbox.
    aspect_ratio: job.aspect || (job.grid ? '4:3' : '2:3'), output_format: 'webp',
    guidance_scale: 3, output_quality: 80, prompt_strength: 0.8,
    num_inference_steps: 28, seed: job.seed ?? 85,
  };
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: `${WTR.id}:${WTR.version}`, input }),
  });
  let p = await res.json();
  if (p.error) throw new Error(String(p.error));
  if (!p.urls?.get) throw new Error(p.detail || 'no polling url');
  while (!['succeeded', 'failed', 'canceled'].includes(p.status)) {
    await new Promise(r => setTimeout(r, 1500));
    p = await (await fetch(p.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (p.status !== 'succeeded') throw new Error(p.error || `prediction ${p.status}`);
  const out = Array.isArray(p.output) ? p.output[0] : p.output;
  return { url: out, predictTime: p.metrics?.predict_time || null };
}

async function upload(buf, name, contentType = 'image/webp') {
  const file = bucket.file(`hospital-film/${name}`);
  await file.save(buf, { metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/hospital-film/${name}`;
}

/** Cut a 2x2 sheet into its four panels, trimming the inked gutter. */
async function slice(buf, id) {
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  const halfW = Math.floor(width / 2), halfH = Math.floor(height / 2);
  const inset = Math.round(Math.min(halfW, halfH) * 0.035);   // shave the panel border
  const out = [];
  const spots = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (let i = 0; i < spots.length; i++) {
    const [cx, cy] = spots[i];
    const region = {
      left: cx * halfW + inset, top: cy * halfH + inset,
      width: halfW - inset * 2, height: halfH - inset * 2,
    };
    const panel = await sharp(buf).extract(region).webp({ quality: 88 }).toBuffer();
    out.push({ panel: i + 1, buf: panel, name: `${id}-p${i + 1}.webp` });
  }
  return out;
}

async function fileAsset(url, description, promptStyle, promptContent) {
  const post = async (p, body) => {
    const r = await fetch(`${BASE}${p}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const t = await r.text();
    if (!r.ok) console.warn(`  ! ${p} ${r.status}: ${t.slice(0, 120)}`);
    return t;
  };
  await post('/api/gallery', {
    assetsOnly: true, chat: CHAT, url, description,
    prompt: 'flux wtr watercolor LoRA · 28 steps',
  });
  await post('/api/gallery/assets/prompt', {
    chat: CHAT, url, style: promptStyle, content: promptContent,
  });
}

(async () => {
  const gridJobs = jobs.filter(j => j.grid).length;
  console.log(`${jobs.length} generations (${gridJobs} of them 2x2 grids → ${gridJobs * 4} panels)`);
  console.log(`estimated Replicate cost: ~$${(jobs.length * PRICE_PER_IMAGE).toFixed(2)}`);
  if (DRY) {
    jobs.forEach(j => console.log(`  [${j.id}] ${j.grid ? 'GRID ' : ''}${j.label}\n      ${fullPrompt(j.prompt)}`));
    return;
  }
  initFirebase();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  for (const job of jobs) {
    process.stdout.write(`[${job.id}] ${job.label} … `);
    try {
      const { url, predictTime } = await replicate(job);
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      fs.writeFileSync(path.join(OUT_DIR, `${job.id}.webp`), buf);
      const sheetUrl = await upload(buf, `${job.id}.webp`);
      const style = `wtr watercolor drawing LoRA (sageryza/watercolordrawings), lora_scale ${job.loraScale ?? 1}, seed ${job.seed ?? 85}, 28 steps, guidance 3, aspect ${job.aspect || (job.grid ? '4:3' : '2:3')}. Sent as: "${WTR.trigger} [content]. ${WTR.suffix}"`;
      await fileAsset(sheetUrl, job.label, style, job.prompt);
      const rec = { id: job.id, label: job.label, url: sheetUrl, predictTime, panels: [] };
      if (job.grid) {
        const panels = await slice(buf, job.id);
        for (const p of panels) {
          fs.writeFileSync(path.join(OUT_DIR, p.name), p.buf);
          const pUrl = await upload(p.buf, p.name);
          const pLabel = (job.panelLabels && job.panelLabels[p.panel - 1]) || `${job.label} — panel ${p.panel}`;
          await fileAsset(pUrl, pLabel, style, `${job.prompt}\n\n[panel ${p.panel} of the 2x2 sheet, cropped out]`);
          rec.panels.push({ panel: p.panel, url: pUrl, label: pLabel });
        }
      }
      results.push(rec);
      console.log(`ok ${predictTime ? predictTime.toFixed(1) + 's' : ''}${job.grid ? ' +4 panels' : ''}`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({ id: job.id, label: job.label, error: err.message });
    }
  }
  const manifest = path.join(OUT_DIR, 'results.json');
  fs.writeFileSync(manifest, JSON.stringify(results, null, 2));
  console.log(`\nwrote ${manifest}`);
})();

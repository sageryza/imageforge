#!/usr/bin/env node
/**
 * hospital-gpt-gen.js — the ChatGPT-watercolor path for the "In the Hospital"
 * film. Same recipe as the Playground's ChatGPT style (PL_GPT_STYLES.evan):
 * gpt-image-2's EDITS endpoint, refs/evan-film-style.png attached as a pure
 * style reference, 1024x1536, prompt = prefix + her words + no-text suffix.
 *
 * What this adds: a --character <url|path> reference (one or more) attached
 * AFTER the style ref, with a character line naming it, so a look locked in
 * an earlier render can be carried into this style.
 *
 * Usage:
 *   node scripts/hospital-gpt-gen.js <jobs.json> [--dry-run] [--chat <slug>]
 *
 * jobs.json entries:
 *   { "id","label","prompt","quality":"low|medium|high",
 *     "characterRefs":["<url or refs/ path>"], "characterLine":"…" }
 *
 * Env: OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT (Deck Factory).
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ── Verbatim from server.js PL_GPT / PL_GPT_STYLES.evan — keep identical ──
const PL_GPT = {
  id: 'gpt-image-2', size: '1024x1536',
  prefix: 'Use only the style of the attached style reference and ignore its ' +
    'content — do not copy anything depicted in it. You can choose your own ' +
    'colors rather than copying the colors of the style reference.',
};
const EVAN_SUFFIX = 'Do not include any text in the image.';
const STYLE_REF = path.join(__dirname, '..', 'refs', 'evan-film-style.png');

const PRICE = { low: 0.02, medium: 0.06, high: 0.25 };   // per image, 1024x1536
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const OUT_DIR = process.env.HOSPITAL_OUT || '/tmp/hospital-gpt';

const argv = process.argv.slice(2);
const jobsPath = argv.find(a => !a.startsWith('--'));
const DRY = argv.includes('--dry-run');
const ci = argv.indexOf('--chat');
const CHAT = ci >= 0 ? argv[ci + 1] : 'hospital-story-images';
if (!jobsPath) { console.error('usage: hospital-gpt-gen.js <jobs.json>'); process.exit(1); }
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));

const KEY = process.env.OPENAI_API_KEY;
if (!KEY && !DRY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    storageBucket: `${creds.project_id}.firebasestorage.app`,
  });
  bucket = admin.storage().bucket();
}

/** The literal text sent to OpenAI, assembled exactly the way the server does. */
function builtPrompt(job) {
  const charLine = job.characterRefs?.length ? (job.characterLine || '') : '';
  return `${PL_GPT.prefix}${charLine}\n\n${job.prompt}\n\n${EVAN_SUFFIX}`;
}

async function loadRef(src) {
  if (/^https?:/.test(src)) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`ref fetch ${r.status} for ${src}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = src.split('.').pop().split('?')[0].toLowerCase();
    const type = ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return { buf, name: `ref.${ext}`, type };
  }
  const p = path.isAbsolute(src) ? src : path.join(__dirname, '..', src);
  return { buf: fs.readFileSync(p), name: path.basename(p), type: 'image/png' };
}

async function generate(job) {
  const form = new FormData();
  form.append('model', PL_GPT.id);
  form.append('prompt', builtPrompt(job));
  form.append('size', PL_GPT.size);
  form.append('quality', job.quality || 'medium');
  form.append('n', '1');
  // Style reference FIRST, then any character references — the character line
  // says "the second attached image", so order is load-bearing.
  const refs = [STYLE_REF, ...(job.characterRefs || [])];
  for (const src of refs) {
    const { buf, name, type } = await loadRef(src);
    form.append('image[]', new Blob([buf], { type }), name);
  }
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form,
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image returned');
  return Buffer.from(b64, 'base64');
}

async function upload(buf, name) {
  const file = bucket.file(`hospital-film/${name}`);
  await file.save(buf, { metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/hospital-film/${name}`;
}

async function fileAsset(url, description, style, content, quality) {
  const post = async (p, body) => {
    const r = await fetch(`${BASE}${p}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) console.warn(`  ! ${p} ${r.status}`);
  };
  await post('/api/gallery', {
    assetsOnly: true, chat: CHAT, url, description,
    prompt: `gpt-image-2 · ${quality}`,
  });
  await post('/api/gallery/assets/prompt', { chat: CHAT, url, style, content });
}

(async () => {
  const est = jobs.reduce((a, j) => a + (PRICE[j.quality || 'medium'] || 0.06), 0);
  console.log(`${jobs.length} gpt-image-2 renders — estimated $${est.toFixed(2)}`);
  if (DRY) {
    jobs.forEach(j => console.log(`\n[${j.id}] ${j.quality || 'medium'} — ${j.label}\nrefs: ${['refs/evan-film-style.png', ...(j.characterRefs || [])].join(', ')}\n---\n${builtPrompt(j)}\n---`));
    return;
  }
  initFirebase();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  for (const job of jobs) {
    process.stdout.write(`[${job.id}] ${job.quality || 'medium'} ${job.label} … `);
    try {
      const buf = await generate(job);
      fs.writeFileSync(path.join(OUT_DIR, `${job.id}.png`), buf);
      const url = await upload(buf, `${job.id}.png`);
      const refList = ['refs/evan-film-style.png', ...(job.characterRefs || [])].join(' + ');
      const style = `gpt-image-2 EDITS, quality ${job.quality || 'medium'}, 1024x1536. Attached: ${refList}. Sent verbatim as:\n\n${builtPrompt(job).replace(job.prompt, '[content]')}`;
      await fileAsset(url, job.label, style, job.prompt, job.quality || 'medium');
      results.push({ id: job.id, label: job.label, url, quality: job.quality || 'medium' });
      console.log('ok');
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({ id: job.id, error: err.message });
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`\nwrote ${OUT_DIR}/results.json`);
})();

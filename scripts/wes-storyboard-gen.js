#!/usr/bin/env node
/**
 * wes-storyboard-gen.js — Sophie's mental-hospital storyboard, Wes Anderson
 * style, drawn in a chat's OWN container (2026-09-06: "just do 2:3 no image
 * reference try 3 pick my words verbatim / a whole scene / run in ur
 * container / but in background").
 *
 * gpt-image-2 GENERATIONS (no reference image), 1024x1536, quality medium,
 * lossless webp. The prompt is STYLE + her words verbatim; STYLE is the only
 * thing the chat adds and it is disclosed word for word in the reply and in
 * the filed style half. Every picture is stamped with its prompt, uploaded
 * to Deck Factory Storage under wes-storyboard/, filed into the chat's
 * Assets tab with label · MODEL · QUALITY · SIZE · both prompt halves, and
 * the scene is posted as a grid Compare page.
 *
 *   node scripts/wes-storyboard-gen.js <jobs.json> [--dry-run] [--chat <slug>]
 * jobs.json: { style, title, shots:[{ id, label, content, tries }] }
 * Env: OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT (Deck Factory).
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const im = require('../image-meta');

const argv = process.argv.slice(2);
const jobsPath = argv.find((a) => !a.startsWith('--'));
const DRY = argv.includes('--dry-run');
const ci = argv.indexOf('--chat');
const CHAT = ci >= 0 ? argv[ci + 1] : 'mental-hospital-storyboard-9cv0ja';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const OUT = process.env.WES_OUT || '/tmp/wes-storyboard';
const MODEL = 'gpt-image-2', SIZE = '1024x1536', QUALITY = 'medium', TIER = '1K';
const CENTS = 4.1;   // medium 2:3, the served price table

const J = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
const full = (s) => `${J.style}\n\n${s.content}`;
const styleHalf = `${J.style}\n\n[content]`;

let bucket = null;
function initFirebase() {
  const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(creds), storageBucket: `${creds.project_id}.firebasestorage.app` });
  bucket = admin.storage().bucket();
}
async function post(p, body) {
  const r = await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.warn(`  ! ${p} ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function draw(prompt) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1, output_format: 'webp', moderation: 'low' }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const b64 = j.data && j.data[0] && j.data[0].b64_json;
  if (!b64) throw new Error('no image returned');
  return { buf: Buffer.from(b64, 'base64'), usage: j.usage };
}

(async () => {
  const jobs = [];
  J.shots.forEach((s) => { for (let t = 1; t <= (s.tries || 3); t++) jobs.push({ ...s, try: t, id: `${s.id}-t${t}` }); });
  console.log(`${jobs.length} renders at ${QUALITY} ${SIZE} — about $${(jobs.length * CENTS / 100).toFixed(2)}`);
  if (DRY) { J.shots.forEach((s) => console.log(`\n[${s.id}] ${s.label}\n---\n${full(s)}\n---`)); return; }
  initFirebase();
  fs.mkdirSync(OUT, { recursive: true });
  const results = await Promise.all(jobs.map(async (job) => {
    const label = `${job.label} — try ${job.try}`;
    try {
      const madeAt = Date.now();
      const { buf, usage } = await draw(full(job));
      const stamped = im.stamp(buf, { fullPrompt: full(job), promptStyle: styleHalf, promptContent: job.content, model: MODEL, quality: QUALITY, size: TIER, canvas: SIZE, chat: CHAT, label, madeAt: new Date(madeAt).toISOString() });
      fs.writeFileSync(path.join(OUT, `${job.id}.webp`), stamped);
      const file = bucket.file(`wes-storyboard/${job.id}-${madeAt}.webp`);
      await file.save(stamped, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
      await file.makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      await post('/api/gallery', { assetsOnly: true, chat: CHAT, url, description: label, prompt: `${MODEL} · ${QUALITY} · ${TIER}` });
      await post('/api/gallery/assets/prompt', { chat: CHAT, url, style: styleHalf, content: job.content });
      console.log(`[${job.id}] ok`);
      return { id: job.id, shot: job.id.replace(/-t\d+$/, ''), label, url, usage, content: job.content };
    } catch (e) { console.log(`[${job.id}] FAILED: ${e.message}`); return { id: job.id, error: e.message }; }
  }));
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.url);
  if (ok.length) {
    const groups = J.shots.map((s) => ({ label: s.label, items: ok.filter((r) => r.shot === s.id).map((r) => ({ id: r.id, label: r.label, img: r.url, model: MODEL, quality: QUALITY, promptStyle: styleHalf, promptContent: r.content })) })).filter((g) => g.items.length);
    const page = await post('/api/chatfeed/page', { chat: CHAT, title: J.title, template: 'grid', data: { groups } });
    console.log('page', JSON.stringify(page).slice(0, 300));
  }
  console.log(`${ok.length} ok, ${results.length - ok.length} failed`);
})();

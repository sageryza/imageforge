#!/usr/bin/env node
// piece-draw.js — draw NEW pattern pieces from a container in the fruit
// chart's exact recipe (2026-09-22, Sophie, building the exotic set around
// the peacock: "try the first and magnolia").
//
//   node scripts/piece-draw.js --list scripts/decks/exotic.json --ids garnet,magnolia [--dry]
//
// The list file holds {id, name, scene}; the scene is her line, sent VERBATIM
// inside the same wrapper every deck card used (refs/sage-sandy-mirror.png as
// the style reference, gpt-image-2 edits, 1024x1024, medium — pattern.js
// DRAW, verbatim). The picture is stamped with its whole prompt, uploaded to
// pieces/full/<id>.webp (+ a 640px card), filed into the chat's Assets tab
// with its label, MODEL · QUALITY · SIZE caption and prompt split, and the
// record appended to <list>-drawn.json (decks/exotic-drawn.json), which
// card-pattern.js reads as a set. NEVER run without her go for the exact ids.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const LIST = flag('list', '');
const IDS = (flag('ids', '') || '').split(',').filter(Boolean);
const CHAT = flag('chat', 'peacock-set-placement');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const BASE = 'https://imageforge-q125.onrender.com';
const DRY = args.includes('--dry');
const ROOT = path.join(__dirname, '..');
const STYLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]';
const QUALITY = 'medium', SIZE = '1024x1024', TIER = '1K';
if (!LIST || !IDS.length) { console.error('--list file --ids a,b are required (her go names them)'); process.exit(1); }

const rows = JSON.parse(fs.readFileSync(LIST, 'utf8')).filter(r => IDS.includes(r.id));
const missing = IDS.filter(id => !rows.find(r => r.id === id));
if (missing.length) { console.error('not on the list:', missing.join(',')); process.exit(1); }
const recFile = LIST.replace(/\.json$/, '-drawn.json');

async function draw(prompt) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'webp');
  form.append('image[]', fs.readFileSync(path.join(ROOT, 'refs', 'sage-sandy-mirror.png')), { filename: 'sage-sandy-mirror.png', contentType: 'image/png' });
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form, timeout: 300000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return Buffer.from(data.data[0].b64_json, 'base64');
}

(async () => {
  for (const r of rows) console.log(`${r.id} · ${QUALITY} · ${SIZE} · ${r.scene}`);
  if (DRY) return;
  const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: `${key.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();
  const put = async (buf, dest) => { const f = bucket.file(dest); await f.save(buf, { metadata: { contentType: 'image/webp' }, resumable: false }); await f.makePublic(); return `https://storage.googleapis.com/${bucket.name}/${dest}`; };
  const recs = fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : [];
  for (const r of rows) {
    const full = STYLE.replace('[content]', r.scene);
    const t0 = Date.now();
    const raw = await draw(full);
    const n = recs.filter(x => x.piece === r.id).length + 1;
    const id = n > 1 ? `${r.id}-v${n}` : r.id;
    const tmp = path.join(process.env.CLAUDE_SCRATCH || '/tmp', id + '.webp');
    fs.writeFileSync(tmp, raw);
    execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), tmp, '--full', full, '--style', STYLE, '--content', r.scene,
      '--model', 'gpt-image-2', '--quality', QUALITY, '--size', TIER, '--chat', CHAT], { stdio: 'inherit' });
    const stamped = fs.readFileSync(tmp);
    const fullUrl = await put(stamped, `pieces/full/${id}.webp`);
    const small = await sharp(stamped).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toBuffer();
    const url = await put(small, `pieces/card/${id}.webp`);
    const description = `${r.name}${n > 1 ? ` v${n}` : ''} — pattern piece (${QUALITY} · ${TIER})`;
    await fetch(`${BASE}/api/gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, session: SESSION, url: fullUrl, description, prompt: `gpt-image-2 · ${QUALITY} · ${TIER}` }) });
    await fetch(`${BASE}/api/gallery/assets/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, url: fullUrl, style: STYLE, content: r.scene, full }) });
    recs.push({ id, piece: r.id, name: r.name, url, full: fullUrl, quality: QUALITY, size: TIER, scene: r.scene, chat: CHAT, at: new Date().toISOString() });
    fs.writeFileSync(recFile, JSON.stringify(recs, null, 1));
    console.log(`  drawn in ${((Date.now() - t0) / 1000) | 0}s → ${fullUrl}`);
  }
})().catch(e => { console.error(e); process.exit(1); });

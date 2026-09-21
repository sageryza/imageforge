#!/usr/bin/env node
// deck-draw.js — draw a whole flash-card deck with THE deck recipe (2026-09-21,
// Sophie: "can u make a house plants deck same style w the words under too
// medium"). One list file per deck (scripts/decks/<deck>.json: id, name,
// scene), the SAME wrapper and style reference every fruit and vegetable card
// used (fruit-redraw.js: refs/sage-sandy-mirror.png attached to a gpt-image-2
// edit, 1024x1024, medium), the exact prompt stamped into the file, the full
// picture and a 640px card copy in Storage under <deck>/full and <deck>/card,
// each picture filed into the chat's Assets tab with its label, caption and
// prompt split, and a record per card in scripts/decks/<deck>-drawn.json (what
// flashcard-compose.py and the deck pages read). Re-running skips cards that
// already have a record — a deck grows, it never redraws by accident.
//
//   node scripts/deck-draw.js --deck plants [--chat male-playing-cards-auto] [--only 01-monstera,02-pothos] [--dry] [--jobs 3]
//
// NEVER run without her go. Cost is ~4-6¢ a card at medium; --dry prints the
// list and the count and spends nothing.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const DECK = flag('deck');
if (!DECK) { console.error('--deck <name> is required (scripts/decks/<name>.json)'); process.exit(1); }
const CHAT = flag('chat', 'male-playing-cards-auto');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const ONLY = (flag('only', '') || '').split(',').filter(Boolean);
const JOBS = parseInt(flag('jobs', '3'), 10);
const DRY = args.includes('--dry');
const BASE = 'https://imageforge-q125.onrender.com';
const ROOT = path.join(__dirname, '..');
const LIST = path.join(__dirname, 'decks', `${DECK}.json`);
const REC = path.join(__dirname, 'decks', `${DECK}-drawn.json`);
const STYLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]';
const tier = (size) => { const w = parseInt(size, 10); return w >= 4000 ? '4K' : w >= 2000 ? '2K' : '1K'; };

const list = JSON.parse(fs.readFileSync(LIST, 'utf8'));
const quality = list.quality || 'medium';
const size = list.size || '1024x1024';
const recs = fs.existsSync(REC) ? JSON.parse(fs.readFileSync(REC, 'utf8')) : [];
const done = new Set(recs.map((r) => r.id));
const todo = list.cards.filter((c) => (!ONLY.length || ONLY.includes(c.id)) && !done.has(c.id));
console.log(`${list.title || DECK}: ${list.cards.length} cards, ${done.size} drawn, ${todo.length} to draw · ${quality} · ${size}`);
for (const c of todo) console.log(`  ${c.id} · ${c.scene}`);
if (DRY || !todo.length) process.exit(0);

async function draw(prompt) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
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
  const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: `${key.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();
  const put = async (buf, dest) => { const f = bucket.file(dest); await f.save(buf, { metadata: { contentType: 'image/webp' }, resumable: false }); await f.makePublic(); return `https://storage.googleapis.com/${bucket.name}/${dest}`; };
  const save = () => fs.writeFileSync(REC, JSON.stringify(recs, null, 1));

  const one = async (c) => {
    const full = STYLE.replace('[content]', c.scene);
    const t0 = Date.now();
    const raw = await draw(full);
    const tmp = path.join('/tmp', `${DECK}-${c.id}.webp`);
    fs.writeFileSync(tmp, raw);
    execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), tmp, '--full', full, '--style', STYLE, '--content', c.scene,
      '--model', 'gpt-image-2', '--quality', quality, '--size', tier(size), '--chat', CHAT], { stdio: 'ignore' });
    const stamped = fs.readFileSync(tmp);
    const fullUrl = await put(stamped, `${DECK}/full/${c.id}.webp`);
    const small = await sharp(stamped).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toBuffer();
    const url = await put(small, `${DECK}/card/${c.id}.webp`);
    const description = `${c.name} — ${list.title || DECK} deck (${quality} · ${tier(size)})`;
    await fetch(`${BASE}/api/gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, session: SESSION, url: fullUrl, description, prompt: `gpt-image-2 · ${quality} · ${tier(size)}` }) });
    await fetch(`${BASE}/api/gallery/assets/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, url: fullUrl, style: STYLE, content: c.scene, full }) });
    recs.push({ id: c.id, name: c.name, url, full: fullUrl, quality, size: tier(size), scene: c.scene, at: new Date().toISOString() });
    save();
    console.log(`  ${c.id} drawn in ${((Date.now() - t0) / 1000) | 0}s`);
  };

  // JOBS at a time; a failure is logged and the rest go on (re-run picks it up).
  const queue = [...todo];
  let failed = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    while (queue.length) {
      const c = queue.shift();
      try { await one(c); } catch (e) { failed++; console.log(`  ${c.id} FAILED: ${e.message}`); }
    }
  }));
  console.log(`done: ${recs.length} drawn, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

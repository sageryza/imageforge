// fruit-redraw.js — redraw deck cards from her notes, the deck's own recipe
// (2026-09-20, Sophie: "let's start w cut ones" · "we need the whole one next
// to it" · "try it w seeet potato and pineaple").
//
//   node scripts/fruit-redraw.js --ids 10-sweetpotato,09-pineapple [--tag cut1] [--dry]
//
// A row may carry `size` (default 1024x1024): the vegetables were drawn two
// to a landscape sheet and cut apart, so a card is ~750px — she asked for
// asparagus and broccoli again on their own at 2K (2026-09-20: "the
// vegetables were done two at a time · very landscape · redo asparagus
// broccoli at 2k or 4k"). A veg row uploads under veg/ instead of fruit/.
//
// Reads scripts/fruit-chart/redo-2026-09-20.json for the scene line, sends the
// SAME wrapper every deck card used with refs/sage-sandy-mirror.png attached
// (gpt-image-2 edits, 1024x1024, medium unless the row says otherwise), stamps
// the exact prompt into the file, uploads fruit/full + fruit/card as
// `<id>-<tag>.webp`, files the picture into the chat's Assets with its label,
// caption and prompt split, and appends the record to
// scripts/fruit-chart/redo-uploaded.json (fruit-sketch-pick.js reads it).
// NEVER run without her go for the exact ids.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const IDS = (flag('ids', '') || '').split(',').filter(Boolean);
const TAG = flag('tag', 'cut1');
const CHAT = flag('chat', 'fruits-vegetables-inventory');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const BASE = 'https://imageforge-q125.onrender.com';
const DRY = args.includes('--dry');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scripts', 'fruit-chart');
const STYLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]';
if (!IDS.length) { console.error('--ids a,b is required (her go names them)'); process.exit(1); }

const rows = JSON.parse(fs.readFileSync(path.join(OUT, 'redo-2026-09-20.json'), 'utf8')).filter(r => IDS.includes(r.id));
const missing = IDS.filter(id => !rows.find(r => r.id === id));
if (missing.length) { console.error('not on the redo list:', missing.join(',')); process.exit(1); }

const tier = size => { const w = parseInt(size, 10); return w >= 4000 ? '4K' : w >= 2000 ? '2K' : '1K'; };
async function draw(prompt, quality, size) {
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
  const recFile = path.join(OUT, 'redo-uploaded.json');
  const recs = fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : [];
  for (const r of rows) {
    const quality = r.quality || 'medium';
    const size = r.size || '1024x1024';
    const pre = r.deck === 'veg' ? 'veg' : 'fruit';
    const full = STYLE.replace('[content]', r.scene);
    console.log(`${r.id} · ${quality} · ${size} · ${r.scene}`);
    if (DRY) continue;
    const t0 = Date.now();
    const raw = await draw(full, quality, size);
    const id = `${r.id}-${TAG}`;
    const tmp = path.join('/tmp', id + '.webp');
    fs.writeFileSync(tmp, raw);
    execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), tmp, '--full', full, '--style', STYLE, '--content', r.scene,
      '--model', 'gpt-image-2', '--quality', quality, '--size', tier(size), '--chat', CHAT], { stdio: 'inherit' });
    const stamped = fs.readFileSync(tmp);
    const fullUrl = await put(stamped, `${pre}/full/${id}.webp`);
    const small = await sharp(stamped).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toBuffer();
    const url = await put(small, `${pre}/card/${id}.webp`);
    const description = r.kind === 'cut' ? `${r.name} — redrawn, whole with one cut open (${quality})` : `${r.name} — redrawn on its own at ${tier(size)} (${quality})`;
    await fetch(`${BASE}/api/gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, session: SESSION, url: fullUrl, description, prompt: `gpt-image-2 · ${quality} · ${tier(size)}` }) });
    await fetch(`${BASE}/api/gallery/assets/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, url: fullUrl, style: STYLE, content: r.scene, full }) });
    recs.push({ id, deck: r.id, name: r.name, url, full: fullUrl, quality, size: tier(size), tag: TAG, scene: r.scene, at: new Date().toISOString() });
    fs.writeFileSync(recFile, JSON.stringify(recs, null, 1));
    console.log(`  drawn in ${((Date.now() - t0) / 1000) | 0}s → ${fullUrl}`);
  }
})().catch(e => { console.error(e); process.exit(1); });

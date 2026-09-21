// animals-draw-pair.js — two animals on one landscape sheet, cut apart
// (2026-09-21, Sophie: "what if we did two animals like the asparagus one ·
// try w a bear and a cheetah"). The vegetable pairs' recipe (two-up on a 3:2
// sheet, fruit-cut.js at the gutter) at the 4K landscape size, where the
// measured price is 11.7¢ + 1.2¢ for the style reference — about 6.5¢ an
// animal with ~1750px each (docs/modules/pictures.md).
//
//   node scripts/animals-draw-pair.js --left "a bear" --right "a cheetah" [--ids bear,cheetah]
//        [--size 3504x2336] [--quality medium] [--dry]
//
// Never run without her go for the exact pair.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const LEFT = flag('left'), RIGHT = flag('right');
const IDS = (flag('ids', '') || '').split(',').filter(Boolean);
const SIZE = flag('size', '3504x2336');
const QUALITY = flag('quality', 'medium');
const CHAT = flag('chat', 'fruits-vegetables-inventory');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const BASE = 'https://imageforge-q125.onrender.com';
const DRY = args.includes('--dry');
const ROOT = path.join(__dirname, '..');
if (!LEFT || !RIGHT || IDS.length !== 2) { console.error('--left, --right and --ids a,b are required'); process.exit(1); }

const STYLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]';
const SCENE = `two separate animal drawings side by side, evenly spaced, each drawn on its own with clear white space around it — not touching or overlapping. On the left: ${LEFT}. On the right: ${RIGHT}. No text or lettering anywhere.`;
const FULL = STYLE.replace('[content]', SCENE);
const tier = s => { const w = parseInt(s, 10); return w >= 3000 ? '4K' : w >= 1900 ? '2K' : '1K'; };
const cap = `gpt-image-2 · ${QUALITY} · ${tier(SIZE)}`;
const name = s => s.replace(/^(a|an) /, '');

async function draw() {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', FULL);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'webp');
  form.append('image[]', fs.readFileSync(path.join(ROOT, 'refs', 'sage-sandy-mirror.png')), { filename: 'sage-sandy-mirror.png', contentType: 'image/png' });
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form, timeout: 300000 });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return Buffer.from(data.data[0].b64_json, 'base64');
}

(async () => {
  console.log(`${SIZE} · ${QUALITY}\n${SCENE}`);
  if (DRY) return;
  const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: `${key.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();
  const put = async (buf, dest) => { const f = bucket.file(dest); await f.save(buf, { metadata: { contentType: 'image/webp' }, resumable: false }); await f.makePublic(); return `https://storage.googleapis.com/${bucket.name}/${dest}`; };
  const file = async (url, description) => {
    await fetch(`${BASE}/api/gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetsOnly: true, chat: CHAT, session: SESSION, url, description, prompt: cap }) });
    await fetch(`${BASE}/api/gallery/assets/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, url, style: STYLE, content: SCENE, full: FULL }) });
  };
  const stamp = (f) => execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), f, '--full', FULL, '--style', STYLE, '--content', SCENE, '--model', 'gpt-image-2', '--quality', QUALITY, '--size', tier(SIZE), '--chat', CHAT], { stdio: 'inherit' });

  const pairId = `pair-${IDS.join('-')}`;
  const dir = `/tmp/animals-${pairId}`; fs.mkdirSync(dir, { recursive: true });
  const sheetPath = path.join(dir, pairId + '.webp');
  const t0 = Date.now();
  fs.writeFileSync(sheetPath, await draw());
  console.log(`drawn in ${((Date.now() - t0) / 1000) | 0}s`);
  stamp(sheetPath);
  const sheetUrl = await put(fs.readFileSync(sheetPath), `animals/sheet/${pairId}.webp`);
  await file(sheetUrl, `${name(LEFT)} + ${name(RIGHT)} — the two-up sheet (uncut)`);

  const namesFile = path.join(dir, 'names.json');
  fs.writeFileSync(namesFile, JSON.stringify([{ id: IDS[0], name: name(LEFT) }, { id: IDS[1], name: name(RIGHT) }]));
  execFileSync('node', [path.join(ROOT, 'scripts', 'fruit-cut.js'), sheetPath, namesFile, dir, '--cols', '2', '--rows', '1'], { stdio: 'inherit' });
  const out = [];
  for (const id of IDS) {
    const card = path.join(dir, id + '.webp');
    stamp(card);
    const full = await put(fs.readFileSync(card), `animals/full/${id}.webp`);
    const small = await sharp(card).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toBuffer();
    const url = await put(small, `animals/card/${id}.webp`);
    const label = id === IDS[0] ? name(LEFT) : name(RIGHT);
    await file(full, `${label[0].toUpperCase()}${label.slice(1)} — cut from the two-up sheet`);
    out.push({ id, name: label, url, full, sheet: sheetUrl, size: tier(SIZE), quality: QUALITY });
    console.log(`  ${label} → ${full}`);
  }
  const rec = path.join(ROOT, 'scripts', 'fruit-chart', 'animals-uploaded.json');
  const recs = fs.existsSync(rec) ? JSON.parse(fs.readFileSync(rec, 'utf8')) : [];
  fs.writeFileSync(rec, JSON.stringify(recs.concat(out), null, 1));
})().catch(e => { console.error(e); process.exit(1); });

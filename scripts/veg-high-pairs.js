// veg-high-pairs.js — four vegetables drawn at HIGH, two to a wide sheet, cut
// apart and filed beside their medium cards (2026-09-21, Sophie: "ok test",
// after "do u think i shud redo them all at high?").
//
//   node scripts/veg-high-pairs.js [--dry]
//
// The medium vegetable cards were drawn two to a 1536x1024 sheet and cut with
// fruit-cut.js, so the fair comparison draws the high ones the same way — the
// same wrapper, the same reference (refs/sage-sandy-mirror.png), the same cut.
// Wide at high is 18.4¢ a sheet against 23¢ for one square, so a pair is the
// cheap shape too. Uploads veg/full + veg/card as `<id>-hq.webp` (the medium
// card is never overwritten), files each into the chat's Assets with its
// caption and exact prompt, and writes scripts/fruit-chart/veg-hq-uploaded.json.
// NEVER run without her go.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const CHAT = 'reaching-54-no-stretch';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
const BASE = 'https://imageforge-q125.onrender.com';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scripts', 'fruit-chart');
const WORK = path.join(process.env.SCRATCH || '/tmp', 'veg-hq');
const STYLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]';
const PAIR = 'two separate vegetable drawings side by side, evenly spaced, each drawn on its own with clear white space around it — not touching or overlapping. On the left: [left]. On the right: [right]. No text or lettering anywhere.';

// The same scene phrases the medium sheets used (veg-pairs.json), so the only
// thing that differs between the two cards on a row is the quality.
const PAIRS = [
  { id: 'hq-veg-01', cells: [{ id: '07-bellpepper', name: 'Bell pepper', scene: 'a red bell pepper' }, { id: '13-cauliflower', name: 'Cauliflower', scene: 'a head of cauliflower' }] },
  { id: 'hq-veg-02', cells: [{ id: '12-kale', name: 'Kale', scene: 'a bunch of curly kale' }, { id: '04-corn', name: 'Corn', scene: 'an ear of corn with the husk peeled back' }] },
];

async function draw(prompt) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', 'high');
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
  fs.mkdirSync(WORK, { recursive: true });
  const recFile = path.join(OUT, 'veg-hq-uploaded.json');
  const recs = fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : [];
  let bucket;
  if (!DRY) {
    const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: `${key.project_id}.firebasestorage.app` });
    bucket = admin.storage().bucket();
  }
  const put = async (buf, dest) => { const f = bucket.file(dest); await f.save(buf, { metadata: { contentType: 'image/webp' }, resumable: false }); await f.makePublic(); return `https://storage.googleapis.com/${bucket.name}/${dest}`; };

  for (const p of PAIRS) {
    const content = PAIR.replace('[left]', p.cells[0].scene).replace('[right]', p.cells[1].scene);
    const full = STYLE.replace('[content]', content);
    console.log(`${p.id} · high · 1536x1024\n  ${content}`);
    if (DRY) continue;
    const t0 = Date.now();
    const sheet = path.join(WORK, p.id + '.webp');
    fs.writeFileSync(sheet, await draw(full));
    const names = path.join(WORK, p.id + '-names.json');
    fs.writeFileSync(names, JSON.stringify(p.cells.map(c => ({ id: c.id + '-hq', name: c.name }))));
    const cut = path.join(WORK, p.id + '-cells');
    execFileSync('node', [path.join(ROOT, 'scripts', 'fruit-cut.js'), sheet, names, cut, '--cols', '2', '--rows', '1'], { stdio: 'inherit' });
    console.log(`  drawn in ${((Date.now() - t0) / 1000) | 0}s`);
    for (const c of p.cells) {
      const id = c.id + '-hq';
      const file = path.join(cut, id + '.webp');
      execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), file, '--full', full, '--style', STYLE, '--content', content,
        '--model', 'gpt-image-2', '--quality', 'high', '--size', '1K', '--chat', CHAT], { stdio: 'inherit' });
      const stamped = fs.readFileSync(file);
      const fullUrl = await put(stamped, `veg/full/${id}.webp`);
      const small = await sharp(stamped).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toBuffer();
      const url = await put(small, `veg/card/${id}.webp`);
      const description = `${c.name} — drawn at high, cut from a pair (the medium-vs-high test)`;
      await fetch(`${BASE}/api/gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetsOnly: true, chat: CHAT, session: SESSION, url: fullUrl, description, prompt: 'gpt-image-2 · high · 1K' }) });
      await fetch(`${BASE}/api/gallery/assets/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: CHAT, url: fullUrl, style: STYLE, content, full }) });
      recs.push({ id, deck: c.id, name: c.name, url, full: fullUrl, quality: 'high', size: '1K', sheet: p.id, scene: content, at: new Date().toISOString() });
      fs.writeFileSync(recFile, JSON.stringify(recs, null, 1));
      console.log(`  ${id} → ${fullUrl}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// pattern-gpt-mockup.js — a pattern shown on a real-looking product through
// gpt-image-2 (2026-09-22, Sophie, on the CSS bed: "lol hahaha did u draw the
// mockup urself?? i meant use gpt"). The photostudio / animal-mockup recipe:
// the pattern rides as the REFERENCE (the 3x3 repeat, so the model sees it
// repeating) attached as `image[]` to an edit, and the prompt describes only
// the SCENE — never what is printed on the fabric (the never-describe-a-
// reference rule). Each take is stamped with its exact prompt, filed into the
// Dump and the chat's Assets tab with its caption, and the takes go on one
// grid page.
//
//   node scripts/pattern-gpt-mockup.js --tile "all fifteen fruit" [--tile "sea animals"]
//        [--scene "a bedspread …"] [--size 1536x1024] [--quality medium] [--takes 1]
//        [--chat animal-fruit-patterns] [--v 1] [--dry]
//
// ~5-6¢ a take at medium. NEVER run without her go; --dry prints the prompt
// and spends nothing.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
const flags = (n) => args.map((a, i) => (a === '--' + n ? args[i + 1] : null)).filter(Boolean);
const has = (n) => args.includes('--' + n);
const ROOT = path.join(__dirname, '..');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const CHAT = flag('chat', 'animal-fruit-patterns');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const VERSION = flag('v', '1');
const SIZE = flag('size', '1536x1024');
const QUALITY = flag('quality', 'medium');
const TAKES = Number(flag('takes', 1));
const DRY = has('dry');
const SCENE = flag('scene', 'a bedspread sewn from this fabric on a made double bed in a bright, plain bedroom, seen from the foot of the bed, soft daylight from a window to one side, plain white pillows. The print is LARGE: each drawing on the fabric is about the size of a hand, and the attached image covers roughly one third of the width of the bed, so only a few repeats fit across it');
const SCRATCH = process.env.CLAUDE_SCRATCH || path.join(process.env.TMPDIR || '/tmp', 'card-pattern');
const OUT = path.join(SCRATCH, 'gpt-mockups');
fs.mkdirSync(OUT, { recursive: true });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tier = (s) => { const [w, h] = String(s).split('x').map(Number); const m = Math.max(w, h); return m >= 3000 ? '4K' : m >= 1800 ? '2K' : '1K'; };

const STYLE = `The attached image is the fabric. Keep the fabric exactly as it appears there — the same print at the same scale — and do not add, change or invent anything printed on it.

Draw a product photograph: [content]`;
const FULL = STYLE.replace('[content]', SCENE);
const TILES = flags('tile');
if (!TILES.length) { console.error('usage: --tile <pattern name> [--tile …] [--scene "…"] [--dry]'); process.exit(2); }

async function draw(refPath) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', FULL);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'webp');
  form.append('image[]', fs.readFileSync(refPath), { filename: 'fabric.png', contentType: 'image/png' });
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form, timeout: 300000 });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return Buffer.from(data.data[0].b64_json, 'base64');
}
const upload = async (buf, filename, ct) => {
  const q = new URLSearchParams({ session: 'pattern-gpt-mockups', bundle: `pattern mockups v${VERSION}`, filename });
  const j = await (await fetch(`${BASE}/api/drop/upload-file?${q}`, { method: 'POST', headers: { 'Content-Type': ct }, body: buf })).json();
  if (!j.ok) throw new Error(`upload ${filename}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.item;
};
const post = (u, body) => fetch(`${BASE}${u}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

(async () => {
  console.log(`${SIZE} · ${QUALITY} · ${TAKES} take(s) each\n${FULL}\n`);
  const cap = `gpt-image-2 · ${QUALITY} · ${tier(SIZE)}`;
  const groups = [];
  for (const name of TILES) {
    const key = slug(name);
    const tilePath = path.join(SCRATCH, 'out', `${key}.png`);
    if (!fs.existsSync(tilePath)) throw new Error(`no tile at ${tilePath} — draw "${name}" with card-pattern.js first`);
    // The reference is ONE tile at 1536px (a 3x3 made the model print it tiny
    // — 2026-09-22, "ur mockup was way too tiny"); the prompt says how big it
    // sits on the bed.
    const refPath = path.join(OUT, `${key}-ref.png`);
    await sharp(tilePath).resize(1536, 1536).png().toFile(refPath);
    console.log(`${name}: reference ${refPath}`);
    if (DRY) continue;
    const items = [];
    for (let i = 1; i <= TAKES; i++) {
      const buf = await draw(refPath);
      const tmp = path.join(OUT, `${key}-take-${i}.webp`);
      fs.writeFileSync(tmp, buf);
      execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), tmp, '--full', FULL, '--style', STYLE, '--content', SCENE, '--model', 'gpt-image-2', '--quality', QUALITY, '--size', tier(SIZE), '--chat', CHAT], { stdio: 'ignore' });
      const it = await upload(fs.readFileSync(tmp), `${key}-bedspread-take-${i}.webp`, 'image/webp');
      const description = `${name} — as a bedspread, gpt-image-2 take ${i} (${QUALITY} · ${tier(SIZE)})`;
      await post('/api/gallery', { assetsOnly: true, chat: CHAT, session: SESSION, url: it.url, description, prompt: cap });
      await post('/api/gallery/assets/prompt', { chat: CHAT, url: it.url, style: STYLE, content: SCENE, full: FULL });
      items.push({ id: `${key}-take-${i}`, img: it.thumb || it.url, full: it.url, url: it.url, label: `${name} · take ${i} · ${QUALITY} · ${tier(SIZE)}`, model: 'gpt-image-2', quality: QUALITY, size: tier(SIZE) });
      console.log(`  take ${i} → ${it.url}`);
    }
    groups.push({ label: name, items });
  }
  if (DRY || !groups.length) return;
  const title = `Bedspread mockups v${VERSION} — gpt-image-2, ${groups.map((g) => g.label).join(', ')}`;
  const page = await post('/api/chatfeed/page', { chat: CHAT, session: SESSION, title, template: 'grid', data: { groups, help: 'The pattern handed to gpt-image-2 as the fabric, the bed and the room described in words. ♥ or ✕, and tap + to say what to change about the scene.' } });
  console.log('page', JSON.stringify(page));
  console.log(`\npage: ${BASE}/api/chatfeed/page/${page.id}`);
})().catch((e) => { console.error(e); process.exit(1); });

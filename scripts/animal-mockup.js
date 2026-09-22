#!/usr/bin/env node
// animal-mockup.js — a PRODUCT MOCKUP of the animal flash cards through
// gpt-image-2 (2026-09-22, Sophie: "how can we make product mockups w chat
// gpt" · "maybe u can attach multiple cards as one reference" · "go, cards
// fanned on a wood table"). The photostudio / jewelry recipe: the product
// rides as the REFERENCE — here ONE SHEET of finished print cards (the
// flashcard-compose.py fronts laid out in a grid, so every card is exact on
// one picture) attached as `image[]` to an edit — and the prompt describes
// only the SCENE, never the cards (the never-describe-a-reference rule).
// Each take is stamped with its exact prompt, filed into the Dump and the
// chat's Assets tab with its caption and prompt split, and the takes plus
// the sheet go on one grid page.
//
//   node scripts/animal-mockup.js --fronts <dir> --scene "cards fanned out on a wood table"
//        [--takes 1] [--size 1536x1024] [--quality medium] [--material "thick matte white cardstock"]
//        [--chat animal-deck-heart-tiebreak] [--dry]
//
// NEVER run without her go for the scene. ~5-6¢ a take at medium, ONE take a scene; --dry
// builds the sheet and prints the prompt, spending nothing.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const FRONTS = flag('fronts');
const SCENE = flag('scene');
const TAKES = parseInt(flag('takes', '1'), 10);  // one take a scene (2026-09-22, "stop doing two takes")
const SIZE = flag('size', '1536x1024');
const QUALITY = flag('quality', 'medium');
const CHAT = flag('chat', 'animal-deck-heart-tiebreak');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const BASE = 'https://imageforge-q125.onrender.com';
const DRY = args.includes('--dry');
const OUT = flag('out', path.join(process.env.CLAUDE_SCRATCH || '/tmp', 'animal-mockup'));
if (!FRONTS || !SCENE) { console.error('--fronts <dir> and --scene "…" are required'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const tier = (s) => { const w = parseInt(s, 10); return w >= 4000 ? '4K' : w >= 2000 ? '2K' : '1K'; };
// --material: the card stock, named (2026-09-22, "u might specify material").
const MATERIAL = flag('material', 'thick matte white cardstock');
// EVERY CARD IS THE SAME SIZE, SAID OUT LOUD (2026-09-22, "wait the cards
// aren't keeping size!" — set down loosely, the model redrew them at four
// different proportions). A poker card is 2.5 x 3.5in, portrait, all alike.
const STYLE = `The attached image shows the product: a set of flash cards printed on ${MATERIAL}, with rounded corners. Every card is identical in size and shape — a 2.5 by 3.5 inch portrait card, the same proportions as in the attached image — and none may be drawn larger, smaller, wider or squarer than the others. Keep every card exactly as it appears there — the drawings, the lettering, the white card face, the rounded corners — and do not add, change or invent any card. Draw a product photograph: [content]`;
const FULL = STYLE.replace('[content]', SCENE);
const post = (u, body) => fetch(`${BASE}${u}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function sheet() {
  const files = fs.readdirSync(FRONTS).filter((f) => /\.png$/i.test(f)).sort();
  const cols = Math.ceil(Math.sqrt(files.length)), rows = Math.ceil(files.length / cols);
  const cw = 412, ch = 562, gap = 40; // half the 825x1125 print card
  const W = cols * cw + (cols + 1) * gap, H = rows * ch + (rows + 1) * gap;
  const layers = [];
  // ROUNDED CORNERS (2026-09-22, "corners aren't round"): a printed poker
  // card is cut with a 1/8in radius, and the model draws the corners it is
  // shown — so the sheet's cards are masked round (37px at 825, half here).
  const r = Math.round(cw * 37 / 825);
  const mask = Buffer.from(`<svg width="${cw}" height="${ch}"><rect x="0" y="0" width="${cw}" height="${ch}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  for (const [i, f] of files.entries()) {
    const buf = await sharp(path.join(FRONTS, f)).resize(cw, ch).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    layers.push({ input: buf, left: gap + (i % cols) * (cw + gap), top: gap + Math.floor(i / cols) * (ch + gap) });
  }
  const out = path.join(OUT, 'sheet.png');
  fs.mkdirSync(OUT, { recursive: true });
  await sharp({ create: { width: W, height: H, channels: 4, background: '#f4efe6' } }).composite(layers).flatten({ background: '#f4efe6' }).png().toFile(out);
  return { out, n: files.length };
}

async function draw(sheetPath) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', FULL);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'webp');
  form.append('image[]', fs.readFileSync(sheetPath), { filename: 'cards.png', contentType: 'image/png' });
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form, timeout: 300000 });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { buf: Buffer.from(data.data[0].b64_json, 'base64'), usage: data.usage };
}

const upload = async (buf, filename, ct) => {
  const q = new URLSearchParams({ session: 'animal-mockups', bundle: 'animal deck mockups', filename });
  const j = await (await fetch(`${BASE}/api/drop/upload-file?${q}`, { method: 'POST', headers: { 'Content-Type': ct }, body: buf })).json();
  if (!j.ok) throw new Error(`upload ${filename}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.item;
};

(async () => {
  const { out: sheetPath, n } = await sheet();
  console.log(`sheet: ${n} cards → ${sheetPath}\n${SIZE} · ${QUALITY} · ${TAKES} take(s)\n${FULL}`);
  if (DRY) return;
  const sheetItem = await upload(fs.readFileSync(sheetPath), 'reference-sheet.png', 'image/png');
  const cap = `gpt-image-2 · ${QUALITY} · ${tier(SIZE)}`;
  const takes = [];
  for (let i = 1; i <= TAKES; i++) {
    const t0 = Date.now();
    const { buf, usage } = await draw(sheetPath);
    const tmp = path.join(OUT, `take-${i}.webp`);
    fs.writeFileSync(tmp, buf);
    execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), tmp, '--full', FULL, '--style', STYLE, '--content', SCENE, '--model', 'gpt-image-2', '--quality', QUALITY, '--size', tier(SIZE), '--chat', CHAT], { stdio: 'ignore' });
    const it = await upload(fs.readFileSync(tmp), `mockup-${i}.webp`, 'image/webp');
    const description = `animal deck mockup — ${SCENE}, take ${i} (${QUALITY} · ${tier(SIZE)})`;
    await post('/api/gallery', { assetsOnly: true, chat: CHAT, session: SESSION, url: it.url, description, prompt: cap });
    await post('/api/gallery/assets/prompt', { chat: CHAT, url: it.url, style: STYLE, content: SCENE, full: FULL });
    takes.push({ i, url: it.url, thumb: it.thumb || it.url, usage });
    console.log(`  take ${i} in ${((Date.now() - t0) / 1000) | 0}s → ${it.url}`);
  }
  const items = [
    ...takes.map((t) => ({ id: `mock-${t.i}`, img: t.thumb, full: t.url, url: t.url, label: `take ${t.i} · ${QUALITY} · ${tier(SIZE)}`, model: 'gpt-image-2', quality: QUALITY, size: tier(SIZE) })),
  ];
  const page = await (await post('/api/chatfeed/page', { chat: CHAT, title: `Animal deck mockup — ${SCENE} (${TAKES})`, template: 'grid', data: {
    groups: [{ label: SCENE, items }, { label: 'the reference sheet they were drawn from', items: [{ id: 'mock-sheet', img: sheetItem.thumb || sheetItem.url, full: sheetItem.url, url: sheetItem.url, label: `${n} print cards on one sheet` }] }],
    help: 'The cards rode as one reference sheet; the prompt described only the scene. Heart the take you like.',
  } })).json();
  fs.writeFileSync(path.join(__dirname, 'decks', `animals-mockup-${Date.now()}.json`), JSON.stringify({ scene: SCENE, size: SIZE, quality: QUALITY, prompt: FULL, sheet: sheetItem.url, takes, page: page.id }, null, 1));
  console.log(`page: ${BASE}/api/chatfeed/page/${page.id}`);
})().catch((e) => { console.error(e); process.exit(1); });

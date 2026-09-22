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
//        [--topdown] [--lay] [--title "…"] [--chat animal-deck-heart-tiebreak] [--dry]
//   node scripts/animal-mockup.js --fronts <dir> --from scripts/decks/animals-mockup-<n>.json   (re-lay, free)
//
// NEVER run without her go for the scene. ~5-6¢ a take at medium, ONE take a scene; --dry
// builds the sheet and prints the prompt, spending nothing.
//
// --lay: THE CARDS ARE LAID ON, NOT DRAWN (2026-09-22, "wait the cards aren't
// keeping size!" · "still looks wrong · measure"). The model redraws the cards
// it is shown — measured 4-9% apart in width and 1.27-1.49 tall-to-wide on the
// table shots, whatever the prompt says — so after each take
// scripts/mockup-lay.py finds every card the model drew, matches it to its
// print file by looks, and pastes the real front over it at ONE size (5:7,
// covering the largest drawn card) at the model's own angle, with a soft
// shadow. Exact by construction: measured 0% spread, 1.40, the real art on
// every card. The laid picture is the take; the model's own is filed under it
// as "before laying". --from re-lays the takes of an old record for free.
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
if (!FRONTS || (!SCENE && !args.includes('--from'))) { console.error('--fronts <dir> and --scene "…" (or --from <record>) are required'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const tier = (s) => { const w = parseInt(s, 10); return w >= 4000 ? '4K' : w >= 2000 ? '2K' : '1K'; };
// --material: the card stock, named (2026-09-22, "u might specify material").
const MATERIAL = flag('material', 'thick matte white cardstock');
// --topdown: the table shots — a true overhead camera so every card sits at
// one scale. Off for a scene with people, shelves or perspective.
const TOPDOWN = args.includes('--topdown');
const LAY = args.includes('--lay') || !!flag('from');
const FROM = flag('from');   // an earlier record: re-lay its takes instead of drawing
// --reference <file>: THE LAYOUT IS THE REFERENCE (2026-09-22, the answer to
// "that's not what i meant"). Instead of a sheet of cards for the model to
// arrange (and resize), it is handed a picture in which every card is ALREADY
// laid at one exact size — the print files composited at 5:7, turned a little
// — and told to photograph THAT, changing only the scene around them. The
// model does the whole photograph; the geometry it keeps is ours.
const REFERENCE = flag('reference');
// EVERY CARD IS THE SAME SIZE, SAID OUT LOUD (2026-09-22, "wait the cards
// aren't keeping size!" — set down loosely, the model redrew them at four
// different proportions). A poker card is 2.5 x 3.5in, portrait, all alike.
const STYLE = `The attached image shows the product: a set of flash cards printed on ${MATERIAL}, with rounded corners. Keep every card exactly as it appears there — the drawings, the lettering, the white card face, the rounded corners — and do not add, change or invent any card.

CARD SIZE — THIS IS THE MOST IMPORTANT RULE. All of the cards are physically identical: each one is a standard poker-size card, 2.5 inches wide by 3.5 inches tall, taller than it is wide in the ratio 5:7, exactly as they appear in the attached image. In the photograph every card must be drawn at the SAME size and the SAME 5:7 proportions as every other card: the same width, the same height, the same rounded-corner radius. Do not make any card wider, squarer, taller, larger or smaller than its neighbours. A card may be turned a little, but turning never changes its size or shape. Check every card against the others before finishing: if any two cards differ in size or proportion, the photograph is wrong.

${TOPDOWN ? 'The camera looks straight down at the table (a true top-down view, no perspective), so all the cards are seen at the same scale. ' : ''}Draw a product photograph: [content]`;
const KEEP_STYLE = `The attached image is the exact layout of a product photograph: a set of flash cards printed on ${MATERIAL}, with rounded corners, already laid out. Every card in it is the same physical size — a standard poker-size card, 2.5 by 3.5 inches — and is already drawn at its correct size, position and angle.

Turn this layout into a real product photograph. KEEP EVERY CARD EXACTLY AS IT IS: the same position, the same size, the same angle, the same drawing and lettering on it, the same rounded corners. Do not move, resize, redraw, add or remove any card. Only the surroundings change: replace the flat background with the scene below, and light the cards as real cards would be lit there, with soft natural shadows under them.

Draw a product photograph: [content]`;
const FULL = (REFERENCE ? KEEP_STYLE : STYLE).replace('[content]', SCENE || '');
const post = (u, body) => fetch(`${BASE}${u}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function sheet() {
  const files = fs.readdirSync(FRONTS).filter((f) => /\.png$/i.test(f)).sort();
  const cols = Math.ceil(Math.sqrt(files.length)), rows = Math.ceil(files.length / cols);
  const cw = 375, ch = 525, gap = 40; // half the PRINTED 750x1050 card — the 1/8in bleed trimmed, so the sheet is 5:7 like the prompt says (it was 825x1125 with bleed, 1.36)
  const W = cols * cw + (cols + 1) * gap, H = rows * ch + (rows + 1) * gap;
  const layers = [];
  // ROUNDED CORNERS (2026-09-22, "corners aren't round"): a printed poker
  // card is cut with a 1/8in radius, and the model draws the corners it is
  // shown — so the sheet's cards are masked round (37px at 825, half here).
  const r = Math.round(cw * 37 / 825);
  const mask = Buffer.from(`<svg width="${cw}" height="${ch}"><rect x="0" y="0" width="${cw}" height="${ch}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  for (const [i, f] of files.entries()) {
    const src = sharp(path.join(FRONTS, f)); const meta = await src.metadata();
    const bleed = meta.width === 825 && meta.height === 1125 ? 37 : 0;
    const buf = await src.extract({ left: bleed, top: bleed, width: meta.width - 2 * bleed, height: meta.height - 2 * bleed }).resize(cw, ch).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
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

// lay the real fronts over the drawn cards (mockup-lay.py); answers the laid file and its report
function lay(takePath, i) {
  const out = path.join(OUT, `laid-${i}.png`), rep = path.join(OUT, `laid-${i}.json`);
  const log = execFileSync('python3', [path.join(ROOT, 'scripts', 'mockup-lay.py'), takePath, '--fronts', FRONTS, '--out', out, '--report', rep], { encoding: 'utf8' });
  console.log(log.trim().split('\n').map((l) => '    ' + l).join('\n'));
  return { out, report: JSON.parse(fs.readFileSync(rep, 'utf8')) };
}

(async () => {
  const prior = FROM ? JSON.parse(fs.readFileSync(FROM, 'utf8')) : null;
  const scene = prior ? prior.scene : SCENE;
  const full = prior ? prior.prompt : FULL;
  const quality = prior ? prior.quality : QUALITY, size = prior ? prior.size : SIZE;
  const { out: sheetPath, n } = REFERENCE ? { out: REFERENCE, n: fs.readdirSync(FRONTS).filter((f) => /\.png$/i.test(f)).length } : await sheet();
  console.log(`sheet: ${n} cards → ${sheetPath}\n${size} · ${quality} · ${prior ? `re-laying ${prior.takes.length} take(s) of ${FROM}` : `${TAKES} take(s)`}${LAY ? ' · laid' : ''}\n${full}`);
  if (DRY) return;
  fs.mkdirSync(OUT, { recursive: true });   // --reference skips sheet(), which used to be what made it
  const sheetItem = prior ? { url: prior.sheet, thumb: prior.sheet } : await upload(fs.readFileSync(sheetPath), REFERENCE ? 'reference-layout.png' : 'reference-sheet.png', 'image/png');
  const cap = `gpt-image-2 · ${quality} · ${tier(size)}`;
  const takes = [];
  const count = prior ? prior.takes.length : TAKES;
  for (let i = 1; i <= count; i++) {
    const t0 = Date.now();
    const tmp = path.join(OUT, `take-${i}.webp`);
    let usage, it;
    if (prior) {
      // an old take, fetched back; already filed and stamped by its own run
      fs.writeFileSync(tmp, Buffer.from(await (await fetch(prior.takes[i - 1].url)).arrayBuffer()));
      it = { url: prior.takes[i - 1].url, thumb: prior.takes[i - 1].thumb };
    } else {
      const d = await draw(sheetPath); usage = d.usage;
      fs.writeFileSync(tmp, d.buf);
      execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), tmp, '--full', full, '--style', REFERENCE ? KEEP_STYLE : STYLE, '--content', scene, '--model', 'gpt-image-2', '--quality', quality, '--size', tier(size), '--chat', CHAT], { stdio: 'ignore' });
      it = await upload(fs.readFileSync(tmp), `mockup-${i}.webp`, 'image/webp');
      const description = `animal deck mockup — ${scene}, take ${i}${LAY ? ', before laying' : ''} (${quality} · ${tier(size)})`;
      await post('/api/gallery', { assetsOnly: true, chat: CHAT, session: SESSION, url: it.url, description, prompt: cap });
      await post('/api/gallery/assets/prompt', { chat: CHAT, url: it.url, style: REFERENCE ? KEEP_STYLE : STYLE, content: scene, full });
    }
    const take = { i, url: it.url, thumb: it.thumb || it.url, usage };
    if (LAY) {
      const { out, report } = lay(tmp, i);
      // the laid picture is the take she sees: the scene is the model's (same prompt on record), the cards are the print files
      const laidWebp = path.join(OUT, `laid-${i}.webp`);
      await sharp(out).webp({ lossless: true }).toFile(laidWebp);
      execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), laidWebp, '--full', full, '--style', STYLE, '--content', scene, '--model', 'gpt-image-2', '--quality', quality, '--size', tier(size), '--chat', CHAT], { stdio: 'ignore' });
      const li = await upload(fs.readFileSync(laidWebp), `mockup-${i}-laid.webp`, 'image/webp');
      await post('/api/gallery', { assetsOnly: true, chat: CHAT, session: SESSION, url: li.url, description: `animal deck mockup — ${scene}, take ${i}, the real cards laid on at one size (${quality} · ${tier(size)})`, prompt: cap });
      await post('/api/gallery/assets/prompt', { chat: CHAT, url: li.url, style: STYLE, content: scene, full });
      take.drawn = { url: take.url, thumb: take.thumb }; take.url = li.url; take.thumb = li.thumb || li.url; take.laid = report;
    }
    takes.push(take);
    console.log(`  take ${i} in ${((Date.now() - t0) / 1000) | 0}s → ${take.url}`);
  }
  const items = takes.map((t) => ({ id: `mock-${t.i}`, img: t.thumb, full: t.url, url: t.url, label: `take ${t.i}${t.laid ? ` · ${t.laid.laid.length} cards laid at one size` : ''} · ${quality} · ${tier(size)}`, model: 'gpt-image-2', quality, size: tier(size) }));
  const groups = [{ label: scene, items }];
  if (LAY) groups.push({ label: 'as the model drew them, before laying', items: takes.map((t) => ({ id: `drawn-${t.i}`, img: t.drawn.thumb, full: t.drawn.url, url: t.drawn.url, label: `take ${t.i} as drawn · ${quality} · ${tier(size)}`, model: 'gpt-image-2', quality, size: tier(size) })) });
  groups.push({ label: 'the reference sheet they were drawn from', items: [{ id: 'mock-sheet', img: sheetItem.thumb || sheetItem.url, full: sheetItem.url, url: sheetItem.url, label: `${n} print cards on one sheet` }] });
  const page = await (await post('/api/chatfeed/page', { chat: CHAT, title: `Animal deck mockup — ${flag('title', scene)}`, template: 'grid', data: {
    groups,
    help: LAY ? 'The model drew the table and where each card lies; the print files were laid on top at one exact size. Heart the take you like.' : 'The cards rode as one reference sheet; the prompt described only the scene. Heart the take you like.',
  } })).json();
  fs.writeFileSync(path.join(__dirname, 'decks', `animals-mockup-${Date.now()}.json`), JSON.stringify({ scene, size, quality, prompt: full, sheet: sheetItem.url, laid: LAY, from: FROM || undefined, takes, page: page.id }, null, 1));
  console.log(`page: ${BASE}/api/chatfeed/page/${page.id}`);
})().catch((e) => { console.error(e); process.exit(1); });

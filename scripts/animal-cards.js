#!/usr/bin/env node
// animal-cards.js — the animal deck's PRINT FILES: every picked animal on a
// poker card with its name under it (2026-09-22, Sophie, after breaking the
// ties: "add text under"). Reads scripts/decks/animals-drawn.json (what
// animal-deck.js wrote), composes each card with flashcard-compose.py in the
// Sophie Hand font (her handwriting, the fruit deck's face since #2552),
// files the fronts into the Dump as one album with the zip beside them, and
// posts one page in the chat: the save link at the top, the cards two to a
// row, the name under each.
//
//   node scripts/animal-cards.js [--chat animal-deck-heart-tiebreak] [--dry]
//        [--supersede <pageId>] [--font public/fonts/sophie-hand.ttf] [--v 1]
//        [--rec scripts/decks/animals-hearts.json] [--caps --size 52 --track 0.24]
//        [--stock superior]
//
// v2 (2026-09-26, Sophie: "i want to upload animal deck mpc"): --rec picks the
// record file (the hearts-only deck, 63, is what she is uploading), the name
// wears the face the hearts page and the mockups wear (Lemon Hand caps,
// 52px/.24em — the flash-card page's 12px/.22em at print size, the same
// numbers animal-mockup-scenes.js uses), and the zip carries order.xml from
// mpc_order_builder.py beside fronts/ and back.png, the way the fruit zips do
// — so MPC Autofill on her Mac reads it whole, and MPC's own Upload images on
// her phone takes fronts/ in filename order. The back is still the cream
// stand-in until one is designed.
//
// Free — no model call; the composer is a plain resize (a 1024px picture at
// 2in wide is ~500 DPI on the card).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const CHAT = flag('chat', 'animal-deck-heart-tiebreak');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const FONT = flag('font', path.join(__dirname, '..', 'public', 'fonts', 'sophie-hand.ttf'));
const VERSION = flag('v', '1');
const SUPERSEDE = (flag('supersede', '') || '').split(',').filter(Boolean);
const DRY = args.includes('--dry');
const REC = path.join(__dirname, 'decks', 'animals-drawn.json');
const OUT = flag('out', path.join(process.env.CLAUDE_SCRATCH || '/tmp', 'animal-cards'));
const REC_FILE = flag('rec', REC);
const CAPS = args.includes('--caps');
const SIZE = flag('size', CAPS ? '52' : '64');
const TRACK = flag('track', CAPS ? '0.24' : '0.12');
const STOCK = flag('stock', 'superior');

const recs = JSON.parse(fs.readFileSync(REC_FILE, 'utf8')).sort((a, b) => a.name.localeCompare(b.name));
console.log(`${recs.length} cards · ${path.basename(REC_FILE)} · ${path.basename(FONT)}${CAPS ? ' caps' : ''} ${SIZE}px/${TRACK}em · ${STOCK} · v${VERSION}`);
if (DRY) { for (const r of recs) console.log(`  ${r.name} ← ${r.full}`); process.exit(0); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const upload = async (buf, filename, ct, media) => {
  const q = new URLSearchParams({ session: 'animal-cards', bundle: `animal cards v${VERSION}`, filename, from: 'claude', ...(media ? { media } : {}) });
  const r = await fetch(`${BASE}/api/drop/upload-file?${q}`, { method: 'POST', headers: { 'Content-Type': ct }, body: buf });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${filename}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.item;
};

(async () => {
  const full = path.join(OUT, 'full');
  fs.mkdirSync(full, { recursive: true });
  const lines = ['Name | file'];
  for (const r of recs) {
    const fn = `${r.id}.webp`;
    const p = path.join(full, fn);
    if (!fs.existsSync(p)) fs.writeFileSync(p, Buffer.from(await (await fetch(r.full)).arrayBuffer()));
    lines.push(`${r.name} | ${fn}`);
  }
  fs.writeFileSync(path.join(OUT, 'cards.txt'), lines.join('\n'));
  const deck = path.join(OUT, `animals-v${VERSION}`);
  fs.rmSync(deck, { recursive: true, force: true });
  execFileSync('python3', [path.join(__dirname, 'flashcard-compose.py'), path.join(OUT, 'cards.txt'), '--src', full, '--full', full, '--font', FONT, '--out', deck, ...(CAPS ? ['--caps'] : []), '--size', String(SIZE), '--track', String(TRACK)], { stdio: 'inherit' });
  // order.xml beside the fronts, so the zip is the whole MPC Autofill order.
  execFileSync('python3', [path.join(__dirname, 'mpc_order_builder.py'), deck, '--stock', STOCK, '--out', path.join(deck, 'order.xml')], { stdio: 'inherit' });

  // The fronts into the Dump, one album, then the zip beside them.
  const fronts = fs.readdirSync(path.join(deck, 'fronts')).sort();
  const items = [];
  for (const f of fronts) {
    const it = await upload(fs.readFileSync(path.join(deck, 'fronts', f)), f, 'image/png');
    items.push({ file: f, name: f.replace(/^\d+-/, '').replace(/\.png$/, '').replace(/-/g, ' '), url: it.thumb || it.url, full: it.url });
    console.log(`  ${f} → ${it.url}`);
  }
  const zipPath = path.join(OUT, `animal-cards-v${VERSION}.zip`);
  fs.rmSync(zipPath, { force: true });
  execFileSync('zip', ['-q', '-r', zipPath, '.'], { cwd: deck });
  const zip = await upload(fs.readFileSync(zipPath), `animal-cards-v${VERSION}.zip`, 'application/zip', 'file');
  const mb = (fs.statSync(zipPath).size / 1048576).toFixed(0);
  const save = `/api/drop/file/${zip.id}`;
  console.log(`zip → ${save} (${mb}MB)`);

  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(`<div class="imgrow">${items.slice(i, i + 2).map((it) => `<figure data-item="animals-${esc(it.file.replace(/\.png$/, ''))}"><img src="${esc(it.url)}" alt="${esc(it.name)}"><figcaption>${esc(it.name)}</figcaption></figure>`).join('')}</div>`);
  }
  const title = `Animal deck — ${items.length} cards, MPC print files v${VERSION}`;
  const help = `The zip is the whole MakePlayingCards order: fronts/ numbered A to Z, back.png (a plain cream stand-in) and order.xml (${STOCK} stock). On the phone: open the zip in Files, then in MPC's card editor tap Upload images and pick every file in fronts/ — they land on cards 1 to ${items.length} in filename order. On a Mac, MPC Autofill reads the folder whole (autofill --directory). Nothing here touches the cart.`;
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>figcaption{font-size:12px;color:var(--ink2);text-align:center;margin-top:4px}.imgrow figure{margin:0}.save{font-size:14px;margin:4px 0}</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
  <p class="save"><a href="${save}">save the animal deck (zip, ${mb}MB)</a></p>
  ${rows.join('\n')}
</div>
<script src="/compare.js"></script>
<script>(function(){ if (window.__compareHelp) window.__compareHelp({ text: ${JSON.stringify(help)} }); if (window.__compareNotes) window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: 'animal-cards-v${VERSION}' }); })();</script>
`;
  const posted = await (await fetch(`${BASE}/api/chatfeed/page`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, title, html }) })).json();
  console.log('page', JSON.stringify(posted));
  for (const id of SUPERSEDE) console.log('superseded', id, (await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, { method: 'POST' })).status);
  fs.writeFileSync(path.join(__dirname, 'decks', `animals-cards-v${VERSION}.json`), JSON.stringify({ page: posted.id, zip: save, items }, null, 1));
  console.log(`\ncards: ${BASE}/api/chatfeed/page/${posted.id}`);
})().catch((e) => { console.error(e); process.exit(1); });

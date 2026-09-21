// decks-draw-grid.js — a deck IDEA as 3x3 sheets, cut into cards, on one grid
// page to evaluate (2026-09-21, Sophie: "can u do 2 9 panels to evaluate ·
// squares" · "also do the pockets one · u can do 1k since we're just looking
// · and the selling one"). The nine-fruit grid's prompt shape; at the 4K
// square size (2880x2880) a card is ~1000px for ~2¢, at 1K (1024x1024)
// ~340px for ~0.7¢ — enough to look at an idea, not enough for a card.
// fruit-cut.js at the gutters.
//
//   node scripts/decks-draw-grid.js --set breakfasts|pockets|selling|after
//        [--sheets 1,2] [--size 2880x2880] [--dry] [--page-only]
//
// Never run without her go.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SET = flag('set', 'breakfasts');
const SIZE = flag('size', '2880x2880');
const QUALITY = flag('quality', 'medium');
const CHAT = flag('chat', 'fruits-vegetables-inventory');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const BASE = 'https://imageforge-q125.onrender.com';
const DRY = args.includes('--dry');
const PAGE_ONLY = args.includes('--page-only');
const ROOT = path.join(__dirname, '..');
const REC = path.join(ROOT, 'scripts', 'fruit-chart', `${SET}-uploaded.json`);

// Each set: what the nine things are, per sheet — [id, label, what the model
// draws from] — plus the noun the grid sentence uses and the page's title.
const SETS = {};
SETS.breakfasts = { noun: 'breakfast', title: 'Breakfasts of the world', menu: {
  1: [
    ['japan', 'Japan', 'a Japanese breakfast — a bowl of rice, a piece of grilled fish, a bowl of miso soup and a small dish of pickles'],
    ['turkey', 'Turkey', 'a Turkish breakfast spread — white cheese, olives, sliced tomatoes and cucumber, a simit and a glass of tea'],
    ['mexico', 'Mexico', 'a plate of chilaquiles with a fried egg on top'],
    ['england', 'England', 'a full English breakfast — eggs, bacon, sausage, beans, a grilled tomato and toast'],
    ['vietnam', 'Vietnam', 'a bowl of pho with herbs and lime on the side'],
    ['egypt', 'Egypt', 'a bowl of ful medames with flatbread'],
    ['india', 'India', 'idli with sambar and coconut chutney'],
    ['israel', 'Israel', 'a pan of shakshuka'],
    ['colombia', 'Colombia', 'arepas with scrambled eggs and a cup of hot chocolate'],
  ],
  2: [
    ['nigeria', 'Nigeria', 'akara fritters with a bowl of pap'],
    ['sweden', 'Sweden', 'a Swedish breakfast — crispbread with cheese, a boiled egg and a cup of coffee'],
    ['jamaica', 'Jamaica', 'ackee and saltfish with fried dumplings'],
    ['australia', 'Australia', 'avocado toast with a poached egg'],
    ['france', 'France', 'a croissant and a bowl of café au lait'],
    ['usa', 'USA', 'a stack of pancakes with bacon and eggs'],
    ['ethiopia', 'Ethiopia', 'injera with firfir and a cup of coffee'],
    ['korea', 'Korea', 'a Korean breakfast — a bowl of rice, soup and small dishes of banchan'],
    ['morocco', 'Morocco', 'msemen flatbread with honey and a glass of mint tea'],
  ],
} };
// "things in pockets" — what comes out of a pocket, one thing a card
SETS.pockets = { noun: 'small object', title: 'Things in pockets', menu: { 1: [
  ['keys', 'Keys', 'a ring of keys'],
  ['receipt', 'Receipt', 'a crumpled receipt'],
  ['shell', 'Shell', 'a small seashell'],
  ['note', 'Folded note', 'a folded paper note'],
  ['coins', 'Coins', 'a few loose coins'],
  ['lipbalm', 'Lip balm', 'a tube of lip balm'],
  ['hairtie', 'Hair tie', 'a hair tie'],
  ['ticket', 'Ticket stub', 'a torn ticket stub'],
  ['acorn', 'Acorn', 'an acorn'],
] } };
// "what a street sells" — the stands and carts, one a card
SETS.selling = { noun: 'street stall', title: 'What a street sells', menu: { 1: [
  ['fruitstand', 'Fruit stand', 'a fruit stand piled with fruit'],
  ['flowercart', 'Flower cart', 'a flower cart with buckets of flowers'],
  ['newsstand', 'Newsstand', 'a newsstand hung with magazines'],
  ['tacotruck', 'Taco truck', 'a taco truck with its window open'],
  ['pretzel', 'Pretzel cart', 'a pretzel cart'],
  ['icecream', 'Ice cream cart', 'an ice cream cart with a striped umbrella'],
  ['coffee', 'Coffee kiosk', 'a small coffee kiosk'],
  ['fishmonger', 'Fish stall', 'a fish stall with fish on ice'],
  ['balloons', 'Balloon seller', 'a bunch of balloons on strings held by a seller'],
] } };
// "after they've eaten" — the breakfasts of the world, plates done
SETS.after = { noun: 'finished plate', title: 'Breakfasts of the world — after', menu: { 1: [
  ['japan-after', 'Japan', 'the remains of a Japanese breakfast — an empty rice bowl, fish bones on a plate, an empty miso bowl, chopsticks laid down'],
  ['turkey-after', 'Turkey', 'the remains of a Turkish breakfast — crumbs, olive pits, an empty tea glass'],
  ['mexico-after', 'Mexico', 'a plate of chilaquiles scraped clean with a fork left on it'],
  ['england-after', 'England', 'a full English breakfast plate after eating — smears of egg and beans, a crust of toast'],
  ['vietnam-after', 'Vietnam', 'an empty pho bowl with chopsticks across it and a squeezed lime'],
  ['egypt-after', 'Egypt', 'an empty bowl of ful with a torn end of flatbread'],
  ['india-after', 'India', 'an empty idli plate with a smear of chutney'],
  ['israel-after', 'Israel', 'a shakshuka pan with only sauce left and a heel of bread'],
  ['colombia-after', 'Colombia', 'an empty arepa plate and an empty cup of hot chocolate'],
] } };
const DECK = SETS[SET]; if (!DECK) { console.error('unknown --set'); process.exit(1); }
const MENU = DECK.menu;
const SHEETS = (flag('sheets', Object.keys(MENU).join(','))).split(',').map(Number);
const PRE = SET;
const STYLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]';
const sceneOf = rows => `a 3 by 3 grid of nine separate ${DECK.noun} drawings, evenly spaced in three rows of three, each ${DECK.noun} drawn on its own with clear white space around it — none of them touching or overlapping. Top row, left to right: ${rows.slice(0, 3).map(r => r[2]).join('; ')}. Middle row, left to right: ${rows.slice(3, 6).map(r => r[2]).join('; ')}. Bottom row, left to right: ${rows.slice(6, 9).map(r => r[2]).join('; ')}. No text or lettering anywhere.`;
const tier = s => { const w = parseInt(s, 10); return w >= 2800 ? '4K' : w >= 1900 ? '2K' : '1K'; };
const cap = `gpt-image-2 · ${QUALITY} · ${tier(SIZE)}`;

async function draw(full) {
  const form = new FormData();
  form.append('model', 'gpt-image-2'); form.append('prompt', full); form.append('size', SIZE); form.append('quality', QUALITY); form.append('output_format', 'webp');
  form.append('image[]', fs.readFileSync(path.join(ROOT, 'refs', 'sage-sandy-mirror.png')), { filename: 'sage-sandy-mirror.png', contentType: 'image/png' });
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form, timeout: 300000 });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return Buffer.from(data.data[0].b64_json, 'base64');
}
const post = (url, body) => fetch(`${BASE}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

(async () => {
  let recs = fs.existsSync(REC) ? JSON.parse(fs.readFileSync(REC, 'utf8')) : [];
  if (!PAGE_ONLY) {
    for (const n of SHEETS) console.log(`sheet ${n} · ${SIZE} · ${QUALITY}\n${sceneOf(MENU[n])}\n`);
    if (DRY) return;
    const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: `${key.project_id}.firebasestorage.app` });
    const bucket = admin.storage().bucket();
    const put = async (buf, dest) => { const f = bucket.file(dest); await f.save(buf, { metadata: { contentType: 'image/webp' }, resumable: false }); await f.makePublic(); return `https://storage.googleapis.com/${bucket.name}/${dest}`; };
    const file = async (url, description, scene, full) => {
      await post('/api/gallery', { assetsOnly: true, chat: CHAT, session: SESSION, url, description, prompt: cap });
      await post('/api/gallery/assets/prompt', { chat: CHAT, url, style: STYLE, content: scene, full });
    };
    const stamp = (f, scene, full) => execFileSync('node', [path.join(ROOT, 'scripts', 'stamp-prompt.js'), f, '--full', full, '--style', STYLE, '--content', scene, '--model', 'gpt-image-2', '--quality', QUALITY, '--size', tier(SIZE), '--chat', CHAT], { stdio: 'ignore' });
    // both sheets drawn at once
    const drawn = await Promise.all(SHEETS.map(async n => { const scene = sceneOf(MENU[n]); const full = STYLE.replace('[content]', scene); const t0 = Date.now(); const buf = await draw(full); console.log(`sheet ${n} drawn in ${((Date.now() - t0) / 1000) | 0}s`); return { n, scene, full, buf }; }));
    for (const { n, scene, full, buf } of drawn) {
      const dir = `/tmp/${PRE}-${n}`; fs.mkdirSync(dir, { recursive: true });
      const sheetPath = path.join(dir, `sheet-${n}.webp`); fs.writeFileSync(sheetPath, buf); stamp(sheetPath, scene, full);
      const sheetUrl = await put(fs.readFileSync(sheetPath), `${PRE}/sheet/sheet-${n}.webp`);
      await file(sheetUrl, `${DECK.title} — sheet ${n} (uncut)`, scene, full);
      const namesFile = path.join(dir, 'names.json');
      fs.writeFileSync(namesFile, JSON.stringify(MENU[n].map(r => ({ id: r[0], name: r[1] }))));
      execFileSync('node', [path.join(ROOT, 'scripts', 'fruit-cut.js'), sheetPath, namesFile, dir, '--cols', '3', '--rows', '3'], { stdio: 'inherit' });
      for (const [id, country, what] of MENU[n]) {
        const card = path.join(dir, id + '.webp'); stamp(card, scene, full);
        const fullUrl = await put(fs.readFileSync(card), `${PRE}/full/${id}.webp`);
        const small = await sharp(card).resize(640, 640, { fit: 'inside' }).webp({ quality: 82 }).toBuffer();
        const url = await put(small, `${PRE}/card/${id}.webp`);
        await file(fullUrl, `${country} — ${what}`, scene, full);
        recs = recs.filter(r => r.id !== id).concat([{ id, country, what, url, full: fullUrl, sheet: n, sheetUrl, size: tier(SIZE), quality: QUALITY }]);
      }
      fs.writeFileSync(REC, JSON.stringify(recs, null, 1));
    }
  }
  // the grid page — one group per sheet, ♥/✕ a card
  const groups = SHEETS.map(n => ({ label: `Sheet ${n}`, items: recs.filter(r => r.sheet === n).map(r => ({ id: r.id, img: r.url, full: r.full, url: r.full, label: `${r.country} — ${r.what} · ${r.quality} · ${r.size} sheet ÷ 9`, model: 'gpt-image-2', quality: r.quality, size: r.size })) }));
  const OLD = flag('supersede');
  const r = await post('/api/chatfeed/page', { chat: CHAT, title: `${DECK.title} — ${recs.length} to evaluate (${tier(SIZE)})`, template: 'grid',
    data: { groups, help: `3x3 sheets at ${tier(SIZE)}, cut into cards. Heart the ones that work; a note on a card says what is wrong with it.` } });
  console.log(JSON.stringify(r));
  if (OLD && r.ok) console.log('superseded', OLD, (await fetch(`${BASE}/api/chatfeed/page/${OLD}/supersede`, { method: 'POST' })).status);
})().catch(e => { console.error(e); process.exit(1); });

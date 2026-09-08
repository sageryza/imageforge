#!/usr/bin/env node
// hospital-rough-cut.js — the hospital-night ROUGH CUT as a Film Editor cut doc
// (2026-09-08, Sophie: "i kinda wanna stitch the current rough cut … for
// missing chunks just a 1s card saying whats missing").
//
// Film order = the ward script's 55 numbered scenes (docs/mental-hospital —
// the script page's scene table, "The ward — the script v34", plus what landed
// after it). Scenes 1–5 are the pre-ward cut (Film Editor doc
// ClYuZyz0HdflLGzaCJNI): BOTH its lanes are copied in verbatim, keys and
// anchors included, so its render is reproduced byte-for-byte at the head and
// she still has every one of its sounds to move. A scene with no clip yet is a
// 1s STILL — a cream card carrying the scene number and name — drawn here with
// sharp (no model, no money) and filed into the Dump.
//
//   node scripts/hospital-rough-cut.js cards       → draws + uploads the cards, writes cards.json
//   node scripts/hospital-rough-cut.js cut         → writes cut.json (needs cards.json)
//
// Then the film-cut loop: filmcut.js create · set · render · pin.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE = 'https://imageforge-q125.onrender.com';
const ST = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'docs', 'mental-hospital', 'rough-cut');
const PRE_CUT = 'ClYuZyz0HdflLGzaCJNI';
const W = 560, H = 752; // every Seedance ward clip is 560x752 (measured)

// The ward in film order. `clip` = the made clip's url; `card` = not shot yet.
// Names are the script page's own. Inserts and b-roll (8b, 9b) are not chunks
// of the story and get no card; the two b-roll shots that exist are placed
// where their sentence sits in the script.
const WARD = [
  { n: '6',  name: 'Intake A — the doctor\'s questions', clip: ST + 'drops/_/a59ab8130c2303616ed573c598bff00e.mp4' },
  { n: '7',  name: 'Intake B', clip: ST + 'drops/_/404215846ffe69a95a8d748bf0264e2b.mp4' },
  { n: '8·b-roll', name: 'Pudding cups (b-roll B2)', clip: ST + 'drops/_/4800304956a2c4e5ee5b7e76e2ed9a49.mp4' },
  { n: '8',  name: 'The dining room — Michael and Anastasia (braid Sophie, redo candidate)', clip: ST + 'drops/_/0486bbb4b8d57fd7bfe0ab616167b3c1.mp4' },
  { n: '9',  name: 'The hallway walk v2', clip: ST + 'drops/_/55544f47ab3f2f654e3bc32961408db4.mp4' },
  { n: '9·b-roll', name: 'Socks on the linoleum (b-roll B1 v2)', clip: ST + 'drops/_/f899742c87d62493f9bad9f60bc7a677.mp4' },
  { n: '10', name: 'Roommate 1 — Annie flounces v2', clip: ST + 'drops/_/860c4b880c3fd591f8dacc6cbfea6394.mp4' },
  { n: '11', name: 'Roommate 2 — the light and the peels', clip: ST + 'drops/_/91b57d090225ba8e998a8f99e29013ea.mp4' },
  { n: '12', name: 'Roommate 3 — the nurse', clip: ST + 'drops/_/d014933454572e59fea39c67161a8f5e.mp4' },
  { n: '13', name: 'Morning meds — the jolly nurse', clip: ST + 'drops/_/37d01bc7779c7216a3f41015f90d6761.mp4' },
  { n: '13b', name: 'Morning meds — the tail', clip: ST + 'drops/_/f6138a818f436df0ce0cf4591c62f434.mp4' },
  { n: '14', name: 'Art class', clip: ST + 'drops/_/5d39cde4c324500a9da9aefdff9a3459.mp4' },
  { n: '15', name: 'Dinner with Michael — the mashed potatoes, the saved butter' },
  { n: '16', name: 'The snack table' },
  { n: '17', name: 'The poem, and the walk after' },
  { n: '18', name: 'Music class — Yolanda (teacher speaks gibberish, redo candidate)', clip: ST + 'drops/_/2457f4d94f48fb4a69eb140a731026b3.mp4' },
  { n: '19', name: 'Metaphor Machine 1 — building it', clip: ST + 'drops/_/8fc2e0feab1faf7e92a7b8c8df528275.mp4' },
  { n: '20', name: 'Metaphor Machine 2 — the nurses', clip: ST + 'drops/_/dfdfa2a1c16f9a34b05622dd8c6119fa.mp4' },
  { n: '21', name: '"It just made me sluggish" — the pill on the desk, peeling the orange' },
  { n: '22', name: 'The assistant: "we\'re going to release you" — Debra backs out' },
  { n: '23', name: 'The montage · the sculptures gone from the wall — Mary and Juanita' },
  { n: '24', name: 'Yolanda and the young male nurse' },
  { n: '25', name: 'Stealing the scissors A — art class v2', clip: ST + 'drops/_/07362b5a2c692c46e8e4f7621b301657.mp4' },
  { n: '26', name: 'Stealing the scissors B — the hall, the drawer' },
  { n: '27', name: 'The nurse finds the scissors' },
  { n: '28', name: 'Climax 1 — the walk to his office v2', clip: ST + 'drops/_/2240ca2e52da4cb110c705e5269e63b1.mp4' },
  { n: '29', name: 'Climax 2a — the office: "cut my hand off?"', clip: ST + 'drops/_/2cf3ba15623df19cfc1201d03ce8f702.mp4' },
  { n: '30', name: 'Climax 2b — "when can I leave?" · the assistant arrives', clip: ST + 'drops/_/962709d92d6afd741f16020f526eaf32.mp4' },
  { n: '31', name: 'Climax 3 — Tomorrow? → the judge · the grin, the ghost, You can go now' },
  { n: '32', name: 'Climax 4 — the hall float, the mirror' },
  { n: '33', name: 'Climax 5 — the speech at the mirror' },
  { n: '34', name: 'Climax 6 — the hall breakdown' },
  { n: '35', name: 'Climax 7 — the phone · "hi daddy"' },
  { n: '36', name: 'Ms. O\'Hara — the treatment, back to your room (Sophie\'s LumaFusion cut v1 of 36a+36b+37)', clip: ST + 'drops/_/eaee97a08b4281525676ee585e1c0dcb.mp4' },
  { n: '38', name: 'First meal in four days · the shower' },
  { n: '39a', name: 'Parents arrive — part 1: the knock, the stride, the hug', clip: ST + 'drops/_/1bd83e9447d37465d3cacf4873e2c30d.mp4' },
  { n: '39b', name: '"Your parents are here" — part 2: Mommy Daddy, the nurse breaks it up' },
  { n: '40', name: 'Parents at the dining table · Yolanda · "you sounded so upset"' },
  { n: '41', name: 'The office with the parents — "your daughter is very unwell"' },
  { n: '42', name: 'The hallway goodbye — "take any pills they give you"' },
  { n: '43', name: 'The tall nurse · half a pill · the window over New York' },
  { n: '44', name: 'The town hall — Anastasia\'s question, Sophie\'s hand up' },
  { n: '45', name: 'The scale — Mayra weighed, 98 pounds · the headstand' },
  { n: '46', name: '"We\'re going to let you go" — the conditions, Los Angeles' },
  { n: '47', name: 'The pill-cup sculpture · "Sage, that\'s a nice name"' },
  { n: '48', name: 'The end of the hallway — the door patients go through' },
  { n: '49', name: 'The nurses\' meeting about her room' },
  { n: '50', name: 'The marble steps — the run for it' },
  { n: '51', name: 'Grandma\'s apartment — "what a figure"' },
  { n: '52', name: '"Pulling out your hair" — videos in the mirror' },
  { n: '53', name: 'Bed — the boots, the belt · "even so"' },
  { n: '54', name: 'The escape — the suitcase, the bellhop, "the door was locked"' },
  { n: '55', name: 'The taxi to the airport — the banana and the croissant · the gate' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function wrap(text, max) {
  const words = text.split(/\s+/), lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 7);
}
function cardSvg(n, name) {
  const lines = wrap(name, 26);
  const lh = 46, y0 = H / 2 - ((lines.length - 1) * lh) / 2 + 40;
  const body = lines.map((l, i) => `<text x="${W / 2}" y="${y0 + i * lh}" text-anchor="middle" font-family="DejaVu Serif" font-size="30" fill="#2b2622">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="100%" height="100%" fill="#f4efe4"/>
<text x="${W / 2}" y="${y0 - 150}" text-anchor="middle" font-family="DejaVu Sans" font-size="20" letter-spacing="4" fill="#8a7f72">NOT SHOT YET</text>
<text x="${W / 2}" y="${y0 - 80}" text-anchor="middle" font-family="DejaVu Serif" font-weight="bold" font-size="72" fill="#2b2622">${esc(n)}</text>
${body}</svg>`;
}

async function upload(buf, filename) {
  const q = new URLSearchParams({ bundle: 'Hospital night → rough cut cards', filename, session: 'hospital-rough-cut-cards' });
  const r = await fetch(`${BASE}/api/drop/upload-file?${q}`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: buf });
  const j = await r.json();
  if (!j.ok) throw new Error('upload failed ' + JSON.stringify(j).slice(0, 200));
  return j.item;
}

async function cards() {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'cards.json');
  const have = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const s of WARD) {
    if (s.clip || have[s.n]) continue;
    const png = await sharp(Buffer.from(cardSvg(s.n, s.name))).png().toBuffer();
    fs.writeFileSync(path.join(OUT, `card-${s.n}.png`), png);
    if (process.env.DRY) { console.log('drew', s.n); continue; }   // DRY=1: draw only, eye it, upload nothing
    const item = await upload(png, `hospital-card-${s.n}.png`);
    have[s.n] = { id: item.id, url: item.url };
    console.log(s.n, item.url);
    fs.writeFileSync(file, JSON.stringify(have, null, 1));
  }
  console.log('cards', Object.keys(have).length);
}

async function cut() {
  const have = JSON.parse(fs.readFileSync(path.join(OUT, 'cards.json'), 'utf8'));
  const pre = await (await fetch(`${BASE}/api/filmeditor/${PRE_CUT}`)).json();
  const clips = pre.clips.map((c) => ({ ...c }));       // keys c1…c12 kept — anchors point at them
  const sounds = (pre.sounds || []).map((s) => ({ ...s }));
  for (const s of WARD) {
    const key = 's' + s.n.replace(/[^a-z0-9]/gi, '');
    if (s.clip) clips.push({ key, kind: 'video', url: s.clip, title: `${s.n} · ${s.name}`, in: 0 });
    else clips.push({ key, kind: 'image', url: have[s.n].url, title: `${s.n} · not shot yet — ${s.name}`, out: 1 });
  }
  const doc = { clips, sounds };
  fs.writeFileSync(path.join(OUT, 'cut.json'), JSON.stringify(doc, null, 1));
  console.log('pieces', clips.length, 'sounds', sounds.length);
}

const cmd = process.argv[2];
(cmd === 'cards' ? cards() : cmd === 'cut' ? cut() : Promise.reject(new Error('cards | cut')))
  .catch((e) => { console.error(e); process.exit(1); });

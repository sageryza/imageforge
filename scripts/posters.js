#!/usr/bin/env node
// posters.js — elegant minimal posters of her animals and fruits (2026-09-22,
// Sophie: "elegant aesthetic minimal posters for my animals and fruits ·
// possibly all animals and then subcategories like sea animals · the animals
// with their names under, possibly a little description or fact in smaller
// print · a border plain black thin around the whole thing · a thin underline
// for title · try it w handwriting font, as well as the other new font we made
// for the title, letters spaced out like they are on the cards · title spaced
// like the magic flower picture").
//
// One poster per SET (scripts/posters/sets.json — every set a title and the
// animals or fruits on it), each animal a picture with its name under and a
// one-line fact under that (scripts/posters/facts.json), in TWO faces:
//   hand   the title and the names in Sophie Hand (her handwriting), caps,
//          spaced out; the fact in her hand, lowercase
//   magic  the title in Magic Title (the Magic of Flowers face), the names in
//          Magic Subtitle caps, the fact in Magic Subtitle italic
// The title is spaced like MAGIC OF FLOWERS on the box (.34em), with a thin
// rule under it (longer since v2 — her note: "longer top line"); a thin black
// border sits inside the edge of the sheet. "Far Away" (v1) was "not a good
// category" — Jungle replaced it; kangaroo, koala and panda are only on ANIMALS.
//
// The poster is HTML rendered by headless Chromium at 2x (3:4, 2400x3200 px),
// so it is free — no model call — and a change is a re-render.
//
//   node scripts/posters.js [--sets fruits,sea,birds] [--faces hand,magic]
//        [--paper legal] [--dry] [--v 1] [--chat minimal-animal-fruit-posters] [--supersede id]
//
// --dry renders to the scratchpad and stops (the PHOTO). Without it the PNGs go
// into the Dump as one album, each is filed into the chat's Assets tab with its
// label, and one Compare page is posted: every set a .duo, hand beside magic.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const CHAT = flag('chat', 'minimal-animal-fruit-posters');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const VERSION = flag('v', '1');
const SUPERSEDE = (flag('supersede', '') || '').split(',').filter(Boolean);
const ROOT = path.join(__dirname, '..');
const SETS = JSON.parse(fs.readFileSync(path.join(__dirname, 'posters', 'sets.json'), 'utf8'));
const FACTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'posters', 'facts.json'), 'utf8'));
const WANT = (flag('sets', Object.keys(SETS).join(',')) || '').split(',').filter(Boolean);
const FACES = (flag('faces', 'hand,magic') || '').split(',').filter(Boolean);
const OUT = flag('out', path.join(process.env.CLAUDE_SCRATCH || '/tmp', 'posters'));
// --paper legal (v5, 2026-09-23, Sophie: "redo posters for legal"): US legal is
// 8.5 x 14 in, so the sheet is 1275 x 2100 CSS px at 2x = 2550 x 4200, which
// is exactly 300 DPI at print size. The default sheet is 3:4.
const PAPER = flag('paper', '3x4');
const [W, H] = PAPER === 'legal' ? [1275, 2100] : [1200, 1600];
const SCALE = 2;

const SOURCES = {
  animals: () => JSON.parse(fs.readFileSync(path.join(__dirname, 'decks', 'animals-drawn.json'), 'utf8')),
  fruits: () => JSON.parse(fs.readFileSync(path.join(__dirname, 'decks', 'fruits-finished.json'), 'utf8')),
};
// The paper takes the pictures' own off-white — the median of every
// picture, shrunk to 24x24, where most pixels are its background — so a picture's square does not show against
// the sheet (the model's white is not #fff, and 15 slightly grey squares on a
// pure white poster read as tiles).
async function paperOf(items) {
  const sharp = require('sharp');
  const ch = [[], [], []];
  for (const it of items) {
    const { data } = await sharp(it.img.replace(/^file:\/\//, '')).resize(24, 24, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 3) { ch[0].push(data[i]); ch[1].push(data[i + 1]); ch[2].push(data[i + 2]); }
  }
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  return `rgb(${med(ch[0])},${med(ch[1])},${med(ch[2])})`;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fontUrl = (f) => 'file://' + path.join(ROOT, 'public', 'fonts', f);
// Pictures are fetched once into a local cache and the page reads them off
// disk — headless Chromium in a container has no route to Storage, and a
// second render should cost no bandwidth anyway.
const cached = async (url) => {
  const dir = path.join(OUT, 'pics');
  fs.mkdirSync(dir, { recursive: true });
  const fn = path.join(dir, require('crypto').createHash('sha1').update(url).digest('hex').slice(0, 16) + path.extname(new URL(url).pathname));
  if (!fs.existsSync(fn)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    fs.writeFileSync(fn, Buffer.from(await r.arrayBuffer()));
  }
  return 'file://' + fn;
};

// The items on a set: every record of its source, or the picked names in the
// order they were picked; a name with no picture is an error, never a blank.
function itemsOf(set) {
  const all = SOURCES[set.from]();
  const byName = new Map(all.map((r) => [r.name.toLowerCase(), r]));
  const names = set.pick || all.map((r) => r.name).sort((a, b) => a.localeCompare(b));
  return names.map((n) => {
    const r = byName.get(n.toLowerCase());
    if (!r) throw new Error(`${set.title}: no picture for "${n}"`);
    return { name: r.name.toLowerCase(), img: r.full || r.url, fact: FACTS[r.name.toLowerCase()] || '' };
  });
}

// The columns are not picked by count any more — the PAGE measures them
// (v3, 2026-09-22, Sophie: "are u actually looking at the spacing · tons on
// bottom"). v1 and v2 chose a column count from the count of animals and let
// the pictures take whatever width that left, so a poster of six or twelve
// ended with its bottom third empty. Now, for every column count from two
// to eight, the page finds the biggest picture whose rows still fit the
// sheet, keeps the count that gives the biggest picture, and spreads the
// rows evenly down the sheet — so the animals FILL the poster, top to
// bottom, whatever their number.
function posterHtml(set, items, face, paper = '#fff') {
  // The margin inside the border is generous (v4 — Sophie: "still not enough
  // space around sides"): 110px each side, so the animals sit well in from
  // the line rather than against it.
  const inner = W - 2 * 150; // border inset 40 + padding 110
  const fonts = face === 'hand'
    ? `@font-face{font-family:T;src:url(${fontUrl('sophie-hand.ttf')})}
       @font-face{font-family:N;src:url(${fontUrl('sophie-hand.ttf')})}
       @font-face{font-family:F;src:url(${fontUrl('sophie-hand.ttf')})}`
    : `@font-face{font-family:T;src:url(${fontUrl('magic-title.ttf')})}
       @font-face{font-family:N;src:url(${fontUrl('magic-subtitle.ttf')})}
       @font-face{font-family:F;src:url(${fontUrl('magic-subtitle-italic.ttf')})}`;
  const titleSize = face === 'hand' ? 58 : 54;
  const rows = items.map((it) => `<div class="it">
      <img src="${esc(it.img)}">
      <div class="nm">${esc(it.name.toUpperCase())}</div>
      ${it.fact ? `<div class="ft">${esc(it.fact)}</div>` : ''}
    </div>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
  ${fonts}
  :root{--cell:300px;--pic:216px;--nm:30px;--ft:22px;--gap:40px}
  html,body{margin:0;background:${paper}}
  body{width:${W}px;height:${H}px;position:relative;color:#111;font-family:N,serif;-webkit-font-smoothing:antialiased}
  .bd{position:absolute;inset:40px;border:2px solid #111;box-sizing:border-box}
  .in{position:absolute;inset:40px;padding:60px 110px 70px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center}
  h1{margin:0;flex-shrink:0;font-family:T,serif;font-weight:400;font-size:${titleSize}px;letter-spacing:.34em;text-indent:.34em;text-align:center;line-height:1.1}
  .rule{flex-shrink:0;width:${Math.round(inner * 0.38)}px;height:1.5px;background:#111;margin:22px 0 30px}
  .grid{display:flex;flex-wrap:wrap;justify-content:center;align-content:space-evenly;width:${inner}px;flex:1;min-height:0;overflow:hidden}
  .it{display:flex;flex-direction:column;align-items:center;text-align:center;width:var(--cell);padding:calc(var(--gap) / 2) 0;box-sizing:border-box}
  .it img{object-fit:contain;display:block;width:var(--pic);height:var(--pic)}
  .nm{font-family:N,serif;font-size:var(--nm);letter-spacing:.18em;text-indent:.18em;margin-top:.35em;line-height:1.2;white-space:nowrap}
  .ft{font-family:F,serif;font-size:var(--ft);letter-spacing:${face === 'hand' ? '.02em' : '.06em'};color:#333;margin-top:.3em;line-height:1.3;padding:0 6px}
  </style><div class="bd"></div><div class="in"><h1>${esc(set.title.toUpperCase())}</h1><div class="rule"></div><div class="grid">${rows}</div></div>`;
}

// Runs IN the page: tries every column count, keeps the one whose biggest
// fitting picture is biggest, then fits any name still wider than its cell.
// Returns what it chose so the log can say it.
const FIT = `(() => {
  const g = document.querySelector('.grid'), R = document.documentElement.style, inner = g.clientWidth;
  const its = [...document.querySelectorAll('.it')], nms = [...document.querySelectorAll('.nm')];
  const fits = () => g.scrollHeight <= g.clientHeight + 1;
  const apply = (cols, pic) => {
    const cell = Math.floor(inner / cols);
    const nm = Math.max(12, Math.min(30, Math.round(cell * 0.1)));
    R.setProperty('--cell', cell + 'px'); R.setProperty('--pic', pic + 'px');
    R.setProperty('--nm', nm + 'px'); R.setProperty('--ft', Math.max(9, Math.round(nm * 0.72)) + 'px');
    R.setProperty('--gap', Math.round(cell * 0.14) + 'px');
    for (const n of nms) n.style.fontSize = '';
  };
  let best = null;
  for (let cols = 2; cols <= 8; cols++) {
    if (cols > its.length) break;
    const cell = Math.floor(inner / cols);
    let lo = 40, hi = Math.round(cell * 0.8);
    apply(cols, lo); if (!fits()) continue;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; apply(cols, mid); if (fits()) lo = mid; else hi = mid; }
    if (!best || lo > best.pic) best = { cols, pic: lo };
  }
  if (!best) best = { cols: 8, pic: 40 };
  apply(best.cols, best.pic);
  for (const nm of nms) {
    let s = parseFloat(getComputedStyle(nm).fontSize);
    while (nm.scrollWidth > nm.parentElement.clientWidth - 32 && s > 8) { s -= 0.5; nm.style.fontSize = s + 'px'; }
  }
  return { ...best, overflow: !fits() };
})()`;

const upload = async (buf, filename, ct) => {
  const q = new URLSearchParams({ session: 'posters', bundle: `posters v${VERSION}`, filename });
  const r = await fetch(`${BASE}/api/drop/upload-file?${q}`, { method: 'POST', headers: { 'Content-Type': ct }, body: buf });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${filename}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.item;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const made = [];
  for (const key of WANT) {
    const set = SETS[key];
    if (!set) throw new Error(`no set "${key}"`);
    const items = itemsOf(set);
    for (const it of items) it.img = await cached(it.img);
    const paper = await paperOf(items);
    for (const face of FACES) {
      const html = posterHtml(set, items, face, paper);
      const hp = path.join(OUT, `${key}-${face}.html`);
      fs.writeFileSync(hp, html);
      await page.goto('file://' + hp, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const fit = await page.evaluate(FIT);
      const { overflow } = fit;
      const png = path.join(OUT, `${key}-${face}.png`);
      await page.screenshot({ path: png, fullPage: false });
      made.push({ key, face, set, count: items.length, png, overflow, cols: fit.cols, pic: fit.pic });
      console.log(`${key} · ${face} · ${items.length} · ${fit.cols} across · pictures ${fit.pic}px${overflow ? ' · OVERFLOWS' : ''} → ${png}`);
    }
  }
  await browser.close();
  if (DRY) return;

  const FACE_LABEL = { hand: 'handwriting', magic: 'magic title' };
  const items = [];
  for (const m of made) {
    const fn = `poster-${m.key}-${m.face}${PAPER === 'legal' ? '-legal' : ''}-v${VERSION}.png`;
    const it = await upload(fs.readFileSync(m.png), fn, 'image/png');
    const description = `${m.set.title} poster — ${FACE_LABEL[m.face]}${PAPER === 'legal' ? ' · legal' : ''} · v${VERSION}`;
    await fetch(`${BASE}/api/gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: it.url, description, prompt: `html render · no model · ${W * SCALE}x${H * SCALE}${PAPER === 'legal' ? ' · legal 8.5x14 at 300 DPI' : ''}` }) });
    items.push({ ...m, url: it.url, thumb: it.thumb || it.url, description });
    console.log(`  ${fn} → ${it.url}`);
  }
  const sets = [...new Set(items.map((i) => i.key))];
  const blocks = sets.map((key) => {
    const two = items.filter((i) => i.key === key);
    return `<div class="card"><h2>${esc(two[0].set.title)}</h2><div class="duo">${two.map((i) => `<figure data-item="${esc(`${key}-${i.face}-v${VERSION}`)}"><span class="tag">${esc(FACE_LABEL[i.face])}</span><img src="${esc(i.url)}" alt="${esc(i.description)}" loading="lazy"></figure>`).join('')}</div></div>`;
  });
  const title = `Posters v${VERSION} — ${sets.length} sets${PAPER === 'legal' ? ', legal size 8.5x14' : ''}, handwriting beside magic title`;
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <h1>${esc(title)}</h1>
  ${blocks.join('\n')}
</div>
<script src="/compare.js"></script>
<script>(function(){ if (window.__compareNotes) window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: 'posters-v${VERSION}' }); })();</script>
`;
  const posted = await (await fetch(`${BASE}/api/chatfeed/page`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, title, html }) })).json();
  console.log('page', JSON.stringify(posted));
  for (const id of SUPERSEDE) console.log('superseded', id, (await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, { method: 'POST' })).status);
  fs.writeFileSync(path.join(__dirname, 'posters', `posted-v${VERSION}.json`), JSON.stringify({ page: posted.id, items: items.map(({ key, face, url, description, count }) => ({ key, face, url, description, count })) }, null, 1));
  console.log(`\nposters: ${BASE}/api/chatfeed/page/${posted.id}`);
})().catch((e) => { console.error(e); process.exit(1); });

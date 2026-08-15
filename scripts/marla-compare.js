#!/usr/bin/env node
/**
 * marla-compare.js — the two Compare pages Sophie asked for (Aug 2026):
 *   1. the ten Marla character sheets with HER OWN notes under each, so the
 *      pick and the reasoning are on one screen;
 *   2. every version of the fishbowl page and every version of the page where
 *      she sits watching Tommy, side by side.
 *
 * WHY IT MAKES DISPLAY COPIES FIRST. The sheets are ~2.4MB gpt-image-2 PNGs
 * and the finished pages are ~500KB webp; a page pointing straight at them is
 * several megabytes on her phone. Every image here is re-encoded to a 760px
 * webp under storybook/marla/compare/ and uploaded immutable-cached — the
 * house rule from webp-assets.js, applied to a one-off page.
 *
 * The originals are never touched: the lightbox is a display copy too, which
 * is the right trade for a review page (she is judging the drawing, not
 * pixel-peeping), and the full-size art stays in Assets.
 *
 * USAGE
 *   node scripts/marla-compare.js            # build copies + post both pages
 *   node scripts/marla-compare.js --dry-run  # print what it would post
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CHAT = 'marlas-eyes-fishbowl-storybook';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const DRY = process.argv.includes('--dry-run');
const WIDE = 760;

const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));
const chars = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/storybooks/char-state.json'), 'utf8'));

const P = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/storybook/marla/pages/';

// Her notes, verbatim off the Assets tab. A paraphrase here would defeat the
// point of the page — she asked to see what she actually said.
const SHEETS = [
  { n: 1,  key: 'marlaSheetV2',      vote: null,     note: "I think I want the dress to be more complicated with like maybe some sort of frills or lace in the top forest area and then like Please and the skirt I don't know and maybe like slight ruffles on the sleeves I don't know" },
  { n: 2,  key: 'marlaSheet_v3b',    vote: 'dislike', note: 'she looks pretty but too mean' },
  { n: 3,  key: 'marlaSheet_v3c',    vote: null,     note: 'she looks kind of sad and EP' },
  { n: 4,  key: 'marlaSheet_v3d',    vote: null,     note: 'boring Idk' },
  { n: 5,  key: 'marlaSheet_v3e',    vote: 'like',   note: 'OK, use this one' },
  { n: 6,  key: 'marlaSheet_v3f',    vote: null,     note: null },
  { n: 7,  key: 'marlaSheet_v3g',    vote: 'dislike', note: null },
  { n: 8,  key: 'marlaSheet_v3h',    vote: null,     note: null },
  { n: 9,  key: 'marlaSheet_v3i',    vote: null,     note: null },
  { n: 10, key: 'marlaSheet_v3j',    vote: null,     note: null },
];

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}

// A 760px webp beside the original, immutable-cached. Named off the SOURCE
// filename so re-running is idempotent and a changed picture (always a new id
// in this pipeline) never collides with an old copy.
const made = new Map();
async function display(srcUrl) {
  if (made.has(srcUrl)) return made.get(srcUrl);
  const name = srcUrl.split('/').pop().replace(/\.(png|webp|jpe?g)$/i, '') + `-${WIDE}.webp`;
  const dest = `storybook/marla/compare/${name}`;
  const bucket = admin.storage().bucket();
  const file = bucket.file(dest);
  const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
  const [exists] = await file.exists();
  if (!exists) {
    const buf = Buffer.from(await (await fetch(srcUrl)).arrayBuffer());
    const out = await sharp(buf).resize({ width: WIDE, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const tmp = path.join(os.tmpdir(), name);
    fs.writeFileSync(tmp, out);
    await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
    await file.makePublic();
    fs.unlink(tmp, () => {});
    process.stdout.write(`  ${name} ${Math.round(out.length / 1024)}KB\n`);
  }
  made.set(srcUrl, url);
  return url;
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function shell(title, body, sheet) {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .vote { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
  .vote.y { color: #b3443f; }
  .vote.n { color: var(--ink2); }
  .said { font-style: italic; color: var(--ink2); margin: 6px 0 0; font-size: 15px; line-height: 1.45; }
  .card h3 .num { color: var(--ink2); font-weight: 400; }
</style>

<div class="wrap">
  <h1>${esc(title)}</h1>
${body}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(sheet)} });
})();
</script>`;
}

async function pageSheets() {
  const blocks = [];
  for (const s of SHEETS) {
    const rec = state[s.key];
    if (!rec?.url) { console.log(`  (no ${s.key})`); continue; }
    const img = await display(rec.url);
    const vote = s.vote === 'like' ? '<span class="vote y">you picked this</span>'
      : s.vote === 'dislike' ? '<span class="vote n">you crossed this out</span>' : '';
    blocks.push(`  <div class="card" data-item="sheet-${s.n}">
    <h3>Option ${s.n} ${vote}</h3>
    <div class="imgrow"><img src="${img}" alt="Marla option ${s.n}"></div>
${s.note ? `    <p class="said">“${esc(s.note)}”</p>\n` : ''}  </div>`);
  }
  // The coat sheets are new Marlas she has not judged yet; they belong on the
  // same page because the question ("which Marla") is the same question.
  const coats = [];
  for (const t of ['a', 'b']) if (chars['marla-coat']?.[t]) coats.push(await display(chars['marla-coat'][t].url));
  if (coats.length) {
    blocks.push(`  <div class="card" data-item="coat">
    <h3>In her coat — new, not yet judged</h3>
    <div class="duo">
      ${coats.map((u, i) => `<figure><span class="tag">option ${i + 1}</span><img src="${u}" alt="Marla in her coat option ${i + 1}"></figure>`).join('\n      ')}
    </div>
  </div>`);
  }
  return shell('Marla — the ten sheets and what you said about each', blocks.join('\n'), 'marla-sheets-10');
}

async function pageVersions() {
  const fish = [
    ['first version', P + 'p01.webp'],
    ['v2', P + 'p01-v2.webp'],
    ['v3e — your sheet', P + 'p01-v3e.webp'],
  ];
  const tommy = [
    ['first version', P + 'p28.webp'],
    ['v3e — your sheet', P + 'p28-v3e.webp'],
  ];
  const f = [];
  for (const [tag, u] of fish) f.push([tag, await display(u)]);
  const t = [];
  for (const [tag, u] of tommy) t.push([tag, await display(u)]);

  const body = `  <div class="card" data-item="fishbowl">
    <h3>Page 1 — the fishbowl</h3>
    <div class="duo" style="grid-template-columns:1fr 1fr 1fr">
      ${f.map(([tag, u]) => `<figure><span class="tag">${esc(tag)}</span><img src="${u}" alt="page 1 ${esc(tag)}"></figure>`).join('\n      ')}
    </div>
  </div>
  <div class="card" data-item="tommy">
    <h3>Page 28 — sitting, watching Tommy</h3>
    <div class="duo">
      ${t.map(([tag, u]) => `<figure><span class="tag">${esc(tag)}</span><img src="${u}" alt="page 28 ${esc(tag)}"></figure>`).join('\n      ')}
    </div>
  </div>`;
  return shell('Marla — every fishbowl and every Tommy, side by side', body, 'marla-versions-p1-p28');
}

async function post(title, html) {
  if (DRY) { console.log(`\n--dry-run: would post "${title}" (${Math.round(html.length / 1024)}KB)`); return; }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  const j = await r.json();
  console.log(`\n${title}\n  ${j.ok ? j.url : 'FAILED ' + JSON.stringify(j)}`);
  if (j.warnings?.length) console.log('  WARNINGS:', j.warnings.join(' · '));
}

// The four runs of the ORIGINAL page 1 prompt, differing only in which card
// the model was handed. They sit two to a row rather than four across: at
// 390px four columns is 84px a picture, which is too small to judge a face on.
async function pageFishbowlTest(second) {
  const t = state.fishbowlTest || {};
  const order = (second ? [
    ['e', 'sheet 1'],
    ['f', 'sheet 1 again'],
    ['g', 'sheet 5 — yours'],
  ] : [
    ['a', 'no card'],
    ['b', 'sheet 1'],
    ['c', 'sheet 1 again'],
    ['d', 'sheet 5 — yours'],
  ]).filter(([k]) => t[k]?.pageUrl);
  const cells = [];
  for (const [k, tag] of order) cells.push([tag, await display(t[k].pageUrl)]);
  const body = `  <div class="card" data-item="fishbowl-test">
    <h3>Same prompt, different Marla</h3>
    <div class="duo">
      ${cells.map(([tag, u]) => `<figure><span class="tag">${esc(tag)}</span><img src="${u}" alt="page 1 ${esc(tag)}"></figure>`).join('\n      ')}
    </div>
  </div>`;
  return second
    ? shell('Page 1 — the fishbowl rewrite with each character sheet', body, 'marla-p1-fishbowl-3')
    : shell('Page 1 — the original prompt with each character sheet', body, 'marla-p1-cards-4');
}

(async () => {
  initAdmin();
  console.log('display copies:');
  if (process.argv.includes('--fishbowl-second')) {
    await post('Page 1 — the fishbowl rewrite with each character sheet', await pageFishbowlTest(true));
    process.exit(0);
  }
  if (process.argv.includes('--fishbowl-test')) {
    await post('Page 1 — the original prompt with each character sheet', await pageFishbowlTest(false));
    process.exit(0);
  }
  const a = await pageSheets();
  const b = await pageVersions();
  await post('Marla — the ten sheets and what you said about each', a);
  await post('Marla — every fishbowl and every Tommy, side by side', b);
  process.exit(0);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });

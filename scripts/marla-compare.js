#!/usr/bin/env node
/**
 * marla-compare.js — the versions Compare page for "Eyes as Wide as a Fishbowl".
 *
 * Sophie asked for one page that DIFFS the versions of each redrawn page and,
 * under each one, "just what you said about the expression for that prompt".
 * So every cell carries the expression text VERBATIM out of the prompt that
 * really drew it (state.json keeps `prompt` + `scene` per version) — never a
 * paraphrase, same rule as the PROMPT overlay.
 *
 * Two kinds of expression text, and they are separated on purpose:
 *   - the STANDING line, the same on every page in a round (it changed once,
 *     after her page-12 note) — shown ONCE at the top, with a chip per cell
 *     saying which of the two that prompt carried;
 *   - the SCENE's own expression sentence, which differs page to page — shown
 *     under its picture.
 *
 * TWO webp display copies per picture, never the raw ~3MB PNGs: 420px in the
 * grid (~35KB) and 1100px behind `data-full` for the lightbox, so a page of
 * forty-odd versions still opens on a phone.
 *
 * ORDER comes from the ASSETS TAB's `created`, not from state.json's `at` —
 * seven entries were rebuilt from the tab after a write race and carry at:0,
 * and sorting on that would put them first. Their real filing time is on the
 * server, so ask the server.
 *
 *   node scripts/marla-compare.js [--dry-run] [--no-post]
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
const NO_POST = process.argv.includes('--no-post');

const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));

// ── the two standing expression lines, verbatim out of the prompts ─────────
const RULE_OLD = 'She does not smile; her face is still and unreadable unless this page says otherwise.';
const RULE_NEW = 'Use the reference sheet for her FACE and CLOTHES only. Do NOT copy the expression from the reference sheet: give her an expression that fits what is happening on THIS page, and a posture that fits what she is doing. She is not a smiler, but she is not blank either.';

function standingRule(prompt) {
  const p = String(prompt || '');
  if (p.includes(RULE_NEW)) return 'new';
  if (p.includes(RULE_OLD)) return 'old';
  return null;                       // no character card on this one
}

// The scene's OWN words about her face. Verbatim sentences picked by cue — a
// sentence is either about how she looks or it is not, and quoting half of one
// would be paraphrasing.
const CUE = /\b(expression|face|eyes?|mouth|eyebrows?|brow|smil\w*|frown\w*|glare|scowl|stare|staring|gaze|blank|unreadable|crying|tears?|laugh\w*|delight\w*|exasperat\w*|weeping)\b/i;
const sentences = (t) => String(t || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const sceneExpression = (scene) => sentences(scene).filter((x) => CUE.test(x)).join(' ');

// ── gather the version families ───────────────────────────────────────────
// A family is one BOOK PAGE and every picture ever drawn for it. `extra` keys
// carry their page number in front (3a -> 3).
const NUMBERED = ['s1', 'v2', 'v3', 'v3e', 's2', 's2diag', 's4', 's5'];
// The description test, run twice: page 8 (she is turned away, so it shows
// what the description does to the DRAWING) and page 13 (face-on and in
// outdoor coats, so it shows what it does to her LIKENESS and her clothes).
const TESTS = [
  { page: 8, note: 'Page 8 — she is turned away, so this is about the drawing, not her likeness.', keys: ['8t-full', '8t-expression', '8t-none'] },
  { page: 13, note: 'Page 13 — face-on and in coats, so this is where her frock and her face are actually on the line.', keys: ['13t-full', '13t-physical', '13t-expression', '13t-none'] },
];
const TEST_KEYS = TESTS.flatMap((t) => t.keys);

async function assetTimes() {
  const r = await fetch(`${BASE}/api/gallery/assets?chat=${encodeURIComponent(CHAT)}&limit=400`);
  const j = await r.json();
  const t = new Map();
  for (const a of j.assets || []) if (a.created) t.set(a.url, Date.parse(a.created));
  return t;
}

function families(times) {
  const fam = {};
  const add = (n, rec) => { (fam[n] = fam[n] || []).push(rec); };
  const when = (filed, at) => times.get(filed) || at || 0;
  for (const b of NUMBERED) {
    for (const [k, v] of Object.entries(state[b] || {})) {
      const url = v.artUrl || v.url;
      if (!url) continue;
      add(String(Number(k)), { key: `${b}-${k}`, url, prompt: v.prompt, scene: v.scene, at: when(v.pageUrl, v.at) });
    }
  }
  for (const [k, v] of Object.entries(state.extra || {})) {
    if (TEST_KEYS.includes(k)) continue;          // the test is its own card
    const m = String(k).match(/^(\d+)/);
    if (!m || !v.url) continue;
    add(m[1], { key: k, url: v.url, prompt: v.prompt, scene: v.scene, at: when(v.url, v.at), variant: k });
  }
  for (const n of Object.keys(fam)) {
    fam[n].sort((a, b) => a.at - b.at);
    if (fam[n].length < 2) delete fam[n];         // one picture is not a diff
  }
  return fam;
}

// ── display copies ────────────────────────────────────────────────────────
function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}

async function copyAt(src, name, width, q) {
  const bucket = admin.storage().bucket();
  const dest = `storybook/marla/cmp/${name}-${width}.webp`;
  const file = bucket.file(dest);
  const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
  const [exists] = await file.exists();
  if (exists) {
    const [meta] = await file.getMetadata();
    if (meta.metadata && meta.metadata.w) return { url, w: +meta.metadata.w, h: +meta.metadata.h };
  }
  const buf = await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
  const { width: w, height: h } = await sharp(buf).metadata();
  const tmp = path.join(os.tmpdir(), `${name}-${width}.webp`);
  fs.writeFileSync(tmp, buf);
  await bucket.upload(tmp, {
    destination: dest,
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { w: String(w), h: String(h) },
    },
  });
  await file.makePublic();
  fs.unlink(tmp, () => {});
  return { url, w, h };
}

const cache = new Map();
async function display(srcUrl, name) {
  if (cache.has(name)) return cache.get(name);
  const src = Buffer.from(await (await fetch(srcUrl)).arrayBuffer());
  const small = await copyAt(src, name, 420, 80);
  const full = await copyAt(src, name, 1100, 82);
  const out = { small, full };
  cache.set(name, out);
  return out;
}

// ── the page ──────────────────────────────────────────────────────────────
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DAY = (ms) => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : '');
const safe = (s) => String(s).replace(/[^a-z0-9-]/gi, '-');

function figure(tag, img, chip, expr) {
  return `<figure><span class="tag">${esc(tag)}</span>`
    + `<img src="${img.small.url}" data-full="${img.full.url}" width="${img.small.w}" height="${img.small.h}" alt="${esc(tag)}" loading="lazy">`
    + (chip ? `<div class="chips"><span class="chip ${chip === 'new' ? 'good' : 'warn'}">${chip === 'new' ? 'new standing line' : 'old standing line'}</span></div>` : '')
    + (expr ? `<figcaption>${esc(expr)}</figcaption>` : '')
    + '</figure>';
}

(async () => {
  const times = DRY ? new Map() : await assetTimes();
  const fam = families(times);
  const pages = Object.keys(fam).map(Number).sort((a, b) => a - b);
  const shots = pages.reduce((n, p) => n + fam[p].length, 0);
  console.log(`${pages.length} pages with more than one version · ${shots} pictures`);
  if (DRY) { for (const p of pages) console.log(` p${p}: ${fam[p].map((v) => v.key).join(', ')}`); return; }

  initAdmin();

  const testShots = new Map();
  for (const k of TEST_KEYS) {
    const v = state.extra[k];
    if (!v) continue;
    testShots.set(k, await display(v.url, k));
    process.stdout.write('.');
  }

  const blocks = [];
  for (const p of pages) {
    const cells = [];
    for (const v of fam[p]) {
      const img = await display(v.url, safe(`p${p}-${v.key}`));
      const tag = (v.variant ? `${v.variant} · ` : '') + DAY(v.at);
      cells.push(figure(tag, img, standingRule(v.prompt), sceneExpression(v.scene)));
      process.stdout.write('.');
    }
    blocks.push(`<div class="card" data-item="p${p}">
    <h3>Page ${p}</h3>
    <div class="duo">${cells.join('')}</div>
  </div>`);
  }
  console.log('');

  const TEST_TAG = (k) => (k.endsWith('-full') ? 'described in full'
    : k.endsWith('-physical') ? 'described, expression line removed'
    : k.endsWith('-expression') ? 'point at the sheet only'
    : 'nothing said about her');
  const testCards = TESTS.map((t) => `<div class="card" data-item="describe-p${t.page}">
    <h3>Does describing her help? — page ${t.page}</h3>
    <div class="duo">${t.keys.filter((k) => testShots.has(k)).map((k) => {
      const img = testShots.get(k);
      return '<figure>'
        + `<span class="tag">${esc(TEST_TAG(k))}</span>`
        + `<img src="${img.small.url}" data-full="${img.full.url}" width="${img.small.w}" height="${img.small.h}" alt="${esc(TEST_TAG(k))}" loading="lazy">`
        + '</figure>';
    }).join('')}</div>
    <p class="mini">${esc(t.note)}</p>
  </div>`).join('\n  ');

  const sheet = `versions-p${pages.length}`;
  const title = 'Marla v3 — the versions, and what each prompt said about her face';
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>${esc(title)}</h1>

  ${testCards}

  <!-- The two standing lines sit BELOW the first card, not under the title:
       nothing to read between the title and the first picture (Aug 2026).
       They stay ON the page rather than behind the "?" because every chip
       below names one of them — hidden, the chips would mean nothing. -->
  <div class="big"><b>the standing line, before</b>${esc(RULE_OLD)}</div>
  <div class="big"><b>and after your note</b>${esc(RULE_NEW)}</div>

  ${blocks.join('\n  ')}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(sheet)} });
  window.__compareHelp({ html: '<b>The chip under a picture</b> says which of the two standing lines above that prompt carried. '
    + 'The words below it are that page\\'s own sentence about her face, exactly as it was sent — a picture with no words '
    + 'under it had nothing page-specific said about her face. Oldest version on the left.' });
})();
</script>`;

  const out = path.join(ROOT, 'docs/marla/compare-versions.html');
  fs.writeFileSync(out, html);
  console.log(`${(html.length / 1024).toFixed(0)}KB → ${out}`);
  if (NO_POST) return;

  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });

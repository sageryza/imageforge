#!/usr/bin/env node
/**
 * marla-expression-page.js — the four description arms, side by side.
 *
 * Sophie: "I don't quite understand the verdict on that one change… you could
 * make a compare page with the different variations. Keep the writing very
 * minimal, just points of what changed, and any extra text should go behind
 * a ? button."
 *
 * So each picture carries ONE line naming what its prompt had, nothing else,
 * and the reasoning lives in the "?" card. Two per row (.duo, labels on top).
 *
 *   node scripts/marla-expression-page.js [--no-post]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CHAT = 'marlas-eyes-fishbowl-storybook';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const NO_POST = process.argv.includes('--no-post');
const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));

// The four arms, in the order they take words AWAY. The line under each is
// what that prompt carried — not an opinion about the result.
const ARMS = [
  { suffix: 'full', tag: 'everything', note: 'age, hair, eyes, the frock, socks, shoes — plus the do-not-copy-the-sheet’s-expression line' },
  { suffix: 'physical', tag: 'minus the expression line', note: 'the same words, with only the sentence about her face taken out' },
  { suffix: 'expression', tag: 'the sheet line only', note: 'no description at all — just “use the sheet for her face and clothes, don’t copy its expression”' },
  { suffix: 'none', tag: 'nothing', note: 'not a word about her; the character sheet on its own' },
];
const PAGES = [
  { n: 13, keys: '13t', note: 'face-on, in coats' },
  { n: 8, keys: '8t', note: 'turned away' },
];

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
  await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable', metadata: { w: String(w), h: String(h) } } });
  await file.makePublic();
  fs.unlink(tmp, () => {});
  return { url, w, h };
}
async function display(srcUrl, name) {
  const src = Buffer.from(await (await fetch(srcUrl)).arrayBuffer());
  return { small: await copyAt(src, name, 420, 80), full: await copyAt(src, name, 1100, 82) };
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

(async () => {
  initAdmin();
  const cards = [];
  for (const p of PAGES) {
    const figs = [];
    for (const a of ARMS) {
      const rec = state.extra[`${p.keys}-${a.suffix}`];
      if (!rec) continue;
      const img = await display(rec.url, `${p.keys}-${a.suffix}`);
      figs.push('<figure>'
        + `<span class="tag">${esc(a.tag)}</span>`
        + `<img src="${img.small.url}" data-full="${img.full.url}" width="${img.small.w}" height="${img.small.h}" alt="${esc(a.tag)}" loading="lazy">`
        + `<figcaption>${esc(a.note)}</figcaption></figure>`);
      process.stdout.write('.');
    }
    cards.push(`<div class="card" data-item="p${p.n}">
    <h3>Page ${p.n} — ${esc(p.note)}</h3>
    <div class="duo">${figs.join('')}</div>
  </div>`);
  }
  console.log('');

  const title = 'Marla — four ways of describing her, same page';
  const sheet = 'describe-arms4';
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>${esc(title)}</h1>
  ${cards.join('\n  ')}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(sheet)} });
  window.__compareHelp({ html: '<b>Same scene, same character sheet, same everything.</b> The only difference is how much '
    + 'of Marla the prompt says out loud. Page 13 is the one that decides it — she is face-on and in a coat there, '
    + 'so both her face and her frock are on the line; on page 8 she is turned away.<br><br>'
    + '<b>What the four came out as.</b> With <i>nothing</i> said, her white-and-blue frock is replaced by a plain coat '
    + 'and dress. With the <i>sheet line only</i>, the frock survives. Taking out just the <i>expression line</i> keeps '
    + 'the frock AND draws as loosely as the bare run — so the tight, heavy look was coming from that one sentence, '
    + 'not from describing her.<br><br>'
    + '<b>The catch.</b> Page 13\\'s scene already says what her face should do, so removing the standing sentence cost '
    + 'nothing there. On a page whose scene says nothing about her face, that sentence is the only thing stopping her '
    + 'copying the blank look off the sheet — which was the page 12 problem.' });
})();
</script>`;

  fs.writeFileSync(path.join(ROOT, 'docs/marla/compare-expression.html'), html);
  console.log(`${(html.length / 1024).toFixed(0)}KB`);
  if (NO_POST) return;
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });

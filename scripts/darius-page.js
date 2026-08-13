#!/usr/bin/env node
/**
 * Post a Darius film's Compare page: the film at the top as a line with a play
 * button, then its shots in order with a note box on each.
 *
 *   node scripts/darius-page.js <heart|proof> [--dry-run]
 *
 * The page follows the house rules the shell carries: the title and nothing
 * above it (no eyebrow, no tagline), /compare.css and /compare.js linked so the
 * autoscroll pill styles itself and the tap contract works, the script in an
 * IIFE, images in rows of two, and NEVER an embedded <video> — a film is one
 * line with a play button, or it is a black slab she scrolls past every visit.
 *
 * The note sheet is named for the item set it answers (`<set>-film-v1-sNN`), so
 * a rebuilt page that renumbers its shots cannot silently re-point notes she
 * has already written at different content.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'darius-interview-videos';
const SESSION = '01UYkBwduk918fNXj7uDjBLh';
const SET = process.argv.find((a) => a === 'heart' || a === 'proof') || 'heart';
const DRY = process.argv.includes('--dry-run');

const TITLES = {
  heart: 'The heart — how an out-of-body experience works (v1)',
  proof: 'The proof — what Darius says can be checked (v1)',
};

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, '.darius-film');
const store = `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/darius-${SET}/`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

const film = JSON.parse(fs.readFileSync(path.join(DIR, SET + '-film.json'), 'utf8'));
const labels = require(`./nde-watercolor/darius-${SET}-labels.json`);

let t = 0;
const cards = film.shots.map((sh) => {
  const at = mmss(t); t += sh.seconds;
  const imgs = sh.pictures.map((p) => {
    const id = p.file.replace(/-m\.webp$/, '');
    return `      <img src="${store}${id}-m.webp" alt="${esc(labels[id] || id)}">`;
  }).join('\n');
  return `  <div class="card" data-item="${sh.shot}">\n`
    + `    <h2>${at} · ${esc(sh.name)}</h2>\n`
    + `    <div class="imgrow">\n${imgs}\n    </div>\n  </div>`;
}).join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLES[SET])}</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>${esc(TITLES[SET])}</h1>

  <div id="film"></div>

${cards}
</div>

<script src="/compare.js"><\/script>
<script>
(function () {
  window.__filmRow({ url: ${JSON.stringify(store + SET + '-v1.mp4')},
    label: ${JSON.stringify(TITLES[SET].replace(/ \(v1\)$/, '') + ' — v1')},
    meta: ${JSON.stringify(mmss(film.seconds))}, mount: '#film' });
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)},
    sheet: ${JSON.stringify(SET + '-film-v1-s' + film.shots.length)} });
})();
<\/script>
`;

const out = path.join(DIR, SET + '-page.html');
fs.writeFileSync(out, html);
console.log(path.relative(ROOT, out), html.length, 'bytes ·', film.shots.length, 'cards');
if (DRY) process.exit(0);

fetch(BASE + '/api/chatfeed/page', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, session: SESSION, title: TITLES[SET], html }),
}).then((r) => r.json()).then((j) => {
  console.log(JSON.stringify(j, null, 1));
  // A warning means the page skipped part of the kit; fix and re-post NOW,
  // while this chat is still the one that can.
  if (j.warnings && j.warnings.length) process.exitCode = 1;
});

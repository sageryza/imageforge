#!/usr/bin/env node
// ticky-tack-audition-page.js — post the three Thomas audition takes as ONE
// Compare page in the ticky-tack chat (comparing takes = a Compare page, one
// __filmRow per take inside a [data-item] block). Reads jobs.json written by
// ticky-tack-audition.js. `--dry` prints the html.
const fs = require('fs'), path = require('path');
const CHAT = 'tiki-tack-draft-commit';
const VERSION = process.argv.find((a) => /^--v\d+$/.test(a)) || '--v1';
const V = VERSION.slice(3);
const dir = path.join(__dirname, '..', 'docs', 'ticky-tack', 'thomas-audition');
const jobs = JSON.parse(fs.readFileSync(path.join(dir, 'jobs.json'), 'utf8')).filter((j) => j.video);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const rows = jobs.map((j) => {
  const prompt = fs.readFileSync(path.join(dir, j.file), 'utf8').trim();
  return `  <div class="card" data-item="${j.scene}">
    <h2>${esc(j.title.replace(/^Thomas audition \d+ — /, ''))}</h2>
    <div id="film-${j.scene}"></div>
    <details class="prompt"><summary>the exact prompt</summary><pre>${esc(prompt)}</pre></details>
  </div>`;
}).join('\n');
const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Thomas audition v${V} — three Mini takes (15s)</title>
<link rel="stylesheet" href="/compare.css">
<style>
  details.prompt{margin-top:8px}
  details.prompt summary{cursor:pointer;font-size:13px;text-decoration:underline}
  details.prompt pre{white-space:pre-wrap;font:13px/1.45 inherit;font-family:inherit;margin:8px 0 0;opacity:.85}
</style>
<div class="wrap">
  <h1>Thomas audition v${V} — three Mini takes (15s)</h1>
${rows}
</div>
<script src="/compare.js"></script>
<script>
(function () {
  var takes = ${JSON.stringify(jobs.map((j) => ({ scene: j.scene, url: j.video, label: j.title.replace(/^Thomas audition \d+ — /, ''), meta: '15s · 480p · Mini' })))};
  takes.forEach(function (t) {
    window.__filmRow({ url: t.url, label: t.label, meta: t.meta, mount: '#film-' + t.scene, chat: '${CHAT}' });
  });
  window.__compareNotes({ chat: '${CHAT}', sheet: 'thomas-audition-v${V}' });
  window.__compareHelp({ html: '<b>Three trial clips of Thomas.</b> Seedance 2.0 Mini on Atlas Cloud, 15 seconds, 480p, landscape, no references — the book\\'s own description of him and the girl opens every prompt. ♥ or ✕ each take and leave a note on the one that is closest.' });
})();
</script>`;
if (process.argv.includes('--dry')) { console.log(html); process.exit(0); }
fetch('https://imageforge-q125.onrender.com/api/chatfeed/page', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, title: `Thomas audition v${V} — three Mini takes (15s)`, html }) })
  .then((r) => r.json()).then((j) => console.log(JSON.stringify(j, null, 1)));

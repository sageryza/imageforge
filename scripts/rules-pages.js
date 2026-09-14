#!/usr/bin/env node
// The rules as Compare pages — one page per section of CLAUDE.md, plain
// bullets with a three-stop box (tick · x · clear) and the house note on each
// (2026-09-14, Sophie: "put each section u mentioned in its own compare page,
// summarized w check x note feature · basically plain text, no header ·
// bullets"). The bullets live in docs/rules-pages/rules-pages.json; this
// builds the html from them and posts each page. No <h1> on purpose — her
// word — so the kit's title rule is deliberately not met here.
//   node scripts/rules-pages.js            dry: prints sizes
//   node scripts/rules-pages.js --go       posts every page
//   node scripts/rules-pages.js --go --supersede <id,id,…>   retire the old
'use strict';
const fs = require('fs');
const path = require('path');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs/rules-pages/rules-pages.json'), 'utf8'));
const go = process.argv.includes('--go');
const supIdx = process.argv.indexOf('--supersede');
const supersede = supIdx > -1 ? process.argv[supIdx + 1].split(',') : [];
const version = process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : '1';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function html(page, chat) {
  const sheet = `rules-${page.slug}-v${version}`;
  const rows = page.items.map((t, i) => {
    const id = `${page.slug}-${String(i + 1).padStart(2, '0')}`;
    return `  <div class="it" data-item="${id}">
    <button type="button" class="box" data-id="${id}" aria-label="tick, then x, then clear"><span class="tk">✓</span><span class="ex">✕</span></button>
    <div class="t">${esc(t)}</div>
  </div>`;
  }).join('\n');
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)} v${version}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* plain bullets, no header (her ask); the pill's column is reserved on the right */
  .wrap { padding-top: 10px; }
  .it { display: flex; gap: 10px; align-items: flex-start; padding: 9px 64px 9px 0;
        border-bottom: 1px solid var(--line); }
  .it .t { flex: 1; min-width: 0; font-size: 15.5px; line-height: 1.4; }
  .box { flex: none; width: 22px; height: 22px; padding: 0; margin-top: 1px;
         border-radius: 6px; border: 1.5px solid #cabda4; background: var(--surface);
         color: var(--chg); position: relative; }
  .box::before { content: ''; position: absolute; inset: -8px -8px -8px -12px; }
  .box span { display: none; font: 700 13px/1 -apple-system, sans-serif; }
  .box[data-ok="1"] { border-color: var(--chg); background: #fbeeea; }
  .box[data-ok="1"] .tk { display: inline; }
  .box[data-ok="0"] { border-color: #b9b2a6; color: #8d867a; background: #efece6; }
  .box[data-ok="0"] .ex { display: inline; }
  .it.x .t { color: #8d867a; text-decoration: line-through; }
</style>
<div class="wrap">
${rows}
</div>
<script src="/compare.js"></script>
<script>
(function () {
  var CHAT = ${JSON.stringify(chat)}, SHEET = ${JSON.stringify(sheet)};
  var state = {};
  function paint(id) {
    var b = document.querySelector('.box[data-id="' + id + '"]'); if (!b) return;
    var v = state[id];
    if (v === true) b.setAttribute('data-ok', '1'); else if (v === false) b.setAttribute('data-ok', '0'); else b.removeAttribute('data-ok');
    b.closest('.it').classList.toggle('x', v === false);
  }
  function save(id, ok) {
    fetch('/api/chatfeed/verdict', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, sheet: SHEET, item: id, ok: ok }) }).catch(function () {});
  }
  // tick → x → clear, the chats list-item box's own walk (it cycles on purpose:
  // one box, nothing to aim at)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.box'); if (!b) return;
    var id = b.getAttribute('data-id'), v = state[id];
    var next = v === true ? false : v === false ? null : true;
    state[id] = next; paint(id); save(id, next);
  });
  fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(CHAT) + '&sheet=' + encodeURIComponent(SHEET))
    .then(function (r) { return r.json(); })
    .then(function (d) { var it = (d && d.items) || {}; Object.keys(it).forEach(function (k) { state[k] = it[k]; paint(k); }); })
    .catch(function () {});
  window.__compareNotes({ chat: CHAT, sheet: SHEET });
})();
</script>
`;
}

(async () => {
  for (const page of spec.pages) {
    const h = html(page, spec.chat);
    if (!go) { console.log(`${page.slug}: ${page.items.length} items, ${h.length} bytes`); continue; }
    const r = await fetch(BASE + '/api/chatfeed/page', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: spec.chat, title: `${page.title} v${version}`, html: h }) });
    const j = await r.json();
    console.log(page.slug, j.id || j, (j.warnings || []).length ? 'warnings: ' + j.warnings.join(' | ') : '');
  }
  for (const id of supersede) {
    const r = await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    console.log('superseded', id, r.status);
  }
})();

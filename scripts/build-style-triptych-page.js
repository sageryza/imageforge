#!/usr/bin/env node
/**
 * Build + post the Compare page for a style-triptych run.
 *
 *   node scripts/build-style-triptych-page.js <quality> [--version v1] [--dry-run]
 *
 * Reads out/style-triptych/manifest-<quality>.json (written by
 * style-triptych.js) and posts one page per run into the chat's Compare tab.
 * A NEW QUALITY IS A NEW PAGE — never re-point an old one at new media.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'compare-page-style-variants';
const QUALITY = (process.argv[2] || 'low').toLowerCase();
const vArg = process.argv.find((a) => a.startsWith('--version='));
const VERSION = vArg ? vArg.split('=')[1] : 'v1';
const DRY = process.argv.includes('--dry-run');

const manifest = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'out', 'style-triptych', `manifest-${QUALITY}.json`), 'utf8'));
const ok = manifest.filter((m) => m.url);
if (!ok.length) { console.error('nothing generated'); process.exit(1); }

// Column order is fixed so every row reads the same way left-to-right.
const ORDER = ['watercolor', 'dream', 'pastel'];
const TAGS = { watercolor: 'watercolor', dream: 'dream mystery', pastel: 'pastel' };

// Row order is fixed too — the manifest grows in whatever order subjects were
// (re-)run, and a re-run must not shuffle the page under her.
const ROWS = ['braid', 'dinner', 'bicycle', 'terrarium'];
const subjects = [];
for (const m of ok) {
  let s = subjects.find((x) => x.id === m.subject);
  if (!s) { s = { id: m.subject, label: m.subjectLabel, stress: m.stress, cols: {} }; subjects.push(s); }
  s.cols[m.style] = m;
}
subjects.sort((a, b) => {
  const ia = ROWS.indexOf(a.id), ib = ROWS.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SHEET = `styles3-${QUALITY}-s${subjects.length}`;

const cards = subjects.map((s) => {
  const cells = ORDER.filter((k) => s.cols[k]).map((k) => {
    const m = s.cols[k];
    return `      <figure><span class="tag">${esc(TAGS[k])}</span>` +
      `<img src="${esc(m.url)}" alt="${esc(s.label)} — ${esc(TAGS[k])}"></figure>`;
  }).join('\n');
  return `  <div class="card" data-item="${esc(s.id)}">
    <h3>${esc(s.label)}</h3>
    <div class="duo trio">
${cells}
    </div>
  </div>`;
}).join('\n');

const helpRows = subjects.map((s) => `<li><b>${esc(s.label)}</b> — ${esc(s.stress)}</li>`).join('');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Three styles, one prompt — ${esc(QUALITY)} (${esc(VERSION)})</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* Three across, labels on top — .duo's look, one more column. */
  .duo.trio { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
</style>

<div class="wrap">
  <h1>Three styles, one prompt — ${esc(QUALITY)} (${esc(VERSION)})</h1>
${cards}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html: '<b>Same words, three house styles.</b> Left to right: '
    + 'sage sandy mirror (watercolor), dream mystery (diary comic), '
    + 'sophie snake + sophie animals (Witch School pastel). '
    + 'gpt-image-2 edits, 1024x1536, quality ${esc(QUALITY)}.'
    + '<br><br>The subjects were picked to be awkward:<ul>${helpRows.replace(/'/g, "\\'")}</ul>' });
})();
</script>
`;

if (DRY) { console.log(html); process.exit(0); }

(async () => {
  const res = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat: CHAT,
      title: `Three styles, one prompt — ${QUALITY} (${VERSION})`,
      html,
      reference: true,
      topic: 'styles',
    }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  if (data.warnings && data.warnings.length) {
    console.error('\n⚠ WARNINGS — fix the page and re-post:', data.warnings);
    process.exit(1);
  }
  if (data.id) console.log(`\npage → ${BASE}/api/chatfeed/page/${data.id}`);
})();

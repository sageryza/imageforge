#!/usr/bin/env node
// storyboard-print-page.js — the Compare page that hands her the print sheets
// (2026-09-04, Sophie: "put them in ur compare tab so i can download"). One
// page: every PDF as a line with a save link, and under each storyboard its
// pages as pictures, two to a row, so she can see the layout in the tab before
// printing and leave a note on any page (the revisions she expects).
//
//   node scripts/storyboard-print-page.js --manifest <file> [--manifest <file>…] [--extra <json>] [--everything <json>] [--title "…"] [--go] [--supersede <pageId>]
//
// `--manifest` is what storyboard-print.js --go writes; `--extra <json>` adds
// other PDFs already in the Dump as `[{title, url}]` (yesterday's triangle
// sheets ride this way). Dry by default: prints the html size and the
// warnings check; --go posts it.
'use strict';
const fs = require('fs');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'print-storyboards-letter';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// a save line: the PDF opens at the top of the app / in Safari, where the
// share sheet can save it — a same-origin link left alone by compare.js
// would open the PDF INSIDE the page's iframe with no way to save it.
const dl = (title, url, meta) =>
  `<div class="dl"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>${meta ? ` <span class="meta">${esc(meta)}</span>` : ''}</div>`;

// a section: one PDF's save line and its pages two to a row, each a note box
function section(h2, title, url, meta, pageUrls, key) {
  const rows = [];
  for (let i = 0; i < pageUrls.length; i += 2) {
    rows.push(`<div class="imgrow">${pageUrls.slice(i, i + 2).map((u, j) =>
      `<figure data-item="${esc(key)}-p${i + j + 1}"><img src="${esc(u)}" alt="${esc(title)} — page ${i + j + 1}"></figure>`).join('')}</div>`);
  }
  return `<div class="card">
  ${h2 ? `<h2>${esc(h2)}</h2>` : ''}
  ${dl(title, url, meta)}
  ${rows.join('\n  ')}
</div>`;
}

// manifests: {docs:[{title, pages, pdf:{url}, pageUrls, stories:[…]}]} from
// storyboard-print.js; extra: [{title, url, meta, pageUrls}] for PDFs already
// in the Dump (pdf-pages.py makes their previews); everything: one {title,
// url, meta, pageUrls} drawn FIRST — the one PDF that holds all of it
function build(docs, extra, title, sheet, everything) {
  const top = everything ? section('', everything.title, everything.url, everything.meta, everything.pageUrls || [], 'everything') : '';
  const boards = docs.map((d) => section(
    d.title,
    `${d.title} — one PDF (${d.pages} ${d.pages === 1 ? 'page' : 'pages'})`,
    d.pdf.url,
    d.stories.map((st) => `${st.title} ${st.cols} across`).join(' · '),
    d.pageUrls || [], slug(d.stem || d.title)));
  const extras = extra.length ? `<h2 class="sec">Similitude — the letter sheets</h2>\n` + extra.map((e) => section('', e.title, e.url, e.meta, e.pageUrls || [], slug(e.title))).join('\n') : '';
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .dl { margin: 6px 0 10px; }
  .dl a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
  .dl .meta { color: var(--ink2); font-size: .85em; }
  .imgrow figure { margin: 0; }
  .imgrow img { border: 1px solid var(--line); background: #fff; }
  h2.sec { margin: 22px 0 8px; }
</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
  ${top}
  ${boards.join('\n  ')}
  ${extras}
</div>
<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(sheet)} });
  window.__compareHelp({ html: '<b>Print sheets.</b> Tap a title to open the PDF and save it (letter paper). '
    + 'The pages under each show the layout; leave a note on a page for a revision. '
    + 'On a storyboard a frame colour is the beat\\'s own, a bar over beats joins a chunk, and a dashed box is a beat with no picture yet.' });
})();
</script>
`;
}

async function main() {
  const docs = [];
  process.argv.forEach((a, i) => { if (a === '--manifest' && process.argv[i + 1]) docs.push(...(JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8')).docs || [])); });
  const extra = arg('extra') ? JSON.parse(fs.readFileSync(arg('extra'), 'utf8')) : [];
  const title = arg('title', 'Print sheets — storyboards + Similitude');
  const sheet = slug(title);
  const everything = arg('everything') ? JSON.parse(fs.readFileSync(arg('everything'), 'utf8')) : null;
  const html = build(docs, extra, title, sheet, everything);
  const out = arg('out', '');
  if (out) fs.writeFileSync(out, html);
  console.log('html', html.length, 'bytes ·', docs.length, 'storyboard pdfs ·', extra.length, 'extra pdfs');
  if (!process.argv.includes('--go')) return;
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, session: SESSION, title, html }),
  });
  const body = await r.json();
  console.log(JSON.stringify(body, null, 1));
  const sup = arg('supersede', '');
  if (sup && body.id) {
    const s = await fetch(BASE + '/api/chatfeed/page/' + sup + '/supersede', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, by: body.id }),
    });
    console.log('supersede', sup, s.status);
  }
}

module.exports = { build };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

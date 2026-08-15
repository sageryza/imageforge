#!/usr/bin/env node
// gen-sort-proposal-page.js — the review page for a sort dry run.
//
// Sophie, 2026-08-15: "can you make a compare page showing where each chat was
// supposed to go in the dry run, and if there was any reasoning about why you
// could put it in."
//
// Reads the JSON a dry run wrote (`backfill-chat-categories.js --json`) and
// posts it as a Compare page. Built from the saved decisions rather than from
// a fresh run on purpose: the pass that costs money happens once, and the page
// can be rebuilt for free as many times as the layout needs.
//
//   node scripts/backfill-chat-categories.js --json /tmp/dry.json
//   node scripts/gen-sort-proposal-page.js /tmp/dry.json
//   node scripts/gen-sort-proposal-page.js /tmp/dry.json --html-only  # no post
//
// A NEW RUN IS A NEW PAGE — the title carries the count and the verdict sheet
// is keyed to it (`sort-dryrun-<n>`), so her notes can never be silently
// re-pointed at a different set of chats.

const fs = require('fs');
const fetch = globalThis.fetch || require('node-fetch');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'auto-sort-chats-category';
const file = process.argv[2];
if (!file) { console.error('usage: gen-sort-proposal-page.js <dryrun.json> [--html-only]'); process.exit(1); }

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

(async () => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = data.rows || [];
  // Her display names, so a row reads the way it reads in her app rather than
  // as a branch slug.
  let names = {};
  try {
    const feed = await (await fetch(BASE + '/api/chatfeed?limit=1')).json();
    Object.keys(feed.chats || {}).forEach((n) => { names[n] = (feed.chats[n] || {}).displayName || ''; });
  } catch (_) { /* slugs are fine */ }

  // Folders in the order they were offered, then the leave-alone pile LAST —
  // it is the biggest group and the least interesting, so it must not be the
  // first thing she scrolls through.
  const folders = (data.folders || []).filter((f) => rows.some((r) => r.category === f));
  const groups = folders.map((f) => ({ name: f, rows: rows.filter((r) => r.category === f) }));
  const left = rows.filter((r) => !r.category);
  const sorted = rows.length - left.length;

  const row = (r) => {
    const disp = names[r.chat] && names[r.chat] !== r.chat ? names[r.chat] : '';
    return `  <div class="card" data-item="${esc(r.chat)}">\n`
      + `    <h3>${esc(disp || r.chat)}</h3>\n`
      + (disp ? `    <div class="mini">${esc(r.chat)}</div>\n` : '')
      + (r.reason ? `    <div class="mini">${esc(r.reason)}</div>\n` : '')
      + '  </div>\n';
  };

  const sheet = 'sort-dryrun-' + rows.length;
  const title = `Sort proposal — ${sorted} of ${rows.length} chats`;
  const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>${esc(title)}</h1>
${groups.map((g) => `  <h2>${esc(g.name)} · ${g.rows.length}</h2>\n` + g.rows.map(row).join('')).join('')}
  <h2>left alone · ${left.length}</h2>
${left.map(row).join('')}</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(sheet)} });
  window.__compareHelp({ html: '<b>Nothing has been filed.</b> This is what the '
    + 'sorter would do to the chats you have never filed yourself, with its own '
    + 'reason under each one. Chats you filed by hand are not here and are never '
    + 'touched. <b>look at</b> and <b>come back to</b> are never offered to it. '
    + 'Leave a note on any row you disagree with and I will fix it before writing '
    + 'anything.' });
})();
</script>
`;

  if (process.argv.includes('--html-only')) {
    const out = file.replace(/\.json$/, '') + '.html';
    fs.writeFileSync(out, html);
    console.log('wrote ' + out + ' (' + html.length + ' bytes)');
    return;
  }
  const res = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  const out = await res.json();
  console.log(JSON.stringify(out, null, 1));
  if (out.warnings && out.warnings.length) {
    console.error('\nWARNINGS — fix the page and re-post before finishing the turn.');
    process.exit(1);
  }
})().catch((err) => { console.error(String(err.message || err)); process.exit(1); });

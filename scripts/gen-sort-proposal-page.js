#!/usr/bin/env node
// gen-sort-proposal-page.js — the review page for a sort dry run.
//
// Sophie, 2026-08-15: "can you make a compare page showing where each chat was
// supposed to go in the dry run, and if there was any reasoning about why you
// could put it in." Then, on reading v1: "I'd like a check off mark per chat to
// say yeah file it there, or alternatively file it elsewhere." And: "I'm
// wondering if it would be easy to flag which ones should be archived."
//
// Reads the JSON a dry run wrote (`backfill-chat-categories.js --json`) and
// posts it as a Compare page. Built from the saved decisions rather than from a
// fresh run on purpose: the pass that costs money happens once, and the page
// rebuilds for free as many times as the layout needs.
//
//   node scripts/backfill-chat-categories.js --json /tmp/dry.json
//   node scripts/gen-sort-proposal-page.js /tmp/dry.json
//   node scripts/gen-sort-proposal-page.js /tmp/dry.json --html-only  # no post
//
// HER ANSWER PER ROW IS A FOLDER NAME, not a yes/no — that is what makes one
// control do both halves of what she asked for. `ok` on the verdict doc takes a
// short string (chatfeed.js), so ✓ writes the proposed folder and the picker
// writes a different one; `none` means leave it unfiled. A row with no value is
// one she has not answered yet, which is a state a boolean could not carry.
// Read her answers back with:
//   GET /api/chatfeed/verdict?chat=<chat>&sheet=sort-dryrun-<n>
//
// A NEW RUN IS A NEW PAGE — the title carries the count and the sheet is keyed
// to it, so her answers can never be silently re-pointed at a different set.

const fs = require('fs');
const fetch = globalThis.fetch || require('node-fetch');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'auto-sort-chats-category';
const file = process.argv[2];
if (!file) { console.error('usage: gen-sort-proposal-page.js <dryrun.json> [--html-only]'); process.exit(1); }

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Only an ACTIONABLE flag gets a chip. "keep" is the ordinary state of a live
// chat, and a chip on every row is a chip she stops reading.
const HINT_CLASS = { archive: 'good', 'dead end': 'info', 'needs you': 'warn' };

(async () => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = data.rows || [];
  let names = {};
  let folders = data.folders || [];
  try {
    const feed = await (await fetch(BASE + '/api/chatfeed?limit=1')).json();
    Object.keys(feed.chats || {}).forEach((n) => { names[n] = (feed.chats[n] || {}).displayName || ''; });
    // The picker offers every folder she has TODAY, not only the ones the run
    // knew about — she made "dream app" after this pass and needs to reach it.
    const live = await (await fetch(BASE + '/api/chatfeed/sort')).json();
    if (live.categories && live.categories.length) folders = live.categories;
  } catch (_) { /* the run's own list is a fine fallback */ }

  const used = folders.filter((f) => rows.some((r) => r.category === f));
  const groups = used.map((f) => ({ name: f, rows: rows.filter((r) => r.category === f) }));
  const left = rows.filter((r) => !r.category);
  const sorted = rows.length - left.length;
  const flagged = rows.filter((r) => r.hint && r.hint !== 'keep').length;

  const opts = (sel) => ['none'].concat(folders)
    .map((f) => `<option value="${esc(f)}"${f === (sel || 'none') ? ' selected' : ''}>`
      + esc(f === 'none' ? 'leave unfiled' : f) + '</option>').join('');

  const row = (r) => {
    const disp = names[r.chat] && names[r.chat] !== r.chat ? names[r.chat] : '';
    const cls = HINT_CLASS[r.hint];
    return `  <div class="card" data-item="${esc(r.chat)}" data-pick="${esc(r.category || 'none')}">\n`
      + `    <h3>${esc(disp || r.chat)}</h3>\n`
      + (disp ? `    <div class="mini">${esc(r.chat)}</div>\n` : '')
      + (r.reason ? `    <div class="mini">${esc(r.reason)}</div>\n` : '')
      // WHERE IT IS ARCHIVED (Aug 2026, Sophie: "there's two archives, one in the
      // Claude app and one in the Deck Factory app… just have a little mark if
      // they're archived and where"). Every row here is un-archived in Deck
      // Factory by construction — the run skips those — so the only mark this
      // can carry is the Claude one, and it says so rather than just "archived".
      + (r.claudeArchived ? '    <div class="chips"><span class="chip">archived in Claude</span></div>\n' : '')
      + (cls ? `    <div class="chips"><span class="chip ${cls}">${esc(r.hint)}</span>`
          + (r.hint === 'needs you' && r.pendingAsk
            ? `<span class="mini">${esc(r.pendingAsk)}</span>`
            : (r.stateWhy ? `<span class="mini">${esc(r.stateWhy)}</span>` : ''))
          + '</div>\n' : '')
      + '    <div class="pick"><button class="yes" type="button">✓</button>'
      + `<select>${opts(r.category)}</select><span class="said"></span></div>\n`
      + '  </div>\n';
  };

  const sheet = 'sort-dryrun-' + rows.length;
  const title = `Sort proposal — ${sorted} of ${rows.length} chats`;
  const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
/* The row's two controls, side by side and each its own width — never a slab
   (compare.css's button rule). The select is a native one on purpose: one tap
   on a phone, and it is already on the pill's exempt list so choosing a folder
   can never start the autoscroll. */
.pick { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.pick button.yes { padding: 7px 12px; }
.pick button.yes.on { background: var(--gold); color: var(--surface); }
.pick select {
  font: 500 14px/1 -apple-system, 'Helvetica Neue', sans-serif;
  border: 1px solid var(--line); border-radius: 6px; padding: 7px 8px;
  background: var(--surface); color: var(--ink);
}
.pick .said { font: 600 12px/1 -apple-system, sans-serif; color: var(--green); }
.card.answered { border-color: #c9dbbd; }
</style>

<div class="wrap">
  <h1>${esc(title)}</h1>
${groups.map((g) => `  <h2>${esc(g.name)} · ${g.rows.length}</h2>\n` + g.rows.map(row).join('')).join('')}
  <h2>left alone · ${left.length}</h2>
${left.map(row).join('')}</div>

<script src="/compare.js"></script>
<script>
(function () {
  var CHAT = ${JSON.stringify(CHAT)}, SHEET = ${JSON.stringify(sheet)};
  window.__compareNotes({ chat: CHAT, sheet: SHEET });
  window.__compareHelp({ html: '<b>Nothing has been filed.</b> This is what the '
    + 'sorter would do to the chats you have never filed yourself. <b>✓</b> means '
    + 'file it where it says; the dropdown puts it somewhere else, or leaves it '
    + 'unfiled. Chats you filed by hand are not here and are never touched, and '
    + '<b>look at</b> / <b>come back to</b> are never offered to it.<br><br>'
    + 'The coloured flag is whether the chat looks finished — <b>archive</b> '
    + 'built and settled, <b>dead end</b> stopped on something that could not be '
    + 'done, <b>needs you</b> a question of yours nobody answered (it says which). '
    + 'Nothing is archived either; that stays yours.<br><br>'
    + '<b>archived in Claude</b> means you archived that chat in the Claude app '
    + 'but not here — the two archives are separate, and this page only skips the '
    + 'Deck Factory one. 23 of these have no Claude session on record at all '
    + '(older than the session list, or on the other account), so for those the '
    + 'absence of a mark means unknown rather than live.' });

  function save(item, val) {
    return fetch('/api/chatfeed/verdict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, sheet: SHEET, item: item, ok: val })
    });
  }
  function paint(card, val) {
    var sel = card.querySelector('select'), btn = card.querySelector('button.yes');
    var said = card.querySelector('.said');
    var answered = !!val;
    card.classList.toggle('answered', answered);
    // The ✓ lights only when her answer IS the proposal — once she moves a chat
    // somewhere else the tick would be claiming she agreed with the guess.
    btn.classList.toggle('on', answered && val === card.getAttribute('data-pick'));
    if (answered) sel.value = val;
    said.textContent = answered ? (val === 'none' ? 'unfiled' : val) : '';
  }
  var cards = [].slice.call(document.querySelectorAll('.card[data-item]'));
  cards.forEach(function (card) {
    var item = card.getAttribute('data-item');
    card.querySelector('button.yes').addEventListener('click', function () {
      var v = card.getAttribute('data-pick');
      paint(card, v); save(item, v);
    });
    card.querySelector('select').addEventListener('change', function () {
      paint(card, this.value); save(item, this.value);
    });
  });
  // What she answered last time — the page is long and she will not finish it
  // in one sitting, so it has to come back exactly as she left it.
  fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(CHAT) + '&sheet=' + encodeURIComponent(SHEET))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var items = (d && d.items) || {};
      cards.forEach(function (card) {
        var v = items[card.getAttribute('data-item')];
        if (typeof v === 'string' && v) paint(card, v);
      });
    }).catch(function () { /* an unreachable read must not break the picking */ });
})();
</script>
`;

  if (process.argv.includes('--html-only')) {
    const out = file.replace(/\.json$/, '') + '.html';
    fs.writeFileSync(out, html);
    console.log('wrote ' + out + ' (' + html.length + ' bytes, ' + flagged + ' flagged)');
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

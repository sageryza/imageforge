#!/usr/bin/env node
/**
 * Build + post the Compare page for a style-triptych run.
 *
 *   node scripts/build-style-triptych-page.js <quality> [--sheet] [--version v2]
 *                                             [--supersede <pageId>] [--dry-run]
 *
 * Reads the manifest style-triptych.js / style-triptych-sheet.js wrote and
 * posts one page per run into the chat's Compare tab.
 *
 * A NEW QUALITY OR A NEW METHOD IS A NEW PAGE — never re-point an old one at
 * new media (a cached copy would then show stale pictures). --supersede marks
 * the page this one replaces.
 *
 * Every image carries a PROMPT button (Sophie, Aug 2026: "put the prompt
 * behind the button in each one and include the style which will change per
 * thingy"). The style half really does differ per column, so each cell shows
 * its OWN style text, not one shared blob. The panel opens full width under
 * the row rather than inside the 1/3-wide column, because a prompt crammed
 * into a third of a phone screen is unreadable.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'compare-page-style-variants';
const QUALITY = (process.argv[2] || 'low').toLowerCase();
const SHEET = process.argv.includes('--sheet');
const pick = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const VERSION = pick('--version', SHEET ? 'v2' : 'v1');
const SUPERSEDE = pick('--supersede', null);
const DRY = process.argv.includes('--dry-run');

const mfName = SHEET ? `manifest-sheet-${QUALITY}.json` : `manifest-${QUALITY}.json`;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'style-triptych', mfName), 'utf8'));
const ok = manifest.filter((m) => m.url);
if (!ok.length) { console.error('nothing generated'); process.exit(1); }

const ORDER = ['watercolor', 'dream', 'pastel'];
const TAGS = { watercolor: 'watercolor', dream: 'dream mystery', pastel: 'pastel' };
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
const SHEET_TAG = SHEET ? 'sheet' : 'solo';
const SHEETN = `styles3-${SHEET_TAG}-${QUALITY}-s${subjects.length}`;

// The prompts, keyed by cell id — read by the page script to fill the panel.
const prompts = {};
for (const m of ok) {
  prompts[`${m.subject}__${m.style}`] = { style: m.promptStyle, content: m.promptContent };
}

const cards = subjects.map((s) => {
  const cells = ORDER.filter((k) => s.cols[k]).map((k) => {
    const m = s.cols[k];
    return `      <figure>
        <span class="tag">${esc(TAGS[k])}</span>
        <img src="${esc(m.url)}" alt="${esc(s.label)} — ${esc(TAGS[k])}">
        <button type="button" class="pbtn" data-p="${esc(s.id)}__${esc(k)}" data-n="${esc(TAGS[k])}">prompt</button>
      </figure>`;
  }).join('\n');
  return `  <div class="card" data-item="${esc(s.id)}">
    <h3>${esc(s.label)}</h3>
    <div class="duo trio">
${cells}
    </div>
    <div class="ppanel" hidden></div>
  </div>`;
}).join('\n');

const title = SHEET
  ? `Three styles, one sheet — ${QUALITY} (${VERSION})`
  : `Three styles, one prompt — ${QUALITY} (${VERSION})`;

const helpBits = [
  '<b>Same words, three house styles.</b> Left to right: sage sandy mirror (watercolor), '
  + 'dream mystery (diary comic), sophie snake + sophie animals (Witch School pastel).',
  SHEET
    ? `Each style drew all four subjects as ONE 2x2 sheet at quality ${QUALITY}, cut into cells — `
      + 'so a cell is a quarter of a 1024x1536 sheet, not a full render.'
    : `gpt-image-2 edits, 1024x1536, quality ${QUALITY}.`,
  'Tap <b>prompt</b> under any picture for the exact text that drew it.',
].join('<br><br>');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* Three across, labels on top — .duo's look, one more column. */
  .duo.trio { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .duo.trio figure { display: flex; flex-direction: column; }
  /* The button hugs its word and sits under its own picture. */
  .pbtn { font-size: 12px; padding: 5px 9px; margin-top: 6px; align-self: start; }
  .pbtn[aria-expanded="true"] { background: var(--gold); color: var(--surface); }
  /* Full width under the row — a prompt in a 1/3 column is unreadable. */
  .ppanel { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px; }
  .ppanel h4 {
    font: 700 11px/1 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .14em; text-transform: uppercase; color: var(--gold); margin-bottom: 5px;
  }
  .ppanel p { font-size: 14px; line-height: 1.5; margin-bottom: 12px; white-space: pre-wrap; }
  .ppanel p:last-child { margin-bottom: 0; }
</style>

<div class="wrap">
  <h1>${esc(title)}</h1>
${cards}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var P = ${JSON.stringify(prompts)};
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEETN)} });
  window.__compareHelp({ html: ${JSON.stringify(helpBits)} });

  // One panel per card, one open at a time. Tapping the open button closes it.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.pbtn');
    if (!b) return;
    var card = b.closest('.card');
    var panel = card.querySelector('.ppanel');
    var open = b.getAttribute('aria-expanded') === 'true';
    card.querySelectorAll('.pbtn').forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
    if (open) { panel.hidden = true; return; }
    b.setAttribute('aria-expanded', 'true');
    var p = P[b.getAttribute('data-p')] || {};
    panel.innerHTML = '<h4>' + b.getAttribute('data-n') + ' — style</h4><p></p>'
      + '<h4>content</h4><p></p>';
    var ps = panel.querySelectorAll('p');
    ps[0].textContent = p.style || 'not available';
    ps[1].textContent = p.content || 'not available';
    panel.hidden = false;
  });
})();
</script>
`;

if (DRY) { console.log(html); process.exit(0); }

(async () => {
  const res = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html, reference: true, topic: 'styles' }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  if (data.warnings && data.warnings.length) {
    console.error('\n⚠ WARNINGS — fix the page and re-post:', data.warnings);
    process.exit(1);
  }
  if (data.id) console.log(`\npage → ${BASE}/api/chatfeed/page/${data.id}`);
  if (SUPERSEDE && data.id) {
    // The route only toggles a flag — it stores no pointer to the replacement,
    // so the version lives in the TITLE and nowhere else.
    const s = await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDE}/supersede`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superseded: true }),
    });
    console.log('superseded', SUPERSEDE, '→', s.status, JSON.stringify(await s.json()).slice(0, 200));
  }
})();

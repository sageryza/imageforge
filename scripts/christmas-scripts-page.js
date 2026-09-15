// christmas-scripts-page — turn docs/christmas-commercial/SCRIPTS.md into the
// Compare page Sophie reads the scripts on (2026-09-15: "script in compare").
//
//   node scripts/christmas-scripts-page.js            # print the html
//   node scripts/christmas-scripts-page.js --go       # post it
//   node scripts/christmas-scripts-page.js --go --supersede <pageId>
//
// THE PAGE CARRIES THE SCRIPT AND NOTHING ELSE (Sophie, 2026-09-15: "stay in
// ur lane" · "scripts = mine only"). Everything in that file that is a chat
// talking — the ordering rule, the reference problem, the provenance tags,
// what an eleven-year-old does not sound like — is dropped here. The doc is
// where a chat reads; the page is where she reads, and on it there is nothing
// but the words that get shot. Each spot is one [data-item] so her note lands
// on that spot.
const fs = require('fs');
const path = require('path');

const CHAT = 'christmas-scripts-saturnalia';
const SHEET = 'xmas-scripts-v1';
const TITLE = 'Christmas scripts v1 — nine spots and the ending';

const md = fs.readFileSync(path.join(__dirname, '..', 'docs/christmas-commercial/SCRIPTS.md'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\*([^*]+)\*/g, '<i>$1</i>')
  .replace(/`([^`]+)`/g, '$1');

// Split on the "## " headings; keep the nine spots and the ending.
const blocks = md.split(/\n(?=## )/).map((b) => b.trim()).filter(Boolean);
const spots = blocks.filter((b) => /^## (\d+\. |THE ENDING)/.test(b));
if (spots.length !== 10) throw new Error(`expected 10 blocks, found ${spots.length}`);

function render(block, i) {
  const lines = block.split('\n');
  const head = lines[0].replace(/^##\s*/, '').replace(/ — the girl talks$/, ' (:12)');
  const id = 'spot-' + (i === 9 ? 'ending' : (i + 1));
  const out = [];
  // Paragraph-level grouping: blank line ends a run.
  let buf = [], kind = null;
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    const k = kind; buf = []; kind = null;
    if (!text) return;
    if (k === 'q') {
      // a quoted line: VO / SUPER / a speaker, or an option
      out.push(`<p class="ln">${inline(text.replace(/>\s?/g, '').trim())}</p>`);
    } else if (k === 'li') {
      // a bullet in these docs can carry a quoted line inline ("… > \"…\"")
      out.push(`<li>${inline(text.replace(/^[-*]\s+/, '').replace(/\s*>\s*/g, ' '))}</li>`);
    } else if (k === 'beat') {
      out.push(`<p class="beat">${inline(text)}</p>`);
    } else {
      out.push(`<p class="dir">${inline(text)}</p>`);
    }
  };
  let inList = false;
  for (const raw of lines.slice(1)) {
    const l = raw.replace(/\s+$/, '');
    if (!l.trim()) { flush(); continue; }
    if (/^>\s*$/.test(l)) { flush(); continue; }
    if (/^---+\s*$/.test(l)) { flush(); continue; }   // the doc's section rule
    if (/^###\s/.test(l)) { flush(); continue; }        // the card's h2 says it already
    let k = 'p';
    if (/^>/.test(l)) k = 'q';
    else if (/^[-*] /.test(l)) k = 'li';
    else if (/^\*\*:\d/.test(l)) k = 'beat';
    // a speaker label or a new bullet always starts its own paragraph; the
    // parenthetical is part of the label ("SANTA (to camera, tired):")
    if (k === 'q' && /^>\s*[A-Z][A-Z0-9 .'’\/-]*(\([^)]*\))?\s*:/.test(l)) flush();
    if (k === 'li' && /^[-*] /.test(l)) flush();
    // a plain line right under a beat or a bullet is that line WRAPPING,
    // never a new paragraph — unwrapped, a beat split in two and a bullet
    // broke out of its own <ul> (both shipped in the first cut)
    if (kind === 'beat' && k === 'p') k = 'beat';
    if (kind === 'li' && k === 'p') k = 'li';
    if (kind && kind !== k) flush();
    if (k === 'li' && !inList) { out.push('<ul class="extras">'); inList = true; }
    if (k !== 'li' && inList) { out.push('</ul>'); inList = false; }
    kind = k; buf.push(l);
  }
  flush();
  if (inList) out.push('</ul>');
  // Drop the chat-facing prose from the ending block: keep the stage
  // direction, the lines and the extras, nothing addressed to a chat.
  const CHATTY = /^<p class="dir">(<b>|In the comic four|It rides on the end)/;
  const body = out
    .map((h) => h.replace(/ ?<i>\(from the v2 set[^<]*\)<\/i>/, ''))
    .filter((h) => !CHATTY.test(h));
  return `<div class="card" data-item="${id}">\n<h2>${inline(head)}</h2>\n${body.join('\n')}\n</div>`;
}

const cards = spots.map(render).join('\n\n');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* THE PILL'S COLUMN IS RESERVED ON A PAGE MADE OF WORDS. It is fixed at
     x 324-374 on a 390pt phone and the page scrolls under it, so on a text
     page every line that passes through its band loses its last word —
     PHOTO'd before this was here ("we bring a tree", "a table set for too
     many"). A picture page only ever loses a corner of one picture, which is
     why the kit does not reserve it; 64px, not 56, per the measurement in
     the new-page skill. */
  .card { padding-right: 64px; }
  .card h2 { margin-bottom: 8px; }
  .dir { font-style: italic; color: var(--ink2); margin-bottom: 10px; }
  .beat { font-size: 14px; letter-spacing: .02em; margin: 14px 0 4px; }
  .ln { margin: 0 0 8px 14px; padding-left: 12px; border-left: 2px solid var(--rose); }
  .extras { margin: 12px 0 0 18px; }
  .extras li { margin-bottom: 6px; color: var(--ink2); }
</style>

<div class="wrap">
  <h1>${esc(TITLE)}</h1>

${cards}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: '${CHAT}', sheet: '${SHEET}' });
})();
</script>
`;

if (!process.argv.includes('--go')) { process.stdout.write(html); process.exit(0); }

(async () => {
  const base = 'https://imageforge-q125.onrender.com';
  const r = await fetch(base + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html }),
  });
  const j = await r.json();
  console.log(JSON.stringify(j, null, 1));
  const i = process.argv.indexOf('--supersede');
  if (i > 0 && process.argv[i + 1]) {
    const s = await fetch(`${base}/api/chatfeed/page/${process.argv[i + 1]}/supersede`, { method: 'POST' });
    console.log('superseded:', s.status);
  }
})();

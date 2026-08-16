#!/usr/bin/env node
/**
 * marla-text-page.js — where the caption goes, shown rather than described.
 *
 * Sophie's plan, in her words: overlay the text directly on the pages with
 * clear bottoms; on the ones with something down there, "blur that out and put
 * a white level that fades in with low opacity, so the text still has a place";
 * and the few with something important at the bottom get handled one at a time.
 *
 * Which page is which comes from marla-bottoms.js — the ink measured in the
 * region the caption really occupies, never a guess. The counts on the page are
 * that measurement over all 36.
 *
 *   node scripts/marla-text-page.js [--no-post]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHAT = 'marlas-eyes-fishbowl-storybook';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const NO_POST = process.argv.includes('--no-post');

const made = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/textplace.json'), 'utf8'));
const bottoms = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/bottoms.json'), 'utf8'));
const bucketOf = (r) => (r.heavy <= 0.05 ? 'clear' : r.mean < 40 ? 'veil' : 'byhand');
const counts = bottoms.reduce((a, r) => { a[bucketOf(r)] = (a[bucketOf(r)] || 0) + 1; return a; }, {});

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pick = (n) => made.find((m) => m.n === n);

// A composed page is 1024x1536; the facing spread is 2048x1536.
function fig(url, tag, w = 1024, h = 1536) {
  return `<figure><span class="tag">${esc(tag)}</span>`
    + `<img src="${url}" data-full="${url}" width="${w}" height="${h}" alt="${esc(tag)}" loading="lazy"></figure>`;
}

const CARDS = [
  { item: 'clear', h: `Bare bottom — text straight on (${counts.clear || 0} pages)`,
    figs: [[pick(24), 'clear', 'page 24'], [pick(25) || pick(22), 'clear', 'page 22']] },
  { item: 'veil', h: `Something down there — a veil that fades in (${counts.veil || 0} pages)`,
    figs: [[pick(1), 'veil', 'page 1'], [pick(32), 'veil', 'page 32']] },
  { item: 'byhand', h: `Dark to the edge — the words move off the picture (${counts.byhand || 0} pages)`,
    figs: [[pick(17), 'facing', 'page 17'], [pick(35), 'facing', 'page 35']] },
];

const title = 'Marla — where the caption goes';
const sheet = 'textplace-b3';
const cards = CARDS.map((c) => {
  const figs = c.figs.filter(([m]) => m).map(([m, kind, tag]) => {
    const wide = kind === 'facing';
    return fig(m[kind], tag, wide ? 2048 : 1024, 1536);
  }).join('');
  return `<div class="card" data-item="${c.item}">
    <h3>${esc(c.h)}</h3>
    <div class="duo">${figs}</div>
  </div>`;
}).join('\n  ');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>${esc(title)}</h1>
  ${cards}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(sheet)} });
  window.__compareHelp({ html: '<b>No cream band anymore.</b> The caption used to be painted over the bottom of every '
    + 'picture, which covered the calm bottom the prompt had asked for.<br><br>'
    + '<b>How a page picks its treatment.</b> The ink is measured in the exact region that page\\'s caption occupies — '
    + 'a five-line caption reaches much higher than a two-line one — so the choice follows the real picture, not a rule '
    + 'of thumb. Bare paper takes the words as they are. A light wash or a stray object gets a soft blur and a white '
    + 'veil fading in from nothing to about 70%. A bottom that is dark edge to edge gets neither: a veil strong enough '
    + 'to read there would bleach the drawing, so those pages keep their picture whole and the words go on the facing '
    + 'page — or the picture gets redrawn with room made for them.<br><br>'
    + '<b>The veil is the one fade in the whole project</b>, and only because a hard edge would just be the cream band '
    + 'again.' });
})();
</script>`;

(async () => {
  fs.writeFileSync(path.join(ROOT, 'docs/marla/compare-textplace.html'), html);
  console.log(`${(html.length / 1024).toFixed(1)}KB · clear ${counts.clear} · veil ${counts.veil} · byhand ${counts.byhand}`);
  if (NO_POST) return;
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });

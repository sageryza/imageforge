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
// Sophie's correction: importance decides, darkness only decides the veil.
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/bottom-content.json'), 'utf8')).pages;
const bucketOf = (r) => ((content[String(r.n)] || {}).matters ? 'byhand' : r.mean < 12 ? 'clear' : 'veil');
const counts = bottoms.reduce((a, r) => { a[bucketOf(r)] = (a[bucketOf(r)] || 0) + 1; return a; }, {});

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pick = (n) => made.find((m) => m.n === n);

// A composed page is 1024x1536; the facing spread is 2048x1536.
function fig(url, tag, w = 1024, h = 1536) {
  return `<figure><span class="tag">${esc(tag)}</span>`
    + `<img src="${url}" data-full="${url}" width="${w}" height="${h}" alt="${esc(tag)}" loading="lazy"></figure>`;
}

const CARDS = [
  { item: 'clear', h: `Nothing down there — words straight on (${counts.clear || 0} pages)`,
    figs: [[pick(1), 'clear', 'page 1'], [pick(31), 'clear', 'page 31']] },
  { item: 'veil', h: `Nothing that matters, but dark — the veil (${counts.veil || 0} pages)`,
    figs: [[pick(17), 'veil', 'page 17'], [pick(29), 'veil', 'page 29']] },
  { item: 'byhand', h: `Something that matters is down there (${counts.byhand || 0} pages)`,
    figs: [[pick(35), 'facing', 'page 35'], [pick(32), 'facing', 'page 32']] },
];

const title = 'Marla v2 — where the caption goes';
const sheet = 'textplace-imp3';
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
  window.__compareHelp({ html: '<b>Your correction, applied.</b> It is not about how dark the bottom is, it is about '
    + 'whether what is down there matters. Page 17 measures nearly black — wet sand while they spread the blanket — '
    + 'and it takes the words happily. Page 35 is paler and cannot: her legs and shoes are down there.<br><br>'
    + '<b>So darkness only decides the veil.</b> Nothing important and light paper: the words go straight on. Nothing '
    + 'important but dark: a soft blur and a white veil fading in, so they stay readable. Something that matters: the '
    + 'picture is left whole and the words go on the facing page.<br><br>'
    + '<b>These are the pictures you chose</b>, not the newest ones — page 1 is the painted-over cover, page 31 is the '
    + 'version you hearted. The importance call on each page is mine and every one of them is written down; overturn '
    + 'any of them and the treatment follows.' });
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

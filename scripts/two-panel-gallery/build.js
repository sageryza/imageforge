/* Two-panel animation gallery — build + post the Compare page.
 *
 *   node scripts/two-panel-gallery/build.js            # build + POST
 *   node scripts/two-panel-gallery/build.js --dry      # write the html only
 *
 * Stills and their filed prompts are READ BACK from each chat's Assets tab
 * rather than retyped, so every prompt on the page is the text that chat
 * actually filed. Clips + posters come from media.json (see media.js).
 *
 * No <video> in the markup on purpose: the clip tile is a poster with a play
 * badge that calls window.__compareShell.openVideo(), which carries the house
 * overlay contract (autoscroll stopped, page locked, scroll position restored,
 * player torn down on close). That also keeps the page clear of the
 * "embedded <video>" kit warning.
 */
const fs = require('fs');
const path = require('path');
const { PAIRS, SINGLES, DUDS } = require('./rows');
const media = require('./media.json');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'two-panel-animation-gallery';
const SHEET = 'motion-that-worked-v1';
const TITLE = 'Where the motion worked (v1)';
const DRY = process.argv.includes('--dry');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function assets(chat) {
  const r = await fetch(`${BASE}/api/gallery/assets?chat=${encodeURIComponent(chat)}&limit=400`);
  if (!r.ok) throw new Error(`${chat} assets → ${r.status}`);
  return (await r.json()).assets || [];
}

// The ANIMATION block the Exile chat appended to its style half is the motion
// prompt — split it out so the row can show the two halves separately.
function splitFiled(style) {
  const s = String(style || '');
  const i = s.indexOf('ANIMATION (');
  if (i < 0) return { style: s.trim(), motion: null };
  const tail = s.slice(i);
  const j = tail.indexOf('verbatim:');
  return {
    style: s.slice(0, i).trim(),
    motion: j < 0 ? null : tail.slice(j + 'verbatim:'.length).trim(),
    motionMeta: tail.slice(0, j < 0 ? tail.length : j).trim(),
  };
}

function chip(text, kind) { return `<span class="chip${kind ? ' ' + kind : ''}">${esc(text)}</span>`; }

function clipTile(key, label) {
  const m = media[key];
  if (!m) throw new Error(`no media for ${key}`);
  return `<div><div class="tag">${esc(label)}</div>`
    + `<button type="button" class="clip" data-src="${esc(m.clip)}" data-poster="${esc(m.poster)}"`
    + ` aria-label="Play ${esc(label)}">`
    + `<img src="${esc(m.poster)}" alt="" class="pf">`
    + `<span class="pb"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"`
    + ` stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg></span>`
    + `</button></div>`;
}

function promptFold(r) {
  const parts = [];
  if (r.startContent) parts.push(`<b>The start panel — content</b>\n${r.startContent}`);
  if (r.content) parts.push(`<b>${r.startContent ? 'The end panel — content' : 'The drawing — content'}</b>\n${r.content}`);
  if (r.style) parts.push(`<b>The drawing — style half</b>\n${r.style}`);
  if (r.motion) parts.push(`<b>The motion prompt, sent to wan</b>\n${r.motion}`);
  else parts.push('<b>The motion prompt</b>\nNot on file. The chat that made this filed the'
    + " DRAWING's prompt but not the line it sent to wan, and its session is gone, so the exact"
    + ' text cannot be recovered. Nothing is reconstructed here on purpose — a paraphrase would'
    + ' read like the real thing and be wrong.');
  if (r.motionMeta) parts.push(`<b>Animator settings</b>\n${r.motionMeta}`);
  return `<details><summary>the prompts, verbatim</summary><div class="pr">`
    + parts.map((p) => `<p>${p.replace(/^<b>(.*?)<\/b>\n/, (_, h) => `<b>${esc(h)}</b><br>`)
      .replace(/\n/g, '<br>')}</p>`).join('') + `</div></details>`;
}

function row(r) {
  const trio = !!r.end;
  const grid = trio
    ? `<div class="trio"><div><div class="tag">start panel</div><img src="${esc(r.still)}" alt=""></div>`
      + `<div><div class="tag">end panel, drawn from it</div><img src="${esc(r.end)}" alt=""></div>`
      + clipTile(r.media, 'the clip') + `</div>`
    : `<div class="duo"><div><div class="tag">${esc(r.stillLabel || 'the drawing')}</div>`
      + `<img src="${esc(r.still)}" alt=""></div>`
      + clipTile(r.media, r.clipLabel || 'the clip') + `</div>`;
  const chips = (r.chips || []).map((c) => chip(c)).join('')
    + chip(`picture moved ${Math.round(r.move)}`, r.move >= 24 ? 'good' : r.move >= 10 ? 'info' : 'warn');
  const extra = (r.alsoPlay || []).length
    ? `<div class="also">${r.alsoPlay.map((a) => {
      const m = media[a.media];
      return `<button type="button" class="alsobtn" data-src="${esc(m.clip)}" data-poster="${esc(m.poster)}">`
        + `▶ ${esc(a.label)} · ${Math.round(a.move)}</button>`;
    }).join('')}</div>` : '';
  return `<div class="card" data-item="${esc(r.id)}">`
    + `<h3>${esc(r.title)}</h3>`
    + `<div class="chips">${chips}</div>`
    + grid
    + (r.her ? `<p class="mini">${esc(r.her)}</p>` : '')
    + extra
    + promptFold(r)
    + `</div>`;
}

(async () => {
  // Fill the single-drawing rows from the Assets tabs they were filed in.
  const cache = {};
  for (const r of [...SINGLES, ...DUDS]) {
    if (!r.assetLabel) continue;
    cache[r.chat] = cache[r.chat] || await assets(r.chat);
    const a = cache[r.chat].find((x) => (x.description || '').includes(r.assetLabel));
    if (!a) throw new Error(`no asset for "${r.assetLabel}" in ${r.chat}`);
    const sp = splitFiled(a.promptStyle);
    r.still = a.url;
    r.style = sp.style;
    r.content = a.promptContent || null;
    r.motion = r.motion === undefined ? sp.motion : r.motion;
    r.motionMeta = sp.motionMeta || null;
    r.chips = r.chips || [a.prompt || 'gpt-image-2', sp.motion ? 'wan 480p' : 'wan 480p draft'];
  }

  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .sect { margin-top: 4px; font: 600 12.5px/1 -apple-system, sans-serif; letter-spacing: .09em;
          text-transform: uppercase; color: var(--chg); margin: 26px 0 10px; }
  .trio { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 10px 0; }
  .trio img { width: 100%; height: auto; border-radius: 6px; display: block; }
  .clip { display: block; width: 100%; padding: 0; border: 0; background: none;
          position: relative; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .clip .pf { width: 100%; height: auto; border-radius: 6px; display: block; }
  .clip .pb { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
              width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--paper);
              background: rgba(20,18,15,.55); color: var(--paper);
              display: flex; align-items: center; justify-content: center; }
  .clip .pb svg { margin-left: 2px; }
  .also { margin: 8px 0 2px; }
  .alsobtn { font: inherit; font-size: 13px; color: var(--ink2); background: var(--paper);
             border: 1px solid var(--line); border-radius: 6px; padding: 5px 9px;
             margin: 0 6px 6px 0; cursor: pointer; }
  details { margin-top: 9px; }
  summary { font-size: 13.5px; color: var(--chg); cursor: pointer; }
  .pr { margin-top: 8px; }
  .pr p { font-size: 13.5px; line-height: 1.5; color: var(--ink2); margin: 0 0 10px;
          white-space: normal; }
  .pr b { color: var(--ink); font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; }
</style>
<div class="wrap">
  <h1>${esc(TITLE)}</h1>

  <div class="sect">Two panels, animated between</div>
  ${PAIRS.map(row).join('\n')}

  <div class="sect">One drawing, and a written action</div>
  ${SINGLES.map(row).join('\n')}

  <div class="sect">Where it died</div>
  ${DUDS.map(row).join('\n')}

  <div class="card">
    <h3>What the winners have in common</h3>
    <p class="mini">A pair earns its second drawing when the end is a different picture — a body
    somewhere it wasn't, a scene that has become something else. A single drawing moves when its
    prompt names an <b>event with an actor</b>; a prompt describing a texture or a mood
    ("shifts and breathes", "light moves across them") returns a still with a wobble. And the
    motion prompt is the one thing worth filing next to the image — most of the winners here
    can't tell you what they were told to do.</p>
  </div>
</div>
<script src="/compare.js"></script>
<script>
(function () {
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.clip, .alsobtn');
    if (!b) return;
    var open = window.__compareShell && window.__compareShell.openVideo;
    if (open) open(b.getAttribute('data-src'), b.getAttribute('data-poster'));
  });
  window.__compareHelp({ html:
    '<b>The idea.</b> One page, two panels, same scene and camera — panel 1 is the ' +
    "animation's first frame, panel 2 its last. The page is sliced down the gutter and wan " +
    'gets both halves, so the clip has to travel between them instead of drifting. It earns ' +
    'the second drawing only when panel 2 is a genuinely different picture; where a single ' +
    'drawing plus a written action would do, that is cheaper and looks better. Both are ' +
    'below, measured on one scale.' +
    '<br><br><b>Reading it.</b> Tap a drawing to see it big, tap a clip to play it. ' +
    '<b>"picture moved"</b> is measured, not remembered: every clip decoded the same way and ' +
    'scored on how different its last frame is from its first. Same scale for all four ' +
    'projects, so the numbers compare. <b>The + under each row</b> is a note.' });
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
})();
</script>
`;

  const out = path.join(__dirname, 'page.html');
  fs.writeFileSync(out, html);
  console.log(`page → ${out} (${(html.length / 1024).toFixed(0)}kb)`);
  if (DRY) return;

  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html }),
  });
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(`POST /page → ${r.status} ${JSON.stringify(d).slice(0, 300)}`);
  console.log('posted →', d.url || d.id);
  if (d.warnings && d.warnings.length) {
    console.log('\nKIT WARNINGS:');
    d.warnings.forEach((w) => console.log(' -', w));
  } else {
    console.log('no kit warnings');
  }
})().catch((e) => { console.error(e); process.exit(1); });

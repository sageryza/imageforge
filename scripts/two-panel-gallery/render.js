/* Two-panel animation gallery — the shared row renderer.
 *
 * Both pages in this folder are the same shape: a card per clip, the drawing
 * beside the clip, the measured motion on a chip, and the verbatim prompts in
 * a fold. Extracted here when the second page was built so the two can't drift.
 *
 * No <video> in the markup on purpose: the clip tile is a poster with a play
 * badge that calls window.__compareShell.openVideo(), which carries the house
 * overlay contract (autoscroll stopped, page locked, scroll position restored,
 * player torn down on close) — and keeps the page clear of the kit warning.
 *
 * NOTHING TO READ BETWEEN THE TITLE AND THE FIRST PICTURE: every page here
 * puts its explanation in window.__compareHelp, never in a card at the top.
 */
const media = require('./media.json');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const chip = (text, kind) => `<span class="chip${kind ? ' ' + kind : ''}">${esc(text)}</span>`;

// The ANIMATION block the Exile chat appended to its filed style half IS the
// motion prompt — split it out so a row can show the two halves separately.
function splitFiled(style) {
  const s = String(style || '');
  const i = s.indexOf('ANIMATION (');
  if (i < 0) return { style: s.trim(), motion: null, motionMeta: null };
  const tail = s.slice(i);
  const j = tail.indexOf('verbatim:');
  return {
    style: s.slice(0, i).trim(),
    motion: j < 0 ? null : tail.slice(j + 'verbatim:'.length).trim(),
    motionMeta: tail.slice(0, j < 0 ? tail.length : j).trim(),
  };
}

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

const NO_MOTION = '<b>The motion prompt</b>\nNot on file. The chat that made this filed the'
  + " DRAWING's prompt but not the line it sent to wan, and its session is gone, so the exact"
  + ' text cannot be recovered. Nothing is reconstructed here on purpose — a paraphrase would'
  + ' read like the real thing and be wrong.';

function promptFold(r) {
  const parts = [];
  if (r.startContent) parts.push(`<b>The start panel — content</b>\n${r.startContent}`);
  if (r.content) parts.push(`<b>${r.startContent ? 'The end panel — content' : 'The drawing — content'}</b>\n${r.content}`);
  if (r.style) parts.push(`<b>The drawing — style half</b>\n${r.style}`);
  if (r.motion) parts.push(`<b>The motion prompt, sent verbatim</b>\n${r.motion}`);
  else parts.push(NO_MOTION);
  if (r.motionMeta) parts.push(`<b>Animator settings</b>\n${r.motionMeta}`);
  return '<details><summary>the prompts, verbatim</summary><div class="pr">'
    + parts.map((p) => `<p>${p.replace(/^<b>(.*?)<\/b>\n/, (_, h) => `<b>${esc(h)}</b><br>`)
      .replace(/\n/g, '<br>')}</p>`).join('') + '</div></details>';
}

// `move` is the measured first-frame-to-last-frame pixel change (motion.py).
// It is NOT the whole judgement — a clip whose STYLE collapses scores high for
// the wrong reason, and a clip whose action returns to rest scores low despite
// reading well. `verdict` overrides the colour where that is the case.
function row(r) {
  const grid = r.end
    ? `<div class="trio"><div><div class="tag">start panel</div><img src="${esc(r.still)}" alt=""></div>`
      + `<div><div class="tag">end panel, drawn from it</div><img src="${esc(r.end)}" alt=""></div>`
      + clipTile(r.media, 'the clip') + '</div>'
    : `<div class="duo"><div><div class="tag">${esc(r.stillLabel || 'the drawing')}</div>`
      + `<img src="${esc(r.still)}" alt=""></div>`
      + clipTile(r.media, r.clipLabel || 'the clip') + '</div>';
  const kind = r.verdict || (r.move >= 24 ? 'good' : r.move >= 10 ? 'info' : 'warn');
  const chips = (r.chips || []).map((c) => chip(c)).join('')
    + chip(`picture moved ${Math.round(r.move)}`, kind);
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
    + '</div>';
}

const CSS = `  .sect { font: 600 12.5px/1 -apple-system, sans-serif; letter-spacing: .09em;
          text-transform: uppercase; color: var(--chg); margin: 26px 0 10px; }
  .sect:first-of-type { margin-top: 4px; }
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
  .pr p { font-size: 13.5px; line-height: 1.5; color: var(--ink2); margin: 0 0 10px; }
  .pr b { color: var(--ink); font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; }`;

const SCRIPT = `(function () {
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.clip, .alsobtn');
    if (!b) return;
    var open = window.__compareShell && window.__compareShell.openVideo;
    if (open) open(b.getAttribute('data-src'), b.getAttribute('data-poster'));
  });
})();`;

function page({ title, help, chat, sheet, body }) {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
${CSS}
</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
${body}
</div>
<script src="/compare.js"></script>
<script>
${SCRIPT}
(function () {
  window.__compareHelp({ html: ${JSON.stringify(help)} });
  window.__compareNotes({ chat: ${JSON.stringify(chat)}, sheet: ${JSON.stringify(sheet)} });
})();
</script>
`;
}

async function post({ base, chat, title, html }) {
  const r = await fetch(`${base}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat, title, html }),
  });
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(`POST /page → ${r.status} ${JSON.stringify(d).slice(0, 300)}`);
  return d;
}

module.exports = { esc, chip, clipTile, promptFold, row, splitFiled, page, post, media };

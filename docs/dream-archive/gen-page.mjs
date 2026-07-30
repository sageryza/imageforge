// Render archive.json as the dream archive page (posted to the Chats app's
// Compare tab, which is where Sophie reads things on her phone).
//
// One dream per card, newest last, in one chronological run. Each card shows
// only the tabs it actually has — a dream with just a transcript shows no
// Drawing tab and no Listen tab, rather than empty ones.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const a = JSON.parse(fs.readFileSync(path.join(HERE, 'archive.json'), 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mmss = (n) => n ? `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}` : '';

const SOURCE_LABEL = {
  'voice memo': 'recorded',
  'dream pipeline': 'illustrated',
  'imported comic': 'old comic',
  'witch app': 'illustrated',
  journal: 'handwritten',
};

function card(d, i) {
  const tabs = [];
  if (d.illustrations.length) tabs.push(['art', 'Drawing' + (d.illustrations.length > 1 ? ` (${d.illustrations.length})` : '')]);
  if (d.text && d.text.trim()) tabs.push(['text', 'Words']);
  if (d.audio) tabs.push(['audio', 'Listen' + (d.audioSeconds ? ' ' + mmss(d.audioSeconds) : '')]);
  const first = tabs.length ? tabs[0][0] : null;

  const panes = [];
  if (d.illustrations.length) {
    panes.push(`<div class="pane${first === 'art' ? ' on' : ''}" data-p="art">${
      d.illustrations.map((u, k) => `<img loading="lazy" src="${esc(u)}" alt="drawing ${k + 1}">`).join('')
    }</div>`);
  }
  if (d.text && d.text.trim()) {
    const full = d.text.trim();
    // Show an opening paragraph; the rest opens on demand. Truncate on a
    // sentence end near the limit so the preview doesn't stop mid-word.
    const LIMIT = 320;
    let head = full;
    if (full.length > LIMIT + 80) {
      const win = full.slice(0, LIMIT + 80);
      const stop = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
      head = (stop > LIMIT / 2 ? win.slice(0, stop + 1) : full.slice(0, LIMIT)).trim();
    }
    const truncated = head.length < full.length;
    panes.push(`<div class="pane${first === 'text' ? ' on' : ''}" data-p="text">`
      + `<div class="words"${truncated ? ' data-full="1"' : ''}>`
      + `<div class="head">${esc(head)}${truncated ? '…' : ''}</div>`
      + (truncated ? `<div class="rest">${esc(full)}</div><button class="more">Read the whole dream</button>` : '')
      + `</div></div>`);
  }
  if (d.audio) {
    panes.push(`<div class="pane${first === 'audio' ? ' on' : ''}" data-p="audio">
      <audio controls preload="none" src="${esc(BASE + d.audio)}"></audio>
      <p class="anote">${esc(d.audioNote || 'Your own voice, the morning you recorded it.')}</p></div>`);
  }

  // Superseded attempts are kept rather than deleted, so their drawings have to
  // be reachable too — otherwise "nothing is lost" isn't true on the page.
  const oldArt = (d.versions || []).flatMap((v) => v.illustrations || []);
  const fresh = new Set(d.illustrations);
  const extraArt = [...new Set(oldArt.filter((u) => !fresh.has(u)))];
  if (extraArt.length) {
    panes.push(`<div class="pane" data-p="old"><p class="anote">Earlier drawings of this dream, kept as history.</p>${
      extraArt.map((u) => `<img loading="lazy" src="${esc(u)}" alt="earlier drawing">`).join('')
    }</div>`);
    tabs.push(['old', `Earlier art (${extraArt.length})`]);
  }

  const flags = [];
  if (d.dateUncertain) flags.push(`<span class="q" title="${esc(d.dateNote || "nobody remembers when this one was")}">?</span>`);
  if (d.incomplete) flags.push('<span class="inc">you noted part of this was missing</span>');
  if (d.versions.length) flags.push(`<span class="vers">${d.versions.length} earlier version${d.versions.length > 1 ? 's' : ''} kept</span>`);

  return `<article id="d${i}">
    <header>
      <div class="when">${esc(d.display)}${flags.length ? ' ' + flags.join(' ') : ''}</div>
      ${d.title ? `<h2>${esc(d.title)}</h2>` : ''}
      <div class="src">${esc(SOURCE_LABEL[d.source] || d.source)}${d.page ? ` · journal p${d.page}` : ''}</div>
      ${d.unsplit ? `<p class="note">This recording was never split into separate dreams, so the words below are the whole thing — several dreams in a row.${
        d.alsoTitled && d.alsoTitled.length ? ` The others in it were called: ${esc(d.alsoTitled.join(', '))}.` : ''}</p>` : ''}
    </header>
    ${tabs.length > 1 ? `<nav class="tabs">${tabs.map(([k, l], n) => `<button data-t="${k}"${n === 0 ? ' class="on"' : ''}>${esc(l)}</button>`).join('')}</nav>` : ''}
    ${panes.join('')}
  </article>`;
}

const years = {};
a.dreams.forEach((d) => { const y = d.sort.slice(0, 4); years[y] = (years[y] || 0) + 1; });

const html = `<style>
*{box-sizing:border-box}
body{margin:0;padding:0 0 70px;background:#f7f4ee;color:#2a2622;
  font:17px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
.top{padding:20px 16px 14px;border-bottom:1px solid #ddd4c6}
h1{font-size:23px;margin:0 0 6px}
.lede{font-size:15px;color:#5d564e;margin:0 0 12px}
.counts{font-size:13px;color:#6b6459;display:flex;flex-wrap:wrap;gap:4px 14px}
.counts b{color:#2a2622}
article{padding:20px 16px;border-bottom:1px solid #e6dfd3}
header{margin:0 0 12px}
.when{font-size:13px;color:#8a8074;letter-spacing:.03em;text-transform:uppercase}
h2{font-size:19px;margin:4px 0 3px}
.src{font-size:12px;color:#a09484;text-transform:uppercase;letter-spacing:.06em}
.note{font-size:13px;color:#8a5a3c;background:#faf1e9;border:1px solid #eadbc8;
  border-radius:6px;padding:8px 10px;margin:9px 0 0}
.q{display:inline-block;width:16px;height:16px;line-height:16px;text-align:center;
  border-radius:6px;background:#c2532f;color:#fff;font-size:11px;font-weight:700;
  font-style:normal;vertical-align:1px;cursor:help}
.inc,.vers{display:inline-block;font-size:11px;text-transform:none;letter-spacing:0;
  color:#8a8074;border:1px solid #ddd4c6;border-radius:6px;padding:0 6px;margin-left:4px}
.tabs{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap}
.tabs button{font:inherit;font-size:14px;padding:5px 12px;border-radius:6px;
  border:1px solid #ddd4c6;background:#fff;color:#5d564e;cursor:pointer}
.tabs button.on{background:#2a2622;border-color:#2a2622;color:#f7f4ee}
.pane{display:none}
.pane.on{display:block}
/* Drawings sit two to a row and open bigger on tap. A lone drawing still
   fills only half the width, so a row never changes shape. */
/* Must be scoped to .on — an unscoped .pane[data-p=...] outranks
   .pane{display:none} and leaves the drawings showing under every tab. */
.pane.on[data-p="art"],.pane.on[data-p="old"]{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}
.pane[data-p="old"] .anote,.pane[data-p="audio"] .anote{grid-column:1/-1}
.pane img{display:block;width:100%;border-radius:6px;background:#efe9df;cursor:zoom-in}
.pane.on[data-p="audio"]{display:block}
.words{white-space:pre-wrap;color:#3d3833;max-width:640px}
.words .rest{display:none;white-space:pre-wrap}
.words.open .head{display:none}
.words.open .rest{display:block}
.more{font:inherit;font-size:14px;margin-top:10px;padding:5px 12px;border-radius:6px;
  border:1px solid #ddd4c6;background:#fff;color:#5d564e;cursor:pointer;display:inline-block}
.more:hover{background:#efe9df}
/* Closing has to be possible halfway through, so this rides at the bottom of
   the screen the whole time a dream is open — never only at the end of the text. */
#shut{position:fixed;left:14px;bottom:16px;z-index:60;display:none;font:inherit;font-size:15px;
  padding:9px 16px;border-radius:6px;border:1px solid #2a2622;background:#2a2622;color:#f7f4ee;cursor:pointer}
#shut.on{display:block}
audio{width:100%;max-width:520px;display:block}
.anote{font-size:13px;color:#8a8074;margin:8px 0 0}
.undated{padding:24px 16px 8px}
.undated h2{font-size:16px;text-transform:uppercase;letter-spacing:.06em;color:#8a8074;
  border-bottom:1px solid #ddd4c6;padding-bottom:8px}
.undated p{font-size:14px;color:#5d564e}
</style>
<div class="top">
  <h1>Every dream, in order</h1>
  <p class="lede">${a.total} dreams pulled together from your voice memos, your journals, the Deck Factory and the witch app.</p>
  <div class="counts">
    <span><b>${a.dreams.filter(d => d.audio).length}</b> you can listen to</span>
    <span><b>${a.dreams.filter(d => d.illustrations.length).length + a.undated.filter(d => d.illustrations.length).length}</b> illustrated</span>
    <span><b>${a.total}</b> with words</span>
    <span>${Object.entries(years).map(([y, n]) => `${y}: ${n}`).join(' · ')}</span>
  </div>
</div>
${a.dreams.slice().reverse().map(card).join('')}
${a.undated.length ? `<div class="undated"><h2>Date unknown — ${a.undated.length} old comics</h2>
  <p>These came in as an already-illustrated batch with no real dates on them, so rather than put them somewhere wrong they sit here until you can place them.</p></div>
  ${a.undated.map((d, i) => card(d, 9000 + i)).join('')}` : ''}
<button id="shut">Close dream</button>
<script>
// One dream open at a time, so the floating Close is never ambiguous.
let openWords = null;
const shut = document.getElementById('shut');
function closeOpen(scroll) {
  if (!openWords) return;
  const art = openWords.closest('article');
  openWords.classList.remove('open');
  const btn = openWords.querySelector('.more');
  if (btn) btn.textContent = 'Read the whole dream';
  openWords = null;
  shut.classList.remove('on');
  // Come back to the dream you were reading, not wherever the collapse left you.
  if (scroll && art) art.scrollIntoView({ block: 'start' });
}
shut.addEventListener('click', () => closeOpen(true));
document.addEventListener('click', (e) => {
  const more = e.target.closest('.more');
  if (more) {
    const words = more.closest('.words');
    if (words === openWords) { closeOpen(true); return; }
    closeOpen(false);
    words.classList.add('open');
    more.textContent = 'Close';
    openWords = words;
    shut.classList.add('on');
    return;
  }
  const b = e.target.closest('.tabs button');
  if (!b) return;
  const art = b.closest('article');
  art.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  art.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.p === b.dataset.t));
});
// House rule: opening an image freezes the page behind it.
// body{overflow:hidden} alone does NOT hold on iOS Safari — the page keeps
// scrolling behind the picture. Pinning the body with position:fixed at its
// current offset does, and it also stops the autoscroll pill moving the page
// while you're looking at something.
let lockedAt = 0;
function lockScroll() {
  lockedAt = window.scrollY || window.pageYOffset || 0;
  const b = document.body;
  b.style.position = 'fixed';
  b.style.top = (-lockedAt) + 'px';
  b.style.left = '0';
  b.style.right = '0';
  b.style.width = '100%';
}
function unlockScroll() {
  const b = document.body;
  b.style.position = '';
  b.style.top = '';
  b.style.left = '';
  b.style.right = '';
  b.style.width = '';
  window.scrollTo(0, lockedAt);
}
document.addEventListener('click', (e) => {
  const img = e.target.closest('.pane img');
  if (!img) return;
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:#141210;z-index:99;display:flex;'
    + 'align-items:center;justify-content:center;padding:16px;touch-action:none';
  const big = document.createElement('img');
  big.src = img.src;
  big.style.cssText = 'max-width:100%;max-height:100%;border-radius:6px';
  o.appendChild(big);
  lockScroll();
  const close = () => { o.remove(); unlockScroll(); document.removeEventListener('keydown', onKey); };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  o.addEventListener('click', close);
  // Belt and braces on iOS: swallow the scroll gesture over the overlay too.
  o.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(o);
});
</script>`;

const out = path.join(HERE, 'archive.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
console.log('dated:', a.dreams.length, '| undated:', a.undated.length);

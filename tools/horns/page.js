// Build the Compare page for the Horns of the Goddess magic passages and post
// it into the chat's Compare tab. Starts from public/compare-shell.html: the
// house look and behaviour come from /compare.css + /compare.js, and the
// autoscroll pill is injected by the server — nothing here re-implements them.
const fs = require('fs');
const D = process.env.HORNS_DIR || '/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'horns-goddess-magic-passages';
const SHEET = 'horns-magic-v2';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
// a position in a 7-hour audiobook needs the hour; a length never does
const hms = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.round(s) % 60).padStart(2, '0')}`;

const passages = JSON.parse(fs.readFileSync(D + '/passages.json'));
const clips = JSON.parse(fs.readFileSync(D + '/clips/clips.json'));
const flagged = JSON.parse(fs.readFileSync(__dirname + '/flagged.json'));
const urlFor = slug => clips.find(c => c.slug === slug).url;

const MAIN = {
  'unicorn-rainbow': ['The unicorn over the rainbow', 'Part 1 · Chapter 9, Signs and Symbols',
    'Estelle, under an oak in the grove, gives the method she uses to calm her mind.'],
  'cease-to-function': ['She ceases to function', 'Part 1 · Chapter 1, the druidess',
    'Aranaia is locked in a hut by strangers who faked a call for healing — and Karen starts doing it for real on the couch.'],
  'ceremonies-grove': ['The ceremonies in the grove', 'Part 1 · Chapter 5, the old religion',
    'The whole working: the circle, the joined hands, travelling together, and healing the woman with the bad back.'],
};
const ORDER = ['unicorn-rainbow', 'cease-to-function', 'ceremonies-grove'];

const mainCards = ORDER.map(slug => {
  const p = passages.find(x => x.slug === slug);
  const [title, where, gist] = MAIN[slug];
  return `  <div class="card" data-item="${slug}">
    <h3>${esc(title)}</h3>
    <div class="chips"><span class="chip">${esc(where)}</span><span class="chip">${hms(p.t0)}</span><span class="chip">${mmss(p.t1 - p.t0)} long</span></div>
    <p class="mini">${esc(gist)}</p>
    <audio controls preload="none" src="${urlFor(slug)}"></audio>
    <details class="passage"><summary>Read it</summary>
      ${p.paras.map(t => `<p>${esc(t)}</p>`).join('\n      ')}
    </details>
  </div>`;
}).join('\n');

const flagCards = (rows, part) => rows.map((r, i) => {
  const [title, t0, t1, s0, s1, gist, quote] = r;
  return `  <div class="card" data-item="${part}-${i}">
    <h3>${esc(title)}</h3>
    <div class="chips"><span class="chip">${esc(t0)} – ${esc(t1)}</span><span class="chip">${mmss(s1 - s0)}</span></div>
    <p class="mini">${esc(gist)}</p>
    <blockquote>${esc(quote)}</blockquote>
  </div>`;
}).join('\n');

const REEL = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/horns-passages/reel-v1.mp3';
const beats = JSON.parse(fs.readFileSync(__dirname + '/reel-beats.json'));
const beatRows = beats.map(b => `      <li><b>${esc(b.label)}</b> — Part ${b.part}, ${hms(b.t0)} · ${Math.round(b.t1 - b.t0)}s</li>`).join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Horns of the Goddess — the reel and the magic passages</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .passage { margin-top: 10px; }
  .passage p { margin-bottom: 11px; }
  .passage > summary { cursor: pointer; font: 600 12px/1 -apple-system, 'Helvetica Neue', sans-serif;
                       letter-spacing: .12em; text-transform: uppercase; color: var(--gold);
                       padding: 7px 0; list-style: none; }
  .passage > summary::-webkit-details-marker { display: none; }
  .passage > summary::after { content: ' +'; }
  .passage[open] > summary::after { content: ' \\2212'; }
  .passage[open] > summary { margin-bottom: 4px; }
  .jump {
    position: fixed; z-index: 8;
    left: max(14px, 4vw); bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 8px;
  }
  .jump button {
    width: 40px; height: 40px; padding: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .jump button:active { border-color: var(--gold); color: var(--gold); }
  .jump svg { width: 20px; height: 20px; fill: none; stroke: currentColor;
              stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  audio { width: 100%; margin: 8px 0 2px; }
  blockquote { margin-top: 8px; padding-left: 11px; border-left: 2px solid var(--line);
               color: var(--ink2); font-style: italic; font-size: 15px; }
</style>

<div class="wrap">
  <h1>Horns of the Goddess — the reel and the magic passages</h1>

  <h2>The reel</h2>
  <div class="card" data-item="reel-v1">
    <h3>Everybody's a witch — v1</h3>
    <div class="chips"><span class="chip">5:18</span><span class="chip">9 beats</span><span class="chip">both parts</span></div>
    <audio controls preload="none" src="${REEL}"></audio>
    <details class="passage"><summary>The running order</summary>
      <ul>
${beatRows}
      </ul>
    </details>
  </div>

  <h2>The three you asked for</h2>
${mainCards}

  <h2>Also worth taking — Part 1</h2>
${flagCards(flagged.part1, 'p1')}

  <h2>Also worth taking — Part 2</h2>
${flagCards(flagged.part2, 'p2')}
</div>

<nav class="jump">
  <button type="button" id="jtop" aria-label="All the way to the top">
    <svg viewBox="0 0 24 24"><path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/></svg>
  </button>
  <button type="button" id="jbot" aria-label="All the way to the bottom">
    <svg viewBox="0 0 24 24"><path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/></svg>
  </button>
</nav>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });

  // ── keep her place ────────────────────────────────────────────────
  // Keyed on THIS page's own path, so a new version of the page starts
  // clean instead of inheriting an offset that now points somewhere else.
  // The open/closed state of the folds is saved WITH the offset and applied
  // FIRST on the way back: restoring a scroll position against a different
  // set of folds lands somewhere she never was.
  var KEY = 'horns-place:' + location.pathname;
  var folds = function () { return [].slice.call(document.querySelectorAll('details.passage')); };

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        y: Math.round(window.scrollY),
        open: folds().map(function (d) { return d.open ? 1 : 0 }),
      }));
    } catch (e) {}
  }

  function restore() {
    var raw; try { raw = localStorage.getItem(KEY) } catch (e) { return }
    if (!raw) return;
    var st; try { st = JSON.parse(raw) } catch (e) { return }
    if (!st || !st.y) return;
    if (Array.isArray(st.open)) folds().forEach(function (d, i) { d.open = !!st.open[i] });
    // Twice on purpose: once now, once after the webfont has settled, since
    // a serif page reflows under a restored offset and drifts.
    window.scrollTo(0, st.y);
    requestAnimationFrame(function () { window.scrollTo(0, st.y) });
    window.addEventListener('load', function () { window.scrollTo(0, st.y) }, { once: true });
  }

  var t = 0;
  window.addEventListener('scroll', function () {
    clearTimeout(t); t = setTimeout(save, 200);
  }, { passive: true });
  document.addEventListener('toggle', function (e) {
    if (e.target.matches && e.target.matches('details.passage')) save();
  }, true);
  // iOS often never fires unload, and a backgrounded tab can be discarded.
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save() });

  restore();

  // ── all the way up / all the way down ─────────────────────────────
  // These are <button>, which is already on the pill's shared skip list, so a
  // tap can never START the autoscroll. Stopping a running one is deliberate:
  // being thrown to the bottom while it scrolls is disorienting.
  function jump(y) {
    if (window.__scrollStop) window.__scrollStop();
    window.scrollTo(0, y);
    save();
  }
  document.getElementById('jtop').addEventListener('click', function () { jump(0) });
  document.getElementById('jbot').addEventListener('click', function () {
    jump(document.documentElement.scrollHeight);
  });
  window.__compareHelp({ html: '<b>The three at the top are cut.</b> Each one plays its own '
    + 'audio, and the full text opens on a tap. Everything under them is flagged but not cut '
    + 'yet — leave a note on any of them and I will cut it the same way. The page remembers where you were, and the arrows go all the way up or all the way down.' });
})();
</script>`;

fs.writeFileSync(D + '/page.html', html);
console.log('page', (html.length / 1024).toFixed(0) + 'KB');

if (process.argv.includes('--post')) {
  fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: 'Horns of the Goddess — the reel and the magic passages', html }),
  }).then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2)));
}

const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('/tmp/takes/rows.json', 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// group by LINE, in reel order (rows.json is already in spec order)
const parts = [];
for (const r of rows) {
  const key = r.shot + '|' + r.text;
  let p = parts.find((x) => x.key === key);
  if (!p) { p = { key, shot: r.shot, text: r.text, takes: [] }; parts.push(p); }
  p.takes.push(r);
}

const PLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

const body = parts.map((p) => {
  const multi = p.takes.length > 1;
  const takes = p.takes.map((t, i) => `
      <div class="take${t.used ? ' inreel' : ''}" data-item="${esc(t.id)}" data-url="${esc(t.url)}">
        <button class="pl" aria-label="Play take ${i + 1}">${PLAY}</button>
        <span class="tk">Take ${i + 1}</span>
        <span class="meta">${mmss(t.t0)}${t.src === 'vo2' ? ' · 2nd recording' : ''} · ${t.len}s</span>
        ${t.used ? '<span class="badge">in the reel</span>' : ''}
      </div>`).join('');
  // COLLAPSIBLE, her word — <details>/<summary>, which is also the one
  // collapsible the pill's shared skip list already exempts, so opening a
  // section can never start the autoscroll.
  return `
  <details class="card">
    <summary>
      <span class="ln">${esc(p.text)}</span>
      <span class="cnt">${p.takes.length}</span>
    </summary>
    ${takes}
  </details>`;
}).join('');

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Water reel — every take, line by line</title>
<link rel="stylesheet" href="/compare.css">
<style>
  details.card{padding:0}
  /* THE CHEVRON SITS ON THE LEFT. The pill owns the top-right corner of the
     VIEWPORT and every row here scrolls through it, so an affordance parked at
     a row's right end reads as untappable exactly when she reaches for it —
     measured: the pill covered the summary's right end outright. On the left
     it is never under anything, and the whole summary stays the tap target. */
  summary{display:flex;align-items:flex-start;gap:9px;padding:12px 14px;cursor:pointer;list-style:none}
  summary::-webkit-details-marker{display:none}
  summary::before{content:'';flex:none;width:8px;height:8px;margin:5px 2px 0 2px;
    border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;
    transform:rotate(-45deg);opacity:.5;transition:transform .15s}
  details[open] summary::before{transform:rotate(45deg)}
  .ln{font:15px/1.35 var(--serif,Georgia,serif)}
  .cnt{flex:none;font:11px/1 var(--sans,system-ui);opacity:.55;margin-top:4px;margin-left:auto}
  /* THE BOX SHORTENS RATHER THAN PADDING: compare.js hangs the note + at
     right:7px of the item, which is its PADDING box, so a padding reserve
     would not move it a pixel. */
  details > .take{margin:0 56px 0 14px}
  details > .take:last-of-type{margin-bottom:12px}
  .take{display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line,#0001);position:relative}
  .take:first-of-type{border-top:0}
  .pl{flex:none;width:34px;height:34px;border-radius:6px;border:1px solid var(--ink,#26221c);
      background:var(--paper,#f6f2e9);color:var(--ink,#26221c);display:flex;align-items:center;
      justify-content:center;padding:0;cursor:pointer}
  .pl svg{width:16px;height:16px}
  .tk{font:13px/1 var(--sans,system-ui);font-weight:600}
  .meta{font:12px/1 var(--sans,system-ui);opacity:.6}
  .badge{font:10px/1 var(--sans,system-ui);letter-spacing:.06em;text-transform:uppercase;
         border:1px solid var(--ink,#26221c);border-radius:6px;padding:3px 5px}
  .take.inreel .tk{text-decoration:underline;text-underline-offset:3px}
  .bar{position:absolute;left:0;bottom:0;height:2px;width:0;background:var(--ink,#26221c);opacity:.35}
</style>

<div class="wrap">
  <h1>Water reel — every take, line by line</h1>
  ${body}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var au = null, cur = null, raf2 = 0;
  var PLAY = ${JSON.stringify(PLAY)}, PAUSE = ${JSON.stringify(PAUSE)};
  function stop() {
    if (au) { au.pause(); au.src = ''; au = null; }
    if (cur) { cur.querySelector('.pl').innerHTML = PLAY; var b = cur.querySelector('.bar'); if (b) b.remove(); cur = null; }
    cancelAnimationFrame(raf2);
  }
  document.querySelectorAll('.take').forEach(function (row) {
    row.querySelector('.pl').addEventListener('click', function () {
      var wasMe = cur === row;
      stop();
      if (wasMe) return;
      cur = row;
      row.querySelector('.pl').innerHTML = PAUSE;
      var bar = document.createElement('div'); bar.className = 'bar'; row.appendChild(bar);
      au = new Audio(row.getAttribute('data-url'));
      au.play().catch(function () { stop(); });
      au.addEventListener('ended', stop);
      (function tick() {
        if (!au) return;
        if (au.duration) bar.style.width = (100 * au.currentTime / au.duration) + '%';
        raf2 = requestAnimationFrame(tick);
      })();
    });
  });
  // playing stops when she leaves the page or the app goes to the background
  ['pagehide', 'freeze'].forEach(function (e) { window.addEventListener(e, stop); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });

  window.__compareNotes({ chat: 'water-video-notes-check', sheet: 'water-takes-v1' });
  window.__compareHelp({ html: '<b>Every take you recorded, under the line it belongs to.</b> '
    + 'The one marked <i>in the reel</i> is the take the current cut uses. '
    + 'Tap + on a take to tell me to switch to it.' });
})();
</script>`;
fs.writeFileSync('/tmp/takes/page.html', html);
console.log('parts', parts.length, 'takes', rows.length, 'bytes', html.length);

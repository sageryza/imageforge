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

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html: '<b>The three at the top are cut.</b> Each one plays its own '
    + 'audio, and the full text opens on a tap. Everything under them is flagged but not cut '
    + 'yet — leave a note on any of them and I will cut it the same way.' });
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

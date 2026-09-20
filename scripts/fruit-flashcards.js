// fruit-flashcards.js — a MOCKUP of the fruit deck as flash cards (2026-09-20,
// Sophie: "can u show me what it would look like if the fruits became fruit
// flash cards"). Nothing drawn: the cards are the pictures she has already
// picked (the Finished page), laid out as cards — picture on the front, tap
// to flip to the name on the back. A Compare page from compare-shell.html.
//
//   node scripts/fruit-flashcards.js [--chat fruits-vegetables-inventory]
//                                    [--from <finishedPageId>] [--dry] [--supersede <pageId>]

const fs = require('fs');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CHAT = flag('chat', 'fruits-vegetables-inventory');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const FROM = flag('from', '7wb6CDFTjMbeYwvsRLJQ');
const SUPERSEDE = flag('supersede');
const DRY = args.includes('--dry');
// --front: v2 — the name on the FRONT, bottom, lowercase, no flip (2026-09-20,
// Sophie: "try a version w name on front bottom lowercase").
const FRONT = args.includes('--front') || args.includes('--v3');
// --v3: the name in a lighter serif (Cormorant Garamond), smaller, lifted a
// little off the bottom, more letter-spacing and more air between the cards
// (2026-09-20, Sophie: "more elegant font · smaller · a little higher · more
// spacing").
const V3 = args.includes('--v3');
// --fonts: ONE compare page of the name in several fonts, lowercase and caps
// side by side, two sample cards each, a ♥/✕ per option (2026-09-20, Sophie:
// "now try caps · and a couple other fonts in lower and caps · u can put in
// compare tab").
const FONTS = args.includes('--fonts');
const FONT_SET = [
  ['cormorant', 'Cormorant Garamond', 'Cormorant+Garamond:wght@500', 500],
  ['ebgaramond', 'EB Garamond', 'EB+Garamond:wght@400;500', 400],
  ['playfair', 'Playfair Display', 'Playfair+Display:wght@400', 400],
  ['marcellus', 'Marcellus', 'Marcellus', 400],
];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async () => {
  // the picked picture per fruit, read off the Finished page's own data
  const html = await (await fetch(`${BASE}/api/chatfeed/page/${FROM}`)).text();
  const m = html.match(/window\.__pageData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) || html.match(/__pageData\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('no __pageData on the Finished page');
  const groups = JSON.parse(m[1]).groups || [];
  const cards = groups.map(g => ({ name: g.label, img: g.items[0].img })).filter(c => c.img);

  const cardFront = c => `<div class="fc fc2"><span class="face front">
      <img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy" decoding="async"><span class="nm2">${esc(c.name.toLowerCase())}</span></span></div>`;
  const cardFlip = c => `<button class="fc" type="button" data-nostop aria-label="${esc(c.name)}">
    <span class="fc-in">
      <span class="face front"><img src="${esc(c.img)}" alt="" loading="lazy" decoding="async"><span class="tag">?</span></span>
      <span class="face back"><span class="nm">${esc(c.name)}</span></span>
    </span></button>`;

  const card = FRONT ? cardFront : cardFlip;
  const V = V3 ? 'v3 — lighter name' : FRONT ? 'v2 — name on the front' : 'mockup';
  const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fruit flash cards — ${V}</title>
<link rel="stylesheet" href="/compare.css">
${V3 ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap">' : ''}
<style>
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:6px}
  .fc{all:unset;display:block;cursor:pointer;-webkit-tap-highlight-color:transparent;perspective:900px;aspect-ratio:3/4}
  .fc-in{position:relative;display:block;width:100%;height:100%;transition:transform .45s;transform-style:preserve-3d}
  .fc.flip .fc-in{transform:rotateY(180deg)}
  .face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    background:#fff;border:1px solid #e0d6c4;border-radius:10px;box-shadow:0 1px 3px rgba(38,34,28,.12);
    backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
  .front img{width:84%;height:84%;object-fit:contain;display:block}
  .front .tag{position:absolute;right:10px;bottom:8px;font-size:13px;color:var(--ink2);font-family:inherit}
  .back{transform:rotateY(180deg);background:#fff}
  .back .nm{font-family:'Newsreader',Georgia,serif;font-size:24px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink);text-align:center;padding:0 10px;line-height:1.2}
  .fc:focus-visible .face{outline:2px solid var(--chg)}
  .fc2 .front{flex-direction:column;justify-content:flex-start;padding:10px 8px 12px;box-sizing:border-box}
  .fc2 .front img{width:86%;height:auto;flex:1;min-height:0;object-fit:contain}
  .fc2 .nm2{font-family:'Newsreader',Georgia,serif;font-size:19px;color:var(--ink);text-align:center;line-height:1.2;padding-top:8px}
  .v3 .cards{gap:20px 18px}
  .v3 .fc2 .front{padding:14px 10px 20px}
  .v3 .fc2 .front img{width:80%}
  .v3 .fc2 .nm2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:15px;letter-spacing:.12em;color:var(--ink);padding-top:12px}
</style>
<div class="wrap${V3 ? ' v3' : ''}">
  <h1>Fruit flash cards — ${V}</h1>
  <div class="cards">${cards.map(card).join('\n')}</div>
</div>
<script src="/compare.js"></script>
<script>
(function () {
  document.querySelectorAll('.fc').forEach(function (b) {
    b.addEventListener('click', function () { b.classList.toggle('flip'); });
  });
  window.__compareHelp({ html: '<b>A mockup, nothing drawn.</b> Each card is the picture you picked' + (${JSON.stringify(FRONT)} ? ', its name under it. ' : '; tap it to flip to the name on the back. ') + ${JSON.stringify(cards.length)} + ' so far — the rest join as you finish them.' });
})();
</script>`;

  if (FONTS) return postFonts(cards);
  if (DRY) { fs.writeFileSync('/tmp/fruit-flashcards.html', page); console.log('wrote /tmp/fruit-flashcards.html', cards.length, 'cards'); return; }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: `Fruit flash cards — ${V} (${cards.length})`, html: page }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
  if (SUPERSEDE) console.log('superseded', SUPERSEDE, (await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDE}/supersede`, { method: 'POST' })).status);
})().catch(e => { console.error(e); process.exit(1); });

async function postFonts(cards) {
  const sample = cards.slice(0, 2);
  const gf = 'https://fonts.googleapis.com/css2?' + FONT_SET.map(f => 'family=' + f[2]).join('&') + '&display=swap';
  const card = (c, key, caps) => `<div class="fc fc2 f-${key}${caps ? ' caps' : ''}"><span class="face front">
      <img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy" decoding="async"><span class="nm2">${esc(caps ? c.name.toUpperCase() : c.name.toLowerCase())}</span></span></div>`;
  const block = (f) => `<h2>${esc(f[1])}</h2>
    <div class="opt" data-item="${f[0]}-lower"><div class="lbl">lowercase</div><div class="cards">${sample.map(c => card(c, f[0], false)).join('')}</div></div>
    <div class="opt" data-item="${f[0]}-caps"><div class="lbl">caps</div><div class="cards">${sample.map(c => card(c, f[0], true)).join('')}</div></div>`;
  const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fruit flash cards — fonts, lower and caps</title>
<link rel="stylesheet" href="/compare.css">
<link rel="stylesheet" href="${gf}">
<style>
  h2{font-size:15px;margin:26px 0 6px}
  .opt{position:relative;padding:8px 0 14px}
  .lbl{font-size:12px;color:var(--ink2);letter-spacing:.06em;margin:0 0 8px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:20px 18px}
  .fc{display:block;aspect-ratio:3/4}
  .face{position:relative;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;height:100%;box-sizing:border-box;
    padding:14px 10px 20px;background:#fff;border:1px solid #e0d6c4;border-radius:10px;box-shadow:0 1px 3px rgba(38,34,28,.12);overflow:hidden}
  .face img{width:80%;height:auto;flex:1;min-height:0;object-fit:contain}
  .nm2{font-size:15px;letter-spacing:.12em;color:var(--ink);text-align:center;line-height:1.2;padding-top:12px}
  .caps .nm2{font-size:12.5px;letter-spacing:.2em}
  ${FONT_SET.map(f => `.f-${f[0]} .nm2{font-family:'${f[1]}',Georgia,serif;font-weight:${f[3]}}`).join('\n  ')}
</style>
<div class="wrap">
  <h1>Fruit flash cards — fonts, lower and caps</h1>
  ${FONT_SET.map(block).join('\n')}
</div>
<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: 'flashcard-fonts-v1' });
  window.__compareHelp({ html: '<b>Four fonts, each in lowercase and caps</b>, on the same two cards. Heart the one you want; a note on any block says what to change.' });
})();
</script>`;
  if (DRY) { fs.writeFileSync('/tmp/fruit-flashcards-fonts.html', page); console.log('wrote /tmp/fruit-flashcards-fonts.html'); return; }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: 'Fruit flash cards — 4 fonts, lower and caps', html: page }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
}

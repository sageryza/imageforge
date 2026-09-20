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
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async () => {
  // the picked picture per fruit, read off the Finished page's own data
  const html = await (await fetch(`${BASE}/api/chatfeed/page/${FROM}`)).text();
  const m = html.match(/window\.__pageData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) || html.match(/__pageData\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('no __pageData on the Finished page');
  const groups = JSON.parse(m[1]).groups || [];
  const cards = groups.map(g => ({ name: g.label, img: g.items[0].img })).filter(c => c.img);

  const card = c => `<button class="fc" type="button" data-nostop aria-label="${esc(c.name)}">
    <span class="fc-in">
      <span class="face front"><img src="${esc(c.img)}" alt="" loading="lazy" decoding="async"><span class="tag">?</span></span>
      <span class="face back"><span class="nm">${esc(c.name)}</span></span>
    </span></button>`;

  const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fruit flash cards — mockup</title>
<link rel="stylesheet" href="/compare.css">
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
</style>
<div class="wrap">
  <h1>Fruit flash cards — mockup</h1>
  <div class="cards">${cards.map(card).join('\n')}</div>
</div>
<script src="/compare.js"></script>
<script>
(function () {
  document.querySelectorAll('.fc').forEach(function (b) {
    b.addEventListener('click', function () { b.classList.toggle('flip'); });
  });
  window.__compareHelp({ html: '<b>A mockup, nothing drawn.</b> Each card is the picture you picked; tap it to flip to the name on the back. ' + ${JSON.stringify(cards.length)} + ' so far — the rest join as you finish them.' });
})();
</script>`;

  if (DRY) { fs.writeFileSync('/tmp/fruit-flashcards.html', page); console.log('wrote /tmp/fruit-flashcards.html', cards.length, 'cards'); return; }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: `Fruit flash cards — mockup (${cards.length})`, html: page }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
  if (SUPERSEDE) console.log('superseded', SUPERSEDE, (await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDE}/supersede`, { method: 'POST' })).status);
})().catch(e => { console.error(e); process.exit(1); });

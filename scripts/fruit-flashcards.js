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
// --cards <drawn.json> --title <name>: the SAME v3 card, size and spacing,
// for another deck (2026-09-22, Sophie, on the animal deck's print-files
// page: "use the fruit template · not zip · compare · size and spacing of
// fruit"). Reads a deck-draw.js record file instead of the Finished page.
// --hand: the name in Sophie Hand (her handwriting, the fruit deck's face
// since #2552) instead of Cormorant Garamond.
const CARDS = flag('cards');
const TITLE = flag('title', 'Fruit flash cards');
const HAND = args.includes('--hand') || Boolean(flag('face'));
// --face lemon|sophie [--caps]: which of her own faces the name wears
// (2026-09-22, Sophie: "try lemon caps"). --hand alone is Sophie Hand.
const FACE = flag('face', 'sophie');
const FACE_FILE = { sophie: 'sophie-hand.ttf', lemon: 'lemon-hand.ttf', title: 'magic-title.ttf', subtitle: 'magic-subtitle.ttf' }[FACE] || FACE;
const CAPS = args.includes('--caps');
// --size <px> --track <em>: the name's size and letter-spacing, over the
// defaults (2026-09-22, Sophie, on Lemon Hand caps: "try it smaller and with
// more space between letters" → 12px, .22em).
const NM_SIZE = flag('size', CAPS ? '15' : '17');
const NM_TRACK = flag('track', CAPS ? '.1em' : '.06em');
// --fonts: ONE compare page of the name in several fonts, lowercase and caps
// side by side, two sample cards each, a ♥/✕ per option (2026-09-20, Sophie:
// "now try caps · and a couple other fonts in lower and caps · u can put in
// compare tab").
const FONTS = args.includes('--fonts');
// --set wide: letters wider than they are tall (2026-09-20, Sophie: "i'd
// like a font that has wider letters more than tall and narrow · try a few").
const WIDE_SET = [
  ['gilda', 'Gilda Display', 'Gilda+Display', 400],
  ['bellefair', 'Bellefair', 'Bellefair', 400],
  ['forum', 'Forum', 'Forum', 400],
  ['cinzel', 'Cinzel', 'Cinzel:wght@400', 400],
  ['poiret', 'Poiret One', 'Poiret+One', 400],
  ['julius', 'Julius Sans One', 'Julius+Sans+One', 400],
];
// --set short: SHORT AND WIDE — letters wider than tall (2026-09-20, Sophie,
// on the wide set: "none are short and wide"). Two ways to get there: a font
// with a real width axis pushed to its widest (Roboto Serif and Archivo go to
// 150 / 125), a genuinely extended face (Krona One, Syncopate, Michroma), and
// an elegant serif STRETCHED sideways with scaleX — the fifth field is extra
// CSS on the name.
const SHORT_SET = [
  ['robotoserif', 'Roboto Serif · widest', 'Roboto+Serif:wdth,wght@150,400', 400, "font-family:'Roboto Serif',serif;font-stretch:150%;font-variation-settings:'wdth' 150"],
  ['archivo', 'Archivo · expanded', 'Archivo:wdth,wght@125,400', 400, "font-family:'Archivo',sans-serif;font-stretch:125%;font-variation-settings:'wdth' 125"],
  ['krona', 'Krona One', 'Krona+One', 400, "font-family:'Krona One',sans-serif;font-size:11px"],
  ['syncopate', 'Syncopate', 'Syncopate', 400, "font-family:'Syncopate',sans-serif;font-size:10.5px"],
  ['michroma', 'Michroma', 'Michroma', 400, "font-family:'Michroma',sans-serif;font-size:10.5px"],
  ['gildawide', 'Gilda Display · stretched', 'Gilda+Display', 400, "font-family:'Gilda Display',serif;font-size:13px;display:inline-block;transform:scaleX(1.5)"],
  ['cormwide', 'Cormorant Garamond · stretched', 'Cormorant+Garamond:wght@500', 500, "font-family:'Cormorant Garamond',serif;font-size:14px;display:inline-block;transform:scaleX(1.55)"],
  ['bellewide', 'Bellefair · stretched', 'Bellefair', 400, "font-family:'Bellefair',serif;font-size:13px;display:inline-block;transform:scaleX(1.5)"],
];
// --set short2: the stretched serifs ran off the card (2026-09-20, Sophie:
// "the stretched ones went off card · try again · also try architects
// daughter") — the scale is smaller and the letter-spacing lighter, so a
// ten-letter name fits inside a 170px card, and the stretch is MEASURED in
// the page (any name wider than its card is shrunk to fit).
const SHORT2_SET = [
  ['syncopate', 'Syncopate', 'Syncopate', 400, "font-family:'Syncopate',sans-serif;font-size:10.5px"],
  ['architects', 'Architects Daughter', 'Architects+Daughter', 400, "font-family:'Architects Daughter',cursive;font-size:14px;letter-spacing:.08em"],
  ['gildawide', 'Gilda Display · stretched', 'Gilda+Display', 400, "font-family:'Gilda Display',serif;font-size:11.5px;letter-spacing:.05em;display:inline-block;transform:scaleX(1.4)"],
  ['cormwide', 'Cormorant Garamond · stretched', 'Cormorant+Garamond:wght@500', 500, "font-family:'Cormorant Garamond',serif;font-size:12.5px;letter-spacing:.05em;display:inline-block;transform:scaleX(1.45)"],
  ['bellewide', 'Bellefair · stretched', 'Bellefair', 400, "font-family:'Bellefair',serif;font-size:11.5px;letter-spacing:.05em;display:inline-block;transform:scaleX(1.4)"],
];
const SET = flag('set', 'first');
const FONT_SET = SET === 'short2' ? SHORT2_SET : SET === 'short' ? SHORT_SET : SET === 'wide' ? WIDE_SET : [
  ['cormorant', 'Cormorant Garamond', 'Cormorant+Garamond:wght@500', 500],
  ['ebgaramond', 'EB Garamond', 'EB+Garamond:wght@400;500', 400],
  ['playfair', 'Playfair Display', 'Playfair+Display:wght@400', 400],
  ['marcellus', 'Marcellus', 'Marcellus', 400],
];
const FONTS_TITLE = SET === 'short2' ? `Fruit flash cards — short-and-wide v2, lower and caps` : SET === 'short' ? `Fruit flash cards — ${FONT_SET.length} short-and-wide, lower and caps` : SET === 'wide' ? `Fruit flash cards — ${FONT_SET.length} wide fonts, lower and caps` : 'Fruit flash cards — 4 fonts, lower and caps';
const FONTS_SHEET = SET === 'short2' ? 'flashcard-fonts-short-v2' : SET === 'short' ? 'flashcard-fonts-short-v1' : SET === 'wide' ? 'flashcard-fonts-wide-v1' : 'flashcard-fonts-v1';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async () => {
  // the picked picture per fruit, read off the Finished page's own data
  let cards;
  if (CARDS) {
    cards = JSON.parse(fs.readFileSync(CARDS, 'utf8')).sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ name: r.name, img: r.url }));
  } else {
    const html = await (await fetch(`${BASE}/api/chatfeed/page/${FROM}`)).text();
    const m = html.match(/window\.__pageData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) || html.match(/__pageData\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) throw new Error('no __pageData on the Finished page');
    const groups = JSON.parse(m[1]).groups || [];
    cards = groups.map(g => ({ name: g.label, img: g.items[0].img })).filter(c => c.img);
  }

  const cardFront = c => `<div class="fc fc2"><span class="face front">
      <img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy" decoding="async"><span class="nm2${HAND ? ' hand' : ''}">${esc(CAPS ? c.name.toUpperCase() : c.name.toLowerCase())}</span></span></div>`;
  const cardFlip = c => `<button class="fc" type="button" data-nostop aria-label="${esc(c.name)}">
    <span class="fc-in">
      <span class="face front"><img src="${esc(c.img)}" alt="" loading="lazy" decoding="async"><span class="tag">?</span></span>
      <span class="face back"><span class="nm">${esc(c.name)}</span></span>
    </span></button>`;

  const card = FRONT ? cardFront : cardFlip;
  const V = CARDS ? flag('v', 'v1') : V3 ? 'v3 — lighter name' : FRONT ? 'v2 — name on the front' : 'mockup';
  const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)} — ${V}</title>
<link rel="stylesheet" href="/compare.css">
${V3 && !HAND ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap">' : ''}
<style>
  ${HAND ? `@font-face{font-family:"Her Hand";src:url(/fonts/${FACE_FILE}) format("truetype");font-display:swap}
  .v3 .fc2 .nm2.hand{font-family:'Her Hand',Georgia,serif;font-weight:400;font-size:${NM_SIZE}px;letter-spacing:${NM_TRACK};text-indent:${NM_TRACK}}` : ''}
  /* text-indent = letter-spacing: the tracking leaves a gap AFTER the last
     letter too, so a centred box sits its letters half a gap left of centre
     (MEASURED 2026-09-22, 1.2px at .24em on 10px: "are they centered"). */
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
  <h1>${esc(TITLE)} — ${V}</h1>
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
    body: JSON.stringify({ chat: CHAT, title: `${TITLE} — ${V} (${cards.length})`, html: page }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
  if (SUPERSEDE) console.log('superseded', SUPERSEDE, (await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDE}/supersede`, { method: 'POST' })).status);
})().catch(e => { console.error(e); process.exit(1); });

async function postFonts(cards) {
  const sample = cards.slice(0, 2);
  const gf = 'https://fonts.googleapis.com/css2?' + FONT_SET.map(f => 'family=' + f[2]).join('&') + '&display=swap';
  const card = (c, key, caps) => `<div class="fc fc2 f-${key}${caps ? ' caps' : ''}"><span class="face front">
      <img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy" decoding="async"><span class="nmw"><span class="nm2">${esc(caps ? c.name.toUpperCase() : c.name.toLowerCase())}</span></span></span></div>`;
  const block = (f) => `<h2>${esc(f[1])}</h2>
    <div class="opt" data-item="${f[0]}-lower"><div class="lbl">lowercase</div><div class="cards">${sample.map(c => card(c, f[0], false)).join('')}</div></div>
    <div class="opt" data-item="${f[0]}-caps"><div class="lbl">caps</div><div class="cards">${sample.map(c => card(c, f[0], true)).join('')}</div></div>`;
  const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(FONTS_TITLE)}</title>
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
  .short2 .caps .nm2{letter-spacing:.12em}
  .short2 .caps.f-architects .nm2{font-size:12px}
  .nmw{display:block;width:100%;text-align:center;overflow:visible}
  ${FONT_SET.map(f => `.f-${f[0]} .nm2{font-family:'${f[1]}',Georgia,serif;font-weight:${f[3]};${f[4] || ''}}`).join('\n  ')}
</style>
<div class="wrap${SET === 'short2' ? ' short2' : ''}">
  <h1>${esc(FONTS_TITLE)}</h1>
  ${FONT_SET.map(block).join('\n')}
</div>
<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(FONTS_SHEET)} });
  // A NAME NEVER RUNS OFF ITS CARD: measure each stretched name against the
  // card's inner width once the fonts are in, and scale the wide ones down.
  function fit() {
    document.querySelectorAll('.nm2').forEach(function (n) {
      var box = n.closest('.face'); if (!box) return;
      var room = box.clientWidth - 16, w = n.getBoundingClientRect().width;
      if (w > room) {
        var t = getComputedStyle(n).transform, sx = 1;
        if (t && t !== 'none') { var m = t.match(/matrix\(([^,]+)/); if (m) sx = parseFloat(m[1]) || 1; }
        n.style.transform = 'scaleX(' + (sx * room / w).toFixed(3) + ')';
      }
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else setTimeout(fit, 800);
  window.addEventListener('resize', fit);
  window.__compareHelp({ html: '<b>${FONT_SET.length} fonts, each in lowercase and caps</b>, on the same two cards. Heart the one you want; a note on any block says what to change.' });
})();
</script>`;
  if (DRY) { fs.writeFileSync('/tmp/fruit-flashcards-fonts.html', page); console.log('wrote /tmp/fruit-flashcards-fonts.html'); return; }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: FONTS_TITLE, html: page }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
}

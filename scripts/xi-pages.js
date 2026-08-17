// XI batch-1 review pages — the ONE card list + the two page posters.
//
//   node scripts/xi-pages.js pairs            post the pairs page
//   node scripts/xi-pages.js deck             post the singles swipe deck
//   node scripts/xi-pages.js pairs --out f.html   write HTML only, post nothing
//
// Batch 1 (2026-08-17, chat xi-card-design): 67 one-type cards — see
// docs/xi-cards.md for the recipe and lanes. The singles deck was posted
// 2026-08-17 (sheet page-v9bIL7ob2HwqWfRnGvPK); the pairs page writes to
// sheet xi-pairs-b1x67. Re-running a poster makes a NEW page (the
// new-version rule) — do it for a new batch or a real revision, not a typo.
//
// The pairs page is Sophie's ask (2026-08-17): test cards TWO at a time,
// swapping ONE card per step so every pairing is theoretically reachable,
// and WRITE the memory a pair triggers. States match the singles deck
// (sparked / almost / nothing) so the two sheets read together.

const LANE_A = [
  'PRETENDED TO BE ASLEEP', 'SNUCK OUT', 'LISTENED AT THE DOOR',
  "READ SOMETHING I SHOULDN'T HAVE", 'FAKED BEING SICK', 'GOT AWAY WITH IT',
  'TOOK THE DARE', 'LEARNED A BAD WORD', 'GOT CALLED BY MY FULL NAME',
  'MADE A FRIEND FOR ONE DAY', 'NEVER SAW THEM AGAIN', "WAS SOMEBODY'S FAVORITE",
  "KEPT SOMEONE'S SECRET", 'PRETENDED NOT TO SEE THEM', 'SHARED A LOOK WITH A STRANGER',
  'WAITED UP', 'WAVED UNTIL THEY WERE OUT OF SIGHT', "DIDN'T KNOW IT WAS THE LAST TIME",
  'KEPT IT FOR NO REASON', 'NEVER GAVE IT BACK', 'NEVER FOUND IT',
  'HID IT SO WELL I LOST IT', 'BROKE SOMETHING AND SAID NOTHING', 'SAVED UP FOR IT',
  'WROTE IT AND NEVER SENT IT', 'LAUGHED UNTIL IT HURT', 'TRIED NOT TO LAUGH',
  'SANG AT THE TOP OF MY LUNGS', 'FELL ASLEEP ON THE WAY HOME', 'STAYED IN THE CAR FOR THE SONG',
  'WON SOMETHING SMALL', 'GOT LOCKED OUT', 'MISSED IT BY A MINUTE',
  'SLEPT THROUGH IT', 'REGRETTED THE HAIRCUT', 'WORE THE WRONG THING',
  'ATE IT TO BE POLITE', 'NODDED LIKE I UNDERSTOOD', 'STAYED TOO LATE',
  'LEFT WITHOUT SAYING GOODBYE', 'TALKED UNTIL THE PHONE DIED', 'GOT THE CALL',
  'WANTED TO GO HOME', 'GOT PICKED LAST', 'PACKED IN A HURRY',
  'TOOK THE LONG WAY HOME', 'RACED THE STREETLIGHTS HOME', 'WATCHED FROM THE WINDOW',
  'LET IT RING', 'MADE THE SAME WISH EVERY YEAR', 'ATE STANDING OVER THE SINK',
  'STAYED HOME SICK', 'WAITED TO BE PICKED UP',
];
const LANE_B = [
  'THE KITCHEN, LATE AT NIGHT', 'THE BACK SEAT ON A LONG DRIVE', 'A WAITING ROOM',
  "THE SMELL OF SOMEONE ELSE'S HOUSE", 'A PARKING LOT AFTER DARK', 'THE SMELL OF CHLORINE',
  'RAIN ON HOT PAVEMENT', 'A SONG THAT WAS EVERYWHERE THAT SUMMER', 'THE HUM OF A FAN AT NIGHT',
  'THE FIRST COLD MORNING', '3 A.M.', 'THE LAST DAY OF SCHOOL',
  'THE JUNK DRAWER', 'THE NIGHT THE POWER WENT OUT',
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// The canonical batch-1 order: one Lane B card after every 4 Lane A cards
// (fatigue spreads over both lanes). The singles deck used this exact order;
// keep it stable — pair keys are slug-based, but resume positions index it.
function cards() {
  const out = [];
  let ai = 0, bi = 0;
  while (ai < LANE_A.length || bi < LANE_B.length) {
    for (let k = 0; k < 4 && ai < LANE_A.length; k++) out.push(LANE_A[ai++]);
    if (bi < LANE_B.length) out.push(LANE_B[bi++]);
  }
  return out.map((cap) => ({ id: slug(cap), cap }));
}

const CHAT = 'xi-card-design';
const SESSION = '01XgqGzHWKXv6khB9PLduuKS';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

// ── the singles swipe deck (stock template — data, not HTML) ──
function deckBody() {
  return {
    chat: CHAT, session: SESSION, title: 'XI cards — batch 1', template: 'deck',
    data: {
      help: 'All one type now — no event/twist split. Mark each card: sparked = a real memory surfaced · almost = something stirred · nothing. When a card sparks, tap the mic and say the memory in a sentence — those recordings drive the art later.',
      states: [
        { key: true, label: 'sparked' },
        { key: 'almost', label: 'almost' },
        { key: false, label: 'nothing' },
      ],
      voice: true,
      items: cards().map((c) => ({ id: c.id, text: c.cap })),
    },
  };
}

// ── the pairs page (custom compare page) ──
// Two cards side by side; each has its own swap. Marking a pair auto-steps
// the RIGHT card to the next unseen pairing (hold one, walk the other), so
// systematic coverage is just tapping — and the swaps reach any pairing by
// hand. The memory box saves to the pair's verdict text (typed; dictation is
// polled while focused — iOS fills a field without firing `input`).
function pairsHtml() {
  const CARDS = cards();
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>XI pairs — batch 1</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .xwrap { max-width: 560px; margin: 0 auto; }
  .xduo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .xcard {
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
    min-height: 148px; display: flex; align-items: center; justify-content: center;
    padding: 14px 10px; text-align: center;
    font: 700 16px/1.45 Georgia, 'Times New Roman', serif; letter-spacing: .04em;
  }
  .xswap { text-align: center; margin-top: 8px; }
  .xstates { display: flex; gap: 8px; justify-content: center; margin-top: 18px; }
  .xstates button.sel { border-color: var(--gold); color: var(--gold); font-weight: 700; }
  .xtools { display: flex; gap: 8px; justify-content: center; align-items: center; margin-top: 14px; }
  .xmeta { text-align: center; font: 12px/1.4 -apple-system, sans-serif; color: var(--ink2); margin-top: 10px; }
  .xmem { margin-top: 6px; }
  .xmemrow { display: flex; justify-content: flex-end; }
  .xmem-open {
    width: 26px; height: 26px; border-radius: 50%; padding: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--ink2); transition: transform .15s;
  }
  .xmem-open svg { width: 13px; height: 13px; display: block; }
  .xmem.open .xmem-open { transform: rotate(45deg); }
  .xmem-box {
    display: none; width: 100%; margin-top: 8px; min-height: 74px;
    font: 14px/1.45 Georgia, 'Times New Roman', serif;
    color: var(--ink); background: var(--paper);
    border: 1px solid var(--line); border-radius: 6px;
    padding: 8px 9px; resize: vertical;
    -webkit-text-size-adjust: 100%;
  }
  .xmem.open .xmem-box { display: block; }
  .xmem-box:focus { outline: none; border-color: var(--gold); }
  .xmem-text { display: none; margin-top: 8px; font-size: 15px; white-space: pre-wrap; }
  .xmem.has .xmem-text { display: block; }
  .xmem.open .xmem-text { display: none; }
</style>

<div class="wrap xwrap" data-nostop>
  <h1>XI pairs — batch 1</h1>

  <div class="xduo">
    <div><div class="xcard" id="cardL"></div><div class="xswap"><button id="swapL">swap</button></div></div>
    <div><div class="xcard" id="cardR"></div><div class="xswap"><button id="swapR">swap</button></div></div>
  </div>

  <div class="xstates">
    <button data-v="true">sparked</button>
    <button data-v="almost">almost</button>
    <button data-v="false">nothing</button>
  </div>

  <div class="xmem" id="mem">
    <div class="xmemrow"><button class="xmem-open" id="memOpen" aria-label="Write the memory">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button></div>
    <div class="xmem-text" id="memText"></div>
    <textarea class="xmem-box" id="memBox"></textarea>
  </div>

  <div class="xtools">
    <button id="back">&#8249; back</button>
    <button id="shuffle">shuffle</button>
  </div>
  <div class="xmeta" id="meta"></div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var CHAT = ${JSON.stringify(CHAT)}, SHEET = 'xi-pairs-b1x67';
  var CARDS = ${JSON.stringify(CARDS)};
  var N = CARDS.length, TOTAL = N * (N - 1) / 2;
  var seen = {}, texts = {}, hist = [];
  var i = 0, j = 1;
  var $ = function (id) { return document.getElementById(id); };
  var stateBtns = Array.prototype.slice.call(document.querySelectorAll('.xstates button'));
  var VALS = { 'true': true, 'false': false, 'almost': 'almost' };

  function pairKey(a, b) {
    var s = [CARDS[a].id, CARDS[b].id].sort();
    return s[0] + '+' + s[1];
  }
  function curKey() { return pairKey(i, j); }
  function isSeen(k) { return seen[k] !== undefined && seen[k] !== null; }
  function seenCount() {
    var n = 0; for (var k in seen) { if (isSeen(k) && k.indexOf('+') > 0) n++; }
    return n;
  }

  // ── the memory box: saves keyed to the pair it was typed on, never the
  // pair on screen (a save can land after a swap). Dictation is POLLED —
  // iOS can fill a field without firing input.
  var memTimer = null, memPoll = null, memLast = '';
  function memSave(key, text) {
    texts[key] = text;
    fetch('/api/chatfeed/verdict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, sheet: SHEET, item: key, text: text }),
    }).catch(function () { /* offline — local copy stands */ });
  }
  function memQueue() {
    var key = curKey(), val = $('memBox').value;
    if (val === memLast) return;
    memLast = val;
    clearTimeout(memTimer);
    memTimer = setTimeout(function () { memSave(key, val); }, 700);
  }
  function memFlush() {
    if (!memTimer) return;
    clearTimeout(memTimer); memTimer = null;
    memSave(curKey(), $('memBox').value);
  }
  $('memBox').addEventListener('input', memQueue);
  $('memBox').addEventListener('focus', function () {
    memPoll = setInterval(memQueue, 500);
  });
  $('memBox').addEventListener('blur', function () {
    clearInterval(memPoll); memQueue();
  });
  $('memOpen').addEventListener('click', function () {
    var open = $('mem').classList.toggle('open');
    if (open) { $('memBox').value = texts[curKey()] || ''; memLast = $('memBox').value; $('memBox').focus(); }
    else { memFlush(); paintMem(); }
  });
  window.addEventListener('pagehide', function () {
    var val = $('memBox').value;
    if (!$('mem').classList.contains('open') || !val.trim()) return;
    try {
      navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({
        chat: CHAT, sheet: SHEET, item: curKey(), text: val,
      })], { type: 'application/json' }));
    } catch (_) { /* nothing more to do */ }
  });

  function paintMem() {
    var t = texts[curKey()] || '';
    $('memText').textContent = t;
    $('mem').classList.toggle('has', !!t.trim());
  }
  function paint() {
    $('cardL').textContent = CARDS[i].cap;
    $('cardR').textContent = CARDS[j].cap;
    var v = seen[curKey()];
    stateBtns.forEach(function (b) {
      b.classList.toggle('sel', v !== undefined && v !== null && VALS[b.getAttribute('data-v')] === v);
    });
    $('mem').classList.remove('open');
    paintMem();
    $('meta').textContent = 'seen ' + seenCount() + ' of ' + TOTAL + ' pairs';
    try { localStorage.setItem('xi-pairs-b1', JSON.stringify({ i: i, j: j })); } catch (_) {}
  }

  // Step one side to its next card, preferring the first UNSEEN pairing;
  // a full lap with nothing unseen just steps once.
  function advance(side) {
    memFlush();
    var fixed = side === 'L' ? j : i, cur = side === 'L' ? i : j;
    var first = null, pick = null;
    for (var s = 1; s < N; s++) {
      var x = (cur + s) % N;
      if (x === fixed) continue;
      if (first === null) first = x;
      var k = side === 'L' ? pairKey(x, fixed) : pairKey(fixed, x);
      if (!isSeen(k)) { pick = x; break; }
    }
    var nx = pick !== null ? pick : first;
    if (side === 'L') i = nx; else j = nx;
    paint();
  }
  function pushHist() { hist.push([i, j]); if (hist.length > 300) hist.shift(); }

  $('swapL').addEventListener('click', function () { pushHist(); advance('L'); });
  $('swapR').addEventListener('click', function () { pushHist(); advance('R'); });
  $('back').addEventListener('click', function () {
    var p = hist.pop();
    if (p) { memFlush(); i = p[0]; j = p[1]; paint(); }
  });
  $('shuffle').addEventListener('click', function () {
    memFlush(); pushHist();
    var a = i, b = j, t;
    for (t = 0; t < 300; t++) {
      a = Math.floor(Math.random() * N); b = Math.floor(Math.random() * N);
      if (a !== b && !isSeen(pairKey(a, b))) break;
    }
    if (a === b) b = (a + 1) % N;
    i = a; j = b; paint();
  });
  stateBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var v = VALS[b.getAttribute('data-v')], k = curKey();
      memFlush();
      seen[k] = v;
      fetch('/api/chatfeed/verdict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: CHAT, sheet: SHEET, item: k, ok: v }),
      }).catch(function () { /* offline — local state stands */ });
      pushHist();
      advance('R');
    });
  });

  // resume where she left off, then fill in what's already marked
  try {
    var pos = JSON.parse(localStorage.getItem('xi-pairs-b1') || 'null');
    if (pos && pos.i >= 0 && pos.i < N && pos.j >= 0 && pos.j < N && pos.i !== pos.j) { i = pos.i; j = pos.j; }
  } catch (_) {}
  paint();
  fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(CHAT) + '&sheet=' + SHEET)
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (d) {
      seen = (d && d.items) || {};
      texts = (d && d.texts) || {};
      paint();
    });

  window.__compareHelp({ html: '<b>Two cards, one memory.</b> Find a memory '
    + 'that is BOTH cards, mark it: sparked = a real one surfaced · almost '
    + '= something stirred · nothing. Marking steps the right card to the '
    + 'next unseen pairing — hold one, walk the other. Each swap changes '
    + 'only its own card, so every pairing is reachable; shuffle jumps to a '
    + 'random unseen pair, back re-opens the last one (re-marking it moves on '
    + 'again). The + opens a box to write the memory itself — typed or '
    + 'dictated, it saves as you go, one memory per pair.' });
})();
</script>
`;
}

function pairsBody() {
  return { chat: CHAT, session: SESSION, title: 'XI pairs — batch 1', html: pairsHtml() };
}

async function main() {
  const mode = process.argv[2];
  const outIx = process.argv.indexOf('--out');
  if (!['deck', 'pairs'].includes(mode)) {
    console.error('usage: node scripts/xi-pages.js deck|pairs [--out file.html]');
    process.exit(1);
  }
  const body = mode === 'deck' ? deckBody() : pairsBody();
  if (outIx > 0) {
    if (mode === 'pairs') require('fs').writeFileSync(process.argv[outIx + 1], body.html);
    else require('fs').writeFileSync(process.argv[outIx + 1], JSON.stringify(body, null, 2));
    console.log('wrote', process.argv[outIx + 1], '(nothing posted)');
    return;
  }
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log('HTTP', r.status);
  console.log(await r.text());
}

module.exports = { cards, deckBody, pairsBody, pairsHtml, CHAT };

if (require.main === module) {
  main().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
}

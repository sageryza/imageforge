/* THE DREAM COMMERCIALS ROOM — every film and every still made for the dream
 * app's commercials, on one page (Aug 2026, Sophie: "gather up all the films
 * that were made, and all the stills and basically make like a second story
 * room just for dream app commercials but do it like a compare page").
 *
 * The films are LINES WITH A PLAY BUTTON at the top (__filmRow), never
 * embedded players. Every still on this page is a DERIVED display copy — the
 * originals are 2-3MB PNGs and 1.5MB webps, and the house rule is that a page
 * never serves those. The originals are untouched where they were made.
 *
 *   node scripts/dream-commercials/room.js [--dry]
 */
const st = require('./stills.json');
const ex = require('./extra.json');
const boys = require('./boys.json');
const R = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/';

// unique urls in order, across a commercial's versions
const merge = (...ls) => {
  const seen = new Set(), out = [];
  ls.flat().forEach((s) => { if (!seen.has(s.url)) { seen.add(s.url); out.push(s); } });
  return out;
};

// THE SIX CURRENT CUTS. `prefix` + `chat` let the page re-resolve each one on
// open (GET /api/chatfeed/newest) so a re-cut in another chat reaches this
// room without it being rebuilt; the urls here are the fallback. `chat` is
// also where a note left while watching lands — the chat that can act on it.
const FILMS = [
  { url: R + 'dream-commercial/commercial-v2.mp4', label: 'The boys — before / after the dream app · v2', meta: '0:44',
    prefix: 'dream-commercial/commercial-', chat: 'dream-app-commercial' },
  { url: R + 'commercials/reels/everydream3/everydream3-reel-draft-v1.mp4', label: 'Every night — the sad piano appeal · v3', meta: '0:59',
    prefix: 'commercials/reels/everydream', chat: 'fictional-pill-commercial' },
  { url: R + 'commercials/reels/birdcostume/birdcostume-reel-draft-v1.mp4', label: 'The bird costume', meta: '0:41',
    prefix: 'commercials/reels/birdcostume', chat: 'commercial-production-series' },
  { url: R + 'commercials/reels/birdstory/birdstory-reel-draft-v2.mp4', label: 'The bird, told as a story · v2', meta: '0:41',
    prefix: 'commercials/reels/birdstory', chat: 'fictional-pill-commercial' },
  { url: R + 'commercials/reels/reverie3/reverie3-reel-draft-v1.mp4', label: 'Rêverie — the gorgeous nonsense · v3', meta: '0:27',
    prefix: 'commercials/reels/reverie', chat: 'fictional-pill-commercial' },
  { url: R + 'dream-commercial/spot-v4.mp4', label: 'The song spot · v4', meta: '0:13',
    prefix: 'dream-commercial/spot-', chat: 'song-commercial-selection' },
];

const EARLIER = [
  { url: R + 'dream-commercial/commercial-v1.mp4', label: 'The boys · v1 — dark mode, no fries dream', meta: '0:42' },
  { url: R + 'commercials/reels/everydream2/everydream2-reel-draft-v1.mp4', label: 'Every night · v2 — B&W + stats + real site', meta: '0:47' },
  { url: R + 'commercials/reels/everydream/everydream-reel-draft-v1.mp4', label: 'Every night · v1', meta: '0:31' },
  { url: R + 'commercials/reels/birdstory/birdstory-reel-draft-v1.mp4', label: 'The bird story · v1', meta: '0:35' },
  { url: R + 'commercials/reels/reverie2/reverie2-reel-draft-v1.mp4', label: 'Rêverie · v2 — weirder, high stills', meta: '0:27' },
  { url: R + 'commercials/reels/reverie/reverie-reel-draft-v1.mp4', label: 'Rêverie · v1', meta: '0:27' },
  { url: R + 'dream-commercial/spot-v3.mp4', label: 'The song spot · v3', meta: '0:14' },
  { url: R + 'dream-commercial/spot-v2.mp4', label: 'The song spot · v2', meta: '0:14' },
  { url: R + 'dream-commercial/spot-v1.mp4', label: 'The song spot · v1', meta: '0:14' },
];

const SHELF = [
  { url: R + 'pill-commercial/thresholdyn-v1.mp4', label: 'THRESHOLDYN — the pill spot', meta: '1:22' },
  { url: R + 'commercials/ideatrol/ideatrol-draft-480p-v1.mp4', label: 'IDEATROL', meta: '1:14' },
  { url: R + 'commercials/doomscrollex/doomscrollex-draft-480p-v1.mp4', label: 'DOOMSCROLLEX', meta: '1:10' },
  { url: R + 'commercials/replyva/replyva-draft-480p-v1.mp4', label: 'REPLYVA', meta: '1:08' },
  { url: R + 'commercials/cancellia/cancellia-draft-480p-v1.mp4', label: 'CANCELLIA', meta: '1:17' },
  { url: R + 'commercials/hobbystatin/hobbystatin-draft-480p-v1.mp4', label: 'HOBBYSTATIN', meta: '1:20' },
  { url: R + 'commercials/tabzolam/tabzolam-draft-480p-v1.mp4', label: 'TABZOLAM', meta: '0:55' },
  { url: R + 'commercials/reels/skipsmalltalk/skipsmalltalk-reel-draft-v1.mp4', label: 'Xi — skip the small talk', meta: '0:31' },
  { url: R + 'commercials/reels/syncday/syncday-reel-draft-v1.mp4', label: 'Secretly a Witch — synchronicity day', meta: '0:35' },
  { url: R + 'commercials/reels/bookofshadows/bookofshadows-reel-draft-v1.mp4', label: 'Secretly a Witch — Book of Shadows', meta: '0:34' },
  { url: R + 'commercials/reels/memoryfight-warm/memoryfight-warm-reel-draft-v1.mp4', label: 'Memory Library — the fight, warm ending', meta: '0:31' },
  { url: R + 'commercials/reels/memoryfight-spiky/memoryfight-spiky-reel-draft-v1.mp4', label: 'Memory Library — the fight, spiky ending', meta: '0:31' },
];

const SECTIONS = [
  { id: 'boys', h: 'The boys — before / after', stills: boys },
  { id: 'everynight', h: 'Every night — the sad piano appeal', stills: merge(st.everydream3, st.everydream2, st.everydream1) },
  { id: 'birdcostume', h: 'The bird costume', stills: st.birdcostume },
  { id: 'birdstory', h: 'The bird, told as a story', stills: st.birdstory },
  { id: 'reverie', h: 'Rêverie — the gorgeous nonsense', stills: merge(st.reverie3, st.reverie2, st.reverie1) },
  { id: 'song', h: 'The song spot', stills: ex.song },
  { id: 'somnivex', h: 'Somnivex® — storyboarded, never shot', stills: ex.somnivex },
];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function build() {
  const secs = SECTIONS.map((s) => {
    const imgs = s.stills.map((x) => `<img src="${esc(x.url)}" alt="${esc(x.label || x.name || s.h)}">`).join('\n      ');
    return `  <div class="card" data-item="${esc(s.id)}">
    <h2>${esc(s.h)}</h2>
    <div class="imgrow">
      ${imgs}
    </div>
  </div>`;
  }).join('\n');

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The dream commercials room</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>The dream commercials room</h1>
  <div id="films"></div>
${secs}
  <div class="card" data-item="earlier">
    <h2>Earlier cuts</h2>
    <div id="earlier"></div>
  </div>
  <div class="card" data-item="shelf">
    <h2>Also on the shelf — the other apps</h2>
    <div id="shelf"></div>
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var FILMS = ${JSON.stringify(FILMS)};
  var EARLIER = ${JSON.stringify(EARLIER)};
  var SHELF = ${JSON.stringify(SHELF)};
  // the six current cuts: the row keeps a live handle on its own opts, so
  // re-resolving below only has to write the new url into it — __filmRow reads
  // opts at CLICK time, not at build time
  var live = FILMS.map(function (f) {
    var o = { url: f.url, label: f.label, meta: f.meta, mount: '#films', chat: f.chat };
    return { f: f, o: o, btn: window.__filmRow(o) };
  });
  EARLIER.forEach(function (f) { window.__filmRow({ url: f.url, label: f.label, meta: f.meta, mount: '#earlier' }); });
  SHELF.forEach(function (f) { window.__filmRow({ url: f.url, label: f.label, meta: f.meta, mount: '#shelf' }); });

  /* ASK WHICH CUT IS CURRENT, on every open — the page is frozen HTML and the
     chats that make these films re-cut them daily. One request, no model call.
     A failure leaves every row on the url it was built with. */
  (function () {
    var q = live.filter(function (x) { return x.f.prefix; })
      .map(function (x) { return x.f.prefix + '|' + (x.f.chat || ''); }).join(',');
    if (!q) return;
    fetch('/api/chatfeed/newest?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var films = (d && d.films) || {};
        live.forEach(function (x) {
          var hit = films[x.f.prefix];
          if (!hit || !hit.url || hit.url === x.o.url || !x.btn) return;
          x.o.url = hit.url;                       // what the tap now plays
          var t = x.btn.querySelector('.t'), m = x.btn.querySelector('.m');
          if (t && hit.title) t.textContent = hit.title;
          // never keep the old duration against a new cut — it is a number
          // about a film that is no longer the one playing
          if (m) m.textContent = hit.title ? '' : (hit.name || 'newer cut');
        });
      })
      .catch(function () { /* the built-in urls still play */ });
  })();
  window.__compareNotes({ chat: 'dream-app-commercials', sheet: 'commercials-room-v1' });
  window.__compareHelp({ html: '<b>Every dream-app commercial that exists.</b> '
    + 'The newest cut of each is at the top; earlier cuts and the other apps\\' '
    + 'spots are at the bottom. Every picture here is a smaller display copy — '
    + 'the full-size originals are untouched in the chats that made them. '
    + 'The + in a section\\'s corner leaves a note on that commercial.<br><br>'
    + '<b>While a film plays</b>, touch the screen and a Note button appears — it '
    + 'pauses, takes a note stamped with where you are, and files it to the chat '
    + 'that makes that film. The six rows at the top always play the current cut: '
    + 'the page asks on every open, so a re-cut elsewhere shows up here.' });
})();
</script>`;
}

module.exports = { build, FILMS, EARLIER, SHELF, SECTIONS };

if (require.main === module) {
  const html = build();
  const counts = SECTIONS.map((s) => `${s.id}:${s.stills.length}`).join(' ');
  console.error(`films ${FILMS.length} · earlier ${EARLIER.length} · shelf ${SHELF.length} · stills ${counts}`);
  if (process.argv.includes('--dry')) { process.stdout.write(html); process.exit(0); }
  fetch('https://imageforge-q125.onrender.com/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: 'dream-app-commercials', title: 'The dream commercials room', html }),
  }).then((r) => r.json()).then((j) => console.log(JSON.stringify(j)));
}

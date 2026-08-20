/* HOW THE GRID WILL LOOK — a mockup of the new dream Instagram's profile grid
 * with the reels that exist in it (Aug 2026, Sophie: "creating a grid showing
 * the reels that we picked and how they'll look once they're posted just so I
 * can wrap my head around it… make up a preliminary version of this with one
 * image still from any commercials we already made").
 *
 * PRELIMINARY on purpose: nothing has been picked yet — that is what the two
 * idea decks are for — so the tiles are the six commercials that are actually
 * shot, plus the one that is storyboarded, plus two empty slots.
 *
 * The tiles are cropped 3:4, which is what Instagram's profile grid does to a
 * reel cover now — so the crop she sees here is the crop she gets. Every cover
 * is a real frame lifted out of the finished film.
 *
 *   node scripts/dream-commercials/grid.js [--dry]
 */
const C = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercials/covers/';
const R = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/';
const ex = require('./extra.json');

// A TILE PLAYS, THE WAY THE REAL GRID DOES (Aug 2026, Sophie: "what if the
// instagram play buttons actually worked and opened lightbox"). A mockup of a
// grid whose tiles do nothing is a picture of an index; one whose tiles open
// their film IS the index — and it costs nothing, because every one of these
// films is already in Storage. `film` plays in the video lightbox; a tile with
// no film (Somnivex is storyboarded, never shot) opens its still in the image
// one, so no tile is a dead control.
const TILES = [
  { id: 'boys', cover: C + 'groupchat-v2.webp', label: 'The boys — before / after', meta: '0:44',
    film: R + 'dream-commercial/commercial-v2.mp4' },
  { id: 'everynight', cover: C + 'everydream3.webp', label: 'Every night', meta: '0:59',
    film: R + 'commercials/reels/everydream3/everydream3-reel-draft-v1.mp4' },
  { id: 'birdcostume', cover: C + 'birdcostume.webp', label: 'The bird costume', meta: '0:41',
    film: R + 'commercials/reels/birdcostume/birdcostume-reel-draft-v1.mp4' },
  { id: 'birdstory', cover: C + 'birdstory.webp', label: 'The bird, as a story', meta: '0:41',
    film: R + 'commercials/reels/birdstory/birdstory-reel-draft-v2.mp4' },
  { id: 'reverie', cover: C + 'reverie3.webp', label: 'Rêverie', meta: '0:27',
    film: R + 'commercials/reels/reverie3/reverie3-reel-draft-v1.mp4' },
  { id: 'song', cover: C + 'song-v2.webp', label: 'The song spot', meta: '0:13',
    film: R + 'dream-commercial/spot-v4.mp4' },
  { id: 'somnivex', cover: (ex.somnivex[3] || ex.somnivex[0]).url, label: 'Somnivex®', meta: 'storyboard' },
  { id: 'next1', empty: true, label: 'next' },
  { id: 'next2', empty: true, label: 'next' },
];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Instagram's own reel glyph, drawn rather than fetched — the page loads
// nothing from outside Storage
const REEL = '<svg class="reelg" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.8" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/>'
  + '<path d="M2 8h20M8.5 2 12 8M15 2l3.5 6"/><path d="m10.5 12.5 4.5 2.6-4.5 2.6z" fill="currentColor"/></svg>';

function build() {
  // THE TILE CARRIES NO WORDS AND NO NOTE + — the whole question this page
  // answers is what the grid LOOKS like, and both of those cover a third of a
  // 3-across tile. The names live in the legend under the phone instead, in
  // the same 3 columns, so a tile is still identifiable without anything
  // being drawn on top of it.
  // a real tile is a BUTTON, which also buys the autoscroll exemption for
  // free — `button` is in the pill's shared skip list, so a tap that opens a
  // film can never also start the page scrolling
  const tiles = TILES.map((t) => (t.empty
    ? `<div class="gtile empty"><span>${esc(t.label)}</span></div>`
    : `<button type="button" class="gtile"`
      + (t.film ? ` data-film="${esc(t.film)}"` : ` data-still="${esc(t.cover)}"`)
      + ` aria-label="${esc(t.film ? 'Play ' + t.label : t.label + ' — the storyboard')}">`
      + `<img src="${esc(t.cover)}" alt="${esc(t.label)}">${REEL}</button>`)).join('\n      ');
  const legend = TILES.map((t) => (t.empty
    ? '<i></i>'
    : `<i>${esc(t.label)}<b>${esc(t.meta)}</b></i>`)).join('\n      ');

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>How the grid will look</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* the phone: a flat panel, no gradients anywhere — it is a depiction of
     Instagram's grid, so it wears Instagram's proportions and nothing else */
  .phone{max-width:420px;margin:0 auto;border:1.5px solid var(--ink);border-radius:10px;
    overflow:hidden;background:#fff;}
  .pbar{display:flex;align-items:center;gap:12px;padding:16px 14px 10px;}
  .pav{width:56px;height:56px;border-radius:50%;background:#EFE9DC;border:1px solid #DDD3C0;
    display:flex;align-items:center;justify-content:center;font:700 20px/1 -apple-system,sans-serif;
    color:#8A7F6E;flex:none;}
  .pnums{display:flex;gap:22px;color:#262016;}
  .pnums div{text-align:center;font:400 11px/1.35 -apple-system,sans-serif;color:#8A7F6E;}
  .pnums b{display:block;font:700 15px/1.2 -apple-system,sans-serif;color:#262016;}
  .phandle{padding:0 14px 12px;font:600 13px/1.45 -apple-system,sans-serif;color:#262016;}
  .phandle span{display:block;font-weight:400;color:#6B6357;}
  .ptabs{display:flex;border-top:1px solid #E7DECF;}
  .ptabs i{flex:1;height:38px;display:flex;align-items:center;justify-content:center;}
  .ptabs i:first-child{box-shadow:inset 0 -2px 0 #262016;}
  .ptabs svg{width:19px;height:19px;color:#262016;}
  .ggrid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:#fff;}
  /* compare.css styles every <button> as a rounded rect with a border and
     inline-flex; a grid tile is none of those, so it says so itself */
  .gtile{position:relative;margin:0;padding:0;border:0;border-radius:0;display:block;
    width:100%;aspect-ratio:3/4;background:#EFE9DC;overflow:hidden;cursor:pointer;
    -webkit-tap-highlight-color:transparent;}
  .gtile:active img{opacity:.82;}
  .gtile img{width:100%;height:100%;object-fit:cover;display:block;}
  .gtile .reelg{position:absolute;top:6px;right:6px;width:15px;height:15px;color:#fff;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));}
  .glegend{max-width:420px;margin:9px auto 0;display:grid;grid-template-columns:repeat(3,1fr);
    gap:2px 8px;}
  .glegend i{font:600 10px/1.35 -apple-system,sans-serif;font-style:normal;color:var(--ink);}
  .glegend b{display:block;font:400 10px/1.35 -apple-system,sans-serif;color:var(--ink2,#8A7F6E);}
  .gtile.empty{display:flex;align-items:center;justify-content:center;border:1px dashed #DDD3C0;
    background:#F7F2E8;}
  .gtile.empty span{font:700 9px/1 -apple-system,sans-serif;letter-spacing:.14em;
    text-transform:uppercase;color:#B6AB98;}
</style>

<div class="wrap">
  <h1>How the grid will look</h1>
  <div class="card" data-item="grid">
    <div class="phone">
      <div class="pbar">
        <div class="pav">✦</div>
        <div class="pnums">
          <div><b>7</b>posts</div><div><b>—</b>followers</div><div><b>—</b>following</div>
        </div>
      </div>
      <div class="phandle">you...my.dreams<span>dreams, shared. youwereinmydreams.com</span></div>
      <div class="ptabs">
        <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></i>
        <i>${REEL.replace('class="reelg"', '')}</i>
        <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z"/></svg></i>
      </div>
      <div class="ggrid">
      ${tiles}
      </div>
    </div>
    <div class="glegend">
      ${legend}
    </div>
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  // ONE delegated handler for the whole grid. Both lightboxes come from
  // compare.js, so the overlay contract (autoscroll stopped, page locked,
  // scroll position restored on close, video torn down) is already right.
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.gtile') : null;
    if (!t || !window.__compareShell) return;
    var film = t.getAttribute('data-film');
    if (film) return window.__compareShell.openVideo(film);
    var still = t.getAttribute('data-still');
    if (still) window.__compareShell.openImage(still, t.getAttribute('aria-label') || '');
  });

  window.__compareNotes({ chat: 'dream-app-commercials', sheet: 'ig-grid-v1' });
  window.__compareHelp({ html: '<b>Preliminary.</b> Nothing has been picked yet — '
    + 'these are the six commercials that are actually shot, the one that is only '
    + 'storyboarded, and two empty slots. Each cover is a real frame out of the '
    + 'finished film.<br><br>The tiles are cropped <b>3:4</b>, which is what '
    + 'Instagram\\'s profile grid does to a reel cover — so the crop here is the '
    + 'crop you get. The films themselves are 2:3, and Instagram wants 9:16, so '
    + 'they will letterbox in the player until they are re-rendered taller.<br><br>'
    + '<b>Tap a tile to play it</b> — the same as the real grid. Somnivex has '
    + 'no film yet, so its tile opens the storyboard frame instead.<br><br>'
    + 'The + in the corner leaves a note on the whole grid — per-reel notes '
    + 'live on the room page and the idea decks.' });
})();
</script>`;
}

module.exports = { build, TILES };

if (require.main === module) {
  const html = build();
  console.error(`tiles ${TILES.length} (${TILES.filter((t) => !t.empty).length} real)`);
  if (process.argv.includes('--dry')) { process.stdout.write(html); process.exit(0); }
  fetch('https://imageforge-q125.onrender.com/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: 'dream-app-commercials', title: 'How the grid will look — v2, the tiles play', html }),
  }).then((r) => r.json()).then((j) => console.log(JSON.stringify(j)));
}

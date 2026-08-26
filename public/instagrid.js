/* instagrid.js — THE INSTAGRAM PROFILE-GRID MOCKUP, drawn from data (Aug 2026).

   Sophie asked for her Instagram mockups behind one icon on the Chats app's
   UPDATE tab: "two mockups of instagram (the dream one is already made by the
   dream commercials chat so reuse it exactly, it plays the films. port the
   shape for witch videos)." A third, PEOPLE WATCHING, followed 2026-08-24 —
   and cost nothing here, because this file is told an account and never how
   many there are.

   REUSED EXACTLY means the markup, the CSS and the behaviour below are a
   faithful lift of `scripts/dream-commercials/grid.js` — the page that chat
   posted into its Compare tab. What changed is only WHERE the shape and the
   tiles come from: both now live in `public/instagram-grids.json`, which THIS
   file draws and which that script also reads, so the posted page and the live
   page cannot drift into two different mockups of the same account.

   THE THREE THINGS THAT MAKE IT THE REAL GRID, all inherited, none of them
   incidental:

   1. TILES ARE CROPPED 3:4 — what Instagram's profile grid does to a reel
      cover now, so the crop she sees here is the crop she gets.
   2. A TILE PLAYS (Sophie: "what if the instagram play buttons actually worked
      and opened lightbox"). A tile with a film opens it in compare.js's video
      lightbox; a tile with no film opens its still in the image one, so no
      tile is a dead control. Both lightboxes come from compare.js, so the
      overlay contract — autoscroll stopped, page locked, scroll position
      restored, video torn down on close — is right by construction, and a tile
      is a <button>, which the pill's own skip list already exempts.
   3. EVERY TILE NAMES ITS FILM'S PREFIX AND THE CHAT THAT MAKES IT. The url in
      the data is only the fallback: GET /api/chatfeed/newest resolves each
      prefix to that film's CURRENT cut, so a re-cut in another chat reaches
      this grid without anyone re-posting anything. `chat` is also where a note
      left ON the film lands — the chat that can act on it, not this one.

   Needs /compare.css (the look and the pill's tokens) and /compare.js (the
   lightboxes) on the host page. Draws nothing until asked:

       window.__instaGrid.render(account, mountEl);   // one account
       window.__instaGrid.refresh(rootEl);            // ask for current cuts
*/
(function () {
  if (window.__instaGrid) return;                    // safe to include twice

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Instagram's own reel glyph, drawn rather than fetched — the page loads
  // nothing from outside Storage. (Lucide dropped brand glyphs for trademark
  // reasons, so every mark on this mockup is hand-inlined.)
  var REEL = '<svg class="reelg" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.8" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/>'
    + '<path d="M2 8h20M8.5 2 12 8M15 2l3.5 6"/><path d="m10.5 12.5 4.5 2.6-4.5 2.6z" fill="currentColor"/></svg>';

  var GRID_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'
    + '<rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>';
  var HEART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'
    + '<path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z"/></svg>';

  /* The phone: a flat panel, no gradients anywhere — it is a depiction of
     Instagram's grid, so it wears Instagram's proportions and nothing else. */
  var CSS = ''
    + '.phone{max-width:420px;margin:0 auto;border:1.5px solid var(--ink);border-radius:10px;'
    + 'overflow:hidden;background:#fff;}'
    + '.pbar{display:flex;align-items:center;gap:12px;padding:16px 14px 10px;}'
    + '.pav{width:56px;height:56px;border-radius:50%;background:#EFE9DC;border:1px solid #DDD3C0;'
    + 'display:flex;align-items:center;justify-content:center;font:700 20px/1 -apple-system,sans-serif;'
    + 'color:#8A7F6E;flex:none;}'
    + '.pnums{display:flex;gap:22px;color:#262016;}'
    + '.pnums div{text-align:center;font:400 11px/1.35 -apple-system,sans-serif;color:#8A7F6E;}'
    + '.pnums b{display:block;font:700 15px/1.2 -apple-system,sans-serif;color:#262016;}'
    + '.phandle{padding:0 14px 12px;font:600 13px/1.45 -apple-system,sans-serif;color:#262016;}'
    + '.phandle span{display:block;font-weight:400;color:#6B6357;}'
    + '.ptabs{display:flex;border-top:1px solid #E7DECF;}'
    + '.ptabs i{flex:1;height:38px;display:flex;align-items:center;justify-content:center;}'
    + '.ptabs i:first-child{box-shadow:inset 0 -2px 0 #262016;}'
    + '.ptabs svg{width:19px;height:19px;color:#262016;}'
    + '.ggrid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:#fff;}'
    /* compare.css styles every <button> as a rounded rect with a border and
       inline-flex; a grid tile is none of those, so it says so itself */
    + '.gtile{position:relative;margin:0;padding:0;border:0;border-radius:0;display:block;'
    + 'width:100%;aspect-ratio:3/4;background:#EFE9DC;overflow:hidden;cursor:pointer;'
    + '-webkit-tap-highlight-color:transparent;}'
    + '.gtile:active img{opacity:.82;}'
    + '.gtile img{width:100%;height:100%;object-fit:cover;display:block;}'
    + '.gtile .reelg{position:absolute;top:6px;right:6px;width:15px;height:15px;color:#fff;'
    + 'filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));}'
    + '.glegend{max-width:420px;margin:9px auto 0;display:grid;grid-template-columns:repeat(3,1fr);'
    + 'gap:2px 8px;}'
    + '.glegend i{font:600 10px/1.35 -apple-system,sans-serif;font-style:normal;color:var(--ink);}'
    + '.glegend b{display:block;font:400 10px/1.35 -apple-system,sans-serif;color:var(--ink2,#8A7F6E);}'
    + '.glegend i.moved b{color:#C25E4C;}'
    /* an empty slot is a bare dashed square — it used to say NEXT and Sophie
       asked for the placeholder text gone (2026-08-26), so it carries no words */
    + '.gtile.empty{border:1px dashed #DDD3C0;background:#F7F2E8;}';

  function installCss() {
    if (document.getElementById('instagrid-css')) return;
    var s = document.createElement('style');
    s.id = 'instagrid-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* THE TILE CARRIES NO WORDS AND NO NOTE + — the whole question this mockup
     answers is what the grid LOOKS like, and both of those cover a third of a
     3-across tile. The names live in the legend under the phone instead, in the
     same 3 columns, so a tile is still identifiable without anything being
     drawn on top of it. */
  function tileHtml(t) {
    if (t.empty) return '<div class="gtile empty"></div>';
    return '<button type="button" class="gtile" data-id="' + esc(t.id) + '"'
      + (t.film ? ' data-film="' + esc(t.film) + '"' : ' data-still="' + esc(t.cover) + '"')
      + (t.prefix ? ' data-prefix="' + esc(t.prefix) + '"' : '')
      + (t.chat ? ' data-chat="' + esc(t.chat) + '"' : '')
      + ' aria-label="' + esc(t.film ? 'Play ' + t.label : t.label + ' — the still') + '">'
      + '<img src="' + esc(t.cover) + '" alt="' + esc(t.label) + '">' + REEL + '</button>';
  }

  function legendHtml(t) {
    if (t.empty) return '<i></i>';
    return '<i data-id="' + esc(t.id) + '">' + esc(t.label) + '<b>' + esc(t.meta || '') + '</b></i>';
  }

  // The post count is DERIVED from the tiles, never carried in the data — a
  // stored number is one more thing to forget when a tile is added.
  function postCount(tiles) {
    return tiles.filter(function (t) { return !t.empty; }).length;
  }

  function accountHtml(a) {
    var tiles = (a.tiles || []);
    return '<div class="phone">'
      + '<div class="pbar">'
      + '<div class="pav">' + esc(a.avatar || '✦') + '</div>'
      + '<div class="pnums">'
      + '<div><b>' + postCount(tiles) + '</b>posts</div>'
      + '<div><b>—</b>followers</div><div><b>—</b>following</div>'
      + '</div></div>'
      + '<div class="phandle">' + esc(a.handle || '')
      + '<span>' + esc(a.bio || '') + '</span></div>'
      + '<div class="ptabs">'
      + '<i>' + GRID_ICON + '</i>'
      + '<i>' + REEL.replace('class="reelg"', '') + '</i>'
      + '<i>' + HEART_ICON + '</i>'
      + '</div>'
      + '<div class="ggrid">' + tiles.map(tileHtml).join('') + '</div>'
      + '</div>'
      + '<div class="glegend">' + tiles.map(legendHtml).join('') + '</div>';
  }

  function render(account, mount) {
    installCss();
    mount.innerHTML = accountHtml(account);
    return mount;
  }

  /* THE CURRENT CUT, ASKED FOR ON EVERY OPEN. One request, no model call,
     nothing stored. A failure leaves every tile on the url it was built with,
     which is the whole point of the fallback. */
  function refresh(root) {
    var tiles = [].slice.call((root || document).querySelectorAll('.gtile[data-prefix]'));
    if (!tiles.length) return Promise.resolve();
    var q = tiles.map(function (t) {
      return t.getAttribute('data-prefix') + '|' + (t.getAttribute('data-chat') || '');
    }).join(',');
    return fetch('/api/chatfeed/newest?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var films = (d && d.films) || {};
        tiles.forEach(function (t) {
          var hit = films[t.getAttribute('data-prefix')];
          if (!hit || !hit.url) return;
          if (hit.url === t.getAttribute('data-film')) return;
          var had = t.getAttribute('data-film');
          t.setAttribute('data-film', hit.url);
          t.removeAttribute('data-still');
          // The cover is still the older cut's frame, so the legend has to say
          // the film MOVED — the chat's own pin title when there is one, else
          // the file's name. A duration that belongs to a film no longer
          // playing is the one thing this must never leave on screen.
          var leg = (root || document).querySelector('.glegend i[data-id="'
            + t.getAttribute('data-id') + '"]');
          if (!leg) return;
          var b = leg.querySelector('b');
          if (b) b.textContent = hit.title || (had ? 'newer cut' : 'film added');
          leg.classList.add('moved');
        });
      })
      .catch(function () { /* the built-in urls stand */ });
  }

  /* ONE delegated handler for every grid on the page. Both lightboxes come from
     compare.js, so the overlay contract is already right. The note lands in the
     chat that MAKES this film, on the film's own url — the same thread its
     pinned player writes to, so that chat sweeps it. */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.gtile') : null;
    if (!t || !window.__compareShell) return;
    var film = t.getAttribute('data-film'), chat = t.getAttribute('data-chat');
    if (film) {
      return window.__compareShell.openVideo(film, null,
        chat ? { chat: chat, url: film } : null);
    }
    var still = t.getAttribute('data-still');
    if (still) window.__compareShell.openImage(still, t.getAttribute('aria-label') || '');
  });

  window.__instaGrid = { render: render, refresh: refresh, accountHtml: accountHtml };
})();

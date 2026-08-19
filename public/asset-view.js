/* asset-view.js — the ITEM → asset-lightbox adapter, shared (Aug 2026).

   /asset-lightbox.js is the Assets tab's lightbox, lifted verbatim; this is
   the small piece that feeds it a template page's item — the description, the
   MODEL · QUALITY caption, both halves of the prompt, the current vote, and
   the note thread fetched once per page. It lived inside grid.js, and judge.js
   needed exactly the same thing the moment Sophie asked for the Assets formula
   on a swipe card too ("the same exact asset tab formula w heart ex prompt
   note chat etc in lightbox view"), so it moved out here rather than being
   typed a second time — two hand copies of this code had already drifted once
   (assets.html grew action icons while only chats.html got the scroll fix).

     var views = window.__assetViews({
       chat,                     // the chat the notes belong to
       voteOf(it) -> 'like'|'dislike'|null,   // the item's vote right now
       cast(it, v, a),           // she tapped ♥/✕ IN the lightbox
     });
     views.open(it);             // open the lightbox on this item
     views.asset(it);            // the asset view, to repaint after a change

   The caller owns WHERE a vote lands — the grid writes its page verdict, the
   deck writes its own — which is the same split the Assets tab has always
   had. */
(function () {
  if (window.__assetViews) return;

  window.__assetViews = function (opts) {
    var chat = opts.chat || '';
    var cache = {};          // item id → the asset view the lightbox drives
    var notesLoaded = null;  // ONE fetch per page open; threads keyed by url

    function loadNotes() {
      if (!notesLoaded) {
        notesLoaded = fetch('/api/gallery/assets/notes?chat=' + encodeURIComponent(chat))
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (d) {
            var m = {};
            ((d && d.notes) || []).forEach(function (n) {
              if (n && n.url) m[n.url] = n.thread || [];
            });
            return m;
          });
      }
      return notesLoaded;
    }

    // a hand-built page that calls __grid/__judge directly may not carry the
    // script tag the template page renders — fetch it once, on the first tap
    function ensureLightbox(fn) {
      if (window.__assetLightbox) return fn();
      var s = document.createElement('script');
      s.src = '/asset-lightbox.js';
      s.onload = fn;
      document.head.appendChild(s);
    }

    function assetFor(it) {
      var a = cache[it.id];
      if (a) return a;
      a = cache[it.id] = {
        description: it.label || '',
        prompt: [it.model, it.quality].filter(Boolean).join(' · '),
        promptStyle: it.promptStyle || '',
        promptContent: it.promptContent || '',
        compressedAtBirth: !!it.compressedAtBirth,   // the lightbox marks it too
        vote: opts.voteOf ? opts.voteOf(it) : null,
        thread: null,
        _cast: function (v) { if (opts.cast) opts.cast(it, v, a); },
        _noteSend: function (text, cb) {
          fetch('/api/gallery/assets/note', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat: chat, url: it.url, text: text, from: 'sophie' }),
          }).then(function (r) { return r.json(); })
            .then(function (d) {
              if (d && d.thread) a.thread = d.thread;
              cb(!!(d && d.ok));
            })
            .catch(function () { cb(false); });
        },
      };
      return a;
    }

    return {
      asset: assetFor,
      /** repaint an OPEN lightbox after the page changed the vote under it */
      sync: function (it, vote) {
        var a = cache[it.id];
        if (!a) return;
        a.vote = vote;
        if (a._lbPaint) a._lbPaint();
      },
      open: function (it) {
        var a = assetFor(it);
        var open = function () { window.__assetLightbox(it.full || it.img, a); };
        if (a.thread) return ensureLightbox(open);
        loadNotes().then(function (map) {
          a.thread = map[it.url] || [];
          ensureLightbox(open);
        });
      },
    };
  };
})();

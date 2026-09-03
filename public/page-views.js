/* page-views.js — ONE PAGE, TWO VIEWS (Aug 2026, Sophie: "I'm thinking the
   compare page, and tinder swipe shud be TWO views of the the same page, since
   they have the same content. that way I can swipe back and forth, and see
   them at full size, rather than opening and closing").

   A template page used to be EITHER a grid or a deck, so seeing one set both
   ways meant two pages and a trip back to the tab between them. Now every
   template page carries both, over the same items and — because both views
   have always posted to the same verdict doc under the same item ids — the
   same marks. Switching is a repaint, not a reload: nothing is re-fetched and
   nothing is lost.

     window.__pageViews({ data, start })      // 'swipe' | 'compare'

   `data` is the page's own payload (chat, sheet, items and/or groups, states,
   voice, help…). Whichever half is missing is derived: a grid's groups
   flatten into the deck's item list, and a deck's items become one-card
   groups, so a page posted either way opens either way.

   THE TWO VIEWS DISAGREE ABOUT THE PAGE ITSELF, which is what this file is
   really for:
     • the deck is ONE SCREEN — judge.js puts `jg-mombg` on the body (height
       100dvh, overflow hidden) and the page must not scroll;
     • the grid SCROLLS and wants the autoscroll pill;
   so the body class and the pill go on and off with the view. A deck's own
   `meta forge-pill off` can't do that job any more — it is a page-level
   decision and this is a per-view one. */
(function () {
  if (window.__pageViews) return;

  var css = document.createElement('style');
  css.textContent =
    // the switch: two words on a hairline, the house .acctabs pattern, with
    // the line measuring the lit one rather than counting tabs
    '.pv{position:relative;display:flex;border-bottom:1px solid var(--line);'
    + 'margin:0 0 12px;padding-right:64px;}'
    + '.pv button{flex:1 1 0;min-width:0;padding:7px 4px 9px;border:none;background:none;'
    + 'font:inherit;font-size:10px;letter-spacing:.08em;text-transform:uppercase;'
    + 'color:var(--ink2);-webkit-tap-highlight-color:transparent;}'
    + '.pv button.on{color:var(--ink);}'
    + '.pv::after{content:"";position:absolute;left:0;bottom:-1px;height:2px;'
    + 'width:var(--pvw,0);background:var(--ink);transform:translateX(var(--pvx,0));'
    + 'transition:transform .2s ease,width .2s ease;}'
    // ON THE DECK the switch rides in her own chrome: her cream, her rule,
    // and inside the 22px gutter every other row there shares
    // …and it owes the NOTCH when the viewer's bar is gone (2026-09-03): the
    // parent hands the inset down as `--forgetop`, because env() is 0 in a
    // nested browsing context and this row is the topmost thing on screen
    + '.jg-mombg .pv{border-bottom-color:#E7DECF;margin:0;flex:none;'
    + 'padding:var(--forgetop,0px) 22px 0;}'
    + '.jg-mombg .pv button{color:#8A7F6E;}'
    + '.jg-mombg .pv button.on{color:#262016;}'
    + '.jg-mombg .pv::after{background:#C25E4C;}'
    // THE DECK'S HEIGHT CHAIN RUNS THROUGH THIS WRAPPER. judge.js sizes itself
    // off 100% of its mount, and its mount used to be a direct child of .wrap;
    // the two-view page put a div in between, which left the card floating at
    // the top of a half-height box with the screen empty under the note. So
    // the wrapper is a full-height flex column and the deck takes what the
    // switch does not.
    + '.jg-mombg #pageviews{height:100%;display:flex;flex-direction:column;min-height:0;}'
    + '.jg-mombg #judge{flex:1;min-height:0;}'
    // one screen: no pill over a deck, whatever the host injected
    + '.jg-mombg .float{display:none !important;}'
    // AND NO PAGE TITLE OVER A DECK (2026-09-03, Sophie: "spacing is weird").
    // The <h1> is a per-PAGE decision (page-templates drops it for a `deck`)
    // and the deck is a per-VIEW one — so the swipe view of a GRID-posted page
    // drew the title in 26px serif above her chrome, under the app viewer's
    // own bar, which is the same name a THIRD time. Measured at 390x844 with
    // her 47px inset: bar 0-55, h1 55-78, and the card starting 119px down a
    // screen her design fills. Hidden per view rather than dropped, so the
    // compare half keeps its heading (and compare.js's "?" its mount) and
    // every page already posted gets this with nothing re-posted.
    + '.jg-mombg .wrap>h1{display:none;}'
    + '[hidden]{display:none !important;}';
  document.head.appendChild(css);

  /** a deck's items as one-card groups — the grid's rows */
  function groupsOf(data) {
    if (data.groups && data.groups.length) return data.groups;
    return (data.items || []).map(function (it) { return { items: [it] }; });
  }

  /* ── SPREADS (Aug 2026, Sophie: "so I can leave a note per card, or per
     spread. same w heart") ────────────────────────────────────────────────
     A page is spreads holding cards. A mark can land on either, and both go
     to the same verdict doc — a spread just needs a key of its own.

     THE `s:` PREFIX IS WHAT KEEPS THEM APART. Item ids are cut down to
     [a-z0-9_-] when they are derived (page-templates deriveId), so a colon
     can never appear in one and a spread key can never collide with a card's.
     The id is derived HERE, from the label and the position, rather than
     stored: page data is frozen the day it is posted, and deriving it means
     every page already out there gets spread marks too.

     A ONE-CARD SPREAD GETS NO KEY OF ITS OWN — its card's mark IS the mark,
     and a second heart for the same picture would be two answers to one
     question. So only a spread of 2+ is markable as a spread. */
  function spreadsOf(data) {
    var taken = {};
    return groupsOf(data).map(function (g, i) {
      var items = g.items || [];
      var sp = { label: g.label || '', items: items };
      if (items.length > 1) {
        var base = String(g.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '').slice(0, 40) || ('spread-' + (i + 1));
        var id = base; var n = 2;
        while (taken[id]) { id = base + '-' + n; n += 1; }
        taken[id] = 1;
        sp.id = 's:' + id;
      }
      return sp;
    });
  }

  /* ── ONE CARD AT A TIME IS THE DEFAULT (2026-09-03, Sophie, on "Playground
     triangle hearts v1 (19)": "as a rule tinder compare shud default to 1
     unless they're comparing something specific") ────────────────────────────
     Every group used to become ONE swipe card holding all of it side by side,
     which is right for the two-up picker it was built for and falls apart the
     moment a group is a LISTING rather than a comparison. `.jg-spread` is
     `flex:1 1 0` with no wrap, so the pictures just divide the card between
     them — her 19-card group drew 11px-wide pictures under a row of "this one"
     buttons overlapping each other into an unreadable stack.

     SPREAD_MAX IS MEASURED, NOT CHOSEN — the real page at her 390pt viewport:
       2 across → 169px pictures, the "this one" button fits with slack
       3 across → 110px, fits
       4 across →  81px against a 72px button, no slack left
       5 across →  63px, the button squeezed to its own text
       9 across →  31px pictures (16px TALL) and the buttons OVERFLOW
      19 across →  11px, the screenshot she sent
     So 3 is the last size where a picture is big enough to compare and every
     control still fits its column, and 4+ is a listing wearing a comparison's
     clothes. Measured over her 30 most recent template pages the same day, the
     group sizes are 1×60, 2×1, 3×40, 4-10×72, 19×1 — so this splits the
     inventory buckets (attributes, hearts, panels) and leaves the quality
     ladders and the three-proposal sets exactly as they were.

     THE SPREAD IS UNTOUCHED IN THE OTHER VIEW, deliberately: `spreadsOf` still
     hands the grid its groups, so the label, the ruled-off row and the `s:`
     key are all still there in COMPARE, which is the view a big group reads
     correctly in. A split group's spread mark therefore lives in compare only
     — no verdict is lost either way, because review.js counts CARD ids and a
     spread mark already decides every card under it.

     Splitting must never CHANGE the cards, so each one is copied and the
     group's name rides as its eyebrow — she still knows which pile a card came
     out of, the way the grid's heading tells her. */
  var SPREAD_MAX = 3;

  function itemsOf(data) {
    var out = [];
    spreadsOf(data).forEach(function (sp) {
      if (!sp.id) { out.push(sp.items[0]); return; }
      if (sp.items.length <= SPREAD_MAX) {
        out.push({ id: sp.id, label: sp.label, cards: sp.items });
        return;
      }
      sp.items.forEach(function (c) {
        // copy — these are the GRID's own objects, and an eyebrow written onto
        // one would show up in the other view too
        out.push(sp.label && !(c && c.eyebrow)
          ? Object.assign({}, c, { eyebrow: sp.label })
          : c);
      });
    });
    return out;
  }

  window.__pageViews = function (opts) {
    var data = opts.data || {};
    var host = document.querySelector(opts.mount || '#pageviews');
    if (!host) return;
    var view = opts.start === 'compare' ? 'compare' : 'swipe';
    var started = {};

    var row = document.createElement('div');
    row.className = 'pv';
    var bSwipe = document.createElement('button');
    bSwipe.type = 'button'; bSwipe.textContent = 'Swipe';
    var bGrid = document.createElement('button');
    bGrid.type = 'button'; bGrid.textContent = 'Compare';
    row.appendChild(bSwipe); row.appendChild(bGrid);

    var deck = document.createElement('div'); deck.id = 'judge';
    var grid = document.createElement('div'); grid.id = 'grid';
    host.appendChild(row); host.appendChild(deck); host.appendChild(grid);

    function line() {
      var on = row.querySelector('button.on');
      if (!on) return;
      var r = row.getBoundingClientRect(); var t = on.getBoundingClientRect();
      if (!t.width) return;
      row.style.setProperty('--pvw', t.width + 'px');
      row.style.setProperty('--pvx', (t.left - r.left - row.clientLeft) + 'px');
    }

    function show(which) {
      view = which;
      var swiping = which === 'swipe';
      bSwipe.classList.toggle('on', swiping);
      bGrid.classList.toggle('on', !swiping);
      deck.hidden = !swiping;
      grid.hidden = swiping;
      // the body class is the DECK's, so it goes on and off with the view —
      // left on, the grid could not scroll; taken off, the deck would
      if (swiping && !started.swipe) {
        started.swipe = window.__judge(Object.assign({}, data, {
          mount: '#judge', items: itemsOf(data), look: 'mom',
          // BROWSE IS THE DECK'S DEFAULT, and only the deck template's own
          // validator was setting it — so a GRID-posted page's swipe view
          // came up without it, and marking a card jumped her to the piles
          // instead of leaving her on it ("a mark never moves the deck").
          browse: data.browse === false ? false : true,
        })) || {};
      } else if (!swiping && !started.compare) {
        started.compare = window.__grid(Object.assign({}, data, {
          mount: '#grid', groups: spreadsOf(data),
        })) || {};
      } else {
        // COMING BACK: both views write the same verdict doc under the same
        // item ids, so the one she returns to only has to re-read it. Marks
        // made in the other view appear; her place in the deck is kept.
        var h = swiping ? started.swipe : started.compare;
        if (h && h.refresh) h.refresh();
      }
      // the body class is the DECK's — the grid could not scroll with it on,
      // and the deck would scroll without it
      document.body.classList.toggle('jg-mombg', swiping);
      // THE VIEWER'S BAR IS THE DECK'S TO SPEND (2026-09-03, Sophie: "headers
      // unnecessary - takes space. push it down"). It shows the same title
      // the page carries and costs ~94px of a screen the deck fills exactly;
      // the grid, which scrolls, keeps it. The chevron is not lost — a
      // template page is opened with `back=1`, so the deck draws one in the
      // top row it already has.
      try {
        if (window.parent && window.parent !== window
            && typeof window.parent.__pageChrome === 'function') {
          window.parent.__pageChrome(!swiping);
        }
      } catch (_) { /* cross-origin host — leave its chrome alone */ }
      // …and the pill is taken off the DECK by hand as well as by the CSS
      // rule above (Aug 2026, Sophie: "why is the pill there tho it doesn't
      // work" — with a screenshot of it over the swipe view, which the rule
      // says cannot happen and which no local run reproduced). An inline
      // display beats every stylesheet, so whatever out-specified or never
      // reached that rule on her phone cannot keep the pill on screen.
      var pill = document.querySelector('.float');
      if (pill) pill.style.display = swiping ? 'none' : '';
      // …and the APP's pill, which lives in the parent (see judge.js's own
      // note): the deck asks it down per inner view, so all this half has to
      // do is give it back the moment the grid — which really scrolls — shows.
      try {
        if (!swiping && window.parent && window.parent !== window
            && typeof window.parent.__pagePill === 'function') {
          window.parent.__pagePill(true);
        }
      } catch (_) { /* cross-origin host — leave its chrome alone */ }
      line();
      window.scrollTo(0, 0);
      // …and the GRID puts her back where she was (compare.js __pagePlace):
      // a swipe round trip, or a fresh open of a long page, lands on the
      // chapter she left rather than at the top. The deck is one screen and
      // keeps its own place on its verdict doc.
      if (!swiping && started.compare && started.compare.place) started.compare.place.restore();
    }

    // A CARD'S LINK TO A CHAT OPENS THE THREAD IN THE APP (2026-09-02, Sophie
    // on the archive deck: "the chat links don't work"). Both views render an
    // item's `link` as a target=_blank anchor — right for a browser, where a
    // new tab is the honest answer — but inside the Chats app the page runs
    // in the page viewer's IFRAME, and that viewer's click interceptor
    // deliberately leaves _blank links alone, so the tap reached nothing at
    // all. The morning brief solved the same trip with the parent's
    // __openThread bridge (close the viewer, open the thread, push the way
    // back); this is that bridge for every template page, in the one host
    // both views share. Capture phase, so it runs before either view's own
    // handlers. The href stays as it is: in a browser, or for a chat the
    // registry does not know (the bridge answers false), the link does its
    // ordinary job.
    host.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.jg-momlink a, .gd-link a') : null;
      if (!a) return;
      var chat = null;
      try {
        var u = new URL(a.href);
        // by PATH, not origin: a script posts the deck with the absolute
        // onrender url, and the app's registry is the only judge of whether
        // that chat is one of ours (the bridge answers false otherwise)
        if (/^\/chats\/?$/.test(u.pathname)) chat = u.searchParams.get('chat');
      } catch (_) { return; }
      if (!chat) return;
      try {
        if (window.parent && window.parent !== window
            && typeof window.parent.__openThread === 'function'
            && window.parent.__openThread(chat) === true) {
          e.preventDefault(); e.stopPropagation();
        }
      } catch (_) { /* cross-origin host — let the link do its job */ }
    }, true);

    bSwipe.addEventListener('click', function () { show('swipe'); });
    bGrid.addEventListener('click', function () { show('compare'); });
    window.addEventListener('resize', line, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(line);

    show(view);
    return { show: show, view: function () { return view; } };
  };
})();

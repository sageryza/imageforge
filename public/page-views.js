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
    + '.jg-mombg .pv{border-bottom-color:#E7DECF;margin:0;padding:0 22px;flex:none;}'
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
    + '[hidden]{display:none !important;}';
  document.head.appendChild(css);

  /** a grid's groups flattened, in order — the deck's item list */
  function itemsOf(data) {
    if (data.items && data.items.length) return data.items;
    var out = [];
    (data.groups || []).forEach(function (g) {
      (g.items || []).forEach(function (it) { out.push(it); });
    });
    return out;
  }
  /** a deck's items as one-card groups — the grid's rows */
  function groupsOf(data) {
    if (data.groups && data.groups.length) return data.groups;
    return (data.items || []).map(function (it) { return { items: [it] }; });
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
        })) || {};
      } else if (!swiping && !started.compare) {
        started.compare = window.__grid(Object.assign({}, data, {
          mount: '#grid', groups: groupsOf(data),
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
      line();
      window.scrollTo(0, 0);
    }

    bSwipe.addEventListener('click', function () { show('swipe'); });
    bGrid.addEventListener('click', function () { show('compare'); });
    window.addEventListener('resize', line, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(line);

    show(view);
    return { show: show, view: function () { return view; } };
  };
})();

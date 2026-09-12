/* THE LIST · TILES · 3/4 SWITCH — ONE FILE, EVERY FEED (2026-09-12, Sophie,
 * asking for the new Stitch tool: "could you reuse the shell so I can switch
 * between tiles and list view?").
 *
 * The switch was born on the Playground (2026-08-25: LIST is a box per run,
 * TILES is a wall `--cols` across, and the third segment is the NUMBER, 3 or
 * 4 — "I asked for the button to say three or four, not a picture") and was
 * COPIED onto Footage on 2026-09-09. Stitch would have been the third copy —
 * the exact shape the three-way toggle was lifted out of three pages for
 * (/tritoggle.css, Aug 2026): three hand-typed twins, two palettes, and only
 * a test comparing files property by property ever noticing one drift.
 *
 * So this is the ONE implementation of the switch's BEHAVIOUR, and
 * /viewswitch.css is the one paint. A page owns three things and nothing
 * else: WHICH view is showing (the callback), its OWN storage key, and what
 * a tap on the number means to its layout (it reads `--cols` off the root).
 *
 *   var vs = window.__viewSwitch({
 *     mount: '#feedbar',          // where the box goes (or where it already is)
 *     key: 'footage',             // → localStorage footage_view / footage_cols
 *     cols: [3, 4],               // the number segment's stops (default [3, 4])
 *     view: 'list',               // the opening view (default 'list')
 *     onView: function (view) {…} // show/hide the two surfaces, repaint
 *   });
 *   vs.view()  → 'list' | 'tiles'      vs.cols() → 3 | 4
 *   vs.setView('tiles')                vs.apply()   // repaint both (after a load)
 *
 * IT ADOPTS THE MARKUP IF THE PAGE ALREADY HAS IT. The ids — #v-list,
 * #v-tiles, #v-cols — are what two dozen headless tests tap and measure, so a
 * page that carries the `.viewtog` box keeps it and this file only wires it;
 * a page with an empty mount gets the same box built. Either way the ids and
 * the storage keys are byte-for-byte what they were, so nothing on a phone
 * cached from before this file forgets its view.
 *
 * TWO STATES IS NOT THE CYCLE THE HOUSE RULE FORBIDS: the number segment has
 * exactly two stops, so a tap has nowhere else it could mean — "THREE OPTIONS
 * = A THREE-WAY TOGGLE" is about a control with stops she can AIM at.
 *
 * ONE VARIABLE, `--cols` ON THE ROOT, so a tile wall and a card's own row of
 * pictures in list view read the same number and the segment is never a dead
 * control in either view (the Playground's rule; Footage's `.usedrefs` reads
 * it too). Sticky, all three choices — the view, the columns.
 *
 * Nothing in here touches the network. Test: node scripts/test-viewswitch.js
 * (nobody keeps a second copy, and the real box measured in a browser). */
(function () {
  'use strict';
  function store(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function keep(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function viewSwitch(opts) {
    opts = opts || {};
    var key = String(opts.key || 'feed');
    var COLS = (Array.isArray(opts.cols) && opts.cols.length) ? opts.cols.slice() : [3, 4];
    var initial = opts.view === 'tiles' ? 'tiles' : 'list';
    var onView = typeof opts.onView === 'function' ? opts.onView : function () {};
    var onCols = typeof opts.onCols === 'function' ? opts.onCols : function () {};
    var mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) throw new Error('viewswitch: no mount');

    // adopt the page's own box, or build the one box
    var box = mount.classList && mount.classList.contains('viewtog') ? mount : mount.querySelector('.viewtog');
    if (!box) {
      box = document.createElement('div');
      box.className = 'viewtog';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'How to read the feed');
      box.innerHTML = '<button type="button" id="v-list">List</button>'
        + '<button type="button" id="v-tiles">Tiles</button>'
        + '<button type="button" class="colseg" id="v-cols"></button>';
      mount.insertBefore(box, mount.firstChild);
    }
    var bList = box.querySelector('#v-list'), bTiles = box.querySelector('#v-tiles'), bCols = box.querySelector('#v-cols');
    if (!bList || !bTiles || !bCols) throw new Error('viewswitch: the box needs #v-list, #v-tiles and #v-cols');

    function view() { var v = store(key + '_view'); return v === 'tiles' ? 'tiles' : (v === 'list' ? 'list' : initial); }
    function cols() {
      var n = parseInt(store(key + '_cols'), 10);
      return COLS.indexOf(n) >= 0 ? n : COLS[0];
    }
    function applyCols() {
      var n = cols(), next = COLS[(COLS.indexOf(n) + 1) % COLS.length];
      document.documentElement.style.setProperty('--cols', String(n));
      bCols.textContent = String(n);                       // the NUMBER, never bars
      bCols.setAttribute('aria-label', n + ' a row — tap for ' + next);
      bCols.title = n + ' a row';
      onCols(n);
    }
    function applyView() {
      var tiles = view() === 'tiles';
      bList.classList.toggle('on', !tiles);
      bTiles.classList.toggle('on', tiles);
      onView(tiles ? 'tiles' : 'list');
    }
    function setView(v) { keep(key + '_view', v === 'tiles' ? 'tiles' : 'list'); applyView(); }
    function setCols(n) { if (COLS.indexOf(n) < 0) return; keep(key + '_cols', String(n)); applyCols(); }

    bList.addEventListener('click', function () { setView('list'); });
    bTiles.addEventListener('click', function () { setView('tiles'); });
    bCols.addEventListener('click', function () { setCols(COLS[(COLS.indexOf(cols()) + 1) % COLS.length]); });

    var api = {
      box: box, view: view, cols: cols, setView: setView, setCols: setCols,
      applyView: applyView, applyCols: applyCols,
      apply: function () { applyCols(); applyView(); },
    };
    if (opts.apply !== false) api.apply();
    return api;
  }
  window.__viewSwitch = viewSwitch;
})();

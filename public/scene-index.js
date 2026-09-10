/* scene-index.js — THE SCENES-INDEX KIT (2026-09-10, Sophie: "add send to
   footage button · and chapter buttons etc · so light blue ward, nautch and
   ticky tack all have all features").

   A scenes-index page is the grid of little 3-D keys — one key a scene, in
   shooting order, a tap opening that scene's card on its belt page. There are
   three of them (the ward film in light blue, the Nautchaug Boyfriend's in
   beige, Ticky Tack in red) and each was built by a chat copying its
   neighbour, so every feature landed on exactly one of them:

     the Send-to-Footage key on a tile      ward only
     the chapter rail down the right side   nautch only
     folding a chapter away                 nautch only

   That is the belt drift (docs/mental-hospital/belt/VERSIONS.md) arriving one
   surface up. So the three behaviours live HERE, in one served file, and a
   page opts in with one line after /compare.js:

     <script src="/scene-index.js"></script>

   A posted Compare page is FROZEN, so this being a served file is the whole
   point: the next fix reaches all three the day it deploys, with nothing
   re-posted.

   IT READS THE PAGE IT IS ON AND ADDS NOTHING TWICE. Everything it needs is
   already in the markup every one of these pages has:

     .grid          the wall of keys
     .ep            a chapter heading, a grid child spanning the row
     a.b[href]      a key, href="/api/chatfeed/page/<belt>#j-<card key>"

   Each half is built only when the page does not already have it — the
   nautch page keeps its own fold and rail, the ward page keeps its own
   footage keys — so this can be added to a live page without taking anything
   away from it. */
(function () {
  var grid = document.querySelector('.grid');
  if (!grid) return;
  var kids = function () { return [].slice.call(grid.children); };
  var heads = kids().filter(function (el) { return el.classList && el.classList.contains('ep'); });

  function css(id, text) {
    if (document.getElementById(id)) return;
    var st = document.createElement('style');
    st.id = id; st.textContent = text;
    document.head.appendChild(st);
  }
  var enc = encodeURIComponent;

  /* ── WHICH TILES BELONG TO WHICH HEADING ────────────────────────────────
     A heading owns every grid child after it until the next heading. The
     child, not the tile: the ward wraps each key in a `.cell` (its footage
     key rides that corner) and the other two do not, so hiding has to reach
     whatever is actually in the grid. */
  function ownership() {
    var own = heads.map(function () { return []; }), at = -1;
    kids().forEach(function (el) {
      if (!el.classList) return;
      if (el.classList.contains('ep')) at = heads.indexOf(el);
      else if (at >= 0) own[at].push(el);
    });
    return own;
  }

  /* The key her folds are remembered under. It is the page's TITLE with the
     version marker taken off, never the url: a new version is a new page id,
     and a chapter she folded away this morning must not come back open when
     the chat re-posts the page at lunchtime. */
  function memKey() {
    var h1 = document.querySelector('h1');
    var t = (h1 ? h1.textContent : '').replace(/\bv\d+\b.*$/, '').replace(/\W+/g, '-')
      .replace(/^-|-$/g, '').toLowerCase();
    return 'sceneindex.shut.' + (t || location.pathname);
  }

  /* ── THE CHAPTER HEADINGS FOLD ──────────────────────────────────────────
     THE WHOLE HEADING IS THE FOLD (the house rule — never a caret to hit),
     and it becomes a real <button>, which is what keeps a tap on it out of
     compare.js's tap-to-autoscroll. The count shows only while it is SHUT:
     open, the tiles are right there (the archive summary's don't-say-it-twice
     rule). A page whose headings are already buttons has its own fold and is
     left alone. */
  var shut = {}, own = [], folds = null;
  function buildFolds() {
    if (!heads.length || heads[0].tagName === 'BUTTON') return null;
    css('sx-fold-css',
      '.grid button.ep{display:flex;align-items:center;gap:7px;width:100%;text-align:left;'
      + 'background:none;border:0;box-shadow:none;padding:0;cursor:pointer;'
      + '-webkit-tap-highlight-color:transparent;color:inherit}'
      + '.grid button.ep .epv{width:13px;height:13px;flex:none;transition:transform .15s;opacity:.75}'
      + '.grid button.ep.shut .epv{transform:rotate(-90deg)}'
      + '.grid button.ep .epc{display:none}'
      + '.grid button.ep.shut .epc{display:inline;font-weight:400;letter-spacing:.06em;opacity:.6;order:3}'
      + '.grid > .sx-hid{display:none}');
    var CHEV = '<svg class="epv" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M6 9l6 6 6-6"/></svg>';
    heads = heads.map(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = p.className;                 // keeps the page's own .ep look
      if (p.id) b.id = p.id;
      b.setAttribute('aria-expanded', 'true');
      b.innerHTML = CHEV + '<span class="epc"></span>';
      b.appendChild(document.createTextNode(p.textContent.trim()));
      p.parentNode.replaceChild(b, p);
      return b;
    });
    own = ownership();
    try { shut = JSON.parse(localStorage.getItem(memKey()) || '{}') || {}; } catch (e) { shut = {}; }
    function save() { try { localStorage.setItem(memKey(), JSON.stringify(shut)); } catch (e) {} }
    function paint(i) {
      var on = !!shut[i];
      heads[i].classList.toggle('shut', on);
      heads[i].setAttribute('aria-expanded', on ? 'false' : 'true');
      var n = own[i].length;
      heads[i].querySelector('.epc').textContent = n + ' scene' + (n === 1 ? '' : 's');
      own[i].forEach(function (el) { el.classList.toggle('sx-hid', on); });
    }
    heads.forEach(function (h, i) {
      paint(i);
      // FOLDING KEEPS THE TITLE UNDER HER FINGER. Everything below a folded
      // chapter moves up, and at the bottom of the page the browser also
      // clamps the scroll — so the heading she just tapped slides away from
      // her. Anchor it at the y it was at, and if a clamped page cannot hold
      // it there, pull it back into view.
      h.addEventListener('click', function () {
        var was = h.getBoundingClientRect().top;
        shut[i] = !shut[i]; save(); paint(i);
        if (folds && folds.fit) folds.fit();
        var now = h.getBoundingClientRect().top;
        if (Math.abs(now - was) > 1) window.scrollTo(0, Math.max(0, window.scrollY + (now - was)));
        var t = h.getBoundingClientRect().top;
        if (t < 0 || t > window.innerHeight - 46) window.scrollTo(0, Math.max(0, window.scrollY + t - 14));
      });
    });
    return { open: function (i) { if (shut[i]) { shut[i] = false; save(); paint(i); } } };
  }

  /* ── THE CHAPTER RAIL ───────────────────────────────────────────────────
     The little buttons down the right side that jump to a chapter, in the
     64px the grid already leaves for the injected pill, below whatever that
     pill is using. Skipped on a page that already has one. */
  /* A 56px KEY HOLDS ABOUT ONE WORD, so the heading is cut into a word she can
     read at a glance and a qualifier under it. A DASH means the chapter is
     named after the dash ("Part one — the city" → CITY over PART ONE); a comma
     or a slash means it is named before one ("Hers, must stay" → HERS over
     MUST STAY); with neither, the first couple of words lead.
     Then the key is boiled down to ONE WORD when the phrase is too long to
     render — the LONGEST word in it, which is the distinctive one: "the two
     beginnings" → BEGINNINGS, "recommend keeping" → RECOMMEND, "Ms. O'Hara" →
     O'HARA. Measured on her three pages, that is the difference between a rail
     of words and a rail of "TWO BEGI…" / "RECOMM…" / "SCULPTU…". The full
     heading is always on the button's title and aria-label. */
  function keyWord(p) {
    p = p.replace(/^(the|a|an)\s+/i, '').trim();
    if (p.length <= 9) return p;
    var w = p.split(/\s+/).filter(function (x) { return x.replace(/\W/g, '').length > 2; });
    if (w.length < 2) return p;
    var best = w[0];
    w.forEach(function (x) {
      if (x.replace(/\W/g, '').length > best.replace(/\W/g, '').length) best = x;
    });
    return best;
  }
  function railWords(t) {
    t = (t || '').replace(/\s+/g, ' ').trim();
    var tag = t, name = '';
    var dash = t.split(/\s+[—–]\s+|\s+-\s+/);
    if (dash.length > 1) { tag = dash[dash.length - 1]; name = dash.slice(0, -1).join(' '); }
    else if (/[,/]/.test(t)) {
      var c = t.split(/\s*[,/]\s*/);
      tag = c[0]; name = c.slice(1).join(' ').trim();
    } else {
      // no separator: the first couple of words are the key, the rest hangs
      // under it — "Five moments with Thomas that must stay"
      var w = t.split(' ');
      if (w.length > 2) { tag = w.slice(0, 2).join(' '); name = w.slice(2).join(' '); }
    }
    return {
      tag: keyWord(tag).toUpperCase(),
      name: name.replace(/^(the|a|an)\s+/i, '').trim().toUpperCase(),
    };
  }

  function buildRail() {
    if (!heads.length || document.querySelector('.rail')) return;
    css('sx-rail-css',
      '.rail{position:fixed;right:6px;bottom:10px;width:56px;z-index:8;display:flex;'
      + 'flex-direction:column;gap:5px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}'
      + '.rl{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
      + 'min-height:38px;padding:4px 2px;background:var(--surface2,#f0eadf);border:1px solid #d9d2c4;'
      + 'border-radius:6px;color:var(--ink2,#6b6255);cursor:pointer;'
      + '-webkit-tap-highlight-color:transparent;box-shadow:none}'
      + '.rl:active{background:#e6dfd2}'
      + '.rl b{color:var(--ink,#2a2620);font:700 11.5px/1 -apple-system,\'Helvetica Neue\',sans-serif;'
      + 'letter-spacing:.01em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.rl.t5 b{font-size:10px}.rl.t6 b{font-size:9.5px}.rl.t7 b{font-size:8.5px}.rl.t8 b{font-size:8px}'
      + '.rl.t9 b{font-size:7px}.rl.t10 b{font-size:6.5px}'
      + '.rl i{font:700 7px/1.05 -apple-system,\'Helvetica Neue\',sans-serif;font-style:normal;'
      + 'letter-spacing:.03em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');
    var rail = document.createElement('div');
    rail.className = 'rail';
    heads.forEach(function (h, i) {
      var full = (h.textContent || '').replace(/^\s*\d+ scenes?\s*/, '').trim();
      var w = railWords(full);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rl';
      b.title = full; b.setAttribute('aria-label', 'Go to ' + full);
      b.innerHTML = '<b></b>' + (w.name ? '<i></i>' : '');
      b.querySelector('b').textContent = w.tag;
      if (w.tag.length > 4) b.classList.add('t' + Math.min(w.tag.length, 10));
      if (w.name) b.querySelector('i').textContent = w.name;
      b.addEventListener('click', function () {
        if (window.__scrollStop) { try { window.__scrollStop(); } catch (e) {} }
        if (folds) folds.open(i);                             // opens it, then goes
        var y = window.scrollY + h.getBoundingClientRect().top - 14;
        window.scrollTo({ top: y < 0 ? 0 : y, behavior: 'smooth' });   // never scrollIntoView
      });
      rail.appendChild(b);
    });
    document.body.appendChild(rail);

    // WHERE THE RAIL STARTS: the lowest bottom of anything fixed in that
    // column, MEASURED every frame she scrolls — the pill is conditional, its
    // arrows come and go, and her safe-area inset pushes the whole stack down.
    // A Compare page opened in the app runs in an IFRAME and the pill she taps
    // there is drawn by the PARENT (mkPagePill in chats.html), so a scan of
    // our own document finds nothing and the rail starts UNDER her pill. Same
    // origin, so the parent is readable: measure its pill and subtract the
    // frame's own offset. FLOOR of 150 when nothing is measurable, because a
    // rail under an unseen pill is the failure worth avoiding.
    var SEL = ['.float', '#spd', '#ptop', '#pbot', '#pillnotch'];
    function hosts() {
      var out = [{ doc: document, win: window, off: 0, w: window.innerWidth }];
      try {
        var fe = window.frameElement;
        if (fe && window.parent && window.parent !== window && window.parent.document) {
          var fr = fe.getBoundingClientRect();
          out.push({ doc: window.parent.document, win: window.parent, off: fr.top, w: window.parent.innerWidth });
        }
      } catch (e) {}
      return out;
    }
    function fit() {
      var lo = 0, any = false;
      hosts().forEach(function (h) {
        var seen = [];
        SEL.forEach(function (s) {
          [].slice.call(h.doc.querySelectorAll(s)).forEach(function (e) { seen.push(e); });
        });
        [].slice.call(h.doc.body ? h.doc.body.children : []).forEach(function (e) {
          if (e !== rail && h.win.getComputedStyle(e).position === 'fixed') seen.push(e);
        });
        seen.forEach(function (e) {
          if (e === rail || rail.contains(e)) return;
          // the app's viewer is a fixed inset:0 box HOLDING this frame — an
          // ancestor, and any full-width bar or overlay: not a pill column
          try { if (window.frameElement && e.contains(window.frameElement)) return; } catch (_) {}
          var cs = h.win.getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
          var r = e.getBoundingClientRect();
          if (!r.width || !r.height || r.width > 140 || r.height > 360) return;
          if (!(r.right > h.w - 74 && r.top - h.off < 440)) return;
          any = true; lo = Math.max(lo, r.bottom - h.off);
          // its label may hang below the box it sits in — take the children too
          [].slice.call(e.querySelectorAll('*')).forEach(function (c) {
            var q = c.getBoundingClientRect(); if (q.height) lo = Math.max(lo, q.bottom - h.off);
          });
        });
      });
      var top = any ? Math.max(lo + 12, 14) : 150;
      // never a rail with no room: if what we measured leaves under 120px, it
      // was not the pill we were looking at
      if (window.innerHeight - top < 120) top = 150;
      rail.style.top = top + 'px';
    }
    fit();
    if (folds) folds.fit = fit;
    var tick = false;
    function later() {
      if (tick) return; tick = true;
      requestAnimationFrame(function () { tick = false; fit(); });
    }
    addEventListener('scroll', later, true);
    addEventListener('resize', later);
    if (window.ResizeObserver) new ResizeObserver(later).observe(document.documentElement);
    [120, 400, 900, 1800].forEach(function (ms) { setTimeout(fit, ms); });  // the pill arrives late
  }

  /* ── SEND TO FOOTAGE ────────────────────────────────────────────────────
     (2026-09-10, Sophie: "a button that sends it w refs to footage".) A small
     key in the tile's own top-right corner — its OWN tap target (a 30px hit
     area behind an 18px mark, never overflowing the tile, so the neighbour's
     key is never under it), and a real link to the Footage tool: on her phone
     the app opens the tool.

     The scene's words and references live on its BELT PAGE, not here, so a tap
     reads that page (same origin — the posted html, cached once) and the
     verdict sheet it saves her edits on, assembles the hand-off exactly the way
     the belt's own button does, writes `footage_handoff`, and lets the link go.
     Nothing is sent by this tap; the star on the Footage page is still hers.

     THE BELT NAMES ITSELF, so there is no map to keep: every belt page carries
     `var CHAT='…', SHEET='…'` and every key carries its belt's page id and its
     card key in its own href. */
  var BELT_HREF = /\/api\/chatfeed\/page\/([A-Za-z0-9_-]+)#j-(.+)$/;
  var pages = {}, sheets = {};
  function beltOf(id) {
    return pages[id] || (pages[id] = fetch('/api/chatfeed/page/' + id)
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var m = /var\s+CHAT\s*=\s*'([^']*)'\s*,\s*SHEET\s*=\s*'([^']*)'/.exec(t);
        return {
          doc: new DOMParser().parseFromString(t, 'text/html'),
          chat: m ? m[1] : '', sheet: m ? m[2] : '',
        };
      }));
  }
  function sheetOf(id) {
    return sheets[id] || (sheets[id] = beltOf(id).then(function (b) {
      if (!b.chat || !b.sheet) return {};
      return fetch('/api/chatfeed/verdict?chat=' + enc(b.chat) + '&sheet=' + enc(b.sheet))
        .then(function (r) { return r.json(); })
        .then(function (d) { return (d && d.texts) || {}; })
        .catch(function () { return {}; });
    }));
  }
  function kindOf(u) {
    return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) ? 'video'
      : /\.(mp3|m4a|wav|aac|ogg)(\?|$)/i.test(u) ? 'audio' : 'image';
  }
  function slotNo(t) { var m = /(?:video|image|audio)\s*(\d+)/i.exec(t || ''); return m ? parseInt(m[1], 10) : 999; }

  function handoff(belt, texts, key, title) {
    var card = belt.doc.querySelector('.card[data-key="' + key + '"]');
    if (!card) throw new Error('no card');
    function box(sel) { var e = card.querySelector(sel); return e ? e.value : ''; }
    // HER EDIT WINS. The posted html holds the text as the chat wrote it; what
    // she has typed since lives on the verdict sheet, and the belt page fills
    // its own boxes from there at runtime — which never happens in a document
    // we only parsed. Different belts save the plain box under different item
    // keys, so all three spellings are tried before falling back to the box.
    function field(f) {
      var k = f ? key + '.' + f : key;
      if (typeof texts[k] === 'string') return texts[k];
      if (!f && typeof texts[key + '.p'] === 'string') return texts[key + '.p'];
      return box('.p[data-key="' + key + '"]' + (f ? '[data-field="' + f + '"]' : ':not([data-field])'));
    }
    var prompt = ['cont', 'mine', ''].map(function (f) { return (field(f) || '').trim(); })
      .filter(Boolean).join('\n\n');
    // The newer belts publish their references as JSON beside the card's own
    // Send button — exact, already in slot order. The older ones are read off
    // the pictures they show, by the slot their caption names.
    var refs = [], rj = card.querySelector('.refjson[data-key="' + key + '"]');
    if (rj) { try { refs = JSON.parse(rj.textContent || '[]') || []; } catch (e) { refs = []; } }
    refs = refs.filter(function (r) { return r && r.url; }).map(function (r) {
      return { url: r.url, kind: r.kind || kindOf(r.url), name: r.name || '' };
    });
    if (!refs.length) {
      var vids = [], imgs = [];
      card.querySelectorAll('.vid a[href]').forEach(function (a) {
        var u = a.getAttribute('href');
        vids.push({ n: slotNo(a.parentNode ? a.parentNode.textContent : ''), url: u,
          kind: kindOf(u), name: (a.textContent || '').trim() });
      });
      card.querySelectorAll('.refs figure').forEach(function (f) {
        var im = f.querySelector('img'), c = f.querySelector('figcaption');
        if (!im) return;
        var t = (c && c.textContent) || '';
        imgs.push({ n: slotNo(t), url: im.getAttribute('src'), kind: 'image',
          name: t.replace(/^\s*(?:image|video|audio)\s*\d+\s*[—–-]\s*/i, '').trim() });
      });
      vids.sort(function (a, b) { return a.n - b.n; });
      imgs.sort(function (a, b) { return a.n - b.n; });
      refs = vids.concat(imgs).map(function (r) { return { url: r.url, kind: r.kind, name: r.name }; });
    }
    var s = parseInt(typeof texts[key + '.s'] === 'string' ? texts[key + '.s']
      : box('.secs[data-key="' + key + '"]'), 10);
    var h = { prompt: prompt, refs: refs, model: 'mini', res: '480p', ratio: '16:9',
      title: title, at: Date.now() };
    if (s > 0) h.seconds = s;
    if (belt.chat) h.from = belt.chat;
    return h;
  }

  var CLAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="m12.296 3.464 3.02 3.956"/><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z"/>'
    + '<path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m6.18 5.276 3.1 3.899"/></svg>';

  function buildFootage() {
    if (document.querySelector('.ff')) return;             // this page has its own
    var tiles = [].slice.call(grid.querySelectorAll('a.b[href]')).filter(function (a) {
      return BELT_HREF.test(a.getAttribute('href') || '');
    });
    if (!tiles.length) return;
    css('sx-ff-css',
      '.cell{position:relative}'
      + '.cell .b{width:100%;box-sizing:border-box;padding-top:9px}'
      + '.ff{position:absolute;top:2px;right:2px;width:16px;height:16px;display:flex;'
      + 'align-items:center;justify-content:center;background:#fff;'
      + 'border:1.5px solid var(--tileink,var(--ink,#26221c));border-radius:4px;'
      + 'color:var(--tileink,var(--ink,#26221c));text-decoration:none;'
      + '-webkit-tap-highlight-color:transparent}'
      + '.ff::before{content:"";position:absolute;top:-6px;right:-6px;bottom:-6px;left:-6px}'
      // A PAGE WITH ITS OWN FOLD HIDES THE TILE, NOT THE WRAPPER. The nautch
      // page's fold ran before this and holds references to the bare <a class="b">;
      // wrapping them here would leave a folded chapter as a row of empty grid
      // cells. The cell follows its own tile down.
      + '.grid > .cell:has(> .b.hid){display:none}'
      + '.ff svg{width:10px;height:10px;display:block}'
      + '.ff.busy{opacity:.45}');
    var ready = {};
    tiles.forEach(function (tile) {
      var m = BELT_HREF.exec(tile.getAttribute('href'));
      var id = m[1], key = m[2];
      var title = (tile.getAttribute('title') || tile.getAttribute('aria-label') || '')
        .replace(/^\s*\S+\s*·\s*/, '').trim();
      var cell = tile.parentNode;
      if (!cell || !cell.classList || !cell.classList.contains('cell')) {
        cell = document.createElement('div');
        cell.className = 'cell';
        tile.parentNode.insertBefore(cell, tile);
        cell.appendChild(tile);
      }
      var a = document.createElement('a');
      a.className = 'ff';
      a.href = location.origin + '/footage';
      a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('data-page', id); a.setAttribute('data-key', key);
      a.setAttribute('aria-label', 'Send to Footage — ' + title);
      a.title = 'Send to Footage';
      a.innerHTML = CLAP;
      cell.appendChild(a);

      function assemble() {
        return Promise.all([beltOf(id), sheetOf(id)]).then(function (r) {
          return handoff(r[0], r[1], key, title);
        });
      }
      // Warm the belt page under the thumb so the tap itself is one write.
      a.addEventListener('pointerdown', function () { beltOf(id); sheetOf(id); }, { passive: true });
      a.addEventListener('click', function (ev) {
        var k = id + '/' + key;
        if (ready[k]) {
          ready[k].at = Date.now();
          try { localStorage.setItem('footage_handoff', JSON.stringify(ready[k])); } catch (e) {}
          return;                                       // let the link go
        }
        ev.preventDefault();
        a.classList.add('busy');
        assemble().then(function (h) {
          ready[k] = h;
          try { localStorage.setItem('footage_handoff', JSON.stringify(h)); } catch (e) {}
          a.classList.remove('busy');
          var w = window.open(a.href, '_blank');
          if (!w) location.href = a.href;
        }).catch(function () {
          a.classList.remove('busy');
          alert('Could not read that scene off its belt page — open the card instead.');
        });
      });
    });
  }

  /* ── THE HELP CARD SAYS WHAT WAS ADDED ──────────────────────────────────
     compare.js keeps the help as a real node, so this appends a line rather
     than rewriting the page's own words — and only for the halves this page
     actually got. */
  function tellHelp(lines) {
    if (!lines.length) return;
    var card = document.querySelector('.cmp-helpcard');
    if (!card) return;
    var p = document.createElement('p');
    p.innerHTML = lines.join(' ');
    card.appendChild(p);
  }

  function start() {
    var told = [];
    // THE KEYS GO ON FIRST. A tile gains a `.cell` wrapper here, and it is the
    // wrapper that is then the grid's child — so a fold built before this one
    // would own the tiles and hide nothing (measured: six keys still showing
    // under a shut heading).
    var had = !!document.querySelector('.ff');
    buildFootage();
    if (!had && document.querySelector('.ff')) {
      told.push('<b>The little clapperboard on each key</b> opens the Footage tool with that '
        + 'scene already in the box — the reference lines and your words as they stand on the '
        + 'belt page right now, every reference in its slot. Nothing is sent until you press the star there.');
    }
    folds = buildFolds();
    if (folds) told.push('<b>Tap a chapter heading</b> to fold it away.');
    if (!document.querySelector('.rail')) told.push('<b>The little buttons down the right side</b> jump to a chapter.');
    buildRail();
    tellHelp(told);
  }

  // compare.js draws the help card when the page calls __compareHelp, which is
  // an inline script that may run after this one — so the help line waits a
  // beat rather than looking for a card that is not there yet.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
})();

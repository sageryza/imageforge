/* searchfilters.js — THE ADVANCED SEARCH DRAWER, one shell for every page.
 *
 * 2026-09-02, Sophie: "can u add settings - a toggle open advanced search in
 * all pages - reusable shell - playground meta assets etc · search by low
 * medium high, by date · you can put the heart x thing within the toggle".
 *
 * WHY IT IS A FILE. The Chats app already had this control — one `Filters`
 * chip, shut until she taps it, wearing its own state when something is
 * narrowed — and it lived as `buildFilters` inside chats.html, where no other
 * page could reach it. Meanwhile the Playground and Meta Assets each grew
 * their OWN filter row: three loose chips on a bar that is already fighting
 * the injected pill for width, with no room to add "only the high ones" or
 * "just this week" to either. That is the /tritoggle.css story exactly — one
 * control, three hand-copies, and only a test ever noticing a drift — so this
 * is the same answer: one shell, linked.
 *
 * THE SHAPE, and every rule in it is one the Chats drawer already earned:
 *
 *   - OPT IN. The drawer is SHUT until she taps the chip. A filter she is not
 *     using must never be a control she has to step over.
 *   - THE CHIP WEARS THE STATE while the drawer is shut ("♥ only · High"), so
 *     a filter she has forgotten can never go on quietly deleting results
 *     behind a closed drawer. Open, the rows say it in full and the chip goes
 *     back to its word — the same answer twice is worse than once.
 *   - LIT EITHER WAY, because lit is the half that is never redundant.
 *
 * TWO KINDS OF ROW, and which one a filter gets is decided by whether it has
 * an OFF state to spare:
 *
 *   kind:'tri'   a three-way toggle (/tritoggle.css) with the value spelled
 *                out beside it. This is the house pattern for `everything`
 *                plus the two OPPOSITE narrowings — "whose messages", "does
 *                it search the archive". The word CLEARS the filter; the
 *                track is AIMED (/tritoggle.js). Nothing cycles.
 *   kind:'chips' a row of chips, none lit = everything. This is what quality
 *                and date need and what a toggle cannot give them: `low ·
 *                medium · high` is three options, but a FILTER needs a fourth
 *                answer — "all of them" — and there is nowhere on a three-way
 *                track to put it. Chips also let her say low AND high, which
 *                is what comparing a ladder actually looks like.
 *
 * THE PAGE OWNS THE FILTERS, THIS FILE OWNS THE SHAPE. Specs are passed in:
 * their values, their words, their query-string `param` when the answer has
 * to reach a server, and — for a filter that is meant to survive a reload —
 * their own `get`/`set`, so no localStorage key lives in here and the
 * Playground's existing `promptlab_liked`/`promptlab_hidex` keep meaning what
 * they always meant.
 *
 * NOTHING COUNTS THE ROWS OR THE CHIPS. A new filter is one spec.
 */
(function (root, factory) {
  // UMD — the browser gets `window.ForgeSearchFilters`, and a node test can
  // `require` the pure half (the neutral/clean rules, the date floors, the
  // quality reader) with no DOM at all.
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ForgeSearchFilters = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The aim rule is /tritoggle.js — the ONE copy. This line is only the floor
  // for a page whose shared file did not load: the pre-2026-08-24 CYCLE,
  // deliberately not a second implementation of the aim.
  function triNext(el, count, ev, cur) {
    if (typeof window !== 'undefined' && window.triNext) return window.triNext(el, count, ev, cur);
    return ((cur | 0) + 1 + count) % count;
  }

  function isMulti(s) { return s.kind === 'chips' && !!s.multi; }
  function neutralOf(s) {
    if (s.kind === 'tri') return s.neutral;
    return isMulti(s) ? [] : '';
  }
  function same(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) {
      var x = (a || []).slice().sort(), y = (b || []).slice().sort();
      return x.length === y.length && x.every(function (v, i) { return v === y[i]; });
    }
    return a === b;
  }
  function isNeutral(s, v) { return same(v, neutralOf(s)); }
  // A value the spec has never heard of WIDENS to neutral rather than emptying
  // the list — the rule every filter here has followed since the first one.
  function clean(s, v) {
    if (isMulti(s)) {
      return (Array.isArray(v) ? v : []).filter(function (x) { return s.vals.indexOf(x) >= 0; });
    }
    return s.vals.indexOf(v) >= 0 ? v : neutralOf(s);
  }
  // What the chip says when this filter is narrowing something.
  function wordsOf(s, v) {
    if (isMulti(s)) {
      return (v || []).map(function (x) { return s.words[s.vals.indexOf(x)]; });
    }
    if (isNeutral(s, v)) return [];
    return [s.words[s.vals.indexOf(v)]];
  }

  /**
   * mount    an element to fill (emptied)
   * specs    [{key, kind, label, vals, words, neutral?, param?, multi?, get?, set?}]
   * onChange (state) => void
   * opts     {chipClass?, label?}
   */
  function build(mount, specs, onChange, opts) {
    opts = opts || {};
    var state = {}, rows = {};
    specs.forEach(function (s) {
      state[s.key] = clean(s, s.get ? s.get() : neutralOf(s));
    });

    mount.innerHTML = '';
    // The mount carries the class, so the `--fsf-*` tokens reach the CHIP as
    // well as the drawer — they used to live on `.filtdrawer` alone, which
    // left the chip falling back to defaults a page had never set and drawing
    // no box at all (caught by a screenshot, not by any assertion).
    mount.classList.add('filtmount');
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filtchip' + (opts.chipClass ? ' ' + opts.chipClass : '');
    chip.setAttribute('aria-expanded', 'false');
    mount.appendChild(chip);
    var drawer = document.createElement('div');
    drawer.className = 'filtdrawer';
    drawer.hidden = true;
    mount.appendChild(drawer);

    function commit(s) {
      if (s.set) s.set(state[s.key]);
      paint();
      if (onChange) onChange(state);
    }

    specs.forEach(function (s) {
      var row = document.createElement('div');
      row.className = 'filtrow filtrow-' + s.kind;
      if (s.kind === 'tri') {
        var tog = document.createElement('button');
        tog.type = 'button'; tog.className = 'tri';
        tog.setAttribute('data-n', String(s.vals.indexOf(state[s.key])));
        var val = document.createElement('span'); val.className = 'filtval';
        row.appendChild(tog); row.appendChild(val);
        rows[s.key] = { row: row, tog: tog, val: val };
        // WHERE SHE TAPPED IS THE STOP SHE MEANT; the WORD beside it clears
        // the filter rather than stepping, because it sits nowhere near the
        // stop it names and so has nothing to aim at.
        tog.onclick = function (ev) {
          var i = triNext(tog, s.vals.length, ev, s.vals.indexOf(state[s.key]));
          state[s.key] = s.vals[i]; commit(s);
        };
        val.onclick = function () {
          if (isNeutral(s, state[s.key])) return;
          state[s.key] = neutralOf(s); commit(s);
        };
      } else {
        // A CHIP ROW SAYS WHAT IT IS FOR. A three-way toggle can lean on the
        // word riding beside it; a row of chips reading "Low Medium High" with
        // nothing over it is a row of words she has to guess the question for.
        var lab = document.createElement('span');
        lab.className = 'filtlab'; lab.textContent = s.label || '';
        var box = document.createElement('div');
        box.className = 'filtchips'; box.setAttribute('role', 'group');
        if (s.label) box.setAttribute('aria-label', s.label);
        var btns = {};
        s.vals.forEach(function (v, i) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'filtcbtn'; b.dataset.v = v;
          if (s.icons && s.icons[i]) { b.innerHTML = s.icons[i]; b.setAttribute('aria-label', s.words[i]); b.title = s.words[i]; }
          else b.textContent = s.words[i];
          if (s.classes && s.classes[i]) b.className += ' ' + s.classes[i];
          // TAPPING THE LIT ONE CLEARS IT — the house rule everywhere a mark
          // is cast (the Playground's own ♥, the importance dial). With no
          // chip lit the filter is off, which is the whole of its OFF state.
          b.onclick = function () {
            if (isMulti(s)) {
              var cur = state[s.key].slice(), at = cur.indexOf(v);
              if (at >= 0) cur.splice(at, 1); else cur.push(v);
              state[s.key] = cur;
            } else {
              state[s.key] = (state[s.key] === v) ? '' : v;
            }
            commit(s);
          };
          btns[v] = b; box.appendChild(b);
        });
        if (s.label) row.appendChild(lab);
        row.appendChild(box);
        rows[s.key] = { row: row, btns: btns };
      }
      drawer.appendChild(row);
    });

    function narrowedKeys() {
      return specs.filter(function (s) { return !isNeutral(s, state[s.key]); }).map(function (s) { return s.key; });
    }

    function paint() {
      specs.forEach(function (s) {
        var r = rows[s.key], v = state[s.key], on = !isNeutral(s, v);
        if (s.kind === 'tri') {
          var i = Math.max(s.vals.indexOf(v), 0);
          r.tog.setAttribute('data-n', String(i));
          r.tog.setAttribute('aria-label', (s.label || '') + ' — ' + s.words[i] + ', tap a side to pick one');
          r.val.textContent = s.words[i];
        } else {
          s.vals.forEach(function (val) {
            var lit = isMulti(s) ? (v || []).indexOf(val) >= 0 : v === val;
            r.btns[val].classList.toggle('on', lit);
            r.btns[val].setAttribute('aria-pressed', lit ? 'true' : 'false');
          });
        }
        r.row.classList.toggle('on', on);
      });
      var on = narrowedKeys();
      var words = [];
      specs.forEach(function (s) { words = words.concat(wordsOf(s, state[s.key])); });
      chip.textContent = (on.length && drawer.hidden) ? words.join(' · ') : (opts.label || 'Filters');
      chip.classList.toggle('on', !!on.length);
    }

    function setOpen(open) {
      drawer.hidden = !open;
      chip.setAttribute('aria-expanded', open ? 'true' : 'false');
      paint();   // the chip's WORDS depend on whether the drawer is shut
    }
    chip.onclick = function () { setOpen(drawer.hidden); };
    paint();

    return {
      state: state,
      el: mount,
      chip: chip,
      drawer: drawer,
      get: function (k) { return state[k]; },
      // The ONE place a filter is read into a request, so a new caller cannot
      // forget that neutral sends NOTHING — an absent param is exactly what
      // every older cached page already sends, and it has to keep meaning
      // "everything".
      query: function () {
        return specs.map(function (s) {
          if (!s.param || isNeutral(s, state[s.key])) return '';
          var v = isMulti(s) ? state[s.key].join(',') : state[s.key];
          return '&' + s.param + '=' + encodeURIComponent(v);
        }).join('');
      },
      stamp: function () {
        return specs.map(function (s) {
          return isMulti(s) ? state[s.key].slice().sort().join('+') : state[s.key];
        }).join('|');
      },
      narrowed: function () { return narrowedKeys().length > 0; },
      open: function () { setOpen(true); },
      reset: function () {
        specs.forEach(function (s) { state[s.key] = neutralOf(s); if (s.set) s.set(state[s.key]); });
        setOpen(false); paint();
      },
      // Restoring a remembered hunt OPENS the drawer when it is narrowed: she
      // is coming back to the same search, and the control shaping it should
      // be in front of her rather than folded behind a chip.
      setAll: function (o) {
        specs.forEach(function (s) {
          state[s.key] = clean(s, o && o[s.key]);
          if (s.set) s.set(state[s.key]);
        });
        setOpen(narrowedKeys().length > 0); paint();
      },
      paint: paint,
    };
  }

  // ── WHAT A DATE CHIP MEANS, in ONE place ────────────────────────────────
  // Days back from now, so "This week" is the last seven days rather than
  // "since Sunday" — she is asking what she has been doing lately, not what
  // the calendar says. `sinceMs(v)` answers the floor a record must be newer
  // than; an unknown or empty value has no floor at all.
  var WHEN_DAYS = { today: 1, week: 7, month: 30 };
  var WHEN = {
    vals: ['today', 'week', 'month'],
    words: ['Today', 'This week', 'This month'],
    label: 'When',
  };
  function sinceMs(v, now) {
    var d = WHEN_DAYS[v];
    return d ? ((now == null ? Date.now() : now) - d * 86400000) : 0;
  }
  // The quality ladder, spelled the way every record here already spells it.
  var QUALITY = {
    vals: ['low', 'medium', 'high'],
    words: ['Low', 'Medium', 'High'],
    label: 'Quality',
  };
  // A filed caption is `gpt-image-2 · medium · 2K`, so a picture's quality is
  // readable off it wherever the record itself carries no field. Anchored on
  // whole words: "highlight" is not a quality.
  function qualityOf(text) {
    var m = /(^|[^a-z])(low|medium|high)([^a-z]|$)/i.exec(String(text || ''));
    return m ? m[2].toLowerCase() : '';
  }

  return {
    build: build,
    // The pure half, exported for the test and for a page that wants to ask
    // the same question without building a drawer.
    neutralOf: neutralOf, isNeutral: isNeutral, clean: clean, wordsOf: wordsOf,
    WHEN: WHEN, WHEN_DAYS: WHEN_DAYS, sinceMs: sinceMs,
    QUALITY: QUALITY, qualityOf: qualityOf,
  };
}));

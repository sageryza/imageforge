/**
 * FEEDKIT — the pieces a picture FEED is made of, in ONE place.
 *
 * WHY IT IS A FILE AND NOT A COPY. A picture feed is the same recipe wherever
 * it appears: the search grammar, the live-dictation input, the Return
 * handler, the keyed reconcile that stopped the flashing, the derived display
 * copy, the toast.
 * Hand-copying those into a second page is exactly what /tritoggle.css was
 * created to end — five hand-copies of one toggle, two attribute names and two
 * palettes, and only a test ever noticing one drift.
 *
 * WHAT BELONGS HERE: behaviour with no opinion about what a run IS. Anything
 * that knows about styles, cells, prices or votes stays in the page — those
 * genuinely differ between the two tools.
 *
 * The page holds NO fallback copy of any of this (unlike /tritoggle.js's one
 * cycling line, which is a degraded-but-working floor): there is no sensible
 * half-version of a search grammar, so a page that needs the kit links it.
 */
(function () {
  'use strict';

  // ── THE HOUSE SEARCH GRAMMAR, client half ───────────────────────────────
  // Bare words AND within one item, `OR` for either, `-word` to exclude,
  // "quoted" for a phrase. search-grammar.js is the server's parser; matching
  // stays per-caller on purpose, and this is the FEED's rule — each term
  // anchored at a word START, so "aries" never finds "boundaries" and
  // `gpt-image-2` keeps its hyphens.
  function qparse(q) {
    var groups = [], re = /(-|!)?(?:"([^"]*)"|(\S+))/g, m, orNext = false, notNext = false;
    while ((m = re.exec(String(q || '')))) {
      var quoted = m[2] !== undefined, raw = quoted ? m[2] : m[3], bare = !m[1] && !quoted;
      if (bare && /^or$/i.test(raw)) { orNext = true; continue; }
      if (bare && /^and$/i.test(raw)) continue;
      if (bare && /^not$/i.test(raw)) { notNext = true; continue; }
      var v = String(raw == null ? '' : raw).toLowerCase().replace(/\s+/g, ' ').trim();
      if (!v) continue;
      var rx = null;
      try {
        rx = new RegExp((/^[a-z0-9]/i.test(v) ? '\\b' : '') +
          v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'i');
      } catch (e) { rx = null; }
      if (!rx) continue;
      var neg = !!m[1] || notNext, last = groups[groups.length - 1];
      if (orNext && last && !last.neg && !neg) last.terms.push(rx);
      else groups.push({ neg: neg, terms: [rx] });
      orNext = false; notNext = false;
    }
    return groups;
  }
  function qmatch(hay, groups) {
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], hit = false;
      for (var j = 0; j < g.terms.length; j++) { if (g.terms[j].test(hay)) { hit = true; break; } }
      if (g.neg ? hit : !hit) return false;
    }
    return true;
  }

  // ── SEARCH AS SHE DICTATES ──────────────────────────────────────────────
  // iOS can fill a field without ever firing `input`, so the box polls its
  // value while focused. Returns a handle whose `sync()` re-baselines it —
  // call that whenever something else writes into the box, or the next blur
  // fires the callback a second time.
  function liveInput(el, fn) {
    var last = el.value, timer = null;
    function fire() { if (el.value === last) return; last = el.value; fn(); }
    ['input', 'change', 'compositionupdate', 'compositionend', 'keyup', 'paste']
      .forEach(function (ev) { el.addEventListener(ev, function () { setTimeout(fire, 0); }); });
    el.addEventListener('focus', function () { clearInterval(timer); timer = setInterval(fire, 150); });
    el.addEventListener('blur', function () { clearInterval(timer); timer = null; fire(); });
    return { sync: function () { last = el.value; } };
  }
  // RETURN ENDS THE SEARCH TOO (Aug 2026, Sophie) — a lone <input type=search>
  // outside a <form> has nothing to submit to, so Return would do nothing at
  // all. It runs the search and drops the keyboard, so what she is left
  // looking at is the pictures.
  function enterSubmits(el, fn) {
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.keyCode !== 13) return;
      e.preventDefault();
      if (fn) fn();
      el.blur();
    });
  }

  // ── REPAINT WITHOUT REBUILDING ──────────────────────────────────────────
  // (Aug 2026, Sophie: "the playground flashes a lot and sometimes things
  // don't load".) Every repaint used to be `innerHTML = …` over the whole
  // feed, which destroys and recreates every <img> — the browser blanks and
  // re-decodes the wall, so a ♥, a keystroke or a finishing run flashed
  // everything she was looking at. Repaints RECONCILE instead: a node whose
  // content did not change is LEFT ALONE (same element, same decoded
  // picture), a changed one is updated in place, and order is fixed by MOVING
  // nodes — moving an element never reloads its image.
  function syncChildren(box, items, make, update) {
    var stray = [], byKey = {}, el, k;
    for (el = box.firstElementChild; el; el = el.nextElementSibling) {
      k = el.getAttribute('data-key');
      if (k == null) stray.push(el); else byKey[k] = el;
    }
    stray.forEach(function (s) { s.remove(); });     // e.g. an old empty-note
    var prev = null;
    items.forEach(function (it) {
      var node = byKey[it.key];
      if (node) delete byKey[it.key];
      else { node = make(it); node.setAttribute('data-key', it.key); }
      var want = prev ? prev.nextElementSibling : box.firstElementChild;
      if (node !== want) box.insertBefore(node, want || null);
      update(node, it);       // after insertion — a clamp check needs layout
      prev = node;
    });
    Object.keys(byKey).forEach(function (kk) { byKey[kk].remove(); });
  }

  // ── THE DERIVED DISPLAY COPY, NEVER THE ORIGINAL ────────────────────────
  // The house webp rule. A tile is ~90-190px but its url is a full-size
  // picture — on Panels a 4K sheet is a 7-10MB lossless webp that decodes to
  // ~33MB, which is what got the app's screens killed by iOS. Tiles ride the
  // gated thumb service; the LIGHTBOX and Save still get the untouched
  // original. A temp Replicate/OpenAI url or a data: url has no derived copy
  // and is sent as-is (the service only re-serves Google storage hosts, and
  // those urls expire on their own anyway).
  function thumbFor(u, w) {
    return /^https:\/\/(storage|firebasestorage)\.googleapis\.com\//.test(u || '')
      ? '/api/story/thumb?w=' + (w || 480) + '&url=' + encodeURIComponent(u)
      : u;
  }

  // ── THE TOAST ───────────────────────────────────────────────────────────
  // One line, bottom centre, gone in 2.2s. The page owns `#toast`'s paint;
  // this owns the timer, so two pages cannot disagree about how long it sits.
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }

  window.FeedKit = { qparse: qparse, qmatch: qmatch, liveInput: liveInput,
    enterSubmits: enterSubmits, syncChildren: syncChildren, thumbFor: thumbFor,
    toast: toast };
})();

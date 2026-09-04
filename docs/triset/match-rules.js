// match-rules.js — the pure rules behind the MATCH TEST page (docs/triset/
// match-game.tpl.html). Inlined into the page by scripts/triset-match-game.js
// and required by its test, so the tally she reads and the tally the test
// checks are one function.
//
// Her answers live on a verdict doc: one text per ANCHOR card, a JSON array of
// the ids she matched to it. A key that exists — even `[]` — means she has
// judged that card ("none of these" is an answer); a missing key means not yet.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__matchRules = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  function parseMatches(text) {
    if (text == null || text === '') return null;
    try {
      var v = JSON.parse(text);
      return Array.isArray(v) ? v.map(String) : null;
    } catch (e) { return null; }
  }

  // texts: {anchorId: json} → {anchorId: [ids]} for the judged cards only
  function judged(texts) {
    var out = {};
    Object.keys(texts || {}).forEach(function (k) {
      var m = parseMatches(texts[k]);
      if (m) out[k] = m;
    });
    return out;
  }

  // The tally: one row per card, her count where she has judged it (null
  // where she has not), the machine's count beside it. Judged rows first,
  // most matches first, ties by name; the unjudged keep deck order at the end.
  function tally(deck, texts, machine) {
    var j = judged(texts);
    var rows = deck.map(function (c, i) {
      var mine = j[c.id] ? j[c.id].filter(function (id) { return id !== c.id; }).length : null;
      return { id: c.id, n: c.n, mine: mine, machine: machine ? machine[i] : null, order: i };
    });
    rows.sort(function (a, b) {
      if ((a.mine === null) !== (b.mine === null)) return a.mine === null ? 1 : -1;
      if (a.mine === null) return a.order - b.order;
      if (b.mine !== a.mine) return b.mine - a.mine;
      return a.n < b.n ? -1 : a.n > b.n ? 1 : 0;
    });
    return rows;
  }

  // the one line over the tally: how many judged, and the spread of her counts
  function summary(rows) {
    var done = rows.filter(function (r) { return r.mine !== null; });
    if (!done.length) return { judged: 0, total: rows.length, min: null, max: null, avg: null };
    var vals = done.map(function (r) { return r.mine; });
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    return { judged: done.length, total: rows.length,
      min: Math.min.apply(null, vals), max: Math.max.apply(null, vals),
      avg: Math.round(sum / vals.length * 10) / 10 };
  }

  // where to go on ›: the next card in deck order she has not judged, wrapping;
  // every card judged → simply the next one
  function nextUnjudged(deck, texts, from) {
    var j = judged(texts), n = deck.length;
    for (var s = 1; s <= n; s++) {
      var i = (from + s) % n;
      if (!j[deck[i].id]) return i;
    }
    return (from + 1) % n;
  }

  // A seeded shuffle and the scatter (v2, 2026-09-04: "scatter all the cards
  // around - a different random pattern every time"). Positions are a jittered
  // grid — every card has its own cell, so nothing overlaps however the dice
  // fall — with a random lean, in a shuffled order. `seed` is the page's own
  // Date.now(), so every open is a new table and "Scatter again" is a new seed.
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function shuffle(list, seed) {
    var r = rng(seed), a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function scatter(ids, seed, opts) {
    opts = opts || {};
    var cols = opts.cols || 4, cellW = opts.cellW || 97, cellH = opts.cellH || 92, card = opts.card || 78, lean = opts.lean || 14;
    var r = rng(seed + 7), order = shuffle(ids, seed), out = [];
    order.forEach(function (id, i) {
      var c = i % cols, row = Math.floor(i / cols);
      out.push({ id: id, x: c * cellW + Math.floor(r() * (cellW - card)), y: row * cellH + Math.floor(r() * Math.max(1, cellH - card * 0.866 - 4)),
        rot: Math.round((r() * 2 - 1) * lean), w: card });
    });
    return { cards: out, height: Math.ceil(order.length / cols) * cellH, width: cols * cellW };
  }

  return { parseMatches: parseMatches, judged: judged, tally: tally, summary: summary, nextUnjudged: nextUnjudged,
    rng: rng, shuffle: shuffle, scatter: scatter };
}));

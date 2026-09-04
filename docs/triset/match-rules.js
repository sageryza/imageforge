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

  return { parseMatches: parseMatches, judged: judged, tally: tally, summary: summary, nextUnjudged: nextUnjudged };
}));

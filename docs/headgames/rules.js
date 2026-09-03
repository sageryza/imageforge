// headgames-rules.js — THE ONE set of rules for the Head Games: what a game's
// stored bits MEAN once they are in their shape. Loaded by headgames.js on the
// server (validation, and any reader that wants the diagnosis) AND served to
// public/headgames.html at /headgames-rules.js (the pause-plan.js pattern), so
// the page and the server can never disagree about which block tipped the
// scale or which block was load-bearing.
//
// Sophie's brief (2026-09-03): "little games we play in our head all the
// time … organizing ur mind — stray bits of info that normally float around,
// now, structured in a format that makes sense … diagnose mental processes,
// represent, no value judgement." Each game is a SHAPE for one kind of loose
// mental content, and the shape has to DO something once the bits are in it.
// Nothing here scores, ranks or judges — it only says what the shape shows.
//
//   THE SCALE   pros and cons as a tipping scale: she decides how many blocks
//               each reason weighs, then taps them on one at a time and
//               watches. The diagnosis is the moment it tips.
//   THE JARS    things she wondered and never looked up, one jar each, the
//               question on the lid; the lid comes off when she finds out.
//   THE TRAIN   "how did I get to thinking about this?" — cars, coupled,
//               walked backwards one at a time to the station it left from.
//   THE TOWER   why she believes a thing: each reason a block; pull one out
//               and see if it stands. Shows which block is load-bearing.
//   LUGGAGE TAGS where an opinion came from: every opinion wears a tag with
//               who handed it to her. Shows how many tags carry one name.
//
// Pure. No I/O, no Date.now() unless handed in. Tests: scripts/test-headgames.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__headgamesRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GAMES = ['scale', 'jar', 'train', 'tower', 'tag'];
  var MAX_W = 5;                       // blocks a reason can weigh, 1..5
  var TILT_PER_BLOCK = 2.5;            // degrees the beam turns per block of difference
  var TILT_MAX = 18;                   // and the most it can turn either way

  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  var sign = function (n) { return n > 0 ? 1 : n < 0 ? -1 : 0; };
  var norm = function (s) { return String(s == null ? '' : s).trim().replace(/\s+/g, ' '); };

  /* ── THE SCALE ───────────────────────────────────────────────────────── */
  // pros/cons: [{text, w}] — w is 1..MAX_W blocks, decided BEFORE anything is
  // placed. placed: [{side:'pro'|'con', i}] in the order she tapped them on.
  // Answers the running totals after every step, the beam's tilt (positive =
  // tipped toward the cons, drawn on the right), and the two moments worth
  // naming:
  //   firstTipAt — the first step that took the beam off level at all
  //   decidedAt  — the step after which the beam never came back: the block
  //                that DID it, which is the one she is asking about
  // Both are step indexes into `placed`, or -1. `left` is the FOR total (drawn
  // on the left pan), `right` the AGAINST total.
  function weigh(pros, cons, placed) {
    pros = pros || []; cons = cons || []; placed = placed || [];
    var left = 0, right = 0, steps = [], seen = {};
    for (var k = 0; k < placed.length; k++) {
      var p = placed[k];
      var list = p.side === 'pro' ? pros : cons;
      var r = list[p.i];
      var key = p.side + ':' + p.i;
      if (!r || seen[key]) continue;   // a bad index or a double tap places nothing
      seen[key] = true;
      var w = blocks(r.w);
      if (p.side === 'pro') left += w; else right += w;
      steps.push({ side: p.side, i: p.i, text: r.text, w: w, left: left, right: right, tilt: tiltOf(left, right) });
    }
    var finalSign = sign(right - left);
    var firstTipAt = -1, decidedAt = -1;
    for (var s = 0; s < steps.length; s++) {
      var sg = sign(steps[s].right - steps[s].left);
      if (firstTipAt < 0 && sg !== 0) firstTipAt = s;
    }
    if (finalSign !== 0) {
      // walk back from the end: the decided step is the earliest one from
      // which the sign never left finalSign again
      decidedAt = steps.length - 1;
      while (decidedAt > 0 && sign(steps[decidedAt - 1].right - steps[decidedAt - 1].left) === finalSign) decidedAt--;
    }
    var total = pros.length + cons.length;
    return {
      left: left, right: right, tilt: tiltOf(left, right), steps: steps,
      firstTipAt: firstTipAt, decidedAt: decidedAt,
      placedCount: steps.length, total: total, done: total > 0 && steps.length >= total,
      leans: finalSign < 0 ? 'pro' : finalSign > 0 ? 'con' : 'level',
    };
  }
  function blocks(w) { var n = Math.round(Number(w)); return isFinite(n) ? clamp(n, 1, MAX_W) : 1; }
  function tiltOf(left, right) { return clamp((right - left) * TILT_PER_BLOCK, -TILT_MAX, TILT_MAX); }

  // The one line under the scale, in words that judge nothing.
  function scaleLine(rep, words) {
    words = words || { pro: 'for', con: 'against' };
    if (!rep.placedCount) return '';
    if (rep.leans === 'level') return 'Level. ' + rep.left + ' ' + words.pro + ', ' + rep.right + ' ' + words.con + '.';
    var st = rep.steps[rep.decidedAt];
    var side = words[rep.leans];
    var line = 'Tipped ' + side + ' on: ' + st.text + '. ' + rep.left + ' ' + words.pro + ', ' + rep.right + ' ' + words.con + '.';
    if (rep.firstTipAt >= 0 && rep.firstTipAt !== rep.decidedAt) line += ' First moved on: ' + rep.steps[rep.firstTipAt].text + '.';
    return line;
  }

  /* ── THE JARS ────────────────────────────────────────────────────────── */
  var DAY = 86400000;
  // Whole days a jar has been shut (an open jar answers the days it WAS shut).
  function jarDays(jar, now) {
    var from = Number(jar.shutAt) || 0;
    var to = jar.openedAt ? Number(jar.openedAt) : Number(now);
    if (!from || !to) return 0;
    return Math.max(0, Math.floor((to - from) / DAY));
  }
  // Shut jars first, the longest-shut leading (that is what the shelf is for),
  // then the opened ones, newest-opened first.
  function jarOrder(jars) {
    return (jars || []).slice().sort(function (a, b) {
      var ao = a.openedAt ? 1 : 0, bo = b.openedAt ? 1 : 0;
      if (ao !== bo) return ao - bo;
      if (!ao) return (Number(a.shutAt) || 0) - (Number(b.shutAt) || 0);
      return (Number(b.openedAt) || 0) - (Number(a.openedAt) || 0);
    });
  }
  function jarShelf(jars, now) {
    var shut = 0, longest = null;
    for (var i = 0; i < (jars || []).length; i++) {
      var j = jars[i];
      if (j.openedAt) continue;
      shut++;
      if (!longest || (Number(j.shutAt) || 0) < (Number(longest.shutAt) || 0)) longest = j;
    }
    return { shut: shut, longest: longest, longestDays: longest ? jarDays(longest, now) : 0 };
  }

  /* ── THE TRAIN ───────────────────────────────────────────────────────── */
  // cars: strings in the order she ADDED them — the thought she ended up on
  // first, then each "before that". stationAt: set once she says the last
  // car is where it left from. The ROUTE reads the other way: station first.
  function trainRoute(train) {
    var cars = (train && train.cars || []).map(norm).filter(Boolean);
    var route = cars.slice().reverse();
    return {
      route: route, cars: cars.length,
      end: cars[0] || '', start: cars[cars.length - 1] || '',
      atStation: Boolean(train && train.stationAt && cars.length),
    };
  }
  function trainLine(train) {
    var r = trainRoute(train);
    if (!r.cars) return '';
    if (!r.atStation) return r.cars + (r.cars === 1 ? ' car' : ' cars') + ' so far.';
    return r.cars + (r.cars === 1 ? ' car' : ' cars') + ' from "' + r.start + '" to "' + r.end + '".';
  }

  /* ── THE TOWER ───────────────────────────────────────────────────────── */
  // blocks: [{text, pulled, stood}] — stood is true/false once she has pulled
  // that block and answered "does it still stand?", null until then. A block
  // whose pull brought it down is load-bearing. Untested blocks are named as
  // such, never assumed either way.
  function towerReport(blocks) {
    var load = [], stands = [], untested = [];
    (blocks || []).forEach(function (b, i) {
      var row = { i: i, text: b.text };
      if (b.stood === false) load.push(row);
      else if (b.stood === true) stands.push(row);
      else untested.push(row);
    });
    return { loadBearing: load, standsWithout: stands, untested: untested, total: (blocks || []).length };
  }
  function towerLine(blocks) {
    var r = towerReport(blocks);
    if (!r.total) return '';
    var parts = [];
    if (r.loadBearing.length) parts.push('Load-bearing: ' + r.loadBearing.map(function (b) { return b.text; }).join(', ') + '.');
    if (r.standsWithout.length) parts.push('Stands without ' + r.standsWithout.length + (r.standsWithout.length === 1 ? ' block.' : ' blocks.'));
    if (r.untested.length) parts.push(r.untested.length + ' not pulled yet.');
    if (!r.loadBearing.length && !r.untested.length) parts.push('No single block holds it up.');
    return parts.join(' ');
  }

  /* ── LUGGAGE TAGS ────────────────────────────────────────────────────── */
  // Group by who handed it over — case- and space-insensitive, the first
  // spelling kept for display — most tags first, then alphabetical. A tag
  // with nobody on it goes under "no name".
  function tagGroups(tags) {
    var byKey = {}, order = [];
    (tags || []).forEach(function (t) {
      var from = norm(t.from);
      var key = from ? from.toLowerCase() : '';
      if (!byKey[key]) { byKey[key] = { name: from || 'no name', key: key, tags: [] }; order.push(key); }
      byKey[key].tags.push(t);
    });
    return order.map(function (k) { return byKey[k]; }).sort(function (a, b) {
      if (b.tags.length !== a.tags.length) return b.tags.length - a.tags.length;
      if (!a.key !== !b.key) return a.key ? -1 : 1;     // a real name before "no name"
      return a.name.localeCompare(b.name);
    }).map(function (g) { g.count = g.tags.length; return g; });
  }
  function tagLine(tags) {
    var g = tagGroups(tags);
    if (!g.length) return '';
    var named = g.filter(function (x) { return x.key; });
    var n = tags.length;
    var line = n + (n === 1 ? ' tag' : ' tags') + ', ' + named.length + (named.length === 1 ? ' name.' : ' names.');
    if (named.length && named[0].count > 1) line += ' ' + named[0].count + ' carry ' + named[0].name + '.';
    return line;
  }

  return {
    GAMES: GAMES, MAX_W: MAX_W, TILT_MAX: TILT_MAX,
    weigh: weigh, blocks: blocks, tiltOf: tiltOf, scaleLine: scaleLine,
    jarDays: jarDays, jarOrder: jarOrder, jarShelf: jarShelf,
    trainRoute: trainRoute, trainLine: trainLine,
    towerReport: towerReport, towerLine: towerLine,
    tagGroups: tagGroups, tagLine: tagLine,
    norm: norm,
  };
});

// footage-hay.js — WHAT A CLIP'S CARD SAYS, in one string, so a search finds
// what she is looking at.
//
// 2026-09-11, Sophie: "add a search button and filter like playground" · "yea
// footage". The Playground keeps its haystack in two places (`runHay` on the
// page, `promptlabHay` in server.js) and pins them equal with a test; this
// one is loaded by footage.js on the server AND served to the page at
// /footage-hay.js (the clip-diff.js pattern), so the client filter that runs
// while the server's answer is in flight and the server's own search over
// the whole log read the identical words. Matching is the FEED's rule —
// search-grammar.js's compileFeed/feedMatches on the server, FeedKit.qparse/
// qmatch on the page — each term anchored at a word START, so "ward" never
// finds "toward" and `2.5` keeps its dot.
//
// It reads the CARD (`cardOf`'s answer), never the raw doc, so the words are
// the ones on screen: the model's label as well as its id, the door, the
// seconds with an `s` on them, the size and the shape, the project, the seed,
// the status in the card's own words, and the tags a card wears (trimmed, a
// video reference, a first frame).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FootageHay = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function hayOf(c) {
    if (!c) return '';
    var refs = Array.isArray(c.refs) ? c.refs : [];
    var kinds = [];
    refs.forEach(function (r) {
      if (!r) return;
      if (r.role === 'first') kinds.push('first frame');
      else if (r.role === 'last') kinds.push('last frame');
      else kinds.push((r.kind === 'video' ? 'video' : r.kind === 'audio' ? 'audio' : 'image') + ' ref');
      if (r.name) kinds.push(r.name);
    });
    var trims = Array.isArray(c.trims) ? c.trims : (c.trim ? [c.trim] : []);
    return [
      c.prompt, c.title, c.note,
      c.modelLabel, c.model, c.door,
      c.seconds != null ? c.seconds + 's' : '', c.resolution, c.ratio,
      c.project,
      c.seed != null ? 'seed ' + c.seed : '',
      c.status, c.status === 'failed' ? 'refused' : '',
      c.why, c.error,
      trims.length ? 'trimmed' : '',
      c.lastFrame ? 'last frame' : '',
      c.resentAs ? 'resent' : '',
    ].concat(kinds).filter(Boolean).join('  ');
  }
  return { hayOf: hayOf };
}));

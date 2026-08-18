// pause-plan.js — THE ONE description of "what Sophie's pause edit does to
// this recording". Loaded by pausing.js on the server (the render) AND by
// public/pausing.html in the browser (the preview she listens to), because
// those two must agree exactly: the whole point of the tool is that she sets
// a length by EAR, so the 1.2s she approved in the preview has to be the
// 1.2s that comes out of the render. Two implementations of this would drift
// and the tool would quietly stop being trustworthy.
//
// THE MODEL. Her edit is a list of ITEMS over the ORIGINAL timeline:
//   { kind:'set', id, a, b, was, len }  — the gap [a,b] becomes `len` long
//   { kind:'add', id, a, b:a, was:0, len } — `len` of new pause at `a`
// and `pieces` is that walked out end to end: alternating audio spans of the
// source and pause pieces. A pause piece names where its room tone comes
// from — `src` = the gap's OWN audio (trimmed if she shortened it, repeated
// if she lengthened it), `src:null` = the recording's baked room tone, for a
// pause that has no gap of its own to borrow from.
//
// NEVER DIGITAL SILENCE. That is the whole finding behind this tool: a pause
// rebuilt as zero samples sounds like a dropout — it is what made the "45
// percent" line sound bungled — because a room has a floor and a voice
// recording's silence is not silent. So every pause piece is real audio out
// of her own recording, and the only question is which piece of it.
//
// A pause is never taken to zero here either. `out` is 0.08s of room tone,
// not a splice: removing a beat entirely is a CUT, which is the Cutting
// Room's and Cutting Blocks' job, not this tool's.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__pausePlan = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  var LEN_MIN = 0.08;   // "take it out" — an elision, not a splice
  var LEN_MAX = 4;      // longer than this is a gap in the edit, not a beat
  var SAME = 0.02;      // she picked the length it already was → not a change

  // Her answer for one pause → a length in seconds, or null for "leave it".
  // '' and 'keep' both mean untouched; they are what the sheet stores when
  // she taps "leave it" after having changed something.
  function clampLen(v) {
    if (v === '' || v === null || v === undefined || v === 'keep') return null;
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(Math.min(LEN_MAX, Math.max(LEN_MIN, n)) * 100) / 100;
  }

  // Where an ADDED pause sits: right after the word she tapped, but nudged
  // into whatever air already follows it rather than onto the word's own
  // tail — a pause spliced into the decay of a consonant sounds like a
  // stutter, not a beat.
  function addAt(words, wi) {
    var w = words && words[wi];
    if (!w) return null;
    var nx = words[wi + 1];
    var t = nx ? Math.min(nx.start, w.end + 0.06) : w.end;
    return Math.round(Math.max(w.end, t) * 100) / 100;
  }

  // pauses: [{id,a,b,len,wi}] as detected · set: {id: len} · added: {aNN: len}
  function planEdit(opts) {
    var pauses = (opts && opts.pauses) || [];
    var set = (opts && opts.set) || {};
    var added = (opts && opts.added) || {};
    var words = (opts && opts.words) || [];
    var dur = Number(opts && opts.dur) || 0;

    var byId = {};
    pauses.forEach(function (p) { byId[p.id] = p; });

    var items = [];
    Object.keys(set).forEach(function (id) {
      var p = byId[id];
      if (!p) return;
      var len = clampLen(set[id]);
      if (len === null) return;
      if (Math.abs(len - p.len) < SAME) return;   // no-op: don't re-cut a gap to itself
      items.push({ kind: 'set', id: id, a: p.a, b: p.b, was: p.len, len: len });
    });
    Object.keys(added).forEach(function (id) {
      var wi = parseInt(String(id).replace(/^a/, ''), 10);
      var len = clampLen(added[id]);
      if (len === null || !isFinite(wi)) return;
      var at = addAt(words, wi);
      if (at === null) return;
      items.push({ kind: 'add', id: id, a: at, b: at, was: 0, len: len });
    });

    items.sort(function (x, y) { return x.a - y.a || (x.kind === 'add' ? -1 : 1); });

    // Overlaps are dropped, never merged. Two items over the same stretch of
    // the recording would each consume it and the second would eat audio the
    // first had already replaced — the arithmetic the Cutting Room's
    // mergeRanges exists to prevent, one layer up. In practice this is only
    // reachable by adding a pause inside a gap she has also set.
    var kept = [];
    var dropped = [];
    var edge = 0;
    items.forEach(function (it) {
      if (it.a < edge - 0.001) { dropped.push(it); return; }
      kept.push(it);
      edge = it.b;
    });

    var pieces = [];
    var t = 0;
    var total = 0;
    kept.forEach(function (it) {
      if (it.a > t + 0.005) { pieces.push({ type: 'audio', a: t, b: it.a }); total += it.a - t; }
      pieces.push({
        type: 'pause',
        id: it.id,
        len: it.len,
        // an existing gap lends its OWN room tone; an added one has none, so
        // it borrows the recording's baked room tone (src:null)
        src: it.kind === 'set' ? { a: it.a, b: it.b } : null,
      });
      total += it.len;
      t = it.b;
    });
    if (dur > t + 0.005) { pieces.push({ type: 'audio', a: t, b: dur }); total += dur - t; }

    return {
      items: kept,
      dropped: dropped,
      pieces: pieces,
      total: Math.round(total * 100) / 100,
      // what the edit does to the length of the recording, which is the one
      // number worth showing her
      delta: Math.round((total - dur) * 100) / 100,
    };
  }

  return { planEdit: planEdit, clampLen: clampLen, addAt: addAt, LEN_MIN: LEN_MIN, LEN_MAX: LEN_MAX };
}));

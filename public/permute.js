/*
 * PERMUTATION PROMPTS — Midjourney's curly brackets, for the Playground
 * (Aug 2026, Sophie: "u know in midjourney using curly brackets to do
 * multiple prompts" → "yes :)").
 *
 * `a {red, blue} bird` is two prompts — "a red bird" and "a blue bird" — and
 * separate groups multiply: `a {cat, dog} in {snow, rain}` is four. The rules
 * are Midjourney's own, because that is the grammar she already knows:
 *
 *   - top-level commas inside {} separate the options
 *   - groups NEST: `{a, {b, c} d}` → a · "b d" · "c d"
 *   - `\{` `\}` `\,` are literal characters, never syntax
 *   - an unmatched { or } is literal too — a typo must not eat the prompt
 *   - options are trimmed, doubled spaces collapse, duplicates drop
 *
 * ONE copy of the rule, shared: promptlab.html loads this file and the pure
 * test requires it directly (the pad-art.js pattern), so the expansion the
 * page runs is the expansion the test pins.
 *
 * The generation is CAPPED (50) so `{a,b}x10` cannot hang the tab building
 * ten billion strings — `clipped: true` says the cap was hit, and the page
 * refuses the tap outright (its own per-tap cap is far lower anyway).
 */
(function (root) {
  'use strict';

  var CAP = 50;

  // Parses one sequence, returning every expansion of it plus which character
  // ended it: ',' or '}' (inside a group) or '' (end of input). `st.i` walks
  // the string; `st.clipped` latches when a cross product had to be cut.
  function seq(st, inGroup) {
    var list = [''];
    while (st.i < st.s.length) {
      var c = st.s[st.i];
      if (c === '\\' && st.i + 1 < st.s.length) {
        list = append(list, st.s[st.i + 1]);
        st.i += 2;
        continue;
      }
      if (inGroup && (c === ',' || c === '}')) { st.i++; return { list: list, term: c }; }
      if (c === '{') {
        var mark = st.i;
        st.i++;
        var alts = group(st);
        if (alts === null) {
          // No closing } ahead — rewind and take the { literally.
          st.i = mark + 1;
          list = append(list, '{');
        } else {
          list = cross(st, list, alts);
        }
        continue;
      }
      list = append(list, c);
      st.i++;
    }
    return { list: list, term: '' };
  }

  // Parses the inside of a group (the { is already consumed). Returns the
  // option list, or null when the group never closes.
  function group(st) {
    var alts = [];
    for (;;) {
      var part = seq(st, true);
      // Each option is trimmed on the way in — `{red, blue}` means "red" and
      // "blue", not "red" and " blue".
      part.list.forEach(function (p) { alts.push(p.trim()); });
      if (part.term === '}') return alts;
      if (part.term !== ',') return null; // ran off the end — unmatched {
    }
  }

  function append(list, text) {
    return list.map(function (p) { return p + text; });
  }

  function cross(st, list, alts) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      for (var j = 0; j < alts.length; j++) {
        if (out.length >= CAP) { st.clipped = true; return out; }
        out.push(list[i] + alts[j]);
      }
    }
    return out;
  }

  // → { prompts: [...], clipped: bool }. Plain text comes back as itself,
  // one entry, so a caller can treat every prompt as a batch of N.
  function permutePrompt(text) {
    var st = { s: String(text == null ? '' : text), i: 0, clipped: false };
    var raw = seq(st, false).list;
    var seen = {}, prompts = [];
    raw.forEach(function (p) {
      var t = p.replace(/\s+/g, ' ').trim();
      if (seen[t]) return;
      seen[t] = true;
      prompts.push(t);
    });
    if (!prompts.length) prompts = [''];
    return { prompts: prompts, clipped: st.clipped };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { permutePrompt: permutePrompt, CAP: CAP };
  else root.permutePrompt = permutePrompt;
})(typeof self !== 'undefined' ? self : this);

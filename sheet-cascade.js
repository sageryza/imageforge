// sheet-cascade.js — ✕ ON A SHEET IS ✕ ON ITS PANELS (2026-09-06, Sophie:
// "when i x a uncut panels sheet it shud x every panel in it unless i hearted
// it or heart it after or unex").
//
// A panels run is ONE paid picture cut into pieces, so a sheet she crosses out
// is a sheet whose pieces she has crossed out — and until this she had to ✕ the
// sheet in the Sheets view and then ✕ every panel again in the panel view, or
// live with a run that said two different things about itself on two screens.
//
// THE RULE, in her words, is three clauses and this file is all three:
//   ✕ the sheet          → every panel of that run is ✕'d too
//   "unless i hearted it" → a panel she has ♥'d is LEFT ALONE
//   "or heart it after"   → hearting a panel later wins (it is her mark now,
//                           and a later un-✕ of the sheet never touches it)
//   "or unex"             → un-✕'ing the sheet lifts the ✕ off the panels it
//                           put one on, and off nothing else
//
// WHICH MEANS THE CASCADE HAS TO REMEMBER WHOSE MARK IT IS. Without that,
// "unex" can only be all-or-nothing: clearing every ✕ on the run would wipe the
// ones she cast herself, panel by panel, before she ever touched the sheet.
// So a cascaded ✕ is TAGGED — `voteFrom.<i> = 'sheet'` on the run doc, beside
// the vote it explains — and the release only ever lifts a tag it wrote. Any
// direct vote on a panel DROPS that tag (see the vote route): the moment she
// marks a panel herself it is hers, and the sheet has no claim on it.
//
// `votes` is untouched in shape — the same map the whole page and both vote
// routes already read, keyed by image index as a STRING, with '-1' the virtual
// index of the banked uncut sheet. Nothing here invents a second store of
// marks; `voteFrom` only ever says where an existing one came from.
//
// PURE, and SHARED with the page (the pause-plan.js pattern): promptlab.html
// applies the same plan optimistically, because on the Panels tab her ♥/✕ tap
// is followed by a feed read that asks for kind=single — the panels runs are
// refreshed by their own throttled sweep, so a page computing this differently
// (or not at all) would show her unmarked panels for up to twenty seconds
// after the ✕ that marked them.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__sheetCascade = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  // The virtual index of the banked uncut sheet — the one the Sheets view and
  // the still-cutting cell already open at. Firestore map keys are strings.
  var SHEET = '-1';
  // What a cascaded mark is tagged with. One word, because there is one thing
  // that casts a mark on a picture she did not tap.
  var FROM = 'sheet';

  function at(map, i) {
    if (!map) return null;
    var v = map[String(i)];
    return v === undefined ? null : v;
  }

  // THE PANELS OF A RUN — the indexes of `images` that are really pieces of the
  // sheet. A cut-FAILED run's `images` is the sheet itself (finishPanelsCut),
  // and a story sheet is its own single picture: neither has panels, so neither
  // cascades. That falls out of this rather than being a case anywhere else.
  function panelIndexes(run) {
    var r = run || {};
    if (!r.panels || !r.panels.length) return [];
    if (!r.sheetUrl) return [];
    var imgs = (r.images && r.images.length) ? r.images : [];
    var out = [];
    for (var i = 0; i < imgs.length; i++) if (imgs[i] && imgs[i] !== r.sheetUrl) out.push(i);
    return out;
  }

  // What a vote on the SHEET does to the panels under it.
  //   run  — the run doc as it stands BEFORE the write (its votes are `prev`)
  //   next — the sheet's new vote: 'dislike' | 'like' | null (cleared)
  // Answers the panels that change: `votes[i]` = 'dislike' or null (clear),
  // `from[i]` = 'sheet' or null (drop the tag). Nothing else is ever touched.
  function plan(run, next) {
    var votes = (run && run.votes) || {};
    var from = (run && run.voteFrom) || {};
    var prev = at(votes, SHEET);
    var out = { votes: {}, from: {}, changed: [] };
    var idx = panelIndexes(run);
    var i, k;
    if (next === 'dislike') {
      for (k = 0; k < idx.length; k++) {
        i = idx[k];
        // Her ♥ wins, always — that is the "unless i hearted it" clause, and
        // it is why the cascade can be a blunt sweep everywhere else.
        if (at(votes, i) === 'like') continue;
        // Already out. Leave the mark AND its tag exactly as they are: if she
        // ✕'d this panel herself, re-tagging it 'sheet' would hand a later
        // un-✕ the right to undo her own mark.
        if (at(votes, i) === 'dislike') continue;
        out.votes[i] = 'dislike';
        out.from[i] = FROM;
        out.changed.push(i);
      }
      return out;
    }
    // ANYTHING THAT ENDS THE SHEET'S ✕ RELEASES THE PANELS — her "unex", and
    // also hearting the sheet (which clears the ✕ in the same tap). A sheet
    // that was not ✕'d has nothing to release, so a ♥ on a fresh sheet does
    // nothing to the panels at all: hearting everything under it is a rule she
    // never asked for.
    if (prev !== 'dislike') return out;
    for (k = 0; k < idx.length; k++) {
      i = idx[k];
      if (at(from, i) !== FROM) continue;        // she marked this one herself
      if (at(votes, i) !== 'dislike') continue;  // she has changed it since
      out.votes[i] = null;
      out.from[i] = null;
      out.changed.push(i);
    }
    return out;
  }

  // THE PANELS THAT LAND AFTER THE ✕ (the cut runs seconds behind the banked
  // sheet, and the still-cutting cell is votable at -1, so she really can cross
  // out a sheet whose panels do not exist yet). Same plan, run against the run
  // as it stands the moment the cut lands.
  function planForCut(run) {
    return plan(run, at((run && run.votes) || {}, SHEET));
  }

  return { plan: plan, planForCut: planForCut, panelIndexes: panelIndexes, at: at, SHEET: SHEET, FROM: FROM };
}));

// sheet-cascade.js — A MARK ON A SHEET IS A MARK ON ITS PANELS (2026-09-06,
// Sophie: "when i x a uncut panels sheet it shud x every panel in it unless i
// hearted it or heart it after or unex", then — looking at a hearted sheet
// whose panels had not moved — "it shud work both ways - heart or x").
//
// A panels run is ONE paid picture cut into pieces, so a sheet she marks is a
// sheet whose pieces she has marked — and until this she had to mark the sheet
// in the Sheets view and then mark every panel again in the panel view, or live
// with a run that said two different things about itself on two screens.
//
// THE RULE, in her words:
//   ✕ or ♥ the sheet      → every panel of that run takes the same mark
//   "unless i hearted it"  → a panel she has marked HERSELF is left alone
//   "or heart it after"    → marking a panel later wins (it is her mark now,
//                            and the sheet never touches it again)
//   "or unex"              → clearing the sheet lifts the mark off the panels it
//                            put one on, and off nothing else
//   "both ways"            → and flipping the sheet ✕ → ♥ flips those panels
//                            with it, since they are the cascade's marks
//
// WHICH MEANS THE CASCADE HAS TO REMEMBER WHOSE MARK IT IS. Without that,
// "unex" can only be all-or-nothing: clearing every mark on the run would wipe
// the ones she cast herself, panel by panel, before she ever touched the sheet.
// So a cascaded mark is TAGGED — `voteFrom.<i> = 'sheet'` on the run doc,
// beside the vote it explains — and the cascade only ever moves a mark it wrote
// itself. Any direct vote on a panel DROPS that tag (see the vote route): the
// moment she marks a panel herself it is hers, and the sheet has no claim on it.
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
// after the tap that marked them.

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
  //   run  — the run doc as it stands BEFORE the write (its marks are `prev`)
  //   next — the sheet's new vote: 'dislike' | 'like' | null (cleared)
  // Answers the panels that change: `votes[i]` = the mark or null (clear),
  // `from[i]` = 'sheet' or null (drop the tag). Nothing else is ever touched.
  //
  // THREE CASES PER PANEL, and that is the whole rule:
  //   the cascade's own mark (tagged) → follows the sheet, whatever it now says
  //   a mark of HERS (untagged)       → untouched, always
  //   no mark at all                  → takes the sheet's, and is tagged
  function plan(run, next) {
    var votes = (run && run.votes) || {};
    var from = (run && run.voteFrom) || {};
    var out = { votes: {}, from: {}, changed: [] };
    var idx = panelIndexes(run);
    var mark = (next === 'like' || next === 'dislike') ? next : null;
    for (var k = 0; k < idx.length; k++) {
      var i = idx[k];
      var now = at(votes, i);
      // HER MARK WINS, ALWAYS — "unless i hearted it", and the same for a ✕ she
      // cast on a panel herself: re-tagging it would hand the sheet the right
      // to undo her own mark later.
      if (at(from, i) !== FROM && now !== null) continue;
      if (now === mark) continue;                       // already says that
      if (mark === null) { out.votes[i] = null; out.from[i] = null; }
      else { out.votes[i] = mark; out.from[i] = FROM; }
      out.changed.push(i);
    }
    return out;
  }

  // THE PANELS THAT LAND AFTER THE MARK (the cut runs seconds behind the banked
  // sheet, and the still-cutting cell is votable at -1, so she really can mark a
  // sheet whose panels do not exist yet). Same plan, run against the run as it
  // stands the moment the cut lands.
  function planForCut(run) {
    return plan(run, at((run && run.votes) || {}, SHEET));
  }

  return { plan: plan, planForCut: planForCut, panelIndexes: panelIndexes, at: at, SHEET: SHEET, FROM: FROM };
}));

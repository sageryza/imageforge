'use strict';
// WHAT THE STUCK-RUN SWEEP SHOULD DO WITH ONE PLAYGROUND RUN — pure, so the
// rules have a test that needs no Firestore.
//
// A deploy (or a crash) restarts the server mid-run and leaves the doc behind.
// Two shapes, and they are NOT the same loss:
//
//   * no banked sheet -> the paid draw died with the process. Nothing to
//     recover; the doc is a zombie "drawing…" pinned to the top of her feed
//     and is marked failed once it is past any legitimate run's life.
//   * a PANELS run parked on 'ready' with its sheet banked and no cut panels
//     -> only the FREE half was lost. Recut it from the banked sheet.
//
// THE TWO WAITS ARE DIFFERENT LENGTHS, AND THAT IS THE POINT (2026-08-29,
// Sophie: "my last panels draw is taking a long time"). Measured that
// morning: her sheet was banked at 07:06 and was still uncut at 07:16 — the
// cut it was waiting for had died with the process seconds after the sheet
// landed, and the sweep would not touch it for ten minutes because it judged
// a banked sheet by the same clock as a dead draw. A cut takes SECONDS
// (17s for that 4K six-panel sheet), so ten minutes of grace is ten minutes
// of a finished, paid picture sitting on screen uncut. An orphaned sheet is
// recut after ORPHAN_CUT_MS instead.
//
// THE SHORT WAIT IS ONLY SAFE BECAUSE OF `cutting` — the ids whose cut is
// queued or running IN THIS PROCESS. A cut is serialized process-wide
// (gateCut), so a run can sit banked-and-uncut for minutes while it waits
// its turn behind other sheets, and recutting one of those would file a
// second set of panels. The set answers "is anything still going to cut
// this?" exactly, where a clock can only guess. The remaining grace covers
// the one case the set cannot see: a deploy's OLD instance still finishing a
// cut of its own while the new one boots.
const STUCK_MS = 10 * 60 * 1000;
const ORPHAN_CUT_MS = 2 * 60 * 1000;

// A panels run whose paid sheet is banked and whose panels are not cut.
function isOrphanedSheet(r) {
  return !!(r && r.panels && r.sheetUrl && !((r.images || []).length));
}

// -> 'recut' | 'fail' | null (leave it alone). `now` and `createdAt` are ms.
function sweepAction(r, opts) {
  const o = opts || {};
  const now = o.now || Date.now();
  const at = Number(r && r.createdAt) || 0;
  if (!at) return null; // no clock on the doc: never judge it
  const age = now - at;
  if (isOrphanedSheet(r)) {
    if (o.cutting && o.cutting.has(r.id)) return null;
    return age >= ORPHAN_CUT_MS ? 'recut' : null;
  }
  return age >= STUCK_MS ? 'fail' : null;
}

module.exports = { sweepAction, isOrphanedSheet, STUCK_MS, ORPHAN_CUT_MS };

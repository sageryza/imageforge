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

// A THIRD SHAPE — killed DURING generation (2026-08-29, the same morning,
// Sophie: "forget the drawing this can't happen again"): a panels run with
// NO banked sheet was billed and never received (measured 2026-08-28: ~$1.75
// of 4K sheets in one evening). The doc stores everything the draw needs, so
// it is REDRAWN rather than failed — one more sheet's cost, capped, because
// deploys land in bursts (three merges in a row, 2026-08-27) and one retry
// is not enough; a third kill fails honestly. The caller restarts the
// staleness clock on each redraw (redrawnAt), or the next tick would kill
// the very draw the last one started — a 4K sheet can draw 14 minutes.
const REDRAW_CAP = 2;

// A panels run whose paid sheet is banked and whose panels are not cut.
function isOrphanedSheet(r) {
  return !!(r && r.panels && r.sheetUrl && !((r.images || []).length));
}

const sheetGrid = require('./sheet-grid');

// Rebuild what finishPanelsCut / runPromptLabPanelsJob need from a run DOC
// alone — everything they take was stored at run time, so an orphaned run is
// finishable (or redrawable) by any later process. The head/tail seam is
// recovered by finding the panel block (a deterministic rebuild from the
// stored panels) inside the stored fullPrompt; where it no longer matches,
// empty halves are the honest fallback. (Moved out of server.js 2026-08-29
// so the redraw decision can ask whether a doc is rebuildable at all.)
function panelsCfgOf(d) {
  const m = /^(\d+)x(\d+)$/.exec(String(d.sheet || ''));
  const g = d.grid || {};
  if (!m || !g.across || !g.down || !Array.isArray(d.panels)) return null;
  const plan = {
    W: Number(m[1]), H: Number(m[2]), sheet: d.sheet, cell: String(d.cell || ''),
    across: g.across, down: g.down, count: g.count || g.across * g.down,
  };
  const full = String(d.fullPrompt || '');
  const block = sheetGrid.panelBlock(plan.count, d.panels);
  const at = block ? full.indexOf(block) : -1;
  return {
    plan, panels: d.panels, prompt: String(d.prompt || ''), fullPrompt: full,
    head: at > 0 ? full.slice(0, at).trim() : '',
    tail: at >= 0 ? full.slice(at + block.length).trim() : '',
    quality: d.quality || 'medium', styleId: d.gptStyle || 'evan',
  };
}

// -> 'recut' | 'redraw' | 'fail' | null (leave it alone). `now` and
// `createdAt` are ms — the caller passes redrawnAt as the clock when a
// redraw has already restarted it.
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
  if (age < STUCK_MS) return null;
  // A panels run that never banked a sheet: redraw while the cap allows and
  // the doc really is rebuildable — a blind redraw of a broken doc is worse
  // than an honest failure. A single run is not rebuildable from its doc
  // yet and still fails, as before.
  if (r && r.panels && !r.sheetUrl && (r.redraws || 0) < REDRAW_CAP && panelsCfgOf(r)) {
    return 'redraw';
  }
  return 'fail';
}

module.exports = { sweepAction, isOrphanedSheet, panelsCfgOf, STUCK_MS, ORPHAN_CUT_MS, REDRAW_CAP };

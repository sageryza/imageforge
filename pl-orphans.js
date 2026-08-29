// pl-orphans.js — what the stuck-run sweep does with an orphaned Playground
// run. ONE decision, pure, so the sweep's judgement has a test that needs no
// Firestore (the pl-feed-fill.js pattern).
//
// Why this exists (2026-08-29, Sophie: "this can't happen again"): deploys
// restart the server mid-generation, and the sweep could only recover a
// panels run whose sheet was already BANKED (the free recut). A run killed
// DURING generation — billed, no bytes — was marked failed, even though the
// run doc stores everything the draw needs (measured 2026-08-28: ~$1.75 of
// 4K sheets lost in one evening; again 2026-08-29, her creepy-guy sheet at
// 14 minutes). So a generation-phase orphan is REDRAWN now, not failed:
// it costs one more sheet, which beats a dead tile and the first bill wasted.
const sheetGrid = require('./sheet-grid');

// Two deploys can land in a burst and kill the redraw too (three merges in a
// row measured 2026-08-27), so one retry is not enough; a third failure is
// real and fails honestly.
const REDRAW_CAP = 2;

// Rebuild what finishPanelsCut needs from a run DOC alone — everything it
// takes was stored at run time, so an orphaned run is finishable by any later
// process. The head/tail seam is recovered by finding the panel block (a
// deterministic rebuild from the stored panels) inside the stored fullPrompt;
// where it no longer matches, empty halves are the honest fallback.
// (Moved verbatim from server.js so the redraw decision can ask it.)
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

// The staleness clock: a redraw RESTARTS it, or the next sweep tick would
// fail the very draw the last one started (a 4K sheet can draw for 14
// minutes — measured on the run that earned this file).
function orphanAgeAt(r) {
  return r.redrawnAt?.toMillis?.() || r.createdAt?.toMillis?.() || 0;
}

// The decision for one STALE run (the caller has already applied the age
// cutoff — that 10-minute floor covers the deploy overlap window where the
// OLD instance may still legitimately finish its in-flight draw, so a young
// run is never touched):
//   recut  — panels run with a banked sheet and no cut: finish free.
//   redraw — panels run that never banked a sheet: draw it again, capped.
//   fail   — anything else (a single run is not rebuildable from its doc
//            yet; a run past the cap has been killed three times and that
//            is real).
function orphanPlan(r) {
  const isPanels = Array.isArray(r.panels) && r.panels.length > 0;
  if (isPanels && r.sheetUrl && !(r.images || []).length) return { action: 'recut' };
  if (isPanels && !r.sheetUrl && (r.redraws || 0) < REDRAW_CAP) {
    const cfg = panelsCfgOf(r);
    if (cfg) return { action: 'redraw', cfg };
  }
  return { action: 'fail' };
}

module.exports = { panelsCfgOf, orphanPlan, orphanAgeAt, REDRAW_CAP };

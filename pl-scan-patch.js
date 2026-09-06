// pl-scan-patch.js — A VOTE REACHES THE PLAYGROUND'S SCAN CACHE (2026-09-06,
// Sophie: "when i heart individual panels the heart gets removed 😡").
//
// The Panels tab reads its whole gallery through `promptlabScan()`, the same
// 60-second cache a search takes — and a vote wrote the run DOC and never that
// cache. So: she hearts a panel, the page marks it in the same frame, and her
// next tap on the tab (any tap — the sweep is armed on pointerdown, throttled
// 20s) re-reads the gallery, the server answers out of a cache frozen BEFORE
// her heart, `mergeRuns` lets the fresh copy win, and the ♥ she just cast is
// gone. Measured: the cache is 60s, the sweep throttle is 20s, so every heart
// on the Panels tab had a two-in-three chance of being undone by the tap after
// it. The page's own optimistic mark was RIGHT; the server was handing back the
// past.
//
// This applies the SAME patch a vote route writes to Firestore onto the cached
// copy, so the cache is exact at no read cost. Dotted keys only (`votes.3`,
// `voteFrom.-1`), which is the whole vocabulary the vote routes use; anything
// else on a patch is applied as a top-level field. `isDelete` says whether a
// value is a delete sentinel (`FieldValue.delete()` on the server — the test
// hands in its own).
//
// Pure, so it has a test that needs no Firestore.
'use strict';

function applyPatch(runs, id, patch, isDelete) {
  if (!Array.isArray(runs) || !id || !patch) return false;
  const run = runs.find((r) => r && r.id === id);
  if (!run) return false;
  const del = typeof isDelete === 'function' ? isDelete : () => false;
  Object.keys(patch).forEach((key) => {
    const v = patch[key];
    const dot = key.indexOf('.');
    if (dot < 0) {
      if (del(v)) delete run[key]; else run[key] = v;
      return;
    }
    const head = key.slice(0, dot), tail = key.slice(dot + 1);
    if (del(v)) {
      if (run[head] && typeof run[head] === 'object') delete run[head][tail];
      return;
    }
    if (!run[head] || typeof run[head] !== 'object') run[head] = {};
    run[head][tail] = v;
  });
  return true;
}

module.exports = { applyPatch };

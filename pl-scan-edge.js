// pl-scan-edge.js — THE LIVE EDGE OF THE PLAYGROUND'S SCAN CACHE (2026-09-22,
// Sophie, "lio" typed while a lion was drawing: "missing lion").
//
// A search (and the Panels tab's whole gallery) reads `promptlabScan()`, a
// 60-second cache of the newest runs. That is right for the history and wrong
// for the last minute of it: a run that was drawing when the cache was read
// stays `running` in it — and the page drops a running hit — and a run created
// after the read is not in it at all. Measured on her lion: the search answered
// eleven and the wall showed ten, the newest Sandy-mirror lion having landed
// seconds after the cache was cut.
//
// So the cache keeps its 60s for the history and re-reads only its EDGE on
// every call: the runs it holds that have not finished (a handful, at most),
// and anything created since the scan (a small ranged query). Both are cheap;
// a full re-read of six thousand docs on every keystroke is not, which is why
// the cache exists. `plan` says what to read; `apply` folds the answers back
// into the cached array IN PLACE, so every later reader is exact at no cost.
//
// Pure, so it has a test that needs no Firestore.
'use strict';

const FINAL = { done: true, failed: true, cancelled: true };
const EDGE_AGE_MS = 2 * 60 * 60 * 1000; // a run unfinished this long is a zombie — stop asking
const SINCE_MARGIN_MS = 10 * 1000;      // the scan's own clock against Firestore's

function isFinal(r) { return !!(r && FINAL[r.status]); }

// What to read fresh: the ids of unfinished cached runs (young enough to still
// be drawing) and the moment newer runs are asked for from.
function plan(runs, scanAt, now) {
  const t = now || Date.now();
  const ids = (runs || [])
    .filter((r) => r && r.id && !isFinal(r) && (t - (r.createdAt || 0)) < EDGE_AGE_MS)
    .map((r) => r.id);
  return { ids, since: Math.max(0, (scanAt || 0) - SINCE_MARGIN_MS) };
}

// Fold fresh docs into the cached array in place: a run already held is
// replaced by its fresh copy where it stands; a new run is inserted by
// createdAt, newest first. Returns how many were new.
function apply(runs, fresh) {
  if (!Array.isArray(runs) || !Array.isArray(fresh)) return 0;
  let added = 0;
  fresh.forEach((d) => {
    if (!d || !d.id) return;
    const i = runs.findIndex((r) => r && r.id === d.id);
    if (i >= 0) { runs[i] = d; return; }
    const at = d.createdAt || 0;
    let j = 0;
    while (j < runs.length && ((runs[j] && runs[j].createdAt) || 0) >= at) j++;
    runs.splice(j, 0, d);
    added++;
  });
  return added;
}

module.exports = { plan, apply, isFinal, EDGE_AGE_MS, SINCE_MARGIN_MS };

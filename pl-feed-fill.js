// Fill ONE page of a kind-filtered Playground feed read.
//
// 2026-08-28, Sophie: "aldo all the older ones r gone". The feed route filters
// by kind (single / panels) AFTER reading a page of docs, and the old rule —
// "a short page is fine, the client's Older keeps walking" — is only true
// while the page is SHORT. Measured that morning: the newest 40 docs were 40
// panels runs, so the Picture tab's first page came back EMPTY. An empty page
// has no oldest single to take a cursor from, so Older could not walk either,
// and 1,100 pictures were unreachable behind one morning's panels runs.
//
// So a filtered read keeps walking until it HAS its limit. Pure and injected
// with its own reader so the walk is testable without Firestore.
'use strict';

// read(cursor, limit) -> array of runs, newest first, strictly older than
//   `cursor` (a createdAt in millis; falsy = from the top).
// keeps(run) -> is this run one the caller asked for.
// passes: the most reads one request will ever make. A run of unfiltered docs
//   longer than passes*limit is a different problem, and an unbounded fill
//   would let one request walk the whole collection.
async function fillPage({ read, keeps, limit, before = 0, passes = 12 }) {
  const out = [];
  let cursor = before;
  let full = true;
  for (let pass = 0; pass < passes && out.length < limit && full; pass++) {
    const page = await read(cursor, limit);
    full = page.length === limit;
    if (!page.length) break;
    cursor = page[page.length - 1].createdAt;
    for (const r of page) if (keeps(r)) out.push(r);
  }
  return {
    runs: out.slice(0, limit),
    // "there are docs behind this page": the last read was full, or the fill
    // overshot and keepers were cut off the end.
    more: full || out.length > limit,
  };
}

module.exports = { fillPage };

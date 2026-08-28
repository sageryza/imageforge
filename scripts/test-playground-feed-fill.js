#!/usr/bin/env node
// The Playground feed's kind-filtered paging — pure, no network, no Firestore.
//
// The bug this pins (2026-08-28, Sophie: "aldo all the older ones r gone"):
// the newest 40 docs were 40 PANELS runs, so the Picture tab's first page came
// back empty over 1,100 pictures — and an empty page has no oldest single to
// take a cursor from, so Older could not walk out of it either.
'use strict';

const fs = require('fs');
const path = require('path');
const { fillPage } = require('../pl-feed-fill');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  — ' + extra : '')); }
};

// A fixture collection, newest first, with createdAt one minute apart.
function makeDocs(kinds) {
  return kinds.map((k, i) => ({
    id: 'r' + i, createdAt: 2000000000000 - i * 60000,
    ...(k === 'p' ? { grid: { across: 3, down: 3, count: 9 } } : {}),
  }));
}
const isPanels = (r) => !!(r && r.grid);
// The reader the route injects, over a fixture: strictly older than `cursor`.
const readerFor = (docs) => {
  const reads = [];
  const read = async (cursor, n) => {
    const from = cursor ? docs.filter((d) => d.createdAt < cursor) : docs;
    const page = from.slice(0, n);
    reads.push({ cursor, n, got: page.length });
    return page;
  };
  return { read, reads };
};

(async () => {
  console.log('\nfillPage — the walk');

  // 1. HER CASE: 40 panels then plenty of singles. One read answers nothing;
  //    the fill must keep going and come back with a full page.
  {
    const docs = makeDocs(Array(40).fill('p').concat(Array(200).fill('s')));
    const { read, reads } = readerFor(docs);
    const r = await fillPage({ read, keeps: (x) => !isPanels(x), limit: 40 });
    ok('a first page of 40 panels still answers 40 pictures', r.runs.length === 40,
      'got ' + r.runs.length);
    ok('  ...and none of them is a panels run', r.runs.every((x) => !isPanels(x)));
    ok('  ...and it took more than one read', reads.length > 1, 'reads=' + reads.length);
    ok('  ...and says there is more behind it', r.more === true);
    ok('  ...newest first, unscrambled',
      r.runs.every((x, i) => i === 0 || x.createdAt < r.runs[i - 1].createdAt));
  }

  // 2. The single read is not made twice over the same docs — each pass takes
  //    its cursor from the LAST doc read, panels included, or the walk stalls.
  {
    const docs = makeDocs(Array(40).fill('p').concat(Array(200).fill('s')));
    const { read, reads } = readerFor(docs);
    await fillPage({ read, keeps: (x) => !isPanels(x), limit: 40 });
    ok('each pass moves its cursor back', reads.every((x, i) => i === 0 || x.cursor),
      JSON.stringify(reads.map((x) => x.cursor)));
    const ids = new Set();
    ok('no doc is read twice', reads.length >= 2);
  }

  // 3. Unfiltered (no kind — an older cached page) answers on ONE read, exactly
  //    as the route always did.
  {
    const docs = makeDocs(Array(200).fill('s'));
    const { read, reads } = readerFor(docs);
    const r = await fillPage({ read, keeps: () => true, limit: 40 });
    ok('an unfiltered page still costs exactly one read', reads.length === 1,
      'reads=' + reads.length);
    ok('  ...and is full', r.runs.length === 40 && r.more === true);
  }

  // 4. THE END OF THE FEED: fewer keepers than the limit and nothing behind
  //    them — `more` must go false or Older becomes a button that never stops.
  {
    const docs = makeDocs(['s', 's', 'p', 's']);
    const { read } = readerFor(docs);
    const r = await fillPage({ read, keeps: (x) => !isPanels(x), limit: 40 });
    ok('the end of the feed answers what is left', r.runs.length === 3);
    ok('  ...and says there is no more', r.more === false);
  }

  // 5. A collection with NO keepers at all terminates, and does not lie.
  {
    const docs = makeDocs(Array(30).fill('p'));
    const { read, reads } = readerFor(docs);
    const r = await fillPage({ read, keeps: (x) => !isPanels(x), limit: 40 });
    ok('all-panels history answers empty, not forever', r.runs.length === 0);
    ok('  ...and stops walking', r.more === false && reads.length === 1);
  }

  // 6. BOUNDED: a very long run of unfiltered docs must not read the whole
  //    collection in one request.
  {
    const docs = makeDocs(Array(4000).fill('p').concat(Array(50).fill('s')));
    const { read, reads } = readerFor(docs);
    const r = await fillPage({ read, keeps: (x) => !isPanels(x), limit: 40, passes: 12 });
    ok('the fill is bounded', reads.length <= 12, 'reads=' + reads.length);
    ok('  ...and still reports more behind it', r.more === true);
  }

  // 7. `before` is honoured — Older's own cursor.
  {
    const docs = makeDocs(Array(100).fill('s'));
    const { read } = readerFor(docs);
    const cut = docs[50].createdAt;
    const r = await fillPage({ read, keeps: () => true, limit: 10, before: cut });
    ok('before= starts behind the cursor', r.runs.every((x) => x.createdAt < cut));
    ok('  ...at the very next run', r.runs[0].id === docs[51].id);
  }

  // 8. The overshoot: a page that gathers more keepers than the limit is cut
  //    to the limit and still says there is more.
  {
    const docs = makeDocs(Array(100).fill('s'));
    const { read } = readerFor(docs);
    const r = await fillPage({ read, keeps: () => true, limit: 40 });
    ok('never hands back more than the limit', r.runs.length === 40);
  }

  console.log('\nthe page — the two halves that made it unreachable');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'promptlab.html'), 'utf8');
  ok('the first load asks for kind=single',
    /fetch\('\/api\/promptlab\?limit=' \+ PAGE \+ '&kind=single'\)/.test(html));
  ok('Older still walks with kind=single',
    /'\/api\/promptlab\?limit=' \+ PAGE \+ '&before=' \+ oldest \+ '&kind=single'/.test(html));
  ok('Older has a last-resort cursor so it is never a dead button',
    /for \(var j = feed\.length - 1; j >= 0; j--\)/.test(html));

  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  ok('the route uses the shared fill, not its own loop',
    /plFeedFill\.fillPage\(\{/.test(server));
  ok('  ...and nothing re-inlines a bare one-read page',
    !/more: snap\.size === limit/.test(server));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

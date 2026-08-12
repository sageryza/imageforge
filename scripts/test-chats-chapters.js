#!/usr/bin/env node
// CHAPTERS — headings inside one long thread (Aug 2026, Sophie: "divide the
// moon milk chat into chapters").
//
// Two layers, both run for real:
//   1. POST /api/chatfeed/chapters — the REAL route against a stubbed
//      Firestore, because the question is what it WRITES (sorting, dropping
//      junk, clearing, and refusing to invent a chat).
//   2. chapterPlan() — lifted out of chats.html and executed, so the heading
//      really lands where the chapter changes rather than one row off.
//
// Run: node scripts/test-chats-chapters.js
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ROOT = path.join(__dirname, '..');

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

// ── the stubbed Firestore (same shape as test-chats-backfill-created.js) ────
const DELETE = { __delete: true };
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));
  function coll(name) {
    store[name] = store[name] || {};
    return {
      doc(id) {
        return {
          id,
          async get() {
            const d = store[name][id];
            return { exists: !!d, id, data: () => d, get: (k) => (d ? d[k] : undefined) };
          },
          async set(patch, opt) {
            const cur = (opt && opt.merge && store[name][id]) ? store[name][id] : {};
            const next = Object.assign({}, cur);
            Object.keys(patch).forEach((k) => {
              if (patch[k] === DELETE) delete next[k]; else next[k] = patch[k];
            });
            store[name][id] = next;
          },
          async update(patch) { return this.set(patch, { merge: true }); },
        };
      },
      async add(doc) { const id = 'gen' + Math.random(); store[name][id] = doc; return { id }; },
      where() { return this; },
      orderBy() { return this; },
      limit() { return this; },
      async get() {
        const docs = Object.keys(store[name]).map((id) => ({
          id, exists: true, data: () => store[name][id], get: (k) => store[name][id][k],
        }));
        return { empty: !docs.length, docs, size: docs.length, forEach: (f) => docs.forEach(f) };
      },
    };
  }
  return { store, api: { collection: coll } };
}

function loadRouter(db) {
  const fakeAdmin = {
    apps: [{}],
    firestore: Object.assign(() => db.api, { FieldValue: { delete: () => DELETE } }),
    storage: () => ({ bucket: () => ({}) }),
  };
  const orig = Module._load;
  Module._load = function (request) {
    if (request === 'firebase-admin') return fakeAdmin;
    return orig.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve(path.join(ROOT, 'chatfeed.js'))];
    return require(path.join(ROOT, 'chatfeed.js'));
  } finally { Module._load = orig; }
}

// The registry doc for a chat that really exists, so the route's guard passes.
const SEED = { 'forge-chat-registry': { 'deck-factory-movies': { account: '2' } } };

async function post(body, seed) {
  const db = makeDb(seed || SEED);
  const mod = loadRouter(db);
  const router = mod.router || mod;
  const express = require('express');
  const app = express();
  app.use('/api/chatfeed', router);
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const port = server.address().port;
  let out;
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/api/chatfeed/chapters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    out = { status: r.status, json: await r.json().catch(() => null) };
  } finally { server.close(); }
  return { out, reg: db.store['forge-chat-registry'] };
}

// ── chapterPlan, lifted out of the page and run for real ───────────────────
const html = fs.readFileSync(path.join(ROOT, 'public/chats.html'), 'utf8');
function lift(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('chats.html has no ' + name + '()');
  let d = 0;
  for (let k = html.indexOf('{', i); k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1);
  }
  throw new Error('unbalanced ' + name);
}
const chapterPlan = eval('(' + lift('chapterPlan') + ')');

(async () => {
  console.log('POST /api/chatfeed/chapters');
  {
    const { out, reg } = await post({
      chat: 'deck-factory-movies',
      chapters: [
        { title: 'The 720p cut', at: '2026-07-03T02:24:00Z' },
        { title: 'Building Moon Milk', at: '2026-07-02T14:25:00Z' },
      ],
    });
    const got = reg['deck-factory-movies'].chapters;
    ok('the post is accepted', out.status === 200, JSON.stringify(out));
    ok('chapters land on the registry doc', Array.isArray(got) && got.length === 2, JSON.stringify(got));
    ok('they are stored in TIME order, whatever order they arrived in',
      got[0].title === 'Building Moon Milk' && got[1].title === 'The 720p cut',
      JSON.stringify(got.map((c) => c.title)));
    ok('the rest of the registry doc survives the merge', reg['deck-factory-movies'].account === '2');
  }
  {
    // A half-written chapter is DROPPED, never guessed at — a heading in the
    // wrong place is worse than one heading fewer.
    const { out, reg } = await post({
      chat: 'deck-factory-movies',
      chapters: [
        { title: 'Good one', at: '2026-07-02T14:25:00Z' },
        { title: '', at: '2026-07-03T00:00:00Z' },
        { title: 'No time at all' },
        { title: 'Junk time', at: 'sometime in July' },
      ],
    });
    const got = reg['deck-factory-movies'].chapters;
    ok('junk chapters are dropped, not stored', got.length === 1 && got[0].title === 'Good one',
      JSON.stringify(got));
    ok('…and the call still succeeds', out.status === 200);
  }
  {
    const { reg } = await post({ chat: 'deck-factory-movies', chapters: [] });
    ok('an empty list CLEARS the field rather than storing []',
      !('chapters' in reg['deck-factory-movies']), JSON.stringify(reg['deck-factory-movies']));
  }
  {
    // The phantom-chat trap: set({},{merge:true}) writes a doc that did not
    // exist, and every pile derives from the registry keys.
    const { out, reg } = await post({
      chat: '__typo-not-a-chat',
      chapters: [{ title: 'x', at: '2026-07-02T14:25:00Z' }],
    });
    ok('an unknown chat is refused', out.status === 404, JSON.stringify(out));
    ok('…and no phantom registry doc is created', !reg['__typo-not-a-chat'],
      JSON.stringify(Object.keys(reg)));
  }
  {
    const { out } = await post({ chat: 'deck-factory-movies' });
    ok('a missing chapters array is a 400, not a silent clear', out.status === 400, JSON.stringify(out));
  }
  {
    const { out } = await post({ chapters: [] });
    ok('no chat is a 400', out.status === 400, JSON.stringify(out));
  }

  console.log('chapterPlan (lifted from chats.html)');
  // The thread paints NEWEST FIRST, so this is the order the rows go down the
  // screen. Two chapters over five messages.
  const CH = [
    { title: 'Building Moon Milk', at: '2026-07-02T14:25:00Z' },
    { title: 'The 720p cut', at: '2026-07-03T02:24:00Z' },
  ];
  const msg = (t) => ({ created: t });
  {
    const rendered = [
      msg('2026-07-03T09:00:00Z'),   // 720p
      msg('2026-07-03T02:24:00Z'),   // 720p — exactly on the boundary
      msg('2026-07-02T20:00:00Z'),   // Moon Milk
      msg('2026-07-02T14:25:00Z'),   // Moon Milk — exactly on the boundary
    ];
    const plan = chapterPlan(rendered, CH);
    ok('one heading per chapter, no more', plan.filter(Boolean).length === 2, JSON.stringify(plan));
    ok('the newest chapter heads the thread', plan[0] === 'The 720p cut', JSON.stringify(plan));
    ok('the middle rows of a chapter get nothing', plan[1] === null);
    ok('the next heading lands on that chapter\'s NEWEST message', plan[2] === 'Building Moon Milk',
      JSON.stringify(plan));
    ok('a message exactly ON a boundary belongs to that chapter, not the one before',
      plan[3] === null, JSON.stringify(plan));
  }
  {
    // Anything older than the first chapter is unlabelled — silence, not a
    // wrong guess. It sits at the bottom of the thread with no heading.
    const rendered = [msg('2026-07-02T20:00:00Z'), msg('2026-06-30T10:00:00Z')];
    const plan = chapterPlan(rendered, CH);
    ok('messages before the first chapter get no heading', plan[1] === null, JSON.stringify(plan));
    ok('…and the first chapter still heads its own block', plan[0] === 'Building Moon Milk');
  }
  {
    ok('no chapters → every row is bare (the thread renders as it always did)',
      chapterPlan([msg('2026-07-03T09:00:00Z'), msg('2026-07-02T20:00:00Z')], []).join(',') === ',');
    ok('undefined chapters → same', chapterPlan([msg('2026-07-03T09:00:00Z')], undefined)[0] === null);
    ok('no messages → empty plan, no throw', chapterPlan([], CH).length === 0);
  }
  {
    // A message with no `created` must not silently claim a heading.
    const plan = chapterPlan([{ }, msg('2026-07-02T20:00:00Z')], CH);
    ok('a message with no time gets no heading', plan[0] === null, JSON.stringify(plan));
  }

  console.log('the page');
  ok('the divider is styled', /\.chapdiv\s*\{/.test(html));
  ok('the divider text is SANS, caps and NOT bold (the sans rule)',
    /\.chapdiv span\{[^}]*-apple-system[^}]*\}/.test(html)
    && /\.chapdiv span\{[^}]*text-transform:uppercase[^}]*\}/.test(html)
    && /\.chapdiv span\{[^}]*font-weight:400[^}]*\}/.test(html));
  ok('the title is escaped before it reaches innerHTML', /chapdiv[\s\S]{0,200}esc\(plan\[i\]\)/.test(html));
  ok('dividers hide while the in-thread search filters the rows',
    /chaprows\.forEach\(function\(h\)\{ h\.style\.display=q\?'none':''; \}\);/.test(html));

  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// A BACKFILLED REPLY KEEPS ITS REAL TIME (Aug 2026).
//
// The Chats app sorts a thread by `created`, and POST /api/chatfeed stamped it
// NOW unconditionally — right for a live post, wrong for a backfill: replaying
// an old conversation would stack every Claude message at the TOP, above the
// messages it was answering. (Her side, POST /reply, has accepted `created`
// since July 2026 for exactly this reason; this is the other half.)
//
// Drives the REAL route against a stubbed Firestore — the question is what the
// route WRITES, which source-shape assertions cannot answer.
//
//   node scripts/test-chats-backfill-created.js
'use strict';
const path = require('path');
const Module = require('module');
const ROOT = path.join(__dirname, '..');

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

const DELETE = { __delete: true };
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));
  const added = [];
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
      async add(doc) { const id = 'gen' + (added.length + 1); store[name][id] = doc; added.push(doc); return { id }; },
      where() { return this; },
      orderBy() { return this; },
      limit() { return this; },
      async get() { return { empty: true, docs: [], forEach() {} }; },
    };
  }
  return { store, added, api: { collection: coll } };
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

async function post(body) {
  const db = makeDb({});
  const mod = loadRouter(db);
  const router = mod.router || mod;
  const express = require('express');
  const app = express();
  app.use('/api/chatfeed', router);
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const port = server.address().port;
  let out;
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/api/chatfeed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    out = { status: r.status, json: await r.json().catch(() => null) };
  } finally { server.close(); }
  return { out, db };
}

(async () => {
  const JULY = '2026-07-02T21:34:00.000Z';

  // 1. a backfilled reply keeps the time it was really written
  {
    const { out, db } = await post({ chat: 'moon-milk', text: 'the first cut is up', created: JULY });
    const msg = db.added[0];
    ok('the post is accepted', out.status === 200, JSON.stringify(out));
    ok('created is the real July time', msg && msg.created === JULY, JSON.stringify(msg && msg.created));
    ok('postedAt stays NOW (delta poll must stay monotonic)',
      msg && msg.postedAt > JULY, JSON.stringify(msg && msg.postedAt));
    ok('it is still a Claude message', msg && msg.from === 'claude');
  }

  // 2. a live post — no `created` — is stamped now, exactly as before
  {
    const { db } = await post({ chat: 'moon-milk', text: 'hello' });
    const msg = db.added[0];
    const age = Date.now() - new Date(msg.created).getTime();
    ok('no created → stamped now', age >= 0 && age < 60000, msg && msg.created);
  }

  // 3. a FUTURE time is refused — or one bad clock pins a message to the top
  //    of her thread forever
  {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const { db } = await post({ chat: 'moon-milk', text: 'from the future', created: future });
    const msg = db.added[0];
    ok('a future created is ignored', msg && msg.created !== future, msg && msg.created);
    ok('…and falls back to now', msg && Date.now() - new Date(msg.created).getTime() < 60000);
  }

  // 4. garbage doesn't throw or land as Invalid Date
  {
    const { out, db } = await post({ chat: 'moon-milk', text: 'nonsense stamp', created: 'not a date' });
    const msg = db.added[0];
    ok('a junk created is ignored, not fatal', out.status === 200 && msg && !isNaN(new Date(msg.created).getTime()),
      JSON.stringify(msg && msg.created));
  }

  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

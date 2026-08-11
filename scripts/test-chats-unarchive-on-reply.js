#!/usr/bin/env node
// MESSAGING AN ARCHIVED CHAT TAKES IT OUT OF THE ARCHIVE (Aug 2026, Sophie:
// "when I message a chat that I archived, can it automatically come out of the
// archive").
//
// This drives the REAL `POST /api/chatfeed/reply` in chatfeed.js against a
// stubbed Firestore, rather than asserting on the shape of the source — the
// question here is what the route WRITES, and only running it can answer that.
//
//   node scripts/test-chats-unarchive-on-reply.js
'use strict';
const path = require('path');
const Module = require('module');
const ROOT = path.join(__dirname, '..');

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

// ── a Firestore small enough to reason about, real enough to drive the route ──
const DELETE = { __delete: true };
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));   // { collection: { id: doc } }
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
  // stub firebase-admin for the require of chatfeed.js, then put it back
  const orig = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'firebase-admin') return fakeAdmin;
    return orig.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve(path.join(ROOT, 'chatfeed.js'))];
    return require(path.join(ROOT, 'chatfeed.js'));
  } finally { Module._load = orig; }
}

// Run one POST /reply through the real router and hand back the registry doc.
async function reply(seed, body) {
  const db = makeDb(seed);
  const mod = loadRouter(db);
  const router = mod.router || mod;
  const express = require('express');
  const app = express();
  app.use('/api/chatfeed', router);
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const port = server.address().port;
  let out;
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/api/chatfeed/reply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    out = { status: r.status, json: await r.json().catch(() => null) };
  } finally { server.close(); }
  return { out, db };
}

(async () => {
  const REG = 'forge-chat-registry';

  // 1. an ARCHIVED chat she messages comes back out
  {
    const seed = { [REG]: { 'old-chat': { archived: true, lastSeen: '2026-08-01T00:00:00.000Z' } } };
    const { out, db } = await reply(seed, { chat: 'old-chat', text: 'are you still there?' });
    const reg = db.store[REG]['old-chat'];
    ok('the reply is accepted', out.status === 200 && out.json && out.json.ok, JSON.stringify(out));
    ok('the chat is no longer archived', reg && reg.archived === false, JSON.stringify(reg));
    ok('the route says it unarchived', out.json && out.json.unarchived === true, JSON.stringify(out.json));
    // and it still does what answering a chat has always done
    ok('it is still parked (hiddenAt stamped)', !!(reg && reg.hiddenAt));
    ok('workingAt is still stamped', !!(reg && reg.workingAt));
    ok('her message was written to the feed', db.added.length === 1 && db.added[0].from === 'sophie');
  }

  // 2. a chat that was NOT archived is untouched by this — no stray field
  {
    const seed = { [REG]: { 'live-chat': { lastSeen: '2026-08-01T00:00:00.000Z' } } };
    const { db } = await reply(seed, { chat: 'live-chat', text: 'hello' });
    const reg = db.store[REG]['live-chat'];
    ok('an unarchived chat gains no archived field', reg && !('archived' in reg), JSON.stringify(reg));
    ok('…and is still parked', !!(reg && reg.hiddenAt));
  }

  // 3. the archive survives a chat's OWN reply — only HER message pulls it
  //    out, which is the whole difference between Archive and hiddenAt. A
  //    chat's reply arrives on POST /api/chatfeed, never here, so the check
  //    is that the archived flag is not touched by that path's registry write.
  {
    const src = require('fs').readFileSync(path.join(ROOT, 'chatfeed.js'), 'utf8');
    // JUST that route — slicing to /reply would sweep in /archive itself and
    // every route between them, which is not what this is asking
    const start = src.indexOf("router.post('/'");
    const end = src.indexOf('router.post(', start + 10);
    const feedPost = src.slice(start, end);
    ok('the chat-reply route never writes archived',
      start > 0 && end > start && !/archived/.test(feedPost),
      'span ' + start + '..' + end);
  }

  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

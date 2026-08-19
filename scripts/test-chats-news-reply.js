#!/usr/bin/env node
// ANSWERING A CHAT CLEARS ITS UPDATE CARD (Aug 2026, Sophie: "we made it so
// that opening messages on the update tab doesn't get rid of the notification.
// Is it possible to make it so that if I actually replied to the message that
// does get rid of the notification").
//
// The whole feature is ONE field: `POST /api/chatfeed/reply` stamps the same
// `notifSeenAt` the ✓ writes. So this drives the REAL routes in chatfeed.js
// against a stubbed Firestore — the question is what each route WRITES, and
// only running them can answer that — and then replays the Update tab's own
// floor rule over the result, because "the card is gone" is a comparison, not
// a boolean.
//
// The three that must NOT stamp it are the point of the test:
//   • a chat's OWN reply (POST /)          — that IS the news
//   • the turn-start ping (POST /working)  — fires for background-event turns
//                                            too (hook v14), so it would clear
//                                            cards she never saw
//   • a note typed inside a Compare page   — rerouted to the verdict doc, and
//                                            it is not a message in the thread
//
//   node scripts/test-chats-news-reply.js
'use strict';
const path = require('path');
const Module = require('module');
const ROOT = path.join(__dirname, '..');

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

// ── a Firestore small enough to reason about, real enough to drive the routes ──
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

// Run one POST through the real router and hand back the registry.
async function post(seed, route, body, headers) {
  const db = makeDb(seed);
  const mod = loadRouter(db);
  const express = require('express');
  const app = express();
  app.use('/api/chatfeed', mod.router || mod);
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const port = server.address().port;
  let out;
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/api/chatfeed' + route, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(body),
    });
    out = { status: r.status, json: await r.json().catch(() => null) };
  } finally { server.close(); }
  return { out, db };
}

// The Update tab's own rule, copied from newsFloor + the card build in
// chats.html: a card shows when its newest arrival is newer than the floor.
const shows = (reg, arrivalISO) => !(reg && reg.notifSeenAt && reg.notifSeenAt >= arrivalISO);

(async () => {
  const REG = 'forge-chat-registry';
  const iso = (ms) => new Date(ms).toISOString();
  // the delivery she is looking at — an hour ago, relative to the clock the
  // routes stamp with, because every comparison here is against `now`
  const T0 = Date.now() - 3600000;

  // 1. HER REPLY clears the card
  {
    const seed = { [REG]: { oven: { lastSeen: iso(T0) } } };
    const { out, db } = await post(seed, '/reply', { chat: 'oven', text: 'looks good, ship it' });
    const reg = db.store[REG].oven;
    ok('the reply is accepted', out.status === 200 && out.json && out.json.ok, JSON.stringify(out));
    ok('her reply stamps notifSeenAt', !!(reg && reg.notifSeenAt), JSON.stringify(reg));
    // the page mirrors the stamp locally off the response, so the card is
    // gone the moment she taps back — not on the next registry poll
    ok('…and the response carries the stamp for the page to mirror',
      out.json && out.json.notifSeenAt === (reg && reg.notifSeenAt), JSON.stringify(out.json));
    ok('…and the card for what she answered is gone', !shows(reg, iso(T0)),
      'floor ' + (reg && reg.notifSeenAt) + ' vs arrival ' + iso(T0));
    // the stamp is the write time, not her (possibly older) send time
    ok('the stamp is postedAt, not her `created`',
      reg && reg.notifSeenAt > iso(T0) && reg.notifSeenAt === reg.hiddenAt,
      JSON.stringify(reg));
    // her oven example, which is why this is a stamp and not a boolean
    const later = iso(Date.now() + 60000);
    ok('…but the next version brings the card straight back', shows(reg, later));
    ok('it still parks the chat', !!(reg && reg.hiddenAt));
  }

  // 2. an OLD hook posts her message with her real send time — still clears
  {
    const seed = { [REG]: { oven: {} } };
    const { db } = await post(seed, '/reply', { chat: 'oven', text: 'yes', created: iso(T0 - 300000) });
    const reg = db.store[REG].oven;
    ok('a back-dated `created` still clears the card', !shows(reg, iso(T0)),
      'floor ' + (reg && reg.notifSeenAt));
  }

  // 3. THE CHAT'S OWN REPLY is the news — it must never clear its own card
  {
    const seed = { [REG]: { oven: {} } };
    const { out, db } = await post(seed, '/', { chat: 'oven', text: 'here is v6', tldr: 'v6' });
    const reg = db.store[REG].oven || {};
    ok('a chat reply is accepted', out.status === 200, JSON.stringify(out));
    ok('a chat reply never writes notifSeenAt', !('notifSeenAt' in reg), JSON.stringify(reg));
  }

  // 4. THE TURN-START PING must not clear it either — since hook v14 a turn
  //    started by a background event (a wake event, a task notification) is
  //    still a turn, so /working fires when Sophie has said nothing at all.
  {
    const seed = { [REG]: { oven: {} } };
    const { db } = await post(seed, '/working', { chat: 'oven', session: 'abc123' });
    const reg = db.store[REG].oven || {};
    ok('the turn-start ping never writes notifSeenAt', !('notifSeenAt' in reg), JSON.stringify(reg));
    ok('…it still parks the chat, as before', !!reg.hiddenAt);
  }

  // 5. A NOTE TYPED INSIDE A COMPARE PAGE is rerouted to the verdict doc — it
  //    is not a message in the thread, so it clears nothing.
  {
    const seed = { [REG]: { oven: {} } };
    const { out, db } = await post(seed, '/reply', { chat: 'oven', text: 'this one' },
      { referer: 'https://imageforge-q125.onrender.com/api/chatfeed/page/pg123' });
    const reg = db.store[REG].oven || {};
    ok('a page note is kept on the page', out.json && out.json.keptOnPage === true, JSON.stringify(out.json));
    ok('a page note never writes notifSeenAt', !('notifSeenAt' in reg), JSON.stringify(reg));
  }

  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

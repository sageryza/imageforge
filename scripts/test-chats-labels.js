#!/usr/bin/env node
// CATEGORIES AND TAGS ARE ONE THING (Aug 2026, Sophie: "right now you can only
// be in one category at a time, for example witch or to be reviewed, and you
// can't add tags — I think it would make sense to just combine them and let you
// be in multiple categories or tags at once").
//
// One field, `labels`, many per chat, her own words. The two things most likely
// to be broken by a later change are the two this test spends most of its
// assertions on:
//   • THE MIRRORS. Every write still stores `category` (the first label) and
//     `tags` (the whole set) beside `labels`, because her phone runs a cached
//     page for days and because chat-sort.js, brief.js and the backfill scripts
//     were never touched. Drop a mirror and nothing fails loudly — her filing
//     just quietly stops meaning anything on the build she is looking at.
//   • THE OLD SHAPE STILL READS. A chat that has never been written since is
//     `category` + `tags` and must read as the union of the two, on the server
//     and on the page alike. That is what made this need no backfill.
//
// Three layers, all run for real:
//   1. POST /labels against a stubbed Firestore — replace, add, remove, the
//      mirrors, clearing, and the phantom-row guard (a `set(…, merge)` on a
//      missing doc CREATES it, and every pile derives from the registry keys).
//   2. the two legacy routes kept LOSSLESS — /category edits only the folder
//      half and /tags only the tag half, so a tap on a cached page can never
//      wipe labels it was never able to show.
//   3. the real page in headless Chromium: the Organize sheet as ONE row of
//      chips, several lit at once, a tap toggling, a typed word joining, and a
//      chat carrying the OLD pair of fields arriving with both words lit.
//
// Run: node scripts/test-chats-labels.js
// playwright is an optionalDependency, so layer 3 skips cleanly without it.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ROOT = path.join(__dirname, '..');

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

// ── the stubbed Firestore ──────────────────────────────────────────────────
const DELETE = { __delete: true };
const UNION = (...v) => ({ __union: v });
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));
  const writes = [];
  function coll(name) {
    store[name] = store[name] || {};
    const setDoc = (id, patch, opt) => {
      writes.push({ coll: name, id, patch });
      const cur = (opt && opt.merge && store[name][id]) ? store[name][id] : {};
      const next = Object.assign({}, cur);
      Object.keys(patch).forEach((k) => {
        const v = patch[k];
        if (v === DELETE) { delete next[k]; return; }
        if (v && v.__union) {
          const have = Array.isArray(next[k]) ? next[k].slice() : [];
          v.__union.forEach((x) => { if (have.indexOf(x) < 0) have.push(x); });
          next[k] = have; return;
        }
        next[k] = v;
      });
      store[name][id] = next;
    };
    return {
      doc(id) {
        return {
          id, __coll: name,
          async get() {
            const d = store[name][id];
            return { exists: !!d, id, data: () => d, get: (k) => (d ? d[k] : undefined) };
          },
          async set(patch, opt) { setDoc(id, patch, opt); },
          async update(patch) { setDoc(id, patch, { merge: true }); },
        };
      },
      async add(doc) { const id = 'gen' + writes.length; store[name][id] = doc; return { id }; },
      where() { return this; }, orderBy() { return this; }, limit() { return this; },
      async get() {
        const docs = Object.keys(store[name]).map((id) => ({
          id, exists: true, data: () => store[name][id], get: (k) => store[name][id][k],
        }));
        return { empty: !docs.length, docs, size: docs.length, forEach: (f) => docs.forEach(f) };
      },
    };
  }
  const api = {
    collection: coll,
    batch() {
      const q = [];
      return {
        set(ref, patch, opt) { q.push([ref, patch, opt]); return this; },
        async commit() { q.forEach(([ref, patch, opt]) => coll(ref.__coll).doc(ref.id).set(patch, opt)); },
      };
    },
  };
  return { store, api, writes };
}

function loadRouter(db) {
  const fakeAdmin = {
    apps: [{}],
    firestore: Object.assign(() => db.api, {
      FieldValue: { delete: () => DELETE, arrayUnion: (...v) => UNION(...v) },
    }),
    storage: () => ({ bucket: () => ({}) }),
    credential: { cert: () => ({}) },
    initializeApp: () => {},
  };
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'firebase-admin') return fakeAdmin;
    return origLoad.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve(path.join(ROOT, 'chatfeed.js'))];
    return require(path.join(ROOT, 'chatfeed.js'));
  } finally { Module._load = origLoad; }
}

function handlerFor(router, method, route) {
  const layer = (router.stack || []).find((l) => l.route && l.route.path === route
    && l.route.methods && l.route.methods[method]);
  return layer && layer.route.stack[layer.route.stack.length - 1].handle;
}

async function call(handle, body) {
  const req = { body, query: {}, params: {}, headers: {}, get: () => undefined };
  let out = null, code = 200;
  const res = {
    status(c) { code = c; return this; },
    json(v) { out = v; return this; },
    set() { return this; },
  };
  await handle(req, res, () => {});
  return { code, body: out };
}

// ── 1. POST /labels ────────────────────────────────────────────────────────
async function routeTests() {
  console.log('the route:');
  const db = makeDb({
    'forge-chat-registry': {
      // the OLD shape, never rewritten — one folder and one tag
      legacy: { category: 'witch', tags: ['built'] },
      plain: {},
      other: {},
    },
  });
  const mod = loadRouter(db);
  const router = mod.router || mod;
  const reg = () => db.store['forge-chat-registry'];
  const post = handlerFor(router, 'post', '/labels');
  ok('POST /labels exists', !!post);
  if (!post) return;

  // the old shape reads as the union of the two fields
  ok('a chat written before this reads as category + tags',
    JSON.stringify(mod.labelsOf(reg().legacy)) === '["witch","built"]',
    JSON.stringify(mod.labelsOf(reg().legacy)));

  // ADD keeps what is already there — the whole point of the merge
  let r = await call(post, { chats: ['legacy'], add: ['to be reviewed'] });
  ok('adding a word answers ok', r.code === 200 && r.body && r.body.ok);
  ok('…and it JOINS the two the chat already had',
    JSON.stringify(reg().legacy.labels) === '["witch","built","to be reviewed"]',
    JSON.stringify(reg().legacy.labels));
  ok('the `category` mirror is the FIRST label', reg().legacy.category === 'witch');
  ok('the `tags` mirror is the WHOLE set',
    JSON.stringify(reg().legacy.tags) === '["witch","built","to be reviewed"]',
    JSON.stringify(reg().legacy.tags));
  ok('filing stamps `filedAt`, or the chat bounces back onto the list',
    typeof reg().legacy.filedAt === 'string' && reg().legacy.filedAt.length > 10);
  ok('…and stamps it as HERS, which locks the auto-sorter out',
    reg().legacy.catBy === 'sophie');

  // REMOVE takes one word off and leaves the rest
  r = await call(post, { chat: 'legacy', remove: 'built' });
  ok('removing one word leaves the others',
    JSON.stringify(reg().legacy.labels) === '["witch","to be reviewed"]',
    JSON.stringify(reg().legacy.labels));

  // REPLACE
  await call(post, { chat: 'legacy', labels: ['tech', 'story'] });
  ok('`labels` replaces the whole set',
    JSON.stringify(reg().legacy.labels) === '["tech","story"]', JSON.stringify(reg().legacy.labels));

  // dictation capitalises at random, so everything is lower-cased and de-duped
  await call(post, { chat: 'plain', labels: ['Witch', ' witch ', 'TECH'] });
  ok('words are lower-cased and de-duped — "Witch" and "witch" are one chip',
    JSON.stringify(reg().plain.labels) === '["witch","tech"]', JSON.stringify(reg().plain.labels));

  // clearing deletes every one of the four fields
  await call(post, { chat: 'plain', labels: [] });
  ok('clearing DELETES `labels`', reg().plain.labels === undefined);
  ok('…and both mirrors with it',
    reg().plain.category === undefined && reg().plain.tags === undefined);
  ok('…and the filing stamp too', reg().plain.filedAt === undefined && reg().plain.catBy === undefined);

  // bulk: one word onto several chats, each keeping its own
  await call(post, { chats: ['plain', 'other'], add: ['meta'] });
  await call(post, { chats: ['plain'], add: ['xi'] });
  await call(post, { chats: ['plain', 'other'], add: ['stories'] });
  ok('a bulk tap ADDS rather than overwriting',
    JSON.stringify(reg().plain.labels) === '["meta","xi","stories"]'
    && JSON.stringify(reg().other.labels) === '["meta","stories"]',
    JSON.stringify(reg().plain.labels) + ' / ' + JSON.stringify(reg().other.labels));

  // the phantom-row guard
  r = await call(post, { chats: ['nobody-here'], add: ['meta'] });
  ok('a chat that does not exist is NOT created', reg()['nobody-here'] === undefined);
  ok('…and it is named back as missing rather than failing the batch',
    r.body && r.body.ok && JSON.stringify(r.body.missing) === '["nobody-here"]',
    JSON.stringify(r.body));

  // a word with nothing picked is still MADE — the empty-folder bug
  await call(post, { labels: ['errands'] });
  ok('a word made with no chats picked is remembered on __settings',
    (reg().__settings.categories || []).indexOf('errands') > -1,
    JSON.stringify(reg().__settings));

  r = await call(post, {});
  ok('an empty body is refused', r.code === 400);

  // ---- the two legacy routes, kept lossless ------------------------------
  const cat = handlerFor(router, 'post', '/category');
  const tags = handlerFor(router, 'post', '/tags');
  await call(post, { chat: 'other', labels: ['witch', 'built'] });
  await call(cat, { chats: ['other'], category: 'tech' });
  ok('a cached page filing a FOLDER keeps the tag words',
    JSON.stringify(reg().other.labels) === '["tech","built"]', JSON.stringify(reg().other.labels));
  await call(tags, { chat: 'other', tags: ['story'] });
  ok('a cached page setting TAGS keeps the folder',
    JSON.stringify(reg().other.labels) === '["tech","story"]', JSON.stringify(reg().other.labels));
  await call(cat, { chats: ['other'], category: '' });
  ok('“None” on a cached page clears only the half it can see',
    JSON.stringify(reg().other.labels) === '["story"]', JSON.stringify(reg().other.labels));
}

// ── 2. the real page ───────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); } catch { chromium = null; }
}

const PUB = path.join(ROOT, 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const MSGS = [
  { id: 'm1', chat: 'both-ways', from: 'claude', text: 'hello', tldr: 'a', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'nothing-yet', from: 'claude', text: 'hello', tldr: 'b', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
];
const CHATS = {
  // the OLD pair of fields, never rewritten — it has to arrive showing BOTH
  'both-ways': { account: '1', lastSeen: MSGS[0].created, category: 'witch', tags: ['built'], filedAt: iso(T0 - 500) },
  'nothing-yet': { account: '1', lastSeen: MSGS[1].created },
};

async function pageTests() {
  console.log('the page:');
  if (!chromium) { console.log('  SKIP: playwright not installed'); return; }
  const posts = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
      const since = url.searchParams.get('since');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        build: 'test-build-1', chats: CHATS,
        settings: { appAccount: '1', categories: ['witch', 'to be reviewed'] },
        truncated: [], messages: since ? [] : MSGS, delta: !!since,
      }));
    }
    if (url.pathname === '/api/chatfeed/labels' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => body += c);
      req.on('end', () => {
        posts.push(JSON.parse(body || '{}'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if (url.pathname === '/' || url.pathname === '/chats') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const lit = () => page.$$eval('.askwrap .arctags .catchip.on', (ns) => ns.map((n) => n.textContent.trim()));
  const chip = (label) => page.$$eval('.askwrap .arctags .catchip', (ns, l) => {
    const b = ns.find((n) => n.textContent.trim() === l);
    if (b) b.click();
    return !!b;
  }, label);
  try {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="nothing-yet"]');
    // the old pair of fields files the chat, so it is off the unfiled list
    ok('a chat with the OLD category + tags is filed, as it always was',
      !(await page.$('#grid [data-chat="both-ways"]')));

    await page.click('#grid [data-chat="nothing-yet"]');
    await page.waitForSelector('#thread .orgbtn');
    await page.click('#thread .orgbtn');
    await page.waitForSelector('.askwrap .arctags');

    // ONE section, not two — the split came off with the merge
    ok('the sheet has one row of chips, not a Folder half and a Tags half',
      (await page.$$('.askwrap .orggrp')).length === 0);
    const chips = await page.$$eval('.askwrap .arctags .catchip', (ns) => ns.map((n) => n.textContent.trim()));
    ok('her own words are offered', chips.indexOf('Witch') > -1 && chips.indexOf('To be reviewed') > -1,
      chips.join(' · '));
    ok('…and the ten old tag words alongside them',
      chips.indexOf('Bug fix') > -1 && chips.indexOf('Research') > -1, chips.join(' · '));
    ok('nothing is lit on a chat with no words yet',
      (await lit()).join(',') === 'None', (await lit()).join(','));

    // SEVERAL AT ONCE — the whole ask
    ok('the chip is there to tap', await chip('Witch'));
    await page.waitForTimeout(150);
    await chip('To be reviewed');
    await page.waitForTimeout(150);
    const on = await lit();
    ok('two words can be lit at the same time',
      on.indexOf('Witch') > -1 && on.indexOf('To be reviewed') > -1, on.join(','));
    ok('each tap is its own ADD, so neither replaced the other',
      JSON.stringify((posts[0] || {}).add) === '["witch"]'
      && JSON.stringify((posts[1] || {}).add) === '["to be reviewed"]',
      JSON.stringify(posts));

    // tapping a lit word takes it off
    await chip('Witch');
    await page.waitForTimeout(150);
    ok('tapping a lit word takes it off',
      (await lit()).indexOf('Witch') < 0, (await lit()).join(','));
    ok('…as a remove, not a rewrite of the set',
      JSON.stringify((posts[2] || {}).remove) === '["witch"]', JSON.stringify(posts[2]));

    // a word that did not exist
    await page.fill('.askwrap .arctags input', 'crystals');
    await page.press('.askwrap .arctags input', 'Enter');
    await page.waitForTimeout(200);
    ok('a typed word joins the chat and the vocabulary',
      (await lit()).indexOf('Crystals') > -1, (await lit()).join(','));

    // None clears the lot
    await chip('None');
    await page.waitForTimeout(200);
    ok('None takes it out of everything',
      (await lit()).join(',') === 'None', (await lit()).join(','));
    ok('…as one replace, never a pile of removes',
      JSON.stringify((posts[posts.length - 1] || {}).labels) === '[]',
      JSON.stringify(posts[posts.length - 1]));

    // the old shape reads as both words on the page too
    await page.click('.askwrap .askrow .go');
    await page.waitForTimeout(150);
    await page.click('#backbtn').catch(() => {});
    await page.goto(base + '/chats');
    await page.waitForSelector('#catrow .tagsbtn');
    if (!(await page.$('#catrow .tagsbtn.on'))) await page.click('#catrow .tagsbtn');
    await page.waitForSelector('#catrow .catchip:not(.starchip):not(.tagsbtn)');
    const folders = await page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn)',
      (ns) => ns.map((n) => n.firstChild.textContent.trim()));
    ok('a legacy tag word shows as a chip on the home row now it is in use',
      folders.indexOf('Built') > -1, folders.join(' · '));
    await page.$$eval('#catrow .catchip', (ns) => {
      const b = ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Built'); if (b) b.click();
    });
    await page.waitForTimeout(200);
    ok('…and filtering by it finds the chat filed under the OTHER field',
      JSON.stringify(await page.$$eval('#grid .crow', (ns) => ns.map((n) => n.dataset.chat))) === '["both-ways"]',
      await page.$$eval('#grid .crow', (ns) => ns.map((n) => n.dataset.chat).join(',')));
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  await routeTests();
  await pageTests();
  if (fails) { console.log('\nDONE with ' + fails + ' failure(s)'); process.exitCode = 1; }
  else console.log('\nPASS: one field, many words — old data reads, cached pages still write');
})();

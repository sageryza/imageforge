#!/usr/bin/env node
// THE REFERENCE SHELF (Aug 2026, Sophie: "we should save compare pages if
// they're comparing things that often need to be re-referenced — for example
// the different qualities of images like high, medium and low, or the
// different styles").
//
// Two layers, both run for real:
//
//   1. The REAL routes against a stubbed Firestore, because the questions are
//      what they WRITE and what they RETURN: `reference`/`refTopic` set at
//      post time, a topic sent alone never taking a page off the shelf, the
//      cross-chat GET /references any chat reads before paying to rebuild a
//      comparison that exists, and — the one that matters — /bookmarks
//      UNIONING the kept pages with the reference pages without duplicating a
//      page that is both (two equality queries can't be OR'd in Firestore, so
//      the union is hand-written and a mistake there is a row she taps twice).
//
//   2. The REAL page in headless Chromium against a stub feed: a reference
//      page she never bookmarked appears in the ARTIFACTS tab, the two piles
//      get headings only when BOTH exist, the topic shows on the row, and the
//      row's ↓ POSTs {reference:false} and takes the row away.
//
// Run: node scripts/test-chats-references.js
// playwright is an optionalDependency, so layer 2 skips cleanly without it.
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

// ── 1. the routes, against a stubbed Firestore ─────────────────────────────
const DELETE = { __delete: true };
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));
  function coll(name) {
    store[name] = store[name] || {};
    const setDoc = (id, patch, opt) => {
      const cur = (opt && opt.merge && store[name][id]) ? store[name][id] : {};
      const next = Object.assign({}, cur);
      Object.keys(patch).forEach((k) => {
        if (patch[k] === DELETE) delete next[k]; else next[k] = patch[k];
      });
      store[name][id] = next;
    };
    // a query remembers its equality filters and applies them in get()
    function q(filters) {
      return {
        where(field, op, val) { return q(filters.concat([[field, val]])); },
        orderBy() { return this; },
        limit() { return this; },
        async get() {
          const docs = Object.keys(store[name])
            .filter((id) => filters.every(([f, v]) => store[name][id][f] === v))
            .map((id) => ({ id, exists: true, data: () => store[name][id] }));
          return { empty: !docs.length, docs, size: docs.length, forEach: (f) => docs.forEach(f) };
        },
      };
    }
    return Object.assign(q([]), {
      doc(id) {
        const did = id || ('gen' + Object.keys(store[name]).length);
        return {
          id: did, __coll: name,
          async get() {
            const d = store[name][did];
            return { exists: !!d, id: did, data: () => d };
          },
          async set(patch, opt) { setDoc(did, patch, opt); },
        };
      },
    });
  }
  return { store, api: { collection: coll } };
}

function loadRouter(db) {
  const saved = [];
  const fakeAdmin = {
    apps: [{}],
    firestore: Object.assign(() => db.api, { FieldValue: { delete: () => DELETE } }),
    storage: () => ({ bucket: () => ({ file: (n) => ({ name: n, async save() { saved.push(n); } }) }) }),
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

async function call(handle, { body, query, params } = {}) {
  const req = { body: body || {}, query: query || {}, params: params || {}, headers: {}, get: () => undefined };
  let out = null, code = 200;
  const res = {
    status(c) { code = c; return this; },
    json(v) { out = v; return this; },
    set() { return this; },
  };
  await handle(req, res, () => {});
  return { code, body: out };
}

const ISO = (d) => new Date(d).toISOString();

async function routeTests() {
  console.log('the routes:');
  const db = makeDb({
    'forge-chat-pages': {
      // a standing reference, already on the shelf, never bookmarked
      qual: { chat: 'hospital-story-images', title: 'Quality ladder — low vs medium vs high',
        created: ISO('2026-08-05'), reference: true, refTopic: 'image quality' },
      // one that is BOTH kept and on the shelf — the union's trap
      styles: { chat: 'chatgpt-image-style-reference', title: 'Style tests — side by side (v1)',
        created: ISO('2026-08-04'), reference: true, refTopic: 'styles', bookmarked: true },
      // an ordinary one-off she kept
      cut: { chat: 'evan-story', title: 'Short 1 v4 — tightest cut',
        created: ISO('2026-08-06'), bookmarked: true },
      // an ordinary one-off she did not keep — belongs in neither pile
      plain: { chat: 'evan-story', title: 'Short 1 v3', created: ISO('2026-08-03') },
    },
    'forge-chat-feed': {},
    'forge-chat-registry': { 'evan-story': { displayName: 'Evan' } },
  });
  const mod = loadRouter(db);
  const router = mod.router || mod;
  const pages = () => db.store['forge-chat-pages'];

  // -- posting a page as a reference --------------------------------------
  const post = handlerFor(router, 'post', '/page');
  ok('POST /page exists', !!post);
  await call(post, { body: { chat: 'c', title: 'Scale 1 / 1.2 / 1.4', html: '<p>x</p>',
    reference: true, topic: '  LoRA Scale  ' } });
  const made = Object.keys(pages()).filter((k) => pages()[k].title === 'Scale 1 / 1.2 / 1.4')[0];
  ok('a page posted with reference:true lands on the shelf', made && pages()[made].reference === true);
  ok('…and its topic is normalised (trimmed, lower-cased)',
    made && pages()[made].refTopic === 'lora scale', made && pages()[made].refTopic);

  await call(post, { body: { chat: 'c', title: 'An ordinary sheet', html: '<p>x</p>' } });
  const plain2 = Object.keys(pages()).filter((k) => pages()[k].title === 'An ordinary sheet')[0];
  ok('an ordinary page carries NO reference field at all',
    plain2 && !('reference' in pages()[plain2]) && !('refTopic' in pages()[plain2]),
    JSON.stringify(pages()[plain2]));

  // -- the toggle ---------------------------------------------------------
  const refRoute = handlerFor(router, 'post', '/page/:id/reference');
  ok('POST /page/:id/reference exists', !!refRoute);

  let r = await call(refRoute, { params: { id: 'plain' }, body: { reference: true, topic: 'styles' } });
  ok('a page can be put on the shelf after the fact',
    r.body && r.body.ok === true && pages().plain.reference === true, JSON.stringify(r.body));

  // a topic sent ALONE must never change whether it is on the shelf — the
  // same contract as the bookmark route's note beside it
  await call(refRoute, { params: { id: 'plain' }, body: { topic: 'image quality' } });
  ok('a topic sent alone edits ONLY the topic',
    pages().plain.reference === true && pages().plain.refTopic === 'image quality',
    JSON.stringify(pages().plain));

  await call(refRoute, { params: { id: 'plain' }, body: { topic: '' } });
  ok("topic:'' clears the topic and leaves the page on the shelf",
    pages().plain.reference === true && !('refTopic' in pages().plain),
    JSON.stringify(pages().plain));

  await call(refRoute, { params: { id: 'qual' }, body: { reference: false } });
  ok('taking a page off the shelf KEEPS its topic (putting it back remembers)',
    pages().qual.reference === false && pages().qual.refTopic === 'image quality',
    JSON.stringify(pages().qual));
  await call(refRoute, { params: { id: 'qual' }, body: { reference: true } });

  r = await call(refRoute, { params: { id: '__nope' }, body: { reference: true } });
  ok('a page that does not exist is refused, never created',
    r.code === 404 && !('__nope' in pages()), r.code + ' ' + JSON.stringify(r.body));

  r = await call(refRoute, { params: { id: 'qual' }, body: {} });
  ok('an empty body is refused', r.code === 400, JSON.stringify(r.body));

  // -- the shelf ----------------------------------------------------------
  const shelf = handlerFor(router, 'get', '/references');
  ok('GET /references exists', !!shelf);
  r = await call(shelf, {});
  const ids = (r.body.pages || []).map((p) => p.id);
  ok('the shelf reaches ACROSS chats',
    ids.indexOf('qual') >= 0 && ids.indexOf('styles') >= 0, ids.join(','));
  ok('…and holds nothing that was never put on it',
    ids.indexOf('cut') < 0, ids.join(','));
  ok('newest first', (r.body.pages[0] || {}).created >= (r.body.pages[1] || {}).created,
    ids.join(','));
  ok('every row carries the url that opens it',
    (r.body.pages || []).every((p) => p.url === '/api/chatfeed/page/' + p.id));
  ok('the topics on file come back alongside',
    (r.body.topics || []).indexOf('image quality') >= 0
    && (r.body.topics || []).indexOf('styles') >= 0, JSON.stringify(r.body.topics));

  r = await call(shelf, { query: { topic: 'Styles' } });
  ok('?topic= filters, case-insensitively',
    r.body.pages.length === 1 && r.body.pages[0].id === 'styles',
    r.body.pages.map((p) => p.id).join(','));

  // -- the keep-pile ------------------------------------------------------
  const bm = handlerFor(router, 'get', '/bookmarks');
  r = await call(bm, {});
  const items = (r.body.items || []).filter((i) => i.kind === 'page');
  const byId = {};
  items.forEach((i) => { byId[i.id] = (byId[i.id] || 0) + 1; });
  ok('a reference page she never bookmarked IS in the keep-pile',
    !!byId.qual, items.map((i) => i.id).join(','));
  ok('a page that is BOTH kept and a reference appears exactly ONCE',
    byId.styles === 1, 'styles counted ' + byId.styles);
  ok('an ordinary kept page is still there', !!byId.cut, items.map((i) => i.id).join(','));
  const qual = items.filter((i) => i.id === 'qual')[0] || {};
  ok('a reference row carries its topic', qual.topic === 'image quality', JSON.stringify(qual));
  ok('…and says it is a reference', qual.reference === true, JSON.stringify(qual));
  ok('…and says whether she ALSO kept it (so the ↓ knows if the row leaves)',
    qual.bookmarked === false && (items.filter((i) => i.id === 'styles')[0] || {}).bookmarked === true,
    JSON.stringify(qual));

  // -- the chat's own Compare list ----------------------------------------
  const list = handlerFor(router, 'get', '/pages');
  r = await call(list, { query: { chat: 'hospital-story-images' } });
  ok('GET /pages reports the shelf state too',
    (r.body.pages || [])[0] && r.body.pages[0].reference === true
    && r.body.pages[0].topic === 'image quality', JSON.stringify(r.body.pages));
}

// ── 2. the real page ───────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); } catch { chromium = null; } }

const PUB = path.join(ROOT, 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const MSGS = [{ id: 'm1', chat: 'evan-story', from: 'claude', text: 'hi', tldr: 'hi',
  created: iso(T0 - 1000), postedAt: iso(T0 - 1000) }];
const CHATS = { 'evan-story': { account: '1', lastSeen: MSGS[0].created } };

function bmkItems() {
  return [
    { id: 'qual', chat: 'hospital-story-images', title: 'Quality ladder — low vs medium vs high',
      snippet: 'Quality ladder — low vs medium vs high', created: iso(T0 - 5e6), note: '',
      kind: 'page', reference: true, topic: 'image quality', bookmarked: false },
    { id: 'styles', chat: 'chatgpt-image-style-reference', title: 'Style tests — side by side',
      snippet: 'Style tests — side by side', created: iso(T0 - 6e6), note: '',
      kind: 'page', reference: true, topic: 'styles', bookmarked: false },
    { id: 'cut', chat: 'evan-story', title: 'Short 1 v4 — tightest cut',
      snippet: 'Short 1 v4 — tightest cut', created: iso(T0 - 4e6), note: '',
      kind: 'page', reference: false, topic: '', bookmarked: true },
    { id: 'msg1', chat: 'evan-story', snippet: 'a kept message', created: iso(T0 - 3e6),
      note: '', kind: 'read' },
  ];
}

async function pageTests() {
  console.log('the page:');
  if (!chromium) { console.log('  SKIP: playwright not installed'); return; }
  const refPosts = [];
  let items = bmkItems();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p === '/api/chatfeed' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        build: 'b1', chats: CHATS, settings: { appAccount: '1', categories: [] },
        truncated: [], messages: url.searchParams.get('since') ? [] : MSGS,
        delta: !!url.searchParams.get('since'),
      }));
    }
    if (p === '/api/chatfeed/bookmarks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ items, chats: CHATS }));
    }
    if (/^\/api\/chatfeed\/page\/[^/]+\/reference$/.test(p) && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => body += c);
      req.on('end', () => {
        refPosts.push({ id: p.split('/')[4], body: JSON.parse(body || '{}') });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if (p === '/' || p === '/chats') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, messages: [], todos: [] }));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((x) => { try { fs.accessSync(x); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const openArtifacts = async () => {
    await page.waitForSelector('#bmklink', { timeout: 8000 });
    await page.click('#bmklink');
    await page.waitForSelector('#grid .acctabs.bmktabs', { timeout: 6000 });
    await page.$$eval('#grid .acctabs.bmktabs .acctab', (ns) => ns[1].click());
    await page.waitForTimeout(300);
  };
  const groups = () => page.$$eval('#grid .bmkgrp', (ns) => ns.map((n) => n.textContent.trim()));
  const snips = () => page.$$eval('#grid .bmkrow .sr-snip', (ns) => ns.map((n) => n.textContent.trim()));

  try {
    await page.goto(base + '/chats');
    await openArtifacts();

    let s = await snips();
    ok('a reference page she NEVER bookmarked is in the ARTIFACTS tab',
      s.some((t) => /Quality ladder/.test(t)), s.join(' | '));
    ok('…alongside the ones she kept herself',
      s.some((t) => /tightest cut/.test(t)), s.join(' | '));
    ok('a kept MESSAGE has not leaked into the artifacts tab',
      !s.some((t) => /kept message/.test(t)), s.join(' | '));

    const g = await groups();
    ok('the two piles are headed REFERENCE then KEPT',
      g.length === 2 && /reference/i.test(g[0]) && /kept/i.test(g[1]), g.join(','));
    ok('the reference rows come FIRST',
      /Quality ladder|Style tests/.test(s[0] || ''), s.join(' | '));

    const badges = await page.$$eval('#grid .bmkrow .sr-kind', (ns) => ns.map((n) => n.textContent.trim()));
    ok('a reference row wears its topic',
      badges.indexOf('image quality') >= 0 && badges.indexOf('styles') >= 0, badges.join(','));

    // the ↓ takes it off the shelf
    const rows = await page.$$('#grid .bmkrow');
    const off = await rows[0].$('.pr-sup');
    ok('a reference row carries the take-it-off control', !!off);
    if (off) {
      await off.click();
      await page.waitForTimeout(300);
      ok('the ↓ POSTs reference:false for that page',
        refPosts.length === 1 && refPosts[0].body.reference === false,
        JSON.stringify(refPosts));
      s = await snips();
      ok('…and the row leaves the pile it was only in as a reference',
        !s.some((t) => /Quality ladder/.test(t)), s.join(' | '));
      ok('…without disturbing anything else',
        s.some((t) => /Style tests/.test(t)) && s.some((t) => /tightest cut/.test(t)),
        s.join(' | '));
    }

    // ONE kind of thing → a plain list, no headings (the Compare tabs' rule)
    items = bmkItems().filter((i) => i.kind !== 'page' || i.reference);
    await page.goto(base + '/chats');
    await openArtifacts();
    ok('with only reference pages there are NO headings',
      (await groups()).length === 0, (await groups()).join(','));

    // …and a page she kept but never a reference must NOT carry the ↓
    items = bmkItems().filter((i) => i.kind !== 'page' || !i.reference);
    await page.goto(base + '/chats');
    await openArtifacts();
    ok('an ordinary kept artifact has no take-it-off control',
      !(await page.$('#grid .bmkrow .pr-sup')));
    ok('…and still shows', (await snips()).some((t) => /tightest cut/.test(t)));
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  await routeTests();
  await pageTests();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();

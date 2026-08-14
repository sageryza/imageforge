#!/usr/bin/env node
// THE ARCHIVE IS TWO PILES (Aug 2026, Sophie: "right now the archive is a
// single list — I want to split it using the hairline pattern into two piles,
// one of things where we built something and something was accomplished and
// everything worked out, and then another one that's pretty much trash but I'm
// just keeping it for bookkeeping … obviously the default is the left side").
//
// Two layers, both run for real:
//
//   1. POST /api/chatfeed/archive-kind — the REAL route against a stubbed
//      Firestore, because the question is what it WRITES: 'other' stored,
//      'built' DELETING the field (absent is the default, so a stored 'built'
//      would be a second way to say the same thing), bulk, and — the one that
//      matters — a name with no registry doc SKIPPED rather than created. A
//      `set(…, merge)` on a missing doc writes it, and sortedChatNames lists
//      every registry key, so one typo would put a phantom row in her list
//      that only the Admin SDK can remove. That has happened in this app
//      before.
//
//   2. The REAL page in headless Chromium against a stub feed: the tab row
//      exists in the archive and nowhere else, BUILT is the landing tab, an
//      UNMARKED archived chat is on BUILT (the 81 already-archived chats had
//      no backfill), a marked one is on OTHER, the row's ↓ moves a chat and
//      POSTs the right body, and both tabs are actually tappable at 375/390/
//      430 — the pill has eaten a control in this app more than once.
//
// Run: node scripts/test-chats-archive-split.js
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

// ── 1. the route, against a stubbed Firestore ──────────────────────────────
const DELETE = { __delete: true };
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
        if (patch[k] === DELETE) delete next[k]; else next[k] = patch[k];
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
    firestore: Object.assign(() => db.api, { FieldValue: { delete: () => DELETE } }),
    storage: () => ({ bucket: () => ({}) }),
    credential: { cert: () => ({}) },
    initializeApp: () => {},
  };
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'firebase-admin') return fakeAdmin;
    return origLoad.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve(path.join(ROOT, 'chatfeed.js'))];
    return require(path.join(ROOT, 'chatfeed.js'));
  } finally { Module._load = origLoad; }
}

// find the POST /archive-kind handler on the express router
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

async function routeTests() {
  console.log('the route:');
  const db = makeDb({
    'forge-chat-registry': {
      built: { archived: true },
      junk: { archived: true },
      marked: { archived: true, archiveKind: 'other' },
    },
  });
  const mod = loadRouter(db);
  const router = mod.router || mod;
  const h = handlerFor(router, 'post', '/archive-kind');
  if (!h) { ok('POST /archive-kind exists', false, 'route not registered'); return; }
  ok('POST /archive-kind exists', true);
  const reg = () => db.store['forge-chat-registry'];

  let r = await call(h, { chat: 'junk', kind: 'other' });
  ok('marking one chat answers ok', r.body && r.body.ok === true, JSON.stringify(r.body));
  ok("'other' is stored on the registry doc", reg().junk.archiveKind === 'other',
    JSON.stringify(reg().junk));

  r = await call(h, { chat: 'marked', kind: 'built' });
  ok("'built' DELETES the field rather than storing a second default",
    !('archiveKind' in reg().marked), JSON.stringify(reg().marked));

  // absent kind is 'built' — a body with no kind must never be read as 'other'
  await call(h, { chat: 'junk', kind: 'other' });
  r = await call(h, { chat: 'junk' });
  ok('no kind at all means built', !('archiveKind' in reg().junk), JSON.stringify(reg().junk));

  // the archive flag itself is untouched — these are different questions
  ok('marking never touches `archived`', reg().junk.archived === true);

  // bulk, the way /category takes a selection
  r = await call(h, { chats: ['built', 'junk'], kind: 'other' });
  ok('bulk marks every named chat',
    reg().built.archiveKind === 'other' && reg().junk.archiveKind === 'other');

  // THE ONE THAT MATTERS: a name with no doc must not be created
  r = await call(h, { chats: ['built', '__nope-not-a-chat'], kind: 'other' });
  ok('a chat that does not exist is NOT created',
    !('__nope-not-a-chat' in reg()), Object.keys(reg()).join(','));
  ok('…and it is reported back as missing',
    r.body && Array.isArray(r.body.missing) && r.body.missing.indexOf('__nope-not-a-chat') >= 0,
    JSON.stringify(r.body));
  ok('…while the real chat in the same call still lands',
    reg().built.archiveKind === 'other');

  r = await call(h, {});
  ok('an empty body is refused', r.code === 400, JSON.stringify(r.body));
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
  { id: 'm1', chat: 'live-one', from: 'claude', text: 'still going', tldr: 'a', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'we-built-it', from: 'claude', text: 'shipped the thing', tldr: 'b', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'computer-wont-turn-on', from: 'claude', text: 'it turned on', tldr: 'c', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
  { id: 'm4', chat: 'also-built', from: 'claude', text: 'and this one', tldr: 'd', created: iso(T0 - 4000), postedAt: iso(T0 - 4000) },
];
const CHATS = {
  'live-one': { account: '1', lastSeen: MSGS[0].created },
  // deliberately NO archiveKind on the two built ones: the 81 chats that were
  // already archived when this shipped carry nothing, and they must read as
  // BUILT with no backfill.
  'we-built-it': { account: '1', lastSeen: MSGS[1].created, archived: true },
  // account 2 on purpose: the archive is not account-filtered, so this one
  // must show while the app is on the account-1 tab
  'also-built': { account: '2', lastSeen: MSGS[3].created, archived: true },
  'computer-wont-turn-on': { account: '1', lastSeen: MSGS[2].created, archived: true, archiveKind: 'other' },
};

async function pageTests() {
  console.log('the page:');
  if (!chromium) { console.log('  SKIP: playwright not installed'); return; }
  const kindPosts = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
      const since = url.searchParams.get('since');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        build: 'test-build-1', chats: CHATS,
        settings: { appAccount: '1', categories: [] },
        truncated: [], messages: since ? [] : MSGS, delta: !!since,
      }));
    }
    if (url.pathname === '/api/chatfeed/archive-kind' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => body += c);
      req.on('end', () => {
        kindPosts.push(JSON.parse(body || '{}'));
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
  const rows = () => page.$$eval('#grid .crow', (ns) => ns.map((n) => n.dataset.chat));

  try {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="live-one"]');

    // the tab row belongs to the archive and nowhere else
    ok('no pile tabs on the chat list', !(await page.$('#grid .archtabs')));

    await page.click('#archlink');
    await page.waitForSelector('#grid .archtabs', { timeout: 4000 })
      .catch(() => ok('the archive draws the hairline tab row', false));
    ok('the archive draws the hairline tab row', !!(await page.$('#grid .archtabs')));

    const labels = await page.$$eval('#grid .archtabs .acctab', (ns) => ns.map((n) => n.textContent.trim()));
    ok('two tabs, BUILT on the left', labels.length === 2 && /built/i.test(labels[0]), labels.join(','));
    ok('…and the other pile on the right', /other/i.test(labels[1] || ''), labels.join(','));

    // …and it is the hairline pattern, not a fresh look: same classes as the
    // account tabs, with the sliding line halved for two tabs
    const lineW = await page.evaluate(() => {
      const el = document.querySelector('#grid .archtabs');
      return getComputedStyle(el, '::after').width;
    });
    const rowW = await page.$eval('#grid .archtabs', (n) => n.getBoundingClientRect().width);
    ok('the sliding line is exactly one tab wide',
      Math.abs(parseFloat(lineW) - rowW / 2) < 2, lineW + ' of ' + rowW);

    // landing tab + the no-backfill rule
    ok('it lands on BUILT', await page.evaluate(() => window.__archTab() === 'built'));
    // ONE tab row in the archive (Aug 2026, Sophie): the account tabs are
    // hidden here, so BUILT / OTHER is the only question on screen — and the
    // account FILTER goes with the row rather than becoming a silent one.
    const shown = await page.$$eval('.acctabs', (ns) => ns.filter(
      (n) => getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0)
      .map((n) => n.id || n.className));
    ok('exactly one tab row in the archive', shown.length === 1, shown.join(' | '));
    ok('…and it is the pile row, not the account row',
      /archtabs/.test(shown[0] || ''), shown.join(' | '));

    let r = await rows();
    ok('an UNMARKED archived chat is on BUILT (no backfill needed)',
      r.indexOf('we-built-it') >= 0 && r.indexOf('also-built') >= 0, r.join(','));
    ok('…including one on the OTHER account — the archive is not split by account',
      r.indexOf('also-built') >= 0, r.join(','));
    ok('a marked chat is NOT on BUILT',
      r.indexOf('computer-wont-turn-on') < 0, r.join(','));
    ok('a live chat is in neither pile', r.indexOf('live-one') < 0, r.join(','));

    // the other pile
    await page.$$eval('#grid .archtabs .acctab', (ns) => ns[1].click());
    await page.waitForTimeout(120);
    r = await rows();
    ok('OTHER holds exactly the marked chat',
      r.length === 1 && r[0] === 'computer-wont-turn-on', r.join(','));
    ok('the sliding line moved to slot 1',
      (await page.$eval('#grid .archtabs', (n) => n.dataset.on)) === '1');

    // moving one across, from its row
    await page.$$eval('#grid .archtabs .acctab', (ns) => ns[0].click());
    await page.waitForTimeout(120);
    const btn = await page.$('#grid .crow[data-chat="also-built"] .archbtn');
    ok('a row in the archive carries the move button', !!btn);
    // …and it replaced the hide ⊖, which could never do anything here
    ok('the dead hide button is not also on the row',
      !(await page.$('#grid .crow[data-chat="also-built"] .hidebtn')));
    if (btn) {
      await btn.click();
      await page.waitForTimeout(200);
      r = await rows();
      ok('the moved chat leaves BUILT at once', r.indexOf('also-built') < 0, r.join(','));
      const post = kindPosts.find((p) => p.chat === 'also-built');
      ok('…and it POSTs kind=other', post && post.kind === 'other', JSON.stringify(kindPosts));
      await page.$$eval('#grid .archtabs .acctab', (ns) => ns[1].click());
      await page.waitForTimeout(120);
      r = await rows();
      ok('…and it is now on OTHER', r.indexOf('also-built') >= 0, r.join(','));
      // back again
      await page.click('#grid .crow[data-chat="also-built"] .archbtn');
      await page.waitForTimeout(200);
      const back = kindPosts.filter((p) => p.chat === 'also-built').pop();
      ok('the ↺ sends it back as kind=built', back && back.kind === 'built', JSON.stringify(back));
    }

    // both tabs tappable at every width — the pill has eaten a control before
    for (const width of [375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(80);
      const hit = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#grid .archtabs .acctab')];
        return tabs.map((t) => {
          const b = t.getBoundingClientRect();
          const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return !!(el && (el === t || t.contains(el)));
        });
      });
      ok('both pile tabs are tappable at ' + width,
        hit.length === 2 && hit.every(Boolean), JSON.stringify(hit));
    }

    // leaving and coming back opens on BUILT — never a sticky junk pile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.__setArchTab('other'));
    await page.reload();
    await page.waitForSelector('#grid [data-chat="live-one"]');
    await page.click('#archlink');
    await page.waitForSelector('#grid .archtabs');
    ok('a fresh load opens the archive on BUILT',
      await page.evaluate(() => window.__archTab() === 'built'));
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  await routeTests();
  await pageTests();
  if (fails) { console.log('\n' + fails + ' FAILED'); process.exit(1); }
  console.log('\nPASS: the archive splits into BUILT / OTHER, and the mark is safe');
})().catch((e) => { console.error(e); process.exit(1); });

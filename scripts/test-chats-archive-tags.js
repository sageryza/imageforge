#!/usr/bin/env node
// TAGS INSTEAD OF PILES (Aug 2026, Sophie: "rather than having the built/other
// tabs I think it would be better to have actual Tags … and so what I want to
// add is a bookmark and a star on the left that will be filled in if it's
// already bookmarked or star … next to that coming towards the right I want a
// list of tags … then I can click the tag or tags that fit it best and it will
// be stored with those tags and then those tags become a list of options at the
// top of the archive that I can click on and filter by").
//
// This REPLACES scripts/test-chats-archive-split.js, whose subject — the BUILT /
// OTHER hairline tabs and the ↓ that moved a chat between them — no longer
// exists. What survived from it is the shape of the test and the one assertion
// that mattered most, the phantom-row guard: a `set(…, merge)` on a missing doc
// CREATES it, and sortedChatNames lists every registry key, so one typo would
// put a row in her list that only the Admin SDK can remove. That has happened in
// this app before, so every chat-keyed write gets that test.
//
// Three layers, all run for real:
//   1. POST /api/chatfeed/tags against a stubbed Firestore — what it WRITES:
//      the array stored, an unknown word dropped rather than the save refused,
//      an empty pick DELETING the field, and a name with no doc skipped.
//   2. the two vocabularies pinned equal — chats.html's TAG_LIST against
//      chatfeed.js's TAGS. They are two copies by necessity (the page must not
//      pay a request to learn ten words) and drift would let her file a tag
//      the server silently drops.
//   3. the REAL page in headless Chromium: the sheet's header on top, no name
//      box anywhere in it, the star and bookmark filled to match the chat and
//      toggling, a tag chip saving on the tap, and the archive's filter row
//      offering only tags that are in there — with an already-archived chat
//      carrying no tags reading as `built`, which is what spares the 97 chats
//      already in the archive a backfill.
//
// Run: node scripts/test-chats-archive-tags.js
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
      shipped: { archived: true },
      tagged: { archived: true, tags: ['built'] },
    },
  });
  const mod = loadRouter(db);
  const router = mod.router || mod;
  const h = handlerFor(router, 'post', '/tags');
  if (!h) { ok('POST /tags exists', false, 'route not registered'); return; }
  ok('POST /tags exists', true);
  const reg = () => db.store['forge-chat-registry'];

  let r = await call(h, { chat: 'shipped', tags: ['bug fix', 'built'] });
  ok('tagging one chat answers ok', r.body && r.body.ok === true, JSON.stringify(r.body));
  ok('the tags are stored as an array',
    JSON.stringify(reg().shipped.tags) === '["bug fix","built"]', JSON.stringify(reg().shipped));
  ok('tagging never touches `archived`', reg().shipped.archived === true);

  // A word the server does not know is DROPPED, not refused: her phone can be
  // running a page from days ago, and one retired tag must not fail the save.
  r = await call(h, { chat: 'shipped', tags: ['story', 'nonsense-tag'] });
  ok('an unknown tag is dropped, and the rest still lands',
    JSON.stringify(reg().shipped.tags) === '["story"]', JSON.stringify(reg().shipped));

  r = await call(h, { chat: 'shipped', tags: ['built', 'built', 'BUILT'] });
  ok('the same word twice is stored once',
    JSON.stringify(reg().shipped.tags) === '["built"]', JSON.stringify(reg().shipped));

  // Un-picking everything clears the field rather than storing an empty array —
  // the same reasoning the piles used for 'built': one way to say "nothing".
  r = await call(h, { chat: 'shipped', tags: [] });
  ok('clearing every tag DELETES the field', !('tags' in reg().shipped), JSON.stringify(reg().shipped));

  r = await call(h, { chat: 'tagged' });
  ok('a body with no tags array is refused', r.code === 400, JSON.stringify(r.body));
  ok('…and the chat it named is untouched',
    JSON.stringify(reg().tagged.tags) === '["built"]', JSON.stringify(reg().tagged));

  // THE ONE THAT MATTERS: a name with no doc must not be created
  r = await call(h, { chat: '__nope-not-a-chat', tags: ['built'] });
  ok('a chat that does not exist is NOT created',
    !('__nope-not-a-chat' in reg()), Object.keys(reg()).join(','));
  ok('…and it is refused rather than silently ok', r.code === 404, JSON.stringify(r.body));

  r = await call(h, { tags: ['built'] });
  ok('an empty body is refused', r.code === 400, JSON.stringify(r.body));
}

// ── 2. the two vocabularies, pinned equal ──────────────────────────────────
function vocabTests() {
  console.log('the vocabulary:');
  const server = fs.readFileSync(path.join(ROOT, 'chatfeed.js'), 'utf8');
  const page = fs.readFileSync(path.join(ROOT, 'public/chats.html'), 'utf8');
  const lift = (src, decl) => {
    const i = src.indexOf(decl);
    if (i < 0) return null;
    const a = src.indexOf('[', i), b = src.indexOf(']', a);
    try { return JSON.parse(src.slice(a, b + 1).replace(/'/g, '"')); } catch { return null; }
  };
  const srv = lift(server, 'const TAGS = [');
  const pg = lift(page, "var TAG_LIST=[");
  ok('chatfeed.js declares TAGS', Array.isArray(srv) && srv.length > 0);
  ok('chats.html declares TAG_LIST', Array.isArray(pg) && pg.length > 0);
  ok('the page and the server know the SAME tags',
    JSON.stringify(srv) === JSON.stringify(pg),
    JSON.stringify(srv) + ' vs ' + JSON.stringify(pg));
  ok('every one of her five is in there',
    ['bug fix', 'new feature', 'built', 'story', 'quick question']
      .every((t) => (srv || []).indexOf(t) > -1), JSON.stringify(srv));
}

// ── 3. the real page ───────────────────────────────────────────────────────
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
  { id: 'm3', chat: 'the-bug', from: 'claude', text: 'fixed it', tldr: 'c', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
];
const CHATS = {
  'live-one': { account: '1', lastSeen: MSGS[0].created, starred: true,
    sophieNote: 'the tags one' },
  // deliberately NO tags: an archived chat that predates them must read as
  // `built`, which is what spares the 97 already in there a backfill.
  'we-built-it': { account: '1', lastSeen: MSGS[1].created, archived: true },
  'the-bug': { account: '1', lastSeen: MSGS[2].created, archived: true,
    tags: ['bug fix'], bookmarked: true,
    sophieNote: 'why I put it away', wrapLine: 'a summary nobody should see over her note' },
};

async function pageTests() {
  console.log('the page:');
  if (!chromium) { console.log('  SKIP: playwright not installed'); return; }
  const posts = { tags: [], star: [], bmk: [], archive: [], note: [] };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const take = (bin) => {
      let body = '';
      req.on('data', (c) => body += c);
      req.on('end', () => {
        posts[bin].push(JSON.parse(body || '{}'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    };
    if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
      const since = url.searchParams.get('since');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        build: 'test-build-1', chats: CHATS,
        settings: { appAccount: '1', categories: [] },
        truncated: [], messages: since ? [] : MSGS, delta: !!since,
      }));
    }
    if (url.pathname === '/api/chatfeed/tags' && req.method === 'POST') return take('tags');
    if (url.pathname === '/api/chatfeed/chatnote' && req.method === 'POST') return take('note');
    if (url.pathname === '/api/chatfeed/star' && req.method === 'POST') return take('star');
    if (url.pathname === '/api/chatfeed/chat-bookmark' && req.method === 'POST') return take('bmk');
    if (url.pathname === '/api/chatfeed/archive' && req.method === 'POST') return take('archive');
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

    // ---- the sheet -------------------------------------------------------
    await page.click('#grid [data-chat="live-one"]');
    await page.waitForSelector('#thread .archlink.arch-g');
    await page.click('#thread .archlink.arch-g');
    await page.waitForSelector('.askwrap .arctags');

    ok('the question is the first thing in the sheet',
      await page.$eval('.askbox', (n) => n.firstElementChild.tagName === 'P'
        && /archive this chat/i.test(n.firstElementChild.textContent)));
    // "let's make it impossible to change the name of the chat in this instance"
    // The only text box in here is HER NOTE — renaming lives on the pencil in
    // the thread header and nowhere else.
    ok('there is no rename box in the sheet', (await page.$$('.askwrap .arcname')).length === 0);
    ok('and the only input is her note',
      (await page.$$eval('.askwrap input', (ns) => ns.map((n) => n.className).join(','))) === 'arcnote');
    ok('and no pile tabs either', (await page.$$('.askwrap .arctabs')).length === 0);

    // the marks read the chat's real state — live-one is starred, not kept
    ok('the star is filled because this chat is starred',
      await page.$eval('.askwrap .arcstar', (n) => n.classList.contains('on')));
    ok('the bookmark is empty because it is not kept',
      await page.$eval('.askwrap .arcbmk', (n) => !n.classList.contains('on')));

    // THE GLYPH, not just the class (Sophie, 2026-08-15: "the bookmark doesn't
    // fill in when I click it, that's frustrating"). BMK_SVG is drawn
    // `fill="none"`, so lighting the button recoloured the OUTLINE and left the
    // bookmark hollow — the class was on the whole time and the first version of
    // this test asserted exactly that, which is why it passed while she was
    // looking at a dead-looking control. Assert the PAINT.
    const bmkFill = () => page.$eval('.askwrap .arcbmk svg path', (n) => getComputedStyle(n).fill);
    const hollow = await bmkFill();
    ok('the bookmark starts hollow', hollow === 'none', hollow);
    await page.click('.askwrap .arcbmk');
    await page.waitForTimeout(200);
    ok('tapping the bookmark lights it',
      await page.$eval('.askwrap .arcbmk', (n) => n.classList.contains('on')));
    const filled = await bmkFill();
    ok('…and the glyph actually FILLS, not just the outline',
      filled !== 'none' && filled !== hollow, filled);
    ok('…and files it straight away',
      posts.bmk.length === 1 && posts.bmk[0].chat === 'live-one' && posts.bmk[0].bookmarked === true,
      JSON.stringify(posts.bmk));
    // The star was never broken — it is drawn `fill="currentColor"` — which is
    // why only one of the two marks looked dead. Pin that it stays filled.
    ok('the star, already set, is drawn filled',
      (await page.$eval('.askwrap .arcstar svg path', (n) => getComputedStyle(n).fill)) !== 'none');

    const chips = await page.$$eval('.askwrap .arctags .catchip', (ns) => ns.map((n) => n.textContent.trim()));
    ok('her five tags are all offered',
      ['bug fix', 'new feature', 'built', 'story', 'quick question'].every((t) => chips.indexOf(t) > -1),
      chips.join(' · '));
    ok('none of them is picked on a chat with no tags',
      await page.$$eval('.askwrap .arctags .catchip.on', (ns) => ns.length) === 0);

    const chip = (label) => page.$$eval('.askwrap .arctags .catchip', (ns, l) => {
      const b = ns.find((n) => n.textContent.trim() === l);
      if (b) b.click();
      return !!b;
    }, label);
    ok('tapping a tag needs the chip to be there', await chip('bug fix'));
    await page.waitForTimeout(200);
    ok('tapping a tag lights it',
      await page.$$eval('.askwrap .arctags .catchip.on', (ns) => ns.length) === 1);
    ok('…and saves it on the tap, not on Archive',
      posts.tags.length === 1 && posts.tags[0].chat === 'live-one'
      && JSON.stringify(posts.tags[0].tags) === '["bug fix"]', JSON.stringify(posts.tags));
    ok('nothing has been archived yet', posts.archive.length === 0);

    // a second tag rides along with the first
    await chip('story');
    await page.waitForTimeout(200);
    ok('a second tag joins rather than replacing',
      JSON.stringify((posts.tags[1] || {}).tags) === '["bug fix","story"]', JSON.stringify(posts.tags));
    // …and tapping it again takes it off
    await chip('story');
    await page.waitForTimeout(200);
    ok('tapping a lit tag un-picks it',
      JSON.stringify((posts.tags[2] || {}).tags) === '["bug fix"]', JSON.stringify(posts.tags));

    // ---- her own note ----------------------------------------------------
    ok('there is one note box, and it is a single line',
      (await page.$$('.askwrap .arcnote')).length === 1
      && (await page.$eval('.askwrap .arcnote', (n) => n.tagName)) === 'INPUT');
    ok('it arrives carrying the note she already wrote',
      (await page.$eval('.askwrap .arcnote', (n) => n.value)) === 'the tags one');
    await page.fill('.askwrap .arcnote', 'archived, tags shipped');
    await page.waitForTimeout(400);
    ok('typing in it saves to her OWN note field, not a second one',
      posts.note.length > 0 && posts.note[posts.note.length - 1].chat === 'live-one'
      && posts.note[posts.note.length - 1].note === 'archived, tags shipped',
      JSON.stringify(posts.note));

    // Cancel means "don't archive it" — the tags she just picked stay picked
    await page.click('.askwrap .askrow button:not(.go)');
    await page.waitForTimeout(200);
    ok('Cancel closes the sheet', (await page.$$('.askwrap')).length === 0);
    ok('and archives nothing', posts.archive.length === 0);
    await page.click('#thread .archlink.arch-g');
    await page.waitForSelector('.askwrap .arctags');
    ok('re-opening it shows the tag still picked',
      await page.$$eval('.askwrap .arctags .catchip.on', (ns) => ns.length) === 1);
    await page.click('.askwrap .askrow button:not(.go)');
    await page.waitForTimeout(200);

    // ---- the archive's filter row ----------------------------------------
    await page.click('#thread header .no .archlink.hide-r').catch(() => {});
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="live-one"]');
    ok('no tag filter row on the chat list', !(await page.$('#grid .arctagrow')));

    await page.click('#archlink');
    await page.waitForSelector('#grid .arctagrow', { timeout: 4000 })
      .catch(() => ok('the archive draws the filter row', false));
    const filters = await page.$$eval('#grid .arctagrow .catchip', (ns) => ns.map((n) => n.textContent.trim()));
    ok('ALL leads the row', filters[0] === 'All', filters.join(' · '));
    ok('the tags actually in the archive are offered',
      filters.indexOf('bug fix') > -1 && filters.indexOf('built') > -1, filters.join(' · '));
    ok('a tag nobody used is NOT offered — the row is not the whole vocabulary',
      filters.indexOf('research') < 0 && filters.indexOf('audio') < 0, filters.join(' · '));
    ok('both archived chats are showing under All', (await rows()).length === 2, (await rows()).join(','));

    // the no-backfill rule: an archived chat with no tags reads as `built`
    await page.click('#grid .arctagrow .catchip:nth-of-type(' + (filters.indexOf('built') + 1) + ')');
    await page.waitForTimeout(200);
    ok('filtering by BUILT finds the chat that carries no tags at all',
      JSON.stringify(await rows()) === '["we-built-it"]', (await rows()).join(','));

    await page.click('#grid .arctagrow .catchip:nth-of-type(' + (filters.indexOf('bug fix') + 1) + ')');
    await page.waitForTimeout(200);
    ok('filtering by BUG FIX finds only the tagged one',
      JSON.stringify(await rows()) === '["the-bug"]', (await rows()).join(','));
    // Session-only, like every other filter here: a reload opens the archive on
    // everything, never on a slice she has no memory of choosing.
    ok('the filter is really set right now',
      await page.evaluate(() => window.__archTag()) === 'bug fix');
    await page.reload();
    await page.waitForSelector('#grid [data-chat="live-one"]');
    await page.click('#archlink');
    await page.waitForSelector('#grid .arctagrow');
    ok('a reload opens the archive on everything again',
      await page.evaluate(() => window.__archTag()) === ''
      && (await rows()).length === 2, (await rows()).join(','));

    await page.click('#grid .arctagrow .catchip:nth-of-type(1)');
    await page.waitForTimeout(200);
    ok('ALL puts everything back', (await rows()).length === 2, (await rows()).join(','));

    // the ↓ went with the piles it moved chats between
    ok('an archive row carries no pile-mover', !(await page.$('#grid .crow .archbtn')));
    // Her note is the italic line under the bold name — the same place it sits
    // before a chat is archived, and it still beats anything a chat wrote.
    ok('her note is the line on the archived row',
      (await page.$eval('#grid .crow[data-chat="the-bug"] .cr-note', (n) => n.textContent.trim()))
        === 'why I put it away');
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  await routeTests();
  vocabTests();
  await pageTests();
  if (fails) { console.log('\n' + fails + ' FAILED'); process.exit(1); }
  console.log('\nPASS: tags replace the piles — stored, pinned, and the archive filters by them');
})().catch((e) => { console.error(e); process.exit(1); });

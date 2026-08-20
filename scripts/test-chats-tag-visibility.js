#!/usr/bin/env node
// WHICH WORDS EACH SURFACE OFFERS, AND WHAT SEE MORE LOOKS LIKE (Aug 2026,
// Sophie, in one sitting):
//   • "see more shud look different so as not to be confused with being a
//     category/tag"
//   • "I wanna make certain tags just available in the archived step, these
//     tags are failure, bug fix, and new feature for now" → "also put built as
//     one of the archive only tags" → "put bug fix and new feature into the
//     progress tags for just the archive"
//   • "for the archive, get rid of the following tags: look at, come back to,
//     to read, to be reviewed, waiting for answer"
//   • "and waiting for a response should be in progress tags"
//   • "there's a story and stories tags — get rid of stories, but make sure to
//     put everything that's in stories currently into story before you get rid
//     of it" · "get rid of the weird games tag"
//   • "get rid of images audio and writing" · "research goes in progress not
//     categories" → "so does quick question" → "quick question and research
//     should only be in the archive tag tab"
//
// One vocabulary had been doing two jobs. HOW A CHAT ENDED (built · failure ·
// bug fix · new feature · research · quick question) is a judgement she only
// makes while archiving; WHERE LIVE WORK STANDS (look at · come back to · to
// read · to be reviewed · waiting for a response) is answered BY archiving.
// Each surface takes one list out, and `paintVocabChips` is the single place
// that decides. Note that ARCHIVE_ONLY does BOTH jobs for a word: offered in
// the archive alone, AND read as a progress word there — which is why
// `research` and `quick question` are not also in TASK_LABELS.
//
// Layer 1 (pure, no network) pins the constants that cannot drift:
//   the page's TAG_LIST against chatfeed.js's TAGS, the two PILE_SEEDS copies,
//   ARCHIVE_ONLY and LIVE_ONLY not overlapping, `story` inheriting the pile
//   seat `stories` gave up, and every forgotten word gone from every list.
// Layer 2 drives the REAL page headless: the home row and the Organize sheet
// hide the archive-only words, the archive sheet and the archive's own FILTER
// ROW hide the five live ones and carry the archive words in their PROGRESS
// group (above the CATEGORIES rule, not under it), and SEE MORE is drawn as a
// control — no border, no box, the accent colour, a chevron — rather than as
// another chip.
// Layer 3 runs POST /labels/forget against a stubbed Firestore: the merge lands
// on every chat before the word is dropped, `catBy` survives it, and the word
// leaves the remembered vocabulary as well as the chats.
//
//   node scripts/test-chats-tag-visibility.js
// playwright is an optionalDependency, so layer 2 skips cleanly without it.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

const HTML = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
const arrOf = (name) => {
  const m = HTML.match(new RegExp('var ' + name + '=(\\[[\\s\\S]*?\\]);'));
  if (!m) return null;
  return JSON.parse(m[1].replace(/'/g, '"').replace(/,(\s*])/g, '$1'));
};

// ── 1. the constants ───────────────────────────────────────────────────────
console.log('the vocabulary');
const TAG_LIST = arrOf('TAG_LIST');
const PILE_PAGE = arrOf('PILE_SEEDS');
const TASK_LABELS = arrOf('TASK_LABELS');
const ARCHIVE_ONLY = arrOf('ARCHIVE_ONLY');
const LIVE_ONLY = arrOf('LIVE_ONLY');
const server = require(path.join(ROOT, 'chatfeed.js'));
// The archive-only words as the page CAPITALISES them, for the page layer.
const ARCH_WORDS = ARCHIVE_ONLY.map((w) => w.charAt(0).toUpperCase() + w.slice(1));

ok('the page and the server agree on the tag seeds',
  JSON.stringify(TAG_LIST) === JSON.stringify(server.TAGS),
  JSON.stringify(TAG_LIST) + ' vs ' + JSON.stringify(server.TAGS));
ok('…and on the pile seeds',
  JSON.stringify(PILE_PAGE) === JSON.stringify(server.PILE_SEEDS),
  JSON.stringify(PILE_PAGE) + ' vs ' + JSON.stringify(server.PILE_SEEDS));
ok('the six archive-only words',
  JSON.stringify(ARCHIVE_ONLY) === JSON.stringify(
    ['built', 'failure', 'bug fix', 'new feature', 'research', 'quick question']),
  JSON.stringify(ARCHIVE_ONLY));
// The three she had never made and could see nothing in (Aug 2026: "get rid of
// images audio and writing"). Measured the day they went: images 0 chats,
// writing 0, audio 3 — all archived.
['images', 'audio', 'writing'].forEach((w) => {
  ok('\u201c' + w + '\u201d is out of the vocabulary',
    TAG_LIST.indexOf(w) < 0 && PILE_PAGE.indexOf(w) < 0 && TASK_LABELS.indexOf(w) < 0,
    JSON.stringify(TAG_LIST));
});
// Being ARCHIVE_ONLY is what makes a word a PROGRESS word in the archive —
// putting these two in TASK_LABELS as well would drop them back on the home row
// and into Organize, which is the opposite of what she asked for.
ok('`research` and `quick question` are NOT in TASK_LABELS',
  ['research', 'quick question'].every((w) => TASK_LABELS.indexOf(w) < 0),
  JSON.stringify(TASK_LABELS));
ok('the five live-progress words are the archive-hidden list',
  JSON.stringify(LIVE_ONLY) === JSON.stringify(
    ['look at', 'come back to', 'to read', 'to be reviewed', 'waiting for a response']),
  JSON.stringify(LIVE_ONLY));
// A word on BOTH lists would be offered nowhere at all — a chip that exists in
// the vocabulary and appears on no surface is a word she can never take off.
ok('no word is on both lists',
  ARCHIVE_ONLY.every((w) => LIVE_ONLY.indexOf(w) < 0));
// Every archive word must still be IN the vocabulary, or the archive sheet
// would filter it out of `fileVocab()` before the group ever sees it.
ok('every archive-only word is a seed the vocabulary carries',
  ARCHIVE_ONLY.every((w) => TAG_LIST.indexOf(w) > -1), JSON.stringify(TAG_LIST));
ok('`waiting for a response` is a progress word now',
  TASK_LABELS.indexOf('waiting for a response') > -1, JSON.stringify(TASK_LABELS));
ok('…and the outcome words have left the progress list',
  ARCHIVE_ONLY.every((w) => TASK_LABELS.indexOf(w) < 0), JSON.stringify(TASK_LABELS));
// THE ONE THING THAT WOULD HAVE COST HER REAL WORK: `stories` filed a chat
// away and `story` did not, so merging 36 chats into a word that is not a pile
// would have dumped all 36 back onto her main list.
ok('`story` inherited the pile seat `stories` gave up',
  PILE_PAGE.indexOf('story') > -1 && PILE_PAGE.indexOf('stories') < 0,
  JSON.stringify(PILE_PAGE));
ok('`weird games` is gone from the piles', PILE_PAGE.indexOf('weird games') < 0);
['stories', 'weird games', 'failed'].forEach((w) => {
  ok('“' + w + '” is in no seed list any more',
    TAG_LIST.indexOf(w) < 0 && PILE_PAGE.indexOf(w) < 0 && TASK_LABELS.indexOf(w) < 0);
});

// ── 3. POST /labels/forget, against a stubbed Firestore ────────────────────
// (Before the page, because it needs no browser — a skipped layer 2 must not
// take this with it.)
const DELETE = { __delete: true };
const UNION = (v) => ({ __union: v });
const REMOVE = (v) => ({ __remove: v });
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
        if (v === DELETE || (v && v.__delete)) { delete next[k]; return; }
        if (v && v.__union) {
          next[k] = (Array.isArray(next[k]) ? next[k] : []).concat(
            v.__union.filter((x) => (next[k] || []).indexOf(x) < 0));
          return;
        }
        if (v && v.__remove) {
          next[k] = (Array.isArray(next[k]) ? next[k] : []).filter((x) => v.__remove.indexOf(x) < 0);
          return;
        }
        next[k] = v;
      });
      store[name][id] = next;
    };
    return {
      doc: (id) => ({
        get: async () => ({ exists: !!store[name][id], id, data: () => store[name][id] }),
        set: async (patch, opt) => setDoc(id, patch, opt),
      }),
      get: async () => ({
        docs: Object.keys(store[name]).map((id) => ({ id, data: () => store[name][id] })),
      }),
    };
  }
  return {
    store, writes,
    db: {
      collection: coll,
      batch: () => {
        const q = [];
        return { set: (ref, patch, opt) => q.push([ref, patch, opt]),
          commit: async () => { for (const [ref, patch, opt] of q) await ref.set(patch, opt); } };
      },
    },
  };
}

async function forgetTests() {
  console.log('\nforgetting a word');
  const REG = 'forge-chat-registry';
  const seed = { [REG]: {
    __settings: { categories: ['stories', 'story', 'witch', 'weird games'] },
    a: { labels: ['stories', 'witch'], catBy: 'sophie' },
    b: { labels: ['stories'], catBy: 'auto' },
    c: { labels: ['stories', 'story'] },
    d: { category: 'stories', tags: ['bug fix'] },   // the OLD two-field shape
    e: { labels: ['witch'] },
  } };
  const fake = makeDb(seed);
  const admin = {
    firestore: Object.assign(() => fake.db, {
      FieldValue: {
        delete: () => DELETE,
        arrayUnion: (...v) => UNION(v),
        arrayRemove: (...v) => REMOVE(v),
      },
      Timestamp: { now: () => ({ toDate: () => new Date() }) },
    }),
    apps: [{}], initializeApp: () => {}, credential: { cert: () => ({}) },
  };
  const Module = require('module');
  const realLoad = Module._load;
  Module._load = function (req, parent, isMain) {
    if (req === 'firebase-admin') return admin;
    return realLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve(path.join(ROOT, 'chatfeed.js'))];
  const router = require(path.join(ROOT, 'chatfeed.js'));
  Module._load = realLoad;

  const stack = ((router.router || router).stack) || [];
  const layer = stack.find((l) => l.route && l.route.path === '/labels/forget'
    && l.route.methods && l.route.methods.post);
  ok('POST /labels/forget exists', !!layer);
  if (!layer) return;
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  const call = async (body) => {
    let out = null;
    await handler({ body }, {
      status(c) { this._c = c; return this; },
      json(j) { out = { code: this._c || 200, body: j }; return this; },
    }, () => {});
    return out;
  };

  let r = await call({ label: 'stories', into: 'story', dry: true });
  ok('a dry run names every chat and writes nothing',
    r.body.dry === true && r.body.chats.sort().join(',') === 'a,b,c,d'
    && fake.writes.length === 0, JSON.stringify(r.body.chats));
  // The seat: `stories` gave its place in PILE_SEEDS to `story` in the same
  // commit that ran this, so the dry run can SAY so — the 36 chats stay filed.
  // A merge into a word that is NOT a pile is the case to check before running
  // it for real, and this is the number that tells her which one she has.
  ok('…and says whether the survivor files a chat away',
    r.body.intoIsPile === true && r.body.droppedPile === false, JSON.stringify(r.body));

  r = await call({ label: 'stories', into: 'story' });
  const reg = fake.store[REG];
  ok('every chat that had it now has the survivor',
    ['a', 'b', 'c', 'd'].every((n) => reg[n].labels.indexOf('story') > -1),
    JSON.stringify(reg));
  ok('…and none of them still has the forgotten word',
    Object.keys(reg).filter((n) => n !== '__settings')
      .every((n) => (reg[n].labels || []).indexOf('stories') < 0));
  ok('a chat already wearing both keeps ONE',
    reg.c.labels.filter((t) => t === 'story').length === 1, JSON.stringify(reg.c.labels));
  ok('the OLD two-field shape is read and rewritten whole',
    reg.d.labels.sort().join(',') === 'bug fix,story', JSON.stringify(reg.d.labels));
  // Renaming her vocabulary is not a filing decision about the chats the
  // auto-sorter had filed — stamping them `sophie` would lock it out forever.
  ok('`catBy` is preserved, not stamped', reg.b.catBy === 'auto' && reg.a.catBy === 'sophie');
  ok('a chat that never had the word is untouched',
    JSON.stringify(reg.e.labels) === '["witch"]');
  ok('the word leaves the remembered vocabulary',
    reg.__settings.categories.indexOf('stories') < 0
    && reg.__settings.categories.indexOf('story') > -1,
    JSON.stringify(reg.__settings.categories));
  ok('`pileLabels` is left alone while it is still the code seed',
    reg.__settings.pileLabels === undefined);

  // …and a plain forget, with nothing to merge into.
  r = await call({ label: 'weird games' });
  ok('forgetting with no survivor is fine', r.body.ok === true);
  r = await call({ label: 'witch', into: 'witch' });
  ok('merging a word into itself is refused', r.code === 400);
  r = await call({ label: '' });
  ok('an empty word is refused', r.code === 400);
}

// ── 2. the real page ───────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); } catch { chromium = null; } }

const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const MSGS = ['live-one', 'arch-one', 'reading', 'arch-two'].map((c, i) => ({
  id: 'm' + i, chat: c, from: 'claude', text: c, tldr: c,
  created: iso(T0 - (4 - i) * 3600000), postedAt: iso(T0 - (4 - i) * 3600000),
}));
// `live-one` carries NO label: `witch` is a pile seed, so a chat wearing it is
// filed off the main list and the row would never be reached.
const CHATS = {
  'live-one': { account: '1' },
  'arch-one': { account: '1', archived: true, labels: ['bug fix', 'witch'] },
  // THE CASE THE FIRST PASS MISSED: an archived chat wearing one of the five
  // live-progress words. It kept the word (nothing is stripped) but the
  // archive's filter row must not offer it. Measured on her real data the day
  // she asked again: to read 3 · to be reviewed 2 · come back to 1 · look at 1.
  'arch-two': { account: '1', archived: true, labels: ['to read', 'come back to'] },
  // …and one wearing a live-progress word, so the folded row really has a plain
  // chip on it to measure SEE MORE against. `to read` is not a pile.
  reading: { account: '1', labels: ['to read'] },
};

function stubServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        build: 'test', chats: CHATS, truncated: [],
        settings: { categories: ['witch', 'research'] },
        messages: url.searchParams.get('since') ? [] : MSGS,
        delta: !!url.searchParams.get('since'),
      }));
    }
    if (url.pathname === '/' || url.pathname === '/chats') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(HTML);
    }
    const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
    if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
      res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      return res.end(fs.readFileSync(asset));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
}

async function pageTests() {
  console.log('\nthe row and the sheets');
  const srv = stubServer();
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => ok('the page threw: ' + e.message, false));
  try {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="live-one"]');
    await page.waitForSelector('#catrow .tagsbtn');
    if (!(await page.$('#catrow .tagsbtn.on'))) await page.click('#catrow .tagsbtn');
    await page.waitForTimeout(150);

    // ---- SEE MORE IS A CONTROL, NOT A CHIP -------------------------------
    const more = await page.$('#catrow .morechip');
    ok('SEE MORE is on the row while the categories are folded', !!more);
    if (more) {
      const look = await page.evaluate(() => {
        const m = document.querySelector('#catrow .morechip');
        const c = document.querySelector('#catrow .catchip:not(.morechip):not(.starchip):not(.tagsbtn)');
        const g = (n) => { const s = getComputedStyle(n); return {
          bw: s.borderTopWidth, bg: s.backgroundColor, col: s.color }; };
        return { more: g(m), chip: g(c), chev: !!m.querySelector('svg.mc-v') };
      });
      // Her whole complaint: it was the same box as the words beside it.
      ok('…drawn with no border, where a tag chip has one',
        parseFloat(look.more.bw) === 0 && parseFloat(look.chip.bw) > 0,
        JSON.stringify(look));
      ok('…and in the accent, not the chips’ quiet grey',
        look.more.col !== look.chip.col, JSON.stringify(look));
      ok('…with a chevron saying there is more under here', look.chev);
    }

    // ---- THE HOME ROW DOES NOT OFFER THE OUTCOME WORDS -------------------
    if (more) await page.click('#catrow .morechip');
    await page.waitForTimeout(150);
    const rowWords = await page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn):not(.morechip)',
      (ns) => ns.map((n) => (n.firstChild && n.firstChild.textContent || '').trim()));
    ok('the home row shows her categories', rowWords.indexOf('Witch') > -1, rowWords.join(' · '));
    ok('…and none of the archive-only words',
      ARCH_WORDS.every((w) => rowWords.indexOf(w) < 0),
      rowWords.join(' · '));

    // ---- THE ORGANIZE SHEET IS THE SAME -----------------------------------
    await page.click('#grid [data-chat="live-one"]');
    await page.waitForSelector('#thread .orgbtn');
    await page.click('#thread .orgbtn');
    await page.waitForSelector('.askwrap .arctags');
    const org = await page.$$eval('.askwrap .arctags .catchip', (ns) => ns.map((n) => n.textContent.trim()));
    // `To read` is the live-progress word in this fixture (the vocabulary only
    // carries a word that is seeded or in use, so the others are not here).
    ok('Organize offers the live-progress words',
      org.indexOf('To read') > -1, org.join(' · '));
    ok('…and `stories` is not a word any more, only `story`',
      org.indexOf('Story') > -1 && org.indexOf('Stories') < 0, org.join(' · '));
    ok('…and not the archive-only words',
      ARCH_WORDS.every((w) => org.indexOf(w) < 0),
      org.join(' · '));
    await page.click('.askwrap .askrow .go');
    await page.waitForTimeout(150);

    // ---- THE ARCHIVE SHEET IS THE MIRROR ----------------------------------
    await page.waitForSelector('#thread .archlink.arch-g');
    await page.click('#thread .archlink.arch-g');
    await page.waitForSelector('.askwrap .arctags');
    const arc = await page.evaluate(() => {
      const row = document.querySelector('.askwrap .arctags');
      const out = { words: [], beforeRule: [], rule: null };
      let seen = false;
      [].slice.call(row.children).forEach((n) => {
        if (n.classList.contains('catdiv')) { seen = true; out.rule = n.textContent.trim(); return; }
        if (!n.classList.contains('catchip')) return;
        const w = n.textContent.trim();
        out.words.push(w);
        if (!seen) out.beforeRule.push(w);
      });
      return out;
    });
    ok('the archive sheet offers all six archive-only words',
      ARCH_WORDS.every((w) => arc.words.indexOf(w) > -1),
      arc.words.join(' · '));
    // Her ask, exactly: "put bug fix and new feature into the progress tags for
    // just the archive" — above the CATEGORIES rule, not under it.
    ok('…in the PROGRESS group, above the categories rule',
      ARCH_WORDS.every((w) => arc.beforeRule.indexOf(w) > -1),
      'before the rule: ' + arc.beforeRule.join(' · '));
    ok('…and the rule still says Categories', arc.rule === 'Categories', String(arc.rule));
    ok('…and the five live-progress words are gone from it',
      ['Look at', 'Come back to', 'To read', 'To be reviewed', 'Waiting for a response']
        .every((w) => arc.words.indexOf(w) < 0), arc.words.join(' · '));
    await page.click('.askwrap .askrow button:not(.go)').catch(() => {});
    await page.waitForTimeout(200);

    // ---- THE ARCHIVE'S OWN FILTER ROW OBEYS THE SAME RULE -----------------
    // The archive is TWO surfaces and the first pass only fixed the sheet:
    // this row builds its own list off `fileVocab()` and went on offering all
    // five. Verified failing against that version.
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="live-one"]');
    await page.click('#archlink');
    await page.waitForSelector('#grid .arctagrow .catchip');
    const arow = await page.evaluate(() => {
      const row = document.querySelector('#grid .arctagrow');
      const out = { words: [], beforeRule: [], rule: null };
      let seen = false;
      [].slice.call(row.children).forEach((n) => {
        if (n.classList.contains('catdiv')) { seen = true; out.rule = n.textContent.trim(); return; }
        const w = n.textContent.trim();
        out.words.push(w);
        if (!seen) out.beforeRule.push(w);
      });
      return out;
    });
    ok('the archive row still leads with All', arow.words[0] === 'All', arow.words.join(' · '));
    ok('…and offers a word that IS in the archive', arow.words.indexOf('Bug fix') > -1,
      arow.words.join(' · '));
    ok('…and NOT the live-progress words, even though a chat in there wears them',
      ['Look at', 'Come back to', 'To read', 'To be reviewed'].every((w) => arow.words.indexOf(w) < 0),
      arow.words.join(' · '));
    ok('…with the outcome words above the categories rule',
      arow.beforeRule.indexOf('Bug fix') > -1 && arow.rule === 'Categories',
      'before: ' + arow.beforeRule.join(' · ') + ' | rule: ' + arow.rule);
    ok('…and her topic word under it',
      arow.words.indexOf('Witch') > arow.words.indexOf('Bug fix'), arow.words.join(' · '));
    // Nothing is stripped — the chat is still in the archive, still carrying the
    // word. It only stopped being a way of filtering here.
    ok('the chat wearing it is still IN the archive',
      !!(await page.$('#grid [data-chat="arch-two"]')));
    // …and the sheet that CAN still show it is the Organize one, not this row.
    await page.click('#grid [data-chat="arch-two"]');
    await page.waitForSelector('#thread .orgbtn');
    await page.click('#thread .orgbtn');
    await page.waitForSelector('.askwrap .arctags');
    const still = await page.$$eval('.askwrap .arctags .catchip.on',
      (ns) => ns.map((n) => n.textContent.trim()));
    ok('…and Organize still shows the word lit on it — nothing was stripped',
      still.indexOf('To read') > -1, still.join(' · '));
  } finally {
    await browser.close();
    srv.close();
  }
}

(async () => {
  await forgetTests();
  if (!chromium) console.log('\nSKIP: playwright not installed — the page layer did not run');
  else await pageTests();
  console.log(fails
    ? '\nFAILED: ' + fails
    : '\nPASS: each surface offers its own half of the vocabulary, and See more is a control');
  process.exit(fails ? 1 : 0);
})();

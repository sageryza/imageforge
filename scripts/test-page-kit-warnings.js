#!/usr/bin/env node
// COMPARE-PAGE KIT WARNINGS (Aug 2026) — POST /api/chatfeed/page inspects the
// submitted HTML and answers `warnings` so the chat that can still fix the page
// sees them in its own tool output. It must NEVER block the post.
//
// The REAL route is driven against a stubbed Firestore + Storage (the pattern
// in test-chats-chapters.js), because the question is what the route ANSWERS
// and what it WRITES — neither is answerable by reading the source shape.
//
// Run: node scripts/test-page-kit-warnings.js
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

// ── stubbed Firestore + Storage ────────────────────────────────────────────
const DELETE = { __delete: true };
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));
  let n = 0;
  function coll(name) {
    store[name] = store[name] || {};
    return {
      doc(id) {
        const key = id || ('page' + (++n));
        return {
          id: key,
          async get() {
            const d = store[name][key];
            return { exists: !!d, id: key, data: () => d, get: (k) => (d ? d[k] : undefined) };
          },
          async set(patch, opt) {
            const cur = (opt && opt.merge && store[name][key]) ? store[name][key] : {};
            const next = Object.assign({}, cur);
            Object.keys(patch).forEach((k) => {
              if (patch[k] === DELETE) delete next[k]; else next[k] = patch[k];
            });
            store[name][key] = next;
          },
          async update(patch) { return this.set(patch, { merge: true }); },
        };
      },
      async add(doc) { const id = 'gen' + (++n); store[name][id] = doc; return { id }; },
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

function loadRouter(db, saved) {
  const fakeAdmin = {
    apps: [{}],
    firestore: Object.assign(() => db.api, { FieldValue: { delete: () => DELETE } }),
    storage: () => ({
      bucket: () => ({
        file: (name) => ({
          name,
          async save(buf) { saved[name] = buf.toString('utf8'); },
          async download() { return [Buffer.from(saved[name] || '', 'utf8')]; },
          async delete() { delete saved[name]; },
        }),
      }),
    }),
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

async function postPage(body) {
  const db = makeDb({ 'forge-chat-registry': { 'a-chat': { account: '2' } } });
  const saved = {};
  const mod = loadRouter(db, saved);
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use('/api/chatfeed', mod.router || mod);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const port = server.address().port;
  let out;
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/api/chatfeed/page', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    out = { status: r.status, json: await r.json().catch(() => null) };
  } finally { server.close(); }
  return { out, pages: db.store['forge-chat-pages'] || {}, saved };
}

const has = (ws, needle) => (ws || []).some((w) => w.toLowerCase().includes(needle));

// ── the pages under test ───────────────────────────────────────────────────
// (a) the real shell, filled in the least amount possible.
const SHELL = fs.readFileSync(path.join(ROOT, 'public/compare-shell.html'), 'utf8');

// (b) the hand-rolled page this whole feature exists for: its own look, its own
// (missing) behaviour — neither /compare.js nor the five tokens.
const HANDROLLED = `<!doctype html><meta charset="utf-8"><title>Two cuts</title>
<style>body{background:#faf7f0;color:#241f1a;font-family:Georgia,serif}
.card{border:1px solid #ddd;padding:12px}</style>
<div class="wrap"><h1>Two cuts</h1>
<div class="card"><img src="https://example.com/a.webp" alt="a"></div></div>
<script>(function(){ document.title = document.title; })();</script>`;

// (c) tokens defined by hand (a page that genuinely can't link the stylesheet)
// but still no shared behaviour.
const TOKENS_ONLY = `<!doctype html><meta charset="utf-8"><title>Palette</title>
<style>:root{--ink:#241f1a;--paper:#faf7f0;--chg:#b3443f;--ink2:#6b625a;--rose:#d98f96}
body{background:var(--paper);color:var(--ink)}</style>
<div class="wrap"><h1>Palette</h1></div>`;

// (d) the shell, but with the film parked at the top as a player.
const WITH_VIDEO = SHELL.replace('<div class="wrap">',
  '<div class="wrap">\n  <video src="https://example.com/cut-v2.mp4" controls playsinline></video>');

// (e) the shell wearing the two rows Sophie keeps having removed by hand — the
// gold chat/date eyebrow above the title and the tagline under it — plus a box
// carrying example text she would have to clear before typing.
const WITH_CHROME = SHELL.replace('<div class="wrap">',
  '<div class="wrap">\n  <div class="eyebrow">A CHAT · 13 AUG</div>')
  // anchored on the real title text — the shell MENTIONS <h1> in its comment
  // block first, and comments are stripped before anything is read
  .replace('<h1>Title states', '<div class="sub">One line about the page.</div>\n  <h1>Title states')
  .replace('</div>\n</div>', '<textarea placeholder="a cat in a teacup"></textarea></div>\n</div>');

(async () => {
  console.log('POST /api/chatfeed/page — kit warnings');

  { // (a) a page built from the shell is clean
    const { out, pages } = await postPage({ chat: 'a-chat', title: 'From the shell', html: SHELL });
    ok('the shell posts with NO warnings', out.status === 200 && !out.json.warnings,
      JSON.stringify(out.json));
    const doc = Object.values(pages)[0];
    ok('…and nothing is written to kitWarnings on a clean page',
      doc && !('kitWarnings' in doc), JSON.stringify(doc));
    ok('…and every existing field is untouched',
      out.json.ok === true && typeof out.json.id === 'string'
      && out.json.url === '/api/chatfeed/page/' + out.json.id, JSON.stringify(out.json));
  }

  { // (b) neither kit half — both warnings, and the post still succeeds
    const { out, pages, saved } = await postPage({ chat: 'a-chat', title: 'Two cuts', html: HANDROLLED });
    const w = out.json.warnings;
    ok('a hand-rolled page answers warnings', Array.isArray(w) && w.length === 2, JSON.stringify(out.json));
    ok('…one names /compare.js and the autoscroll', has(w, '/compare.js') && has(w, 'autoscroll'),
      JSON.stringify(w));
    ok('…one names /compare.css and the black pill',
      has(w, '/compare.css') && has(w, 'black'), JSON.stringify(w));
    ok('…each warning names its fix (the shell / the five tokens)',
      has(w, 'compare-shell.html') && has(w, '--rose'), JSON.stringify(w));
    ok('the post is NEVER blocked — ok:true, 200', out.status === 200 && out.json.ok === true,
      JSON.stringify(out));
    const doc = Object.values(pages)[0];
    ok('the page is still STORED', !!doc && !!doc.path && !!saved[doc.path]);
    ok('kitWarnings rides on the doc for a later sweep',
      doc && Array.isArray(doc.kitWarnings) && doc.kitWarnings.length === 2,
      JSON.stringify(doc && doc.kitWarnings));
    ok('…and it is the same array the caller got',
      Array.isArray(w) && JSON.stringify(doc && doc.kitWarnings) === JSON.stringify(w));
  }

  { // (c) tokens by hand → only the behaviour warning
    const { out } = await postPage({ chat: 'a-chat', title: 'Palette', html: TOKENS_ONLY });
    const w = out.json.warnings;
    ok('hand-defined tokens satisfy the pill-colour check', Array.isArray(w) && w.length === 1,
      JSON.stringify(w));
    ok('…and the one left is the /compare.js one', has(w, '/compare.js'), JSON.stringify(w));
  }

  { // --ink2 must not be read as --ink
    const short = TOKENS_ONLY.replace('--ink:#241f1a;', '').replace('color:var(--ink)', '');
    const { out } = await postPage({ chat: 'a-chat', title: 'Palette', html: short });
    ok('--ink2 does NOT satisfy --ink (word boundary)',
      (out.json.warnings || []).length === 2, JSON.stringify(out.json.warnings));
  }

  { // (d) an embedded player
    const { out } = await postPage({ chat: 'a-chat', title: 'Short 1 v4', html: WITH_VIDEO });
    const w = out.json.warnings;
    ok('an embedded <video> is warned about', Array.isArray(w) && w.length === 1, JSON.stringify(w));
    ok('…and it names __filmRow as the fix', has(w, '__filmrow'), JSON.stringify(w));
  }

  { // (e) the title-and-nothing-else rules: no eyebrow, no tagline, no example
    // text in a box. All three are things she has asked to have removed by hand.
    const { out } = await postPage({ chat: 'a-chat', title: 'Dressed up', html: WITH_CHROME });
    const w = out.json.warnings || [];
    ok('an .eyebrow above the title is warned about', has(w, 'eyebrow'), JSON.stringify(w));
    ok('a .sub tagline is warned about', has(w, 'tagline'), JSON.stringify(w));
    ok('…and it names the "?" as where an explanation goes',
      has(w, '__comparehelp'), JSON.stringify(w));
    ok('example text in a box is warned about', has(w, 'placeholder'), JSON.stringify(w));
    ok('…and the page is still POSTED, never blocked',
      out.status === 200 && out.json.ok === true, JSON.stringify(out.json));
  }

  { // comments are stripped before anything is read — the shell keeps the rules
    // in a comment block, so a page that only MENTIONS the kit is not carrying it
    const { out } = await postPage({
      chat: 'a-chat', title: 'Commented out',
      html: TOKENS_ONLY + '\n<!-- start from the shell: <script src="/compare.js"></script> -->',
    });
    ok('a /compare.js inside a COMMENT does not count as loading it',
      has(out.json.warnings, '/compare.js'), JSON.stringify(out.json.warnings));
  }

  { // a fragment is not a page — no rules, no noise
    const { out } = await postPage({
      chat: 'a-chat', title: 'A fragment', html: '<div class="card"><p>just a block</p></div>',
    });
    ok('a fragment gets no warnings at all', !out.json.warnings, JSON.stringify(out.json));
  }

  { // a page carrying its OWN pill is not the shared-pill contract
    const { out } = await postPage({
      chat: 'a-chat', title: 'Its own pill',
      html: '<!doctype html><title>x</title><div class="float" id="vtop"></div><h1>x</h1>',
    });
    ok('a page with its own pill (id="vtop") is skipped', !out.json.warnings, JSON.stringify(out.json));
  }

  { // the existing contract for a bad post is unchanged
    const { out } = await postPage({ chat: 'a-chat', title: 'no html' });
    ok('a missing html is still a 400', out.status === 400, JSON.stringify(out));
  }

  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

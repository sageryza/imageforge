#!/usr/bin/env node
// headgames-page.js — build the HEAD GAMES Compare page and post it into the
// Chats app, so a new version of the hub needs NO deploy (2026-09-03, Sophie:
// "make it off render so we don't have to deploy every time — a compare page
// maybe").
//
// The page is docs/headgames/headgames.tpl.html with docs/headgames/rules.js
// inlined at the __RULES__ marker and the chat baked in at __CHAT__. Her
// state never lives on the page: every game keeps its things on a verdict
// doc (`hg-<game>` sheets under the baked chat), read and written through
// /api/chatfeed/verdict — which the live server already has. So a re-post
// opens on the same jars, trains, towers, tags and scales.
//
//   node scripts/headgames-page.js                 build only; prints the size
//   node scripts/headgames-page.js --out file.html write the built page to a file
//   node scripts/headgames-page.js --go            post it (a NEW page, versioned)
//   node scripts/headgames-page.js --go --supersede <id>   … and supersede the old one
//
// The title carries the version (`Head Games v3`) — a new version is a new
// page, never an edit of the old one. `FORGE_BASE` overrides the server.
// It costs nothing: no model call anywhere.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'headgames');
const CHAT = 'mental-games-instrumental-beliefs';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

function build(opts) {
  opts = opts || {};
  const tpl = fs.readFileSync(path.join(DIR, 'headgames.tpl.html'), 'utf8');
  const rules = fs.readFileSync(path.join(DIR, 'rules.js'), 'utf8');
  if (!tpl.includes('__RULES__') || !tpl.includes('__CHAT__')) throw new Error('template is missing a marker');
  return tpl.replace('__RULES__', () => rules).replace(/__CHAT__/g, opts.chat || CHAT);
}

// The version is read off the last line of docs/headgames/VERSIONS, a small
// ledger this script appends to on every post — so two chats posting cannot
// both call theirs v3.
const LEDGER = path.join(DIR, 'VERSIONS');
function nextVersion() {
  let n = 0;
  try {
    const lines = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean);
    const last = lines[lines.length - 1] || '';
    const m = last.match(/^v(\d+)/);
    if (m) n = Number(m[1]);
  } catch (e) { /* first post */ }
  return n + 1;
}

async function post(html, title, supersede) {
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  const body = await r.json();
  if (!r.ok || !body.ok) throw new Error('post failed: ' + JSON.stringify(body));
  if (supersede) {
    const s = await fetch(BASE + '/api/chatfeed/page/' + encodeURIComponent(supersede) + '/supersede', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ superseded: true }),
    });
    body.superseded = s.ok ? supersede : 'FAILED ' + supersede;
  }
  return body;
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const go = args.includes('--go');
    const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
    const supersede = args.includes('--supersede') ? args[args.indexOf('--supersede') + 1] : null;
    const html = build();
    if (out) { fs.writeFileSync(out, html); console.log('wrote ' + out + ' (' + html.length + ' bytes)'); }
    else console.log('built ' + html.length + ' bytes' + (go ? '' : ' (dry — pass --go to post)'));
    if (!go) return;
    const v = nextVersion();
    const title = 'Head Games v' + v;
    const res = await post(html, title, supersede);
    fs.appendFileSync(LEDGER, 'v' + v + ' ' + res.id + ' ' + new Date().toISOString() + '\n');
    console.log(JSON.stringify({ title, id: res.id, url: BASE + res.url, warnings: res.warnings || [], superseded: res.superseded || null }, null, 2));
  })().catch((e) => { console.error(e.message || e); process.exit(1); });
}

module.exports = { build, CHAT, nextVersion };

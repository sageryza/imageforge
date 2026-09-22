#!/usr/bin/env node
// pattern-page.js — build the PATTERN Compare page and post it into the Chats
// app, so it needs NO deploy (2026-09-22, Sophie: "does it need to be a page ·
// can't it just be in compare · make a note saying things start in compare
// unless i explicitly ask for page").
//
// The page is docs/pattern/pattern.tpl.html with pattern-plan.js inlined at
// __PLAN__, every ready piece on forge-pattern-pieces inlined at __PIECES__
// (id, name, kind, thumb, cut, w, h — read from Firestore with the Admin SDK,
// or handed in with --pieces file.json), the chat at __CHAT__ and the version
// in the title. Her patterns never live on the page: they are JSON texts on a
// verdict doc (sheet `pattern` under the baked chat) through
// /api/chatfeed/verdict, and an export is drawn on the page's own canvas and
// filed into the Dump through /api/drop/upload-file — both routes the live
// server already has. So a re-post opens on the same patterns.
//
//   node scripts/pattern-page.js                         build only; prints the size
//   node scripts/pattern-page.js --out file.html         write the built page to a file
//   node scripts/pattern-page.js --go                    post it (a NEW page, versioned)
//   node scripts/pattern-page.js --go --supersede <id>   … and supersede the old one
//   --pieces file.json   use this list instead of Firestore (the test does)
//
// The title carries the version (`Pattern v3`) — a new version is a new page,
// never an edit of the old one; docs/pattern/VERSIONS is the ledger. A new
// piece on the list (scripts/pattern-seed.js, or POST /api/pattern/pieces once
// that is live) reaches her through a re-post. It costs nothing: no model
// call anywhere.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'pattern');
const CHAT = 'animal-fruit-pattern-tool';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const LEDGER = path.join(DIR, 'VERSIONS');

/** What the page needs of a piece — never the whole doc. */
function pieceRow(d) {
  return { id: d.id, name: d.name || '', kind: d.kind || 'other', thumb: d.thumb || d.cut, cut: d.cut, w: d.w || 1, h: d.h || 1 };
}

function build(opts) {
  opts = opts || {};
  const tpl = fs.readFileSync(path.join(DIR, 'pattern.tpl.html'), 'utf8');
  const plan = fs.readFileSync(path.join(ROOT, 'pattern-plan.js'), 'utf8');
  for (const m of ['__PLAN__', '__PIECES__', '__CHAT__', '__VERSION__']) if (!tpl.includes(m)) throw new Error('template is missing ' + m);
  const pieces = (opts.pieces || []).filter((p) => p.cut).map(pieceRow);
  // `</script>` inside a JSON string would end the page's script early.
  const json = JSON.stringify(pieces).replace(/<\//g, '<\\/');
  return tpl.replace('__PLAN__', () => plan).replace('__PIECES__', () => json)
    .replace(/__CHAT__/g, opts.chat || CHAT).replace(/__VERSION__/g, opts.version || '');
}

async function piecesFromFirestore() {
  const admin = require('firebase-admin');
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  const snap = await admin.firestore().collection('forge-pattern-pieces').get();
  const out = [];
  snap.forEach((d) => { const p = d.data(); if (p.status === 'ready' && !p.hidden && p.cut) out.push({ id: d.id, ...p }); });
  return out;
}

function nextVersion() {
  let n = 0;
  try {
    const lines = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean);
    const m = (lines[lines.length - 1] || '').match(/^v(\d+)/);
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
    const file = args.includes('--pieces') ? args[args.indexOf('--pieces') + 1] : null;
    const pieces = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : await piecesFromFirestore();
    const v = nextVersion();
    const html = build({ pieces, version: 'v' + v });
    console.log(`${pieces.length} pieces, built ${html.length} bytes` + (go ? '' : ' (dry — pass --go to post)'));
    if (out) { fs.writeFileSync(out, html); console.log('wrote ' + out); }
    if (!go) return;
    const body = await post(html, `Pattern v${v}`, supersede);
    fs.appendFileSync(LEDGER, `v${v} ${body.id} ${new Date().toISOString()}\n`);
    console.log(JSON.stringify(body));
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { build, pieceRow, CHAT };

#!/usr/bin/env node
// triset-match-game.js — build the MATCH TEST Compare page and post it into
// the Chats app (2026-09-04, Sophie: "a sort of mini game where i can take a
// card, then see all the other cards, and match them to the triangle. and do
// this for every card" — to see whether the matching is even-ish per card).
//
// The page is docs/triset/match-game.tpl.html with docs/triset/match-rules.js
// inlined at __RULES__, her chosen 61-card deck (read out of dominoes.html —
// scripts/lib/dominoes-deck.js, never a second list) baked in at __DECK__ with
// the game's own tag-match count per card, and the chat + sheet at __CHAT__ /
// __SHEET__. Her answers never live on the page: one verdict text per anchor
// card on the sheet, through /api/chatfeed/verdict, so a re-post opens on the
// same answers. It costs nothing — no model call anywhere.
//
//   node scripts/triset-match-game.js                   build only; prints the size
//   node scripts/triset-match-game.js --out file.html   write the built page to a file
//   node scripts/triset-match-game.js --go              post it (a NEW page, versioned)
//   node scripts/triset-match-game.js --go --supersede <id>
const fs = require('fs');
const path = require('path');
const tdeck = require('./lib/triset-deck');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'triset');
const CHAT = 'triset-matching-balance';
const SHEET = 'match-test';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const LEDGER = path.join(DIR, 'MATCH-VERSIONS');

// `deck` is every DEALT card of the pool — both editions — with its edition on
// it; the page's chips pick one (v3, 2026-09-04: "u didn't choose the right
// deck" — the deck is an edition of the game's pool, never the dominoes 61)
function build(opts) {
  opts = opts || {};
  const tpl = fs.readFileSync(path.join(DIR, 'match-game.tpl.html'), 'utf8');
  const rules = fs.readFileSync(path.join(DIR, 'match-rules.js'), 'utf8');
  const deck = opts.deck;
  if (!deck) throw new Error('build needs the deck — main() fetches it');
  const cards = deck.map(c => ({ id: c.id, n: c.n, url: c.url, flip: !!c.flip, edition: c.edition || '' }));
  for (const m of ['__RULES__', '__DECK__', '__CHAT__', '__SHEET__']) {
    if (!tpl.includes(m)) throw new Error('template is missing ' + m);
  }
  return tpl.replace('__RULES__', () => rules)
    .replace('__DECK__', () => JSON.stringify(cards).replace(/<\//g, '<\\/'))
    .replace(/__CHAT__/g, opts.chat || CHAT)
    .replace(/__SHEET__/g, opts.sheet || SHEET);
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
    await fetch(BASE + '/api/chatfeed/page/' + encodeURIComponent(supersede) + '/supersede', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }).catch(() => {});
  }
  return body;
}

async function main() {
  const deck = tdeck.editionDeck(await tdeck.fetchPool(BASE), 'all');
  console.log('deck', JSON.stringify(tdeck.editions(await tdeck.fetchPool(BASE))));
  const html = build({ deck });
  const out = process.argv.indexOf('--out');
  if (out > 0 && process.argv[out + 1]) fs.writeFileSync(process.argv[out + 1], html);
  console.log('built', (html.length / 1024).toFixed(0) + 'KB');
  if (!process.argv.includes('--go')) return;
  const v = nextVersion();
  const title = 'Match test v' + v + ' (' + deck.length + ' cards)';
  const sup = process.argv.indexOf('--supersede');
  const body = await post(html, title, sup > 0 ? process.argv[sup + 1] : null);
  fs.appendFileSync(LEDGER, 'v' + v + ' ' + new Date().toISOString() + ' ' + (body.id || '') + '\n');
  console.log('posted', title, body.id, body.url || '', body.warnings ? JSON.stringify(body.warnings) : '');
}

module.exports = { build, CHAT, SHEET };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });

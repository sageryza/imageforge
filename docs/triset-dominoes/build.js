#!/usr/bin/env node
/* Similitude Dominoes — build the page and (with --post) publish it.
 *
 *   node docs/triset-dominoes/build.js            → writes /tmp/dominoes.html
 *   node docs/triset-dominoes/build.js --post     → POSTs it as a NEW Compare page
 *
 * A NEW VERSION IS A NEW PAGE — bump the title's v number rather than
 * re-pointing the old one, and supersede the page it replaces.
 *
 * The cards are read LIVE off /api/triset/cards (edition 'nature' — the 84 she
 * hearted and printed), so the suits are always her real deck. names.json is
 * the one short name per card, in that collection's own order; if the deck
 * grows, the extra cards fall back to their title's first words.
 */
const fs = require('fs'), path = require('path');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CUTS = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/triset/cuts/';
const START = [82, 78, 77, 83, 10, 40, 59];   // sunflower · full moon · ladybug ·
                                              // mountain · poppies · northern lights · peacock
const TITLE = 'Similitude Dominoes v1';
const CHAT = 'triset-dominoes-game';

const STOP = new Set(('a an the one two of in on at with over under from to and its only above ' +
  'into out middle left up down too far below behind through toward after beside they get or then are')
  .split(' '));
const short = (t) => {
  const w = String(t || '').toLowerCase().replace(/[^a-z0-9 -]/g, ' ').split(/\s+/)
    .filter(x => x && !STOP.has(x));
  return w.slice(0, 2).join(' ') || 'card';
};

(async () => {
  const r = await fetch(BASE + '/api/triset/cards');
  const cards = (await r.json()).cards.filter(c => c.edition === 'nature' && c.cut);
  const names = JSON.parse(fs.readFileSync(path.join(__dirname, 'names.json'), 'utf8'));
  const deck = cards.map((c, i) => ({ k: c.cut.replace(CUTS, ''), n: names[i] || short(c.title) }));
  const html = fs.readFileSync(path.join(__dirname, 'dominoes.tpl.html'), 'utf8')
    .replace('__DECK__', JSON.stringify(deck))
    .replace('__SUITS__', JSON.stringify(START));
  const out = process.env.OUT || '/tmp/dominoes.html';
  fs.writeFileSync(out, html);
  console.log(deck.length + ' cards → ' + out + ' (' + html.length + ' bytes)');
  if (!process.argv.includes('--post')) return;
  const p = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html }),
  });
  console.log(await p.text());
})();

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
 * hearted and printed), so the game is always her real deck. cards.json is the
 * name and the TAGS for each, in that collection's own order — the tags are
 * what the computer can see, and a card without them can only ever be played
 * by her.
 */
const fs = require('fs'), path = require('path');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CUTS = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/triset/cuts/';
const TITLE = 'Similitude Dominoes v4';
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
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf8'));
  if (meta.length !== cards.length) {
    // the tags are per card IN THIS ORDER, so a deck that has grown must be
    // re-tagged rather than silently played with the wrong words
    console.error('WARNING: ' + cards.length + ' cards but ' + meta.length
      + ' tagged — re-tag cards.json before trusting the links');
  }
  // NO POINT-DOWN CARDS (her call, 2026-09-02): the made cards are cut point
  // down and every space on this table points up
  const deck = cards.map((c, i) => ({
    k: c.cut.replace(CUTS, ''),
    id: c.id.slice(0, 8),
    n: (meta[i] && meta[i].n) || short(c.title),
    t: (meta[i] && meta[i].t) || [],
    flip: !!c.flip,
  })).filter(c => !c.flip).map(c => { delete c.flip; return c; });
  const html = fs.readFileSync(path.join(__dirname, 'dominoes.tpl.html'), 'utf8')
    .replace('__DECK__', JSON.stringify(deck));
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

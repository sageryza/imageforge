// dominoes-deck.js — THE ONE READER for her chosen 61-card deck.
//
// The deck she picked (2026-09-03) lives in public/dominoes.html as its DECK
// constant — {k: cut filename, id, n: name, t: visual tags} — and every
// surface that wants "the currently chosen triset deck" reads it out of that
// page rather than keeping a second list (similitude-two.js's rule, lifted
// here so the print sheet and the match game share it too). The line ends in
// a comment, so a regex to the first `];` is not enough: strings are skipped
// and brackets counted.
const fs = require('fs');
const path = require('path');

const CUTS = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/triset/cuts/';

function readDeck(file) {
  const html = fs.readFileSync(file || path.join(__dirname, '..', '..', 'public', 'dominoes.html'), 'utf8');
  const at = html.indexOf('var DECK = [');
  if (at < 0) throw new Error('dominoes.html carries no DECK');
  const start = at + 'var DECK = '.length;
  let depth = 0; let inStr = false; let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (!depth) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('dominoes.html DECK never closes');
  return JSON.parse(html.slice(start, end)).map(c => ({ ...c, url: CUTS + c.k }));
}

// The WEAK words and the shared-tag rule are the dominoes game's own
// (public/dominoes.html) — copied here verbatim so the match game's tally can
// show what the game itself would count for a pair. Broad category words
// stay on the cards for her but never make a match by themselves.
const WEAK = {};
['animal', 'bird', 'insect', 'fish', 'cat', 'made thing', 'water', 'sky', 'tree', 'leaves', 'leaf', 'plant', 'fruit', 'flower', 'rock', 'green', 'brown', 'grey', 'blue', 'many', 'small', 'big', 'indoors', 'garden', 'forest', 'sea', 'field', 'wood', 'glass', 'window', 'pale', 'tiny', 'close-up', 'still', 'moving', 'hidden', 'round', 'dots', 'lines', 'pattern', 'far away', 'height', 'vertical', 'sand', 'snow', 'ice', 'cold', 'light', 'star', 'moon', 'cloud', 'wings', 'eyes'].forEach(w => { WEAK[w] = 1; });

function sharedTags(a, b) {
  return (a.t || []).filter(t => !WEAK[t] && (b.t || []).indexOf(t) >= 0);
}

// how many of the other cards each card shares a strong tag with — the
// machine's own answer to "is the matching even-ish per card"
function machineCounts(deck) {
  return deck.map((c, i) => deck.reduce((n, o, j) => n + (i !== j && sharedTags(c, o).length ? 1 : 0), 0));
}

module.exports = { readDeck, CUTS, WEAK, sharedTags, machineCounts };

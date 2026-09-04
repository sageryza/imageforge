// triset-deck.js — the game's own decks, read off the live pool.
//
// "The currently chosen triset deck" is an EDITION of the Similitude pool
// (nature · everyday — the chips on /similitude), not the dominoes page's
// 61 (2026-09-04, Sophie: "u didn't choose the right deck"). This reads
// GET /api/triset/cards — the same public read the game deals from — and
// hands back one edition (or every dealt card) shaped like dominoes-deck.js's
// cards, so the print sheet and the match test take either.
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

async function fetchPool(base) {
  const r = await fetch((base || BASE) + '/api/triset/cards');
  if (!r.ok) throw new Error('pool read failed: ' + r.status);
  const j = await r.json();
  return j.cards || j;
}

// one card as the sheet and the page want it: id, a short name off the title,
// the CURRENT cut (the original as the fallback), whether it was drawn
// point-down, and its edition
function cardOf(c) {
  const url = c.cut || c.url;
  return { id: c.id, n: String(c.title || '').split('\n')[0].slice(0, 60), url, k: String(url).split('/').pop(),
    flip: !!c.flip, edition: c.edition || '' };
}

function editionDeck(cards, edition) {
  return cards
    .filter(c => c.status === 'ready' && !c.hidden && (c.cut || c.url))
    .filter(c => edition === 'all' ? !!c.edition : (c.edition || '') === edition)
    .map(cardOf);
}

function editions(cards) {
  const out = {};
  cards.forEach(c => { if (c.edition && c.status === 'ready' && !c.hidden) out[c.edition] = (out[c.edition] || 0) + 1; });
  return out;
}

module.exports = { fetchPool, editionDeck, editions, cardOf };

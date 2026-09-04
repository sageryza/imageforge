#!/usr/bin/env node
// triset-print-likes.js — her NEW Playground triangle hearts on a letter print
// sheet (2026-09-04, Sophie: "did u add my new playground likes? if not, make
// a new no outline page w them. skip the box designs").
//
// The hearts come off the standing "Playground triangle hearts" page
// (triset.js writes it — one item per hearted picture, newest first). "New"
// means not already in her chosen 61 (dominoes-deck.js): a pool card adopted
// from a Playground picture carries that picture's url in `from`, so the join
// is exact. Each new picture is cut into a card with the pool's own cutter
// (triset-cut.js bakeCut — the same triangle, the same rim) and laid out by
// triset-print-letter.js with no outline. Nothing is filed anywhere — the
// cuts are print copies in the scratchpad; the pool is untouched.
//
//   node scripts/triset-print-likes.js              build; prints the list and the pdf path
//   node scripts/triset-print-likes.js --go         … and upload the pdf to the Dump
//   --skip "box"                                    drop hearts whose words carry this (default: the
//                                                   three "collection of insane nature things" designs)
//   --outline on                                    with the cut line (default off, her ask)
//   --out <dir>
const fs = require('fs');
const path = require('path');
const { readDeck } = require('./lib/dominoes-deck');
const print = require('./triset-print-letter');
const { bakeCut } = require('../triset-cut');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const LIKES_PAGE = 'triset-pl-likes';
// her "box designs": the border-collage prompts, not a card subject
const SKIP_DEFAULT = /collection of insane nature things/i;

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

async function likesItems() {
  const r = await fetch(BASE + '/api/chatfeed/page/' + LIKES_PAGE);
  const html = await r.text();
  // the data is followed by the view switch's own call on the same line
  const m = html.match(/__pageData\s*=\s*(\{[\s\S]*?\});\s*(?:window\.__pageViews|<\/script>)/);
  if (!m) throw new Error('the hearts page carries no __pageData');
  return JSON.parse(m[1]).groups.map(g => g.items[0]).filter(Boolean);
}

async function deckUrls() {
  const r = await fetch(BASE + '/api/triset/cards');
  const j = await r.json();
  const list = j.cards || j;
  const deck = readDeck();
  const urls = new Set();
  for (const d of deck) {
    const c = list.find(c => c.id.startsWith(d.id));
    if (!c) continue;
    urls.add(c.url);
    if (c.from && c.from.url) urls.add(c.from.url);
  }
  return urls;
}

// the new ones, oldest first so the sheet reads in the order she hearted them
function pickNew(items, inDeck, skipRe) {
  return items.filter(it => it.url && !inDeck.has(it.url) && !skipRe.test(it.promptContent || it.label || ''))
    .reverse();
}

async function main() {
  const out = arg('out', path.join(process.env.TMPDIR || '/tmp', 'triset-print-likes'));
  fs.mkdirSync(path.join(out, 'cuts'), { recursive: true });
  const skipWord = arg('skip', '');
  const skipRe = skipWord ? new RegExp(skipWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : SKIP_DEFAULT;
  const items = await likesItems();
  const inDeck = await deckUrls();
  const picked = pickNew(items, inDeck, skipRe);
  console.log(items.length + ' hearts · ' + picked.length + ' not in the deck and not skipped');
  const cards = [];
  for (const it of picked) {
    const k = it.id + '.cut.webp';
    const f = path.join(out, 'cuts', k);
    if (!fs.existsSync(f)) {
      const r = await fetch(it.url);
      if (!r.ok) throw new Error('picture missing: ' + it.url);
      const { buf } = await bakeCut(Buffer.from(await r.arrayBuffer()));
      fs.writeFileSync(f, buf);
    }
    const n = String(it.label || '').split('\n')[0].slice(0, 60);
    cards.push({ k, n, url: it.url, id: it.id });
    console.log('  ' + n);
  }
  const outline = arg('outline', 'off') !== 'off';
  const built = await print.buildHtml(cards, c => print.fileData(path.join(out, 'cuts', c.k)),
    { side: Number(arg('side', 2.2)), border: Number(arg('border', 0.1)), outline, footer: 'Playground hearts' });
  const stem = 'similitude-playground-hearts-' + cards.length + (outline ? '' : '-no-outline');
  const htmlFile = path.join(out, stem + '.html');
  const pdfFile = path.join(out, stem + '.pdf');
  fs.writeFileSync(htmlFile, built.html);
  await print.renderPdf(htmlFile, pdfFile);
  console.log('pdf', pdfFile, built.pages + ' pages', (fs.statSync(pdfFile).size / 1e6).toFixed(1) + 'MB');
  if (process.argv.includes('--go')) {
    const b = await print.upload(pdfFile, stem + '.pdf');
    console.log('uploaded', BASE + '/api/drop/file/' + b.item.id, b.duplicate ? '(already there)' : '');
  }
}

module.exports = { pickNew, SKIP_DEFAULT };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });

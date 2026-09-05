#!/usr/bin/env node
// similitude-print-all.js — EVERY Similitude card ONCE, on letter, no outline
// (2026-09-05, Sophie: "was it just one of each card? if not make it that").
//
// The three no-outline sheets overlapped: measured, 30 of the Everyday
// edition's cards are also among the 61, so the "everything" PDF printed
// them twice. This is one deck — the 61 in their order, then the Everyday
// cards not among them, then her new Playground hearts (cut with the pool's
// own cutter, as triset-print-likes does) — deduped by card id and by
// picture url, laid out by triset-print-letter.js with no outline.
//
//   node scripts/similitude-print-all.js [--go] [--out <dir>] [--outline on]
const fs = require('fs');
const path = require('path');
const { readDeck } = require('./lib/dominoes-deck');
const tdeck = require('./lib/triset-deck');
const print = require('./triset-print-letter');
const likes = require('./triset-print-likes');
const { bakeCut } = require('../triset-cut');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

async function likesItems() {
  const r = await fetch(BASE + '/api/chatfeed/page/triset-pl-likes');
  const html = await r.text();
  const m = html.match(/__pageData\s*=\s*(\{[\s\S]*?\});\s*(?:window\.__pageViews|<\/script>)/);
  if (!m) throw new Error('the hearts page carries no __pageData');
  return JSON.parse(m[1]).groups.map(g => g.items[0]).filter(Boolean);
}

async function main() {
  const out = arg('out', process.env.SCRATCH || path.join(process.env.TMPDIR || '/tmp', 'similitude-print-all'));
  fs.mkdirSync(path.join(out, 'cuts'), { recursive: true });
  const pool = await tdeck.fetchPool(BASE);
  const seenId = new Set(), seenUrl = new Set();
  const deck = [];
  const take = (c, from) => {
    if (seenId.has(c.id) || seenUrl.has(c.url)) return false;
    seenId.add(c.id); seenUrl.add(c.url);
    deck.push(c);
    return true;
  };
  // 1. the 61, resolved to the pool's CURRENT cut (the dominoes deck's ids are prefixes)
  let n61 = 0;
  for (const d of readDeck()) {
    const c = pool.find(p => p.id.startsWith(d.id));
    if (c) { if (take(tdeck.cardOf(c))) n61++; } else if (take(d)) n61++;
  }
  // 2. the Everyday edition's extras (a made card is drawn point-down and stays off a point-up sheet)
  let nEv = 0, flipped = [];
  for (const c of tdeck.editionDeck(pool, 'everyday')) {
    if (c.flip) { if (!seenId.has(c.id)) flipped.push(c.n); continue; }
    if (take(c)) nEv++;
  }
  // 3. her new Playground hearts, not already a card above
  const urls = new Set(deck.flatMap(c => [c.url, c.id].filter(Boolean)));
  pool.forEach(p => { if (seenId.has(p.id) && p.from && p.from.url) urls.add(p.from.url); });
  const picked = likes.pickNew(await likesItems(), urls, likes.SKIP_DEFAULT);
  let nHearts = 0;
  for (const it of picked) {
    const k = it.id + '.cut.webp';
    const f = path.join(out, 'cuts', k);
    if (!fs.existsSync(f)) {
      const r = await fetch(it.url);
      if (!r.ok) throw new Error('picture missing: ' + it.url);
      const { buf } = await bakeCut(Buffer.from(await r.arrayBuffer()));
      fs.writeFileSync(f, buf);
    }
    if (take({ k, n: String(it.label || '').split('\n')[0].slice(0, 60), url: it.url, id: 'pl-' + it.id })) nHearts++;
  }
  console.log(`${deck.length} cards, one of each · the 61: ${n61} · everyday extras: ${nEv} · playground hearts: ${nHearts}` + (flipped.length ? ` · left off (point-down): ${flipped.join(' · ')}` : ''));
  for (const c of deck) {
    const f = path.join(out, 'cuts', c.k);
    if (fs.existsSync(f) && fs.statSync(f).size > 0) continue;
    const r = await fetch(c.url);
    if (!r.ok) throw new Error('cut missing: ' + c.k);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const outline = arg('outline', 'off') !== 'off';
  const built = await print.buildHtml(deck, c => print.fileData(path.join(out, 'cuts', c.k)),
    { side: Number(arg('side', 2.2)), border: Number(arg('border', 0.1)), outline, footer: 'Similitude · every card once' });
  const stem = 'similitude-all-' + deck.length + '-letter' + (outline ? '' : '-no-outline');
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

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

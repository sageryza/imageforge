#!/usr/bin/env node
/**
 * The STYLES page — one subject per row, the three house styles across
 * (Aug 2026, Sophie: "one that compares the styles and one that compares the
 * quality"; the quality half is build-quality-ladder-page.js).
 *
 *   node scripts/build-style-triptych-page.js <quality> [--sheet] [--version v2]
 *                                             [--supersede <pageId>] [--dry-run]
 *
 * This page isolates STYLE: same subject, same quality, same method across a
 * row, so the only thing moving is which reference drew it.
 *
 * A NEW QUALITY OR A NEW METHOD IS A NEW PAGE — never re-point an old one at
 * new media, because a cached copy would then show stale pictures.
 * --supersede marks the page this one replaces.
 *
 * The markup, the CSS and the prompt-button behaviour come from
 * lib/triptych-page.js, shared with the quality ladder.
 */
const fs = require('fs');
const path = require('path');
const { buildPage, postPage } = require('./lib/triptych-page');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'compare-page-style-variants';
const QUALITY = (process.argv[2] || 'low').toLowerCase();
const SHEET = process.argv.includes('--sheet');
const pick = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const VERSION = pick('--version', SHEET ? 'v2' : 'v1');
const SUPERSEDE = pick('--supersede', null);
const DRY = process.argv.includes('--dry-run');

const mfName = SHEET ? `manifest-sheet-${QUALITY}.json` : `manifest-${QUALITY}.json`;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'style-triptych', mfName), 'utf8'));
const ok = manifest.filter((m) => m.url);
if (!ok.length) { console.error('nothing generated'); process.exit(1); }

// Fixed so a row always reads the same way, and a re-run of one subject can
// never shuffle the page under her.
const ORDER = ['watercolor', 'dream', 'pastel'];
const TAGS = { watercolor: 'watercolor', dream: 'dream mystery', pastel: 'pastel' };
const ROWS = ['braid', 'dinner', 'bicycle', 'terrarium'];

const subjects = [];
for (const m of ok) {
  let s = subjects.find((x) => x.id === m.subject);
  if (!s) { s = { id: m.subject, label: m.subjectLabel, cols: {} }; subjects.push(s); }
  s.cols[m.style] = m;
}
subjects.sort((a, b) => {
  const ia = ROWS.indexOf(a.id), ib = ROWS.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

const rows = subjects.map((s) => ({
  id: s.id,
  label: s.label,
  cells: ORDER.filter((k) => s.cols[k]).map((k) => {
    const m = s.cols[k];
    return {
      key: k, tag: TAGS[k], url: m.url,
      alt: `${s.label} — ${TAGS[k]}`,
      promptStyle: m.promptStyle,
      promptContent: m.promptContent,
    };
  }),
}));

const title = SHEET
  ? `Three styles, one sheet — ${QUALITY} (${VERSION})`
  : `Three styles, one prompt — ${QUALITY} (${VERSION})`;

const help = [
  '<b>Same words, three house styles.</b> Left to right: sage sandy mirror (watercolor), '
  + 'dream mystery (diary comic), sophie snake + sophie animals (Witch School pastel). '
  + 'Only the style moves across a row.',
  SHEET
    ? `Each style drew all four subjects as ONE 2x2 sheet at quality ${QUALITY}, cut into cells — `
      + 'so a cell is a quarter of a 1024x1536 sheet, not a full render.'
    : `gpt-image-2 edits, 1024x1536 solo renders, quality ${QUALITY}.`,
  'Comparing the QUALITY settings instead? That is its own page — this one holds quality still.',
  'Tap <b>prompt</b> under any picture for the exact text that drew it.',
].join('<br><br>');

const html = buildPage({
  title, chat: CHAT,
  sheet: `styles3-${SHEET ? 'sheet' : 'solo'}-${QUALITY}-s${subjects.length}`,
  help, rows,
});

if (DRY) { console.log(html); process.exit(0); }
postPage({ base: BASE, chat: CHAT, title, html, topic: 'styles', supersede: SUPERSEDE });

#!/usr/bin/env node
/**
 * The QUALITY page — one subject, one style per row, low/medium/high across
 * (Aug 2026, Sophie: "one that compares the styles and one that compares the
 * quality").
 *
 *   node scripts/build-quality-ladder-page.js [--subject bicycle]
 *                                             [--version v1] [--dry-run]
 *
 * The point of splitting the two pages is that each isolates ONE variable, so
 * this page holds everything else still: the same subject, the same style
 * recipe, the same SOLO 1024x1536 render — only the `quality` API parameter
 * moves. That is why it cannot be assembled out of the sheet run: those cells
 * are ~500x770 crops of a 2x2, so a low solo next to a medium cell would be
 * measuring the METHOD, not the quality.
 */
const fs = require('fs');
const path = require('path');
const { buildPage, postPage } = require('./lib/triptych-page');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'compare-page-style-variants';
const pick = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SUBJECT = pick('--subject', 'bicycle');
const VERSION = pick('--version', 'v1');
const DRY = process.argv.includes('--dry-run');

const LADDER = ['low', 'medium', 'high'];
const STYLES = ['watercolor', 'dream', 'pastel'];
const STYLE_LABEL = {
  watercolor: 'Watercolor — sage sandy mirror',
  dream: 'Dream mystery — diary comic',
  pastel: 'Pastel — Witch School',
};
// Rough per-image cost, so the page says what a rung actually buys.
const COST = { low: '~2¢', medium: '~6¢', high: '~25¢' };

// Pull this subject out of each quality's SOLO manifest (never the sheet one).
const byQuality = {};
for (const q of LADDER) {
  const f = path.join(ROOT, 'out', 'style-triptych', `manifest-${q}.json`);
  if (!fs.existsSync(f)) { console.error(`missing ${f} — run style-triptych.js ${q} --subjects=${SUBJECT}`); process.exit(1); }
  byQuality[q] = JSON.parse(fs.readFileSync(f, 'utf8')).filter((m) => m.url && m.subject === SUBJECT);
}

const missing = [];
const rows = STYLES.map((st) => {
  const cells = [];
  for (const q of LADDER) {
    const m = byQuality[q].find((x) => x.style === st);
    if (!m) { missing.push(`${st}/${q}`); continue; }
    cells.push({
      key: q,
      tag: q,
      url: m.url,
      alt: `${m.subjectLabel} — ${STYLE_LABEL[st]} — ${q}`,
      // The prompt text is IDENTICAL down a row — only the API parameter moves,
      // which is the whole point — so the panel names the settings explicitly
      // rather than letting three identical prompts look like a mistake.
      promptStyle: `${m.promptStyle}\n\nSent at: ${m.model}, size ${m.size}, quality ${q} (${COST[q]} per image). `
        + 'The prompt text is identical at all three rungs — quality is an API parameter, not part of the prompt.',
      promptContent: m.promptContent,
    });
  }
  const any = byQuality.low.find((x) => x.style === st) || {};
  return { id: st, label: STYLE_LABEL[st] || st, cells, subjectLabel: any.subjectLabel };
}).filter((r) => r.cells.length);

if (missing.length) console.warn(`⚠ missing rungs: ${missing.join(', ')}`);
if (!rows.length) { console.error('nothing to build'); process.exit(1); }

const subjectLabel = rows[0].subjectLabel || SUBJECT;
const title = `${subjectLabel} — quality ladder (${VERSION})`;
const help = [
  `<b>One picture, three qualities.</b> Every cell is the same subject in the same `
  + `style at the same size — only the quality setting changes, left to right: `
  + `low (${COST.low}), medium (${COST.medium}), high (${COST.high}).`,
  'These are full 1024x1536 solo renders, NOT cells cut out of a 2x2 sheet — a sheet cell '
  + 'is a quarter of the page, so mixing the two would compare the method instead of the quality.',
  `This subject was chosen because it is the one that visibly breaks: the drivetrain, `
  + `the chain and the tools are where a rung either buys something or does not.`,
  'Tap <b>prompt</b> under any picture for the exact text that drew it.',
].join('<br><br>');

const html = buildPage({
  title, chat: CHAT,
  sheet: `quality-${SUBJECT}-s${rows.length}x${LADDER.length}`,
  help, rows,
});

if (DRY) { console.log(html); process.exit(0); }
postPage({ base: BASE, chat: CHAT, title, html, topic: 'image quality' });

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

// FOUR rungs (Aug 2026, Sophie: "the quality should include the low quality
// which is quarter of a sheet medium"). The cheapest option is not `low` — it
// is a QUARTER of a medium 2x2 sheet, which costs a quarter of one medium
// render and is the thing she is actually deciding whether to use. Ordered by
// what an image really costs, cheapest first, so the row reads as a ladder.
const LADDER = [
  { key: 'sheetmed', tag: '¼ sheet · med', manifest: 'manifest-sheet-medium.json', quality: 'medium', cost: '~1.5¢ (a medium sheet ÷ 4)' },
  { key: 'low', tag: 'low', manifest: 'manifest-low.json', quality: 'low', cost: '~2¢' },
  { key: 'medium', tag: 'medium', manifest: 'manifest-medium.json', quality: 'medium', cost: '~6¢' },
  { key: 'high', tag: 'high', manifest: 'manifest-high.json', quality: 'high', cost: '~25¢' },
];
const STYLES = ['watercolor', 'dream', 'pastel'];
const STYLE_LABEL = {
  watercolor: 'Watercolor — sage sandy mirror',
  dream: 'Dream mystery — diary comic',
  pastel: 'Pastel — Witch School',
};

const byRung = {};
for (const r of LADDER) {
  const f = path.join(ROOT, 'out', 'style-triptych', r.manifest);
  if (!fs.existsSync(f)) { console.error(`missing ${f}`); process.exit(1); }
  byRung[r.key] = JSON.parse(fs.readFileSync(f, 'utf8')).filter((m) => m.url && m.subject === SUBJECT);
}

const missing = [];
const rows = STYLES.map((st) => {
  const cells = [];
  for (const r of LADDER) {
    const m = byRung[r.key].find((x) => x.style === st);
    if (!m) { missing.push(`${st}/${r.key}`); continue; }
    // The ¼-sheet rung is genuinely a different SHAPE of thing — a crop of a
    // 2x2, drawn alongside three other subjects — so its panel says so rather
    // than letting it read as just another quality setting.
    const size = m.cellSize ? `${m.cellSize} (a quarter of a ${m.sheetSize} sheet)` : m.size;
    cells.push({
      key: r.key,
      tag: r.tag,
      url: m.url,
      alt: `${m.subjectLabel} — ${STYLE_LABEL[st]} — ${r.tag}`,
      // The prompt text is IDENTICAL down a row for the three solo rungs —
      // only the API parameter moves, which is the whole point — so the panel
      // names the settings rather than letting identical prompts look like a
      // mistake. The sheet rung's prompt really is different (it asked for a
      // grid of four), and that difference is exactly what she is judging.
      promptStyle: `${m.promptStyle}\n\nSent at: ${m.model}, size ${size}, quality ${m.quality} `
        + `(${r.cost} per image).`
        + (m.fromSheet
          ? ' This one was NOT drawn on its own — it is one quarter of a 2x2 sheet that drew all '
            + 'four subjects in a single call, which is why it costs a quarter of a medium and comes '
            + 'out a quarter of the size.'
          : ' Drawn on its own, one call for this one picture. Quality is an API parameter, not part '
            + 'of the prompt text.'),
      promptContent: m.promptContent,
    });
  }
  const any = byRung.low.find((x) => x.style === st) || {};
  return { id: st, label: STYLE_LABEL[st] || st, cells, subjectLabel: any.subjectLabel };
}).filter((r) => r.cells.length);

if (missing.length) console.warn(`⚠ missing rungs: ${missing.join(', ')}`);
if (!rows.length) { console.error('nothing to build'); process.exit(1); }

const subjectLabel = rows[0].subjectLabel || SUBJECT;
const title = `${subjectLabel} — quality ladder (${VERSION})`;
const help = [
  '<b>One picture, four ways of paying for it.</b> Same subject, same style, cheapest first: '
  + LADDER.map((r) => `${r.tag} (${r.cost})`).join(', ') + '.',
  '<b>The first one is not a quality setting</b> — it is a quarter of a medium 2x2 sheet that drew '
  + 'all four subjects in one call. That is why it costs a quarter of a medium and comes out about '
  + 'a quarter of the size. The other three are full 1024x1536 renders drawn on their own.',
  'So the question this page answers: is a quarter of a medium sheet better or worse than a whole '
  + 'low render, for less money?',
  'This subject was chosen because it is the one that visibly breaks — the drivetrain, the chain '
  + 'and the tools are where a rung either buys something or does not.',
  'Tap <b>prompt</b> under any picture for the exact text that drew it.',
].join('<br><br>');

const html = buildPage({
  title, chat: CHAT,
  sheet: `quality-${SUBJECT}-s${rows.length}x${LADDER.length}`,
  help, rows,
});

if (DRY) { console.log(html); process.exit(0); }
postPage({ base: BASE, chat: CHAT, title, html, topic: 'image quality' });

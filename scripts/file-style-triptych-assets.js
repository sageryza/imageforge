#!/usr/bin/env node
/**
 * File a style-triptych run into the chat's Assets tab — the whole
 * deliver-images ritual, straight off the manifest.
 *
 *   node scripts/file-style-triptych-assets.js <quality> [--sheet] [--dry-run]
 *
 * Per image: the LABEL (what she reviews by), the MODEL · QUALITY caption,
 * and the EXACT prompt split style/content. The manifest is written at
 * generation time, so none of this is a reconstruction — which matters,
 * because the quality caption can never be honestly backfilled by a later chat.
 *
 * With --sheet it files the twelve CUT CELLS *and* the three source sheets.
 * The sheets go in deliberately: they are what was actually paid for and
 * drawn, a cell is a crop of one, and she should be able to see the whole
 * thing she is judging cells out of.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'compare-page-style-variants';
const QUALITY = (process.argv[2] || 'low').toLowerCase();
const SHEET = process.argv.includes('--sheet');
const DRY = process.argv.includes('--dry-run');

const mfName = SHEET ? `manifest-sheet-${QUALITY}.json` : `manifest-${QUALITY}.json`;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'style-triptych', mfName), 'utf8'));
const ok = manifest.filter((m) => m.url);

const STYLE_NAME = {
  watercolor: 'watercolor (sage sandy mirror)',
  dream: 'dream mystery (diary comic)',
  pastel: 'pastel (Witch School)',
};

// The three source sheets, one per style, derived from their cells.
function sheetRows() {
  const seen = new Map();
  for (const m of ok) {
    if (!m.sheetUrl || seen.has(m.style)) continue;
    seen.set(m.style, {
      url: m.sheetUrl,
      description: `Full 2x2 sheet — ${STYLE_NAME[m.style] || m.style} (all four subjects, one render)`,
      caption: `${m.model} · ${m.quality}`,
      // The sheet's prompt IS the full prompt; the seam is the grid line.
      style: m.promptStyle.replace(/\n\n\[content[^\]]*\]\n\n/, '\n\n[content — the four subjects, one per quarter]\n\n'),
      content: m.fullPrompt,
    });
  }
  return [...seen.values()];
}

(async () => {
  const rows = ok.map((m) => ({
    url: m.url,
    description: `${m.subjectLabel} — ${STYLE_NAME[m.style] || m.style}`
      + (SHEET ? ` [${m.cell} of the 2x2 sheet]` : ''),
    caption: `${m.model} · ${m.quality}`,
    style: m.promptStyle,
    content: m.promptContent,
  })).concat(SHEET ? sheetRows() : []);

  const items = rows.map((r) => ({ url: r.url, style: r.style, content: r.content }));

  for (const r of rows) {
    if (DRY) { console.log(`${r.description}\n  caption: ${r.caption}\n  ${r.url}\n`); continue; }
    const g = await fetch(`${BASE}/api/gallery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: r.url, description: r.description, prompt: r.caption }),
    });
    console.log(`${g.ok ? 'OK ' : 'ERR'} ${r.description}`);
  }

  if (DRY) return;
  const p = await fetch(`${BASE}/api/gallery/assets/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, items }),
  });
  const res = await p.json();
  console.log(`\nprompts: ok=${res.ok} saved=${res.saved}`
    + (res.results ? ` failed=${res.results.filter((x) => !x.ok).length}` : ''));
})();

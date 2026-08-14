#!/usr/bin/env node
/**
 * File a style-triptych run into the chat's Assets tab — the whole
 * deliver-images ritual, straight off the manifest.
 *
 *   node scripts/file-style-triptych-assets.js <quality> [--dry-run]
 *
 * Per image: the LABEL (what she reviews by), the MODEL · QUALITY caption,
 * and the EXACT prompt split style/content. The manifest is written at
 * generation time, so none of this is a reconstruction — which matters,
 * because the quality caption can never be honestly backfilled by a later chat.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'compare-page-style-variants';
const QUALITY = (process.argv[2] || 'low').toLowerCase();
const DRY = process.argv.includes('--dry-run');

const manifest = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'out', 'style-triptych', `manifest-${QUALITY}.json`), 'utf8'));
const ok = manifest.filter((m) => m.url);

const STYLE_NAME = {
  watercolor: 'watercolor (sage sandy mirror)',
  dream: 'dream mystery (diary comic)',
  pastel: 'pastel (Witch School)',
};

(async () => {
  const items = [];
  for (const m of ok) {
    const description = `${m.subjectLabel} — ${STYLE_NAME[m.style] || m.style}`;
    const caption = `${m.model} · ${m.quality}`;
    items.push({ url: m.url, style: m.promptStyle, content: m.promptContent });

    if (DRY) { console.log(`${description}\n  caption: ${caption}\n  ${m.url}\n`); continue; }

    // Label + MODEL · QUALITY caption. Converges by url onto whatever the Stop
    // hook files, so this never makes a second tile.
    const g = await fetch(`${BASE}/api/gallery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: m.url, description, prompt: caption }),
    });
    console.log(`${g.ok ? 'OK ' : 'ERR'} ${description}`);
  }

  if (DRY) return;
  // The exact prompt, split — batched, one call.
  const p = await fetch(`${BASE}/api/gallery/assets/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, items }),
  });
  console.log('\nprompts:', JSON.stringify(await p.json()).slice(0, 400));
})();

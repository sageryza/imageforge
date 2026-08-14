#!/usr/bin/env node
// File every finished page into the chat's Assets tab, labeled, with the EXACT
// prompt split into its style and content halves and a MODEL · QUALITY caption.
// House rule (CLAUDE.md, "Deliverables → the in-app gallery" and "Prompts on
// Assets images"): every image deliverable is filed individually and labeled,
// and the prompt is the literal text sent — never a paraphrase. The style half
// wraps the content, so the seam is marked with [content].
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'marlas-eyes-fishbowl-storybook';
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/marla/pages.json'), 'utf8'));
const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/marla/state.json'), 'utf8'));

// Short label: the page number plus a few of her own words from that page.
function label(page) {
  const w = page.words.replace(/\s+/g, ' ').trim();
  const short = w.length > 62 ? w.slice(0, 62).replace(/[\s,;:.—-]+\S*$/, '') + '…' : w;
  return `Page ${page.n} — ${short}`;
}

(async () => {
  const dry = process.argv.includes('--dry-run');
  const items = [];
  for (const page of plan.pages) {
    const s = state.pages[page.n];
    if (!s?.pageUrl) continue;
    // The literal prompt, with the scene lifted out so the two halves are exact.
    const style = s.prompt.replace(`Draw: ${page.scene}`, 'Draw: [content]')
      + '\n\nAttached: refs/sage-sandy-mirror.png as the style reference'
      + (s.cards?.length ? `, then the ${s.cards.join(' and ')} character card${s.cards.length > 1 ? 's' : ''}` : '')
      + '. gpt-image-2 edits, size 1024x1536, quality medium.';
    items.push({ url: s.pageUrl, style, content: page.scene, page });
  }
  console.log(`${items.length} pages to file into ${CHAT}`);
  if (dry) { console.log(items[0].style, '\n---\n', items[0].content); return; }

  for (const it of items) {
    const r = await fetch(`${BASE}/api/gallery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetsOnly: true,
        chat: CHAT,
        url: it.url,
        description: label(it.page),
        prompt: 'gpt-image-2 · medium',
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.log(`  page ${it.page.n}: file failed — ${JSON.stringify(j).slice(0, 120)}`);
  }
  const r = await fetch(`${BASE}/api/gallery/assets/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, items: items.map((i) => ({ url: i.url, style: i.style, content: i.content })) }),
  });
  const j = await r.json().catch(() => ({}));
  const bad = (j.items || []).filter((x) => !x.ok);
  console.log(`prompts filed; ${bad.length ? `${bad.length} failed` : 'all ok'}`);
  process.exit(0);
})();

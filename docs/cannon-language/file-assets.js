#!/usr/bin/env node
// File every still into the chat's Assets tab with a real label, the
// model · quality caption, and the exact prompt split into style + content.
//
// The style half is the REAL server-side wrapper as sent (PL_GPT_STYLES.evan),
// with [content] marking the seam, then the attached ref, size, quality and
// the motion prompt. Never paraphrased — if a value isn't known, it is omitted
// rather than guessed.
//
//   node file-assets.js [--quality medium] [--dry-run]
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'illustrated-cannon-passage';
const TOKEN = process.env.STUDIO_TOKEN || '';
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const QUALITY = argOf('--quality', 'medium');
const DRY = args.includes('--dry-run');

const spec = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8'));
const shots = spec.shots;
const stills = JSON.parse(fs.readFileSync(path.join(DIR, `renders-${QUALITY}.json`), 'utf8'));
const clips = fs.existsSync(path.join(DIR, 'clips.json'))
  ? JSON.parse(fs.readFileSync(path.join(DIR, 'clips.json'), 'utf8')) : {};
const LABELS = JSON.parse(fs.readFileSync(path.join(DIR, 'labels.json'), 'utf8'));

const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { 'x-studio-token': TOKEN } : {}) };

// the exact wrapper the server builds: prefix \n\n <typed> \n\n suffix
const styleHalf = (shot) => {
  const c = clips[shot.n];
  const lines = [
    spec.style.prefix, '', '[content]', '', spec.style.suffix, '',
    `Attached style reference: ${spec.style.refs.join(', ')} · gpt-image-2 edits · ${spec.style.size} · quality ${QUALITY}`,
  ];
  if (c) lines.push(`Motion (replicate wan-video/wan-2.2-i2v-fast, 480p, ${c.frames} frames @ 16fps, interpolate_output, go_fast): ${c.motion}`);
  return lines.join('\n');
};

(async () => {
  const items = [];
  let filed = 0;
  for (const s of shots) {
    const st = stills[s.n];
    if (!st) { console.error(`shot ${s.n}: no ${QUALITY} still, skipping`); continue; }
    const description = LABELS[s.n];
    if (!description) { console.error(`shot ${s.n}: no label, skipping`); continue; }
    if (DRY) { console.log(`[${s.n}] ${description}`); items.push({ url: st.url }); continue; }

    const r = await fetch(`${BASE}/api/gallery`, {
      method: 'POST', headers,
      body: JSON.stringify({
        assetsOnly: true, chat: CHAT, url: st.url,
        description, prompt: `gpt-image-2 · ${QUALITY}`,
      }),
    });
    if (!r.ok) console.error(`  shot ${s.n} gallery: ${r.status} ${(await r.text()).slice(0, 120)}`);
    else filed++;
    items.push({ url: st.url, style: styleHalf(s), content: s.prompt });
  }

  if (DRY) { console.log(`\ndry run — ${items.length} stills would be filed`); return; }

  // prompts in one batched call
  const p = await fetch(`${BASE}/api/gallery/assets/prompt`, {
    method: 'POST', headers, body: JSON.stringify({ chat: CHAT, items }),
  });
  const pj = await p.json().catch(() => ({}));
  const okCount = Array.isArray(pj.results) ? pj.results.filter(x => x.ok).length : (p.ok ? items.length : 0);
  console.log(`filed ${filed} stills · ${okCount} prompts → chat "${CHAT}"`);
})();

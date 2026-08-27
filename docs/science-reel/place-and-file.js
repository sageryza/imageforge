#!/usr/bin/env node
// After the sheets land: place each panel on its Story Room beat, and file
// every panel into this chat's Assets tab — label, MODEL · QUALITY · SIZE
// caption (1/4 (4K)), and the exact prompt split style/content.
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const BASE = 'https://imageforge-q125.onrender.com';
const CHAT = 'science-memo-animated-reel';
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'beats.json'), 'utf8'));
const runs = JSON.parse(fs.readFileSync(path.join(HERE, 'runs.json'), 'utf8'));
const pad = JSON.parse(fs.readFileSync(path.join(HERE, 'pad.json'), 'utf8'));

const urlFor = {}, runFor = {}, fullFor = {};
for (const r of runs) r.beats.forEach((n, i) => { urlFor[n] = r.images[i]; runFor[n] = r.id; fullFor[n] = r.fullPrompt; });
const beatId = {};
for (const b of pad.beats) beatId[b.n] = b.id;

async function j(url, body) {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(BASE + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const t = await r.text();
      const out = JSON.parse(t);
      if (out.error) throw new Error(out.error);
      return out;
    } catch (e) {
      if (a === 4) throw new Error(`${url}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 3000 * (a + 1)));
    }
  }
}

// A panel's style half is everything around ITS line in the sent sheet text,
// with [content] marking where its words sit (the Assets overlay convention).
function styleHalf(n, content) {
  const full = fullFor[n] || '';
  const i = full.indexOf(content);
  if (i < 0) return '';
  return `${full.slice(0, i)}[content]${full.slice(i + content.length)}`
    .trim().slice(0, 1500);
}

(async () => {
  for (const b of plan.beats) {
    const url = urlFor[b.n];
    if (!url) { console.log('beat', b.n, 'NO PANEL — skipped'); continue; }
    // 1. place on the pad beat (dreamy side; src names the run for provenance)
    await j('/api/scratchpad/image', {
      pad: pad.pad, id: beatId[b.n], url, style: 'dreamy',
      src: { kind: 'promptlab', runId: runFor[b.n], prompt: b.prompt },
    });
    // 2. label + caption in the Assets tab
    await j('/api/gallery', {
      assetsOnly: true, chat: CHAT, url,
      description: b.label,
      prompt: 'gpt-image-2 · medium · 1/4 (4K)',
    });
    // 3. the exact prompt, split
    await j('/api/gallery/assets/prompt', {
      chat: CHAT, url, style: styleHalf(b.n, b.prompt), content: b.prompt,
    });
    console.log('beat', b.n, 'placed + filed');
  }
  console.log('DONE');
})().catch((e) => { console.error(e.message); process.exit(1); });

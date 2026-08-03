// Files rendered wc-story panels: Assets tile (label + model·quality caption),
// exact prompt halves (style wrapper with [content] seam + attached-refs note),
// and My Creations (via post-to-gallery.js). Usage:
//   node file-wc-story.js [id,id,…]   (default: every id in panels-wc-story.json)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'mason-noise-art-images';
const WRAP_STYLE = 'Use the attached image only as the style reference — do not copy its content. Draw: [content]';
const WRAP_CHAR = 'Use the first attached image only as the style reference — do not copy its content. The second attached image is the character reference for Mason. Draw: [content]';

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'panels-wc-story.json'), 'utf8'));
  const only = process.argv[2] ? process.argv[2].split(',').map(s => s.trim()) : null;
  const panels = manifest.filter(p => !only || only.includes(p.id));

  for (const p of panels) {
    const res = await fetch(`${BASE}/api/gallery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: p.url, description: `${p.label} — ${p.quality}`, prompt: `gpt-image-2 · ${p.quality}` }),
    });
    console.log(`${p.id}: asset tile → ${res.status}`);
  }

  const items = panels.map(p => ({
    url: p.url,
    // p.wrap is the exact wrapper that render recorded; the constants are only
    // the fallback for entries rendered before that field existed
    style: (p.wrap || (p.char ? WRAP_CHAR : WRAP_STYLE)) +
      ` (attached: datescan0013.png as the style reference${p.char ? ', mason-char-ref.jpeg as the Mason character reference' : ''}; 1024x1536, quality ${p.quality})`,
    content: p.content,
  }));
  const pr = await fetch(`${BASE}/api/gallery/assets/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, items }),
  });
  console.log(`prompts → ${pr.status} ${JSON.stringify(await pr.json()).slice(0, 200)}`);

  for (const p of panels) {
    try {
      execFileSync('node', [path.join(__dirname, '..', 'post-to-gallery.js'),
        '--url', p.url, '--prompt', p.label, '--created', String(p.madeAt)],
        { stdio: 'inherit', cwd: path.join(__dirname, '..', '..') });
    } catch (e) { console.error(`${p.id}: My Creations post FAILED — ${e.message}`); }
  }
  console.log('FILED', panels.map(p => p.id).join(', '));
})().catch(e => { console.error('FATAL', e); process.exit(1); });

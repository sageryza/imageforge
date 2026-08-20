// file-assets.js — the deliver-images ritual for the Vibrilify panels:
// Assets label + MODEL · QUALITY caption, the exact prompt split (style half
// = the real promptUsed with the content marked by [content]), and the grid
// storyboard Compare page. My Creations posts run separately through
// scripts/post-to-gallery.js (needs GALLERY_UID).
// Usage: node scripts/vibrilify/file-assets.js /path/to/movie.json [--page]
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'vibrilify-max-commercial';
const movie = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec.json'), 'utf8'));

const LABELS = [
  'Vibrilify — the kitchen is slightly too large',
  'Vibrilify — the dog has known for weeks',
  'Vibrilify — the neighbor does not stop waving',
  'Vibrilify — the air was also bad',
  'Vibrilify — one lavender pill',
  'Vibrilify — the sun rises indoors',
  'Vibrilify — she high-fives a horse',
  'Vibrilify — forty guests she has never met',
  'Vibrilify — forgiving her father in a Costco',
  'Vibrilify — becoming the wind chimes',
  'Vibrilify — out of respect for the grapefruit',
  'Vibrilify — logo: not responsible for the horse',
];

async function post(p, body) {
  const r = await fetch(BASE + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw new Error(`${p}: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}

(async () => {
  const items = [];
  for (let i = 0; i < movie.scenes.length; i++) {
    const s = movie.scenes[i];
    const url = s.panel.url;
    const content = s.imagePrompt;
    // The exact sent prompt with the content seam marked — never a paraphrase.
    let style = String(s.panel.promptUsed || '');
    style = style.includes(content) ? style.replace(content, '[content]') : style;
    style += ' [refs attached: dream-mystery.jpg (style) + chained panel refs (first/previous); gpt-image-2 edit, 1024x1536, medium]';
    await post('/api/gallery', { assetsOnly: true, chat: CHAT, url, description: LABELS[i], prompt: 'gpt-image-2 · medium' });
    items.push({ url, style: style.slice(0, 1500), content: content.slice(0, 1500) });
    console.log('filed', i, LABELS[i]);
  }
  const pr = await post('/api/gallery/assets/prompt', { chat: CHAT, items });
  console.log('prompts:', JSON.stringify(pr).slice(0, 200));

  if (process.argv.includes('--page')) {
    const groups = movie.scenes.map((s, i) => ({
      label: `${i + 1} · ${s.title}${typeof s.startAt === 'number' ? ` · ${s.startAt.toFixed(1)}s` : ' (inside the pill morph)'}`,
      items: [{ id: 'shot-' + (i + 1), label: LABELS[i], img: s.panel.url, model: 'gpt-image-2', quality: 'medium' }],
    }));
    const page = await post('/api/chatfeed/page', {
      chat: CHAT, title: 'Vibrilify MAX — storyboard v1 (12 shots)',
      template: 'grid', data: { groups },
    });
    console.log('page:', JSON.stringify({ id: page.id, sheet: page.sheet, warnings: page.warnings || null }));
  }
})().catch(e => { console.error(e.message); process.exit(1); });

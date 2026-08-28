// file-clearing.js — the deliver-images ritual for the "clearing things up"
// segment: Assets label, the MODEL · QUALITY · SIZE caption (1024x1536 is the
// 1K rung — size-tier.js derives it, never a hardcoded string), and the exact
// prompt split with the content seam marked [content]. Also posts the
// three-shot storyboard as a grid Compare page.
// Usage: node scripts/vibrilify/file-clearing.js [--page]
const fs = require('fs');
const path = require('path');
const { tierOf } = require('../../size-tier.js');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'max-voice-segment-animation';
const CANVAS = '1024x1536';
const CAPTION = `gpt-image-2 · medium · ${tierOf(CANVAS)}`;
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec-clearing.json'), 'utf8'));
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'state-clearing.json'), 'utf8'));

const LABELS = {
  tangle: 'Clearing things up — the tangled pile (before)',
  unfurled: 'Clearing things up — unfurled into its separate components (after)',
  star: 'Clearing things up — the shimmering rainbow shooting star',
};

async function post(p, body) {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw new Error(`${p}: ${r.status} ${JSON.stringify(d).slice(0, 250)}`);
  return d;
}

(async () => {
  const items = [];
  for (const s of spec.shots) {
    const rec = state.shots[s.id];
    if (!rec?.url) { console.error(`skip ${s.id} — not rendered`); continue; }
    // The style half is the LITERAL text that was sent, with her content
    // marked — never a paraphrase, and never the style's label.
    const style = rec.style
      ? `${rec.promptUsed.replace(rec.content, '[content]')} [no reference images attached; gpt-image-2 generation, ${CANVAS}, medium]`
      : `[content] [no style wrapper — the whole prompt is the content half; gpt-image-2 generation, ${CANVAS}, medium]`;
    await post('/api/gallery', { assetsOnly: true, chat: CHAT, url: rec.url, description: LABELS[s.id], prompt: CAPTION });
    items.push({ url: rec.url, style: style.slice(0, 1500), content: rec.content.slice(0, 1500) });
    console.log('filed', s.id, '—', LABELS[s.id]);
  }
  if (items.length) console.log('prompts:', JSON.stringify(await post('/api/gallery/assets/prompt', { chat: CHAT, items })).slice(0, 200));

  if (process.argv.includes('--page')) {
    const groups = spec.shots.map((s, i) => ({
      label: `${i + 1} · ${LABELS[s.id]}`,
      items: [{ id: 'shot-' + s.id, label: LABELS[s.id], img: state.shots[s.id]?.url, model: 'gpt-image-2', quality: 'medium' }],
    })).filter(g => g.items[0].img);
    groups.push({
      label: `${groups.length + 1} · The end card (reused from the spot — not re-rendered)`,
      items: [{ id: 'shot-endcard', label: 'Vibrilify — logo: not responsible for the horse', img: spec.endCard }],
    });
    const page = await post('/api/chatfeed/page', {
      chat: CHAT, title: 'Vibrilify MAX — "clearing things up" storyboard', template: 'grid', data: { groups },
    });
    console.log('page:', JSON.stringify({ id: page.id, sheet: page.sheet, warnings: page.warnings || null }));
  }
})().catch(e => { console.error(e.message); process.exit(1); });

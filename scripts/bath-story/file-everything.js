// File the bath-story deliverables everywhere they belong (one pass):
// iOS "My Creations" gallery (membry, true make-times) + chat Assets with
// labels + style/content prompts + a Compare page pairing every panel with
// its voiceover cut. Mirrors scripts/story-short-pastel/file-everything.js.
// Run from /home/user/imageforge. Needs STORY_FIREBASE_SERVICE_ACCOUNT (or
// FIREBASE_SERVICE_ACCOUNT), GALLERY_UID, network to the live server.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRATCH = process.env.BATH_SCRATCH || '/tmp/claude-0/-home-user/3f02d84e-abbd-5c13-b33d-ae39d8184c4b/scratchpad';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'bath-thought-experiment';
const PANELS = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'bath/panels.json'), 'utf8'));
const TIMELINE = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'bath-audio/timeline.json'), 'utf8'));

const STYLE_HALF = 'Pastel (house) V2 — gpt-image-2 edits with the witch-school style refs: bold confident black ink outlines, flat colors, no gradients, minimal shading, soft pastel palette of lilac, pastel pink, mint and pale yellow, plain white background, playful modern editorial illustration; whitened background; 1024x1536 portrait, medium quality.';

const LABELS = {
  'bath-calm': 'Bath 1 — the thought experiment begins in the tub',
  'bath-bubble-normal': 'Bath 2 — thought bubble: running into the ex at the supermarket, normal clothes',
  'market-good': 'Bath 3 — what if she looked really good: red polka-dot dress and straw hat',
  'market-poof': 'Bath 4 — the poof: she vanishes mid-thought',
  'market-bad': 'Bath 5 — what if she looked really bad: torn green pants, loose black shirt',
  'bath-bubble-return': 'Bath 6 — back in the tub: the bubble starts becoming real',
  'tree-materialize': 'Bath 7 — the tree materializes from particles',
  'room-materialize': 'Bath 8 — his room materializes around him',
};

async function post(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${txt.slice(0, 200)}`);
  try { return JSON.parse(txt); } catch { return txt; }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildPage() {
  const byId = Object.fromEntries(PANELS.map(p => [p.id, p]));
  const cards = TIMELINE.segments.map(seg => {
    const p = seg.panel ? byId[seg.panel] : null;
    const img = p ? `<img src="${p.url}" alt="${esc(LABELS[p.id])}" loading="lazy">` :
      `<div class="nopanel">No image described for this stretch yet — it needs one or two panels.</div>`;
    const title = p ? esc(LABELS[p.id]) : (seg.id === 's06' ? 'The people become real (no image yet)' : 'God created us this way (no image yet)');
    return `<section class="card">
      <h2>${title}</h2>
      ${img}
      <audio controls preload="none" src="${seg.url}"></audio>
      <p class="words">&ldquo;${esc(seg.text)}&rdquo;</p>
      <p class="meta">${seg.seconds.toFixed(1)}s &middot; ${seg.start.toFixed(1)}&ndash;${seg.end.toFixed(1)}s in the take</p>
    </section>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Bath Thought Experiment</title>
<style>
  body { margin:0; background:#FBF7F1; color:#2A2622; font:16px/1.5 -apple-system, system-ui, sans-serif; }
  .wrap { max-width:560px; margin:0 auto; padding:20px 16px 80px; }
  h1 { font-size:22px; margin:8px 0 2px; }
  .sub { color:#6B615A; font-size:13px; margin:0 0 18px; }
  .full { background:#FFFFFF; border:1px solid #E4DCD2; border-radius:6px; padding:14px; margin-bottom:22px; }
  .full h2 { font-size:15px; margin:0 0 8px; }
  .card { background:#FFFFFF; border:1px solid #E4DCD2; border-radius:6px; padding:14px; margin-bottom:18px; }
  .card h2 { font-size:15px; margin:0 0 10px; }
  .card img { width:100%; border-radius:6px; display:block; margin-bottom:10px; }
  audio { width:100%; margin-bottom:8px; }
  .words { font-size:14px; color:#4A443E; margin:0 0 6px; }
  .meta { font-size:12px; color:#8A8078; margin:0; }
  .nopanel { background:#F3EDE4; border-radius:6px; padding:26px 14px; text-align:center; color:#6B615A; font-size:14px; margin-bottom:10px; }
</style></head><body><div class="wrap">
<h1>The Bath Thought Experiment</h1>
<p class="sub">Pastel V2 storyboard &middot; portrait 2:3 &middot; her voiceover cut per panel (precise cutting, machine-verified)</p>
<div class="full"><h2>The whole voiceover, pauses tightened</h2>
<audio controls preload="none" src="${TIMELINE.stitched}"></audio></div>
${cards}
</div></body></html>`;
}

(async () => {
  // 1) iOS My Creations gallery — true make-times, via the documented CLI
  for (const p of PANELS) {
    const out = execFileSync('node', ['scripts/post-to-gallery.js', '--url', p.url,
      '--prompt', p.content, '--style', 'Pastel (house)', '--created', String(Math.round(p.madeAt))],
      { env: process.env, encoding: 'utf8' });
    console.log('gallery:', p.id, out.trim().split('\n').pop());
  }
  // 2) chat Assets, labeled
  for (const p of PANELS) {
    await post('/api/gallery', { assetsOnly: true, chat: CHAT, url: p.url, description: LABELS[p.id] });
    console.log('asset:', p.id);
  }
  // 3) prompts, style/content split, one batch call
  const r = await post('/api/gallery/assets/prompt', {
    chat: CHAT, items: PANELS.map(p => ({ url: p.url, style: STYLE_HALF, content: p.content })),
  });
  console.log('prompts:', JSON.stringify(r).slice(0, 200));
  // 4) Compare page
  const page = await post('/api/chatfeed/page', { chat: CHAT, title: 'The Bath Thought Experiment', html: buildPage() });
  console.log('compare page:', JSON.stringify(page).slice(0, 200));
  console.log('ALL FILED');
})().catch(e => { console.error('FATAL', e); process.exit(1); });

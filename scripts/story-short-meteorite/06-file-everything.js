// File all deliverables: clips + final video → Firebase; panels → My Creations
// gallery + chat Assets (with style/content prompt split); the 12 beats +
// pastel cand cards → the Story Room project; a Compare page with the whole
// storyboard + per-beat clips + the finished short. Idempotent — beats are
// only created when the project has none, cards skip if a same-label card
// already exists on the beat.
const fs = require('fs');
const admin = require('firebase-admin');
const { OUT, BEATS, PROJECT, CHAT } = require('./beats');
const BASE = 'https://imageforge-q125.onrender.com';
const panels = require(OUT + '/panels.json');
const timing = require(OUT + '/timing.json');

const STYLE_HALF = 'Pastel (house) — gpt-image-2 edits with witch-school style refs: bold confident black ink outlines, flat colors, no gradients, minimal shading, soft pastel palette of lilac, pastel pink, mint and pale yellow, plain white background, playful modern editorial illustration; whitened background; 1024x1536 (2:3 portrait) medium.';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}
const post = (p, b) => req('POST', p, b);

(async () => {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();

  // 1. Upload clips + final video
  const videoUrls = {};
  for (const t of timing) {
    const dest = `story-shorts/${PROJECT}/clip-${t.beat}.mp4`;
    await bucket.upload(`${OUT}/clip-${t.beat}.mp4`, { destination: dest, metadata: { contentType: 'video/mp4' } });
    await bucket.file(dest).makePublic();
    videoUrls[t.beat] = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    console.log('clip', t.beat, 'uploaded');
  }
  const finDest = `story-shorts/${PROJECT}/the-meteorite-short.mp4`;
  await bucket.upload(`${OUT}/the-meteorite-short.mp4`, { destination: finDest, metadata: { contentType: 'video/mp4' } });
  await bucket.file(finDest).makePublic();
  const finalUrl = `https://storage.googleapis.com/${bucket.name}/${finDest}`;
  console.log('FINAL →', finalUrl);

  // 2. Gallery (My Creations + chat Assets) per panel
  for (const p of panels) {
    const r = await post('/api/gallery', {
      url: p.url, chat: CHAT, description: BEATS[p.beat].label,
      prompt: 'gpt-image-2 · medium · Pastel (house) · 2:3 portrait',
      created: p.madeAt, style: 'Pastel (house)', type: 'single',
    });
    console.log('gallery', p.beat, JSON.stringify(r).slice(0, 100));
  }

  // 3. Style/content prompt split, batched
  const r3 = await post('/api/gallery/assets/prompt', {
    chat: CHAT,
    items: panels.map(p => ({ url: p.url, style: STYLE_HALF, content: p.content })),
  });
  console.log('prompts:', JSON.stringify(r3).slice(0, 200));

  // 4. Story Room: create the 12 beats (only when the project has none), then
  //    append each panel as a cand card (skip if a same-label card exists).
  const story = await req('GET', '/api/story');
  const proj = (story.projects || []).find(p => p.id === PROJECT);
  if (!proj) throw new Error('project not found: ' + PROJECT);
  if (!(proj.beats || []).length) {
    for (const b of BEATS) {
      await post('/api/story/beat', { projectId: PROJECT, vo: b.spans.join(' ') });
    }
    console.log('created', BEATS.length, 'beats');
  } else console.log('beats already exist:', proj.beats.length, '— not recreating');

  const story2 = await req('GET', '/api/story');
  const proj2 = (story2.projects || []).find(p => p.id === PROJECT);
  for (const p of panels) {
    const label = 'pastel house — ' + BEATS[p.beat].label.replace(/^Meteorite \d+ — /, '');
    const existing = ((proj2.beats[p.beat] || {}).cards || []).some(c => c.label === label);
    if (existing) { console.log('story card', p.beat, 'exists, skip'); continue; }
    const b64 = fs.readFileSync(`${OUT}/panel-${p.beat}.webp`).toString('base64');
    const r = await post('/api/story/art', {
      projectId: PROJECT, beat: p.beat, label,
      image: `data:image/webp;base64,${b64}`,
    });
    console.log('story card', p.beat, JSON.stringify(r).slice(0, 120));
  }

  // 5. Compare page
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = panels.map(p => `
    <section class="beat">
      <div class="num">beat ${p.beat + 1} · ${esc(BEATS[p.beat].label.replace(/^Meteorite \d+ — /, ''))}</div>
      <img src="${p.url}" alt="">
      <p class="vo">${esc(BEATS[p.beat].spans.join(' … '))}</p>
      <video src="${videoUrls[p.beat]}" controls playsinline preload="none" poster="${p.url}"></video>
    </section>`).join('\n');
  const total = timing.reduce((a, t) => a + t.duration, 0);
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Meteorite — pastel short</title>
<style>
  body { margin:0; background:#fff; color:#1c1c1e; font:16px/1.5 -apple-system, system-ui, sans-serif; }
  .wrap { max-width:560px; margin:0 auto; padding:20px 16px 80px; }
  h1 { font-size:22px; margin:8px 0 2px; }
  .sub { color:#6e6e73; font-size:14px; margin:0 0 18px; }
  .final { border:1px solid #e5e5ea; border-radius:6px; overflow:hidden; margin-bottom:28px; }
  .final video { display:block; width:100%; }
  .final .cap { padding:10px 12px; font-size:14px; color:#6e6e73; }
  .beat { margin:0 0 30px; border-top:1px solid #e5e5ea; padding-top:18px; }
  .num { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#b06fa8; margin-bottom:8px; }
  .beat img, .beat video { display:block; width:100%; border-radius:6px; border:1px solid #eee; }
  .vo { font-size:15px; color:#3a3a3c; margin:10px 0; }
  .beat video { margin-top:6px; }
</style></head><body><div class="wrap">
  <h1>The Meteorite</h1>
  <p class="sub">Pastel (house) storyboard · ${panels.length} beats · your own voice, precision-cut from the 17-min recording (~${Math.round(total)}s kept) · 1080x1620 portrait</p>
  <div class="final"><video src="${finalUrl}" controls playsinline preload="metadata"></video>
  <div class="cap">The finished 2:3 portrait short — panels animated with wan, timed to your voice.</div></div>
  ${rows}
</div></body></html>`;
  const r5 = await post('/api/chatfeed/page', { chat: CHAT, title: 'The Meteorite — pastel short', html });
  console.log('compare page:', JSON.stringify(r5).slice(0, 200));

  fs.writeFileSync(OUT + '/final-url.txt', finalUrl);
  console.log('FILING DONE');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

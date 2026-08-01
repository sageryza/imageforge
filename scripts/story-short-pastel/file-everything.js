// File all deliverables: clips + final video → Firebase; panels → My Creations
// gallery + chat Assets (with style/content prompts); pastel cards → the Story
// Room beats; a Compare page with the whole storyboard + video.
const fs = require('fs');
const admin = require('firebase-admin');
const OUT = '/tmp/claude-0/-home-user/5cf8109c-feb1-5772-9302-0197d40bce90/scratchpad/destiny';
const BASE = 'https://imageforge-q125.onrender.com';
const CHAT = 'new-house-story-illustrations';
const PROJECT = 'controlling-my-own-destiny';
const panels = require(OUT + '/panels.json');
const timing = require(OUT + '/timing.json');

const STYLE_HALF = 'Pastel (house) — gpt-image-2 edits with witch-school style refs: bold confident black ink outlines, flat colors, no gradients, minimal shading, soft pastel palette of lilac, pastel pink, mint and pale yellow, plain white background, playful modern editorial illustration; whitened background; 1024x1536 medium.';

const LABELS = [
  'Destiny 1 — the kitchen glass shatters (so angry it couldn\'t be ignored)',
  'Destiny 2 — coincidence bubbles orbit her head',
  'Destiny 3 — the crowd watches the sky, she watches her glowing hands',
  'Destiny 4 — emotion, intention and will as ribbons of light',
  'Destiny 5 — one fingertip bends the stream',
  'Destiny 6 — a wish whispered, a gift returned',
  'Destiny 7 — the universe quietly rearranges the path',
  'Destiny 8 — holding the reins of her own constellation',
];

const BEAT_TEXTS = [
  "Here's the honest truth. I didn't know I was a witch. Until one day I got so angry, I made something happen that I couldn't ignore.",
  "Then I thought back through all those weird coincidences in my life that I thought had just been the universe trying to tell me something.",
  "And I realized what I must have known all along. That I wasn't a bystander watching the strange things happen in my life.",
  "But that I was the one causing them. Not literally causing every single thing to happen, but with my emotion, my intention, and my will.",
  "Subtly changing the way my life had been flowing to match what I wanted.",
  "I realized that I had wished for things and then gotten them, almost immediately.",
  "The universe quietly rearranging events to match my desire.",
  "This was a powerful realization, but a little scary. I could no longer be a victim, because I was controlling my own destiny.",
];

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

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
    console.log('clip', t.beat, '→', videoUrls[t.beat]);
  }
  const finDest = `story-shorts/${PROJECT}/${PROJECT}-short.mp4`;
  await bucket.upload(`${OUT}/${PROJECT}-short.mp4`, { destination: finDest, metadata: { contentType: 'video/mp4' } });
  await bucket.file(finDest).makePublic();
  const finalUrl = `https://storage.googleapis.com/${bucket.name}/${finDest}`;
  console.log('FINAL →', finalUrl);

  // 2. Gallery (My Creations + chat Assets) per panel
  for (const p of panels) {
    const r = await post('/api/gallery', {
      url: p.url, chat: CHAT, description: LABELS[p.beat],
      prompt: 'gpt-image-2 · medium · Pastel (house)',
      created: p.madeAt, style: 'Pastel (house)', type: 'single',
    });
    console.log('gallery', p.beat, JSON.stringify(r).slice(0, 120));
  }

  // 3. Style/content prompt split, batched
  const r3 = await post('/api/gallery/assets/prompt', {
    chat: CHAT,
    items: panels.map(p => ({ url: p.url, style: STYLE_HALF, content: p.content })),
  });
  console.log('prompts:', JSON.stringify(r3).slice(0, 200));

  // 4. Story Room cards (data URL upload → membry, appended as cand cards)
  for (const p of panels) {
    const b64 = fs.readFileSync(`${OUT}/panel-${p.beat}.webp`).toString('base64');
    const r = await post('/api/story/art', {
      projectId: PROJECT, beat: p.beat,
      label: LABELS[p.beat].replace(/^Destiny \d+ — /, 'pastel house — '),
      image: `data:image/webp;base64,${b64}`,
    });
    console.log('story card', p.beat, JSON.stringify(r).slice(0, 140));
  }

  // 5. Compare page
  const rows = panels.map(p => `
    <section class="beat">
      <div class="num">beat ${p.beat + 1}</div>
      <img src="${p.url}" alt="">
      <p class="vo">${BEAT_TEXTS[p.beat].replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>
      <video src="${videoUrls[p.beat]}" controls playsinline preload="none" poster="${p.url}"></video>
    </section>`).join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Controlling My Own Destiny — pastel short</title>
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
  <h1>Controlling My Own Destiny</h1>
  <p class="sub">Pastel (house) storyboard · 8 beats · your narration, pauses tightened (3:24 → ~1:33) · 1080x1920</p>
  <div class="final"><video src="${finalUrl}" controls playsinline preload="metadata"></video>
  <div class="cap">The finished vertical short — panels animated with wan, timed to your voice.</div></div>
  ${rows}
</div></body></html>`;
  const r5 = await post('/api/chatfeed/page', { chat: CHAT, title: 'Controlling My Own Destiny — pastel short', html });
  console.log('compare page:', JSON.stringify(r5).slice(0, 200));

  fs.writeFileSync(OUT + '/final-url.txt', finalUrl);
  console.log('FILING DONE');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

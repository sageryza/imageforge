// Frame-to-frame animation test (Sophie, Aug 2026): draw an END panel that
// continues an existing beat panel's exact scene, then animate BETWEEN the
// two with wan-2.2-i2v-fast `last_image` conditioning (the movies.js pair
// technique) instead of letting the model drift off one still. Two beats:
// the meteorite reveal (lift) and the bargain (slide across the table).
const fs = require('fs');
const admin = require('firebase-admin');
const { OUT, BEATS, PROJECT, CHAT } = require('./beats');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TOKEN = process.env.REPLICATE_API_TOKEN;
const VERSION = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';
const BASE = 'https://imageforge-q125.onrender.com';

const CONT = 'The FIRST attached image is the exact scene to continue — keep the SAME characters, faces, outfits, setting, composition, linework and flat pastel palette. The other attached images are style references only. Draw the SAME scene a moment LATER: ';
const END = ' Vertical 2:3 portrait composition. Absolutely no text, no words, no letters, no numbers, no captions.';

const PAIRS = [
  {
    beat: 1,
    endContent: 'the woman now holds the display case raised high toward the viewer at the top of her lift, arms extended, the glinting flecks and pastel sparkles flared bigger and brighter around the case.',
    motion: 'She lifts the display case higher toward the viewer in one smooth continuous motion, the sparkles flaring brighter as it rises.',
  },
  {
    beat: 7,
    endContent: 'the meteorite case has finished sliding and now sits at the woman\'s edge of the table directly in front of her, the man leaned back with his hands withdrawn, the small tied money bag still ignored at the table edge, the woman unmoved with her arms crossed.',
    motion: 'He pushes the meteorite case in one continuous slide across the table until it stops in front of the woman, then draws his hands back; she stays motionless with her arms crossed.',
  },
];

async function edit(prompt, refs, retries = 2) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', '1024x1536');
      form.append('quality', 'medium');
      form.append('output_format', 'webp');
      form.append('output_compression', '90');
      refs.forEach((b, i) => form.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i + 1}.png`));
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return Buffer.from(data.data[0].b64_json, 'base64');
    } catch (e) { lastErr = e; if (a < retries) await new Promise(r => setTimeout(r, 2000 * (a + 1))); }
  }
  throw lastErr;
}

async function predict(input) {
  let p;
  for (let a = 0; a < 5; a++) { // transient proxy/DNS hiccups return non-JSON error bodies — retry the create
    try {
      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: VERSION, input }),
      });
      p = await res.json();
      break;
    } catch (e) {
      console.warn('  create hiccup:', String(e.message).slice(0, 80));
      if (a === 4) throw e;
      await new Promise(r => setTimeout(r, 3000 * (a + 1)));
    }
  }
  if (p.error || !p.id) throw new Error('create failed: ' + JSON.stringify(p).slice(0, 300));
  const id = p.id;
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const r2 = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      p = await r2.json(); // transient proxy/DNS hiccups return non-JSON bodies — treat as a missed poll, not a failure
    } catch (e) { console.warn('  poll hiccup:', String(e.message).slice(0, 80)); continue; }
    if (p.status === 'succeeded') return p;
    if (p.status === 'failed' || p.status === 'canceled') throw new Error('prediction ' + p.status + ': ' + (p.error || ''));
  }
  throw new Error('timed out');
}

async function post(path, body) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return data;
}

(async () => {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();
  const styleRefs = [];
  for (const p of ['witch-school/refs/style-1.png', 'witch-school/refs/style-2.png']) {
    const [buf] = await bucket.file(p).download();
    styleRefs.push(buf);
  }
  const panels = require(OUT + '/panels.json');
  const results = [];
  for (const pair of PAIRS) {
    const startLocal = `${OUT}/panel-${pair.beat}.webp`;
    const endLocal = `${OUT}/pair-${pair.beat}-end.webp`;
    const startUrl = panels.find(p => p.beat === pair.beat).url;
    if (!fs.existsSync(endLocal) || process.env.FORCE) {
      console.log(`beat ${pair.beat}: drawing end frame…`);
      const buf = await edit(CONT + pair.endContent + END, [fs.readFileSync(startLocal), ...styleRefs]);
      fs.writeFileSync(endLocal, buf);
    }
    const endDest = `story-shorts/${PROJECT}/pair-${pair.beat}-end.webp`;
    await bucket.upload(endLocal, { destination: endDest, metadata: { contentType: 'image/webp' } });
    await bucket.file(endDest).makePublic();
    const endUrl = `https://storage.googleapis.com/${bucket.name}/${endDest}`;
    console.log(`beat ${pair.beat}: end frame → ${endUrl}`);

    console.log(`beat ${pair.beat}: animating between frames…`);
    const pred = await predict({
      image: startUrl,
      last_image: endUrl,
      prompt: pair.motion + ' Flat pastel illustration style with bold black ink outlines on a white background.',
      resolution: '720p', num_frames: 121, frames_per_second: 16, interpolate_output: true, go_fast: true,
    });
    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    const clipLocal = `${OUT}/pair-${pair.beat}.mp4`;
    const buf = Buffer.from(await (await fetch(out)).arrayBuffer());
    if (buf.length < 20000) throw new Error('clip too small');
    fs.writeFileSync(clipLocal, buf);
    const clipDest = `story-shorts/${PROJECT}/pair-${pair.beat}.mp4`;
    await bucket.upload(clipLocal, { destination: clipDest, metadata: { contentType: 'video/mp4' } });
    await bucket.file(clipDest).makePublic();
    const clipUrl = `https://storage.googleapis.com/${bucket.name}/${clipDest}`;
    console.log(`beat ${pair.beat}: clip → ${clipUrl}`);
    results.push({ ...pair, startUrl, endUrl, clipUrl, madeAt: Date.now() });
  }

  // File end panels + prompts (verbatim), then a NEW Compare page for the test.
  for (const r of results) {
    await post('/api/gallery', {
      url: r.endUrl, chat: CHAT, created: r.madeAt, style: 'Pastel (house)', type: 'single',
      description: BEATS[r.beat].label.replace(/^Meteorite \d+ — /, '') + ' — END frame (frame-to-frame test)',
      prompt: 'gpt-image-2 · medium · Pastel (house) · 2:3 · scene continuation',
    });
  }
  await post('/api/gallery/assets/prompt', {
    chat: CHAT,
    items: results.map(r => ({ url: r.endUrl, style: CONT + '[content]' + END + ' — refs attached: the beat\'s start panel FIRST, then witch-school/refs/style-1.png, style-2.png · gpt-image-2 edits · 1024x1536 · medium', content: r.endContent })),
  });
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = results.map(r => `
    <section class="beat">
      <div class="num">${esc(BEATS[r.beat].label)}</div>
      <div class="pair"><img src="${r.startUrl}"><img src="${r.endUrl}"></div>
      <p class="vo">motion: ${esc(r.motion)}</p>
      <video src="${r.clipUrl}" controls playsinline preload="none" poster="${r.startUrl}"></video>
    </section>`).join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frame-to-frame test v1</title>
<style>
  body { margin:0; background:#fff; color:#1c1c1e; font:16px/1.5 -apple-system, system-ui, sans-serif; }
  .wrap { max-width:560px; margin:0 auto; padding:20px 16px 80px; }
  h1 { font-size:22px; margin:8px 0 2px; } .sub { color:#6e6e73; font-size:14px; margin:0 0 18px; }
  .beat { margin:0 0 30px; border-top:1px solid #e5e5ea; padding-top:18px; }
  .num { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#b06fa8; margin-bottom:8px; }
  .pair { display:flex; gap:8px; } .pair img { width:calc(50% - 4px); border-radius:6px; border:1px solid #eee; }
  .vo { font-size:14px; color:#3a3a3c; margin:10px 0; }
  video { display:block; width:100%; border-radius:6px; border:1px solid #eee; }
</style></head><body><div class="wrap">
  <h1>Frame-to-frame test v1</h1>
  <p class="sub">wan last_image conditioning — start panel → drawn end panel, the model animates the action between. Reveal &amp; bargain beats.</p>
  ${rows}
</div></body></html>`;
  await post('/api/chatfeed/page', { chat: CHAT, title: 'Frame-to-frame test v1 — reveal & bargain', html });
  fs.writeFileSync(`${OUT}/pair-results.json`, JSON.stringify(results, null, 2));
  console.log('TEST DONE');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

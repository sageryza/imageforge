// WARNING, earned live: the manifest at OUT is the ONLY guard against
// redrawing. Every finished sticker writes to a FIXED Storage path, so running
// this with the manifest missing or cleared re-renders every id AND overwrites
// the bytes at URLs a posted Compare page and the Assets tiles already point
// at (stale-media hazard, CLAUDE.md "Compare pages"). Keep .day-stickers.json,
// or pass --only-style ids you actually want. Restoring cost real money once.
//
// One-off: draw a "guess my day" sticker sheet from the moments in Sophie's
// 2026-08-06 voice memo. Same pipeline as scripts/selfcare-stickers.js
// (gpt-image-2 edits against the Witch School style refs -> background-remover
// -> alpha-trim -> upload) so these read as the same set as Sticker Day.
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BUCKET = 'deckfactory-43176.firebasestorage.app';
const REFS = ['storage:witch-school/refs/sophie-snake.png', 'storage:witch-school/refs/sophie-animals.png'];
const BG_REMOVE_MODEL = '851-labs/background-remover';
const OUT = path.join(__dirname, '..', '.day-stickers.json');

const STYLE = 'Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black), playful modern editorial illustration, flat colors with NO gradients and minimal shading. Draw a brand-new, SIMPLE, uncluttered illustration of ONE single object. ';
const END = ' The object is centered and complete, drawn large and filling most of the frame, on a plain flat solid cream off-white background with nothing else in the frame — no scenery, no surface, no table, no cast shadow, no drop shadow, no frame or border. Absolutely no text, no words, no letters, no numbers, no captions.';
// One sticker genuinely needs its numerals — the house number IS the moment.
const END_NUM = ' The object is centered and complete, drawn large and filling most of the frame, on a plain flat solid cream off-white background with nothing else in the frame — no scenery, no surface, no table, no cast shadow, no drop shadow, no frame or border. The only characters anywhere in the image are the three digits 4 4 4 on the plate itself — no other text, words or captions.';

const STICKERS = [
  { id: 'frog',       prompt: 'A plump sitting frog seen straight on, facing forward.' },
  { id: 'cat',        prompt: 'A cat sitting upright with its tail curled round its front paws, seen from the side, head turned to look away over its shoulder.' },
  { id: 'figs',       prompt: 'A small framed painting of two ripe figs on a leafy branch, one fig cut open to show the inside, seen straight on.' },
  { id: 'processor',  prompt: 'A countertop food processor with its lid on and a bright green puree inside the bowl, seen straight on.' },
  // v1 drew as folded grey shorts — grey is outside the pack palette and the
  // legs were cropped, so it was the one sticker that didn't read as the set.
  // v2 fixed the length but the style refs pulled it salmon; the moment is
  // specifically GREY sweatpants, so v3 names the colour outright — the pack
  // already carries one off-palette object (the blue water glass).
  { id: 'sweatpants3', prompt: 'A pair of plain heather-grey jogging sweatpants hanging full length with both legs visible, a drawstring at the waist and elasticated cuffs at the ankles, seen straight on from the front. The sweatpants are grey, not pink and not orange.' },
  { id: 'mic',        prompt: 'A handheld karaoke microphone held at a diagonal with its cord looping below it.' },
  { id: 'unsent',     prompt: 'A mobile phone seen straight on with one single empty chat speech bubble on its screen, the bubble drawn as a dashed broken outline as if it is disappearing.' },
  { id: 'door444',    prompt: 'A rectangular house number plate showing the three digits 444, hanging straight on.', numerals: true },
];

const COST_PER = 0.042;
console.log(`${STICKERS.length} stickers · estimated $${(STICKERS.length * COST_PER).toFixed(2)}`);
if (process.argv.includes('--dry-run')) process.exit(0);

const OPENAI = process.env.OPENAI_API_KEY;
const REPLICATE = process.env.REPLICATE_API_TOKEN;
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), storageBucket: BUCKET });

async function materializeRefs(refs) {
  const out = [];
  for (const r of refs) {
    const remote = r.slice('storage:'.length);
    const local = '/tmp/ref-' + remote.split('/').pop();
    if (!fs.existsSync(local)) await getStorage().bucket().file(remote).download({ destination: local });
    out.push(local);
  }
  return out;
}

async function generate(prompt, refs, numerals) {
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', STYLE + prompt + (numerals ? END_NUM : END));
  fd.append('size', '1024x1024');
  fd.append('quality', 'medium');
  fd.append('n', '1');
  for (const p of refs) fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), path.basename(p));
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: 'Bearer ' + OPENAI }, body: fd,
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error).slice(0, 220));
  return Buffer.from(d.data[0].b64_json, 'base64');
}

let bgVersion = null;
async function removeBackground(imageUrl) {
  if (!bgVersion) {
    const mj = await (await fetch(`https://api.replicate.com/v1/models/${BG_REMOVE_MODEL}`, { headers: { Authorization: 'Bearer ' + REPLICATE } })).json();
    bgVersion = mj.latest_version.id;
  }
  let p = await (await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + REPLICATE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: bgVersion, input: { image: imageUrl } }),
  })).json();
  let n = 0;
  while (!['succeeded', 'failed', 'canceled'].includes(p.status) && n < 60) {
    await new Promise(r => setTimeout(r, 2000));
    p = await (await fetch(p.urls.get, { headers: { Authorization: 'Bearer ' + REPLICATE } })).json();
    n++;
  }
  if (p.status !== 'succeeded') throw new Error(`bg-removal ${p.status}`);
  return Array.isArray(p.output) ? p.output[0] : p.output;
}

async function fetchBuffer(url, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { last = e; if (i < tries) await new Promise(r => setTimeout(r, 2000 * i)); }
  }
  throw new Error('download failed: ' + last.message);
}

async function upload(buf, remotePath) {
  const file = getStorage().bucket().file(remotePath);
  await file.save(buf, { metadata: { contentType: 'image/png' }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${BUCKET}/${remotePath}`;
}

async function trimSquare(buf) {
  const trimmed = await sharp(buf).trim({ threshold: 1 }).toBuffer();
  const m = await sharp(trimmed).metadata();
  const side = Math.max(m.width, m.height);
  const pad = Math.round(side * 0.04);
  return sharp({ create: { width: side + pad * 2, height: side + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, left: pad + Math.round((side - m.width) / 2), top: pad + Math.round((side - m.height) / 2) }])
    .png().toBuffer();
}

(async () => {
  const refs = await materializeRefs(REFS);
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  for (const s of STICKERS) {
    if (out[s.id] && !process.argv.includes('--force')) { console.log(`${s.id} … have it`); continue; }
    process.stdout.write(`${s.id} … `);
    try {
      let buf = null;
      for (let a = 1; a <= 3 && !buf; a++) {
        try { buf = await generate(s.prompt, refs, s.numerals); }
        catch (e) { if (a === 3) throw e; process.stdout.write(`retry(${a}) `); await new Promise(r => setTimeout(r, 3000 * a)); }
      }
      const rawUrl = await upload(buf, `daystickers/2026-08-06/_raw/${s.id}.png`);
      process.stdout.write('cut … ');
      const final = await trimSquare(await fetchBuffer(await removeBackground(rawUrl)));
      out[s.id] = { img: await upload(final, `daystickers/2026-08-06/${s.id}.png`), raw: rawUrl, prompt: STYLE + s.prompt + (s.numerals ? END_NUM : END) };
      fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
      console.log('ok');
    } catch (e) { console.log('FAILED: ' + e.message); }
  }
  console.log('done →', OUT);
})();

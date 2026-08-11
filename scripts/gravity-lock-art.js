#!/usr/bin/env node
/**
 * Gravity Lock art — the celestial bodies drawn in Sophie's own styles.
 *
 * A style test, not a one-off: the same four subjects (moon, astronaut, ringed
 * planet, black hole) are drawn in BOTH the Pastel house look and the Hoonies
 * woodcut look, so the two can be judged against each other on identical
 * subjects.
 *
 * The two recipes are copied VERBATIM from server.js — MODELS.house
 * ['house-pastel'] and PL_GPT_STYLES.hoonies — refs, prefix, suffix and the
 * whiten pass included. If either drifts in server.js, this drifts too and the
 * test stops being about the styles.
 *
 * Every finished picture is cut off its white ground (corner flood fill, the
 * same idea as whitenBackground but writing alpha 0 instead of white), trimmed,
 * re-padded square, and then ALSO composited onto the game's real night sky —
 * because that is the ground it has to work on, and a pastel drawing judged on
 * white tells you nothing about how it reads on black.
 *
 *   node scripts/gravity-lock-art.js [--only moon,astronaut] [--styles pastel]
 *                                    [--quality medium] [--dry-run]
 *
 * Needs OPENAI_API_KEY and FIREBASE_SERVICE_ACCOUNT (Deck Factory — the style
 * refs live in its Storage bucket).
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NIGHT = '#070b16';                       // the game's flat sky
const OUT = path.join(__dirname, '..', '.artout', 'gravity-lock');

// ---------------------------------------------------------------- recipes
// Verbatim from server.js. Do not "tidy" these strings.
const STYLES = {
  pastel: {
    label: 'Pastel',
    refs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    prefix: 'Use the attached images ONLY as a STYLE reference for the linework: ' +
      'bold confident black ink outlines, flat colors with NO gradients and minimal ' +
      'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, ' +
      'on a plain white background, playful modern editorial illustration.',
    suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
    whiten: true,
  },
  hoonies: {
    label: 'Hoonies',
    refs: [
      'hoonies/refs/style-1.png', 'hoonies/refs/style-2.png',
      'hoonies/refs/style-3.png', 'hoonies/refs/style-4.png',
    ],
    prefix: 'Use the attached images ONLY as a style reference — copy their ' +
      'drawing style, not their content. Draw the subject below in that exact ' +
      'style, alone on a plain white background, no border, no frame, no text.',
    suffix: 'Do not include any text in the image.',
    whiten: false,
  },
};

// No background words in any subject: both prefixes already pin a plain white
// ground, and saying "in space" fights that and ruins the cutout.
const SUBJECTS = {
  moon:      { name: 'the moon',      text: 'A full moon: a round sphere covered in craters, seen straight on.' },
  astronaut: { name: 'the astronaut', text: 'An astronaut in a spacesuit with a round helmet, floating with arms and legs loose, seen from the front, whole body.' },
  planet:    { name: 'a planet',      text: 'A small round planet with two thin rings circling it, seen straight on.' },
  blackhole: { name: 'the black hole',text: 'A black hole: a solid dark circle with a bright ring of light around it.' },
  // v2 — v1 leaked the style refs' OWN CONTENT into the picture (the girl, the
  // snake, the cat and the dog are what sophie-snake.png and sophie-animals.png
  // actually depict). A sparse subject leaves the model room to fill the frame
  // from the references, so this one says out loud what must not be in it.
  blackhole2:{ name: 'the black hole', text: 'A black hole, alone: one solid black circle with a single bright glowing ring around its edge, and nothing else at all in the picture. No people, no animals, no plants, no other objects.' },
};

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes('--' + n);
const only = (flag('only', '') || '').split(',').filter(Boolean);
const wantStyles = (flag('styles', 'pastel,hoonies') || '').split(',').filter(Boolean);
const QUALITY = flag('quality', 'medium');
const SIZE = flag('size', '1024x1024');
const DRY = has('dry-run');

// ---------------------------------------------------------------- firebase
let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set (style refs live in Storage)');
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred), storageBucket: `${cred.project_id}.firebasestorage.app` });
  bucket = admin.storage().bucket();
}
const refCache = new Map();
async function loadRef(p) {
  if (refCache.has(p)) return refCache.get(p);
  const [buf] = await bucket.file(p).download();
  refCache.set(p, buf);
  return buf;
}

// ---------------------------------------------------------------- openai
async function editWithRefs(prompt, refBufs, { quality, size, timeout = 240000 }) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  refBufs.forEach((b, i) => form.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i}.png`));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form, signal: ctrl.signal,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `openai ${r.status}`);
    return Buffer.from(j.data[0].b64_json, 'base64');
  } finally { clearTimeout(timer); }
}

// ---------------------------------------------------------------- cutout
// Corner flood fill, the same shape as server.js's whitenBackground, except it
// writes alpha 0 rather than white. Only pixels CONNECTED to an edge go — an
// enclosed white highlight inside the drawing survives, which a plain
// "make white transparent" pass would punch out.
async function cutBackground(buf, tol = 46) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const idx = (x, y) => (y * W + x) * C;
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const tol2 = tol * tol;
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= tol2; };
  const visited = new Uint8Array(W * H), stack = [];
  const pushIf = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (visited[p] || !close(idx(x, y))) return; visited[p] = 1; stack.push(p); };
  for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
  for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p - x) / W; pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < W * H; p++) if (visited[p]) out[p * C + 3] = 0;
  return sharp(out, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}

// Trim the transparent margin, then re-pad to a square so every body lands the
// same visual size in its slot however the model framed it.
async function trimSquare(pngBuf, pad = 0.06) {
  const t = await sharp(pngBuf).trim({ threshold: 1 }).toBuffer();
  const m = await sharp(t).metadata();
  const side = Math.round(Math.max(m.width, m.height) * (1 + pad * 2));
  return sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: t, gravity: 'center' }]).png().toBuffer();
}

async function onNightSky(pngBuf, side = 900) {
  const art = await sharp(pngBuf).resize(Math.round(side * 0.78), Math.round(side * 0.78), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: side, height: side, channels: 4, background: NIGHT } })
    .composite([{ input: art, gravity: 'center' }]).png().toBuffer();
}

// ---------------------------------------------------------------- run
(async () => {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const jobs = [];
  for (const sk of wantStyles) {
    if (!STYLES[sk]) throw new Error('unknown style ' + sk);
    for (const bk of Object.keys(SUBJECTS)) {
      if (only.length && !only.includes(bk)) continue;
      jobs.push({ styleKey: sk, subjKey: bk });
    }
  }
  const est = (jobs.length * (QUALITY === 'high' ? 0.25 : QUALITY === 'low' ? 0.02 : 0.06)).toFixed(2);
  console.log(`${jobs.length} image(s) at quality ${QUALITY}, ${SIZE} — estimated $${est}`);
  if (DRY) { jobs.forEach(j => console.log('  ', j.styleKey, j.subjKey)); return; }

  initFirebase();
  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];

  for (const { styleKey, subjKey } of jobs) {
    const st = STYLES[styleKey], sub = SUBJECTS[subjKey];
    const id = `${styleKey}-${subjKey}`;
    const prompt = `${st.prefix} ${sub.text} ${st.suffix}`;
    const madeAt = Date.now();
    process.stdout.write(`${id} … `);
    try {
      const refs = await Promise.all(st.refs.map(loadRef));
      let buf = await editWithRefs(prompt, refs, { quality: QUALITY, size: SIZE });
      const buf0 = buf;                       // untouched original, banked below
      fs.writeFileSync(path.join(OUT, id + '-raw.png'), buf);

      if (st.whiten) buf = await sharp(await cutBackground(buf)).flatten({ background: '#ffffff' }).png().toBuffer();
      const cut = await trimSquare(await cutBackground(buf));
      fs.writeFileSync(path.join(OUT, id + '-cutout.png'), cut);
      const tile = await onNightSky(cut);
      fs.writeFileSync(path.join(OUT, id + '-onsky.png'), tile);

      // permanent public URLs — OpenAI's bytes are ours already, but the app
      // needs somewhere to fetch them from
      // The RAW bytes go up too. They are the only untouched copy — the cutout is
      // trimmed and alpha'd and the on-sky one is composited — and .artout/ is a
      // scratch dir that does not survive the session.
      const urls = {};
      for (const [kind, bytes] of [['raw', buf0], ['cutout', cut], ['onsky', tile]]) {
        const p = `gravity-lock/${id}-${kind}.png`;
        await bucket.file(p).save(bytes, { contentType: 'image/png', metadata: { cacheControl: 'public,max-age=31536000,immutable' } });
        await bucket.file(p).makePublic();
        urls[kind] = `https://storage.googleapis.com/${bucket.name}/${p}`;
      }
      manifest.push({ id, styleKey, styleLabel: st.label, subjKey, subjName: sub.name, prompt,
        stylePrompt: `${st.prefix} [content] ${st.suffix}`, content: sub.text,
        refs: st.refs, quality: QUALITY, size: SIZE, madeAt, urls });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('ok');
    } catch (e) {
      console.log('FAILED —', e.message);
    }
  }
  console.log('\nmanifest:', manifestPath);
})();

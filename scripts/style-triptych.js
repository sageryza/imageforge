#!/usr/bin/env node
/**
 * One prompt, three house styles, side by side — the comparison Sophie kept
 * wanting and nobody had built (Aug 2026).
 *
 *   node scripts/style-triptych.js [low|medium|high] [--subjects a,b] [--dry-run]
 *
 * The harness is IDENTICAL across the three styles so the only thing moving is
 * the style itself: gpt-image-2's edits endpoint, 1024x1536 (2:3), refs attached
 * as pure STYLE references, and the Playground's own prompt seam
 *   `${prefix}\n\n${typed}\n\n${suffix}`
 * (server.js ~4892). Each style then carries its REAL production recipe — the
 * one Sophie would actually get if she asked for that look — not a normalised
 * one, because what she is judging is the styles as they ship.
 *
 * Every run writes a manifest next to the images recording the EXACT prompt
 * sent per picture, so the Assets-tab prompt split is never a reconstruction.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const QUALITY = (process.argv[2] || 'low').toLowerCase();
if (!['low', 'medium', 'high'].includes(QUALITY)) {
  console.error(`quality must be low|medium|high (got "${QUALITY}")`);
  process.exit(1);
}
const DRY = process.argv.includes('--dry-run');
const onlyArg = process.argv.find((a) => a.startsWith('--subjects='));
const ONLY = onlyArg ? onlyArg.split('=')[1].split(',').map((s) => s.trim()) : null;

// gpt-image-2 edits, 2:3 portrait — PL_GPT's own recipe.
const MODEL = 'gpt-image-2';
const SIZE = '1024x1536';

// ─── The three styles ────────────────────────────────────────────────────
// watercolor + pastel are VERBATIM copies of PL_GPT_STYLES.evan / .pastel in
// server.js — keep them in step. `dream` is the one that had no Playground
// tile; its prefix/suffix are scripts/nde-panel.py's wording, the real in-use
// recipe for that reference (the anti-grid line is load-bearing there, because
// dream-mystery.jpg is itself a multi-panel comic page and the model copies
// that layout without it).
const STYLES = [
  {
    id: 'watercolor',
    label: 'Watercolor — sage sandy mirror',
    refs: [{ file: 'sage-sandy-mirror.png', type: 'image/png' }],
    prefix: 'Use only the style of the attached style reference and ignore its ' +
      'content — do not copy anything depicted in it. You can choose your own ' +
      'colors rather than copying the colors of the style reference.',
    suffix: 'Do not include any text in the image.',
  },
  {
    id: 'dream',
    label: 'Dream mystery — diary comic',
    refs: [{ file: 'dream-mystery.jpg', type: 'image/jpeg' }],
    prefix: 'The FIRST attached image is a STYLE reference — copy its drawing style, ' +
      'linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy ' +
      'its content, subjects, or composition.',
    suffix: 'Render as ONE single full-bleed vertical illustration — a single image, ' +
      'NOT a grid, NOT split panels, no borders, no caption boxes, no text or lettering anywhere.',
  },
  {
    id: 'pastel',
    label: 'Pastel — Witch School house',
    storageRefs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    prefix: 'Use the attached images ONLY as a STYLE reference for the linework: ' +
      'bold confident black ink outlines, flat colors with NO gradients and minimal ' +
      'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, ' +
      'on a plain white background, playful modern editorial illustration.',
    suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
    whiten: true,
  },
];

// ─── The subjects ────────────────────────────────────────────────────────
// Deliberately awkward: each one leans on a different thing illustration models
// are known to fumble, so the grid shows where a style holds together and where
// it falls apart — not just which is prettiest on an easy subject.
const SUBJECTS = [
  // The first version of this subject had her cutting her own hair with
  // scissors and gpt-image-2's safety system refused it on all three styles —
  // a self-harm read. A refusal is TERMINAL (never retry it, see CLAUDE.md);
  // the subject is re-written instead, keeping the same three stresses.
  {
    id: 'braid',
    label: 'Braiding her hair in the mirror',
    stress: 'both hands working behind the head + a face that has to match its reflection',
    text: 'A woman kneeling on a bathroom floor braiding her long hair into a plait with ' +
      'both hands raised behind her head, her face reflected in the mirror above the sink ' +
      'behind her, hairpins scattered across the tiles around her.',
  },
  {
    id: 'dinner',
    label: 'Six at a small table',
    stress: 'a crowd — overlapping bodies, arms that belong to someone',
    text: 'Six people crowded around a small round restaurant table passing dishes to one ' +
      'another, one of them half standing to reach across, and a waiter squeezing past ' +
      'behind them with a loaded tray held above his head.',
  },
  {
    id: 'bicycle',
    label: 'The chain came off',
    stress: 'machinery + an upside-down pose',
    text: 'A man crouched underneath an upside-down bicycle on a repair stand, turning the ' +
      'pedals with one hand while the chain slips off the sprocket into his other hand, ' +
      'his tools spread out on the ground beneath him.',
  },
  {
    id: 'terrarium',
    label: 'Three lizards, one through the glass',
    stress: 'transparency and a count that has to stay right',
    text: 'A glass terrarium on a windowsill holding three small lizards, one of them ' +
      'clinging to the far wall of the glass so it is seen through two panes at once, ' +
      'heavy rain streaking down the window behind it.',
  },
];

const subjects = ONLY ? SUBJECTS.filter((s) => ONLY.includes(s.id)) : SUBJECTS;
if (!subjects.length) { console.error('no subjects matched'); process.exit(1); }

// The Playground's seam, character for character (server.js ~4892).
const assemble = (st, typed) => `${st.prefix}\n\n${typed}${st.suffix ? `\n\n${st.suffix}` : ''}`;

let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT missing (deckfactory service account)');
  const sa = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: `${sa.project_id}.firebasestorage.app`,
  });
  bucket = admin.storage().bucket();
}

const houseRefCache = new Map();
async function loadStorageRef(p) {
  if (houseRefCache.has(p)) return houseRefCache.get(p);
  const [buf] = await bucket.file(p).download();
  houseRefCache.set(p, buf);
  return buf;
}

async function refBuffers(st) {
  if (st.storageRefs) {
    const bufs = await Promise.all(st.storageRefs.map(loadStorageRef));
    return bufs.map((b, i) => ({ buf: b, name: `ref${i + 1}.png`, type: 'image/png' }));
  }
  return st.refs.map((r, i) => ({
    buf: fs.readFileSync(path.join(ROOT, 'refs', r.file)),
    name: `ref${i + 1}${path.extname(r.file)}`,
    type: r.type,
  }));
}

// VERBATIM from server.js whitenBackground — the pass the pastel house style
// runs, so the pastel column here is what the app would actually ship. It
// samples the four corners rather than assuming white, and interior colours
// walled off by black outlines are preserved.
async function whitenBackground(buf, tol = 46) {
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
  for (let p = 0; p < W * H; p++) if (visited[p]) { const i = p * C; out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; if (C === 4) out[i + 3] = 255; }
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).webp({ lossless: true }).toBuffer();
}

async function generate(prompt, refs) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'webp');
  refs.forEach((r) => form.append('image[]', r.buf, { filename: r.name, contentType: r.type }));
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form,
    timeout: 300000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'gpt-image-2 edit error');
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  return Buffer.from(b64, 'base64');
}

async function upload(buf, dest) {
  const file = bucket.file(dest);
  await file.save(buf, { metadata: { contentType: 'image/webp' }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

(async () => {
  const runs = [];
  for (const sub of subjects) for (const st of STYLES) runs.push({ sub, st });
  const rough = { low: 0.02, medium: 0.06, high: 0.25 }[QUALITY] * runs.length;
  console.log(`${runs.length} images · ${MODEL} · ${SIZE} · quality=${QUALITY} · ~$${rough.toFixed(2)}\n`);
  if (DRY) {
    for (const { sub, st } of runs) {
      console.log(`── ${sub.id} / ${st.id} ${'─'.repeat(30)}`);
      console.log(assemble(st, sub.text));
      console.log();
    }
    return;
  }

  initFirebase();
  const outDir = path.join(ROOT, 'out', 'style-triptych', QUALITY);
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];

  // Sequential on purpose: a rate-limit stall here costs minutes, not a
  // half-finished grid Sophie has to guess her way through.
  for (const { sub, st } of runs) {
    const prompt = assemble(st, sub.text);
    const t0 = Date.now();
    try {
      let buf = await generate(prompt, await refBuffers(st));
      if (st.whiten) {
        try { buf = await whitenBackground(buf); } catch (e) { console.warn('  whiten failed:', e.message); }
      }
      const name = `${sub.id}__${st.id}.webp`;
      fs.writeFileSync(path.join(outDir, name), buf);
      const url = await upload(buf, `style-compare/${QUALITY}/${name}`);
      manifest.push({
        subject: sub.id, subjectLabel: sub.label, stress: sub.stress,
        style: st.id, styleLabel: st.label, quality: QUALITY, model: MODEL, size: SIZE,
        refs: st.storageRefs || st.refs.map((r) => r.file),
        promptStyle: `${st.prefix}\n\n[content]\n\n${st.suffix}`,
        promptContent: sub.text,
        fullPrompt: prompt,
        url, bytes: buf.length, ms: Date.now() - t0,
        createdAt: Date.now(),
      });
      console.log(`  OK ${sub.id}/${st.id} — ${Math.round(buf.length / 1024)}KB in ${Math.round((Date.now() - t0) / 1000)}s`);
    } catch (e) {
      console.error(`  ERR ${sub.id}/${st.id}: ${String(e.message).slice(0, 160)}`);
      manifest.push({ subject: sub.id, style: st.id, quality: QUALITY, error: String(e.message) });
    }
  }

  // MERGE, never overwrite: a re-run of one subject (a safety refusal rewritten,
  // a single failure retried) must not wipe the rest of the grid off the
  // manifest — that record is the only place the exact prompts are kept.
  const mf = path.join(ROOT, 'out', 'style-triptych', `manifest-${QUALITY}.json`);
  let merged = manifest;
  if (fs.existsSync(mf)) {
    const prior = JSON.parse(fs.readFileSync(mf, 'utf8'));
    const touched = new Set(manifest.map((m) => `${m.subject}/${m.style}`));
    merged = prior.filter((m) => !touched.has(`${m.subject}/${m.style}`)).concat(manifest);
  }
  fs.writeFileSync(mf, JSON.stringify(merged, null, 2));
  console.log(`\nmanifest → ${mf} (${merged.length} entries)`);
})().catch((e) => { console.error(e); process.exit(1); });

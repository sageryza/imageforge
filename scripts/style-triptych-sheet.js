#!/usr/bin/env node
/**
 * The style triptych as 2x2 SHEETS — all four subjects drawn in ONE pass per
 * style, then cut into cells (Aug 2026, Sophie's ask).
 *
 *   node scripts/style-triptych-sheet.js [medium] [--dry-run]
 *
 * ONE sheet per style instead of four separate renders, so a style's four
 * subjects come out of a single generation and are consistent with each other.
 * The trade Sophie named herself: each cell is a QUARTER of the sheet
 * (~512x768 from a 1024x1536), so a cell is smaller than the individual runs.
 *
 * WHAT IS REUSED, AND WHY IT MATTERS:
 *   - `slice()` from vectorize.js does the cutting — it finds the REAL gutters
 *     rather than cutting at exact halves. Its `report.missed` counts the
 *     seams it could not find; a missed seam falls back to the midpoint.
 *     **`gutters()` needs a seam of luma >= 245**, so a style that renders on
 *     cream paper (dream mystery) is expected to miss and land on halves.
 *   - `HOUSE.grid(2,2)` from vector.js is the grid instruction, verbatim. Its
 *     "wide clean white gutters" and "nothing crossing or touching between the
 *     cells" are load-bearing: the sheet is cut on a straight line, so a
 *     drawing that leans into its neighbour loses a limb.
 *
 * THE ONE PLACE THIS DIVERGES FROM THE STYLES AS THEY SHIP: dream mystery's
 * real suffix is an ANTI-GRID line ("NOT a grid, NOT split panels"), which
 * exists because dream-mystery.jpg is itself a comic page. It directly
 * contradicts a 2x2 sheet, so for THIS run only it is replaced with the plain
 * no-text rule. Named in the reply that delivers these.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const { slice } = require('../vectorize');

const ROOT = path.join(__dirname, '..');
const QUALITY = (process.argv[2] || 'medium').toLowerCase();
const DRY = process.argv.includes('--dry-run');
const REUSE = process.argv.includes('--reuse');
const MODEL = 'gpt-image-2';
const SIZE = '1024x1536';

// Verbatim from vector.js HOUSE.grid(2, 2) — do not drift this wording.
const GRID = 'A 2x2 grid of four completely separate small illustrations on a plain white '
  + 'background. Wide clean white gutters between them, each drawing sitting well inside its '
  + 'own quarter, nothing crossing or touching between the cells, no grid lines, no borders, '
  + 'no frames.';

// Reading order — must match slice()'s output order (row-major).
const SUBJECTS = [
  { id: 'braid', at: 'TOP LEFT', label: 'Braiding her hair in the mirror',
    text: 'A woman kneeling on a bathroom floor braiding her long hair into a plait with '
      + 'both hands raised behind her head, her face reflected in the mirror above the sink '
      + 'behind her, hairpins scattered across the tiles around her.' },
  { id: 'dinner', at: 'TOP RIGHT', label: 'Six at a small table',
    text: 'Six people crowded around a small round restaurant table passing dishes to one '
      + 'another, one of them half standing to reach across, and a waiter squeezing past '
      + 'behind them with a loaded tray held above his head.' },
  { id: 'bicycle', at: 'BOTTOM LEFT', label: 'The chain came off',
    text: 'A man crouched underneath an upside-down bicycle on a repair stand, turning the '
      + 'pedals with one hand while the chain slips off the sprocket into his other hand, '
      + 'his tools spread out on the ground beneath him.' },
  { id: 'terrarium', at: 'BOTTOM RIGHT', label: 'Three lizards, one through the glass',
    text: 'A glass terrarium on a windowsill holding three small lizards, one of them '
      + 'clinging to the far wall of the glass so it is seen through two panes at once, '
      + 'heavy rain streaking down the window behind it.' },
];

const STYLES = [
  {
    id: 'watercolor', label: 'Watercolor — sage sandy mirror',
    refs: [{ file: 'sage-sandy-mirror.png', type: 'image/png' }],
    prefix: 'Use only the style of the attached style reference and ignore its '
      + 'content — do not copy anything depicted in it. You can choose your own '
      + 'colors rather than copying the colors of the style reference.',
    suffix: 'Do not include any text in the image.',
  },
  {
    id: 'dream', label: 'Dream mystery — diary comic',
    refs: [{ file: 'dream-mystery.jpg', type: 'image/jpeg' }],
    prefix: 'The FIRST attached image is a STYLE reference — copy its drawing style, '
      + 'linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy '
      + 'its content, subjects, or composition.',
    // REPLACED for the sheet run — see the header. Its real suffix forbids a grid.
    suffix: 'Do not include any text in the image.',
    suffixSwapped: true,
  },
  {
    id: 'pastel', label: 'Pastel — Witch School house',
    storageRefs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    prefix: 'Use the attached images ONLY as a STYLE reference for the linework: '
      + 'bold confident black ink outlines, flat colors with NO gradients and minimal '
      + 'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, '
      + 'on a plain white background, playful modern editorial illustration.',
    suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
    whiten: true,
  },
];

const assemble = (st) => `${st.prefix}\n\n${GRID} `
  + SUBJECTS.map((s) => `${s.at}: ${s.text.replace(/\.$/, '')}.`).join(' ')
  + `\n\n${st.suffix}`;

let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
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
    name: `ref${i + 1}${path.extname(r.file)}`, type: r.type,
  }));
}

// VERBATIM from server.js whitenBackground.
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
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}

async function generate(prompt, refs) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'png');   // PNG so the cut is lossless; cells go out as webp
  refs.forEach((r) => form.append('image[]', r.buf, { filename: r.name, contentType: r.type }));
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form, timeout: 300000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'gpt-image-2 edit error');
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  return Buffer.from(b64, 'base64');
}

async function upload(buf, dest, type = 'image/webp') {
  const f = bucket.file(dest);
  await f.save(buf, { metadata: { contentType: type }, resumable: false });
  await f.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

(async () => {
  const cost = { low: 0.02, medium: 0.06, high: 0.25 }[QUALITY] * STYLES.length;
  console.log(`${STYLES.length} sheets · ${MODEL} · ${SIZE} · 2x2 · quality=${QUALITY} · ~$${cost.toFixed(2)}\n`);
  if (DRY) {
    for (const st of STYLES) { console.log(`── ${st.id} ${'─'.repeat(40)}`); console.log(assemble(st)); console.log(); }
    return;
  }
  initFirebase();
  const outDir = path.join(ROOT, 'out', 'style-triptych', `sheet-${QUALITY}`);
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];

  for (const st of STYLES) {
    const prompt = assemble(st);
    const t0 = Date.now();
    try {
      // --reuse cuts and uploads a sheet already on disk instead of paying for
      // it again. The sheet is written BEFORE any upload precisely so a failure
      // downstream never costs a re-render.
      const sheetPath = path.join(outDir, `${st.id}__sheet.png`);
      let sheet;
      if (REUSE && fs.existsSync(sheetPath)) {
        sheet = fs.readFileSync(sheetPath);
        console.log(`  ${st.id}: reusing sheet on disk (${Math.round(sheet.length / 1024)}KB) — not re-generated`);
      } else {
        sheet = await generate(prompt, await refBuffers(st));
        if (st.whiten) { try { sheet = await whitenBackground(sheet); } catch (e) { console.warn('  whiten failed:', e.message); } }
        fs.writeFileSync(sheetPath, sheet);
      }
      const sheetUrl = await upload(await sharp(sheet).webp({ quality: 92 }).toBuffer(),
        `style-compare/sheet-${QUALITY}/${st.id}__sheet.webp`);

      const cells = await slice(sheet, 2, 2);
      const rep = cells.report;
      console.log(`  ${st.id}: sheet ${Math.round(sheet.length / 1024)}KB in ${Math.round((Date.now() - t0) / 1000)}s`
        + ` · cut x=[${rep.x}] y=[${rep.y}]${rep.missed ? `  ⚠ ${rep.missed} seam(s) MISSED → midpoint` : ''}`);

      for (let i = 0; i < SUBJECTS.length; i++) {
        const s = SUBJECTS[i];
        const web = await sharp(cells[i]).webp({ quality: 92 }).toBuffer();
        const meta = await sharp(cells[i]).metadata();
        fs.writeFileSync(path.join(outDir, `${s.id}__${st.id}.webp`), web);
        const url = await upload(web, `style-compare/sheet-${QUALITY}/${s.id}__${st.id}.webp`);
        manifest.push({
          subject: s.id, subjectLabel: s.label, cell: s.at,
          style: st.id, styleLabel: st.label, quality: QUALITY, model: MODEL,
          sheetSize: SIZE, cellSize: `${meta.width}x${meta.height}`,
          fromSheet: true, sheetUrl, seamsMissed: rep.missed,
          suffixSwapped: Boolean(st.suffixSwapped),
          refs: st.storageRefs || st.refs.map((r) => r.file),
          promptStyle: `${st.prefix}\n\n${GRID}\n\n[content — this cell is the ${s.at} quarter of a 2x2 sheet]\n\n${st.suffix}`,
          promptContent: s.text,
          fullPrompt: prompt,
          url, bytes: web.length, createdAt: Date.now(),
        });
        console.log(`     ${s.at.padEnd(12)} ${s.id.padEnd(10)} ${meta.width}x${meta.height}  ${Math.round(web.length / 1024)}KB`);
      }
    } catch (e) {
      console.error(`  ERR ${st.id}: ${String(e.message).slice(0, 200)}`);
      manifest.push({ style: st.id, quality: QUALITY, error: String(e.message) });
    }
  }

  const mf = path.join(ROOT, 'out', 'style-triptych', `manifest-sheet-${QUALITY}.json`);
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest → ${mf}`);
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * The image pipeline, actually walked — one idea, one run at a time.
 *
 *   node scripts/pipeline-walkthrough.js <run-id> [--dry-run]
 *   node scripts/pipeline-walkthrough.js --list
 *
 * Sophie asked to be walked through the pipeline with an example rather than
 * told about it, so this RUNS it: the same idea round the lap twice, then
 * spread into a second style, then one rung up the ladder. Every run is
 * declared in docs/pipeline-walkthrough.json — the prompts, in order, as data,
 * so the page and the reply quote the text that was really sent rather than a
 * reconstruction of it.
 *
 * WHY THIS IS A SCRIPT AND NOT A TOOL: the four-up stop has no tool (see
 * docs/image-pipeline.md, "the three structural holes"). This is the same
 * shape as scripts/style-triptych-sheet.js and it is not the fix — it is the
 * hole, demonstrated. It is kept small on purpose so the tool, when it is
 * built, is not built by copying this.
 *
 * WHAT IS REUSED, AND WHY IT MATTERS:
 *   - `slice()` from vectorize.js does the cutting — it finds the REAL gutters
 *     rather than cutting at exact halves, and reports the seams it could not
 *     find (a missed seam falls back to the midpoint).
 *   - The grid clause is `HOUSE.grid(2, 2)` from vector.js, verbatim. Its
 *     "wide clean white gutters" and "nothing crossing or touching between the
 *     cells" are load-bearing: the sheet is cut on a straight line, so a
 *     drawing that leans into its neighbour loses a limb.
 *   - The two style recipes are COPIES of the ones in
 *     scripts/style-triptych-sheet.js — keep them identical, or a picture made
 *     here stops being comparable with the style pages already on the shelf.
 *
 * A SOLO run (one cell) takes vector.js's `single` clause instead of the grid,
 * because asking for a grid and describing one cell fills the rest with
 * invented filler.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');
const { slice } = require('../vectorize');

const ROOT = path.join(__dirname, '..');
const SPEC = path.join(ROOT, 'docs', 'pipeline-walkthrough.json');
const OUT = path.join(ROOT, 'out', 'pipeline-walkthrough');
const MODEL = 'gpt-image-2';
const SIZE = '1024x1536';
const COST = { low: 0.02, medium: 0.06, high: 0.25 };

// Verbatim from vector.js HOUSE — do not drift this wording.
const GRID = 'A 2x2 grid of four completely separate small illustrations on a plain white '
  + 'background. Wide clean white gutters between them, each drawing sitting well inside its '
  + 'own quarter, nothing crossing or touching between the cells, no grid lines, no borders, '
  + 'no frames.';
const SINGLE = 'ONE small illustration, centred on a plain white background with clean white '
  + 'space all around it, no grid, no borders, no frames.';

// COPIES of scripts/style-triptych-sheet.js's STYLES — move both together.
const STYLES = {
  watercolor: {
    label: 'Watercolor — sage sandy mirror',
    refs: [{ file: 'sage-sandy-mirror.png', type: 'image/png' }],
    prefix: 'Use only the style of the attached style reference and ignore its '
      + 'content — do not copy anything depicted in it. You can choose your own '
      + 'colors rather than copying the colors of the style reference.',
    suffix: 'Do not include any text in the image.',
  },
  pastel: {
    label: 'Pastel — Witch School house',
    storageRefs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    prefix: 'Use the attached images ONLY as a STYLE reference for the linework: '
      + 'bold confident black ink outlines, flat colors with NO gradients and minimal '
      + 'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, '
      + 'on a plain white background, playful modern editorial illustration.',
    suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
    whiten: true,
  },
};

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const arg = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!arg || arg === '--list') {
  spec.runs.forEach((r) => console.log(`${r.id.padEnd(10)} ${r.style.padEnd(11)} ${r.quality.padEnd(7)} `
    + `${r.cells.length} cell(s)  ~$${(COST[r.quality] || 0).toFixed(2)}  ${r.what}`));
  process.exit(0);
}
const run = spec.runs.find((r) => r.id === arg);
if (!run) { console.error(`no run "${arg}" — try --list`); process.exit(1); }
const st = STYLES[run.style];
if (!st) { console.error(`no style "${run.style}"`); process.exit(1); }

/** The literal text sent, assembled the one way. Position labels only when
 *  there is a grid to place things in. */
function assemble(r) {
  const solo = r.cells.length === 1;
  const body = solo
    ? r.cells[0].text
    : r.cells.map((c) => `${c.at}: ${c.text.replace(/\.$/, '')}.`).join(' ');
  return `${st.prefix}\n\n${solo ? SINGLE : GRID} ${body}\n\n${st.suffix}`;
}

let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  bucket = admin.storage().bucket();
}

const refCache = new Map();
async function refBuffers() {
  if (st.storageRefs) {
    const bufs = [];
    for (const p of st.storageRefs) {
      if (!refCache.has(p)) refCache.set(p, (await bucket.file(p).download())[0]);
      bufs.push(refCache.get(p));
    }
    return bufs.map((b, i) => ({ buf: b, name: `ref${i + 1}.png`, type: 'image/png' }));
  }
  return st.refs.map((r, i) => ({
    buf: fs.readFileSync(path.join(ROOT, 'refs', r.file)),
    name: `ref${i + 1}${path.extname(r.file)}`, type: r.type,
  }));
}

// VERBATIM from server.js whitenBackground — the pastel style's flood-fill pass.
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
  return sharp(out, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}

async function generate(prompt, refs, quality) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', quality);
  form.append('output_format', 'png');    // PNG so the cut is lossless; cells go out as webp
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
  const prompt = assemble(run);
  console.log(`${run.id} · ${st.label} · ${MODEL} · ${SIZE} · quality=${run.quality} · ~$${COST[run.quality].toFixed(2)}\n`);
  if (DRY) { console.log(prompt); return; }

  initFirebase();
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();

  // The sheet is written to disk BEFORE any upload, so a failure downstream
  // never costs a re-render.
  const sheetPath = path.join(OUT, `${run.id}__sheet.png`);
  let sheet;
  if (fs.existsSync(sheetPath)) {
    sheet = fs.readFileSync(sheetPath);
    console.log(`  reusing the sheet already on disk (${Math.round(sheet.length / 1024)}KB) — nothing spent`);
  } else {
    sheet = await generate(prompt, await refBuffers(), run.quality);
    if (st.whiten) { try { sheet = await whitenBackground(sheet); } catch (e) { console.warn('  whiten failed:', e.message); } }
    fs.writeFileSync(sheetPath, sheet);
    console.log(`  sheet ${Math.round(sheet.length / 1024)}KB in ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  const solo = run.cells.length === 1;
  const sheetUrl = await upload(await sharp(sheet).webp({ quality: 92 }).toBuffer(),
    `pipeline-walkthrough/${run.id}__sheet.webp`);

  let cells = [sheet], report = { missed: 0, x: [], y: [] };
  if (!solo) { cells = await slice(sheet, 2, 2); report = cells.report; }
  if (!solo) {
    console.log(`  cut x=[${report.x}] y=[${report.y}]`
      + (report.missed ? `  ⚠ ${report.missed} seam(s) MISSED → midpoint` : '  · every seam found on a real gutter'));
  }

  const items = [];
  for (let i = 0; i < run.cells.length; i++) {
    const c = run.cells[i];
    const web = await sharp(cells[i]).webp({ quality: 92 }).toBuffer();
    const meta = await sharp(cells[i]).metadata();
    fs.writeFileSync(path.join(OUT, `${run.id}__${c.id}.webp`), web);
    const url = await upload(web, `pipeline-walkthrough/${run.id}__${c.id}.webp`);
    items.push({
      run: run.id, round: run.round, cell: c.id, label: c.label, at: c.at || null,
      style: run.style, styleLabel: st.label, quality: run.quality, model: MODEL,
      sheetSize: SIZE, cellSize: `${meta.width}x${meta.height}`, fromSheet: !solo,
      sheetUrl, seamsMissed: report.missed,
      refs: st.storageRefs || st.refs.map((r) => r.file),
      promptStyle: `${st.prefix}\n\n${solo ? SINGLE : GRID}\n\n`
        + `[content — ${solo ? 'this whole picture' : `this cell is the ${c.at} quarter of a 2x2 sheet`}]\n\n${st.suffix}`,
      promptContent: solo ? c.text : `${c.at}: ${c.text}`,
      fullPrompt: prompt, url, bytes: web.length, createdAt: Date.now(),
    });
    console.log(`     ${(c.at || 'solo').padEnd(13)} ${c.id.padEnd(9)} ${meta.width}x${meta.height}  ${Math.round(web.length / 1024)}KB`);
  }

  const mf = path.join(OUT, `manifest-${run.id}.json`);
  fs.writeFileSync(mf, JSON.stringify(items, null, 1));
  console.log(`\n  ${items.length} picture(s) · ${mf}`);
  console.log(`  each one cost ~${(COST[run.quality] / run.cells.length * 100).toFixed(2)}¢`);
})().catch((e) => { console.error(e); process.exit(1); });

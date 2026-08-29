// Draw a panels SHEET in a CHAT'S OWN CONTAINER, cut it, upload it — the
// path CLAUDE.md's "THE FEED IS HERS" rule sends chat work down (2026-08-28,
// Sophie: "The playground is for me that's why it's called the playground").
//
// Two reasons it exists rather than POSTing /api/promptlab:
//   • a run started there lands in HER Playground feed, which is hers;
//   • Render restarts on every deploy, and a restart mid-generation loses the
//     paid sheet outright — measured 2026-08-28, ~$1.75 of 4K sheets gone in
//     one evening. This box shares nothing with that one.
//
// It is deliberately NOT a second recipe: the geometry is sheet-grid.js, the
// prompt halves are the live /api/promptlab/styles, and the cut is cutSheet's
// own findSeams/seamBoxes. Only the plumbing is local.
//
//   node scripts/draw-panel-sheet.js job.json
//
// job.json: { shape:'portrait'|'square', grid:2|4|6|9, tier:'1k'|'2k'|'4k',
//             quality:'low'|'medium'|'high', panels:[…], cast:[{name,description}] }
// Writes <job>.out.json with the sheet url, the cut urls, the plan and the
// exact full prompt — file those with the label, the MODEL · QUALITY · SIZE
// caption and both prompt halves, per the deliver-images ritual.
// It also files the DONE run into the Playground's PANELS tab by itself
// (POST /api/promptlab/panels-import — 2026-08-28, Sophie: "the playground
// is for me, but panels should go in panels"); pass `chat` in job.json so
// the record says who drew it.
//
// Needs OPENAI_API_KEY and FIREBASE_SERVICE_ACCOUNT (Deck Factory) in the
// environment, and `npm install sharp form-data node-fetch@2 firebase-admin`.
// locally with the server's own image-aware seam finder, upload to Storage.
const fs = require('fs'), path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const sharp = require('sharp');
const sheetGrid = require('/home/user/imageforge/sheet-grid.js');

const REPO = '/home/user/imageforge';
const KEY = process.env.OPENAI_API_KEY;

function initFb() {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc),
    storageBucket: `${svc.project_id}.firebasestorage.app` });
  return admin.storage().bucket();
}
async function save(bucket, buf, dir) {
  const name = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const f = bucket.file(name);
  await f.save(buf, { contentType: 'image/webp', resumable: false });
  await f.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${name}`;
}
async function edits(prompt, refs, { quality, size }) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('output_format', 'webp');
  form.append('moderation', 'low');
  refs.forEach((b, i) => form.append('image[]', b, { filename: `ref${i + 1}.jpg`, contentType: 'image/jpeg' }));
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, ...form.getHeaders() },
    body: form, timeout: 900000 });
  const j = await r.json();
  if (!r.ok || !j.data || !j.data[0]) throw new Error(JSON.stringify(j).slice(0, 400));
  return { buf: Buffer.from(j.data[0].b64_json, 'base64'), usage: j.usage };
}
async function cut(buf, plan) {
  sharp.cache(false);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== plan.W || info.height !== plan.H)
    throw new Error(`sheet came back ${info.width}x${info.height}, wanted ${plan.sheet}`);
  const gray = new Uint8Array(info.width * info.height);
  for (let i = 0, p = 0; i < gray.length; i++, p += info.channels)
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  const seams = sheetGrid.findSeams(gray, info.width, info.height, plan.across, plan.down);
  const rects = sheetGrid.seamBoxes(seams.xs, seams.ys, info.width, info.height);
  const raw = { width: info.width, height: info.height, channels: info.channels };
  const out = [];
  for (const r of rects) out.push(await sharp(data, { raw }).extract(r).webp({ lossless: true }).toBuffer());
  return out;
}
(async () => {
  const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const styles = await (await fetch('https://imageforge-q125.onrender.com/api/promptlab/styles')).json();
  const st = styles.styles.dreamy, res = styles.res;
  const plan = sheetGrid.sheetFor(job.shape, job.grid, job.tier, res);
  const tail = sheetGrid.applySheet(st.suffix, st.sheet, sheetGrid.layoutWords(job.grid));
  const cast = sheetGrid.castRows(job.cast);
  const castTxt = sheetGrid.castBlock(cast);
  const block = sheetGrid.panelBlock(job.grid, job.panels);
  const body = castTxt ? `${castTxt}\n\n${block}` : block;
  // job.full re-sends an EXACT prompt (e.g. one Sophie already ran with her
  // own edited prefix/tail) verbatim, rather than rebuilding it from the
  // house halves — a rebuild can differ by a clause she deliberately cut.
  const full = job.full || `${st.prefix}\n\n${body}\n\n${tail}`;
  fs.writeFileSync(`${process.argv[2]}.prompt.txt`, full);
  console.log('sheet', plan.sheet, 'cell', plan.cell);
  const ref = fs.readFileSync(path.join(REPO, 'refs', 'dream-mystery.jpg'));
  const { buf, usage } = await edits(full, [ref], { quality: job.quality, size: plan.sheet });
  const bucket = initFb();
  const sheetUrl = await save(bucket, buf, 'panels/sheets');
  console.log('SHEET', sheetUrl);
  const cuts = await cut(buf, plan);
  const urls = [];
  for (const c of cuts) urls.push(await save(bucket, c, 'panels/cuts'));
  fs.writeFileSync(`${process.argv[2]}.out.json`,
    JSON.stringify({ sheetUrl, urls, plan, full, usage, job }, null, 1));
  urls.forEach((u, i) => console.log(i + 1, u));
  // File the DONE run into the Playground's PANELS tab (2026-08-28, Sophie:
  // "the playground is for me, but panels should go in panels") — a record
  // only, no generation and no cut on Render. Best-effort: the sheet is
  // already banked and filed above, so a failed import loses nothing but the
  // tab entry; re-run the POST by hand from the .out.json if it prints FAILED.
  try {
    const r = await fetch('https://imageforge-q125.onrender.com/api/promptlab/panels-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // urls are one per CELL in reading order; panels map to the leading
        // cells, so the pairing is exact and a trailing filler cut stays out.
        panels: job.panels, images: urls.slice(0, job.panels.length),
        grid: { across: plan.across, down: plan.down },
        style: 'dreamy', quality: job.quality, res: job.tier,
        size: plan.sheet, aspectRatio: job.shape === 'square' ? '1:1' : '2:3',
        sheetUrl, fullPrompt: full, cast: sheetGrid.castRows(job.cast),
        chat: job.chat || process.env.FORGE_CHAT || '',
      }),
    });
    const j = await r.json().catch(() => ({}));
    console.log(j.ok ? `panels tab: run ${j.id}` : `panels-import FAILED: ${j.error || r.status}`);
  } catch (e) { console.log('panels-import FAILED:', e.message); }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });

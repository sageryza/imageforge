#!/usr/bin/env node
// Draw the panel sheets from THIS container (the server's cut step was
// OOM-killing the 512MB box), using the exact served Dreamy recipe and the
// repo's own sheet-grid for geometry + image-aware seams. Files the runs
// into forge-promptlab and My Creations exactly as the server would.
// Usage: node docs/science-reel/draw-local.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
sharp.cache(false);
const admin = require('firebase-admin');
const sheetGrid = require(path.join(__dirname, '..', '..', 'sheet-grid'));
const sizeTier = require(path.join(__dirname, '..', '..', 'size-tier'));
const promptRecord = require(path.join(__dirname, '..', '..', 'prompt-record'));

const HERE = __dirname;
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'beats.json'), 'utf8'));
const OUT = path.join(HERE, 'runs.json');
const runs = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];

const DECK_SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const MEM_SA = JSON.parse(process.env.STORY_FIREBASE_SERVICE_ACCOUNT);
const GALLERY_UID = process.env.GALLERY_UID;
const deck = admin.initializeApp({ credential: admin.credential.cert(DECK_SA), storageBucket: 'deckfactory-43176.firebasestorage.app' }, 'deck');
const mem = admin.initializeApp({ credential: admin.credential.cert(MEM_SA) }, 'mem');

// Served recipe — the ONE copy of the style text (never hand-copied).
const styles = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-imageforge/18a88ccf-db73-59f9-b512-91c9583c81df/scratchpad/styles.json', 'utf8'));
const st = styles.styles.dreamy;
const resTable = styles.res;
const GRID = 4, SHAPE = 'portrait', TIER = '4k', QUALITY = 'medium';
const geo = sheetGrid.sheetFor(SHAPE, GRID, TIER, resTable);
const REF = fs.readFileSync(path.join(HERE, '..', '..', 'refs', 'dream-mystery.jpg'));

function buildPrompt(panels) {
  const head = st.prefix.trim();
  const tail = sheetGrid.applySheet(st.suffix, st.sheet, sheetGrid.layoutWords(GRID));
  const block = sheetGrid.panelBlock(GRID, panels);
  return `${head}${head ? '\n\n' : ''}${block}${tail ? `\n\n${tail}` : ''}`;
}

async function upload(buf, prefix) {
  const bucket = deck.storage().bucket();
  const name = `${prefix}/${crypto.randomBytes(12).toString('hex')}.webp`;
  await bucket.file(name).save(buf, { metadata: { contentType: 'image/webp' } });
  await bucket.file(name).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${name}`;
}

async function draw(fullPrompt) {
  for (let a = 0; a < 3; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', fullPrompt);
      form.append('size', geo.sheet);
      form.append('quality', QUALITY);
      form.append('output_format', 'webp');
      form.append('moderation', 'low');
      form.append('image[]', new Blob([REF], { type: 'image/jpeg' }), 'ref1.jpg');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const b64 = data.data && data.data[0] && data.data[0].b64_json;
      if (!b64) throw new Error('no image in answer');
      return { buf: Buffer.from(b64, 'base64'), usage: data.usage || null };
    } catch (e) {
      console.warn(`draw attempt ${a + 1}: ${e.message}`);
      if (a === 2) throw e;
      await new Promise((r) => setTimeout(r, 5000 * (a + 1)));
    }
  }
}

async function cut(sheetBuf) {
  let img = sharp(sheetBuf);
  const meta = await img.metadata();
  if (meta.width !== geo.W || meta.height !== geo.H) {
    console.warn(`sheet came back ${meta.width}x${meta.height}, wanted ${geo.sheet} — resizing`);
    img = sharp(await img.resize(geo.W, geo.H, { fit: 'fill' }).webp({ lossless: true }).toBuffer());
  }
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const gray = new Uint8Array(info.width * info.height);
  for (let i = 0, p = 0; i < gray.length; i++, p += info.channels) {
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  const seams = sheetGrid.findSeams(gray, info.width, info.height, geo.across, geo.down);
  const rects = sheetGrid.seamBoxes(seams.xs, seams.ys, info.width, info.height);
  const raw = { width: info.width, height: info.height, channels: info.channels };
  const bufs = [];
  for (const r of rects) bufs.push(await sharp(data, { raw }).extract(r).webp({ lossless: true }).toBuffer());
  return { bufs, rects };
}

async function fileCreation(doc) {
  const col = mem.firestore().collection('users').doc(GALLERY_UID).collection('creations');
  const dup = await col.where('url', '==', doc.url).limit(1).get();
  if (!dup.empty) return;
  await col.add(doc);
}

async function recordRun({ beats4, panels, fullPrompt, sheetUrl, urls, rects, usage }) {
  const db = deck.firestore();
  const ref = db.collection('forge-promptlab').doc();
  await ref.set({
    id: ref.id, status: 'done', engine: 'gptimage', prompt: panels.join('\n'),
    fullPrompt, model: 'gpt-image-2', gptStyle: 'dreamy', quality: QUALITY,
    size: geo.sheet, aspectRatio: geo.aspectRatio, res: TIER,
    promptEdited: false, noText: false, styleRef: (st.refs || []).join(','),
    outputs: 1, character: false, photoRef: '', images: urls,
    panels, grid: { across: geo.across, down: geo.down, count: geo.count },
    sheet: geo.sheet, cell: geo.cell, sheetUrl,
    ...(usage ? { usage: [usage] } : {}),
    createdAt: admin.firestore.Timestamp.now(),
  });
  const style = `${st.label} · ${QUALITY}`;
  const cutSlot = sizeTier.cutSize(geo.sheet, geo.count);
  const base = { model: 'gpt-image-2', quality: QUALITY, style, source: 'playground' };
  const mk = (extra) => ({
    type: 'image', stickers: null, createdAt: admin.firestore.Timestamp.now(), ...base, ...extra,
  });
  await fileCreation(mk({
    url: sheetUrl, prompt: `the sheet — ${geo.count} panels`, canvas: geo.sheet,
    ...promptRecord.promptFields({ full: fullPrompt, content: panels.join('\n') }),
  }));
  for (let i = 0; i < urls.length; i++) {
    const seamAt = fullPrompt.indexOf(panels[i]);
    const prefix = seamAt >= 0 ? fullPrompt.slice(0, seamAt).trim() : st.prefix;
    const suffix = seamAt >= 0 ? fullPrompt.slice(seamAt + panels[i].length).trim() : '';
    const r = rects && rects[i];
    await fileCreation(mk({
      url: urls[i], prompt: panels[i],
      canvas: r ? `${r.width}x${r.height}` : geo.cell, size: cutSlot,
      ...promptRecord.promptFields({ full: fullPrompt, content: panels[i], prefix, suffix }),
    }));
  }
  return ref.id;
}

async function doSheet(i, group, reuse) {
  const panels = group.map((b) => b.prompt);
  const fullPrompt = reuse ? reuse.fullPrompt : buildPrompt(panels);
  let sheetBuf, sheetUrl, usage = null;
  if (reuse) {
    console.log(`sheet ${i}: reusing banked sheet ${reuse.sheetUrl}`);
    sheetUrl = reuse.sheetUrl;
    sheetBuf = Buffer.from(await (await fetch(sheetUrl)).arrayBuffer());
  } else {
    console.log(`sheet ${i}: drawing…`);
    const d = await draw(fullPrompt);
    sheetBuf = d.buf; usage = d.usage;
    sheetUrl = await upload(sheetBuf, 'promptlab');
    console.log(`sheet ${i}: banked ${sheetUrl}`);
  }
  const { bufs, rects } = await cut(sheetBuf);
  const urls = [];
  for (const b of bufs) urls.push(await upload(b, 'promptlab'));
  const runId = await recordRun({ beats4: group.map((b) => b.n), panels, fullPrompt, sheetUrl, urls, rects, usage });
  console.log(`sheet ${i}: DONE run ${runId}`);
  return { sheet: i, id: runId, beats: group.map((b) => b.n), images: urls, sheetUrl, fullPrompt, usage, rects };
}

(async () => {
  // sheet 0's paid sheet is banked on the stuck server run — reuse it
  const stuck = await (await fetch('https://imageforge-q125.onrender.com/api/promptlab/wtf08daggKM7DJW3XOBJ')).json();
  const groups = [];
  for (let i = 0; i < plan.beats.length; i += 4) groups.push(plan.beats.slice(i, i + 4));
  // sanity: my locally built prompt must equal the server's own for sheet 0
  const mine = buildPrompt(groups[0].map((b) => b.prompt));
  if (stuck.fullPrompt && stuck.fullPrompt !== mine) {
    console.warn('NOTE: local prompt differs from server sheet-0 prompt — using the server one for the banked sheet');
  }
  for (let i = 0; i < groups.length; i++) {
    if (runs.find((r) => r.sheet === i)) { console.log(`sheet ${i}: already done`); continue; }
    const reuse = (i === 0 && stuck.sheetUrl) ? { sheetUrl: stuck.sheetUrl, fullPrompt: stuck.fullPrompt || mine } : null;
    const done = await doSheet(i, groups[i], reuse);
    runs.push(done);
    fs.writeFileSync(OUT, JSON.stringify(runs, null, 1));
  }
  console.log('ALL SHEETS DONE');
  process.exit(0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });

#!/usr/bin/env node
/**
 * Upload a nde-watercolor.py output folder to Storage and file every image into
 * a chat's Assets tab — label, model·quality caption, and the EXACT prompt split
 * into its style half and its content half (never a paraphrase; see CLAUDE.md).
 *
 *   node scripts/nde-file-watercolor.js <outdir> <labels.json> [--chat <slug>] [--prefix nde-watercolor/cards]
 *
 * labels.json: { "<image id>": "the Assets-tab label", ... }
 * <outdir> must contain the images plus the prompts.json the renderer wrote.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const outdir = args[0];
const labelsFile = args[1];
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CHAT = flag('chat', 'nde-illustration-montages');
const PREFIX = flag('prefix', 'nde-watercolor');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const BUCKET = 'deckfactory-43176.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  storageBucket: BUCKET,
});

// The renderer sends style-prefix + likeness + "Draw: <scene>". The Assets overlay
// wants that split at the seam, so the style half keeps every word actually sent
// and marks where the scene went.
function splitPrompt(rec) {
  const sent = rec.prompt;
  const i = sent.indexOf('Draw: ');
  const head = i >= 0 ? sent.slice(0, i) : sent;
  const scene = i >= 0 ? sent.slice(i + 'Draw: '.length) : '';
  const refs = rec.refs.map((r) => path.basename(r)).join(', ');
  const style = `${head}Draw: [content]\n\n— attached, in order: ${refs} · gpt-image-2 edits endpoint · ${rec.size} · quality ${rec.quality}`;
  return { style, content: scene };
}

(async () => {
  const recs = JSON.parse(fs.readFileSync(path.join(outdir, 'prompts.json'), 'utf8'))
    .filter((r) => r.file);
  const labels = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
  const bucket = admin.storage().bucket();
  const items = [];

  for (const rec of recs) {
    const dest = `${PREFIX}/${rec.id}.webp`;
    await bucket.upload(rec.file, {
      destination: dest,
      metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    });
    await bucket.file(dest).makePublic();
    const url = `https://storage.googleapis.com/${BUCKET}/${dest}`;
    const label = labels[rec.id] || rec.id;
    // The caption is the tile's model · quality line, and it must come off the
    // render record — a hardcoded string silently mislabels the moment a batch
    // runs at a different quality.
    const caption = `gpt-image-2 · ${rec.quality}`;
    items.push({ ...splitPrompt(rec), url, label, caption, id: rec.id });
    console.log(`  up  ${rec.id} → ${url}`);
  }

  // One asset record per image: label + the model·quality caption.
  for (const it of items) {
    const r = await fetch(`${BASE}/api/gallery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        assetsOnly: true, chat: CHAT, url: it.url,
        description: it.label, prompt: it.caption,
      }),
    });
    console.log(`  tile ${it.id}: ${r.status}`);
  }

  // Then the exact prompt split, batched.
  const r = await fetch(`${BASE}/api/gallery/assets/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat: CHAT,
      items: items.map((it) => ({ url: it.url, style: it.style, content: it.content })),
    }),
  });
  console.log('  prompts:', r.status, (await r.text()).slice(0, 300));

  fs.writeFileSync(path.join(outdir, 'filed.json'), JSON.stringify(items, null, 1));
  console.log(`\n${items.length} filed into "${CHAT}"`);
})().catch((e) => { console.error(e); process.exit(1); });

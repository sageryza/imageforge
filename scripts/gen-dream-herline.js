#!/usr/bin/env node
/**
 * gen-dream-herline.js — the RAW TEXT style clause with SOPHIE'S OWN LINE in
 * place of the long anti-grid paragraph (her note on the Assets image,
 * 2026-08-17: "render as a single image not a grid not split panels").
 *
 * The experiment it continues lives in the dream-feed-art chat's Assets tab:
 * the whole dream typed straight into the prompt as [content], drawn twice —
 * once against refs/dream-mystery.jpg, once against refs/sage-sandy-mirror.png.
 * Only the SECOND PARAGRAPH of the style clause changes here. Before:
 *
 *   Draw: [content] Render as ONE single full-bleed illustration — a single
 *   image, NOT a grid, NOT split panels, no borders, no caption boxes, no text
 *   or lettering anywhere.
 *
 * After — her words, with punctuation added (she said punctuation was fine):
 *
 *   Draw: [content] — render as a single image, not a grid, not split panels.
 *
 * The two refs keep their OWN opening paragraph, exactly as the originals were
 * sent — they were never worded the same, and re-wording one would stop the
 * pair being comparable to what is already in the tab.
 *
 * STRICTLY ONE RUN AT A TIME (CLAUDE.md: parallel image batches have restarted
 * the 512MB box). ~4.2¢ per run at 1024x1024 medium.
 *
 *   node scripts/gen-dream-herline.js
 *
 * ENV: OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT (Deck Factory).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const BUCKET = 'deckfactory-43176.firebasestorage.app';
// Her dream text is NOT committed — this repo is public. It is read back from
// the content half already filed on the original RAW TEXT tile, which is the
// same 5,372 characters that run sent.
const SOURCE_CHAT = 'dream-feed-art';
const SOURCE_URL = `https://storage.googleapis.com/${BUCKET}/dream-feed/raw-text/halloween-raw-dream.webp`;
const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');

// Her line, verbatim, punctuated.
const HER = 'Draw: [content] — render as a single image, not a grid, not split panels.';

const RUNS = [
  {
    id: 'halloween-herline-dream',
    ref: 'refs/dream-mystery.jpg',
    refName: 'dream mystery',
    intro: 'The FIRST attached image is a STYLE reference — copy its drawing style, linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its content, subjects, or composition.',
    tail: '(attached style ref: refs/dream-mystery.jpg — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)',
  },
  {
    id: 'halloween-herline-sage',
    // The 8.5MB PNG is over the edits endpoint's comfort; the committed 1600px
    // jpg is the same page and is what the original run attached too.
    ref: 'refs/sage-sandy-mirror-1600.jpg',
    refName: 'sage sandy mirror',
    intro: 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.',
    tail: '(attached style ref: refs/sage-sandy-mirror.png — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)',
  },
];

// What goes in the PROMPT overlay's style half: the clause as written, with
// [content] marking the seam (CLAUDE.md — the exact text, never a paraphrase).
const styleClause = (r) => `${r.intro}\n\n${HER}\n\n${r.tail}`;
// What is actually sent: the same thing with her dream substituted in.
const fullPrompt = (r, content) => `${r.intro}\n\n${HER.replace('[content]', content)}`;

async function dreamText() {
  const res = await fetch(`${BASE}/api/gallery/assets?chat=${SOURCE_CHAT}&limit=200`);
  const { assets = [] } = await res.json();
  const hit = assets.find((a) => a.url === SOURCE_URL || (a.alts || []).includes(SOURCE_URL));
  const text = hit && hit.promptContent;
  if (!text) throw new Error('the original RAW TEXT tile has no content half to read the dream from');
  return text;
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  storageBucket: BUCKET,
});
const bucket = admin.storage().bucket();

async function draw(r, content) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', fullPrompt(r, content));
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('output_format', 'webp');
  form.append('output_compression', '80');
  form.append('image[]', fs.readFileSync(path.join(ROOT, r.ref)), {
    filename: path.basename(r.ref),
    contentType: r.ref.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
  });
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form,
    timeout: 300000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  const dest = `dream-feed/raw-text/${r.id}.webp`;
  const file = bucket.file(dest);
  await file.save(Buffer.from(b64, 'base64'), { contentType: 'image/webp', resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${BUCKET}/${dest}`;
}

(async () => {
  const CONTENT = await dreamText();
  const out = [];
  for (const r of RUNS) {                     // one at a time, deliberately
    process.stdout.write(`drawing ${r.id} … `);
    const t = Date.now();
    try {
      const url = await draw(r, CONTENT);
      console.log(`${url}  (${Math.round((Date.now() - t) / 1000)}s)`);
      out.push({ ...r, url, style: styleClause(r), created: Date.now() });
    } catch (e) {
      console.log('FAILED ' + e.message);
      out.push({ ...r, error: e.message });
    }
  }
  console.log(JSON.stringify(out, null, 2));
  console.log('done');
})();

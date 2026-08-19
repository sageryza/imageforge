#!/usr/bin/env node
/**
 * gen-dream-herline.js — the RAW TEXT experiment: a dream typed into the prompt
 * VERBATIM as [content], with Sophie's own anti-grid line as the style clause's
 * second paragraph (her note on the Assets image, 2026-08-17: "render as a
 * single image not a grid not split panels").
 *
 * THE FORMULA. Every run here is the same three paragraphs — the ref's own
 * opening line, then:
 *
 *   Draw: [content] — render as a single image, not a grid, not split panels.
 *
 * (her words, punctuated; it replaced the much longer "Render as ONE single
 * full-bleed illustration — a single image, NOT a grid, NOT split panels, no
 * borders, no caption boxes, no text or lettering anywhere.") The two refs keep
 * their OWN opening paragraph exactly as the originals were sent — they were
 * never worded the same, and re-wording one would stop the tiles being
 * comparable to what is already in the dream-feed-art tab.
 *
 * WHAT [content] IS. The dream's OWN WORDS, never an illustration idea written
 * for it. That is the whole question the experiment asks: the live dream feed
 * has a model pick one moment and fold the rest in (movies.js dreamImagePlan),
 * and this asks what the raw transcript does on its own.
 *
 * SOURCES. Neither dream is committed — this repo is public.
 *   --dream <forge-dreamapp doc id>   the dream feed's own text, read live
 *   (default)                         the long Halloween dream, read back from
 *                                     the content half already filed on the
 *                                     original RAW TEXT tile
 *
 * VARIANTS (--variant):
 *   one       her line, as above (default)
 *   amorphous her follow-up note, 2026-08-19: "wonder if we could do panels but
 *             not have them squares and just have like amorphous shapes for
 *             panels?"
 *
 * STRICTLY ONE RUN AT A TIME (CLAUDE.md: parallel image batches have restarted
 * the 512MB box). ~4.2¢ per run at 1024x1024 medium.
 *
 *   node scripts/gen-dream-herline.js [--dream <id>] [--variant one|amorphous]
 *                                     [--ref dream|sage|both] [--slug <name>]
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
const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');
const SOURCE_CHAT = 'dream-feed-art';
const SOURCE_URL = `https://storage.googleapis.com/${BUCKET}/dream-feed/raw-text/halloween-raw-dream.webp`;

// The second paragraph — the only thing that varies between variants.
const VARIANTS = {
  one: 'Draw: [content] — render as a single image, not a grid, not split panels.',
  amorphous: 'Draw: [content] — lay it out as panels, but not squares: amorphous, irregular shapes, no grid, no straight borders.',
};

const REFS = {
  dream: {
    key: 'dream',
    file: 'refs/dream-mystery.jpg',
    name: 'dream mystery',
    intro: 'The FIRST attached image is a STYLE reference — copy its drawing style, linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its content, subjects, or composition.',
    tail: '(attached style ref: refs/dream-mystery.jpg — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)',
  },
  sage: {
    key: 'sage',
    // The 8.5MB PNG is over the edits endpoint's comfort; the committed 1600px
    // jpg is the same page and is what the original run attached too.
    file: 'refs/sage-sandy-mirror-1600.jpg',
    name: 'sage sandy mirror',
    intro: 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.',
    tail: '(attached style ref: refs/sage-sandy-mirror.png — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)',
  },
};

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// What the PROMPT overlay's style half shows: the clause as written, [content]
// marking the seam (CLAUDE.md — the exact text, never a paraphrase).
const styleClause = (r, para) => `${r.intro}\n\n${para}\n\n${r.tail}`;
// What is actually sent: the same thing with the dream substituted in.
const fullPrompt = (r, para, content) => `${r.intro}\n\n${para.replace('[content]', content)}`;

async function halloweenText() {
  const res = await fetch(`${BASE}/api/gallery/assets?chat=${SOURCE_CHAT}&limit=200`);
  const { assets = [] } = await res.json();
  const hit = assets.find((a) => a.url === SOURCE_URL || (a.alts || []).includes(SOURCE_URL));
  if (!hit || !hit.promptContent) throw new Error('the original RAW TEXT tile has no content half to read the dream from');
  return { text: hit.promptContent, title: 'Last-Minute Halloween Party' };
}

async function dreamAppText(id) {
  const snap = await admin.firestore().collection('forge-dreamapp').doc(id).get();
  if (!snap.exists) throw new Error(`no dream ${id}`);
  const v = snap.data();
  if (!v.text) throw new Error(`dream ${id} has no text`);
  return { text: v.text, title: v.title || id };
}

async function draw(r, para, content, slug) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', fullPrompt(r, para, content));
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('output_format', 'webp');
  form.append('output_compression', '80');
  form.append('image[]', fs.readFileSync(path.join(ROOT, r.file)), {
    filename: path.basename(r.file),
    contentType: r.file.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
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
  const dest = `dream-feed/raw-text/${slug}-${r.key}.webp`;
  const file = admin.storage().bucket().file(dest);
  await file.save(Buffer.from(b64, 'base64'), { contentType: 'image/webp', resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${BUCKET}/${dest}`;
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    storageBucket: BUCKET,
  });
  const variant = arg('--variant', 'one');
  const para = VARIANTS[variant];
  if (!para) throw new Error(`unknown variant ${variant} — one of ${Object.keys(VARIANTS).join(', ')}`);
  const which = arg('--ref', 'both');
  const refs = which === 'both' ? [REFS.dream, REFS.sage] : [REFS[which]];
  if (refs.some((r) => !r)) throw new Error(`unknown ref ${which}`);
  const dreamId = arg('--dream', '');
  const { text, title } = dreamId ? await dreamAppText(dreamId) : await halloweenText();
  const slug = arg('--slug', dreamId ? `${dreamId.slice(0, 8)}-${variant}` : `halloween-${variant}`);
  console.log(`"${title}" · ${text.length} chars verbatim · variant ${variant} · ${refs.length} run(s)`);

  const out = [];
  for (const r of refs) {                     // one at a time, deliberately
    process.stdout.write(`drawing ${slug}-${r.key} … `);
    const t = Date.now();
    try {
      const url = await draw(r, para, text, slug);
      console.log(`${url}  (${Math.round((Date.now() - t) / 1000)}s)`);
      out.push({ ref: r.name, refKey: r.key, title, variant, url, style: styleClause(r, para), created: Date.now() });
    } catch (e) {
      console.log('FAILED ' + e.message);
      out.push({ ref: r.name, refKey: r.key, title, variant, error: e.message });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });

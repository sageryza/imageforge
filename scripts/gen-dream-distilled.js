#!/usr/bin/env node
/**
 * gen-dream-distilled.js — draw a dream from its DISTILLED prompt, not from
 * the raw transcript.
 *
 * THE DIFFERENCE FROM gen-dream-herline.js, which is the whole point. That
 * script feeds the dream's transcript to the model VERBATIM and asks the model
 * to cope with the length (the salient clause). This one hands over a prompt a
 * writer already reduced to one situation — Sophie's rule, 2026-08-20: "a
 * prompt that mostly describes the action and doesn't really describe what it
 * looks like, that way the app can make it up itself and doesn't micromanage".
 * The distillations live in `docs/dream-prompts/action-only-v1.json` and each
 * one records who wrote it, because most of them are Claude's sentences rather
 * than the dreamer's.
 *
 * THE STYLE CLAUSE IS THE SAME FORMULA the raw-text runs used, so the two are
 * comparable — the ref's own opening paragraph, then one line that varies:
 *
 *   Draw: [content] — render as a single image, not a grid, not split panels.
 *
 * (her own anti-grid words, 2026-08-17) plus whatever she has asked for on top.
 * `--add` appends her extra sentences to that line VERBATIM and they are what
 * the filed style half shows, so the PROMPT overlay can never disagree with
 * what was sent.
 *
 * RUNS ARE PARALLEL BY DEFAULT, AND THE SERIALIZE RULE DOES NOT APPLY HERE
 * (Sophie, 2026-08-20: "why are you doing them one at a time?" — she was
 * right). CLAUDE.md's "SERIALIZE bulk Playground batches" was measured on the
 * PLAYGROUND, where the 512MB Render box buffers every image and runs the
 * whiten pass, and it restarted under sixteen at once. This script runs in a
 * chat's own container and posts straight to OpenAI: the Render box is not in
 * the loop at all, so five serial runs cost five minutes of her time to avoid
 * a limit that isn't there. `--serial` is kept for the case where it IS the
 * server doing the work. Square 1024x1024 at medium is 5.3¢ a run — the SQUARE
 * canvas is the dear one; the same quality at 1024x1536 is cheaper.
 *
 *   node scripts/gen-dream-distilled.js --title "Choosing a Kitten" \
 *        --add "Minimal text only. Hand-drawn border."
 *   node scripts/gen-dream-distilled.js --titles a.json --add "…"   (a JSON array of titles)
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
const BANK = path.join(ROOT, 'docs/dream-prompts/action-only-v1.json');

// Her anti-grid line, and the ref's own opening paragraph. Both are copied
// from gen-dream-herline.js on purpose — a second wording would stop these
// tiles being comparable with the raw-text ones already in her Assets tab.
const LINE = 'Draw: [content] — render as a single image, not a grid, not split panels.';
const REF = {
  file: 'refs/dream-mystery.jpg',
  name: 'dream mystery',
  intro: 'The FIRST attached image is a STYLE reference — copy its drawing style, linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its content, subjects, or composition.',
  tail: '(attached style ref: refs/dream-mystery.jpg, the full-quality photo 3370x4096 — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)',
};

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The style half exactly as the PROMPT overlay will show it, [content] marking
// the seam; and the text actually sent, which is the same thing with the
// prompt substituted in. One function each so they cannot drift.
const styleClause = (para) => `${REF.intro}\n\n${para}\n\n${REF.tail}`;
const fullPrompt = (para, content) => `${REF.intro}\n\n${para.replace('[content]', content)}`;

async function draw(para, content, dest) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', fullPrompt(para, content));
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('output_format', 'webp');
  // NO output_compression — lossy, applied before the bytes come back, and no
  // later pass can undo it (CLAUDE.md, and scripts/test-no-generation-compression.js
  // greps for it).
  form.append('image[]', fs.readFileSync(path.join(ROOT, REF.file)), {
    filename: path.basename(REF.file),
    contentType: 'image/jpeg',
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
  const bank = JSON.parse(fs.readFileSync(BANK, 'utf8')).prompts;
  const titlesFile = arg('--titles', '');
  const wanted = titlesFile ? JSON.parse(fs.readFileSync(titlesFile, 'utf8')) : [arg('--title', '')];
  const add = arg('--add', '');
  // Her extra sentences ride on the SAME line, so the whole instruction stays
  // one sentence-plus-asides rather than a list the model can rank.
  const para = add ? `${LINE} ${add}` : LINE;
  const tag = arg('--tag', 'distilled');

  const picks = wanted.map((t) => {
    const hit = bank.find((p) => p.title.toLowerCase() === String(t).toLowerCase());
    if (!hit) throw new Error(`no distilled prompt titled "${t}"`);
    return hit;
  });
  console.log(`${picks.length} run(s) · square 1024x1024 · medium · ~5.3¢ each`);
  console.log(`line: ${para}\n`);

  const one = async (p) => {
    const dest = `dream-feed/distilled/${slug(p.title)}-${tag}.webp`;
    const t = Date.now();
    try {
      const url = await draw(para, p.prompt, dest);
      console.log(`  ${Math.round((Date.now() - t) / 1000)}s  ${p.title}`);
      return {
        title: p.title, dreamer: p.dreamer, url, created: Date.now(),
        style: styleClause(para), content: p.prompt, promptBy: p.source,
      };
    } catch (e) {
      console.log(`  FAILED  ${p.title} — ${e.message}`);
      return { title: p.title, error: e.message };
    }
  };
  let out;
  if (process.argv.includes('--serial')) {
    out = [];
    for (const p of picks) out.push(await one(p));
  } else {
    out = await Promise.all(picks.map(one));     // see the header: nothing here is server-side
  }
  const dump = arg('--out', '');
  if (dump) fs.writeFileSync(dump, JSON.stringify(out, null, 1));
  console.log('\n' + JSON.stringify(out.map((o) => ({ title: o.title, url: o.url, error: o.error })), null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });

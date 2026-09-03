#!/usr/bin/env node
// Write a picture's prompt INTO the file (image-meta.js) — for a chat that
// drew in its own container and is about to upload the bytes some other way
// than scripts/post-to-gallery.js (which stamps by itself).
//
//   node scripts/stamp-prompt.js <file> --full "<exact text sent>" \
//     [--style "<wrapper with [content]>"] [--content "<her words>"] \
//     [--model gpt-image-2] [--quality medium] [--size 2K|<WxH>] [--chat <slug>] [--out <file>]
//   node scripts/stamp-prompt.js <file> --read      # print what a file carries
//
// Pixels are untouched (pure container surgery); the file is rewritten in
// place unless --out is given. Exact text only — never a paraphrase.
const fs = require('fs');
const im = require('../image-meta');

const args = process.argv.slice(2);
const isFlag = (a) => /^--/.test(a || '');
const file = args.find((a, i) => !isFlag(a) && !isFlag(args[i - 1]));
const arg = (n) => { const i = args.indexOf('--' + n); return i !== -1 && args[i + 1] !== undefined && !isFlag(args[i + 1]) ? args[i + 1] : undefined; };
if (!file || !fs.existsSync(file)) {
  console.error('usage: stamp-prompt.js <file> --full "…" [--style …] [--content …] [--model …] [--quality …] [--size …] [--chat …] [--out …] | --read');
  process.exit(1);
}
const buf = fs.readFileSync(file);
if (args.includes('--read')) {
  const m = im.read(buf);
  console.log(m ? JSON.stringify(m, null, 2) : '(no prompt in this file)');
  process.exit(0);
}
const canvas = arg('size');
const fields = {
  fullPrompt: arg('full'), promptStyle: arg('style'), promptContent: arg('content'),
  model: arg('model'), quality: arg('quality'), chat: arg('chat'), label: arg('label'),
  size: canvas ? require('../size-tier').captionSize(canvas) : undefined,
  canvas: canvas && /x/.test(canvas) ? canvas : undefined,
  madeAt: new Date().toISOString(),
};
if (!fields.fullPrompt && !fields.promptContent) { console.error('--full (the exact text sent) is required'); process.exit(1); }
const out = im.stamp(buf, fields);
if (out === buf) { console.error('not a webp/png/jpeg this can stamp — file left alone'); process.exit(2); }
fs.writeFileSync(arg('out') || file, out);
console.log(`stamped ${arg('out') || file} (+${out.length - buf.length} bytes, pixels untouched)`);

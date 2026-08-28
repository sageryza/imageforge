#!/usr/bin/env node
// image-size.js — the picture's size from its FIRST BYTES.
//
// Every case here is driven against REAL encoded files made by sharp, not
// hand-written header fixtures: a fixture can only ever prove this file
// agrees with whatever I believed the format was when I wrote both halves.
// The pictures are big and noisy on purpose, so a 4KB read really is a
// truncation and not the whole file by accident.
//
// The measurement this file exists for is checked here too: sharp CANNOT
// read a truncated webp header (and can read a truncated png and jpeg), which
// is why the ranged read parses the container itself. If that ever stops
// being true, this test says so rather than leaving the note in image-size.js
// standing on a stale measurement.
//
//   node scripts/test-image-size.js
const { imageSize, HEADER_BYTES } = require('../image-size');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

let sharp;
try { sharp = require('sharp'); }
catch {
  console.log('SKIP: sharp not installed');
  process.exit(0);
}

// Noise, so nothing compresses down to a file smaller than the read.
function noise(w, h) {
  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < px.length; i++) px[i] = (i * 2654435761) & 255;
  return sharp(px, { raw: { width: w, height: h, channels: 3 } });
}

(async () => {
  // The canvases this repo actually makes: both Playground tiers, the pad's
  // own draw sizes, a phone photo's landscape, and a 1x1 edge case.
  const sizes = [[1024, 1536], [1024, 1024], [2336, 3504], [2880, 2880], [4032, 3024], [1, 1]];
  const formats = ['png', 'webp', 'jpeg'];

  for (const [w, h] of sizes) {
    for (const fmt of formats) {
      const full = await noise(w, h)[fmt](fmt === 'webp' ? { lossless: false } : {}).toBuffer();
      const head = full.subarray(0, Math.min(full.length, HEADER_BYTES));
      const s = imageSize(head);
      ok(s && s.w === w && s.h === h,
        `${fmt} ${w}x${h} read from ${head.length} bytes → ${s ? s.w + 'x' + s.h : 'null'}`);
    }
  }

  // The three webp shapes are three different headers, and only one of them
  // is what an ordinary encode produces — so ask for each explicitly.
  const vp8l = await noise(1024, 1536).webp({ lossless: true }).toBuffer();
  ok(imageSize(vp8l.subarray(0, HEADER_BYTES)) &&
     imageSize(vp8l.subarray(0, HEADER_BYTES)).h === 1536, 'webp VP8L (lossless — what the app stores) reads');
  const vp8 = await noise(1024, 1536).webp({ lossless: false }).toBuffer();
  ok(imageSize(vp8.subarray(0, HEADER_BYTES)) &&
     imageSize(vp8.subarray(0, HEADER_BYTES)).h === 1536, 'webp VP8 (lossy — the derived thumbs) reads');
  // VP8X is the extended container — an alpha channel is the everyday way to
  // get one, and the die-cut stickers in this repo are exactly that.
  const vp8x = await noise(1024, 1024).ensureAlpha().webp({ lossless: false }).toBuffer();
  const gotX = imageSize(vp8x.subarray(0, HEADER_BYTES));
  ok(gotX && gotX.w === 1024 && gotX.h === 1024, 'webp with alpha reads (VP8X or VP8L, whichever it encoded to)');

  // A JPEG with a big colour profile pushes the frame header past any fixed
  // offset — the walk is what handles it, and it is why this isn't a
  // read-at-byte-160.
  const iccJpeg = await noise(1200, 800).withMetadata({ icc: 'p3' }).jpeg().toBuffer();
  const icc = imageSize(iccJpeg.subarray(0, HEADER_BYTES));
  ok(icc && icc.w === 1200 && icc.h === 800, 'jpeg with an ICC profile ahead of the frame still reads');

  // ── never a guess ───────────────────────────────────────────────────
  ok(imageSize(Buffer.alloc(0)) === null, 'nothing in → null out');
  ok(imageSize(null) === null, 'null in → null out');
  ok(imageSize(Buffer.from('not a picture at all, just some words')) === null,
    'a file that is not a picture → null, never a number');
  const png = await noise(64, 64).png().toBuffer();
  ok(imageSize(png.subarray(0, 8)) === null,
    'a header that has not arrived yet → null (8 bytes of a PNG)');
  // An mp4 starts with an ftyp box and must not be mistaken for a RIFF or a
  // JPEG — a clip's poster is an image, a clip is not.
  const mp4ish = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
  ok(imageSize(mp4ish) === null, 'an mp4 is not a picture');

  // ── the measurement this file is built on ───────────────────────────
  // Lossy on purpose — VP8 is a different header from VP8L, and both have
  // to read. (Explicit rather than bare so the no-lossy-generation sweep can
  // tell a deliberate fixture from a generation path.)
  const bigWebp = await noise(2336, 3504).webp({ lossless: false }).toBuffer();
  const bigPng = await noise(2336, 3504).png().toBuffer();
  const bigJpeg = await noise(2336, 3504).jpeg().toBuffer();
  const sharpReads = async (buf) => {
    try { const m = await sharp(buf.subarray(0, HEADER_BYTES)).metadata(); return Boolean(m && m.width); }
    catch { return false; }
  };
  ok(bigWebp.length > HEADER_BYTES && !(await sharpReads(bigWebp)),
    'STILL TRUE: sharp cannot read a truncated webp header — the reason this file exists');
  ok(imageSize(bigWebp.subarray(0, HEADER_BYTES)) !== null,
    'and image-size.js reads that same truncated webp');
  ok((await sharpReads(bigPng)) && (await sharpReads(bigJpeg)),
    'sharp does read truncated png and jpeg (so it is a fine fallback for anything unknown)');

  console.log(failures ? `\n${failures} FAILED` : '\nall good');
  process.exit(failures ? 1 : 0);
})();

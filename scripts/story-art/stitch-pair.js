#!/usr/bin/env node
/**
 * Stitch two pictures side by side into ONE reference image.
 *
 * Sophie's technique (Aug 2026, the El Salvador bar scene): when two existing
 * frames already show the characters the way she wants them, joining them into
 * a single reference carries BOTH likenesses into a new scene more reliably
 * than attaching them as two separate image[] refs — and it costs nothing.
 * The likeness line then just names left and right.
 *
 *   node scripts/story-art/stitch-pair.js <left.webp> <right.webp> <out.png> [height]
 */
const sharp = require('sharp');

const [, , LEFT, RIGHT, OUT, H = '1536'] = process.argv;
if (!LEFT || !RIGHT || !OUT) {
  console.error('usage: stitch-pair.js <left> <right> <out.png> [height]');
  process.exit(1);
}

(async () => {
  const h = Number(H);
  const a = await sharp(LEFT).resize({ height: h }).toBuffer();
  const b = await sharp(RIGHT).resize({ height: h }).toBuffer();
  const am = await sharp(a).metadata();
  const bm = await sharp(b).metadata();
  await sharp({
    create: { width: am.width + bm.width, height: h, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: a, left: 0, top: 0 }, { input: b, left: am.width, top: 0 }])
    .png()
    .toFile(OUT);
  console.log(`stitched ${am.width + bm.width}x${h} -> ${OUT}`);
})();

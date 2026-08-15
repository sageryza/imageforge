#!/usr/bin/env node
/**
 * Room art originals → the display copies public/doors/ serves.
 *
 * The renderer (scripts/nde-watercolor.py) writes 1024x1536 webp at ~1.8MB
 * each. Twenty-one of those is ~38MB, which is neither something to put in a
 * git repo nor something to hand a phone. This writes a width-640 copy of each
 * (~80KB), which is the size the room screen actually paints — the card is at
 * most ~44vh tall, so 640px wide is still over 2x on an iPhone.
 *
 *   node scripts/doors-display-copies.js <srcdir> [<srcdir> ...]
 *
 * The FULL-RESOLUTION originals are never downscaled in place and never
 * deleted — they go to Firebase Storage via scripts/nde-file-watercolor.js,
 * which is also what puts them in the Assets tab. This only ever ADDS smaller
 * copies (the house rule: save full-res first, make small copies as extras).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'public', 'doors');
const WIDTH = 640;
const dirs = process.argv.slice(2);
if (!dirs.length) { console.error('usage: doors-display-copies.js <srcdir> [...]'); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });

(async () => {
  let n = 0;
  let bytes = 0;
  for (const dir of dirs) {
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).sort()) {
      const dest = path.join(OUT, file);
      await sharp(path.join(dir, file))
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(dest);
      const kb = fs.statSync(dest).size;
      bytes += kb;
      n++;
      console.log(`  ${file}  ${Math.round(kb / 1024)}KB`);
    }
  }
  console.log(`\n${n} display copies → public/doors/  (${(bytes / 1048576).toFixed(1)}MB total)`);
})().catch((e) => { console.error(e); process.exit(1); });

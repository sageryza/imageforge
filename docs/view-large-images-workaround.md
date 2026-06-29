# Workaround: "image too large to view" (Read tool rejects media)

**Symptom:** When you try to Read/view a generated image, it fails with something
like `media removed — rejected by API`, or a large (~1MB+) PNG silently won't load.

**Fix:** Downscale each image to a small JPEG thumbnail first, then view the
thumbnail. ~560px wide at quality 72 lands around 30–50KB — small enough to view,
big enough to still judge text legibility and artifacts.

## Steps

1. Install jimp (pure-JS, no native deps, installs fine behind a proxy). Pin 0.22
   so the API below matches:

   ```bash
   cd <your-working-dir>
   npm init -y >/dev/null 2>&1
   npm install jimp@0.22.10 --no-audit --no-fund
   ```

2. Save this as `thumb.js`:

   ```js
   const Jimp = require('jimp');
   const fs = require('fs');
   (async () => {
     for (const f of process.argv.slice(2)) {
       try {
         const img = await Jimp.read(f);
         img.resize(560, Jimp.AUTO).quality(72);
         const out = f.replace(/\.(png|jpe?g|webp)$/i, '') + '.thumb.jpg';
         await img.writeAsync(out);
         console.log(out, img.bitmap.width + 'x' + img.bitmap.height,
                     (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
       } catch (e) { console.log('FAIL', f, e.message); }
     }
   })();
   ```

3. Make thumbnails, then open the resulting `*.thumb.jpg` files with your view tool:

   ```bash
   node thumb.js image1.png image2.png
   ```

## Two gotchas

- **View ONE thumbnail per Read call.** Reading several large images in a single
  call also triggers the rejection — even thumbnails. Batch them one at a time.
- **jimp API differs by version.** This is the v0.22 API
  (`const Jimp = require('jimp')`, `Jimp.read()`, `.resize(w, Jimp.AUTO)`,
  `.quality()`, `.writeAsync()`). jimp v1.x uses `const { Jimp } = require('jimp')`
  and `.resize({ w: 560 })` — so pin `jimp@0.22.10` to avoid surprises.

#!/usr/bin/env node
/*
 * THE SHEET CUT, IN ITS OWN THROWAWAY PROCESS (2026-08-25, Sophie: "that
 * seems insane for such a simple job — consider very different alternatives").
 *
 * The job really is simple — crop N rectangles out of one picture — but the
 * decoded page is what costs: a 4K sheet is ~25-33MB of raw pixels and
 * libvips wants working space around every decode and encode. Done inside
 * server.js that spike rode the same 512MB the whole app lives in, and an
 * overrun OOM-killed the SITE (the 502 crash loop of 2026-08-24). Done here,
 * the server's own memory never grows past reading the finished ~1-3MB webp
 * panels back one at a time, and the worst possible failure is this process
 * dying — the run records a failed cut and the site never notices.
 *
 * The cut itself is the measured lean path from panels.js's history: ONE real
 * decode to a raw buffer with sharp's cache off; the seam scan's grey copy
 * and every crop read that buffer; panels encode straight to files
 * (`toFile`), so the encodes never accumulate in JS. Parent watches the out
 * dir appear file by file for live progress.
 *
 * argv: <sheetFile> <outDir> <planJSON> <skipJSON: [indexes already cut]>
 * writes: panel-<i>.webp per cut + manifest.json
 *   { moved, boxes, panels: [{i, file, box} | {i, error} | null(skipped)],
 *     peakRss } — peakRss is this process's own measured high-water mark, so
 * every real cut keeps proving what it costs (the number that was reasoned
 * about instead of measured is how the OOM shipped).
 */
const fs = require('fs');
const path = require('path');

let peak = 0;
const meter = setInterval(() => {
  const r = process.memoryUsage.rss();
  if (r > peak) peak = r;
}, 40);
meter.unref();

(async () => {
  const [sheetFile, outDir, planStr, skipStr] = process.argv.slice(2);
  const sharp = require('sharp');
  const sheetSeams = require(path.join(__dirname, '..', 'sheet-seams.js'));
  const sheetGrid = require(path.join(__dirname, '..', 'sheet-grid.js'));
  const plan = JSON.parse(planStr);
  const skip = new Set(JSON.parse(skipStr || '[]'));
  sharp.cache(false);
  sharp.concurrency(1);

  const sheet = fs.readFileSync(sheetFile);
  const { data, info } = await sharp(sheet, { limitInputPixels: false })
    .raw().toBuffer({ resolveWithObject: true });
  const rawPage = { raw: { width: info.width, height: info.height, channels: info.channels } };

  let boxes; let moved = 0;
  try {
    const gray = await sharp(data, rawPage).greyscale().raw().toBuffer({ resolveWithObject: true });
    const seams = sheetSeams.findSeams({ data: gray.data,
      width: gray.info.width, height: gray.info.height,
      across: plan.across, down: plan.down });
    boxes = sheetSeams.seamBoxes(seams);
    moved = seams.moved || 0;
  } catch (e) {
    // the seam finder failing must never cost the cut — the math lines are
    // exactly what this tool always did
    console.error('seams failed, cutting on the math lines:', e.message);
    boxes = sheetGrid.cutBoxes(plan);
  }

  const panels = [];
  for (let i = 0; i < boxes.length; i++) {
    if (skip.has(i)) { panels.push(null); continue; }
    try {
      const file = path.join(outDir, `panel-${i}.webp`);
      await sharp(data, rawPage).extract(boxes[i])
        .webp({ lossless: true, effort: 0 }).toFile(file);
      panels.push({ i, file, box: boxes[i] });
    } catch (e) {
      // one failed cut costs its panel, not the run — the sheet is paid for
      panels.push({ i, error: e.message });
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'),
    JSON.stringify({ moved, boxes, panels, peakRss: peak }));
})().catch((e) => { console.error(e && e.message || String(e)); process.exit(1); });

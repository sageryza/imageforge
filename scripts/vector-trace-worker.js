#!/usr/bin/env node
// One cell, one process, then exit.
//
// WHY THIS EXISTS. The tracer retains about 23MB of NATIVE memory per cell and
// never gives it back — measured 2026-08-14 over a real 3x3 sheet: nine traces
// alone took RSS from 83MB to 288MB, while the 2048px renders after them added
// only 65MB more. On Render's 512MB instance, shared with the whole Express
// app, that reaches the limit around the fifth or sixth cell and the process is
// OOM-killed. Nothing in JS can catch that, so the job document was simply left
// saying `running` forever, with no error and no partial result.
//
// Three sheets stalled that way (a 6-cell one on cell 6, two 9-cell ones on
// cell 6), while tracing the SAME cells one job at a time always worked — which
// was the accident that pointed at the cause: a fresh process reclaims it.
//
// `sharp.cache(false)` was tried first and moved the peak 402MB -> 372MB, which
// is not the problem. The leak is in the native tracer, so the only fix
// available from here is to put a process boundary around each cell.
//
// stdin:  JSON { in, out, fills, ink, render }
// stdout: JSON { colors, ms, ink, inkErr, svgBytes }   (one line, nothing else)
// files:  <out>.svg and <out>.png
const fs = require('fs');
const sharp = require('sharp');
const { vectorize } = require('../vectorize');

sharp.cache(false);
sharp.concurrency(1);

(async () => {
  const job = JSON.parse(fs.readFileSync(0, 'utf8'));
  const png = fs.readFileSync(job.in);
  const out = await vectorize(png, { fills: job.fills || 0, ink: job.ink != null ? job.ink : 'auto' });
  fs.writeFileSync(`${job.out}.svg`, out.svg);
  const render = job.render || 2048;
  const raster = await sharp(Buffer.from(out.svg), { density: 96 })
    .resize(render, render, { fit: 'inside' }).png().toBuffer();
  fs.writeFileSync(`${job.out}.png`, raster);
  process.stdout.write(JSON.stringify({
    colors: out.colors, ms: out.ms, ink: out.ink, inkErr: out.inkErr,
    svgBytes: out.svg.length,
  }));
})().catch((e) => {
  process.stderr.write(String((e && e.stack) || e));
  process.exit(1);
});

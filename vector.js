// Vector Studio — a described set of drawings -> scalable SVG art.
//
//   POST /api/vector/sheet    describe 1-25 drawings -> grid -> cut -> vectors
//   POST /api/vector/trace    a picture you already have -> a vector
//
// WHY THIS EXISTS. Every other image surface here ends at a PNG, which is fine
// on a screen and useless anywhere else: a card drawn at 1024px cannot go on a
// poster or a tote, and a die-cut sticker needs a cut path nothing was
// producing. A vector is sharp at any size from one ~100KB file, it recolours
// by editing a fill, and its outline IS the cut line. It also costs nothing to
// make — the trace is local, so the only money in this whole module is the one
// gpt-image-2 call that draws the sheet.
//
// WHY A SHEET, not one call per drawing. It is N times cheaper (one medium
// call, ~6c) and — the real reason — the drawings come out as a SET: one pass
// of the model, so line weight, palette and scale match across them. Separate
// calls drift.
//
// HOW MANY PER SHEET: up to NINE, and the ceiling is not the tracer. This was
// measured, not assumed — the pipeline shipped at four only because the Gravity
// Lock cards happened to be a 2x2. A 3x3 sheet was drawn at low, medium and
// high: cells come out 341px, the drawings ~250-310px of that, and the traced
// line weight lands within 4.8% / 7.4% / 6.4% of the source, all inside the 8%
// the 2x2 cards are held to. Nothing degrades.
//
// What DOES change with the grid is the drawing, not the trace: a smaller cell
// gets a simpler drawing from the model (fills per drawing averaged 2.9 at 3x3
// against 4.75 at 2x2), and trace error scales with how fine a drawing's detail
// is relative to its cell. Measured on the SAME subjects at two sizes: a
// strawberry's seeded surface went +14.1% at 205px to +9.0% at 256px, an acorn's
// cross-hatch +12.7% to +8.6%, while a bicycle sat in the noise at both. Cell
// size moves the worst case, not the average (mean ~4.3% at 5x5, ~4.4% at 4x4).
// See docs/vector-pipeline.md for the full table.
//
// `HOUSE` below is the style, and it is the recipe the Gravity Lock cards were
// drawn with, down to the wording. It is here as ONE technical constraint plus
// one convenience: the tracer needs flat colour (a gradient has no flat colours
// to find), and a fixed prompt keeps a set consistent. It is not a view about
// what the art should look like — change HOUSE to change the look.
//
// Everything slow is a BACKGROUND JOB on a Firestore doc (house rule): the POST
// returns an id in well under a second, the caller polls, and a finished sheet
// is never lost by walking away.
const express = require('express');
const admin = require('firebase-admin');
const sharp = require('sharp');
const fetch = require('node-fetch');
const FormData = require('form-data');

const { vectorize, cutout, slice } = require('./vectorize');

const router = express.Router();
const JOBS = 'forge-vector';

// The house recipe, verbatim. `prefix` and `grid` are prepended and `suffix`
// appended to whatever the caller describes, in that order, so a sheet made
// today matches the ones made in August 2026.
const HOUSE = {
  refs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
  model: 'gpt-image-2',
  size: '1024x1024',
  quality: 'medium',
  prefix: 'Use the attached images ONLY as a STYLE reference for the linework: '
    + 'bold confident black ink outlines, flat colors with NO gradients and minimal shading, '
    + 'a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, '
    + 'playful modern editorial illustration.',
  // Wide gutters and "nothing crossing between the cells" are load-bearing: the
  // sheet is cut on a straight grid line, so a drawing that leans into its
  // neighbour's cell loses a limb.
  // "quarter" for a 2x2 keeps that prompt BYTE-IDENTICAL to the one the Gravity
  // Lock cards were drawn with; any other layout says "cell".
  grid: (cols, rows) => `A ${cols}x${rows} grid of ${WORDS[cols * rows]} completely separate `
    + 'small illustrations on a plain white background. '
    + `Wide clean white gutters between them, each drawing sitting well inside its own ${cols === 2 && rows === 2 ? 'quarter' : 'cell'}, `
    + 'nothing crossing or touching between the cells, no grid lines, no borders, no frames.',
  // One drawing is not a grid of one — asking for a grid and describing a single
  // cell gets you the rest in invented filler.
  single: 'ONE small illustration, centred on a plain white background with clean white space '
    + 'all around it, no grid, no borders, no frames.',
  // At the VERY END, after the caller's words — the no-text rule.
  suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
};

const WORDS = {
  1: 'one', 2: 'two', 3: 'three', 4: 'four', 6: 'six', 9: 'nine',
  12: 'twelve', 16: 'sixteen', 20: 'twenty', 25: 'twenty-five',
};
// How many columns and rows for a given number of drawings. A count that does
// not tile takes the next layout up and the spare cells are simply never cut
// out — the sheet costs the same either way. 4, 6, 9, 12, 16, 20 and 25 waste
// nothing.
const LAYOUT = {
  1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [2, 2], 5: [3, 2], 6: [3, 2],
  7: [3, 3], 8: [3, 3], 9: [3, 3],
  10: [4, 3], 11: [4, 3], 12: [4, 3],
  13: [4, 4], 14: [4, 4], 15: [4, 4], 16: [4, 4],
  17: [5, 4], 18: [5, 4], 19: [5, 4], 20: [5, 4],
  21: [5, 5], 22: [5, 5], 23: [5, 5], 24: [5, 5], 25: [5, 5],
};
const MAX_CELLS = 25;
const COLNAME = { 1: [''], 2: ['LEFT', 'RIGHT'], 3: ['LEFT', 'CENTRE', 'RIGHT'] };
const ROWNAME = { 1: [''], 2: ['TOP', 'BOTTOM'], 3: ['TOP', 'MIDDLE', 'BOTTOM'] };

/** Where each cell sits.
 *
 *  Up to 3x3 these are the NAMES the model is told, and a 2x2 still reads
 *  TOP LEFT / TOP RIGHT / BOTTOM LEFT / BOTTOM RIGHT exactly as the Gravity
 *  Lock cards were asked for — that wording is not to be drifted. Beyond 3
 *  there is no natural name for the fourth column across, so the prompt
 *  switches to a row-by-row list and these become plain coordinates, used only
 *  as the `cell` label on a finished item. (Returning undefined here instead
 *  crashed a 5x5 render: runSheet labels every item with one.) */
function positions(cols, rows) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(COLNAME[cols] && ROWNAME[rows]
        ? [ROWNAME[rows][r], COLNAME[cols][c]].filter(Boolean).join(' ')
        : `row ${r + 1}, column ${c + 1}`);
    }
  }
  return out;
}

const QUALITIES = ['low', 'medium', 'high'];
const COST = { low: 0.02, medium: 0.06, high: 0.25 };   // one sheet, not one card

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '40mb' }));

/** Build the sheet prompt exactly the way the Gravity Lock cards were built.
 *  Exported so a caller (or a test) can see the literal text before spending. */
function sheetPrompt(cells) {
  const say = (c) => String(c.draw || c).trim().replace(/\.$/, '');
  if (cells.length === 1) return `${HOUSE.prefix} ${HOUSE.single} ${say(cells[0])}. ${HOUSE.suffix}`;
  const [cols, rows] = LAYOUT[cells.length];
  let parts;
  if (cols <= 3) {
    // Named positions, which is what the Gravity Lock cards used and what the
    // 2x2 byte-identity assertion pins.
    const at = positions(cols, rows);
    parts = cells.map((c, i) => `${at[i]}: ${say(c)}.`);
  } else {
    // Past three columns there is no natural name for the fourth one across
    // ("UPPER FAR LEFT" is a mouthful and an invitation to misplace), so the
    // instruction becomes a row-by-row list — a shape models follow well for
    // long sets.
    parts = [];
    for (let r = 0; r < rows; r++) {
      const row = cells.slice(r * cols, (r + 1) * cols);
      if (!row.length) break;
      parts.push(`ROW ${r + 1} of ${rows}, left to right: ${row.map(say).join('; ')}.`);
    }
  }
  return `${HOUSE.prefix} ${HOUSE.grid(cols, rows)} ${parts.join(' ')} ${HOUSE.suffix}`;
}

async function put(buf, path, contentType) {
  const f = bucket().file(path);
  await f.save(buf, { metadata: { contentType, cacheControl: 'public,max-age=31536000,immutable' } });
  await f.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${path}`;
}

// The style references live privately in Storage and are shared with the
// pastel house style. Cached after the first fetch, like loadHouseRef.
const refCache = new Map();
async function houseRef(path) {
  if (!refCache.has(path)) {
    const [buf] = await bucket().file(path).download();
    refCache.set(path, buf);
  }
  return refCache.get(path);
}

/** One gpt-image-2 edits call with the house style references attached.
 *
 * `output_format: png`, where the rest of the app asks for webp at compression
 * 80 — but NOT for the reason this comment used to give. It claimed webp's
 * ringing around a hard ink line was noise the flattener would spend a cluster
 * on. That was reasoning, and it is wrong: measured on the same 3x3 sheet, PNG
 * (933KB) and webp-80 (53KB) trace to the same line weight within noise — max
 * 7.4% against 7.0%, mean 3.6% against 3.3%, the webp marginally BETTER. One
 * drawing found a fourth fill instead of three.
 *
 * PNG stays because it is free to keep and removes a variable from a pipeline
 * whose whole job is flat colour — not because webp was costing anything. So a
 * sheet drawn elsewhere and handed to /trace (e.g. /api/generate/housestyle,
 * which saves webp) is NOT handicapped, and nobody should re-render one to PNG
 * hoping for a better trace.
 */
async function drawSheet(prompt, { quality = HOUSE.quality, size = HOUSE.size, timeout = 180000, retries = 2 } = {}) {
  const refs = await Promise.all(HOUSE.refs.map(houseRef));
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', HOUSE.model);
      form.append('prompt', prompt);
      form.append('size', size);
      form.append('quality', quality);
      form.append('output_format', 'png');
      refs.forEach((b, i) => form.append('image[]', b, { filename: `ref${i + 1}.png`, contentType: 'image/png' }));
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
        body: form,
        timeout,
      });
      const j = await res.json();
      // A safety refusal is DETERMINISTIC — retrying it only burns time and
      // reports a network-shaped error for what is really a content decision.
      if (j.error) {
        const msg = j.error.message || JSON.stringify(j.error);
        if (/safety|moderation|content policy/i.test(msg)) throw Object.assign(new Error('refused by the safety filter: ' + msg), { terminal: true });
        throw new Error(msg);
      }
      const d = j.data && j.data[0];
      if (d && d.b64_json) return Buffer.from(d.b64_json, 'base64');
      if (d && d.url) return await fetchBuf(d.url);
      throw new Error('no image came back');
    } catch (err) {
      if (err.terminal) throw err;
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function fetchBuf(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${String(url).slice(0, 80)}`);
  return Buffer.from(await r.arrayBuffer());
}

// ── the job ────────────────────────────────────────────────────────────────
async function patch(id, fields) {
  await db().collection(JOBS).doc(id).set(fields, { merge: true });
}

/** One picture -> the pair of files everything downstream wants: the SVG (the
 *  deliverable) and a big PNG render of it (what a gallery tile shows). */
async function traceOne(png, base, { fills = 0, render = 2048, ink = 'auto' } = {}) {
  // `ink: 'auto'` by default — the threshold is chosen per drawing so the traced
  // line weight matches the source. A fixed threshold is one guess for every
  // picture and it lands a few percent heavy on anything with fine repeated
  // detail: a strawberry's seeded surface came out +14.1%, an acorn's
  // cross-hatch +12.7%. Calibrated they are +0.5% and +1.2%. It costs about
  // three traces instead of one, and a trace is free.
  const out = await vectorize(png, { fills, ink });
  const svgUrl = await put(Buffer.from(out.svg), `${base}.svg`, 'image/svg+xml');
  // Rasterised at 2048 on purpose: a tile shown at ~110pt on a 3x phone is
  // ~330px, but she opens it, and a 1024 preview was the limiting factor the
  // last time round.
  const rendered = await sharp(Buffer.from(out.svg), { density: 96 })
    .resize(render, render, { fit: 'inside' }).png().toBuffer();
  const pngUrl = await put(rendered, `${base}.png`, 'image/png');
  // Hex, not [r,g,b] triples: Firestore refuses an array inside an array
  // ("Property array contains an invalid nested entity"), which failed the very
  // first end-to-end run AFTER the sheet had been paid for. Hex is also what a
  // caller wants for a swatch or a recolour.
  const colors = out.colors.map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''));
  return {
    svg: svgUrl, png: pngUrl, colors, kb: Math.round(out.svg.length / 1024), ms: out.ms,
    ...(out.ink != null ? { ink: out.ink, inkErr: Math.round(out.inkErr * 1000) / 10 } : {}),
  };
}

async function runSheet(id, body) {
  const cells = body.cells;
  const name = String(body.name || id).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const quality = QUALITIES.includes(body.quality) ? body.quality : HOUSE.quality;
  const prompt = sheetPrompt(cells);
  const base = `vector/${name}`;
  try {
    // `sheet` lets a caller re-cut and re-trace a sheet that was ALREADY drawn,
    // for nothing. Tuning the trace should never re-bill the model, and the
    // first live run proved why: it failed after the draw and would otherwise
    // have cost another 6c to try again.
    let sheetPng, sheetUrl;
    if (body.sheet) {
      await patch(id, { step: 'fetching the sheet', prompt, quality, reused: true });
      sheetUrl = String(body.sheet);
      sheetPng = await fetchBuf(sheetUrl);
    } else {
      await patch(id, { step: 'drawing the sheet', prompt, quality });
      sheetPng = await drawSheet(prompt, { quality });
      sheetUrl = await put(sheetPng, `${base}/sheet.png`, 'image/png');
    }
    await patch(id, { step: 'cutting the sheet', sheet: sheetUrl });

    const [cols, rows] = LAYOUT[cells.length];
    const cellPngs = cells.length > 1 ? await slice(sheetPng, cols, rows) : [sheetPng];
    const at = cells.length > 1 ? positions(cols, rows) : [''];
    const items = [];
    for (let i = 0; i < cells.length; i++) {
      const slug = String(cells[i].id || `cell-${i + 1}`).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      await patch(id, { step: `tracing ${slug} (${i + 1} of ${cells.length})` });
      // The cut-out is what makes a card its own object, and it is skipped for
      // a drawing whose own background is dark — the corner flood-fill would
      // eat it. (The Grand Tour card, black background, is the live example.)
      let cell = cellPngs[i];
      const dark = cells[i].darkBackground === true;
      if (!dark) {
        try { cell = await cutout(cellPngs[i]); } catch (e) { /* keep the raw cell */ }
      }
      const cutUrl = await put(await sharp(cell).png().toBuffer(), `${base}/${slug}-cut.png`, 'image/png');
      const traced = await traceOne(cell, `${base}/${slug}`, {
        fills: Number(cells[i].fills) || 0,
        ink: cells[i].ink != null ? cells[i].ink : 'auto',
      });
      items.push({ id: slug, draw: String(cells[i].draw || cells[i]), cell: at[i], cut: cutUrl, ...traced });
      await patch(id, { items });
    }
    await patch(id, { status: 'done', step: '', items, finishedAt: new Date().toISOString() });
  } catch (e) {
    await patch(id, { status: 'failed', step: '', error: String(e.message || e) });
  }
}

async function runTrace(id, body) {
  const name = String(body.name || id).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  try {
    const urls = Array.isArray(body.urls) ? body.urls : [body.url];
    const items = [];
    for (let i = 0; i < urls.length; i++) {
      await patch(id, { step: `tracing ${i + 1} of ${urls.length}` });
      let buf = await fetchBuf(urls[i]);
      if (body.cutout) buf = await cutout(buf);
      const slug = urls.length > 1 ? `${name}-${i + 1}` : name;
      items.push({ id: slug, source: urls[i], ...await traceOne(buf, `vector/traced/${slug}`, {
        fills: Number(body.fills) || 0, ink: body.ink != null ? body.ink : 'auto',
      }) });
      await patch(id, { items });
    }
    await patch(id, { status: 'done', step: '', items, finishedAt: new Date().toISOString() });
  } catch (e) {
    await patch(id, { status: 'failed', step: '', error: String(e.message || e) });
  }
}

// ── routes ─────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  let tracerOk = true, why = '';
  try { require('@neplex/vectorizer'); } catch (e) { tracerOk = false; why = e.message; }
  res.json({
    ok: true,
    tracer: tracerOk, tracerError: why || undefined,
    firebase: !!admin.apps.length,
    openai: !!process.env.OPENAI_API_KEY,
    style: { model: HOUSE.model, size: HOUSE.size, quality: HOUSE.quality, refs: HOUSE.refs },
    cost: { sheet: COST, trace: 0 },
  });
});

/** The literal prompt a sheet would send, without spending anything. */
router.post('/prompt', (req, res) => {
  const cells = req.body && req.body.cells;
  if (!Array.isArray(cells) || !cells.length || cells.length > MAX_CELLS) {
    return res.status(400).json({ error: `cells must be 1-${MAX_CELLS} descriptions` });
  }
  const [cols, rows] = LAYOUT[cells.length];
  res.json({ prompt: sheetPrompt(cells), layout: `${cols}x${rows}`, wasted: cols * rows - cells.length });
});

router.post('/sheet', async (req, res) => {
  const cells = req.body && req.body.cells;
  if (!Array.isArray(cells) || !cells.length || cells.length > MAX_CELLS) {
    return res.status(400).json({ error: `cells must be 1-${MAX_CELLS} descriptions` });
  }
  if (!admin.apps.length) return res.status(503).json({ error: 'Firebase not configured' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY not set' });
  const id = `sh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await patch(id, {
    id, kind: 'sheet', status: 'running', step: 'starting',
    cells, createdAt: new Date().toISOString(),
  });
  runSheet(id, req.body);                              // fire and forget
  res.json({
    ok: true, id, poll: `/api/vector/job/${id}`,
    cost: req.body.sheet ? 0 : (COST[req.body.quality] || COST.medium),
  });
});

router.post('/trace', async (req, res) => {
  const urls = Array.isArray(req.body.urls) ? req.body.urls : (req.body.url ? [req.body.url] : []);
  if (!urls.length) return res.status(400).json({ error: 'url or urls required' });
  if (!admin.apps.length) return res.status(503).json({ error: 'Firebase not configured' });
  const id = `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await patch(id, { id, kind: 'trace', status: 'running', step: 'starting', createdAt: new Date().toISOString() });
  runTrace(id, req.body);
  res.json({ ok: true, id, poll: `/api/vector/job/${id}`, cost: 0 });
});

router.get('/job/:id', async (req, res) => {
  const d = await db().collection(JOBS).doc(req.params.id).get();
  if (!d.exists) return res.status(404).json({ error: 'no such job' });
  res.json(d.data());
});

router.get('/jobs', async (req, res) => {
  const q = await db().collection(JOBS).orderBy('createdAt', 'desc')
    .limit(Math.min(50, Number(req.query.limit) || 20)).get();
  res.json({ jobs: q.docs.map((d) => d.data()) });
});

module.exports = { router, HOUSE, LAYOUT, MAX_CELLS, positions, sheetPrompt, traceOne };

/**
 * PANELS — one sheet, drawn once, cut into separate pictures.
 *
 * Sophie, 2026-08-23: "i think we copy the playground code for it's own
 * module. this has four text boxes, one for each panel — or an option for
 * other grid sizes like 9 or 2 (landscape, side by side)".
 *
 * WHY IT EXISTS. It is the Playground's recipe with the run turned inside
 * out: instead of one prompt drawn once, N prompts drawn TOGETHER on one page
 * and cut apart locally. That is cheaper twice over, measured rather than
 * argued (docs/modules/pictures.md): output tokens scale sub-linearly with
 * pixels, AND a sheet is ONE call, so it pays the style reference's ~1.2c once
 * instead of once per picture. Per finished picture at medium, four panels:
 *     four separate 1024x1536 draws   5.39c each
 *     one 2336x3504 sheet, quartered  3.25c each  (1168x1752 — 1.30x a 1K)
 * So 4K is the tier where a quarter comes out BIGGER than an ordinary 1K
 * picture. 2K is cheaper still but its quarters are smaller than a plain 1K
 * image, which is the thing that is easy to get backwards.
 *
 * THE CUT IS LOCAL, FREE AND LOSSLESS — an exact crop of the sheet's own
 * pixels, never a resample, so a panel is the model's output rather than a
 * re-encode of it (the house "nothing stands between the source and the
 * output" rule). The geometry lives in sheet-grid.js and is DERIVED, so a
 * grid nobody has drawn before still lands on a legal canvas.
 *
 * THE STYLE'S OWN TAIL FIGHTS THIS, and that is the one thing not to undo.
 * PL_GPT_STYLES.dreamy ends "Render as ONE single illustration — NOT a grid,
 * NOT split panels", which is load-bearing for ordinary runs (the reference IS
 * a multi-panel comic page and the model will happily copy its layout). A
 * sheet REPLACES that tail, never appends to it — two sentences arguing
 * produce one panel with three ghosts of the others.
 *
 * A PANEL'S CAPTION SAYS "1/4 (4K)", NOT ITS OWN PIXELS (Sophie's rule, and
 * size-tier.js's cutSize builds it): a quarter of a 4K sheet is 1168x1752,
 * which lands on the 1K rung by pixel count and would read as an ordinary
 * small picture, losing the one fact that says what it is and what it cost.
 *
 * Routes
 *   GET  /status                 config health, open even when gated
 *   GET  /config                 grids, cell shapes, tiers, styles, prices
 *                                — SERVED, never copied into the page
 *   POST /                       start a sheet; returns an id in ~0.3s
 *   GET  /:id                    one run, with its job state
 *   GET  /                       the feed, newest first (?limit=&q=)
 *   POST /:id/hide               hide a run from the feed (never deleted)
 *
 * Nothing here is deleted outright and no route overwrites a render.
 */
const express = require('express');
const admin = require('firebase-admin');
const sheetGrid = require('./sheet-grid');
const sizeTier = require('./size-tier');

const COLLECTION = 'forge-panels';
const MAX_PANEL_CHARS = 1200;   // one cell's words; generous, cut not refused
const MAX_FEED = 400;

// Handed in by server.js at mount time (the movies.init pattern) — this module
// owns none of the credentials or the model call, so it can be driven whole
// from a test with three stubs and no network.
let deps = {
  imageEdit: null,        // (prompt, refBuffers, opts) -> OpenAI edits response
  refsFor: null,          // (style) -> Promise<Buffer[]>
  refBuffer: null,        // (filename) -> Buffer
  saveBuffer: null,       // (buf, mime, prefix) -> Promise<url>
  fileCreation: null,     // ({url, prompt, model, quality, size, canvas, style})
  styles: {},             // PL_GPT_STYLES
  gpt: {},                // PL_GPT
  whiten: null,           // (buf) -> Promise<Buffer>
};
function init(d) { deps = Object.assign(deps, d || {}); }
// Tests drive cutSheet directly with a stub uploader — the module owns none of
// the credentials, so this needs no network and no Firebase.
function __setDeps(d) { deps = Object.assign(deps, d || {}); }

const router = express.Router();

// The house gate, copied from audio.js: open when STUDIO_TOKEN is unset,
// otherwise every route but /status wants the header.
router.use((req, res, next) => {
  const want = process.env.STUDIO_TOKEN;
  if (!want || req.path === '/status') return next();
  const got = req.get('x-studio-token') || req.query.token;
  if (got === want) return next();
  return res.status(401).json({ error: 'studio token required' });
});

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    firebase: Boolean(admin.apps.length),
    openai: Boolean(process.env.OPENAI_API_KEY),
    grids: Object.keys(sheetGrid.GRIDS).map(Number),
    shapes: Object.keys(sheetGrid.SHAPES),
  });
});

// WHAT THE PAGE DRAWS ITS CONTROLS FROM. Same rule as the Playground's
// /styles route: the server owns what is actually sent and what it costs, and
// the page holds no copy — a price or a prompt baked into the HTML is a second
// source of truth that drifts silently. A test pins that panels.html carries
// no cost figure and no prefix of its own.
router.get('/config', (req, res) => {
  const grids = Object.entries(sheetGrid.GRIDS).map(([id, g]) => ({
    id: Number(id), label: g.label, across: g.across, down: g.down,
    count: g.across * g.down, cells: sheetGrid.cellNames(Number(id)),
  }));
  const shapes = Object.entries(sheetGrid.SHAPES)
    .map(([id, s]) => ({ id, label: s.label, aspectRatio: s.aspectRatio }));
  // Every combination's real canvas AND its real price, so the page never
  // computes either. `each` is what one finished picture costs — the whole
  // point of the tool, and the number a per-picture comparison needs.
  const plans = {};
  for (const gid of Object.keys(sheetGrid.GRIDS)) {
    for (const sid of Object.keys(sheetGrid.SHAPES)) {
      for (const tid of Object.keys(sheetGrid.TIERS)) {
        const plan = sheetGrid.sheetFor(Number(gid), sid, tid);
        if (!plan) continue;
        const qs = (deps.gpt && deps.gpt.qualities) || ['low', 'medium', 'high'];
        // priced against the DEFAULT style's reference count — the page
        // re-asks when she picks another, and most styles attach one
        plans[`${gid}|${sid}|${tid}`] = Object.assign({ cents: sheetCents(plan, qs, 1) }, plan);
      }
    }
  }
  const styles = Object.entries(deps.styles || {}).map(([id, st]) => ({
    id, label: st.label, prefix: st.prefix, suffix: st.suffix,
    refs: (st.refFiles || []).concat(st.storageRefs || []),
  }));
  res.json({
    grids, shapes, tiers: Object.keys(sheetGrid.TIERS), plans, styles,
    qualities: (deps.gpt && deps.gpt.qualities) || ['low', 'medium', 'high'],
    defaults: { grid: 4, shape: 'portrait', res: '4k', quality: 'medium', style: 'dreamy' },
    model: (deps.gpt && deps.gpt.id) || 'gpt-image-2',
  });
});

// WHAT A SHEET COSTS, per quality and per finished picture.
//
// THE MODEL IS FITTED TO THE MEASURED TABLE, NOT GUESSED, and it is not a
// price per megapixel — that was the first cut here and it was ~2x wrong at
// 4K, which would have put a confident wrong number in front of Sophie on the
// one screen she decides what to spend from.
//
// gpt-image-2's cost is SUB-linear in pixels, which is the whole reason this
// tool is cheaper than drawing the panels one at a time. `cents = fixed +
// rate * megapixels` reproduces the measured ladder in PL_GPT.res (itself
// measured by scripts/measure-image-cost.js against the API's own `usage`) to
// within 0.2% at medium and high, ~3% at low, where the figures are fractions
// of a cent anyway. Coefficients are derived from the 1K and 4K rungs; the 2K
// rung is the check they are validated against, and the test re-runs it.
//
// AND COST TRACKS THE ASPECT RATIO, NOT THE AREA — 1920² and 1568x2352 hold
// the same 3.69 megapixels and the square costs 50% more at every quality
// (CLAUDE.md's inversion warning). So there are two anchors, and a sheet whose
// shape falls between them is interpolated across that ratio.
//
// A RATIO OUTSIDE THE MEASURED RANGE IS CLAMPED, NEVER EXTRAPOLATED. Two
// pictures side by side make a 2:1 page and nothing at 2:1 has ever been
// measured; running the fit out that far produced a rate barely a third of the
// square's, which is not a finding, it is a straight line leaving its data.
// Clamping quotes the NEAREST MEASURED shape instead. Cost falls as a page
// gets less square, so quoting a 2:3 price for a 2:1 page errs HIGH — the safe
// direction for a number she decides what to spend from. The run records the
// real `usage` the API returns — that is the number any later comparison
// should read, and `approx` on every estimate says so.
const CENTS_FIT = {
  // ratio = long edge / short edge of the SHEET
  square: { ratio: 1, low: [0.400, 0.1905], medium: [3.493, 1.7238], high: [13.856, 6.9088] },
  portrait: { ratio: 1.5, low: [0.298, 0.1285], medium: [2.283, 1.1554], high: [9.259, 4.6034] },
};
function fitFor(ratio, quality) {
  const a = CENTS_FIT.square, b = CENTS_FIT.portrait;
  const r = Math.min(Math.max(Number(ratio) || 1, a.ratio), b.ratio);
  const t = (r - a.ratio) / (b.ratio - a.ratio);
  const [af, ar] = a[quality] || a.medium;
  const [bf, br] = b[quality] || b.medium;
  return { fixed: af + t * (bf - af), rate: ar + t * (br - ar) };
}
// THE INPUT SIDE, measured on this tool's first real sheet (2026-08-24).
// The fitted model above reproduces the OUTPUT-token cost, because PL_GPT.res
// is an output-only table — so the first estimate this tool ever printed said
// 11.74c and the API charged 13.06c. The missing 1.32c is what it costs to
// SEND the style reference and the words:
//     1,505 image tokens x $8/1M  = 1.20c   per attached reference
//       246 text  tokens x $5/1M  = 0.12c   the prompt itself
// This is the saving the whole tool exists for, so it is named rather than
// folded into the fit: a sheet pays it ONCE where N separate draws pay it N
// times. It does not move with quality or canvas — it is the input, not the
// picture — so it is added after the fit rather than inside it.
const REF_CENTS = 1.20;
const TEXT_CENTS = 0.12;
function sheetCents(plan, qualities, refs) {
  if (!plan) return null;
  const mp = plan.pixels / 1e6;
  const ratio = Math.max(plan.width, plan.height) / Math.min(plan.width, plan.height);
  const clamped = ratio > CENTS_FIT.portrait.ratio || ratio < CENTS_FIT.square.ratio;
  const input = round2(Math.max(Number(refs) || 1, 1) * REF_CENTS + TEXT_CENTS);
  const out = {};
  for (const q of qualities || ['low', 'medium', 'high']) {
    const f = fitFor(ratio, q);
    const total = f.fixed + f.rate * mp + input;
    out[q] = { sheet: round2(total), each: round2(total / plan.count),
      // what a draw of the SAME picture on its own would pay in input, N times
      // over — the number the comparison rests on
      input, approx: true, clamped };
  }
  return out;
}
const round2 = (n) => Math.round(n * 100) / 100;
// How many images ride along with the prompt — each one is charged as image
// input, and it is the cost a sheet pays once instead of once per picture.
const refCount = (st) => Math.max(
  ((st && st.refFiles) || []).length + ((st && st.storageRefs) || []).length, 1);

/**
 * THE PROMPT, built in one place so a test can read it without a network.
 * Her words per cell go in VERBATIM — nothing is rewritten, and the only
 * lines added are the grid instruction and the style's own prefix/tail, both
 * of which the page shows her (the "if you add anything to a prompt Sophie
 * gave, tell her" rule made structural).
 *
 * THE GRID SENTENCE REPLACES THE STYLE'S TAIL rather than joining it — see
 * the header. `sheetSuffix` is what a style's own suffix becomes here.
 */
function buildPrompt({ plan, panels, prefix, suffix, cells }) {
  const names = cells && cells.length ? cells : sheetGrid.cellNames(
    Object.keys(sheetGrid.GRIDS).find((k) => sheetGrid.GRIDS[k].across * sheetGrid.GRIDS[k].down === plan.count));
  const lines = [
    prefix,
    '',
    gridLine(plan),
    ...panels.map((p, i) => `${names[i] || `panel ${i + 1}`}: ${String(p).trim()}`),
  ];
  if (suffix) lines.push('', suffix);
  return lines.filter((l, i) => l !== '' || i > 0).join('\n').trim();
}

/**
 * THE GRID SENTENCE STATES THE GEOMETRY THE CUT NEEDS, AND NOTHING ELSE.
 * The page is sliced along exact halves/thirds, so what actually matters is
 * that each illustration FILLS its own cell edge to edge — a gutter or a page
 * margin puts the art out of register with the cut lines and every panel comes
 * out with a slice of its neighbour.
 * It deliberately says nothing about borders, caption boxes or palette: those
 * are the STYLE's business, and a sentence here arguing with a style's own tail
 * is the exact failure this module's header warns about (Dreamy asks for a
 * hand-drawn frame, which is right per panel).
 *
 * It is its own function because it is part of the WRAPPER around her words,
 * so the stored style half has to carry it — see fileRun. Built in one place
 * so the sentence that is filed cannot drift from the sentence that is sent.
 */
function gridLine(plan) {
  const shape = plan.down === 1
    ? `a single row of ${plan.count} separate illustrations, side by side`
    : `a ${plan.across}x${plan.down} grid of ${plan.count} separate illustrations`;
  return `Draw ${shape} on one page, in reading order. They fill the page in equal `
    + `${plan.count === 2 ? 'halves' : plan.count === 4 ? 'quarters' : 'parts'}`
    + ' with no gutters and no page margin: each illustration must completely '
    + 'fill its own part, edge to edge, because the page is going to be cut '
    + 'along those lines. Each is a separate picture with its own subject — '
    + 'do not continue one scene across them.';
}

// A style's suffix, with any "one single illustration / not a grid" clause
// taken OUT — that sentence is correct for the Playground and fatal here.
// Matched on the CLAUSE rather than the whole tail so the rest of a style's
// wording (no text, the border, the palette) survives untouched.
const ONE_PICTURE_RE =
  /(?:^|(?<=[.!?])\s*)[^.!?]*\b(?:one single illustration|a single illustration|NOT a grid|not split panels|single scene)\b[^.!?]*[.!?]?/gi;
function sheetSuffix(suffix) {
  return String(suffix || '').replace(ONE_PICTURE_RE, ' ').replace(/\s{2,}/g, ' ').trim();
}

router.post('/', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firebase not configured' });
    if (!deps.imageEdit) return res.status(503).json({ error: 'panels not initialised' });

    const gridId = sheetGrid.GRIDS[String(req.body.grid)] ? Number(req.body.grid) : 4;
    const shapeId = sheetGrid.SHAPES[String(req.body.shape)] ? String(req.body.shape) : 'portrait';
    // 4K is the default HERE, unlike the Playground's 1K — a sheet only pays
    // off at the tier where a cut panel beats an ordinary picture, and the
    // whole reason to open this page is to get panels worth keeping.
    const resId = sheetGrid.TIERS[String(req.body.res)] ? String(req.body.res) : '4k';
    const plan = sheetGrid.sheetFor(gridId, shapeId, resId);
    if (!plan) return res.status(400).json({ error: 'no legal canvas for that grid' });

    const qualities = (deps.gpt && deps.gpt.qualities) || ['low', 'medium', 'high'];
    const quality = qualities.includes(req.body.quality) ? req.body.quality : 'medium';

    const styleId = deps.styles[String(req.body.style)] ? String(req.body.style) : 'dreamy';
    const st = deps.styles[styleId] || Object.values(deps.styles)[0];
    if (!st) return res.status(503).json({ error: 'no styles configured' });

    // ONE BOX PER CELL — her ask. A short box is fine; an EMPTY one is not,
    // because the model fills an unnamed cell with whatever it likes and she
    // pays for it at the sheet's price.
    const raw = Array.isArray(req.body.panels) ? req.body.panels : [];
    const panels = raw.slice(0, plan.count)
      .map((p) => String(p == null ? '' : p).trim().slice(0, MAX_PANEL_CHARS));
    if (panels.length < plan.count || panels.some((p) => !p)) {
      return res.status(400).json({
        error: `all ${plan.count} panels need words`,
        missing: Array.from({ length: plan.count }, (_, i) => i).filter((i) => !panels[i]),
      });
    }

    // Her edits to the wrapper, exactly as the Playground handles them: only a
    // STRING overrides, so an absent field keeps the house text and an empty
    // string genuinely deletes that half.
    const over = (v, baked) => (typeof v === 'string' ? v.trim().slice(0, 4000) : baked);
    const prefix = over(req.body.prefix, st.prefix || '');
    const suffix = over(req.body.suffix, sheetSuffix(st.suffix || ''));
    const promptEdited = prefix !== (st.prefix || '') || suffix !== sheetSuffix(st.suffix || '');

    const cells = sheetGrid.cellNames(gridId);
    const fullPrompt = buildPrompt({ plan, panels, prefix, suffix, cells });

    const docRef = admin.firestore().collection(COLLECTION).doc();
    await docRef.set({
      id: docRef.id, status: 'running',
      grid: gridId, shape: shapeId, res: resId, quality, style: styleId,
      sheetSize: plan.sheet, cellSize: plan.cell, count: plan.count,
      aspectRatio: plan.aspectRatio, cellAspectRatio: plan.cellAspectRatio,
      panels, prefix, suffix, promptEdited, fullPrompt,
      estimate: sheetCents(plan, qualities, refCount(st))[quality] || null,
      sheetUrl: '', images: [],
      job: { kind: 'sheet', status: 'running', done: 0, total: plan.count + 1,
        label: 'drawing the sheet', startedAt: Date.now() },
      createdAt: admin.firestore.Timestamp.now(),
    });
    // prefix/suffix ride along so each filed picture carries the real wrapper
    // — Sophie's hard rule, 2026-08-24: the whole prompt is stored wherever an
    // image is made, and here ONE call makes several pictures.
    runSheet(docRef, { plan, fullPrompt, quality, styleId, panels, gridId, shapeId, resId, prefix, suffix });
    return res.json({ id: docRef.id, poll: `/api/panels/${docRef.id}`,
      sheet: plan.sheet, cell: plan.cell, count: plan.count,
      estimate: sheetCents(plan, qualities, refCount(st))[quality] || null });
  } catch (err) {
    console.warn('panels start failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * The background job: draw the sheet, cut it, upload every piece.
 * Nothing blocks the POST, the state lives on the doc, and a failure lands as
 * `job.status:'failed'` with its message rather than a hung request.
 *
 * A SAFETY REFUSAL IS TERMINAL and must not be retried (the house rule) — the
 * whole sheet is one call, so a refusal costs the run and re-sending the same
 * words buys the same refusal at full price.
 */
async function runSheet(docRef, cfg) {
  const patch = (o) => docRef.update(o).catch(() => {});
  try {
    const st = deps.styles[cfg.styleId] || Object.values(deps.styles)[0];
    const refs = await deps.refsFor(st);

    const data = await deps.imageEdit(cfg.fullPrompt, refs, {
      quality: cfg.quality, size: cfg.plan.sheet, timeout: 600000,
    });
    if (data && data.error) throw new Error(data.error.message || 'gpt-image-2 error');
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) throw new Error('gpt-image-2 returned no image');
    let sheet = Buffer.from(b64, 'base64');
    if (st.whiten && deps.whiten) {
      try { sheet = await deps.whiten(sheet); }
      catch (e) { console.warn('panels whiten failed:', e.message); }
    }

    const sheetUrl = await deps.saveBuffer(sheet, 'image/webp', 'panels/sheets');
    await patch({
      sheetUrl, usage: (data && data.usage) || null,
      job: { kind: 'sheet', status: 'running', done: 1, total: cfg.plan.count + 1,
        label: 'cutting', startedAt: Date.now() },
    });

    const images = await cutSheet(sheet, cfg, patch, []);
    if (!images.length) throw new Error('every cut failed — the sheet is saved, nothing was cut');

    await patch({ status: 'done', images,
      job: { kind: 'sheet', status: 'done', done: cfg.plan.count + 1,
        total: cfg.plan.count + 1, label: '', startedAt: Date.now() } });

    fileRun(sheetUrl, images, cfg, 0);
  } catch (err) {
    console.warn('panels sheet failed:', err.message);
    await patch({ status: 'failed', error: err.message,
      job: { kind: 'sheet', status: 'failed', error: err.message, startedAt: Date.now() } });
  }
}

/**
 * INTO MY CREATIONS — shared by the first run and by a resume, so a re-cut
 * panel is filed exactly like one that landed first time.
 *
 * The SHEET carries its own tier ("4K") and each PANEL carries the FRACTION
 * ("1/4 (4K)") — a quarter of a 4K sheet is 1168x1752, which lands on the 1K
 * rung by pixel count and would read as an ordinary small picture.
 *
 * `skip` is how many panels were already filed on an earlier pass; those are
 * left alone rather than filed twice.
 */
function fileRun(sheetUrl, images, cfg, skip) {
  if (!deps.fileCreation) return;
  const st = deps.styles[cfg.styleId] || Object.values(deps.styles)[0] || {};
  const tier = sizeTier.captionSize(cfg.plan.sheet);
  const cut = sizeTier.cutSize(cfg.plan.sheet, cfg.plan.count);
  const model = (deps.gpt && deps.gpt.id) || 'gpt-image-2';
  const label = st.label || cfg.styleId;
  // THE WHOLE PROMPT RIDES ALONG (Sophie's hard rule, 2026-08-24: "anytime an
  // image is made ANYWHERE the whole prompt shud be stored"). This module
  // shipped without it, so every sheet and every cut panel filed with no style
  // prompt at all — the exact hole the rule was written to close, reopened by
  // the one tool that draws N pictures at once.
  //
  // `cfg.fullPrompt` is the literal page-sized text that was sent, and it is
  // the honest answer for a PANEL too: that text is what drew it, because it
  // was drawn as part of the sheet. The style half is the real wrapper —
  // her prefix, the GRID SENTENCE this module adds, and the tail — so the
  // seam shows everything that was put around her words, the added sentence
  // included.
  const shared = { source: 'panels', style: `${label} · ${cfg.quality}`, model,
    quality: cfg.quality, fullPrompt: cfg.fullPrompt,
    promptPrefix: [cfg.prefix, gridLine(cfg.plan)].filter(Boolean).join('\n\n'),
    promptSuffix: cfg.suffix };
  if (!skip) {
    deps.fileCreation(Object.assign({ url: sheetUrl,
      prompt: `the sheet — ${cfg.plan.count} panels: ${(cfg.panels || []).join(' · ')}`,
      // The sheet's caption names what it is; its CONTENT half is her words,
      // one cell per line, verbatim — never that caption line, which is ours.
      promptContent: (cfg.panels || []).map((p) => String(p).trim()).filter(Boolean).join('\n'),
      canvas: cfg.plan.sheet, sizeSlot: tier }, shared));
  }
  images.slice(skip || 0).forEach((im) => deps.fileCreation(Object.assign({
    url: im.url, prompt: im.prompt, canvas: cfg.plan.cell, sizeSlot: cut }, shared)));
}

/**
 * THE CUT, shared by the first run and by a resume.
 *
 * DECODED ONCE. It used to be `sharp(sheet).extract(...)` per panel, which
 * re-decodes the whole page every time — a 2336x3504 sheet is 24.5MB of raw
 * pixels, so nine panels meant nine decodes on a 512MB box that is also
 * serving the app. One decode, N crops.
 *
 * Lossless — an exact crop of the sheet's own pixels, so a panel is the
 * model's output and not a re-encode of it.
 *
 * `have` is what already landed, so a resume only cuts the panels that are
 * missing and never re-uploads one she may already have hearted.
 */
async function cutSheet(sheet, cfg, patch, have) {
  const sharp = require('sharp');
  const boxes = sheetGrid.cutBoxes(cfg.plan);
  const names = sheetGrid.cellNames(cfg.gridId);
  const images = (have || []).slice();
  const done = new Set(images.map((im) => im.cell));
  // ONE decode for the whole sheet; each crop is taken from this.
  const page = sharp(sheet, { limitInputPixels: false });
  for (let i = 0; i < boxes.length; i++) {
    const cell = names[i] || `panel ${i + 1}`;
    if (done.has(cell)) continue;
    try {
      const buf = await page.clone().extract(boxes[i]).webp({ lossless: true }).toBuffer();
      const url = await deps.saveBuffer(buf, 'image/webp', 'panels/cuts');
      images.push({ url, cell, prompt: cfg.panels[i], size: cfg.plan.cell });
    } catch (e) {
      // one failed cut costs its panel, not the run — the sheet is paid for
      console.warn(`panels cut ${i + 1} failed:`, e.message);
    }
    // keep them in reading order however they were assembled
    images.sort((a, b) => names.indexOf(a.cell) - names.indexOf(b.cell));
    await patch({ images: images.slice(),
      job: { kind: 'sheet', status: 'running', done: 1 + images.length,
        total: cfg.plan.count + 1, label: 'cutting', startedAt: Date.now() } });
  }
  return images;
}

/**
 * A WEDGED RUN IS RE-CUT FROM ITS OWN SHEET, FREE.
 *
 * Measured the first time this tool drew anything (2026-08-24): the sheet
 * landed, two of four panels cut, and thirteen seconds later ANOTHER CHAT
 * merged a PR — the Render deploy restarted the box mid-job and the doc sat
 * `running` forever. Several chats merge here all day, so that is a normal
 * event, not a freak one.
 *
 * The expensive half had already succeeded. So this re-cuts from the stored
 * sheet: no model call, no money, and the panels that already landed are kept
 * rather than re-uploaded. That is the whole reason the sheet is saved to
 * Storage BEFORE the cutting starts.
 *
 * It refuses to touch a job that is genuinely still working — only one that
 * has been silent past STALE_MS, the same stale-job takeover cutmarks.js uses,
 * so a restart can never wedge a doc permanently.
 */
const STALE_MS = 5 * 60 * 1000;
function isStale(d) {
  const j = d.job || {};
  if (j.status !== 'running') return false;
  return Date.now() - (Number(j.startedAt) || 0) > STALE_MS;
}

router.post('/:id/resume', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firebase not configured' });
    const ref = admin.firestore().collection(COLLECTION).doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'run not found' });
    const d = doc.data();
    if (!d.sheetUrl) return res.status(400).json({ error: 'no sheet to cut — nothing was drawn' });
    if ((d.images || []).length >= d.count) {
      return res.json({ ok: true, alreadyDone: true, images: d.images });
    }
    if (d.status === 'running' && !isStale(d)) {
      return res.json({ ok: true, stillWorking: true, job: d.job || null });
    }
    const plan = sheetGrid.sheetFor(d.grid, d.shape, d.res);
    if (!plan) return res.status(400).json({ error: 'this run has no legal canvas any more' });
    await ref.update({ status: 'running',
      job: { kind: 'recut', status: 'running', done: 1 + (d.images || []).length,
        total: plan.count + 1, label: 'cutting', startedAt: Date.now() } });
    recut(ref, d, plan);
    return res.json({ ok: true, resumed: true, have: (d.images || []).length, want: plan.count });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

async function recut(ref, d, plan) {
  const patch = (o) => ref.update(o).catch(() => {});
  try {
    const r = await fetch(d.sheetUrl);
    if (!r.ok) throw new Error(`could not fetch the sheet (${r.status})`);
    const sheet = Buffer.from(await r.arrayBuffer());
    // fullPrompt/prefix/suffix come off the stored run — without them a
    // resumed panel would file with no prompt while its first-pass siblings
    // carry one, which is the same picture described two different ways.
    const cfg = { plan, panels: d.panels || [], gridId: d.grid,
      quality: d.quality, styleId: d.style,
      fullPrompt: d.fullPrompt || '', prefix: d.prefix || '', suffix: d.suffix || '' };
    const images = await cutSheet(sheet, cfg, patch, d.images || []);
    if (!images.length) throw new Error('every cut failed');
    await patch({ status: 'done', images,
      job: { kind: 'recut', status: 'done', done: plan.count + 1,
        total: plan.count + 1, label: '', startedAt: Date.now() } });
    fileRun(d.sheetUrl, images, cfg, (d.images || []).length);
  } catch (err) {
    console.warn('panels recut failed:', err.message);
    await patch({ status: 'failed', error: err.message,
      job: { kind: 'recut', status: 'failed', error: err.message, startedAt: Date.now() } });
  }
}

router.get('/:id', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firebase not configured' });
    const doc = await admin.firestore().collection(COLLECTION).doc(String(req.params.id)).get();
    if (!doc.exists) return res.status(404).json({ error: 'run not found' });
    return res.json(clean(doc.data()));
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

// The feed. ONE equality filter and everything else sorted in memory — the
// house rule, so no route here ever needs a composite index.
router.get('/', async (req, res) => {
  try {
    if (!admin.apps.length) return res.json({ runs: [] });
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 200);
    const snap = await admin.firestore().collection(COLLECTION)
      .orderBy('createdAt', 'desc').limit(MAX_FEED).get();
    let runs = snap.docs.map((d) => clean(d.data())).filter((r) => !r.hidden);
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) runs = runs.filter((r) => hay(r).includes(q));
    return res.json({ runs: runs.slice(0, limit), total: runs.length });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

// Searchable text for one run — her words first, then how it was drawn.
function hay(r) {
  return [(r.panels || []).join(' '), r.style, r.quality, r.sheetSize, r.cellSize,
    r.res, r.shape, `${r.count} panels`, r.status].filter(Boolean).join(' ').toLowerCase();
}

// Hidden, never deleted — the house verb.
router.post('/:id/hide', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firebase not configured' });
    await admin.firestore().collection(COLLECTION).doc(String(req.params.id))
      .update({ hidden: req.body && req.body.hidden === false ? false : true });
    return res.json({ ok: true });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

function clean(d) {
  const o = Object.assign({}, d);
  if (o.createdAt && o.createdAt.toMillis) o.ms = o.createdAt.toMillis();
  delete o.createdAt;
  return o;
}

module.exports = { router, init, __setDeps, buildPrompt, gridLine, sheetSuffix, sheetCents,
  hay, cutSheet, fileRun, isStale, STALE_MS, COLLECTION };

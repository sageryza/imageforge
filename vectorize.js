// Flat-colour art -> a clean SVG. The engine, with no HTTP around it.
//
// A JS port of scripts/vectorize-card.py, which is still the readable
// reference for WHY each step exists. Same algorithm, same defaults, same
// tracer — `@neplex/vectorizer` is a native binding to the very vtracer the
// Python calls, so nothing about the trace itself changed. It lives in Node so
// the server needs no Python in its build for one script.
//
// It is NOT bit-identical to the Python and cannot be. Two reasons, both
// measured: k-means starts from a seeded RNG and the two languages have
// different ones, and PIL's Lanczos and sharp's differ at edges (4.2% of pixels
// off by more than 4), which is enough to move a cluster that was sitting on
// the share threshold anyway. The two agree exactly on 8 of the 13 Gravity Lock
// cards and differ by one marginal colour — 0.04% to 0.3% of the card — on the
// rest. Neither answer is the right one, so scripts/test-vectorize.js does not
// compare them: it asserts against the SOURCE CARD instead. Read its header for
// what that gate does and does not catch.
//
// The whole job is FLATTENING the picture to exactly `fills + 2` colours; the
// tracer then emits one layer per real colour instead of the 100+ near
// duplicates it finds in a raw render. Three parts of that are load-bearing and
// each one shipped a visibly wrong result when it was missing:
//
//  1. THE ANTI-ALIASED BAND BESIDE EVERY LINE IS NOT A COLOUR. It is a ramp
//     from ink to paper straight through the range the real fills occupy, so a
//     palette built over it spends a whole cluster on the ramp — and the trace
//     wears that colour as a pale halo along every line. `band` dilates the ink
//     mask and drops that collar from the palette.
//  2. THE PALETTE IS K-MEANS, NOT A QUANTISER. A quantiser picks colours to
//     span the gamut, which is exactly wrong for flat art: a grey hammer head
//     (210,204,209) and a lilac moon (214,207,232) sit 23 apart and get merged.
//     K-means centres land ON the dense flat colours; each cluster is then
//     painted its MEDIAN real colour, so what comes out is what went in.
//  3. LABELS PROPAGATE, NOT COLOURS. Every pixel that is not a confident fill
//     takes the LABEL of the nearest one by distance transform, so no blended
//     in-between colour is ever invented — weighed against the distance to the
//     nearest paper pixel, or a fill bleeds into the open space beside a line.
//
// `ink` is 130, not 150, and it was earned the hard way (Sophie: the cards were
// "a little blurry and not crisp"). It sets the STROKE WEIGHT of the whole
// drawing; measured against the source's own 50% crossing, 150 drew 6-9% too
// much line. test-vectorize.js fails at 150, which is the check that pins it.
//
// The other half of that fix — running the paper-grain median AFTER the upscale,
// not before — needs NO code here to hold, and it is worth knowing why: sharp
// applies its operations in its OWN fixed pipeline order, not the order you call
// them. Verified: `.median().resize()` and `.resize().median()` in one chain are
// bit-identical (0.000 mean difference), and only a genuinely separate pipeline
// differs (0.747). So the ordering bug that merged four dots on an astronaut's
// chest badge into one blob cannot be expressed here at all. Do NOT "fix" this
// by splitting the median into its own sharp() call — that would reintroduce it.
const sharp = require('sharp');

let vtracer = null;
function tracer() {
  // A real dependency (the endpoint needs it), but required LAZILY: it ships a
  // per-platform native binary, and a host where that binary is missing should
  // fail on the one route that uses it rather than refusing to boot the server.
  if (!vtracer) vtracer = require('@neplex/vectorizer');
  return vtracer;
}

// A border-touching blob smaller than this share of the main drawing is a
// neighbour's severed piece, not part of this drawing.
const STRAY_SHARE = 0.15;

// A fill this close to pure white is paper as far as the eye is concerned, so
// painting it as a fill costs an outline and a layer for no visible gain. The
// wind card is the case: its astronaut's white spacesuit is a genuine interior
// region walled off by its own ink outline, and treating it as a colour took
// the SVG from 95KB to 410KB while looking identical. A pale CREAM is a
// different matter and stays a fill — an alarm clock's face sits 30 from white,
// well outside this.
const WHITE_MERGE = 8;

const DEFAULTS = {
  fills: 0,        // 0 = work the count out from the picture
  ink: 130,        // luminance below this is line
  // `paper` is no longer how the flatten decides what is background — that is
  // `bgTol`, a distance to the sampled background COLOUR. It survives as the
  // shared definition of "too bright to be a fill" that the test uses to build
  // its own comparison mask, so the two agree on which pixels are being judged.
  paper: 243,
  band: 3,         // px of anti-aliased collar to keep out of the palette
  median: 3,       // paper-grain filter, applied AFTER the upscale
  upscale: 3,
  smooth: 9,       // median filter on the LABEL map
  // How close to the background colour a pixel must be to count as paper. Has
  // to clear a white suit (~5 from white) without swallowing a cream face
  // (~34). 15 sits in that gap.
  bgTol: 15,
  speckle: 10,
  // `ink: 'auto'` picks the threshold per drawing so the traced line weight
  // matches the source, rather than taking whatever the fixed default gives.
  inkTol: 0.015,   // stop once within this of the source
  inkSteps: 2,     // extra secant steps after the first correction
};

// ── deterministic RNG ──────────────────────────────────────────────────────
// Seeded so a card always traces to the same SVG. Re-tracing on a whim and
// getting a different file is how a "fixed" version turns out to be a reroll.
function rng(seed) {
  let a = (seed + 0x6d2b79f5) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── k-means over RGB ───────────────────────────────────────────────────────
function lloyd(X, n, C, iters = 40) {
  const k = C.length / 3;
  const sum = new Float64Array(k * 3), cnt = new Float64Array(k);
  for (let it = 0; it < iters; it++) {
    sum.fill(0); cnt.fill(0);
    for (let i = 0; i < n; i++) {
      const r = X[i * 3], g = X[i * 3 + 1], b = X[i * 3 + 2];
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const dr = r - C[j * 3], dg = g - C[j * 3 + 1], db = b - C[j * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = j; }
      }
      sum[best * 3] += r; sum[best * 3 + 1] += g; sum[best * 3 + 2] += b; cnt[best]++;
    }
    let moved = 0;
    for (let j = 0; j < k; j++) {
      if (!cnt[j]) continue;
      for (let c = 0; c < 3; c++) {
        const v = sum[j * 3 + c] / cnt[j];
        moved = Math.max(moved, Math.abs(v - C[j * 3 + c]));
        C[j * 3 + c] = v;
      }
    }
    if (moved < 0.4) break;
  }
  return C;
}

/** k-means++ seeding, best of a few restarts by inertia.
 *
 * Plain Lloyd's from a random pick is NOT good enough here and it shipped once:
 * on the weight card at k=4 it split one pastel in half and left the grey
 * hammer head merged into the lilac, so the closest pair of centres came out
 * 8.6 apart when the four real colours are never nearer than 28 — which then
 * fooled pickFills, whose whole decision is that number.
 */
function kmeans(X, n, k, { seed = 0, restarts = Number(process.env.VEC_RESTARTS) || 4, iters = 40 } = {}) {
  let best = null, bestCost = Infinity;
  const d2 = new Float64Array(n);
  for (let r = 0; r < restarts; r++) {
    const rand = rng(seed + r);
    const C = new Float64Array(k * 3);
    let p = Math.min(n - 1, Math.floor(rand() * n));
    C[0] = X[p * 3]; C[1] = X[p * 3 + 1]; C[2] = X[p * 3 + 2];
    for (let j = 1; j < k; j++) {                       // ++ seeding
      let tot = 0;
      for (let i = 0; i < n; i++) {
        let bd = Infinity;
        for (let m = 0; m < j; m++) {
          const dr = X[i * 3] - C[m * 3], dg = X[i * 3 + 1] - C[m * 3 + 1], db = X[i * 3 + 2] - C[m * 3 + 2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bd) bd = d;
        }
        d2[i] = bd; tot += bd;
      }
      let pick = Math.min(n - 1, Math.floor(rand() * n));
      if (tot > 0) {
        let t = rand() * tot, acc = 0;
        for (let i = 0; i < n; i++) { acc += d2[i]; if (acc >= t) { pick = i; break; } }
      }
      C[j * 3] = X[pick * 3]; C[j * 3 + 1] = X[pick * 3 + 1]; C[j * 3 + 2] = X[pick * 3 + 2];
    }
    lloyd(X, n, C, iters);
    let cost = 0;
    for (let i = 0; i < n; i++) {
      let bd = Infinity;
      for (let j = 0; j < k; j++) {
        const dr = X[i * 3] - C[j * 3], dg = X[i * 3 + 1] - C[j * 3 + 1], db = X[i * 3 + 2] - C[j * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) bd = d;
      }
      cost += bd;
    }
    if (cost < bestCost) { bestCost = cost; best = C; }
  }
  return best;
}

function assign(X, n, C) {
  const k = C.length / 3, lab = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let bj = 0, bd = Infinity;
    for (let j = 0; j < k; j++) {
      const dr = X[i * 3] - C[j * 3], dg = X[i * 3 + 1] - C[j * 3 + 1], db = X[i * 3 + 2] - C[j * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; bj = j; }
    }
    lab[i] = bj;
  }
  return lab;
}

function subsample(X, n, cap) {
  const step = Math.max(1, Math.floor(n / cap));
  if (step === 1) return { X, n };
  const m = Math.floor((n + step - 1) / step), S = new Float64Array(m * 3);
  for (let i = 0, j = 0; i < n; i += step, j++) {
    S[j * 3] = X[i * 3]; S[j * 3 + 1] = X[i * 3 + 1]; S[j * 3 + 2] = X[i * 3 + 2];
  }
  return { X: S, n: m };
}

/** How many colours does this drawing actually have?
 *
 * Hand-picking it per card does not scale to a folder, and getting it wrong is
 * the difference between a grey hammer head and a lilac one. So: take the
 * LARGEST k whose clusters are all genuinely distinct — every pair of centres
 * at least `apart` in RGB, every cluster holding at least `share` of the fill
 * pixels. One too many and the extra cluster splits a real colour or latches
 * onto noise; one too few and two colours merge.
 *
 * `apart` is MEASURED, not picked. On the weight card, whose answer is known to
 * be 4, the closest pair of centres runs 28.6 / 27.5 / 29.1 at k=2,3,4 and then
 * falls off a cliff to 19.5 at k=5 and 7.9 at k=6 — because from k=5 on the
 * only way to make another cluster is to cut a real colour in half. 24 sits in
 * that gap. Re-measure before changing it.
 *
 * `share` has to be SMALL — an accent on one astronaut's backpack is a real
 * colour and only ~2-4% of the fill pixels; at 4% the mint pack vanished off
 * three cards. What a small cluster must NOT be is the paper's own soft edge,
 * which shows up as a near-white centre — so `frompaper` rejects those by
 * COLOUR instead. Sizing alone could not tell them apart.
 */
function pickFills(X, n, { lo = 2, hi = 7, apart = 24, share = 0.012, frompaper = 25 } = {}) {
  const s = subsample(X, n, 20000);
  let best = null;
  for (let k = lo; k <= hi; k++) {
    const C = kmeans(s.X, s.n, k);
    const lab = assign(s.X, s.n, C);
    const counts = new Float64Array(k);
    for (let i = 0; i < s.n; i++) counts[lab[i]]++;
    // A near-white cluster is the paper's own soft edge. It is harmless (it
    // paints white beside white) so it must NOT be judged and must NOT veto the
    // count: on the co-orbital card the true k=5 was thrown out by one
    // (241,241,241) centre and the planet lost its mint and pink.
    const real = [];
    for (let j = 0; j < k; j++) {
      const dr = C[j * 3] - 255, dg = C[j * 3 + 1] - 255, db = C[j * 3 + 2] - 255;
      if (Math.sqrt(dr * dr + dg * dg + db * db) >= frompaper) real.push(j);
    }
    if (!real.length) continue;
    // DISTANCE is judged over pairs of REAL centres, and additionally over any
    // pair where BOTH are pale. SHARE is judged over the real ones only.
    //
    // Each clause was earned. A near-white centre must not veto a good k on
    // SIZE — that is what threw out the co-orbital card's true k=5 and lost the
    // planet its mint and pink. But two PALE surfaces cannot both be real, and
    // exempting them entirely let one smooth face split into two: an alarm
    // clock came out with fills at (253,246,238) and (253,242,228), ten apart,
    // mottling what should be one cream. Judging distance over ALL pairs
    // instead was too blunt and cost the mirror card a colour, so the pale-pair
    // test is scoped by `palish` — 45 from white, which sits in a clean gap
    // (the clock's pair are 21 and 30 from white; the mirror's nearest pair are
    // 69 and 101).
    const palish = [];
    for (let j = 0; j < k; j++) {
      if (Math.hypot(C[j * 3] - 255, C[j * 3 + 1] - 255, C[j * 3 + 2] - 255) < 45) palish.push(j);
    }
    const gap = (a, b) => Math.hypot(C[a * 3] - C[b * 3], C[a * 3 + 1] - C[b * 3 + 1], C[a * 3 + 2] - C[b * 3 + 2]);
    let minD = Infinity, minShare = Infinity;
    for (const a of real) {
      minShare = Math.min(minShare, counts[a] / s.n);
      for (const b of real) if (a !== b) minD = Math.min(minD, gap(a, b));
    }
    for (let x = 0; x < palish.length; x++) {
      for (let y = x + 1; y < palish.length; y++) minD = Math.min(minD, gap(palish[x], palish[y]));
    }
    if (real.length === 1 && palish.length < 2) minD = Infinity;
    if (minD >= apart && minShare >= share) best = C;
  }
  // RETURN THE CENTRES, not just the count. Deciding k on one clustering and
  // then re-clustering to paint is deciding about colours you never used — a
  // near-white centre rejected here reappeared in the output because the second
  // run found a different set. One clustering, start to finish.
  return best || kmeans(s.X, s.n, lo);
}

// ── masks ──────────────────────────────────────────────────────────────────
/** scipy's binary_dilation with its default cross, iterated `iters` times. */
function dilate(mask, w, h, iters) {
  let cur = mask;
  for (let it = 0; it < iters; it++) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (cur[i] ||
            (x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) ||
            (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) out[i] = 1;
      }
    }
    cur = out;
  }
  return cur;
}

/** Exact squared EDT of one line (Felzenszwalb & Huttenlocher), with argmin. */
function edt1d(f, n, d, arg, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    arg[q] = v[k];
  }
}

/** Exact Euclidean distance to the nearest `src` pixel, plus WHICH one it is.
 *  `src` is the set being measured to; distance is 0 on it. */
function edt(src, w, h, wantIndices) {
  const INF = 1e12;
  const dy = new Float64Array(w * h), ay = new Int32Array(wantIndices ? w * h : 0);
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n);
  const arg = new Int32Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {                       // down each column
    for (let y = 0; y < h; y++) f[y] = src[y * w + x] ? 0 : INF;
    edt1d(f, h, d, arg, v, z);
    for (let y = 0; y < h; y++) {
      dy[y * w + x] = d[y];
      if (wantIndices) ay[y * w + x] = arg[y];
    }
  }
  const dist = new Float64Array(w * h);
  const iy = wantIndices ? new Int32Array(w * h) : null;
  const ix = wantIndices ? new Int32Array(w * h) : null;
  for (let y = 0; y < h; y++) {                       // then along each row
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = dy[row + x];
    edt1d(f, w, d, arg, v, z);
    for (let x = 0; x < w; x++) {
      dist[row + x] = Math.sqrt(d[x]);
      if (wantIndices) { ix[row + x] = arg[x]; iy[row + x] = ay[row + arg[x]]; }
    }
  }
  return { dist, iy, ix };
}

/** Median filter over the LABEL map. Labels are a handful of small ints plus
 *  -1 for "not a fill", so a sliding histogram is exact and ~4x cheaper than
 *  reading the whole window per pixel. */
function medianLabels(LAB, w, h, size, k) {
  const r = (size - 1) >> 1, out = new Int16Array(w * h);
  const hist = new Int32Array(k + 1);                 // bin 0 is the -1 label
  const at = (x, y) => LAB[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] + 1;
  for (let y = 0; y < h; y++) {
    hist.fill(0);
    let total = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) { hist[at(dx, y + dy)]++; total++; }
    }
    for (let x = 0; x < w; x++) {
      const half = (total >> 1) + 1;                  // scipy takes the upper median
      let acc = 0, val = 0;
      for (let b = 0; b <= k; b++) { acc += hist[b]; if (acc >= half) { val = b; break; } }
      out[y * w + x] = val - 1;
      if (x < w - 1) {
        for (let dy = -r; dy <= r; dy++) { hist[at(x - r, y + dy)]--; hist[at(x + r + 1, y + dy)]++; }
      }
    }
  }
  return out;
}

// ── the flatten ────────────────────────────────────────────────────────────
/** The picture as exactly `fills + 2` flat colours: the fills, ink, and paper.
 *  Returns { data, width, height, colors } — `data` is raw RGB. */
async function flatten(input, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  let img = sharp(input).ensureAlpha();
  const meta = await img.metadata();
  // A cut-out arrives with transparency: put it on paper first, or the flatten
  // reads the empty space as black.
  img = sharp(await img.png().toBuffer())
    .flatten({ background: '#ffffff' })
    .removeAlpha();
  const W = Math.round((meta.width || 512) * o.upscale);
  const H = Math.round((meta.height || 512) * o.upscale);
  if (o.upscale > 1) img = img.resize(W, H, { kernel: 'lanczos3', fit: 'fill' });
  // AFTER the upscale, never before — see the header.
  if (o.median) img = img.median(o.median);
  const { data: raw, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, N = w * h;

  const lum = new Float64Array(N);
  const inkm = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const l = 0.299 * raw[i * 3] + 0.587 * raw[i * 3 + 1] + 0.114 * raw[i * 3 + 2];
    lum[i] = l;
    if (l < o.ink) inkm[i] = 1;
  }
  // PAPER IS WHAT MATCHES THE BACKGROUND COLOUR, not merely what is bright.
  //
  // A plain brightness threshold puts a knife-edge through any pale FILL that
  // happens to sit near it. Measured on an alarm clock whose cream face spans
  // luminance 242-246 against a threshold of 243: 3,144 pixels of one smooth
  // face crossed to pure white while 1,825 stayed cream — the "weird cream
  // spots in the white area" Sophie reported. Comparing to the background
  // COLOUR separates them cleanly: that cream sits 34 from white, while a white
  // spacesuit or a white badge sits about 5 and is genuinely paper.
  //
  // A border-connected flood fill was tried first and is worse. It classifies
  // every enclosed white — a suit, an eye — as a FILL, which floods the
  // clustering population with near-white pixels and crowds out small saturated
  // details: a lantern lost its gold candle flame (247,202,106) entirely, and
  // the wind card's SVG tripled. Distance to the background costs nothing and
  // has neither problem.
  const bg = [0, 0, 0];
  {
    const edgeIdx = [];
    for (let x = 0; x < w; x += 2) { edgeIdx.push(x); edgeIdx.push((h - 1) * w + x); }
    for (let y = 0; y < h; y += 2) { edgeIdx.push(y * w); edgeIdx.push(y * w + w - 1); }
    for (let c = 0; c < 3; c++) {
      const v = edgeIdx.map((i) => raw[i * 3 + c]).sort((a, b) => a - b);
      bg[c] = v.length ? v[v.length >> 1] : 255;
    }
  }
  const paperm = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (inkm[i]) continue;
    const dr = raw[i * 3] - bg[0], dg = raw[i * 3 + 1] - bg[1], db = raw[i * 3 + 2] - bg[2];
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= o.bgTol) paperm[i] = 1;
  }

  const edge = dilate(inkm, w, h, o.band);            // see (1)
  const solid = new Uint8Array(N);
  let ns = 0;
  for (let i = 0; i < N; i++) if (!inkm[i] && !paperm[i] && !edge[i]) { solid[i] = 1; ns++; }
  if (!ns) throw new Error('nothing but ink and paper — is this a flat-colour drawing?');

  const pix = new Float64Array(ns * 3), idx = new Int32Array(ns);
  for (let i = 0, j = 0; i < N; i++) {
    if (!solid[i]) continue;
    pix[j * 3] = raw[i * 3]; pix[j * 3 + 1] = raw[i * 3 + 1]; pix[j * 3 + 2] = raw[i * 3 + 2];
    idx[j++] = i;
  }
  const C = o.fills                                   // see (2)
    ? (() => { const s = subsample(pix, ns, 40000); return kmeans(s.X, s.n, o.fills); })()
    : pickFills(pix, ns);
  const k = C.length / 3;
  const labs = assign(pix, ns, C);

  const cols = [];                                    // each cluster's MEDIAN real colour
  for (let j = 0; j < k; j++) {
    const ch = [[], [], []];
    for (let i = 0; i < ns; i++) if (labs[i] === j) { ch[0].push(pix[i * 3]); ch[1].push(pix[i * 3 + 1]); ch[2].push(pix[i * 3 + 2]); }
    cols.push(ch.map((a) => {
      if (!a.length) return 255;
      a.sort((x, y) => x - y);
      const m = a.length >> 1;
      return Math.round(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2);
    }));
  }

  let LAB = new Int16Array(N).fill(-1);
  for (let i = 0; i < ns; i++) LAB[idx[i]] = labs[i];
  if (o.smooth) {
    // The window sees -1 wherever a pixel is not a fill, so near any line the
    // median comes back -1 — and a -1 reaching the paint step becomes cluster
    // 0. That is what put pink crescents inside the moon's craters and along
    // the feather's spine. Keep only the smoothed labels that are real ones.
    const sm = medianLabels(LAB, w, h, o.smooth, k);
    for (let i = 0; i < N; i++) if (solid[i] && sm[i] >= 0) LAB[i] = sm[i];
  }

  const { dist: dF, iy, ix } = edt(solid, w, h, true);   // see (3)
  const { dist: dP } = edt(paperm, w, h, false);
  const out = Buffer.alloc(N * 3);
  // The ink's OWN colour, from its core (the <60 pixels, away from the
  // anti-aliased edge) — a hard-coded dark grey turned the Grand Tour card's
  // black background into charcoal. Fall back when a card has no deep black.
  const core = [[], [], []];
  for (let i = 0; i < N; i++) if (lum[i] < 60) { core[0].push(raw[i * 3]); core[1].push(raw[i * 3 + 1]); core[2].push(raw[i * 3 + 2]); }
  const inkCol = core[0].length > 200
    ? core.map((a) => { a.sort((x, y) => x - y); const m = a.length >> 1; return Math.round(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2); })
    : [26, 26, 26];
  const asPaper = cols.map((c) => Math.hypot(c[0] - 255, c[1] - 255, c[2] - 255) <= WHITE_MERGE);
  for (let i = 0; i < N; i++) {
    let c;
    if (inkm[i]) c = inkCol;
    else if (paperm[i] || (!solid[i] && dP[i] <= dF[i])) c = [255, 255, 255];
    else {
      const lab = LAB[iy[i] * w + ix[i]];
      if (lab < 0) throw new Error('a pixel was left unlabelled — it would be painted cluster 0');
      c = asPaper[lab] ? [255, 255, 255] : cols[lab];
    }
    out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
  }
  // Report only the colours the picture actually shows — a cluster merged into
  // paper is not one of its fills.
  return {
    data: out, width: w, height: h,
    colors: cols.filter((c, j) => !asPaper[j]).map((c) => c.map(Math.round)),
  };
}

/** How much of a picture is line, at a fixed reference threshold.
 *  The yardstick both sides of the calibration are measured against. */
async function inkShare(buf, width) {
  let s = sharp(buf).flatten({ background: '#ffffff' }).removeAlpha();
  if (width) s = s.resize(width, width, { fit: 'fill' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  const N = info.width * info.height;
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2] < DEFAULTS.ink) n++;
  }
  return { share: n / N, width: info.width };
}

/** Trace with the ink threshold CHOSEN so the drawn line weight matches the
 *  source, instead of accepting whatever the default gives.
 *
 *  `ink` decides where a soft edge stops being a line, so it sets the stroke
 *  weight of the whole drawing — and the error it produces is smooth and
 *  monotonic in it. Measured on a strawberry at a 205px cell: +14.1% at ink
 *  130, +10.5% at 124, +8.7% at 118, +5.7% at 110, +1.6% at 100. An acorn
 *  crosses zero around 108. So there is nothing fundamental about landing a few
 *  percent heavy; the fixed default was simply one guess for every picture.
 *
 *  Two probes fix a line through (ink, error), and the root of that line is the
 *  next guess — a secant search. Three traces instead of one, and the trace is
 *  free, so the only cost is a few seconds.
 */
async function calibrate(input, o) {
  const want = await inkShare(input);
  const at = async (ink) => {
    const out = await vectorize(input, { ...o, ink });
    const got = await inkShare(Buffer.from(out.svg), want.width);
    return { ink, err: (got.share - want.share) / want.share, out };
  };
  let a = await at(o.ink);
  if (Math.abs(a.err) <= o.inkTol) return { ...a.out, ink: a.ink, inkErr: a.err, probes: 1 };
  // Step toward the answer using the slope measured above: about 0.9% of line
  // weight per unit of threshold, from the sweep. Bracketing first would cost
  // an extra trace for nothing.
  let b = await at(clampInk(Math.round(a.ink - a.err / 0.009)));
  for (let i = 0; i < o.inkSteps; i++) {
    const best = Math.abs(b.err) < Math.abs(a.err) ? b : a;
    if (Math.abs(best.err) <= o.inkTol) break;
    if (a.ink === b.ink || a.err === b.err) break;
    const next = clampInk(Math.round(b.ink - b.err * (b.ink - a.ink) / (b.err - a.err)));
    if (next === b.ink || next === a.ink) break;
    a = b; b = await at(next);
  }
  const best = Math.abs(b.err) < Math.abs(a.err) ? b : a;
  return { ...best.out, ink: best.ink, inkErr: best.err, probes: 2 + o.inkSteps };
}

const clampInk = (v) => Math.max(80, Math.min(200, v));

/** A flat-colour PNG/JPEG/WEBP buffer -> { svg, colors, ms }. */
async function vectorize(input, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (o.ink === 'auto') return calibrate(input, { ...o, ink: DEFAULTS.ink });
  const t0 = Date.now();
  const flat = await flatten(input, o);
  const png = await sharp(flat.data, { raw: { width: flat.width, height: flat.height, channels: 3 } })
    .png().toBuffer();
  const v = tracer();
  let svg = await v.vectorize(png, {
    colorMode: v.ColorMode.Color,
    hierarchical: v.Hierarchical.Stacked,
    mode: v.PathSimplifyMode.Spline,
    filterSpeckle: o.speckle,
    colorPrecision: 8,
    layerDifference: 0,
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    pathPrecision: 8,
  });
  svg = String(svg);
  // vtracer writes no viewBox, so add one — without it the SVG does not scale,
  // which is the entire point of having it.
  if (!svg.includes('viewBox')) {
    svg = svg.replace(`width="${flat.width}" height="${flat.height}"`,
      `viewBox="0 0 ${flat.width} ${flat.height}" width="${flat.width}" height="${flat.height}"`);
  }
  return { svg, colors: flat.colors, flatPng: png, ms: Date.now() - t0 };
}

/** Lift a drawing off its paper: flood-fill the near-white in from all four
 *  corners, trim to the ink, and re-pad square.
 *
 *  Corner flood-fill, NOT a global white threshold — the white INSIDE a drawing
 *  (an astronaut's suit, a badge's face) is the same white as the paper, and
 *  thresholding punches holes straight through it. Only white that a corner can
 *  reach is background.
 */
async function cutout(input, { tol = 22, pad = 0.04 } = {}) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels, N = w * h;
  const bg = new Uint8Array(N);
  const near = (i) => data[i * ch] >= 255 - tol && data[i * ch + 1] >= 255 - tol && data[i * ch + 2] >= 255 - tol;
  const stack = [];
  for (const i of [0, w - 1, (h - 1) * w, h * w - 1]) if (near(i) && !bg[i]) { bg[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0 && !bg[i - 1] && near(i - 1)) { bg[i - 1] = 1; stack.push(i - 1); }
    if (x < w - 1 && !bg[i + 1] && near(i + 1)) { bg[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !bg[i - w] && near(i - w)) { bg[i - w] = 1; stack.push(i - w); }
    if (y < h - 1 && !bg[i + w] && near(i + w)) { bg[i + w] = 1; stack.push(i + w); }
  }
  const out = Buffer.alloc(N * 4);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < N; i++) {
    out[i * 4] = data[i * ch]; out[i * 4 + 1] = data[i * ch + 1]; out[i * 4 + 2] = data[i * ch + 2];
    out[i * 4 + 3] = bg[i] ? 0 : 255;
    if (!bg[i]) {
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error('the whole cell is background — nothing was drawn in it');

  // Drop a fragment that has intruded from a neighbouring cell. Gutter-aware
  // slicing makes this rare, but a sheet whose drawings genuinely touch has no
  // clear cut and the severed piece lands here. The test is deliberately narrow
  // — SMALL and TOUCHING THE BORDER — because that is what an intrusion is: a
  // drawing's own small parts (a seed, a grass tuft, a dot over an i) sit
  // inside the frame and are kept, and a big drawing that fills its cell is the
  // largest component and is kept whatever it touches.
  const comp = new Int32Array(N).fill(-1);
  const sizes = [], touches = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (bg[s0] || comp[s0] >= 0) continue;
    const id = sizes.length; let n = 0, edge = false;
    const st = [s0]; comp[s0] = id;
    while (st.length) {
      const i = st.pop(); n++;
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !bg[i - 1] && comp[i - 1] < 0) { comp[i - 1] = id; st.push(i - 1); }
      if (x < w - 1 && !bg[i + 1] && comp[i + 1] < 0) { comp[i + 1] = id; st.push(i + 1); }
      if (y > 0 && !bg[i - w] && comp[i - w] < 0) { comp[i - w] = id; st.push(i - w); }
      if (y < h - 1 && !bg[i + w] && comp[i + w] < 0) { comp[i + w] = id; st.push(i + w); }
    }
    sizes.push(n); touches.push(edge);
  }
  const biggest = Math.max(...sizes);
  const drop = sizes.map((n, j) => touches[j] && n < biggest * STRAY_SHARE);
  if (drop.some(Boolean)) {
    x0 = w; y0 = h; x1 = -1; y1 = -1;
    for (let i = 0; i < N; i++) {
      if (!bg[i] && drop[comp[i]]) { bg[i] = 1; out[i * 4 + 3] = 0; continue; }
      if (bg[i]) continue;
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
  const side = Math.round(Math.max(cw, chh) * (1 + pad * 2));
  // Trim to the ink then re-pad SQUARE, so every card in a set reads the same
  // visual size however tall or wide the drawing in it happened to be.
  const trimmed = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: cw, height: chh })
    .extend({
      top: Math.round((side - chh) / 2), bottom: side - chh - Math.round((side - chh) / 2),
      left: Math.round((side - cw) / 2), right: side - cw - Math.round((side - cw) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png().toBuffer();
  return trimmed;
}

/** Where a sheet's real gutters are, one boundary at a time.
 *
 * Cutting on exact fractions LOOKS right and is not: the model does not place
 * its drawings on a perfect grid, and a boundary that lands on ink does two
 * visible things at once — it clips the drawing it cuts through, and it leaves
 * the severed piece behind in the NEIGHBOURING cell as a stray mark. Both
 * shipped: on a 3x3 sheet the second row cut fell at y=682 while the real
 * gutter was 622-674, so the bottom row's drawings lost their tops and the
 * sailboat came out with a dot floating above its flag — the tail of the
 * balloons' string from the cell above.
 *
 * So: project the ink onto each axis, and for every interior boundary take the
 * WIDEST run of completely clear pixels near where the boundary should be,
 * cutting through its middle. With no clear run the fraction is used after all
 * — there is no better answer when the drawings genuinely touch — and the
 * caller is told, because that sheet needs looking at.
 */
async function gutters(input, cols, rows) {
  const { data, info } = await sharp(input).flatten({ background: '#ffffff' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const colInk = new Float64Array(W), rowInk = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 245) { colInk[x]++; rowInk[y]++; }
    }
  }
  const cutsOn = (ink, n, len) => {
    const at = [0], missed = [];
    for (let k = 1; k < n; k++) {
      const want = Math.round((k * len) / n);
      // Search a third of a cell either side — enough to find a gutter the
      // model nudged, not so much that it can find the NEXT gutter along.
      const reach = Math.floor(len / n / 3);
      let best = null;
      for (let x = Math.max(1, want - reach); x <= Math.min(len - 2, want + reach); x++) {
        if (ink[x] !== 0) continue;
        let e = x;
        while (e + 1 < len && ink[e + 1] === 0) e++;
        if (!best || e - x > best[1] - best[0]) best = [x, e];
        x = e;
      }
      if (best) at.push(Math.round((best[0] + best[1]) / 2));
      else { at.push(want); missed.push(want); }
    }
    at.push(len);
    return { at, missed };
  };
  const cx = cutsOn(colInk, cols, W), cy = cutsOn(rowInk, rows, H);
  return { x: cx.at, y: cy.at, missed: cx.missed.length + cy.missed.length };
}

/** Slice a sheet into its cells, in reading order, cutting on the real gutters.
 *  Returns the buffers; `slice.report` on the result carries what it did. */
async function slice(input, cols = 2, rows = 2) {
  const g = await gutters(input, cols, rows);
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(await sharp(input).extract({
        left: g.x[c], top: g.y[r],
        width: g.x[c + 1] - g.x[c], height: g.y[r + 1] - g.y[r],
      }).png().toBuffer());
    }
  }
  out.report = { x: g.x, y: g.y, missed: g.missed };
  return out;
}

module.exports = { vectorize, calibrate, inkShare, flatten, cutout, slice, gutters, DEFAULTS, kmeans, pickFills, edt, dilate, medianLabels };

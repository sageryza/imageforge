// mpc-upload.js — full-auto MPC upload (everything EXCEPT payment).
//
// The ZIP hand-off (mpc.js) still needs a human to run the desktop tool. This
// module removes that step: it drives a real browser in the cloud to log into
// MakePlayingCards, create the deck project, upload every prepped card, set the
// options, and land in the cart — then STOPS. Sophie logs in, reviews, and pays.
// Payment is never automated (by design and by request).
//
//   card image URLs → [prep] → headless browser: login · upload · options · cart → (human pays)
//
// IMPORTANT — calibration. MPC's editor DOM is not publicly documented and their
// site changes over time (that churn is the whole reason the maintained MPC
// Autofill desktop tool exists). The engine here is generic and tested against a
// mock site; the MPC-specific URLs/selectors live in ONE block (DEFAULT_FLOW) and
// every step is screenshotted, so the first supervised real run just tunes that
// block. Treat this as "engine done, selectors need a live calibration pass."
//
// Runtime: needs a browser-capable host (Playwright + Chromium). That is NOT the
// Render free web service — run this where a browser can live (a worker, a Mac,
// or this kind of container). playwright is an OPTIONAL dependency; the route
// reports unavailable when it or the browser isn't installed.
//
// Mounted at /api/mpc/upload by server.js. STUDIO_TOKEN-gated.

const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium = null;
try { ({ chromium } = require('playwright')); }
catch (e) { console.warn('mpc-upload: playwright unavailable —', e.message); }

const mpc = require('./mpc');
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

function mpcCreds() {
  return { email: process.env.MPC_EMAIL || '', password: process.env.MPC_PASSWORD || '' };
}

// ─── MPC-specific flow (THE calibration block) ──────────────────────
// Overridable per-call via opts.flow (the mock test does exactly that). Selectors
// are best-effort and marked for a live calibration pass.
const DEFAULT_FLOW = {
  loginUrl: process.env.MPC_LOGIN_URL || 'https://www.makeplayingcards.com/login.aspx',
  // "design your own" starting point for the deck product (poker by default).
  productUrl: process.env.MPC_PRODUCT_URL ||
    'https://www.makeplayingcards.com/design/custom-back-standard-mpc-playing-cards.html',
  sel: {
    email: '#txtEmail, #email, input[name*=email i]',
    password: '#txtPassword, #password, input[type=password]',
    loginSubmit: '#btnLogin, button[type=submit], input[type=submit]',
    loginSuccess: 'text=/log ?out|my account|sign out/i',
    // The upload control on the editor. Often a hidden <input type=file>.
    uploadInput: 'input[type=file]',
    // Quantity / options on the product page.
    qty: 'select[name*=qty i], #quantity, select[name*=quantity i]',
    addToCart: 'text=/add to cart|add to shopping cart/i',
    cartMarker: 'text=/shopping cart|proceed to checkout|your cart/i',
    // PAYMENT GUARD — if any of these appear we hard-stop; we never pay.
    paymentMarker: 'text=/payment method|credit card|billing address|place your order/i',
  },
  // Max ms to wait for the login-success signal before continuing anyway.
  loginTimeout: 30000,
};

function mergeFlow(base, override) {
  if (!override) return base;
  return {
    ...base, ...override,
    sel: { ...base.sel, ...(override.sel || {}) },
  };
}

// Prep every card image (reusing mpc.prepCardImage) into workDir/fronts,
// workDir/backs, or workDir/back.png. Returns the file lists.
async function prepToDir(spec, workDir) {
  const size = spec.size || 'poker';
  const mode = spec.mode || 'cover';
  const frontsDir = path.join(workDir, 'fronts');
  fs.mkdirSync(frontsDir, { recursive: true });
  const pad = (spec.fronts || []).length > 99 ? 3 : 2;

  const fronts = [];
  for (let i = 0; i < spec.fronts.length; i++) {
    const raw = await mpc.fetchImageBuffer(spec.fronts[i]);
    const { buffer } = await mpc.prepCardImage(raw, { size, mode });
    const p = path.join(frontsDir, `${String(i + 1).padStart(pad, '0')}.png`);
    fs.writeFileSync(p, buffer);
    fronts.push({ path: p, slot: i });
  }

  const backs = [];
  let back = null;
  if (Array.isArray(spec.backs) && spec.backs.length) {
    const backsDir = path.join(workDir, 'backs');
    fs.mkdirSync(backsDir, { recursive: true });
    for (let i = 0; i < spec.backs.length && i < spec.fronts.length; i++) {
      const raw = await mpc.fetchImageBuffer(spec.backs[i]);
      const { buffer } = await mpc.prepCardImage(raw, { size, mode });
      const p = path.join(backsDir, `${String(i + 1).padStart(pad, '0')}.png`);
      fs.writeFileSync(p, buffer);
      backs.push({ path: p, slot: i });
    }
  } else if (typeof spec.back === 'string') {
    const raw = await mpc.fetchImageBuffer(spec.back);
    const { buffer } = await mpc.prepCardImage(raw, { size, mode });
    back = path.join(workDir, 'back.png');
    fs.writeFileSync(back, buffer);
  }
  return { fronts, backs, back };
}

// The automation engine. Returns { ok, cartUrl, shots:[{step,path}], log:[] }.
// Every step is screenshotted; it stops at the cart and refuses to go past a
// payment page. onStep(update) streams progress to the caller (the job store).
async function driveMpcUpload(spec, opts = {}) {
  if (!chromium) throw new Error('playwright not installed (browser-capable host required)');
  const flow = mergeFlow(DEFAULT_FLOW, opts.flow);
  const creds = opts.creds || mpcCreds();
  const usingRealSite = !opts.flow;
  if (usingRealSite && (!creds.email || !creds.password)) {
    throw new Error('MPC_EMAIL / MPC_PASSWORD not configured');
  }
  if (!spec || !Array.isArray(spec.fronts) || !spec.fronts.length) {
    throw new Error('spec.fronts[] is required');
  }

  const workDir = opts.workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-upload-'));
  const shotsDir = path.join(workDir, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const log = [];
  const shots = [];
  let shotN = 0;
  const onStep = typeof opts.onStep === 'function' ? opts.onStep : () => {};
  const say = (m) => { log.push(m); onStep({ log: [...log], shots: [...shots] }); };

  const files = await prepToDir(spec, workDir);
  say(`prepped ${files.fronts.length} front(s)` +
    (files.backs.length ? ` + ${files.backs.length} back(s)` : files.back ? ' + shared back' : ''));

  const browser = await chromium.launch({
    headless: opts.headless !== false,
    // Optional override for hosts where the browser lives outside Playwright's
    // default cache (e.g. a prebuilt worker image). Normally unset.
    executablePath: opts.executablePath || process.env.MPC_BROWSER_PATH || undefined,
  });
  try {
    const page = await (await browser.newContext({ acceptDownloads: false })).newPage();
    page.setDefaultTimeout(opts.timeout || 30000);

    const shot = async (name) => {
      const p = path.join(shotsDir, `${String(++shotN).padStart(2, '0')}_${name}.png`);
      try { await page.screenshot({ path: p }); shots.push({ step: name, path: p }); } catch {}
      onStep({ log: [...log], shots: [...shots] });
    };

    // 1) LOGIN
    say('login');
    await page.goto(flow.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.fill(flow.sel.email, creds.email);
    await page.fill(flow.sel.password, creds.password);
    await page.click(flow.sel.loginSubmit);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator(flow.sel.loginSuccess).first()
      .waitFor({ timeout: flow.loginTimeout }).catch(() => say('login-success marker not seen; continuing'));
    await shot('after-login');

    // 2) OPEN THE DECK PRODUCT
    say('open product');
    await page.goto(flow.productUrl, { waitUntil: 'domcontentloaded' });
    await shot('product');

    // 3) UPLOAD FRONTS  (most site-specific step — calibration lands here)
    say('upload fronts');
    const frontPaths = files.fronts.map((f) => f.path);
    await page.setInputFiles(flow.sel.uploadInput, frontPaths).catch((e) => say('front upload failed: ' + e.message));
    await page.waitForLoadState('networkidle').catch(() => {});
    await shot('uploaded-fronts');

    // 3b) BACKS (optional)
    if (files.backs.length || files.back) {
      say('upload back(s)');
      const backPaths = files.backs.length ? files.backs.map((b) => b.path) : [files.back];
      // Re-query the file input; some editors expose a separate back uploader.
      await page.setInputFiles(flow.sel.uploadInput, backPaths).catch((e) => say('back upload failed: ' + e.message));
      await shot('uploaded-backs');
    }

    // 4) OPTIONS (quantity / stock)
    if (spec.quantity) {
      await page.selectOption(flow.sel.qty, String(spec.quantity)).catch(() => {});
    }

    // 5) ADD TO CART
    say('add to cart');
    await page.click(flow.sel.addToCart, { timeout: 20000 }).catch((e) => say('add-to-cart click failed: ' + e.message));
    await page.waitForLoadState('networkidle').catch(() => {});
    await shot('cart');

    // 6) PAYMENT GUARD — we never proceed to pay.
    const onPayment = await page.locator(flow.sel.paymentMarker).count().catch(() => 0);
    if (onPayment) say('payment page detected — STOPPING before payment (never automated)');

    const cartUrl = page.url();
    say(`stopped at cart: ${cartUrl}`);
    return { ok: true, cartUrl, shots, log, workDir };
  } finally {
    await browser.close();
  }
}

// ─── Background job store (in-memory; browser jobs are short-lived) ──
const jobs = new Map();
function newJobId() { return 'up_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

async function uploadShots(job) {
  const bucket = bucketOrNull();
  if (!bucket) return; // shots stay as local paths (fine for a worker run)
  for (const s of job.shots) {
    if (s.url || !s.path) continue;
    try {
      const buf = fs.readFileSync(s.path);
      const filename = `mpc-uploads/${job.id}/${path.basename(s.path)}`;
      const file = bucket.file(filename);
      await file.save(buf, { metadata: { contentType: 'image/png' } });
      await file.makePublic();
      s.url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    } catch { /* leave local path */ }
  }
}

function runJob(job, spec, opts) {
  job.status = 'running';
  driveMpcUpload(spec, {
    ...opts,
    onStep: (u) => {
      job.log = u.log || job.log;
      job.shots = (u.shots || job.shots).map((s) => {
        const prior = job.shots.find((x) => x.path === s.path);
        return prior && prior.url ? { ...s, url: prior.url } : s;
      });
    },
  }).then(async (result) => {
    job.cartUrl = result.cartUrl;
    job.shots = result.shots;
    await uploadShots(job);
    job.status = 'awaiting_payment';
    job.finishedAt = Date.now();
  }).catch(async (err) => {
    job.error = err.message;
    await uploadShots(job).catch(() => {});
    job.status = 'error';
    job.finishedAt = Date.now();
  });
}

function jobView(job) {
  return {
    id: job.id, status: job.status, cartUrl: job.cartUrl || null,
    error: job.error || null, log: job.log || [],
    shots: (job.shots || []).map((s) => ({ step: s.step, url: s.url || null })),
    startedAt: job.startedAt, finishedAt: job.finishedAt || null,
  };
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  const creds = mpcCreds();
  res.json({
    ok: true,
    ready: Boolean(chromium),
    playwright: Boolean(chromium),
    credentials: Boolean(creds.email && creds.password),
    note: 'Full auto-upload stops at the cart; payment is always manual. Needs a '
      + 'browser-capable host (not the Render free web service) and a live '
      + 'calibration pass on MPC selectors.',
  });
});

// POST /api/mpc/upload  — start an upload job. Body = the same deck spec as
// /api/mpc/prep-order (deckName, size, mode, quantity, fronts[], back|backs[]).
router.post('/', (req, res) => {
  if (!chromium) {
    return res.status(501).json({ error: 'playwright not installed on this host (browser-capable runtime required)' });
  }
  const spec = req.body || {};
  if (!Array.isArray(spec.fronts) || !spec.fronts.length) {
    return res.status(400).json({ error: 'fronts[] is required (image URLs or data URLs)' });
  }
  const creds = mpcCreds();
  if (!creds.email || !creds.password) {
    return res.status(400).json({ error: 'MPC_EMAIL / MPC_PASSWORD not configured' });
  }
  const job = { id: newJobId(), status: 'queued', log: [], shots: [], startedAt: Date.now() };
  jobs.set(job.id, job);
  runJob(job, spec, { headless: true });
  res.status(202).json({ ok: true, jobId: job.id, poll: `/api/mpc-upload/${job.id}` });
});

// GET /api/mpc/upload/:id — poll job status (log + screenshots + cart URL).
router.get('/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'no such job' });
  res.json(jobView(job));
});

module.exports = {
  router,
  configured: () => Boolean(chromium),
  driveMpcUpload,
  prepToDir,
  DEFAULT_FLOW,
  _jobs: jobs,
};

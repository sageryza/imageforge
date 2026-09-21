// mpc-upload.js — full-auto MPC upload (everything EXCEPT payment).
//
// The ZIP hand-off (mpc.js) still needs a human to run the desktop tool. This
// module removes that step: it drives a real browser in the cloud to log into
// MakePlayingCards, create the deck project, upload every prepped card, set the
// options, SAVE the project to her account and stop on the review page. Sophie
// opens Saved Projects, reviews, and orders. Nothing here touches the cart or
// payment (by design and by request).
//
//   card image URLs → [prep] → headless browser: login · options · upload · save → (she orders)
//
// IMPORTANT — calibration. MPC's editor DOM is not publicly documented and their
// site changes over time (that churn is the whole reason the maintained MPC
// Autofill desktop tool exists). The engine here is generic and tested against a
// mock site; the MPC-specific URLs/selectors live in ONE block (DEFAULT_FLOW).
// SINCE 2026-09-20 THAT BLOCK IS PORTED FROM THE MAINTAINED MPC AUTOFILL TOOL
// (chilli-axe/mpc-autofill, driver.py) — the ids and JS calls the community
// drives MPC with every day — so it is calibrated by source rather than by a
// guess. The first real run on her account is still the measurement; every
// step is screenshotted for it, and login refuses to go on blind.
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
const crypto = require('crypto');

let chromium = null;
try { ({ chromium } = require('playwright')); }
catch (e) { console.warn('mpc-upload: playwright unavailable —', e.message); }

const mpc = require('./mpc');
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

// Is a Chromium actually on disk for this Playwright? (The build installs
// chromium-headless-shell with PLAYWRIGHT_BROWSERS_PATH=0; a build that could
// not is honest here instead of failing on the first job.)
// Where the browser is: MPC_BROWSER_PATH, then Playwright's own idea, then the
// copy the Render build downloads into ./.pw-browsers (buildCommand sets
// PLAYWRIGHT_BROWSERS_PATH=.pw-browsers so the artifact carries it — no env var
// to remember at runtime), then the container's /opt/pw-browsers.
function findBrowser() {
  const cands = [];
  if (process.env.MPC_BROWSER_PATH) cands.push(process.env.MPC_BROWSER_PATH);
  if (chromium) { try { cands.push(chromium.executablePath()); } catch {} }
  for (const root of [path.join(__dirname, '.pw-browsers'), '/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright')]) {
    let dirs = [];
    try { dirs = fs.readdirSync(root); } catch { continue; }
    for (const d of dirs.sort().reverse()) {
      for (const tail of ['chrome-linux/headless_shell', 'chrome-linux/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
        cands.push(path.join(root, d, tail));
      }
    }
  }
  return cands.find((c) => c && fs.existsSync(c)) || null;
}
function browserInstalled() { return Boolean(chromium && findBrowser()); }

function mpcCreds() {
  return { email: process.env.MPC_EMAIL || '', password: process.env.MPC_PASSWORD || '' };
}

// ─── MPC-specific flow (THE calibration block) ──────────────────────
// Ported 2026-09-20 from the maintained MPC Autofill desktop tool
// (chilli-axe/mpc-autofill, desktop-tool/src/driver.py + constants.py), which
// drives exactly these ids and JS objects on makeplayingcards.com — so the
// selectors below are the community's calibrated ones, not guesses. MPC's
// editor is a JS app: the wizard is stepped with `oDesign.setNextStep()`,
// images upload through the hidden `#uploadId` input and are keyed by the
// SHA-1 of the file bytes (`oDesignImage.dn_getImageList()`), and a slot is
// filled with `PageLayout.prototype.applyDragPhoto(getElement3("dnImg", slot),
// 0, pid)`. The per-card-count and same/different-image controls live inside
// the `sysifm_loginFrame` iframe. Overridable per call via opts.flow (the mock
// test does exactly that).
//
// WHERE IT STOPS: the project is SAVED to the account and the run ends on the
// review page. Nothing here touches the cart or checkout — she opens Saved
// Projects, reviews, and orders by hand. That is the desktop tool's own
// stopping point too.
const DEFAULT_FLOW = {
  loginUrl: process.env.MPC_LOGIN_URL || 'https://www.makeplayingcards.com/login.aspx',
  logoutHref: 'https://www.makeplayingcards.com/logout.aspx',
  // The blank custom-deck starting point (the desktop tool's starting_url_route).
  startUrl: process.env.MPC_PRODUCT_URL || 'https://www.makeplayingcards.com/design/custom-blank-card.html',
  acceptSettingsUrl: 'https://www.makeplayingcards.com/products/pro_item_process_flow.aspx',
  sel: {
    email: '#txtEmail, #email, input[type=email], input[name*=email i]',
    password: '#txtPassword, #password, input[type=password]',
    loginSubmit: '#btnLogin, button[type=submit], input[type=submit]',
    stock: '#dro_paper_type',        // select, by visible text ("(S30) Standard Smooth")
    bracket: '#dro_choosesize',      // select, values are the bracket sizes (18, 36, 55 …)
    effect: '#dro_product_effect',   // select; foil is value EF_055
    frame: 'sysifm_loginFrame',      // iframe NAME holding the card-count box
    cardNumber: '#txt_card_number',  // inside the frame
    upload: '#uploadId',             // hidden <input type=file> on the editor
    loading: '#sysdiv_wait',         // MPC's loading circle
    projectName: '#txt_temporaryname',
    saveStatus: '#div_temporarysavestatus',
    closeBtn: '#closeBtn',
  },
  foilValue: 'EF_055',
  savedText: 'Saved successfully',
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

// An already-prepped deck folder (what mpc_card_prep.py / prep-order write):
// fronts/*.png in natural order, backs/*.png or back.png. No download, no prep.
function filesFromDir(dir) {
  const list = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((f) => path.join(d, f)) : []);
  const fronts = list(path.join(dir, 'fronts')).map((p, slot) => ({ path: p, slot }));
  const backs = list(path.join(dir, 'backs')).map((p, slot) => ({ path: p, slot }));
  const back = fs.existsSync(path.join(dir, 'back.png')) ? path.join(dir, 'back.png') : null;
  if (!fronts.length) throw new Error(`no fronts/*.png under ${dir}`);
  return { fronts, backs, back };
}

// A prep zip (fronts/, back.png or backs/, order.xml) unpacked into a deck
// folder the engine can run — what `scripts/mpc-upload-job.js` feeds it.
async function deckDirFromZip(zipBuf, dir) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(zipBuf);
  const entries = Object.values(zip.files).filter((f) => !f.dir && !/(^|\/)__MACOSX\//.test(f.name) && /\.(png|jpe?g)$/i.test(f.name));
  if (!entries.length) throw new Error('zip holds no card images');
  for (const e of entries) {
    // keep only the tail that matters: fronts/x.png · backs/x.png · back.png
    const m = e.name.match(/(?:^|\/)((?:fronts|backs)\/[^/]+|back\.png)$/i);
    if (!m) continue;
    const out = path.join(dir, m[1]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await e.async('nodebuffer'));
  }
  return dir;
}

const sha1Upper = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The automation engine. Returns { ok, projectName, reviewUrl, shots, log }.
// Every step is screenshotted; the project is SAVED to the account before the
// review page, and the run ends there. onStep(update) streams progress to the
// caller (the job store).
async function driveMpcUpload(spec, opts = {}) {
  if (!chromium) throw new Error('playwright not installed (browser-capable host required)');
  const flow = mergeFlow(DEFAULT_FLOW, opts.flow);
  const creds = opts.creds || mpcCreds();
  if (!creds.email || !creds.password) throw new Error('MPC_EMAIL / MPC_PASSWORD not configured');
  if (!opts.deckDir && (!spec || !Array.isArray(spec.fronts) || !spec.fronts.length)) {
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

  const files = opts.deckDir ? filesFromDir(opts.deckDir) : await prepToDir(spec, workDir);
  const quantity = files.fronts.length;
  const stock = mpc.normalizeStock(spec.stock);
  const projectName = String(spec.deckName || spec.name || 'Deck Factory deck').slice(0, 32);
  say(`prepped ${quantity} front(s)` +
    (files.backs.length ? ` + ${files.backs.length} back(s)` : files.back ? ' + shared back' : ''));

  // LOW-MEMORY LAUNCH. The live box is a 512MB Starter that idles near 300MB,
  // so the browser gets one renderer, no GPU, no /dev/shm, a small JS heap and
  // a viewport it never has to paint at full size. MPC_LAUNCH_ARGS adds more.
  const browser = await chromium.launch({
    headless: opts.headless !== false,
    executablePath: opts.executablePath || findBrowser() || undefined,
    args: [
      '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--no-sandbox',
      '--renderer-process-limit=1', '--disable-extensions', '--disable-background-networking',
      '--disable-features=site-per-process,IsolateOrigins', '--js-flags=--max-old-space-size=96',
      ...String(process.env.MPC_LAUNCH_ARGS || '').split(/\s+/).filter(Boolean),
      ...(opts.args || []),
    ],
  });
  try {
    const page = await (await browser.newContext({ acceptDownloads: false, viewport: { width: 1100, height: 800 } })).newPage();
    page.setDefaultTimeout(opts.timeout || 30000);
    page.on('dialog', (d) => d.accept().catch(() => {}));  // the tool's alert_handler

    const shot = async (name) => {
      const p = path.join(shotsDir, `${String(++shotN).padStart(2, '0')}_${name}.png`);
      try { await page.screenshot({ path: p }); shots.push({ step: name, path: p }); } catch {}
      onStep({ log: [...log], shots: [...shots] });
    };
    // wait(): until MPC's loading circle is gone (30s), else reload — returns whether it reloaded.
    const waitLoading = async () => {
      const el = page.locator(flow.sel.loading);
      if (!(await el.count())) return false;
      try { await el.first().waitFor({ state: 'hidden', timeout: 30000 }); return false; }
      catch { say('loading circle stuck 30s — reloading'); await page.reload({ waitUntil: 'domcontentloaded' }); return true; }
    };
    // wait_until_javascript_object_is_defined(): up to 10s, then carry on.
    const waitDefined = async (ctx, expr) => {
      const t = Date.now();
      while (Date.now() - t < 10000) {
        const ok = await ctx.evaluate((e) => { try { return eval(`typeof ${e}`) !== 'undefined'; } catch { return false; } }, expr).catch(() => false);
        if (ok) return true;
        await sleep(500);
      }
      say(`${expr} never defined after 10s — going on`);
      return false;
    };
    const js = async (ctx, code) => ctx.evaluate((c) => eval(c), code);
    // A step can navigate the editor (fronts → backs → review), so give the page a
    // beat to start it, then wait for the document and the loading circle.
    const nextStep = async () => {
      await waitLoading(); await waitDefined(page, 'oDesign.setNextStep');
      await js(page, 'oDesign.setNextStep();');
      await sleep(600); await page.waitForLoadState('domcontentloaded').catch(() => {}); await waitLoading();
    };
    // The card-count iframe is re-created on every editor page — find it fresh and
    // wait for its document, never keep a handle across a step.
    const editorFrame = async () => {
      await page.waitForSelector(`iframe[name="${flow.sel.frame}"]`, { timeout: 15000 }).catch(() => {});
      const fr = page.frame({ name: flow.sel.frame }) || page.frames().find((f) => f.name() === flow.sel.frame) || null;
      if (fr) await fr.waitForLoadState('domcontentloaded').catch(() => {});
      return fr;
    };
    const setMode = async (same) => {
      const fr = await editorFrame();
      if (!fr) { say('card-count frame not found'); return; }
      await waitDefined(fr, 'setMode'); await waitDefined(fr, 'oRenderFeature');
      await js(fr, `setMode('ImageText', ${same ? 1 : 0});`).catch((e) => say('setMode: ' + e.message));
    };
    const uploadedPids = async () => {
      await waitDefined(page, 'oDesignImage.dn_getImageList');
      const s = await js(page, 'oDesignImage.dn_getImageList()').catch(() => '');
      return s ? String(s).split(';') : [];
    };
    const uploading = async () => (await js(page, "oDesignImage.UploadStatus == 'Uploading'").catch(() => false)) === true;
    const uploadImage = async (file) => {
      const pid = sha1Upper(file);
      if ((await uploadedPids()).includes(pid)) return pid;
      const before = (await uploadedPids()).length;
      for (let tries = 0; tries < 3; tries++) {
        while (await uploading()) await sleep(500);
        await page.setInputFiles(flow.sel.upload, file);
        await sleep(1000);
        while (await uploading()) await sleep(500);
        if ((await uploadedPids()).length > before) return pid;
        say(`upload of ${path.basename(file)} did not register (try ${tries + 1})`);
      }
      throw new Error(`could not upload ${path.basename(file)} after 3 tries`);
    };
    const slotEl = (slot) => `PageLayout.prototype.getElement3("dnImg", "${slot}")`;
    const insertImage = async (pid, slots) => {
      await waitDefined(page, 'PageLayout.prototype.applyDragPhoto');
      for (const slot of slots) {
        const present = await js(page, `${slotEl(slot)} !== null`).catch(() => false);
        if (!present) { say(`slot ${slot} not on the page — skipped`); continue; }
        const have = await js(page, `${slotEl(slot)}.getAttribute('pid')`).catch(() => null);
        if (have === pid) continue;
        for (let tries = 0; tries < 3; tries++) {
          await js(page, `PageLayout.prototype.applyDragPhoto(${slotEl(slot)}, 0, "${pid}")`);
          if (!(await waitLoading())) break;
        }
      }
    };
    const saveProject = async () => {
      say(`save project "${projectName}"`);
      await waitLoading();
      await page.locator(flow.sel.projectName).first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.fill(flow.sel.projectName, projectName).catch((e) => say('project name box: ' + e.message));
      await waitDefined(page, 'oDesign.setTemporarySave');
      await js(page, 'oDesign.setTemporarySave();');
      await page.locator(flow.sel.saveStatus).filter({ hasText: flow.savedText }).first()
        .waitFor({ timeout: 30000 }).catch(() => say('save status not confirmed in 30s'));
    };

    // 1) LOGIN — and refuse to go on blind: everything after this writes into her account.
    say('login');
    await page.goto(flow.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.fill(flow.sel.email, creds.email);
    await page.fill(flow.sel.password, creds.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: flow.loginTimeout }).catch(() => {}),
      page.click(flow.sel.loginSubmit),
    ]);
    await page.waitForLoadState('networkidle').catch(() => {});
    const signedIn = await page.locator(`a[href="${flow.logoutHref}"]`).first()
      .waitFor({ timeout: flow.loginTimeout }).then(() => true).catch(() => false);
    await shot('after-login');
    if (!signedIn) throw new Error('login did not land (no logout link) — see the after-login screenshot');

    // 2) DEFINE THE PROJECT — stock, bracket, foil (define_project).
    say('define project');
    await page.goto(flow.startUrl, { waitUntil: 'domcontentloaded' });
    await page.locator(flow.sel.stock).waitFor();
    await page.selectOption(flow.sel.stock, { label: stock });
    const brackets = (await page.$$eval(`${flow.sel.bracket} option`, (os) => os.map((o) => parseInt(o.value, 10))))
      .filter((n) => Number.isFinite(n) && n >= quantity).sort((a, b) => a - b);
    if (!brackets.length) throw new Error(`${quantity} cards fits no MPC bracket`);
    await page.selectOption(flow.sel.bracket, String(brackets[0]));
    say(`stock ${stock}, bracket ${brackets[0]} for ${quantity} cards`);
    if (spec.foil) await page.selectOption(flow.sel.effect, flow.foilValue).catch((e) => say('foil: ' + e.message));
    await shot('project-defined');

    // 3) PAGE TO FRONTS — accept settings, set the exact card count, different image per card.
    say('page to fronts');
    await waitDefined(page, 'doPersonalize');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      js(page, `doPersonalize('${flow.acceptSettingsUrl}');`),
    ]);
    await waitLoading();
    {
      const fr = await editorFrame();
      if (fr) { await fr.fill(flow.sel.cardNumber, String(quantity)).catch((e) => say('card number: ' + e.message)); }
      else say('card-count frame not found on the fronts page');
    }
    await setMode(false);
    await shot('fronts-page');

    // 4) FRONTS — upload each file once (SHA-1 keyed) and drop it into its slot.
    say(`upload ${quantity} fronts`);
    for (const f of files.fronts) {
      const pid = await uploadImage(f.path);
      await insertImage(pid, [f.slot]);
      if ((f.slot + 1) % 10 === 0) { say(`${f.slot + 1}/${quantity} fronts in`); await shot(`fronts-${f.slot + 1}`); }
    }
    await shot('fronts-done');
    await saveProject();

    // 5) BACKS — page_to_backs, then the shared back into slot 0 or a back per slot.
    say('page to backs');
    await nextStep();
    const close = page.locator(flow.sel.closeBtn);
    if (await close.count() && await close.first().isVisible().catch(() => false)) await close.first().click().catch(() => {});
    await nextStep();
    await waitDefined(page, 'PageLayout.prototype.renderDesignCount');
    await js(page, 'PageLayout.prototype.renderDesignCount()').catch(() => {});
    const shared = !files.backs.length;
    await setMode(shared);
    await shot('backs-page');
    if (files.back) {
      const pid = await uploadImage(files.back);
      await insertImage(pid, [0]);
    } else {
      for (const b of files.backs) { const pid = await uploadImage(b.path); await insertImage(pid, [b.slot]); }
    }
    await shot('backs-done');
    await saveProject();

    // 6) REVIEW — two steps on, project saved. The run ends here; ordering is hers.
    say('page to review');
    await nextStep(); await nextStep();
    await shot('review');
    const reviewUrl = page.url();
    say(`done: project "${projectName}" saved · review ${reviewUrl}`);
    return { ok: true, projectName, reviewUrl, shots, log, workDir };
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
    job.reviewUrl = result.reviewUrl;
    job.projectName = result.projectName;
    job.shots = result.shots;
    await uploadShots(job);
    job.status = 'saved';
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
    id: job.id, status: job.status,
    reviewUrl: job.reviewUrl || null, projectName: job.projectName || null,
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
    ready: Boolean(chromium) && browserInstalled(),
    playwright: Boolean(chromium),
    browser: browserInstalled(),
    rss_mb: Math.round(process.memoryUsage().rss / 1048576),
    credentials: Boolean(creds.email && creds.password),
    note: 'Saves the deck as a project in the MPC account and stops on the review '
      + 'page; ordering is always manual. Needs a browser-capable host (not the '
      + 'Render web service). Selectors ported from the MPC Autofill desktop tool.',
  });
});

// POST /api/mpc/upload  — start an upload job. Body = the same deck spec as
// /api/mpc/prep-order (deckName, size, mode, quantity, fronts[], back|backs[]).
router.post('/', (req, res) => {
  if (!chromium || !browserInstalled()) {
    return res.status(501).json({ error: 'no browser on this host — run it as a one-off job: node scripts/render-job.js --cmd "node scripts/mpc-upload-job.js --zip … --name …"' });
  }
  // MEASURED 2026-09-21: the browser peaks ~225MB PSS and this box idles near
  // 300 of its 512 — running it here would OOM the server under her draws.
  // The job (a fresh instance) is the door; this route only runs on a host
  // with room, and says so otherwise.
  const rssMb = process.memoryUsage().rss / 1048576;
  if (!process.env.MPC_UPLOAD_INPROCESS && rssMb > 150) {
    return res.status(503).json({ error: `this instance is at ${Math.round(rssMb)}MB; run the upload as a one-off Render job (scripts/render-job.js)` });
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

// GET /api/mpc/upload/:id — poll job status (log + screenshots + review URL).
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
  filesFromDir,
  deckDirFromZip,
  browserInstalled,
  findBrowser,
  DEFAULT_FLOW,
  _jobs: jobs,
};

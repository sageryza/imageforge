#!/usr/bin/env node
// mpc-upload-job.js — the MPC upload as a ONE-OFF RENDER JOB (2026-09-21,
// Sophie: "try render" — after the cloud container's browser could not trust
// the sandbox proxy and she does not want the desktop: "it hurts my back").
//
// Measured why it is a job and not a route on the web service: the headless
// browser peaks at ~225MB PSS on the mock editor with the low-memory flags
// (`scripts/test-mpc-upload.js` under a PSS sampler), and the live Starter box
// idles near 300MB of its 512 — together they do not fit, and an OOM restarts
// the server under whatever it is drawing. A one-off job runs the same build
// on a FRESH Starter instance with all 512MB to itself, is billed by the
// second, and exits. `scripts/render-job.js` starts one and waits for it.
//
//   node scripts/mpc-upload-job.js --zip <url> --name "Fruit flash cards v1" \
//        [--stock superior] [--chat male-playing-cards-auto] [--foil]
//
// The zip is what `mpc_order_builder.py` / `POST /api/mpc/prep-order` produce:
// fronts/*.png (natural order = slot order), back.png or backs/*.png. Needs
// MPC_EMAIL + MPC_PASSWORD in the environment (she pastes them into the Render
// env herself — never into a chat, never into this repo), Playwright's
// chromium-headless-shell installed by the build (`PLAYWRIGHT_BROWSERS_PATH=0`
// puts it inside node_modules so the build artifact carries it), and
// FIREBASE_SERVICE_ACCOUNT so the step screenshots land in Storage.
//
// When it ends it POSTs ONE Compare page into the chat — the screenshots in
// order and the outcome in the title — so she can see what MPC received
// without anyone reading a log. It never touches the cart or payment: the deck
// is saved as a project in her MPC account and the review page is where it
// stops (the engine's own rule, mpc-upload.js).
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const has = (n) => args.includes('--' + n);
const ZIP = flag('zip');
const NAME = flag('name', 'Deck Factory deck');
const STOCK = flag('stock', 'superior');
const CHAT = flag('chat', 'male-playing-cards-auto');
const BASE = flag('base', process.env.RENDER_EXTERNAL_URL || 'https://imageforge-q125.onrender.com');
if (!ZIP) { console.error('usage: --zip <url> --name "…" [--stock superior] [--chat slug]'); process.exit(2); }

(async () => {
  const up = require('../mpc-upload');
  const t0 = Date.now();
  const say = (m) => console.log(new Date().toISOString().slice(11, 19), m);

  // Firebase for the screenshots (same env var the server reads).
  let bucket = null;
  try {
    const admin = require('firebase-admin');
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw && !admin.apps.length) {
      const sa = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
    }
    if (admin.apps.length) bucket = admin.storage().bucket();
  } catch (e) { say('no Firebase for screenshots: ' + e.message); }

  say(`fetch zip ${ZIP}`);
  const r = await fetch(ZIP);
  if (!r.ok) throw new Error(`zip fetch ${r.status}`);
  const zipBuf = Buffer.from(await r.arrayBuffer());
  const deckDir = await up.deckDirFromZip(zipBuf, fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-deck-')));
  const files = up.filesFromDir(deckDir);
  say(`deck: ${files.fronts.length} fronts, ${files.backs.length ? files.backs.length + ' backs' : files.back ? 'shared back' : 'no back'}`);

  let result = null, error = null;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-job-'));
  try {
    result = await up.driveMpcUpload({ deckName: NAME, stock: STOCK, foil: has('foil') }, {
      deckDir, workDir, headless: true, timeout: 45000,
      onStep: (u) => { const l = u.log[u.log.length - 1]; if (l && l !== global.__last) { global.__last = l; say(l); } },
    });
  } catch (e) { error = e.message; say('ERROR ' + error); }

  // Screenshots → Storage → one Compare page in the chat.
  const shots = [];
  const shotDir = path.join(workDir, 'shots');
  for (const f of (fs.existsSync(shotDir) ? fs.readdirSync(shotDir).sort() : [])) {
    const p = path.join(shotDir, f);
    if (!bucket) { shots.push({ step: f, url: null }); continue; }
    try {
      const dest = `mpc-uploads/${Date.now().toString(36)}/${f}`;
      await bucket.upload(p, { destination: dest, metadata: { contentType: 'image/png' } });
      await bucket.file(dest).makePublic();
      shots.push({ step: f.replace(/^\d+_/, '').replace(/\.png$/, ''), url: `https://storage.googleapis.com/${bucket.name}/${dest}` });
    } catch (e) { shots.push({ step: f, url: null }); }
  }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  const outcome = error ? `failed — ${error.slice(0, 80)}` : `saved as "${result.projectName}"`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = [];
  const pics = shots.filter((s) => s.url);
  for (let i = 0; i < pics.length; i += 2) {
    rows.push('<div class="imgrow">' + pics.slice(i, i + 2).map((s) => `<figure><img src="${esc(s.url)}" alt="${esc(s.step)}"><figcaption>${esc(s.step)}</figcaption></figure>`).join('') + '</div>');
  }
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>MPC upload — ${esc(NAME)} — ${esc(outcome)}</title>
<link rel="stylesheet" href="/compare.css">
<style>figcaption{font-size:12px;color:var(--ink2);text-align:center;margin-top:4px}.imgrow figure{margin:0}</style>
<div class="wrap">
  <h1>MPC upload — ${esc(NAME)} — ${esc(outcome)}</h1>
  ${rows.join('\n') || '<p>No screenshots were written.</p>'}
  <pre style="font-size:12px;white-space:pre-wrap">${esc(((result && result.log) || []).join('\n'))}${error ? '\n\nERROR ' + esc(error) : ''}</pre>
</div>
<script src="/compare.js"></script>
<script>(function(){ window.__compareHelp({ html: '<b>What the job did, step by step.</b> Each picture is the browser at that step. ' + ${JSON.stringify(mins)} + ' minutes. The deck is a saved project in the MPC account; nothing was added to the cart.' }); })();</script>`;
  try {
    const pr = await fetch(`${BASE}/api/chatfeed/page`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat: CHAT, title: `MPC upload — ${NAME} — ${outcome}`, html }) });
    const pj = await pr.json().catch(() => ({}));
    say(`page ${pj.url || pr.status}`);
  } catch (e) { say('page post failed: ' + e.message); }

  say(`done in ${mins} min — ${outcome}`);
  console.log(JSON.stringify({ ok: !error, outcome, reviewUrl: result && result.reviewUrl, shots: shots.map((s) => s.url).filter(Boolean) }));
  process.exit(error ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });

// Draw a BATCH OF SINGLE pictures in a CHAT'S OWN CONTAINER, upload them, and
// file each one the way the deliver-images ritual requires — the singles
// sibling of `draw-panel-sheet.js`.
//
// Two reasons it exists rather than POSTing /api/promptlab (CLAUDE.md, "THE
// FEED IS HERS", 2026-08-28, Sophie: "The playground is for me that's why
// it's called the playground"):
//   • a run started there lands in HER Playground feed, between the pictures
//     she drew herself — a chat's batch of eighteen is exactly the rat-bump
//     complaint arriving by another door;
//   • Render restarts on every deploy and a restart mid-generation loses the
//     paid picture outright. This box shares nothing with that one.
//
// It is deliberately NOT a second recipe: the style halves come from the LIVE
// `/api/promptlab/styles`, so there is one copy of the wording and a reword on
// the server reaches this the same day. Only the plumbing is local.
//
//   node scripts/draw-singles.js job.json [--dry]
//
// job.json: { chat, style:'dreamy'|'evan'|'pastel'|…, shape:'portrait'|'square',
//             tier:'1k'|'2k'|'4k', quality:'low'|'medium'|'high',
//             noText?:true, items:[{ label, prompt }] }
//
// `--dry` prices the batch and prints the exact prompt of the first item
// without spending anything — run it first, and ask Sophie above $3.
//
// Every item's `prompt` is sent VERBATIM as the content half; the style
// prefix/suffix wrap it and are disclosed in the filed style half with the
// `[content]` seam, per the exact-prompt rule.
//
// Writes <job>.out.json (url, the literal full prompt, real usage, the make
// time) so a failed filing can be replayed without re-drawing.
//
// Needs OPENAI_API_KEY and FIREBASE_SERVICE_ACCOUNT (Deck Factory).
const fs = require('fs'), path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const REPO = '/home/user/imageforge';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const KEY = process.env.OPENAI_API_KEY;
// Fired all at once: the draw happens on OpenAI's hardware and costs this box
// nothing, so staggering only spends her minutes (CLAUDE.md, "DRAWING AND
// CUTTING ARE PACED SEPARATELY"). The retry below is for OpenAI's own rate
// limiter, which is a different thing from our memory ceiling.
const RETRIES = 3;

function initFb() {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc),
    storageBucket: `${svc.project_id}.firebasestorage.app` });
  return admin.storage().bucket();
}
async function save(bucket, buf, dir) {
  const name = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const f = bucket.file(name);
  await f.save(buf, { contentType: 'image/webp', resumable: false });
  await f.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${name}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One picture. NO output_compression anywhere — it is lossy and OpenAI applies
// it before the bytes come back, so nothing later can undo it
// (test-no-generation-compression.js greps the tree for exactly this).
async function edits(prompt, refs, { quality, size }) {
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('output_format', 'webp');
    form.append('moderation', 'low');
    refs.forEach((r, i) => form.append('image[]', r.buf,
      { filename: r.name, contentType: r.type }));
    let r, j;
    try {
      r = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${KEY}`, ...form.getHeaders() },
        body: form, timeout: 900000 });
      j = await r.json();
    } catch (e) {
      if (attempt >= RETRIES) throw e;
      await sleep(4000 * (attempt + 1)); continue;
    }
    if (r.ok && j.data && j.data[0]) return { buf: Buffer.from(j.data[0].b64_json, 'base64'), usage: j.usage };
    // A 429 or a 5xx is the rate limiter or a blip; a 400 is this prompt and
    // retrying it only spends the wait again.
    const retryable = r.status === 429 || r.status >= 500;
    if (!retryable || attempt >= RETRIES) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    await sleep(6000 * (attempt + 1));
  }
}

// A ref named `storage:<path>` lives in the bucket, anything else in refs/.
async function loadRef(bucket, name) {
  const type = /\.png$/i.test(name) ? 'image/png' : 'image/jpeg';
  if (name.startsWith('storage:')) {
    const [buf] = await bucket.file(name.slice(8)).download();
    return { buf, name: path.basename(name), type };
  }
  return { buf: fs.readFileSync(path.join(REPO, 'refs', name)), name: path.basename(name), type };
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), timeout: 120000 });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

(async () => {
  const jobPath = process.argv[2];
  const dry = process.argv.includes('--dry');
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  const items = job.items || [];
  const quality = job.quality || 'medium';
  const tier = job.tier || '1k';
  const shape = job.shape || 'portrait';

  const styles = await (await fetch(`${BASE}/api/promptlab/styles`)).json();
  const st = styles.styles[job.style];
  if (!st) throw new Error(`unknown style ${job.style}`);
  const face = styles.res[shape];
  const rung = face.tiers[tier];
  if (!rung) throw new Error(`unknown tier ${tier}`);

  // The no-text toggle SWAPS a named clause rather than appending a second
  // sentence arguing with it (server.js's own applyNoText).
  let suffix = st.suffix || '';
  if (job.noText && st.noText) {
    suffix = suffix.includes(st.noText.from)
      ? suffix.replace(st.noText.from, st.noText.to)
      : `${suffix} ${st.noText.to}`.trim();
  }

  const cents = rung.cents[quality];
  // A style ref is charged as input image tokens and is NOT small — about
  // 1.2-1.9c a call (docs/modules/pictures.md). Named so an estimate is honest
  // at the cheap end, where the reference is most of the bill.
  const refCents = (st.refs || []).length * 1.5;
  const total = ((cents + refCents) * items.length) / 100;
  console.log(`${items.length} x ${job.style} ${quality} ${rung.label} ${rung.size}`);
  console.log(`~$${total.toFixed(2)} (${cents}c a picture + ~${refCents}c of reference)`);
  if (dry) {
    console.log('\n--- prompt 1 ---\n' +
      [st.prefix, items[0] && items[0].prompt, suffix].filter(Boolean).join('\n\n'));
    return;
  }

  const bucket = initFb();
  const refs = [];
  for (const name of st.refs || []) refs.push(await loadRef(bucket, name));

  const out = await Promise.all(items.map(async (it) => {
    const full = [st.prefix, it.prompt, suffix].filter(Boolean).join('\n\n');
    const row = { label: it.label, content: it.prompt, full,
      style: [st.prefix, '[content]', suffix].filter(Boolean).join('\n\n') };
    try {
      const { buf, usage } = await edits(full, refs, { quality, size: rung.size });
      // The make time is stamped when the bytes arrive, not at filing — it is
      // what keeps concurrent chats' deliverables in the right order.
      row.created = Date.now();
      row.url = await save(bucket, buf, `singles/${job.chat || 'chat'}`);
      row.usage = usage;
      console.log('OK  ', it.label, row.url);
    } catch (e) {
      row.error = e.message;
      console.log('FAIL', it.label, e.message);
    }
    return row;
  }));

  const drawn = out.filter((r) => r.url);
  fs.writeFileSync(`${jobPath}.out.json`, JSON.stringify(
    { chat: job.chat, style: job.style, quality, tier, size: rung.size,
      aspectRatio: face.aspectRatio, caption: `gpt-image-2 · ${quality} · ${rung.label}`,
      items: out }, null, 1));

  // File each picture: the label she reviews by, the MODEL · QUALITY · SIZE
  // caption, and both halves of the exact prompt. Done HERE because this is
  // the only moment anything knows the quality — no later chat can backfill it.
  if (job.chat && drawn.length) {
    const caption = `gpt-image-2 · ${quality} · ${rung.label}`;
    for (const r of drawn) {
      try {
        await post(`${BASE}/api/gallery`,
          { assetsOnly: true, chat: job.chat, url: r.url, description: r.label, prompt: caption });
      } catch (e) { console.log('caption FAILED', r.label, e.message); }
    }
    try {
      await post(`${BASE}/api/gallery/assets/prompt`, { chat: job.chat,
        items: drawn.map((r) => ({ url: r.url, style: r.style, content: r.content })) });
    } catch (e) { console.log('prompt FAILED', e.message); }
    console.log(`filed ${drawn.length} into ${job.chat}`);
  }

  const spent = out.reduce((n, r) => n + (r.url ? cents + refCents : 0), 0) / 100;
  console.log(`drawn ${drawn.length}/${items.length} · ~$${spent.toFixed(2)}`);
  if (drawn.length < items.length) process.exitCode = 1;
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });

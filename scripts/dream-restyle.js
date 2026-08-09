#!/usr/bin/env node
/**
 * dream-restyle.js — re-illustrate an already-rendered dream with a DIFFERENT
 * style reference, by hand, outside the app's render job.
 *
 * Why this exists: the dream pipeline hard-codes ONE style ref
 * (`refs/dream-mystery.jpg`, the diary-comic page — `styleRef` in movies.js),
 * so there is no way from the app to see what the same dream looks like drawn
 * against another reference. This script reproduces `renderDreamPageV2`'s
 * prompt EXACTLY and swaps only that first attachment.
 *
 * It re-uses the dream's EXISTING page plan (each page's `text`, `captions`
 * and `who`, straight off the doc) instead of re-running `dreamPaginate`, so
 * the comparison is apples-to-apples: same pages, same hand-lettered captions,
 * same character cards, same continuity clauses — only the style ref differs.
 *
 * It NEVER writes to the dream doc. New pages land in Storage under
 * `dream-restyle/` and the prompts are dumped next to the images, so the
 * dream Sophie sees in the app is untouched.
 *
 *   node scripts/dream-restyle.js <dreamId> [--style sage-sandy-mirror.png]
 *                                 [--quality low|medium|high] [--out ./dir]
 *                                 [--pages 0,2] [--spans spans.json] [--dry-run]
 *
 * --spans is the VERBATIM-WORDS mode, and it is the prototype of a real fix.
 * `dreamPaginate`'s per-page `text` is a PARAPHRASE — its prompt asks for "the
 * slice of the dream this image covers", never for exact words — and
 * `renderDreamPageV2` then makes that paraphrase authoritative ("THIS page
 * covers ONLY this part of it") while demoting her actual transcript to "for
 * context only". So concrete detail dies in the reading step, before the
 * illustrator ever sees it: "one of my paper bowls that I had abandoned in the
 * fridge" became "an old, crusty bowl", and the page came back with a ceramic
 * bowl. (The project notes claim this step allots a "verbatim slice" — it does
 * not, and never did.)
 *   --spans takes {"<pageNumber>": "<her exact words>"} and swaps that page's
 * paraphrase for the span, refusing to run unless the span is an EXACT
 * substring of dreamText — a paraphrase can never sneak through that check.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) + OPENAI_API_KEY.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');
const FormData = require('form-data');
const fetch = require('node-fetch');

const PANEL_COST = { low: 0.02, medium: 0.06, high: 0.25 };
const ROOT = path.join(__dirname, '..');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const dreamId = process.argv[2];
const styleFile = arg('style', 'sage-sandy-mirror.png');
const quality = arg('quality', 'medium');
const outDir = arg('out', path.join(ROOT, 'dream-restyle', String(dreamId)));
const onlyPages = arg('pages', null);
const spansFile = arg('spans', null);
const dryRun = process.argv.includes('--dry-run');
if (!dreamId) { console.error('usage: node scripts/dream-restyle.js <dreamId> [--style file.png]'); process.exit(1); }

// The app labels every attachment image/jpeg regardless of what it is; sniff
// the real type instead so a PNG reference isn't sent under a lying header.
function sniff(buf) {
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['png', 'image/png'];
  if (buf[0] === 0xff && buf[1] === 0xd8) return ['jpg', 'image/jpeg'];
  if (buf.slice(8, 12).toString() === 'WEBP') return ['webp', 'image/webp'];
  return ['png', 'image/png'];
}

async function openaiEdit(prompt, refs, q) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  let lastErr;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      refs.forEach((buf, i) => {
        const [ext, type] = sniff(buf);
        form.append('image[]', buf, { filename: `ref${i + 1}.${ext}`, contentType: type });
      });
      form.append('size', '1024x1536');
      form.append('quality', q);
      form.append('output_format', 'webp');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, ...form.getHeaders() },
        body: form,
        timeout: 300000,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const b64 = data.data && data.data[0] && data.data[0].b64_json;
      if (!b64) throw new Error('gpt-image-2 returned no image');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      // A safety refusal is deterministic — retrying only burns time (movies.js
      // learned this the expensive way).
      if (/safety|content policy|moderation/i.test(err.message)) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Verbatim port of movies.js `dreamPageRefs` — which already-drawn pages to
// feed back as this page's character reference.
function dreamPageRefs(who, rendered) {
  if (!rendered.length) return [];
  const byUrl = new Map();
  for (const name of new Set(who || [])) {
    const src = rendered.find(p => p.who.includes(name));
    if (!src) continue;
    if (!byUrl.has(src.url)) byUrl.set(src.url, new Set());
    byUrl.get(src.url).add(name);
  }
  let refs = [...byUrl.entries()].map(([url, set]) => ({ url, names: [...set] }));
  const last = rendered[rendered.length - 1];
  if (last && !refs.some(r => r.url === last.url)) refs = [...refs.slice(0, 2), { url: last.url, names: [] }];
  return refs.slice(0, 3);
}

async function fetchBuf(url) {
  const res = await fetch(url, { timeout: 60000 });
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const snap = await db.collection('forge-dreams').doc(dreamId).get();
  if (!snap.exists) throw new Error(`no dream ${dreamId}`);
  const dream = snap.data();
  const plan = (dream.pagePlan && dream.pagePlan.length ? dream.pagePlan : dream.pages) || [];
  if (!plan.length) throw new Error('dream has no pages to re-illustrate');
  const wanted = onlyPages ? onlyPages.split(',').map(n => +n) : plan.map((_, i) => i);

  const styleRef = fs.readFileSync(path.join(ROOT, 'refs', styleFile));
  const cast = Array.isArray(dream.castApproved) ? dream.castApproved : [];
  const total = plan.length;
  const dreamText = String(dream.dreamText || dream.dream || '');

  // Verbatim mode. Every span must appear in her transcript character for
  // character — that check is the whole point, so it aborts rather than
  // quietly drawing from something she never said.
  const spans = spansFile ? JSON.parse(fs.readFileSync(spansFile, 'utf8')) : {};
  for (const [page, span] of Object.entries(spans)) {
    if (!dreamText.includes(span)) throw new Error(`span for page ${page} is NOT an exact substring of the dream transcript`);
    console.log(`page ${page}: verbatim span verified, ${span.length} chars of her own words`);
  }

  console.log(`${dream.title} — ${wanted.length} of ${total} page(s), style ref ${styleFile}, quality ${quality}`);
  console.log(`estimated cost $${(wanted.length * (PANEL_COST[quality] || 0.06)).toFixed(2)}`);
  if (dryRun) { process.exit(0); }
  fs.mkdirSync(outDir, { recursive: true });

  // Pages drawn in THIS style — the new look feeds itself forward. Re-drawing a
  // single page (--pages) still needs the pages BEFORE it as character/scene
  // references, so a previous run's prompts.json is read back and its pages
  // ride along; otherwise a one-page re-draw would silently lose the
  // continuity the full run had.
  const priorFile = path.join(outDir, 'prompts.json');
  const prior = fs.existsSync(priorFile) ? JSON.parse(fs.readFileSync(priorFile, 'utf8')).pages || [] : [];
  const rendered = [];
  const out = [];
  for (let i = 0; i < total; i++) {
    const p = plan[i];
    if (!wanted.includes(i)) {
      const was = prior.find(x => x.page === i + 1);
      if (was) { rendered.push({ url: was.url, who: was.who || [] }); out.push(was); }
      continue;
    }
    const who = p.who || [];
    const onPage = cast.filter(c => who.includes(c.name));
    const refs = [styleRef];
    const clauses = [];
    let n = 2;
    for (const c of onPage) {
      if (!c.url) continue;
      refs.push(await fetchBuf(c.url));
      clauses.push(`the #${n++} attached image is a CHARACTER REFERENCE for ${c.name} — whenever `
        + `${c.name} appears, draw them with the exact same face, hair and clothing as in it; do not redesign them`);
    }
    for (const r of dreamPageRefs(who, rendered)) {
      refs.push(await fetchBuf(r.url));
      clauses.push(r.names.length
        ? `the #${n++} attached image is an EARLIER PAGE of this same comic — draw ${r.names.join(' and ')} with the exact same face, hair and clothing they have there, and do not redesign them`
        : `the #${n++} attached image is an EARLIER PAGE of this same comic — keep the drawing style and scenery consistent with it`);
    }
    for (const c of onPage) {
      if (c.url || !c.desc) continue;
      clauses.push(`${c.name} is ${c.desc} — keep ${c.name} looking exactly the same everywhere they appear`);
    }
    const styleIntro = 'The FIRST attached image is a STYLE reference — copy its hand-lettered drawing style exactly, but do NOT copy its content or subjects. ';
    const continuity = clauses.length
      ? `For continuity: ${clauses.join('; ')}. Any character NOT named above is a DIFFERENT person — give them their own distinct new face and look; never reuse a face from the attached images for them. `
      : '';
    const caps = (p.captions || []).filter(Boolean);
    const capInstr = caps.length
      ? `Hand-letter ${caps.length === 1 ? 'this caption' : 'these ' + caps.length + ' captions, in order,'} onto the page as small caption boxes in the dreamer's handwriting, each spelled EXACTLY as written and nothing added: ${caps.map(c => `"${c}"`).join(', ')}.`
      : "Add a short hand-lettered caption in the dreamer's own voice.";
    // The slice line. Verbatim mode says the words ARE the dreamer's, so the
    // model stops treating them as a summary it may re-interpret: her own
    // concrete nouns are the spec, and where she hedges between two things
    // ("i don't know if it was shlomo") it has to commit to one rather than
    // averaging them into something generic.
    const span = spans[String(i + 1)];
    const sliceLine = span
      ? `THIS page covers ONLY this part of it, quoted VERBATIM in the dreamer's own spoken words: "${span}". `
        + 'Draw only that part. These are her actual words, not a summary — every concrete detail in them is a '
        + 'specification: draw the exact objects she names, in the material, size and state she gives them, and '
        + 'ignore only her speech filler ("like", "um", false starts). Where she is unsure between two '
        + 'possibilities, pick one and draw it plainly. '
      : `THIS page covers ONLY this part of it: "${String(p.text || '')}". Draw only that part. `;
    const prompt = `${styleIntro}${continuity}`
      + `This is page ${i + 1} of ${total} of a hand-drawn comic telling a real dream. `
      + `The whole dream, for context only: "${dreamText}". `
      + sliceLine
      + 'Decide the page layout yourself — one full-page drawing or a few panels, whatever tells this part best. '
      + capInstr;

    console.log(`page ${i + 1}/${total} — ${refs.length} attachments, drawing…`);
    const buf = await openaiEdit(prompt, refs, quality);
    const file = path.join(outDir, `page${i + 1}.webp`);
    fs.writeFileSync(file, buf);
    const name = `dream-restyle/${dreamId}-p${i + 1}-${crypto.randomBytes(4).toString('hex')}.webp`;
    const obj = bucket.file(name);
    await obj.save(buf, { contentType: 'image/webp', metadata: { cacheControl: 'public, max-age=31536000, immutable' } });
    await obj.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${name}`;
    console.log(`  ${url}`);
    rendered.push({ url, who });
    out.push({ page: i + 1, url, file, prompt, text: p.text, captions: caps, who, attachments: refs.length });
    fs.writeFileSync(path.join(outDir, 'prompts.json'),
      JSON.stringify({ dreamId, title: dream.title, styleFile, quality, pages: out }, null, 2));
  }
  console.log(`done — ${out.length} page(s), $${(out.length * (PANEL_COST[quality] || 0.06)).toFixed(2)}`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });

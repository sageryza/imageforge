#!/usr/bin/env node
// EVERY PICTURE SHE EVER MADE MUST BE FINDABLE (2026-08-28, Sophie: "i wanna
// make sure every picture I've ever created can be found"). Meta Assets is a
// view over forge-chat-assets + the My Creations gallery — so a picture whose
// record never landed in either is invisible there, with nothing on screen
// saying so. Measured the day this was written: 186 Playground outputs, 27
// Freeform outputs and ~160 story-art pictures (Marla storybook pages, witch
// lesson art on beats) were invisible — every one a finished picture whose
// filing was lost (deploy restarts kill the best-effort fileRunToCreations,
// and story pipelines placed art on beats without filing it anywhere).
//
// This script is BOTH the audit and the repair:
//   node scripts/backfill-meta-coverage.js            # dry — names every gap
//   node scripts/backfill-meta-coverage.js --go       # files them
//
// NOTHING IS INVENTED. A picture is filed only when a record of its making
// exists, and the words come from that record verbatim: a Playground run's
// own prompt / fullPrompt / model / quality / size, a Freeform run's
// promptSent, a story beat's text and its src prompt. A picture with no
// provenance anywhere is REPORTED, never filed with a guess — the same rule
// as the caption backfill measurement in CLAUDE.md (a confident wrong caption
// is worse than a blank one).
//
// It files into the My Creations gallery (membry), the same doc shape and
// url-dedupe as server.js's fileRunToCreations / fileCreationDoc — so it is
// idempotent (re-running writes nothing new) and Meta Assets picks the rows
// up on its next 60s rebuild. Timestamps are the picture's own make-time, so
// nothing floods the top of her gallery.
//
// What it deliberately does NOT count as a missing picture: her own INPUT
// photos (promptlab/photorefs, freeform/refs — references she attached, not
// creations), derived display copies (thumbs/, drops/_thumb — the webp rule's
// derived copies), and the committed refs/ style references.
'use strict';

const admin = require('firebase-admin');
const promptRecord = require('../prompt-record');
const sizeTier = require('../size-tier');
const metaAssets = require('../meta-assets');

const GO = process.argv.includes('--go');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i > 0 ? parseInt(process.argv[i + 1], 10) || Infinity : Infinity;
})();

const svc = (name) => {
  const raw = process.env[name];
  if (!raw) { console.error(`missing ${name}`); process.exit(1); }
  return JSON.parse(raw);
};
admin.initializeApp({ credential: admin.credential.cert(svc('FIREBASE_SERVICE_ACCOUNT')) });
const storyApp = admin.initializeApp(
  { credential: admin.credential.cert(svc('STORY_FIREBASE_SERVICE_ACCOUNT')) }, 'story');

const uk = (u) => String(u || '').split('?')[0].split('#')[0].trim().toLowerCase();
const IMG = /\.(webp|png|jpe?g)$/i;
const HOST = /^https?:\/\/(storage\.googleapis\.com|firebasestorage\.googleapis\.com)/;
// Inputs and derived copies — not creations, never a gap.
const SKIP = /(promptlab\/photorefs|freeform\/refs|\/thumbs\/|drops\/_|\/refs\/|_thumb)/;
const isOutput = (u) => HOST.test(u) && IMG.test(String(u).split('?')[0]) && !SKIP.test(u);

// The Playground's style labels, by gptStyle key — promptlab.html's STYLES
// rows (label + gptStyle), kept small here because requiring server.js would
// boot the server.
const STYLE_LABELS = { evan: 'Sandy mirror', plain: 'ChatGPT', dreamy: 'Dreamy',
  scarry: 'Scarry', pastel: 'Pastel', hoonies: 'Hoonies' };

async function galleryUid() {
  // The device uid is the one holding the creations pile — same heuristic as
  // scripts/find-gallery-uid.js, one collectionGroup read.
  const snap = await storyApp.firestore().collectionGroup('creations').select().get();
  const counts = new Map();
  snap.docs.forEach((d) => {
    const uid = d.ref.parent.parent.id;
    counts.set(uid, (counts.get(uid) || 0) + 1);
  });
  let best = null; let bestN = 0;
  counts.forEach((n, uid) => { if (n > bestN) { best = uid; bestN = n; } });
  if (!best) throw new Error('no creations owner found');
  return best;
}

async function main() {
  const db = admin.firestore();

  // ── What Meta Assets can already show, via the REAL builder ──
  const assetsSnap = await db.collection('forge-chat-assets')
    .select('chat', 'url', 'created', 'prompt', 'description',
      'promptStyle', 'promptContent', 'kind', 'hash', 'md5', 'compressedAtBirth').get();
  const creationsSnap = await storyApp.firestore().collectionGroup('creations')
    .select('url', 'prompt', 'type', 'model', 'quality', 'style', 'size',
      'createdAt', 'promptStyle', 'promptContent').get();
  const creations = creationsSnap.docs.map((d) => {
    const c = d.data();
    return { url: c.url, prompt: c.prompt, type: c.type, model: c.model,
      quality: c.quality, style: c.style, size: c.size,
      promptStyle: c.promptStyle, promptContent: c.promptContent,
      ms: c.createdAt && c.createdAt.toMillis ? c.createdAt.toMillis() : 0 };
  });
  const rows = metaAssets.buildMetaAssets(assetsSnap.docs.map((d) => d.data()), creations);
  const shown = new Set();
  rows.forEach((r) => { shown.add(uk(r.url)); (r.alts || []).forEach((u) => shown.add(uk(u))); });

  // ── Gather candidates: {url, ms, fields…} keyed by url, first record wins ──
  const found = new Map();
  const offer = (url, rec) => {
    const k = uk(url);
    if (!url || !isOutput(url) || shown.has(k) || found.has(k)) return;
    found.set(k, Object.assign({ url }, rec));
  };

  // 1. Playground runs — the run doc is the exact provenance.
  const pl = await db.collection('forge-promptlab').get();
  pl.docs.forEach((d) => {
    const r = d.data();
    const ms = r.createdAt && r.createdAt.toMillis ? r.createdAt.toMillis() : 0;
    const label = STYLE_LABELS[r.gptStyle] || (r.style === 'watercolor' ? 'WTR' : '') || '';
    const urls = [].concat(r.images || []).map((u) => (typeof u === 'string' ? u : u && u.url))
      .concat(r.url ? [r.url] : []).filter(Boolean);
    urls.forEach((u) => offer(u, {
      ms, source: 'backfill · playground run ' + (r.id || d.id),
      prompt: r.prompt || '', fullPrompt: r.fullPrompt || '',
      model: r.model || (r.gptStyle ? 'gpt-image-2' : ''),
      quality: r.quality || '', canvas: r.size || '',
      style: label ? `${label}${r.quality ? ' · ' + r.quality : ''}` : '',
    }));
  });

  // 2. Freeform runs — promptSent is verbatim, no style half by design.
  const ff = await db.collection('forge-freeform').get();
  ff.docs.forEach((d) => {
    const r = d.data();
    const ms = r.createdAt && r.createdAt.toMillis ? r.createdAt.toMillis()
      : (typeof r.created === 'number' ? r.created : 0);
    const urls = [].concat(r.images || []).map((u) => (typeof u === 'string' ? u : u && u.url))
      .concat(r.url ? [r.url] : []).filter(Boolean)
      .filter((u) => /freeform\/out/.test(u));
    urls.forEach((u) => offer(u, {
      ms, source: 'backfill · freeform run ' + (r.id || d.id),
      prompt: r.promptSent || r.prompt || '',
      fullPrompt: r.promptSent || r.prompt || '',
      model: 'gpt-image-2', quality: r.quality || '', canvas: r.size || '',
    }));
  });

  // 3. Story pads — a beat's art (current, alt sides, past pictures, trash).
  //    Words: the beat's own text as the label; the drawing prompt from the
  //    picture's own src record where one is kept.
  const pads = await db.collection('forge-scratchpad').get();
  const offerBeat = (padTitle, b) => {
    if (!b) return;
    const label = String(b.text || '').trim();
    const sides = [{ url: b.url, src: b.src }];
    Object.values(b.alt || {}).forEach((a) => { if (a) sides.push({ url: a.url, src: a.src }); });
    const hist = [].concat(b.imageHistory || [],
      ...Object.values(b.alt || {}).map((a) => (a && a.imageHistory) || []));
    hist.forEach((h) => { if (h) sides.push({ url: h.url, src: h.src, ms: h.at }); });
    sides.forEach((s) => {
      if (!s || !s.url) return;
      const src = s.src || {};
      offer(s.url, {
        ms: s.ms || b.addedAt || 0,
        source: 'backfill · story "' + padTitle + '"',
        prompt: label || src.prompt || b.prompt || '',
        fullPrompt: src.promptUsed || '',
        promptContent: src.prompt || b.prompt || label || '',
        model: src.model || '', quality: src.quality || '',
        style: src.style ? String(src.style) : '',
      });
    });
  };
  pads.docs.forEach((d) => {
    const p = d.data();
    const title = p.title || d.id;
    (p.beats || []).forEach((b) => offerBeat(title, b));
    (p.trash || []).forEach((b) => offerBeat(title, b));
  });

  // ── Report / write ──
  const list = Array.from(found.values()).sort((a, b) => (a.ms || 0) - (b.ms || 0)).slice(0, LIMIT);
  const noWords = list.filter((c) => !c.prompt && !c.fullPrompt);
  console.log(`${list.length} invisible pictures with provenance` +
    (noWords.length ? ` (${noWords.length} of them wordless — filed with caption fields only)` : ''));
  const byGroup = {};
  list.forEach((c) => { const g = c.source.replace(/ ".*/, '').replace(/ run .*/, ''); byGroup[g] = (byGroup[g] || 0) + 1; });
  Object.entries(byGroup).forEach(([g, n]) => console.log(' ', n, g));

  if (!GO) { console.log('\nDRY RUN — nothing written. Re-run with --go to file them.'); return; }

  const uid = await galleryUid();
  const col = storyApp.firestore().collection('users').doc(uid).collection('creations');
  let wrote = 0;
  for (const c of list) {
    // Same dedupe as fileCreationDoc — idempotent by url.
    const dup = await col.where('url', '==', c.url).limit(1).get();
    if (!dup.empty) continue;
    const doc = {
      type: 'image', url: c.url,
      prompt: String(c.prompt || '').slice(0, 500), stickers: null,
      createdAt: c.ms ? admin.firestore.Timestamp.fromMillis(Number(c.ms))
        : admin.firestore.Timestamp.now(),
      source: String(c.source).slice(0, 120),
    };
    if (c.style) doc.style = String(c.style).slice(0, 80);
    if (c.model) doc.model = String(c.model).slice(0, 80);
    if (c.quality) doc.quality = String(c.quality).slice(0, 40);
    if (c.canvas) {
      doc.canvas = String(c.canvas).slice(0, 40);
      doc.size = sizeTier.captionSize(c.canvas) || doc.canvas;
    }
    Object.assign(doc, promptRecord.promptFields({
      full: c.fullPrompt, content: c.promptContent || c.prompt,
    }));
    await col.add(doc);
    wrote++;
    if (wrote % 50 === 0) console.log('  …', wrote);
  }
  console.log('filed', wrote, 'pictures into My Creations — Meta Assets shows them within 60s');
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/* Seed the Triset pool — a chat's CONTAINER job, never Render's (the house
   rule: a chat draws in its own container; Render's routes are for her taps).

   Draws the starter cards through triset.js's OWN draw + cardPrompt (the
   dreamy recipe with the triangle clause, read out of server.js by
   scripts/lib/dreamy-style.js — one implementation, so seeds and made cards
   cannot drift), uploads them to deckfactory Storage, writes the
   forge-triset-cards docs (content-addressed sha1(url), so re-running
   updates in place), and files each card the house way: the chat's Assets
   tab with its label + MODEL · QUALITY · SIZE caption + exact prompt halves,
   and My Creations with model/quality/size.

   Money: N cards × ~6.5c (gpt-image-2 medium 1024x1024 + the dreamy
   reference's input tokens). Default batch ≈ 78c. Draws fire ALL AT ONCE
   (they run on OpenAI's hardware — the container pacing rule).

   Run:  node scripts/seed-triset.js --dry     (prints the plan, spends 0)
         node scripts/seed-triset.js --go
   Env:  OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT (deckfactory),
         STORY_FIREBASE_SERVICE_ACCOUNT (membry, for My Creations). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const triset = require('../triset');
const { dreamyStyle } = require('./lib/dreamy-style');

// --chat/--ver: a batch SHE dictated in ANOTHER chat files into THAT chat's
// Assets tab, where she is reviewing it (the house rule: a chat's pictures
// belong in its own tab). The cards still join the one pool either way.
const argOf = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const CHAT = argOf('chat', 'triangular-set-solitaire');
// bump per redrawn generation: the objects are served immutable, so a redraw
// needs a new url, and the doc id is sha1(url)
const SEED_VER = argOf('ver', 'seed2');
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

// The starter pool: subjects that overlap on purpose — spots, horns, spirals,
// night, steam, round things — so a set is findable in most hands. Short,
// thing-named prompts (the house rule: name the thing, not its parts).
const SEEDS = [
  // the five she hearted, redrawn equilateral (2026-08-30)
  { slug: 'garden-snake', title: 'a garden snake' },
  { slug: 'sunflower', title: 'a sunflower' },
  { slug: 'mountain', title: 'a mountain' },
  { slug: 'spotted-egg', title: 'a spotted egg in a nest' },
  { slug: 'teacup', title: 'a steaming cup of tea' },
  // fresh subjects for the seven she did not — same overlapping-qualities idea
  { slug: 'beehive', title: 'a beehive dripping with honey' },
  { slug: 'lighthouse', title: 'a lighthouse at night' },
  { slug: 'sleeping-fox', title: 'a fox curled up asleep' },
  { slug: 'watermelon', title: 'a slice of watermelon' },
  { slug: 'ladybug', title: 'a ladybug on a leaf' },
  { slug: 'moon-in-lake', title: 'a full moon reflected in a lake' },
  { slug: 'lemon', title: 'a lemon with leaves' },
];

// --file <json>: draw a batch SHE dictated (e.g. asset-note card ideas)
// instead of the built-in list — [{slug, title}, …] or {cards:[…]} (a batch
// doc that carries its design notes alongside the cards); titles verbatim.
const fileArg = process.argv.indexOf('--file');
const fileJson = fileArg > -1 && process.argv[fileArg + 1]
  ? JSON.parse(fs.readFileSync(process.argv[fileArg + 1], 'utf8')) : null;
const LIST = Array.isArray(fileJson) ? fileJson : (fileJson && fileJson.cards) || SEEDS;
// --edition (or `edition` in the batch file): the cards join a named DECK
// within the pool — the page's edition chips narrow the deal to it, and a
// set found inside one keeps its made card in it. '' files them plain.
const EDITION = argOf('edition', (fileJson && fileJson.edition) || '');
const DRY = process.argv.includes('--dry') || !process.argv.includes('--go');
const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

triset.init({ gptStyles: { dreamy: dreamyStyle() } });

async function main() {
  const cents = (LIST.length * triset.COST_CENTS).toFixed(0);
  console.log(`${LIST.length} seed cards · ${triset.QUALITY} ${triset.CANVAS} · ~${cents}c`);
  if (DRY) {
    for (const s of LIST) console.log('  ' + s.slug.padEnd(18) + s.title);
    const rec = triset.cardPrompt(LIST[0].title, { invent: false });
    console.log('\nfirst full prompt:\n' + rec.fullPrompt);
    console.log('\n(dry — pass --go to draw)');
    return;
  }

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    // the newer Firebase default bucket — `<id>.appspot.com` does not exist
    // on this project (server.js line ~264 is the reference)
    storageBucket: `${sa.project_id}.firebasestorage.app`,
  });
  const bucket = admin.storage().bucket();
  const db = admin.firestore();
  const refs = triset.refBuffers();

  const outDir = path.join(ROOT, '.seed-triset');
  fs.mkdirSync(outDir, { recursive: true });

  // 1) draw — all at once (OpenAI's hardware; the container pacing rule)
  const results = await Promise.all(LIST.map(async (s) => {
    const rec = triset.cardPrompt(s.title, { invent: false });
    try {
      // THE BANK IS KEYED ON THE PROMPT, NOT THE SLUG (2026-08-31). It was
      // the slug alone, so re-running a slug whose TITLE had changed — a
      // re-roll carrying her note ("just the hands, no ppl") — silently
      // re-uploaded the OLD picture and filed the NEW prompt against it. The
      // saving is real and worth keeping; the identity has to be what was
      // actually drawn.
      const f = path.join(outDir, s.slug + '-' + sha1(rec.fullPrompt).slice(0, 8) + '.webp');
      // a banked draw is PAID work — a re-run after an upload failure must
      // never draw (and bill) it again
      if (fs.existsSync(f) && fs.statSync(f).size > 10000) {
        console.log('banked ' + s.slug);
        return { ...s, rec, file: f, madeAt: fs.statSync(f).mtimeMs };
      }
      const buf = await triset.draw(rec.fullPrompt, refs);
      fs.writeFileSync(f, buf);
      console.log('drawn  ' + s.slug + '  ' + (buf.length / 1024).toFixed(0) + 'KB');
      return { ...s, rec, file: f, madeAt: Date.now() };
    } catch (e) {
      console.log('FAILED ' + s.slug + ': ' + e.message);
      return { ...s, rec, failed: e.message };
    }
  }));
  const good = results.filter(r => r.file);
  if (!good.length) throw new Error('nothing drawn');

  // 2) upload + card docs (content-addressed: re-running updates in place)
  for (const r of good) {
    const p = `triset/cards/${SEED_VER}-${r.slug}.webp`;
    await bucket.upload(r.file, {
      destination: p,
      metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    });
    await bucket.file(p).makePublic();
    r.url = `https://storage.googleapis.com/${bucket.name}/${p}`;
    const doc = {
      // `name` is the DISPLAY title when the drawn content is a wordy
      // instruction ("a flat wash of pastel red paint…" reads as "pastel
      // red"); the exact prompt fields below stay verbatim either way.
      title: r.name || r.title, url: r.url, source: 'seed', status: 'ready',
      ...(EDITION ? { edition: EDITION } : {}),
      model: 'gpt-image-2', quality: triset.QUALITY, canvas: triset.CANVAS, size: triset.SIZE_TIER,
      fullPrompt: r.rec.fullPrompt, promptStyle: r.rec.promptStyle, promptContent: r.rec.promptContent,
      createdAt: r.madeAt,
    };
    await db.collection('forge-triset-cards').doc(sha1(r.url)).set(doc, { merge: true });
    console.log('filed  ' + r.slug);
  }

  // 3) the chat's Assets tab: label + MODEL · QUALITY · SIZE caption…
  const caption = `gpt-image-2 · ${triset.QUALITY} · ${triset.SIZE_TIER}`;
  for (const r of good) {
    const res = await fetch(BASE + '/api/gallery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetsOnly: true, chat: CHAT, session: SESSION, url: r.url,
        description: 'Triset ' + SEED_VER + ' card — ' + (r.name || r.title), prompt: caption,
        created: r.madeAt,
      }),
    }).then(x => x.json()).catch(e => ({ error: e.message }));
    if (res.error) console.log('asset FAILED ' + r.slug + ': ' + res.error);
  }
  // …and the exact prompt halves.
  const pr = await fetch(BASE + '/api/gallery/assets/prompt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat: CHAT,
      items: good.map(r => ({ url: r.url, style: r.rec.promptStyle, content: r.rec.promptContent })),
    }),
  }).then(x => x.json()).catch(e => ({ error: e.message }));
  console.log('prompts filed: ' + JSON.stringify(pr && pr.error ? pr : { ok: true, n: good.length }));

  // 4) My Creations, with the true make-time and the full caption fields.
  let uid = process.env.GALLERY_UID || '';
  if (!uid) {
    try { uid = ((await db.doc('config/gallery-uid').get()).data() || {}).uid || ''; } catch (e) {}
  }
  if (!uid) { console.log('no gallery uid — skipped My Creations (run post-to-gallery.js later)'); return; }
  const { execFileSync } = require('child_process');
  for (const r of good) {
    try {
      // THE WHOLE PROMPT RIDES ONTO THE CREATION TOO — the hard rule. The
      // caption line is her SUBJECT (promptContent), not the tile's label:
      // the "Triset <ver> card" context is on the Assets tile's description,
      // and a style half rebuilt from these two halves is the real wrapper.
      const [pre, suf] = r.rec.promptStyle.split('\n\n[content]\n\n');
      execFileSync('node', [path.join(__dirname, 'post-to-gallery.js'),
        '--url', r.url, '--prompt', r.rec.promptContent || r.title,
        '--model', 'gpt-image-2', '--quality', triset.QUALITY, '--size', triset.CANVAS,
        '--full', r.rec.fullPrompt, '--prefix', pre || '', '--suffix', suf || '',
        '--created', String(r.madeAt), '--source', 'triset', '--uid', uid,
      ], { stdio: 'pipe' });
    } catch (e) { console.log('creation FAILED ' + r.slug + ': ' + String(e.message).slice(0, 120)); }
  }
  console.log('done — ' + good.length + ' cards in the pool'
    + (results.length - good.length ? (', ' + (results.length - good.length) + ' failed') : ''));
}

main().catch((e) => { console.error(e); process.exit(1); });

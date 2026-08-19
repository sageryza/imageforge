#!/usr/bin/env node
/**
 * file-dream-feed-assets.js — file every image the LIVE dream feed has drawn
 * into a chat's Assets tab, with its EXACT prompt and its MODEL · QUALITY
 * caption.
 *
 * WHY THIS IS POSSIBLE AT ALL: dreamapp.js stores `promptUsed` on every panel
 * it writes, so the text that made each picture is on the record and nothing
 * has to be reconstructed. Sophie's rule holds either way — a dream with no
 * `promptUsed` (the seeded sample dreams) is SKIPPED rather than filed with a
 * guessed prompt or a guessed caption.
 *
 * THE TWO GENERATIONS OF THE PROMPT, told apart by the prompt itself and not
 * by a date (the record is the evidence):
 *   - "ONE single full-frame illustration of a real dream"  → movies.js
 *     makeDreamImage, one square, 1024x1024, quality medium (dreamapp.js's
 *     default since #1360; the page never sends a quality).
 *   - "This is page N of M of a hand-drawn comic"           → the superseded
 *     makeDreamPagesV2 path, 1024x1536, quality low (the old default).
 *
 * THE STYLE/CONTENT SEAM. Each side is capped at 6000 chars and these prompts
 * run to 7.4k, so the split is chosen to keep BOTH halves under the cap while
 * every character stays verbatim — style is the fixed wrapper with [content]
 * marking where the other half slots in, content is the depiction.
 *
 *   CHAT=<slug> node scripts/file-dream-feed-assets.js [--dry]
 *
 * ENV: FIREBASE_SERVICE_ACCOUNT (Deck Factory), FORGE_BASE to override the host.
 */
'use strict';

const admin = require('firebase-admin');

const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');
const CHAT = process.env.CHAT || '';
const DRY = process.argv.includes('--dry');
const DREAMS = 'forge-dreamapp';
const MAX = 6000;

const SQ_NOTE = '\n\n(attached style ref: refs/dream-mystery.jpg — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)';
const CM_NOTE = '\n\n(attached style ref: refs/dream-mystery.jpg + earlier pages of the same comic — gpt-image-2 images/edits, 1024x1536, quality low, output webp)';

// One panel in, its tile fields out. Pure, so the seams can be checked without
// touching the network.
function describe(panel, dreamTitle, pageCount) {
  const p = panel.promptUsed || '';
  if (!p) return null;
  if (p.includes('ONE single full-frame illustration')) {
    const a = p.indexOf('Draw this: "');
    const b = p.indexOf('The rest of the dream, for context only');
    return {
      url: panel.url,
      label: `Dream feed (live) — ${dreamTitle} — one square, current prompt`,
      caption: 'gpt-image-2 · medium',
      style: p.slice(0, a) + '[content] ' + p.slice(b) + SQ_NOTE,
      content: p.slice(a, b).trim(),
    };
  }
  const a = p.indexOf('The whole dream, for context only:');
  const c = p.indexOf('Draw only that part.');
  return {
    url: panel.url,
    label: `Dream feed (live) — ${dreamTitle}, page ${panel.i + 1} of ${pageCount} — old comic prompt`,
    caption: 'gpt-image-2 · low',
    style: p.slice(0, a) + '[content] ' + p.slice(c) + CM_NOTE,
    content: p.slice(a, c).trim(),
  };
}

async function post(route, body) {
  const res = await fetch(BASE + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'bad json' }));
}

async function main() {
  if (!CHAT) { console.error('CHAT=<slug> is required'); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const snap = await admin.firestore().collection(DREAMS).get();
  const items = [];
  let skipped = 0;
  snap.forEach((doc) => {
    const v = doc.data();
    const panels = (v.panels || []).filter((p) => p.url);
    for (const p of panels) {
      const it = describe(p, v.title || 'untitled', panels.length);
      if (!it) { skipped++; continue; }
      items.push(it);
    }
  });
  console.log(`${items.length} panels with a prompt on file · ${skipped} skipped (no promptUsed — never guessed)`);
  for (const it of items) {
    if (it.style.length > MAX || it.content.length > MAX) {
      console.log(`  OVER CAP, skipping: ${it.label} (style ${it.style.length}, content ${it.content.length})`);
      continue;
    }
    if (DRY) { console.log(`  would file: ${it.label}`); continue; }
    const a = await post('/api/gallery', { assetsOnly: true, chat: CHAT, url: it.url, description: it.label, prompt: it.caption });
    const b = await post('/api/gallery/assets/prompt', { chat: CHAT, url: it.url, style: it.style, content: it.content });
    console.log(`  ${a.ok ? 'filed' : 'ERR ' + JSON.stringify(a)} · ${b.ok ? 'prompt' : 'ERR ' + JSON.stringify(b)} · ${it.label}`);
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { describe };

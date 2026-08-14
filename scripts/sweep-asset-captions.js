#!/usr/bin/env node
/*
 * sweep-asset-captions.js — READ-ONLY. What is missing from a chat's Assets
 * tab: labels, MODEL · QUALITY captions, filed prompts, and the unlabeled
 * claude-deliveries strays.
 *
 * WHY: the four filing rules in CLAUDE.md ("LABEL every image you deliver",
 * "FILE THE MODEL · QUALITY CAPTION on every image too", "POST THE PROMPT for
 * every image you deliver", and the claude-deliveries hole) are rules chats
 * forget, and nothing ever told anyone. Measured 2026-08-13 across the three
 * most recently active image-making chats: one held 150 images with 124
 * missing the model · quality caption and 26 unlabeled claude-deliveries
 * copies sitting beside their captioned originals. This turns "did I file
 * everything?" into one command.
 *
 * IT NEVER WRITES ANYTHING. Not a POST, not a PATCH — see the note it prints
 * at the end. A quality caption cannot be honestly reconstructed by a later
 * chat (CLAUDE.md, measured: of 1,938 caption-less images only 31 were
 * recoverable), so guessing one is worse than leaving it blank. This report
 * points each chat at its OWN mess, while it still remembers how it made the
 * pictures.
 *
 * USAGE
 *   node scripts/sweep-asset-captions.js                 # recently active chats
 *   node scripts/sweep-asset-captions.js --active 14     # …over 14 days
 *   node scripts/sweep-asset-captions.js --chat <name>   # ONE chat, full detail
 *   node scripts/sweep-asset-captions.js --all           # every chat (slow)
 *   node scripts/sweep-asset-captions.js --json          # machine readable
 *
 * A chat delivering images should run it on ITSELF before finishing:
 *   node scripts/sweep-asset-captions.js --chat <your chat slug>
 *
 * ENV: FORGE_BASE (default the live app), STUDIO_TOKEN when the server is gated.
 */
'use strict';

const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');
const TOKEN = process.env.STUDIO_TOKEN || '';
const PAGE = 150;              // the Assets tab's own page size
const DEFAULT_ACTIVE_DAYS = 7;

/* ─────────────────────────── the classifier ──────────────────────────────
 * Exported and pure, so scripts/test-sweep-asset-captions.js can drive it
 * with fixture assets and no server. One asset in, the list of what it is
 * missing out.
 *
 * The four questions, and why each is asked the way it is:
 *
 *   label   — `description` is what Sophie reviews by and what the Assets
 *             search matches. The hook writes it from a markdown link's text,
 *             so an image delivered as a bare url arrives with none.
 *   caption — the asset doc's `prompt` field carries the curated MODEL ·
 *             QUALITY tag ("gpt-image-2 · medium"). The hook's own default is
 *             "from <chat>", which has no separator — so the presence of a
 *             MIDDLE DOT is the test. It is a weak test on purpose: this
 *             report says "nothing here names the model and the quality", and
 *             only the chat that made the picture can say what they were.
 *   prompt  — promptStyle / promptContent, the PROMPT overlay's two halves.
 *             Either side counts as filed; neither means the button is hidden.
 *   stray   — the claude-deliveries hole: an image sent as a chat FILE is
 *             re-uploaded by the hook under a fresh random filename, so the
 *             tab's filename union cannot join it to the captioned original
 *             and it lands as its own unlabeled tile. `alts` is checked too,
 *             because a tile that DID merge carries its other paths there.
 *
 * ONE EXCEPTION, AND IT IS ABOUT HONESTY: a picture out of one of Sophie's own
 * SOURCE LIBRARIES — the Dump, the crystal photos, her Midjourney exports —
 * was never generated from words, so "no filed prompt" and "no MODEL · QUALITY
 * caption" are not findings against it. There is no model and there was no
 * prompt; counting them told a chat to go and file something that does not
 * exist. A missing LABEL is still a finding: a phone photo in an Assets tab
 * needs saying what it is as much as anything else does. The prefix list is
 * asset-guard.js's SOURCE_LIBRARY_PREFIXES — ONE copy, read here and there.
 */
const DELIVERIES = /\/claude-deliveries\//;
const { sourceLibraryPrefix } = require('../asset-guard');

function classifyAsset(asset) {
  const a = asset || {};
  const url = typeof a.url === 'string' ? a.url : '';
  const label = typeof a.description === 'string' ? a.description.trim() : '';
  const caption = typeof a.prompt === 'string' ? a.prompt.trim() : '';
  const paths = [url].concat(Array.isArray(a.alts) ? a.alts.filter(x => typeof x === 'string') : []);

  // Judged over every path, not just the primary one: a merged tile can carry
  // the library photo on `url` and a re-uploaded copy in `alts`, or the other
  // way round, and it is one phone photo either way.
  const library = paths.some(p => !!sourceLibraryPrefix(p));

  const noLabel = !label;
  // A middle dot is what "gpt-image-2 · medium" has and "from <chat>" hasn't.
  const noCaption = !library && !caption.includes('·');
  const noPrompt = !library
    && !String(a.promptStyle || '').trim() && !String(a.promptContent || '').trim();
  const stray = noLabel && paths.some(p => DELIVERIES.test(p));

  const missing = [];
  if (noLabel) missing.push('label');
  if (noCaption) missing.push('caption');
  if (noPrompt) missing.push('prompt');

  return { url, label, caption, library, noLabel, noCaption, noPrompt, stray, missing };
}

/* ─────────────────────────────── the sweep ─────────────────────────────── */

const headers = {};
if (TOKEN) headers['x-studio-token'] = TOKEN;

async function getJSON(path) {
  const r = await fetch(BASE + path, { headers });          // GET only, always
  if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** Every image in a chat's Assets tab. The route is PAGED — walk it. */
async function allAssets(chat) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const d = await getJSON(
      `/api/gallery/assets?chat=${encodeURIComponent(chat)}&limit=${PAGE}&offset=${offset}`);
    const page = Array.isArray(d.assets) ? d.assets : [];
    out.push(...page);
    const total = Number.isFinite(d.total) ? d.total : out.length;
    // Stop on a short page as well as on the count: a page can come back
    // shorter than `limit` when unusable docs are dropped from it, and
    // trusting only `total` would then loop forever on an empty tail.
    if (!page.length || out.length >= total) return { assets: out, total };
  }
}

function sweepChat(chat, assets) {
  const rows = assets.map(classifyAsset);
  return {
    chat,
    images: rows.length,
    noLabel: rows.filter(r => r.noLabel).length,
    noCaption: rows.filter(r => r.noCaption).length,
    noPrompt: rows.filter(r => r.noPrompt).length,
    strays: rows.filter(r => r.stray).length,
    rows,
  };
}

/** The chat list, from the registry the feed already hands out. */
async function chatList({ all, days }) {
  const d = await getJSON('/api/chatfeed?limit=1');
  const reg = d.chats || {};
  const since = Date.now() - days * 86400 * 1000;
  return Object.keys(reg)
    .filter(slug => slug !== '__settings')
    .filter(slug => !reg[slug].deletedAt)          // a deleted chat is not a mess to fix
    .map(slug => ({ chat: slug, lastSeen: reg[slug].lastSeen || '' }))
    .filter(c => all || (c.lastSeen && Date.parse(c.lastSeen) >= since))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
    .map(c => c.chat);
}

const CLOSING = [
  '',
  'A MODEL · QUALITY caption can only be filed by the chat that MADE the image,',
  'at the time it made it — nothing on the record recovers it afterwards, and a',
  'guessed one puts a confident wrong number in front of Sophie forever. So this',
  'report writes nothing. Fix your own chat while you still remember the run:',
  '  caption  POST /api/gallery { assetsOnly:true, chat, url, prompt:"gpt-image-2 · medium", description }',
  '  prompt   POST /api/gallery/assets/prompt { chat, url, style, content }   (the EXACT text sent)',
  '  strays   after any SendUserFile, label the new claude-deliveries/* tiles too',
  'Where the exact text is genuinely gone, leave it empty and say so.',
];

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = n => argv.includes(n);
  const val = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const one = val('--chat');
  const json = flag('--json');
  const all = flag('--all');
  const days = Number(val('--active') || DEFAULT_ACTIVE_DAYS);
  if (!Number.isFinite(days) || days <= 0) throw new Error('--active wants a number of days');

  const chats = one ? [one] : await chatList({ all, days });
  if (!chats.length) {
    console.log(`No chats seen in the last ${days} days. Use --all to sweep every chat.`);
    return;
  }

  const report = [];
  for (const chat of chats) {
    let got;
    try {
      got = await allAssets(chat);
    } catch (e) {
      report.push({ chat, error: e.message });
      continue;
    }
    if (!got.assets.length) continue;               // a chat with no images has no mess
    report.push(sweepChat(chat, got.assets));
  }

  if (json) {
    console.log(JSON.stringify({
      base: BASE,
      scope: one ? { chat: one } : all ? { all: true } : { activeDays: days },
      chats: report.map(r => (r.error ? r : {
        chat: r.chat, images: r.images, noLabel: r.noLabel, noCaption: r.noCaption,
        noPrompt: r.noPrompt, strays: r.strays,
        offenders: r.rows.filter(x => x.missing.length).map(x => ({
          url: x.url, label: x.label, caption: x.caption,
          missing: x.missing, stray: x.stray,
        })),
      })),
    }, null, 2));
    return;
  }

  const scope = one ? `chat "${one}"`
    : all ? `all ${chats.length} chats`
      : `${chats.length} chats seen in the last ${days} days`;
  console.log(`\nasset captions — ${scope}  (${BASE})\n`);

  const clean = [];
  for (const r of report) {
    if (r.error) { console.log(`  ??  ${r.chat} — ${r.error}`); continue; }
    const bits = [];
    if (r.noLabel) bits.push(`${r.noLabel} unlabeled`);
    if (r.noCaption) bits.push(`${r.noCaption} no model · quality`);
    if (r.noPrompt) bits.push(`${r.noPrompt} no prompt`);
    if (r.strays) bits.push(`${r.strays} claude-deliveries strays`);
    if (!bits.length) { clean.push(r.chat); continue; }
    console.log(`  ${r.chat} — ${r.images} images: ${bits.join(', ')}`);
  }
  if (clean.length) console.log(`\n  fully filed: ${clean.join(', ')}`);

  // One chat = the working view: name every image that is short of something.
  if (one) {
    const r = report.find(x => x.chat === one && !x.error);
    if (!r) console.log(`  (nothing in the Assets tab for "${one}")`);
    else {
      const bad = r.rows.filter(x => x.missing.length);
      console.log(`\n  ${bad.length} of ${r.images} images are short of something:\n`);
      for (const x of bad) {
        const name = x.label || '(unlabeled)';
        const tag = x.missing.join(' + ') + (x.stray ? ' + STRAY claude-deliveries copy' : '');
        console.log(`    [${tag}] ${truncate(name, 70)}`);
        console.log(`        ${truncate(x.url, 110)}`);
      }
    }
  }

  const tot = report.filter(r => !r.error).reduce((a, r) => ({
    images: a.images + r.images, noLabel: a.noLabel + r.noLabel,
    noCaption: a.noCaption + r.noCaption, noPrompt: a.noPrompt + r.noPrompt,
    strays: a.strays + r.strays,
  }), { images: 0, noLabel: 0, noCaption: 0, noPrompt: 0, strays: 0 });
  console.log(`\n  ${tot.images} images · ${tot.noLabel} unlabeled · ${tot.noCaption} without a`
    + ` model · quality caption · ${tot.noPrompt} without a filed prompt · ${tot.strays} strays`);

  console.log(CLOSING.join('\n'));
  console.log('');
}

// Exported so the test can drive the classifier with fixtures and no server;
// the CLI runs only when this file IS the command.
module.exports = { classifyAsset, sweepChat, CLOSING };

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

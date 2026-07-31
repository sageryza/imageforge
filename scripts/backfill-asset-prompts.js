#!/usr/bin/env node
/*
 * backfill-asset-prompts.js — file the PROMPT behind images that are already in
 * a chat's Assets tab, split into style + content.
 *
 * WHY: prompts are only stored from the moment a chat posts them, so every
 * image filed before that has an empty Prompt overlay. A chat still has its own
 * prompts in its history, so it can fill its own back catalogue in one pass.
 *
 * USAGE
 *   # 1. see what this chat has, and which images still have no prompt
 *   node scripts/backfill-asset-prompts.js <chat> --list
 *
 *   # 2. write a prompts file, then post it (25 images per request)
 *   node scripts/backfill-asset-prompts.js <chat> prompts.json [--dry-run]
 *
 * prompts.json is an array. Identify each image by "url" (exact) or "match" (a
 * substring of its url OR of the label/description shown in the app — easier,
 * because a chat remembers what it called an image, not its storage hash):
 *   [
 *     { "url":   "https://storage.googleapis.com/…/abc.png",
 *       "style": "wtr watercolor drawing, loose wash, soft edges",
 *       "content": "a woman on a park bench feeding crows" },
 *     { "match": "Penny — the blue Kleenex",
 *       "style": "gosh gouache, flat matte shapes",
 *       "content": "a small dog asleep in a shoebox" }
 *   ]
 * An object keyed by url works too: { "<url>": {style, content} }.
 * Sending only one side leaves the other side alone. "" clears a side.
 *
 * ENV: FORGE_BASE (default the live app), STUDIO_TOKEN when the server is gated.
 */
const fs = require('fs');

const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');
const TOKEN = process.env.STUDIO_TOKEN || '';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const rest = args.filter((a) => !a.startsWith('--'));
const chat = rest[0];
const file = rest[1];
const DRY = flags.has('--dry-run');

if (!chat) {
  console.error('usage: backfill-asset-prompts.js <chat> [prompts.json] [--list] [--dry-run]');
  process.exit(1);
}

const headers = { 'Content-Type': 'application/json' };
if (TOKEN) headers['x-studio-token'] = TOKEN;

async function assets() {
  const r = await fetch(`${BASE}/api/gallery/assets?chat=${encodeURIComponent(chat)}&limit=500`, { headers });
  if (!r.ok) throw new Error(`GET assets ${r.status} ${await r.text()}`);
  return (await r.json()).assets || [];
}

// Which entry in the prompts file is this image? Exact url first, then a
// substring against the url or the label the chat gave it.
function pick(entries, asset) {
  const label = `${asset.description || ''} ${asset.prompt || ''}`;
  return entries.find((e) => e.url && e.url === asset.url)
    || entries.find((e) => e.match && (asset.url.includes(e.match) || label.includes(e.match)));
}

(async () => {
  const list = await assets();
  if (flags.has('--list') || !file) {
    console.log(`${chat}: ${list.length} images`);
    list.forEach((a) => {
      const has = [a.promptStyle ? 'style' : null, a.promptContent ? 'content' : null]
        .filter(Boolean).join('+') || 'no prompt';
      console.log(`  [${has}] ${a.description || a.prompt || '(unlabeled)'}\n      ${a.url}`);
    });
    const missing = list.filter((a) => !a.promptStyle && !a.promptContent).length;
    console.log(`\n${missing} of ${list.length} still have no prompt.`);
    if (!file) console.log('Pass a prompts.json to fill them (see the header of this file).');
    return;
  }

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = Array.isArray(parsed)
    ? parsed
    : Object.keys(parsed).map((url) => Object.assign({ url }, parsed[url]));

  const items = [];
  const unmatched = [];
  entries.forEach((e) => {
    const hit = list.find((a) => pick([e], a));
    if (!hit) { unmatched.push(e.url || e.match); return; }
    const it = { url: hit.url };
    if (e.style !== undefined) it.style = e.style;
    if (e.content !== undefined) it.content = e.content;
    items.push(it);
  });

  if (unmatched.length) {
    console.log(`No image in ${chat} matched: ${unmatched.join(', ')}`);
  }
  if (!items.length) { console.log('Nothing to post.'); return; }
  console.log(`${DRY ? 'Would post' : 'Posting'} prompts for ${items.length} image(s).`);
  if (DRY) { console.log(JSON.stringify(items, null, 2)); return; }

  let saved = 0;
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    const r = await fetch(`${BASE}/api/gallery/assets/prompt`, {
      method: 'POST', headers, body: JSON.stringify({ chat, items: batch }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`POST ${r.status} ${JSON.stringify(d)}`);
    saved += d.saved || 0;
    (d.results || []).filter((x) => !x.ok).forEach((x) => console.log(`  failed: ${x.url} — ${x.error}`));
  }
  console.log(`Saved ${saved} of ${items.length}.`);
})().catch((e) => { console.error(e.message); process.exit(1); });

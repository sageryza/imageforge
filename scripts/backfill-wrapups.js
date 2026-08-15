#!/usr/bin/env node
// Give every ALREADY-ARCHIVED chat a wrap-up (Aug 2026, Sophie: "whenever I'm
// about to archive a chat the last message of the chat is them explaining what
// the chat was about and what went down").
//
// Chats archived from now on carry their own — written by the chat, or frozen
// from its Update card as it goes past. This is for the ones that were already
// in there when the feature shipped: measured 2026-08-14, **73 of her 88
// archived chats showed nothing but a name**, and nothing had ever been written
// for them, so only reading the thread back can rescue those.
//
// IT SPENDS MONEY — one Claude call per chat, server-side. So:
//   node scripts/backfill-wrapups.js                 # dry run, prints the bill
//   node scripts/backfill-wrapups.js --apply         # do it
//   node scripts/backfill-wrapups.js --apply --limit 5
//   node scripts/backfill-wrapups.js --apply --chat <slug>
// Idempotent: a chat that already has a wrap-up is skipped by the server, so a
// re-run after a failure costs only the ones still missing. --force overrides.
'use strict';

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const FORCE = argv.includes('--force');
const arg = (f, d) => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : d; };
const LIMIT = parseInt(arg('--limit', '0'), 10) || 0;
const ONLY = arg('--chat', '');

// Measured shape of the digest the route sends: capped at 9,000 chars of
// transcript (~2.3k tokens) plus a ~250-token system prompt, answering with
// ~250 tokens. At Sonnet's rates that is well under 2c a chat — the estimate
// below is deliberately rounded UP so the number she is given is never light.
const CENTS_EACH = 2;

const hdr = { 'Content-Type': 'application/json' };
if (process.env.STUDIO_TOKEN) hdr['x-studio-token'] = process.env.STUDIO_TOKEN;

async function main() {
  const r = await fetch(BASE + '/api/chatfeed?limit=1&scan=200');
  if (!r.ok) throw new Error('feed read failed: ' + r.status);
  const chats = (await r.json()).chats || {};

  let names = Object.keys(chats).filter((n) => {
    const c = chats[n];
    if (!c.archived || c.deletedAt) return false;          // archived pile only
    if (!FORCE && (c.wrapUp || c.wrapLine)) return false;  // already has one
    return true;
  });
  if (ONLY) names = names.filter((n) => n === ONLY);
  names.sort();
  if (LIMIT) names = names.slice(0, LIMIT);

  const bill = '$' + (names.length * CENTS_EACH / 100).toFixed(2);
  console.log(names.length + ' archived chats have no wrap-up');
  console.log('estimated cost: ~' + bill + ' (about ' + CENTS_EACH + 'c each, rounded up)');
  if (!names.length) return;
  if (!APPLY) {
    names.forEach((n) => console.log('   ' + n));
    console.log('\ndry run — pass --apply to write them');
    return;
  }

  let done = 0; let failed = 0; let skipped = 0;
  for (const chat of names) {
    try {
      const res = await fetch(BASE + '/api/chatfeed/wrapup/write', {
        method: 'POST', headers: hdr, body: JSON.stringify({ chat, force: FORCE }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { failed++; console.log('  FAIL ' + chat + ' — ' + (j.error || res.status)); continue; }
      if (j.skipped) { skipped++; console.log('  skip ' + chat + ' — ' + j.skipped); continue; }
      done++;
      console.log('  ok   ' + chat + ' — ' + (j.wrapLine || '').slice(0, 80));
    } catch (e) {
      failed++; console.log('  FAIL ' + chat + ' — ' + e.message);
    }
  }
  console.log('\nwrote ' + done + ', skipped ' + skipped + ', failed ' + failed);
  if (failed) console.log('re-run to retry only the ones still missing — it is idempotent');
}

main().catch((e) => { console.error(e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * check-cost-guards.js — verify the Firestore cost fixes are still in place.
 *
 * WHY THIS EXISTS
 * In July 2026 the Chats page was silently costing ~$40/mo: every poll re-read
 * the newest 1500 forge-chat-feed docs, and /api/wall re-walked every Storage
 * object, on a 60s timer. Reads are invisible — nothing errors, nothing slows
 * down, it only shows on the bill — which is exactly how it went unnoticed.
 * The fixes (#577, #578): delta polling (?since=), a launch cache in
 * localStorage, and a memory-cached wall listing. This script checks that all
 * three are still alive on the live server, so a future change that quietly
 * regresses one shows up in weeks, not on an invoice. A scheduled session runs
 * it every couple of weeks.
 *
 * Zero dependencies (global fetch, Node 18+), zero writes, ~6 reads total.
 * Exit 0 = all guards in place; exit 1 = something regressed (details printed).
 */

const BASE = process.env.FORGE_URL || 'https://imageforge-q125.onrender.com';
const ok = [];
const fails = [];

// The first hit may eat a Render cold start, so be patient once.
async function get(path, asJson) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return asJson ? r.json() : r.text();
}

(async () => {
  // 1. Delta polling: a ?since= in the future must answer delta:true with zero
  //    messages. If this breaks, every poll is back to reading the full feed.
  try {
    const d = await get('/api/chatfeed?since=2099-01-01T00:00:00.000Z', true);
    if (d.delta === true && (d.messages || []).length === 0) {
      ok.push('delta poll: answers delta:true with 0 messages');
    } else {
      fails.push('DELTA POLL REGRESSED: ?since= no longer returns an empty delta — polls are re-reading the feed');
    }
  } catch (e) { fails.push('chatfeed unreachable: ' + e.message); }

  // 2. The deployed Chats page must still carry the client half: the launch
  //    cache and the ?since= poller. (The server half working means nothing if
  //    a page regen dropped the client code.)
  try {
    const html = await get('/chats', false);
    if (html.includes('chats-cache-v1')) ok.push('chats page: launch cache present');
    else fails.push('CHATS PAGE REGRESSED: launch cache (chats-cache-v1) missing — every app-open is a 1500-doc read again');
    if (html.includes('since=')) ok.push('chats page: delta poller present');
    else fails.push('CHATS PAGE REGRESSED: ?since= poller missing — page is full-loading on a timer again');
    if (html.includes('document.hidden')) ok.push('chats page: hidden-tab pause present');
    else fails.push('CHATS PAGE REGRESSED: document.hidden check missing — backgrounded pages poll all day again');
  } catch (e) { fails.push('/chats unreachable: ' + e.message); }

  // 3. Wall cache: two calls back to back — the second must be served from
  //    memory. (The first may legitimately walk the buckets if the TTL
  //    lapsed; that's the cache filling, not a failure.)
  try {
    await get('/api/wall?limit=1', true);
    const w2 = await get('/api/wall?limit=1', true);
    if (w2.cached === true) ok.push(`wall: second call cached (total ${w2.total} images)`);
    else fails.push('WALL CACHE REGRESSED: back-to-back calls both walked the buckets');
  } catch (e) { fails.push('/api/wall unreachable: ' + e.message); }

  // 4. Wall page client half: must pause when hidden.
  try {
    const html = await get('/wall', false);
    if (html.includes('document.hidden')) ok.push('wall page: hidden-tab pause present');
    else fails.push('WALL PAGE REGRESSED: document.hidden check missing');
  } catch (e) { fails.push('/wall unreachable: ' + e.message); }

  console.log('Cost guards on ' + BASE + '\n');
  ok.forEach((s) => console.log('  PASS  ' + s));
  fails.forEach((s) => console.log('  FAIL  ' + s));
  console.log('');
  if (fails.length) {
    console.log(`${fails.length} guard(s) DOWN — reads are billing again. See CLAUDE.md "Polling is a DELTA".`);
    process.exit(1);
  }
  console.log('All cost guards in place.');
  process.exit(0);
})();

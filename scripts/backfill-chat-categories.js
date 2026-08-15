#!/usr/bin/env node
// backfill-chat-categories.js — sort the chats that were already there.
//
// The live sorter (chat-sort.js) files a chat at the end of a turn, so it only
// ever reaches chats that are still talking. Measured 2026-08-15: 187 of her
// 283 chats were unfiled, most of them asleep, and those are exactly the ones
// she has been sorting by hand.
//
// DRY BY DEFAULT. It prints the folder it would pick for every chat and writes
// nothing until `--write`, because filing takes a chat OFF her main list — a
// wrong batch would look like chats disappearing.
//
//   node scripts/backfill-chat-categories.js                 # dry, all of them
//   node scripts/backfill-chat-categories.js --limit 20      # dry, a sample
//   node scripts/backfill-chat-categories.js --write         # for real
//   node scripts/backfill-chat-categories.js --chat <slug> --write
//
// `--write` stamps `filedAt` NOW (`stampNow`), unlike a live sort: these are
// chats she would have filed by hand today, and filing by hand means "out of
// my way". A live sort stamps her last message instead so a fresh answer still
// reaches her main list — see chat-sort.js's filedStamp.
//
// FORGE_BASE overrides the server. Idempotent: a chat that already has a
// folder is skipped by the server, so re-running only picks up what is left.

// Node 18+ has fetch built in; the dependency is the fallback. This script is
// run from a chat's container, which does not always have node_modules
// installed — and a backfill that can't start is a backfill nobody runs.
const fetch = globalThis.fetch || require('node-fetch');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const WRITE = has('--write');
const ONE = val('--chat', '');
const LIMIT = Number(val('--limit', 0)) || 0;
const PAUSE_MS = Number(val('--pause', 400));

async function api(path, opts) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts && opts.headers) },
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch (_) { throw new Error(`${path}: ${text.slice(0, 200)}`); }
  if (data.error) throw new Error(`${path}: ${data.error}`);
  return data;
}

(async () => {
  const state = await api('/api/chatfeed/sort');
  if (!state.anthropic) throw new Error('ANTHROPIC_API_KEY is not set on the server — nothing can be sorted');
  if (!state.enabled) throw new Error('auto-sorting is switched off (__settings.autoSort === false)');
  console.log(`folders: ${state.categories.join(' · ')}`);
  console.log(`triage (never auto-filed): ${state.triage.join(' · ')}`);
  console.log(`${state.chats} chats — ${state.filedBySophie} hers, ${state.filedByAuto} auto, ${state.unfiled} unfiled\n`);

  let names;
  if (ONE) names = [ONE];
  else {
    // The feed's own read is the cheapest list of chats there is, and it
    // carries the registry, so the skips cost nothing here either.
    const feed = await api('/api/chatfeed?limit=1');
    names = Object.keys(feed.chats || {})
      .filter((n) => {
        const c = feed.chats[n] || {};
        return !c.category && !c.deletedAt && !c.archived && !c.movedTo;
      })
      .sort();
  }
  if (LIMIT) names = names.slice(0, LIMIT);
  console.log(`${names.length} chat${names.length === 1 ? '' : 's'} to look at`
    + (WRITE ? ' — WRITING\n' : ' — dry run, nothing will be written\n'));

  const tally = {};
  for (let i = 0; i < names.length; i++) {
    const chat = names[i];
    let out;
    try {
      out = await api('/api/chatfeed/sort', {
        method: 'POST',
        body: JSON.stringify({ chat, force: true, dry: !WRITE, stampNow: true }),
      });
    } catch (err) { out = { why: 'error', reason: String(err.message || err) }; }
    const pick = out.category || '—';
    tally[pick] = (tally[pick] || 0) + 1;
    const pad = String(i + 1).padStart(String(names.length).length);
    console.log(`${pad}/${names.length}  ${pick.padEnd(14)} ${chat}`
      + (out.reason ? `  · ${out.reason}` : '')
      + (out.why && out.why !== 'sorted' && out.why !== 'dry-run' ? `  [${out.why}]` : ''));
    if (PAUSE_MS && i < names.length - 1) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  console.log('\n' + Object.keys(tally).sort((a, b) => tally[b] - tally[a])
    .map((k) => `${k}: ${tally[k]}`).join('   '));
  if (!WRITE) console.log('\ndry run — re-run with --write to file them');
})().catch((err) => { console.error(String(err.message || err)); process.exit(1); });

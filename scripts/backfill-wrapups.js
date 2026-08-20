#!/usr/bin/env node
// BACKFILL THE ARCHIVE WRAP-UPS — write the summary for every chat that has
// none (Aug 2026, Sophie: "maybe we should have summaries written up for every
// chat in that note box automatically … OK, just run it on all the chats").
//
// Why a backfill exists at all: a chat is ASLEEP by the time she archives it,
// so it cannot summarise itself then. `POST /api/chatfeed/wrapup/write` reads
// the thread the app already stores and writes the three lengths + the open
// line. This script is just the loop over her chats.
//
// It is DELIBERATELY not forced: the route skips a chat that already has a
// wrap-up, so re-running this costs nothing for the ones already done and can
// never overwrite one a chat wrote about itself. Use the Summarize button in
// the archive sheet to rewrite a single chat.
//
//   node scripts/backfill-wrapups.js --dry-run     # what it would do, and the price
//   node scripts/backfill-wrapups.js               # do it
//   node scripts/backfill-wrapups.js --limit 20    # a first slice, to check the writing
//   node scripts/backfill-wrapups.js --chat <slug> # just one (still skips if present)
//   node scripts/backfill-wrapups.js --rewrite-over 180 --dry-run
//                                                 # REWRITE the ones that came
//                                                 # back too long, after the
//                                                 # prompt was tightened
//
// FORGE_BASE overrides the server. ~1¢ a chat on Sonnet — say the estimate
// before running it, and ask above $3 (the house spending rule).
'use strict';

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const argv = process.argv.slice(2);
const flag = (n) => argv.indexOf(n) > -1;
const val = (n, d) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const DRY = flag('--dry-run');
const ONE = val('--chat', '');
const LIMIT = Number(val('--limit', 0)) || 0;
const CONC = Math.max(1, Number(val('--concurrency', 3)) || 3);
// REWRITING, not filling in (Aug 2026: the short half came back at a median of
// 218 characters against a 180 cap, so the prompt was tightened and the ones
// already on file had to be re-asked). This is the ONLY thing that passes
// `force`, and it is deliberately narrow: it re-asks the chats whose short
// summary is longer than N characters and leaves every other one alone, so a
// rerun cannot quietly re-bill the whole registry.
const OVER = Number(val('--rewrite-over', 0)) || 0;
const CENTS = 1;                       // measured: ~1¢ a summary on claude-sonnet-5

const api = async (path, opts) => {
  const r = await fetch(BASE + path, Object.assign({
    headers: Object.assign({ 'Content-Type': 'application/json' },
      process.env.STUDIO_TOKEN ? { 'x-studio-token': process.env.STUDIO_TOKEN } : {}),
  }, opts || {}));
  const t = await r.text();
  try { return JSON.parse(t); } catch (_) { return { error: 'HTTP ' + r.status + ': ' + t.slice(0, 200) }; }
};

(async () => {
  const feed = await api('/api/chatfeed?limit=1');
  if (!feed || !feed.chats) { console.error('could not read the feed:', feed && feed.error); process.exit(1); }
  const all = Object.keys(feed.chats);
  // The route skips these too — filtering here is what makes the estimate real.
  const todo = all.filter((n) => {
    const c = feed.chats[n] || {};
    if (ONE) return n === ONE;
    if (OVER) return String(c.wrapUp || '').length > OVER;
    return !(c.wrapLine || c.wrapUp);
  });
  const list = LIMIT ? todo.slice(0, LIMIT) : todo;
  console.log(OVER
    ? all.length + ' chats, ' + list.length + ' with a short summary over ' + OVER
      + ' characters — rewriting those'
    : all.length + ' chats, ' + (all.length - todo.length) + ' already summarised, '
      + list.length + ' to write');
  console.log('estimated cost: about $' + (list.length * CENTS / 100).toFixed(2));
  if (DRY) { list.slice(0, 20).forEach((n) => console.log('  would write ' + n));
    if (list.length > 20) console.log('  … and ' + (list.length - 20) + ' more');
    return; }

  let done = 0, wrote = 0, skipped = 0, empty = 0, failed = 0;
  const fails = [];
  const queue = list.slice();
  const worker = async () => {
    for (;;) {
      const chat = queue.shift();
      if (!chat) return;
      let d;
      try {
        d = await api('/api/chatfeed/wrapup/write', {
          method: 'POST',
          body: JSON.stringify(OVER ? { chat, force: true } : { chat }),
        });
      }
      catch (e) { d = { error: String((e && e.message) || e) }; }
      done++;
      if (d && d.ok && d.skipped) skipped++;
      else if (d && d.ok) wrote++;
      else if (d && /no messages/.test(d.error || '')) empty++;
      else { failed++; fails.push(chat + ': ' + ((d && d.error) || 'unknown')); }
      const tag = d && d.ok && !d.skipped ? '✓' : (d && d.ok ? '·' : (/no messages/.test((d && d.error) || '') ? '∅' : '✗'));
      console.log('[' + done + '/' + list.length + '] ' + tag + ' ' + chat
        + (d && d.ok && !d.skipped ? ' — ' + String(d.wrapLine || '').slice(0, 80) : ''));
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log('\nwrote ' + wrote + ' · already had one ' + skipped + ' · no messages ' + empty
    + ' · failed ' + failed);
  console.log('actual spend: about $' + (wrote * CENTS / 100).toFixed(2));
  if (fails.length) { console.log('\nfailures:'); fails.slice(0, 40).forEach((f) => console.log('  ' + f)); }
})();

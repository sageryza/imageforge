#!/usr/bin/env node
// Stamp `filedAt` on every chat that already sits in a category (Aug 2026).
//
// A filed chat rejoins the main chat list when it ANSWERS — but only for a
// reply that landed after she filed it, which is what `filedAt` records. The
// chats filed before that field existed carry no stamp, so without this pass
// they could never pop out, and the feature would be silently dead for exactly
// the chats she has actually filed.
//
// Stamping them at NOW is the right baseline, not their filing time (which
// nothing recorded): from this moment on, any new reply brings the chat back,
// and the replies already sitting there — which she has had every chance to
// read — stay put. The alternative, back-dating to zero, would empty every
// folder onto the main list in one go.
//
// Idempotent: a chat that already has a stamp is left alone (`--force`
// restamps). Uses the same registry the app reads, via the public API, so it
// needs no service account.
//
//   node scripts/backfill-filedat.js [--dry-run] [--force] [--base <url>]

const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return (i > 0 && process.argv[i + 1]) || process.env.FORGE_BASE
    || 'https://imageforge-q125.onrender.com';
})();
const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const TOKEN = process.env.STUDIO_TOKEN || '';

const headers = () => Object.assign({ 'Content-Type': 'application/json' },
  TOKEN ? { 'x-studio-token': TOKEN } : {});

(async () => {
  const r = await fetch(BASE + '/api/chatfeed?limit=1', { headers: headers() });
  if (!r.ok) throw new Error('feed read failed: ' + r.status);
  const { chats } = await r.json();
  const filed = Object.entries(chats || {})
    .filter(([, v]) => v && v.category)
    .filter(([, v]) => FORCE || !v.filedAt);

  if (!filed.length) { console.log('nothing to stamp — every filed chat already has one'); return; }
  console.log((DRY ? 'would stamp ' : 'stamping ') + filed.length + ' filed chat(s):');
  filed.forEach(([n, v]) => console.log('  ' + n.padEnd(40) + v.category));
  if (DRY) return;

  // One POST per category, re-filing its chats — the route stamps filedAt as a
  // side effect of setting the category, so this needs no new endpoint and
  // writes nothing the app doesn't already write.
  const byCat = {};
  filed.forEach(([n, v]) => { (byCat[v.category] = byCat[v.category] || []).push(n); });
  for (const [category, names] of Object.entries(byCat)) {
    const res = await fetch(BASE + '/api/chatfeed/category', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ chats: names, category }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(category + ': ' + (body.ok ? names.length + ' stamped' : 'FAILED ' + res.status));
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });

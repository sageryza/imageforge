#!/usr/bin/env node
/* apply-chapters.js — POST the approved chapter plan (Aug 2026).
 *
 * The plan lives in docs/chapters/chapter-plan.json, one entry per chat:
 *   { "<chat slug>": { first, last, total, chapters:[{title, at, n}] } }
 * `n` is the measured message count the boundary produced when the plan was
 * built — it is documentation, not input; POST /api/chatfeed/chapters takes
 * only {title, at}.
 *
 * A chapter MOVES NOTHING: it is a title and a time on the registry doc, and
 * the thread draws a heading where the chapter changes. So a wrong boundary
 * costs one more run of this script and can never damage a thread. Sending
 * [] for a chat clears its chapters.
 *
 *   node scripts/apply-chapters.js --dry-run          # print, POST nothing
 *   node scripts/apply-chapters.js                    # every chat in the plan
 *   node scripts/apply-chapters.js --chat jonas       # just one
 *
 * FORGE_BASE overrides the server.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const PLAN = path.join(__dirname, '..', 'docs', 'chapters', 'chapter-plan.json');
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = (() => { const i = args.indexOf('--chat'); return i >= 0 ? args[i + 1] : null; })();

(async () => {
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  const chats = Object.keys(plan).filter((c) => !only || c === only);
  if (!chats.length) { console.error('no chats matched'); process.exit(1); }
  for (const chat of chats) {
    const chapters = plan[chat].chapters.map((c) => ({ title: c.title, at: c.at }));
    console.log(`\n## ${chat} — ${chapters.length} chapters (${plan[chat].total} messages)`);
    chapters.forEach((c, i) => console.log(`   ${i + 1}. ${c.at.slice(0, 16)}  ${c.title}`));
    if (dry) continue;
    const r = await fetch(`${BASE}/api/chatfeed/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat, chapters }),
    });
    const j = await r.json().catch(() => ({}));
    // The route 404s a chat that does not exist rather than creating one —
    // a typo would otherwise put a phantom row in her chat list.
    console.log(r.ok ? `   -> ok, ${(j.chapters || []).length} stored` : `   -> FAILED ${r.status} ${j.error || ''}`);
  }
  if (dry) console.log('\n(dry run — nothing was posted)');
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// Tag the Story Room shelf's stories with their category chip (Aug 2026).
//
// The shelf files every story under one chip — Unsorted · Personal · Witch ·
// Lessons · NDE. A story with no `category` field files under UNSORTED (it was
// Personal until 2026-08-26, when Personal became a pile of Sophie's own), so
// this script only has to tag the two groups it can name from a title:
//   - a title starting "NDE"            → nde
//   - "The Lessons" / "Astrology fable" → lessons
// Everything else is left alone (= Unsorted, hers to file). Idempotent — re-running skips
// pads already carrying the right tag. `--dry-run` prints the plan.
//
//   node scripts/seed-pad-categories.js [--dry-run]
//   FORGE_BASE overrides the server (default the live app).

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const TOKEN = process.env.STUDIO_TOKEN || '';
const DRY = process.argv.includes('--dry-run');

const LESSONS = new Set(['The Lessons', 'Astrology fable']);
function categoryFor(title) {
  const t = String(title || '').trim();
  if (/^NDE\b/i.test(t)) return 'nde';
  if (LESSONS.has(t)) return 'lessons';
  return null; // Unsorted — the default, no tag needed
}

async function main() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['x-studio-token'] = TOKEN;
  const r = await fetch(`${BASE}/api/scratchpad/pads`, { headers });
  if (!r.ok) throw new Error(`GET /pads ${r.status}`);
  const { pads } = await r.json();
  let set = 0, kept = 0, skipped = 0;
  for (const p of pads) {
    const want = categoryFor(p.title);
    if (!want) { skipped++; continue; }
    if (p.category === want) { kept++; continue; }
    console.log(`${DRY ? '[dry] ' : ''}${p.id}  "${p.title}" → ${want}`);
    if (!DRY) {
      const w = await fetch(`${BASE}/api/scratchpad/pads/category`, {
        method: 'POST', headers,
        body: JSON.stringify({ pad: p.id, category: want }),
      });
      if (!w.ok) throw new Error(`POST /pads/category ${p.id} ${w.status}`);
    }
    set++;
  }
  console.log(`${set} tagged, ${kept} already right, ${skipped} left unsorted.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });

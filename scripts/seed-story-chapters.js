#!/usr/bin/env node
// SEED A STORY'S CHAPTERS BY THEIR WORDS (2026-09-06). A chapter is a marker
// on the beat that opens it (`beat.chapter`, POST /api/scratchpad/chapter);
// this finds each opening beat by a phrase of Sophie's own words — in the
// beat's caption OR its drawing prompt, whichever carries them — and marks
// it. FIRST match in beat order wins ("the first 'ok the room we were
// watching the matrix'"). Nothing is reordered or rewritten: the only field
// this touches is `chapter`, on exactly the beats the plan names.
//
//   node scripts/seed-story-chapters.js                 # dry: prints the plan
//   node scripts/seed-story-chapters.js --go            # writes it
//   node scripts/seed-story-chapters.js --pad <id> --plan plan.json [--go]
//
// A story already carrying ANY chapter is refused without --force: by then
// she has been naming them herself, and a seed over her words is the wrong
// direction. FORGE_BASE overrides the server.
const fs = require('fs');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const TOKEN = process.env.STUDIO_TOKEN || '';

// Sophie's hospital story ("nautchaug", pad 5mwDoZPOwPqA37Hr2yL5) — ten
// chapters, a starting point she can rename or move on the page. The ER is
// placed on the bathroom beat because on her pad it sits AFTER the library
// and the emergency-room beats (read live 2026-09-06); the fallback the brief
// named ("the emergency room, after they questioned me") was not needed.
const HOSPITAL = {
  pad: '5mwDoZPOwPqA37Hr2yL5',
  chapters: [
    { title: 'Before', find: 'i spent a couple days in a storage shed' },
    { title: 'The ER', find: 'on the first night, i went into the bathroom and cried' },
    { title: 'The ward', find: 'we were all playing cards in the main area' },
    { title: 'The Matrix', find: 'ok the room we were watching the matrix' },
    { title: "The tag guy's wife", find: 'shot of her car' },
    { title: 'The boys', find: 'then there was i forget his name' },
    { title: 'Jake', find: 'them there was jake' },
    { title: 'The pills', find: 'also they caught me (me) doing this weird pivot thing' },
    { title: 'The doctors', find: 'there was only one part i (me) cried' },
    { title: 'Getting out', find: 'there was a scene where they diagnosed me' },
  ],
};

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// The words a beat carries — its caption first, its drawing prompt behind it.
const wordsOf = (b) => norm((b.text || '') + '\n' + (b.prompt || ''));

// Pure: which beat opens each chapter. `{ id, at, title, first }` per chapter,
// or `missing` naming the phrases nothing carries. Refuses two chapters
// landing on ONE beat — that is a plan error, not a story to write.
function planFor(beats, chapters) {
  const out = [], missing = [], used = new Set();
  chapters.forEach((c) => {
    const want = norm(c.find);
    const at = beats.findIndex((b) => wordsOf(b).includes(want));
    if (at < 0) { missing.push(c); return; }
    const b = beats[at];
    if (used.has(b.id)) throw new Error(`two chapters land on beat ${at} (${b.id}): "${c.title}"`);
    used.add(b.id);
    out.push({ id: b.id, at, title: c.title, first: norm(b.text || b.prompt).slice(0, 70) });
  });
  // beat order, not plan order — a plan out of order is worth seeing
  out.sort((a, b) => a.at - b.at);
  return { plan: out, missing };
}

async function api(p, opts) {
  const headers = Object.assign({ 'content-type': 'application/json' }, TOKEN ? { 'x-studio-token': TOKEN } : {});
  const r = await fetch(BASE + '/api/scratchpad' + p, Object.assign({ headers }, opts || {}));
  if (!r.ok) throw new Error(`${p} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const go = argv.includes('--go'), force = argv.includes('--force');
  const spec = arg('--plan') ? JSON.parse(fs.readFileSync(arg('--plan'), 'utf8')) : HOSPITAL;
  const pad = arg('--pad') || spec.pad;
  const chapters = spec.chapters;
  const d = await api(`?pad=${encodeURIComponent(pad)}`);
  const beats = d.beats || [];
  console.log(`${d.title || 'Untitled'} — ${beats.length} beats`);
  const has = beats.filter((b) => b.chapter);
  if (has.length && !force) {
    console.log(`REFUSED: the story already carries ${has.length} chapter(s) — ` +
      has.map((b) => `"${b.chapter}"`).join(', ') + ` (--force to seed over them)`);
    process.exit(2);
  }
  const { plan, missing } = planFor(beats, chapters);
  plan.forEach((p) => console.log(`  ${String(p.at).padStart(3)}  ${p.title.padEnd(20)} ← "${p.first}"`));
  if (missing.length) {
    console.log('MISSING — nothing on the pad carries these words:');
    missing.forEach((m) => console.log(`  ${m.title}: "${m.find}"`));
    process.exit(1);
  }
  if (!go) { console.log('(dry — add --go to write)'); return; }
  for (const p of plan) {
    await api('/chapter', { method: 'POST', body: JSON.stringify({ pad, id: p.id, title: p.title }) });
    console.log(`  set ${p.title}`);
  }
  const after = await api(`?pad=${encodeURIComponent(pad)}`);
  const got = (after.beats || []).filter((b) => b.chapter).map((b) => b.chapter);
  console.log(`done — ${got.length} chapters on the pad: ${got.join(' · ')}`);
}

module.exports = { planFor, HOSPITAL, norm };
if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });

// Merge every source of Sophie's dreams into one chronological archive.
//
//   node docs/dream-archive/collect-journal.mjs   # writes source-journal.json
//   node docs/dream-archive/build-archive.mjs     # writes archive.json
//
// Sources, and what each one actually has:
//   voice memos  (membry Storage manifest)  text + ORIGINAL AUDIO + exact time
//   dream pipeline (deckfactory forge-dreams) text + ILLUSTRATIONS, no audio
//                                            (it transcribes, then discards)
//   witch app    (forge-witch-dream-illus)   text + one illustration
//   journal      (scanned handwriting)       text only, year inferred
//
// Nothing is deleted and nothing is guessed silently: a dream whose date can't
// be known carries dateUncertain, and re-runs/re-renders of the same dream are
// folded into one entry with the others kept as `versions`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from '/home/user/imageforge/node_modules/firebase-admin/lib/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'archive.json');

const deckSa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const membrySa = JSON.parse(process.env.STORY_FIREBASE_SERVICE_ACCOUNT);
const deck = admin.initializeApp({ credential: admin.credential.cert(deckSa) }, 'deck');
const membry = admin.initializeApp({
  credential: admin.credential.cert(membrySa),
  storageBucket: membrySa.project_id + '.firebasestorage.app',
}, 'membry');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const ms = (v) => { if (!v) return 0; if (v.toDate) return v.toDate().getTime(); const t = Date.parse(v); return isNaN(t) ? 0 : t; };
const PT = (iso, withTime = true) => new Date(iso).toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric',
  ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
});

// ── 1. voice memos ─────────────────────────────────────────────────────────
// The id carries the real recording time (local stamp + UTC), so these are the
// only dreams with a precise moment attached — and the only ones with audio.
async function voiceMemos() {
  const [buf] = await membry.storage().bucket().file('memo-audio/manifest.json').download();
  const m = JSON.parse(buf.toString());
  return m.memos.filter((x) => x.cat === 'dream').map((x) => {
    // e.g. 2022-04-13_1000_2022-04-13T17_00_40Z
    const iso = (/_(\d{4}-\d{2}-\d{2}T[\dT_]+Z)$/.exec(x.id) || [])[1];
    const when = iso ? new Date(iso.replace(/_/g, ':').replace(/:(\d{2})Z$/, ':$1Z')) : null;
    const ok = when && !isNaN(when.getTime());
    return {
      source: 'voice memo',
      id: 'memo-' + x.id,
      sort: ok ? when.toISOString() : x.date + 'T12:00:00.000Z',
      display: ok ? PT(when.toISOString()) : PT(x.date + 'T12:00:00Z', false),
      dateUncertain: !ok,
      title: x.title || null,
      text: x.transcript || null,
      summary: x.desc || null,
      keywords: x.keywords || [],
      audio: `/api/memos/audio/${encodeURIComponent(x.id)}`,
      audioSeconds: x.dur || null,
      illustrations: [],
      versions: [],
    };
  });
}

// ── 2. the dream pipeline ──────────────────────────────────────────────────
// 93 docs, but only ~28 recordings: each was split and re-rendered several
// times. Fold each distinct dream into one entry, preferring the newest version
// that actually produced drawings, and keep the rest as history.
async function pipeline() {
  const snap = await deck.firestore().collection('forge-dreams').get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => !d.owner);            // guest dreams from the public try-it page
  const imports = docs.filter((d) => d.source === 'imported-comics');
  const live = docs.filter((d) => d.source !== 'imported-comics');

  // Key a dream by its OWN slice of the recording. Older docs never saved the
  // slice — only the whole recording — so their text cannot be attributed to one
  // dream. Those group by recording instead, becoming a single honest card
  // rather than four cards repeating the same transcript under four titles.
  const groups = new Map();
  for (const d of live) {
    const slice = norm(d.dreamText || '').slice(0, 120);
    const key = slice || 'whole-recording:' + norm(d.dream).slice(0, 150);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }

  const out = [];
  for (const [, ds] of groups) {
    const sorted = ds.slice().sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
    const withPages = sorted.filter((d) => (d.pages || []).length);
    const best = withPages[withPages.length - 1] || sorted[sorted.length - 1];
    const first = sorted[0];
    const when = new Date(ms(first.createdAt) || Date.now()).toISOString();
    // An unsplit recording holds several dreams under several suggested titles;
    // say so, and show every drawing made from it rather than just one doc's.
    const unsplit = !best.dreamText;
    const titles = [...new Set(sorted.map((d) => d.title).filter(Boolean))];
    const allArt = unsplit
      ? [...new Set(sorted.flatMap((d) => (d.pages || []).map((p) => p.url)).filter(Boolean))]
      : (best.pages || []).map((p) => p.url).filter(Boolean);
    out.push({
      source: 'dream pipeline',
      id: 'dream-' + best.id,
      sort: when,
      display: PT(when),
      dateUncertain: false,
      dateNote: 'when you recorded it',
      title: unsplit ? (titles[0] || null) : (best.title || null),
      text: best.dreamText || best.dream || null,
      // The whole-recording cards carry every dream in that recording, so the
      // text below is the full thing, not one dream. Never pretend otherwise.
      unsplit: unsplit || undefined,
      alsoTitled: unsplit && titles.length > 1 ? titles.slice(1) : undefined,
      summary: null,
      keywords: [],
      audio: null,
      illustrations: allArt,
      // the FULL recording this dream was split out of — used to match it back
      // to the voice memo, then dropped before writing the archive
      recordingText: best.dream || null,
      // every other attempt at this same dream, kept rather than dropped
      versions: sorted.filter((d) => d.id !== best.id).map((d) => ({
        id: d.id, title: d.title || null,
        at: new Date(ms(d.createdAt)).toISOString(),
        illustrations: (d.pages || []).map((p) => p.url).filter(Boolean),
      })),
    });
  }

  // A recording can yield BOTH proper slices and an older unsplit doc. Where
  // real slices exist, the collapsed card just repeats them — drop it, but move
  // any drawing only it had onto the slices so no art is lost.
  const splitRecordings = new Set(out.filter((d) => !d.unsplit && d.recordingText)
    .map((d) => norm(d.recordingText).slice(0, 150)));
  for (let i = out.length - 1; i >= 0; i--) {
    const d = out[i];
    if (!d.unsplit || !d.recordingText) continue;
    const key = norm(d.recordingText).slice(0, 150);
    if (!splitRecordings.has(key)) continue;
    const slices = out.filter((x) => !x.unsplit && x.recordingText && norm(x.recordingText).slice(0, 150) === key);
    const have = new Set(slices.flatMap((x) => x.illustrations));
    const orphanArt = d.illustrations.filter((u) => !have.has(u));
    if (orphanArt.length && slices[0]) slices[0].illustrations.push(...orphanArt);
    out.splice(i, 1);
  }

  // The imported comics: real drawings, but the dates are placeholders the
  // importer invented, so they are explicitly undated rather than mis-dated.
  for (const d of imports) {
    out.push({
      source: 'imported comic',
      id: 'import-' + d.id,
      sort: null,
      display: 'date unknown',
      dateUncertain: true,
      dateNote: 'the imported batch had no real dates',
      title: d.title || null,
      text: d.dream || null,
      summary: null, keywords: [], audio: null,
      illustrations: [...(d.pages || []).map((p) => p.url), ...(d.alternates || [])].filter(Boolean),
      versions: [],
    });
  }
  return out;
}

// ── 3. the witch app ───────────────────────────────────────────────────────
// Mostly re-illustrations of dreams the pipeline already has. Where the text
// matches, the drawing is added to that dream instead of making a duplicate.
async function witch(existing) {
  const snap = await deck.firestore().collection('forge-witch-dream-illus').get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.status !== 'error');
  const extra = [];
  let merged = 0;
  for (const d of docs) {
    const art = d.page1 && (d.page1.url || d.page1);
    const key = norm(d.dream).slice(0, 120);
    const hit = [...existing, ...extra].find((e) => e.text && norm(e.text).slice(0, 120) === key);
    if (hit) {
      if (typeof art === 'string' && !hit.illustrations.includes(art)) { hit.illustrations.push(art); merged++; }
      continue;
    }
    const when = new Date(ms(d.createdAt) || Date.now()).toISOString();
    extra.push({
      source: 'witch app',
      id: 'witch-' + d.id,
      sort: when, display: PT(when), dateUncertain: false,
      dateNote: 'when you recorded it',
      title: d.title || null, text: d.dream || null,
      summary: null, keywords: [], audio: null,
      illustrations: typeof art === 'string' ? [art] : [],
      versions: [],
    });
  }
  return { extra, merged };
}

// ── 4. the journal ─────────────────────────────────────────────────────────
function journal() {
  const p = path.join(HERE, 'source-journal.json');
  if (!fs.existsSync(p)) {
    console.error('! source-journal.json missing — run collect-journal.mjs first');
    return [];
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')).map((d) => ({
    source: 'journal',
    id: d.id,
    sort: d.sort + 'T12:00:00.000Z',
    display: d.display + (d.dayUncertain ? ' (day not written)' : ''),
    // Sophie confirmed the notebooks run Feb 2024 -> Jul 2025 and the page order
    // is sound, so these are no longer flagged. The marker is for dates nobody
    // can recover — the old imported comics, and anything coming from ChatGPT.
    dateUncertain: false,
    dateNote: 'placed by page order across the confirmed Feb 2024 - Jul 2025 run',
    title: null,
    text: d.text || null,
    summary: null, keywords: [],
    audio: null, illustrations: [], versions: [],
    incomplete: d.incomplete,
    page: d.page,
  }));
}

// ── cross-source merge ─────────────────────────────────────────────────────
// A dream can exist twice: once as the voice memo it was recorded in, and again
// as the pipeline dream(s) split out of that same recording and illustrated.
// Same audio, so they should be ONE dream carrying all three layers — not two
// cards saying the same thing.
//
// The two transcripts come from different models (gpt-4o-transcribe vs whisper),
// so they never match exactly; compare word sets instead, and only within a day
// of each other.
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
function overlap(a, b) {
  const A = words(a), B = words(b);
  if (A.size < 5 || B.size < 5) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}
const DAY = 86400000;

function mergeRecordings(memoDreams, pipeDreams) {
  const dropped = [];
  let attached = 0;
  for (const memo of memoDreams) {
    const at = Date.parse(memo.sort);
    // pipeline dreams recorded within a day, ranked by how much text they share
    const near = pipeDreams
      .filter((p) => p.text && Math.abs(Date.parse(p.sort) - at) < 1.5 * DAY)
      .map((p) => ({ p, score: overlap(memo.text, p.recordingText || p.text) }))
      .filter((x) => x.score >= 0.5)
      .sort((a, b) => b.score - a.score);
    if (!near.length) continue;

    // the audio belongs to every dream sliced out of that recording
    for (const { p } of near) {
      if (!p.audio) {
        p.audio = memo.audio;
        p.audioSeconds = memo.audioSeconds;
        const aDay = new Date(at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        const pDay = new Date(Date.parse(p.sort)).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        p.audioNote = aDay === pDay
          ? 'the recording this dream was sliced out of'
          : `the recording this was sliced out of — you recorded it ${memo.display}, and illustrated it the next day`;
        attached++;
      }
    }
    // Only fold the memo card away if the pipeline dreams actually cover it. If
    // the pipeline only illustrated one dream out of three, the memo still holds
    // the other two and has to stay.
    const covered = near.reduce((a, { p }) => a + (p.text || '').length, 0);
    if (covered >= (memo.text || '').length * 0.6) {
      memo.mergedInto = near.map((x) => x.p.id);
      dropped.push(memo);
    }
  }
  return { dropped: new Set(dropped), attached };
}

// ── merge ──────────────────────────────────────────────────────────────────
const memos = await voiceMemos();
const pipe = await pipeline();
const jrnl = journal();
const { dropped, attached } = mergeRecordings(memos, pipe);
const keptMemos = memos.filter((m) => !dropped.has(m));
const dated = [...keptMemos, ...pipe, ...jrnl];
const { extra, merged } = await witch(dated);
const all = [...dated, ...extra];
all.forEach((d) => { delete d.recordingText; });

const undated = all.filter((d) => !d.sort);
const ordered = all.filter((d) => d.sort).sort((a, b) => a.sort.localeCompare(b.sort));
const archive = { builtFor: 'Sophie', total: all.length, dreams: ordered, undated };
fs.writeFileSync(OUT, JSON.stringify(archive, null, 1));

const by = {};
all.forEach((d) => { by[d.source] = (by[d.source] || 0) + 1; });
console.log('dreams:', all.length, JSON.stringify(by));
console.log('  with illustrations:', all.filter((d) => d.illustrations.length).length);
console.log('  with audio:', all.filter((d) => d.audio).length);
console.log('  with text:', all.filter((d) => d.text && d.text.trim()).length);
console.log('  uncertain dates:', all.filter((d) => d.dateUncertain).length);
console.log('  undated entirely:', undated.length);
console.log('  witch drawings folded into an existing dream:', merged);
console.log('  voice-memo audio attached to an illustrated dream:', attached);
console.log('  duplicate memo cards folded away:', dropped.size);
console.log('  dreams with ALL THREE (art + words + audio):', all.filter((d) => d.audio && d.illustrations.length && d.text).length);
console.log('  superseded versions kept:', all.reduce((a, d) => a + d.versions.length, 0));
console.log('range:', ordered[0] && ordered[0].display, '->', ordered[ordered.length - 1] && ordered[ordered.length - 1].display);
process.exit(0);

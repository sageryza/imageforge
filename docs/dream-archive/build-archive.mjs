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

  // key a dream by its own slice when there is one, else by the recording
  const groups = new Map();
  for (const d of live) {
    const slice = norm(d.dreamText || '').slice(0, 120);
    const key = slice || norm(d.title) + '|' + norm(d.dream).slice(0, 120);
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
    out.push({
      source: 'dream pipeline',
      id: 'dream-' + best.id,
      sort: when,
      display: PT(when),
      dateUncertain: false,
      dateNote: 'when you recorded it',
      title: best.title || null,
      text: best.dreamText || best.dream || null,
      summary: null,
      keywords: [],
      audio: null,
      illustrations: (best.pages || []).map((p) => p.url).filter(Boolean),
      // every other attempt at this same dream, kept rather than dropped
      versions: sorted.filter((d) => d.id !== best.id).map((d) => ({
        id: d.id, title: d.title || null,
        at: new Date(ms(d.createdAt)).toISOString(),
        illustrations: (d.pages || []).map((p) => p.url).filter(Boolean),
      })),
    });
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
    const hit = existing.find((e) => e.text && norm(e.text).slice(0, 120) === key);
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
    dateUncertain: true,
    dateNote: 'the journals have no years in them; placed by page order',
    title: null,
    text: d.text || null,
    summary: null, keywords: [],
    audio: null, illustrations: [], versions: [],
    incomplete: d.incomplete,
    page: d.page,
  }));
}

// ── merge ──────────────────────────────────────────────────────────────────
const memos = await voiceMemos();
const pipe = await pipeline();
const jrnl = journal();
const dated = [...memos, ...pipe, ...jrnl];
const { extra, merged } = await witch(dated);
const all = [...dated, ...extra];

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
console.log('  superseded versions kept:', all.reduce((a, d) => a + d.versions.length, 0));
console.log('range:', ordered[0] && ordered[0].display, '->', ordered[ordered.length - 1] && ordered[ordered.length - 1].display);
process.exit(0);

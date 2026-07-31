// ─── Dream archive (/api/dream-archive, page at /dreams-archive) ────────────
//
// Every dream Sophie has, in one chronological run, built LIVE on request —
// this replaces the static page a chat had to regenerate by hand, so a dream
// recorded this morning is in it without anyone rebuilding anything.
//
// Sources, and what each actually holds:
//   voice memos   membry Storage manifest   text + ORIGINAL AUDIO + exact time
//   forge-dreams  deckfactory Firestore     text + ILLUSTRATIONS, no audio
//   witch app     forge-witch-dream-illus   text + one illustration
//   journal       Storage (static)          scanned handwriting, text only
//   shared gdoc   Storage (static)          a journal several people wrote in
//
// The two static ones are snapshots because their sources are a public repo's
// build output and a Google Doc — neither is reachable from here. Everything
// else is read live.
const express = require('express');

const router = express.Router();
const CACHE_MS = 3 * 60 * 1000;

let deps = { deckDb: null, membryBucket: null, deckBucket: null };
function init(d) { deps = { ...deps, ...d }; }

let cache = { at: 0, data: null };

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const ms = (v) => { if (!v) return 0; if (v.toDate) return v.toDate().getTime(); const t = Date.parse(v); return isNaN(t) ? 0 : t; };
const PT = (iso, withTime = true) => new Date(iso).toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric',
  ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
});
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
function overlap(a, b) {
  const A = words(a), B = words(b);
  if (A.size < 5 || B.size < 5) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

async function readJson(bucket, path) {
  try { const [buf] = await bucket.file(path).download(); return JSON.parse(buf.toString()); }
  catch { return null; }
}

async function build() {
  const deck = await deps.deckDb();
  const membry = await deps.membryBucket();
  const deckB = await deps.deckBucket();
  const out = [];

  // 1. voice memos — the only dreams with the original recording
  const manifest = await readJson(membry, 'memo-audio/manifest.json');
  const memos = [];
  for (const x of ((manifest && manifest.memos) || [])) {
    if (x.cat !== 'dream') continue;
    const iso = (/_(\d{4}-\d{2}-\d{2}T[\dT_]+Z)$/.exec(x.id) || [])[1];
    const when = iso ? new Date(iso.replace(/_/g, ':').replace(/:(\d{2})Z$/, ':$1Z')) : null;
    const ok = when && !isNaN(when.getTime());
    memos.push({
      source: 'voice memo', id: 'memo-' + x.id,
      sort: ok ? when.toISOString() : x.date + 'T12:00:00.000Z',
      display: ok ? PT(when.toISOString()) : PT(x.date + 'T12:00:00Z', false),
      title: x.title || null, text: x.transcript || null,
      audio: `/api/memos/audio/${encodeURIComponent(x.id)}`,
      audioSeconds: x.dur || null, illustrations: [], versions: [],
    });
  }

  // 2. the dream pipeline — 93 docs are really ~28 recordings split and
  //    re-rendered, so fold each dream into one entry and keep the rest.
  const snap = await deck.collection('forge-dreams').get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => !d.owner);
  const groups = new Map();
  for (const d of docs.filter((d) => d.source !== 'imported-comics')) {
    const slice = norm(d.dreamText || '').slice(0, 120);
    const key = slice || 'whole-recording:' + norm(d.dream).slice(0, 150);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  const pipe = [];
  for (const [, ds] of groups) {
    const sorted = ds.slice().sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
    const withPages = sorted.filter((d) => (d.pages || []).length);
    const best = withPages[withPages.length - 1] || sorted[sorted.length - 1];
    const when = new Date(ms(sorted[0].createdAt) || Date.now()).toISOString();
    const unsplit = !best.dreamText;
    const titles = [...new Set(sorted.map((d) => d.title).filter(Boolean))];
    pipe.push({
      source: 'dream pipeline', id: 'dream-' + best.id,
      sort: when, display: PT(when),
      title: unsplit ? (titles[0] || null) : (best.title || null),
      text: best.dreamText || best.dream || null,
      unsplit: unsplit || undefined,
      alsoTitled: unsplit && titles.length > 1 ? titles.slice(1) : undefined,
      recordingText: best.dream || null,
      audio: null, audioSeconds: null,
      illustrations: unsplit
        ? [...new Set(sorted.flatMap((d) => (d.pages || []).map((p) => p.url)).filter(Boolean))]
        : (best.pages || []).map((p) => p.url).filter(Boolean),
      versions: sorted.filter((d) => d.id !== best.id).map((d) => ({
        id: d.id, title: d.title || null,
        illustrations: (d.pages || []).map((p) => p.url).filter(Boolean),
      })),
    });
  }
  // where a recording produced real slices, the collapsed card just repeats them
  const split = new Set(pipe.filter((d) => !d.unsplit && d.recordingText).map((d) => norm(d.recordingText).slice(0, 150)));
  for (let i = pipe.length - 1; i >= 0; i--) {
    const d = pipe[i];
    if (!d.unsplit || !d.recordingText) continue;
    const k = norm(d.recordingText).slice(0, 150);
    if (!split.has(k)) continue;
    const slices = pipe.filter((x) => !x.unsplit && x.recordingText && norm(x.recordingText).slice(0, 150) === k);
    const have = new Set(slices.flatMap((x) => x.illustrations));
    const orphan = d.illustrations.filter((u) => !have.has(u));
    if (orphan.length && slices[0]) slices[0].illustrations.push(...orphan);
    pipe.splice(i, 1);
  }

  // 3. a dream recorded as a voice memo AND split by the pipeline is ONE dream
  const DAY = 86400000;
  const dropped = new Set();
  for (const memo of memos) {
    const at = Date.parse(memo.sort);
    const near = pipe
      .filter((p) => p.text && Math.abs(Date.parse(p.sort) - at) < 1.5 * DAY)
      .map((p) => ({ p, s: overlap(memo.text, p.recordingText || p.text) }))
      .filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s);
    if (!near.length) continue;
    for (const { p } of near) if (!p.audio) { p.audio = memo.audio; p.audioSeconds = memo.audioSeconds; }
    const covered = near.reduce((a, { p }) => a + (p.text || '').length, 0);
    if (covered >= (memo.text || '').length * 0.6) dropped.add(memo.id);
  }
  out.push(...memos.filter((m) => !dropped.has(m.id)), ...pipe);

  // 4. witch app — usually a re-illustration of a dream already here
  const w = await deck.collection('forge-witch-dream-illus').get();
  const extra = [];
  for (const d of w.docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => x.status !== 'error')) {
    const art = d.page1 && (d.page1.url || d.page1);
    const key = norm(d.dream).slice(0, 120);
    const hit = [...out, ...extra].find((e) => e.text && norm(e.text).slice(0, 120) === key);
    if (hit) { if (typeof art === 'string' && !hit.illustrations.includes(art)) hit.illustrations.push(art); continue; }
    const when = new Date(ms(d.createdAt) || Date.now()).toISOString();
    extra.push({
      source: 'witch app', id: 'witch-' + d.id, sort: when, display: PT(when),
      title: d.title || null, text: d.dream || null, audio: null,
      illustrations: typeof art === 'string' ? [art] : [], versions: [],
    });
  }
  out.push(...extra);

  // 5 + 6. the static snapshots
  for (const [path, tag] of [['dream-archive/journal.json', 'journal'], ['dream-archive/shared-gdoc.json', 'shared dream journal']]) {
    const rows = await readJson(deckB, path);
    for (const r of (rows || [])) {
      out.push({
        source: tag, id: r.id,
        sort: r.sort ? (String(r.sort).length === 10 ? r.sort + 'T12:00:00.000Z' : r.sort) : null,
        display: r.display, dateUncertain: !!r.dateUncertain,
        authorUncertain: !!r.authorUncertain, notHers: !!r.notHers,
        title: r.title || null, text: r.text || null,
        audio: null, illustrations: [], versions: [], incomplete: !!r.incomplete,
      });
    }
  }

  // the imported comics have placeholder dates — undated rather than mis-dated
  for (const d of docs.filter((d) => d.source === 'imported-comics')) {
    out.push({
      source: 'imported comic', id: 'import-' + d.id, sort: null,
      display: 'date unknown', dateUncertain: true,
      title: d.title || null, text: d.dream || null, audio: null,
      illustrations: [...(d.pages || []).map((p) => p.url), ...(d.alternates || [])].filter(Boolean),
      versions: [],
    });
  }

  out.forEach((d) => { delete d.recordingText; });
  const dated = out.filter((d) => d.sort).sort((a, b) => b.sort.localeCompare(a.sort)); // newest first
  const undated = out.filter((d) => !d.sort);
  return {
    builtAt: new Date().toISOString(),
    total: out.length,
    withAudio: out.filter((d) => d.audio).length,
    withArt: out.filter((d) => d.illustrations.length).length,
    dreams: dated, undated,
  };
}

router.get('/status', (req, res) => res.json({ ok: true, cached: !!cache.data, builtAt: cache.data ? cache.data.builtAt : null }));

router.get('/data', async (req, res) => {
  try {
    if (req.query.fresh === '1') cache = { at: 0, data: null };
    if (cache.data && Date.now() - cache.at < CACHE_MS) return res.json(cache.data);
    const data = await build();
    cache = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.warn('dream archive build failed —', err.message);
    if (cache.data) return res.json(cache.data);      // stale beats nothing
    res.status(502).json({ error: err.message });
  }
});

module.exports = { router, init, build };

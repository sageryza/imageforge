// v15 audio repair: (1) merge consecutive same-source parts that overlap or
// nearly touch — a time-overlap replays a fragment (the 0:28 stutter), and a
// zero-gap seam puts a needless fade-dip mid-speech; (2) re-listen at every
// splice boundary (windowed word-timestamp transcription of the master, the
// Cutting Room rule) and set edges to real word times; (3) drop three
// trailing false-start fragments ("I—" b08, dangling "I" b11@0/b12, "It—"
// b41) — named to Sophie in the delivery message.
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const REPO = '/home/user/imageforge';
const FFMPEG = require(path.join(REPO, 'node_modules', 'ffmpeg-static'));
const D = __dirname;

const u = JSON.parse(fs.readFileSync(path.join(D, 'units.json'), 'utf8'));
const { MODEL } = JSON.parse(fs.readFileSync(path.join(D, 'model.json'), 'utf8'));
const BY = {}; MODEL.forEach((b) => { BY[b.id] = b; });
const MASTER = path.join(D, 'evan-v7-lite.mp3');
const norm = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9']/g, '');

// trailing fragments to drop: unit id -> words to remove from the tail
const TAIL_TRIMS = { b08: 1, 'b11@0': 1, b41: 1 };

function decSegs(str) {
  return String(str || '').split(',').filter(Boolean).map((p) => {
    const m = /^(\w+):(\d+)-(\d+)$/.exec(p); if (!m) return null;
    return { b: m[1], a: +m[2], z: +m[3] };
  }).filter((s) => s && BY[s.b]);
}

// words of a unit (with trims applied)
function unitWords(un) {
  if (un.kind === 'tts') return [];
  let ws = [];
  decSegs(un.segs).forEach((sg) => { ws = ws.concat(BY[sg.b].words.slice(sg.a, sg.z)); });
  const trim = TAIL_TRIMS[un.id] || 0;
  return trim ? ws.slice(0, ws.length - trim) : ws;
}

// ── 1. film-order part list, one entry per unit-span, then merge ──────────
// (units already carry their spans; walk them in film order)
const items = [];
u.units.forEach((un, ui) => {
  if (un.kind === 'tts') { items.push({ tts: u.parts[un.parts[0]].tts, unit: ui }); return; }
  un.spans.forEach((s, si) => {
    items.push({ t0: s.t0, t1: s.t1, unit: ui, span: si });
  });
});
// attach expected words per source item (first span gets the head, last the tail)
u.units.forEach((un, ui) => {
  if (un.kind === 'tts') return;
  const ws = unitWords(un);
  const mine = items.filter((it) => it.unit === ui && it.tts === undefined);
  if (!mine.length || !ws.length) return;
  mine[0].head = ws.slice(0, 3);
  mine[mine.length - 1].tail = ws.slice(-3);
});

const MERGE_GAP = 0.35;
const merged = [];
items.forEach((it) => {
  const last = merged[merged.length - 1];
  if (it.tts === undefined && last && last.tts === undefined &&
      it.t0 - last.t1 <= MERGE_GAP && it.t0 >= last.t0) {
    // continuous source: absorb (keeps the material between, plays once)
    last.t1 = Math.max(last.t1, it.t1);
    last.tail = it.tail || last.tail;
    last.units.push({ unit: it.unit, srcT0: it.t0 });
  } else {
    merged.push(it.tts !== undefined ? { ...it }
      : { ...it, units: [{ unit: it.unit, srcT0: it.t0 }] });
  }
});
console.log('parts:', items.length, '->', merged.length, 'after merge');

// ── 2. windowed re-listen at splice edges ─────────────────────────────────
const CACHE_PATH = path.join(D, 'seam-cache.json');
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (_) {}
function windowWords(w0, w1) {
  const key = w0.toFixed(2) + '-' + w1.toFixed(2);
  if (cache[key]) return cache[key];
  const f = path.join(D, 'win.mp3');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(Math.max(0, w0)), '-t', String(w1 - w0),
    '-i', MASTER, '-af', 'adelay=1000:all=1', '-ac', '1', '-ar', '16000', f]);
  const out = execSync(`curl -sS https://api.openai.com/v1/audio/transcriptions -H "Authorization: Bearer $OPENAI_API_KEY" -F file=@${f} -F model=whisper-1 -F response_format=verbose_json -F "timestamp_granularities[]=word"`,
    { cwd: D, maxBuffer: 10e6 }).toString();
  const j = JSON.parse(out);
  if (j.error) throw new Error('whisper: ' + JSON.stringify(j.error));
  const words = (j.words || []).map((w) => ({ w: norm(w.word), t0: Math.max(0, w0) + w.start - 1, t1: Math.max(0, w0) + w.end - 1 }));
  cache[key] = words; fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  return words;
}
// pick the occurrence CLOSEST to the expected time — first/last both matched
// the wrong repeat of a phrase ("He said" pulled in a cut block; "the face"
// matched a stray and left cut words in)
function findSeq(words, seq, ref, edge) {
  const target = seq.map(norm).filter(Boolean);
  if (!target.length) return null;
  const idxs = [];
  for (let i = 0; i + target.length <= words.length; i++) {
    let ok = true;
    for (let k = 0; k < target.length; k++) if (words[i + k].w !== target[k]) { ok = false; break; }
    if (ok) idxs.push(i);
  }
  if (!idxs.length && target.length > 1) return findSeq(words, edge === 'end' ? seq.slice(-1) : seq.slice(0, 1), ref, edge);
  if (!idxs.length) return null;
  let best = null, bestD = Infinity;
  for (const i of idxs) {
    const hit = { start: words[i].t0, end: words[i + target.length - 1].t1 };
    const d = Math.abs((edge === 'end' ? hit.end : hit.start) - ref);
    if (d < bestD) { bestD = d; best = hit; }
  }
  return best;
}

merged.forEach((p, pi) => {
  if (p.tts !== undefined) return;
  const orig = { t0: p.t0, t1: p.t1 };
  // head: widen/tighten to the real start of the first expected word
  if (p.head && p.t0 > 0.5) {
    const ws = windowWords(p.t0 - 2.2, Math.min(p.t1, p.t0 + 3.2));
    const hit = findSeq(ws, p.head.slice(0, 2), p.t0, 'start');
    if (hit) {
      const t0n = Math.max(0, hit.start - 0.12);
      if (Math.abs(t0n - p.t0) > 0.03 && p.t0 - t0n < 1.5 && t0n - p.t0 < 1.5) p.t0 = +t0n.toFixed(2);
    }
  }
  // tail: end after the real last expected word
  if (p.tail) {
    const ws = windowWords(Math.max(p.t0, p.t1 - 4.2), p.t1 + 1.6);
    const hit = findSeq(ws, p.tail.slice(-2), p.t1, 'end');
    if (hit) {
      const t1n = hit.end + 0.12;
      if (Math.abs(t1n - p.t1) > 0.03 && Math.abs(t1n - p.t1) < 2.5 && t1n > p.t0 + 0.2) p.t1 = +t1n.toFixed(2);
    }
  }
  if (p.t0 !== orig.t0 || p.t1 !== orig.t1) {
    console.log(`part ${pi}: [${orig.t0}, ${orig.t1}] -> [${p.t0}, ${p.t1}]  (${(p.head || []).join(' ')} … ${(p.tail || []).join(' ')})`);
  }
});

// ── 3. write corrected parts + unit map for the stitcher ──────────────────
const parts = merged.map((p) => p.tts !== undefined ? { tts: p.tts } : { t0: p.t0, t1: p.t1 });
fs.writeFileSync(path.join(D, 'parts-v15.json'), JSON.stringify({ parts, merged }, null, 1));
const total = merged.reduce((a, p) => a + (p.tts !== undefined ? 0 : p.t1 - p.t0), 0);
console.log('cut spans total:', total.toFixed(1) + 's over', parts.filter((p) => !p.tts).length, 'spans +', parts.filter((p) => p.tts).length, 'tts');

#!/usr/bin/env node
/**
 * Build THE HEART film — Darius on how an out-of-body experience works.
 *
 * Audio comes from the Episode Editor, which owns the ONE precise cutter
 * (docs/nde-precise-cutting.md): the span's words are located in the real
 * audio's word timestamps, both edges land in detected silences. This script
 * never cuts audio itself — it creates the episode, then asks the editor to
 * PREVIEW each snippet, which is the same cut a render makes and is banked in
 * the permanent clip cache, so it is paid for once ever.
 *
 *   node scripts/darius-heart-film.js make     # create the episode + snippets
 *   node scripts/darius-heart-film.js cut      # preview every snippet, poll
 *   node scripts/darius-heart-film.js report   # per-clip urls + durations
 *
 * The running ORDER is the argument the film makes, not the order the spans
 * happen to fall in the interviews — see SHOTS below.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const ROOT = path.join(__dirname, '..');
const SPEC = require('./darius-moments.json');
const STATE = path.join(ROOT, '.darius-film', 'heart.json');
const CACHE = path.join(ROOT, '.darius-cache');

/* The argument, in order. Each entry is a heart-span id from darius-moments.json.
   It opens on the limit of the senses, states the mechanism, teaches the method,
   says what it is like to be out, then widens to what the field explains. */
const SHOTS = [
  'h-onepercent',   // five senses, one percent — why you cannot see it from here
  'h-generator',    // the heart is not a pump; the field glues the soul in
  'h-paralysis',    // sleep paralysis is the doorway; panic snaps you back
  'h-deeper',       // going further down until you come right out
  'h-physical',     // you are out, and your hands are solid
  'h-animals',      // cats see more of it, and so does equipment
  'h-internet',     // the body is the computer, the field is the internet
  'h-telepathy',    // the same field, turned up
  'h-rice',         // water holds memory
  'h-house',        // an empty house rots
  'h-toroid',       // the heart is a toroidal field, and so is everything
];

const ffprobe = () => {
  try { return require('ffprobe-static').path; } catch (_) { return 'ffprobe'; }
};

function words(videoId) {
  const doc = JSON.parse(fs.readFileSync(path.join(CACHE, videoId + '.json'), 'utf8'));
  const segs = (doc.video || doc).transcript.segments;
  const out = [];
  for (const s of segs) {
    const toks = String(s.text).replace(/\[[^\]]*\]/g, ' ').replace(/>>/g, ' ').split(/\s+/).filter(Boolean);
    const dur = s.dur || 2;
    toks.forEach((w, i) => out.push({ w, t: +(s.start + (i / toks.length) * dur).toFixed(2) }));
  }
  return out;
}

/* The snippet's TEXT is what phraseSpan matches against the real audio, and its
   timeSec is the anchor that picks the alignment window — so both come from the
   same span the picker page seeded. */
function shots() {
  const W = {};
  for (const k of Object.keys(SPEC.sources)) W[k] = words(SPEC.sources[k].videoId);
  return SHOTS.map((id, i) => {
    const m = SPEC.heart.find((x) => x.id === id);
    if (!m) throw new Error('no such heart span: ' + id);
    const text = W[m.src].filter((x) => x.t >= m.pick0 && x.t <= m.pick1).map((x) => x.w).join(' ');
    return {
      id: 's' + String(i + 1).padStart(2, '0'),
      spanId: id,
      name: m.label,
      videoId: SPEC.sources[m.src].videoId,
      text,
      timeSec: Math.round((m.pick0 + m.pick1) / 2),
    };
  });
}

const api = async (p, opt) => {
  const r = await fetch(BASE + '/api/editor' + p, {
    ...opt, headers: { 'content-type': 'application/json', ...(opt || {}).headers },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(p + ': ' + (j.error || r.status));
  return j;
};

const readState = () => JSON.parse(fs.readFileSync(STATE, 'utf8'));

async function make() {
  const sn = shots();
  const sources = [...new Set(sn.map((s) => s.videoId))].map((videoId) => ({
    videoId,
    experiencer: 'Darius J. Wright',
    audioUrl: `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/nde-audio/${videoId}.webm`,
    timeSec: Math.min(...sn.filter((s) => s.videoId === videoId).map((s) => s.timeSec)),
  }));
  const { episode } = await api('/', {
    method: 'POST',
    body: JSON.stringify({
      title: 'The heart — how an out-of-body experience works (v1)',
      sources,
      snippets: sn.map(({ id, name, videoId, text, timeSec }) => ({ id, name, videoId, text, timeSec })),
      sequence: sn.map((s) => ({ type: 'clip', snippetId: s.id })),
    }),
  });
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ id: episode.id, shots: sn }, null, 1));
  console.log('episode', episode.id, '·', sn.length, 'shots ·', sources.length, 'sources');
}

/* Preview every snippet. A cut already in the clip cache answers instantly; the rest
   run as background jobs on the doc, so this polls rather than blocking. */
/* ONE CUT AT A TIME, deliberately. v1 posted all eleven previews in the first
   round, which starts eleven concurrent whisper-plus-ffmpeg jobs on a 0.5 vCPU
   / 512MB instance that is also serving Sophie's Chats app — and after 25
   minutes exactly one clip had landed. Each cut is asked for, waited on, and
   only then is the next one started.
   A transport error is NOT terminal either: Render answered 502 on all eleven
   while an instance restarted, and the first version struck each snippet off on
   its first failure. Only the server SAYING the cut failed retires one. Note a
   dead job's doc still reads `running` for 15 minutes (previewState's staleness
   window), so a snippet lost to a restart can sit there a while before a fresh
   POST is allowed to restart it — that wait is the server's, not a hang here. */
async function cut() {
  const st = readState();
  const urls = { ...(st.clips || {}) };
  const save = () => fs.writeFileSync(STATE, JSON.stringify({ ...st, clips: urls }, null, 1));
  for (const shot of st.shots) {
    if (urls[shot.id]) { console.log('  have', shot.id); continue; }
    let fails = 0;
    for (let t = 0; t < 200; t++) {
      const r = await api(`/${st.id}/preview`, { method: 'POST', body: JSON.stringify({ snippetId: shot.id }) })
        .catch((e) => ({ status: 'net', error: e.message }));
      if (r.status === 'ready' && r.url) {
        urls[shot.id] = r.url; save();
        console.log('  cut', shot.id, r.cached ? '(cached)' : '', '·', shot.name.slice(0, 50));
        break;
      }
      if (r.status === 'failed' || r.status === 'error') { console.log('  ERR', shot.id, r.error || ''); break; }
      if (r.status === 'net' && ++fails > 40) { console.log('  GIVE UP', shot.id, r.error); break; }
      await new Promise((z) => setTimeout(z, 6000));
    }
  }
  save();
  console.log(`${Object.keys(urls).length}/${st.shots.length} cut`);
}

async function report() {
  const st = readState();
  const dir = path.join(ROOT, '.darius-film', 'audio');
  fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const s of st.shots) {
    const url = (st.clips || {})[s.id];
    if (!url) { console.log(s.id, 'MISSING'); continue; }
    const f = path.join(dir, s.id + '.mp3');
    if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(url)).arrayBuffer()));
    const d = +execFileSync(ffprobe(), ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', f]).toString().trim();
    total += d;
    console.log(`${s.id}  ${d.toFixed(1).padStart(5)}s  ${s.name}`);
  }
  console.log(`\ntotal ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`);
  st.durations = Object.fromEntries(st.shots.map((s) => [s.id, null]));
  fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
}

const cmd = process.argv[2] || 'make';
({ make, cut, report })[cmd]().catch((e) => { console.error(e.message); process.exit(1); });

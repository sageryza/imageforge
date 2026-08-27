#!/usr/bin/env node
// film-shots-detect.js — build a film's SHOT MAP from the film itself.
//
// A chat that cuts a film knows its own shot list and should POST it straight
// to /api/filmshots. This is the other door: every film ALREADY made, where
// nobody wrote the list down. It measures rather than guesses —
//
//   1. ffmpeg finds the cuts (scene detection),
//   2. one frame is pulled from the MIDDLE of each shot,
//   3. each frame is matched against the chat's own filed pictures by
//      perceptual hash (dHash, 64 bits over an 8x8 grayscale gradient).
//
// Measured on Sophie's example the day this was written — "Hate of the Game —
// the reel v1" (5:42, chat `hate-game-memo-visuals`): 39 cuts → 40 shots, and
// 40 of 40 matched the right picture, every one of them the nearest candidate
// by a clear margin.
//
// A SHOT IT IS NOT SURE ABOUT IS LEFT OUT, not guessed in: the player shows
// no Prompt button where there is no shot, and that is the honest answer —
// reading one picture's prompt believing it belongs to another is the one
// failure this whole feature must not have. `--loose` includes them anyway
// (say so if you use it).
//
// It costs NOTHING: no model call, just bandwidth and ffmpeg on this box.
//
//   node scripts/film-shots-detect.js --film <url> --chat <slug>          # dry
//   node scripts/film-shots-detect.js --film <url> --chat <slug> --go     # file it
//   … --pad <padId>        candidates from a Story Room pad's beats instead
//   … --threshold 0.2      ffmpeg scene threshold (lower = more cuts)
//   … --max 26 --margin 4  how sure a match has to be
//   … --keep               leave the downloaded film and frames behind
//
// FORGE_BASE overrides the server (default the live app).
// Test: node scripts/test-filmshots.js (the pure halves — bounds and matching)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

// ---- pure helpers (exported for the test) ----------------------------------

/** Cut times → [start, end] per shot. The first shot starts at 0, the last
 *  runs to the end of the film. */
function boundsFrom(cuts, duration) {
  const marks = (cuts || []).map(Number).filter((n) => isFinite(n) && n > 0.05 && n < duration - 0.05)
    .sort((a, b) => a - b);
  const edges = [0, ...marks, duration];
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    if (edges[i + 1] - edges[i] < 0.12) continue;      // a flash, not a shot
    out.push([edges[i], edges[i + 1]]);
  }
  return out;
}

/** dHash: 64 bits, each one "is this pixel darker than the one to its right".
 *  `gray` is a 9x8 grayscale raster (sharp's raw output). */
function dhashBits(gray) {
  const bits = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits.push(gray[y * 9 + x] < gray[y * 9 + x + 1] ? 1 : 0);
  }
  return bits;
}

const hamming = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);

/**
 * The nearest candidate for each frame, with the runner-up beside it so the
 * caller can say how sure it is. `best` is the index into `cands`.
 */
function assign(frameHashes, candHashes) {
  return frameHashes.map((fh) => {
    let best = -1, bd = 999, second = 999;
    candHashes.forEach((ch, i) => {
      const d = hamming(ch, fh);
      if (d < bd) { second = bd; bd = d; best = i; } else if (d < second) second = d;
    });
    return { best, dist: bd, margin: second - bd };
  });
}

/** The map, and the reasons — one row per shot, `keep:false` where the match
 *  is not sure enough to put a prompt behind her finger. */
function planShots(bounds, picks, cands, opts) {
  const max = (opts && opts.max) || 26;
  const minMargin = (opts && opts.margin) || 4;
  return bounds.map(([start, end], i) => {
    const p = picks[i] || { best: -1, dist: 999, margin: 0 };
    const c = cands[p.best] || null;
    const sure = !!c && p.dist <= max && p.margin >= minMargin;
    return {
      at: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      url: c ? c.url : null,
      title: c ? (c.description || '') : '',
      dist: p.dist, margin: p.margin,
      keep: sure && !!c,
    };
  });
}

module.exports = { boundsFrom, dhashBits, hamming, assign, planShots };
if (require.main !== module) return;

// ---- the run ----------------------------------------------------------------

const sharp = require('sharp');
const fetch = require('node-fetch');
const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes('--' + name);
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const TOKEN = process.env.STUDIO_TOKEN || '';
const film = arg('film');
const chat = arg('chat');
const padId = arg('pad');
const threshold = Number(arg('threshold', '0.2'));
const maxDist = Number(arg('max', '26'));
const minMargin = Number(arg('margin', '4'));

if (!film || !chat) {
  console.error('usage: node scripts/film-shots-detect.js --film <url> --chat <slug> [--pad <id>] [--go]');
  process.exit(2);
}

const headers = TOKEN ? { 'x-studio-token': TOKEN } : {};
const sh = (bin, args) => execFileSync(bin, args, { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });

async function candidates() {
  if (padId) {
    const r = await fetch(`${BASE}/api/scratchpad/?pad=${encodeURIComponent(padId)}`, { headers });
    const pad = await r.json();
    const style = pad.style || 'watercolor';
    return (pad.beats || []).map((b) => {
      const slot = (b.alt && b.alt[style]) || b;
      return slot && slot.url ? { url: slot.url, description: (b.text || '').slice(0, 120) } : null;
    }).filter(Boolean);
  }
  const out = [];
  for (let offset = 0; ; offset += 300) {
    const r = await fetch(`${BASE}/api/gallery/assets?chat=${encodeURIComponent(chat)}&limit=300&offset=${offset}`, { headers });
    const d = await r.json();
    (d.assets || []).forEach((a) => { if (a.kind !== 'audio') out.push(a); });
    if (!d.total || offset + 300 >= d.total) break;
  }
  return out;
}

async function hashUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const buf = await r.buffer();
  const { data } = await sharp(buf).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return dhashBits(data);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmshots-'));
  const local = path.join(dir, 'film.mp4');
  console.log('downloading the film…');
  const fr = await fetch(film);
  if (!fr.ok) throw new Error(`the film answered ${fr.status}`);
  fs.writeFileSync(local, await fr.buffer());

  const meta = JSON.parse(sh(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', local]).toString());
  const duration = Number(meta.format.duration);
  // showinfo prints one line per frame the scene filter selected — the cuts.
  // ffmpeg writes them to STDERR and exits 0, so this is spawnSync (which
  // hands back stderr on success) and not the exec used everywhere else.
  const det = spawnSync(FFMPEG, ['-i', local, '-filter:v', `select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-'],
    { maxBuffer: 1 << 28, encoding: 'utf8' });
  const cuts = [...String(det.stderr || '').matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]));
  const bounds = boundsFrom(cuts, duration);
  console.log(`${duration.toFixed(1)}s, ${cuts.length} cuts → ${bounds.length} shots`);

  const cands = await candidates();
  console.log(`${cands.length} pictures to match against (${padId ? 'pad ' + padId : 'chat ' + chat})`);
  const candHashes = [];
  for (const c of cands) {
    try { candHashes.push(await hashUrl(c.url)); }
    catch (e) { candHashes.push(new Array(64).fill(0)); console.warn('  could not read', c.url.slice(-28), e.message); }
  }

  const frameHashes = [];
  for (let i = 0; i < bounds.length; i++) {
    const t = bounds[i][0] + (bounds[i][1] - bounds[i][0]) / 2;
    const f = path.join(dir, `f${i}.png`);
    sh(FFMPEG, ['-y', '-ss', String(t), '-i', local, '-frames:v', '1', '-vf', 'scale=256:-1', f]);
    const { data } = await sharp(fs.readFileSync(f)).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    frameHashes.push(dhashBits(data));
  }

  const plan = planShots(bounds, assign(frameHashes, candHashes), cands, { max: maxDist, margin: minMargin });
  plan.forEach((s, i) => {
    console.log(`${String(i + 1).padStart(3)} ${s.at.toFixed(1).padStart(7)}s  d=${String(s.dist).padStart(2)} m=${String(s.margin).padStart(2)}  `
      + (s.keep ? '' : 'LEFT OUT  ') + String(s.title || s.url || '').slice(0, 60));
  });
  const kept = plan.filter((s) => (flag('loose') ? s.url : s.keep));
  console.log(`\n${kept.length} of ${plan.length} shots mapped.`);

  if (!flag('go')) {
    console.log('dry run — add --go to file this map.');
  } else {
    const r = await fetch(`${BASE}/api/filmshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ chat, url: film, seconds: duration, source: 'detect',
        shots: kept.map((s) => ({ at: s.at, url: s.url, title: s.title })) }),
    });
    console.log('filed:', JSON.stringify(await r.json()));
  }
  if (!flag('keep')) fs.rmSync(dir, { recursive: true, force: true });
  else console.log('left behind in', dir);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

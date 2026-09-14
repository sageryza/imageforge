#!/usr/bin/env node
// fcpxml-to-cut.js — read a cut Sophie made in LumaFusion (its "XML Project
// Package" export = FCPXML, Final Cut Pro's XML) and write it as a Film Editor
// cut doc (cut-model.js lanes), so the cut she made on her phone is the SAME
// cut both of us edit — from the original clips, not a re-encoded movie.
// (2026-09-08, Sophie: "what's fcpxml · write it?")
//
//   node scripts/fcpxml-to-cut.js <project.fcpxml | folder.fcpxmld | package.zip> \
//        --media media.json [--out cut.json] [--set <cutId>]
//
// media.json maps the FILENAMES she imported to their Storage urls (the zip we
// handed her names them, so this is a dictionary we already hold):
//   { "06 36b part 1 - ghosts and goblins (30s).mp4": {"url": "https://…", "seconds": 30.042, "poster": "https://…"} }
// A filename not in the map is reported and the piece is SKIPPED, never
// invented. Nothing here spends money.
//
// What is read (FCPXML 1.8–1.11, which is what LumaFusion writes):
//   resources/asset      → id → src filename (+ the file's own duration)
//   sequence/spine       → the picture lane, in timeline order
//     asset-clip / clip  → a piece: `start` is the IN point in the source,
//                          `duration` the length; `offset` is where it sits
//     gap                → a hole: rendered as nothing, so we drop it and warn
//     video (ref=still)  → a still, held for `duration`
//   a clip with lane="-1"/"-2" (attached, below the spine) or an audio-only
//   asset → the SOUND lane: {at: offset, in: start, out: start+duration}
//   adjust-volume amount="-6dB" → gain; audio-fade → fadeIn/fadeOut
// Times are rationals like "3003/24000s" — every one is converted exactly.
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const R3 = (x) => Math.round(x * 1000) / 1000;

// "3003/24000s" · "12s" · "0s" → seconds (number)
function secs(v) {
  if (v == null) return null;
  const m = String(v).trim().match(/^(-?\d+)(?:\/(\d+))?s$/);
  if (!m) return null;
  return Number(m[1]) / (m[2] ? Number(m[2]) : 1);
}
function db(v) { const m = String(v || '').match(/(-?[\d.]+)\s*dB/i); return m ? Number(m[1]) : 0; }
function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
function basename(src) {
  // file:///private/var/…/Imported/06%2036b%20part%201.mp4 → "06 36b part 1.mp4"
  let s = String(src || '');
  try { s = decodeURIComponent(s); } catch { /* keep undecoded */ }
  return s.replace(/^file:\/\/+/, '').split(/[\\/]/).pop();
}

// Find the .fcpxml text inside whatever she exported.
function loadXml(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    // a .fcpxmld bundle: Info.fcpxml inside
    const f = fs.readdirSync(p).find((n) => /\.fcpxml$/i.test(n));
    if (!f) throw new Error('no .fcpxml inside ' + p);
    return fs.readFileSync(path.join(p, f), 'utf8');
  }
  if (/\.zip$/i.test(p)) {
    const JSZip = require('jszip');
    // sync-ish: jszip is async; caller uses loadXmlAsync
    throw new Error('zip: use loadXmlAsync');
  }
  return fs.readFileSync(p, 'utf8');
}
async function loadXmlAsync(p) {
  if (/\.zip$/i.test(p) && fs.statSync(p).isFile()) {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(fs.readFileSync(p));
    const name = Object.keys(zip.files).find((n) => /\.fcpxml$/i.test(n) && !zip.files[n].dir);
    if (!name) throw new Error('no .fcpxml inside the zip');
    return zip.files[name].async('string');
  }
  return loadXml(p);
}

// The pure half: FCPXML text + filename→url map → {clips, sounds, skipped, gaps}
function fcpxmlToCut(xml, media, opts) {
  opts = opts || {};
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: false, isArray: (name) => ['asset', 'format', 'asset-clip', 'clip', 'gap', 'video', 'audio', 'ref-clip', 'sequence', 'project', 'event', 'library', 'spine', 'adjust-volume', 'audio-fade'].includes(name) });
  const doc = parser.parse(xml);
  const root = doc.fcpxml;
  if (!root) throw new Error('not an fcpxml document');

  // resources → assets by id
  const assets = {};
  const formats = {};
  const res = root.resources || {};
  for (const f of arr(res.format)) formats[f.id] = f;
  for (const a of arr(res.asset)) {
    // FCPXML 1.9+: <asset><media-rep src=…/></asset>; older: src on the asset
    const rep = arr(a['media-rep'])[0] || {};
    const src = rep.src || a.src || '';
    assets[a.id] = {
      id: a.id, name: a.name || basename(src), file: basename(src),
      seconds: secs(a.duration), hasVideo: a.hasVideo === '1', hasAudio: a.hasAudio === '1',
      still: a.hasVideo === '1' && (secs(a.duration) === 0 || /image/i.test(String(a.uti || ''))) || (!a.hasVideo && !a.hasAudio && /\.(png|jpe?g|webp|heic)$/i.test(basename(src))),
    };
  }

  // the first project's first sequence's spine — LumaFusion exports one
  let spine = null;
  const walk = (node) => {
    if (!node || typeof node !== 'object' || spine) return;
    for (const seq of arr(node.sequence)) if (seq.spine) { spine = arr(seq.spine)[0]; return; }
    for (const k of Object.keys(node)) if (typeof node[k] === 'object') walk(node[k]);
  };
  walk(root);
  if (!spine) throw new Error('no sequence/spine in the fcpxml');

  const clips = [], sounds = [], skipped = [], gaps = [];
  const media0 = media || {};
  const lookup = (asset) => {
    if (!asset) return null;
    return media0[asset.file] || media0[asset.name] || Object.values(media0).find((m) => m && m.file === asset.file) || null;
  };

  // everything on the spine, in offset order (the parser groups by tag name,
  // so timeline order has to come back from `offset`)
  const items = [];
  for (const tag of ['asset-clip', 'clip', 'video', 'gap', 'ref-clip']) for (const el of arr(spine[tag])) items.push({ tag, el });
  items.sort((a, b) => (secs(a.el.offset) || 0) - (secs(b.el.offset) || 0));

  let n = 0;
  const pieceKeys = [];
  const addSound = (el, asset, laneNote) => {
    const m = lookup(asset);
    if (!m) { skipped.push({ file: asset && asset.file, why: 'no url for this file' }); return; }
    const at = secs(el.offset) || 0, tIn = secs(el.start) || 0, dur = secs(el.duration);
    const s = { key: 's' + (sounds.length + 1), url: m.url, name: asset.name || asset.file, at: R3(at), in: R3(tIn), out: dur != null ? R3(tIn + dur) : null, gain: 0, fadeIn: 0, fadeOut: 0, mute: false };
    if (m.seconds) s.seconds = m.seconds;
    for (const v of arr(el['adjust-volume'])) s.gain = db(v.amount);
    for (const f of arr(el['audio-fade'])) { if (f['fade-in']) s.fadeIn = R3(secs(arr(f['fade-in'])[0].duration) || 0); if (f['fade-out']) s.fadeOut = R3(secs(arr(f['fade-out'])[0].duration) || 0); }
    if (String(el.enabled) === '0') s.mute = true;
    sounds.push(s);
  };
  // attached clips ride INSIDE the spine clip they are connected to
  const attached = (el) => {
    for (const tag of ['asset-clip', 'clip', 'audio', 'video']) for (const sub of arr(el[tag])) {
      if (sub.lane == null) continue;
      const asset = assets[sub.ref] || assets[(arr(sub.audio)[0] || arr(sub.video)[0] || {}).ref];
      if (Number(sub.lane) < 0 || (asset && !asset.hasVideo)) addSound(sub, asset, 'lane ' + sub.lane);
      else skipped.push({ file: asset && asset.file, why: 'a picture on lane ' + sub.lane + ' (an overlay) — the cut doc has one picture lane' });
    }
  };

  for (const { tag, el } of items) {
    const dur = secs(el.duration);
    if (tag === 'gap') { gaps.push({ at: R3(secs(el.offset) || 0), seconds: R3(dur || 0) }); attached(el); continue; }
    const ref = el.ref || (arr(el.video)[0] || {}).ref || (arr(el.audio)[0] || {}).ref;
    const asset = assets[ref];
    if (!asset) { skipped.push({ file: ref, why: 'no asset for ref' }); continue; }
    if (!asset.hasVideo && asset.hasAudio) { addSound(el, asset, 'spine audio'); continue; }
    const m = lookup(asset);
    if (!m) { skipped.push({ file: asset.file, why: 'no url for this file' }); attached(el); continue; }
    n += 1;
    const key = 'p' + n;
    const tIn = secs(el.start) || 0;
    const title = (el.name || asset.name || asset.file || '').replace(/\.[a-z0-9]+$/i, '');
    if (asset.still || tag === 'video' && (asset.seconds === 0 || asset.still)) {
      clips.push({ key, kind: 'image', url: m.url, title, out: R3(dur || 4), poster: m.poster || null });
    } else {
      const piece = { key, kind: 'video', url: m.url, title, in: R3(tIn), out: R3(tIn + (dur || 0)), poster: m.poster || null };
      if (m.seconds) piece.seconds = m.seconds;
      for (const v of arr(el['adjust-volume'])) piece.gain = db(v.amount);
      if (String(el.enabled) === '0' || (arr(el.audio)[0] || {}).enabled === '0') piece.mute = true;
      clips.push(piece);
    }
    pieceKeys.push(key);
    attached(el);
  }
  return { clips, sounds, skipped, gaps, total: R3(clips.reduce((a, c) => a + (c.kind === 'image' ? c.out : c.out - c.in), 0)) };
}

module.exports = { fcpxmlToCut, secs, basename };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
    const src = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--media' && args[args.indexOf(a) - 1] !== '--out' && args[args.indexOf(a) - 1] !== '--set');
    if (!src) { console.error('usage: fcpxml-to-cut.js <file.fcpxml|bundle.fcpxmld|package.zip> --media media.json [--out cut.json] [--set <cutId>]'); process.exit(1); }
    const media = flag('--media') ? JSON.parse(fs.readFileSync(flag('--media'), 'utf8')) : {};
    const xml = await loadXmlAsync(src);
    const r = fcpxmlToCut(xml, media);
    const out = flag('--out') || 'cut.json';
    fs.writeFileSync(out, JSON.stringify({ clips: r.clips, sounds: r.sounds }, null, 1));
    console.log(`${r.clips.length} pieces · ${r.sounds.length} sounds · ${r.total}s → ${out}`);
    for (const g of r.gaps) console.log(`  gap at ${g.at}s (${g.seconds}s) — dropped; the cut doc has no empty picture`);
    for (const s of r.skipped) console.log(`  SKIPPED ${s.file}: ${s.why}`);
    const id = flag('--set');
    if (id) {
      const { spawnSync } = require('child_process');
      const p = spawnSync('node', [path.join(__dirname, 'filmcut.js'), 'set', id, out], { stdio: 'inherit' });
      process.exit(p.status || 0);
    }
  })().catch((e) => { console.error(e.message); process.exit(1); });
}

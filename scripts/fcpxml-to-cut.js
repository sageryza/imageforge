#!/usr/bin/env node
// fcpxml-to-cut.js — read a cut Sophie made in LumaFusion (its "XML Project
// Package" export = FCPXML, Final Cut Pro's XML) and write it as a Film Editor
// cut doc (cut-model.js lanes), so the cut she made on her phone is the SAME
// cut both of us edit — from the original clips, not a re-encoded movie.
// (2026-09-08, Sophie: "what's fcpxml · write it?")
//
//   node scripts/fcpxml-to-cut.js <project.fcpxml | folder.fcpxmld | package.zip> \
//        --media media.json [--out cut.json] [--set <cutId>]
//   node scripts/fcpxml-to-cut.js --dump latest|<dropId> --media media.json …
//
// THE FOOTAGE LOG IS THE MEDIA MAP BY DEFAULT (2026-09-16, her first real
// export): every clip the app drew, keyed by the filename the app saves it
// under, and matched by LENGTH + SHAPE when the name says nothing (the
// app named saved clips `clip-<random>.mp4` before that day's build). A
// length+shape that fits two clips is SKIPPED and both are named — never
// guessed. `--media` still rides on top; `--no-footage` turns the log off.
// A "Full Media" zip settles those: the md5 of each clip in the zip is
// matched against the candidates' Storage md5 (one HEAD each, no download).
//
// --dump reads the package OFF THE DUMP (2026-09-16, Sophie: "easiest,
// period?"): she shares LumaFusion's XML Project Package straight to Deck
// Factory from the export sheet and it lands in the Dump as a `file`;
// `latest` is the newest zip there, an id is one she named. Export it with
// "No Relinkable Media" — every clip is already in our Storage (we sent them
// to her), so the zip is kilobytes and the upload is a second.
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
//   asset → the SOUND lane: {at: parent.at + offset - parent.start, in: start,
//   out: start+duration, anchor: the piece it is connected to}
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
async function loadXmlAsync(p) { return (await loadPackage(p)).xml; }

// The whole package: the xml, plus the md5 of every media file that rides in
// the zip (a "Full Media" export). Those bytes are the ORIGINALS the app
// saved, so their md5 is the Storage object's own — the one join that cannot
// be ambiguous (2026-09-16, when three of seven clips in her XML-only export
// looked like dozens of others by length and shape).
async function loadPackage(p) {
  if (/\.zip$/i.test(p) && fs.statSync(p).isFile()) {
    const JSZip = require('jszip');
    const crypto = require('crypto');
    const zip = await JSZip.loadAsync(fs.readFileSync(p));
    const name = Object.keys(zip.files).find((n) => /\.fcpxml$/i.test(n) && !zip.files[n].dir);
    if (!name) throw new Error('no .fcpxml inside the zip');
    const md5s = {};
    for (const n of Object.keys(zip.files)) {
      if (zip.files[n].dir || /\.fcpxml$/i.test(n)) continue;
      const buf = await zip.files[n].async('nodebuffer');
      md5s[basename(n)] = crypto.createHash('md5').update(buf).digest('base64');
    }
    return { xml: await zip.files[name].async('string'), md5s };
  }
  return { xml: loadXml(p), md5s: {} };
}

// Storage answers a HEAD with `x-goog-hash: md5=<base64>` — no download.
async function storageMd5(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const h = r.headers.get('x-goog-hash') || '';
    const m = h.match(/md5=([A-Za-z0-9+/=]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

// Storage answers content-length on the same HEAD.
async function storageBytes(url) {
  try { const r = await fetch(url, { method: 'HEAD' }); return Number(r.headers.get('content-length') || 0) || null; } catch { return null; }
}

// Settle an ambiguous clip by FILE SIZE — the number the Files app shows
// under a clip ("6.1 MB", one decimal, decimal megabytes), which she can
// read off a screenshot when the bytes themselves cannot travel. `sizes` is
// {filename: <MB as shown> | <bytes>}; a shown MB matches within its own
// rounding (±0.05 MB, ±0.5 MB for a bare "1 MB"). One candidate in range →
// settled; two → still a tie, never guessed.
async function settleBySize(result, media, sizes, head) {
  head = head || storageBytes;
  let settled = 0;
  const seen = new Set();
  for (const a of result.ambiguous || []) {
    if (seen.has(a.file) || media[a.file]) continue;
    seen.add(a.file);
    const raw = sizes[a.file]; if (raw == null) continue;
    const shownMB = Number(raw) < 1e4;
    const want = shownMB ? Number(raw) * 1e6 : Number(raw);
    const tol = shownMB ? (Number.isInteger(Number(raw)) ? 0.5e6 : 0.05e6) + 1000 : 1;
    const hits = [];
    for (const c of a.candidates) { const n = await head(c.url); if (n && Math.abs(n - want) <= tol) hits.push(c); }
    if (hits.length === 1) { media[a.file] = hits[0]; settled += 1; }
    else if (hits.length > 1) a.candidates = hits;   // narrowed for the next join
  }
  return settled;
}

// Settle every ambiguous clip whose bytes rode in the zip: HEAD each
// candidate, keep the one whose md5 is the file's. Pins the answer into the
// media map under the asset's own filename, so the next parse joins by name.
async function settleByHash(result, media, md5s, head) {
  head = head || storageMd5;
  let settled = 0;
  for (const a of result.ambiguous || []) {
    const want = md5s[a.file];
    if (!want || media[a.file]) continue;
    for (const c of a.candidates) {
      if (await head(c.url) === want) { media[a.file] = c; settled += 1; break; }
    }
  }
  return settled;
}

// The pure half: FCPXML text + filename→url map → {clips, sounds, skipped, gaps}
// A clip's shape class off its pixel size — the Footage log knows a clip as
// `480p · 9:16`, the fcpxml knows it as 496x864, and the two meet here.
function shapeOf(w, h) {
  if (!w || !h) return '';
  const short = Math.min(w, h);
  const res = short <= 520 ? '480p' : short <= 760 ? '720p' : short <= 1100 ? '1080p' : String(short);
  return res + (w > h ? ' landscape' : w < h ? ' portrait' : ' square');
}
function shapeOfCard(resolution, ratio) {
  const r = String(ratio || '');
  const [a, b] = r.split(':').map(Number);
  const orient = a && b ? (a > b ? 'landscape' : a < b ? 'portrait' : 'square') : '';
  return String(resolution || '') + (orient ? ' ' + orient : '');
}
const FP_TOL = 0.06;   // seconds — a 24fps frame is 0.042
function fingerprintMatch(asset, media) {
  if (!asset || !asset.seconds || !asset.w) return [];
  const shape = shapeOf(asset.w, asset.h);
  const seen = new Set();
  const out = [];
  for (const m of Object.values(media)) {
    if (!m || !m.url || !m.seconds || !m.shape || seen.has(m.url)) continue;
    if (m.shape !== shape || Math.abs(Number(m.seconds) - asset.seconds) > FP_TOL) continue;
    seen.add(m.url); out.push(m);
  }
  return out;
}
function whyNot(asset, m) {
  if (m && m.ambiguous) {
    const ids = m.ambiguous.map((c) => c.id || c.url);
    return `${ids.length} clips are ${R3(asset.seconds)}s ${shapeOf(asset.w, asset.h)} — which one? ` + ids.slice(0, 6).join(' · ') + (ids.length > 6 ? ` · +${ids.length - 6} more` : '');
  }
  return 'no url for this file';
}

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
    const fmt = formats[a.format] || {};
    assets[a.id] = {
      id: a.id, name: a.name || basename(src), file: basename(src),
      seconds: secs(a.duration), hasVideo: a.hasVideo === '1', hasAudio: a.hasAudio === '1',
      w: Number(fmt.width) || 0, h: Number(fmt.height) || 0,
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

  const clips = [], sounds = [], skipped = [], gaps = [], ambiguous = [];
  const media0 = media || {};
  const lookup = (asset) => {
    if (!asset) return null;
    const byName = media0[asset.file] || media0[asset.name] || Object.values(media0).find((m) => m && m.file === asset.file) || null;
    if (byName) return byName;
    // BY FINGERPRINT when the name says nothing (2026-09-16, her first real
    // export): the app's Save-to-Photos named every clip `clip-<random>.mp4`
    // until the same day's build, so the filename joins to nothing. A clip's
    // length and shape still do — but only when exactly ONE candidate has
    // them; two 15-second Mini clips look identical here and guessing would
    // put the wrong picture in her cut. Ambiguous → skipped, candidates named.
    let fp = fingerprintMatch(asset, media0);
    // a cut is one project: when the SURE matches all sit in one project (or
    // one folder), an ambiguous clip is looked for there first
    // A TIE-BREAKER ONLY: a cut can span projects (her christmas cut leaned
    // on trims filed under one project and clips under another), so the
    // same-project subset wins only when it is exactly one clip; otherwise
    // the whole set stays, for the size and md5 joins to work over.
    if (fp.length > 1 && sureWhere.project) {
      const same = fp.filter((c) => c.project === sureWhere.project);
      const inFolder = sureWhere.folder ? same.filter((c) => c.folder === sureWhere.folder) : [];
      if (inFolder.length === 1) fp = inFolder;
      else if (same.length === 1) fp = same;
    }
    if (fp.length === 1) return fp[0];
    if (fp.length > 1) return { ambiguous: fp };
    return null;
  };
  // where the clips this cut names for CERTAIN live — read off every asset
  // before the spine is walked, so a later clip can lean on an earlier one
  const sureWhere = { project: '', folder: '' };
  {
    const sure = [];
    for (const a of Object.values(assets)) {
      const byName = media0[a.file] || media0[a.name] || Object.values(media0).find((m) => m && m.file === a.file);
      const hit = byName || (fingerprintMatch(a, media0).length === 1 ? fingerprintMatch(a, media0)[0] : null);
      if (hit && hit.project) sure.push(hit);
    }
    const projects = [...new Set(sure.map((h) => h.project))];
    if (projects.length === 1) {
      sureWhere.project = projects[0];
      const folders = [...new Set(sure.map((h) => h.folder).filter(Boolean))];
      if (folders.length === 1) sureWhere.folder = folders[0];
    }
  }

  // everything on the spine, in offset order (the parser groups by tag name,
  // so timeline order has to come back from `offset`)
  const items = [];
  for (const tag of ['asset-clip', 'clip', 'video', 'gap', 'ref-clip']) for (const el of arr(spine[tag])) items.push({ tag, el });
  items.sort((a, b) => (secs(a.el.offset) || 0) - (secs(b.el.offset) || 0));

  let n = 0;
  const pieceKeys = [];
  // A CONNECTED SOUND'S `offset` IS IN ITS PARENT'S OWN TIME, NOT THE
  // TIMELINE'S (2026-09-16, her second export). FCPXML places a child at
  // `offset` on the parent clip's local timeline, whose first frame is the
  // parent's `start` — so a sound at the head of a clip whose start is 5.2s
  // carries offset="5.2s". Read as a timeline second that put every detached
  // track 1-40s early. Timeline at = parent.at + (offset - parent.start);
  // and the sound is ANCHORED to the piece it rode in on, so it follows the
  // shot when she moves it (the film-cut skill's rule).
  const addSound = (el, asset, laneNote, parent) => {
    const m = lookup(asset);
    if (!m || m.ambiguous) { skipped.push({ file: asset && asset.file, why: whyNot(asset, m) }); if (m && m.ambiguous) ambiguous.push({ file: asset.file, candidates: m.ambiguous }); return; }
    const local = secs(el.offset) || 0, tIn = secs(el.start) || 0, dur = secs(el.duration);
    const at = parent ? parent.at + (local - parent.start) : local;
    const s = { key: 's' + (sounds.length + 1), url: m.url, name: asset.name || asset.file, at: R3(at), in: R3(tIn), out: dur != null ? R3(tIn + dur) : null, gain: 0, fadeIn: 0, fadeOut: 0, mute: false };
    if (parent && parent.key) s.anchor = { piece: parent.key, offset: R3(at - parent.at) };
    if (m.seconds) s.seconds = m.seconds;
    for (const v of arr(el['adjust-volume'])) s.gain = db(v.amount);
    for (const f of arr(el['audio-fade'])) { if (f['fade-in']) s.fadeIn = R3(secs(arr(f['fade-in'])[0].duration) || 0); if (f['fade-out']) s.fadeOut = R3(secs(arr(f['fade-out'])[0].duration) || 0); }
    if (String(el.enabled) === '0') s.mute = true;
    sounds.push(s);
  };
  // attached clips ride INSIDE the spine clip they are connected to
  const attached = (el, parent) => {
    for (const tag of ['asset-clip', 'clip', 'audio', 'video']) for (const sub of arr(el[tag])) {
      if (sub.lane == null) continue;
      const asset = assets[sub.ref] || assets[(arr(sub.audio)[0] || arr(sub.video)[0] || {}).ref];
      if (Number(sub.lane) < 0 || (asset && !asset.hasVideo)) addSound(sub, asset, 'lane ' + sub.lane, parent);
      else skipped.push({ file: asset && asset.file, why: 'a picture on lane ' + sub.lane + ' (an overlay) — the cut doc has one picture lane' });
    }
  };

  for (const { tag, el } of items) {
    const dur = secs(el.duration);
    const at = secs(el.offset) || 0;
    if (tag === 'gap') { gaps.push({ at: R3(at), seconds: R3(dur || 0) }); attached(el, { at, start: secs(el.start) || 0, key: null }); continue; }
    const ref = el.ref || (arr(el.video)[0] || {}).ref || (arr(el.audio)[0] || {}).ref;
    const asset = assets[ref];
    if (!asset) { skipped.push({ file: ref, why: 'no asset for ref' }); continue; }
    if (!asset.hasVideo && asset.hasAudio) { addSound(el, asset, 'spine audio'); continue; }
    const m = lookup(asset);
    if (!m || m.ambiguous) { skipped.push({ file: asset.file, why: whyNot(asset, m) }); if (m && m.ambiguous) ambiguous.push({ file: asset.file, candidates: m.ambiguous }); attached(el, { at, start: secs(el.start) || 0, key: null }); continue; }
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
      // DETACHED AUDIO: LumaFusion writes the clip as <video> + its own
      // <audio> on a lane, so the soundtrack rides the sound lane and the
      // picture must not play it a second time.
      if (tag === 'clip' && arr(el.audio).some((a) => a.lane != null && a.ref === ref)) piece.mute = true;
      clips.push(piece);
    }
    pieceKeys.push(key);
    attached(el, { at, start: tIn, key });
  }
  return { clips, sounds, skipped, gaps, ambiguous, total: R3(clips.reduce((a, c) => a + (c.kind === 'image' ? c.out : c.out - c.in), 0)) };
}

// The newest zip in the Dump (or the one she named), downloaded to a temp
// file. Pure lookup + one download; nothing here spends money.
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
function pickDump(items, which) {
  const zips = items.filter((i) => /\.zip$/i.test(String(i.filename || i.storagePath || '')));
  if (which && which !== 'latest') return zips.find((i) => i.id === which) || items.find((i) => i.id === which) || null;
  return zips.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
}
async function fromDump(which) {
  const r = await fetch(`${BASE}/api/drop/items?media=file`);
  if (!r.ok) throw new Error(`dump list: HTTP ${r.status}`);
  const it = pickDump((await r.json()).items || [], which);
  if (!it) throw new Error(which === 'latest' ? 'no zip in the Dump yet' : `no Dump file ${which}`);
  const f = await fetch(`${BASE}/api/drop/file/${it.id}`);
  if (!f.ok) throw new Error(`dump download: HTTP ${f.status}`);
  const dest = path.join(require('os').tmpdir(), `dump-${it.id}.zip`);
  fs.writeFileSync(dest, Buffer.from(await f.arrayBuffer()));
  console.log(`Dump ${it.id} · ${it.filename || ''} · ${new Date(it.createdAt || 0).toISOString()} → ${dest}`);
  return dest;
}

// THE FOOTAGE LOG AS A MEDIA MAP — every clip the app has drawn, keyed by the
// FILENAME the app saves it under (the Storage object's own name since the
// 2026-09-16 build) and carrying the length and shape the fingerprint reads.
// Whole log: the default feed leaves tucked films out, so each film is asked
// for by name too. Free reads; nothing here spends money.
async function fromFootage() {
  const map = {};
  const put = (url, seconds, shape, id, title, where) => {
    if (!url) return;
    const file = basename(url.split('?')[0]);
    if (!map[file]) map[file] = { url, file, seconds: Number(seconds) || 0, shape, id, title, project: where && where.project || '', folder: where && where.folder || '' };
  };
  const pages = async (params) => {
    let before = '', beforeId = '';
    for (let i = 0; i < 20; i++) {
      const u = `${BASE}/api/footage/jobs?limit=200${params}${before ? `&before=${encodeURIComponent(before)}&beforeId=${encodeURIComponent(beforeId)}` : ''}`;
      const r = await fetch(u);
      if (!r.ok) throw new Error(`footage jobs: HTTP ${r.status}`);
      const d = await r.json();
      const jobs = d.jobs || [];
      for (const j of jobs) {
        const shape = shapeOfCard(j.resolution, j.ratio);
        const where = { project: j.project || '', folder: j.folder || '' };
        // TRIMS FIRST: a trimmed job's `video` IS its trim's url, so the trim
        // has to claim that filename with the trim's own length, not the job's
        for (const t of (j.trims || [])) if (t.status === 'ready') put(t.url, t.seconds, shape, `${j.id} trim ${t.start}-${t.end}`, j.title || j.prompt, where);
        put(j.video, j.seconds, shape, j.id, j.title || j.prompt, where);
        put(j.source, j.seconds, shape, j.id, j.title || j.prompt, where);
      }
      if (!d.more || !jobs.length) break;
      const last = jobs[jobs.length - 1];
      before = last.sentAt || ''; beforeId = last.id;
      if (!before) break;
    }
  };
  await pages('');
  // EVERY DOOR'S LOG TOO (forge-video-jobs): a clip a chat drew through
  // Atlas / APIFRAME / OpenRouter that the Footage feed leaves out
  try {
    const d = await (await fetch(`${BASE}/api/apiframe/video-log?limit=2000`)).json();
    for (const j of (d.jobs || [])) {
      const pr = j.params || {};
      const shape = shapeOfCard(pr.resolution || j.resolution, pr.aspect_ratio || pr.ratio || j.aspect || j.ratio);
      put(j.video, pr.duration || j.seconds, shape, j.job || j.jobId || j.id, j.title || j.prompt, { project: j.project || '', folder: j.folder || '' });
    }
  } catch { /* the footage feed alone */ }
  let films = [];
  try { films = ((await (await fetch(`${BASE}/api/cast/films`)).json()).films || []).filter((f) => f.tucked); } catch { /* no shelf */ }
  for (const f of films) await pages(`&project=${encodeURIComponent(f.slug)}`);
  return map;
}

module.exports = { fcpxmlToCut, secs, basename, pickDump, fromFootage, shapeOf, shapeOfCard, fingerprintMatch, loadPackage, settleByHash, storageMd5, settleBySize, storageBytes };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
    let src = args.find((a) => !a.startsWith('--') && !['--media', '--out', '--set', '--dump', '--sizes'].includes(args[args.indexOf(a) - 1]));
    if (flag('--dump')) src = await fromDump(flag('--dump'));
    if (!src) { console.error('usage: fcpxml-to-cut.js <file.fcpxml|bundle.fcpxmld|package.zip> --media media.json [--out cut.json] [--set <cutId>]'); process.exit(1); }
    // the Footage log is always consulted (by filename, then by fingerprint);
    // a --media file rides on top of it and wins on a name clash
    const media = Object.assign({}, args.includes('--no-footage') ? {} : await fromFootage(),
      flag('--media') ? JSON.parse(fs.readFileSync(flag('--media'), 'utf8')) : {});
    const { xml, md5s } = await loadPackage(src);
    let r = fcpxmlToCut(xml, media);
    if (r.ambiguous.length && Object.keys(md5s).length) {
      const n = await settleByHash(r, media, md5s);
      if (n) { console.log(`${n} clip(s) settled by md5 against the zip's media`); r = fcpxmlToCut(xml, media); }
    }
    if (r.ambiguous.length && flag('--sizes')) {
      const n = await settleBySize(r, media, JSON.parse(fs.readFileSync(flag('--sizes'), 'utf8')));
      if (n) { console.log(`${n} clip(s) settled by file size`); r = fcpxmlToCut(xml, media); }
    }
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

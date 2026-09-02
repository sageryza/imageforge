// filmeditor.js — Film Editor: Sophie's tap-only phone film editor, built from
// her own Claude Design canvas (docs/film-editor-design/, banked 2026-08-22).
// Page at /filmeditor, iOS tile under the FILM filter.
//
// The one surface that CUTS video. Assembly arranges whole pieces and the
// Story Room pad thinks in beats; neither can trim. Here a CUT is TWO LANES
// of pieces — the shape is cut-model.js, shared with the page and validated
// once (Sophie, 2026-09-02: "clips laid out exactly the same so we can both
// edit in parallel … i need to be able to move the sound around"):
//
//   PICTURE lane — `clips`, ordered. A piece is a REFERENCE into a source
//     file (url + in/out); a STILL (`kind:'image'`) is a picture held for
//     `out` seconds. Split and trim are metadata (two references into one
//     file, a moved in-point), so nothing is destructive and nothing
//     re-uploads: the render is the only moment the source is actually cut.
//   SOUND lane — `sounds`, any number, free to overlap. Each is a reference
//     into a source (url + in/out, out null = to the end) at a timeline
//     second `at`, with a level in dB, fades, mute, and optionally an ANCHOR
//     to a shot ("start N seconds after THAT piece, wherever it goes"). The
//     legacy one-track `audio` is READ as the first sound and MIRRORED back
//     on every save (CutModel.audioMirror) so a page cached on her phone
//     still reads and writes — a legacy `audio` write replaces only the
//     mirrored first sound and leaves the rest of the lane alone.
//
// THE DOC IS THE FILM — the chat and Sophie both edit ONE doc, and every
// version is a render of it (docs/film-editor-parallel-editing-plan.md).
// So a save carries `base`, the `updatedAt` the writer loaded, and a save
// whose base is not the doc's current stamp is REFUSED (409, with the
// current doc) rather than merged or silently overwritten — last-writer-wins
// was the bug this exists to close. `updatedAt` is the cut's EDIT clock: only
// a pieces save (and a rename) stamps it; a render job's progress ticks and
// the render record itself deliberately do not, or every save during a
// render would read as stale. `by` ('sophie'|'chat') rides every write.
//
// THE RENDER IS THE SCRATCH-PAD FILM'S RECIPE (via assembly.js — the pad's
// measured finding, imported not re-learned): every piece normalized onto ONE
// canvas (the first VIDEO piece's frame — else the first still's — evened,
// long edge capped 1280; 30fps, setsar=1, yuv420p) as its own segment so the
// concat demuxer joins with -c copy, audio as per-segment PCM cut/padded to
// each segment's REAL encoded length, concatenated sample-exact, AAC-encoded
// ONCE at the mux. A clip's trim is `-ss IN -to OUT` as INPUT options —
// source timestamps; measured 2026-09-02, `-to` is the absolute in-file
// position, so the cut lasts OUT−IN. A STILL is Assembly's own recipe:
// `-loop 1 -t <hold> -i <picture>` through the same segment filters (a png
// or webp loops exactly; its poster is the picture itself), always silent.
// A piece's `mute` swaps its PCM for anullsrc and its `gain` rides a
// `volume` filter on that segment's PCM.
//
// THE SOUNDS ARE MIXED AT THE MUX, ONE GRAPH (mixGraph — pure, exported):
// every non-muted sound is one input, trimmed with -ss/-to as input options,
// then (a MONO file first through pan=stereo|c0=c0|c1=c0 — aformat's own
// upmix would lose 3.0 dB, measured; her voice memos are mono) aformat 44100
// stereo → volume=<gain>dB → afade in / afade out (the
// out fade placed from the TRIMMED length, probed when the doc does not know
// it) → adelay to its RESOLVED start (CutModel.soundStart — an anchored sound
// lands on its shot wherever the shot moved) → amix with the picture lane's
// own PCM as input 1, duration=first, normalize=0. normalize=0 is
// load-bearing: amix's default halves every voice. duration=first plus
// -shortest at the mux is what keeps a long bed from lengthening the film.
// A muted sound is never downloaded and never enters the graph.
//
// A split piece shares its source url with its twin, so the job downloads and
// probes each unique URL ONCE — twelve pieces of one recording cost one
// download; a sound that is also a clip's own file shares that download.
//
// Every render record carries `by` and `cut: {clips, sounds}` — the snapshot
// it was rendered from — so `GET /:id/diff` can say in words what moved since
// (CutModel.diffCut); that is what a chat reads when she next messages it.
// After a render the film's SHOT MAP is written from the doc through
// filmshots.js (best-effort — never fails a render; only when the doc names a
// `chat`), so the paused player's Prompt door works on a film cut here.
//
// Renders never overwrite — filmeditor/<id>/film-<n>.mp4, kept on the doc
// (capped 12) newest first — and the cut snapshot on each is schema fields
// only, so twelve of them stay far under Firestore's doc limit.
// `filmeditor/` is on clips.js's SKIP_PREFIXES: a film cut FROM footage must
// not be harvested back onto the shelf as a clip.
//
// Preview proxies bake themselves (one at a time — the 512MB box); a STILL's
// proxy is a 60-second silent mp4 loop of the picture at the proxy edge, so
// the page's two-video player never learns what a still is (measured
// 2026-09-02: 78KB for 60s at 720x540 with -tune stillimage).
//
// Routes (mounted at /api/filmeditor by server.js, STUDIO_TOKEN gate, /status open):
//   GET    /status      → { ok, firebase, ffmpeg, ffprobe, cuts }
//   GET    /            → { cuts } — trimmed list, newest edited first
//   POST   /            → { title?, chat?, session?, by? } → { id } — a new empty cut
//   POST   /proxies     → { urls:[…], audio:[…] } — start/report preview bakes;
//                         an image url in `urls` answers with still:true
//   GET    /proxies?urls=a,b&audio=c — read only
//   GET    /:id         → the doc, `sounds` always present (legacy audio read in)
//   POST   /:id/pieces  → { clips?, sounds?, audio?, base?, by? } — the whole
//                         arrangement in one save (a split changes two pieces
//                         and the order at once). A field left out is left
//                         alone; `audio` (legacy) counts only when `sounds` is
//                         absent. base ≠ updatedAt → 409 { error:'stale', doc }.
//                         → { ok, updatedAt, pieces, doc }
//   POST   /:id/title   → { title } → { ok, title, updatedAt }
//   POST   /:id/render  → { by? } — bake the cut (background job on the doc)
//   GET    /:id/job     → { job, renders }
//   GET    /:id/diff?from=<render at ms> → { from, by, snapshot, updatedAt,
//                         changes, text } — what moved since that render
//                         (newest when omitted; no render → against an empty cut)
//   DELETE /:id         → remove the cut (Storage renders stay)
//
// Tests: node scripts/test-filmeditor.js (pure functions, no network) and
// node scripts/test-filmeditor-render.js (a real render of generated fixtures
// through renderCut — stills, an anchored sound following a reorder, fades,
// gain, mute — asserted with ffprobe/ffmpeg, no Firestore).

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const editor = require('./editor');           // uploadPublic + audioDuration
const clips = require('./clips');             // bucketForUrl (Admin-SDK downloads)
const assembly = require('./assembly');       // targetFrom + segmentFilters — ONE canvas rule
const CutModel = require('./cut-model');      // THE shape of a cut, shared with the page
const filmshots = require('./filmshots');     // the shot map behind the paused player's Prompt door
const { storageRef } = require('./asset-hash');
const { imageSize } = require('./image-size');

const COL = process.env.FILMEDITOR_COLLECTION || 'forge-film-edits';
const PROXY_COL = 'forge-film-proxies';
const STORAGE_FOLDER = 'filmeditor';
const PROXY_EDGE = 720;        // preview copies cap both edges here
const MAX_PIECES = CutModel.MAX_PIECES;
const MAX_RENDERS = 12;        // the house cap; older cuts kept
const MIN_PIECE = CutModel.MIN_PIECE;

function tryRequire(name) { try { return require(name); } catch { return null; } }
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}
function usable(p) { if (!p) return null; try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { return null; } }
const FFMPEG = process.env.FFMPEG_PATH || usable(tryRequire('ffmpeg-static')) || firstOnPath('ffmpeg');
const ffprobeStatic = tryRequire('ffprobe-static');
const FFPROBE = process.env.FFPROBE_PATH || usable(ffprobeStatic && ffprobeStatic.path) || firstOnPath('ffprobe');

function db() { return admin.apps.length ? admin.firestore() : null; }
function fail(res, err) {
  console.warn('filmeditor:', err.message);
  res.status(500).json({ error: err.message });
}
function run(bin, args, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
  });
}
const nowIso = () => new Date().toISOString();
const r3 = (x) => Math.round(x * 1000) / 1000;

// ── The shape: cut-model.js, re-exported (never a second copy of a rule) ───
const { cleanPieces, cleanSounds, pieceSeconds, totalSeconds, splitPiece, readDoc } = CutModel;

// Who wrote: her, or a chat. Anything else is her — the page never sends it.
const byOf = (v) => (v === 'chat' ? 'chat' : 'sophie');

// THE STALE RULE (pure): a writer that says which doc it loaded is refused
// when the doc has moved on. A writer that sends no base (an older cached
// page) is let through exactly as before — refusing it would make the page
// on her phone unable to save at all.
function staleSave(base, updatedAt) {
  if (base == null || base === '') return false;
  const b = Number(base);
  if (!Number.isFinite(b)) return false;
  return b !== Number(updatedAt || 0);
}

// A LEGACY `audio` write is the one-track page talking: it knows only the
// mirrored first sound, so it replaces THAT one — same file at a moved
// offset stays the same sound (moved, riding its shot if it had one), a
// different file takes its place, null clears it — and the rest of the lane
// is left exactly as it was. Wiping every sound because an old page sent
// `audio:null` on its every save would hand a chat's whole sound design to
// a cache. Pure.
function legacySounds(audio, cur, clipsNow) {
  const fresh = CutModel.soundsFromAudio(audio)[0] || null;
  const rest = (cur || []).slice(1);
  if (!fresh) return rest;
  const head = (cur || [])[0];
  if (head && head.url === fresh.url) {
    const at = CutModel.soundStart(head, clipsNow);
    if (Math.abs(fresh.at - at) <= CutModel.MOVE_EPS) return [head].concat(rest);
    return [CutModel.moveSound(head, clipsNow, fresh.at)].concat(rest);
  }
  return [fresh].concat(rest);
}

// What a save writes, given the doc as it stands and the body (pure). A
// field left out is left alone; the sound lane is always re-normalized
// against the clips that will be on the doc (an anchor follows a moved
// shot, an anchor to a deleted shot is dropped) and the legacy mirror is
// rewritten with it. null = nothing to save.
function savePatch(doc, body) {
  body = body || {};
  const cur = readDoc(doc);
  const hasClips = 'clips' in body;
  const hasSounds = 'sounds' in body;
  const hasAudio = 'audio' in body;
  if (!hasClips && !hasSounds && !hasAudio) return null;
  const nextClips = hasClips ? cleanPieces(body.clips) : cur.clips;
  let nextSounds = cur.sounds;
  if (hasSounds) nextSounds = cleanSounds(body.sounds);
  else if (hasAudio) nextSounds = legacySounds(body.audio, cur.sounds, nextClips);
  nextSounds = CutModel.normalize(nextClips, nextSounds);
  const patch = { sounds: nextSounds, audio: CutModel.audioMirror(nextSounds) };
  if (hasClips) patch.clips = nextClips;
  return patch;
}

// The doc as a reader should see it: both lanes present and clean, the
// legacy mirror derived (an old doc carries `audio` and no `sounds`).
function withLanes(doc) {
  const lanes = readDoc(doc || {});
  return { ...doc, clips: lanes.clips, sounds: lanes.sounds, audio: CutModel.audioMirror(lanes.sounds) };
}

// ── Preview proxies ────────────────────────────────────────────────────────
// Her sources stall in the player because they are HEAVY, not because the
// web can't play video (measured 2026-08-22: a 784x1168 Midjourney export at
// 19 Mbps — 12.3MB for five seconds). The editor therefore PREVIEWS a baked
// lightweight copy per source (the proxy-editing pattern every real editor
// uses) while the RENDER always cuts the original — the house display-copy
// rule, applied to video. Measured on her real clip: 12.3MB → 278KB.
const proxyId = (url) => crypto.createHash('sha1').update(String(url)).digest('hex');

// Pure: a source that is already small and light streams fine as itself.
function proxyNeeded(probe, bytes) {
  const secs = probe && probe.seconds;
  const kbps = secs ? (bytes * 8) / secs / 1000 : null;
  const edge = Math.max((probe && probe.width) || 0, (probe && probe.height) || 0);
  return !(kbps != null && kbps < 3000 && edge <= PROXY_EDGE);
}
// Pure: the exact bake. CRF with a maxrate ceiling, both edges capped, moov
// up front so it streams from the first byte.
function proxyArgs(src, out, hasAudio) {
  return ['-y', '-i', src,
    '-vf', `scale=${PROXY_EDGE}:${PROXY_EDGE}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25',
    '-maxrate', '3M', '-bufsize', '6M', '-pix_fmt', 'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
    '-movflags', '+faststart', out];
}
// Pure: a STILL's proxy — the picture looped for STILL_MAX seconds (the
// longest hold the schema allows), silent, at the proxy edge. The player
// then treats a still exactly like any video source: seek to `in`, play to
// `out`. -tune stillimage is what keeps 60s of one frame at ~78KB.
function stillProxyArgs(src, out) {
  return ['-y', '-loop', '1', '-t', String(CutModel.STILL_MAX), '-i', src,
    '-vf', `scale=${PROXY_EDGE}:${PROXY_EDGE}:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=${assembly.FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-tune', 'stillimage',
    '-an', '-movflags', '+faststart', out];
}

// THE AUDIO TRACK GETS A PROXY TOO (2026-08-23, measured on her real cut:
// the "music" was a 13.9MB 480p YouTube VIDEO mp4 streamed through the
// <audio> element — a 17.9s film needs ~300KB of actual audio). An
// audio-only AAC copy is baked for any track that is a video file or heavy;
// a small pure-audio file honestly skips.
const audioProxyId = (url) => `${proxyId(url)}-aud`;
function audioProxyNeeded(probe, bytes) {
  return Boolean(probe.hasVideo) || bytes > 12 * 1024 * 1024;
}
function audioProxyArgs(src, out) {
  return ['-y', '-i', src, '-vn', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', out];
}

// One bake at a time — the 512MB box (the Playground's serialize lesson).
let proxyChain = Promise.resolve();
function enqueueProxy(url, kind) {
  const fn = kind === 'audio' ? bakeAudioProxy : bakeProxy;
  proxyChain = proxyChain.then(() => fn(url)).catch(() => {});
}
async function bakeProxy(url) {
  const d = db();
  if (!d || !FFMPEG || !FFPROBE) return;
  const ref = d.collection(PROXY_COL).doc(proxyId(url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feproxy-'));
  try {
    const src = path.join(dir, 'src');
    await downloadSource(url, src);
    const bytes = fs.statSync(src).size;
    const probe = await probeFile(src);
    if (probe.image) {
      // a still: always baked — the player needs a video to seek in
      const out = path.join(dir, 'proxy.mp4');
      await run(FFMPEG, stillProxyArgs(src, out), 900000);
      const proxyUrl = await editor.uploadPublic(out,
        `${STORAGE_FOLDER}/proxy/${proxyId(url)}.mp4`, 'video/mp4');
      await ref.set({
        url, status: 'ready', proxyUrl, still: true,
        bytes: fs.statSync(out).size, srcBytes: bytes, at: Date.now(),
      }, { merge: true });
      return;
    }
    if (!probe.hasVideo) throw new Error('no video stream');
    if (!proxyNeeded(probe, bytes)) {
      await ref.set({ url, status: 'skip', proxyUrl: null, at: Date.now() }, { merge: true });
      return;
    }
    const out = path.join(dir, 'proxy.mp4');
    await run(FFMPEG, proxyArgs(src, out, probe.hasAudio), 900000);
    const proxyUrl = await editor.uploadPublic(out,
      `${STORAGE_FOLDER}/proxy/${proxyId(url)}.mp4`, 'video/mp4');
    await ref.set({
      url, status: 'ready', proxyUrl,
      bytes: fs.statSync(out).size, srcBytes: bytes, at: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('filmeditor: proxy failed —', err.message);
    await ref.set({ url, status: 'error', proxyUrl: null, error: String(err.message).slice(0, 300), at: Date.now() }, { merge: true }).catch(() => {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
async function bakeAudioProxy(url) {
  const d = db();
  if (!d || !FFMPEG || !FFPROBE) return;
  const ref = d.collection(PROXY_COL).doc(audioProxyId(url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feaprox-'));
  try {
    const src = path.join(dir, 'src');
    await downloadSource(url, src);
    const bytes = fs.statSync(src).size;
    const probe = await probeFile(src);
    if (!probe.hasAudio) throw new Error('no audio stream');
    if (!audioProxyNeeded(probe, bytes)) {
      await ref.set({ url, kind: 'audio', status: 'skip', proxyUrl: null, at: Date.now() }, { merge: true });
      return;
    }
    const out = path.join(dir, 'proxy.m4a');
    await run(FFMPEG, audioProxyArgs(src, out), 900000);
    const proxyUrl = await editor.uploadPublic(out,
      `${STORAGE_FOLDER}/proxy/${proxyId(url)}.m4a`, 'audio/mp4');
    await ref.set({
      url, kind: 'audio', status: 'ready', proxyUrl,
      bytes: fs.statSync(out).size, srcBytes: bytes, at: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('filmeditor: audio proxy failed —', err.message);
    await ref.set({ url, kind: 'audio', status: 'error', proxyUrl: null, error: String(err.message).slice(0, 300), at: Date.now() }, { merge: true }).catch(() => {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The shared read+enqueue: answer what exists, start what doesn't. A wedged
// 'making' older than 20 min and an 'error' older than 10 get another go.
// A still's record answers `still:true` beside the usual pair.
async function proxyStates(urls, mayEnqueue, kind) {
  const d = db();
  const idFor = kind === 'audio' ? audioProxyId : proxyId;
  const map = {};
  for (const url of urls) {
    const snap = await d.collection(PROXY_COL).doc(idFor(url)).get();
    const v = snap.exists ? snap.data() : null;
    const age = v ? Date.now() - (v.at || 0) : 0;
    const retry = v && ((v.status === 'making' && age > 20 * 60 * 1000)
      || (v.status === 'error' && age > 10 * 60 * 1000));
    if (mayEnqueue && (!v || retry)) {
      await d.collection(PROXY_COL).doc(idFor(url)).set(
        { url, ...(kind === 'audio' ? { kind: 'audio' } : {}), status: 'making', proxyUrl: null, at: Date.now() }, { merge: true });
      enqueueProxy(url, kind);
      map[url] = { status: 'making', proxyUrl: null };
    } else {
      map[url] = v ? { status: v.status, proxyUrl: v.proxyUrl || null, ...(v.still ? { still: true } : {}) }
        : { status: 'none', proxyUrl: null };
    }
  }
  return map;
}

// ── The mix (pure, exported) ───────────────────────────────────────────────
const AFORMAT = 'aformat=sample_rates=44100:channel_layouts=stereo';

// How long a sound plays after its trim: the doc's own answer when it has
// one, else what the render probed (`lens[key]`), else unknown.
function soundLength(s, lens) {
  if (lens && lens[s.key] != null && Number.isFinite(Number(lens[s.key]))) return r3(Number(lens[s.key]));
  return CutModel.soundSeconds(s);
}
// The sounds that enter the graph, in the order they take inputs 2..N+1.
// Muted is out; a sound known to play nothing is out.
function activeSounds(sounds, lens) {
  return (sounds || []).filter((s) => {
    if (!s || s.mute) return false;
    const len = soundLength(s, lens);
    return len == null || len > 0;
  });
}
// The trim as INPUT options: -ss only when there is an in-point, -to only
// when there is an out — an open sound simply runs to its file's end.
function soundInputArgs(s, file) {
  const args = [];
  if (s.in > 0) args.push('-ss', Number(s.in).toFixed(3));
  if (s.out != null) args.push('-to', Number(s.out).toFixed(3));
  args.push('-i', file);
  return args;
}
// A piece's own PCM filter: its level, then apad so the wav can be cut to
// the segment's real length. (A muted piece never reaches this — anullsrc.)
function segmentAudioFilter(piece) {
  const g = Number(piece && piece.gain) || 0;
  return g ? `volume=${g}dB,apad` : 'apad';
}
// Inputs: 0 = the silent concat video, 1 = the picture lane's PCM, 2.. = the
// active sounds in order. '' when nothing is active — the caller then muxes
// the PCM straight, no graph.
// A MONO sound must not go through aformat's own upmix: swresample's default
// matrix puts a centre channel into L and R at 1/√2 each, so a mono file
// arrives in the stereo mix 3.0 dB DOWN (measured 2026-09-02 with astats:
// −18.06 dB mono → −21.07 dB per channel after aformat; `pan` keeps −18.06;
// so does `-ac 2`). Her voice memos are mono — this is the difference
// between "her voice at unity" and her voice 3 dB under every bed. `chans`
// is what the render probed per sound key; with nothing known a sound is
// treated as stereo, which is the smaller error.
const MONO_UP = 'pan=stereo|c0=c0|c1=c0';
function mixGraph(sounds, clipsNow, lens, chans) {
  const active = activeSounds(sounds, lens);
  if (!active.length) return '';
  const parts = active.map((s, i) => {
    const mono = chans && Number(chans[s.key]) === 1;
    const chain = mono ? [MONO_UP, AFORMAT] : [AFORMAT];
    if (s.gain) chain.push(`volume=${s.gain}dB`);
    if (s.fadeIn > 0) chain.push(`afade=t=in:st=0:d=${s.fadeIn}`);
    const len = soundLength(s, lens);
    if (s.fadeOut > 0 && len != null && len > 0) {
      const d = Math.min(s.fadeOut, len);
      chain.push(`afade=t=out:st=${r3(Math.max(0, len - d))}:d=${d}`);
    }
    const ms = Math.max(0, Math.round(CutModel.soundStart(s, clipsNow) * 1000));
    chain.push(`adelay=${ms}|${ms}`);
    return `[${i + 2}:a]${chain.join(',')}[s${i}]`;
  });
  const labels = active.map((s, i) => `[s${i}]`).join('');
  return `${parts.join(';')};[1:a]${labels}amix=inputs=${active.length + 1}:duration=first:dropout_transition=0:normalize=0[a]`;
}

// The film's shot map, derived from the cut: every piece at its timeline
// second. A still's picture IS the shot; a clip's poster stands in for it
// (that is what the chat filed, if anything), else its own url — which
// resolves to no words and so no button, the Assets tab's own silence.
function shotsFromCut(clipsNow) {
  return CutModel.starts(clipsNow).map((s) => {
    const p = s.piece;
    const shot = { at: s.start, url: p.kind === 'image' ? p.url : (p.poster || p.url) };
    if (p.title) shot.title = p.title;
    return shot;
  });
}

// What moved since a render (pure): `fromAt` names a render by its `at`;
// omitted = the newest. No render, or one from before snapshots → against an
// empty cut, and `snapshot:false` says so.
function diffSince(doc, fromAt) {
  const renders = (doc && doc.renders) || [];
  const want = fromAt != null && fromAt !== '' ? Number(fromAt) : null;
  const render = want != null ? renders.find((r) => Number(r.at) === want) : renders[0] || null;
  if (want != null && !render) return null;
  const before = render && render.cut ? render.cut : { clips: [], sounds: [] };
  const changes = CutModel.diffCut(before, doc || {});
  return {
    from: render ? render.at : null,
    by: render ? render.by || null : null,
    snapshot: Boolean(render && render.cut),
    updatedAt: (doc && doc.updatedAt) || 0,
    changes,
    text: CutModel.describeDiff(changes),
  };
}

const trimmedCut = (a) => {
  const lanes = readDoc(a);
  return {
    id: a.id, title: a.title || '',
    pieces: lanes.clips.length,
    seconds: Math.round(totalSeconds(lanes.clips) * 10) / 10,
    renders: (a.renders || []).length,
    poster: (lanes.clips[0] || {}).poster || (lanes.clips[0] && lanes.clips[0].kind === 'image' ? lanes.clips[0].url : null) || null,
    sounds: lanes.sounds.length,
    hasAudio: lanes.sounds.length > 0,
    chat: a.chat || null,
    lastEditBy: a.lastEditBy || null,
    job: a.job && a.job.status === 'running' ? { kind: a.job.kind, label: a.job.label } : null,
    updatedAt: a.updatedAt || 0,
  };
};

// ── Firestore plumbing (the assembly/cutmarks pattern) ─────────────────────
async function loadDoc(id) {
  const d = db();
  if (!d) throw new Error('Firebase unavailable');
  const snap = await d.collection(COL).doc(id).get();
  return snap.exists ? snap.data() : null;
}
// `touch` stamps the edit clock. Job progress and render records do NOT
// touch it — see the header: a save during a render must not read as stale.
async function patchDoc(id, fields, touch) {
  const f = JSON.parse(JSON.stringify(fields));
  if (touch) f.updatedAt = Date.now();
  await db().collection(COL).doc(id).update(f);
  return f.updatedAt;
}
async function txField(id, field, fn) {
  const ref = db().collection(COL).doc(id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('no such cut');
    const value = fn(snap.data()[field], snap.data());
    tx.update(ref, { [field]: JSON.parse(JSON.stringify(value)) });
    return value;
  });
}
// The save, in a transaction so the stale check and the write are one step:
// two writers racing cannot both pass the check.
async function saveCut(id, body) {
  const ref = db().collection(COL).doc(id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { status: 404 };
    const doc = snap.data();
    const patch = savePatch(doc, body);
    if (!patch) return { status: 400 };
    if (staleSave(body.base, doc.updatedAt)) return { status: 409, doc: withLanes(doc) };
    const updatedAt = Math.max(Date.now(), Number(doc.updatedAt || 0) + 1);
    const fields = { ...patch, updatedAt, lastEditBy: byOf(body.by) };
    tx.update(ref, JSON.parse(JSON.stringify(fields)));
    return { status: 200, updatedAt, doc: withLanes({ ...doc, ...fields }) };
  });
}

// Background jobs — startJob with the stale-takeover, patching FIELDS only.
async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such cut');
  if (doc.job && doc.job.status === 'running') {
    const age = Date.now() - new Date(doc.job.startedAt || 0).getTime();
    if (age < 20 * 60 * 1000) throw new Error(`a "${doc.job.kind}" job is already running`);
  }
  const job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: nowIso() };
  await patchDoc(id, { job });
  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      Object.assign(job, { done, total, label });
      if (Date.now() - lastSave > 1500) {
        lastSave = Date.now();
        await patchDoc(id, { job }).catch(() => {});
      }
    };
    try {
      await fn(progress);
      Object.assign(job, { status: 'done', label: 'done' });
    } catch (err) {
      console.warn(`filmeditor: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
    }
    await patchDoc(id, { job }).catch((e) => console.warn('filmeditor: save failed —', e.message));
  })();
}

// Admin SDK first (private objects, and it works where a url fetch can't),
// plain fetch as the fallback for anything external.
async function downloadSource(url, file) {
  const ref = storageRef(url);
  const bucket = ref ? clips.bucketForUrl(url) : null;
  if (bucket) {
    await bucket.file(ref.path).download({ destination: file });
    return file;
  }
  const res = await fetch(url, { redirect: 'follow', timeout: 900000 });
  if (!res.ok) throw new Error(`source fetch ${res.status}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    res.body.pipe(out);
    res.body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  return file;
}

// What a file is. An IMAGE probes as a `*_pipe` format carrying one video
// stream and no duration (measured 2026-09-02: png → png_pipe, webp →
// webp_pipe, both with width/height); a format ffprobe cannot size is asked
// image-size.js off its first bytes.
async function probeFile(file) {
  if (!FFPROBE) return { seconds: 0, width: null, height: null, hasVideo: true, hasAudio: true, image: false };
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries',
    'format=duration,format_name:stream=codec_type,width,height,channels', '-of', 'json', file], 120000);
  const info = JSON.parse(stdout || '{}');
  const d = parseFloat((info.format || {}).duration || '0');
  const vs = (info.streams || []).find((s) => s.codec_type === 'video');
  const fmt = String((info.format || {}).format_name || '');
  const image = /_pipe$/.test(fmt);
  let width = (vs && vs.width) || null;
  let height = (vs && vs.height) || null;
  if (image && !(width && height)) {
    try {
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(4096);
      const n = fs.readSync(fd, buf, 0, 4096, 0);
      fs.closeSync(fd);
      const sz = imageSize(buf.subarray(0, n));
      if (sz) { width = sz.w; height = sz.h; }
    } catch { /* stays unknown */ }
  }
  return {
    seconds: Number.isFinite(d) && d > 0 ? d : 0,
    width, height,
    hasVideo: Boolean(vs),
    hasAudio: (info.streams || []).some((s) => s.codec_type === 'audio'),
    channels: Number(((info.streams || []).find((s) => s.codec_type === 'audio') || {}).channels) || 0,
    image,
  };
}

// ─── the render itself ──────────────────────────────────────────────
// Takes a doc OBJECT and a working dir the caller owns; returns the finished
// file and what it was cut from. No Firestore, no upload — runRender wraps
// it, and the integration test drives it with generated fixtures.
async function renderCut(doc, opts) {
  opts = opts || {};
  const dir = opts.dir;
  const progress = opts.progress || (async () => {});
  const download = opts.download || downloadSource;
  if (!FFMPEG || !FFPROBE) throw new Error('ffmpeg/ffprobe unavailable');
  if (!dir) throw new Error('renderCut needs a dir');
  const lanes = readDoc(doc);
  const pieces = lanes.clips;
  const sounds = lanes.sounds;
  if (!pieces.length) throw new Error('the timeline is empty — nothing to bake');
  const wanted = sounds.filter((s) => !s.mute);
  const total = pieces.length + wanted.length + 2;

  // One download + one probe per unique SOURCE — split pieces share a url,
  // and a sound that is a clip's own file shares its download.
  const sources = new Map();
  async function sourceFor(url) {
    if (sources.has(url)) return sources.get(url);
    const file = path.join(dir, `src-${sources.size}`);
    await download(url, file);
    const probe = await probeFile(file);
    const entry = { file, probe };
    sources.set(url, entry);
    return entry;
  }

  // THE CANVAS: the first VIDEO piece's frame when there is one, else the
  // first still's — a film of stills opening on one is still shaped by the
  // footage in it.
  let target = null;
  const firstVideo = pieces.find((p) => p.kind !== 'image');
  const lead = firstVideo || pieces[0];
  const leadSrc = await sourceFor(lead.url);
  if (lead.kind !== 'image' && !leadSrc.probe.hasVideo) throw new Error(`"${lead.title || 'a piece'}" has no video stream`);
  target = assembly.targetFrom(leadSrc.probe.width, leadSrc.probe.height);

  const segs = [];
  const auds = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    await progress(i, total, `piece ${i + 1} of ${pieces.length} — ${p.title || 'untitled'}`.slice(0, 80));
    const src = await sourceFor(p.url);
    const still = p.kind === 'image';
    if (!still && !src.probe.hasVideo) throw new Error(`"${p.title || 'a piece'}" has no video stream`);

    const seg = path.join(dir, `seg-${i}.mp4`);
    let tIn = 0;
    let tOut = p.out;
    if (still) {
      // Assembly's still: the picture looped for its hold, through the same
      // segment filters — one canvas, one fps, its own encode.
      await run(FFMPEG, ['-y', '-loop', '1', '-t', Number(p.out).toFixed(3), '-i', src.file,
        '-vf', assembly.segmentFilters(target), '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-movflags', '+faststart', seg], 900000);
    } else {
      // The kept span decoded accurately (-ss/-to as INPUT options = source
      // timestamps), normalized onto the one canvas, its own encode —
      // concat-copy safe, exactly the assembly segment with a trim in front.
      const srcEnd = src.probe.seconds || null;
      tIn = Math.min(p.in, srcEnd != null ? Math.max(0, srcEnd - MIN_PIECE) : p.in);
      tOut = srcEnd != null ? Math.min(p.out, srcEnd) : p.out;
      if (tOut - tIn < MIN_PIECE / 2) throw new Error(`"${p.title || 'a piece'}" trims to nothing`);
      await run(FFMPEG, ['-y', '-ss', tIn.toFixed(3), '-to', tOut.toFixed(3), '-i', src.file,
        '-vf', assembly.segmentFilters(target), '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-movflags', '+faststart', seg], 900000);
    }

    // Audio: PCM cut/padded to the segment's REAL encoded length, so the
    // sample-exact wav concat can never drift off the picture. A still, a
    // muted piece and a silent source all lay down silence.
    const segDur = await editor.audioDuration(seg);
    if (!segDur) throw new Error(`"${p.title || 'a piece'}" encoded to nothing`);
    const wav = path.join(dir, `aud-${i}.wav`);
    if (!still && !p.mute && src.probe.hasAudio) {
      await run(FFMPEG, ['-y', '-ss', tIn.toFixed(3), '-to', tOut.toFixed(3), '-i', src.file,
        '-vn', '-af', segmentAudioFilter(p), '-t', segDur.toFixed(3),
        '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', wav], 600000);
    } else {
      await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-t', segDur.toFixed(3), '-c:a', 'pcm_s16le', wav], 600000);
    }
    segs.push(seg);
    auds.push(wav);
  }

  // The sounds: each downloaded once, probed for the length the doc does
  // not know (an open `out`), refused honestly when it carries no audio.
  const lens = {};
  const chans = {};
  for (let i = 0; i < wanted.length; i++) {
    const s = wanted[i];
    await progress(pieces.length + i, total, `sound ${i + 1} of ${wanted.length} — ${s.name || 'untitled'}`.slice(0, 80));
    const src = await sourceFor(s.url);
    if (!src.probe.hasAudio) throw new Error(`"${s.name || 'a sound'}" has no audio`);
    const known = CutModel.soundSeconds(s);
    lens[s.key] = known != null ? known : r3(Math.max(0, (src.probe.seconds || 0) - (s.in || 0)));
    chans[s.key] = src.probe.channels || 0;
  }
  const active = activeSounds(sounds, lens);
  // sources are only safe to drop once every piece is cut (shared urls) —
  // and a sound's file stays for the mux
  const keep = new Set(active.map((s) => s.url));
  for (const [url, s] of sources) if (!keep.has(url)) fs.rmSync(s.file, { force: true });

  await progress(total - 2, total, 'joining the pieces');
  const esc = (f) => `file '${f.replace(/'/g, "'\\''")}'`;
  const vList = path.join(dir, 'v.txt');
  fs.writeFileSync(vList, segs.map(esc).join('\n'));
  const silent = path.join(dir, 'v.mp4');
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', vList, '-c', 'copy', silent], 600000);
  const aList = path.join(dir, 'a.txt');
  fs.writeFileSync(aList, auds.map(esc).join('\n'));
  const track = path.join(dir, 'a.wav');
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', aList, '-c', 'copy', track], 600000);

  const out = path.join(dir, 'film.mp4');
  if (active.length) {
    const inputs = [];
    for (const s of active) inputs.push(...soundInputArgs(s, sources.get(s.url).file));
    await run(FFMPEG, ['-y', '-i', silent, '-i', track, ...inputs,
      '-filter_complex', mixGraph(sounds, pieces, lens, chans),
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], 600000);
  } else {
    await run(FFMPEG, ['-y', '-i', silent, '-i', track, '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], 600000);
  }
  const seconds = await editor.audioDuration(out);
  return {
    file: out, seconds: Math.round(seconds * 10) / 10,
    width: target.width, height: target.height,
    clips: pieces, sounds, mixed: active.length,
  };
}

// The render JOB: read the doc, render it, publish, file the record with its
// snapshot, then the shot map (best-effort).
async function runRender(id, progress, by) {
  if (!FFMPEG || !FFPROBE) throw new Error('ffmpeg/ffprobe unavailable');
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such cut');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmeditor-'));
  try {
    const total = 1;
    const r = await renderCut(doc, { dir, progress });
    await progress(total, total, 'publishing');
    const n = (doc.renders || []).length + 1;
    const url = await editor.uploadPublic(r.file, `${STORAGE_FOLDER}/${id}/film-${n}.mp4`, 'video/mp4');
    const render = {
      url, at: Date.now(), by: byOf(by), seconds: r.seconds,
      pieces: r.clips.length, sounds: r.mixed, audio: r.mixed > 0,
      width: r.width, height: r.height,
      cut: { clips: r.clips, sounds: r.sounds },
    };
    await txField(id, 'renders', (cur) => [render].concat(Array.isArray(cur) ? cur : []).slice(0, MAX_RENDERS));
    if (doc.chat) {
      try {
        await filmshots.record({
          chat: doc.chat, url, shots: shotsFromCut(r.clips), seconds: r.seconds, source: 'filmeditor',
        });
      } catch (e) { console.warn('filmeditor: shot map not written —', e.message); }
    }
    return render;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '1mb' }));

router.get('/status', async (req, res) => {
  let cuts = null;
  try { cuts = (await db().collection(COL).count().get()).data().count; } catch { /* unconfigured */ }
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: !!FFMPEG, ffprobe: !!FFPROBE, cuts });
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const cuts = snap.docs.map((s) => trimmedCut({ id: s.id, ...s.data() }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ cuts });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firebase unavailable');
    const body = req.body || {};
    const ref = d.collection(COL).doc();
    // Named with HER date and time (Pacific), the assembly lesson — two cuts
    // made the same day must never wear one name.
    const PT = { timeZone: 'America/Los_Angeles' };
    const title = String(body.title || '').trim().slice(0, 120)
      || 'Cut · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...PT })
      + ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...PT }).toLowerCase();
    // The cut knows its chat — session-first resolution like every other
    // chat-keyed post, so the shot map lands where that chat's pictures are.
    const session = String(body.session || '').replace(/^cse_/, '').slice(0, 80);
    let chat = String(body.chat || '').trim().slice(0, 60);
    if (chat) {
      try { chat = await require('./chatfeed').resolveChat(chat, session); }
      catch (e) { /* resolution down — keep the given slug */ }
    }
    const now = Date.now();
    await ref.set({
      id: ref.id, title, clips: [], sounds: [], audio: null, renders: [], job: null,
      chat: chat || null, session: session || null,
      lastEditBy: byOf(body.by || (chat ? 'chat' : 'sophie')),
      createdAt: now, updatedAt: now,
    });
    res.json({ id: ref.id, title, updatedAt: now });
  } catch (err) { fail(res, err); }
});

// Preview proxies — MUST stay registered above GET /:id or Express reads
// "proxies" as a cut id (the /api/promptlab/styles lesson).
// POST { urls:[…] } ensures a bake exists or starts one; GET ?urls=a,b only
// reads. The page polls GET while any answer says 'making'. An image url
// rides `urls` like any source and answers `still:true`.
const cleanUrls = (list) => [...new Set(list
  .map((u) => String(u || '').trim().slice(0, 500))
  .filter((u) => /^https:\/\//.test(u)))].slice(0, 40);
router.post('/proxies', async (req, res) => {
  try {
    const urls = cleanUrls(Array.isArray(req.body.urls) ? req.body.urls : []);
    const audioUrls = cleanUrls(Array.isArray(req.body.audio) ? req.body.audio : []);
    if (!urls.length && !audioUrls.length) return res.status(400).json({ error: 'urls[] required' });
    res.json({
      proxies: urls.length ? await proxyStates(urls, true) : {},
      audio: audioUrls.length ? await proxyStates(audioUrls, true, 'audio') : {},
    });
  } catch (err) { fail(res, err); }
});
router.get('/proxies', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const urls = cleanUrls(String(req.query.urls || '').split(','));
    const audioUrls = cleanUrls(String(req.query.audio || '').split(','));
    res.json({
      proxies: urls.length ? await proxyStates(urls, false) : {},
      audio: audioUrls.length ? await proxyStates(audioUrls, false, 'audio') : {},
    });
  } catch (err) { fail(res, err); }
});

// Play-session telemetry (2026-08-23, round three) — what her PHONE actually
// did during a play: build id, rVFC fire counts, playhead holds, boundary
// reveal waits, audio start latency / entry realigns / stalls. Every fix so
// far was verified in headless Chromium while her device kept failing; this
// closes that loop with a measurement instead of another guess. One small doc
// per cut, newest sessions first, capped — no bytes, nothing personal beyond
// the browser's user-agent line. Registered above GET /:id (the /proxies
// lesson: Express would read "telemetry" as a cut id).
// The page's current build id, read once from the html itself — one source.
// GET /build is what the page's self-heal compares itself against: the iOS
// app keeps recent tools alive, so a loaded page can be DAYS old while the
// served one moves on (the round-three finding, 2026-08-23).
const PAGE_BUILD = (() => {
  try {
    const m = /var BUILD = '([^']+)'/.exec(
      fs.readFileSync(path.join(__dirname, 'public', 'filmeditor.html'), 'utf8'));
    return (m && m[1]) || '';
  } catch (e) { return ''; }
})();
router.get('/build', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ build: PAGE_BUILD });
});

const TEL_COL = 'forge-film-telemetry';
const telNum = (v, cap) => Math.max(0, Math.min(Number(v) || 0, cap));
router.post('/telemetry', async (req, res) => {
  try {
    const d = db();
    if (!d) return res.status(503).json({ error: 'no store' });
    const b = req.body || {};
    const cut = String(b.cut || '').slice(0, 40);
    if (!/^[A-Za-z0-9_-]{4,}$/.test(cut)) return res.status(400).json({ error: 'cut required' });
    const session = {
      at: telNum(b.at, 4102444800000) || Date.now(),
      build: String(b.build || '').slice(0, 40),
      ua: String(b.ua || '').slice(0, 160),
      ph0: telNum(b.ph0, 36000), ph1: telNum(b.ph1, 36000),
      dur: telNum(b.dur, 3600000), joints: telNum(b.joints, 10000),
      vholdMs: telNum(b.vholdMs, 3600000), choldMs: telNum(b.choldMs, 3600000),
      black: (Array.isArray(b.black) ? b.black : []).slice(0, 30).map((n) => telNum(n, 60000)),
      rvfc: (Array.isArray(b.rvfc) ? b.rvfc : []).slice(0, 2).map((n) => telNum(n, 10000000)),
      aud: b.aud && typeof b.aud === 'object' ? {
        src: b.aud.src === 'proxy' ? 'proxy' : 'raw',
        startMs: b.aud.startMs == null ? null : telNum(b.aud.startMs, 3600000),
        entries: (Array.isArray(b.aud.entries) ? b.aud.entries : []).slice(0, 20)
          .map((n) => Math.max(-3600, Math.min(Number(n) || 0, 3600))),
        resync: telNum(b.aud.resync, 10000), paceOn: telNum(b.aud.paceOn, 10000),
        waits: telNum(b.aud.waits, 10000),
      } : null,
    };
    const ref = d.collection(TEL_COL).doc(cut);
    const snap = await ref.get();
    const sessions = [session, ...((snap.exists && snap.data().sessions) || [])].slice(0, 20);
    await ref.set({ cut, sessions, at: Date.now() });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});
router.get('/telemetry', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const d = db();
    if (!d) return res.status(503).json({ error: 'no store' });
    const cut = String(req.query.cut || '').slice(0, 40);
    if (!cut) return res.status(400).json({ error: 'cut required' });
    const snap = await d.collection(TEL_COL).doc(cut).get();
    res.json({ cut, sessions: (snap.exists && snap.data().sessions) || [] });
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    res.json(withLanes(doc));
  } catch (err) { fail(res, err); }
});

router.get('/:id/job', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    res.json({ job: doc.job || null, renders: doc.renders || [] });
  } catch (err) { fail(res, err); }
});

// What moved since a render — the words a chat reads back to her.
router.get('/:id/diff', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    const out = diffSince(doc, req.query.from);
    if (!out) return res.status(404).json({ error: 'no such render' });
    res.json(out);
  } catch (err) { fail(res, err); }
});

// The whole arrangement in one save — a split changes two pieces and the
// order at once, so a partial write could never be right. A field the page
// doesn't send is left alone; `sounds: []` genuinely clears the lane, and a
// legacy `audio: null` clears the mirrored track. `base` is the writer's
// loaded `updatedAt`; a stale one is refused WITH the current doc.
router.post('/:id/pieces', async (req, res) => {
  try {
    const out = await saveCut(req.params.id, req.body || {});
    if (out.status === 404) return res.status(404).json({ error: 'no such cut' });
    if (out.status === 400) return res.status(400).json({ error: 'nothing to save' });
    if (out.status === 409) return res.status(409).json({ error: 'stale', updatedAt: out.doc.updatedAt || 0, doc: out.doc });
    res.json({ ok: true, updatedAt: out.updatedAt, pieces: out.doc.clips.length, doc: out.doc });
  } catch (err) { fail(res, err); }
});

router.post('/:id/title', async (req, res) => {
  try {
    const title = String(req.body.title || '').slice(0, 120).trim();
    if (!title) return res.status(400).json({ error: 'a title is required' });
    const updatedAt = await patchDoc(req.params.id, { title }, true);
    res.json({ ok: true, title, updatedAt });
  } catch (err) { fail(res, err); }
});

router.post('/:id/render', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    if (!readDoc(doc).clips.length) return res.status(400).json({ error: 'the timeline is empty' });
    const by = byOf((req.body || {}).by);
    await startJob(req.params.id, 'render', (progress) => runRender(req.params.id, progress, by));
    res.json({ ok: true, status: 'rendering', by });
  } catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db().collection(COL).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router, COL, PROXY_COL,
  // the shape (cut-model.js), re-exported for the tests and older callers
  cleanPieces, cleanSounds, pieceSeconds, totalSeconds, splitPiece, readDoc, withLanes,
  // the save rules
  staleSave, savePatch, legacySounds, byOf,
  // the mix
  mixGraph, activeSounds, soundInputArgs, segmentAudioFilter, soundLength,
  // the render, the diff, the shot map
  renderCut, diffSince, shotsFromCut, downloadSource, probeFile,
  proxyId, proxyNeeded, proxyArgs, stillProxyArgs,
  audioProxyId, audioProxyNeeded, audioProxyArgs,
  trimmedCut, MAX_PIECES, MAX_RENDERS, MIN_PIECE, PROXY_EDGE, PAGE_BUILD,
};

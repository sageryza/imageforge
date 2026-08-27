// ytdl.js — paste a video URL, get the file, already filed where the tools look.
//
// Sophie's ask (Aug 2026): "can u create an endpoint so i can give u a youtube
// url and download it thru here? otherwise i have to do it on my computer."
// The alternative she was using is a third-party site on her phone (ytdown.to):
// it works, but it hands the file to her Files app, so every download still
// needs a second trip to upload it into whichever tool wanted it.
//
// RENDER IS NOT BLOCKED — measured live 2026-08-23: probe 4.8s, a 3.4MB m4a in
// under 6s, a 360p mp4 merged, postered and filed at 9.1MB. It can regress
// (the blocking is YouTube's to change), so `GET /status?probe=1` re-runs that
// measurement on demand, and a real block lands as `blocked:true` on the doc
// with yt-dlp's own words rather than as a hung job.
//
// THE BINARY IS FETCHED AT RUNTIME AND REFRESHES ITSELF WEEKLY, deliberately.
// Render's stock Node image has no yt-dlp and no Python, so the choices were a
// build step or this. yt-dlp is the one dependency here that goes stale on
// someone else's schedule — YouTube changes its player and last month's binary
// stops extracting — so a version pinned at build time is a tool that works
// until it silently doesn't. `yt-dlp_linux` is a self-contained PyInstaller
// build (no Python needed); it lands in the system temp dir, is re-fetched when
// older than a week, and a fetch failure degrades to whatever is on PATH.
//
// NOTHING IS EVER HELD IN MEMORY. The whole app has 512MB and a film is
// gigabytes: yt-dlp writes straight to disk, ffprobe reads the file, the
// Storage write streams from disk (`bucket.upload`), and the temp file is
// deleted in a finally. There is no express.raw on this module at all.
//
// IT FILES INTO THE LIBRARIES THAT ALREADY EXIST, THROUGH THEIR OWN ROUTES.
// A fourth copy of md5 dedupe / poster baking / duration probing is how those
// drift apart, so the job POSTs the finished file to the sibling that already
// owns that job — video to the Dump (/api/drop/upload-file, which Assembly's
// "Add from the Dump" and the Film Editor read), audio to the audio library
// (/api/audio/upload-file, batch `youtube`). Both dedupe by the md5 of the
// bytes, so grabbing the same video twice tops up rather than doubling.
//   NOTE, and say it out loud when handing over a music track: the audio
//   library TRANSCRIBES unconditionally (~$0.006/min) and files into the voice
//   memo archive. That is right for an interview and wrong for a song — pass
//   `to:"none"` for music and use the returned url directly.
//
// The doc id is sha1(source|kind|quality), so re-asking for a grab already
// done returns that doc instead of paying for it twice, and a half-finished
// job is resumed rather than duplicated.
//
// Mounted at /api/ytdl by server.js. STUDIO_TOKEN-gated (only /status is open).
//
// Routes:
//   GET  /status[?probe=1]   → { ok, firebase, ytdlp, ffmpeg, probe? }
//   POST /grab               → { url, kind:'audio'|'video', quality?, to?, name? }
//                              returns { id, job } in ~0.3s; work runs behind it
//   GET  /items?limit=       → recent grabs, newest first
//   GET  /:id                → the grab doc
//   GET  /:id/job            → poll one job
//   POST /:id/retry          → run it again (a stale/failed job)
//   DELETE /:id              → forget the grab (the filed copy is untouched)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const router = express.Router();

const COL = 'forge-ytdl';

// The self-contained linux build — no Python on the box required.
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
const YTDLP_BIN = path.join(os.tmpdir(), 'forge-yt-dlp');
const YTDLP_MAX_AGE = 7 * 24 * 60 * 60 * 1000;   // re-fetch weekly

// Caps, and the size one is a MEMORY fact rather than a preference: the file is
// handed on to the Dump / audio library through their own upload routes, and
// both sit behind `express.raw`, which buffers the entire body — on a 512MB box
// a 600MB grab is an OOM on arrival. 300MB is roughly an hour of 720p and far
// more than any audio. The duration cap just refuses obvious mistakes (a
// twelve-hour livestream) before anything is spent on it.
const MAX_SECONDS = Number(process.env.YTDL_MAX_SECONDS || 3 * 60 * 60);
const MAX_MB = Number(process.env.YTDL_MAX_MB || 300);

const KINDS = new Set(['audio', 'video']);
// Video: the height cap. Audio is always the best audio-only stream there is.
const QUALITIES = { '360': 360, '480': 480, '720': 720, '1080': 1080 };

let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } catch { /* direct */ }
}

function tryRequire(name) { try { return require(name); } catch { return null; } }
function usable(p) {
  if (!p) return null;
  try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { return null; }
}
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}

// ffmpeg is what lets yt-dlp merge a separate video and audio stream into one
// mp4 (and remux a DASH m4a into a container every player accepts). Static npm
// binary first, same resolution as its siblings; without it the job asks for a
// single pre-muxed stream instead of the best two, which costs quality and
// never fails.
const FFMPEG = process.env.FFMPEG_PATH
  || usable(tryRequire('ffmpeg-static'))
  || firstOnPath('ffmpeg');
const FFPROBE = process.env.FFPROBE_PATH
  || usable((tryRequire('ffprobe-static') || {}).path)
  || firstOnPath('ffprobe');

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}
function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function fail(res, err) {
  const msg = err && err.message ? err.message : String(err);
  res.status(msg.includes('not configured') ? 503 : 500).json({ error: msg });
}
function nowIso() { return new Date().toISOString(); }
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60);
}

/* ── the source url ──────────────────────────────────────────────────────── */

// yt-dlp supports a thousand sites and there is no reason to refuse Vimeo, so
// this validates the SHAPE rather than the host: http(s) only, and never an
// address inside our own network. The gate is the studio token; this is the
// belt against a route that fetches a url on the server's behalf.
const PRIVATE_HOST = /^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.internal$|.*\.local$)/i;

function checkSource(raw) {
  const s = String(raw || '').trim();
  if (!s) throw new Error('url required');
  let u;
  try { u = new URL(s); } catch { throw new Error('that is not a url'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('http(s) urls only');
  if (PRIVATE_HOST.test(u.hostname)) throw new Error('that host is not reachable from here');
  return u.toString();
}

// The tail of a youtube url is the one part worth reading ourselves: it makes
// the doc id stable across the six spellings of the same video (youtu.be, /shorts,
// &t=90, a playlist index hanging off the end) so asking twice is one doc.
function youtubeId(u) {
  try {
    const url = new URL(u);
    if (/(^|\.)youtu\.be$/i.test(url.hostname)) return url.pathname.slice(1).split('/')[0] || null;
    if (!/(^|\.)youtube(-nocookie)?\.com$/i.test(url.hostname)) return null;
    const v = url.searchParams.get('v');
    if (v) return v;
    const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname);
    return m ? m[2] : null;
  } catch { return null; }
}

function grabId(source, kind, quality) {
  const key = youtubeId(source) || source;
  return crypto.createHash('sha1')
    .update(`${key}|${kind}|${quality || ''}`).digest('hex').slice(0, 20);
}

/* ── yt-dlp itself ───────────────────────────────────────────────────────── */

let ytdlpReady = null;   // a promise, so ten concurrent grabs fetch it once

function binAge(p) {
  try { return Date.now() - fs.statSync(p).mtimeMs; } catch { return Infinity; }
}

async function fetchBinary() {
  const tmp = `${YTDLP_BIN}.${crypto.randomBytes(4).toString('hex')}`;
  const res = await fetch(YTDLP_URL, {
    redirect: 'follow', agent: proxyAgent || undefined, timeout: 300000,
  });
  if (!res.ok) throw new Error(`yt-dlp download ${res.status}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    res.body.pipe(out);
    res.body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  await fs.promises.chmod(tmp, 0o755);
  // Rename last: a half-written binary must never become the cached one.
  await fs.promises.rename(tmp, YTDLP_BIN);
  return YTDLP_BIN;
}

// The binary, freshest available. An expired cache that fails to refresh keeps
// serving the old copy — a week-old yt-dlp is far better than none.
async function ytdlp() {
  const onPath = process.env.YTDLP_PATH ? usable(process.env.YTDLP_PATH) : null;
  if (onPath) return onPath;
  if (!ytdlpReady) {
    ytdlpReady = (async () => {
      const age = binAge(YTDLP_BIN);
      if (age < YTDLP_MAX_AGE) return YTDLP_BIN;
      try {
        return await fetchBinary();
      } catch (e) {
        if (age < Infinity) {
          console.warn('ytdl: refresh failed, keeping the cached binary —', e.message);
          return YTDLP_BIN;
        }
        const sys = firstOnPath('yt-dlp');
        if (sys) return sys;
        throw new Error(`yt-dlp unavailable — ${e.message}`);
      }
    })();
    // A failure must not be cached forever; the next call may well succeed.
    ytdlpReady.catch(() => { ytdlpReady = null; });
  }
  return ytdlpReady;
}

// spawn + collect, with a hard timeout. stdout is bounded because yt-dlp's
// progress lines are chatty and nothing here needs more than the tail.
function run(bin, args, { timeout = 30 * 60 * 1000, onLine } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let out = ''; let err = ''; let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; try { p.kill('SIGKILL'); } catch {} reject(new Error('timed out')); }
    }, timeout);
    p.stdout.on('data', (d) => {
      const s = String(d);
      out = (out + s).slice(-20000);
      if (onLine) s.split('\n').forEach((l) => { if (l.trim()) onLine(l.trim()); });
    });
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    p.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (code === 0) resolve({ out, err });
      else reject(new Error(cleanErr(err) || `yt-dlp exited ${code}`));
    });
  });
}

// yt-dlp's stderr is long and mostly boilerplate. Keep the line that says what
// actually went wrong, and name the bot-block for what it is — that is the one
// failure with a different remedy (the desktop queue), so it must not read like
// a generic error.
function cleanErr(err) {
  const lines = String(err || '').split('\n').map((l) => l.trim())
    .filter((l) => l && !/^WARNING:/i.test(l));
  const hit = lines.filter((l) => /^ERROR:/i.test(l)).pop() || lines.pop() || '';
  return hit.replace(/^ERROR:\s*/i, '').slice(0, 400);
}

// The bot-block, told apart from every other failure. This is the whole reason
// CLAUDE.md says these downloads are desktop-only, so when it happens the doc
// says so in a field rather than burying it in an error string.
function isBlocked(msg) {
  return /sign in to confirm|not a bot|429|too many requests|blocked it in your country|unable to download webpage: http error 403/i
    .test(String(msg || ''));
}

/* ── the doc + its background job ────────────────────────────────────────── */

async function loadDoc(id) {
  const snap = await db().collection(COL).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}
// Patch FIELDS, never stamp a whole doc — a job saving a stale copy of the
// whole thing is what reverted concurrent edits in the Episode Editor.
async function patchDoc(id, fields) {
  await db().collection(COL).doc(id)
    .set({ ...JSON.parse(JSON.stringify(fields)), updatedAt: Date.now() }, { merge: true });
}

async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such grab');
  if (doc.job && doc.job.status === 'running') {
    const age = Date.now() - new Date(doc.job.startedAt || 0).getTime();
    // Stale-job takeover: a restart mid-download must not wedge the doc forever.
    if (age < 30 * 60 * 1000) throw new Error(`a "${doc.job.kind}" job is already running`);
  }
  const job = {
    kind, status: 'running', done: 0, total: 0,
    label: 'starting', error: null, startedAt: nowIso(),
  };
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
      Object.assign(job, { status: 'done', label: 'done', done: job.total || 1 });
    } catch (err) {
      console.warn(`ytdl: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
      await patchDoc(id, {
        status: 'failed', error: err.message, blocked: isBlocked(err.message),
      }).catch(() => {});
    }
    await patchDoc(id, { job }).catch((e) => console.warn('ytdl: save failed —', e.message));
  })();
}

/* ── the work ────────────────────────────────────────────────────────────── */

async function readMeta(bin, source, client) {
  const { out } = await run(bin, [
    '--no-warnings', '--no-playlist', '--skip-download',
    ...clientArgs(client),
    '--print', '%(id)s\t%(title)s\t%(duration)s\t%(uploader)s\t%(ext)s',
    source,
  ], { timeout: 120000 });
  const [vid, title, dur, uploader] = String(out).trim().split('\n').pop().split('\t');
  const seconds = Number(dur);
  return {
    videoId: vid && vid !== 'NA' ? vid : null,
    title: title && title !== 'NA' ? title : null,
    seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    uploader: uploader && uploader !== 'NA' ? uploader : null,
  };
}

// The format string. Audio takes the best audio-only stream and remuxes to m4a
// when ffmpeg is around. Video takes the best pair under the height cap and
// merges — but WITHOUT ffmpeg a merge is impossible, so it falls back to the
// best single pre-muxed stream rather than failing.
function formatFor(kind, quality) {
  if (kind === 'audio') return 'bestaudio[ext=m4a]/bestaudio/best';
  const h = QUALITIES[String(quality)] || 720;
  return FFMPEG
    ? `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`
    : `best[height<=${h}][ext=mp4]/best[height<=${h}]/best`;
}

async function download(bin, source, kind, quality, dir, progress, client) {
  const args = [
    '--no-warnings', '--no-playlist', '--no-part',
    ...clientArgs(client),
    '--newline',                                  // one progress line at a time
    '--retries', '3', '--fragment-retries', '5',
    '--max-filesize', `${MAX_MB}m`,
    '-f', formatFor(kind, quality),
    '-o', path.join(dir, 'media.%(ext)s'),
  ];
  if (FFMPEG) {
    args.push('--ffmpeg-location', FFMPEG);
    // Land in a container everything plays. A bare DASH m4a and an unmerged
    // stream both play in some things and not others; without ffmpeg neither
    // step is possible and the format string above already avoids needing them.
    if (kind === 'audio') args.push('--remux-video', 'm4a');
    else args.push('--merge-output-format', 'mp4');
  }
  args.push(source);

  await run(bin, args, {
    timeout: 45 * 60 * 1000,
    onLine: (line) => {
      const m = /\[download\]\s+([\d.]+)%/.exec(line);
      if (m) progress(Math.round(Number(m[1])), 100, 'downloading');
      else if (/\[Merger\]|\[ExtractAudio\]|\[VideoRemuxer\]/.test(line)) progress(100, 100, 'packaging');
    },
  });

  const files = (await fs.promises.readdir(dir))
    .filter((f) => f.startsWith('media.'))
    .map((f) => path.join(dir, f));
  if (!files.length) {
    // --max-filesize aborts cleanly with exit 0 and writes nothing, so an empty
    // directory after a successful run means exactly one thing.
    throw new Error(`nothing downloaded — the file is probably over the ${MAX_MB}MB cap`);
  }
  // The merged output when there is one; otherwise the biggest piece.
  const stats = await Promise.all(files.map(async (f) => ({ f, size: (await fs.promises.stat(f)).size })));
  stats.sort((a, b) => b.size - a.size);
  return stats[0];
}

function md5File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('md5');
    const s = fs.createReadStream(file);
    s.on('data', (d) => h.update(d));
    s.on('error', reject);
    s.on('end', () => resolve(h.digest('hex')));
  });
}

/* ── where the file goes ─────────────────────────────────────────────────── */

// The finished file goes to the sibling that already owns that kind of media,
// through the route it already exposes — so md5 dedupe, duration probing, the
// video poster and the memo filing all happen exactly once, in the one place
// that knows how. The bytes are streamed from disk; the receiving route is what
// buffers, which is what MAX_MB is sized against.
const SELF = `http://127.0.0.1:${process.env.PORT || 3001}`;

function selfHeaders(ct) {
  const h = { 'content-type': ct };
  if (process.env.STUDIO_TOKEN) h['x-studio-token'] = process.env.STUDIO_TOKEN;
  return h;
}

async function fileInto(dest, localFile, { filename, name, ct, seconds }) {
  const q = new URLSearchParams({ filename, name });
  let url;
  if (dest === 'dump') {
    q.set('bundle', 'YouTube');
    q.set('session', `ytdl-${new Date().toISOString().slice(0, 10)}`);
    url = `${SELF}/api/drop/upload-file?${q}`;
  } else {
    q.set('batch', 'youtube');
    url = `${SELF}/api/audio/upload-file?${q}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: selfHeaders(ct),
    body: fs.createReadStream(localFile),
    timeout: 20 * 60 * 1000,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.item || !out.item.url) {
    throw new Error(`filing into the ${dest === 'dump' ? 'Dump' : 'audio library'} failed — ${out.error || res.status}`);
  }
  return {
    url: out.item.url,
    filedAs: dest,
    filedId: out.item.id || null,
    duplicate: Boolean(out.duplicate),
    seconds: out.item.seconds || seconds || null,
    posterUrl: out.item.posterUrl || null,
  };
}

// `to:"none"` — she wants the url and nothing else (a music track, which the
// audio library would otherwise transcribe and file into her voice memos).
// Then this module holds the only copy, under a readable path.
async function storeOwn(localFile, { videoId, title, ext, ct }) {
  const bucket = bucketOrNull();
  if (!bucket) throw new Error('Firebase Storage not configured');
  const base = slug(title) || slug(videoId) || 'grab';
  const dest = `ytdl/${slug(videoId) || 'x'}/${base}.${ext}`;
  await bucket.upload(localFile, { destination: dest, metadata: { contentType: ct } });
  const f = bucket.file(dest);
  await f.makePublic();
  return {
    url: `https://storage.googleapis.com/${bucket.name}/${dest}`,
    storagePath: dest,
    filedAs: 'none',
  };
}

// WHERE AN UNSPECIFIED GRAB GOES, and why audio does NOT default to the audio
// library. That library transcribes everything it receives and files it into
// Sophie's voice-memo archive — right for an interview, wrong for a song, and
// the two are not tellable apart from the metadata (`categories`, `artist` and
// `track` all come back NA on the player client yt-dlp uses here, measured
// 2026-08-24). So the default is the one whose mistake is cheap: `none` keeps
// the file under `ytdl/` and hands back a url, and a chat grabbing an INTERVIEW
// asks for `to:"audio"` deliberately. The other way round, a music grab nobody
// thought about would put song lyrics in among the notes she searches, and
// there is no undo for that beyond finding and deleting the memo.
// Video is unambiguous — the Dump is where video is looked for, and it neither
// transcribes nor costs anything.
function defaultTo(kind) {
  return kind === 'audio' ? 'none' : 'dump';
}

function ctFor(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === 'mp4' || e === 'm4v') return 'video/mp4';
  if (e === 'webm') return 'video/webm';
  if (e === 'mkv') return 'video/x-matroska';
  if (e === 'm4a') return 'audio/mp4';
  if (e === 'mp3') return 'audio/mpeg';
  if (e === 'opus') return 'audio/opus';
  if (e === 'ogg') return 'audio/ogg';
  if (e === 'wav') return 'audio/wav';
  return 'application/octet-stream';
}

/* ── the grab ────────────────────────────────────────────────────────────── */

// THE BOT-BLOCK IS PER PLAYER CLIENT — NOT per IP, and not per video
// (measured 2026-08-27, and this REPLACES the "it is just rate-limiting" note
// that stood here for three days). On ONE box within a few seconds, asking for
// the same video: `default`, `android_vr`, `android`, `ios_music` and
// `android_music` all answered, while `tv`, `tv_simply`, `web`, `web_safari`,
// `web_music`, `ios` and `mweb` were every one of them refused with "Sign in to
// confirm you're not a bot". The web and tv clients want a JS challenge solved
// that this box has no runtime for; the android family does not ask.
//
// That is why waiting alone was not enough: six real grabs of Sophie's on
// Aug 25 failed with four bot-blocks while the endpoint's own probe was
// answering fine the whole time, because the probe's video happened to be one
// `default` would still serve. So a refusal is answered by CHANGING CLIENT
// first and only then by waiting — and anything that is not a block (a dead
// url, a private video) still fails at once rather than wasting her time.
const CLIENTS = ['default', 'android_vr', 'android', 'ios_music', 'android_music'];
const BLOCK_ROUNDS = 2;
const BLOCK_WAITS = [8000];

function clientArgs(client) {
  return !client || client === 'default'
    ? [] : ['--extractor-args', `youtube:player_client=${client}`];
}

// fn(client) → result. Answers { value, client } so the caller can carry the
// client that worked into the next step instead of re-discovering it.
async function pastTheBlock(what, fn, progress, waits = BLOCK_WAITS, clients = CLIENTS) {
  let last;
  for (let round = 0; round < BLOCK_ROUNDS; round++) {
    for (const client of clients) {
      try {
        return { value: await fn(client), client };
      } catch (e) {
        last = e;
        if (!isBlocked(e.message)) throw e;
        await progress(0, 100, `youtube refused ${client} — trying another way`);
        console.warn(`ytdl: ${what} refused on client ${client}`);
      }
    }
    if (round < BLOCK_ROUNDS - 1) {
      await progress(0, 100, 'youtube said wait — pausing');
      await new Promise((r) => setTimeout(r, waits[0]));
    }
  }
  throw last;
}

async function runGrab(id, progress) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such grab');
  const { source, kind, quality } = doc;
  const to = doc.to || defaultTo(kind);

  await progress(0, 100, 'finding yt-dlp');
  const bin = await ytdlp();

  await progress(0, 100, 'reading the video');
  const lookup = await pastTheBlock('the lookup', (c) => readMeta(bin, source, c), progress);
  const meta = lookup.value;
  if (meta.seconds && meta.seconds > MAX_SECONDS) {
    throw new Error(`that is ${Math.round(meta.seconds / 60)} minutes — the cap is ${Math.round(MAX_SECONDS / 60)}`);
  }
  await patchDoc(id, {
    title: meta.title, seconds: meta.seconds,
    uploader: meta.uploader, videoId: meta.videoId,
  });

  // Everything downloaded lands in its own directory, and the directory goes
  // away in the finally — a 300MB leftover on an ephemeral disk is how a box
  // runs out of space three grabs later.
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ytdl-'));
  try {
    await progress(0, 100, 'downloading');
    // Whichever client answered the lookup goes first for the download — on a
    // refusal the rest of the ladder is still there behind it.
    const order = [lookup.client, ...CLIENTS.filter((c) => c !== lookup.client)];
    const got = await pastTheBlock('the download',
      (c) => download(bin, source, kind, quality, dir, progress, c),
      progress, BLOCK_WAITS, order);
    const { f: file, size } = got.value;
    const ext = (path.extname(file).slice(1) || (kind === 'audio' ? 'm4a' : 'mp4')).toLowerCase();
    const ct = ctFor(ext);
    const nice = (meta.title || 'grab').replace(/[/\\]+/g, '-').slice(0, 120);

    await progress(100, 100, to === 'none' ? 'saving' : 'filing');
    const filed = to === 'none'
      ? await storeOwn(file, { videoId: meta.videoId, title: meta.title, ext, ct })
      : await fileInto(to, file, {
        filename: `${slug(nice) || 'grab'}.${ext}`, name: nice, ct, seconds: meta.seconds,
      });

    const md5 = await md5File(file);
    await patchDoc(id, {
      ...filed,
      status: 'done', error: null, blocked: false,
      ext, bytes: size, md5, client: got.client,
      seconds: filed.seconds || meta.seconds || null,
      finishedAt: Date.now(),
    });
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ── routes ──────────────────────────────────────────────────────────────── */

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '1mb' }));

// GET /status[?probe=1] — config health, and on demand the one measurement
// that actually matters: can THIS box, on THIS IP, still pull from YouTube?
// CLAUDE.md's "datacenter IPs are bot-blocked" is a population fact about an
// environment, and the rule there is to measure it rather than reason about it.
// The probe reads metadata only — no download, no bytes, no cost.
router.get('/status', async (req, res) => {
  const out = {
    ok: true,
    firebase: Boolean(bucketOrNull()),
    ffmpeg: Boolean(FFMPEG),
    ffprobe: Boolean(FFPROBE),
    maxMinutes: Math.round(MAX_SECONDS / 60),
    maxMB: MAX_MB,
  };
  try {
    const bin = await ytdlp();
    out.ytdlp = true;
    const v = await run(bin, ['--version'], { timeout: 60000 }).catch(() => null);
    out.ytdlpVersion = v ? String(v.out).trim().split('\n').pop() : null;
    if (req.query.probe) {
      const t0 = Date.now();
      try {
        const meta = await readMeta(bin, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        out.probe = { ok: true, title: meta.title, ms: Date.now() - t0 };
      } catch (e) {
        out.probe = { ok: false, blocked: isBlocked(e.message), error: e.message, ms: Date.now() - t0 };
      }
    }
  } catch (e) {
    out.ytdlp = false;
    out.ytdlpError = e.message;
  }
  res.set('Cache-Control', 'no-store');
  res.json(out);
});

// POST /grab { url, kind, quality, to, name }
// Returns in ~0.3s with an id; poll GET /:id/job. Asking twice for the same
// video at the same settings returns the doc that already exists — a finished
// one as it stands, an unfinished one with its job restarted.
router.post('/grab', async (req, res) => {
  try {
    const b = req.body || {};
    const source = checkSource(b.url);
    const kind = KINDS.has(String(b.kind)) ? String(b.kind) : 'video';
    const quality = QUALITIES[String(b.quality)] ? String(b.quality) : '720';
    const to = ['dump', 'audio', 'none'].includes(String(b.to))
      ? String(b.to) : defaultTo(kind);
    if (!bucketOrNull()) return res.status(503).json({ error: 'Firebase Storage not configured' });

    const id = grabId(source, kind, quality);
    const existing = await loadDoc(id);

    if (existing && existing.status === 'done' && existing.url) {
      return res.json({ ok: true, id, already: true, item: existing });
    }
    if (existing && existing.job && existing.job.status === 'running'
      && Date.now() - new Date(existing.job.startedAt || 0).getTime() < 30 * 60 * 1000) {
      return res.json({ ok: true, id, running: true, item: existing });
    }

    await patchDoc(id, {
      source, kind, quality, to,
      name: String(b.name || '').slice(0, 200) || null,
      status: 'working', error: null, blocked: false,
      createdAt: existing ? existing.createdAt || Date.now() : Date.now(),
    });
    await startJob(id, 'grab', (progress) => runGrab(id, progress));
    res.json({ ok: true, id, item: await loadDoc(id) });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    // A bad url is the caller's mistake, not the server's.
    if (/url|http\(s\)|reachable/i.test(msg)) return res.status(400).json({ error: msg });
    fail(res, e);
  }
});

// GET /items — what has been grabbed. ONE equality filter at most, so no
// composite index is ever needed; the sort happens here.
router.get('/items', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    let q = db().collection(COL);
    if (req.query.status) q = q.where('status', '==', String(req.query.status));
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, count: items.length, items });
  } catch (e) { fail(res, e); }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, item: doc });
  } catch (e) { fail(res, e); }
});

router.get('/:id/job', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true, id: doc.id, status: doc.status, job: doc.job || null,
      url: doc.url || null, title: doc.title || null,
      blocked: Boolean(doc.blocked), error: doc.error || null,
    });
  } catch (e) { fail(res, e); }
});

// POST /:id/retry — the same grab again. Worth having as its own route: a
// bot-block and a dropped connection both leave a failed doc, and the second is
// usually fixed by simply asking again.
router.post('/:id/retry', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    await patchDoc(req.params.id, { status: 'working', error: null, blocked: false });
    await startJob(req.params.id, 'grab', (progress) => runGrab(req.params.id, progress));
    res.json({ ok: true, id: req.params.id, item: await loadDoc(req.params.id) });
  } catch (e) { fail(res, e); }
});

// DELETE /:id — forget the grab. The FILED copy is deliberately left alone: it
// lives in the Dump or the audio library now and is theirs to delete, and a
// grab record quietly taking a clip out of her Assembly would be the worst kind
// of surprise. Only a `to:"none"` copy, which nothing else owns, is removed.
router.delete('/:id', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    await db().collection(COL).doc(req.params.id).delete();
    if (doc.filedAs === 'none' && doc.storagePath) {
      const bucket = bucketOrNull();
      if (bucket) { try { await bucket.file(doc.storagePath).delete(); } catch { /* already gone */ } }
    }
    res.json({ ok: true, deleted: req.params.id });
  } catch (e) { fail(res, e); }
});

module.exports = {
  router, COL,
  // exported for scripts/test-ytdl.js — the pure decisions, no network
  checkSource, youtubeId, grabId, formatFor, cleanErr, isBlocked, ctFor, slug,
  defaultTo, pastTheBlock, clientArgs, CLIENTS, BLOCK_ROUNDS,
  // The two steps that talk to the outside world, exported so the live test can
  // drive the REAL argv rather than a copy of it that drifts. Nothing else
  // should call these — /grab is the way in.
  _internals: { ytdlp, readMeta, download, MAX_MB, MAX_SECONDS },
};

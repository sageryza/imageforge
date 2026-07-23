#!/usr/bin/env node
/**
 * nde-grab-all.js — THE one-session script. Run on your OWN computer, leave it
 * running (safe unattended; ~1-2 hours for the whole channel).
 *
 * What it does, fully automatic:
 *   1. DISCOVERS every "near death experience of …" interview on Anthony
 *      Chene's channel with yt-dlp (no API key, however many exist).
 *   2. For each video (skipping any the server already has):
 *        a. captions → POST to the server with extract:false  (transcript
 *           stored, NO paid moment call — free), and
 *        b. FULL-quality audio (exactly the best stream YouTube serves, no
 *           re-encoding) → uploaded STRAIGHT to Firebase Storage via a signed
 *           URL the server hands out (Render never touches the bytes).
 *   3. Prints a running tally; re-running any time is safe — done videos are
 *      skipped, so an interrupted run just resumes.
 *
 * After this, the computer is DONE: mining themes and cutting clips all happen
 * server-side from the banked audio.
 *
 * REQUIRES yt-dlp (brew install yt-dlp). Gentle on YouTube: only real-English
 * caption tracks, long pauses, 429 backoff.
 * RUN:  node "$(ls -t ~/Downloads/*grab-all*.js ~/Downloads/*graball*.js 2>/dev/null | head -1)"
 */
const https = require('https');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const SERVER = process.env.NDE_SERVER || 'https://imageforge-q125.onrender.com';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
// Source of truth = the channel's "all uploads" playlist (every YouTube
// channel has one: its list id is the channel id with UC swapped for UU).
// Unlike the channel /videos page — which yt-dlp only partially enumerates —
// the uploads playlist reliably lists EVERY upload. By request we grab the
// whole channel (interviews, podcasts, documentaries); the 10-minute duration
// floor keeps trailers/shorts out. Override with NDE_PLAYLIST_URL to target a
// specific playlist instead.
const CHANNEL = process.env.NDE_PLAYLIST_URL || 'https://www.youtube.com/playlist?list=UUF3j_4PND5orr6RK-sOFSDw';
const TITLE_RE = /./; // no title filter — whole channel by request
const MIN_SECONDS = 600; // skip trailers/shorts

function ytdlpPath() { for (const c of ['yt-dlp', '/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp']) { try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch {} } return null; }
const YTDLP = ytdlpPath();
if (!YTDLP) { console.error('yt-dlp not found — install: brew install yt-dlp'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── tiny https helpers ──
function reqJSON(method, url, obj) {
  const body = obj ? JSON.stringify(obj) : null;
  return new Promise((resolve, reject) => {
    const u = new URL(url.startsWith('http') ? url : SERVER + url);
    const headers = {};
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    if (STUDIO_TOKEN) headers['x-studio-token'] = STUDIO_TOKEN;
    const r = https.request(u, { method, headers }, res => {
      let d = ''; res.on('data', c => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, json: {} }); } });
    });
    r.on('error', reject); r.setTimeout(180000, () => r.destroy(new Error('timeout')));
    if (body) r.write(body); r.end();
  });
}
// stream a file to a signed PUT url (no Render in the path; handles big files)
function putFile(uploadUrl, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const u = new URL(uploadUrl);
    const size = fs.statSync(filePath).size;
    const r = https.request(u, { method: 'PUT', headers: { 'Content-Type': contentType, 'Content-Length': size } }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    r.on('error', reject);
    r.setTimeout(20 * 60 * 1000, () => r.destroy(new Error('upload timeout')));
    fs.createReadStream(filePath).pipe(r);
  });
}

// ── discovery ──
// The complete catalog — Sophie's full link list (July 2026, 60+ videos incl.
// every unlisted interview, documentary, and consciousness interview) unioned
// with everything previously tracked. Discovery still ADDS any new uploads.
const KNOWN = [
  {"id": "GA5eHmZ3_pM", "title": "The near death experience of Gabe Poirot"},
  {"id": "qVngBr-edKc", "title": "Podcast with Vinney Tolman: Beyond our sight (episode 2)"},
  {"id": "rXIvSsGOTqw", "title": "Stories of miracles - With Didier van Cauwelaert"},
  {"id": "lr7i0Lp1Ct8", "title": "The law of Oneness: podcast with Aaron Abke (Episode 1)"},
  {"id": "yXSnS2jMY4k", "title": "The near death experience of Jonathan Ashford"},
  {"id": "8eJQg9zfo1w", "title": "The near death experience of Ray Kinman"},
  {"id": "ysBQgv1gpYI", "title": "The nature of our soul"},
  {"id": "UYBGm_rDvso", "title": "Renaissance (Documentary)"},
  {"id": "0q39gcW71gQ", "title": "The near death experience of Pegi Robinson"},
  {"id": "gaKcOv6WZV4", "title": "Remembering who we are"},
  {"id": "VsWjCA_e3bY", "title": "The near death experience of John Paul Martinez"},
  {"id": "dVuw_44CUqU", "title": "Messages from the other side - With Pontea Dianati"},
  {"id": "zXB_F8EfDNA", "title": "The near death experience of Bruce Van Natta"},
  {"id": "DXQh28N7eis", "title": "The near death experience of Landon Dennis"},
  {"id": "_aHCQnpJWMo", "title": "The nature of reality - With Darius J. Wright"},
  {"id": "iWG_rLdW4Ng", "title": "The near-death experience of Tammy Lee Anderson"},
  {"id": "ALFrYW5mgZw", "title": "Merchants of Light"},
  {"id": "6GsWknK5r-8", "title": "The near-death experience of Dr. Mary Helen Hensley"},
  {"id": "p5DLmCf6WaE", "title": "The near-death experience of Rob Gentile"},
  {"id": "EluiAGiLy0s", "title": "Straight to Heaven : A Message from the Angels"},
  {"id": "j8mGcC2jq0Q", "title": "The near-death experience of Karen Thomas"},
  {"id": "5XrA79_T_R0", "title": "The near-death experience of Peter Anthony"},
  {"id": "7kDx-wkVzCM", "title": "The near-death experience of Malcolm Nair"},
  {"id": "eH3-WZWEMqY", "title": "The near-death experience of Deborah King"},
  {"id": "RCQkIutaqgs", "title": "The near-death experience of Penny Wittbrodt"},
  {"id": "eWgh8bRLCRk", "title": "Experiencing Miracles - With Carlos Vivas"},
  {"id": "xwAYFEkYJE4", "title": "The near-death experience of Graeme O'Connor"},
  {"id": "F-rp6bqfJWQ", "title": "The near-death experience of Nancy Rynes"},
  {"id": "d-vbckkoQs4", "title": "Here and Now"},
  {"id": "XUBmfoItQ7M", "title": "Experiencing the Angels"},
  {"id": "g-SpNv4Nwoc", "title": "A Journey to Oneness"},
  {"id": "B7vEdwuJBEg", "title": "The near-death experience of Scott Drummond"},
  {"id": "pRRJ3u6O2QI", "title": "The near-death experience of David Ditchfield"},
  {"id": "kLZdq7PcusM", "title": "Experiencing the Divine"},
  {"id": "VFkmI4PxnYA", "title": "Until we collapse"},
  {"id": "2GFT_89YMWE", "title": "The near-death experience of Tricia Barker"},
  {"id": "tlCiaVx5-Sk", "title": "Who am I?"},
  {"id": "bLQP3_F8nJQ", "title": "A Spiritual Renaissance"},
  {"id": "WTESmsletG4", "title": "The near-death experience of Jane Thompson"},
  {"id": "X1NuO9CLecw", "title": "The power of the mind"},
  {"id": "9Q9y0KyNxSA", "title": "The primacy of consciousness"},
  {"id": "UG2JXKUE9Vc", "title": "Discovering Spirit"},
  {"id": "ePBzS8hS36k", "title": "The near-death experience of Chris Batts"},
  {"id": "2AeOfYAJJ8o", "title": "Who we are (Documentary)"},
  {"id": "peE-A-VlUtw", "title": "The near-death experience of Chris Kito"},
  {"id": "lsMdNvl8Dmg", "title": "The wisdom of the universe"},
  {"id": "8i3U10E0H4k", "title": "The awakening - Interview with Rahelio"},
  {"id": "5Dh3OUBM9zA", "title": "In search for a meaning - Interview with Fredric Mindful"},
  {"id": "VMqd3m93vss", "title": "Just be yourself - Interview with Suresh Ramaswamy"},
  {"id": "1FD5lReqe64", "title": "The near-death experience of Jeff Olsen"},
  {"id": "4xrtyOqwr9E", "title": "The near-death experience of Bill McDonald"},
  {"id": "tZAs3jD7mVc", "title": "Discovering the emotion code"},
  {"id": "mX2n_kbvI9Q", "title": "Choosing our path"},
  {"id": "yByEQfaD314", "title": "The Nature of Consciousness"},
  {"id": "PgYO3VB6ubo", "title": "Enlightenment (Documentary)"},
  {"id": "YSa3El8VFOo", "title": "The near-death experience of Heidi Craig"},
  {"id": "_qIGyry7wLo", "title": "A revolution in Consciousness - Interview with Peter Russell"},
  {"id": "7qozGtHg1fM", "title": "Dare to dream - Interview with Marc Allen"},
  {"id": "7_mSPxColVI", "title": "Beyond Our Sight (Documentary)"},
  {"id": "0m5BQWiM--o", "title": "The near-death experience of Nadia McCaffrey"},
  {"id": "fvMVnAmbJEA", "title": "47 minutes dead: The near death experience of Vinney Tolman"}
];

function discoverOnce() {
  const out = execFileSync(YTDLP, ['--flat-playlist', '--print', '%(id)s\t%(duration)s\t%(title)s', CHANNEL],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  const vids = [];
  for (const line of out.split('\n')) {
    const [id, dur, ...rest] = line.split('\t');
    const title = rest.join('\t').trim();
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !title) continue;
    if (!TITLE_RE.test(title)) continue;
    const seconds = parseFloat(dur);
    if (Number.isFinite(seconds) && seconds < MIN_SECONDS) continue; // trailer/short
    vids.push({ id, title });
  }
  return vids;
}

async function discover() {
  console.log('Discovering the channel with yt-dlp (this takes ~30-60s)…');
  let found = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const v = discoverOnce();
      if (v.length > found.length) found = v;
      if (found.length > KNOWN.length) break; // got a full-looking listing
      console.log(`  attempt ${attempt}: channel listing returned ${v.length} — retrying (YouTube truncates automated listings)…`);
      await sleep(20000 * attempt);
    } catch (e) { console.log(`  attempt ${attempt} failed: ${String(e.message).slice(0, 120)}`); await sleep(20000 * attempt); }
  }
  // union: known interviews are guaranteed; discovery adds the rest
  const seen = new Set();
  const all = [...KNOWN, ...found].filter(v => !seen.has(v.id) && seen.add(v.id));
  const extra = all.length - KNOWN.length;
  console.log(`Video set: ${KNOWN.length} known interviews + ${extra} more discovered = ${all.length} total.`);
  if (extra === 0) console.log('(YouTube would not list the wider channel this run — the 29 interviews still bank fully; re-run later to add podcasts/documentaries.)');
  return all;
}

// ── captions ──
function parseJson3(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const segments = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (text) segments.push({ start: (ev.tStartMs || 0) / 1000, dur: (ev.dDurationMs || 0) / 1000, text });
  }
  return { segments, full: segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim() };
}
function ytdlpSubs(id, dir) {
  let stderr = '';
  try {
    execFileSync(YTDLP, ['--skip-download', '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en,en-US,en-GB,en-orig', '--sub-format', 'json3',
      '--sleep-requests', '5', '--retries', '3', '--extractor-retries', '3',
      '--extractor-args', 'youtube:player_client=android,web',
      '-o', path.join(dir, '%(id)s.%(ext)s'), '--no-warnings',
      `https://www.youtube.com/watch?v=${id}`], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { stderr = (e.stderr ? e.stderr.toString() : e.message).trim(); }
  const files = fs.readdirSync(dir).filter(f => f.startsWith(id) && f.endsWith('.json3'));
  if (!files.length) {
    const is429 = /429|too many requests/i.test(stderr);
    const err = new Error((stderr.split('\n').filter(l => /error|no subtitles|unavailable|429/i.test(l)).pop() || 'no English captions').replace(/^ERROR:\s*/, '').slice(0, 140));
    err.is429 = is429; throw err;
  }
  files.sort((a, b) => (a.includes('orig') ? 1 : 0) - (b.includes('orig') ? 1 : 0));
  const parsed = parseJson3(path.join(dir, files[0]));
  if (!parsed.segments.length) throw new Error('caption file empty');
  return { source: 'yt-dlp', language: 'en', segments: parsed.segments, full: parsed.full, fetchedAt: new Date().toISOString() };
}
async function retryOn429(fn, label) {
  for (let a = 1; a <= 4; a++) {
    try { return fn(); }
    catch (e) {
      if (e.is429 && a < 4) { const w = 60 * a; console.log(`      429 on ${label} — waiting ${w}s…`); await sleep(w * 1000); continue; }
      throw e;
    }
  }
}

// ── audio (full quality, untouched) ──
function ytdlpAudio(id, dir) {
  let stderr = '';
  try {
    execFileSync(YTDLP, ['-f', 'bestaudio', '--no-playlist', '--sleep-requests', '3', '--retries', '5',
      '-o', path.join(dir, id + '.%(ext)s'), '--no-warnings', `https://www.youtube.com/watch?v=${id}`],
      { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { stderr = (e.stderr ? e.stderr.toString() : e.message).trim(); }
  const f = fs.readdirSync(dir).find(x => x.startsWith(id + '.') && !x.endsWith('.json3') && !x.endsWith('.part'));
  if (!f) {
    const is429 = /429|too many requests/i.test(stderr);
    const err = new Error((stderr.split('\n').filter(Boolean).pop() || 'audio download failed').slice(0, 140));
    err.is429 = is429; throw err;
  }
  return path.join(dir, f);
}

(async () => {
  const videos = await discover();
  console.log(`Found ${videos.length} NDE interviews on the channel.\n`);
  if (!videos.length) { console.error('Nothing matched — tell the chat, the filter may need adjusting.'); process.exit(1); }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndeall-'));
  let tOk = 0, aOk = 0, skip = 0, fail = 0, gb = 0;
  for (let i = 0; i < videos.length; i++) {
    const { id, title } = videos[i];
    const tag = `[${i + 1}/${videos.length}] ${title.slice(0, 60)}`;

    // what does the server already have?
    let have = {};
    try { const r = await reqJSON('GET', `/api/nde/videos/${id}`); if (r.status === 200) have = r.json || {}; } catch {}
    const hasTranscript = !!(have.transcript && have.transcript.full) || !!have.transcriptChars;
    const hasAudio = !!have.audioUrl;
    if (hasTranscript && hasAudio) { skip++; console.log(`${tag} → already banked, skipping`); continue; }

    // 1) transcript (free — extract:false)
    if (!hasTranscript) {
      try {
        const transcript = await retryOn429(() => ytdlpSubs(id, dir), 'captions');
        const r = await reqJSON('POST', '/api/nde/videos', { videoIdOrUrl: id, title, transcript, extract: false, forceTranscript: true });
        if (r.json && (r.json.status === 'transcribed' || r.json.status === 'extracted')) { tOk++; console.log(`${tag}\n      transcript ✓ (free)`); }
        else { console.log(`${tag}\n      transcript: ${(r.json && r.json.error) || r.status}`); }
      } catch (e) { fail++; console.log(`${tag}\n      transcript FAILED: ${e.message}`); }
    } else { console.log(`${tag}\n      transcript already stored`); }

    // 2) full-quality audio → straight to Firebase via signed URL
    if (!hasAudio) {
      try {
        const apath = await retryOn429(() => ytdlpAudio(id, dir), 'audio');
        const ext = apath.split('.').pop().toLowerCase();
        const sig = await reqJSON('GET', `/api/nde/videos/${id}/audio-upload?ext=${ext}`);
        if (!sig.json || !sig.json.uploadUrl) throw new Error('no signed URL: ' + ((sig.json && sig.json.error) || sig.status));
        const code = await putFile(sig.json.uploadUrl, apath, sig.json.contentType);
        if (code !== 200) throw new Error('storage PUT HTTP ' + code);
        const done = await reqJSON('POST', `/api/nde/videos/${id}/audio-done`, { ext, title });
        if (done.json && done.json.ok) {
          const mb = fs.statSync(apath).size / 1e6; gb += mb / 1000; aOk++;
          console.log(`      audio ${mb.toFixed(0)}MB → Firebase ✓`);
        } else throw new Error((done.json && done.json.error) || 'audio-done failed');
        try { fs.unlinkSync(apath); } catch {}
      } catch (e) { fail++; console.log(`      audio FAILED: ${e.message}`); }
    } else { console.log(`      audio already banked`); }

    await sleep(8000); // polite pause between videos
  }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  console.log(`\nDone. transcripts stored: ${tOk} · audios banked: ${aOk} (${gb.toFixed(2)}GB) · skipped (already done): ${skip} · failures: ${fail}`);
  if (fail) console.log('Re-run the SAME command any time — it resumes where it left off and only retries the failures.');
  else console.log('Everything is banked. The computer is done — the chat takes it from here. Enjoy the trip ✦');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });

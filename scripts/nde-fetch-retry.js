#!/usr/bin/env node
/**
 * nde-fetch-retry.js — fetch the remaining Anthony Chene NDE-interview
 * transcripts (completes the 29-video playlist) and POST each to the live
 * server, which extracts the moments and stores them. Run on your OWN computer.
 *
 * v3: gentle on YouTube to avoid 429 rate-limiting —
 *   - requests ONLY real English tracks (no auto-translated variants),
 *   - long pauses between requests and videos,
 *   - on a 429, waits and retries that video (up to 3×),
 *   - SKIPS videos already stored on the server (so re-runs don't re-hammer).
 * REQUIRES yt-dlp (`brew install yt-dlp`). No keys. Safe to leave running
 * (the full set takes ~15-25 min because of the polite pauses).
 * RUN:  node "$(ls -t ~/Downloads/*retry*.js | head -1)"
 */
const https = require('https');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const SERVER = process.env.NDE_SERVER || 'https://imageforge-q125.onrender.com';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const VIDEOS = [{"id": "eH3-WZWEMqY", "title": "The near death experience of Deborah King"}, {"id": "6GsWknK5r-8", "title": "The near death experience of Dr. Mary Helen Hensley"}, {"id": "RCQkIutaqgs", "title": "The near death experience of Penny Wittbrodt"}, {"id": "1FD5lReqe64", "title": "The near-death experience of Jeff Olsen"}, {"id": "F-rp6bqfJWQ", "title": "The near death experience of Nancy Rynes"}, {"id": "iWG_rLdW4Ng", "title": "The near death experience of Tammy Lee Anderson"}, {"id": "WTESmsletG4", "title": "The near-death experience of Jane Thompson"}, {"id": "B7vEdwuJBEg", "title": "The near death experience of Scott Drummond"}, {"id": "5XrA79_T_R0", "title": "The near-death experience of Peter Anthony"}, {"id": "j8mGcC2jq0Q", "title": "The near death experience of Karen Thomas"}, {"id": "pRRJ3u6O2QI", "title": "The near death experience of David Ditchfield"}, {"id": "2GFT_89YMWE", "title": "The near-death experience of Tricia Barker"}, {"id": "ePBzS8hS36k", "title": "The near-death experience of Chris Batts"}, {"id": "p5DLmCf6WaE", "title": "The near death experience of Rob Gentile"}, {"id": "7kDx-wkVzCM", "title": "The near death experience of Malcolm Nair"}, {"id": "VsWjCA_e3bY", "title": "The near death experience of John Paul Martinez"}, {"id": "yXSnS2jMY4k", "title": "The near death experience of Jonathan Ashford"}, {"id": "GA5eHmZ3_pM", "title": "The near death experience of Gabe Poirot"}];

function ytdlpPath() {
  for (const c of ['yt-dlp', '/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp']) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch {}
  }
  return null;
}
const YTDLP = ytdlpPath();
if (!YTDLP) { console.error('yt-dlp not found — install with: brew install yt-dlp'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function req(method, p, obj) {
  const body = obj ? JSON.stringify(obj) : null;
  return new Promise((resolve, reject) => {
    const u = new URL(SERVER + p);
    const headers = {};
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    if (STUDIO_TOKEN) headers['x-studio-token'] = STUDIO_TOKEN;
    const r = https.request(u, { method, headers }, res => {
      let d = ''; res.on('data', c => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, json: {} }); } });
    });
    r.on('error', reject);
    r.setTimeout(120000, () => r.destroy(new Error('timeout')));
    if (body) r.write(body); r.end();
  });
}
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
    execFileSync(YTDLP, [
      '--skip-download', '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en,en-US,en-GB,en-orig',   // real English only, no translated tracks
      '--sub-format', 'json3',
      '--sleep-requests', '5', '--retries', '3', '--extractor-retries', '3',
      '--extractor-args', 'youtube:player_client=android,web',
      '-o', path.join(dir, '%(id)s.%(ext)s'), '--no-warnings',
      `https://www.youtube.com/watch?v=${id}`,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { stderr = (e.stderr ? e.stderr.toString() : e.message).trim(); }
  const files = fs.readdirSync(dir).filter(f => f.startsWith(id) && f.endsWith('.json3'));
  if (!files.length) {
    const is429 = /429|too many requests/i.test(stderr);
    const reason = stderr.split('\n').filter(l => /error|no subtitles|unavailable|sign in|429|throttl/i.test(l)).pop() || 'no English captions';
    const err = new Error(reason.replace(/^ERROR:\s*/, '').slice(0, 140));
    err.is429 = is429;
    throw err;
  }
  files.sort((a, b) => (a.includes('orig') ? 1 : 0) - (b.includes('orig') ? 1 : 0));
  const parsed = parseJson3(path.join(dir, files[0]));
  if (!parsed.segments.length) throw new Error('caption file empty');
  return { source: 'yt-dlp', language: 'en', segments: parsed.segments, full: parsed.full, fetchedAt: new Date().toISOString() };
}
// fetch one video's captions, retrying on 429 with a long backoff
async function fetchOne(id, dir) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return ytdlpSubs(id, dir); }
    catch (e) {
      if (e.is429 && attempt < 3) { const wait = 45 * attempt; console.log(`      429 — waiting ${wait}s then retrying…`); await sleep(wait * 1000); continue; }
      throw e;
    }
  }
}
(async () => {
  console.log(`Fetching up to ${VIDEOS.length} transcripts → ${SERVER}  (gentle mode; ~15-25 min)\n`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nde-'));
  let ok = 0, fail = 0, skip = 0, moments = 0;
  for (let i = 0; i < VIDEOS.length; i++) {
    const { id, title } = VIDEOS[i];
    const tag = `[${i + 1}/${VIDEOS.length}] ${title}`;
    // skip if the server already has it extracted (so re-runs don't re-hammer YouTube)
    try {
      const existing = await req('GET', '/api/nde/videos/' + id);
      if (existing.status === 200 && existing.json && existing.json.status === 'extracted') {
        skip++; console.log(`${tag} → already done, skipping`); continue;
      }
    } catch {}
    try {
      const transcript = await fetchOne(id, dir);
      const r = await req('POST', '/api/nde/videos', { videoIdOrUrl: id, title, transcript, forceTranscript: true, forceExtract: true });
      const rec = r.json || {};
      if (rec.status === 'extracted') { ok++; moments += (rec.moments || []).length; console.log(`${tag} → ${(rec.moments || []).length} moments ✓`); }
      else { fail++; console.log(`${tag} → ${rec.status || r.status}: ${rec.error || '?'}`); }
    } catch (e) { fail++; console.log(`${tag} → ${e.message}`); }
    await sleep(8000); // polite pause between videos
  }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  console.log(`\nDone. ${ok} newly extracted, ${skip} already done, ${fail} failed, ${moments} new moments.`);
  if (fail) console.log('Tip: re-run the same command later — it skips the ones that already made it in and retries only the failures.');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });

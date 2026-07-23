#!/usr/bin/env node
/**
 * nde-fetch-plus.js — for the remaining Anthony Chene interviews, do the FREE
 * transcript step AND bank the audio in the cloud. Run on your OWN computer.
 *
 * Per video:
 *   1. yt-dlp downloads the English captions  → POST to the server with
 *      extract:false  (stores the transcript, NO gpt-4o-mini moment call = $0).
 *   2. yt-dlp downloads the audio (once)      → POST the bytes to the server,
 *      which stores it in Firebase Storage and records the URL. Then all clip
 *      slicing can happen server-side, free, without this computer.
 *
 * Gentle on YouTube (429 backoff, skips videos already done). No API keys.
 * REQUIRES yt-dlp (`brew install yt-dlp`).
 * RUN:  node "$(ls -t ~/Downloads/*fetch-plus*.js ~/Downloads/*fetchplus*.js 2>/dev/null | head -1)"
 */
const https = require('https');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const SERVER = process.env.NDE_SERVER || 'https://imageforge-q125.onrender.com';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const VIDEOS = [{"id": "eH3-WZWEMqY", "title": "The near death experience of Deborah King"}, {"id": "6GsWknK5r-8", "title": "The near death experience of Dr. Mary Helen Hensley"}, {"id": "RCQkIutaqgs", "title": "The near death experience of Penny Wittbrodt"}, {"id": "1FD5lReqe64", "title": "The near-death experience of Jeff Olsen"}, {"id": "F-rp6bqfJWQ", "title": "The near death experience of Nancy Rynes"}, {"id": "iWG_rLdW4Ng", "title": "The near death experience of Tammy Lee Anderson"}, {"id": "WTESmsletG4", "title": "The near-death experience of Jane Thompson"}, {"id": "B7vEdwuJBEg", "title": "The near death experience of Scott Drummond"}, {"id": "5XrA79_T_R0", "title": "The near-death experience of Peter Anthony"}, {"id": "j8mGcC2jq0Q", "title": "The near death experience of Karen Thomas"}, {"id": "pRRJ3u6O2QI", "title": "The near death experience of David Ditchfield"}, {"id": "2GFT_89YMWE", "title": "The near-death experience of Tricia Barker"}, {"id": "ePBzS8hS36k", "title": "The near-death experience of Chris Batts"}, {"id": "p5DLmCf6WaE", "title": "The near death experience of Rob Gentile"}, {"id": "7kDx-wkVzCM", "title": "The near death experience of Malcolm Nair"}, {"id": "VsWjCA_e3bY", "title": "The near death experience of John Paul Martinez"}, {"id": "yXSnS2jMY4k", "title": "The near death experience of Jonathan Ashford"}, {"id": "GA5eHmZ3_pM", "title": "The near death experience of Gabe Poirot"}];

function ytdlpPath() { for (const c of ['yt-dlp','/opt/homebrew/bin/yt-dlp','/usr/local/bin/yt-dlp']) { try { execFileSync(c,['--version'],{stdio:'ignore'}); return c; } catch {} } return null; }
const YTDLP = ytdlpPath();
if (!YTDLP) { console.error('yt-dlp not found — install: brew install yt-dlp'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function reqJSON(method, p, obj) {
  const body = obj ? JSON.stringify(obj) : null;
  return new Promise((resolve, reject) => {
    const u = new URL(SERVER + p);
    const headers = {};
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    if (STUDIO_TOKEN) headers['x-studio-token'] = STUDIO_TOKEN;
    const r = https.request(u, { method, headers }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve({status:res.statusCode,json:JSON.parse(d)});}catch{resolve({status:res.statusCode,json:{}});} }); });
    r.on('error', reject); r.setTimeout(120000, () => r.destroy(new Error('timeout')));
    if (body) r.write(body); r.end();
  });
}
function putBytes(p, buf, contentType) {
  return new Promise((resolve, reject) => {
    const u = new URL(SERVER + p);
    const headers = { 'Content-Type': contentType, 'Content-Length': buf.length };
    if (STUDIO_TOKEN) headers['x-studio-token'] = STUDIO_TOKEN;
    const r = https.request(u, { method: 'POST', headers }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve({status:res.statusCode,json:JSON.parse(d)});}catch{resolve({status:res.statusCode,json:{}});} }); });
    r.on('error', reject); r.setTimeout(300000, () => r.destroy(new Error('upload timeout')));
    r.write(buf); r.end();
  });
}
function parseJson3(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const segments = [];
  for (const ev of data.events || []) { if (!ev.segs) continue; const text = ev.segs.map(s=>s.utf8||'').join('').replace(/\s+/g,' ').trim(); if (text) segments.push({ start:(ev.tStartMs||0)/1000, dur:(ev.dDurationMs||0)/1000, text }); }
  return { segments, full: segments.map(s=>s.text).join(' ').replace(/\s+/g,' ').trim() };
}
function ytdlpSubs(id, dir) {
  let stderr = '';
  try {
    execFileSync(YTDLP, ['--skip-download','--write-subs','--write-auto-subs','--sub-langs','en,en-US,en-GB,en-orig','--sub-format','json3','--sleep-requests','5','--retries','3','--extractor-retries','3','--extractor-args','youtube:player_client=android,web','-o',path.join(dir,'%(id)s.%(ext)s'),'--no-warnings',`https://www.youtube.com/watch?v=${id}`], { stdio:['ignore','ignore','pipe'] });
  } catch (e) { stderr = (e.stderr ? e.stderr.toString() : e.message).trim(); }
  const files = fs.readdirSync(dir).filter(f => f.startsWith(id) && f.endsWith('.json3'));
  if (!files.length) { const is429 = /429|too many requests/i.test(stderr); const err = new Error((stderr.split('\n').filter(l=>/error|no subtitles|unavailable|429/i.test(l)).pop()||'no English captions').replace(/^ERROR:\s*/,'').slice(0,140)); err.is429 = is429; throw err; }
  files.sort((a,b)=>(a.includes('orig')?1:0)-(b.includes('orig')?1:0));
  const parsed = parseJson3(path.join(dir, files[0]));
  if (!parsed.segments.length) throw new Error('caption file empty');
  return { source:'yt-dlp', language:'en', segments:parsed.segments, full:parsed.full, fetchedAt:new Date().toISOString() };
}
async function subsWithRetry(id, dir) {
  for (let a=1;a<=3;a++){ try { return ytdlpSubs(id,dir); } catch(e){ if (e.is429 && a<3){ const w=45*a; console.log(`      429 — waiting ${w}s…`); await sleep(w*1000); continue; } throw e; } }
}
function ytdlpAudio(id, dir) {
  try { execFileSync(YTDLP, ['-f','bestaudio','--no-playlist','--sleep-requests','3','-o',path.join(dir,id+'.%(ext)s'),`https://www.youtube.com/watch?v=${id}`], { stdio:['ignore','ignore','pipe'] }); }
  catch (e) { throw new Error('audio: ' + (e.stderr?e.stderr.toString().split('\n').filter(Boolean).pop():e.message)); }
  const f = fs.readdirSync(dir).find(x => x.startsWith(id+'.') && !x.endsWith('.json3'));
  if (!f) throw new Error('audio file not found after download');
  return path.join(dir, f);
}
(async () => {
  console.log(`${VIDEOS.length} videos → transcripts (free, no moments) + audio to Firebase → ${SERVER}\n`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndep-'));
  let tOk=0, aOk=0, fail=0, mb=0;
  for (let i=0;i<VIDEOS.length;i++){
    const { id, title } = VIDEOS[i];
    const tag = `[${i+1}/${VIDEOS.length}] ${title}`;
    // transcript (free)
    try {
      const transcript = await subsWithRetry(id, dir);
      const r = await reqJSON('POST','/api/nde/videos',{ videoIdOrUrl:id, title, transcript, extract:false, forceTranscript:true });
      if (r.json && r.json.status === 'transcribed') { tOk++; console.log(`${tag} → transcript stored ✓ (free)`); }
      else { console.log(`${tag} → transcript: ${r.json && r.json.error || r.status}`); }
    } catch (e) { fail++; console.log(`${tag} → transcript FAILED: ${e.message}`); await sleep(6000); continue; }
    // audio → Firebase
    try {
      const apath = ytdlpAudio(id, dir);
      const ext = apath.split('.').pop();
      const buf = fs.readFileSync(apath);
      const up = await putBytes(`/api/nde/videos/${id}/audio?ext=${ext}`, buf, ext==='webm'?'audio/webm':'audio/mp4');
      if (up.json && up.json.ok) { aOk++; mb += buf.length/1e6; console.log(`        audio ${(buf.length/1e6).toFixed(1)}MB → Firebase ✓`); }
      else console.log(`        audio upload: ${up.json && up.json.error || up.status}`);
      try { fs.unlinkSync(apath); } catch {}
    } catch (e) { console.log(`        audio FAILED: ${e.message}`); }
    await sleep(6000);
  }
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch {}
  console.log(`\nDone. ${tOk} transcripts stored, ${aOk} audios uploaded (${mb.toFixed(0)}MB), ${fail} failed.`);
})().catch(e => { console.error(e.stack||e.message); process.exit(1); });

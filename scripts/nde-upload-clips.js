#!/usr/bin/env node
/**
 * nde-upload-clips.js — bank the already-cut clips (the ~258 the local puller
 * wrote to ./clips/<theme>/) into Firebase, as a safety copy so they live in
 * the cloud alongside everything else. Run on the computer that HAS the clips
 * (the MacBook where you ran the puller).
 *
 * No keys, no ffmpeg — just walks ./clips and uploads each audio file through
 * the server. Re-running skips nothing (it re-uploads, overwriting) but is
 * harmless; small files.
 *
 * RUN (from the folder that contains `clips/`, e.g. your home dir):
 *   node "$(ls -t ~/Downloads/*upload-clips*.js ~/Downloads/*uploadclips*.js 2>/dev/null | head -1)"
 * or point it explicitly:  CLIPS_DIR=~/clips node …
 */
const https = require('https');
const fs = require('fs'), path = require('path');

const SERVER = process.env.NDE_SERVER || 'https://imageforge-q125.onrender.com';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const CLIPS_DIR = process.env.CLIPS_DIR
  ? process.env.CLIPS_DIR.replace(/^~/, process.env.HOME)
  : (fs.existsSync(path.join(process.cwd(), 'clips')) ? path.join(process.cwd(), 'clips')
    : path.join(process.env.HOME || '.', 'clips'));

if (!fs.existsSync(CLIPS_DIR)) {
  console.error(`No clips folder found at ${CLIPS_DIR}.`);
  console.error('Run this from the folder that contains "clips/", or set CLIPS_DIR=/path/to/clips.');
  process.exit(1);
}

// gather clips/<theme>/<file> (one level of theme folders; also top-level files)
function gather(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue; // skip _audio_cache etc.
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const f of fs.readdirSync(full)) {
        if (/\.(mp3|m4a|wav)$/i.test(f)) out.push({ rel: `${entry.name}/${f}`, full: path.join(full, f) });
      }
    } else if (/\.(mp3|m4a|wav)$/i.test(entry.name)) {
      out.push({ rel: entry.name, full });
    }
  }
  return out;
}

function upload(rel, filePath) {
  const buf = fs.readFileSync(filePath);
  return new Promise((resolve, reject) => {
    const u = new URL(`${SERVER}/api/nde/clip?path=${encodeURIComponent(rel)}`);
    const headers = { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length };
    if (STUDIO_TOKEN) headers['x-studio-token'] = STUDIO_TOKEN;
    const r = https.request(u, { method: 'POST', headers }, res => {
      let d = ''; res.on('data', c => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, json: {} }); } });
    });
    r.on('error', reject); r.setTimeout(120000, () => r.destroy(new Error('timeout')));
    r.write(buf); r.end();
  });
}

(async () => {
  const clips = gather(CLIPS_DIR);
  console.log(`Uploading ${clips.length} clips from ${CLIPS_DIR} → ${SERVER}\n`);
  let ok = 0, fail = 0, mb = 0;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    try {
      const r = await upload(c.rel, c.full);
      if (r.json && r.json.ok) { ok++; mb += (r.json.bytes || 0) / 1e6; if (i % 20 === 0 || i === clips.length - 1) console.log(`  [${i + 1}/${clips.length}] ${c.rel} ✓`); }
      else { fail++; console.log(`  [${i + 1}/${clips.length}] ${c.rel} → ${(r.json && r.json.error) || r.status}`); }
    } catch (e) { fail++; console.log(`  [${i + 1}/${clips.length}] ${c.rel} FAILED: ${e.message}`); }
  }
  console.log(`\nDone. ${ok} clips banked (${mb.toFixed(0)}MB), ${fail} failed.`);
  console.log(`They live at Firebase nde-clips/original/ — list with ${SERVER}/api/nde/clips`);
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });

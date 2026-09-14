#!/usr/bin/env node
// transcribe-media.js — whisper over anything in the Dump (or any url), CACHED
// (2026-09-14, Sophie: "transcribe w whisper, cache it").
//
// She shoots takes on her phone, dumps them, and then wants to know what she
// SAID in each one without opening every clip. Transcription is ~$0.006 a
// minute and a take gets re-read many times — by her, by the Story Room's
// take-alignment, by whatever cuts the film — so the rule this is built around
// is the house one: PAID OR SLOW WORK IS BANKED THE MOMENT IT EXISTS AND KEYED
// BY WHAT MADE IT. Asking for the same url twice costs nothing.
//
//   transcripts/<sha1(url)>.json   { url, model, text, words, segments,
//                                    seconds, at, silent? }
//
// The key is sha1 of the SOURCE URL, and the Dump is content-addressed
// (drops/_/<md5>.<ext>), so the same bytes dumped into two albums are one
// cache entry by construction — nothing here has to dedupe.
//
// TWO MIRRORS, both deliberate:
//   · `scratchpad/take-words/<sha1(url)>.json` — the Story Room's OWN take
//     cache (scratchpad.js `takeWords`), same key, same word shape. So a
//     story whose voiceover IS this take renders with no transcription at
//     all. Writing it here is free; not writing it means paying twice.
//   · `transcript` + `transcriptAt` on the file's `forge-drops` doc, capped,
//     so the Dump can SHOW what a clip says without fetching the cache. The
//     words stay in Storage — a long take is thousands of them and the doc
//     rides a list read.
//
// NOTHING IS DESTROYED and nothing is re-encoded: her file is downloaded, a
// throwaway 16k mono mp3 is handed to whisper, and the original is untouched
// (the house "a derived copy, never the source" rule).
//
// A file with NO audio track is cached as `silent` rather than left to be
// retried forever — silence is the answer, not a failure.
//
// Usage:
//   node scripts/transcribe-media.js <url|dropId> [...]
//   node scripts/transcribe-media.js --session 2026-09-09-1846 --bundle footage
//   node scripts/transcribe-media.js --session … --dry      # what it would do
//   node scripts/transcribe-media.js <url> --force          # re-transcribe
//   ... --json      # machine-readable
//
// Needs FIREBASE_SERVICE_ACCOUNT (deckfactory) and OPENAI_API_KEY.

'use strict';

const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DROPS = 'forge-drops';
const CACHE = 'transcripts';
const TAKE_WORDS = 'scratchpad/take-words';
const MODEL = 'whisper-1';
const CENTS_PER_MIN = 0.6;
// What whisper can be pointed at. Everything else in a bundle (the stills) is
// skipped silently — a dump is mostly pictures.
const MEDIA_RE = /\.(mov|mp4|m4v|webm|avi|mkv|mp3|m4a|wav|aac|flac|ogg|caf|aiff?)(\?|$)/i;

let FFMPEG = null;
try { FFMPEG = require('ffmpeg-static'); } catch { /* named below */ }

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const DRY = flag('dry');
const FORCE = flag('force');
const JSON_OUT = flag('json');

const keyOf = (url) => crypto.createHash('sha1').update(String(url)).digest('hex');

function run(bin, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)}: ${(stderr || err.message).slice(-300)}`));
      else resolve({ stdout, stderr });
    });
  });
}

async function download(url, to) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status} for ${url}`);
  fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
  return to;
}

// whisper-1 with word timestamps. verbose_json because the segments carry
// start times and gpt-4o-mini-transcribe returns none (chatfeed.js's own note).
async function whisper(file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'take.mp3');
  form.append('model', MODEL);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'transcription failed');
  return d;
}

/** Every target, in order, deduped by url — an explicit url, a drop doc id,
 *  or every media file in a dump session/bundle. */
async function targets(db) {
  const out = [];
  const seen = new Set();
  const add = (t) => { if (t.url && !seen.has(t.url)) { seen.add(t.url); out.push(t); } };

  const session = opt('session');
  const bundle = opt('bundle');
  if (session || bundle) {
    let q = db.collection(DROPS);
    if (session) q = q.where('session', '==', session);
    if (bundle) q = q.where('bundle', '==', bundle);
    const snap = await q.get();
    const docs = snap.docs.slice().sort((a, b) => (a.data().photoIndex || 0) - (b.data().photoIndex || 0));
    for (const d of docs) {
      const v = d.data();
      if (v.media === 'image' && !MEDIA_RE.test(String(v.url || ''))) continue;
      if (!MEDIA_RE.test(String(v.url || ''))) continue;
      add({ url: v.url, id: d.id, name: v.name || v.filename || null });
    }
  }
  for (const a of argv) {
    if (a.startsWith('--')) continue;
    if (argv[argv.indexOf(a) - 1] && argv[argv.indexOf(a) - 1].startsWith('--')) continue; // a flag's value
    if (/^https?:\/\//.test(a)) { add({ url: a, id: null, name: null }); continue; }
    const d = await db.collection(DROPS).doc(a).get();
    if (!d.exists) { console.error(`  · ${a}: no such drop`); continue; }
    const v = d.data();
    add({ url: v.url, id: d.id, name: v.name || v.filename || null });
  }
  return out;
}

async function cached(bucket, url) {
  const f = bucket.file(`${CACHE}/${keyOf(url)}.json`);
  try {
    if (!(await f.exists())[0]) return null;
    const [buf] = await f.download();
    const v = JSON.parse(buf.toString('utf8'));
    return v && typeof v.text === 'string' ? v : null;
  } catch { return null; }
}

async function transcribe(bucket, db, t) {
  const key = keyOf(t.url);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-'));
  try {
    const raw = await download(t.url, path.join(dir, 'src'));
    const mp3 = path.join(dir, 'a.mp3');
    let silent = false;
    try {
      await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw,
        '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
    } catch (e) {
      // no audio stream at all — that IS the answer, so bank it
      if (/Output file .* does not contain any stream|Output file is empty/i.test(e.message)) silent = true;
      else throw e;
    }
    if (!silent && (!fs.existsSync(mp3) || fs.statSync(mp3).size < 1024)) silent = true;

    const rec = { url: t.url, model: MODEL, at: new Date().toISOString(), text: '', words: [], segments: [], seconds: 0 };
    if (silent) {
      rec.silent = true;
    } else {
      const d = await whisper(mp3);
      rec.text = String(d.text || '').trim();
      rec.seconds = Number(d.duration) || 0;
      rec.words = (d.words || []).map((w) => ({ word: String(w.word || '').trim(), start: Number(w.start) || 0, end: Number(w.end) || 0 }));
      rec.segments = (d.segments || []).map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim() }));
    }
    if (t.name) rec.name = t.name;

    await bucket.file(`${CACHE}/${key}.json`)
      .save(JSON.stringify(rec), { contentType: 'application/json', resumable: false });
    // The Story Room's own take cache, same key, free hit later.
    if (rec.words.length) {
      try {
        await bucket.file(`${TAKE_WORDS}/${key}.json`)
          .save(JSON.stringify(rec.words), { contentType: 'application/json', resumable: false });
      } catch (e) { console.warn(`  (take-words mirror: ${e.message})`); }
    }
    // The readable half, on the file's own doc.
    if (t.id) {
      try {
        await db.collection(DROPS).doc(t.id).set({
          transcript: rec.text.slice(0, 4000),
          transcriptAt: Date.now(),
        }, { merge: true });
      } catch (e) { console.warn(`  (drop doc: ${e.message})`); }
    }
    return rec;
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ } }
}

(async () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  if (!FFMPEG) throw new Error('ffmpeg-static not installed (npm install)');
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(svc),
      storageBucket: `${svc.project_id}.firebasestorage.app`,
    });
  }
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const list = await targets(db);
  if (!list.length) {
    console.error('nothing to transcribe — pass a url, a drop id, or --session/--bundle');
    process.exit(1);
  }

  const out = [];
  let spentSec = 0;
  for (const t of list) {
    const label = t.name || t.url.split('/').pop();
    const hit = FORCE ? null : await cached(bucket, t.url);
    if (hit) {
      out.push({ ...hit, cached: true });
      if (!JSON_OUT) console.log(`✓ cached  ${label}\n   ${hit.silent ? '(no audio)' : JSON.stringify(hit.text)}`);
      continue;
    }
    if (DRY) {
      out.push({ url: t.url, name: t.name, would: true });
      if (!JSON_OUT) console.log(`→ would transcribe  ${label}`);
      continue;
    }
    try {
      const rec = await transcribe(bucket, db, t);
      spentSec += rec.seconds;
      out.push({ ...rec, cached: false });
      if (!JSON_OUT) console.log(`✓ ${rec.silent ? 'no audio' : `${rec.seconds.toFixed(1)}s`}  ${label}\n   ${rec.silent ? '(no audio)' : JSON.stringify(rec.text)}`);
    } catch (e) {
      out.push({ url: t.url, name: t.name, error: e.message });
      if (!JSON_OUT) console.log(`✗ ${label}: ${e.message}`);
    }
  }
  if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
  else if (spentSec) console.log(`\nspent about ${(spentSec / 60 * CENTS_PER_MIN).toFixed(2)}¢ (${spentSec.toFixed(0)}s of audio)`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });

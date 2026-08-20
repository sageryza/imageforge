#!/usr/bin/env node
// Fill the archive's wordless recordings by transcribing their audio on THIS
// Mac — no API key, no per-minute cost, no size cap.
//
// Why this exists: the plan was to import Apple's own Voice Memos transcripts
// (scripts/import-apple-transcripts.mjs), but those are made per-device, on
// demand, and never leave the phone — the Mac's CloudRecordings.db has no
// transcript column at all (checked 2026-08-18, macOS 26.1). The audio IS
// here, though, all of it, so the Mac transcribes it itself.
//
// The server's Whisper had a 45-minute ceiling and a 24MB cap, which is why
// these records are empty in the first place. whisper.cpp has neither: it
// streams a file of any length in 30-second windows, so the 5.9-hour recording
// goes through the same code path as a 6-minute one. Nothing is chunked.
//
// Setup (one time):
//   brew install whisper-cpp
//   curl -fL https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin \
//     -o ~/Library/Application\ Support/ImageForge/whisper-models/ggml-large-v3-turbo.bin
//
// Usage:
//   node scripts/transcribe-local.mjs --dry-run     # what it would do, sends nothing
//   node scripts/transcribe-local.mjs --limit 1     # prove it on one recording
//   node scripts/transcribe-local.mjs               # the whole backlog
//
// Safe to stop and re-run: it re-reads /untranscribed every run, so anything
// already filled is simply not in the list. The server refuses to overwrite a
// record that has words (POST /api/memos/transcript is fill-only), so a repeat
// is a no-op rather than a rewrite.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const has  = n => argv.includes('--' + n);
const val  = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };

const BASE  = String(val('base', process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');
const DRY   = has('dry-run');
const LIMIT = Number(val('limit', 0)) || 0;
const MODEL = val('model', path.join(os.homedir(), 'Library/Application Support/ImageForge/whisper-models/ggml-large-v3-turbo.bin'));
const VAD   = val('vad', path.join(os.homedir(), 'Library/Application Support/ImageForge/whisper-models/ggml-silero-v5.1.2.bin'));
const THREADS = String(val('threads', '8'));
const MIN_SECONDS = 5; // under this there is nothing anyone could transcribe
const CACHE = path.join(os.homedir(), 'Library/Application Support/ImageForge/transcripts');

const DB = path.join(os.homedir(), 'Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/CloudRecordings.db');
const p2 = n => String(n).padStart(2, '0');
const stampOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
const hhmm = s => `${Math.floor(s / 3600)}h${p2(Math.floor(s % 3600 / 60))}`;

// Same snapshot-then-read as push-memos.mjs: never hold a lock on the live
// database while Voice Memos might be writing to it.
function readVoiceMemos() {
  if (!fs.existsSync(DB)) {
    console.error(`\n❌ No Voice Memos database at:\n   ${DB}\n   Open the Voice Memos app once, then run this again.\n`);
    process.exit(1);
  }
  const snap = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-tx-'));
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.copyFileSync(DB + ext, path.join(snap, 'db' + ext)); } catch {}
  }
  const sql = "SELECT COALESCE(ZDATE,''),COALESCE(ZPATH,''),COALESCE(ZCUSTOMLABEL,''),COALESCE(ZDURATION,0) FROM ZCLOUDRECORDING ORDER BY ZDATE;";
  let rows;
  try {
    rows = execFileSync('sqlite3', ['-separator', '\x1f', path.join(snap, 'db'), sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    // A zero-byte snapshot with a real database behind it means the copy was
    // allowed but the READ was not — Full Disk Access, not a missing file.
    console.error('\n❌ Could not read the Voice Memos database: ' + err.message);
    console.error('   If this is a scheduled/background run, give the node binary Full Disk Access.\n');
    process.exit(1);
  } finally { fs.rmSync(snap, { recursive: true, force: true }); }

  const recDir = path.dirname(DB);
  return rows.split('\n').filter(Boolean).map(line => {
    const [zdate, zpath, label, dur] = line.split('\x1f');
    const when = zdate ? new Date((Number(zdate) + 978307200) * 1000) : null;
    const src = zpath ? path.join(recDir, zpath) : null;
    return { when, title: label || 'Recording', dur: Math.round(Number(dur) || 0), src,
             downloaded: !!(src && fs.existsSync(src)) };
  }).filter(r => r.when);
}

function probeDuration(file, fallback) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim();
    return Math.round(Number(out) || fallback);
  } catch { return fallback; }
}

// whisper.cpp wants 16 kHz mono PCM; Voice Memos hands us .m4a.
function transcribe(src, work) {
  const wav = path.join(work, 'a.wav');
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', src,
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { stdio: ['ignore', 'ignore', 'pipe'] });
  const prefix = path.join(work, 'out');
  // --vad is the anti-hallucination measure that matters: Whisper invents
  // speech over silence ("Thank you.", "*crickets*") and these recordings are
  // mostly quiet. VAD hands it only the stretches that contain a voice, so
  // there is no silence for it to fill in. -sns drops non-speech tokens.
  const vad = fs.existsSync(VAD) ? ['--vad', '-vm', VAD] : [];
  execFileSync('whisper-cli', ['-m', MODEL, '-f', wav, '-t', THREADS,
    '-l', 'en', '-nt', '-sns', ...vad, '-otxt', '-of', prefix], { stdio: ['ignore', 'ignore', 'pipe'] });
  const txt = prefix + '.txt';
  return fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8').trim() : '';
}

// Whisper's silence hallucinations, normalised. Filling a record is permanent
// — POST /transcript refuses to overwrite — so a wrong fill is worse than no
// fill: the recording stops appearing in /untranscribed and nobody retries it.
// Bias hard toward skipping. A skip leaves it exactly where it already is.
const HALLUCINATIONS = new Set([
  'thank you', 'thanks for watching', 'thanks for listening', 'you', 'bye',
  'please subscribe', 'subscribe', 'so', 'okay', 'ok', 'hmm', 'oh',
  'thank you for watching', 'thank you very much', 'the end', 'music',
]);

// Sound tags are whisper describing audio, not words she said: *crickets*,
// [BLANK_AUDIO], (silence). Strip them and see what speech is actually left.
function speechOnly(text) {
  return text
    .replace(/\*[^*\n]*\*/g, ' ')
    .replace(/\[[^\]\n]*\]/g, ' ')
    .replace(/\([^)\n]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usable(text) {
  const speech = speechOnly(text);
  if (speech.length < 8) return { ok: false, why: 'no speech, only silence or sound tags' };
  const norm = speech.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (HALLUCINATIONS.has(norm)) return { ok: false, why: `whisper's silence filler ("${speech}")` };
  // A loop of one phrase over a long quiet stretch is the other classic shape.
  const sentences = speech.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  if (sentences.length >= 4 && new Set(sentences.map(x => x.toLowerCase())).size <= 2) {
    return { ok: false, why: 'one phrase repeated — a decoder loop, not speech' };
  }
  if (speech.split(/\s+/).length < 4) return { ok: false, why: `too few words to index ("${speech}")` };
  return { ok: true, text: speech };
}

if (!fs.existsSync(MODEL)) {
  console.error(`\n❌ No whisper model at:\n   ${MODEL}\n   See the setup lines at the top of this script.\n`);
  process.exit(1);
}

console.log('\nArchive: ' + BASE + '/api/memos\n');
const res = await fetch(BASE + '/api/memos/untranscribed');
if (!res.ok) { console.error(`❌ Server said ${res.status}. Is the app awake? Open ${BASE} and try again.`); process.exit(1); }
const { records = [], count = 0, total = 0 } = await res.json();
console.log(`${count} of ${total} archived recordings have no words.\n`);

const byKey = new Map();
for (const r of readVoiceMemos()) {
  const k = `${stampOf(r.when)}|${r.dur}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(r);
}

// stamp|duration, never the stamp alone — she records several short thoughts
// in the same minute, and a wrong match writes one recording's words onto
// another, which is worse than leaving it empty.
const work = [], skipped = { nomatch: 0, ambiguous: 0, gone: 0, tiny: 0 };
for (const rec of records) {
  const hits = byKey.get(rec.key) || [];
  if (hits.length === 0) { skipped.nomatch++; continue; }
  if (hits.length > 1)   { skipped.ambiguous++; continue; }
  const h = hits[0];
  if (!h.downloaded)     { skipped.gone++; continue; }
  const dur = probeDuration(h.src, rec.dur);
  if (dur < MIN_SECONDS) { skipped.tiny++; continue; }
  work.push({ ...rec, src: h.src, title: h.title, dur, size: fs.statSync(h.src).size });
}
work.sort((a, b) => a.dur - b.dur); // quick wins first, so a stopped run still banked something

const totalSecs = work.reduce((a, r) => a + r.dur, 0);
console.log(`Not attempted: ${skipped.nomatch} with no recording on this Mac, ${skipped.ambiguous} whose stamp+length matches two recordings, ${skipped.tiny} under ${MIN_SECONDS}s, ${skipped.gone} not downloaded from iCloud.`);
console.log(`To transcribe: ${work.length} recordings, ${hhmm(totalSecs)} of audio.\n`);

const queue = LIMIT ? work.slice(0, LIMIT) : work;
if (LIMIT) console.log(`(--limit ${LIMIT}: doing ${queue.length} of them)\n`);

if (DRY) {
  for (const r of queue) console.log(`   ${r.date}  ${String(Math.round(r.dur / 60)).padStart(4)}min  ${(r.size / 1024 / 1024).toFixed(1).padStart(5)}MB  ${r.title}`);
  console.log('\n(dry run — nothing transcribed, nothing sent)\n');
  process.exit(0);
}

let done = 0, failed = 0, empty = 0, audioSecs = 0;
const started = Date.now();
for (const [i, r] of queue.entries()) {
  const tag = `[${i + 1}/${queue.length}] ${r.date} ${Math.round(r.dur / 60)}min`;
  process.stdout.write(`${tag} ${r.title.slice(0, 40)} … `);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-'));
  const t0 = Date.now();
  try {
    const raw = transcribe(r.src, dir);
    const secs = (Date.now() - t0) / 1000;
    const verdict = usable(raw);
    if (!verdict.ok) { empty++; console.log(`skipped — ${verdict.why} (${secs.toFixed(0)}s)`); continue; }
    const text = verdict.text;
    // Bank the words on disk BEFORE sending. An hour of audio costs minutes of
    // decoding, and a dropped socket used to throw all of it away — the next
    // run just did the same work again. Now the send is the only thing retried.
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(path.join(CACHE, r.id + '.txt'), text);

    // Render sleeps the app between requests and hands out the occasional
    // UND_ERR_SOCKET on a long-running run; both failures in the first full
    // pass were this, and both succeeded on a retry.
    let out = null, post = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        post = await fetch(BASE + '/api/memos/transcript', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: r.id, transcript: text, source: 'whisper-cpp-large-v3-turbo' }),
        });
        out = await post.json().catch(() => ({}));
        if (post.ok || post.status === 400) break; // 400 is a verdict, not a hiccup
      } catch (err) {
        if (attempt === 4) { post = null; out = { error: err.message }; }
      }
      await new Promise(res => setTimeout(res, attempt * 4000));
    }
    if (!post) { failed++; console.log(`❌ could not reach the server after 4 tries (${(out && out.error) || ''}) — words kept in ${CACHE}`); continue; }
    if (!post.ok) { failed++; console.log(`❌ server ${post.status}: ${(out && out.error) || ''}`); continue; }
    if (out.skipped) { console.log(`already had words (${out.reason || 'skipped'})`); continue; }
    done++; audioSecs += r.dur;
    console.log(`✅ ${text.length.toLocaleString()} chars in ${secs.toFixed(0)}s (${(r.dur / secs).toFixed(1)}× realtime)`);
  } catch (err) {
    failed++;
    console.log(`❌ ${String(err.message || err).split('\n')[0].slice(0, 120)}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const mins = (Date.now() - started) / 60000;
console.log(`\nFilled ${done}, skipped ${empty}, failed ${failed} — ${hhmm(audioSecs)} of audio in ${mins.toFixed(0)} min.`);
if (done) console.log('Search picks them up by itself: filling a record re-runs classify and notifies onFiled.\n');

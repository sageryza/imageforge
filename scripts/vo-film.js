#!/usr/bin/env node
/* vo-film.js — assemble a narration FILM from Sophie's voice memos: one
 * command from a spec to a verified mp4, with a per-shot verdict cache so a
 * one-beat change re-verifies one beat instead of re-transcribing the film.
 *
 *   node scripts/vo-film.js spec.json --dir work/ [--final] [--force]
 *
 * Why this exists (Aug 2026, the Evan and Mason films): both chats hand-rolled
 * this assembly in scratch scripts, and both paid the full rebuild-verify toll
 * — re-cut everything, re-stitch, re-transcribe the WHOLE film — on every
 * small fix, five-plus rounds each. Shots are independent files: editing shot
 * 1a cannot change shot 3d's audio, so 3d's verdict is CACHED (keyed by the
 * shot's bytes) and a rebuild only re-verifies what actually changed. The
 * whole-film transcription gate (vo-verify) runs once, with --final, before
 * anything is handed to Sophie.
 *
 * The spec (all media may be a local path or an https URL):
 *
 *   {
 *     "title": "Mason — the shape",
 *     "width": 1000, "height": 1500, "fps": 30, "bg": "#f7f3ea",
 *     "sources": {                       // ORIGINAL continuous recordings —
 *       "m1347": { "file": "raw-1347.m4a" }   // never pre-spliced audio
 *     },
 *     "shots": [
 *       { "id": "1a", "image": "panel-1a.webp", "source": "m1347",
 *         "phrases": ["so I was thinking about Mason", "…"],
 *         "extra": [{ "source": "m1405", "phrase": "…" }] },
 *       { "id": "bridge", "image": "panel-x.webp",
 *         "tts": "Then I found all the others." },  // her cloned voice
 *       { "id": "2a", "video": "clip-2a.mp4",       // an ANIMATED shot: the
 *         "tts": "It was everywhere." }             // clip instead of a still
 *     ]
 *   }
 *
 * A shot's picture is `image` (a still, held for the shot's length) or
 * `video` (a clip, RETIMED to the shot's length — never frozen on its last
 * frame and never looped, both of which read as a fault mid-sentence). The
 * clip's own audio is dropped: the narration is the only sound.
 *
 * Stages, each cached by content hash (state in <dir>/state.json):
 *   0 tts     the film's tts lines are rendered as ONE TAKE and each shot is
 *             then located inside it, exactly like a real recording — a call
 *             per shot changes register at every cut (see joinTTS).
 *   1 prep    per source: vo-remove-pauses on the ORIGINAL (two-pass
 *             detector), then chunked 75s whisper word timestamps of the
 *             cleaned master. `"denoise": false` on a source skips the
 *             detector (a synthesized take has no room tone to measure).
 *   2 cut     per shot: editor.js's phraseSpan + clampBounds + snapToSilence
 *             locate every span in the cleaned master; with `"relisten":
 *             true` each span is then RE-TRANSCRIBED in a small window and
 *             cut on the fresh timings (see relistenSpan — bulk timings
 *             locate, a re-listen cuts; cutting on the bulk pass alone
 *             clipped word edges on the water reel, 2026-08-25); spans from
 *             one source are clamped non-overlapping in TIME; then the shot
 *             is cleaned on WORD TIMING (see below). TTS renders on
 *             eleven_multilingual_v2 (NEVER v3), cached by text.
 *   3 verify  per shot: transcribe THIS SHOT once (cached by its md5), LCS
 *             word-diff against its own phrases, wordless-gap measurement.
 *   4 stitch  per-shot video segments at exact cumulative frame boundaries
 *             (never the ffconcat stills demuxer — its repeated last frame
 *             ran a film 6.2s past its audio), PCM audio concat, one mux.
 *             Then a LOCAL full-film dead-air profile (no API). --final adds
 *             the vo-verify full-transcription gate.
 *
 * The shot-cleaning rules, every one earned on a shipped mistake:
 *   - Pauses are found by the ABSENCE OF WORDS, never by an energy floor.
 *     Sophie's pauses are full of fan/blanket/phone noise that sits far above
 *     any dead-air threshold — vo-verify said "0 dead-air runs" on a cut that
 *     measured 43 wordless gaps totalling 33.8s. Each gap is replaced by a
 *     bridge cut from the QUIETEST window inside that gap (so a thump in the
 *     middle of a pause is dropped, and the bridge is real room tone, never
 *     synthetic silence); gaps that read as a deliberate beat (>=0.9s) get a
 *     longer breath (0.34s) than ordinary ones (0.22s) — a flat compression
 *     everywhere reads clipped (her Evan note).
 *   - Energy still splits WITHIN a word span: whisper folds trailing noise
 *     into a word, so a "continuous" span can hide a multi-second hole (one
 *     hid 16s on Evan, 7.3s on Mason). Quiet is measured against the FILM's
 *     speech level — never the shot's own, which lets a quiet shot lower its
 *     bar (a 3.2s hole sailed under that twice) — WITH blip tolerance, or the
 *     wobbling floor breaks a dead run into pieces too short to count.
 *   - Head/tail: only a LONG (>1.2s) wordless edge is trimmed (to 0.3s).
 *     Trimming every edge to whisper's words dropped "And so there's" — three
 *     quiet words whisper simply didn't hear that pass.
 *   - NO extension across untranscribed edge sound by default. The Evan laugh
 *     guard protects any loud non-word audio, and on the Mason memos the
 *     loudest non-word audio was the PHONE, measured 10.9dB above her speech.
 *     If a take genuinely ends in a laugh, put the laugh in the phrase's last
 *     word's gap — or accept the trim and re-cut that one shot by hand.
 *   - Her voice is never loudnormed. Plain cuts, 12ms edge fades, PCM/WAV
 *     concat (AAC priming walks the sound off the pictures).
 *
 * Env: OPENAI_API_KEY (whisper), ELEVENLABS_API_KEY (only if a shot has tts).
 * Deps resolved from the repo's node_modules (run from the repo, or NODE_PATH).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, execFile } = require('child_process');

const REPO = path.join(__dirname, '..');
const ed = require(path.join(REPO, 'editor.js'));
const FFMPEG = process.env.FFMPEG_PATH || require('ffmpeg-static');
const FFPROBE = process.env.FFPROBE_PATH || require('ffprobe-static').path;
let sharp = null; try { sharp = require('sharp'); } catch (_) { /* checked at stitch */ }

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const SPEC_PATH = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
if (!SPEC_PATH) { console.error('usage: vo-film.js spec.json --dir work/ [--final] [--force]'); process.exit(1); }
const SPEC = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
const DIR = path.resolve(opt('dir', path.join(path.dirname(SPEC_PATH), 'vo-film-work')));
fs.mkdirSync(DIR, { recursive: true });
const FORCE = flag('force');

const W = SPEC.width || 1000, H = SPEC.height || 1500, FPS = SPEC.fps || 30, BG = SPEC.bg || '#f7f3ea';
const VOICE = SPEC.voice || 'UTkHGl2ImiT6gwtAFCql'; // "Sophie — morning"
const TOOLV = 'vofilm-2'; // bump to invalidate every cache (v2: quiet-landing edges + missed-word gap guard)
// A spec's edge rule changes every cut, so it belongs in the shot cache key.
const EDGEV = JSON.stringify(SPEC.edge || {});
// `"relisten": true` — re-transcribe a small window around every located span
// and cut on the FRESH timings (see relistenSpan). Opt-in per spec: it adds a
// whisper call per span, and a spec that was already approved must not have
// its cuts silently move. New timings change the span times, which are in the
// shot cache key, so flipping it re-cuts exactly the shots it moves.
const RELISTEN = !!SPEC.relisten;

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
const md5f = (f) => md5(fs.readFileSync(f));
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const B = 0.02; // 20ms RMS bins throughout
// ffmpeg's pad filter wants 0xRRGGBB — '#f7f3ea' in a filtergraph is a parse error.
const padColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? '0x' + c.slice(1) : c);

// ---- state ----------------------------------------------------------------
const STATE_PATH = path.join(DIR, 'state.json');
let state = {};
try { state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (_) { state = {}; }
if (FORCE) state = {};
state.caches = state.caches || {};
const saveState = () => fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 1));
// cache(key) -> stored value or undefined; put(key, val) stores + saves
const cache = (k) => state.caches[k];
const put = (k, v) => { state.caches[k] = v; saveState(); return v; };

// ---- small utils ----------------------------------------------------------
function run(bin, a, timeout = 600000) {
  return execFileSync(bin, bin === FFMPEG || bin === FFPROBE ? ['-hide_banner', ...a] : a,
    { timeout, maxBuffer: 256 * 1024 * 1024 });
}
const dur = (f) => parseFloat(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

async function fetchRetry(url, init, tries = 4, label = 'fetch') {
  let last;
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(`${label} http ${r.status}: ${(await r.text()).slice(0, 120)}`);
      return r;
    } catch (e) { last = e; await new Promise((x) => setTimeout(x, 2000 * (a + 1))); }
  }
  throw last;
}

async function materialize(ref, destBase) {
  // a local path is used in place; an https url downloads once into DIR
  if (!/^https?:/i.test(ref)) {
    const p = path.isAbsolute(ref) ? ref : path.resolve(path.dirname(SPEC_PATH), ref);
    if (!fs.existsSync(p)) throw new Error('missing file: ' + p);
    return p;
  }
  const out = path.join(DIR, destBase + path.extname(new URL(ref).pathname || '.bin'));
  if (!fs.existsSync(out)) {
    const r = await fetchRetry(ref, {}, 4, 'download');
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  }
  return out;
}

function rmsProfile(file) {
  const pcm = run(FFMPEG, ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '16000', '-']);
  const BIN = 320, bins = [];
  for (let i = 0; i + BIN * 2 <= pcm.length; i += BIN * 2) {
    let acc = 0;
    for (let j = 0; j < BIN; j++) { const s = pcm.readInt16LE(i + j * 2) / 32768; acc += s * s; }
    bins.push(10 * Math.log10(acc / BIN + 1e-12));
  }
  return bins;
}
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function whisperWords(file) { // one <=75s chunk, word timestamps
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'c.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const r = await fetchRetry('https://api.openai.com/v1/audio/transcriptions',
    { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form }, 5, 'whisper');
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.words || []).map((w) => ({ word: String(w.word || '').trim(), start: +w.start || 0, end: +w.end || 0 }));
}

async function wordsChunked(file) { // 75s chunks — the honest-on-long-files rule
  const total = dur(file);
  const words = [];
  const tmp = path.join(DIR, '_chunk.mp3');
  for (let t0 = 0; t0 < total - 0.3; t0 += 75) {
    run(FFMPEG, ['-v', 'error', '-y', '-ss', String(t0), '-t', '75', '-i', file, '-ac', '1', '-ar', '16000', '-b:a', '48k', tmp]);
    if (fs.statSync(tmp).size < 2000) continue; // empty tail
    for (const w of await whisperWords(tmp)) words.push({ word: w.word, start: w.start + t0, end: w.end + t0 });
  }
  return words;
}

// ---- stage 1: prep sources -------------------------------------------------
async function prepSources() {
  const out = {};
  for (const key of Object.keys(SPEC.sources || {})) {
    const raw = await materialize(SPEC.sources[key].file, `src-${key}`);
    const rawHash = md5f(raw);
    const ck = `prep|${TOOLV}|${key}|${rawHash}`;
    const clean = path.join(DIR, `clean-${key}.wav`);
    const hit = cache(ck);
    if (hit && fs.existsSync(clean) && md5f(clean) === hit.cleanMd5) {
      out[key] = { clean, words: hit.words };
      continue;
    }
    if (SPEC.sources[key].denoise === false) {
      // already clean (a synthesized take) — the two-pass detector measures a
      // real room's floor and has nothing to measure here
      run(FFMPEG, ['-v', 'error', '-y', '-i', raw, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', clean]);
    } else {
      console.log(`prep ${key}: cleaning (two-pass detector)…`);
      await new Promise((res, rej) => {
        execFile('node', [path.join(REPO, 'scripts', 'vo-remove-pauses.js'), raw, clean],
          { cwd: REPO, timeout: 1200000, maxBuffer: 32e6 },
          (err, so, se) => err ? rej(new Error(`vo-remove-pauses ${key}: ${(se || err.message).slice(-300)}`)) : res());
      });
    }
    console.log(`prep ${key}: word timestamps…`);
    const words = await wordsChunked(clean);
    out[key] = { clean, words };
    put(ck, { cleanMd5: md5f(clean), words });
    console.log(`prep ${key}: ${dur(raw).toFixed(1)}s → ${dur(clean).toFixed(1)}s, ${words.length} words`);
  }
  return out;
}

// THE BULK PASS LOCATES, THE RE-LISTEN CUTS (the Cutting Room's own rule,
// finally applied here — Sophie 2026-08-25, hearing clipped word edges: "make
// sure that the audio is cut exactly … whisper doesn't cut exactly to the
// words"). A master's chunked word timestamps are chips-only accuracy: good
// enough to FIND a phrase, tens of ms off at the word edges — and clampBounds
// pads as little as 0.02s/0.03s when her takes run back to back, so a late
// whisper start or an early whisper end (its habit) clips the word. So each
// located span is re-transcribed in a small window around itself, relocated
// on the fresh timings, snapped against the window's real silences, and then
// a VOICING GUARD walks each edge outward while the 20ms RMS is still hot —
// never past the neighbouring word, so a back-to-back take can't bleed in.
// A missed relocation keeps the bulk timings (whisper on a short window can
// drop opening words — the 1s prepended silence is that documented fix).
async function relistenSpan(sources, source, phrase, t0, t1, label) {
  const clean = sources[source].clean;
  const cleanMd5 = md5f(clean);
  const ck = `relisten|${TOOLV}|${source}|${cleanMd5}|${sha1(phrase)}`;
  const hit0 = cache(ck);
  if (hit0) return hit0.span; // null (missed) is a cached answer too
  const total = dur(clean);
  const PADS = 1.0;
  const winStart = Math.max(0, t0 - 2.5);
  const winEnd = Math.min(total, t1 + 2.5);
  const win = path.join(DIR, `_relisten-${sha1(ck).slice(0, 10)}.mp3`);
  run(FFMPEG, ['-v', 'error', '-y', '-ss', winStart.toFixed(3), '-t', (winEnd - winStart).toFixed(3),
    '-i', clean, '-af', `adelay=${PADS * 1000}:all=1`, '-ac', '1', '-ar', '16000', '-b:a', '48k', win]);
  let span = null;
  try {
    const w2 = await whisperWords(win);
    const hit = ed.phraseSpan(w2, phrase);
    if (hit && hit.score >= 0.6) {
      let [rs, re] = ed.clampBounds(w2, hit.start, hit.end);
      const nxt = w2[hit.end + 1] ? w2[hit.end + 1].start : null;
      const prv = hit.start > 0 ? w2[hit.start - 1].end : null;
      const sn = ed.snapToSilence(rs, re, await ed.detectSilences(win), nxt);
      if (Array.isArray(sn)) [rs, re] = sn;
      // THE CUT EDGES LAND IN REAL QUIET, never merely at a cold bin
      // (2026-08-25, her ear again: the film opened INSIDE "Scientists" —
      // whisper's start was late, the fixed 0.15s pad wasn't enough, and the
      // first hot-bin check stopped on the quiet of an /s/ fricative). Each
      // edge walks outward until it finds 0.12s of consecutive near-floor
      // audio, capped, bounded by the neighbouring word so a back-to-back
      // take cannot bleed in.
      const bins = rmsProfile(win);
      const LOW = pct(bins, 0.85) - 25;
      const quietRun = (i) => {
        for (let k = i; k < i + 6; k++) {
          if (k < 0 || k >= bins.length) continue;
          if (bins[k] >= LOW) return false;
        }
        return true;
      };
      let j = Math.floor(re / B);
      const endLim = Math.min(j + Math.round(0.45 / B),
        nxt == null ? Infinity : Math.floor((nxt - 0.02) / B));
      while (!quietRun(j) && j < endLim) j++;
      re = Math.max(re, j * B);
      j = Math.floor(rs / B);
      const startLim = Math.max(j - Math.round(0.50 / B),
        prv == null ? 0 : Math.ceil((prv + 0.02) / B));
      while (!quietRun(j - 6) && j > startLim) j--;
      rs = Math.min(rs, j * B);
      span = [Math.max(0, winStart + rs - PADS), winStart + re - PADS];
    }
  } catch (err) {
    console.warn(`  relisten ${label}: ${err.message} — bulk timings kept`);
  }
  fs.rmSync(win, { force: true });
  put(ck, { span });
  return span;
}

// ---- stage 2: cut shots ----------------------------------------------------
function locateSpans(sources) {
  const spans = []; // {shotIdx, order, source, t0, t1, text}
  const silCache = {};
  const silOf = async (key) => (silCache[key] ||= await ed.detectSilences(sources[key].clean));
  return (async () => {
    for (let si = 0; si < SPEC.shots.length; si++) {
      const shot = SPEC.shots[si];
      if (shot.tts) continue;
      const parts = (shot.phrases || []).map((p) => ({ source: shot.source, phrase: p }))
        .concat((shot.extra || []).map((e) => ({ source: e.source, phrase: e.phrase })));
      if (!parts.length) throw new Error(`shot ${shot.id}: no phrases and no tts`);
      for (let pi = 0; pi < parts.length; pi++) {
        const { source, phrase } = parts[pi];
        const words = sources[source].words;
        const hit = ed.phraseSpan(words, phrase);
        if (!hit) throw new Error(`NO MATCH shot ${shot.id} part ${pi}: "${phrase.slice(0, 60)}…"`);
        if (hit.score < 0.72) console.warn(`  LOW SCORE ${hit.score.toFixed(2)} on ${shot.id}.${pi} — check the phrase wording`);
        let [t0, t1] = ed.clampBounds(words, hit.start, hit.end);
        const maxEnd = words[hit.end + 1] ? words[hit.end + 1].start : null;
        const snapped = ed.snapToSilence(t0, t1, await silOf(source), maxEnd);
        if (Array.isArray(snapped)) [t0, t1] = snapped;
        if (RELISTEN) {
          const fresh = await relistenSpan(sources, source, phrase, t0, t1, `${shot.id}.${pi}`);
          if (fresh) [t0, t1] = fresh;
          else console.warn(`  relisten missed on ${shot.id}.${pi} — bulk timings kept`);
        }
        spans.push({ shotIdx: si, order: pi, source, t0, t1, text: phrase });
      }
    }
    // non-overlapping in TIME per source — a padded cut reaching into the next
    // word's onset replays a sliver ("…behind | behind…", 17 joins on Evan)
    const bySrc = {};
    spans.forEach((s) => (bySrc[s.source] ||= []).push(s));
    for (const k of Object.keys(bySrc)) {
      const list = bySrc[k].sort((a, b) => a.t0 - b.t0);
      for (let i = 1; i < list.length; i++) if (list[i].t0 < list[i - 1].t1) list[i].t0 = list[i - 1].t1;
    }
    return spans;
  })();
}

// `chain` = { previous_request_ids?, next_request_ids?, previous_text?, next_text? },
// ElevenLabs' request stitching. The RETURNED request id is written beside the
// audio as `.id` — see anchorTTS for why losing it costs a re-render.
async function renderTTSText(text, label, chain) {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error(`${label} needs TTS but ELEVENLABS_API_KEY is not set`);
  // An UNCHAINED render keeps the original key shape on purpose: adding the
  // chain to it unconditionally invalidated every take already on disk and
  // silently re-rendered a film that was already approved.
  const ch = chain && Object.keys(chain).length ? '|' + JSON.stringify(chain) : '';
  const key = sha1(`${VOICE}|eleven_multilingual_v2|${text}${ch}`);
  const wav = path.join(DIR, `tts-${key.slice(0, 12)}.wav`);
  if (fs.existsSync(wav)) return wav;
  const r = await fetchRetry(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2', // NEVER eleven_v3 — the voice rule
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
      ...(chain || {}),
    }),
  }, 4, 'elevenlabs');
  // The request id is the ONLY handle on a take that already exists — audio
  // cannot seed a stitch. Write it down at birth or the take can never be
  // chained to and has to be re-rendered (which is a different take).
  const reqId = r.headers.get('request-id') || r.headers.get('x-request-id') || '';
  if (reqId) fs.writeFileSync(wav + '.id', reqId);
  const mp3 = path.join(DIR, `tts-${key.slice(0, 12)}.mp3`);
  fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  run(FFMPEG, ['-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', wav]);
  return wav;
}

const ttsRequestId = (wav) => { try { return fs.readFileSync(wav + '.id', 'utf8').trim(); } catch (_) { return ''; } };

const renderTTS = (shot) => renderTTSText(shot.tts, `shot ${shot.id}`);

// ONE TTS RENDER FOR THE WHOLE FILM, THEN SPLIT IT (Aug 2026, Sophie: "you're
// supposed to pick one clip and then chain them all together so that they
// don't change the register so much"). Every ElevenLabs request is synthesized
// independently, so a film built from one call per shot changes register at
// every cut — audibly, and worse the more shots there are. So the tts lines are
// rendered as a SINGLE take and each shot is then located inside it with the
// same phraseSpan/clamp/snap path her real recordings already use: the film
// hears one continuous performance, cut up, which is exactly what it would be
// if she had read it herself.
//
// The joint take is registered as an ordinary source with `denoise:false` —
// vo-remove-pauses is the two-pass detector built for HER rooms (fan, blanket,
// phone), and synthesized speech has no room tone for pass 2 to measure. The
// per-shot word-timing clean still runs, which is the pass that belongs on
// clean audio; it also compresses TTS's over-long comma breaths on the way.
// **`"anchor": "<shot id>"` PINS THE REGISTER TO ONE LINE** (Aug 2026, Sophie,
// after hearing the joint take: "I didn't love the take … I'll pick my
// favorite and then you can chain them to my favorite, you can chain them
// before and after"). One take for the whole film still leaves WHICH take to
// chance. With an anchor the film is rendered in three: the anchor's line
// alone, then everything BEFORE it chained with `next_request_ids`, then
// everything AFTER it with `previous_request_ids` — so both halves are
// conditioned on the take she chose. The three are concatenated as PCM and the
// shots are located inside exactly as before.
//
// **A take can only be chained to by its REQUEST ID, and audio cannot seed
// one.** The first six takes here were rendered without capturing theirs, so
// the take she picked could not be reused and the anchor had to be re-rendered
// — a different take of the same line. renderTTSText writes the id down now;
// don't drop that.
async function renderAnchored(tts, anchorIdx) {
  const line = (s) => String(s.tts).trim();
  const before = tts.slice(0, anchorIdx).map(line).join('\n\n');
  const after = tts.slice(anchorIdx + 1).map(line).join('\n\n');
  const anchorWav = await renderTTSText(line(tts[anchorIdx]), `anchor "${tts[anchorIdx].id}"`);
  const id = ttsRequestId(anchorWav);
  if (!id) console.warn('  anchor returned no request id — the halves fall back to TEXT conditioning');
  const parts = [];
  if (before) {
    parts.push(await renderTTSText(before, 'the take before the anchor',
      id ? { next_request_ids: [id] } : { next_text: line(tts[anchorIdx]) }));
  }
  parts.push(anchorWav);
  if (after) {
    parts.push(await renderTTSText(after, 'the take after the anchor',
      id ? { previous_request_ids: [id] } : { previous_text: line(tts[anchorIdx]) }));
  }
  if (parts.length === 1) return parts[0];
  const list = path.join(DIR, '_tts-chain.txt');
  fs.writeFileSync(list, parts.map((f) => `file '${f}'`).join('\n'));
  const out = path.join(DIR, `tts-chain-${sha1(parts.join('|')).slice(0, 12)}.wav`);
  run(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
  return out;
}

const TTS_SRC = '__tts';
async function joinTTS() {
  const tts = SPEC.shots.filter((s) => s.tts);
  if (tts.length < 2) return; // a single line has no register to drift against
  const script = tts.map((s) => String(s.tts).trim()).join('\n\n');
  const anchorIdx = SPEC.anchor ? tts.findIndex((s) => s.id === SPEC.anchor) : -1;
  if (SPEC.anchor && anchorIdx < 0) throw new Error(`anchor "${SPEC.anchor}" is not a tts shot`);
  const wav = anchorIdx >= 0
    ? (console.log(`tts: anchored on "${SPEC.anchor}", chained before and after…`),
       await renderAnchored(tts, anchorIdx))
    : (console.log(`tts: one take for ${tts.length} shots (${script.length} chars)…`),
       await renderTTSText(script, 'the joint TTS take'));
  SPEC.sources = { ...(SPEC.sources || {}), [TTS_SRC]: { file: wav, denoise: false } };
  for (const s of tts) {
    s.ttsText = s.tts;          // kept for the delivery report — the words are unchanged
    s.source = TTS_SRC;
    s.phrases = [s.tts];
    delete s.tts;               // it is a phrases shot from here on
  }
}

async function cutShot(shot, si, spans, sources, filmSpeech85) {
  const OUTD = path.join(DIR, 'shots'); fs.mkdirSync(OUTD, { recursive: true });
  const final = path.join(OUTD, `shot-${String(si).padStart(2, '0')}-${shot.id}.wav`);
  if (shot.tts) {
    const t = await renderTTS(shot);
    fs.copyFileSync(t, final);
    return { file: final, text: shot.tts, tts: true };
  }
  const mine = spans.filter((s) => s.shotIdx === si).sort((a, b) => a.order - b.order);
  // extract each span (plain cut, 12ms fades), concat PCM
  const parts = mine.map((s, i) => {
    const f = path.join(OUTD, `_p${si}-${i}.wav`);
    const d = s.t1 - s.t0;
    run(FFMPEG, ['-v', 'error', '-y', '-ss', s.t0.toFixed(3), '-t', d.toFixed(3), '-i', sources[s.source].clean,
      '-af', `afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, d - 0.012).toFixed(3)}:d=0.012`,
      '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', f]);
    return f;
  });
  const raw = path.join(OUTD, `_raw-${shot.id}.wav`);
  if (parts.length === 1) fs.copyFileSync(parts[0], raw);
  else {
    const list = path.join(OUTD, `_l${si}.txt`);
    fs.writeFileSync(list, parts.map((f) => `file '${f}'`).join('\n'));
    run(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', raw]);
  }
  // clean on WORD TIMING (see header). One transcription of the raw shot.
  const bins = rmsProfile(raw);
  const total = bins.length * B;
  const tmp = path.join(DIR, '_shot.mp3');
  run(FFMPEG, ['-v', 'error', '-y', '-i', raw, '-ac', '1', '-ar', '16000', '-b:a', '48k', tmp]);
  const w = total > 76 ? await wordsChunked(raw) : await whisperWords(tmp);
  if (!w.length) throw new Error(`shot ${shot.id}: nothing transcribed`);
  let keep = w.map((x) => [Math.max(0, x.start - 0.06), Math.min(total, x.end + 0.10)]);
  keep.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const k of keep) {
    if (merged.length && k[0] <= merged[merged.length - 1][1] + 0.01) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], k[1]);
    else merged.push([k[0], k[1]]);
  }
  // split word spans on internal quiet (film-level threshold, blip tolerance)
  const speech85 = Math.max(pct(bins, 0.85), filmSpeech85), QUIET = speech85 - 20, BLIP = 3;
  const split = [];
  for (const [a, b] of merged) {
    let cur = a, rs = -1, up = 0;
    for (let i = Math.floor(a / B); i <= Math.ceil(b / B); i++) {
      const quiet = i < bins.length && bins[i] < QUIET;
      if (quiet) { if (rs < 0) rs = i; up = 0; }
      else if (rs >= 0 && ++up > BLIP) {
        const end = i - up;
        if ((end - rs) * B >= 0.40) { split.push([cur, rs * B]); cur = end * B; }
        rs = -1; up = 0;
      }
    }
    if (rs >= 0 && (Math.ceil(b / B) - rs) * B >= 0.40) { split.push([cur, rs * B]); cur = b; }
    if (b - cur > 0.02) split.push([cur, b]);
  }
  const regions = split.filter(([a, b]) => b - a > 0.02);
  // long wordless edges only. The default keeps any edge under 1.2s whole —
  // that is her breath, and trimming every edge to whisper's words dropped
  // three quiet words it never heard. A spec may tighten it (`"edge": {"max":
  // 0.45, "keep": 0.22}`) when the film is one continuous read and the kept
  // edges meet at every joint: on the water reel a ~1.2s tail against the
  // next shot's ~1.2s head measured 8 dead-air runs over 1s. Defaults
  // unchanged, so no existing spec moves.
  const EDGE_MAX = (SPEC.edge && SPEC.edge.max) || 1.2;
  const EDGE_KEEP = (SPEC.edge && SPEC.edge.keep != null) ? SPEC.edge.keep : 0.3;
  if (regions.length) {
    if (regions[0][0] <= EDGE_MAX) regions[0][0] = 0; else regions[0][0] -= EDGE_KEEP;
    const last = regions[regions.length - 1];
    if (total - last[1] <= EDGE_MAX) last[1] = total; else last[1] += EDGE_KEEP;
  }
  // bridges from the quietest window of each gap
  const quietWindow = (g0, g1, len) => {
    const n = Math.round(len / B);
    let best = null, bestE = Infinity;
    for (let i = Math.floor(g0 / B); i + n <= Math.ceil(g1 / B) && i + n <= bins.length; i++) {
      let e = 0; for (let j = i; j < i + n; j++) e += bins[j];
      if (e < bestE) { bestE = e; best = i; }
    }
    return best == null ? null : [best * B, (best + n) * B];
  };
  // A GAP WITH SUSTAINED VOICING IS A MISSED WORD, NOT A PAUSE (2026-08-25,
  // found by Sophie's ear: "secret" — present in the source words, whispered
  // quietly — went untranscribed on the SHOT pass, fell between two word
  // regions, and the bridge replaced it with room tone). The skill's own
  // rule: a real dead stretch holds ~0s above speech-14dB, a spoken word
  // holds its whole length there. So a gap is only bridged when it lacks a
  // sustained hot run; otherwise its audio is kept verbatim.
  const VOICED = speech85 - 14;
  const gapHasSpeech = (g0, g1) => {
    let run = 0;
    for (let i = Math.floor(g0 / B); i < Math.ceil(g1 / B) && i < bins.length; i++) {
      run = bins[i] > VOICED ? run + 1 : 0;
      if (run * B >= 0.18) return true;
    }
    return false;
  };
  const segs = [];
  for (let i = 0; i < regions.length; i++) {
    segs.push(regions[i]);
    if (i < regions.length - 1) {
      const g0 = regions[i][1], g1 = regions[i + 1][0];
      const len = (g1 - g0) >= 0.9 ? 0.34 : 0.22;
      if (g1 - g0 <= len + 0.02) { segs.push([g0, g1]); continue; }
      if (gapHasSpeech(g0, g1)) { segs.push([g0, g1]); continue; }
      const q = quietWindow(g0, g1, len);
      if (q) segs.push(q);
    }
  }
  const fin = [];
  for (const s of segs) {
    if (fin.length && Math.abs(s[0] - fin[fin.length - 1][1]) < 0.005) fin[fin.length - 1][1] = s[1];
    else fin.push([s[0], s[1]]);
  }
  const graph = fin.map(([a, b], i) =>
    `[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, b - a - 0.012).toFixed(3)}:d=0.012[s${i}]`).join(';');
  run(FFMPEG, ['-v', 'error', '-y', '-i', raw, '-filter_complex',
    `${graph};${fin.map((_, i) => `[s${i}]`).join('')}concat=n=${fin.length}:v=0:a=1[out]`,
    '-map', '[out]', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', final]);
  return { file: final, text: mine.map((s) => s.text).join(' '), tts: false };
}

// ---- stage 3: verify one shot (cached by its bytes) -------------------------
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
function lcsMissing(want, got) {
  // Longest missing contiguous run of script words, via a FULL LCS table +
  // proper backtrack. (v1 of this function kept only per-row equality flags
  // and backtracked greedily — it reported a 73-word missing run on a shot
  // whose transcription contained every word. If a diff looks impossible,
  // suspect the diff.) Shots are a few hundred words, so the full table is
  // nothing: (n+1)*(m+1) int32s.
  const n = want.length, m = got.length;
  const Wd = m + 1;
  const T = new Int32Array((n + 1) * Wd);
  for (let i = 1; i <= n; i++) {
    for (let k = 1; k <= m; k++) {
      T[i * Wd + k] = want[i - 1] === got[k - 1]
        ? T[(i - 1) * Wd + (k - 1)] + 1
        : Math.max(T[(i - 1) * Wd + k], T[i * Wd + (k - 1)]);
    }
  }
  const matched = new Uint8Array(n);
  let i = n, k = m;
  while (i > 0 && k > 0) {
    if (want[i - 1] === got[k - 1] && T[i * Wd + k] === T[(i - 1) * Wd + (k - 1)] + 1) { matched[i - 1] = 1; i--; k--; }
    else if (T[(i - 1) * Wd + k] >= T[i * Wd + (k - 1)]) i--;
    else k--;
  }
  let longest = 0, curRun = 0, missing = 0;
  for (let x = 0; x < n; x++) {
    if (!matched[x]) { curRun++; missing++; longest = Math.max(longest, curRun); }
    else curRun = 0;
  }
  return { missing, longest };
}

async function verifyShot(shot, cutInfo) {
  const h = md5f(cutInfo.file);
  const ck = `verify|${TOOLV}.2|${shot.id}|${h}`;
  const hit = cache(ck);
  if (hit) return { ...hit, cached: true };
  const tmp = path.join(DIR, '_v.mp3');
  run(FFMPEG, ['-v', 'error', '-y', '-i', cutInfo.file, '-ac', '1', '-ar', '16000', '-b:a', '48k', tmp]);
  const w = await whisperWords(tmp);
  const seconds = dur(cutInfo.file);
  // wordless gaps + edges
  let worstGap = 0, gapSec = 0;
  for (let i = 1; i < w.length; i++) {
    const g = w[i].start - w[i - 1].end;
    if (g > 0.35) { gapSec += g; worstGap = Math.max(worstGap, g); }
  }
  const lead = w.length ? w[0].start : seconds;
  const tail = w.length ? seconds - w[w.length - 1].end : seconds;
  const { missing, longest } = lcsMissing(norm(cutInfo.text), w.map((x) => norm(x.word)[0] || ''));
  const verdict = {
    seconds: +seconds.toFixed(2),
    heard: w.length,
    missingWords: missing, longestMissingRun: longest,
    worstGap: +worstGap.toFixed(2), gapSec: +gapSec.toFixed(1),
    lead: +lead.toFixed(2), tail: +tail.toFixed(2),
    ok: longest < 4 && worstGap <= 1.5 && lead <= 1.5 && tail <= 1.5,
  };
  return put(ck, verdict);
}

// ---- stage 4: stitch + film-level checks ------------------------------------
async function stitch(shots) {
  if (!sharp) throw new Error('sharp not installed — npm install in the repo first');
  const FR = path.join(DIR, 'frames'); fs.mkdirSync(FR, { recursive: true });
  const lens = shots.map((s) => dur(s.file));
  // A shot's picture is a STILL by default and an animated CLIP when it names
  // one (`"video"`). Only one of the two is materialized per shot — a still
  // frame for a video shot would be a second full-size decode for nothing.
  const vids = [];
  for (let i = 0; i < shots.length; i++) {
    const spec = SPEC.shots[i];
    if (spec.video) { vids[i] = await materialize(spec.video, `vid-${spec.id}`); continue; }
    const img = await materialize(spec.image, `img-${spec.id}`);
    await sharp(img).resize(W, H, { fit: 'contain', background: BG }).png().toFile(path.join(FR, `${i}.png`));
  }
  const alist = path.join(DIR, '_a.txt');
  fs.writeFileSync(alist, shots.map((s) => `file '${s.file}'`).join('\n'));
  const wav = path.join(DIR, 'film.wav');
  run(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c', 'copy', wav]);
  // per-shot video segments at cumulative frame boundaries (no drift),
  // each CACHED by (frame content, duration) — on a one-beat change only the
  // changed shot's segment (and any neighbour whose cumulative rounding
  // wobbled a frame) re-encodes
  const segs = [];
  let cum = 0, prevFrame = 0;
  for (let i = 0; i < shots.length; i++) {
    cum += lens[i];
    const frame = Math.round(cum * FPS);
    const segDur = (frame - prevFrame) / FPS; prevFrame = frame;
    const src = vids[i] || path.join(FR, `${i}.png`);
    const segKey = sha1(`${md5f(src)}|${segDur.toFixed(3)}|${FPS}|${W}x${H}|${BG}`).slice(0, 16);
    const seg = path.join(DIR, `seg-${segKey}.mp4`);
    if (!fs.existsSync(seg)) {
      if (vids[i]) {
        // The clip is fitted to the shot's own audio by RETIMING, never by
        // freezing or looping: a held last frame reads as the film hanging,
        // and a loop jumps back to frame 1 in the middle of a sentence. The
        // narration is the clock — the picture stretches to it.
        const f = segDur / dur(vids[i]);
        run(FFMPEG, ['-v', 'error', '-y', '-i', vids[i], '-an',
          '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:${padColor(BG)},setpts=PTS*${f.toFixed(6)},fps=${FPS}`,
          '-t', segDur.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
          '-pix_fmt', 'yuv420p', '-r', String(FPS), seg]);
      } else {
        run(FFMPEG, ['-v', 'error', '-y', '-loop', '1', '-framerate', String(FPS), '-t', segDur.toFixed(3),
          '-i', path.join(FR, `${i}.png`), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
          '-pix_fmt', 'yuv420p', '-r', String(FPS), seg]);
      }
    }
    segs.push(seg);
  }
  const vlist = path.join(DIR, '_v.txt');
  fs.writeFileSync(vlist, segs.map((f) => `file '${f}'`).join('\n'));
  const vonly = path.join(DIR, '_video.mp4');
  run(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', vlist, '-c', 'copy', vonly]);
  const out = path.join(DIR, (SPEC.out || 'film') + '.mp4');
  run(FFMPEG, ['-v', 'error', '-y', '-i', vonly, '-i', wav, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', out]);
  return { out, wav, lens };
}

function deadAir(file) { // vo-verify's film check, local and free
  const bins = rmsProfile(file);
  const speech = pct(bins, 0.85), TH = speech - 20, BLIP = 3;
  const runs = [];
  let s = -1, up = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] < TH) { if (s < 0) s = i; up = 0; }
    else if (s >= 0 && ++up > BLIP) { if ((i - up - s) * B >= 1.0) runs.push([s * B, (i - up) * B]); s = -1; up = 0; }
  }
  if (s >= 0 && (bins.length - s) * B >= 1.0) runs.push([s * B, bins.length * B]);
  return runs;
}

// ---- main -------------------------------------------------------------------
(async () => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  await joinTTS();
  const sources = await prepSources();
  const spans = await locateSpans(sources);

  // film speech level from every non-tts span's audio (cheap: reuse masters)
  const allBins = [];
  for (const k of Object.keys(sources)) allBins.push(...rmsProfile(sources[k].clean));
  const filmSpeech85 = allBins.length ? pct(allBins, 0.85) : -17;

  // cut + verify per shot, cache-aware
  const shots = [];
  let reused = 0;
  for (let si = 0; si < SPEC.shots.length; si++) {
    const shot = SPEC.shots[si];
    const mine = spans.filter((s) => s.shotIdx === si);
    const ck = `cut|${TOOLV}|${shot.id}|${sha1(JSON.stringify({
      spans: mine.map((s) => [s.source, +s.t0.toFixed(3), +s.t1.toFixed(3), s.text]),
      tts: shot.ttsText || shot.tts || null, speech: +filmSpeech85.toFixed(1), edge: EDGEV,
    }))}`;
    const OUTD = path.join(DIR, 'shots');
    const finalPath = path.join(OUTD, `shot-${String(si).padStart(2, '0')}-${shot.id}.wav`);
    const hit = cache(ck);
    let info;
    if (hit && fs.existsSync(finalPath) && md5f(finalPath) === hit.md5) {
      info = { file: finalPath, text: hit.text, tts: !!shot.tts };
      reused++;
    } else {
      info = await cutShot(shot, si, spans, sources, filmSpeech85);
      put(ck, { md5: md5f(info.file), text: info.text });
      console.log(`cut ${shot.id}: ${dur(info.file).toFixed(2)}s${(shot.ttsText || shot.tts) ? ' (TTS)' : ''}`);
    }
    const v = await verifyShot(shot, info);
    if (!v.ok) {
      console.error(`shot ${shot.id} FAILS: ${JSON.stringify(v)}`);
      console.error('fix the phrase or the source, then re-run — other shots stay cached.');
      process.exit(1);
    }
    console.log(`ok ${shot.id}: ${v.seconds}s, worst gap ${v.worstGap}s, tail ${v.tail}s${v.cached ? ' (cached)' : ''}`);
    shots.push(info);
  }
  if (reused) console.log(`${reused}/${SPEC.shots.length} shots unchanged (cache)`);

  // stitch — skipped wholesale when nothing feeding it changed
  const stitchKey = `stitch|${TOOLV}|${sha1(JSON.stringify({
    shots: shots.map((s) => md5f(s.file)),
    images: SPEC.shots.map((s) => s.video || s.image), W, H, FPS, BG, out: SPEC.out || 'film',
  }))}`;
  const outPath = path.join(DIR, (SPEC.out || 'film') + '.mp4');
  let out, lens;
  const sHit = cache(stitchKey);
  if (sHit && fs.existsSync(outPath) && md5f(outPath) === sHit.md5) {
    out = outPath; lens = sHit.lens;
    console.log('stitch: unchanged (cache)');
  } else {
    ({ out, lens } = await stitch(shots));
    put(stitchKey, { md5: md5f(out), lens });
  }
  const runs = deadAir(out);
  if (runs.length) {
    console.error(`FILM has ${runs.length} dead-air run(s) >=1s: ` + runs.map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)}`).join(', '));
    process.exit(1);
  }
  const script = path.join(DIR, 'script.txt');
  fs.writeFileSync(script, shots.map((s) => s.text).join('\n'));
  const total = lens.reduce((a, b) => a + b, 0);
  console.log(`film: ${out} — ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}, ${SPEC.shots.length} shots, 0 dead-air runs`);
  const ttsShots = SPEC.shots.filter((s) => s.ttsText || s.tts);
  if (ttsShots.length) console.log(`TTS lines (say these to Sophie word for word): ${ttsShots.map((s) => JSON.stringify(s.ttsText || s.tts)).join(' · ')}`);

  if (flag('final')) {
    console.log('final gate: vo-verify full transcription…');
    const r = await new Promise((res) => {
      execFile('node', [path.join(REPO, 'scripts', 'vo-verify.js'), out, '--script', script],
        { cwd: REPO, timeout: 1200000, maxBuffer: 32e6 }, (err, so, se) => res({ err, so: so + se }));
    });
    console.log(r.so.trim().split('\n').slice(-6).join('\n'));
    if (r.err) process.exit(1);
  } else {
    console.log('(run again with --final for the vo-verify full-transcription gate before delivering)');
  }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });

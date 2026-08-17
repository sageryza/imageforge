// ─── Voice-memo ingest (/api/memos) ─────────────────────────────────────────
//
// Lets Sophie's Mac push new Voice Memos recordings into the archive with NO
// credentials on the Mac at all. The Mac only has the audio; this server
// already holds the membry service account and the OpenAI key, so it does the
// parts that need secrets:
//
//   GET  /status   → what's already archived (the stamps to skip) — no auth
//   POST /ingest   → raw audio in; transcribe + categorise + file it
//
// Why this exists: the standalone scripts/update-memos.mjs path works, but it
// needs a Firebase ADMIN key sitting on the laptop and an OpenAI key exported
// in the shell. That key is full read/write over Firestore and Storage, and it
// can't be pasted into a chat or committed (both repos are public). Moving the
// privileged half server-side means the Mac command is copy-paste with nothing
// to fill in.
//
// The archive lives in membry-df528 Storage: memo-audio/<id>.m4a plus
// memo-audio/manifest.json, which is the file everything else reads.
//
// ONE LIBRARY (Aug 2026, Sophie's rule): every way a recording can arrive —
// the Mac push, the iOS share sheet (audio.js), a Story Room voiceover paste,
// a chat with a pasted file — files into THIS archive, through
// fileIntoArchive() below. Transcription is unconditional (no toggle), and
// dedupe is THREE layers, because each catches what the one before cannot:
// the md5 of the bytes (a retried upload), the AUDIO FINGERPRINT (a recording
// re-shared off the phone, whose bytes differ only in rewritten date fields —
// see audioHash), and the TRANSCRIPT BACKSTOP (a re-encoded copy, where even
// the audio bytes differ).
//
// A shared STAMP is not one of them. It is minute-resolution, Sophie records
// several short thoughts back to back, and the archive holds 70 groups of
// recordings that honestly share a minute — treating that as identity refused
// a real 28-minute recording because an 11-second clip was made in the same
// minute. The stamp names a record; it never identifies one.
const express = require('express');
const crypto = require('crypto');

const router = express.Router();
// Storage prefix. Overridable ONLY so the write path can be rehearsed against
// a throwaway folder before it runs against the real 993-recording archive.
const PREFIX = String(process.env.MEMO_PREFIX || 'memo-audio').replace(/\/+$/, '');
const MANIFEST = PREFIX + '/manifest.json';
const MAX_MIN = Number(process.env.MEMO_MAX_MINUTES || 45);
// Whisper's own hard cap is 25MB; leave headroom for the multipart wrapper.
const MAX_BYTES = 24 * 1024 * 1024;

let deps = { bucket: null, transcribe: null, chat: null };
function init(d) { deps = { ...deps, ...d }; }

// The endpoint spends money on transcription, so one address can't sit there
// burning it. A real catch-up run is ~100 files, so the ceiling is generous
// but finite.
const RATE_MAX = 250;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

// Categories the existing archive uses — a new memo has to file into the same
// buckets or the Dreams filter stops matching.
const CATEGORIES = [
  ['idea', 'A thought, plan, insight, brainstorm, or thing to make/try.'],
  ['dream', 'A recollection of a dream from sleep — surreal, narrated as something that happened while asleep.'],
  ['original', 'Singing, humming, a melody, lyrics, or an original musical sketch.'],
  ['cover', "Singing someone else's existing song."],
  ['todo', 'A task, reminder, errand, or something to do.'],
  ['journal', 'A personal reflection, feeling, or account of the day / what is going on.'],
  ['conversation', 'A recorded conversation between two or more people.'],
  ['quote', 'A quote, line, or fragment worth remembering — overheard or recited.'],
  ['note', 'A factual note, piece of info, name, number, or reference.'],
  ['transcription', 'Reading an older written journal entry aloud, rather than speaking in the moment.'],
  ['other', 'Does not clearly fit any category above.'],
];
const VALID_CATS = new Set(CATEGORIES.map(c => c[0]));

// Every naming scheme the exporter has used begins with the recording's local
// wall-clock stamp, so that prefix — not the filename — is the archive key.
const STAMP = /^\d{4}-\d{2}-\d{2}_\d{4}$/;
const stampOf = (s) => { const m = /^\d{4}-\d{2}-\d{2}_\d{4}/.exec(String(s || '')); return m ? m[0] : null; };

const md5Of = (buf) => crypto.createHash('md5').update(buf).digest('hex');

// ── the audio fingerprint ──────────────────────────────────────────────────
//
// Lives in its own dependency-free module (memo-fingerprint.js) because the
// Mac push needs the SAME function to prove a local recording is an already-
// archived one before correcting its date. Read the why-it-exists there.
const { audioHash } = require('./memo-fingerprint');

// ── the transcript backstop ────────────────────────────────────────────────
//
// The last line of defence, and the only one that needs no bytes at all: two
// records of the SAME LENGTH whose words agree are the same recording. It
// exists because a re-encode (not just a re-mux) changes the audio bytes too,
// which beats even the fingerprint above.
//
// The three gates are calibrated against the real archive, not guessed
// (2026-08-07, swept over all 1,117 records): exact duration + at least 40
// words + 90% word agreement flags the 9 genuine duplicates and NOTHING else.
// Every gate is load-bearing —
//   · EXACT duration, because Sophie re-records the same line constantly and
//     those takes land 1-2s apart (a ±2s slack wrongly flagged four of them);
//   · 40 WORDS, because an 8-second line repeated ten seconds later really is
//     word-for-word identical and is NOT a duplicate (2021-09-10_0024/_0025 —
//     two separate recordings, 4KB apart in size);
//   · 90%, because Whisper transcribes the same audio slightly differently
//     each run (that is exactly why the duplicates read as different memos).
// Re-run `node scripts/memo-dedupe.js` (bare = scan only) after moving any.
const DUP_MIN_WORDS = Number(process.env.MEMO_DUP_MIN_WORDS || 40);
const DUP_JACCARD = Number(process.env.MEMO_DUP_JACCARD || 0.9);
const wordsOf = (s) => String(s || '').toLowerCase().match(/[a-z0-9']+/g) || [];
function transcriptTwin(memos, { dur, transcript }) {
  const mine = wordsOf(transcript);
  if (mine.length < DUP_MIN_WORDS) return null;
  const A = new Set(mine);
  for (const m of memos) {
    if (!m.transcript || Number(m.dur) !== Number(dur)) continue;
    const other = wordsOf(m.transcript);
    if (other.length < DUP_MIN_WORDS) continue;
    const B = new Set(other);
    let both = 0;
    A.forEach((w) => { if (B.has(w)) both++; });
    if (both / (A.size + B.size - both) >= DUP_JACCARD) return m;
  }
  return null;
}

// Sophie's phone lives in Pacific time; the stamp is HER wall clock.
const MEMO_TZ = process.env.MEMO_TZ || 'America/Los_Angeles';
function stampInTz(date) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEMO_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}`;
}

// Is this stamp just "now"? Answered by rendering the stamps for the minutes
// either side of the server clock and looking for it, rather than by parsing a
// wall-clock string back through a named timezone — no DST arithmetic to get
// wrong, and it stays correct whatever MEMO_TZ is set to.
const NOW_STAMP_MINUTES = Number(process.env.MEMO_NOW_STAMP_MINUTES || 10);
function isNowish(stamp) {
  const now = Date.now();
  for (let d = -NOW_STAMP_MINUTES; d <= NOW_STAMP_MINUTES; d++) {
    if (stampInTz(new Date(now + d * 60000)) === stamp) return true;
  }
  return false;
}

// The m4a's mvhd creation time (QuickTime epoch, 1904-01-01 UTC). This is the
// moment the recording was FINALIZED — i.e. when it stopped — so callers
// subtract the duration to approximate the start, which is the time Voice
// Memos displays. Best effort only; md5 is the real dedupe key for anything
// stamped this way.
function mvhdDate(buf) {
  const i = buf.indexOf('mvhd');
  if (i < 0 || i + 24 > buf.length) return null;
  const ver = buf[i + 4];
  const secs = ver === 1 ? Number(buf.readBigUInt64BE(i + 8)) : buf.readUInt32BE(i + 8);
  if (!secs) return null;
  const d = new Date((secs - 2082844800) * 1000);
  const y = d.getUTCFullYear();
  return y > 2000 && y < 2100 ? d : null;
}

// The membry app is initialised lazily, so the getter is async.
async function bucket() {
  if (!deps.bucket) throw new Error('membry credential not configured');
  const b = await deps.bucket();
  if (!b) throw new Error('membry credential not configured');
  return b;
}
async function file() { return (await bucket()).file(MANIFEST); }

async function readManifest() {
  const f = await file();
  const [buf] = await f.download();
  const [meta] = await f.getMetadata();
  const m = JSON.parse(buf.toString());
  if (!m || !Array.isArray(m.memos)) throw new Error('manifest is not the expected shape');
  return { manifest: m, generation: meta.generation };
}

// Save the manifest back, guarding against a concurrent writer. Exported so
// the repair script edits the archive through the same contract the server
// uses instead of hand-rolling a second one.
async function writeManifest(manifest, generation) {
  manifest.memos.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  manifest.count = manifest.memos.length;
  await (await file()).save(JSON.stringify(manifest), {
    contentType: 'application/json',
    preconditionOpts: { ifGenerationMatch: generation },
  });
  return manifest.count;
}

// Append one record. Re-reads and retries on a generation conflict so two
// uploads landing together can't silently drop one of them.
//
// A MATCHING STAMP IS NOT A DUPLICATE, and never was — the stamp is only
// minute-resolution, and Sophie records several short thoughts back to back
// all the time. The archive holds 70 groups of recordings that honestly share
// a minute, so the rule was wrong about roughly one recording in fifteen.
// It cost a real one: re-filing a 28-minute recording from 2025-09-12 was
// refused because an unrelated 11-second clip (91KB against 14.2MB) had been
// made in the same minute. Identity is bytes or words — nothing else.
function findDuplicate(memos, record) {
  return memos.find(m => (record.hash && m.hash === record.hash)
      || (record.ahash && m.ahash === record.ahash))
    || transcriptTwin(memos, record);
}

async function appendToManifest(record) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { manifest, generation } = await readManifest();
    const dup = findDuplicate(manifest.memos, record);
    if (dup) return { skipped: true, memo: dup, count: manifest.count };
    manifest.memos.push(record);
    try {
      const count = await writeManifest(manifest, generation);
      return { skipped: false, count };
    } catch (err) {
      const code = err && (err.code || err.status);
      if (code !== 412 && attempt === 5) throw err;
      await new Promise(r => setTimeout(r, attempt * 400));
    }
  }
  throw new Error('could not update the manifest — too many concurrent writes');
}

// ── who wants to know when a recording lands ───────────────────────────────
//
// Search keeps an index of every transcript in the library, and an index that
// only moves when somebody taps a button is an index that is wrong: measured
// Aug 2026 it held 1,035 of these 1,137 recordings, so anything she had
// recorded lately returned NO hits — which reads as the recording not
// existing, not as a stale index.
//
// Listeners fire only when a record was really appended (never for a
// duplicate), and a listener that throws is swallowed: filing a recording is
// the important half and must not fail because something downstream did.
const filedListeners = [];
function onFiled(fn) { if (typeof fn === 'function') filedListeners.push(fn); }
function notifyFiled(record) {
  for (const fn of filedListeners) {
    try { fn(record); } catch (err) { console.warn('memo onFiled listener failed —', err.message); }
  }
}

async function classify(transcript, spokenTitle) {
  if (!deps.chat) return null;
  const list = CATEGORIES.map(([k, d]) => `- ${k}: ${d}`).join('\n');
  try {
    const out = await deps.chat({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You sort a personal voice memo into exactly one category and describe it.\n\nCategories:\n${list}\n\nReturn JSON only, shaped: {"category":"<key>","title":"<4-6 word title>","description":"<1-2 sentence summary in the third person>","keywords":["3-6 short keywords"]}` },
        { role: 'user', content: `Recording title as saved on the phone: ${spokenTitle || '(none)'}\n\nTranscript:\n"""${String(transcript).slice(0, 12000)}"""` },
      ],
    });
    const txt = out && out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content;
    const j = JSON.parse(String(txt || '{}').replace(/^```json\s*|```$/g, ''));
    return VALID_CATS.has(j.category) ? j : { ...j, category: 'other' };
  } catch (err) {
    console.warn('memo classify failed —', err.message);
    return null;
  }
}

// ── fileIntoArchive — THE one way a recording enters the library ───────────
//
// Every entry point (the /ingest route, audio.js's drop, the Story Room
// voiceover paste, a backfill script) funnels through here. Contract:
//
//   BANK FIRST, ENRICH AFTER. The audio is stored and the record appended even
//   when transcription fails (cat 'note' + enrichError on the record) — a
//   Whisper blip must never lose a recording. Transcription is unconditional
//   otherwise (no toggle; Sophie 2026-08-05).
//
//   stamp: pass it when you truly know it (the Mac reads it off the Voice
//   Memos database). Leave it null otherwise — it's derived from the file's
//   mvhd time minus the duration, marked untrusted, and md5 does the deduping.
//
//   transcript: pass it if the caller already paid Whisper for these bytes
//   (audio.js does) so the same audio is never transcribed twice.
//
// Returns { skipped, reason?, memo, count }.
async function fileIntoArchive({ buf, ext = 'm4a', title = '', dur = 0, stamp = null, iso = '', transcript = null, source = null }) {
  if (!buf || !buf.length) throw new Error('empty audio');
  if (!/^[a-z0-9]{2,4}$/i.test(ext)) ext = 'm4a';
  const hash = md5Of(buf);
  const ahash = audioHash(buf);
  dur = Math.max(0, Math.round(Number(dur) || 0));

  // A stamp equal to RIGHT NOW is a caller guessing, not a caller knowing —
  // it is the filing time, not the recording time. 12 records got in that way
  // (found 2026-08-07, gaps of 0-3 minutes from their own upload), and it is
  // how the same recording lands twice under two different days. A stamp
  // nobody vouches for still names the record — it just earns the id a hash
  // suffix, so two recordings that derive the same minute can't collide.
  let stampKnown = Boolean(stamp);
  if (stampKnown && isNowish(stamp)) stampKnown = false;
  let recordedAt = null;
  if (!stamp) {
    const end = mvhdDate(buf);
    recordedAt = end ? new Date(end.getTime() - Math.min(dur, 6 * 3600) * 1000) : new Date();
    stamp = stampInTz(recordedAt);
  }
  if (!STAMP.test(stamp)) throw new Error('stamp must look like 2026-07-15_0812');

  // Cheap checks before doing any paid work. The fingerprint catches a
  // re-shared recording that the file md5 cannot see; the transcript backstop
  // below catches a re-ENCODED one, but only once we have words for it. A
  // shared STAMP is deliberately not consulted — see findDuplicate.
  const { manifest } = await readManifest();
  const dupHash = manifest.memos.find(m => m.hash === hash || (ahash && m.ahash === ahash));
  if (dupHash) return { skipped: true, reason: 'same recording already archived', memo: dupHash, count: manifest.count };

  const isoStr = iso || (recordedAt ? recordedAt.toISOString() : '');
  let id = isoStr ? `${stamp}_${String(isoStr).replace(/[:.]/g, '_').replace(/_\d+Z$/, 'Z')}` : stamp;
  // A derived stamp comes from the file's own clock, so two different
  // recordings can honestly derive the SAME id — and the second would save
  // over the first's audio at memo-audio/<id>. A slice of the hash keeps
  // derived ids unique per content (caught in rehearsal, 2026-08-05).
  if (!stampKnown) id += '_' + hash.slice(0, 6);
  const date = stamp.slice(0, 10);

  let cat = 'toolong', sort = null, enrichError = null;
  transcript = transcript == null ? null : String(transcript).trim();
  const tooBig = buf.length > MAX_BYTES;
  if (dur / 60 <= MAX_MIN && !tooBig) {
    try {
      if (transcript == null) {
        const t = await deps.transcribe(buf, 'memo.' + ext);
        transcript = String((t && t.text) || '').trim();
      }
      if (transcript.length < 8) { cat = 'empty'; transcript = null; }
      else { sort = await classify(transcript, title); cat = (sort && sort.category) || 'other'; }
    } catch (err) {
      // Bank it anyway — enrichable later, never lost.
      console.warn('memo enrich failed (banking anyway) —', err.message);
      cat = 'note'; transcript = null;
      enrichError = String(err.message || err).slice(0, 300);
    }
  }

  // Now that there are words, the backstop can answer — BEFORE the audio is
  // uploaded, so a duplicate costs one transcription and no storage.
  const twin = transcriptTwin(manifest.memos, { dur, transcript });
  if (twin) {
    return { skipped: true, reason: 'the same recording is already archived (same words, same length)', memo: twin, count: manifest.count };
  }

  const objectPath = `${PREFIX}/${id}.${ext}`;
  await (await bucket()).file(objectPath).save(buf, {
    contentType: ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : 'audio/' + ext,
  });

  const record = {
    id, file: `${id}.${ext}`, date, cat,
    title: (sort && sort.title) || title || null,
    desc: (sort && sort.description) || null,
    keywords: (sort && sort.keywords) || [],
    dur, transcript: transcript || null,
    hash,
  };
  if (ahash) record.ahash = ahash;
  if (source) record.source = source;
  if (enrichError) record.enrichError = enrichError;
  const merged = await appendToManifest(record);
  // Another upload won the race, so these bytes have no record pointing at
  // them. Left behind they become an orphan object nothing can ever reach —
  // five of those were already sitting in the archive (one of them 14MB).
  if (merged.skipped) {
    await (await bucket()).file(objectPath).delete().catch(() => {});
  } else {
    notifyFiled(record);
  }
  return {
    skipped: !!merged.skipped,
    reason: merged.skipped ? 'landed concurrently' : undefined,
    memo: merged.memo || record,
    count: merged.count,
    tooBig: tooBig || undefined,
  };
}

// ── routes ─────────────────────────────────────────────────────────────────
// Open, like the other /status endpoints: it reveals counts and stamps, not
// transcripts, and the Mac script needs it before it has anything to send.
router.get('/status', async (req, res) => {
  try {
    if (!deps.bucket) return res.json({ ok: false, error: 'membry credential not configured' });
    const { manifest } = await readManifest();
    const stamps = manifest.memos.map(m => stampOf(m.id) || stampOf(m.file)).filter(Boolean);
    res.json({
      ok: true,
      count: manifest.count,
      newest: manifest.memos.map(m => m.date).filter(Boolean).sort().pop() || null,
      maxMinutes: MAX_MIN,
      stamps,
      // What the Mac push skips on. A stamp ALONE would skip a genuinely new
      // recording made in the same minute as an archived one — and the Mac
      // filters before uploading, so that recording would never be sent at
      // all. Duration comes free from the Voice Memos database, costs no file
      // reading, and separates them. A false send is harmless now (the server
      // has three real layers); a false skip loses a recording for good.
      keys: manifest.memos.map(m => `${stampOf(m.id) || ''}|${Math.round(Number(m.dur) || 0)}`),
      // Content hashes, so a caller can skip a big upload it already knows is
      // archived (the backfill script reads this).
      hashes: manifest.memos.map(m => m.hash).filter(Boolean),
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

const gate = (req, res, next) => {
  const token = process.env.STUDIO_TOKEN;
  if (!token) return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  res.status(401).json({ error: 'unauthorized' });
};

// POST /ingest?stamp=2026-07-15_0812&iso=...&title=...&dur=95&ext=m4a
// Body: the raw audio bytes.
//
// This is also THE documented call for a chat with a pasted recording: POST
// the bytes with just title/dur/ext — `stamp` is OPTIONAL now (Aug 2026).
// Without it the server derives one from the file's own timestamp and the md5
// carries the dedupe, so a chat never has to reconstruct wall-clock time
// (which went wrong for real — see the module header).
//
// transcribe=0 is IGNORED (Aug 2026, Sophie: transcription is unconditional).
// The 120mb cap lets long saved-from-video audio archive at all; anything
// over Whisper's 24MB still files as 'toolong' with no transcript rather
// than bouncing.
router.post('/ingest', gate, express.raw({ type: '*/*', limit: '120mb' }), async (req, res) => {
  try {
    if (!deps.bucket) return res.status(503).json({ error: 'membry credential not configured' });
    const ip = req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many uploads from this address — try again later' });

    const q = req.query || {};
    const stamp = String(q.stamp || '');
    if (stamp && !STAMP.test(stamp)) return res.status(400).json({ error: 'stamp must look like 2026-07-15_0812' });
    const buf = req.body;
    if (!buf || !buf.length) return res.status(400).json({ error: 'empty body — POST the audio as the request body' });

    const out = await fileIntoArchive({
      buf,
      ext: String(q.ext || '').toLowerCase(),
      title: String(q.title || '').slice(0, 200),
      dur: q.dur,
      stamp: stamp || null,
      iso: String(q.iso || ''),
      source: String(q.source || '').slice(0, 40) || null,
    });
    res.json({ ok: true, skipped: out.skipped, reason: out.reason, count: out.count, memo: out.memo, tooBig: out.tooBig });
  } catch (err) {
    console.warn('memo ingest failed —', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── correcting a date nobody vouched for ────────────────────────────────────
//
// A recording shared off the phone carries NO record of when it was made.
// iOS rewrites the m4a's QuickTime clock on every export, so the file says
// "when it was shared", and Voice Memos puts no ©day / title atom in the
// exported copy at all — measured on a real share: the only tags that survive
// are the rewritten creation_time and the encoder's iTunSMPB. So a memo filed
// from a chat upload or the share sheet gets a stamp derived from that
// rewritten clock, and the id carries a hash suffix to say so.
//
// The true date is not lost — it is in Apple's own Voice Memos database
// (ZCLOUDRECORDING.ZDATE), which only Sophie's Mac can read. That is what the
// Mac push already reads, so it is the one thing in the system that can
// answer this, and `scripts/push-memos.mjs` now heals these records on every
// run. The pairing is done on the AUDIO FINGERPRINT, never on duration or
// title: the local recording and the shared copy differ only in their date
// fields, so the fingerprint matches exactly and a wrong record can't be
// re-dated by coincidence.
const DERIVED_ID = /_[0-9a-f]{6}$/;

// The records whose date is a guess. Small by construction — everything the
// Mac push files carries a real stamp — so this is a plain manifest scan.
function unstampedRecords(memos) {
  return memos.filter(m => DERIVED_ID.test(m.id)).map(m => ({
    id: m.id, dur: m.dur, ahash: m.ahash || null, hash: m.hash || null,
    title: m.title || null, date: m.date, cat: m.cat,
  }));
}

// Give one record its real date. The id encodes the stamp, and the audio
// object is named after the id, so this moves bytes as well as editing the
// manifest — and the manifest is backed up beside itself first, the same
// contract scripts/memo-dedupe.js uses, so every repair is reversible by hand.
async function restampRecord({ id, stamp, iso = '', force = false }) {
  if (!STAMP.test(stamp)) throw new Error('stamp must look like 2026-07-15_0812');
  const b = await bucket();
  const { manifest, generation } = await readManifest();
  const rec = manifest.memos.find(m => m.id === id);
  if (!rec) throw new Error('no record with that id');
  if (!DERIVED_ID.test(rec.id) && !force) {
    throw new Error('that record already has a date somebody vouched for — pass force to overrule it');
  }

  const ext = (String(rec.file || '').split('.').pop() || 'm4a').toLowerCase();
  const isoStr = iso || '';
  let newId = isoStr
    ? `${stamp}_${String(isoStr).replace(/[:.]/g, '_').replace(/_\d+Z$/, 'Z')}`
    : stamp;
  if (newId === rec.id) return { changed: false, memo: rec, count: manifest.count };
  if (manifest.memos.some(m => m.id === newId)) throw new Error(`another record is already called ${newId}`);

  await backupManifest(manifest, 'prerestamp');

  // Move the audio first. If this throws, the manifest still points at bytes
  // that exist — the opposite order would leave a record pointing at nothing.
  const from = `${PREFIX}/${rec.file}`;
  const to = `${PREFIX}/${newId}.${ext}`;
  const [exists] = await b.file(from).exists();
  if (exists) await b.file(from).move(to);

  const was = rec.id;
  rec.id = newId;
  rec.file = `${newId}.${ext}`;
  rec.date = stamp.slice(0, 10);
  rec.restampedFrom = was;
  const count = await writeManifest(manifest, generation);
  // A restamp gives a record a NEW id, which to an index keyed by id is a
  // recording gone and another arrived — so the same listeners hear about it
  // and Search re-files its passages under the id it now has.
  notifyFiled(rec);
  return { changed: true, was, memo: rec, count };
}

async function backupManifest(manifest, tag) {
  const name = `${PREFIX}/manifest-backup-${new Date().toISOString().slice(0, 10)}-${tag}.json`;
  await (await bucket()).file(name).save(JSON.stringify(manifest), { contentType: 'application/json' });
}

// GET /unstamped — the records whose date is only a guess, so a client that
// CAN answer (the Mac, which has Apple's database) knows what to look up.
router.get('/unstamped', gate, async (req, res) => {
  try {
    const { manifest } = await readManifest();
    res.json({ ok: true, records: unstampedRecords(manifest.memos) });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// POST /restamp {id, stamp, iso?, force?} — file one record under its real date.
router.post('/restamp', gate, express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const { id, stamp, iso, force } = req.body || {};
    if (!id || !stamp) return res.status(400).json({ error: 'need id and stamp' });
    const out = await restampRecord({ id: String(id), stamp: String(stamp), iso: String(iso || ''), force: Boolean(force) });
    res.json({ ok: true, ...out });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /audio/:id — stream one recording so the dream archive page can play it.
//
// memo-audio/** is readable only by a signed-in Firebase user, and the archive
// page has no Firebase session, so the audio has to come through the server.
// Deliberately narrow: it serves ONLY recordings the archive categorises as
// dreams, so the other ~940 private recordings stay exactly as locked down as
// they are today.
//
// `streamMemoAudio` below is the SAME streamer without that category filter —
// Search (search.js) plays any hit it returns, behind its own studio gate.
// Keep the range/content-type handling here only; two copies would drift.
router.get('/audio/:id', gate, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^[\w.\-:]{8,120}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    await streamMemoAudio(id, req, res, { dreamsOnly: true });
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message });
  }
});

// Stream one archived recording, with byte-range support so scrubbing works
// instead of re-downloading on every seek. `dreamsOnly` keeps the historical
// restriction on the public-ish dream archive route above; Search passes it
// false because a search hit you cannot play is not a result.
async function streamMemoAudio(id, req, res, { dreamsOnly = false } = {}) {
  try {
    const { manifest } = await readManifest();
    const memo = manifest.memos.find(m => m.id === id || m.file === id);
    if (!memo) return res.status(404).json({ error: 'not in the archive' });
    if (dreamsOnly && memo.cat !== 'dream') {
      return res.status(403).json({ error: 'only dream recordings are served here' });
    }

    const f = (await bucket()).file(`${PREFIX}/${memo.file}`);
    const [exists] = await f.exists();
    if (!exists) return res.status(404).json({ error: 'audio missing from storage' });
    const [meta] = await f.getMetadata();
    const total = Number(meta.size || 0);
    // Storage records some of these as audio/mp4a-latm, which iOS Safari won't
    // reliably play. An .m4a is audio/mp4 as far as a browser is concerned, so
    // normalise rather than passing the stored value straight through.
    const stored = String(meta.contentType || '');
    const ext = (memo.file.split('.').pop() || 'm4a').toLowerCase();
    const type = /^audio\/(mp4|mpeg|aac|wav|ogg|webm)$/.test(stored) ? stored
      : (ext === 'm4a' || ext === 'mp4' || ext === 'aac') ? 'audio/mp4'
      : (ext === 'mp3') ? 'audio/mpeg'
      : (stored || 'audio/mp4');
    res.set('Content-Type', type);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'private, max-age=3600');

    // Range support, so scrubbing works instead of re-downloading each seek.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && total) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
      if (start >= total || start > end) {
        res.set('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${total}`);
      res.set('Content-Length', String(end - start + 1));
      return f.createReadStream({ start, end }).on('error', () => res.destroy()).pipe(res);
    }
    if (total) res.set('Content-Length', String(total));
    f.createReadStream().on('error', () => res.destroy()).pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message });
  }
}

// Download one memo's audio to a local file — for tools that need to CUT it
// (Search's clip-from-a-hit), since memo bytes are not public and ffmpeg
// can't seek the gated stream. Returns the memo record alongside the path.
async function memoAudioToFile(id, destPath) {
  const { manifest } = await readManifest();
  const memo = manifest.memos.find(m => m.id === id || m.file === id);
  if (!memo) throw new Error('not in the archive');
  await (await bucket()).file(`${PREFIX}/${memo.file}`).download({ destination: destPath });
  return memo;
}

// readManifest is exported so Search can index the archive's transcripts
// without a second copy of the manifest contract; onFiled is how it hears
// about a new one without either module requiring the other in a circle.
module.exports = {
  router, init, fileIntoArchive, md5Of, audioHash, transcriptTwin,
  unstampedRecords, restampRecord, onFiled,
  readManifest, writeManifest, streamMemoAudio, memoAudioToFile,
};

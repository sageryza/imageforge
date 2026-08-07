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
// dedupe is belt AND braces: the md5 of the bytes (`hash` on every record)
// plus the local wall-clock stamp. Stamp alone is fragile — a caller that
// isn't the Mac has to reconstruct it from the file's internal timestamp,
// which is the moment the recording STOPPED and can be minutes off (learned
// live 2026-08-05: filed _1330, phone said 1:28). md5 alone breaks if a path
// re-encodes. Together they hold.
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

// Append one record. Re-reads and retries on a generation conflict so two
// uploads landing together can't silently drop one of them. trustStamp=false
// (a stamp the SERVER derived from the file, not one the Mac read off the
// Voice Memos database) means a stamp collision does NOT skip — two different
// recordings can honestly share a minute, and a derived stamp can be wrong by
// one — only a hash match does.
async function appendToManifest(record, { trustStamp = true } = {}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { manifest, generation } = await readManifest();
    const dup = manifest.memos.find(m => (record.hash && m.hash === record.hash)
      || (trustStamp && stampOf(m.id) === stampOf(record.id)));
    if (dup) return { skipped: true, memo: dup, count: manifest.count };
    manifest.memos.push(record);
    manifest.memos.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
    manifest.count = manifest.memos.length;
    try {
      await (await file()).save(JSON.stringify(manifest), {
        contentType: 'application/json',
        preconditionOpts: { ifGenerationMatch: generation },
      });
      return { skipped: false, count: manifest.count };
    } catch (err) {
      const code = err && (err.code || err.status);
      if (code !== 412 && attempt === 5) throw err;
      await new Promise(r => setTimeout(r, attempt * 400));
    }
  }
  throw new Error('could not update the manifest — too many concurrent writes');
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
  dur = Math.max(0, Math.round(Number(dur) || 0));

  const trustStamp = Boolean(stamp);
  let recordedAt = null;
  if (!stamp) {
    const end = mvhdDate(buf);
    recordedAt = end ? new Date(end.getTime() - Math.min(dur, 6 * 3600) * 1000) : new Date();
    stamp = stampInTz(recordedAt);
  }
  if (!STAMP.test(stamp)) throw new Error('stamp must look like 2026-07-15_0812');

  // Cheap check before doing any paid work.
  const { manifest } = await readManifest();
  const dupHash = manifest.memos.find(m => m.hash === hash);
  if (dupHash) return { skipped: true, reason: 'same audio already archived', memo: dupHash, count: manifest.count };
  if (trustStamp) {
    const dupStamp = manifest.memos.find(m => stampOf(m.id) === stamp);
    if (dupStamp) return { skipped: true, reason: 'already in the archive', memo: dupStamp, count: manifest.count };
  }

  const isoStr = iso || (recordedAt ? recordedAt.toISOString() : '');
  let id = isoStr ? `${stamp}_${String(isoStr).replace(/[:.]/g, '_').replace(/_\d+Z$/, 'Z')}` : stamp;
  // A derived stamp comes from the file's own clock, so two different
  // recordings can honestly derive the SAME id — and the second would save
  // over the first's audio at memo-audio/<id>. A slice of the hash keeps
  // derived ids unique per content (caught in rehearsal, 2026-08-05).
  if (!trustStamp) id += '_' + hash.slice(0, 6);
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

  await (await bucket()).file(`${PREFIX}/${id}.${ext}`).save(buf, {
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
  if (source) record.source = source;
  if (enrichError) record.enrichError = enrichError;
  const merged = await appendToManifest(record, { trustStamp });
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

// readManifest is exported so Search can index the archive's transcripts
// without a second copy of the manifest contract.
module.exports = { router, init, fileIntoArchive, md5Of, readManifest, streamMemoAudio };

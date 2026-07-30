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
const express = require('express');

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
// uploads landing together can't silently drop one of them.
async function appendToManifest(record) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { manifest, generation } = await readManifest();
    if (manifest.memos.some(m => stampOf(m.id) === stampOf(record.id))) return { skipped: true, count: manifest.count };
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
router.post('/ingest', gate, express.raw({ type: '*/*', limit: '30mb' }), async (req, res) => {
  try {
    if (!deps.bucket) return res.status(503).json({ error: 'membry credential not configured' });
    const ip = req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many uploads from this address — try again later' });

    const q = req.query || {};
    const stamp = String(q.stamp || '');
    if (!STAMP.test(stamp)) return res.status(400).json({ error: 'stamp must look like 2026-07-15_0812' });
    const dur = Math.max(0, Math.round(Number(q.dur) || 0));
    const ext = /^[a-z0-9]{2,4}$/i.test(String(q.ext || '')) ? String(q.ext).toLowerCase() : 'm4a';
    const title = String(q.title || '').slice(0, 200);
    const iso = String(q.iso || '');
    const buf = req.body;
    if (!buf || !buf.length) return res.status(400).json({ error: 'empty body — POST the audio as the request body' });

    // Cheap check before doing any paid work.
    const { manifest } = await readManifest();
    if (manifest.memos.some(m => stampOf(m.id) === stamp)) {
      return res.json({ ok: true, skipped: true, reason: 'already in the archive', count: manifest.count });
    }

    const id = iso ? `${stamp}_${iso.replace(/[:.]/g, '_').replace(/_\d+Z$/, 'Z')}` : stamp;
    const date = stamp.slice(0, 10);

    let cat = 'toolong', transcript = null, sort = null;
    const tooBig = buf.length > MAX_BYTES;
    if (dur / 60 <= MAX_MIN && !tooBig) {
      const t = await deps.transcribe(buf, 'memo.' + ext);
      transcript = String((t && t.text) || '').trim();
      if (transcript.length < 8) { cat = 'empty'; transcript = null; }
      else { sort = await classify(transcript, title); cat = (sort && sort.category) || 'other'; }
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
    };
    const merged = await appendToManifest(record);
    res.json({ ok: true, skipped: !!merged.skipped, count: merged.count, memo: record, tooBig: tooBig || undefined });
  } catch (err) {
    console.warn('memo ingest failed —', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = { router, init };

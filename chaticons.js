// chaticons.js — the little drawing beside every chat's name in the Chats app.
//
// WHY THIS EXISTS
// A chat with no picture used to draw a box with a giant letter in it, and
// Sophie asked for real icons instead. 253 were drawn by hand in one sitting
// (scripts/gen-chat-icons.js, which is still the way to redraw a specific set),
// and then 104 new chats appeared in the following HOUR. Hand-running a batch
// can never keep up with that, so this sweeps on its own.
//
// THE ECONOMICS ARE THE WHOLE DESIGN — IT WAITS ON PURPOSE
// 25 drawings go on ONE gpt-image-2 sheet (~6c), so an icon costs about 0.24c.
// Drawing each chat the moment it appears would be a separate ~6c call — 25x
// the price for the same pictures. So the sweep holds new chats until there are
// enough to fill a sheet, and a brand-new chat wears a letter for a day or two.
// That is the trade, and it is the right way round.
//
// WHAT IT SKIPS, AND WHY
// - ARCHIVED chats (Sophie, Aug 2026: "obviously skip archived chats"). She is
//   done with them; spending on one is spending on a chat she has filed away.
//   The 86 archived ones drawn in the first hand-run stay as they are — this is
//   about what we spend NEXT, not a reason to take a picture off anything.
// - Chats in the TRASH, for the same reason only harder.
// - A chat with NOTHING to draw from — no name she gave it, no note, no status
//   or update card, and a generic slug (`new-session-7f3e9a`). There is no
//   picture of "an unnamed session", and a wrong one is worse than a letter.
//   It comes back into range by itself the moment the chat says what it is.
//
// WHAT IT DRAWS FROM
// The registry the feed already loads — her display name, her note, the chat's
// own status/update cards, its wrap-up, and the slug. NOT the threads: reading
// 600 conversations to pick 600 doodles is a cost with no matching benefit, and
// the registry line is what the chat itself says it is about.
//
// THE TRACER IS NOT IN THIS PATH, DELIBERATELY
// /api/vector/sheet draws, cuts AND traces each cell to SVG, and the trace is
// what hangs: two separate sheets stalled for half an hour on one cell with the
// other 24 finished. An icon needs the CUT, never the SVG. So this calls the
// vector module's `drawSheet` + `sheetPrompt` and vectorize's `slice`/`cutout`
// directly and never goes near `traceOne`.
//
// ROUTES
//   GET  /status                what is waiting, when it last ran (open, free)
//   GET  /waiting               the chats it would draw next, with their lines
//   POST /run { limit?, dry?, force? }  sweep now — background job, returns an id
//   GET  /run/:id               poll one run
//   GET  /runs                  recent runs
//
// HER HOURS: the automatic tick only fires between 11am and 11pm Pacific (her
// ask, and her clock — she is Pacific, not UTC). A hand `POST /run` is not
// bound by it. Only ONE run goes at a time, tick or hand: two runs each read
// who is waiting at their own start and then draw the same chats twice.
//
// The DAILY tick lives in server.js and calls `sweepDue()` — see that block.
// Nothing here is on a timer of its own; a module that schedules itself would
// keep running in every dev container that happens to boot the app.

const express = require('express');
const admin = require('firebase-admin');
const sharp = require('sharp');
const anthropic = require('./anthropic');
const { HOUSE, LAYOUT, MAX_CELLS, sheetPrompt, drawSheet } = require('./vector');
const { slice, cutout } = require('./vectorize');
const { registry, regRef } = require('./chatfeed');

const router = express.Router();
const COL = 'forge-chat-icons';
const STATE = '__state';
const ICON_PATH = (chat) => `chat-feed/icons/${String(chat).replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
const PER_SHEET = MAX_CELLS;              // 25 — the 5x5 the sheet prompt tops out at
const QUALITY = 'medium';                 // ~6c a sheet; low loses the small detail
const DUE_MS = 20 * 60 * 60 * 1000;       // "daily", loosely — see sweepDue

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();
const stateRef = () => db().collection(COL).doc(STATE);

// ---- the gate (audio.js's, verbatim in shape) ------------------------------
router.use((req, res, next) => {
  const want = process.env.STUDIO_TOKEN;
  if (!want || req.path === '/status') return next();
  const got = req.get('x-studio-token') || req.query.token;
  if (got === want) return next();
  res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '256kb' }));

// ---- who needs one --------------------------------------------------------

// A slug that says nothing about the chat. These are the branch names an
// unnamed session gets, and drawing one would be inventing a subject.
const GENERIC = /^(new-session|session|untitled|chat)(-[a-z0-9]{4,8})?$/i;

/** Everything the sweep is allowed to know about a chat, as one line. */
function lineFor(name, r) {
  const bits = [
    r.displayName && `called "${r.displayName}"`,
    r.sophieNote && `her note: ${r.sophieNote}`,
    r.updAsked && `she asked: ${r.updAsked}`,
    r.statusDoing && `doing: ${r.statusDoing}`,
    r.wrapLine && `wrap-up: ${r.wrapLine}`,
  ].filter(Boolean);
  return bits.join(' | ').slice(0, 260);
}

/** True when there is enough on the record to draw an honest picture. */
function drawable(name, r) {
  if (lineFor(name, r)) return true;
  return !GENERIC.test(name);            // a descriptive slug is enough on its own
}

/** The chats waiting for a picture, most recently active first. */
function waitingFrom(chats) {
  return Object.keys(chats)
    .filter((name) => {
      const r = chats[name] || {};
      // The reserved settings doc is not a chat. `registry()` already strips it,
      // so this is belt and braces — but a phantom row in her list is exactly
      // the failure mode a made-up chat name caused once before, and drawing a
      // picture for one would make it look real.
      if (name.startsWith('__')) return false;
      if (r.icon) return false;
      if (r.deletedAt) return false;      // in the trash
      if (r.archived) return false;       // her rule — see the header
      return drawable(name, r);
    })
    .sort((a, b) => String(chats[b].lastSeen || '').localeCompare(String(chats[a].lastSeen || '')))
    .map((name) => ({ chat: name, about: lineFor(name, chats[name]) || `slug: ${name}` }));
}

// ---- what each one draws --------------------------------------------------

const SUBJECT_SYSTEM = [
  'You name what a tiny icon shows. Each icon sits beside a chat name in a phone app,',
  'about 40 pixels across, drawn as a flat pastel line illustration.',
  'For each chat you are given, answer with ONE short noun phrase naming a concrete,',
  'physical thing to draw — 4 to 12 words, no sentence, no verb clause.',
  'RULES:',
  '- Concrete objects only. A feeling, a concept or an abstraction cannot be drawn at this size.',
  '- NEVER any text, letters, numbers, logos or written words in the picture.',
  '- No real person and no face that has to be recognisable as someone.',
  '- Make the items in one batch VISUALLY DISTINCT from each other — vary the object,',
  '  do not answer "a speech bubble" six times. Reach for the specific noun in the chat.',
  '- A picture of the SUBJECT, not of the software: prefer the thing the chat is about.',
].join('\n');

/** Ask Claude for one drawing subject per chat. One call for the whole batch.
 *
 *  IT THROWS RATHER THAN COMING BACK EMPTY, and that is the fix for a real
 *  failure: the first live run drew 76 of 101 because one batch's naming call
 *  came back unparseable, the old code swallowed it into blank subjects, and
 *  `drawBatch` then had nothing to draw — so 25 chats were skipped with a
 *  `done` run, no error, and nothing on the record saying they had been. A
 *  daily job that fails silently is a daily job that quietly stops working.
 *  The caller records the batch as failed and carries on to the next one. */
async function subjectsFor(items) {
  if (!anthropic.available()) throw new Error('ANTHROPIC_API_KEY not set — the subjects are written by Claude');
  const user = 'Name the icon for each of these chats.\n\n'
    + items.map((it, i) => `${i + 1}. slug: ${it.chat}\n   ${it.about}`).join('\n')
    + '\n\nAnswer as JSON: {"icons":[{"n":1,"draw":"..."}, ...]} with one entry per numbered chat, in order.';
  // 120 tokens a chat: the answers run 4-12 words, and the cap is what truncated
  // the JSON mid-array on the batch that failed.
  const out = await anthropic.chatJSON({ system: SUBJECT_SYSTEM, user, maxTokens: 120 * items.length + 400 });
  const byN = new Map((out && out.icons ? out.icons : []).map((x) => [Number(x.n), String(x.draw || '').trim()]));
  const named = items.map((it, i) => ({ chat: it.chat, draw: byN.get(i + 1) || '' }));
  if (!named.some((x) => x.draw)) throw new Error('no subjects came back for this batch');
  return named;
}

// ---- drawing one sheet ----------------------------------------------------

/** Draw one sheet of up to 25, cut it, and give each cell to its chat.
 *  Returns { drawn:[chat…], sheet, failed:[{chat,error}…] }. */
async function drawBatch(items) {
  const cells = items.filter((it) => it.draw);
  if (!cells.length) return { drawn: [], failed: [], sheet: '' };
  const [cols, rows] = LAYOUT[cells.length] || LAYOUT[PER_SHEET];
  const prompt = sheetPrompt(cells, 'pastel');
  const png = await drawSheet(prompt, { quality: QUALITY });

  // Bank the sheet BEFORE cutting. A cut can be redone for nothing; the draw is
  // the only part that costs money, and a crash between the two would burn it.
  const sheetUrl = await put(png, `chat-feed/icon-sheets/${Date.now().toString(36)}.png`);

  const pieces = await slice(png, cols, rows);
  const drawn = [];
  const failed = [];
  for (let i = 0; i < cells.length; i++) {
    try {
      let cell = pieces[i];
      try { cell = await cutout(cell); } catch (e) { /* keep the raw cell */ }
      const icon = await sharp(cell)
        .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      const url = await put(icon, ICON_PATH(cells[i].chat));
      await regRef(cells[i].chat).set({ icon: `${url}?v=${Date.now()}` }, { merge: true });
      drawn.push(cells[i].chat);
    } catch (e) {
      // One bad cell costs its own chat, never the other 24.
      failed.push({ chat: cells[i].chat, error: String(e.message || e) });
    }
  }
  return { drawn, failed, sheet: sheetUrl, prompt };
}

async function put(buf, path) {
  const file = bucket().file(path);
  await file.save(buf, { contentType: 'image/png', resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${file.name}`;
}

// ---- the run (a background job on its own doc) ----------------------------

async function patch(id, fields) {
  await db().collection(COL).doc(id).set(fields, { merge: true });
}

async function runSweep(id, { limit = PER_SHEET } = {}) {
  try {
    const { chats } = await registry();
    const waiting = waitingFrom(chats);
    const take = waiting.slice(0, Math.max(1, Math.min(200, limit)));
    await patch(id, { waiting: waiting.length, taking: take.length, step: 'naming' });

    const drawn = [];
    const failed = [];
    const sheets = [];
    for (let i = 0; i < take.length; i += PER_SHEET) {
      const batch = take.slice(i, i + PER_SHEET);
      // ONE BAD BATCH COSTS ITS OWN 25, NEVER THE RUN — and it says so on the
      // doc. The chats in it keep no icon, so the next sweep picks them up
      // again by itself; what must not happen is the run reporting `done` with
      // them quietly missing, which is what the first live run did.
      try {
        await patch(id, { step: `naming ${i + 1}-${i + batch.length} of ${take.length}` });
        const named = await subjectsFor(batch);
        await patch(id, { step: `drawing ${i + 1}-${i + batch.length} of ${take.length}` });
        const out = await drawBatch(named);
        drawn.push(...out.drawn);
        failed.push(...out.failed);
        if (out.sheet) sheets.push(out.sheet);
      } catch (e) {
        failed.push(...batch.map((b) => ({ chat: b.chat, error: String(e.message || e) })));
      }
      await patch(id, { drawn, failed, sheets });
    }
    await patch(id, { status: 'done', step: '', drawn, failed, sheets, finishedAt: new Date().toISOString(), cost: sheets.length * 0.06 });
    await stateRef().set({ lastRunAt: new Date().toISOString(), lastRunId: id, lastDrawn: drawn.length }, { merge: true });
  } catch (e) {
    await patch(id, { status: 'failed', step: '', error: String(e.message || e) });
    // The clock still moves on a failure, so a permanently broken sweep retries
    // once a day rather than on every hourly tick.
    await stateRef().set({ lastRunAt: new Date().toISOString(), lastError: String(e.message || e) }, { merge: true });
  }
}

/** Is a run going right now?
 *
 *  A LOCK, BECAUSE TWO RUNS DRAW THE SAME CHATS TWICE. Found live: the daily
 *  tick fired four minutes into a hand-run and both were working off their own
 *  snapshot of who was waiting, so a sheet's worth of chats was drawn, filed,
 *  and then drawn and filed again — about 6c for nothing. Each run reads
 *  `waitingFrom` once at the start and nothing re-checks mid-run, which is
 *  right for a single run and exactly what makes two of them collide.
 *
 *  The staleness window is cutmarks.js's takeover rule: a run still marked
 *  `running` after 20 minutes is a job whose process died (a deploy mid-sweep),
 *  and it must not wedge the sweep forever. */
const STALE_RUN_MS = 20 * 60 * 1000;
async function runningNow() {
  const q = await db().collection(COL).where('status', '==', 'running').get();
  const live = q.docs
    .map((d) => d.data())
    .filter((r) => Date.now() - Date.parse(r.createdAt || 0) < STALE_RUN_MS);
  return live.length ? live[0] : null;
}

/** The hour on HER clock, 0-23.
 *
 *  Sophie is Pacific ("i'm on pst not utc jsyk"), and the IANA zone is what
 *  actually tracks the clock she reads — it is PDT half the year, and a fixed
 *  -8 would fire an hour off all summer. */
function pacificHour(at = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false,
  }).format(at));
}
// Her window for the automatic sweep: 11am to 11pm Pacific. A HAND run
// (POST /run) is not bound by it — she asked for the hours the tick keeps, not
// a curfew on her own button.
const WINDOW = { from: 11, to: 23 };
function inWindow(at = new Date()) {
  const h = pacificHour(at);
  return h >= WINDOW.from && h < WINDOW.to;
}

/** The daily entry point, called by the hourly tick in server.js.
 *
 *  The DUE CHECK IS IN FIRESTORE, NOT IN THE INTERVAL. The web service restarts
 *  on every deploy and this repo deploys many times a day, so an interval that
 *  counted 24 hours from boot would either never fire or fire on every restart.
 *  A stored `lastRunAt` is the only thing that survives a restart. */
async function sweepDue({ force = false } = {}) {
  if (!admin.apps.length || !process.env.OPENAI_API_KEY) return { skipped: 'not configured' };
  if (!force && !inWindow()) return { skipped: 'outside her hours', pacificHour: pacificHour() };
  const busy = await runningNow();
  if (busy) return { skipped: 'a run is already going', running: busy.id };
  const snap = await stateRef().get();
  const last = (snap.exists && snap.data().lastRunAt) || '';
  if (!force && last && Date.now() - Date.parse(last) < DUE_MS) return { skipped: 'not due', last };
  const { chats } = await registry();
  const waiting = waitingFrom(chats);
  if (!waiting.length) {
    await stateRef().set({ lastRunAt: new Date().toISOString(), lastDrawn: 0 }, { merge: true });
    return { skipped: 'nothing waiting' };
  }
  const id = `run-${Date.now().toString(36)}`;
  await patch(id, { id, status: 'running', step: 'starting', by: 'daily', createdAt: new Date().toISOString() });
  runSweep(id, { limit: PER_SHEET });                       // fire and forget
  return { started: id, waiting: waiting.length };
}

// ---- routes ---------------------------------------------------------------

router.get('/status', async (req, res) => {
  const out = {
    ok: true,
    firebase: !!admin.apps.length,
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: anthropic.available(),
    perSheet: PER_SHEET,
    quality: QUALITY,
    costPerSheet: 0.06,
    // Her hours, and where the clock is in them right now.
    hours: `${WINDOW.from}:00-${WINDOW.to}:00 Pacific`,
    pacificHour: pacificHour(),
    inWindow: inWindow(),
  };
  try {
    const [{ chats }, snap] = await Promise.all([registry(), stateRef().get()]);
    const waiting = waitingFrom(chats);
    const all = Object.keys(chats).filter((n) => !chats[n].deletedAt);
    out.waiting = waiting.length;
    out.withIcon = all.filter((n) => chats[n].icon).length;
    out.skippedArchived = all.filter((n) => chats[n].archived && !chats[n].icon).length;
    out.skippedNothingToDrawFrom = all.filter((n) => !chats[n].icon && !chats[n].archived && !drawable(n, chats[n])).length;
    Object.assign(out, snap.exists ? snap.data() : {});
  } catch (e) { out.error = String(e.message || e); }
  res.json(out);
});

router.get('/waiting', async (req, res) => {
  try {
    const { chats } = await registry();
    const waiting = waitingFrom(chats);
    res.json({ total: waiting.length, waiting: waiting.slice(0, Math.min(200, Number(req.query.limit) || 50)) });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

router.post('/run', async (req, res) => {
  if (!admin.apps.length) return res.status(503).json({ error: 'firebase not configured' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY not set' });
  const limit = Math.max(1, Math.min(200, Number(req.body && req.body.limit) || PER_SHEET));
  try {
    const { chats } = await registry();
    const waiting = waitingFrom(chats);
    // DRY IS FREE and answers the only question worth asking before a paid run:
    // who exactly is about to be drawn, and what will it cost.
    if (req.body && req.body.dry) {
      const take = waiting.slice(0, limit);
      const named = await subjectsFor(take);
      return res.json({
        dry: true, waiting: waiting.length, taking: take.length,
        sheets: Math.ceil(take.length / PER_SHEET),
        cost: Number((Math.ceil(take.length / PER_SHEET) * 0.06).toFixed(2)),
        items: named,
      });
    }
    // The same lock the tick obeys: two runs draw the same chats twice, and it
    // does not matter which one started it. `force:true` is the way past it.
    const busy = await runningNow();
    if (busy && !(req.body && req.body.force)) {
      return res.status(409).json({ error: 'a run is already going', running: busy.id, poll: `/api/chaticons/run/${busy.id}` });
    }
    const id = `run-${Date.now().toString(36)}`;
    await patch(id, { id, status: 'running', step: 'starting', by: 'hand', createdAt: new Date().toISOString() });
    runSweep(id, { limit });
    res.json({
      ok: true, id, poll: `/api/chaticons/run/${id}`,
      waiting: waiting.length, taking: Math.min(waiting.length, limit),
      cost: Number((Math.ceil(Math.min(waiting.length, limit) / PER_SHEET) * 0.06).toFixed(2)),
    });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

router.get('/run/:id', async (req, res) => {
  const snap = await db().collection(COL).doc(String(req.params.id)).get();
  if (!snap.exists) return res.status(404).json({ error: 'no such run' });
  res.json(snap.data());
});

router.get('/runs', async (req, res) => {
  const q = await db().collection(COL).orderBy('createdAt', 'desc')
    .limit(Math.min(50, Number(req.query.limit) || 10)).get();
  res.json({ runs: q.docs.filter((d) => d.id !== STATE).map((d) => d.data()) });
});

module.exports = {
  router, sweepDue, waitingFrom, drawable, lineFor, GENERIC, subjectsFor,
  PER_SHEET, QUALITY, DUE_MS, SUBJECT_SYSTEM,
  pacificHour, inWindow, WINDOW, STALE_RUN_MS,
};

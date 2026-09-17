// waiting.js — WHAT IS WAITING: the changes that are merged and not live yet,
// and the PRs still open, each one said in the words of the chat that wrote it.
//
// Sophie's ask (2026-09-14, looking at the "11 changes waiting" push): "shud go
// to a screen that says what the unmerged changes are · each chat contributes".
// The push already tells her HOW MANY (push.js's behindCheck, one rung per
// five). A number is not something she can act on — the only way to find out
// what the eleven were was to go and read main.
//
// EACH CHAT CONTRIBUTES, AND IT ALREADY DOES — nothing new to remember.
// Every PR this repo merges carries the house attribution trailer in its
// squash commit:
//     Claude-Session: https://claude.ai/code/session_01SgNmBN4Panb3mRmSyr1Amx
// and the chat registry records that same session id on the chat that owns it.
// So the join from a commit to the chat that made it is DERIVED — it works for
// every chat that has ever merged, including the ones asleep, and it needed no
// discipline from anyone. A chat may ALSO say it in her words with
// POST /api/waiting { chat, session, pr, line } — that line replaces the commit
// subject on the row and nothing else.
//
// WHAT IT COSTS: THREE unauthenticated GitHub reads (60/hr is the limit),
// cached 5 minutes in this process — the compare behind the count, the open
// PRs, and main's last 100 commits, which is what the deploy log slices its
// runs out of. Three per miss and at most 12 misses an hour is 36 of the 60.
// No model call, and no Firestore read beyond the deploy log and any filed
// line. Opening the page spends nothing.
// A REFUSED READ COSTS ONLY ITS OWN SECTION — each one catches to an empty
// answer, so a 403 on the commit list drops the deploy rows and leaves the
// count and the pile exactly as they were. Measured 2026-09-16: a chat's
// container really does hit that 403 (a shared proxy IP), which is why the
// fallback is not theoretical.
//
// THE LIVE COMMIT IS THIS INSTANCE'S OWN (`RENDER_GIT_COMMIT`) — the same
// source behindCheck counts from, so the page and the push can never disagree
// about the number. Off Render there is no commit to compare against and the
// page says so rather than inventing a baseline.
//
// Routes (STUDIO_TOKEN gate, GET /status open):
//   GET  /api/waiting            → { ok, live, ahead, groups, open, at }
//   GET  /api/waiting/status     → { ok, firebase, live }
//   POST /api/waiting            → { chat, session?, pr?, sha?, line } — a
//        chat's own words for one change (200 chars). Re-posting replaces it.
//   POST /api/waiting/deploy     → no body. Starts a Render deploy of main.
//        Refused with `nothing-waiting`, `cooling` or `no-key`.
//
// Page: /waiting (serveGated, pill). Tests: node scripts/test-waiting.js

const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();
const COLL = 'forge-waiting';
// THE DEPLOY LOG (2026-09-16, Sophie: "can i have collapsed rows under, up to
// five, showing what rode in the last 5 deployed"). One doc per commit that
// has been LIVE on this service, id = the sha, `at` = the first moment an
// instance running it answered.
//
// IT IS WRITTEN BY THE SERVER'S OWN BOOT, so it needs no key and no
// discipline: a deploy IS a new instance, and a new instance reads a
// RENDER_GIT_COMMIT nothing has recorded yet. Render's own deploy API would
// have been the obvious source and is the wrong one — RENDER_API_KEY is NOT
// on this service (measured 2026-09-16: its whole env is ATLASCLOUD_API_KEY ·
// FIREBASE_SERVICE_ACCOUNT · MALLOC_ARENA_MAX · OPENAI_API_KEY ·
// OPENROUTER_API_KEY · REPLICATE_API_TOKEN), so reading it would have meant
// asking Sophie for a new secret to show her something she can already be
// told for free.
// A restart that ships no new commit writes nothing — the sha is already
// there — which is right: nothing rode in it.
// The history before this shipped was SEEDED ONCE from Render's deploy API in
// a chat's own container (scripts/seed-deploy-log.js), so the page was full on
// day one rather than in a week.
const DEPLOYS = 'forge-deploys';
const REPO = process.env.FORGE_REPO || 'sageryza/imageforge';
const BRANCH = process.env.FORGE_BRANCH || 'main';
const TTL_MS = 5 * 60 * 1000;

// THE BUTTON THAT DEPLOYS (2026-09-16, Sophie: "add a button at top of merged
// changes that deploys to render so i can do it myself and chats can stop
// asking"). Every deploy has been a chat running scripts/render-deploy.js from
// its own container, which is why every chat ends its turn asking her for the
// word. The page that already says WHAT is waiting is the place to let her send
// it herself.
//
// IT IS THE SAME DOOR THE SCRIPT USES — POST to Render's deploys API — and the
// SAME GUARD stands in front of it: `preDeployCommand` (scripts/deploy-guard.js)
// runs after the build and before the new instance starts, holds while anything
// is drawing or cutting, pauses image generation, and FAILS the deploy rather
// than kill a draw. So a tap can never take a picture down with it, and this
// route does not re-implement that wait — it would only make her watch a
// spinner for something the platform already does on its own.
//
// WHAT IT NEEDS FROM THE ENV, and the SAFE one is first:
//   · RENDER_DEPLOY_HOOK — Render's own per-service deploy hook url, off the
//     service's Settings page. It can do exactly ONE thing: deploy THIS
//     service. That is the whole reason it is preferred. This page is open
//     (STUDIO_TOKEN is off live), so the secret standing behind its button
//     should be the smallest one that does the job, never a key that could
//     also delete her services.
//   · RENDER_API_KEY — the account-wide key, the fallback. It is what
//     scripts/render-deploy.js uses from a chat's own container, where the
//     blast radius is a container rather than a public route.
// Measured 2026-09-16 the service carried NEITHER (its whole env was
// ATLASCLOUD_API_KEY · FIREBASE_SERVICE_ACCOUNT · MALLOC_ARENA_MAX ·
// OPENAI_API_KEY · OPENROUTER_API_KEY · REPLICATE_API_TOKEN), so the button
// is not drawn at all until Sophie pastes one — `deploy.key` is false and the
// page draws nothing rather than a control that can only answer 503.
//
// TWO GUARDS, because STUDIO_TOKEN is off on the live server and this page is
// therefore open to anyone who finds it:
//   · NOTHING WAITING → refused. With the live commit level with main there is
//     nothing to ship, so the blast radius of a stranger tapping is zero the
//     moment the pile is empty — which is nearly always.
//   · A COOLDOWN, in this process. One deploy per five minutes; the next one
//     is refused with how long is left. A deploy takes longer than that to
//     boot anyway, so it never stands in her way.
const SRV = process.env.RENDER_SERVICE_ID || 'srv-d660igvgi27c73a5u6eg';
const COOL_MS = 5 * 60 * 1000;
let firedAt = 0;

/** What the button should look like right now. Cheap, and never cached — the
 *  cooldown is a clock and build()'s answer is five minutes old. */
function deployState() {
  const left = Math.max(0, COOL_MS - (Date.now() - firedAt));
  const d = deployDoor();
  return { key: !!d, how: d ? d.how : '', cooling: left, firedAt: firedAt || 0 };
}

/** Which door this box can deploy through, if any. The hook wins — it is the
 *  one that can only ever deploy this service. */
function deployDoor() {
  const hook = String(process.env.RENDER_DEPLOY_HOOK || '').trim();
  if (/^https:\/\/api\.render\.com\/deploy\//.test(hook)) return { how: 'hook', url: hook };
  const key = String(process.env.RENDER_API_KEY || '').trim();
  if (key) return { how: 'key', key };
  return null;
}

const db = () => admin.firestore();
const firebaseUp = () => admin.apps.length > 0;

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '32kb' }));

// ---- pure helpers (exported for the test) ----------------------------------

// The session id, bare. Kept identical in shape to chatfeed's own bareSid —
// the registry stores `sessionId` with the prefix already off, and a commit
// trailer carries the `session_` form.
function bareSid(s) {
  return String(s || '').replace(/^(session_|cse_)/, '').trim().slice(0, 120);
}

/** One commit → what a row needs. Pure; `c` is GitHub's compare shape. */
function parseCommit(c) {
  const msg = String((c && c.commit && c.commit.message) || '');
  const lines = msg.split('\n');
  const subject = lines[0].trim();
  // `Title (#2424)` and `Title [skip render] (#2424)` are both squash titles,
  // and a PR number can also appear as `(#2424)` mid-subject — the LAST one on
  // the subject line is the merge's own.
  let pr = 0;
  const nums = subject.match(/\(#(\d+)\)/g);
  if (nums && nums.length) pr = Number(nums[nums.length - 1].replace(/\D/g, '')) || 0;
  // The house attribution trailer. A PR body can carry several (one per commit
  // in a multi-commit squash) — they are all the same chat, so the first wins.
  const sess = msg.match(/claude\.ai\/code\/(?:session_)?([A-Za-z0-9_-]{16,})/);
  return {
    sha: String((c && c.sha) || '').slice(0, 40),
    title: cleanTitle(subject),
    pr,
    session: sess ? bareSid(sess[1]) : '',
    at: String((c && c.commit && c.commit.committer && c.commit.committer.date) || ''),
  };
}

// The subject, minus the machinery she never needs to read: the PR number
// (the row links it) and the `[skip render]` marker (every one of these is
// unshipped by definition — saying so on each row says nothing).
function cleanTitle(s) {
  return String(s || '')
    .replace(/\(#\d+\)/g, '')
    .replace(/\[skip render\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s—–\-:·]+$/, '')
    .trim();
}

/** An open PR → the same row shape. `p` is GitHub's pulls shape. */
function parsePull(p) {
  const body = String((p && p.body) || '');
  const sess = body.match(/claude\.ai\/code\/(?:session_)?([A-Za-z0-9_-]{16,})/);
  return {
    sha: '',
    title: cleanTitle((p && p.title) || ''),
    pr: Number((p && p.number) || 0) || 0,
    session: sess ? bareSid(sess[1]) : '',
    at: String((p && p.updated_at) || (p && p.created_at) || ''),
    draft: !!(p && p.draft),
  };
}

// slug → the session that owns it, from the registry. A chat's `sessionId` is
// the guarded field (chatfeed's keepsDeepLink); `url` is the orange Open
// button's link and is the fallback for a doc stamped before that field
// existed.
function sidIndex(chats) {
  const byS = new Map();
  for (const [slug, d] of Object.entries(chats || {})) {
    if (!d || d.movedTo) continue;
    const sid = bareSid(d.sessionId) || bareSid((String(d.url || '').match(/session_[A-Za-z0-9_-]+/) || [''])[0]);
    if (!sid) continue;
    if (!byS.has(sid)) byS.set(sid, slug);
  }
  return byS;
}

const nameOf = (d, slug) => String((d && (d.displayName || d.name)) || slug || '').trim() || slug;

/**
 * The whole page, pure: commits (and open PRs) grouped by the chat that wrote
 * them, each group newest first, the groups themselves ordered by their own
 * newest change.
 *
 * A change whose session matches no chat is NOT dropped — it lands in one
 * group with an empty slug, because a change she cannot see is the exact thing
 * this screen exists to end. (Measured shapes that land there: a PR merged
 * from her Mac, and the handful of chats whose registry doc predates
 * `sessionId`.)
 */
function groupRows(rows, chats, notes) {
  const byS = sidIndex(chats);
  const noteFor = (r) => {
    const n = (notes && (notes['pr-' + r.pr] || (r.sha && notes['sha-' + r.sha.slice(0, 12)]))) || null;
    return n && n.line ? String(n.line) : '';
  };
  const groups = new Map();
  for (const r of rows) {
    const slug = (r.session && byS.get(r.session)) || '';
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push({ ...r, line: noteFor(r) });
  }
  const out = [];
  for (const [slug, items] of groups) {
    items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    out.push({
      chat: slug,
      name: slug ? nameOf(chats && chats[slug], slug) : '',
      items,
      at: items[0] ? items[0].at : '',
    });
  }
  // Newest work first; the unclaimed pile never leads, however recent it is —
  // it is the leftovers, not the news.
  out.sort((a, b) => {
    if (!a.chat !== !b.chat) return a.chat ? -1 : 1;
    return String(b.at).localeCompare(String(a.at));
  });
  return out;
}

// ---- GitHub (one read each, cached) ----------------------------------------

const cache = { at: 0, key: '', data: null };

async function ghJson(url, fetchFn) {
  const f = fetchFn || fetch;
  const r = await f(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'imageforge' } });
  if (!r.ok) throw new Error(`github ${r.status}`);
  return r.json();
}

/** Merged-and-not-live: the commits main has that the live box does not. */
async function readAhead(fetchFn, sha) {
  const head = String(sha || process.env.RENDER_GIT_COMMIT || '').trim();
  if (!head) return null;
  const j = await ghJson(`https://api.github.com/repos/${REPO}/compare/${head}...${BRANCH}`, fetchFn);
  const commits = Array.isArray(j.commits) ? j.commits : [];
  return {
    sha: head,
    ahead: Number.isFinite(Number(j.ahead_by)) ? Number(j.ahead_by) : commits.length,
    commits: commits.map(parseCommit).reverse(),   // GitHub answers oldest first
  };
}

/** The last N live commits, newest first. Cheap: one small ordered read. */
async function readDeploys(n) {
  if (!firebaseUp()) return [];
  const snap = await db().collection(DEPLOYS).orderBy('at', 'desc').limit(Number(n) || 6).get();
  return snap.docs.map((d) => {
    const v = d.data() || {};
    return { sha: String(v.sha || d.id), at: String(v.at || '') };
  });
}

/** Record this instance's own commit the first time we are asked. */
async function noteLive(sha) {
  const id = String(sha || '').trim();
  if (!id || !firebaseUp() || noteLive._done === id) return;
  noteLive._done = id;
  const ref = db().collection(DEPLOYS).doc(id.slice(0, 12));
  const snap = await ref.get();
  if (snap.exists) return;
  await ref.set({ sha: id, at: new Date().toISOString() });
}

/** main's recent history, newest first — ONE read, whatever the deploy count. */
async function readRecent(fetchFn) {
  const j = await ghJson(`https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=100`, fetchFn);
  return (Array.isArray(j) ? j : []).map(parseCommit);
}

/**
 * The last `n` deploys and what rode in each, pure.
 *
 * `deploys` newest first, `commits` main newest first. A run is the commits
 * from this deploy's own commit (included) down to the NEXT OLDER deploy's
 * commit (excluded) — which is exactly "what this deploy shipped that the one
 * before it did not".
 *
 * A run whose floor cannot be placed is DROPPED, never guessed: with no older
 * deploy inside the window there is no way to tell where it started, and a row
 * claiming the remaining ninety commits rode in one deploy would be a lie. So
 * ask for one more deploy than you mean to show — the extra one is the oldest
 * row's floor.
 */
function deployRuns(deploys, commits, chats, notes, n) {
  const idx = new Map();
  commits.forEach((c, i) => { if (c.sha && !idx.has(c.sha)) idx.set(c.sha, i); });
  const at = (d) => idx.get(String(d.sha || ''));
  const out = [];
  for (let i = 0; i < deploys.length && out.length < (Number(n) || 5); i++) {
    const here = at(deploys[i]);
    if (here === undefined) continue;
    let floor;
    for (let k = i + 1; k < deploys.length; k++) {
      const p = at(deploys[k]);
      if (p !== undefined) { floor = p; break; }
    }
    if (floor === undefined || floor <= here) continue;
    const rode = commits.slice(here, floor);
    out.push({
      sha: String(deploys[i].sha).slice(0, 7),
      at: deploys[i].at,
      n: rode.length,
      groups: groupRows(rode, chats, notes),
    });
  }
  return out;
}

/** Still open — the PRs that have not merged at all. */
async function readOpen(fetchFn) {
  const j = await ghJson(`https://api.github.com/repos/${REPO}/pulls?state=open&per_page=50`, fetchFn);
  return (Array.isArray(j) ? j : []).map(parsePull);
}

async function readNotes() {
  if (!firebaseUp()) return {};
  const snap = await db().collection(COLL).get();
  const out = {};
  snap.docs.forEach((d) => { out[d.id] = d.data(); });
  return out;
}

async function build(opts) {
  const o = opts || {};
  const head = String(o.sha || process.env.RENDER_GIT_COMMIT || '').trim();
  if (!o.fresh && cache.data && cache.key === head && Date.now() - cache.at < TTL_MS) return cache.data;
  await noteLive(head).catch(() => {});
  const [ahead, open, notes, chats, deploys, recent] = await Promise.all([
    readAhead(o.fetch, head).catch((e) => ({ error: e.message })),
    readOpen(o.fetch).catch(() => []),
    readNotes().catch(() => ({})),
    (async () => {
      try { return (await require('./chatfeed').registry()).chats || {}; } catch (e) { return {}; }
    })(),
    readDeploys(6).catch(() => []),
    readRecent(o.fetch).catch(() => []),
  ]);
  const data = {
    live: head ? head.slice(0, 7) : '',
    // A box with no commit of its own (a dev container) can still show what is
    // open; it just cannot say what is unshipped.
    ahead: ahead && !ahead.error ? ahead.ahead : 0,
    error: (ahead && ahead.error) || (head ? '' : 'no-commit'),
    groups: ahead && !ahead.error ? groupRows(ahead.commits, chats, notes) : [],
    open: groupRows(open, chats, notes),
    // Up to five, and honestly fewer when the log cannot place them.
    deploys: deployRuns(deploys, recent, chats, notes, 5),
    at: new Date().toISOString(),
  };
  cache.at = Date.now(); cache.key = head; cache.data = data;
  return data;
}

// ---- routes ----------------------------------------------------------------

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: firebaseUp(), live: String(process.env.RENDER_GIT_COMMIT || '').slice(0, 7) });
});

router.get('/', async (req, res) => {
  try {
    const data = await build({ fresh: req.query.fresh === '1' });
    // Fresh every time — build()'s answer is up to five minutes old and the
    // cooldown is a clock.
    res.json({ ok: true, ...data, deploy: deployState() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// A chat says what its change MEANS, in her words. Keyed by PR when there is
// one (a squash title carries it), else by the merge sha — never by chat, so a
// chat with three changes waiting gets three lines rather than one that
// overwrites the others.
router.post('/', async (req, res) => {
  try {
    if (!firebaseUp()) return res.status(503).json({ error: 'no firestore' });
    const b = req.body || {};
    const pr = Number(b.pr) || 0;
    const sha = String(b.sha || '').replace(/[^0-9a-f]/gi, '').slice(0, 12);
    if (!pr && !sha) return res.status(400).json({ error: 'pr or sha required' });
    const line = String(b.line || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!line) return res.status(400).json({ error: 'line required' });
    const id = pr ? 'pr-' + pr : 'sha-' + sha;
    await db().collection(COLL).doc(id).set({
      line,
      chat: String(b.chat || '').slice(0, 60),
      session: bareSid(b.session),
      pr, sha,
      at: new Date().toISOString(),
    }, { merge: true });
    cache.data = null;
    res.json({ ok: true, id, line });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SHE DEPLOYS IT HERSELF. No body, nothing to pass — this route can only ever
// start a plain deploy of whatever main is, which is the whole of its safety.
router.post('/deploy', async (req, res) => {
  try {
    const door = deployDoor();
    if (!door) return res.status(503).json({ error: 'no-key' });
    const left = Math.max(0, COOL_MS - (Date.now() - firedAt));
    if (left > 0) return res.status(429).json({ error: 'cooling', cooling: left });

    // Nothing waiting → nothing to ship. Read it FRESH: the cached answer can
    // be five minutes old, and five minutes is exactly long enough for a merge
    // to land under her while she looks at the page.
    let ahead = 0;
    const data = await build({ fresh: true }).catch(() => null);
    if (data) {
      if (data.error) return res.status(409).json({ error: 'no-baseline', why: data.error });
      ahead = Number(data.ahead) || 0;
      if (!ahead) return res.status(409).json({ error: 'nothing-waiting' });
    }

    firedAt = Date.now();
    // The hook takes no body and no auth — the url IS the secret. The API
    // route is the same POST scripts/render-deploy.js makes.
    const r = door.how === 'hook'
      ? await fetch(door.url, { method: 'POST' })
      : await fetch(`https://api.render.com/v1/services/${SRV}/deploys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${door.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearCache: 'do_not_clear' }),
      });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      // A refused deploy never spends the cooldown — she should be able to try
      // again the moment whatever refused it is fixed.
      firedAt = 0;
      return res.status(502).json({ error: 'render ' + r.status, why: String(JSON.stringify(j)).slice(0, 200) });
    }
    const dep = j.deploy || j;
    res.json({ ok: true, id: String(dep.id || ''), how: door.how, ahead });
  } catch (e) {
    firedAt = 0;
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, parseCommit, parsePull, cleanTitle, sidIndex, groupRows, readAhead, readOpen, readRecent, readDeploys, deployRuns, build, bareSid, DEPLOYS, deployState, deployDoor, COOL_MS };

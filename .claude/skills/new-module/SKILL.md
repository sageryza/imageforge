---
name: new-module
description: >
  The house server architecture for building a NEW TOOL in ImageForge — the
  `something.js` Express router with its Firestore collection, background
  jobs, dedupe, and token gate that sits behind every tile. Use this skill
  whenever creating a new server module, adding a new /api/* surface, adding
  substantial routes to an existing module, or building the backend for a new
  page or iOS tile. This pattern otherwise exists only by example in the
  sibling modules, and drifting from it has caused real bugs (scrambled album
  order, blocking spinners, lost concurrent edits).
---

# Building a new module

A module is one file at the repo root (`audio.js`, `cutmarks.js`, `songs.js`…)
exporting `{ router, …helpers }`. Before writing code, READ the two reference
modules — the skill tells you what to look for, the code is the law:

- **`audio.js`** — the cleanest full example: gate, md5 dedupe, transaction
  counters, EDITABLE whitelist, background enrichment, ffprobe resolution.
- **`cutmarks.js`** — the background-job machinery (`startJob`, ~line 138)
  and content-addressed docs.

## Mounting and config

Mount in `server.js` INSIDE `loadConfig().then(…)` — the config-loader
hydrates `process.env` from Firestore first, so a module mounted outside it
captures missing keys. `app.use('/api/<name>', require('./<name>').router)`
with a one-line comment saying what the module is, like the siblings.

## The gate

Copy audio.js's router-level middleware verbatim: when `STUDIO_TOKEN` is
unset everything is open; when set, every route requires `x-studio-token`
(or `?token=`) EXCEPT `GET /status`, which stays open and reports config
health (`{ ok, firebase, ffprobe… }` — booleans, never key values). A PUBLIC
route that spends money (selfcare.js) gets a per-IP rate limit instead.

## Data (Firestore project deckfactory-43176, via FIREBASE_SERVICE_ACCOUNT)

- One collection per module, named `forge-<thing>`. One doc per THING.
  (membry-df528 is only for the gallery/Story Room — CLAUDE.md's
  two-projects note.)
- **Content-address the doc id** when reopening should resume: sha1 of the
  source url (`projectId` in cutmarks.js), or a hash of the bytes — so
  re-opening/re-ingesting updates one doc instead of piling up copies.
- **Dedupe files by the md5 of their bytes** (`duplicate:true`, skip the
  store) — filenames can't do it (iOS renames every export), and a re-send
  after a dropped connection must top up, not double.
- **Sequence numbers come from a TRANSACTION on a counter doc**
  (`allocSeq` in audio.js) — NEVER from counting the collection. Counting
  handed concurrent uploads the same number and scrambled the Dump's album
  order for real.
- **PATCH writes go through an `EDITABLE` whitelist + a `clean()`
  normalizer**; url/storagePath/hash/bytes/createdAt are server-owned.
- **Queries: ONE equality filter, sort/filter the rest in memory** — this is
  deliberate, so no route ever needs a composite Firestore index set up.
- **History is kept, capped** — renders/mixes in arrays capped ~8–12,
  superseded work into `*History`; nothing Sophie made is deleted outright.

## Background jobs (house rule: nothing slow blocks a request)

- The POST returns an id in ~0.3s; the work runs fire-and-forget and its
  state lives ON the doc as `job {kind, status, done, total, label, error,
  startedAt}` with a poll route (`GET /:id/job`). Copy cutmarks.js's
  `startJob` — including its stale-job takeover (a "running" job older than
  ~20 min may be replaced, so a server restart can't wedge the doc forever).
- **Patch FIELDS, never stamp a whole doc**: a job's periodic progress save
  of a whole stale doc silently reverted Sophie's concurrent edits (the
  Episode Editor bug). Throttle progress saves (~1.5s).
- A failure lands as `status:'failed'` + `error` on the doc — never a hung
  request. Re-POSTing while a job runs returns the existing doc, never a
  second job. Partial results land as they finish (one failed call costs its
  item, not the run).
- The page half: record pending ids in `localStorage` and resume polling on
  return, so leaving the app never loses paid work.

## Uploads and memory (512MB for the WHOLE app)

- One file per request as the RAW body (`express.raw({ type: () => true,
  limit })`) — no base64 inflation, and the phone gets real progress. But
  `express.raw` buffers the entire body in memory, so anything big travels
  by URL and streams to disk inside the job.
- Storage writes: `bucket.upload(localFile)` streamed from disk for big
  files, never `file.save(fs.readFileSync(…))`; process long audio as a
  STREAM (an hour of PCM is ~115MB — never one Buffer).
- Paths: readable (`audio/<batch>/<NN>-<name>.<ext>`) when humans paste the
  urls around; content-addressed (`drops/_/<hash>.<ext>`) when dedupe
  matters. `makePublic()` → `https://storage.googleapis.com/<bucket>/<path>`
  is the permanent-url form every downstream tool wants.
- ffmpeg/ffprobe: static npm packages first, then env/PATH (copy audio.js's
  `FFPROBE` resolution). A missing binary degrades one field (`seconds:
  null`), never the module.

## Money

- Opening a page must never spend — a model call is a deliberate tap.
- Words a human reads → Claude via `anthropic.js`; `gpt-4o-mini` only for
  bulk mechanical extraction (CLAUDE.md "Which model writes it").
- Retry transient 429/5xx with backoff; a 4xx is permanent; a gpt-image
  safety refusal is terminal and must short-circuit every retry ladder.

## Shipping it

- Module header comment = what it is, why it exists, the gotchas, and a
  route list (audio.js's header is the reference). When behavior changes,
  update the header AND CLAUDE.md in the same commit — stale docs have
  shipped real mistakes here.
- Export the pure functions so `scripts/test-*.js` can drive them; headless
  page tests treat playwright as optional (skip cleanly when absent).
- Give the module its own CLAUDE.md section like the siblings', and register
  keys it needs in config-loader's MANAGED_KEYS.
- The page half is the `new-page` skill's job; the iOS wrapper copies
  `EpisodeEditorView.swift`.

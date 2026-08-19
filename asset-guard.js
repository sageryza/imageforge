'use strict';
/*
 * asset-guard.js — may this BACKGROUND-CAUGHT image become a new tile in this
 * chat's Assets tab?
 *
 * THE PROBLEM (docs/wip-asset-filing.md; Sophie 2026-08-11, again 08-14).
 * The chats' Stop hook scans a finished turn TWICE, and the two scans arrive
 * at POST /api/gallery through two different doors:
 *
 *   scan 1, the reply's PROSE — every Firebase url in the finished reply, and
 *           a markdown link's text becomes the label. Posted as
 *           `{url, prompt, description?}` with NO `assetsOnly`, so it takes
 *           the full gallery path (My Creations + the chat's Assets record).
 *           A deliberate delivery. NOTHING here ever sees it.
 *   scan 2, the turn's RAW TOOL ACTIVITY — every Firebase url that appears
 *           anywhere in the turn's tool calls and results, filed as
 *           `{'wip': u}` → posted as `{url, prompt:"from <chat>",
 *           assetsOnly:true}` with no description. That is the door this
 *           guard stands at.
 *
 * Scan 2 is a safety net and a real one: it is what stops an image a chat
 * generated mid-turn from being lost when the chat forgets to mention it. But
 * it cannot tell an image this chat MADE from one it merely TOUCHED — read,
 * verified, copied a url of — so a Jonas panel landed in the Moon Milk chat,
 * and looking at that stray filed a thumbnail of it into the same tab minutes
 * later.
 *
 * THREE RULES, and only two of them refuse anything:
 *
 *   1  LABELED ELSEWHERE — a background catch may not CREATE a tile for a url
 *      that is already a LABELED asset in a DIFFERENT chat. If a picture is
 *      filed somewhere with a real label it is someone's finished deliverable,
 *      and a second unlabeled copy of it in another chat is never what anyone
 *      wanted. One equality query, only on this path. Also matched by md5 when
 *      the url query misses, which catches a renamed copy of a labeled
 *      deliverable and costs no extra Storage read (the filing path reads that
 *      md5 anyway).
 *   2  DERIVED COPY — never file a url the SERVER ITSELF generated as a
 *      display copy. Those are not deliverables at all, so refusing them
 *      outright loses nothing. Rule 1 can't reach them: a thumbnail is not a
 *      labeled asset in any other chat.
 *   3  DUMP PHOTO → LABEL IT, never refuse it. A background catch of a photo
 *      out of the Dump gets an auto-generated description naming its album, so
 *      it tiles with something readable under it instead of as one more
 *      nameless square. See the note on the rule itself: refusing these was
 *      designed, measured against how Sophie actually works, and reversed.
 *
 * WHAT IS NEVER BLOCKED — the cases to hold in mind before widening anything:
 *
 *   • A PROSE delivery, always. It never arrives at this door.
 *   • A LABELED filing, anywhere — including a second chat's copy of another
 *     chat's deliverable ("it can be in two places"). A description, or a
 *     curated caption like "gpt-image-2 · medium", marks a filing deliberate.
 *   • THE POLAROID SHEET. A chat generates a big source sheet, never labels
 *     it, then labels the cut-out tiles (different urls). The sheet is labeled
 *     NOWHERE, so it still files into the making chat — the safety net is
 *     intact for everything a chat actually makes.
 *   • A re-filing of a url ALREADY in this chat: that converges onto the
 *     existing record upstream and never reaches the guard.
 *
 * THE HONEST LIMIT — ORDERING. Rule 1 depends on the deliberate filing landing
 * FIRST. If the background catch beats it, both records exist and the guard
 * does not go back and remove the stray: collapsing identical bytes is the md5
 * union's job (asset-union.js) and naming the leftovers is the sweep's. A
 * strong net, not a proof. Pinned as a test so the limit stays deliberate.
 *
 * Pure apart from asset-hash's url parser, so scripts/test-asset-guard.js can
 * drive the whole decision table with fixtures and no network.
 */

const { storageRef } = require('./asset-hash');

/* ── Rule 2: display copies the server writes for itself ──────────────────
 * Verified in code, and deliberately NARROW — a wrong entry here silently
 * loses a real deliverable, so anything uncertain is left out.
 *
 *   thumbs/   server.js `thumbName()` — sha1(url|width).webp, the 480px webp
 *             behind every Assets tile and the Update tab's delivered strip.
 *             /wall's own SKIP list already calls it "derived/plumbing, not
 *             art", which is the same judgement made twice.
 *
 *   drops/_thumb/
 *             scripts/crystal-thumbs.js — `drops/_thumb/<key>.webp`, the 480px
 *             webp the crystal splitter tiles with. A server-made copy of a
 *             Dump photo, so refusing it is what leaves only the REAL photo to
 *             tile — and that one arrives on its own and gets its album label
 *             from Rule 3.
 *
 * Considered and LEFT OUT: scripts/selfcare-thumbs.js writes its 512px copy
 * beside the original as `<same path>-512.webp` — a SUFFIX, which cannot be a
 * prefix rule; scripts/webp-assets.js writes `witch-school/webp/` and
 * `witch-quiz/webp/`, which are display copies but also the pictures those
 * pages actually serve, so a chat replacing a lesson card could reasonably
 * point at one.
 */
const DERIVED_PREFIXES = ['thumbs/', 'drops/_thumb/'];

/* ── The source libraries: what only HER OWN upload pipelines write ───────
 * Storage areas a chat cannot create a file in. Verified by reading the module
 * that owns each one; the test is not "is this art" but "could a CHAT have
 * made this file":
 *   drops/      dropbox.js `storeOne()` → `drops/_/<md5>.<ext>` (+ its
 *               `-poster.jpg`). The Dump: photos and video off her phone.
 *   crystals/   crystals.js `storeOne()` → `crystals/<batch>/<crystal>/…`.
 *   ingest/     ingest.js `saveOne()` → `ingest/<batch>/…`, her own Midjourney
 *               exports and the browser extension. (Also on /wall's SKIP list.)
 * Considered and LEFT OUT: `audio/` looks like the same shape but is NOT
 * upload-only — the Cutting Room saves the clips it cuts into
 * `audio/cutting-room/…`, and those are real deliverables.
 *
 * TWO READERS, ONE LIST. Rule 3 below labels the Dump half of it, and
 * scripts/sweep-asset-captions.js reads the whole list to stop counting a
 * missing prompt or MODEL · QUALITY caption against a phone photo: nobody
 * typed words to make one and no model drew it, so those were never there to
 * file. A missing LABEL is still a finding for them.
 */
const SOURCE_LIBRARY_PREFIXES = ['drops/', 'crystals/', 'ingest/'];

/* ── Rule 3: a Dump photo gets a LABEL, never a refusal ───────────────────
 * REFUSING these was designed first, and measuring it is what killed it —
 * written down because the reasoning was good and the answer was still wrong.
 *
 * The design: a chat cannot create a file under `drops/`, so an unlabeled
 * background catch of one must be something the chat merely looked at, and
 * refusing it would clear out the Dump-browsing clutter Rule 1 cannot see (a
 * phone photo is labeled in no chat).
 *
 * The measurement (2026-08-14, all 4,229 `forge-chat-assets` docs): 759 are in
 * the background-catch shape and 99 of those are library urls — but **every
 * one of the 90 `drops/` records in the collection carries `wip:true`,
 * `prompt:"from <chat>"` and no label**, the 18 in the dinner-party chat
 * included. That chat has no Compare pages, and Sophie reviewed those photos
 * in its Assets tab: the review-pull she asked for and the stray arrive as the
 * same POST, through the same door, with the same fields. A refusal would have
 * deleted a workflow she uses.
 *
 * So the problem was never that the photo was filed — it was that it tiled
 * nameless. Rule 3 fixes THAT: look the url up in `forge-drops` and file it
 * with a description naming its album ("Dump — Dinner party #3"). She gets a
 * readable tab, nothing is ever lost, and the sweep stops counting these as
 * unlabeled by itself. The record is found by the md5 in the filename —
 * `drops/_/<hash>.<ext>` is content-addressed (dropbox.js), and `hash` is a
 * field on the doc, so it is one equality query. A photo in two albums has a
 * doc per album; the first is as good as any, since the picture is the same.
 * No record found still FILES, with a plain fallback: a label that is missing
 * detail beats a photo that is missing.
 */
const DUMP_PREFIX = 'drops/_/';

/** The object path inside its bucket, or '' when the url isn't a Storage one. */
function storagePath(url) {
  const ref = storageRef(url);
  return ref ? ref.path : '';
}

function matchPrefix(url, prefixes) {
  const p = storagePath(url);
  if (!p) return null;
  return prefixes.find((pre) => p.startsWith(pre)) || null;
}

/** `thumbs/…` — a display copy the server generated. */
const derivedPrefix = (url) => matchPrefix(url, DERIVED_PREFIXES);

/** `drops/…` &c — a source library only her own upload pipelines write. */
const sourceLibraryPrefix = (url) => matchPrefix(url, SOURCE_LIBRARY_PREFIXES);

/**
 * The Dump's content-address out of a url, or null — the `hash` field on the
 * `forge-drops` doc. `drops/_/<md5>.<ext>`, and `<md5>-poster.jpg` for a
 * video's poster frame, which belongs to the same record.
 */
function dumpHash(url) {
  const p = storagePath(url);
  if (!p || !p.startsWith(DUMP_PREFIX)) return null;
  const file = p.slice(DUMP_PREFIX.length);
  if (file.indexOf('/') >= 0) return null;
  const m = /^([0-9a-f]{16,64})(?:-poster)?\.[a-z0-9]+$/i.exec(file);
  return m ? m[1].toLowerCase() : null;
}

/**
 * How to find this url's `forge-drops` record — `{by:'hash'|'url', value}`, or
 * null when it isn't a Dump photo at all. Either way it is ONE single-field
 * equality query, so no composite index.
 *
 * THE DUMP HAS TWO LAYOUTS ON DISK and both are live in her data (counted
 * 2026-08-14 across the Assets tabs: 28 of the first, 61 of the second):
 *   drops/_/<md5>.<ext>              content-addressed, what dropbox.js writes
 *                                    today → found by `hash`.
 *   drops/<session>/<album>/<file>   the pre-2026-07-28 layout, from before
 *                                    drop-dedupe.js — found by `url`, which is
 *                                    a field on the doc. Sampled 8 of them
 *                                    live: 8 resolved.
 * `drops/_thumb/` is neither: it is a derived copy and Rule 2 refuses it
 * before this is ever asked.
 */
function dumpLookup(url) {
  const hash = dumpHash(url);
  if (hash) return { by: 'hash', value: hash };
  const p = storagePath(url);
  if (!p || !p.startsWith('drops/')) return null;
  if (derivedPrefix(url)) return null;
  if (p.split('/').length < 4) return null;     // drops/<session>/<album>/<file>
  return { by: 'url', value: String(url) };
}

/**
 * A `forge-drops` record → the description its tile wears.
 *
 * Its own field names (dropbox.js), in the order that says the most:
 *   bundleName  the album's display name, with `photoIndex` (0 = cover) as its
 *               order INSIDE that album — "Dump — Pink quartz #3".
 *   name        a name the sort page gave this one file.
 *   track       the FOLDER it was filed into ("style references"), which is
 *               often all a loose file has.
 * A loose file carries no album, and `photoIndex` is then 0 on every one of
 * them — so the number is appended only where it means something. Checked
 * against the real records 2026-08-14: the 18 in the dinner-party chat are
 * loose share-sheet files, `bundleName` null, and one of them is the reason
 * `track` is in this list at all.
 *
 * A record that isn't found still gets a label: knowing a picture came out of
 * the Dump is most of the point, and a label missing detail beats a nameless
 * tile.
 */
function dumpLabel(record) {
  const d = record || {};
  const s = (v) => String(v == null ? '' : v).trim();
  const album = s(d.bundleName);
  if (album) {
    const at = Number.isFinite(Number(d.photoIndex)) ? ` #${Number(d.photoIndex)}` : '';
    return `Dump — ${album}${at}`.slice(0, 300);
  }
  const own = s(d.name) || s(d.track);
  if (own) return `Dump — ${own}`.slice(0, 300);
  return 'Dump photo';
}

/**
 * Is this the hook's background-catch shape — the door the rules stand at?
 *
 * `wip` says which door: true for the raw-scan filing (`assetsOnly:true`),
 * false/absent for a prose delivery, which never reaches here at all. Then a
 * description is the label Sophie reviews by, so anything carrying one is a
 * deliberate delivery; a curated caption counts too, since the hook's own is
 * always "from <chat>".
 */
/**
 * `${slug}`, `$u`, `{{id}}` — a template placeholder that was never expanded.
 * Storage object names may not contain `$` or `{`, so a url carrying either
 * after the bucket is a printf artefact, never a picture.
 */
function unresolvedUrl(url) {
  const p = storagePath(url);
  return p ? /[${}]/.test(p) : false;
}

function isBackgroundCatch(filing) {
  const f = filing || {};
  if (!f.wip) return false;
  if (String(f.description == null ? '' : f.description).trim()) return false;
  const p = String(f.prompt == null ? '' : f.prompt).trim();
  if (p && !/^from\s/i.test(p)) return false;
  return true;
}

/**
 * Everything decidable without touching Firestore.
 * Returns a verdict, or null when the answer depends on what else is filed.
 */
function localVerdict(filing) {
  const f = filing || {};
  // A url carrying an UNEXPANDED SHELL OR TEMPLATE VARIABLE is refused before
  // anything else, labeled or not, because it can never resolve to an object
  // (2026-08-19: a chat printed `.../${slug}-dream.webp` and `.../$u.webp` in
  // its terminal output while looping over real images, and the background
  // scan filed both as tiles — nameless, promptless, and permanently broken
  // in her Assets tab). This is the one case where a filing is refused on the
  // url's SHAPE rather than on what else is on file, and it is safe precisely
  // because no real Storage object can be reached through it.
  if (unresolvedUrl(f.url)) return { block: true, reason: 'unresolved-url' };
  if (!f.wip) return { block: false, reason: 'prose-delivery' };
  if (!isBackgroundCatch(f)) return { block: false, reason: 'labeled' };
  // Rule 2 comes FIRST, so a `drops/_thumb/` copy is refused as the derived
  // thing it is rather than labeled as the photo it is a picture of.
  const derived = derivedPrefix(f.url);
  if (derived) return { block: true, reason: 'derived-copy', prefix: derived };
  // Rule 3: a Dump photo files, wearing its album's name.
  if (dumpLookup(f.url)) {
    return { block: false, reason: 'dump-photo', description: dumpLabel(f.dump) };
  }
  return null;
}

/**
 * Does this filing need its `forge-drops` record looked up before deciding?
 * True only for a background catch of a Dump photo (Rule 3).
 */
function needsDumpRecord(filing) {
  const f = filing || {};
  if (!f.wip || !isBackgroundCatch(f) || derivedPrefix(f.url)) return false;
  return !!dumpLookup(f.url);
}

/**
 * Is the "labeled elsewhere" query worth paying for on this filing?
 *
 * False whenever the local rules already settled it — a prose, labeled or Dump
 * filing is always allowed and a derived url always refused, so none of them
 * needs to know what any other chat holds. It reads the SAME `localVerdict`
 * the decision does, so the two can never disagree about which state they are
 * in.
 */
function needsElsewhereQuery(filing) {
  return localVerdict(filing) === null;
}

/**
 * THE DECISION. Everything the caller knows, one verdict out.
 *
 * @param input.chat    this chat's slug
 * @param input.url     the url being filed
 * @param input.wip     true for the background-catch door (assetsOnly)
 * @param input.description / input.prompt   as POSTed
 * @param input.others  every forge-chat-assets record already filed at this
 *                      url — and, when the url query missed, at these bytes —
 *                      as `{chat, description}`. Null/omitted when it wasn't
 *                      asked for.
 * @param input.dump    the `forge-drops` record for a Dump photo, when the
 *                      caller looked one up (`needsDumpRecord`). Absent or
 *                      null is fine — the label falls back.
 *
 * @returns `{block:false, reason}` — optionally carrying a `description` the
 *          caller should file the asset with — or `{block:true, reason}`. It
 *          never asks for anything to be deleted: an existing stray is not
 *          this guard's to remove (see the ordering limit at the top).
 */
function guardFiling(input) {
  const f = input || {};
  const local = localVerdict(f);
  if (local) return local;
  const others = Array.isArray(f.others) ? f.others : [];
  const elsewhere = others.find((r) => r
    && String(r.chat || '') !== String(f.chat || '')
    && String(r.description == null ? '' : r.description).trim());
  if (elsewhere) {
    return { block: true, reason: 'labeled-elsewhere', chat: String(elsewhere.chat || '') };
  }
  return { block: false, reason: 'new' };
}

module.exports = {
  unresolvedUrl,
  DERIVED_PREFIXES,
  SOURCE_LIBRARY_PREFIXES,
  DUMP_PREFIX,
  storagePath,
  derivedPrefix,
  sourceLibraryPrefix,
  dumpHash,
  dumpLookup,
  dumpLabel,
  isBackgroundCatch,
  needsDumpRecord,
  needsElsewhereQuery,
  guardFiling,
};

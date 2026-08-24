'use strict';
/*
 * meta-assets.js — the META ASSETS page's ordering (Aug 2026, Sophie: "pull
 * every asset from every chat into one place … automatic, they won't have to
 * file them themselves … in order of when it was filed").
 *
 * NOTHING FILES INTO THIS. The page is a VIEW over forge-chat-assets — the
 * same collection every chat's Assets tab already reads — so anything filed
 * into any chat's tab is here by construction, with no second filing step and
 * no second record to drift.
 *
 * ONE ROW PER PICTURE **PER CHAT**, deliberately. Copies of the same picture
 * inside one chat collapse exactly the way that chat's own tab collapses them
 * (asset-union.js, per chat). But the same picture filed in TWO chats stays
 * two rows: a ♥/✕/note is keyed chat+url (forge-asset-votes), so each row is
 * the one that syncs with its own tab — merging them would make a vote here
 * ambiguous about which tab it lands in. That is what makes "a heart here IS
 * the heart there" true with no mirroring machinery at all: the meta page
 * votes against the origin chat's own vote doc.
 *
 * Pure and dependency-light so scripts/test-meta-assets.js can drive it with
 * fixture records and no network.
 */

const assetUnion = require('./asset-union');
const sizeTier = require('./size-tier');
const grammar = require('./search-grammar');

// The pseudo-chat that holds app-made creations (below). A real chat slug is
// branch-derived and never contains a space, but keep it plain anyway so the
// vote docs it keys are unmistakable in the collection.
const APP_BUCKET = 'my-creations';

const urlKey = (u) => String(u || '').split('?')[0].split('#')[0].trim().toLowerCase();

/**
 * All forge-chat-assets docs (plain objects) → rows newest-first.
 * Row = the union tile ({url, ms, prompt, description, promptStyle,
 * promptContent, kind, alts}) plus `chat`.
 *
 * `creations` (optional) are the iOS gallery's docs, mapped to
 * {url, ms, prompt, type, model, quality, size, style}. The ones a CHAT filed ride
 * in as hook copies labeled "from <chat>" and already have a chat row — those
 * are skipped, as is any url a chat row (or its alts) already shows. What
 * survives is the APP-MADE work (stickers, dream pages, in-app generations),
 * which lives nowhere in forge-chat-assets and would otherwise vanish the day
 * the My Creations tile points here. Those rows join as the 'my-creations'
 * bucket: prompt→description (it is what the tile is reviewed by, exactly how
 * CreationsView showed it), model·quality·size→the caption slot, and — for plain
 * images — the prompt also lands in promptContent so the PROMPT overlay and
 * the Playground button work on them too. `app:true` marks them so the page
 * can skip the open-the-chat button (there is no chat to open).
 */
function buildMetaAssets(docs, creations) {
  const byChat = new Map();
  (docs || []).forEach((d) => {
    if (!d || !d.url || !d.chat) return;
    const list = byChat.get(d.chat);
    if (list) list.push(d); else byChat.set(d.chat, [d]);
  });
  const rows = [];
  const seenUrls = new Set();
  byChat.forEach((list, chat) => {
    assetUnion.unionAssets(list.map((d) => assetUnion.assetRecord(d)))
      .forEach((t) => {
        rows.push(Object.assign({ chat }, t));
        seenUrls.add(urlKey(t.url));
        t.alts.forEach((u) => seenUrls.add(urlKey(u)));
      });
  });
  const appRecs = [];
  (creations || []).forEach((c) => {
    if (!c || !c.url) return;
    const p = String(c.prompt || '');
    if (/^from /.test(p)) return;            // a chat deliverable's hook copy
    if (seenUrls.has(urlKey(c.url))) return; // already a chat's tile
    // MODEL · QUALITY · SIZE — the size is the third required slot since Aug
    // 2026 (Sophie: "1K 2K 4K should be a third slot in the model/quality
    // required tagging"). gpt-image-2 draws any canvas, so the first two no
    // longer say what a picture is: the same prompt at the same quality can
    // differ 5x in pixels and 3x in price. Absent on everything filed before
    // the field existed, and an absent slot is simply left out rather than
    // guessed — there is nothing on those records that says how big they are.
    // The third slot is the TIER — "2K", not "1568x2352" (Sophie: "i asked for
    // it to say 1k 2k or 4k"). Normalised on READ as well as on write, so the
    // records filed with raw pixels before her correction show the tier too
    // and nothing needs backfilling.
    // THE STYLE LEADS THE CAPTION (2026-08-24, Sophie: "there's no style
    // clause in Meta assets"). It was on the record the whole time — every
    // Playground run files `style` (the tile's label: Dreamy, Pastel, WTR) —
    // and this line only ever read it as a FALLBACK for a record carrying no
    // model/quality/size, so on everything filed since those fields existed
    // the style was fetched, ignored and dropped. It goes FIRST because it is
    // the coarsest fact about a picture: which recipe drew it, before how
    // well and how big.
    //
    // It is a LABEL, and a label belongs in the caption — not in the PROMPT
    // overlay's style half, which the house rule says must be the exact text
    // sent to the model. A creation doc stores her typed words and the style's
    // NAME, never the prefix/suffix wrapped around them, so filing "Dreamy"
    // as the style prompt would be a reconstruction. That half stays empty.
    const made = [c.style, c.model, c.quality, sizeTier.captionSize(c.size)]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      // A Replicate run files model === styleLabel (fileRunToCreations), so
      // without this a LoRA picture reads "WTR · WTR · medium · 1K".
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' · ');
    appRecs.push({
      url: c.url, ms: c.ms || 0,
      prompt: made,                          // the MODEL · QUALITY · SIZE caption slot
      description: p,                        // what she reviews it by
      promptContent: (c.type || 'image') === 'image' ? p : '',
      compressedAtBirth: c.compressedAtBirth === true,
    });
  });
  assetUnion.unionAssets(appRecs).forEach((t) => {
    rows.push(Object.assign({ chat: APP_BUCKET, app: true }, t));
  });
  // Filing order, newest first. Equal timestamps (a batch filed in one turn)
  // tiebreak on chat then url so paging is deterministic — an offset walk must
  // never show a row twice or skip one because two sorts disagreed.
  rows.sort((a, b) => (b.ms - a.ms)
    || (a.chat < b.chat ? -1 : a.chat > b.chat ? 1 : 0)
    || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return rows;
}


// ── Search, over the FULL list (Aug 2026 — Sophie searched "yarn" and got
// nothing). The page's box used to filter only the tiles ALREADY LOADED, and
// the grid pages 150 at a time, so anything she hadn't scrolled to was
// unsearchable — which on a several-thousand-row list is almost everything.
// The complete list lives in the server's cache, so the match runs HERE and
// the page asks the server. The grammar is the house one (search-grammar.js);
// matching is the feed's rule — every term anchored at a word start ("aries"
// must not find "boundaries"), a quoted phrase kept adjacent — the exact
// regexes the page's own qparse built, so a search here and a search over the
// loaded tiles can never disagree.
function compileQuery(q) {
  return grammar.parseQuery(q).map((g) => ({
    neg: g.neg,
    terms: g.terms.map((t) => {
      const v = t.value;
      try {
        return new RegExp((/^[a-z0-9]/i.test(v) ? '\\b' : '')
          + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'i');
      } catch (e) { return null; }
    }).filter(Boolean),
  })).filter((g) => g.terms.length);
}

const noteKey = (chat, url) => String(chat) + '|' + urlKey(url);

/**
 * Filter built rows by a query. Everything written about an image is
 * searchable, the same haystack the page builds per tile: label, the MODEL ·
 * QUALITY caption, both prompt halves, the origin chat's slug AND display
 * name, the note thread, and the [compressed] marker.
 * `opts.names` = {slug: displayName}; `opts.notes` = Map/object keyed
 * noteKey(chat, url) → array of note texts (alts are checked too).
 */
function searchMetaAssets(rows, q, opts) {
  const groups = compileQuery(q);
  if (!groups.length) return rows;
  const names = (opts && opts.names) || {};
  const notes = (opts && opts.notes) || null;
  const noteTexts = !notes ? () => null
    : (k) => (typeof notes.get === 'function' ? notes.get(k) : notes[k]);
  return rows.filter((r) => {
    const t = [r.description, r.prompt, r.promptStyle, r.promptContent,
      r.chat, r.app ? 'My Creations' : names[r.chat]];
    if (r.compressedAtBirth) t.push('[compressed] compressed at birth');
    if (notes) {
      [r.url].concat(r.alts || []).forEach((u) => {
        const texts = noteTexts(noteKey(r.chat, u));
        if (texts) texts.forEach((s) => t.push(s));
      });
    }
    const hay = t.filter(Boolean).join(' \n ');
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const hit = g.terms.some((rx) => rx.test(hay));
      if (g.neg ? hit : !hit) return false;
    }
    return true;
  });
}

module.exports = { buildMetaAssets, searchMetaAssets, noteKey, APP_BUCKET };

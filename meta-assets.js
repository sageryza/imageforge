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
 * {url, ms, prompt, type, model, quality, style}. The ones a CHAT filed ride
 * in as hook copies labeled "from <chat>" and already have a chat row — those
 * are skipped, as is any url a chat row (or its alts) already shows. What
 * survives is the APP-MADE work (stickers, dream pages, in-app generations),
 * which lives nowhere in forge-chat-assets and would otherwise vanish the day
 * the My Creations tile points here. Those rows join as the 'my-creations'
 * bucket: prompt→description (it is what the tile is reviewed by, exactly how
 * CreationsView showed it), model·quality→the caption slot, and — for plain
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
    const made = [c.model, c.quality].map((v) => String(v || '').trim())
      .filter(Boolean).join(' · ') || String(c.style || '').trim();
    appRecs.push({
      url: c.url, ms: c.ms || 0,
      prompt: made,                          // the MODEL · QUALITY caption slot
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

module.exports = { buildMetaAssets, APP_BUCKET };

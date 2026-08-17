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

/**
 * All forge-chat-assets docs (plain objects) → rows newest-first.
 * Row = the union tile ({url, ms, prompt, description, promptStyle,
 * promptContent, kind, alts}) plus `chat`.
 */
function buildMetaAssets(docs) {
  const byChat = new Map();
  (docs || []).forEach((d) => {
    if (!d || !d.url || !d.chat) return;
    const list = byChat.get(d.chat);
    if (list) list.push(d); else byChat.set(d.chat, [d]);
  });
  const rows = [];
  byChat.forEach((list, chat) => {
    assetUnion.unionAssets(list.map((d) => assetUnion.assetRecord(d)))
      .forEach((t) => rows.push(Object.assign({ chat }, t)));
  });
  // Filing order, newest first. Equal timestamps (a batch filed in one turn)
  // tiebreak on chat then url so paging is deterministic — an offset walk must
  // never show a row twice or skip one because two sorts disagreed.
  rows.sort((a, b) => (b.ms - a.ms)
    || (a.chat < b.chat ? -1 : a.chat > b.chat ? 1 : 0)
    || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return rows;
}

module.exports = { buildMetaAssets };

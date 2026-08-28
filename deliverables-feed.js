// deliverables-feed.js — the DELIVERED tab's list: films, cuts and pictures,
// newest first, as they were handed over.
//
// Sophie's ask (2026-08-28, restructuring the chat area): "one - list of
// deliverables AS they're delivered. so - just the link to a movie, previews
// of images and whatnot" · "just three images, like the update tab".
//
// TWO SOURCES, ONE ORDER. The films/cuts are `forge-deliverables` exactly as
// the /deliverables page already reads them — a pinned film IS a hand-over, so
// nothing new has to be filed. The PICTURES are derived the way the Update
// tab's strip is (brief.js), because there is no image door into the
// deliverables list and 2,488 filed images would bury the films if there were.
//
// A PICTURE ROW IS A BURST, NOT A CHAT. "As they're delivered" is the whole
// ask, so a chat that handed her nine panels this morning and three more
// tonight is TWO rows, not one card that quietly re-points at the newest
// three. A burst ends when a chat goes BURST_MS without filing another
// picture; the row carries the three newest and says how many there were.
//
// WHAT IS NOT A DELIVERABLE, and each exclusion is somebody's earlier lesson:
//   • her own SOURCE LIBRARIES — the Dump, the crystal photos, her Midjourney
//     exports (asset-guard's own list). Nobody handed those to her; she put
//     them in.
//   • a DERIVED display copy (`thumbs/`, `drops/_thumb/`) — a thumbnail is
//     not a picture being delivered, it is the same picture smaller.
//   • an unlabeled `claude-deliveries/` twin of a picture already in the row.
//     The md5 join is the Assets tab's own first key; the copy carrying the
//     LABEL wins the url, because the label is what the row reads as.
//
// Pure — no Firestore, no network, no clock of its own. deliverables.js does
// the reading; this decides what the list says.
// Tests: node scripts/test-deliverables-feed.js

const { sourceLibraryPrefix, derivedPrefix } = require('./asset-guard');

// A hand-over is a sitting. Measured against her real filing: a panels batch
// lands inside a couple of minutes, and the next batch from the same chat is
// usually hours later. Two hours is wide enough that one delivery never splits
// into two rows and narrow enough that a morning and an evening stay apart.
const BURST_MS = 2 * 60 * 60 * 1000;

// Three, like the Update tab's card — her words. A row says how many there
// really were, so the cap hides nothing.
const IMAGES_PER_ROW = 3;

const IMG_URL_RE = /\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i;

const ms = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
};
const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

/** Is this asset record a picture a chat HANDED her? */
function deliverablePicture(a) {
  if (!a || !a.chat || !a.url) return false;
  const url = String(a.url);
  if (a.kind === 'audio' || !IMG_URL_RE.test(url)) return false;
  if (derivedPrefix(url)) return false;        // a thumbnail is not a delivery
  if (sourceLibraryPrefix(url)) return false;  // her own pile, not a hand-over
  return true;
}

/**
 * One chat's pictures → its delivery bursts, newest first.
 * Deduped by md5 first (the Assets tab's own first key), then by url.
 */
function burstsFor(list) {
  const per = new Map();
  list.forEach((a) => {
    const key = a.md5 || a.urlKey || a.url;
    const label = clean(a.description, 120);
    // `from <chat>` is the hook's generic filler, never a curated caption
    const caption = /^from /i.test(String(a.prompt || '')) ? '' : clean(a.prompt, 60);
    const at = ms(a.created);
    const prev = per.get(key);
    if (!prev) { per.set(key, { url: String(a.url), label, caption, at }); return; }
    // THE LABELED COPY WINS THE URL. The two records land seconds apart in
    // whichever order and the unlabeled one is always the hook's copy of the
    // same bytes, so "first one wins" strips the label off half the strip.
    if (label && !prev.label) { prev.url = String(a.url); prev.label = label; }
    if (caption && !prev.caption) prev.caption = caption;
    if (at > prev.at) prev.at = at;
  });
  const pics = Array.from(per.values()).sort((a, b) => b.at - a.at);
  const out = [];
  let cur = null;
  pics.forEach((p) => {
    if (cur && cur[cur.length - 1].at - p.at <= BURST_MS) { cur.push(p); return; }
    cur = [p];
    out.push(cur);
  });
  return out;
}

/**
 * @param {object[]} input.deliverables rows as /api/deliverables serves them
 * @param {object[]} input.assets       `forge-chat-assets` docs
 * @param {object}   input.chats        the registry, for display names
 * @param {number}   input.limit        rows back
 */
function buildFeed({ deliverables, assets, chats, limit = 60 } = {}) {
  const reg = chats || {};
  const nameOf = (c) => clean((reg[c] && reg[c].displayName) || c, 80);

  const rows = [];

  (deliverables || []).forEach((d) => {
    if (!d || !d.url) return;
    rows.push({
      kind: d.kind === 'audio' ? 'audio' : d.kind === 'link' ? 'link' : 'video',
      at: new Date(ms(d.updatedAt || d.at) || 0).toISOString(),
      chat: d.chat || '',
      chatName: d.chatName || nameOf(d.chat || ''),
      title: clean(d.title, 160) || 'Untitled',
      url: d.url,
      versions: d.versions || 1,
      older: d.older || [],
    });
  });

  const byChat = new Map();
  (assets || []).forEach((a) => {
    if (!deliverablePicture(a)) return;
    const arr = byChat.get(a.chat) || [];
    arr.push(a);
    byChat.set(a.chat, arr);
  });
  byChat.forEach((list, chat) => {
    burstsFor(list).forEach((burst) => {
      const shown = burst.slice(0, IMAGES_PER_ROW);
      rows.push({
        kind: 'images',
        at: new Date(burst[0].at).toISOString(),
        chat,
        chatName: nameOf(chat),
        // The newest picture's own label is what the row reads as — it is what
        // she reviews by, and inventing a title for a batch would be a
        // paraphrase of something she already named.
        title: burst.find((p) => p.label) ? burst.find((p) => p.label).label : '',
        count: burst.length,
        images: shown.map((p) => ({ url: p.url, label: p.label, caption: p.caption })),
      });
    });
  });

  rows.sort((a, b) => ms(b.at) - ms(a.at));
  return { items: rows.slice(0, limit) };
}

module.exports = { buildFeed, burstsFor, deliverablePicture, BURST_MS, IMAGES_PER_ROW };

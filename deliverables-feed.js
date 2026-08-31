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
//   • ANYTHING WITH NO LABEL AT ALL. This is the load-bearing one, and it is
//     the house rule rather than a new judgement: a chat LABELS every image it
//     delivers ("[Penny — the blue Kleenex](url)", never a bare url), so an
//     unlabeled record is a background catch — the hook filing a picture a
//     chat merely touched, a generated chat ICON, a film's cover frame, a
//     poster. Measured against the live feed the hour this shipped: of 18
//     picture rows, the 7 with nothing labeled were ALL of that kind
//     (`chat-feed/icons/`, `…/covers/`, `…/posters/`) and every labeled row
//     read as a real hand-over. A path blacklist would have had to grow a line
//     per surface forever; the label is what a delivery already has.
//
// TWO RULES SHE ADDED THE HOUR IT SHIPPED (2026-08-28: "newest replaces
// oldest" · "disappears if i write back"):
//
//   • ONE ROW PER WORK, ITS NEWEST. A film already collapsed by title stem
//     (deliverables.js `workKey`); a chat's PICTURES collapse by chat, so a
//     second batch replaces the first rather than stacking beside it. Nothing
//     is lost — the earlier ones ride along as `older` and the row says how
//     many. This narrows the "as they're delivered" rule rather than undoing
//     it: the bursts are still what a row IS, only the older ones fold.
//
//   • ANSWERED IS DONE. A row leaves the list once she has written back to
//     that chat since it was delivered — `lastHerAt` on the registry, her REAL
//     send time, stamped by the one route both her doors come through (the
//     hook lifting her words out of the Claude app, and the app's reply box).
//     So the tab is what has been handed to her and not yet dealt with, and it
//     empties itself. A chat that delivers again after she wrote back comes
//     back, because the new delivery is newer than her message.
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
  // A hand-over is LABELED — see the header. An unlabeled record is a
  // background catch, and `from <chat>` is the hook's own filler, not a name.
  if (!String(a.description || '').trim()) return false;
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

  // ANSWERED IS DONE — her own message since the hand-over takes the row off.
  const live = rows.filter((r) => {
    const her = reg[r.chat] && reg[r.chat].lastHerAt;
    return !(her && ms(her) > ms(r.at));
  });

  // NEWEST REPLACES OLDEST. The films arrive already collapsed by work; the
  // pictures collapse by CHAT, which is the same question asked of a surface
  // that has no title stem to group on. Sorted newest-first above, so the
  // first one seen is the keeper and everything after it folds under it.
  const seen = new Map();
  const out = [];
  live.forEach((r) => {
    if (r.kind !== 'images') { out.push(r); return; }
    const keep = seen.get(r.chat);
    if (!keep) { r.older = []; seen.set(r.chat, r); out.push(r); return; }
    keep.older.push({ at: r.at, count: r.count, title: r.title });
  });

  return { items: out.slice(0, limit) };
}

module.exports = { buildFeed, burstsFor, deliverablePicture, BURST_MS, IMAGES_PER_ROW };

// SWAPPING A PICTURE INTO A BEAT'S ART SLOT — the ONE place the Story Room's
// past-pictures row is bookkept, so /image (the inbox, and her picking an
// older version back) and a finished draw can never disagree about it.
//
// Its own file, with no dependencies, because the two rules below are the
// whole reason picking works and they are worth a test that needs nothing
// installed (Sophie, 2026-08-24: "make the past picture thumbnails so that I
// can actually pick one"):
//   1. The picture LEAVING is kept. Nothing here ever deletes a picture —
//      that row is what she picks from.
//   2. The picture ARRIVING comes OUT of the history. It is the current one
//      now, and a url sitting in both places draws TWICE in that row — once
//      ringed as current, once as an older version — which is the bug a
//      naive pick ships.
//
// Provenance follows the picture: a version banked from here carries the
// `src` that made it, so picking it back restores its own prompt. Where
// nothing is known (a phone upload, a version banked before this stored one)
// the src is DROPPED rather than left behind — the previous picture's run is
// a lie about what drew this one, and nothing reads src today, so an absent
// one costs nothing where a wrong one would outlive the fix.
//
// A CLIP slot becomes a picture slot: leaving `kind` behind would render an
// image url as a film. Only this slot — the other style's side is untouched.
function swapArt(slot, url, src, now) {
  const at = Number.isFinite(now) ? now : Date.now();
  if (slot.kind === 'clip') {
    delete slot.kind; delete slot.poster; delete slot.seconds;
    delete slot.title; delete slot.clipId; delete slot.url;
  }
  const hist = Array.isArray(slot.imageHistory) ? slot.imageHistory.slice() : [];
  const back = hist.find((h) => h && h.url === url) || null;
  if (slot.url && slot.url !== url) {
    const kept = { url: slot.url, at };
    if (slot.src) kept.src = slot.src;
    hist.push(kept);
  }
  const next = hist.filter((h) => h && h.url !== url);
  if (next.length) slot.imageHistory = next; else delete slot.imageHistory;
  slot.url = url;
  if (src) slot.src = src;
  else if (back && back.src) slot.src = back.src;
  else delete slot.src;
  // Art here again un-deletes this side (`off`, per slot).
  delete slot.off;
  return slot;
}

// TAKING ONE PICTURE OFF A BEAT — the cull (2026-08-28, Sophie: "how to cull
// beat pictures"). Rule 1 above says nothing here ever deletes a picture, and
// that is still right for a SWAP: the row is what she picks from. It had no
// answer for "this one was never mine" — a picture that landed on the wrong
// beat sat in that row forever, and the only exits were the trash button
// (which takes the beat, words and all) or drawing over it (which only ever
// makes the row longer).
//
// The picture itself is untouched: it stays in Storage and in My Creations,
// and the ROUTE banks what this returns in pad.trash, so a cull is undoable.
// This only ever forgets that this BEAT had it.
//
// Two cases, and the second is the whole reason this is here rather than
// inline in the route:
//   • an OLDER picture → dropped from the row, the beat's art untouched.
//   • the CURRENT art → dropped, and the NEWEST picture in the row takes its
//     place, with its own src. That is what a cull means when you are looking
//     at the thing you are culling: "no, not that one" shows you the previous
//     one. An empty row leaves the side with no art — a legitimate state (most
//     beats have none), and never `off`, which would take the beat off this
//     side altogether.
//
// A CLIP is refused: nothing in that row is a film, and clearing a clip slot
// through here would leave `kind`/`poster`/`seconds` behind on a side that no
// longer has one. Removing a clip is the beat's own delete.
function forgetArt(slot, url) {
  if (!slot || !url) return null;
  if (slot.kind === 'clip') return null;
  const hist = Array.isArray(slot.imageHistory) ? slot.imageHistory.slice() : [];
  const isCur = slot.url === url;
  // Every entry carrying that url, not just the first — a row must never be
  // left showing a picture the cull was asked to take off it.
  const hits = hist.filter((h) => h && h.url === url);
  if (!isCur && !hits.length) return null;
  const gone = { url, at: Date.now() };
  const from = isCur ? slot : (hits[hits.length - 1] || {});
  if (from.src) gone.src = from.src;
  const next = hist.filter((h) => !h || h.url !== url);
  if (isCur) {
    // Newest first out of the row — pushed last, so the end of the list.
    const back = next.pop() || null;
    if (back) { slot.url = back.url; if (back.src) slot.src = back.src; else delete slot.src; }
    else { delete slot.url; delete slot.src; }
    delete slot.gen;
  }
  if (next.length) slot.imageHistory = next; else delete slot.imageHistory;
  return gone;
}

module.exports = { swapArt, forgetArt };

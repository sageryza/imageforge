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

module.exports = { swapArt };

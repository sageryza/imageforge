// DUPLICATING A STORY — one story becomes two, so the same words can be
// drawn twice (2026-08-27, Sophie: "can u duplicate the hate of the game
// story room story so i can do my own pictures name one (mine) and the other
// (claude) as suffix").
//
// Its own dependency-free file, like pad-art.js and pad-side.js, because the
// three rules below are the whole of it and they are worth a test that needs
// nothing installed:
//
//   1. EVERY BEAT GETS A FRESH ID. Two stories sharing a beat id is not a
//      cosmetic problem — /text, /image, /color and /remove all find a beat
//      by id inside ONE pad, and the Story Link's `fromMoments` join is by
//      id too, so a shared id makes a beat that belongs to two stories.
//   2. IT IS A DENY-LIST, NOT A COPY-LIST. A story carries fields chats keep
//      adding to; copying everything and then deleting the few that must NOT
//      travel means a field added next month rides along by itself, where a
//      copy-list would silently drop it. What must not travel is the OTHER
//      version's output — its renders (`film`/`films`), its Episode Editor
//      episodes, and its place on her shelf (`pinned`).
//   3. `art:false` LEAVES THE WORDS AND TAKES THE PICTURES. That is the case
//      this was built for: a blank canvas carrying the story. The art is
//      emptied through the caller's own SLOT_KEYS list (scratchpad.js owns
//      what belongs to one side) rather than by wiping the beat, because the
//      words, the frame colour, her voice takes and the chunk link live at
//      the beat root and belong to both sides. The story's INBOX still comes
//      across, so the pictures the other version used are one tap away
//      rather than gone.
//
// `gen` is dropped from every slot either way: it marks a draw that is
// running RIGHT NOW in the other story, and a copy of that marker is a beat
// that sits forever waiting for a job nobody started.

// The other version's output, and where it sits on the shelf.
const DROP = ['film', 'films', 'episodes', 'pinned', 'updatedAt', 'pad', 'id'];

function dupPad(data, opts) {
  const o = opts || {};
  const styles = Array.isArray(o.styles) && o.styles.length ? o.styles : ['watercolor'];
  const slotKeys = Array.isArray(o.slotKeys) ? o.slotKeys : [];
  const mkId = typeof o.mkId === 'function' ? o.mkId : (() => null);
  const art = o.art === true;
  const now = Number.isFinite(o.now) ? o.now : Date.now();

  const src = (data && typeof data === 'object') ? data : {};
  const next = JSON.parse(JSON.stringify(src));
  DROP.forEach((k) => { delete next[k]; });

  // The watercolor slot IS the beat root and every other style lives under
  // beat.alt[style] — the same shape artSlot() hands out, spelled here so
  // this file needs nothing from scratchpad.js but the two lists.
  const slotsOf = (b) => [b].concat(
    styles.filter((s) => s !== 'watercolor').map((s) => b.alt && b.alt[s]),
  ).filter(Boolean);

  next.beats = (Array.isArray(src.beats) ? src.beats : []).map((b0) => {
    const b = JSON.parse(JSON.stringify(b0 || {}));
    b.id = mkId() || `${now}-${Math.random().toString(36).slice(2, 10)}`;
    if (!art) {
      slotsOf(b).forEach((slot) => slotKeys.forEach((k) => { delete slot[k]; }));
      // A side she had DELETED the beat from is about the other version's
      // art; with no art here, every side starts drawable.
      slotsOf(b).forEach((slot) => { delete slot.off; });
    }
    slotsOf(b).forEach((slot) => { delete slot.gen; });
    return b;
  });

  // The pinned shelf face is a URL of the OTHER version's picture — keeping
  // it would tile a story that has no art with art.
  if (!art) delete next.cover;
  if (typeof o.title === 'string') next.title = o.title;
  next.updatedAt = now;
  return next;
}

module.exports = { dupPad, DROP };

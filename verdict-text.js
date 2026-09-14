'use strict';
// The most a verdict text holds. 8000 since 2026-09-08 (a belt scene box is one
// item, and the longest scene on the hospital belt is ~2,400 characters; 2000
// was a note's size and cut her scene mid-word).
const TEXT_MAX = 8000;
// THE TEXT A VERDICT WRITE REPLACES IS KEPT ONE STEP BACK (2026-09-07).
//
// Why: an item's `text` on a verdict doc is the note thread (__compareNotes
// in compare.js), and a page that stored its own editable text under the same
// item id had that text REPLACED the moment she wrote a note on the item —
// her scene edit was gone, and nothing anywhere had a copy. The route now
// files what it writes over under `textsWas[item]`, so the one thing a wrong
// key can destroy is recoverable once.
//
// Pure: given the doc as it stands, the item and the incoming text, answer
// what to keep — or null when nothing is lost (first write, same text, an
// empty slot). A note thread REPEATS its earlier lines (compare.js joins the
// whole thread on every save), so a thread growing is not a loss and is kept
// only as the previous shorter thread — still one step, still honest.
function keptOver(doc, item, incoming) {
  const texts = (doc && doc.texts) || {};
  const old = texts[item];
  if (old === undefined || old === null) return null;
  const was = String(old);
  if (!was.trim()) return null;
  if (was === String(incoming == null ? '' : incoming)) return null;
  return { text: was.slice(0, TEXT_MAX), at: new Date().toISOString() };
}
module.exports = { keptOver, TEXT_MAX };

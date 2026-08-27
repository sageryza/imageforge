// voicelab-recover.js — WHICH ElevenLabs history item is this killed render?
//
// A Voice Studio render is a fire-and-forget background job, so a deploy that
// swaps the instance out mid-render kills the process between "ElevenLabs
// finished the audio" and "we saved it" — the doc sits on `rendering` forever
// and the page spins on it (happened for real: Sophie's 4,842-character Max
// take, 2026-08-27T03:16Z, orphaned by the deploy that merged four minutes
// earlier; ~$0.13 of credits spent, five and a half minutes of audio, nothing
// to show for it).
//
// THE AUDIO IS NOT LOST — ElevenLabs keeps every generation in its own history
// and hands the mp3 back for free. So a killed render is recovered, not
// re-rendered: the same rule the Playground's banked-sheet recovery follows —
// never mark paid work failed when the paid half survives.
//
// This file is the one thing that can go wrong: picking the WRONG item. She
// re-renders the same words over and over (six "magic pills" takes in ninety
// seconds), so "a take in the right voice around the right time" is not
// specific enough on its own. The rules, strictest first:
//
//   1. the REQUEST ID, when the doc has one — voicelab.js stamps it the moment
//      the response headers arrive, which is before the body is buffered and
//      before the upload, i.e. before nearly every kill. Exact, unambiguous.
//   2. TTS — her EXACT words, that voice, inside the window.
//   3. STS — that voice, source STS, inside the window, and ONLY when exactly
//      one item qualifies. There is no text to tell two conversions apart, and
//      handing her another take's audio under this take's name is worse than
//      leaving the card failed.
//
// And in every case an item that sits closer to ANOTHER of her renders belongs
// to that one — a stuck doc must never claim the take that a doc which
// finished normally already used.
//
// Pure: no network, no Firestore, no clock. Tested by scripts/test-voicelab-recover.js.

// Generation takes real time (measured: 48s for 4,842 characters), so the item
// is stamped AFTER the doc. The slack before is clock skew between the two.
const WINDOW_BEFORE_MS = 60 * 1000;
const WINDOW_AFTER_MS = 15 * 60 * 1000;

function ms(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function normText(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

function itemAt(h) {
  return Number(h && h.date_unix ? h.date_unix : 0) * 1000;
}

function sourceFor(rec) {
  return (rec && rec.kind) === 'sts' ? 'STS' : 'TTS';
}

// Could this render have produced this item at all? Voice, kind and the window
// — everything except the text, which only TTS can be asked about.
function plausible(rec, h) {
  const at = ms(rec.createdAt);
  if (!at) return false;
  if (rec.voiceId && h.voice_id && h.voice_id !== rec.voiceId) return false;
  if (h.source && h.source !== sourceFor(rec)) return false;
  const t = itemAt(h);
  if (!t) return false;
  return t >= at - WINDOW_BEFORE_MS && t <= at + WINDOW_AFTER_MS;
}

function claims(rec, h) {
  if (!plausible(rec, h)) return false;
  if ((rec.kind || 'tts') === 'sts') return true;
  return normText(rec.text) === normText(h.text);
}

// Of every render that could own this item, the one whose start sits nearest
// to it. Ties go to the earlier doc, so the answer never depends on read order.
function ownerOf(h, recs) {
  let best = null;
  let bestGap = Infinity;
  for (const r of recs) {
    if (!claims(r, h)) continue;
    const gap = Math.abs(itemAt(h) - ms(r.createdAt));
    if (gap < bestGap || (gap === bestGap && best && ms(r.createdAt) < ms(best.createdAt))) {
      best = r;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * @param rec    the stuck render doc: { id, kind, voiceId, text, createdAt, requestId? }
 * @param items  ElevenLabs /v1/history rows
 * @param opts   { claimed:[historyItemId], others:[render docs] }
 * @returns { item, by, why }
 */
function pickHistoryItem(rec, items, opts = {}) {
  const claimed = new Set(opts.claimed || []);
  const others = (opts.others || []).filter((o) => o && o.id && o.id !== (rec || {}).id);
  const list = (items || []).filter((h) => h && h.history_item_id && !claimed.has(h.history_item_id));
  if (!rec) return { item: null, by: null, why: 'no render' };

  if (rec.requestId) {
    const exact = list.find((h) => h.request_id && h.request_id === rec.requestId);
    if (exact) return { item: exact, by: 'request-id' };
  }
  if (!ms(rec.createdAt)) return { item: null, by: null, why: 'the render has no start time' };

  const mine = list.filter((h) => claims(rec, h));
  if (!mine.length) return { item: null, by: null, why: 'no generation matches this take' };

  const everyone = [rec].concat(others);
  const unspoken = mine.filter((h) => (ownerOf(h, everyone) || {}).id === rec.id);
  if (!unspoken.length) return { item: null, by: null, why: 'the matching generations belong to other takes' };

  // A conversion carries no words of its own, so two of them inside one window
  // cannot be told apart — refuse rather than guess.
  if ((rec.kind || 'tts') === 'sts' && unspoken.length > 1) {
    return { item: null, by: null, why: 'more than one conversion in that window — nothing to tell them apart' };
  }

  const at = ms(rec.createdAt);
  unspoken.sort((a, b) => Math.abs(itemAt(a) - at) - Math.abs(itemAt(b) - at));
  return { item: unspoken[0], by: (rec.kind || 'tts') === 'sts' ? 'voice+time' : 'text+voice+time' };
}

module.exports = { pickHistoryItem, WINDOW_BEFORE_MS, WINDOW_AFTER_MS };

const crypto = require('node:crypto');

// ── the audio fingerprint ───────────────────────────────────────────────────
//
// Its OWN module, with no dependencies beyond node:crypto, because two
// different programs have to agree on it exactly: the server (memos.js, for
// dedupe) and the Mac push (scripts/push-memos.mjs, which uses it to prove
// that a local Voice Memos recording and an already-archived record are the
// same audio before it corrects that record's date). A second hand-copied
// implementation would drift, and a fingerprint that drifts silently stops
// matching — the failure mode is invisible.
//
// THE FILE md5 IS NOT A FINGERPRINT OF THE RECORDING. iOS rewrites an m4a's
// QuickTime creation/modification dates every time the file is exported or
// shared, so re-sharing a recording you already archived produces DIFFERENT
// BYTES for identical audio — and the md5 half of the dedupe can never fire.
//
// Measured, not assumed (2026-08-07, on the pair 2026-08-02_1243 /
// 2026-08-03_2131): both files 2,820,952 bytes, exactly 36 bytes different,
// every one of them a date field — copy A says 2026-08-02T19:43:44Z, copy B
// says 2026-08-04T04:31:10Z, each matching the moment it was FILED. All 2.8MB
// of audio was bit-identical. That one cause defeated BOTH dedupe layers at
// once, because `mvhdDate()` below reads the same rewritten clock, so the
// derived stamp was "when it was shared" too.
//
// `audioHash` zeroes those fields before hashing, so a recording fingerprints
// the same however many times it has been shared.
//
// The scan is deliberately a WHOLE-BUFFER search rather than a tree walk from
// the top-level moov: Voice Memos leaves an earlier copy of mvhd/tkhd/mdhd
// embedded inside the mdat region (same file: headers at 17814 and again at
// 2755110), and iOS updates both copies. A tree walk finds only the second
// and the two fingerprints would still disagree.
//
// A false hit is implausible: the four ASCII bytes must be preceded by a size
// field exactly equal to that box's size at the version byte that follows it.
// Nothing is copied — the hash is fed the buffer's own slices with zeros
// spliced in, so a 400MB recording costs no extra memory.
const DATE_BOXES = { mvhd: [108, 120], tkhd: [92, 104], mdhd: [32, 44] };
const ZEROS = Buffer.alloc(16);
function audioHash(buf) {
  const spans = [];
  for (const [type, sizeFor] of Object.entries(DATE_BOXES)) {
    let i = 0;
    while ((i = buf.indexOf(type, i, 'latin1')) >= 0) {
      const at = i;
      i += 4;
      if (at < 4 || at + 8 > buf.length) continue;
      const version = buf[at + 4];
      if (version > 1) continue;
      if (buf.readUInt32BE(at - 4) !== sizeFor[version]) continue;
      const width = version === 1 ? 8 : 4;
      const end = at + 8 + width * 2;
      if (end > buf.length) continue;
      spans.push([at + 8, end]);
    }
  }
  if (!spans.length) return null; // not an ISO-BMFF file — the md5 is all there is
  spans.sort((a, b) => a[0] - b[0]);
  const h = crypto.createHash('md5');
  let p = 0;
  for (const [s, e] of spans) {
    if (s < p) continue;
    h.update(buf.slice(p, s));
    h.update(ZEROS.slice(0, e - s));
    p = e;
  }
  h.update(buf.slice(p));
  return h.digest('hex');
}

module.exports = { audioHash, DATE_BOXES };

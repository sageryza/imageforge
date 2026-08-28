// WHAT SIZE IS THIS PICTURE — from its first bytes, and nothing else.
//
// Written for the Story Room's "a story's shape follows its first picture"
// rule (2026-08-28, Sophie: "automatic by first picture"), which needs one
// number about a picture it has never opened. The whole point is that it
// answers from a HEADER, so the caller can ask for a few kilobytes over the
// network instead of pulling a 3MB original.
//
// WHY NOT JUST sharp(buf).metadata() — MEASURED, and it is the reason this
// file exists: sharp reads a truncated PNG and a truncated JPEG header fine,
// and REFUSES a truncated WEBP ("Input buffer has corrupt header: webp:
// unable to parse image"). Webp is the format this app stores nearly
// everything in, so the ranged read would have failed on exactly the common
// case and fallen back to downloading whole originals. The webp container
// spells its canvas out in the first 30 bytes; so do the others.
//
// Pure — no dependencies, no network, no I/O. Give it a Buffer of the first
// bytes of a file; it answers { w, h } or null, and null always means "I
// can't tell from this", never a guess. A caller that needs an answer for a
// format this doesn't know can fall back to sharp on the same buffer.
//
// Tests: node scripts/test-image-size.js

// The smallest buffer worth asking about. Every header below lives well
// inside this; a caller reading less is likelier to get a null than an answer.
const HEADER_BYTES = 4096;

function ascii(buf, at, len) {
  return buf.length >= at + len ? buf.toString('latin1', at, at + len) : '';
}

// PNG — IHDR is always the first chunk, at a fixed offset.
function png(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;      // \x89PNG
  if (ascii(buf, 12, 4) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// GIF — the logical screen descriptor sits right after the signature.
function gif(buf) {
  if (buf.length < 10 || ascii(buf, 0, 3) !== 'GIF') return null;
  return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
}

// WEBP — a RIFF container whose FIRST chunk says which of the three shapes
// this file is. All three carry the canvas within the first 30 bytes.
function webp(buf) {
  if (buf.length < 30 || ascii(buf, 0, 4) !== 'RIFF' || ascii(buf, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(buf, 12, 4);
  // Extended: the canvas is stored as (size - 1) in three bytes each.
  if (chunk === 'VP8X') return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  // Lossless: 14 bits of width then 14 of height, both minus one, packed
  // little-endian after the one-byte signature.
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;                      // the VP8L signature byte
    const bits = buf.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  // Lossy: a VP8 keyframe header — the 3-byte start code, then the canvas
  // in 14 bits each (the top two bits of each pair are the scale, not size).
  if (chunk === 'VP8 ') {
    if (!(buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a)) return null;
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

// JPEG — walk the marker chain to the frame header. The frame is normally a
// few hundred bytes in, but an embedded colour profile or thumbnail can push
// it further, which is why this walks rather than reading a fixed offset.
function jpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let p = 2;
  while (p + 9 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }                 // resync over padding
    const marker = buf[p + 1];
    if (marker === 0xff) { p++; continue; }
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
    // Start Of Frame — every SOF but the four that are something else
    // (DHT c4, JPG c8, DAC cc) puts height then width at a fixed offset.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
    }
    // Start Of Scan — the entropy-coded data begins and there is no frame
    // header ahead of us. Stop rather than reading pixels as markers.
    if (marker === 0xda) return null;
    p += 2 + buf.readUInt16BE(p + 2);
  }
  return null;
}

// The size of the picture these bytes begin, or null when they don't say.
// Never guesses: a format this doesn't know, a header that hasn't arrived
// yet, and a zero dimension all answer null.
function imageSize(buf) {
  if (!buf || !buf.length) return null;
  for (const read of [png, webp, jpeg, gif]) {
    let s = null;
    try { s = read(buf); } catch { s = null; }              // a short buffer mid-header
    if (s && s.w > 0 && s.h > 0) return { w: s.w, h: s.h };
  }
  return null;
}

module.exports = { imageSize, HEADER_BYTES };

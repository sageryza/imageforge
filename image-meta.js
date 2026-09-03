'use strict';
/*
 * image-meta.js — THE PROMPT RIDES INSIDE THE PICTURE FILE (2026-09-03,
 * Sophie: "could the prompt it was made from be filed as metadata w pictures"
 * · "would this help our recurring prompt issue?").
 *
 * The whole-prompt rule (prompt-record.js) stores the exact text on a
 * Firestore doc. That record is joined to the picture by url, filename or
 * md5 — and every one of those joins breaks the moment the bytes travel: a
 * re-encoded copy, a download, a Save to Photos, a file pasted into another
 * chat. This writes the same fields INTO the file as an XMP packet, so the
 * picture carries its own prompt wherever it goes, and anything that receives
 * the bytes can read it back (POST /api/gallery does).
 *
 * PURE BYTE SURGERY, NO DECODE, NO ENCODE. A lossless webp re-encoded through
 * sharp keeps its pixels but costs a 4K encode on a 512MB box (the cut gate's
 * own measurement: ~150MB peak). Splicing a chunk into the container costs a
 * Buffer.concat and leaves the picture data byte-for-byte what the model
 * returned — the house "nothing stands between the source and the output"
 * rule, kept literally. Node stdlib only, so the test needs no node_modules.
 *
 *   stamp(buf, fields)  → a new Buffer carrying the packet (webp / png / jpeg);
 *                         anything else, or a malformed file, comes back
 *                         UNCHANGED — stamping must never fail a save.
 *   read(buf)           → the fields, or null when there is no packet.
 *   readRemote(url)     → the same off a hosted file, reading only the tail
 *                         (webp/png keep the packet at the end) or the head
 *                         (jpeg) — never the whole object.
 *
 * WHAT IS WRITTEN: the forge: namespace carries the fields as-is, and
 * dc:description carries her words (promptContent, else the full prompt) —
 * that is the field Photos shows as a picture's Caption.
 */

const FIELDS = ['fullPrompt', 'promptStyle', 'promptContent', 'model', 'quality',
  'size', 'canvas', 'style', 'chat', 'madeAt', 'engine', 'label'];
const NS = 'https://imageforge-q125.onrender.com/ns/forge/1.0/';
const XMP_KEY = 'XML:com.adobe.xmp';
const JPEG_XMP_SIG = 'http://ns.adobe.com/xap/1.0/\0';
// A prompt is capped at 6000 (prompt-record.js CAP); three of them plus the
// wrapper stays far under this, and a jpeg APP1 segment cannot exceed 65533.
const MAX_PACKET = 60000;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');
// XML 1.0 forbids most control characters outright; a prompt never holds
// them on purpose, so they are dropped rather than refused.
const xmlSafe = (s) => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

function cleanFields(fields) {
  const out = {};
  for (const k of FIELDS) {
    const v = fields && fields[k];
    if (v == null) continue;
    const s = xmlSafe(String(v)).trim();
    if (s) out[k] = s;
  }
  return out;
}

/** The XMP packet as a string, or '' when there is nothing to say. */
function packet(fields) {
  const f = cleanFields(fields);
  if (!Object.keys(f).length) return '';
  const caption = f.promptContent || f.fullPrompt || '';
  const lines = Object.keys(f).map((k) => `      <forge:${k}>${esc(f[k])}</forge:${k}>`);
  const dc = caption
    ? `\n      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${esc(caption)}</rdf:li></rdf:Alt></dc:description>`
    : '';
  const x = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="ImageForge">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:forge="${NS}">${dc}
${lines.join('\n')}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  return x.length > MAX_PACKET ? '' : x;
}

/** The fields out of a packet string, or null. */
function parsePacket(xml) {
  if (!xml || xml.indexOf('<x:xmpmeta') < 0) return null;
  const out = {};
  const re = /<forge:([A-Za-z]+)>([\s\S]*?)<\/forge:\1>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (FIELDS.includes(m[1])) out[m[1]] = unesc(m[2]);
  }
  if (!Object.keys(out).length) {
    // Not ours, but a caption written by another tool is still worth reading.
    const d = xml.match(/<dc:description>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/);
    if (d) out.promptContent = unesc(d[1]);
  }
  return Object.keys(out).length ? out : null;
}

// ── containers ──────────────────────────────────────────────────────────────

function kindOf(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return '';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf[0] === 0x89 && buf.slice(1, 4).toString('latin1') === 'PNG') return 'png';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
  return '';
}

// -- webp: RIFF chunks; XMP rides in an 'XMP ' chunk after the image data,
//    announced by a flag in the VP8X header (built here when the file is a
//    bare VP8L/VP8, which is what gpt-image-2 returns).
function webpChunks(buf) {
  const chunks = [];
  let p = 12;
  while (p + 8 <= buf.length) {
    const id = buf.slice(p, p + 4).toString('latin1');
    const size = buf.readUInt32LE(p + 4);
    const end = p + 8 + size;
    if (end > buf.length) return null;               // truncated → leave it alone
    chunks.push({ id, data: buf.slice(p + 8, end) });
    p = end + (size & 1);
  }
  return chunks;
}
function webpDims(chunks) {
  for (const c of chunks) {
    if (c.id === 'VP8L' && c.data.length >= 5 && c.data[0] === 0x2f) {
      const b = c.data.readUInt32LE(1);
      return { w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1, alpha: !!((b >>> 28) & 1) };
    }
    if (c.id === 'VP8 ' && c.data.length >= 10 && c.data[3] === 0x9d && c.data[4] === 0x01 && c.data[5] === 0x2a) {
      return { w: c.data.readUInt16LE(6) & 0x3fff, h: c.data.readUInt16LE(8) & 0x3fff, alpha: false };
    }
  }
  return null;
}
function riffChunk(id, data) {
  const head = Buffer.alloc(8);
  head.write(id, 0, 'latin1');
  head.writeUInt32LE(data.length, 4);
  return data.length & 1 ? Buffer.concat([head, data, Buffer.alloc(1)]) : Buffer.concat([head, data]);
}
function webpStamp(buf, xmp) {
  const chunks = webpChunks(buf);
  if (!chunks || !chunks.length) return buf;
  const kept = chunks.filter((c) => c.id !== 'XMP ');
  const vp8x = kept.find((c) => c.id === 'VP8X');
  let body;
  if (vp8x) {
    const d = Buffer.from(vp8x.data);
    d[0] |= 0x04;                                    // the XMP flag
    body = kept.map((c) => (c === vp8x ? { id: 'VP8X', data: d } : c));
  } else {
    const dims = webpDims(kept);
    if (!dims) return buf;
    const d = Buffer.alloc(10);
    d[0] = 0x04 | (dims.alpha ? 0x10 : 0);
    d.writeUIntLE(dims.w - 1, 4, 3);
    d.writeUIntLE(dims.h - 1, 7, 3);
    body = [{ id: 'VP8X', data: d }, ...kept];
  }
  body.push({ id: 'XMP ', data: Buffer.from(xmp, 'utf8') });
  const parts = body.map((c) => riffChunk(c.id, c.data));
  const total = parts.reduce((n, p) => n + p.length, 4);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(total, 4);
  head.write('WEBP', 8, 'latin1');
  return Buffer.concat([head, ...parts]);
}
function webpRead(buf) {
  const chunks = webpChunks(buf);
  if (!chunks) return null;
  const c = chunks.find((x) => x.id === 'XMP ');
  return c ? c.data.toString('utf8') : null;
}

// -- png: an iTXt chunk keyed XML:com.adobe.xmp, placed BEFORE the first
//    IDAT — libvips (sharp) only surfaces text chunks it met ahead of the
//    pixel data, so a packet parked at the end reads back as nothing there.
//    Reading accepts the compressed zTXt libvips itself writes.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function pngChunks(buf) {
  const chunks = [];
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.slice(p + 4, p + 8).toString('latin1');
    const end = p + 12 + len;
    if (end > buf.length) return null;
    chunks.push({ type, data: buf.slice(p + 8, p + 8 + len) });
    p = end;
    if (type === 'IEND') break;
  }
  return chunks;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const isXmpText = (c) => (c.type === 'iTXt' || c.type === 'zTXt')
  && c.data.slice(0, XMP_KEY.length + 1).toString('latin1') === XMP_KEY + '\0';
function pngStamp(buf, xmp) {
  const chunks = pngChunks(buf);
  if (!chunks || chunks[chunks.length - 1].type !== 'IEND') return buf;
  const kept = chunks.filter((c) => !isXmpText(c));
  const data = Buffer.concat([
    Buffer.from(XMP_KEY + '\0\0\0\0\0', 'latin1'),   // keyword, flag, method, lang, translated
    Buffer.from(xmp, 'utf8'),
  ]);
  const out = [buf.slice(0, 8)];
  let placed = false;
  for (const c of kept) {
    if (!placed && (c.type === 'IDAT' || c.type === 'IEND')) { out.push(pngChunk('iTXt', data)); placed = true; }
    out.push(pngChunk(c.type, c.data));
  }
  return Buffer.concat(out);
}
function pngRead(buf) {
  const chunks = pngChunks(buf);
  if (!chunks) return null;
  const c = chunks.find(isXmpText);
  if (!c) return null;
  if (c.type === 'zTXt') {
    // keyword\0 method <zlib text>
    const z = c.data.slice(XMP_KEY.length + 2);
    return require('zlib').inflateSync(z).toString('utf8');
  }
  // keyword\0 flag method lang\0 translated\0 text
  const flag = c.data[XMP_KEY.length + 1];
  let p = XMP_KEY.length + 1 + 2;
  p = c.data.indexOf(0, p) + 1;                      // past the language tag
  p = c.data.indexOf(0, p) + 1;                      // past the translated keyword
  if (p <= 0) return null;
  const text = c.data.slice(p);
  return (flag ? require('zlib').inflateSync(text) : text).toString('utf8');
}

// -- jpeg: an APP1 segment with the Adobe XMP signature, right after the
//    leading APP segments (APP0/JFIF, APP1/EXIF stay where they are).
function jpegSegments(buf) {
  const segs = [];
  let p = 2;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xFF) return null;
    const marker = buf[p + 1];
    if (marker === 0xDA || marker === 0xD9) break;   // scan data / end: stop walking
    const len = buf.readUInt16BE(p + 2);
    const end = p + 2 + len;
    if (end > buf.length) return null;
    segs.push({ marker, start: p, end, data: buf.slice(p + 4, end) });
    p = end;
  }
  return segs;
}
const isXmpSeg = (s) => s.marker === 0xE1 && s.data.slice(0, JPEG_XMP_SIG.length).toString('latin1') === JPEG_XMP_SIG;
function jpegStamp(buf, xmp) {
  const segs = jpegSegments(buf);
  if (!segs) return buf;
  const payload = Buffer.concat([Buffer.from(JPEG_XMP_SIG, 'latin1'), Buffer.from(xmp, 'utf8')]);
  if (payload.length + 2 > 65533) return buf;
  const head = Buffer.alloc(4);
  head[0] = 0xFF; head[1] = 0xE1; head.writeUInt16BE(payload.length + 2, 2);
  const seg = Buffer.concat([head, payload]);
  // Rebuild the leading segments minus any old XMP, then the new one goes
  // after the last APPn among them, before everything else.
  const kept = segs.filter((s) => !isXmpSeg(s));
  let after = 0;                                     // index in kept: insert after this many
  for (const s of kept) { if (s.marker >= 0xE0 && s.marker <= 0xEF) after++; else break; }
  const parts = [buf.slice(0, 2)];
  kept.forEach((s, i) => {
    parts.push(buf.slice(s.start, s.end));
    if (i + 1 === after) parts.push(seg);
  });
  if (after === 0) parts.push(seg);
  const tailFrom = segs.length ? segs[segs.length - 1].end : 2;
  parts.push(buf.slice(tailFrom));
  return Buffer.concat(parts);
}
function jpegRead(buf) {
  const segs = jpegSegments(buf);
  if (!segs) return null;
  const s = segs.find(isXmpSeg);
  return s ? s.data.slice(JPEG_XMP_SIG.length).toString('utf8') : null;
}

// ── the two doors ───────────────────────────────────────────────────────────

/**
 * Write the fields into the file. Returns the SAME buffer when there is
 * nothing to write, the format is not one of the three, or the file is
 * malformed — a stamp is a courtesy and must never cost a save.
 */
function stamp(buf, fields) {
  try {
    const xmp = packet(fields);
    if (!xmp) return buf;
    switch (kindOf(buf)) {
      case 'webp': return webpStamp(buf, xmp);
      case 'png': return pngStamp(buf, xmp);
      case 'jpeg': return jpegStamp(buf, xmp);
      default: return buf;
    }
  } catch (e) { return buf; }
}

/** The raw packet string, or null. */
function readPacket(buf) {
  try {
    switch (kindOf(buf)) {
      case 'webp': return webpRead(buf);
      case 'png': return pngRead(buf);
      case 'jpeg': return jpegRead(buf);
      default: return null;
    }
  } catch (e) { return null; }
}

/** The fields, or null. */
function read(buf) {
  return parsePacket(readPacket(buf));
}

/**
 * Scan a fragment of a file for the packet — for a ranged read where the
 * container walk cannot run (the head is missing). The packet delimits
 * itself, so the fragment is enough as long as it holds the whole thing.
 */
function readFragment(buf) {
  const s = buf.toString('utf8');
  const a = s.indexOf('<x:xmpmeta');
  const b = s.indexOf('</x:xmpmeta>');
  if (a < 0 || b < 0 || b < a) return null;
  return parsePacket(s.slice(a, b + 12));
}

/**
 * Read the packet off a hosted file without downloading it: the TAIL for
 * webp/png (the chunk is appended), the HEAD for jpeg. Best-effort — any
 * failure answers null, because this is a hint on the filing path.
 */
async function readRemote(url, { fetchFn = global.fetch, timeoutMs = 6000, bytes = 65536 } = {}) {
  if (!fetchFn || !/^https?:\/\//.test(String(url || ''))) return null;
  const get = async (range) => {
    const r = await fetchFn(url, { headers: { Range: range }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok && r.status !== 206) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 8 * bytes ? null : b;                 // a server that ignored the Range
  };
  try {
    const tail = await get(`bytes=-${bytes}`);
    const hit = tail && (read(tail) || readFragment(tail));
    if (hit) return hit;
    const head = await get(`bytes=0-${bytes - 1}`);
    return head ? (read(head) || readFragment(head)) : null;
  } catch (e) { return null; }
}

/** The Assets-tab halves out of a packet, dropped when empty. */
function promptHalves(meta) {
  const out = {};
  if (meta && meta.promptStyle) out.promptStyle = String(meta.promptStyle).slice(0, 1500);
  if (meta && meta.promptContent) out.promptContent = String(meta.promptContent).slice(0, 1500);
  return out;
}
/** The MODEL · QUALITY · SIZE caption a packet describes, or ''. */
function caption(meta) {
  if (!meta) return '';
  return [meta.model, meta.quality, meta.size].filter(Boolean).join(' · ');
}

module.exports = { promptHalves, caption, stamp, read, readPacket, readFragment, readRemote, packet, parsePacket, kindOf, FIELDS, NS };
